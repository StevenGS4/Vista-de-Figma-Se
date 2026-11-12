import { roleNames } from './auth-policy.js';
export const canManageLoans = u => Boolean(u && !u.mustChangePassword && u.roles?.some(
 r=>r===roleNames.ADMIN||r===roleNames.PRESTAMOS));
export function parseLoanSelection(payload){
 if (!payload || typeof payload!=='object') throw new Error('Datos requeridos');
 if (!['INDIVIDUAL','INVENTARIO_COMPLETO'].includes(payload.mode)) throw new Error('Modalidad inválida');
 if (!Array.isArray(payload.recordIds)||!payload.recordIds.length||payload.recordIds.length>20000)
  throw new Error('Selecciona uno o más expedientes');
 const ids=payload.recordIds.map(s=>typeof s==='string'&&/^REG-[1-9]\d*$/.test(s)?Number(s.slice(4)):NaN);
 if(ids.some(n=>!Number.isSafeInteger(n))||new Set(ids).size!==ids.length)
  throw new Error('Expedientes duplicados o inválidos');
 if(payload.mode==='INDIVIDUAL'&&ids.length!==1) throw new Error('Préstamo individual requiere un expediente');
 return {mode:payload.mode,ids};
}
export function validDate(s){
 return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
 !Number.isNaN(Date.parse(s+'T00:00:00Z')) &&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
}
export function parseReturnItems(records){
 if(!Array.isArray(records)||!records.length||records.length>20000)throw new Error('Selecciona expedientes devueltos');
 const ids=records.map(s=>typeof s==='string'&&/^REG-[1-9]\d*$/.test(s)?Number(s.slice(4)):NaN);
 if(ids.some(n=>!Number.isSafeInteger(n))||new Set(ids).size!==ids.length)
  throw new Error('Expedientes devueltos duplicados o inválidos');
 return ids;
}
