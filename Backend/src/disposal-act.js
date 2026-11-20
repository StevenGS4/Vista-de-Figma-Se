import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const template = new URL('../templates/Plantilla_Acta_Baja_Documental_SEMARNAT_Nayarit.docx', import.meta.url);
const escapeXml = (value) => String(value ?? '').replace(/[&<>"']/g, char => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]
));

function fill(xml, values) {
  return xml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error('Marcador del acta sin valor: ' + key);
    return escapeXml(values[key]);
  });
}

function expiration(record) {
  if (!record.closeDate || !record.totalValidity) return '';
  const [year, month, day] = record.closeDate.split('-').map(Number);
  const targetYear = year + Number(record.totalValidity);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export async function buildDisposalAct(values, records) {
  const zip = await JSZip.loadAsync(await readFile(template));
  const name = 'word/document.xml';
  const xml = await zip.file(name).async('string');
  const row = [...xml.matchAll(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g)]
    .find(match => match[0].includes('{{clave_expediente}}'));
  if (!row) throw new Error('La plantilla del acta no contiene la fila del Anexo A');
  const rows = records.map((record, index) => fill(row[0], {
    n: index + 1,
    clave_expediente: record.archiveClassificationCode || record.recordNumber,
    area_serie: [record.areaName, record.cadidoCode, record.cadidoSeriesName].filter(Boolean).join(' · '),
    asunto: record.title || record.description,
    periodo: [record.openDate, record.closeDate].filter(Boolean).join(' a '),
    vencimiento: expiration(record),
    caja: record.locationBox || record.boxNumber,
  })).join('');
  const openings = records.map(record => record.openDate).filter(Boolean).sort();
  const endings = records.map(record => record.closeDate || record.openDate).filter(Boolean).sort();
  const filled = fill(xml.slice(0, row.index), {
    ...values,
    total_expedientes: records.length,
    periodo_documental: [openings[0], endings.at(-1)].filter(Boolean).join(' a '),
    areas_productoras: [...new Set(records.map(record => record.areaName))].join(', '),
    version_cadido_aplicada: [...new Set(records.map(record => record.cadidoYear).filter(Boolean))].join(', '),
  });
  zip.file(name, filled + rows + fill(xml.slice(row.index + row[0].length), values));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
