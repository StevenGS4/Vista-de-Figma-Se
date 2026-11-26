USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS usuario_notificaciones (
 usuario_id BIGINT UNSIGNED NOT NULL,
 contexto VARCHAR(200) NOT NULL,
 clave VARCHAR(120) NOT NULL,
 contenido JSON NOT NULL,
 registrada_en DATETIME NOT NULL,
 revisada_en DATETIME NULL,
 PRIMARY KEY (usuario_id, contexto, clave),
 KEY idx_aviso_lectura (usuario_id, clave),
 FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuario_actividad_sesion (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 usuario_id BIGINT UNSIGNED NOT NULL,
 sesion_id BIGINT UNSIGNED NOT NULL,
 inicio_utc DATETIME NOT NULL,
 ultima_actividad_utc DATETIME NOT NULL,
 KEY idx_actividad_sesion (sesion_id, id),
 KEY idx_actividad_usuario (usuario_id, inicio_utc),
 FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
