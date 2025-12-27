require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// ==== ENV VARIABLES ====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const DOCTOR_NUMBER = process.env.DOCTOR_NUMBER; //στο WhatsApp format: 35799xxxxxx
const OPENAI_KEY = process.env.OPENAI_KEY;

// ==== temporary user memory ====
let userState = {}; 
// userState[user] = {step:1,name:"",concern:"",budget:""}

async function sendWhatsAppMessage(to, message) {
    await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        data: {
            messaging_product: "whatsapp",
            to,
            text: { body: message }
        }
    });
}

// ==== AI reply helper ====
async function askAI(prompt) {
    try {
        const res = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model:"gpt-4.1-mini",
                messages:[{role:"user",content:prompt}]
            },
            {headers:{Authorization:`Bearer ${OPENAI_KEY}`}}
        );
        return res.data.choices[0].message.content;
    } catch(e){
        return "Αναμένετε λίγο, υπήρξε καθυστέρηση στον server 🙏";
    }
}


// =====================================================
//                   ROUTES
// =====================================================

// Test route
app.get("/", (req,res)=> res.send("Dental AI WhatsApp Bot Active ✔"));

// -------- VERIFY WEBHOOK (GET) --------
app.get("/webhook", (req,res)=>{
    const mode=req.query['hub.mode'];
    const token=req.query['hub.verify_token'];
    const challenge=req.query['hub.challenge'];

    if (mode && token){
        if(mode==="subscribe" && token===VERIFY_TOKEN){
            console.log("Webhook verified 🎉");
            res.status(200).send(challenge);
        } else res.sendStatus(403);
    }
});

// -------- RECEIVE MESSAGES (POST) --------
app.post("/webhook", async (req,res)=>{
    try{
        const entry=req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if(!entry) return res.sendStatus(200);

        const from=entry.from;
        const msg=entry.text?.body?.trim();

        if(!userState[from]) userState[from]={step:1};

        const s=userState[from].step;

        // STEP FLOW -----------------------------------

        if(s===1){
            userState[from].step=2;
            await sendWhatsAppMessage(from,"👋 Καλώς όρισες! Περιμένοντας στο ιατρείο είναι ιδανική στιγμή να σε γνωρίσουμε.\nΠώς σε λένε;");
        }
        else if(s===2){
            userState[from].name=msg;
            userState[from].step=3;
            await sendWhatsAppMessage(from,`Χαίρω πολύ ${msg}! 😊\nΤι σε έφερε σήμερα στον οδοντίατρο;`);
        }
        else if(s===3){
            userState[from].concern=msg;
            userState[from].step=4;
            await sendWhatsAppMessage(from,
                "Υπάρχει κάποια συγκεκριμένη θεραπεία που έχεις στο μυαλό σου;\n(🦷 καθαρισμός, σφράγισμα, εμφύτευμα, αισθητική...)");
        }
        else if(s===4){
            userState[from].plan=msg;
            userState[from].step=5;
            await sendWhatsAppMessage(from,
                "Αν σου λέγαμε ότι μπορούμε να αντικαταστήσουμε δόντι με *μόνιμο εμφύτευμα*, θα σε ενδιέφερε να μάθεις περισσότερα; (ναι/όχι)");
        }
        else if(s===5){
            userState[from].interest=msg;

            if(msg.toLowerCase().includes("ναι")){
                const pitch = await askAI(
                `Γράψε σύντομο friendly sales pitch για εμφυτεύματα δοντιών 
                σε 4 προτάσεις, σαν για συνομιλία WhatsApp με ασθενή.`
                );
                await sendWhatsAppMessage(from,pitch);
            } else {
                await sendWhatsAppMessage(from,"Κανένα πρόβλημα 😄 Είμαστε εδώ για ό,τι χρειαστείς!");
            }

            // -------- SEND FINAL REPORT TO DOCTOR --------
            const report = 
`📥 *Νέος Ασθενής WhatsApp Profiling*
👤 Όνομα: ${userState[from].name}
🦷 Ανησυχία: ${userState[from].concern}
🎯 Στόχος θεραπείας: ${userState[from].plan}
💡 Ενδιαφέρον για εμφύτευμα: ${userState[from].interest}
`;

            await sendWhatsAppMessage(DOCTOR_NUMBER, report);
            await sendWhatsAppMessage(from,"Ωραία, ενημερώσαμε τον γιατρό σου ώστε να γνωρίζει ακριβώς τι χρειάζεσαι πριν μπεις μέσα 😊");

            delete userState[from]; // reset user session
        }

        res.sendStatus(200);

    } catch(e){
        console.log("Webhook error:",e);
        res.sendStatus(200);
    }
});

// ====== SERVER START ======
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("SERVER RUNNING ON PORT",PORT));
