// Inventario documental consolidado: selección y periodos sin alterar estados.
// El servidor aplica siempre el alcance del usuario; nunca confía en IDs del navegador.
import { exportScope } from './export-policy.js';
import { readRecords } from './tramite.js';

const error=(message,status=400)=>Object.assign(new Error(message),{status});
const numeric=(value,min,max)=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const dateValid=s=>typeof s==='string'&&datePattern.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'));
const allowedPeriods=['all','week','twoweeks','fortnight','month','bimester','trimester','fourmonth','semester','year','custom'];
const allowedStage=['tramite','concentracion','ambos'];
const allowedDates=['inventory','opening','transfer'];
const allowedSelection=['all','inventories','records','mixed'];
const uniqueText=(input,max,pattern)=>(()=>{
 if(!Array.isArray(input)||input.length>max)throw error('Demasiados elementos seleccionados');
 const clean=input.map(x=>String(x));
 if(clean.some(x=>!pattern.test(x)))throw error('Selección inválida');
 return [...new Set(clean)];
})();
export function normalizePrimarySelection(body={}){
 if(!body||typeof body!=='object'||Array.isArray(body))throw error('Filtros inválidos');
 const period=body.period||'all',stage=body.stage||'ambos',dateField=body.dateField||'inventory',selection=body.selection||'all';
 if(!allowedPeriods.includes(period)||!allowedStage.includes(stage)||!allowedDates.includes(dateField)||!allowedSelection.includes(selection))
  throw error('Tipo de filtro inválido');
 const year=body.year==null||body.year===''?null:Number(body.year);
 const block=body.block==null||body.block===''?null:Number(body.block);
 const ranges={week:53,twoweeks:27,fortnight:24,month:12,bimester:6,trimester:4,fourmonth:3,semester:2,year:1};
 if(period!=='all'&&period!=='custom'&&!numeric(year,1900,2200))throw error('Selecciona un año válido');
 if(ranges[period]&&!numeric(block??1,1,ranges[period]))throw error('Periodo fuera de rango');
 const from=body.from||'',to=body.to||'';
 if(period==='custom'&&(!dateValid(from)||!dateValid(to)||from>to))throw error('Rango de fechas inválido');
 const area=String(body.area||'').trim(),creator=String(body.creator||'').trim();
 const section=String(body.section||'').trim(),series=String(body.series||'').trim();
 const cadido=String(body.cadido||'').trim().toLowerCase();
 if([area,creator,section,series].some(x=>x.length>80)||cadido.length>120)throw error('Filtro demasiado largo');
 const inventoryIds=uniqueText(body.inventoryIds||[],2500,/^[\w-]{1,75}$/);
 const recordIds=uniqueText(body.recordIds||[],10000,/^REG-[1-9]\d*$/);
 if(selection==='inventories'&&!inventoryIds.length||selection==='records'&&!recordIds.length||
    selection==='mixed'&&!inventoryIds.length&&!recordIds.length)
  throw error('Selecciona inventarios o expedientes antes de consultar');
 return {period,year,block:block??1,from,to,stage,dateField,selection,area,creator,section,series,cadido,inventoryIds,recordIds};
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
export async function selectPrimaryRecords(conn,user,body){
 const f=normalizePrimarySelection(body);
 const scope=exportScope(user,'transferencia');
 if(!scope)throw error('No tienes permiso para consultar transferencia primaria',403);
 if(f.area&&scope!=='GLOBAL'&&f.area!==String(user.areaId))throw error('Área fuera de tu alcance',403);
 if(f.creator&&scope==='PROPIO'&&f.creator!==String(user.id))throw error('Usuario fuera de tu alcance',403);
 const filters=['i.deleted_at IS NULL','e.deleted_at IS NULL'];
 const args=[];
 if(scope!=='GLOBAL'){filters.push('a.codigo=?');args.push(user.areaId);}
 if(scope==='PROPIO'){filters.push('i.creado_por=?');args.push(user.id);}
 if(f.area){filters.push('a.codigo=?');args.push(f.area);}
 if(f.creator){
  if(!/^\d{1,16}$/.test(f.creator))throw error('Usuario inválido');
  filters.push('i.creado_por=?');args.push(Number(f.creator));
 }
 if(f.stage!=='ambos'){filters.push('e.etapa=?');args.push(f.stage==='tramite'?'TRAMITE':'CONCENTRACION');}
 if(f.section){filters.push('sc.codigo=?');args.push(f.section);}
 if(f.series){filters.push('sr.codigo=?');args.push(f.series);}
 if(f.cadido){filters.push('LOWER(e.codigo_clasificacion) LIKE ?');args.push('%'+f.cadido.replace(/[%_]/g,'\\$&')+'%');}
 const bounds=periodBounds(f);
 if(bounds){
  const column={inventory:'i.fecha_elaboracion',opening:'e.apertura',transfer:'t.enviada_en'}[f.dateField];
  // La columna de transferencia pertenece a la subconsulta de readRecords,
  // por lo que se evalúa después de cargar expedientes autorizados.
  if(f.dateField!=='transfer'){
   filters.push(column+' BETWEEN ? AND ?');args.push(...bounds);
  }
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
 if(bounds&&f.dateField==='transfer')records=records.filter(r=>r.transferDate>=bounds[0]&&r.transferDate<=bounds[1]);
 if(f.selection!=='all'){
  const inventories=new Set(f.inventoryIds),ids=new Set(f.recordIds);
  records=records.filter(r=>
    (f.selection!=='records'&&inventories.has(r.inventoryId)) ||
    (f.selection!=='inventories'&&ids.has(r.id))
  );
 }
 const unique=new Map(records.map(r=>[r.id,r]));
 return [...unique.values()];
}
