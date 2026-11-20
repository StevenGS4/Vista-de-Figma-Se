import express from 'express';
import { pool } from './config/database.js';
import { requireAuth, requireAdmin } from './auth.js';
import { buildDisposalAct } from './disposal-act.js';
import { readRecords } from './tramite.js';
import { concentrationScope,canEditConcentrationLocation,parseLocation } from './concentration-policy.js';

export const concentrationRouter=express.Router();
concentrationRouter.use(requireAuth);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function condition(user,scope){
 if(scope==='GLOBAL')return {sql:"WHERE e.etapa='CONCENTRACION'",args:[]};
 if(scope==='AREA')return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=?",args:[user.areaId]};
 return {sql:"WHERE e.etapa='CONCENTRACION' AND a.codigo=? AND i.creado_por=?",args:[user.areaId,user.id]};
}
async function enrichRecords(records){
 if(!records.length)return [];
 const extra=new Map();
 // Fragmentar las consultas para evitar listas SQL gigantes y límites de parámetros.
 for(let start=0;start<records.length;start+=400){
  const chunk=records.slice(start,start+400);
  const ids=chunk.map(r=>Number(r.id.replace(/^REG-/,'')));
  const [rows]=await pool.query(`SELECT e.id,e.archivo_zona,
   DATE_FORMAT(r.fecha,'%Y-%m-%d') AS recepcion_fecha,
   CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS recepcion_responsable,
   r.observaciones AS recepcion_observaciones,
   r.estado AS recepcion_estado
   FROM expedientes e
   JOIN transferencia_inventarios ti ON ti.inventario_id=e.inventario_id
   JOIN transferencias t ON t.id=ti.transferencia_id AND t.estado='ACEPTADA'
   LEFT JOIN recepciones r ON r.id=(SELECT MAX(r2.id) FROM recepciones r2 WHERE r2.transferencia_id=t.id)
   LEFT JOIN usuarios u ON u.id=r.responsable_id
   WHERE e.id IN (${ids.map(()=>'?').join(',')})`,ids);
  for(const row of rows)extra.set(Number(row.id),row);
 }
 return records.map(record=>{
  const row=extra.get(Number(record.id.replace(/^REG-/,'')));
  return {...record,
    archiveZone:row?.archivo_zona||'Ubicación pendiente de asignación',
    receptionDate:row?.recepcion_fecha||'',
    receptionResponsible:row?.recepcion_responsable||'',
    receptionNotes:row?.recepcion_observaciones||'',
  };
 });
}
async function listFor(user,oneId=null){
 const scope=concentrationScope(user);
 if(!scope)throw fail(user.mustChangePassword?'Debes cambiar tu contraseña':'Sin permiso para consultar concentración',403);
 const {sql,args}=condition(user,scope);
 const suffix=oneId?" AND e.id=?":'';
 const records=await readRecords(pool,sql+suffix,oneId?[...args,oneId]:args);
 return enrichRecords(records);
}
concentrationRouter.get('/expedientes',async(req,res,next)=>{
 try {res.json({records:await listFor(req.auth.user)});}
 catch(error){next(error);}
});
concentrationRouter.put('/expedientes/:id/ubicacion',async(req,res,next)=>{
 let conn;
 try{
  const user=req.auth.user;
  if(!canEditConcentrationLocation(user))
   throw fail('Solo el responsable de control archivístico o administrador puede cambiar ubicaciones',403);
  const idText=String(req.params.id);
  if(!/^REG-[1-9]\d*$/.test(idText))throw fail('ID de expediente inválido');
  let location;
  try{location=parseLocation(req.body);}catch(error){throw fail(error.message);}
  const id=Number(idText.slice(4));
  if(!Number.isSafeInteger(id))throw fail('ID inválido');
  conn=await pool.getConnection();
  await conn.beginTransaction();
  const [found]=await conn.execute(`SELECT e.id,e.etapa,i.estado AS inventory_state,t.estado AS transfer_state
    FROM expedientes e
    JOIN inventarios i ON i.id=e.inventario_id
    JOIN transferencia_inventarios ti ON ti.inventario_id=i.id
    JOIN transferencias t ON t.id=ti.transferencia_id
    WHERE e.id=? FOR UPDATE`,[id]);
  if(!found.length)throw fail('Expediente transferido no encontrado',404);
  if(found[0].etapa!=='CONCENTRACION'||found[0].inventory_state!=='CONCENTRACION'||
    found[0].transfer_state!=='ACEPTADA')
    throw fail('No se puede asignar ubicación antes de aceptar la transferencia',409);
  const [[physical]]=await conn.execute(`SELECT r.estado FROM recepciones r
    JOIN transferencia_inventarios ti ON ti.transferencia_id=r.transferencia_id
    JOIN expedientes e ON e.inventario_id=ti.inventario_id
    WHERE e.id=? ORDER BY r.id DESC LIMIT 1`,[id]);
  if(physical?.estado!=='RECIBIDA')
    throw fail('Primero confirma la recepción física y asigna la ubicación desde Transferencias',409);
  // La etapa y la disponibilidad jamás se actualizan desde esta ruta.
  await conn.execute(`UPDATE expedientes SET archivo_zona=?,lugar_resguardo=?,estante=?,nivel=?,
    seccion_fisica=?,posicion=?,caja_ubicacion=?,notas_ubicacion=? WHERE id=?`,
    [location.archiveZone,location.room,location.shelf,location.level,
     location.physicalSection,location.position,location.locationBox,location.locationNotes,id]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
    [user.id,'expedientes',id,'ACTUALIZAR_UBICACION',JSON.stringify({
      archiveZone:location.archiveZone,room:location.room,shelf:location.shelf,
      level:location.level,physicalSection:location.physicalSection,
      position:location.position,locationBox:location.locationBox
    })]);
  await conn.commit();
  const [record]=await listFor(user,id);
  res.json({record});
 }catch(error){if(conn)await conn.rollback();next(error);}
 finally{conn?.release();}
});

