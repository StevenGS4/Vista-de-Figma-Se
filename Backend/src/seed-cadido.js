import 'dotenv/config';
import { pool } from './config/database.js';

// Catálogo EXCLUSIVAMENTE ficticio, para probar los selectores generados por Figma.
// No representa el CADIDO oficial de SEMARNAT.
const areas=[
 ['AR-001','Coordinación Administrativa'],['AR-002','Unidad Jurídica'],
 ['AR-003','Archivo de Concentración'],['AR-004','Recursos Materiales'],['AR-005','Recursos Humanos']
];
const sections=[
 ['SEC-DEMO-01','1C — Planeación institucional (demostración)'],
 ['SEC-DEMO-02','4C — Asuntos jurídicos (demostración)'],
 ['SEC-DEMO-03','6C — Recursos materiales (demostración)'],
 ['SEC-DEMO-04','8C — Recursos humanos (demostración)']
];
const series=[
 ['SEC-DEMO-01','DEMO-1C.1','Programas operativos anuales',['AR-001','AR-002','AR-004','AR-005']],
 ['SEC-DEMO-01','DEMO-1C.2','Informes de seguimiento',['AR-001','AR-002','AR-004','AR-005']],
 ['SEC-DEMO-02','DEMO-4C.1','Opiniones y consultas jurídicas',['AR-002']],
 ['SEC-DEMO-02','DEMO-4C.3','Convenios y contratos',['AR-001','AR-002']],
 ['SEC-DEMO-03','DEMO-6C.1','Adquisiciones y servicios',['AR-001','AR-004']],
 ['SEC-DEMO-04','DEMO-8C.1','Expedientes administrativos de personal',['AR-001','AR-005']]
];
let conn;
try {
 conn=await pool.getConnection();
 await conn.beginTransaction();
 for(const [code,name] of areas){
  await conn.execute('INSERT INTO areas(codigo,nombre) VALUES (?,?) ON DUPLICATE KEY UPDATE nombre=nombre',[code,name]);
 }
 for(const [code,name] of sections){
  await conn.execute('INSERT INTO secciones_cadido(codigo,nombre,es_demostracion) VALUES (?,?,1) ON DUPLICATE KEY UPDATE nombre=nombre',[code,name]);
 }
 for(const [sectionCode,code,name,allowed] of series){
  const [[section]]=await conn.execute('SELECT id FROM secciones_cadido WHERE codigo=?',[sectionCode]);
  await conn.execute(`INSERT INTO series_cadido(seccion_id,codigo,nombre,activo,es_demostracion)
   VALUES (?,?,?,1,1) ON DUPLICATE KEY UPDATE nombre=nombre`,[section.id,code,name]);
  const [[serie]]=await conn.execute('SELECT id FROM series_cadido WHERE codigo=?',[code]);
  for(const areaCode of allowed){
   const [[area]]=await conn.execute('SELECT id FROM areas WHERE codigo=?',[areaCode]);
   await conn.execute('INSERT IGNORE INTO series_areas(serie_id,area_id) VALUES (?,?)',[serie.id,area.id]);
  }
 }
 await conn.commit();console.log('Catálogos ficticios de áreas y CADIDO listos para pruebas.');
} catch(e){if(conn)await conn.rollback();console.error('Error de catálogo:',e.message);process.exitCode=1;}
finally{conn?.release();await pool.end();}
