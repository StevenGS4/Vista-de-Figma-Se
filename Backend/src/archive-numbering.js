// Identificadores archivísticos: SEMARNAT.<serie>.<consecutivo con 3 dígitos mínimo>.<año del expediente>.
export function codeFor(serie,index,year){
 if(!/^\d{1,2}[CS]\.\d{1,3}$/.test(String(serie)) ||
    !Number.isSafeInteger(index)||index<1 ||
    !Number.isSafeInteger(Number(year))||Number(year)<1900||Number(year)>2100)
  throw new Error('Serie, consecutivo o año inválido');
 return 'SEMARNAT.'+serie+'.'+String(index).padStart(3,'0')+'.'+year;
}
export function parseArchiveNumber(number,serie){
 const prefix='SEMARNAT.'+serie+'.';
 if(typeof number!=='string'||!number.startsWith(prefix))return null;
 const match=number.slice(prefix.length).match(/^(\d{3,})\.(\d{4})$/);
 if(!match)return null;
 const index=Number(match[1]),year=Number(match[2]);
 return Number.isSafeInteger(index)&&index>0&&year>=1900&&year<=2100?{index,year}:null;
}
export function allocateNumbers(existingNumbers,rows,serie){
 const max=new Map();
 for(const number of existingNumbers){
  const parsed=parseArchiveNumber(number,serie);
  if(parsed)max.set(parsed.year,Math.max(max.get(parsed.year)||0,parsed.index));
 }
 return rows.map(row=>{
  if(/^REG-\d+$/.test(String(row.id)))return null;
  const year=Number(row.recordYear || row.openDate?.slice(0,4) || new Date().getFullYear());
  if(!Number.isSafeInteger(year)||year<1900||year>2100)throw new Error('Selecciona un año válido para el expediente (1900–2100)');
  const number=(max.get(year)||0)+1;
  max.set(year,number);
  return codeFor(serie,number,year);
 });
}
