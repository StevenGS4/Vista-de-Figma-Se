USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS configuracion_transferencias (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  modo_pruebas BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB;

INSERT INTO configuracion_transferencias (id,modo_pruebas)
VALUES (1,FALSE)
ON DUPLICATE KEY UPDATE id=1;
