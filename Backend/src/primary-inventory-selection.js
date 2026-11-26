// Inventario documental consolidado: selección y periodos sin alterar estados.
// El servidor aplica siempre el alcance del usuario; nunca confía en IDs del navegador.
import { exportScope } from './export-policy.js';
import { readRecords } from './tramite.js';
import { validDate } from './loan-policy.js';

const error=(message,status=400)=>Object.assign(new Error(message),{status});
const numeric=(value,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
const allowedPeriods=['all','week','twoweeks','fortnight','month','bimester','trimester','fourmonth','semester','year','custom'];
const allowedStage=['tramite','concentracion','ambos'];
const allowedDates=['inventory','opening','transfer'];
const uniqueText=(input,max,pattern)=>(()=>{
 if(!Array.isArray(input)||input.length>max)throw error('Demasiados elementos seleccionados');
 const clean=input.map(x=>String(x));
 if(clean.some(x=>!pattern.test(x)))throw error('Selección inválida');
 return [...new Set(clean)];
})();
export function normalizePrimarySelection(body={},requireRecords=false){
 if(!body||typeof body!=='object'||Array.isArray(body))throw error('Filtros inválidos');
 const period=body.period||'all',stage=body.stage||'ambos',dateField=body.dateField||'inventory';
 if(!allowedPeriods.includes(period)||!allowedStage.includes(stage)||!allowedDates.includes(dateField))
  throw error('Tipo de filtro inválido');
 const year=body.year==null||body.year===''?null:Number(body.year);
 const block=body.block==null||body.block===''?null:Number(body.block);
 const ranges={week:53,twoweeks:27,fortnight:24,month:12,bimester:6,trimester:4,fourmonth:3,semester:2,year:1};
 if(period!=='all'&&period!=='custom'&&!numeric(year,1900,2200))throw error('Selecciona un año válido');
 if(ranges[period]&&!numeric(block??1,1,ranges[period]))throw error('Periodo fuera de rango');
 const from=body.from||'',to=body.to||'';
 if((from&&!validDate(from))||(period==='custom'&&(!from||!validDate(to)||from>to)))throw error('Rango de fechas inválido');
 const area=String(body.area||'').trim(),creator=String(body.creator||'').trim();
 const section=String(body.section||'').trim(),series=String(body.series||'').trim();
 const cadido=String(body.cadido||'').trim().toLowerCase();
 if([area,creator,section,series].some(x=>x.length>80)||cadido.length>120)throw error('Filtro demasiado largo');
 if((body.selection && !['all','records'].includes(body.selection)) || body.inventoryIds?.length)
  throw error('Selecciona únicamente expedientes individuales');
 const recordIds=uniqueText(body.recordIds||[],10000,/^REG-[1-9]\d*$/);
 if((requireRecords||body.selection==='records')&&!recordIds.length)
  throw error('Selecciona al menos un expediente');
 return {period,year,block:block??1,from,to,stage,dateField,area,creator,section,series,cadido,recordIds};
}
const iso=(year,month,day)=>new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);
export function periodBounds(filter){
 if(filter.period==='all')return null;
 if(filter.period==='custom')return [filter.from,filter.to];
 if(filter.period==='year')return [iso(filter.year,0,1),iso(filter.year,12,0)];
 if(filter.period==='week'){
  const start=new Date(Date.UTC(filter.year,0,1));
  const day=start.getUTCDay()||7;
  start.setUTCDate(start.getUTCDate()-(day-1)+7*(filter.block-1));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);
  return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)];
 }
 if(filter.period==='twoweeks'){
  const start=new Date(Date.UTC(filter.year,0,1));
  start.setUTCDate(start.getUTCDate()+14*(filter.block-1));
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+13);
  const last=iso(filter.year,12,0);
  return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)>last?last:end.toISOString().slice(0,10)];
 }
 if(filter.period==='fortnight'){
  const month=Math.ceil(filter.block/2)-1;
  const first=filter.block%2===1;
  return [iso(filter.year,month,first?1:16),first?iso(filter.year,month,15):iso(filter.year,month+1,0)];
 }
 const size={month:1,bimester:2,trimester:3,fourmonth:4,semester:6}[filter.period];
 if(!size)throw error('Periodo inválido');
 const start=(filter.block-1)*size;
 return [iso(filter.year,start,1),iso(filter.year,start+size,0)];
}
export async function selectPrimaryRecords(conn,user,body,requireRecords=false){
 const f=normalizePrimarySelection(body,requireRecords);
 const scope=exportScope(user,'transferencia');
 if(!scope)throw error('No tienes permiso para consultar transferencia primaria',403);
 if(f.area&&scope!=='GLOBAL'&&f.area!==String(user.areaId))throw error('Área fuera de tu alcance',403);
 if(f.creator&&scope==='PROPIO'&&f.creator!==String(user.id))throw error('Usuario fuera de tu alcance',403);
 const filters=['i.deleted_at IS NULL','e.deleted_at IS NULL'];
 const args=[];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');args.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('e.creado_por=?');args.push(user.id);}
 if(f.area){filters.push('a.codigo=?');args.push(f.area);}
 if(f.creator){
  if(!/^\d{1,16}$/.test(f.creator))throw error('Usuario inválido');
  filters.push('e.creado_por=?');args.push(Number(f.creator));
 }
 if(f.stage!=='ambos'){filters.push('e.etapa=?');args.push(f.stage==='tramite'?'TRAMITE':'CONCENTRACION');}
 if(f.section){filters.push('sc.codigo=?');args.push(f.section);}
 if(f.series){filters.push('sr.codigo=?');args.push(f.series);}
 if(f.cadido){filters.push('LOWER(e.codigo_clasificacion) LIKE ?');args.push('%'+f.cadido.replace(/[%_]/g,'\\$&')+'%');}
 const bounds=periodBounds(f);
 const start=bounds&&bounds[0]>f.from?bounds[0]:f.from;
 const end=bounds?.[1];
 if(f.dateField!=='transfer'){
  const column=f.dateField==='opening'?'e.apertura':'i.fecha_elaboracion';
  if(start){filters.push(column+'>=?');args.push(start);}
  if(end){filters.push(column+'<=?');args.push(end);}
 }
 if(f.recordIds.length){
  filters.push('e.id IN ('+f.recordIds.map(()=>'?').join(',')+')');
  args.push(...f.recordIds.map(id=>id.slice(4)));
 }
 const where='WHERE '+filters.join(' AND ');
 // Contar ANTES de montar el Excel para impedir consultas enormes.
 const [count]=await conn.execute(`SELECT COUNT(*) AS n FROM expedientes e
  JOIN inventarios i ON i.id=e.inventario_id JOIN areas a ON a.id=i.area_id
  JOIN secciones_cadido sc ON sc.id=i.seccion_id
  JOIN series_cadido sr ON sr.id=e.serie_id
  ${where}`,args);
 if(Number(count[0].n)>15000)throw error('Demasiados expedientes. Reduce el periodo o los filtros (máximo 15,000)',413);
 let records=await readRecords(conn,where,args);
 if((start||end)&&f.dateField==='transfer')records=records.filter(r=>r.transferDate&&
  (!start||r.transferDate>=start)&&(!end||r.transferDate<=end));
 if(requireRecords&&new Set(records.map(record=>record.id)).size!==f.recordIds.length)
  throw error('Uno o más expedientes ya no coinciden con los filtros o están fuera de tu alcance',409);
 const unique=new Map(records.map(r=>[r.id,r]));
 return [...unique.values()];
}
