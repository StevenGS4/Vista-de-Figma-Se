import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './config/database.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(cors({ origin }));
app.use(express.json({ limit: '100kb' }));

// Solo confirma que el servidor Node.js está funcionando.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'semarnat-backend', database: 'no verificada en esta ruta' });
});

// Prueba REAL la conexión. No devuelve credenciales ni expedientes.
app.get('/api/db/status', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS conexion');
    res.json({ ok: rows[0].conexion === 1, database: 'conectada' });
  } catch (error) {
    console.error('Error de MySQL:', error.code || error.message);
    res.status(503).json({ ok: false, database: 'sin conexión' });
  }
});

// Más adelante añadiremos /api/auth, /api/inventarios, /api/transferencias, etc.
app.use((error, _req, res, _next) => {
  console.error('Error inesperado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Backend SEMARNAT escuchando en http://localhost:${port}`);
});

const close = () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
