USE semarnat_archivistico_academico_2026;

DROP PROCEDURE IF EXISTS migrar_plazos_cadido_013;
DELIMITER $$
CREATE PROCEDURE migrar_plazos_cadido_013()
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='anios_tramite') THEN
  ALTER TABLE series_cadido ADD COLUMN anios_tramite SMALLINT UNSIGNED NULL;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='anios_concentracion') THEN
  ALTER TABLE series_cadido ADD COLUMN anios_concentracion SMALLINT UNSIGNED NULL;
 END IF;
END$$
DELIMITER ;
CALL migrar_plazos_cadido_013();
DROP PROCEDURE migrar_plazos_cadido_013;

-- CADIDO SEMARNAT 2023 validado, página 23: primer bloque de Legislación.
UPDATE series_cadido s JOIN catalogos_cadido_versiones v ON v.id=s.catalogo_version_id
SET s.anios_tramite=2,s.anios_concentracion=5
WHERE v.anio=2023 AND s.codigo IN ('1C.2','1C.3','1C.5','1C.6','1C.7','1C.8','1C.10','1C.11','1C.13','1C.14','1C.15')
 AND s.anios_tramite IS NULL AND s.anios_concentracion IS NULL;
