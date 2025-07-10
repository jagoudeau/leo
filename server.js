import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { customsearch } from '@googleapis/customsearch';
import { ChatLog, initDb } from './models.js';
import setupAdmin from './admin.js';

const app = express();
app.use(express.json());

// 🌐 Environment Variables
const {
  GROUPME_BOT_ID,
  OPENAI_API_KEY,
  GOOGLE_CSE_KEY,
  GOOGLE_CSE_CX
} = process.env;

// 🤖 OpenAI Init (v4+)
const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

// 🗃️ Init DB and Admin
await initDb();
await setupAdmin(app);

// 🚦 Root Endpoint
app.get('/', (req, res) => {
  res.send('🤖 GroupMe Bot is alive (ESM)!');
});

// 📩 GroupMe Callback
app.post('/', async (req, res) => {
  const { sender_type, name, text } = req.body;
  if (sender_type === 'bot') return res.sendStatus(200);

  const userMsg = text.trim();
  let botReply;

  if (/^hello/i.test(userMsg)) {
    botReply = `Hi ${name}! 👋`;
  } else if (/who is the president/i.test(userMsg)) {
    botReply = 'As of July 2025, the President of the United States is Joe Biden.';
  } else if (/^search /i.test(userMsg)) {
    const query = userMsg.replace(/^search\s+/i, '');
    botReply = await doWebSearch(query);
  } else if (openai) {
    botReply = await aiChat(userMsg, name);
  } else {
    botReply = "Try saying 'hello', 'search ...', or enable OpenAI for smarter chat.";
  }

  // 🧾 Log to DB
  await ChatLog.create({
    user: name,
    message: userMsg,
    reply: botReply,
    timestamp: new Date()
  });

  // 💬 Send Reply
  await sendMessage(botReply);
  res.sendStatus(200);
});

// 🔍 Google Search Function
async function doWebSearch(q) {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_CX) return '🔍 Google search not configured.';
  try {
    const res = await customsearch('v1').cse.list({
      auth: GOOGLE_CSE_KEY,
      cx: GOOGLE_CSE_CX,
      q,
      num: 1
    });
    const item = res.data.items?.[0];
    return item ? `${item.title}: ${item.link}` : 'No results found.';
  } catch (err) {
    console.error('Google API error:', err.message);
    return 'Search error.';
  }
}

// 💡 AI Chat Function (OpenAI v4+)
async function aiChat(msg, user) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful GroupMe assistant.' },
      { role: 'user', content: `${user} says: ${msg}` }
    ];
    const res = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });
    return res.choices[0].message.content;
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return 'AI error.';
  }
}

// 📤 GroupMe Send Function
async function sendMessage(text) {
  try {
    await axios.post('https://api.groupme.com/v3/bots/post', {
      bot_id: GROUPME_BOT_ID,
      text
    });
  } catch (err) {
    console.error('Send error:', err.message);
  }
}

// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 ESM Bot listening on port ${PORT}`));
