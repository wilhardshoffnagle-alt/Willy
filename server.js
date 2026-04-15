import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// PUT YOUR ANTHROPIC API KEY HERE
// Get one at: https://console.anthropic.com → API Keys
// ============================================================
const API_KEY = 'YOUR_API_KEY_HERE';

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const client = new Anthropic({ apiKey: API_KEY });

// ============================================================
// CUSTOMIZE YOUR QUEST CATEGORIES HERE
// Add, remove, or edit these to shape what the AI recommends.
// The AI uses these as a menu of inspiration, then tailors
// specific suggestions to the user's location and situation.
// ============================================================
const QUEST_CATEGORIES = [
  'Getting food or trying a new restaurant',
  'Getting boba, coffee, or drinks at a cafe',
  'Going to a park, trail, or outdoor green space',
  'Watching a movie at a theater',
  'Bowling, mini golf, or arcade games',
  'Exploring a new neighborhood or area you\'ve never visited',
  'Going thrift shopping or browsing a unique local store',
  'Late night snack run or dessert spot',
  'Live music, open mic, or entertainment venue',
  'Escape room or board game cafe',
  'Going to a sports bar to watch a game',
  'Ice cream, boba, or specialty dessert',
  'Night market, farmers market, or street food',
  'Rooftop bar or scenic viewpoint',
  'Comedy show, trivia night, or karaoke',
  'Going for a drive to somewhere new',
  'Finding a cool local spot or hidden gem',
];

app.post('/api/recommend', async (req, res) => {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
    return res.status(500).json({
      error: 'No API key set. Open server.js and paste your key into the API_KEY variable at the top.',
    });
  }

  const { timeOfDay, reason, location } = req.body;

  if (!timeOfDay || !reason || !location) {
    return res.status(400).json({ error: 'Missing required fields: timeOfDay, reason, location' });
  }

  // Set up Server-Sent Events for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const systemPrompt = `You are "Quest Master", an enthusiastic guide helping groups of friends discover fun things to do. Suggest exactly 3 "side quests" based on the details provided.

Format EACH quest exactly like this (including the --- separator):

## ⚔️ Quest [N]: [Creative, exciting quest name]
**Type:** [Activity category with a relevant emoji]
**The Mission:** [2-3 sentences describing the activity and why it's perfect for their specific time of day, mood, and location]
**Where to Go:** [Specific guidance on what types of venues or spots to search for in their area. Mention what to look up, what makes a great pick, and any timing tips.]
**Quest Reward:** [1-2 sentences on the experience, vibes, or memories they'll walk away with]

---

Vary the energy level: make one quest chill/low-key, one moderately active, and one more adventurous. Be enthusiastic, specific, and always tailor to the exact time of day, mood, and location given.`;

    const userPrompt = `My friends and I need a side quest!

🕐 Time of day: ${timeOfDay}
💭 Why we want to go out: ${reason}
📍 Our area: ${location}

Activity ideas to draw inspiration from:
• ${QUEST_CATEGORIES.join('\n• ')}

Give us 3 perfect side quests!`;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Anthropic API error:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const keyStatus = API_KEY && API_KEY !== 'YOUR_API_KEY_HERE' ? '✓ Set' : '✗ Missing — open server.js and add your key';
  console.log(`\n⚔️  Side Quest Generator`);
  console.log(`   URL:     http://localhost:${PORT}/side-quests.html`);
  console.log(`   API key: ${keyStatus}\n`);
});
