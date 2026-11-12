# Etapa 5 — Préstamos y devoluciones (MySQL)

## Alcance
- GET /api/prestamos: consulta autorizada de préstamos, vigencias, historial, modalidad y expedientes pendientes.
- POST /api/prestamos: registra la entrega física INDIVIDUAL o INVENTARIO_COMPLETO usando el procedimiento SQL existente sp_registrar_prestamo. Cambia disponibilidad a PRESTADO sin modificar etapa archivística.
- POST /api/prestamos/:id/returns: devuelve uno o varios expedientes pendientes usando sp_devolver_expediente, conservando ACTIVO mientras haya registros pendientes y DEVUELTO cuando no quede ninguno.
- La selección de inventario completo compara TODOS los expedientes del inventario con los solicitados para impedir préstamos parciales disfrazados.
- Se verifican rol, disponibilidad y pertenencia al mismo inventario en el servidor. MySQL conserva el índice único de préstamos activos y los triggers que protegen cambios de disponibilidad.
- Las fechas de entrega/devolución se registran con la fecha REAL del servidor MySQL, sin aceptar fechas históricas ficticias de React.
- Las fechas previstas determinan el estado Vencido y Próximo a vencer en la interfaz existente.
- Los movimientos de entrega y devolución quedan en prestamo_historial; operaciones significativas se registran además en auditoria.
- El actor que autoriza y entrega es la cuenta autenticada, sin confiar en un texto manipulable desde el navegador.

## Permisos
Únicamente Encargado de préstamos / Control archivístico y Administrador / Coordinador pueden consultar, prestar o registrar devoluciones.

## Verificación local final (requiere MySQL)
1. Abrir MySQL Workbench y ejecutar previamente la migración aditiva Backend/sql/004_concentracion_zona.sql del módulo 4.
2. Confirmar que el SQL original contiene procedimientos sp_registrar_prestamo y sp_devolver_expediente y los triggers de disponibilidad.
3. Arrancar React y backend; iniciar sesión con rol encargado de préstamos o administrador.
4. En Concentración seleccionar un expediente EN_ARCHIVO; registrar préstamo individual con una fecha prevista válida.
5. Recargar: debe seguir PRESTADO en los listados y préstamo ACTIVO.
6. Intentar prestarlo otra vez: el servidor debe rechazarlo, sin duplicación.
7. Registrar devolución: disponibilidad regresa a EN_ARCHIVO; etapa permanece CONCENTRACION y préstamo DEVUELTO.
8. Registrar préstamo de inventario completo con más de una fila; comprobar que todas quedan PRESTADO.
9. Registrar devolución parcial de una fila: préstamo sigue ACTIVO y otras filas continúan PRESTADO.
10. Registrar las restantes: préstamo DEVUELTO y todas quedan EN_ARCHIVO.
11. Vencimientos: comparar fecha_prevista y CURDATE() sin alterar estado de préstamo ACTIVO. Verificar vista vw_prestamos_vencimiento.
12. Intentar prestar inventario con una fila ya prestada o expediente de TRAMITE: rechazo.
13. Confirmar que un rol personal/encargado de área recibe 403 en las rutas de préstamos.
14. Confirmar historial y auditoría y que los préstamos permanecen tras recargar navegador.

## Consultas MySQL
```sql
USE semarnat_archivistico_academico_2026;
SELECT id,folio,modalidad,inventario_id,fecha_prestamo,fecha_prevista,estado
FROM prestamos ORDER BY id DESC;
SELECT prestamo_id,expediente_id,devuelto_en,recibido_devolucion_por
FROM prestamo_expedientes ORDER BY prestamo_id DESC,expediente_id;
SELECT id,inventario_id,etapa,disponibilidad FROM expedientes ORDER BY id DESC;
SELECT * FROM vw_prestamos_vencimiento ORDER BY id DESC;
SELECT prestamo_id,accion,fecha,detalle FROM prestamo_historial ORDER BY id DESC;
```

## Límites conocidos
- El procedimiento sp_registrar_prestamo hace la transacción de creación y de disponibilidad; las notas de recepción se completan después de ese COMMIT. El control de integridad del préstamo no depende de las notas.
- La devolución de múltiples expedientes se realiza con una transacción atómica POR EXPEDIENTE mediante el procedimiento original. Si falla una fila, las anteriores quedan confirmadas y el navegador recarga el estado real; no es una transacción única de todo el lote. Si se exige devolución colectiva todo-o-nada, hará falta un procedimiento SQL adicional.
- El formulario original de Figma permite ingresar nombres de autorización y de entrega, pero el backend usa la identidad autenticada como fuente de verdad y los campos no se usan para suplantar al autorizador.
- Por ahora no se emiten avisos periódicos automáticamente: la bandeja distingue próximos vencimientos y vencidos. La implementación de recordatorios push/correo puede tratarse después.
- No se han ejecutado pruebas de integración real sobre el servidor MySQL local del usuario. No utilizar datos institucionales reales antes de la revisión integral.
