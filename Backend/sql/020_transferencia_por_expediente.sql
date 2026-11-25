USE semarnat_archivistico_academico_2026;

CREATE TABLE IF NOT EXISTS transferencia_expedientes (
  transferencia_id BIGINT UNSIGNED NOT NULL,
  expediente_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (transferencia_id, expediente_id),
  KEY idx_transferencia_expedientes_expediente (expediente_id, transferencia_id),
  FOREIGN KEY (transferencia_id) REFERENCES transferencias(id),
  FOREIGN KEY (expediente_id) REFERENCES expedientes(id)
) ENGINE=InnoDB;

-- Las solicitudes anteriores se crearon por inventario completo.
CREATE OR REPLACE VIEW transferencia_expedientes_v AS
SELECT te.transferencia_id, te.expediente_id, e.inventario_id
FROM transferencia_expedientes te JOIN expedientes e ON e.id=te.expediente_id
UNION ALL
SELECT ti.transferencia_id, e.id, e.inventario_id
FROM transferencia_inventarios ti JOIN expedientes e ON e.inventario_id=ti.inventario_id;
