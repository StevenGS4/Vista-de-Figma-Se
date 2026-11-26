import express from 'express';
import { pool } from './config/database.js';
import { requireAuth, requireAdmin } from './auth.js';
import { readOverdueLoanReports } from './loans.js';
import { noticeScope, recordSessionActivity, saveNotices, staffNotices } from './profile-activity.js';

// Solo acciones realizadas por la cuenta autenticada. La tabla auditoria ya
// forma parte del modelo existente; no se requiere ninguna migración.
export const homeRouter = express.Router();
homeRouter.use(requireAuth);

const titles = {
  inventarios: { CREAR: 'Inventario registrado', ACTUALIZAR: 'Inventario actualizado', ELIMINAR: 'Inventario eliminado' },
  transferencias: {
    SOLICITAR: 'Transferencia solicitada', REENVIAR: 'Transferencia reenviada',
    VISTO_BUENO: 'Visto bueno registrado', OBSERVAR: 'Observaciones registradas',
    ACEPTAR: 'Transferencia aceptada', RECEPCION: 'Recepción física registrada',
  },
  prestamos: { ENTREGA: 'Préstamo registrado', DEVOLUCION: 'Devolución registrada', REPORTE_TARDANZA: 'Reporte por tardanza emitido' },
  expedientes: { ACTUALIZAR_UBICACION: 'Ubicación actualizada' },
  exportaciones: { DESCARGAR: 'Inventario Excel descargado' },
};
const modules = {
  inventarios: 'tramite', transferencias: 'transferencias',
  prestamos: 'prestamos', expedientes: 'concentracion', exportaciones: 'inventarios',
};
const safeDetail = value => {
  try {
    const obj = typeof value === 'string' ? JSON.parse(value) : value;
    if (!obj || typeof obj !== 'object') return '';
    return String(obj.folio || obj.inventoryId || obj.type || '').slice(0,110);
  } catch { return ''; }
};

homeRouter.get('/actividad', async (req,res,next) => {
  try {
    if (req.auth.user.mustChangePassword) return res.status(403).json({ error: 'Primero cambia tu contraseña' });
    const [rows] = await pool.execute(
      'SELECT * FROM auditoria WHERE actor_id=? ORDER BY id DESC LIMIT 5',
      [req.auth.user.id],
    );
    res.set('Cache-Control','private, no-store');
    res.json({ activities: rows.map(row => ({
      id: String(row.id),
      title: titles[row.entidad]?.[row.accion] || 'Movimiento registrado',
      detail: safeDetail(row.detalle) || (row.entidad === 'expedientes' ? 'Expediente '+row.entidad_id : 'Registro '+row.entidad_id),
      module: modules[row.entidad] || 'inicio',
      action: String(row.accion || ''),
      date: row.fecha || row.creado_en || row.created_at || null,
    })) });
  } catch(error) { next(error); }
});

/* Avisos de préstamos exclusivamente para el solicitante autenticado. No da
   acceso al catálogo completo de préstamos ni a expedientes ajenos. */
homeRouter.get('/mis-prestamos',async(req,res,next)=>{
 try{
  if(req.auth.user.mustChangePassword)return res.status(403).json({error:'Primero cambia tu contraseña'});
  const [rows]=await pool.execute(`SELECT p.folio,p.estado AS status,i.folio AS inventory,
   DATE_FORMAT(p.fecha_prestamo,'%Y-%m-%d') AS loanDate,
   DATE_FORMAT(p.fecha_prevista,'%Y-%m-%d') AS dueDate,
   DATE_FORMAT(p.cerrado_en,'%Y-%m-%d') AS returnedDate,
   CAST(pe.expediente_id AS CHAR) AS recordId,e.numero_expediente AS recordNumber,e.titulo_asunto AS title,
   DATE_FORMAT(pe.devuelto_en,'%Y-%m-%d') AS recordReturnedDate
   FROM prestamos p LEFT JOIN inventarios i ON i.id=p.inventario_id
   LEFT JOIN prestamo_expedientes pe ON pe.prestamo_id=p.id
   LEFT JOIN expedientes e ON e.id=pe.expediente_id
   WHERE p.solicitante_usuario_id=?
   ORDER BY p.estado='DEVUELTO',p.fecha_prevista IS NULL,p.fecha_prevista,p.id DESC,
    pe.devuelto_en IS NOT NULL,pe.expediente_id`,[req.auth.user.id]);
  const loansByFolio=new Map();
  for(const {recordId,recordNumber,title,recordReturnedDate,...summary} of rows){
   if(!loansByFolio.has(summary.folio)){
    const record=[recordNumber,title].filter(Boolean).join(' · ')||null;
    loansByFolio.set(summary.folio,{...summary,record,records:[]});
   }
   if(recordId)loansByFolio.get(summary.folio).records.push({
    id:recordId,number:recordNumber,title,returnedDate:recordReturnedDate
   });
  }
  const loans=[...loansByFolio.values()];
  res.set('Cache-Control','private, no-store');
  res.json({loans});
 }catch(error){next(error);}
});
async function personalNotices(userId){
  const [rows]=await pool.execute(`SELECT p.id,p.folio,p.estado,
    DATE_FORMAT(p.fecha_prestamo,'%Y-%m-%d') AS loanDate,
    DATE_FORMAT(p.fecha_prevista,'%Y-%m-%d') AS dueDate,
    DATE_FORMAT(p.cerrado_en,'%Y-%m-%d') AS returnedDate,
    DATEDIFF(p.fecha_prevista,UTC_TIMESTAMP() - INTERVAL 7 HOUR) AS remainingDays,
    DATEDIFF(p.fecha_prevista,p.fecha_prestamo) AS durationDays
    FROM prestamos p WHERE p.solicitante_usuario_id=?
    ORDER BY p.id DESC`,[userId]);
  const reports=await readOverdueLoanReports(userId);
  const notices=reports.map(report=>({
   id:'loan-report-'+report.id,title:'Reporte por tardanza de devolución',
   detail:report.number+' · '+report.loanFolio,module:'inicio',date:report.date,color:'wine',
   report
  }));
  for(const loan of rows){
   notices.push({
    id:'requester-loan-'+loan.id,
    title:'Préstamo registrado a tu nombre',detail:loan.folio,
    module:'inicio',date:loan.loanDate,color:'green'
   });
   if(loan.estado==='DEVUELTO'){
    notices.push({
     id:'requester-return-'+loan.id,
     title:'Préstamo devuelto',detail:loan.folio,
     module:'inicio',date:loan.returnedDate||loan.loanDate,color:'green'
    });
   }else if(loan.remainingDays!=null && loan.remainingDays<=Math.ceil(Math.max(0,loan.durationDays)*0.1)){
    notices.push({
     id:'requester-due-'+loan.id+'-'+loan.dueDate,
     title:loan.remainingDays<0?'Tu préstamo está vencido':
       loan.remainingDays===0?'Tu préstamo vence hoy':'Tu préstamo está próximo a vencer',
     detail:loan.folio+' · '+(loan.remainingDays<0?
       Math.abs(loan.remainingDays)+' día(s) vencido':loan.remainingDays+' día(s) restantes'),
     module:'inicio',date:loan.dueDate,color:loan.remainingDays<0?'wine':'gold'
    });
   }
  }
  return notices;
}

