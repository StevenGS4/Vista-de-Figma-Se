-- Etapa 8: administracion de areas y versionado CADIDO. CONSERVA datos existentes.
-- Ejecutar una vez en MySQL Workbench sobre la base local y guardar respaldo previo.
USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS catalogos_cadido_versiones (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 anio SMALLINT UNSIGNED NOT NULL UNIQUE,
 nombre VARCHAR(220) NOT NULL,
 referencia VARCHAR(350) NULL,
 activo TINYINT(1) NOT NULL DEFAULT 1,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_areas_cadido_008$$
CREATE PROCEDURE migrar_areas_cadido_008()
BEGIN
 DECLARE v_index VARCHAR(128) DEFAULT NULL;
 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='areas' AND COLUMN_NAME='encargado_usuario_id') THEN
  ALTER TABLE areas ADD COLUMN encargado_usuario_id BIGINT UNSIGNED NULL;
  ALTER TABLE areas ADD CONSTRAINT fk_areas_encargado
    FOREIGN KEY (encargado_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;
 END IF;

 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='catalogo_version_id') THEN
  ALTER TABLE series_cadido ADD COLUMN catalogo_version_id BIGINT UNSIGNED NULL;
  ALTER TABLE series_cadido ADD CONSTRAINT fk_series_catalogo_version
    FOREIGN KEY (catalogo_version_id) REFERENCES catalogos_cadido_versiones(id) ON DELETE RESTRICT;
 END IF;

 IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_areas' AND COLUMN_NAME='habilitado') THEN
  ALTER TABLE series_areas ADD COLUMN habilitado TINYINT(1) NOT NULL DEFAULT 1;
 END IF;

 -- El codigo se puede repetir en diferentes versiones; el ID historico de cada serie permanece fijo.
 SELECT INDEX_NAME INTO v_index FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido'
   AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY'
 GROUP BY INDEX_NAME
 HAVING COUNT(*)=1 AND MAX(COLUMN_NAME='codigo')=1 LIMIT 1;
 IF v_index IS NOT NULL THEN
  SET @sql_idx=CONCAT('ALTER TABLE series_cadido DROP INDEX `',REPLACE(v_index,'`','``'),'`');
  PREPARE s FROM @sql_idx; EXECUTE s; DEALLOCATE PREPARE s;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND INDEX_NAME='uq_serie_version_codigo') THEN
  ALTER TABLE series_cadido ADD UNIQUE INDEX uq_serie_version_codigo (catalogo_version_id,codigo);
 END IF;
END$$
DELIMITER ;

CALL migrar_areas_cadido_008();
DROP PROCEDURE migrar_areas_cadido_008;

-- No se activa ninguna serie para ninguna area sin autorizacion expresa.
-- Los expedientes existentes conservan su serie_id historico.
SELECT COUNT(*) AS series_existentes FROM series_cadido;
