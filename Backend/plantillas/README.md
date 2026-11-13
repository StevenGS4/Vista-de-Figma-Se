# Plantilla institucional SEMARNAT — inventarios Excel

## Archivo base

`Backend/plantillas/inventario_tramite.xlsx` — es la copia institucional de partida para **Archivo de trámite** y **Transferencia primaria**.

El generador `Backend/src/template-workbooks.js` abre este archivo con ExcelJS y rellena una copia en memoria, sin alterar ni guardar cambios en la plantilla original. Los expedientes se incorporan a la hoja original y el cierre, las firmas y los demás elementos se desplazan al ampliar las filas.

**No utilizar esta plantilla para Archivo de concentración**; la exportación de concentración mantiene su generador anterior hasta incorporar un formato institucional distinto.

## Prueba obligatoria antes de usar en producción

En PowerShell, desde la raíz del proyecto:

```powershell
cd Backend
npm run test:template
```

La prueba crea copias temporales en memoria para 1, 12 y 100 expedientes de trámite y 12 de transferencia primaria, y verifica que se puedan volver a abrir, mantengan el cierre y contengan todos los registros y logotipos del documento original.

Si la prueba falla, **no uses el archivo descargado para entregas oficiales**: hay que revisar el error y el mapeo de la plantilla. Revisar visualmente, en Excel, cabecera, celdas, renglones añadidos, salto de página, el recuadro de firmas y el instructivo. La prueba no sustituye esa inspección.

## Restricciones

- El backend utiliza el `.xlsx` existente, **no** el archivo original `.xls`.
- La plantilla maestra nunca se modifica en disco.
- El límite actual del API es 15,000 expedientes por exportación.
- No se inventan firmas, peso de cajas, metros lineales ni otros datos que MySQL no almacena.
- Los datos generados se toman de los registros filtrados por permisos de usuario.
- Si el formato institucional cambia, volver a comprobar ubicaciones, combinaciones de celdas y fórmulas antes de cambiar esta plantilla.
