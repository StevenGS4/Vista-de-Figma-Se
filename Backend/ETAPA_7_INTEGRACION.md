# Etapa 7 — Integración, diagnóstico y pruebas finales (SEMARNAT Nayarit)

**Estado:** código integrado en rama de pruebas; la ejecución en el MySQL del equipo del desarrollador **NO se ha hecho**. No utilizar registros institucionales reales hasta completar todo este protocolo.

## A. Antes de trabajar: proteger datos y obtener la rama

1. Realizar una copia de seguridad de `semarnat_archivistico_academico_2026` con **MySQL Workbench → Server → Data Export**. Seleccionar la base y exportar a un archivo SQL. Confirmar que el archivo se guardó. No usar funciones de borrado ni DROP DATABASE.
2. En Git Bash/PowerShell, en la raíz del proyecto:
   ```powershell
   git status
   git fetch origin
   git switch feature/integracion-validacion-etapa-7
   npm install
   cd Backend
   npm install
   ```
   Si `git switch` informa cambios locales pendientes, guardarlos primero; no usar `git reset --hard`.
3. Conservar `Backend/.env` **solo local**, con DB_HOST/DB_USER/DB_PASSWORD/DB_NAME, `FRONTEND_ORIGIN=http://localhost:8443` y un `JWT_SECRET` aleatorio de al menos 32 caracteres. No subir ese archivo a GitHub.

## B. Diagnóstico de esquema (solo lectura)

Desde `Backend` ejecutar:

```powershell
npm run preflight
```

Compara las tablas/columnas necesarias, los cuatro códigos de rol, las vistas, los procedimientos `sp_aceptar_transferencia`, `sp_registrar_prestamo` y `sp_devolver_expediente`. No edita nada.

Si informa `Falta expedientes.archivo_zona`, abrir MySQL Workbench y ejecutar **una vez**:
`Backend/sql/004_concentracion_zona.sql`

Es una migración aditiva: agrega la columna de zona física sin borrar expedientes. Volver a ejecutar `npm run preflight` y comprobar `OK`.

Si se detectan otras tablas, columnas, procedimientos o roles ausentes, **detener las pruebas** y corregir el esquema de forma controlada; no crear columnas a ciegas.

## C. Iniciar frontend y backend

Terminal 1, dentro de `Backend`:
```powershell
npm run dev
```

Terminal 2, en la raíz:
```powershell
npm run dev
```

Abrir `http://localhost:8443`. Backend esperado `http://localhost:3001`.

Desde `Backend`, en una tercera terminal:
```powershell
npm run smoke
```

Esta prueba no destructiva verifica salud HTTP, conexión MySQL y accesos sin iniciar sesión.

Para añadir sesión autenticada, definir **temporalmente** variables en una terminal, sin publicarlas en Git:
```powershell
$env:SMOKE_EMAIL="correo-de-prueba@example.com"
$env:SMOKE_PASSWORD="contraseña-de-prueba-local"
npm run smoke
Remove-Item Env:SMOKE_EMAIL
Remove-Item Env:SMOKE_PASSWORD
```

El script inicia/cierra una sesión, lee datos autorizados y verifica que el Excel tenga firma real de XLSX. **No crea, transfiere ni presta expedientes**. Si el usuario tiene cambio de contraseña pendiente, primero completar el cambio manualmente con el login de React.

## D. Preparar cuentas para probar los cuatro roles

Crear en Administración cuentas **ficticias** y distintas para:
- Personal de área (emisor)
- Encargado de área (jefe distinto del emisor)
- Encargado de préstamos / Control archivístico
- Administrador / Coordinador (ya disponible por bootstrap)

Asegurar que el personal y el jefe estén en la **misma área** y que exista una serie CADIDO habilitada para ella. Si faltan catálogos de demostración, ejecutar `npm run seed:cadido` **solo después de confirmar que se trabaja con una base académica**, no institucional. Comprobar cambio obligatorio de contraseña en primer inicio.

## E. Pruebas por módulo, en este orden

