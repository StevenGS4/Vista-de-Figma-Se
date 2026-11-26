import type { UserRecord, Area } from './data';
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

import type { ArchivalRecord, CadidoSection, CadidoSeries, ConcentrationInventoryData } from './records';
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
  trash:async()=>((await request<{records:ArchivalRecord[]}>('/api/tramite/papelera')).records),
  removeRecord:(folio:string,id:string)=>request<{ok:boolean}>('/api/tramite/inventarios/'+encodeURIComponent(folio)+'/expedientes/'+encodeURIComponent(id),{method:'DELETE',body:'{}'}),
  removeRecords:(folio:string,recordIds:string[])=>
    request<{ok:boolean,inventoryDeleted:boolean,removed:number}>(
      '/api/tramite/inventarios/'+encodeURIComponent(folio)+'/expedientes',
      {method:'DELETE',body:JSON.stringify({recordIds})},
    ),
  restoreInventory:(folio:string)=>request<{ok:boolean}>('/api/tramite/papelera/inventarios/'+encodeURIComponent(folio)+'/restaurar',{method:'POST',body:'{}'}),
  restoreRecord:(id:string)=>request<{ok:boolean}>('/api/tramite/papelera/expedientes/'+encodeURIComponent(id)+'/restaurar',{method:'POST',body:'{}'}),
  purgeInventory:(folio:string)=>request<{ok:boolean}>('/api/tramite/papelera/inventarios/'+encodeURIComponent(folio),{method:'DELETE',body:'{}'}),
  purgeRecord:(id:string)=>request<{ok:boolean}>('/api/tramite/papelera/expedientes/'+encodeURIComponent(id),{method:'DELETE',body:'{}'}),
  emptyTrash:()=>request<{ok:boolean}>('/api/tramite/papelera',{method:'DELETE',body:'{}'}),
};

