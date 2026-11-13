import express from 'express';
import { pool } from './config/database.js';
import { requireAuth } from './auth.js';

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
  prestamos: { ENTREGA: 'Préstamo registrado', DEVOLUCION: 'Devolución registrada' },
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
homeRouter.get('/avisos-prestamos',async(req,res,next)=>{
 try{
  if(req.auth.user.mustChangePassword)return res.status(403).json({error:'Primero cambia tu contraseña'});
  const [rows]=await pool.execute(`SELECT p.id,p.folio,p.estado,
    DATE_FORMAT(p.fecha_prestamo,'%Y-%m-%d') AS loanDate,
    DATE_FORMAT(p.fecha_prevista,'%Y-%m-%d') AS dueDate,
    DATE_FORMAT(p.cerrado_en,'%Y-%m-%d') AS returnedDate,
    DATEDIFF(p.fecha_prevista,CURDATE()) AS remainingDays
    FROM prestamos p WHERE p.solicitante_usuario_id=?
    ORDER BY p.id DESC LIMIT 30`,[req.auth.user.id]);
  const notices=[];
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
   }else if(loan.remainingDays<=3){
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
  res.set('Cache-Control','private, no-store');
  res.json({notices:notices.slice(0,40)});
 }catch(error){next(error);}
});