| Orden | Prueba | Resultado requerido |
|---|---|---|
| 1 | Login correcto/incorrecto, cambio de contraseña, logout | Cookie válida solo durante la sesión; contraseñas hash |
| 2 | Alta y edición de usuarios, cambio de área y rol | Datos y rol sobreviven recarga; no hay acceso no autorizado |
| 3 | Crear un inventario de trámite con 3 expedientes ficticios | Un encabezado, 3 filas, mismos códigos CADIDO |
| 4 | Editar y consultar ese inventario | Se guarda en MySQL; vigencias y valores conservados |
| 5 | Enviar inventario completo a transferencia | Inventario EN_TRANSFERENCIA; expedientes siguen TRAMITE |
| 6 | Visto bueno por jefe distinto del emisor | PENDIENTE_ADMIN, sin cambiar etapas de expedientes |
| 7 | Aceptar por administrador | Todos los expedientes pasan a CONCENTRACION atómicamente |
| 8 | Registrar recepción física | Estado y responsable conservados; sin cambio adicional de etapa |
| 9 | Actualizar zona, sala, estante, nivel, sección, caja | Ubicación persiste tras recarga; etapa sigue CONCENTRACION |
| 10 | Prestar un expediente y devolverlo | PRESTADO y luego EN_ARCHIVO; historial conservado |
| 11 | Prestar inventario completo; devolver 1 de 3 | Préstamo sigue ACTIVO para 2 pendientes |
| 12 | Devolver los 2 restantes | Préstamo DEVUELTO; todos disponibles |
| 13 | Exportar XLSX de Trámite, Concentración y Transferencia Primaria | El archivo abre en Excel, respeta la plantilla enviada y contiene datos reales |
| 14 | Iniciar sesión con otro usuario | No se muestran inventarios, préstamos o transferencias de una sesión anterior |
| 15 | Intentar peticiones sin sesión y con rol no autorizado | Códigos 401/403; no se altera información |

**Confirmar cada paso en MySQL Workbench**, particularmente transferencias, préstamos y devoluciones. Los botones que generan Excel **no** deben cambiar etapa, disponibilidad ni crear transferencias.

## F. Validaciones negativas y casos límite

- Expediente repetido en un inventario; consecutivo duplicado.
- Préstamo de expediente de Trámite, o préstamo doble del mismo expediente.
- Transferencia de inventario incompleto, de otra área o ya vinculado.
- Autoaprobación de visto bueno; aceptación administrativa sin aprobación previa.
- Ubicación con estante 26 o nivel 5.
- Devolución parcial; prueba de intento de segunda devolución de la misma fila.
- Exportación de otro usuario/área con URL manipulada.
- Títulos de expedientes iniciando por `=SUM(1,2)` para validar que Excel los trata como texto.
- Actualizar página tras una operación exitosa y comprobar que no se perdieron datos.

## G. Comprobaciones finales

```powershell
# Desde Backend
npm test

# Desde la raíz (volver con cd ..)
npx tsc --noEmit
npm run build
```

Revisar errores JavaScript en DevTools (F12), red/Network para peticiones 401/403/500 inesperadas y los datos SQL guardados. Si algo falla, conservar el error exacto y el código de respuesta, **sin compartir passwords o JWT**.

## H. Notas de seguridad y limitaciones

- Los PR previos se fusionaron en ramas encadenadas, **no necesariamente en main**. El PR de etapa 7 queda aislado sobre la rama del formato institucional.
- El archivo Excel ya usa la estructura y columnas del documento recibido; la reproducción visual exacta del .xls y el pie de firmas deben cotejarse presencialmente con Excel.
- Los procedimientos SQL registran devoluciones **por expediente**. Una devolución por lote puede confirmar algunas filas antes de fallar; el frontend debe mostrar el estado real.
- Esta etapa agrega revisión de contrato, comprobación de módulos y correcciones detectadas. **No demuestra que las operaciones corran correctamente en tu MySQL local** hasta ejecutar los pasos anteriores.
- Para operación institucional se requerirán auditoría de despliegue, copias de seguridad, HTTPS, medidas de acceso, gestión de contraseñas y validación de formatos oficiales.
