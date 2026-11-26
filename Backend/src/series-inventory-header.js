export function seriesInventoryHeader(records){
 if(!records.length)return null;
 const first=records[0];
 const distinct=get=>[...new Set(records.map(get).filter(Boolean))].join(' · ');
 return {
  administrativeUnit:distinct(record=>record.administrativeUnit),
  areaName:distinct(record=>record.areaName||record.areaId),
  responsible:distinct(record=>record.responsible),
  responsiblePosition:distinct(record=>record.responsiblePosition),
  fund:distinct(record=>record.fund),
  cadidoSectionId:first.cadidoSectionId,
  cadidoSectionName:distinct(record=>record.cadidoSectionName),
  cadidoCode:first.cadidoCode,
  cadidoSeriesName:distinct(record=>record.cadidoSeriesName),
  inventoryDate:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mazatlan'}),
 };
}
