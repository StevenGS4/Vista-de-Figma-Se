# Corrección del flujo archivístico: ubicación en recepción física

## Flujo vigente
1. **Trámite:** personal/encargado captura datos generales, expedientes y control documental. El asistente consta de **cuatro pasos** y no pide estante, nivel, sección o zona de concentración. No envía ni escribe una ubicación física desde la API de Trámite.
2. **Transferencia:** el solicitante envía el inventario y el jefe de área da visto bueno.
3. **Aceptación administrativa:** el administrador revisa y acepta. El procedimiento MySQL `sp_aceptar_transferencia` mueve la etapa a concentración. En este punto la recepción física puede seguir **pendiente**.
4. **Recepción física:** en la misma transferencia aceptada, el administrador registra el cotejo y ubica **cada expediente** (zona, sala, estante, nivel, sección, caja/posición). `Recibida` exige todas las ubicaciones y las guarda en la **misma transacción** de recepción. `Diferencias pendientes` no captura ubicación.
5. **Concentración:** la ubicación se puede consultar; solo un ADMIN puede corregirla y únicamente después de recepción física completa. Préstamos no admite expedientes sin recepción y ubicación completa.

## Base de datos
**No hay que reconstruir tablas ni ejecutar migración SQL nueva.** Se reutilizan las columnas de `expedientes`: `archivo_zona`, `lugar_resguardo`, `estante`, `nivel`, `seccion_fisica`, `posicion`, `caja_ubicacion`, `notas_ubicacion`, junto a `recepciones` y `transferencias`.

La ubicación que ya exista en expedientes anteriores no se borra automáticamente: puede ser un dato histórico legítimo. Si hay pruebas antiguas donde se capturó ubicación equivocadamente en Trámite, hacer **respaldo de MySQL** y auditar esas filas antes de corregirlas; no desactivar claves foráneas ni ejecutar borrados masivos.

## Prueba manual sugerida
1. Iniciar como Personal de área (con CADIDO y encargado asignado); registrar inventario. La secuencia termina en el paso 4 **Revisión**, no aparece ubicación.
2. Verificar en MySQL el expediente de Trámite nuevo: `archivo_zona`, `lugar_resguardo`, `estante`, `nivel`, `seccion_fisica` sin posición física asignada (NULL).
3. Solicitar transferencia, obtener visto bueno y aceptar como ADMIN.
4. Intentar préstamo **antes** de recepción completa: debe rechazarse.
5. Desde Transferencias > Recepción física elegir `Recibida`, asignar ubicación a cada expediente y guardar. Si falta uno, la operación completa debe fallar sin cambios parciales.
6. Confirmar que Concentración muestra las ubicaciones y que solo ADMIN puede modificarlas. Préstamos queda permitido una vez cumplidas las demás reglas.

SQL de verificación de nuevos expedientes:
```sql
SELECT e.id,e.numero_expediente,e.etapa,
 e.archivo_zona,e.lugar_resguardo,e.estante,e.nivel,e.seccion_fisica
FROM expedientes e ORDER BY e.id DESC LIMIT 20;
```

**Limitación:** la comprobación de GitHub compila React, valida sintaxis Node y corre pruebas unitarias. El flujo contra el MySQL local del usuario debe probarse con los pasos anteriores. La aceptación administrativa ya existente ocurre antes del registro de ubicación física; no se cambió el procedimiento institucional de aceptación.
