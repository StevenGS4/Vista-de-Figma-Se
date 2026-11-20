-- 011: Papelera documental recuperable. Ejecutar previamente con respaldo.
-- No se eliminan expedientes ni vínculos históricos durante esta migración.
USE semarnat_archivistico_academico_2026;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_papelera_011$$
CREATE PROCEDURE migrar_papelera_011()
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventarios' AND COLUMN_NAME='deleted_at') THEN
    ALTER TABLE inventarios ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventarios' AND COLUMN_NAME='deleted_by') THEN
    ALTER TABLE inventarios ADD COLUMN deleted_by BIGINT NULL DEFAULT NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expedientes' AND COLUMN_NAME='deleted_at') THEN
    ALTER TABLE expedientes ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expedientes' AND COLUMN_NAME='deleted_by') THEN
    ALTER TABLE expedientes ADD COLUMN deleted_by BIGINT NULL DEFAULT NULL;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventarios' AND INDEX_NAME='idx_inventarios_deleted_at') THEN
    ALTER TABLE inventarios ADD INDEX idx_inventarios_deleted_at(deleted_at);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expedientes' AND INDEX_NAME='idx_expedientes_deleted_at') THEN
    ALTER TABLE expedientes ADD INDEX idx_expedientes_deleted_at(deleted_at);
  END IF;
END$$
DELIMITER ;
CALL migrar_papelera_011();
DROP PROCEDURE migrar_papelera_011;

SELECT
 (SELECT COUNT(*) FROM inventarios WHERE deleted_at IS NOT NULL) AS inventarios_en_papelera,
 (SELECT COUNT(*) FROM expedientes WHERE deleted_at IS NOT NULL) AS expedientes_en_papelera;
