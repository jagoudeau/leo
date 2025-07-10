import express from 'express';
import axios from 'axios';
import { customsearch } from '@googleapis/customsearch';
import { ChatLog, initDb } from './models.js';
import setupAdmin from './admin.js';

const app = express();
app.use(express.json());

const {
  GROUPME_BOT_ID,
  OPENROUTER_API_KEY,
  GOOGLE_CSE_KEY,
  GOOGLE_CSE_CX
} = process.env;

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct';

await initDb();
await setupAdmin(app);

// 🧪 Health check
app.get('/', (req, res) => {
  res.send('🤖 GroupMe Bot is alive (OpenRouter + @leo)');
});

// 📩 GroupMe webhook
app.post('/', async (req, res) => {
  const { sender_type, name, text } = req.body;
  if (sender_type === 'bot') return res.sendStatus(200);

  const userMsg = text.trim();

  // ✅ Respond only if "@leo" is present
  if (!/@leo/i.test(userMsg)) {
    return res.sendStatus(200);
  }

  // 🧹 Strip "@leo" from the message before processing
  const cleanedMsg = userMsg.replace(/@leo/gi, '').trim();
  let botReply;

  if (/^hello/i.test(cleanedMsg)) {
    botReply = `Hi ${name}! 👋`;
  } else if (/when was our club founded/i.test(cleanedMsg)) {
    botReply = '1946';
  } else if (/when is the next meeting/i.test(cleanedMsg)) {
    botReply = 'Meetings are usually the second Tuesday of each Month. 5:00 PM Social & Meeting from 6:00 PM to 7:00 PM';
  } else if (/^search /i.test(cleanedMsg)) {
    const query = cleanedMsg.replace(/^search\s+/i, '');
    botReply = await doWebSearch(query);
  } else if (OPENROUTER_API_KEY) {
    botReply = await aiChat(cleanedMsg, name);
  } else {
    botReply = "Sorry, Leo is sleeping. Please try again later.";
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

// 🔍 Google Search
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

// 🧠 OpenRouter AI Chat
async function aiChat(msg, user) {
  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful GroupMe assistant for a Lions Club in Gonzales, Louisiana.' },
          { role: 'user', content: `${user} says: ${msg}` }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.gonzaleslions.org',
          'X-Title': 'GroupMe Bot'
        }
      }
    );
    return res.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenRouter error:', err.response?.data || err.message);
    return 'Leo AI functions are temporarily unavailable.';
  }
}

// 💬 Send to GroupMe
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 Bot is listening on port ${PORT}`));