homeRouter.get('/avisos-prestamos',async(req,res,next)=>{
 try{
  if(req.auth.user.mustChangePassword)return res.status(403).json({error:'Primero cambia tu contraseña'});
  res.set('Cache-Control','private, no-store').json({notices:await personalNotices(req.auth.user.id)});
 }catch(error){next(error);}
});

homeRouter.get('/notificaciones',async(req,res,next)=>{
 try{
  const user=req.auth.user;
  const role=req.query.role;
  const scope=noticeScope(user,role);
  const [personal,staff]=await Promise.all([personalNotices(user.id),staffNotices(user,role)]);
  await saveNotices(user.id,[['',personal],[scope,staff]]);
  const [rows]=await pool.execute(`SELECT n.contenido,EXISTS (
     SELECT 1 FROM usuario_notificaciones read_notice
     WHERE read_notice.usuario_id=n.usuario_id AND read_notice.clave=n.clave AND read_notice.revisada_en IS NOT NULL
   ) AS seen FROM usuario_notificaciones n WHERE n.usuario_id=? AND n.contexto IN ('',?)`,[user.id,scope]);
  res.set('Cache-Control','private, no-store').json({notices:rows.map(row=>({
   ...(typeof row.contenido==='string'?JSON.parse(row.contenido):row.contenido),read:Number(row.seen)===1
  }))});
 }catch(error){next(error);}
});

homeRouter.post('/notificaciones/revisadas',async(req,res,next)=>{
 try{
  const user=req.auth.user;
  const scope=noticeScope(user,req.body?.role);
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||!ids.length||ids.length>250||
   ids.some(id=>typeof id!=='string'||!/^[-A-Za-z0-9]{1,120}$/.test(id)))
    return res.status(400).json({error:'Identificadores de notificación inválidos'});
  await pool.execute(`UPDATE usuario_notificaciones SET revisada_en=COALESCE(revisada_en,UTC_TIMESTAMP())
   WHERE usuario_id=? AND contexto IN ('',?) AND clave IN (${ids.map(()=>'?').join(',')})`,[user.id,scope,...ids]);
  res.json({ok:true});
 }catch(error){next(error);}
});

homeRouter.post('/actividad-sesion',async(req,res,next)=>{
 try{
  if(!await recordSessionActivity(req.auth))return res.status(401).json({error:'La sesión ha expirado'});
  res.status(204).end();
 }catch(error){next(error);}
});

homeRouter.get('/actividad-sesion/:id',requireAdmin,async(req,res,next)=>{
 try{
  if(!/^[1-9]\d{0,19}$/.test(req.params.id))return res.status(400).json({error:'Usuario inválido'});
  const [periods]=await pool.execute(`SELECT CAST(id AS CHAR) AS id,
    DATE_FORMAT(inicio_utc - INTERVAL 7 HOUR,'%Y-%m-%d %H:%i:%s') AS startedAt,
    DATE_FORMAT(ultima_actividad_utc - INTERVAL 7 HOUR,'%Y-%m-%d %H:%i:%s') AS lastActiveAt
   FROM usuario_actividad_sesion WHERE usuario_id=? ORDER BY inicio_utc DESC,id DESC LIMIT 100`,[req.params.id]);
  res.set('Cache-Control','private, no-store').json({periods});
 }catch(error){next(error);}
});
