import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('CADIDO oficial 2023: 22 secciones y 260 series con códigos únicos',async()=>{
 const filename=fileURLToPath(new URL('../data/cadido_semarnat_2023.json',import.meta.url));
 const catalog=JSON.parse(await readFile(filename,'utf8'));
 assert.equal(catalog.anio,2023);
 assert.equal(catalog.secciones.length,22);
 assert.equal(catalog.series.length,260);
 assert.equal(new Set(catalog.series.map(x=>x.codigo)).size,260);
 const sections=new Set(catalog.secciones.map(x=>x.codigo));
 assert.equal(sections.size,22);
 for(const series of catalog.series){
  assert.match(series.codigo,/^\d{1,2}[CS]\.\d{1,3}$/);
  assert.ok(series.nombre.trim());
  assert.ok(sections.has(series.seccion));
 }
 assert.equal(catalog.series.find(x=>x.codigo==='4C.3').nombre,'EXPEDIENTE ÚNICO DE PERSONAL');
 assert.equal(catalog.series.find(x=>x.codigo==='4S.1').nombre,'MANIFESTACIONES DE IMPACTO AMBIENTAL (MIA)');
});
