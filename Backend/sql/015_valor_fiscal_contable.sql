USE semarnat_archivistico_academico_2026;

-- Permite guardar la marca conjunta FIS/CON del CADIDO sin convertirla
-- a dos valores independientes. Conserva los valores del ENUM existente.
SELECT DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
INTO @valor_tipo, @valor_enum, @valor_nullable, @valor_default, @valor_comment
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'expediente_valores'
    AND COLUMN_NAME = 'valor';

SET @cadido_alter = IF(
    @valor_tipo = 'enum' AND LOCATE('''FISCAL_CONTABLE''', @valor_enum) = 0,
    CONCAT(
        'ALTER TABLE expediente_valores MODIFY COLUMN valor ',
        LEFT(@valor_enum, CHAR_LENGTH(@valor_enum) - 1), ',''FISCAL_CONTABLE'')',
        IF(@valor_nullable = 'NO', ' NOT NULL', ' NULL'),
        IF(@valor_default IS NULL, '', CONCAT(' DEFAULT ', QUOTE(@valor_default))),
        IF(@valor_comment = '', '', CONCAT(' COMMENT ', QUOTE(@valor_comment)))
    ),
    'SELECT ''Tipo de valor documental sin cambios'' AS resultado'
);
PREPARE cadido_alter_stmt FROM @cadido_alter;
EXECUTE cadido_alter_stmt;
DEALLOCATE PREPARE cadido_alter_stmt;

SHOW COLUMNS FROM expediente_valores LIKE 'valor';
