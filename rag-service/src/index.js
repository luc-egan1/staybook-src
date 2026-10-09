const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333';
const HOTELS_URL = process.env.HOTELS_URL || 'http://hotels-service:3001';
const RESERVATIONS_URL = process.env.RESERVATIONS_URL || 'http://reservations-service:3002';

const EMBED_MODEL = process.env.EMBED_MODEL || 'nomic-embed-text';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2:1b';
const COLLECTION = 'hotels';
const VECTOR_SIZE = 768;

async function embed(text) {
  const resp = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  if (!resp.ok) throw new Error(`Ollama embed error: ${resp.status}`);
  const data = await resp.json();
  return data.embedding;
}

async function generate(prompt) {
  const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, prompt, stream: false }),
  });
  if (!resp.ok) throw new Error(`Ollama generate error: ${resp.status}`);
  const data = await resp.json();
  return data.response;
}

async function ensureCollection() {
  const r = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (r.status === 200) return;
  await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: VECTOR_SIZE, distance: 'Cosine' } }),
  });
  console.log(`Created Qdrant collection ${COLLECTION}`);
}

async function indexHotels() {
  const hotelsResp = await fetch(`${HOTELS_URL}/hotels`);
  const hotels = await hotelsResp.json();
  const points = [];
  let pid = 1;
  for (const h of hotels) {
    const roomsResp = await fetch(`${HOTELS_URL}/hotels/${h.id}/rooms`);
    const rooms = await roomsResp.json();
    const roomSummary = rooms
      .map(r => `${r.type} (capacite ${r.capacity}, ${r.price_per_night} EUR/nuit)`)
      .join(', ');
    const text =
      `Hotel: ${h.name}. Ville: ${h.city}. Categorie: ${h.stars} etoiles. ` +
      `Description: ${h.description} Chambres disponibles a ce jour dans le catalogue: ${roomSummary}.`;
    const vector = await embed(text);
    points.push({
      id: pid++,
      vector,
      payload: { hotel_id: h.id, name: h.name, city: h.city, stars: h.stars, text, image_url: h.image_url },
    });
  }
  await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points?wait=true`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  console.log(`Indexed ${points.length} hotels`);
  return points.length;
}

async function search(query, k = 4) {
  const vector = await embed(query);
  const resp = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, limit: k, with_payload: true }),
  });
  const data = await resp.json();
  return data.result || [];
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function fetchAvailability(from, to) {
  const url = `${RESERVATIONS_URL}/availability/all?from=${from}&to=${to}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  return r.json();
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'rag' }));

app.post('/reindex', async (_req, res) => {
  try {
    await ensureCollection();
    const n = await indexHotels();
    res.json({ indexed: n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  const { message, from, to } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const today = new Date();
  const defaultFrom = from || isoDate(new Date(today.getTime() + 86400000));
  const defaultTo = to || isoDate(new Date(today.getTime() + 4 * 86400000));

  try {
    const hits = await search(message, 4);
    const availability = await fetchAvailability(defaultFrom, defaultTo);
    const availabilityByHotel = new Map(availability.map(a => [a.hotel.id, a.available_rooms]));

    const contextBlocks = hits.map(h => {
      const rooms = availabilityByHotel.get(h.payload.hotel_id) || [];
      const dispo = rooms.length === 0
        ? 'aucune chambre disponible sur la periode'
        : rooms.map(r => `${r.type} (${r.capacity} pers., ${r.price_per_night} EUR/nuit, room_id=${r.id})`).join(' ; ');
      return `- ${h.payload.text}\n  Disponibilites entre ${defaultFrom} et ${defaultTo}: ${dispo}`;
    }).join('\n');

    const prompt = `Tu es un concierge d hotel chaleureux et professionnel. Reponds en francais, de maniere concise (3 a 6 phrases).
Utilise UNIQUEMENT les informations du contexte ci dessous. Si la question demande des disponibilites, indique clairement les hotels et chambres libres entre ${defaultFrom} et ${defaultTo}, avec le prix.
Si aucune chambre n est libre, propose de modifier les dates.

Contexte (resultats les plus pertinents):
${contextBlocks}

Question du client: ${message}

Reponse du concierge:`;

    const answer = await generate(prompt);

    const sources = hits.map(h => ({
      hotel_id: h.payload.hotel_id,
      name: h.payload.name,
      city: h.payload.city,
      image_url: h.payload.image_url,
      score: h.score,
      available_rooms: availabilityByHotel.get(h.payload.hotel_id) || [],
    }));

    res.json({ answer, sources, period: { from: defaultFrom, to: defaultTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function bootstrap() {
  let ok = false;
  for (let i = 0; i < 60 && !ok; i++) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/tags`);
      if (r.ok) ok = true;
    } catch (_) {}
    if (!ok) await new Promise(r => setTimeout(r, 2000));
  }
  console.log('Ollama is reachable, ensuring models are pulled...');
  for (const m of [EMBED_MODEL, LLM_MODEL]) {
    try {
      await fetch(`${OLLAMA_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: m, stream: false }),
      });
      console.log(`Pulled ${m}`);
    } catch (e) {
      console.log(`Pull ${m} failed: ${e.message}`);
    }
  }
  try {
    await ensureCollection();
    await indexHotels();
  } catch (e) {
    console.log(`Initial indexing failed: ${e.message}`);
  }
}

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`rag-service listening on ${PORT}`);
  bootstrap();
});
