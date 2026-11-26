import { pool } from './config/database.js';
import { roleNames } from './auth-policy.js';

export function noticeScope(user, role) {
 if (user.mustChangePassword || !Object.values(roleNames).includes(role) || !user.roles.includes(role))
  throw Object.assign(new Error('Rol inválido para consultar notificaciones'), {status:403});
 return role+'|'+user.areaId;
}

export async function staffNotices(user, role) {
 const notices=[];
 if ([roleNames.PERSONAL,roleNames.JEFE_AREA,roleNames.ADMIN].includes(role)) {
  const area=role===roleNames.ADMIN?'':' AND a.codigo=?';
  const scope=area?[user.areaId]:[];
  const [events]=await pool.execute(`SELECT t.id AS transferId,t.folio,h.id,h.accion,DATE_FORMAT(h.fecha,'%Y-%m-%d') AS date
   FROM transferencia_historial h JOIN transferencias t ON t.id=h.transferencia_id JOIN areas a ON a.id=t.area_id
   WHERE t.solicitante_id=? AND h.usuario_id<>? AND h.accion IN ('VISTO_BUENO','OBSERVAR','ACEPTAR','RECEPCION','DIFERENCIA')${area}`,
   [user.id,user.id,...scope]);
  const labels={VISTO_BUENO:'Visto bueno de área',OBSERVAR:'Observaciones',ACEPTAR:'Aceptación',RECEPCION:'Recepción física',DIFERENCIA:'Recepción física'};
  for (const row of events) notices.push({
   id:'transfer-history-TR-'+row.transferId+'-H-'+row.id,title:labels[row.accion]+' registrada',
   detail:row.folio,module:'transferencias',date:row.date,color:row.accion==='OBSERVAR'?'wine':'green',
  });
  if (role!==roleNames.PERSONAL) {
   const state=role===roleNames.ADMIN?"('PENDIENTE_ADMIN','ACEPTADA')":"('PENDIENTE_VB')";
   const [tasks]=await pool.execute(`SELECT t.id,t.folio,t.estado,
    DATE_FORMAT(COALESCE(t.aceptada_en,t.visto_bueno_en,t.enviada_en,t.creada_en),'%Y-%m-%d') AS date
    FROM transferencias t JOIN areas a ON a.id=t.area_id WHERE t.estado IN ${state}${area}
    AND (t.estado='ACEPTADA' OR t.solicitante_id<>?)
    AND NOT EXISTS (SELECT 1 FROM transferencia_documentos d WHERE d.transferencia_id=t.id AND d.tipo='CANCELACION')
    AND (t.estado<>'ACEPTADA' OR NOT EXISTS (SELECT 1 FROM recepciones r WHERE r.transferencia_id=t.id AND r.estado='RECIBIDA'))`,
    [...scope,user.id]);
   const types={
    PENDIENTE_VB:['vb','Transferencia por autorizar'],
    PENDIENTE_ADMIN:['admin','Transferencia por revisar'],
    ACEPTADA:['reception','Recepción física pendiente'],
   };
   for(const row of tasks){
    const [kind,title]=types[row.estado];
    notices.push({id:'transfer-'+kind+'-TR-'+row.id,title,detail:row.folio,module:'transferencias',date:row.date,color:'gold'});
   }
  }
 }
 if ([roleNames.ADMIN,roleNames.PRESTAMOS].includes(role)) {
  const [due]=await pool.execute(`SELECT id,folio,DATE_FORMAT(fecha_prevista,'%Y-%m-%d') AS date,
   DATEDIFF(fecha_prevista,UTC_TIMESTAMP() - INTERVAL 7 HOUR) AS days
   FROM prestamos WHERE estado='ACTIVO' AND fecha_prevista<=DATE(UTC_TIMESTAMP() - INTERVAL 7 HOUR)+INTERVAL 3 DAY`);
  for(const row of due)notices.push({
   id:'loan-due-LOAN-'+row.id+'-'+row.date,title:row.days<0?'Préstamo vencido':row.days===0?'Préstamo vence hoy':'Préstamo próximo a vencer',
   detail:row.folio+' · '+(row.days<0?Math.abs(row.days)+' día(s) de retraso':row.days+' día(s) restantes'),
   module:'prestamos',date:row.date,color:row.days<0?'wine':'gold',
  });
 }
 return notices;
}

export async function saveNotices(userId, batches) {
 const rows=batches.flatMap(([scope,notices])=>notices.map(notice=>[userId,scope,notice.id,JSON.stringify(notice)]));
 for(let start=0;start<rows.length;start+=250){
  const chunk=rows.slice(start,start+250);
  await pool.execute(`INSERT INTO usuario_notificaciones (usuario_id,contexto,clave,contenido,registrada_en)
   VALUES ${chunk.map(()=>'(?,?,?,?,UTC_TIMESTAMP())').join(',')}
   ON DUPLICATE KEY UPDATE contenido=VALUES(contenido)`,chunk.flat());
 }
}

export async function recordSessionActivity({user,sessionId}) {
 const conn=await pool.getConnection();
 try{
  await conn.beginTransaction();
  const [[session]]=await conn.execute(`SELECT id FROM sesiones WHERE id=? AND usuario_id=?
   AND revocado_en IS NULL AND expira_en>NOW() FOR UPDATE`,[sessionId,user.id]);
  if(!session){await conn.rollback();return false;}
  const [[last]]=await conn.execute(`SELECT id,TIMESTAMPDIFF(SECOND,ultima_actividad_utc,UTC_TIMESTAMP()) AS gap
   FROM usuario_actividad_sesion WHERE sesion_id=? AND usuario_id=? ORDER BY id DESC LIMIT 1`,[sessionId,user.id]);
  if(!last||Number(last.gap)>300){
   await conn.execute(`INSERT INTO usuario_actividad_sesion (usuario_id,sesion_id,inicio_utc,ultima_actividad_utc)
    VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,[user.id,sessionId]);
  }else if(Number(last.gap)>=1){
   await conn.execute('UPDATE usuario_actividad_sesion SET ultima_actividad_utc=UTC_TIMESTAMP() WHERE id=?',[last.id]);
  }
  await conn.commit();
  return true;
 }catch(error){await conn.rollback();throw error;}finally{conn.release();}
}
