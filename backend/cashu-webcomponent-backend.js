import { CashuMint, CashuWallet, getEncodedToken } from '@cashu/cashu-ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from "crypto";

const wallets = {};

function sanitizeToken(token) {
	var re = /[0-9A-Fa-f]{6}/g;
	if (re.test(token)) {
		return token;
	} else {
		return null;
	}
}

class CashuWebcomponentBackend {
	
	constructor(webManager, storageManager, mints = []) {
		this.storageManager = storageManager;
		this.payments = {};
		this.receiveFunc = null;
		const cashuInstance = this;
		
		for (let i = 0; i < mints.length; i++) {
			wallets[mints[i]] = new CashuWallet(new CashuMint(mints[i]));
		}
		
		webManager.registerGetEndpoint("/cashu-webcomponent/mints", async (query) => {
			return {data: mints};
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/payinfo", async (query) => {
			let id = query.id;
			let payment = cashuInstance.payments[id];
			if (payment === undefined) {
				return {code: 400};
			}
			
			return ({data: {amount: payment.amount, maxtimes: payment.maxtimes}});
		});
		
		webManager.registerGetEndpoint("/cashu-webcomponent/pay", async (query) => {
			if (!this.receiveFunc) return {code: 500};
			let mint = query.mint;
			if (!mints.includes(mint)) {
				return {code: 400};
			}
			let cashutoken = query.cashutoken;
			let recieveResponse;
			try {
				recieveResponse = await wallets[mint].receive(cashutoken);
			} catch (err) {
				console.log(err);
				return {code: 400};
			}
			let id = query.id;
			let payment = cashuInstance.payments[id];
			if (payment === undefined) {
				return {data: {cashutoken: cashutoken}};
			}
			let proofs = [];
			let amntTot = 0;
			for (let i = 0; i < recieveResponse.token.token.length; i++) {
				let tokenEntry = recieveResponse.token.token[i];
				for (let j = 0; j < tokenEntry.proofs.length; j++) {
					let proof = tokenEntry.proofs[j];
					amntTot += proof.amount;
				}
			}
			let sertoken = getEncodedToken(recieveResponse.token);
			
			if (amntTot === payment.amount) {
				const token = crypto.randomBytes(32).toString('hex');
				await this.storageManager.addToken(id, token);
				this.receiveFunc(sertoken);
				return ({data: {token: token}});
			} else {
				return ({data: {cashutoken: sertoken}});
			}
			
		});
		
	}
	
	addPayment(id, data) {
		
		this.payments[id] = data;
		
	}
	
	onReceive(func) {
		
		this.receiveFunc = func;
		
	}
	
	async getTokenType(token) {
		if (!sanitizeToken(token)) return null;
		return await this.storageManager.getTokenType(token);
	}
	
}

// You can implement your own StorageManager or WebManager for your own use cases by following these as templates

// Here you must implement addToken and getTokenType
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
	
	async addToken(type, token) {
		let tokendata = await this.readObjectFile(this.storageLocation + "/tokens.json");
		tokendata[token] = type;
		await this.writeObjectFile(this.storageLocation + "/tokens.json", tokendata);
	}

	async getTokenType(token) {
		let tokendata = await this.readObjectFile(this.storageLocation + "/tokens.json");
		if (tokendata[token]) return tokendata[token];
		return null; //return null if the token does not exist on the server.
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
