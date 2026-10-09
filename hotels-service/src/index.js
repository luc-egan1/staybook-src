const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-hotels',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'hotels',
  password: process.env.DB_PASSWORD || 'hotels',
  database: process.env.DB_NAME || 'hotels',
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'hotels' }));

app.get('/hotels', async (req, res) => {
  try {
    const { city } = req.query;
    const result = city
      ? await pool.query('SELECT * FROM hotels WHERE LOWER(city) = LOWER($1) ORDER BY id', [city])
      : await pool.query('SELECT * FROM hotels ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/hotels/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hotels WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Hotel not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/hotels/:id/rooms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM rooms WHERE hotel_id = $1 ORDER BY id',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/rooms/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`hotels-service listening on ${PORT}`));
