# Etapa 4 — Archivo de Concentración con MySQL

## Alcance del módulo
- **GET /api/concentracion/expedientes** devuelve solo expedientes con etapa archivística CONCENTRACION.
- **PUT /api/concentracion/expedientes/:id/ubicacion** guarda la ubicación de un expediente específico.
- Se reutiliza la interfaz original `src/ConcentrationPanel.tsx` sin rediseño. Se conservan filtros de área, CADIDO, disponibilidad y búsqueda.
- Se cargan los datos desde MySQL tras el inicio de sesión, combinando Trámite y Concentración en el estado común de React.
- Se muestra la recepción física que corresponde a la transferencia aceptada, sin mezclarla con la etapa del expediente.

## Permisos
| Perfil | Consultar concentración | Editar ubicación |
|---|---|---|
| Personal de área | Expedientes propios de su área | No |
| Encargado de área | Expedientes de su área | No |
| Encargado de préstamos / Control archivístico | Todas las áreas | Sí |
| Administrador / Coordinador | Todas las áreas | Sí |

El backend aplica estos permisos, no solo los botones del frontend.
Las modificaciones no cambian la etapa archivística ni la disponibilidad del préstamo.

## Migración necesaria (no destructiva)
La base existente ya guardaba la **sala** en `expedientes.lugar_resguardo`, además de estante, nivel, sección, posición, caja y notas. Faltaba un lugar separado para **archivo o zona**.

1. Abre MySQL Workbench en tu equipo.
2. Ejecuta `Backend/sql/004_concentracion_zona.sql` en la base `semarnat_archivistico_academico_2026`.
3. Comprueba que aparece la columna `expedientes.archivo_zona`.

La migración es idempotente y **no elimina ni modifica el contenido de columnas anteriores**. No se ejecuta automáticamente en la app.
Sin esta migración, la consulta de concentración generará error; se mostrará como fallo de carga, nunca inventará datos.

## Flujo para comprobación final
1. Usar un inventario creado en Trámite y una transferencia aceptada (etapas 2–3).
2. Iniciar sesión como encargado de préstamos/control archivístico y abrir Concentración.
3. Confirmar la lista de expedientes aceptados; los no aceptados no deben aparecer.
4. Revisar fechas, referencia de transferencia y recepción física cuando exista.
5. Editar la zona, sala, estante, nivel, sección física, posición, caja y notas de un expediente.
6. Guardar, recargar navegador y verificar que se recuperan los mismos valores desde MySQL.
7. Confirmar que solo se modificó el expediente elegido, no los demás de su inventario.
8. Comprobar que la etapa sigue CONCENTRACION y la disponibilidad EN_ARCHIVO/PRESTADO permanece igual.
9. Intentar PUT con rol personal o jefe de área: debe responder 403.
10. Intentar modificar expediente en TRAMITE: debe responder 404 o 409.
11. Probar estante 26 o nivel 5: debe responder 400; comprobar que MySQL no cambió.
12. Verificar el renglón de auditoría ACTUALIZAR_UBICACION.

## SQL de comprobación
```sql
USE semarnat_archivistico_academico_2026;

SELECT id, inventario_id, numero_expediente, etapa, disponibilidad,
       archivo_zona, lugar_resguardo, estante, nivel, seccion_fisica,
       posicion, caja_ubicacion, notas_ubicacion
FROM expedientes WHERE etapa = 'CONCENTRACION' ORDER BY id DESC;

SELECT id, actor_id, entidad, entidad_id, accion, fecha
FROM auditoria WHERE accion = 'ACTUALIZAR_UBICACION' ORDER BY id DESC;

SELECT transferencia_id, estado, fecha, responsable_id, observaciones
FROM recepciones ORDER BY id DESC;
```

## Seguridad y límites
- No se cambian clasificaciones CADIDO, expedientes, etapas ni disponibilidad desde este módulo.
- La recepción física se captura en Transferencias (etapa 3), no en este formulario.
- Las ubicaciones se guardan por expediente, no automáticamente por inventario.
- Código académico: falta probar el flujo real contra el MySQL local del equipo, incluyendo la migración, antes de usar datos institucionales reales.
- La etapa 5 conectará préstamos y devoluciones; por ahora ese módulo sigue siendo una simulación.
