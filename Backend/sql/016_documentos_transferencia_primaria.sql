USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS transferencia_documentos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  transferencia_id BIGINT UNSIGNED NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  detalle VARCHAR(2000) NOT NULL,
  pdf MEDIUMBLOB NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transferencia_documentos (transferencia_id, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
