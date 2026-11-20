import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';

export const areaControlRouter = express.Router();
areaControlRouter.use(requireAuth);

const err=(message,status=400)=>Object.assign(new Error(message),{status});
function scope(user) {
  if(user.mustChangePassword)throw err('Debes cambiar tu contraseña',403);
  if(user.roles.includes('Administrador / Coordinador'))return {admin:true};
  if(user.roles.includes('Encargado de área'))return {admin:false,area:user.areaId};
  throw err('Solo encargados de área y administradores pueden consultar este módulo',403);
}
function validateUserId(raw){
  const id=Number(raw);
  if(!Number.isSafeInteger(id)||id<1)throw err('Identificador de usuario inválido');
  return id;
}
function areaCondition(ctx,field='a.codigo'){
  return ctx.admin?{sql:'',args:[]}:{sql:' AND '+field+'=?',args:[ctx.area]};
}
async function userSummary(conn,ctx,area='') {
  const filter=area?String(area).trim():'';
  const c=areaCondition(ctx);
  const args=[...c.args],clauses=['1=1'];
  if(c.sql)clauses.push('a.codigo=?');
  if(filter){
    if(!ctx.admin&&filter!==ctx.area)throw err('No puedes consultar otra área',403);
    if(ctx.admin){clauses.push('a.codigo=?');args.push(filter);}
  }
  const [users]=await conn.execute(`SELECT u.id,CONCAT_WS(' ',u.nombres,u.apellido_paterno,NULLIF(u.apellido_materno,'')) AS name,
    u.correo AS email,a.codigo AS areaId,a.nombre AS areaName,u.estado AS status
    FROM usuarios u JOIN areas a ON a.id=u.area_id
    WHERE ${clauses.join(' AND ')} ORDER BY a.nombre,u.apellido_paterno,u.nombres,u.id`,args);
  if(!users.length)return [];
  // Conteos por inventario, no por expediente: un inventario contiene muchas filas.
  const [tramite]=await conn.execute(`SELECT i.creado_por AS userId,COUNT(*) AS total
    FROM inventarios i JOIN areas a ON a.id=i.area_id
    WHERE i.estado='TRAMITE' AND i.deleted_at IS NULL ${c.sql}
    GROUP BY i.creado_por`,c.args);
  const [concentracion]=await conn.execute(`SELECT t.solicitante_id AS userId,
    COUNT(DISTINCT ti.inventario_id) AS total
    FROM transferencias t
    JOIN transferencia_inventarios ti ON ti.transferencia_id=t.id
    JOIN inventarios i ON i.id=ti.inventario_id
    JOIN areas a ON a.id=t.area_id
    WHERE t.estado='ACEPTADA' AND i.estado='CONCENTRACION' AND i.deleted_at IS NULL ${c.sql}
    GROUP BY t.solicitante_id`,c.args);
  const tram=new Map(tramite.map(r=>[Number(r.userId),Number(r.total)]));
  const conc=new Map(concentracion.map(r=>[Number(r.userId),Number(r.total)]));
  return users.map(r=>({
    id:String(r.id),name:r.name,email:r.email,areaId:r.areaId,areaName:r.areaName,
    status:r.status==='ACTIVO'?'Activo':'Inactivo',
    activeInventories:tram.get(Number(r.id))||0,
    transferredInventories:conc.get(Number(r.id))||0,
  }));
}
areaControlRouter.get('/usuarios',async(req,res,next)=>{
 try{
  const ctx=scope(req.auth.user);
  const area=typeof req.query.area==='string'?req.query.area:'';
  res.set('Cache-Control','private, no-store');
  res.json({users:await userSummary(pool,ctx,area)});
 }catch(e){next(e);}
});
areaControlRouter.get('/usuarios/:id',async(req,res,next)=>{
 try{
  const ctx=scope(req.auth.user),id=validateUserId(req.params.id);
  const [target]=await pool.execute(`SELECT u.id, a.codigo AS areaCode
    FROM usuarios u JOIN areas a ON a.id=u.area_id WHERE u.id=?`,[id]);
  if(!target.length)throw err('Usuario no encontrado',404);
  if(!ctx.admin&&target[0].areaCode!==ctx.area)throw err('Usuario fuera de tu área',403);
  const users=await userSummary(pool,ctx,ctx.admin?target[0].areaCode:'');
  const summary=users.find(x=>Number(x.id)===id);
  if(!summary)throw err('Usuario no encontrado',404);
  const c=areaCondition(ctx);
  const [inventories]=await pool.execute(`SELECT i.id,i.folio,
    DATE_FORMAT(i.fecha_elaboracion,'%Y-%m-%d') AS openedAt,
    DATE_FORMAT(i.deleted_at,'%Y-%m-%d') AS deletedAt,
    i.estado,COUNT(DISTINCT CASE WHEN e.deleted_at IS NULL THEN e.id END) AS recordCount,
    a.nombre AS areaName
    FROM inventarios i JOIN areas a ON a.id=i.area_id
    LEFT JOIN expedientes e ON e.inventario_id=i.id
    WHERE i.creado_por=? ${c.sql}
    GROUP BY i.id,i.folio,i.fecha_elaboracion,i.deleted_at,i.estado,a.nombre
    ORDER BY i.fecha_elaboracion DESC,i.id DESC LIMIT 300`,[id,...c.args]);
  const [sent]=await pool.execute(`SELECT DISTINCT t.id AS transferId,t.folio AS transferFolio,
    i.id AS inventoryDbId,i.folio AS inventoryFolio,
    DATE_FORMAT(t.enviada_en,'%Y-%m-%d') AS sentAt,
    DATE_FORMAT(t.aceptada_en,'%Y-%m-%d') AS acceptedAt,
    t.estado
    FROM transferencias t
    JOIN transferencia_inventarios ti ON ti.transferencia_id=t.id
    JOIN inventarios i ON i.id=ti.inventario_id
    JOIN areas a ON a.id=t.area_id
    WHERE t.solicitante_id=? ${c.sql}
    ORDER BY sentAt DESC,t.id DESC LIMIT 300`,[id,...c.args]);
  const [records]=await pool.execute(`SELECT e.id,e.numero_expediente AS recordNumber,
    e.titulo_asunto AS title,i.folio AS inventoryFolio,
    DATE_FORMAT(e.apertura,'%Y-%m-%d') AS openedAt,
    DATE_FORMAT(e.cierre,'%Y-%m-%d') AS closedAt,e.etapa,
    DATE_FORMAT(e.deleted_at,'%Y-%m-%d') AS deletedAt
    FROM expedientes e
    JOIN inventarios i ON i.id=e.inventario_id
    JOIN areas a ON a.id=i.area_id
    WHERE (e.creado_por=? OR i.creado_por=?) ${c.sql}
    ORDER BY e.apertura DESC,e.id DESC LIMIT 500`,[id,id,...c.args]);
  // Solo operaciones relacionadas con el área autorizada y que todavía tengan
  // vínculo documental verificable. Nunca mostrar toda la auditoría global al encargado.
  const [activity]=await pool.execute(`SELECT h.id,h.accion AS action,h.entidad AS entity,
    h.entidad_id AS entityId,DATE_FORMAT(h.fecha,'%Y-%m-%d %H:%i:%s') AS occurredAt
    FROM auditoria h WHERE h.actor_id=?
    AND (
      (h.entidad='inventarios' AND EXISTS(SELECT 1 FROM inventarios i
        JOIN areas a ON a.id=i.area_id WHERE i.id=h.entidad_id ${c.sql}))
      OR (h.entidad='expedientes' AND EXISTS(SELECT 1 FROM expedientes e
        JOIN inventarios i ON i.id=e.inventario_id JOIN areas a ON a.id=i.area_id
        WHERE e.id=h.entidad_id ${c.sql}))
      OR (h.entidad='transferencias' AND EXISTS(SELECT 1 FROM transferencias t
        JOIN areas a ON a.id=t.area_id WHERE t.id=h.entidad_id ${c.sql}))
    )
    ORDER BY h.id DESC LIMIT 150`,[id,...c.args,...c.args,...c.args]);
  const [transferHistory]=await pool.execute(`SELECT th.id,th.accion AS action,
    t.folio AS transferFolio,DATE_FORMAT(th.fecha,'%Y-%m-%d %H:%i:%s') AS occurredAt
    FROM transferencia_historial th JOIN transferencias t ON t.id=th.transferencia_id
    JOIN areas a ON a.id=t.area_id
    WHERE th.usuario_id=? ${c.sql}
    ORDER BY th.id DESC LIMIT 150`,[id,...c.args]);
  const feed=[
    ...activity.map(e=>({key:'A-'+e.id,date:e.occurredAt,
      action:e.action,detail:e.entity+' #'+e.entityId,source:'Auditoría'})),
    ...transferHistory.map(e=>({key:'T-'+e.id,date:e.occurredAt,
      action:e.action,detail:e.transferFolio,source:'Transferencia'})),
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,200);
  res.set('Cache-Control','private, no-store');
  res.json({
    user:summary,
    inventories:inventories.map(x=>({id:String(x.id),folio:x.folio,
      openedAt:x.openedAt,deletedAt:x.deletedAt,status:x.deletedAt?'Papelera':x.estado==='CONCENTRACION'?'Concentración':'Trámite',
      recordCount:Number(x.recordCount)})),
    transfers:sent.map(x=>({id:String(x.transferId),folio:x.transferFolio,
      inventoryFolio:x.inventoryFolio,sentAt:x.sentAt,acceptedAt:x.acceptedAt,
      status:x.estado})),
    records:records.map(x=>({id:String(x.id),recordNumber:x.recordNumber,
      title:x.title,inventoryFolio:x.inventoryFolio,openedAt:x.openedAt,
      closedAt:x.closedAt,status:x.deletedAt?'Papelera':x.etapa})),
    activity:feed,
  });
 }catch(e){next(e);}
});
