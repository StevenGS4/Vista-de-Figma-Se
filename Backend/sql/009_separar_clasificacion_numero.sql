-- Etapa 9: clasificación archivística y número de expediente son campos DIFERENTES.
-- Ejecutar con respaldo previo y backend detenido. Nunca borra ni renumera expedientes.
USE semarnat_archivistico_academico_2026;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_clasificacion_009$$
CREATE PROCEDURE migrar_clasificacion_009()
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expedientes' AND COLUMN_NAME='codigo_clasificacion'
 ) THEN
  ALTER TABLE expedientes ADD COLUMN codigo_clasificacion VARCHAR(110) NULL
   COMMENT 'Clave archivística SEMARNAT.<serie>.<secuencia anual>.<año>; independiente de numero_expediente';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='expedientes' AND INDEX_NAME='uq_expediente_codigo_clasificacion'
 ) THEN
  ALTER TABLE expedientes ADD UNIQUE INDEX uq_expediente_codigo_clasificacion(codigo_clasificacion);
 END IF;
END$$
DELIMITER ;

CALL migrar_clasificacion_009();
DROP PROCEDURE migrar_clasificacion_009;

-- Recupera solamente la clave de clasificación en filas antiguas donde el
-- sistema anterior la almacenó equivocadamente en numero_expediente.
-- NO modifica el número de expediente anterior, para no inventar el dato del usuario.
UPDATE expedientes e JOIN series_cadido sr ON sr.id=e.serie_id
 SET e.codigo_clasificacion=e.numero_expediente
 WHERE e.codigo_clasificacion IS NULL
   AND e.numero_expediente REGEXP '^SEMARNAT\\.[0-9]{1,2}[CS]\\.[0-9]{1,3}\\.[0-9]{3,}\\.[0-9]{4}$'
   AND SUBSTRING_INDEX(SUBSTRING(e.numero_expediente,9),'.',2)=sr.codigo;

SELECT COUNT(*) AS expedientes_sin_clave_archivistica FROM expedientes WHERE codigo_clasificacion IS NULL;
-- Si este conteo es mayor a 0, revisar expedientes antiguos, NO asignar códigos ficticios.