import type { DocumentaryTransfer, ReceptionStatus } from './transfers';
export type ReceptionSourceBox={recordId:string;boxNumber:string};
export type TransferReceipt = { detail: string; pdf: string };
export const transferApi={
 cancel:async(id:string,detail:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/cancelar',
  {method:'POST',body:JSON.stringify({detail})})).transfer,
 settings:()=>request<{testMode:boolean}>('/api/transferencias/configuracion'),
 setTestMode:(testMode:boolean)=>request<{testMode:boolean}>('/api/transferencias/configuracion',
  {method:'PUT',body:JSON.stringify({testMode})}),
 documentUrl:(id:string,documentId?:string,copy=false)=>API_BASE+'/api/transferencias/'+encodeURIComponent(id)+'/'+
   (documentId?'documentos/'+encodeURIComponent(documentId)+(copy?'?copia=1':''):'relacion.xlsx'+(copy?'?copia=1':'')),
 document:async(id:string,kind:string,detail:string,pdf?:string,documentId?:string,remove=false)=>(await request<{transfer:DocumentaryTransfer}>(
   '/api/transferencias/'+encodeURIComponent(id)+'/documentos',{method:'POST',body:JSON.stringify({kind,detail,pdf,documentId,remove})})).transfer,
 receptionBoxes:async(id:string)=>(await request<{boxes:ReceptionSourceBox[]}>(
   '/api/transferencias/'+encodeURIComponent(id)+'/reception-boxes'
 )).boxes,
 list:async()=>((await request<{transfers:DocumentaryTransfer[]}>('/api/transferencias')).transfers),
 submit:async(recordIds:string[],existing:DocumentaryTransfer|null,correction?:string,receipt?:TransferReceipt)=>{
   const path=existing?'/api/transferencias/'+encodeURIComponent(existing.id)+'/resend':'/api/transferencias';
   return (await request<{transfer:DocumentaryTransfer}>(path,{method:'POST',body:JSON.stringify({recordIds,correction,receipt})})).transfer;
 },
 areaApprove:async(id:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/approve-area',{method:'POST',body:'{}'})).transfer,
 observe:async(id:string,observation:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/observe',{method:'POST',body:JSON.stringify({observation})})).transfer,
 accept:async(id:string,detail:string)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/accept',{method:'POST',body:JSON.stringify({detail})})).transfer,
 receive:async(id:string,status:ReceptionStatus,date:string,notes:string,location:ReceptionLocation|null)=>(await request<{transfer:DocumentaryTransfer}>('/api/transferencias/'+encodeURIComponent(id)+'/reception',{method:'POST',body:JSON.stringify({status,date,notes,location})})).transfer,
};

export const concentrationApi={
 saveInventoryData:async(id:string,data:ConcentrationInventoryData)=>
  (await request<{data:ConcentrationInventoryData}>(
   '/api/concentracion/expedientes/'+encodeURIComponent(id)+'/datos-inventario',
   {method:'PUT',body:JSON.stringify(data)}
  )).data,
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

import type { ArchivalLoan, LoanReturnCondition } from './loans';
export type LoanEligibleUser={id:string;name:string;areaId:string;canDeliver:boolean};
export type NewLoanPayload={
 mode:'INDIVIDUAL';
 recordIds:string[];
 requestingAreaId:string;
 requesterUserId:string;
 delivererUserId:string;
 loanDate:string;
 expectedReturnDate:string;
 receivedBy:string;
 observations:string;
};
export type OverdueLoanReport = {
 id:string; number:string; loanFolio:string; requesterId:string; requesterName:string;
 areaId:string; loanStatus:"ACTIVO"|"DEVUELTO"; dueDate:string; date:string; reason:string;
};
export const loanApi={
 reports:async()=>((await request<{reports:OverdueLoanReport[]}>('/api/prestamos/reportes')).reports),
 reportOverdue:async(id:string)=>(await request<{number:string}>('/api/prestamos/'+encodeURIComponent(id)+'/reportes',{method:'POST'})).number,
 eligibleUsers:async()=>((await request<{users:LoanEligibleUser[]}>('/api/prestamos/usuarios-elegibles')).users),
 list:async()=>((await request<{loans:ArchivalLoan[]}>('/api/prestamos')).loans),
 create:async(payload:NewLoanPayload)=>(await request<{loan:ArchivalLoan}>('/api/prestamos',{
  method:'POST',body:JSON.stringify(payload)
 })).loan,
 returnItems:async(id:string,recordIds:string[],date:string,receivedBy:string,notes:string,conditions?:Record<string,LoanReturnCondition>)=>
  (await request<{loan:ArchivalLoan}>('/api/prestamos/'+encodeURIComponent(id)+'/returns',{
    method:'POST',body:JSON.stringify({recordIds,date,receivedBy,notes,conditions})
  })).loan,
};

export type ExportType='tramite'|'concentracion'|'transferencia';
export type SeriesInventoryType = Exclude<ExportType, 'transferencia'>;
export type SeriesInventoryFilters = {
 section:string;series:string;from:string;to:string;areas:string[];users:string[];includePhysicalLocation:boolean;
};
export type SeriesInventoryHeader = {
 administrativeUnit:string;areaName:string;responsible:string;responsiblePosition:string;fund:string;
 cadidoSectionId:string;cadidoSectionName:string;cadidoCode:string;cadidoSeriesName:string;inventoryDate:string;
};
export type SeriesInventoryOptions = {
 series:{section:string;sectionName:string;code:string;name:string}[];
 areas:{id:string;name:string}[];
 users:{id:string;name:string;areaId:string}[];
};
export const inventoriesApi={
 seriesOptions:(type:SeriesInventoryType)=>request<SeriesInventoryOptions>('/api/inventarios/'+type+'/series/opciones'),
 seriesPreview:(type:SeriesInventoryType,filters:SeriesInventoryFilters)=>
  request<{header:SeriesInventoryHeader|null;records:ArchivalRecord[]}>('/api/inventarios/'+type+'/series/vista-previa',{
   method:'POST',body:JSON.stringify(filters)
  }),
 async downloadSeries(type:SeriesInventoryType,filters:SeriesInventoryFilters){
  const url=API_BASE+'/api/inventarios/'+type+'/series.xlsx';
  let response:Response;
  try{response=await fetch(url,{method:'POST',credentials:'include',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(filters)});}
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

export type HomeActivity = { id:string; title:string; detail:string; module:string; action:string; date:string|null };
export type PersonalLoan = {
 folio:string;status:string;inventory:string|null;record:string|null;
 loanDate:string;dueDate:string|null;returnedDate:string|null;
 records:{id:string;number:string|null;title:string|null;returnedDate:string|null}[];
};
export type LoanNotice = {report?:OverdueLoanReport;id:string;title:string;detail:string;module:'inicio';date:string;color:'green'|'wine'|'gold'};
export const homeApi={
 activity:async()=>((await request<{activities:HomeActivity[]}>('/api/inicio/actividad')).activities),
 personalLoans:async()=>((await request<{loans:PersonalLoan[]}>("/api/inicio/mis-prestamos")).loans),
 loanNotices:async()=>((await request<{notices:LoanNotice[]}>('/api/inicio/avisos-prestamos')).notices),
};

export const areasApi={
 list:async()=>((await request<{areas:Area[]}>('/api/catalogos/areas')).areas),
};

export type AdminVersion={id:number;year:number;name:string;reference:string|null;active:number};
export type AdminSeries={tramiteYears:number|null;concentrationYears:number|null;id:number;code:string;name:string;section:string;sectionName:string;active:number;enabled:number;records:number};
export type AdminManager={id:number;name:string;areaId:string;email:string};
export type AdminArea=Area & {parentId?:string;managerId?:number|null};
export const adminCatalogApi={
 areas:async()=>((await request<{areas:AdminArea[]}>('/api/admin-catalog/areas')).areas),
 managers:async()=>((await request<{users:AdminManager[]}>('/api/admin-catalog/encargados')).users),
 saveArea:async(area:AdminArea,editing:boolean)=>request<{areas:AdminArea[]}>('/api/admin-catalog/areas'+(editing?'/'+encodeURIComponent(area.id):''),{
  method:editing?'PUT':'POST',body:JSON.stringify(area),
 }),
 versions:async()=>((await request<{versions:AdminVersion[]}>('/api/admin-catalog/versions')).versions),
 createVersion:(year:number,name:string,reference:string)=>request<{ok:boolean}>('/api/admin-catalog/versions',{
  method:'POST',body:JSON.stringify({year,name,reference}),
 }),
 series:async(year:number,areaId:string)=>((await request<{series:AdminSeries[]}>(
 '/api/admin-catalog/series?year='+year+'&area='+encodeURIComponent(areaId))).series),
 saveSeries:(areaId:string,year:number,seriesIds:number[])=>request<{ok:boolean;enabled:number}>(
 '/api/admin-catalog/areas/'+encodeURIComponent(areaId)+'/series',{
 method:'PUT',body:JSON.stringify({year,seriesIds}),
 }),
 importSeries:(year:number,file:string)=>request<{created:number;completed:number;unchanged:number}>(
  '/api/admin-catalog/series/importar',{method:'POST',body:JSON.stringify({year,file})}),
 downloadTemplate:async()=>{
  const response=await fetch(API_BASE+'/api/admin-catalog/series/plantilla.xlsx',{credentials:'include'});
  if(!response.ok) throw new Error('No se pudo descargar la plantilla CADIDO.');
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
  link.href=url;link.download='Plantilla_importacion_CADIDO.xlsx';
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 },
 createSeries:(year:number,code:string,name:string,sectionName:string)=>request<{ok:boolean}>('/api/admin-catalog/series',{
 method:'POST',body:JSON.stringify({year,code,name,sectionName}),
 }),
};

export type ReceptionLocation={archiveZone:string;room:string;shelf:string;level:string;physicalSection:string;position:string;locationBox:string;locationNotes:string};

export type AreaStaffSummary = {
  id:string; name:string; email:string; areaId:string; areaName:string;
  status:"Activo"|"Inactivo"; activeInventories:number; transferredInventories:number;
};
export type AreaStaffDetail = {
  user:AreaStaffSummary;
  inventories:{id:string;folio:string;openedAt:string;deletedAt:string|null;status:string;recordCount:number}[];
  transfers:{id:string;folio:string;inventoryFolio:string;sentAt:string;acceptedAt:string;status:string}[];
  records:{id:string;recordNumber:string;title:string;inventoryFolio:string;openedAt:string;closedAt:string;status:string}[];
  activity:{key:string;date:string;action:string;detail:string;source:string}[];
};
export const areaControlApi = {
  list:async(area="")=>(await request<{users:AreaStaffSummary[]}>(
    "/api/control-area/usuarios"+(area?"?area="+encodeURIComponent(area):"")
  )).users,
  detail:async(id:string)=>(await request<AreaStaffDetail>(
    "/api/control-area/usuarios/"+encodeURIComponent(id)
  )),
};

export type PrimaryPeriod='all'|'week'|'twoweeks'|'fortnight'|'month'|'bimester'|'trimester'|'fourmonth'|'semester'|'year'|'custom';
export type PrimaryFilters={
  period:PrimaryPeriod;year:number;block:number;from:string;to:string;
  dateField:'inventory'|'opening'|'transfer';
  stage:'tramite'|'concentracion'|'ambos';
  area:string;creator:string;
  section:string;series:string;cadido:string;
  recordIds:string[];
};
export type PrimaryCandidate={
 id:string;recordNumber:string;title:string;openDate:string;areaId:string;cadidoCode:string;
 archiveClassificationCode:string;sectionCode:string;section:string;series:string;stage:string;
};
export type PrimaryPreviewRow=PrimaryCandidate;
async function primaryRequest<T>(path:string,filters:PrimaryFilters):Promise<T>{
 return request<T>('/api/inventarios/transferencia/'+path,{
   method:'POST',body:JSON.stringify(filters),
 });
}
export const primaryTransferApi={
 options:async(filters:PrimaryFilters)=>primaryRequest<{total:number,creators:{id:string,name:string}[],records:PrimaryCandidate[]}>('opciones',filters),
 preview:async(filters:PrimaryFilters)=>primaryRequest<{total:number,seriesCount:number,areas:number,records:PrimaryPreviewRow[],truncated:boolean}>('vista-previa',filters),
 async download(filters:PrimaryFilters){
  let response:Response;
  try{
   response=await fetch(API_BASE+'/api/inventarios/transferencia/seleccion.xlsx',{
     method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
     body:JSON.stringify(filters),
   });
  }catch{throw new Error('No se pudo conectar con el servidor para descargar Excel.');}
  if(!response.ok){
   const payload=await response.json().catch(()=>({})) as {error?:string};
   throw new Error(payload.error||'No se pudo descargar el inventario.');
  }
  const blob=await response.blob();
  if(!blob.size)throw new Error('El servidor devolvió un Excel vacío.');
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||
    'concentrado_documental_seleccionado.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(link.href),30000);
 }
};

export type DisposalRecord = {
 id:string;number:string;title:string;inventory:string;
 section:string;sectionCode:string;series:string;code:string;classification:string;
 opened:string;closed:string;retention:string;
};
export type DisposalProposal = {
 id:string;folio:string;area:string;requester:string;createdDate:string;
 status:'PROPUESTA'|'BAJA'|'NO_PROCEDE';
 decisionReference:string|null;decisionDate:string|null;notes:string|null;
 resolvedBy:string|null;resolvedDate:string|null;
};
export type DisposalDetail = DisposalProposal & {records:DisposalRecord[]};
export const disposalApi = {
 list:()=>request<{proposals:DisposalProposal[]}>('/api/bajas'),
 candidates:()=>request<{records:DisposalRecord[]}>('/api/bajas/expedientes'),
 detail:(id:string)=>request<{proposal:DisposalDetail}>('/api/bajas/'+encodeURIComponent(id)),
 create:(recordIds:string[])=>request<{id:string;folio:string}>('/api/bajas',{
  method:'POST',body:JSON.stringify({recordIds}),
 }),
 resolve:(id:string,decision:{status:'BAJA'|'NO_PROCEDE';date:string;reference:string;notes:string})=>
  request<{ok:boolean}>('/api/bajas/'+encodeURIComponent(id)+'/resolucion',{
   method:'POST',body:JSON.stringify(decision),
  }),
 async download(proposal:DisposalProposal){
  const response=await fetch(API_BASE+'/api/bajas/'+encodeURIComponent(proposal.id)+'/listado.xlsx',{credentials:'include'});
  if(!response.ok){
   const data=await response.json().catch(()=>({}));
   throw new Error(data.error||'No se pudo descargar el listado.');
  }
  const url=URL.createObjectURL(await response.blob());
  const link=document.createElement('a');
  link.href=url;
  link.download=proposal.folio+'.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 },
};
