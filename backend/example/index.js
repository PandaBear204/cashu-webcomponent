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
//the final argument is the cashu UID of the admin user, where all paid funds land. This should be stored securely and not plainly in the code like in this example.
const cashu = new CashuWebcomponentBackend(new ExpressWebManager(app), new FileStorageManager("/cashu/test"), ["https://8333.space:3338"], "72c85258e72196eb7d5f4a44fb7844cafe650a3d2ef649f6c79e80432c105430");

//One time payment id "paywall" for 1 sat. If this is repeated elsewhere, it will update the price.
cashu.addPayment("paywall", {amount: 1, maxtimes: 1}); 

//Repeatable payment id "counter" for 1 sat. If this is repeated elsewhere, it will update the price.
cashu.addPayment("counter", {amount: 1});

//add paywalled endpoints for frontend to use
app.get("/paywall", async (req, res) => {
	let timespaid = await cashu.getTimesPaid(req.query.uid, "paywall");
	if (timespaid > 0) {
		res.send({text: "You have paid the example payment, i.e. some paywalled content is shown."});
	} else {
		res.sendStatus(401);
	}
});

app.get("/timespaid", async (req, res) => {
	let timespaid = await cashu.getTimesPaid(req.query.uid, "counter");
	res.send({text: timespaid});
});

//open express server
app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});