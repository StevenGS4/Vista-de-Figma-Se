# Etapa 2 — Archivo de Trámite real contra MySQL

## Implementado
- Listado de inventarios y expedientes obtenido desde MySQL, con restricciones por rol, área y autor.
- Catálogo CADIDO ficticio cargado desde secciones_cadido, series_cadido y series_areas.
- Registro de inventario nuevo con encabezado único y múltiples filas en una transacción.
- Actualización de inventarios sin movimientos de transferencia; conserva identificadores de expedientes.
- Eliminación autorizada a encargados de área y administradores solo sin movimientos históricos protegidos.
- Valores documentales múltiples, soporte físico/electrónico/mixto, ubicación física y vigencias.
- Validación de clasificación, números de expediente, consecutivos y permisos desde Node.js.

## Preparación local
1. Conserva la base MySQL semarnat_archivistico_academico_2026 que ya creaste.
2. Desde la carpeta Backend ejecuta npm install y npm run seed:cadido.
3. La semilla es REPETIBLE y carga solo áreas y códigos demostrativos, nunca CADIDO oficial.
4. Sigue Backend/TEST_AUTH.md para crear la cuenta de administrador si aún no la creaste.
5. Arranca Backend con npm run dev y desde la raíz React con npm run dev.

## Pruebas manuales
1. Inicia sesión con usuario de un área y cambia su contraseña si es primer acceso.
2. Abre Archivo de Trámite, registra un inventario con 3 o más filas y elige una serie disponible.
3. Recarga el navegador. El inventario y todos los expedientes deben permanecer en MySQL.
4. Edita asunto, vigencias, soporte mixto, valores documentales y ubicación; guarda y recarga.
5. Repite un número consecutivo dentro del mismo inventario; debe rechazarse.
6. Inicia sesión como encargado de área: puede revisar y editar los inventarios de su área.
7. Confirma que personal normal no puede eliminar inventarios y encargado de préstamos no tiene este módulo.
8. Confirma que los inventarios de otra área no son accesibles al manipular una URL o llamada API.
9. Como encargado o administrador elimina inventario elegible sin transferencias y confirma que desaparece de MySQL.
10. Consulta las tablas inventarios, expedientes, expediente_valores y la vista vw_inventarios_resumen.

## Consultas útiles en MySQL Workbench
USE semarnat_archivistico_academico_2026;
SELECT folio,estado,area_id,creado_por FROM inventarios ORDER BY id DESC;
SELECT inventario_id,consecutivo,numero_expediente,soporte,etapa FROM expedientes ORDER BY id DESC;
SELECT * FROM expediente_valores ORDER BY expediente_id;
SELECT * FROM vw_inventarios_resumen ORDER BY id DESC;

## Alcance y limitaciones
- Transferencias, concentración, préstamos y Excel no están conectados todavía. No utilizar sus operaciones simuladas como registros definitivos.
- Se usan códigos CADIDO ficticios de ejemplo; sustituirlos por catálogo institucional verificado antes de cargar información real.
- El backend recibe hasta 50 000 filas por petición bajo un límite de carga de 50 MB, pero NO se ha hecho una prueba de estrés a esa escala. Se requiere paginación/importación por lotes para operación masiva.
- Cambiar la serie compartida de un inventario ya existente requerirá un procedimiento posterior de reclasificación coherente; el backend protege el conjunto.
- Los campos y la base de datos no se migran ni se eliminan en esta etapa.
- Estas comprobaciones requieren ejecutarse en el MySQL local; CI solo verifica compilación, sintaxis y pruebas unitarias de reglas.