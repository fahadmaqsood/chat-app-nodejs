import express from 'express';

const router = express.Router();


router.post('/webhook', (req, res) => {
    const body = req.body;

    // Log the incoming webhook event
    console.log("Webhook event received:", JSON.stringify(body, null, 2));


    if (body.object === "whatsapp_business_account") {
        body.entry.forEach((entry) => {
            const changes = entry.changes;

            changes.forEach((change) => {
                if (change.value.messages) {
                    const messages = change.value.messages;
                    messages.forEach((message) => {
                        console.log("New message received:", message);
                    });
                }
            });
        });

        // Respond to acknowledge receipt of the event
        res.status(200).send("Event received");
    } else {
        // Respond with '404 Not Found' if the object is not as expected
        res.status(404).send("Not Found");
    }
});


// Your verify token
const VERIFY_TOKEN = "khompichiki-khompichiki-khompichiki-khom-khom-khom-khom";


// route to redeem a subscription code
router.get('/webhook', (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Verify the token
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        res.status(200).send(challenge); // Send back the challenge token from Facebook
    } else {
        res.status(403).send("Forbidden"); // Respond with '403 Forbidden' if token doesn't match
    }
});



export default router;
