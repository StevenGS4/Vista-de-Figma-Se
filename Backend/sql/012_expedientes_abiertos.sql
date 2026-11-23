-- Permite registrar expedientes activos con su fecha de cierre pendiente.
USE semarnat_archivistico_academico_2026;

ALTER TABLE expedientes MODIFY COLUMN cierre DATE NULL DEFAULT NULL;
