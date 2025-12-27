import axios from "axios";

export async function chatAI(history){
  const completion = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model:"gpt-4.1", 
      messages: history,
      temperature: 0.7
    },
    { headers:{ Authorization:`Bearer ${process.env.OPENAI_KEY}` }}
  );

  return completion.data.choices[0].message.content;
}

export function evaluate(notes){
  let score = 0;

  const lower = notes.toLowerCase();

  if(lower.includes("πόνος")||lower.includes("πονά"))
    score += 25;

  if(lower.includes("κενό")||lower.includes("χάσει")||lower.includes("δόντι"))
    score += 25;

  if(lower.includes("ενδιαφέρομαι")||lower.includes("εμφύτευμα")||lower.includes("σκέφτομαι"))
    score += 30;

  if(lower.includes("κόστος")||lower.includes("τιμή")||lower.includes("ακριβό"))
    score -= 10;

  return Math.min(100, Math.max(0,score));
}
// ai-engine placeholder - full code provided in chat
