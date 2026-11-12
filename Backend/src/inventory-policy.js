import { roleNames } from './auth-policy.js';
export function inventoryScope(user) {
 if(!user || user.mustChangePassword)return null;
 if(user.roles?.includes(roleNames.ADMIN))return 'GLOBAL';
 if(user.roles?.includes(roleNames.JEFE_AREA))return 'AREA';
 if(user.roles?.includes(roleNames.PERSONAL))return 'PROPIO';
 return null;
}
export function hasInventoryAccess(user,scope,inventory){
 if(!user||!inventory||!scope)return false;
 if(scope==='GLOBAL')return true;
 if(inventory.area_code!==user.areaId)return false;
 return scope!=='PROPIO'||Number(inventory.creado_por)===Number(user.id);
}
export const validSupport=value=>['Físico','Electrónico','Mixto'].includes(value);
export function hasCommonHeader(rows){
 if(!Array.isArray(rows)||!rows.length)return false;
 const first=rows[0];
 return rows.every(row=>row.inventoryId===first.inventoryId&&row.areaId===first.areaId&&row.cadidoSectionId===first.cadidoSectionId&&row.cadidoSeriesId===first.cadidoSeriesId);
}