const disposalFields = [["folio_dictamen_agn","text"],["fecha_dictamen_agn","date"],["folio_acta_agn","text"],["fecha_acta_agn","date"],["referencia_inventario_autorizado","text"],["hora_inicio","time"],["fecha_acta_extendida","date"],["sede_y_domicilio","text"],["total_cajas","text"],["metros_lineales","text"],["peso_documental","text"],["fecha_ejecucion","date"],["lugar_ejecucion","text"],["metodo_disposicion","text"],["responsable_ejecucion","text"],["referencia_evidencia","text"],["observaciones","text"],["hora_cierre","time"],["fecha_cierre_extendida","date"],["nombre_responsable_concentracion","text"],["nombre_firmante","text"],["cargo_firmante","text"]];
const officeDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' });
const generatedDate = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Mazatlan'
});

concentrationRouter.get('/bajas', requireAdmin, async (req, res, next) => {
 try {
  const [inventories] = await pool.execute(
   "SELECT i.folio, a.nombre AS area, CAST(u.id AS CHAR) AS userId,"
   + " CONCAT_WS(' ',u.nombres,u.apellido_paterno,u.apellido_materno) AS userName,"
   + " DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS date, COUNT(e.id) AS total"
   + " FROM inventarios i JOIN areas a ON a.id=i.area_id JOIN usuarios u ON u.id=i.creado_por"
   + " JOIN expedientes e ON e.inventario_id=i.id AND e.deleted_at IS NULL AND e.etapa='CONCENTRACION'"
   + " WHERE i.estado='CONCENTRACION' AND i.deleted_at IS NULL"
   + " GROUP BY i.id,i.folio,a.nombre,u.id,u.nombres,u.apellido_paterno,u.apellido_materno,i.fecha_elaboracion"
   + " ORDER BY i.fecha_elaboracion DESC,i.id DESC"
  );
  res.set('Cache-Control', 'private, no-store').json({ inventories });
 } catch (error) { next(error); }
});

const draftClock = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit',
 hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

const disposalFolio = (id, year) => 'BAJA-' + year + '-' + String(id).padStart(6, '0');
const adminName = user => [user.firstName, user.paternalName, user.maternalName].filter(Boolean).join(' ');

function commonValue(records, selector) {
 const values = new Set(records.map(record => String(selector(record) || '').trim()));
 return values.size === 1 ? [...values][0] : '';
}

const evidenceReference = (id, year) => 'EV-' + year + '-' + String(id).padStart(6, '0');

function disposalBoxCount(records) {
 if (!records.length || records.some(record => !String(record.locationBox || record.boxNumber || '').trim())) return 0;
 return new Set(records.map(record => JSON.stringify([
  record.archiveAddress, record.room, record.locationBox || record.boxNumber
 ]))).size;
}

const linearMeters = boxes => (boxes * 0.4).toFixed(2) + ' m';
const boxWeight = boxes => String(boxes * 15) + ' kg';

