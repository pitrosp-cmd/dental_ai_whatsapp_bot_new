import express from "express";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
app.use(bodyParser.json());

// ---------------- DB -----------------
const db = new sqlite3.Database("./messages.db", (err) => {
    if (err) console.error("DB error:", err);
    else console.log("SQLite database connected.");
});

db.run(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_number TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

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

            // Store to DB
            db.run(`INSERT INTO messages (from_number, message) VALUES (?, ?)`, [from, text]);

            // AUTO REPLY (test)
            await sendWhatsAppMessage(from, "Your message was received: " + text);
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
