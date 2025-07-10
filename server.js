const express = require("express");
const axios = require("axios");
const { Configuration, OpenAIApi } = require("openai");
const { customsearch } = require("@googleapis/customsearch");
const { ChatLog, initDb } = require("./models");
const setupAdmin = require("./admin");

const app = express();
app.use(express.json());

const BOT_ID = process.env.GROUPME_BOT_ID;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const openai = OPENAI_KEY
  ? new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }))
  : null;

initDb();
setupAdmin(app);

app.get("/", (req, res) => {
  res.send("🤖 GroupMe Bot is alive!");
});

app.post("/", async (req, res) => {
  const { sender_type, name, text } = req.body;
  if (sender_type === "bot") return res.sendStatus(200);

  const userMsg = text.trim();
  let botReply;

  if (/^hello/i.test(userMsg)) {
    botReply = `Hi ${name}! 👋`;
  } else if (/who is the president/i.test(userMsg)) {
    botReply = "As of July 9, 2025, the President of the United States is Joe Biden.";
  } else if (/^search /i.test(userMsg)) {
    const query = userMsg.replace(/^search\s+/i, "");
    botReply = await doWebSearch(query);
  } else if (openai) {
    botReply = await aiChat(userMsg, name);
  } else {
    botReply = "Try saying 'hello', 'search ...', or enable OpenAI for chat.";
  }

  await ChatLog.create({
    user: name,
    message: userMsg,
    reply: botReply,
    timestamp: new Date()
  });

  await sendMessage(botReply);
  res.sendStatus(200);
});

async function doWebSearch(q) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) {
    return "🔍 Google search not configured.";
  }
  try {
    const res = await customsearch("v1").cse.list({
      auth: GOOGLE_CSE_KEY,
      cx: GOOGLE_CSE_CX,
      q,
      num: 1
    });
    const item = res.data.items?.[0];
    return item ? `${item.title}: ${item.link}` : "No results found.";
  } catch (e) {
    console.error("Google API error:", e.message);
    return "Search error.";
  }
}

async function aiChat(msg, user) {
  try {
    const conv = [
      { role: "system", content: "You are a helpful GroupMe bot." },
      { role: "user", content: `${user} says: ${msg}` }
    ];
    const res = await openai.createChatCompletion({
      model: "gpt-4",
      messages: conv
    });
    return res.data.choices[0].message.content;
  } catch (e) {
    console.error("OpenAI error:", e.message);
    return "AI error.";
  }
}

async function sendMessage(text) {
  try {
    await axios.post("https://api.groupme.com/v3/bots/post", {
      bot_id: BOT_ID,
      text
    });
  } catch (e) {
    console.error("Send error:", e.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 Bot listening on port ${PORT}`));
