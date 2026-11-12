import 'dotenv/config';
import { pool } from './config/database.js';
import { REQUIRED_COLUMNS, compareSchema } from './preflight-contract.js';

let exitCode=0;
try {
 const database=process.env.DB_NAME;
 const [cols]=await pool.execute(`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=?`,[database]);
 const [routines]=await pool.execute(`SELECT ROUTINE_NAME FROM information_schema.ROUTINES
  WHERE ROUTINE_SCHEMA=? AND ROUTINE_TYPE='PROCEDURE'`,[database]);
 const [views]=await pool.execute(`SELECT TABLE_NAME FROM information_schema.VIEWS
  WHERE TABLE_SCHEMA=?`,[database]);
 const [roles]=await pool.query('SELECT codigo FROM roles');
 const [server]=await pool.query('SELECT VERSION() AS mysql_version,CURDATE() AS mysql_date');
 const found={};
 for(const row of cols)(found[row.TABLE_NAME]??=[]).push(row.COLUMN_NAME);
 const errors=compareSchema({
  columns:found,
  procedures:routines.map(row=>row.ROUTINE_NAME),
  views:views.map(row=>row.TABLE_NAME),
  roles:roles.map(row=>row.codigo),
 });
 console.log('PREFLIGHT — ARCHIVO SEMARNAT, solo lectura');
 console.log('Base:',database,'| MySQL:',server[0].mysql_version,
   '| Fecha MySQL:',server[0].mysql_date);
 console.log('Tablas requeridas:',Object.keys(REQUIRED_COLUMNS).length);
 if(errors.length){
  for(const e of errors)console.error('ERROR:',e);
  if(errors.includes('Falta expedientes.archivo_zona'))
   console.error('Acción: ejecutar Backend/sql/004_concentracion_zona.sql en MySQL Workbench antes de arrancar los módulos.');
  exitCode=1;
 }else{
  console.log('OK: columnas, roles, procedimientos y vistas requeridas encontrados.');
 }
 const [count]=await pool.query('SELECT COUNT(*) AS n FROM usuarios');
 if(!Number(count[0].n))console.warn('AVISO: no hay usuarios; consultar TEST_AUTH.md para alta local.');
} catch(error){
 console.error('Error de conexión o verificación:',error.code||error.message);
 exitCode=1;
} finally {
 await pool.end();
}
process.exitCode=exitCode;
