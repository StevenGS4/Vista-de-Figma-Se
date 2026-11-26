USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS propuestas_baja (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  area_codigo VARCHAR(100) NOT NULL,
  area_nombre VARCHAR(200) NOT NULL,
  solicitado_por BIGINT UNSIGNED NOT NULL,
  solicitante_nombre VARCHAR(255) NOT NULL,
  creada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado ENUM('PROPUESTA','BAJA','NO_PROCEDE') NOT NULL DEFAULT 'PROPUESTA',
  dictamen_folio VARCHAR(160) NULL,
  dictamen_fecha DATE NULL,
  observaciones VARCHAR(2000) NULL,
  resuelto_por BIGINT UNSIGNED NULL,
  responsable_resolucion VARCHAR(255) NULL,
  resuelta_en DATETIME NULL,
  KEY idx_propuestas_baja_area (area_codigo, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS propuesta_baja_expedientes (
  propuesta_id BIGINT UNSIGNED NOT NULL,
  expediente_id BIGINT UNSIGNED NOT NULL,
  ficha JSON NOT NULL,
  PRIMARY KEY (propuesta_id, expediente_id),
  KEY idx_propuesta_expediente (expediente_id, propuesta_id),
  FOREIGN KEY (propuesta_id) REFERENCES propuestas_baja(id),
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
