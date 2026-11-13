import { parseLocation } from './concentration-policy.js';

// Valida todo el conjunto ANTES de guardar cualquiera de sus posiciones.
// La transacción de recepción incluye estas posiciones y su estado RECIBIDA.
export function validateReceptionLocations(locations,receivedIds){
 if(!Array.isArray(locations)||!locations.length||locations.length>50000)
  throw new Error('Captura la ubicación física de cada expediente recibido');
 const ids=new Set(receivedIds.map(Number));
 if(locations.length!==ids.size)
  throw new Error('Debes ubicar todos los expedientes incluidos en esta transferencia');
 const supplied=new Set(),parsed=[];
 for(const item of locations){
  if(!/^REG-[1-9]\d*$/.test(String(item?.id??'')))
   throw new Error('Identificador de expediente inválido');
  const rid=Number(String(item.id).slice(4));
  if(!Number.isSafeInteger(rid)||!ids.has(rid)||supplied.has(rid))
   throw new Error('Los expedientes ubicados no corresponden exactamente a la transferencia');
  supplied.add(rid);
  let loc;
  try{loc=parseLocation(item);}catch(error){throw new Error('Ubicación de expediente '+rid+': '+error.message);}
  parsed.push({id:rid,...loc});
 }
 return parsed;
}
