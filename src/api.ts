import type { UserRecord } from './data';
const API_BASE=(import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/,'');
type JsonObject=Record<string,unknown>;
async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 let response:Response;
 try{
  response=await fetch(API_BASE+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})}});
 }catch{throw new Error('No se pudo conectar con Node.js. Verifica que el backend esté encendido.');}
 const data=await response.json().catch(()=>({})) as JsonObject;
 if(!response.ok) throw new Error(typeof data.error==='string'?data.error:'Error del servidor');
 return data as T;
}
export const toUiUser=(u:UserRecord):UserRecord=>({...u,id:String(u.id),areaId:String(u.areaId),password:''});
export const authApi={
 login:async(email:string,password:string)=>toUiUser((await request<{user:UserRecord}>('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})})).user),
 me:async()=>toUiUser((await request<{user:UserRecord}>('/api/auth/me')).user),
 logout:()=>request<{ok:boolean}>('/api/auth/logout',{method:'POST',body:'{}'}),
 changePassword:async(currentPassword:string,newPassword:string)=>toUiUser((await request<{user:UserRecord}>('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})})).user),
};
export const usersApi={
 list:async()=>((await request<{users:UserRecord[]}>('/api/users')).users.map(toUiUser)),
 save:async(user:UserRecord)=>toUiUser((await request<{user:UserRecord}>(user.id?.startsWith('USR-')?'/api/users':'/api/users/'+user.id,{
 method:user.id?.startsWith('USR-')?'POST':'PUT',
 body:JSON.stringify({...user,password:user.password||undefined}),
 })).user),
};

import type { ArchivalRecord, CadidoSection, CadidoSeries } from './records';
export const tramiteApi = {
  catalog:()=>request<{sections:CadidoSection[],series:CadidoSeries[]}>('/api/tramite/catalogo'),
  list:async()=>((await request<{records:ArchivalRecord[]}>('/api/tramite/inventarios')).records),
  save:async(rows:ArchivalRecord[],editing:boolean)=>{
    const folio=rows[0]?.inventoryId;
    if(!folio) throw new Error('Inventario sin identificador');
    const path=editing?'/api/tramite/inventarios/'+encodeURIComponent(folio):'/api/tramite/inventarios';
    return (await request<{records:ArchivalRecord[]}>(path,{
      method:editing?'PUT':'POST',body:JSON.stringify({rows}),
    })).records;
  },
  remove:(folio:string)=>request<{ok:boolean}>('/api/tramite/inventarios/'+encodeURIComponent(folio),{method:'DELETE',body:'{}'}),
};

import type { DocumentaryTransfer, ReceptionStatus } from './transfers';
export const transferApi={
 list:async()=>((await request<{transfers:DocumentaryTransfer[]}>('/api/transferencias')).transfers),
 submit:async(recordIds:string[],existing:DocumentaryTransfer|null)=>{
   const path=existing?'/api/transferencias/'+encodeURIComponent(existing.id)+'/resend':'/api/transferencias';
   return (await request<{transfer:DocumentaryTransfer}>(path,{method:'POST',body:JSON.stringify({recordIds})})).transfer;
 },
 areaApprove:async(id:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/approve-area',{method:'POST',body:'{}'})).transfer,
 observe:async(id:string,observation:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/observe',{method:'POST',body:JSON.stringify({observation})})).transfer,
 accept:async(id:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/accept',{method:'POST',body:'{}'})).transfer,
 receive:async(id:string,status:ReceptionStatus,date:string,notes:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/reception',{method:'POST',body:JSON.stringify({status,date,notes})})).transfer,
};

export const concentrationApi={
 list:async()=>((await request<{records:ArchivalRecord[]}>('/api/concentracion/expedientes')).records),
 saveLocation:async(record:ArchivalRecord)=>{
  const body={
   archiveZone:record.archiveZone,room:record.room,shelf:record.shelf,level:record.level,
   physicalSection:record.physicalSection,position:record.position,
   locationBox:record.locationBox,locationNotes:record.locationNotes
  };
  return (await request<{record:ArchivalRecord}>(
    '/api/concentracion/expedientes/'+encodeURIComponent(record.id)+'/ubicacion',
    {method:'PUT',body:JSON.stringify(body)}
  )).record;
 },
};

import type { ArchivalLoan } from './loans';
export type NewLoanPayload={
 mode:'INDIVIDUAL'|'INVENTARIO_COMPLETO';
 recordIds:string[];
 requestingAreaId:string;
 requesterName:string;
 loanDate:string;
 expectedReturnDate:string;
 receivedBy:string;
 observations:string;
};
export const loanApi={
 list:async()=>((await request<{loans:ArchivalLoan[]}>('/api/prestamos')).loans),
 create:async(payload:NewLoanPayload)=>(await request<{loan:ArchivalLoan}>('/api/prestamos',{
  method:'POST',body:JSON.stringify(payload)
 })).loan,
 returnItems:async(id:string,recordIds:string[],date:string,receivedBy:string,notes:string)=>
  (await request<{loan:ArchivalLoan}>('/api/prestamos/'+encodeURIComponent(id)+'/returns',{
    method:'POST',body:JSON.stringify({recordIds,date,receivedBy,notes})
  })).loan,
};

export type ExportType='tramite'|'concentracion'|'transferencia';
export const inventoriesApi={
 async download(type:ExportType,folio?:string){
  const suffix=folio?'/'+encodeURIComponent(type)+'/'+encodeURIComponent(folio)+'.xlsx'
    :'/'+encodeURIComponent(type)+'.xlsx';
  const url=API_BASE+'/api/inventarios'+suffix;
  let response:Response;
  try{response=await fetch(url,{credentials:'include'});}
  catch{throw new Error('No se pudo conectar con Node.js para generar Excel.');}
  if(!response.ok){
   const payload=await response.json().catch(()=>({})) as {error?:string};
   throw new Error(payload.error||'No se pudo generar el archivo Excel.');
  }
  const blob=await response.blob();
  if(!blob.size)throw new Error('El servidor devolvió un archivo vacío.');
  const nameFromHeader=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1];
  const name=nameFromHeader||'inventarios_'+type+'.xlsx';
  const downloadUrl=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=downloadUrl;
  anchor.download=name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(downloadUrl),30000);
 }
};
