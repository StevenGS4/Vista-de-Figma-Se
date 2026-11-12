// Contrato de la base académica ya definida para el proyecto SEMARNAT.
// Esta lista es de LECTURA: el diagnóstico nunca crea, borra ni edita registros.
export const REQUIRED_COLUMNS = Object.freeze({
 areas: ['id','codigo','nombre','activo'],
 usuarios: ['id','codigo','nombres','apellido_paterno','correo','password_hash','area_id','estado','cambiar_password'],
 roles: ['id','codigo','nombre'],
 usuario_roles: ['usuario_id','rol_id'],
 sesiones: ['usuario_id','token_hash','expira_en','revocado_en'],
 secciones_cadido: ['id','codigo','nombre','es_demostracion'],
 series_cadido: ['id','seccion_id','codigo','nombre','activo','es_demostracion'],
 series_areas: ['serie_id','area_id'],
 inventarios: ['id','folio','area_id','creado_por','serie_id','seccion_id','estado','fecha_elaboracion'],
 expedientes: ['id','inventario_id','numero_expediente','consecutivo','etapa','disponibilidad',
  'soporte','anios_tramite','anios_concentracion','anios_total','archivo_zona',
  'lugar_resguardo','estante','nivel','seccion_fisica'],
 expediente_valores: ['expediente_id','valor'],
 transferencias: ['id','folio','area_id','solicitante_id','estado','visto_bueno_por','aceptada_por'],
 transferencia_inventarios: ['transferencia_id','inventario_id'],
 transferencia_historial: ['id','transferencia_id','usuario_id','accion','fecha'],
 recepciones: ['id','transferencia_id','estado','fecha','responsable_id'],
 prestamos: ['id','folio','modalidad','inventario_id','area_solicitante_id','fecha_prevista','estado'],
 prestamo_expedientes: ['prestamo_id','expediente_id','devuelto_en','recibido_devolucion_por'],
 prestamo_historial: ['id','prestamo_id','actor_id','accion','fecha'],
 auditoria: ['id','actor_id','entidad','entidad_id','accion','fecha'],
});
export const REQUIRED_PROCEDURES = Object.freeze([
 'sp_aceptar_transferencia','sp_registrar_prestamo','sp_devolver_expediente'
]);
export const REQUIRED_VIEWS = Object.freeze(['vw_inventarios_resumen','vw_prestamos_vencimiento']);
export const REQUIRED_ROLE_CODES = Object.freeze(['PERSONAL','JEFE_AREA','PRESTAMOS','ADMIN']);
export function compareSchema({columns,procedures,views,roles}){
 const errors=[];
 for(const [table,expected] of Object.entries(REQUIRED_COLUMNS)){
  const actual=new Set(columns[table]||[]);
  for(const name of expected){
   if(!actual.has(name))errors.push('Falta '+table+'.'+name);
  }
 }
 for(const name of REQUIRED_PROCEDURES)if(!procedures.includes(name))errors.push('Falta procedimiento '+name);
 for(const name of REQUIRED_VIEWS)if(!views.includes(name))errors.push('Falta vista '+name);
 for(const name of REQUIRED_ROLE_CODES)if(!roles.includes(name))errors.push('Falta rol '+name);
 return errors;
}
