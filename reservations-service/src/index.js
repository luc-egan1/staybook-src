const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-reservations',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'reservations',
  password: process.env.DB_PASSWORD || 'reservations',
  database: process.env.DB_NAME || 'reservations',
});

const HOTELS_URL = process.env.HOTELS_URL || 'http://hotels-service:3001';

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'reservations' }));

app.get('/reservations', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reservations ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/reservations', async (req, res) => {
  const { hotel_id, room_id, customer_name, customer_email, check_in, check_out } = req.body;
  if (!hotel_id || !room_id || !customer_name || !check_in || !check_out) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const conflict = await pool.query(
      `SELECT 1 FROM reservations
       WHERE room_id = $1
         AND NOT ($3::date <= check_in OR $2::date >= check_out)`,
      [room_id, check_in, check_out]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: 'Room not available for these dates' });
    }
    const result = await pool.query(
      `INSERT INTO reservations (hotel_id, room_id, customer_name, customer_email, check_in, check_out)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [hotel_id, room_id, customer_name, customer_email, check_in, check_out]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/availability/hotel/:hotelId', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
  try {
    const roomsResp = await fetch(`${HOTELS_URL}/hotels/${req.params.hotelId}/rooms`);
    if (!roomsResp.ok) return res.status(502).json({ error: 'hotels-service unavailable' });
    const rooms = await roomsResp.json();

    const booked = await pool.query(
      `SELECT room_id FROM reservations
       WHERE hotel_id = $1
         AND NOT ($3::date <= check_in OR $2::date >= check_out)`,
      [req.params.hotelId, from, to]
    );
    const bookedIds = new Set(booked.rows.map(r => r.room_id));
    const available = rooms.filter(r => !bookedIds.has(r.id));
    res.json({ hotel_id: parseInt(req.params.hotelId, 10), from, to, available });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/availability/all', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required (YYYY-MM-DD)' });
  try {
    const hotelsResp = await fetch(`${HOTELS_URL}/hotels`);
    const hotels = await hotelsResp.json();
    const out = [];
    for (const h of hotels) {
      const roomsResp = await fetch(`${HOTELS_URL}/hotels/${h.id}/rooms`);
      const rooms = await roomsResp.json();
      const booked = await pool.query(
        `SELECT room_id FROM reservations
         WHERE hotel_id = $1
           AND NOT ($3::date <= check_in OR $2::date >= check_out)`,
        [h.id, from, to]
      );
      const bookedIds = new Set(booked.rows.map(r => r.room_id));
      const available = rooms.filter(r => !bookedIds.has(r.id));
      out.push({ hotel: h, available_rooms: available });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`reservations-service listening on ${PORT}`));
