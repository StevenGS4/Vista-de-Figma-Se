import 'dotenv/config';
import { pool } from './config/database.js';

try {
  const [rows] = await pool.query(
    'SELECT DATABASE() AS base_de_datos, VERSION() AS mysql_version, (SELECT COUNT(*) FROM roles) AS roles'
  );
  console.log('CONEXIÓN MYSQL CORRECTA');
  console.table(rows);
} catch (error) {
  console.error('ERROR AL CONECTAR MYSQL:', error.code || error.message);
  if (error.code === 'ER_ACCESS_DENIED_ERROR') console.error('Revisa DB_USER y DB_PASSWORD en .env');
  if (error.code === 'ER_BAD_DB_ERROR') console.error('Revisa DB_NAME: ¿ejecutaste el script de creación?');
  if (error.code === 'ECONNREFUSED') console.error('MySQL no está escuchando en DB_HOST:DB_PORT');
  process.exitCode = 1;
} finally {
  await pool.end();
}