concentrationRouter.get('/bajas/:folio/borrador', requireAdmin, async (req, res, next) => {
 try {
  const [[inventory]] = await pool.execute(
   "SELECT i.id, i.folio, CONCAT_WS(' ', u.nombres, u.apellido_paterno, u.apellido_materno) AS registrant"
   + " FROM inventarios i LEFT JOIN usuarios u ON u.id=i.creado_por"
   + " WHERE i.folio=? AND i.estado='CONCENTRACION' AND i.deleted_at IS NULL",
   [req.params.folio]
  );
  if (!inventory) throw fail('El inventario ya no está disponible para baja', 409);
  const records = await readRecords(pool, "WHERE i.id=? AND e.etapa='CONCENTRACION'", [inventory.id]);
  if (!records.length) throw fail('El inventario no tiene expedientes activos en Concentración', 409);
  const clock = Object.fromEntries(draftClock.formatToParts(new Date()).map(part => [part.type, part.value]));
  const date = [clock.year, clock.month, clock.day].join('-');
  const address = commonValue(records, record => record.archiveAddress)
   || 'Avenida Allende No. 110 Oriente, Colonia Centro, C.P. 63000, Tepic, Nayarit';
  const time = clock.hour + ':' + clock.minute;
  const administrator = adminName(req.auth.user);
  const boxes = disposalBoxCount(records);
  res.set('Cache-Control', 'private, no-store').json({
   administrator,
   folioSuffix: String(inventory.id).padStart(6, '0'),
   fields: {
    referencia_inventario_autorizado: inventory.folio,
    fecha_acta_extendida: date,
    hora_inicio: time,
    fecha_ejecucion: date,
    hora_cierre: time,
    fecha_cierre_extendida: date,
    sede_y_domicilio: address,
    lugar_ejecucion: address,
    total_cajas: boxes ? String(boxes) : '',
    metros_lineales: boxes ? linearMeters(boxes) : '',
    peso_documental: boxes ? boxWeight(boxes) : '',
    metodo_disposicion: 'Trituración',
    responsable_ejecucion: administrator,
    nombre_responsable_concentracion: inventory.registrant || '',
    nombre_firmante: administrator,
    cargo_firmante: 'Administrador de Contacto Ciudadano',
   },
  });
 } catch (error) { next(error); }
});

concentrationRouter.post('/bajas/:folio', requireAdmin, async (req, res, next) => {
 let conn;
 try {
  const user = req.auth.user;
  if (req.body?.confirm !== true) throw fail('Confirma la baja del inventario completo');
  const values = {};
  for (const [key, type] of disposalFields) {
   const raw = req.body?.fields?.[key];
   if (key === 'observaciones' && raw === '') {
    values[key] = 'Sin observaciones';
    continue;
   }
   if (typeof raw !== 'string' || !raw.trim() || raw.length > 500 || /[\u0000-\u001f]/.test(raw)) {
    throw fail('Completa los datos requeridos del acta');
   }
   if (type === 'date') {
    const date = new Date(raw + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(+date) || date.toISOString().slice(0,10) !== raw) {
     throw fail('El acta contiene una fecha inválida');
    }
    values[key] = officeDate.format(date);
   } else {
    if (type === 'time' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) throw fail('El acta contiene una hora inválida');
    values[key] = raw.trim();
   }
  }
  conn = await pool.getConnection();
  await conn.beginTransaction();
  const [[inventory]] = await conn.execute(
   'SELECT id,folio,estado,deleted_at FROM inventarios WHERE folio=? FOR UPDATE', [req.params.folio]
  );
  if (!inventory || inventory.estado !== 'CONCENTRACION' || inventory.deleted_at) {
   throw fail('El inventario ya no está disponible para baja', 409);
  }
  const [active] = await conn.execute(
   'SELECT id, etapa, disponibilidad FROM expedientes WHERE inventario_id=? AND deleted_at IS NULL FOR UPDATE', [inventory.id]
  );
  if (!active.length || active.some(row => row.etapa !== 'CONCENTRACION' || row.disponibilidad === 'PRESTADO')) {
   throw fail('Todos los expedientes deben estar en Concentración y sin préstamos activos', 409);
  }
  const records = await readRecords(conn, 'WHERE i.id=?', [inventory.id]);
  if (records.length !== active.length) throw fail('El anexo no coincide con el inventario completo', 409);
  values.folio_acta = disposalFolio(inventory.id, req.body.fields.fecha_acta_extendida.slice(0, 4));
  values.administrador_nombre = adminName(user);
  values.fecha_hora_generacion = generatedDate.format(new Date());
  const boxes = disposalBoxCount(records);
  if (boxes && values.metros_lineales === linearMeters(boxes)) values.metros_lineales += ' (estimado)';
  if (boxes && values.peso_documental === boxWeight(boxes)) values.peso_documental += ' (estimado)';
  const internalEvidenceReference = evidenceReference(inventory.id, req.body.fields.fecha_acta_extendida.slice(0, 4));
  const file = await buildDisposalAct(values, records);

  await conn.execute('UPDATE expedientes SET deleted_at=NOW(),deleted_by=? WHERE inventario_id=? AND deleted_at IS NULL',
   [user.id, inventory.id]);
  await conn.execute('UPDATE inventarios SET deleted_at=NOW(),deleted_by=? WHERE id=?', [user.id, inventory.id]);
  await conn.execute('INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [user.id, 'inventarios', inventory.id, 'BAJA_DOCUMENTAL', JSON.stringify({
    folio: inventory.folio, acta: values.folio_acta, expedientes: records.length,
    registroInterno: internalEvidenceReference, referenciaEvidencia: values.referencia_evidencia,
    dictamen: values.folio_dictamen_agn, actaAgn: values.folio_acta_agn, inventarioAutorizado: values.referencia_inventario_autorizado
   })]);
  await conn.commit();
  res.set('Cache-Control', 'private, no-store');
  res.attachment('Acta-' + inventory.folio.replace(/[^a-zA-Z0-9_-]/g, '_') + '.docx').send(file);
 } catch (error) {
  if (conn) await conn.rollback();
  next(error);
 } finally { conn?.release(); }
});
