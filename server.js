import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

// ─────────────────────────────────────────────────────────────
// Edit this list to shape what the AI suggests.
// It's a palette of directions — the model picks what fits the
// user's time, mood, and area, and gets specific from there.
// ─────────────────────────────────────────────────────────────
const IDEA_PALETTE = [
  'grabbing food — a new spot, a favorite, or something neither of you has tried',
  'coffee, boba, matcha, or a cozy cafe to sit and talk',
  'a walk somewhere pretty — park, trail, waterfront, tree-lined street',
  'a short drive to a lookout, viewpoint, or scenic pull-off',
  'browsing — thrift store, record shop, bookstore, weird little shop',
  'a farmers market, night market, or street-food setup',
  'something active — mini golf, bowling, arcade, rock wall, batting cage',
  'something spectator — catch a local game, watch a match at a bar',
  'a dessert run — ice cream, late-night bakery, specialty shop',
  'live stuff — open mic, trivia, karaoke, comedy, small-venue show',
  'a board-game cafe, pinball bar, or puzzle room',
  'a museum, gallery, exhibit, or free community event',
  'cook or bake something together at home with a grocery-store adventure',
  'a neighborhood you\'ve never really walked through',
  'a rooftop, patio, or just a good bench somewhere with a view',
];

app.post('/api/recommend', async (req, res) => {
  if (!client) {
    return res.status(500).json({
      error: 'Server not configured. Set ANTHROPIC_API_KEY and restart.',
    });
  }

  const { timeOfDay, reason, location } = req.body || {};
  if (!timeOfDay || !reason || !location) {
    return res.status(400).json({ error: 'Missing timeOfDay, reason, or location.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const system = `You recommend things for people to do with friends. You are warm, specific, and grounded — not a travel brochure. You never invent venue names you aren't confident about; instead, you describe the kind of place to look for and give the user concrete search terms and cues for picking a good one. You match energy level to the time of day and the reason given.

Return EXACTLY 3 ideas, nothing before or after. Vary them: one low-effort, one moderate, one that takes a little more initiative. Use this exact format for each:

### Idea [N]: [short, punchy title — no quotes, no emojis]
**Vibe:** [2-4 words, e.g. "chill & cozy" or "get out and move"]
**What:** [3-5 sentences. What you'd actually do, why it fits their time and reason, and what makes it good. Talk like a friend, not an ad.]
**Where to look:** [Practical guidance for their specific area. Say what to search on Maps ("look up '<category> near <neighborhood>'"), what signals a good pick (reviews, busyness, specific features), and any timing tips for the chosen time of day. If there's a well-known landmark, district, or category of place in their area that fits, name it — but don't invent specific venues.]`;

  const user = `Three friends need an idea.

Time of day: ${timeOfDay}
Why they're looking: ${reason}
Where they are: ${location}

Directions you can pull from (pick what fits, don't list them all):
- ${IDEA_PALETTE.join('\n- ')}

Give me three ideas in the required format.`;

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1800,
      system,
      messages: [{ role: 'user', content: user }],
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const keyStatus = apiKey ? '✓ set' : '✗ missing — export ANTHROPIC_API_KEY';
  console.log(`\nWhat should we do?`);
  console.log(`  → http://localhost:${PORT}/side-quests.html`);
  console.log(`  api key: ${keyStatus}\n`);
});
