import { CashuMint, CashuWallet, getEncodedToken } from '@cashu/cashu-ts';
import * as fs from 'fs/promises';
import * as path from 'path';

const wallets = {};

function sanitizeUID(uid) {
	var re = /[0-9A-Fa-f]{6}/g;
	if (re.test(uid)) {
		return uid;
	} else {
		return null;
	}
}

class CashuWebcomponentBackend {
	
	constructor(webManager, storageManager, mints = [], secret) {
		this.storageManager = storageManager;
		this.payments = {};
		this.lockedUsers = [];
		const cashuInstance = this;
		
		for (let i = 0; i < mints.length; i++) {
			wallets[mints[i]] = new CashuWallet(new CashuMint(mints[i]));
		}
		
		webManager.registerGetEndpoint("/cashu-webcomponent/mints", async (query) => {
			return {data: mints};
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/payinfo", async (query) => {
			let uid = sanitizeUID(query.uid);
			if (uid === null) {
				return {code: 400};
			}
			let id = query.id;
			let payment = cashuInstance.payments[id];
			if (payment === undefined) {
				return {code: 400};
			}
			const userData = await cashuInstance.storageManager.getUserData(uid);
			let paymentHistory = [];
			if (userData.paymentHistory !== undefined) {
				paymentHistory = userData.paymentHistory;
			}
			
			let nthis = 0;
			for (let i = 0; i < paymentHistory.length; i++) {
				if (paymentHistory[i] === id) {
					nthis++;
				}
			}
			
			let done = false;
			if (payment.maxtimes !== undefined && nthis >= payment.maxtimes) done = true; 
			
			return ({data: {amount: payment.amount, done: done, timespaid: nthis}});
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/balance", async (query) => {
			let uid = sanitizeUID(query.uid);
			if (uid === null) {
				return {code: 400};
			}
			let mint = query.mint;
			if (!mints.includes(mint)) {
				return {code: 400};
			}
			const userData = await cashuInstance.storageManager.getUserData(uid);
			const balance = (userData.mints !== undefined && userData.mints[mint] !== undefined) ? userData.mints[mint] : 0;
			return {data: {balance}};
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/pay", async (query) => {
			let uid = sanitizeUID(query.uid);
			if (uid === null) {
				return {code: 400};
			}
			await cashuInstance.acquireUserLock(uid);
			let mint = query.mint;
			if (!mints.includes(mint)) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			let id = query.id;
			let payment = cashuInstance.payments[id];
			if (payment === undefined) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			let userData = await cashuInstance.storageManager.getUserData(uid);
			let mintBalance = 0;
			if (userData.mints === undefined) userData.mints = {};
			if (userData.mints[mint] !== undefined) {
				mintBalance = userData.mints[mint];
			}
			let paymentHistory = [];
			if (userData.paymentHistory !== undefined) {
				paymentHistory = userData.paymentHistory;
			}
			let nthis = 0;
			for (let i = 0; i < paymentHistory.length; i++) {
				if (paymentHistory[i] === id) {
					nthis++;
				}
			}
			if (payment.maxtimes !== undefined && nthis >= payment.maxtimes) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			if (mintBalance >= payment.amount) {
				mintBalance -= payment.amount;
				userData.mints[mint] = mintBalance;
				paymentHistory.push(id);
				userData.paymentHistory = paymentHistory;
			} else {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 402}; //402 payment required
			}
			
			await cashuInstance.storageManager.setUserData(uid, userData);
			
			let adminUserData = await cashuInstance.storageManager.getUserData(secret);
			let adminMintBalance = 0;
			if (adminUserData.mints === undefined) adminUserData.mints = {};
			if (adminUserData.mints[mint] !== undefined) {
				adminMintBalance = adminUserData.mints[mint];
			}
			adminMintBalance += payment.amount;
			adminUserData.mints[mint] = adminMintBalance;
			
			await cashuInstance.storageManager.setUserData(secret, adminUserData);
			
			cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
			return {code: 200};
			
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/deposit", async (query) => {
			let uid = sanitizeUID(query.uid);
			if (uid === null) {
				return {code: 400};
			}
			await cashuInstance.acquireUserLock(uid);
			let mint = query.mint;
			if (!mints.includes(mint)) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			let token = query.token;
			let recieveResponse;
			try {
				recieveResponse = await wallets[mint].receive(token);
			} catch (err) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			let proofs = await cashuInstance.storageManager.getProofs();
			let amntTot = 0;
			for (let i = 0; i < recieveResponse.token.token.length; i++) {
				let tokenEntry = recieveResponse.token.token[i];
				for (let j = 0; j < tokenEntry.proofs.length; j++) {
					let proof = tokenEntry.proofs[j];
					amntTot += proof.amount;
					proofs.push(proof);
				}
			}
			
			await cashuInstance.storageManager.setProofs(proofs);
			
			let userData = await cashuInstance.storageManager.getUserData(uid);
			let mintBalance = 0;
			if (userData.mints === undefined) userData.mints = {};
			if (userData.mints[mint] !== undefined) {
				mintBalance = userData.mints[mint];
			}
			mintBalance += amntTot;
			userData.mints[mint] = mintBalance;
			
			await cashuInstance.storageManager.setUserData(uid, userData);
			
			cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
			return {code: 200};
		
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/withdraw", async (query) => {
			let uid = sanitizeUID(query.uid);
			if (uid === null) {
				return {code: 400};
			}
			await cashuInstance.acquireUserLock(uid);
			let mint = query.mint;
			if (!mints.includes(mint)) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			let amount = query.amount;
			let amountInt = parseInt(amount);
			if (isNaN(amountInt)) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			
			let userData = await cashuInstance.storageManager.getUserData(uid);
			let mintBalance = 0;
			if (userData.mints === undefined) userData.mints = {};
			if (userData.mints[mint] !== undefined) {
				mintBalance = userData.mints[mint];
			}
			
			if (amountInt <= 0 || amountInt > mintBalance) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			
			mintBalance -= amountInt;
			userData.mints[mint] = mintBalance;
			await cashuInstance.storageManager.setUserData(uid, userData);
			
			let proofs = await cashuInstance.storageManager.getProofs();
			let sendResponse;
			try {
				sendResponse = await wallets[mint].send(amountInt, proofs);
			} catch (err) {
				cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
				return {code: 400};
			}
			
			await cashuInstance.storageManager.setProofs(sendResponse.returnChange);
			
			let tokenSend = {memo: "Cashu Web withdrawal", token: [{proofs: sendResponse.send, mint: mint}]};
			cashuInstance.lockedUsers.splice(cashuInstance.lockedUsers.indexOf(uid), 1);
			return {data: {token: getEncodedToken(tokenSend)}};
		
		});
		
	}
	
	async acquireUserLock(uid) {
		while (this.lockedUsers.includes(uid)) {
			await new Promise(resolve => setTimeout(resolve, 50));
		}
		this.lockedUsers.push(uid);
	}
	
	addPayment(id, data) {
		
		this.payments[id] = data;
		
	}
	
	async getTimesPaid(uidinput, paymentid) {
		let uid = sanitizeUID(uidinput);
		if (uid === null) return 0;
		const userData = await this.storageManager.getUserData(uid);
		let paymentHistory = [];
		if (userData.paymentHistory !== undefined) {
			paymentHistory = userData.paymentHistory;
		}
		
		let nthis = 0;
		for (let i = 0; i < paymentHistory.length; i++) {
			if (paymentHistory[i] === paymentid) {
				nthis++;
			}
		}
		
		return nthis;
		
	}
	
}

