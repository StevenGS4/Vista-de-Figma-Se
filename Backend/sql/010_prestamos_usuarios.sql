-- Migración 010: vincular cada préstamo con el usuario solicitante.
-- No elimina ni modifica préstamos existentes. Ejecutar una sola vez (repetible).
-- Detener el backend y respaldar la base antes de aplicar.
USE semarnat_archivistico_academico_2026;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_prestamos_usuarios_010$$
CREATE PROCEDURE migrar_prestamos_usuarios_010()
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='prestamos'
    AND COLUMN_NAME='solicitante_usuario_id'
 ) THEN
  ALTER TABLE prestamos ADD COLUMN solicitante_usuario_id BIGINT UNSIGNED NULL
    COMMENT 'Usuario de la cuenta solicitante; NULL para préstamos históricos sin vínculo';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='prestamos'
    AND COLUMN_NAME='solicitante_usuario_id' AND REFERENCED_TABLE_NAME='usuarios'
 ) THEN
  ALTER TABLE prestamos ADD CONSTRAINT fk_prestamos_solicitante_usuario
   FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id)
   ON DELETE RESTRICT ON UPDATE CASCADE;
 END IF;
END$$
DELIMITER ;

CALL migrar_prestamos_usuarios_010();
DROP PROCEDURE migrar_prestamos_usuarios_010;

-- Los históricos no se enlazan adivinando nombres.
SELECT id,folio,solicitante_nombre,solicitante_usuario_id,autorizado_por,entregado_por
FROM prestamos ORDER BY id DESC LIMIT 20;
