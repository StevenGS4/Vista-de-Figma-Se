# Etapa 3 — Transferencias documentales con MySQL

## Implementado
- GET /api/transferencias: bandeja limitada a roles, área y solicitante.
- POST /api/transferencias: envío de uno o más INVENTARIOS COMPLETOS. El backend comprueba cada expediente, todos los inventarios son del área permitida, no están prestados ni vinculados a otro movimiento; se reservan mediante inventarios.estado=EN_TRANSFERENCIA. Los expedientes siguen en TRAMITE.
- POST /api/transferencias/:id/approve-area: visto bueno de encargado de área distinto del solicitante. PENDIENTE_VB -> PENDIENTE_ADMIN.
- POST /api/transferencias/:id/observe: observación desde encargado de área o administrador en la etapa correspondiente.
- POST /api/transferencias/:id/resend: el solicitante reenvía después de observaciones, conservando íntegra la relación de inventarios.
- POST /api/transferencias/:id/accept: ejecuta CALL sp_aceptar_transferencia(transferencia_id,admin_id), utilizando el procedimiento existente que cambia todos los expedientes de forma atómica. El estado anterior debe ser PENDIENTE_ADMIN y existir visto bueno. No permite autoaprobación.
- POST /api/transferencias/:id/reception: registra recepción física posterior a aceptación, con recibido o diferencias y observaciones. No modifica la etapa archivística.
- Historial persistente mediante transferencia_historial, y registro informativo de auditoría.
- La pantalla original de Figma utiliza estas rutas. Los datos falsos initialTransfers ya no se cargan en App.tsx.

## Comportamientos importantes
1. Un inventario solicitado pasa a EN_TRANSFERENCIA, pero sus expedientes siguen en etapa TRAMITE.
2. El visto bueno del área y las observaciones NO cambian etapa.
3. Solo el procedimiento almacenado sp_aceptar_transferencia cambia de TRAMITE a CONCENTRACION; se usa la transacción propia del procedimiento.
4. La recepción física no implica otra transferencia de etapa: se registra separadamente en recepciones.
5. La BD dispone de índice UNIQUE(transferencia_inventarios.inventario_id), por lo que no se puede vincular un inventario a dos transferencias.
6. El reenvío tras observaciones conserva los inventarios ya vinculados; las correcciones sustantivas de expedientes reservados quedan fuera de este primer flujo. No se alteran triggers ni se permite editarlos mientras EN_TRANSFERENCIA.

## Pruebas finales sugeridas
1. Iniciar con cuenta de personal; registrar inventario de tres expedientes (etapa 2); enviar transferencia desde Figma.
2. Confirmar transferencia PENDIENTE_VB e inventario EN_TRANSFERENCIA, con TODOS los expedientes todavía TRAMITE.
3. Usuario no autorizado: debe responder 403 al intentar dar visto bueno.
4. Encargado de área distinto del emisor aprueba. La solicitud pasa a PENDIENTE_ADMIN y expedientes siguen TRAMITE.
5. Administrador distinto del emisor acepta. Comprobar que los tres expedientes cambian a CONCENTRACION, misma transacción.
6. Registrar recepción física, con fecha >= aceptación, y verificar historial.
7. Verificar que no se puede enviar un inventario incompleto, duplicado, prestado o de otra área.
8. Devolver con observaciones antes de aceptación; reenviar sin cambiar inventarios y comprobar que exige nuevo visto bueno.
9. Intentar aceptar dos veces. Debe rechazarse la segunda llamada.
10. Recargar navegador y comprobar que estado, fechas e historial siguen en MySQL.

## SQL orientativo
USE semarnat_archivistico_academico_2026;
SELECT id,folio,estado,area_id,solicitante_id,visto_bueno_por,aceptada_por FROM transferencias ORDER BY id DESC;
SELECT transferencia_id,inventario_id FROM transferencia_inventarios ORDER BY transferencia_id DESC;
SELECT id,folio,estado FROM inventarios ORDER BY id DESC;
SELECT inventario_id,numero_expediente,etapa FROM expedientes ORDER BY id DESC;
SELECT transferencia_id,accion,fecha,usuario_id FROM transferencia_historial ORDER BY id DESC;
SELECT transferencia_id,estado,fecha,observaciones FROM recepciones ORDER BY id DESC;

## Configuración
- Se requiere haber ejecutado el SQL original con el procedimiento sp_aceptar_transferencia y los triggers en MySQL 8.
- No se ejecutan migraciones ni scripts destructivos.
- npm install en raíz y Backend, luego npm run dev en ambos.
- Revisar Backend/TEST_AUTH.md y Backend/TEST_TRAMITE.md para la preparación.
- Las pruebas unitarias corren sin MySQL mediante npm test en Backend.
- Las pruebas SQL de integración solo pueden ejecutarse en tu servidor MySQL local al final.

## Alcance pendiente
El módulo de concentración requiere su propia API de actualización de ubicación y controles de resguardo; préstamos, devoluciones y Excel también siguen pendientes. No se ha verificado aún este flujo de extremo a extremo en MySQL local. La aplicación es todavía una versión académica de prueba, no un sistema listo para expedientes reales.
