const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());

const HOTELS_URL = process.env.HOTELS_URL || 'http://hotels-service:3001';
const RESERVATIONS_URL = process.env.RESERVATIONS_URL || 'http://reservations-service:3002';
const RAG_URL = process.env.RAG_URL || 'http://rag-service:3003';

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

app.use(
  '/api/hotels',
  createProxyMiddleware({
    target: HOTELS_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/hotels': '/hotels' },
  })
);

app.use(
  '/api/rooms',
  createProxyMiddleware({
    target: HOTELS_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/rooms': '/rooms' },
  })
);

app.use(
  '/api/reservations',
  createProxyMiddleware({
    target: RESERVATIONS_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/reservations': '/reservations' },
  })
);

app.use(
  '/api/availability',
  createProxyMiddleware({
    target: RESERVATIONS_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/availability': '/availability' },
  })
);

app.use(
  '/api/chat',
  createProxyMiddleware({
    target: RAG_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/chat': '/chat' },
  })
);

app.use(
  '/api/rag',
  createProxyMiddleware({
    target: RAG_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/rag': '' },
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`gateway listening on ${PORT}`));
