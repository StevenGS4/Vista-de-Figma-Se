// Separar los datos de presentación de los registros físicos.
export const exportTypes = Object.freeze({
 tramite: 'Inventario de archivo de trámite',
 concentracion: 'Inventario de archivo de concentración',
 transferencia: 'Relación de inventarios para transferencia primaria',
});

export function safeCell(value) {
 if (value == null) return '';
 if (typeof value === 'number') return Number.isFinite(value) ? value : '';
 const text = Array.isArray(value) ? value.join(', ') : String(value);
 // El lector de Excel no debe interpretar como fórmula datos capturados por usuarios.
 return /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
}
export function stageForType(type) {
 if (type === 'tramite') return 'TRAMITE';
 if (type === 'concentracion') return 'CONCENTRACION';
 if (type === 'transferencia') return 'TRAMITE';
 return null;
}
export function exportScope(user,type) {
 if (!user || user.mustChangePassword || !Object.hasOwn(exportTypes,type)) return null;
 const roles=user.roles || [];
 if (roles.includes('Administrador / Coordinador')) return 'GLOBAL';
 if (roles.includes('Encargado de préstamos / Control archivístico'))
  return type==='tramite' || type==='transferencia' ? null : 'GLOBAL';
 if (roles.includes('Encargado de área')) return 'AREA';
 if (roles.includes('Personal de área')) return 'PROPIO';
 return null;
}
export function filterExportRecords(records,type) {
 const stage=stageForType(type);
 return records.filter(r=>(stage==='TRAMITE' ? r.stage==='Archivo de trámite'
  : r.stage==='Archivo de concentración'));
}
