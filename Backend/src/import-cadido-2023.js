import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './config/database.js';

// Fuente oficial 2023. NO se asignan series automáticamente a ninguna área.
// No se modifican ni borran las series históricas de otras versiones.
const path=fileURLToPath(new URL('../data/cadido_semarnat_2023.json',import.meta.url));
const catalog=JSON.parse(await readFile(path,'utf8'));
if(catalog.secciones.length!==22||catalog.series.length!==260||
   new Set(catalog.series.map(s=>s.codigo)).size!==260)
 throw new Error('El archivo oficial no contiene las 22 secciones y 260 series esperadas');
let conn;
try{
 conn=await pool.getConnection();
 await conn.beginTransaction();
 await conn.execute(`INSERT INTO catalogos_cadido_versiones(anio,nombre,referencia,activo)
  VALUES (2023,'CADIDO SEMARNAT 2023','Documento validado adjunto: CADIDO VALIDADO (SELLADO).pdf',1)
  ON DUPLICATE KEY UPDATE anio=anio`);
 const [[v]]=await conn.execute('SELECT id FROM catalogos_cadido_versiones WHERE anio=2023');
 for(const item of catalog.secciones){
  await conn.execute(`INSERT INTO secciones_cadido(codigo,nombre,es_demostracion)
    VALUES(?,?,0) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),es_demostracion=0`,[item.codigo,item.nombre]);
 }
 const sections=new Map();
 const [rows]=await conn.execute('SELECT id,codigo FROM secciones_cadido');
 for(const row of rows)sections.set(row.codigo,row.id);
 for(const item of catalog.series){
  const id=sections.get(item.seccion);if(!id)throw new Error('Sección desconocida '+item.seccion);
  await conn.execute(`INSERT INTO series_cadido(seccion_id,codigo,nombre,activo,es_demostracion,catalogo_version_id)
   VALUES(?,?,?,1,0,?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),seccion_id=VALUES(seccion_id)`,
   [id,item.codigo,item.nombre,v.id]);
 }
 await conn.commit();
 console.log('Importación 2023 completada: 22 secciones, 260 series; ninguna asignada automáticamente.');
}catch(error){if(conn)await conn.rollback();console.error('Error importando CADIDO:',error.code||error.message);process.exitCode=1;}
finally{conn?.release();await pool.end();}
