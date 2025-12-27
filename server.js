import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// ----------- WHATSAPP VERIFY -----------
app.get("/webhook", (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verify_token) {
        console.log("Webhook verified successfully!");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ----------- RECEIVE MESSAGES ----------
app.post("/webhook", async (req, res) => {
    try {
        const entry = req.body.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];

        if (message) {
            const from = message.from;
            const text = message.text?.body;

            console.log("📩 Received:", text, "from", from);

            // AUTO-REPLY FOR NOW (later we insert AI)
            await sendWhatsAppMessage(from, "🦷 Dental Bot: Καλησπέρα! Λάβαμε το μήνυμά σας 🙂\nΑπαντώ με AI μόλις ολοκληρώσουμε webhook setup.");
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Error handling webhook →", err);
        res.sendStatus(500);
    }
});

// -------- SEND MESSAGE FUNCTION --------
async function sendWhatsAppMessage(to, text) {
    return axios({
        method: "POST",
        url: `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        data: {
            messaging_product: "whatsapp",
            to,
            text: { body: text }
        }
    });
}

// -------------- SERVER -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
