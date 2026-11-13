-- Etapa 4: mantiene los datos existentes. Ejecutar una sola vez en MySQL 8.
-- Idempotente: comprueba la existencia de la columna antes de ALTER TABLE.
USE semarnat_archivistico_academico_2026;

SET @zona_existe := (
 SELECT COUNT(*) FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='expedientes' AND COLUMN_NAME='archivo_zona'
);
SET @zona_sql := IF(@zona_existe = 0,
 'ALTER TABLE expedientes ADD COLUMN archivo_zona VARCHAR(160) NULL AFTER lugar_resguardo',
 'SELECT ''archivo_zona ya existe'' AS aviso');
PREPARE zona_stmt FROM @zona_sql;
EXECUTE zona_stmt;
DEALLOCATE PREPARE zona_stmt;

-- Opcional: verificar la nueva columna en Workbench.
SHOW COLUMNS FROM expedientes LIKE 'archivo_zona';
