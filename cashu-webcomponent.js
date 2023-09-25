let _IsCashuLoading = false;

const toHexString = (bytes) => {
  return Array.from(bytes, (byte) => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
};

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const cashuOnPays = [];
window["addCashuOnPay"] = function(func) {
	cashuOnPays.push(func);
};


let _id, _selectedMint, _mints, _balance = null;
const _cashuUrl = window.location.protocol + "//" + window.location.host + "/cashu-webcomponent";

const cashuElements = [];

const cashuStyle = window["cashuStyleCSS"] ? window["cashuStyleCSS"] : 
`
	.wrapper {
		font-family: sans-serif;
		position: relative;
		display: flex; 
		flex-direction: row;
		background-color: #202124;
		border-color: white;
		border-width: 1px;
		border-style: dashed;
	}
	.wrapperBig {
		height: 90px;
		width: 210px;
	}
	.wrapperSmall {
		height: 35px;
		width: 210px;
	}
	.text {
		margin: 4px;
		color: gray;
	}
	.bold {
		font-weight:700;
	}
	.small {
		font-size: 10px;
	}
	.medium {
		font-size: 16px;
	}
	.big {
		font-size: 24px;
	}
	.importanttext {
		color: orange; 
	}
	.black {
		color: black;
	}
	.watermark {
		margin: 4px;
		position: absolute;
		bottom: 0;
		right: 0;
		color: gray;
		font-size: 10px;
	}
	.errorHolder {
		position: absolute;
		width: 100%;
		height: 100%;
	}
	.overlay {
		position: absolute;
		width: 100%;
		height: 100%;
		background-color: #ffffff;
		opacity: 0.9;
	    display: flex;
	    align-items: center; 
	    justify-content: center;
	}
	.center {
		margin: auto;
		text-align: center;
	}
	.select {
		width: 120px;
	}
	.button {
		margin: 4px;
	}
	.modal {
		overflow-wrap: anywhere;
		display: none; /* Hidden by default */
		position: fixed; /* Stay in place */
		z-index: 1; /* Sit on top */
		left: 0;
		top: 0;
		width: 100%; /* Full width */
		height: 100%; /* Full height */
		overflow: auto; /* Enable scroll if needed */
		background-color: rgb(0,0,0); /* Fallback color */
		background-color: rgba(0,0,0,0.4); /* Black w/ opacity */
	}

	/* The Close Button */
	.close {
		float: right;
		font-size: 28px;
		font-weight: bold;
	}

	.close:hover,
	.close:focus {
		color: black;
		text-decoration: none;
		cursor: pointer;
	}
	.modal-header {
		padding: 2px 16px;
		background-color: gray;
	}

	/* Modal Body */
	.modal-body {padding: 16px;}
	.modal-body textarea {width: 100%; height: 50px; box-sizing: border-box; resize: vertical;}
	.modal-body button {width: 100%; height: 25px;}
	.modal-body p {margin: 0px 0px 8px 0px;}

	/* Modal Content */
	.modal-content {
		position: relative;
		background-color: #202124;
		margin: auto;
		padding: 0;
		border: 1px solid #888;
		width: 80%;
		box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19);
		animation-name: animatetop;
		animation-duration: 0.4s;
		color: white;
	}

	/* Add Animation */
	@keyframes animatetop {
		from {top: -300px; opacity: 0}
		to {top: 0; opacity: 1}
	}
	
	button {
		border: none;
		border-radius: 4px;
		background-color: orange;
		color: white;
	}
	
	button:hover {
		color: orange;
		background-color: white;
		cursor: pointer;
	}
	
	button:active {
		background-color: gray;
		color: white;
	}
	
	textarea {
		border: 2px solid orange;
		color: white;
		border-radius: 4px;
		background-color: orange;
		font-size: 16px;
		resize: none;
	}
	
`;

//Can display errors and info on cashu webcomponents
function overlay(icon, message) {
	const overlay = document.createElement("div");
	overlay.setAttribute("class", "overlay");
	
	const symbol = document.createElement("p");
	symbol.setAttribute("class", "center text black medium");
	symbol.innerHTML = icon;
	overlay.appendChild(symbol);

	const errorElement = document.createElement("p");
	errorElement.setAttribute("class", "center text black medium bold");
	errorElement.innerHTML = message;
	overlay.appendChild(errorElement);
	
	return overlay;
}

function setLoading(loading) {
	for (let i = 0; i < cashuElements.length; i++) {
		setLoadingComponent(cashuElements[i], loading);
	}
}

function setLoadingComponent(component, loading) {
	if (component.error) return;
	if (loading) {
		component.errorHolder.innerHTML = "";
		component.errorHolder.appendChild(overlay("↻", "Loading..."));
		component.errorHolder.setAttribute("style", "display: block;");
	} else {
		component.errorHolder.innerHTML = "";
		component.errorHolder.setAttribute("style", "display: none;");
	}
}

function setErrorOne(component, error) {
	component.error = true;
	component.errorHolder.innerHTML = "";
	component.errorHolder.appendChild(overlay("⚠", error));
	component.errorHolder.setAttribute("style", "display: block;");
}

function setError(error) {
	for (let i = 0; i < cashuElements.length; i++) {
		setErrorOne(cashuElements[i], error);
	}
}

function loadCashu(force = false) {
	setLoading(true);
	
	//Get cashu UID
	if (force || _id === null) {
		_id = window.localStorage.getItem("cashu-webcomponent-uid");
		if (_id === null) {
			const newid = new Uint8Array(32);
			crypto.getRandomValues(newid);
			_id = toHexString(newid);
		}
		window.localStorage.setItem("cashu-webcomponent-uid", _id);
	}
	
	//Check if there are unloaded balances
	let unloadedBalances = _balance === null;
	if (!unloadedBalances) for (let i = 0; i < cashuElements.length; i++) {
		if (cashuElements[i].balance === undefined) continue;
		if (!cashuElements[i].loaded) {
			unloadedBalances = true;
			break;
		}
	}
	
	if (force || unloadedBalances) {
		
		_selectedMint = window.localStorage.getItem("cashu-webcomponent-selectedmint");

		//Fetch a list of mints from the server
		fetch(_cashuUrl + "/mints").then(function(response) {
			return response.json();
		}).then(function(data) {
			_mints = data;
			if (_mints.length === 0) {
				setError("Server has no mints");
				return;
			}
			//Determine which mint is selected
			if (_selectedMint === null || !_mints.includes(_selectedMint)) {
				_selectedMint = _mints[0];
			}
			window.localStorage.setItem("cashu-webcomponent-selectedmint", _selectedMint);
			//Populate mint pickers with mints
			for (let i = 0; i < cashuElements.length; i++) {
				if (cashuElements[i].mintSelect === undefined) continue;
				cashuElements[i].mintSelect.innerHTML = "";
				for (let j = 0; j < _mints.length; j++) {
					const option = document.createElement("option");
					option.text = _mints[j];
					cashuElements[i].mintSelect.appendChild(option);
				}
				cashuElements[i].mintSelect.selectedIndex = _mints.indexOf(_selectedMint);
			}
			//Fetch our balance for this mint from the server
			fetch(_cashuUrl + "/balance?uid=" + _id + "&mint=" + encodeURIComponent(_selectedMint)).then(function(response) {
				return response.json();
			}).then(function(data) {
				_balance = data.balance;
				//Populate components with balances
				for (let i = 0; i < cashuElements.length; i++) {
					if (cashuElements[i].balance !== undefined)  {
						cashuElements[i].balance.innerHTML = numberWithCommas(_balance);
						setLoadingComponent(cashuElements[i], false);
					}
				}
			}).catch(function(err) {
				console.log("Cannot fetch", err);
			});
		}).catch(function(err) {
			console.log("Cannot fetch", err);
		});
		
	//Reset loading on all components with balances
	} else { for (let i = 0; i < cashuElements.length; i++) if (cashuElements[i].balance !== undefined) setLoadingComponent(cashuElements[i], false); }
	
	//Check if there are unloaded cashu pays
	let unloadedPays = false;
	for (let i = 0; i < cashuElements.length; i++) {
		if (cashuElements[i].componentCashuId === undefined) continue;
		if (!cashuElements[i].loaded) {
			unloadedPays = true;
			break;
		}
	}
	
	if (force || unloadedPays) {
		for (let i = 0; i < cashuElements.length; i++) {
			if (cashuElements[i].componentCashuId === undefined) continue;
			fetch(_cashuUrl + "/payinfo?uid=" + _id + "&id=" + encodeURIComponent(cashuElements[i].componentCashuId)).then(function(response) {
				return response.json();
			}).then(function(data) {
				cashuElements[i].timesPaid = data.timespaid;
				cashuElements[i].payInt = data.amount;
				cashuElements[i].payAmount.innerHTML = numberWithCommas(data.amount);
				if (data.done) {
					setErrorOne(cashuElements[i], "Already paid");
				} else {
					setLoadingComponent(cashuElements[i], false);
				}
			}).catch(function(err) {
				console.log("Cannot fetch", err);
			});
		}
	}
	
}

loadCashu(true);

function getModal(title, shadowRoot, easyclose = true) {
	const modal = document.createElement("div");
	modal.setAttribute("class", "modal");
	
	const modalContent = document.createElement("div");
	modalContent.setAttribute("class", "modal-content");
	
	const modalHeader = document.createElement("div");
	modalHeader.setAttribute("class", "modal-header");
	
	const modalClose = document.createElement("span");
	modalClose.setAttribute("class", "close");
	modalClose.innerHTML = "&times;";
	modalHeader.appendChild(modalClose);
	
	const modalTitle = document.createElement("h2");
	modalTitle.innerHTML = title;
	modalHeader.appendChild(modalTitle);
	
	modalContent.appendChild(modalHeader);
	
	const modalBody = document.createElement("div");
	modalBody.setAttribute("class", "modal-body");
	
	modalContent.appendChild(modalBody);
	
	modal.appendChild(modalContent);
	
	modalClose.addEventListener("click", () => {
		modal.setAttribute("style", "display: none;");
	});
	
	if (easyclose) shadowRoot.addEventListener("click", function(event) {
		if (event.target === modal) {
			modal.setAttribute("style", "display: none;");
		}
	});
	
	return {modal, modalBody};
}

class CashuManager extends HTMLElement {
  constructor() {
    super();
  }
  
  connectedCallback() {
	
	this.loaded = false;
	
	this.attachShadow({ mode: "open" });
	// Create (nested) span elements
	let wrapper = document.createElement("div");
	wrapper.setAttribute("class", "wrapper wrapperBig");
	
	this.errorHolder = document.createElement("div");
	this.errorHolder.setAttribute("class", "errorHolder");
	this.errorHolder.setAttribute("style", "display: none;");
	
	const watermark = document.createElement("p");
	watermark.setAttribute("class", "watermark");
	watermark.innerHTML = "Cashu Web";
	wrapper.appendChild(watermark);

	const left = document.createElement("div");
	left.setAttribute("style", "flex: 2;");
	
	const balInfo = document.createElement("p");
	balInfo.setAttribute("class", "text bold small importanttext");
	balInfo.innerHTML = "Balance";
	left.appendChild(balInfo);
	
	const balWrapper = document.createElement("p");
	balWrapper.setAttribute("class", "text bold importanttext");
	
	this.balance = document.createElement("span");
	this.balance.setAttribute("class", "big");
	this.balance.innerHTML = "...";
	balWrapper.appendChild(this.balance);
	
	const balDenom = document.createElement("span");
	balDenom.setAttribute("class", "small");
	balDenom.setAttribute("style", "margin-left:4px;")
	balDenom.innerHTML = "sats";
	balWrapper.appendChild(balDenom);
	
	left.appendChild(balWrapper);
	
	const mintInfo = document.createElement("p");
	mintInfo.setAttribute("class", "text bold small");
	mintInfo.innerHTML = "Mint";
	left.appendChild(mintInfo);
	
	this.mintSelect = document.createElement("select");
	this.mintSelect.setAttribute("class", "text black small select");
	this.mintSelect.addEventListener("change", () => {
		_selectedMint = _mints[this.mintSelect.selectedIndex];
		window.localStorage.setItem("cashu-webcomponent-selectedmint", _selectedMint);
		loadCashu(true);
		
	});
	left.appendChild(this.mintSelect);
	
	wrapper.appendChild(left);
	
	const right = document.createElement("div");
	right.setAttribute("style", "flex: 1;text-align: center;");
	
	const depositModalGot = getModal("Deposit", this.shadowRoot);
	const depositModal = depositModalGot.modal;
	const depositModalBody = depositModalGot.modalBody;
	
	const depositModalText = document.createElement("p");
	depositModalBody.appendChild(depositModalText);
	
	const depositModalArea = document.createElement("textarea");
	depositModalBody.appendChild(depositModalArea);
	
	const depositModalConfirm = document.createElement("button");
	depositModalConfirm.innerHTML = "Deposit";
	depositModalConfirm.addEventListener("click", () => {
		depositModal.setAttribute("style", "display: none;");
		setLoading(true);
		fetch(_cashuUrl + "/deposit?uid=" + _id + "&mint=" + encodeURIComponent(_selectedMint) + "&token=" + encodeURIComponent(depositModalArea.value)).then(function(response) {
			loadCashu(true);
		}).catch(function(err) {
			console.log("Cannot fetch", err);
			setLoading(false);
		});
	});
	depositModalBody.appendChild(depositModalConfirm);
	
	wrapper.appendChild(depositModal);
	
	const deposit = document.createElement("button");
	deposit.innerHTML = "Deposit";
	deposit.setAttribute("class", "button");
	deposit.addEventListener("click", () => {
		depositModalArea.value = "";
		depositModalText.innerHTML = "Enter a Cashu token on " + _selectedMint;
		depositModal.setAttribute("style", "display: block;");
	});
	
	right.appendChild(deposit);
	
	const tokenModalGot = getModal("Withdraw", this.shadowRoot, false);
	const tokenModal = tokenModalGot.modal;
	const tokenModalBody = tokenModalGot.modalBody;
	
	const tokenModalText = document.createElement("p");
	tokenModalBody.appendChild(tokenModalText);
	
	wrapper.appendChild(tokenModal);
	
	const withdrawModalGot = getModal("Withdraw", this.shadowRoot);
	const withdrawModal = withdrawModalGot.modal;
	const withdrawModalBody = withdrawModalGot.modalBody;
	
	const withdrawModalText = document.createElement("p");
	withdrawModalBody.appendChild(withdrawModalText);
	
	const withdrawModalArea = document.createElement("textarea");
	withdrawModalBody.appendChild(withdrawModalArea);
	
	const withdrawModalConfirm = document.createElement("button");
	withdrawModalConfirm.innerHTML = "Withdraw";
	withdrawModalConfirm.addEventListener("click", () => {
		withdrawModal.setAttribute("style", "display: none;");
		setLoading(true);
		fetch(_cashuUrl + "/withdraw?uid=" + _id + "&mint=" + encodeURIComponent(_selectedMint) + "&amount=" + encodeURIComponent(withdrawModalArea.value)).then(function(response) {
			return response.json();
		}).then(function(data) {
			tokenModalText.innerHTML = "Cashu token for " + withdrawModalArea.value + " sats. <b>IF YOU DO NOT SAVE THIS TOKEN BEFORE CLOSING THE WINDOW, THESE SATS WILL BE LOST.</b><br></br><br></br>" + data.token;
			tokenModal.setAttribute("style", "display: block;");
			loadCashu(true);
		}).catch(function(err) {
			console.log("Cannot fetch", err);
			setLoading(false);
		});
	});
	withdrawModalBody.appendChild(withdrawModalConfirm);
	
	wrapper.appendChild(withdrawModal);
	
	const withdraw = document.createElement("button");
	withdraw.innerHTML = "Withdraw";
	withdraw.setAttribute("class", "button");
	withdraw.addEventListener("click", () => {
		withdrawModalArea.value = "";
		withdrawModalText.innerHTML = "Enter amount in sats to withdraw on " + _selectedMint + " (max: " + numberWithCommas(_balance) + ")";
		withdrawModal.setAttribute("style", "display: block;");
	});
	
	right.appendChild(withdraw);
	
	wrapper.appendChild(right);
	
	wrapper.appendChild(this.errorHolder);
	
	//CSS to apply to the shadow DOM
	const style = document.createElement("style");
	style.textContent = cashuStyle;

	// attach the created elements to the shadow DOM
	this.shadowRoot.append(style, wrapper);
	
	//cashu
	cashuElements.push(this);
	setLoadingComponent(this, true);
	loadCashu(false);
	
  }
  
}

customElements.define("cashu-manager", CashuManager);

class CashuPay extends HTMLElement {
  constructor() {
    super();
  }
  
  connectedCallback() {
	  
	this.loaded = false;
	
	this.attachShadow({ mode: "open" });
	// Create (nested) span elements
	let wrapper = document.createElement("div");
	wrapper.setAttribute("class", "wrapper wrapperSmall");
	
	this.errorHolder = document.createElement("div");
	this.errorHolder.setAttribute("class", "errorHolder");
	this.errorHolder.setAttribute("style", "display: none;");
	
	const watermark = document.createElement("p");
	watermark.setAttribute("class", "watermark");
	watermark.innerHTML = "Cashu Web";
	wrapper.appendChild(watermark);
	
	const balWrapper = document.createElement("p");
	balWrapper.setAttribute("class", "text bold importanttext");
		
	const payInfo = document.createElement("span");
	payInfo.setAttribute("class", "text bold small importanttext");
	payInfo.innerHTML = "Pay";
	balWrapper.appendChild(payInfo);
	
	this.payAmount = document.createElement("span");
	this.payAmount.setAttribute("class", "big");
	this.payAmount.innerHTML = "...";
	balWrapper.appendChild(this.payAmount);
	
	const balDenom = document.createElement("span");
	balDenom.setAttribute("class", "small");
	balDenom.setAttribute("style", "margin-left:4px;")
	balDenom.innerHTML = "sats";
	balWrapper.appendChild(balDenom);
	
	wrapper.appendChild(balWrapper);
	
	let buttonPay = document.createElement("button");
	buttonPay.setAttribute("style", "margin: 4px;")
	buttonPay.innerHTML = "Pay";
	wrapper.appendChild(buttonPay);
	
	const depositModalGot = getModal("Pay", this.shadowRoot);
	const depositModal = depositModalGot.modal;
	const depositModalBody = depositModalGot.modalBody;
	
	const depositModalText = document.createElement("p");
	
	depositModalBody.appendChild(depositModalText);
	
	const depositModalArea = document.createElement("textarea");
	depositModalBody.appendChild(depositModalArea);
	
	const depositModalConfirm = document.createElement("button");
	depositModalConfirm.innerHTML = "Pay";
	depositModalBody.appendChild(depositModalConfirm);
	
	wrapper.appendChild(depositModal);
	
	wrapper.appendChild(this.errorHolder);
	
	// Create some CSS to apply to the shadow DOM
	const style = document.createElement("style");
	style.textContent = cashuStyle;

	// attach the created elements to the shadow DOM
	this.shadowRoot.append(style, wrapper);
	
	//cashu
	if (!this.hasAttribute("cashu-id")) {
		setErrorOne(this, "cashu-pay with no cashu-id");
		return;
	} else {
		this.componentCashuId = this.getAttribute("cashu-id");
		const currentComponent = this;
		const payfunction = () => {
			setLoading(true);
			fetch(_cashuUrl + "/pay?uid=" + _id + "&mint=" + encodeURIComponent(_selectedMint) + "&id=" + encodeURIComponent(currentComponent.componentCashuId)).then(function(response) {
				if (response.status === 402) {
					setLoading(false);
					depositModalArea.value = "";
					depositModalText.innerHTML = "Insufficient balance! Enter a Cashu token on " + _selectedMint + " worth at least " + numberWithCommas(currentComponent.payInt - _balance) + " sats";
					depositModal.setAttribute("style", "display: block;");
				} else {
					loadCashu(true);
					for (let i = 0; i < cashuOnPays.length; i++) {
						cashuOnPays[i](currentComponent.componentCashuId);
					}
				}
			}).catch(function(err) {
				console.log("Cannot fetch", err);
			});
		};
		buttonPay.addEventListener("click", payfunction);
		
		depositModalConfirm.addEventListener("click", () => {
			depositModal.setAttribute("style", "display: none;");
			setLoading(true);
			fetch(_cashuUrl + "/deposit?uid=" + _id + "&mint=" + encodeURIComponent(_selectedMint) + "&token=" + encodeURIComponent(depositModalArea.value)).then(function(response) {
				payfunction();
			}).catch(function(err) {
				console.log("Cannot fetch", err);
				setLoading(false);
			});
		});
	}
	
	cashuElements.push(this);
	setLoadingComponent(this, true);
	loadCashu(false);

  }
  
}

customElements.define("cashu-pay", CashuPay);