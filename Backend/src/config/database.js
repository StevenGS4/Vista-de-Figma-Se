import mysql from 'mysql2/promise';

const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Falta ${key} en backend/.env`);
  }
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 20,
  connectTimeout: 8000,
  maxIdle: 2,
  idleTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000,
  decimalNumbers: false,
  timezone: 'Z',
  dateStrings: true,
});
