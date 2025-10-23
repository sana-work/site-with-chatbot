import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import ollama from 'ollama';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MODEL = process.env.LLM_MODEL || 'llama3.1';

// Load site info
const siteInfo = JSON.parse(fs.readFileSync('./site-info.json', 'utf-8'));

// Simple in-memory newsletter stub
const newsletter = new Set();

const SYSTEM_PROMPT = `
You are the helpful website assistant for "${siteInfo.siteName}" with tagline "${siteInfo.tagline}".
Speak plain, easy English. Keep answers short unless asked for detail.

When the user asks about the website, answer using this JSON data faithfully.
If needed, summarize from sections and FAQs.

If the user asks to navigate to a section (home, features, pricing, contact),
emit EXACTLY one line with a JSON directive like:
{"action":"openSection","target":"pricing"}

For actions:
- "subscribe me EMAIL": validate email, then respond with success/failure.
`;

// Very small helper to detect a subscribe request (rule-based)
function maybeSubscribe(text) {
  const m = text.match(/\bsubscribe(?:\s+me)?\s*:\s*([^\s]+@[^\s]+)\b/i) ||
            text.match(/\bsubscribe(?:\s+me)?\s+([^\s]+@[^\s]+)\b/i);
  if (!m) return null;
  const email = m[1].toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!ok) return { ok: false, email, message: 'Invalid email' };
  newsletter.add(email);
  return { ok: true, email, message: `Subscribed ${email}` };
}

async function chatWithOllama(history, userText) {
  const siteBlob = JSON.stringify(siteInfo);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\nSITE_DATA:\n' + siteBlob },
    ...history,
    { role: 'user', content: userText }
  ];

  const response = await ollama.chat({
  model: MODEL,
  messages,
  options: {
    temperature: 0.3,
    num_predict: 200,   // was 256 — keep modest
    num_ctx: 1024       // limit context window to reduce RAM usage
  }
});


  return response?.message?.content || '(no reply)';
}

app.post('/api/chat', async (req, res) => {
  const { message, history = [] } = req.body || {};
  try {
    // Check for a subscribe intent first (free + reliable)
    const sub = maybeSubscribe(message || '');
    if (sub) {
      const text = sub.ok
        ? `You're subscribed: ${sub.email}. Want me to open the Contact section?`
        : `Sorry, that email looks invalid. Please try again.`;
      return res.json({ text });
    }

    // Send chat to local model
    const text = await chatWithOllama(history, message);

    // Try to extract a JSON action like {"action":"openSection","target":"pricing"}
    let action = null;
    const m = /{[\s\S]*"action"\s*:\s*"openSection"[\s\S]*}/.exec(text);
    if (m) {
      try { action = JSON.parse(m[0]); } catch {}
    }

    res.json({ text, action });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (model: ${MODEL})`);
});
