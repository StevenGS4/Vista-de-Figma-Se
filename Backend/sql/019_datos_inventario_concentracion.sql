USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS expedientes_datos_concentracion (
  expediente_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  acceso ENUM('P','C','R') NULL,
  tradicion ENUM('ORIGINAL','COPIA','AMBAS') NULL,
  topografia_m VARCHAR(100) NULL,
  topografia_n VARCHAR(100) NULL,
  topografia_p VARCHAR(100) NULL,
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
