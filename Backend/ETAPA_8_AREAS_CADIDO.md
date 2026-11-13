# Etapa 8 — Catálogo de áreas y CADIDO por edición

## Qué incluye
- Administración > Catálogo de áreas: registrar y editar áreas, configurar su superior y seleccionar un encargado de área.
- El encargado debe ser una cuenta activa de esa misma área con el rol `Encargado de área`. Si el área acaba de crearse: primero crear área, después usuario, finalmente asignar encargado.
- En cada área: «Asignar CADIDO», seleccionar edición, filtrar, marcar series y guardar.
- El CADIDO 2023 del documento aportado por el usuario: 22 secciones, 260 series, códigos y nombres extraídos del **Cuadro General de Clasificación Archivística (páginas 15–21)**. No se insertan asignaciones automáticas.
- Versiones CADIDO por año. Una serie de 2023 y otra de 2024 con el mismo código pueden coexistir porque sus filas SQL tienen IDs distintos.
- Deshabilitar un código para nuevas altas **no elimina ni cambia** expedientes ya almacenados. Se conserva la fila de `series_areas` con `habilitado=0`.
- Archivo de Trámite y Concentración: filtros por código y año de edición de los expedientes existentes.

## Preparar MySQL local (copia de seguridad imprescindible)
1. Respaldar la base `semarnat_archivistico_academico_2026` en Workbench.
2. Con el backend detenido, ejecutar el **archivo completo** `Backend/sql/008_areas_cadido_versionado.sql` en MySQL Workbench. El script conserva las tablas y expedientes actuales, agrega tablas/columnas e índices para versiones.
3. Desde `Backend` (donde ya existe `.env`): `npm run import:cadido:2023`. Es idempotente, pero no reemplaza documentos existentes; no asigna series a áreas.
4. Comprobar `npm run preflight` y `npm test`; después iniciar backend `npm run dev` y frontend en otra terminal `npm run dev` en la raíz.
5. Recargar navegador, iniciar sesión como ADMIN, ir a Administración > Catálogo de áreas.

Para comprobar la importación:
```sql
SELECT cv.anio,COUNT(*) AS series_importadas
FROM series_cadido s
JOIN catalogos_cadido_versiones cv ON cv.id=s.catalogo_version_id
WHERE cv.anio=2023 GROUP BY cv.anio;
-- Esperado: 2023 | 260
SELECT COUNT(*) AS secciones_2023 FROM secciones_cadido
WHERE codigo IN ('1C','2C','3C','4C','5C','6C','7C','8C','9C','10C','11C','12C',
 '1S','2S','3S','4S','5S','6S','7S','8S','9S','10S');
-- Esperado: 22
```

## Flujo de prueba
1. Crear área, por ejemplo `AR-006`, y comprobar tabla `areas`.
2. En Administración > Usuarios crear usuario en AR-006 con rol Encargado de área.
3. Regresar al catálogo de áreas > Editar / Encargado; asignar la cuenta creada.
4. Asignar algunas series de edición 2023; guardar. Comprobar `series_areas.habilitado=1`.
5. Registrar un nuevo inventario de trámite autorizado para esa área, con la serie asignada.
6. Crear otra versión desde el panel, agregar un nuevo código a esa edición y asignarlo. Los códigos y expedientes 2023 siguen sin modificarse.
7. Deshabilitar una serie 2023 para futuras altas, comprobar que expedientes existentes sigan visibles en Trámite/Concentración y que la versión se pueda filtrar por año.

## Limitaciones y seguridad documental
- La edición 2023 validada no permite agregar manualmente códigos ni cambiar los existentes: crea otra edición con el año correcto y la referencia del instrumento para una revisión posterior.
- El PDF aportado tiene tablas selladas de **valor documental, plazos y técnicas de selección en imágenes (páginas 23–44)**. Esta etapa importa **código, nombre y sección**, NO afirma haber transcrito automáticamente todos los valores, plazos y destinos de aquellas tablas. Los campos de vigencia de los expedientes continúan a cargo del registro documental existente.
- El PDF adjunto es la edición 2023; **no incluye** catálogos 2015/2016 para importarlos como oficiales. Las versiones adicionales deben sustentarse con su documento correspondiente.
- Las versiones y los códigos no disponen de endpoint de borrado; crear una versión nunca elimina otra. `series_areas` conserva histórico al deshabilitar.
- Las pruebas automatizadas comprueban compilación, sintaxis y el número de series; no ejecutan una conexión a tu MySQL local. Verificar el flujo de punta a punta en tu equipo antes de usar con expedientes reales.
