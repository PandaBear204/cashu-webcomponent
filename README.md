# cashu-webcomponent
![cashu-webcomponent](cashu-web.png)

cashu-webcomponent is a Webcomponent frontend and Node.js backend allowing websites to add simple drop-in functionality for [Cashu](https://github.com/cashubtc) ecash payments.

# Usage
First, install the backend for node.
```bash
npm i --save cashu-webcomponent-backend
```
Then, import cashu-webcomponent
```javascript
import CashuWebcomponentBackend, { ExpressWebManager, FileStorageManager } from "cashu-webcomponent-backend";
```
Initialize cashu, add named payments. If you set the same payment ID multiple times, it will just modify the price and/or maximum amount of times it can be paid.
```javascript
const cashu = new CashuWebcomponentBackend(new ExpressWebManager(app), new FileStorageManager("/cashu/test"), ["https://8333.space:3338"], adminCashuUID);
cashu.addPayment("paywall", {amount: 1, maxtimes: 1});
cashu.addPayment("counter", {amount: 1});
```
You can now add cashu to your frontend by either downloading the script from this repo or referencing it directly
```html
<script src="cashu-webcomponent.js"></script>
```
You can then add the cashu-manager and cashu-pay components to your site
```html
<cashu-manager></cashu-manager>
<cashu-pay cashu-id="counter"></cashu-pay>
<cashu-pay cashu-id="paywall"></cashu-pay>
```
To check if a user has paid a cashu payment, fetch their cashu-webcomponent UID on the frontend via
```javascript
const cashuUID = localStorage.getItem("cashu-webcomponent-uid");
```
You can then pass this to the backend in requests and use
```javascript
let timespaid = await cashu.getTimesPaid(cashuUID, "paywall");
if (timespaid > 0) {
	//do something
}
```
Internally, cashu-webcomponent uses GET endpoints with query parameters, which you can hook into in advanced use cases.
# Install the demo

# Customize
cashu-webcomponent allows you to customize certain features to work best for your use case
### Custom style

### Backend database

### Use your own webserver implementation
Not using express.js? 
