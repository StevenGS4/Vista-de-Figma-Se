import { parseLocation } from './concentration-policy.js';

// La ubicación se captura UNA VEZ por recepción de transferencia.
// Se replica en todos sus expedientes dentro de una única transacción SQL.
export function validateSharedReceptionLocation(location,receivedIds){
 if(!Array.isArray(receivedIds)||receivedIds.length===0)
  throw new Error('La transferencia no contiene expedientes para ubicar');
 const ids=receivedIds.map(Number);
 if(ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)
  throw new Error('Los expedientes asociados a la transferencia no son válidos');
 try { return parseLocation(location); }
 catch(error){throw new Error('Ubicación física de la transferencia: '+error.message);}
}
