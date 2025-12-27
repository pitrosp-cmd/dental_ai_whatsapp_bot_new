import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { chatAI, evaluate } from "./ai-engine.js";
import { saveSession } from "./database.js";
dotenv.config();

const app = express();
app.use(bodyParser.json());

/*
  sessions[id] = [
    {role:"system", content:"..."}, 
    {role:"user", content:text}, 
    {role:"assistant", content:response}
  ]
*/
const sessions = {};

// WhatsApp webhook verification
app.get("/webhook", (req,res)=>{
  if(req.query["hub.verify_token"] === process.env.VERIFY_TOKEN)
    return res.send(req.query["hub.challenge"]);
  res.status(403).send("Invalid verification token");
});

// Handle received messages
app.post("/webhook", async(req,res)=>{
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if(!msg){ return res.sendStatus(200); }

  const id = msg.from;
  const text = msg.text?.body;

  if (!sessions[id]) {
    sessions[id] = [
      {
        role:"system",
        content:`You are a friendly Greek-speaking dental assistant chatbot. 
        Goal: Build rapport, learn background naturally. 
        You subtly ask about dental habits, missing teeth, aesthetic concerns, fear, and interest level. 
        If user expresses interest → smoothly introduce implants/solutions.
        DO NOT end conversation too fast.
        
        End conversation ONLY when user seems satisfied or has learned enough.
        At the final message include "#finished" at the END of your message (never at the start).`
      }
    ];
  }

  sessions[id].push({role:"user", content:text});

  const response = await chatAI(sessions[id]);
  sessions[id].push({role:"assistant", content:response});

  await sendMessage(id,response);

  // Check if session should close
  if(response.includes("#finished")){
    const notes = sessions[id].map(x=>x.content).join(" ");
    const score = evaluate(notes);
    await notifyDentist(id,notes,score);
    saveSession(id,notes,score);
    delete sessions[id];
  }

  res.sendStatus(200);
});

// Send message to WhatsApp
async function sendMessage(to,text){
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
    { messaging_product:"whatsapp", to, text:{body:text} },
    { headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`}}
  );
}

// Report to dentist
async function notifyDentist(user,notes,score){

  const shortNotes = notes.substring(0,500);

  const report = `🦷 *AI Patient Report*

👤 Ασθενής: ${user}

📄 Συνοπτικά:
${shortNotes}...

📊 Ενδιαφέρον για θεραπεία: *${score}/100*

💡 Ερμηνεία:
${score>70 ? "Υψηλή πιθανότητα ενδιαφέροντος για εμφύτευμα — μίλησε για πλεονεκτήματα & μονιμότητα."
: score>40 ? "Μέτριο ενδιαφέρον — δείξε επιλογές, εξήγησε απλά, μην πιέσεις."
: "Χαμηλή πρόθεση — πρώτα κτίσε εμπιστοσύνη."}

──────────────────────
📌 Συστάσεις ομιλίας στον ασθενή:
${score>60 ? 
"Εστίασε στη διάρκεια, φυσική αίσθηση και αυτοπεποίθηση που προσφέρουν τα εμφυτεύματα."
:
"Ρώτησέ τον για προσδοκίες, φόβους ή απορίες. Σταδιακή ενημέρωση."}
`;

  const doctorNumber = process.env.DOCTOR_NUMBER; // example: 35799123456
  await sendMessage(doctorNumber,report);
}

app.listen(3000,()=>console.log("🚀 Dental AI WhatsApp Bot Running on PORT 3000"));