// You can implement your own StorageManager or WebManager for your own use cases by following these as templates

// Here you must implement getUserData, setUserData, getProofs, and setProofs
class FileStorageManager {
	constructor(storageLocation = "/cashu/data") {
		this.storageLocation = storageLocation;
		this.iolock = [];
	}

	async acquireLock(fileName) {
		while (this.iolock.includes(fileName)) {
			await new Promise(resolve => setTimeout(resolve, 5));
		}
		this.iolock.push(fileName);
	}
	
	async readObjectFile(fileName) {
		await this.acquireLock(fileName);
		let data = {};
		try {
			const read = await fs.readFile(fileName);
			data = JSON.parse(read);
		} catch (err) {
			if (err.code !== "ENOENT") console.log(err);
		}
		this.iolock.splice(this.iolock.indexOf(fileName), 1);
		return data;
	}
	
	async writeObjectFile(fileName, object) {
		await this.acquireLock(fileName);
		await fs.mkdir(path.dirname(fileName), {recursive: true});
		await fs.writeFile(fileName, JSON.stringify(object));
		this.iolock.splice(this.iolock.indexOf(fileName), 1);
	}

	async getUserData(uid) {
		return await this.readObjectFile(this.storageLocation + "/" + uid + ".json");
	}

	async setUserData(uid, data) {
		return await this.writeObjectFile(this.storageLocation + "/" + uid + ".json", data);
	}

	async getProofs() {
		return await this.readObjectFile(this.storageLocation + "/proofs/proofs.json");
	}

	async setProofs(proofs) {
		return await this.writeObjectFile(this.storageLocation + "/proofs/proofs.json", proofs);
	}
	
}

// Here you must implement registerGetEndpoint
class ExpressWebManager {
	constructor(expressApp) {
		this.expressApp = expressApp;
	}
	
	registerGetEndpoint(endpoint, func) {
		this.expressApp.get(endpoint, async (req, res) => {
			let result = await func(req.query);
			if (result.code) {
				res.sendStatus(result.code);
			} else if (result.data) {
				res.send(result.data);
			}
		});
	}
	
}

export default CashuWebcomponentBackend;
export { FileStorageManager, ExpressWebManager };
