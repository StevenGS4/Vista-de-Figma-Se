import ExcelJS from 'exceljs';

const headers = ['codigo', 'serie', 'seccion', 'anios_tramite', 'anios_concentracion'];
const invalid = message => Object.assign(new Error(message), {status:400});

export async function cadidoTemplate() {
 const book = new ExcelJS.Workbook();
 const sheet = book.addWorksheet('CADIDO');
 sheet.columns = headers.map((header,i) => ({header,width:[15,45,35,22,24][i]}));
 sheet.getRow(1).font = {bold:true};
 sheet.views = [{state:'frozen',ySplit:1}];
 const guide = book.addWorksheet('Guía');
 guide.getColumn(1).width = 105;
 for(const instruction of [
  'Selecciona la edición en Administración antes de importar.',
  'En la hoja CADIDO escribe una serie por fila. Conserva los encabezados.',
  'Código: por ejemplo, 1C.11. Serie y sección: nombres del catálogo validado.',
  'Captura ambos plazos de guarda en años enteros, incluido cero cuando así conste.',
  'Si no hay plazos numéricos verificables, deja ambas celdas vacías.',
  'Para 2023 solo se admiten códigos ya registrados y se completan sus plazos faltantes.',
  'La importación no asigna series a las áreas. Guarda las asignaciones por separado.'
 ]) guide.addRow([instruction]);
 return book.xlsx.writeBuffer();
}

export async function readCadidoFile(base64) {
 if(typeof base64 !== 'string' || base64.length > 3_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
  throw invalid('Selecciona un archivo .xlsx de hasta 2 MB');
 const book = new ExcelJS.Workbook();
 try { await book.xlsx.load(Buffer.from(base64,'base64')); }
 catch { throw invalid('No se pudo abrir el Excel. Usa la plantilla de importación.'); }
 const sheet = book.getWorksheet('CADIDO');
 if(!sheet || !headers.every((name,i)=>sheet.getRow(1).getCell(i+1).text.trim()===name))
  throw invalid('La hoja CADIDO debe conservar los cinco encabezados de la plantilla');
 if(sheet.rowCount>10001) throw invalid('Importa hasta 10,000 series por archivo');
 const rows=[], seen=new Set();
 sheet.eachRow((row,index)=>{
  if(index===1) return;
  const cells=headers.map((_,i)=>row.getCell(i+1));
  if(cells.some(cell=>cell.formula)) throw invalid('Fila '+index+': usa valores, no fórmulas');
  const [code,name,section,at,ac]=cells.map(cell=>cell.text.trim());
  if(!code&&!name&&!section&&!at&&!ac) return;
  const key=code.toUpperCase();
  if(!/^\d{1,2}[CS]\.\d{1,3}$/.test(key)||!name||name.length>300||!section||section.length>220)
   throw invalid('Fila '+index+': verifica el código, el nombre de la serie y la sección');
  if(seen.has(key)) throw invalid('Fila '+index+': código duplicado '+key);
  if(Boolean(at)!==Boolean(ac)||[at,ac].some(v=>v && (!/^\d{1,5}$/.test(v)||Number(v)>65535)))
   throw invalid('Fila '+index+': captura dos plazos enteros válidos o deja ambos vacíos');
  seen.add(key);
  rows.push({code:key,name,section,at:at===''?null:Number(at),ac:ac===''?null:Number(ac)});
 });
 if(!rows.length) throw invalid('Agrega al menos una serie a la plantilla');
 return rows;
}
