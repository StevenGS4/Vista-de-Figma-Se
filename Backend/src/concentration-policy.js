import { roleNames } from './auth-policy.js';

export function concentrationScope(user) {
 if (!user || user.mustChangePassword) return null;
 if (user.roles?.includes(roleNames.ADMIN) || user.roles?.includes(roleNames.PRESTAMOS)) return 'GLOBAL';
 if (user.roles?.includes(roleNames.JEFE_AREA)) return 'AREA';
 if (user.roles?.includes(roleNames.PERSONAL)) return 'PROPIO';
 return null;
}
export function canEditConcentrationLocation(user) {
 return Boolean(user && !user.mustChangePassword &&
  user.roles?.includes(roleNames.ADMIN));
}
export function canReadConcentrationRecord(user,record) {
 const scope=concentrationScope(user);
 if (!scope || !record || record.etapa!=='CONCENTRACION') return false;
 if (scope==='GLOBAL') return true;
 if (record.areaCode!==user.areaId) return false;
 return scope==='AREA' || Number(record.creado_por)===Number(user.id);
}
export function parseLocation(data) {
 if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Ubicación inválida');
 const required=(key,max)=>{
  if (typeof data[key]!=='string') throw new Error('Falta '+key);
  const value=data[key].trim();
  if (!value || value.length>max) throw new Error('Valor inválido: '+key);
  return value;
 };
 const optional=(key,max)=>{
  if (data[key]===undefined || data[key]===null) return null;
  if (typeof data[key]!=='string' || data[key].trim().length>max) throw new Error('Valor inválido: '+key);
  return data[key].trim()||null;
 };
 const index=(key,max)=>{
  if (typeof data[key]!=='string' && typeof data[key]!=='number')throw new Error('Falta '+key);
  const n=Number(data[key]);
  if (!Number.isSafeInteger(n) || n<1 || n>max) throw new Error('Fuera de rango: '+key);
  return n;
 };
 return {
  archiveZone:required('archiveZone',160),
  room:required('room',150),
  shelf:index('shelf',25),
  level:index('level',4),
  physicalSection:index('physicalSection',4),
  position:optional('position',45),
  locationBox:optional('locationBox',60),
  locationNotes:optional('locationNotes',50000)
 };
}
