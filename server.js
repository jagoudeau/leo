const express = require('express');
const axios = require('axios');
const { Configuration, OpenAIApi } = require('openai');
const { ChatLog, initDb } = require('./models');
const setupAdmin = require('./admin');

const app = express();
app.use(express.json());

const BOT_ID = process.env.GROUPME_BOT_ID;
const BING_KEY = process.env.BING_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const openai = OPENAI_KEY
  ? new OpenAIApi(new Configuration({ apiKey: OPENAI_KEY }))
  : null;

initDb();
setupAdmin(app);

app.get('/', (req, res) => res.send('🤖 Bot is running!'));

app.post('/', async (req, res) => {
  const { sender_type, name, text } = req.body;
  if (sender_type === 'bot') return res.sendStatus(200);

  const userMsg = text.trim();
  let botReply;

  if (/^hello/i.test(userMsg)) {
    botReply = `Hi ${name}! 👋`;
  } else if (/who is the president/i.test(userMsg)) {
    botReply = "As of July 9, 2025, the U.S. President is Joe Biden.";
  } else if (/^search /i.test(userMsg)) {
    const query = userMsg.replace(/^search\s+/i, '');
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
  if (!BING_KEY) return "🔍 Search unavailable.";
  try {
    const res = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      headers: { 'Ocp-Apim-Subscription-Key': BING_KEY },
      params: { q, count: 1 }
    });
    const first = res.data.webPages?.value?.[0];
    return first ? `${first.name}: ${first.url}` : "No search results.";
  } catch (e) {
    console.error(e);
    return "Search error.";
  }
}

async function aiChat(msg, user) {
  try {
    const conv = [
      { role: 'system', content: 'You are a helpful GroupMe bot.' },
      { role: 'user', content: `${user} says: ${msg}` }
    ];
    const res = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: conv
    });
    return res.data.choices[0].message.content;
  } catch (e) {
    console.error(e);
    return "AI error.";
  }
}

async function sendMessage(text) {
  try {
    await axios.post('https://api.groupme.com/v3/bots/post', {
      bot_id: BOT_ID,
      text
    });
  } catch (e) {
    console.error('Send error:', e.message);
  }
}

app.listen(process.env.PORT || 3000, () => console.log('📡 Bot listening'));
