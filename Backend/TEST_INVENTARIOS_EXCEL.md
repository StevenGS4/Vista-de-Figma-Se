# Etapa 6 — Inventarios y exportación XLSX desde MySQL

## Archivos disponibles

1. **Inventario de Archivo de Trámite**: encabezado y filas reales de expedientes de trámite.
2. **Inventario de Archivo de Concentración**: encabezado, clasificación, ubicación física, disponibilidad y referencia de transferencia aceptada.
3. **Relación de inventarios para Transferencia Primaria**: una fila por inventario elegible de trámite; no solicita ni ejecuta transferencias.

Se generan archivos **Office Open XML (.xlsx)** con ExcelJS. Figma mostraba previamente un archivo XML con extensión .xls: se reemplazó esta descarga local de demostración por la generación real en Node.js.

## Endpoints protegidos

- `GET /api/inventarios/tramite.xlsx`
- `GET /api/inventarios/concentracion.xlsx`
- `GET /api/inventarios/tramite/:folio.xlsx`
- `GET /api/inventarios/concentracion/:folio.xlsx`
- `GET /api/inventarios/transferencia.xlsx`
- `GET /api/inventarios/transferencia/:folio.xlsx`

Todos requieren iniciar sesión. Los enlaces son accesibles desde el navegador de Figma mediante cookies HttpOnly; no se incluye token en URLs.

## Permisos del backend

| Perfil | Trámite | Concentración | Relación transferencia |
|---|---|---|---|
| Personal de área | Expedientes propios | Expedientes propios | Inventarios propios |
| Encargado de área | Su área | Su área | Su área |
| Encargado de préstamos | Sin acceso | Todas las áreas | Sin acceso |
| Administrador | Todas las áreas | Todas las áreas | Todas las áreas |

La consulta SQL filtra por rol, área y propietario ANTES de construir el Excel. No depende de los filtros del navegador.

## Exportación institucional

Los archivos tienen título, encabezados claros, datos, estilo de tabla, panel de filtros y resumen por inventario. La hoja advierte **FORMATO ACADÉMICO NO OFICIAL**: aún debe compararse con las plantillas institucionales efectivas de SEMARNAT. Se conserva el diseño de la interfaz de Figma.

### Consideraciones

- **Relación consolidada**: todos los inventarios elegibles para el usuario, una fila por encabezado. Es distinta del XLSX para un solo folio seleccionado. El botón general no usa los filtros de búsqueda de la lista de Figma, circunstancia indicada junto al botón.
- Se excluyen de relación primaria los inventarios cuyo estado ya no sea `TRAMITE`. Los archivos de Trámite y Concentración respetan la etapa real de cada expediente.
- Descarga de un inventario específico únicamente si el usuario está autorizado para sus expedientes.
- Hasta 15,000 filas por exportación para evitar un consumo excesivo de memoria en el backend académico. Para volúmenes mayores se requerirá un mecanismo paginado y generación por streaming.
- Los campos textuales que comienzan con patrones peligrosos se guardan como texto, no como fórmulas de Excel.
- Exportar no modifica inventarios, transferencias ni préstamos.

## Preparación local y pruebas finales

1. Actualizar código a la rama de integración de etapas.
2. Instalar dependencias desde `Backend` con `npm install` (incluye `exceljs`), además del frontend.
3. Ejecutar migración `Backend/sql/004_concentracion_zona.sql` **antes** de probar la visualización de concentración. No elimina registros.
4. Iniciar backend `npm run dev` y frontend `npm run dev`.
5. Entrar como administrador y crear inventarios de trámite de al menos 3 expedientes; exportar inventario por folio y comprobar encabezado + 3 filas.
6. Generar relación general y comprobar que aparece **una sola fila por inventario** y total de expedientes correcto.
7. Aceptar transferencia, registrar ubicación y exportar inventario de concentración: comprobar conservación de identificadores y datos.
8. Probar distintos perfiles: personal de otra área debe recibir 404 o 403; encargado de préstamos no puede exportar Trámite.
9. Probar la descarga global y confirmar que únicamente contiene inventarios del área o creador autorizados.
10. Intentar exportar un folio inexistente: debe devolver 404.
11. Verificar con Excel que los ficheros abren sin advertencia de formato; columnas, hojas y filtros visibles.
12. Capturar temporalmente un título que comience por `=SUM(1,2)` en datos ficticios: comprobar que sale como texto, sin evaluación de fórmulas.
13. Correr `npm test` dentro de Backend: pruebas de permisos, sanitización y apertura de XLSX con ExcelJS.
14. Revisar que las consultas exportadoras no crean entradas nuevas en `transferencias` ni cambian `expedientes.etapa`.

## Pendiente de revisión final

- Los formatos XLSX aún no se han cotejado con documentos oficiales de la dependencia; cuando se compartan, podremos reproducir columnas y encabezados exactos.
- No se han ejecutado las pruebas de integración contra MySQL local del usuario, ni carga masiva de miles de expedientes.
- Es una versión académica de prueba; no usar información institucional real hasta validar seguridad, permisos, integridad y formatos.
