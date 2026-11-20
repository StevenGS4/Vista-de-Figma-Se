# Plantillas institucionales — Inventarios documentales SEMARNAT

El módulo **Inventarios Excel** genera una copia en memoria del documento institucional correspondiente, rellena los datos de MySQL y conserva la hoja de instructivo, encabezados, formatos y firmas.

| Tipo de descarga | Archivo original obligatorio |
| --- | --- |
| Archivo de trámite | `inventario_tramite.xlsx` |
| Archivo de concentración | `inventario_concentracion.xlsx` |
| Transferencia primaria | `inventario_transferencia_primaria.xlsx` |

## Incorporación de los archivos

Los tres documentos deben permanecer en esta carpeta `Backend/plantillas/`, con los nombres **exactos** de la tabla. Para subir archivos XLSX desde GitHub:

1. Abrir la rama `feature/integracion-validacion-etapa-7`.
2. Entrar a `Backend/plantillas/`.
3. Elegir **Add file → Upload files** y subir los dos archivos pendientes.
4. Confirmar el commit **en la misma rama**.

El código ya selecciona automáticamente la plantilla correspondiente por tipo de inventario. No es necesario modificar la base de datos ni recrear el archivo Excel por programación.

Hasta que los archivos nuevos estén disponibles, Concentración y Transferencia primaria conservan sus exportaciones anteriores; Trámite sigue utilizando su plantilla actual. No se marca como completa la integración de las nuevas plantillas antes de subirlas.

## Verificación

Desde la raíz del proyecto, ejecutar:

```powershell
cd Backend
npm run test:template
```

La prueba genera inventarios con 1, 12, 100 y 1000 expedientes (según el tipo), valida encabezado e instructivo, y comprueba que se conserva el resumen y el logotipo. Un tipo de inventario con plantilla faltante se informa como `PENDIENTE` y aún no equivale a una prueba exitosa.

Antes de utilizar las exportaciones como documentos oficiales, también deben compararse visualmente en Microsoft Excel los renglones, estilos, ancho de columnas, saltos de impresión, resumen y cuadros de firmas.

## Seguridad de los documentos

- El archivo base no se modifica; cada descarga crea una copia.
- No se insertan nombres ni firmas inventadas.
- Se conservan los filtros por permisos del backend y el límite de 15,000 expedientes por exportación.
- Si un archivo XLSX se renombra o se cambia el diseño de sus celdas, deberá ajustarse y volver a probarse su mapeo.
