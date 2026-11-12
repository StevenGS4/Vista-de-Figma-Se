import { roleNames } from './auth-policy.js';

export const transferStates = Object.freeze({
 PREPARACION:'En preparación',
 PENDIENTE_VB:'Pendiente de visto bueno del área',
 PENDIENTE_ADMIN:'Pendiente de revisión administrativa',
 OBSERVACIONES:'Con observaciones',
 ACEPTADA:'Aceptada',
});
export function canSubmitTransfer(user){
 return Boolean(user && !user.mustChangePassword && user.roles?.some(role=>
  role===roleNames.PERSONAL||role===roleNames.JEFE_AREA));
}
export function canApproveArea(user,transfer){
 return Boolean(user && !user.mustChangePassword && user.roles?.includes(roleNames.JEFE_AREA)
  && user.areaId===transfer.areaCode && Number(transfer.solicitante_id)!==Number(user.id)
  && transfer.estado==='PENDIENTE_VB');
}
export function canReviewAdmin(user,transfer){
 return Boolean(user && !user.mustChangePassword && user.roles?.includes(roleNames.ADMIN)
  && Number(transfer.solicitante_id)!==Number(user.id)
  && transfer.estado==='PENDIENTE_ADMIN' && transfer.visto_bueno_por);
}
export function canReceiveTransfer(user,transfer){
 return Boolean(user && !user.mustChangePassword &&
 user.roles?.includes(roleNames.ADMIN) && transfer.estado==='ACEPTADA');
}
export function canViewTransfer(user,transfer){
 if(!user || user.mustChangePassword)return false;
 if(user.roles?.includes(roleNames.ADMIN))return true;
 if(user.roles?.includes(roleNames.JEFE_AREA))return user.areaId===transfer.areaCode;
 return canSubmitTransfer(user) && user.areaId===transfer.areaCode
 && Number(user.id)===Number(transfer.solicitante_id);
}
export function uniqueInventoryFolios(input){
 if(!Array.isArray(input)||!input.length||input.length>500) return null;
 const values=input.map(x=>typeof x==='string'?x.trim():'');
 if(values.some(x=>!x||x.length>100))return null;
 const distinct=[...new Set(values)];
 return distinct.length===values.length?distinct:null;
}
