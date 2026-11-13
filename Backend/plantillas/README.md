# Plantillas institucionales de inventarios (SEMARNAT Nayarit)

Esta carpeta contiene los formatos oficiales **sin datos de expedientes** que servirán como plantillas de descarga. No deben reconstruirse sus diseños desde cero.

## Archivo requerido ahora

**Ruta exacta:** `Backend/plantillas/inventario_tramite.xlsx`

1. Abrir en Microsoft Excel el archivo original `Formato Inventario Documental(3).xls`.
2. Usar **Archivo > Guardar como > Libro de Excel (*.xlsx)**. Conservar logos, fórmulas, formatos, celdas combinadas, hojas e impresión. Revisar que Excel no reporte características perdidas en la conversión.
3. Abrir y comparar el archivo convertido con el original, en especial encabezado, filas de expedientes, resumen y cuatro firmas.
4. En GitHub, entrar a la rama `feature/integracion-validacion-etapa-7` y abrir esta carpeta `Backend/plantillas/`.
5. Elegir **Add file > Upload files** y subir el .xlsx con el nombre exacto `inventario_tramite.xlsx`. Confirmar el commit en la misma rama.

## Alcance previsto

- **Trámite:** plantilla `inventario_tramite.xlsx`.
- **Transferencia primaria:** utilizará esa misma plantilla base, con datos correspondientes y sin sustituir la fuente original.
- **Concentración:** necesita otro archivo institucional y otro mapeo; no utilizar la plantilla de trámite.
- Datos de MySQL rellenan exclusivamente las celdas correspondientes; la plantilla maestra permanece intacta.
- El generador debe ampliar filas manteniendo formatos y desplazar el resumen y firmas, sin sobreescribirlos.
- Deben probarse exportaciones de 1, 11, 12, 100 y 1,000 expedientes, además de encabezados y área de impresión.

**Estado:** carpeta preparada. Hasta identificar y verificar las coordenadas de las celdas en la plantilla convertida, NO reemplazar el exportador de producción: `Backend/src/export-workbooks.js` sigue funcionando como hasta ahora. 
