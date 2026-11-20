import { pool } from "./config/database.js";

export const RECYCLE_DAYS = 60;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const CHUNK = 150;
let running = false;

async function purgeArchivedInventory(id) {
 const conn = await pool.getConnection();
 try {
  await conn.beginTransaction();
  const [parents] = await conn.execute(`SELECT id,folio,deleted_by FROM inventarios
    WHERE id=? AND deleted_at IS NOT NULL AND deleted_at<=DATE_SUB(NOW(), INTERVAL 60 DAY)
    AND estado='TRAMITE' FOR UPDATE`,[id]);
  if (!parents.length) { await conn.rollback(); return false; }
  const inventory = parents[0];
  const [transfer]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[id]);
  if(transfer.length){await conn.rollback();return false;}
  const [children]=await conn.execute('SELECT id FROM expedientes WHERE inventario_id=? FOR UPDATE',[id]);
  const ids=children.map(x=>x.id);
  if(ids.length){
   const [historic]=await conn.query(`SELECT 1 FROM prestamo_expedientes WHERE expediente_id IN (${ids.map(()=>'?').join(',')}) LIMIT 1`,ids);
   if(historic.length){await conn.rollback();return false;}
  }
  for(const item of children) {
   await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[item.id]);
   await conn.execute('DELETE FROM expedientes WHERE id=?',[item.id]);
  }
  await conn.execute('DELETE FROM inventarios WHERE id=?',[id]);
  if(inventory.deleted_by)await conn.execute(
   'INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [inventory.deleted_by,'inventarios',id,'CADUCIDAD_PAPELERA_60_DIAS',
    JSON.stringify({folio:inventory.folio,expedientes:ids.length,automatico:true})],
  );
  await conn.commit();
  return true;
 } catch(err){await conn.rollback();throw err;} finally{conn.release();}
}

async function purgeArchivedRecord(id) {
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [rows]=await conn.execute(`SELECT e.id,e.deleted_by,i.id AS inventory_id,i.folio
    FROM expedientes e JOIN inventarios i ON i.id=e.inventario_id
    WHERE e.id=? AND e.deleted_at IS NOT NULL
    AND e.deleted_at<=DATE_SUB(NOW(), INTERVAL 60 DAY)
    AND i.deleted_at IS NULL AND i.estado='TRAMITE' FOR UPDATE`,[id]);
  if(!rows.length){await conn.rollback();return false;}
  const item=rows[0];
  const [linked]=await conn.execute('SELECT 1 FROM transferencia_inventarios WHERE inventario_id=? LIMIT 1',[item.inventory_id]);
  const [loans]=await conn.execute('SELECT 1 FROM prestamo_expedientes WHERE expediente_id=? LIMIT 1',[id]);
  if(linked.length||loans.length){await conn.rollback();return false;}
  await conn.execute('DELETE FROM expediente_valores WHERE expediente_id=?',[id]);
  await conn.execute('DELETE FROM expedientes WHERE id=?',[id]);
  if(item.deleted_by)await conn.execute(
   'INSERT INTO auditoria(actor_id,entidad,entidad_id,accion,detalle) VALUES (?,?,?,?,?)',
   [item.deleted_by,'expedientes',id,'CADUCIDAD_PAPELERA_60_DIAS',
    JSON.stringify({folio:item.folio,automatico:true})],
  );
  await conn.commit();
  return true;
 }catch(err){await conn.rollback();throw err;}finally{conn.release();}
}

export async function purgeExpiredTrash() {
 if(running)return {skipped:true};
 running=true;
 let purgedInventories=0,purgedRecords=0,failed=0;
 try{
  // Recorrer mediante cursor para que documentos bloqueados por historial
  // no impidan procesar otros documentos vencidos.
  let cursor=0;
  for(;;){
   const [inv]=await pool.execute(`SELECT id FROM inventarios
     WHERE id>? AND deleted_at IS NOT NULL
       AND deleted_at<=DATE_SUB(NOW(), INTERVAL 60 DAY)
     ORDER BY id ASC LIMIT ${CHUNK}`,[cursor]);
   if(!inv.length)break;
   for(const row of inv){
    cursor=row.id;
    try{if(await purgeArchivedInventory(row.id))purgedInventories++;}
    catch(error){failed++;console.error('Caducidad: inventario retenido por integridad:',row.id,error.code||error.message);}
   }
  }
  cursor=0;
  for(;;){
   const [records]=await pool.execute(`SELECT e.id FROM expedientes e
     JOIN inventarios i ON i.id=e.inventario_id
     WHERE e.id>? AND e.deleted_at IS NOT NULL
       AND e.deleted_at<=DATE_SUB(NOW(), INTERVAL 60 DAY)
       AND i.deleted_at IS NULL
     ORDER BY e.id ASC LIMIT ${CHUNK}`,[cursor]);
   if(!records.length)break;
   for(const row of records){
    cursor=row.id;
    try{if(await purgeArchivedRecord(row.id))purgedRecords++;}
    catch(error){failed++;console.error('Caducidad: expediente retenido por integridad:',row.id,error.code||error.message);}
   }
  }
  if(purgedInventories||purgedRecords||failed)
    console.info('Papelera 60 días:',{purgedInventories,purgedRecords,failed});
  return {purgedInventories,purgedRecords,failed};
 }finally{running=false;}
}

export function startTrashRetention() {
 // Revisión inicial y cada 24 h mientras el backend esté ejecutándose.
 void purgeExpiredTrash().catch(e=>console.error('No se pudo comprobar caducidad de papelera:',e.code||e.message));
 const interval=setInterval(()=>{
  void purgeExpiredTrash().catch(e=>console.error('No se pudo comprobar caducidad de papelera:',e.code||e.message));
 },CHECK_INTERVAL_MS);
 interval.unref?.();
 return ()=>clearInterval(interval);
}
