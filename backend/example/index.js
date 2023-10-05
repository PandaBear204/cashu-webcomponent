import express from "express"; //express.js
import CashuWebcomponentBackend, { ExpressWebManager, FileStorageManager } from "../cashu-webcomponent-backend.js";

//setup express server
const app = express();

//serve html files
app.use(express.static("../../"));

app.get("/test", (req, res) => {
  res.send("Healthy");
});

const PORT = 8000;

//initialize cashu stuff
//you can implement your own webmanager and storagemanager - see docs
//note that removing a mint that the website previously supported will require you to manually transfer user funds to a different mint, as they will no longer have access to them.
const cashu = new CashuWebcomponentBackend(new ExpressWebManager(app), new FileStorageManager("/cashu/test"), ["https://8333.space:3338"]);

//Receive serialized cashu tokens from users making payments.
//This should hook into your cashu wallet or be saved somewhere for someone to manually receive to a wallet.
cashu.onReceive((cashutoken) => {
	console.log("Cashu token received: " + cashutoken);
});

//One time payment id "paywall" for 1 sat. If this is repeated elsewhere, it will update the price.
cashu.addPayment("paywall", {amount: 1, maxtimes: 1}); 

//Repeatable payment id "counter" for 1 sat. If this is repeated elsewhere, it will update the price.
cashu.addPayment("counter", {amount: 1});

//add paywalled endpoint for frontend to use
app.get("/paywall", async (req, res) => {
	let paid = await cashu.getTokenType(req.query.token) === "paywall";
	if (paid) {
		res.send({text: "You have paid the example payment, i.e. some paywalled content is shown."});
	} else {
		res.sendStatus(401);
	}
});

//open express server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});