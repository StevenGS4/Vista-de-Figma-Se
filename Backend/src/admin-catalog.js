import express from 'express';
import { pool } from './config/database.js';
import { requireAuth, requireAdmin } from './auth.js';

export const adminCatalogRouter=express.Router();
adminCatalogRouter.use(requireAuth,requireAdmin);
const fail=(msg,status=400)=>Object.assign(new Error(msg),{status});
const code=v=>String(v??'').trim().toUpperCase();
const str=(v,n=200)=>String(v??'').trim().slice(0,n);
const year=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1900||n>2200)throw fail('Año de catálogo inválido');return n;};
const positive=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1)throw fail('ID inválido');return n;};
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
const validArea=async(conn,areaCode)=>{
 const [[a]]=await conn.execute('SELECT id,codigo,nombre FROM areas WHERE codigo=? AND activo=1',[areaCode]);
 if(!a)throw fail('El área no existe o está inactiva',404);
 return a;
};
const managerId=async(conn,manager,areaCode)=>{
 if(manager===null||manager===''||manager===undefined)return null;
 const id=positive(manager);
 const [rows]=await conn.execute(`SELECT u.id FROM usuarios u
 JOIN areas a ON a.id=u.area_id
 JOIN usuario_roles ur ON ur.usuario_id=u.id
 JOIN roles r ON r.id=ur.rol_id
 WHERE u.id=? AND u.estado='ACTIVO' AND a.codigo=?
 AND r.codigo='JEFE_AREA' LIMIT 1`,[id,areaCode]);
 if(!rows.length)throw fail('El encargado debe ser usuario activo de esta área con rol Encargado de área');
 return id;
};
const readAreas=async(conn)=>{
 const [rows]=await conn.query(`SELECT a.codigo AS id,a.nombre AS name,
 COALESCE(p.codigo,'') AS parentId,COALESCE(p.nombre,'Oficina de Representación') AS parent,
 a.encargado_usuario_id AS managerId,
 COALESCE(CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno),'Sin asignar') AS manager
 FROM areas a LEFT JOIN areas p ON p.id=a.superior_id
 LEFT JOIN usuarios u ON u.id=a.encargado_usuario_id
 WHERE a.activo=1 ORDER BY a.nombre`);
 return rows;
};
adminCatalogRouter.get('/areas',wrap(async(req,res)=>res.json({areas:await readAreas(pool)})));
adminCatalogRouter.get('/encargados',wrap(async(req,res)=>{
 const [rows]=await pool.query(`SELECT u.id, CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS name,
 a.codigo AS areaId,u.correo AS email FROM usuarios u
 JOIN areas a ON a.id=u.area_id
 JOIN usuario_roles ur ON ur.usuario_id=u.id
 JOIN roles r ON r.id=ur.rol_id
 WHERE u.estado='ACTIVO' AND r.codigo='JEFE_AREA'
 ORDER BY a.nombre,u.nombres`);
 res.json({users:rows});
}));
adminCatalogRouter.post('/areas',wrap(async(req,res)=>{
 const areaCode=code(req.body?.id),name=str(req.body?.name);
 if(!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(areaCode)||!name)throw fail('Código o nombre de área inválido');
 let conn;try{
  conn=await pool.getConnection();await conn.beginTransaction();
  let parent=null;
  if(req.body?.parentId){parent=(await validArea(conn,code(req.body.parentId))).id;}
  await conn.execute('INSERT INTO areas(codigo,nombre,superior_id,activo) VALUES(?,?,?,1)',[areaCode,name,parent]);
  const manager=await managerId(conn,req.body?.managerId,areaCode);
  if(manager)await conn.execute('UPDATE areas SET encargado_usuario_id=? WHERE codigo=?',[manager,areaCode]);
  await conn.commit();res.status(201).json({areas:await readAreas(pool)});
 }catch(e){if(conn)await conn.rollback();if(e.code==='ER_DUP_ENTRY')throw fail('Ya existe un área con ese código',409);throw e;}finally{conn?.release();}
}));
adminCatalogRouter.put('/areas/:code',wrap(async(req,res)=>{
 const old=code(req.params.code),name=str(req.body?.name);
 if(!name)throw fail('Ingresa el nombre del área');
 let conn;try{
  conn=await pool.getConnection();await conn.beginTransaction();
  const a=await validArea(conn,old);
  let parent=null;
  if(req.body?.parentId){
   const p=await validArea(conn,code(req.body.parentId));
   if(p.id===a.id)throw fail('Un área no puede depender de sí misma');
   parent=p.id;
  }
  const manager=await managerId(conn,req.body?.managerId,old);
  await conn.execute('UPDATE areas SET nombre=?,superior_id=?,encargado_usuario_id=? WHERE id=?',[name,parent,manager,a.id]);
  await conn.commit();res.json({areas:await readAreas(pool)});
 }catch(e){if(conn)await conn.rollback();throw e;}finally{conn?.release();}
}));
adminCatalogRouter.get('/versions',wrap(async(req,res)=>{
 const [rows]=await pool.query('SELECT id,anio AS year,nombre AS name,referencia AS reference,activo AS active FROM catalogos_cadido_versiones ORDER BY anio DESC');
 res.json({versions:rows});
}));
adminCatalogRouter.post('/versions',wrap(async(req,res)=>{
 const y=year(req.body?.year),name=str(req.body?.name,220),reference=str(req.body?.reference,350);
 if(!name)throw fail('El nombre de la versión es obligatorio');
 try{await pool.execute('INSERT INTO catalogos_cadido_versiones(anio,nombre,referencia) VALUES(?,?,?)',[y,name,reference||null]);}
 catch(e){if(e.code==='ER_DUP_ENTRY')throw fail('Ya existe un catálogo para ese año',409);throw e;}
 res.status(201).json({ok:true});
}));
adminCatalogRouter.get('/series',wrap(async(req,res)=>{
 const y=year(req.query.year??2023);
 const areaCode=req.query.area?code(req.query.area):null;
 const [versions]=await pool.execute('SELECT id FROM catalogos_cadido_versiones WHERE anio=?',[y]);
 if(!versions.length)throw fail('Versión no encontrada',404);
 let areaId=null;
 if(areaCode)areaId=(await validArea(pool,areaCode)).id;
 const [rows]=await pool.execute(`SELECT sr.id,sr.codigo AS code,sr.nombre AS name,
 sc.codigo AS section,sc.nombre AS sectionName,sr.activo AS active,
 COALESCE(sa.habilitado,0) AS enabled,
 (SELECT COUNT(*) FROM expedientes e WHERE e.serie_id=sr.id) AS records
 FROM series_cadido sr JOIN secciones_cadido sc ON sc.id=sr.seccion_id
 LEFT JOIN series_areas sa ON sa.serie_id=sr.id AND sa.area_id=?
 WHERE sr.catalogo_version_id=? ORDER BY sc.codigo,sr.codigo`,[areaId||0,versions[0].id]);
 res.json({series:rows});
}));
adminCatalogRouter.post('/series',wrap(async(req,res)=>{
 const y=year(req.body?.year),seriesCode=code(req.body?.code),name=str(req.body?.name,300);
 if(!/^[0-9]{1,2}[CS]\.\d{1,3}$/.test(seriesCode)||!name)throw fail('Código CADIDO o descripción inválidos');
 if(y===2023)throw fail('La edición validada 2023 no puede alterarse; crea una nueva versión para incorporar códigos',409);
 let conn;
 try{
  conn=await pool.getConnection();await conn.beginTransaction();
  const [[v]]=await conn.execute('SELECT id FROM catalogos_cadido_versiones WHERE anio=? AND activo=1',[y]);
  if(!v)throw fail('La versión no existe o está inactiva',404);
  const sectionCode=seriesCode.split('.')[0];
  let [rows]=await conn.execute('SELECT id FROM secciones_cadido WHERE codigo=?',[sectionCode]);
  if(!rows.length){
   const sectionName=str(req.body?.sectionName,220);
   if(!sectionName)throw fail('Indica el nombre de la sección nueva');
   await conn.execute('INSERT INTO secciones_cadido(codigo,nombre,es_demostracion) VALUES(?,?,0)',[sectionCode,sectionName]);
   [rows]=await conn.execute('SELECT id FROM secciones_cadido WHERE codigo=?',[sectionCode]);
  }
  await conn.execute('INSERT INTO series_cadido(seccion_id,codigo,nombre,activo,es_demostracion,catalogo_version_id) VALUES(?,?,?,1,0,?)',
   [rows[0].id,seriesCode,name,v.id]);
  await conn.commit();res.status(201).json({ok:true});
 }catch(e){if(conn)await conn.rollback();if(e.code==='ER_DUP_ENTRY')throw fail('Ese código ya existe en esta versión',409);throw e;}finally{conn?.release();}
}));
adminCatalogRouter.put('/areas/:code/series',wrap(async(req,res)=>{
 const areaCode=code(req.params.code),y=year(req.body?.year),ids=req.body?.seriesIds;
 if(!Array.isArray(ids)||ids.length>500||ids.some(v=>!Number.isSafeInteger(Number(v))||Number(v)<1))throw fail('Lista de series inválida');
 const selected=[...new Set(ids.map(Number))];
 let conn;try{
  conn=await pool.getConnection();await conn.beginTransaction();
  const a=await validArea(conn,areaCode);
  const [[v]]=await conn.execute('SELECT id FROM catalogos_cadido_versiones WHERE anio=? AND activo=1',[y]);
  if(!v)throw fail('Versión inexistente o inactiva');
  const [rows]=await conn.execute('SELECT id FROM series_cadido WHERE catalogo_version_id=? AND activo=1',[v.id]);
  const allowed=new Set(rows.map(r=>Number(r.id)));
  if(selected.some(id=>!allowed.has(id)))throw fail('Alguna serie no pertenece al catálogo activo seleccionado');
  // Nunca se borran asignaciones ni series. Solo se habilitan o deshabilitan para altas futuras.
  await conn.execute(`UPDATE series_areas sa JOIN series_cadido sr ON sr.id=sa.serie_id
   SET sa.habilitado=0 WHERE sa.area_id=? AND sr.catalogo_version_id=?`,[a.id,v.id]);
  for(const id of selected)await conn.execute(`INSERT INTO series_areas(serie_id,area_id,habilitado)
   VALUES(?,?,1) ON DUPLICATE KEY UPDATE habilitado=1`,[id,a.id]);
  await conn.commit();res.json({ok:true,enabled:selected.length});
 }catch(e){if(conn)await conn.rollback();throw e;}finally{conn?.release();}
}));
