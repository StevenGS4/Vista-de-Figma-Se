-- CADIDO SEMARNAT 2023 validado. Ejecutar el archivo completo en MySQL Workbench.
-- Requiere el esquema de la migración 008_areas_cadido_versionado.sql.
-- 22 secciones y 260 series. 4S se escribe con la letra S.
-- Actualiza por edición y código, sin duplicar series ni tocar asignaciones por área.
-- Conserva los IDs y las demás ediciones. Activa las series oficiales de 2023.
SET NAMES utf8mb4;
USE semarnat_archivistico_academico_2026;

DROP TEMPORARY TABLE IF EXISTS tmp_cadido_secciones;
DROP TEMPORARY TABLE IF EXISTS tmp_cadido_series;
CREATE TEMPORARY TABLE tmp_cadido_secciones (
  codigo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(350) NOT NULL
) ENGINE=InnoDB;
CREATE TEMPORARY TABLE tmp_cadido_series (
  codigo VARCHAR(24) PRIMARY KEY,
  seccion VARCHAR(10) NOT NULL,
  nombre VARCHAR(350) NOT NULL,
  valor_documental VARCHAR(120) NOT NULL,
  anios_tramite SMALLINT UNSIGNED NOT NULL,
  anios_concentracion SMALLINT UNSIGNED NOT NULL
) ENGINE=InnoDB;

INSERT INTO tmp_cadido_secciones (codigo,nombre) VALUES
  ('1C', 'LEGISLACIÓN'),
  ('2C', 'ASUNTOS JURÍDICOS'),
  ('3C', 'PROGRAMACIÓN, ORGANIZACIÓN Y PRESUPUESTACIÓN'),
  ('4C', 'RECURSOS HUMANOS'),
  ('5C', 'RECURSOS FINANCIEROS'),
  ('6C', 'RECURSOS MATERIALES Y OBRA PÚBLICA'),
  ('7C', 'SERVICIOS GENERALES'),
  ('8C', 'TECNOLOGÍAS Y SERVICIOS DE LA INFORMACIÓN'),
  ('9C', 'COMUNICACIÓN SOCIAL'),
  ('10C', 'CONTROL Y AUDITORÍA DE ACTIVIDADES PÚBLICAS'),
  ('11C', 'PLANEACIÓN, INFORMACIÓN EVALUACIÓN Y POLÍTICAS'),
  ('12C', 'TRANSPARENCIA Y ACCESO A LA INFORMACIÓN'),
  ('1S', 'PLANEACIÓN Y POLÍTICA AMBIENTAL'),
  ('2S', 'FOMENTO Y REGULACIÓN AMBIENTAL'),
  ('3S', 'GESTIÓN INTEGRAL DE MATERIALES Y ACTIVIDADES RIESGOSAS'),
  ('4S', 'VALORACIÓN DEL IMPACTO Y RIESGO AMBIENTAL'),
  ('5S', 'EVALUACIÓN DE LA GESTIÓN FORESTAL Y DE SUELOS'),
  ('6S', 'GESTIÓN DEL MANEJO Y APROVECHAMIENTO DE VIDA SILVESTRE'),
  ('8S', 'GESTIÓN DE LA CALIDAD DEL AIRE Y REGISTRO DE EMISIONES Y TRANSFERENCIA DE CONTAMINANTES'),
  ('9S', 'AGROECOLOGÍA Y PATRIMONIO CULTURAL'),
  ('10S', 'RECURSOS NATURALES Y BIOSEGURIDAD'),
  ('7S', 'GESTIÓN Y ADMINISTRACIÓN DE LA ZONA FEDERAL MARÍTIMO TERRESTRE Y AMBIENTES COSTEROS');

INSERT INTO tmp_cadido_series
  (codigo,seccion,nombre,valor_documental,anios_tramite,anios_concentracion) VALUES
  ('1C.2', '1C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE LEGISLACIÓN', 'Administrativo, Legal', 2, 5),
  ('1C.3', '1C', 'LEYES', 'Administrativo, Legal', 2, 5),
  ('1C.5', '1C', 'CONVENIOS Y TRATADOS INTERNACIONALES', 'Administrativo, Legal', 2, 5),
  ('1C.6', '1C', 'DECRETOS', 'Administrativo, Legal', 2, 5),
  ('1C.7', '1C', 'REGLAMENTOS', 'Administrativo, Legal', 2, 5),
  ('1C.8', '1C', 'ACUERDOS GENERALES', 'Administrativo, Legal', 2, 5),
  ('1C.10', '1C', 'INSTRUMENTOS JURÍDICOS CONSENSUALES (CONVENIOS, BASES DE COLABORACIÓN, ACUERDOS, ETC.)', 'Administrativo, Legal', 2, 5),
  ('1C.11', '1C', 'RESOLUCIONES', 'Administrativo, Legal', 2, 5),
  ('1C.13', '1C', 'DIARIO OFICIAL DE LA FEDERACIÓN (PUBLICACIONES EN EL)', 'Administrativo, Legal', 2, 5),
  ('1C.14', '1C', 'NORMAS OFICIALES MEXICANAS', 'Administrativo, Legal', 2, 5),
  ('1C.15', '1C', 'COMITÉS Y SUBCOMITÉS DE NORMALIZACIÓN', 'Administrativo', 2, 5),
  ('2C.1', '2C', 'DISPOSICIONES EN MATERIA DE ASUNTOS JURÍDICOS', 'Administrativo', 2, 5),
  ('2C.2', '2C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE ASUNTOS JURÍDICOS', 'Administrativo', 2, 5),
  ('2C.3', '2C', 'REGISTRO Y CERTIFICACIÓN DE FIRMAS', 'Administrativo, Legal', 2, 5),
  ('2C.4', '2C', 'REGISTRO Y CERTIFICACIÓN DE FIRMAS ACREDITADAS ANTE LA DEPENDENCIA', 'Administrativo, Legal', 2, 5),
  ('2C.5', '2C', 'ACTUACIONES Y REPRESENTACIONES EN MATERIA LEGAL', 'Administrativo, Legal', 2, 5),
  ('2C.6', '2C', 'ASISTENCIA CONSULTA Y ASESORÍAS', 'Administrativo, Legal', 2, 5),
  ('2C.7', '2C', 'ESTUDIOS, DICTÁMENES E INFORMES', 'Administrativo, Legal', 2, 5),
  ('2C.8', '2C', 'JUICIOS CONTRA LA DEPENDENCIA', 'Administrativo, Legal', 2, 5),
  ('2C.9', '2C', 'JUICIOS DE LA DEPENDENCIA', 'Administrativo, Legal', 2, 5),
  ('2C.10', '2C', 'AMPAROS', 'Administrativo, Legal', 2, 5),
  ('2C.11', '2C', 'INTERPOSICIÓN DE RECURSOS ADMINISTRATIVOS', 'Administrativo, Legal', 2, 5),
  ('2C.12', '2C', 'OPINIONES TÉCNICO JURÍDICAS', 'Administrativo, Legal', 2, 5),
  ('2C.13', '2C', 'INSPECCIÓN Y DESIGNACIÓN DE PERITOS', 'Administrativo', 2, 5),
  ('2C.14', '2C', 'DESFALCOS, PECULADOS, FRAUDES Y COHECHOS', 'Administrativo, Legal', 2, 5),
  ('2C.15', '2C', 'NOTIFICACIONES', 'Administrativo, Legal', 2, 5),
  ('2C.16', '2C', 'INCONFORMIDADES Y PETICIONES', 'Administrativo, Legal', 2, 5),
  ('2C.17', '2C', 'DELITOS Y FALTAS', 'Administrativo, Legal', 2, 5),
  ('2C.18', '2C', 'DERECHOS HUMANOS', 'Administrativo, Legal', 2, 5),
  ('3C.1', '3C', 'DISPOSICIONES EN MATERIA DE PROGRAMACIÓN', 'Administrativo', 2, 5),
  ('3C.2', '3C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE PROGRAMACIÓN', 'Administrativo', 2, 5),
  ('3C.3', '3C', 'PROCESOS DE PROGRAMACIÓN', 'Administrativo', 2, 5),
  ('3C.4', '3C', 'PROGRAMA ANUAL DE INVERSIONES', 'Administrativo', 2, 5),
  ('3C.5', '3C', 'REGISTRO PROGRÁMATICO DE PROYECTOS INSTITUCIONALES', 'Administrativo', 2, 5),
  ('3C.6', '3C', 'REGISTRO PROGRÁMATICO DE PROYECTOS ESPECIALES', 'Administrativo', 2, 5),
  ('3C.8', '3C', 'DISPOSICIONES EN MATERIA DE ORGANIZACIÓN', 'Administrativo', 2, 5),
  ('3C.9', '3C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE ORGANIZACIÓN', 'Administrativo', 2, 5),
  ('3C.10', '3C', 'DICTAMEN TÉCNICO DE ESTRUCTURAS', 'Administrativo', 2, 5),
  ('3C.11', '3C', 'INTEGRACIÓN Y DICTAMEN DE MANUALES DE ORGANIZACIÓN', 'Administrativo, Legal', 2, 5),
  ('3C.12', '3C', 'INTEGRACIÓN Y DICTAMEN DE MANUALES, NORMAS Y LINEAMIENTOS, DE PROCESOS Y PROCEDIMIENTOS', 'Administrativo, Legal', 2, 5),
  ('3C.13', '3C', 'ACCIONES DE MODERNIZACIÓN ADMINISTRATIVA', 'Administrativo', 2, 5),
  ('3C.14', '3C', 'CERTIFICACIÓN DE CALIDAD DE PROCESOS Y SERVICIOS ADMINISTRATIVOS', 'Administrativo', 2, 5),
  ('3C.17', '3C', 'DISPOSICIONES EN MATERIA DE PRESUPUESTACIÓN', 'Administrativo', 2, 5),
  ('3C.18', '3C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE PRESUPUESTACIÓN', 'Administrativo', 2, 5),
  ('3C.19', '3C', 'ANÁLISIS FINANCIERO Y PRESUPUESTAL', 'Administrativo', 2, 5),
  ('3C.20', '3C', 'EVALUACIÓN Y CONTROL DEL EJERCICIO PRESUPUESTAL', 'Administrativo', 2, 5),
  ('4C.1', '4C', 'DISPOSICIONES EN MATERIA DE RECURSOS HUMANOS', 'Administrativo', 2, 5),
  ('4C.2', '4C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE RECURSOS HUMANOS', 'Administrativo', 2, 5),
  ('4C.3', '4C', 'EXPEDIENTE ÚNICO DE PERSONAL', 'Administrativo, Legal', 2, 23),
  ('4C.4', '4C', 'REGISTRO Y CONTROL DE PUESTOS Y PLAZAS', 'Administrativo, Legal', 3, 4),
  ('4C.5', '4C', 'NÓMINA DE PAGO DE PERSONAL', 'Administrativo', 2, 5),
  ('4C.6', '4C', 'RECLUTAMIENTO Y SELECCIÓN DE PERSONAL', 'Administrativo', 2, 5),
  ('4C.7', '4C', 'IDENTIFICACIÓN Y ACREDITACIÓN DE PERSONAL', 'Administrativo', 2, 5),
  ('4C.8', '4C', 'CONTROL DE ASISTENCIA (VACACIONES, DESCANSOS Y LICENCIAS, INCAPACIDADES, ETC.)', 'Administrativo', 2, 5),
  ('4C.9', '4C', 'CONTROL DISCIPLINARIO', 'Administrativo', 2, 5),
  ('4C.10', '4C', 'DESCUENTOS', 'Administrativo', 2, 5),
  ('4C.11', '4C', 'ESTÍMULOS Y RECOMPENSAS', 'Administrativo', 2, 5),
  ('4C.12', '4C', 'EVALUACIONES Y PROMOCIONES', 'Administrativo', 2, 5),
  ('4C.13', '4C', 'PRODUCTIVIDAD EN EL TRABAJO', 'Administrativo', 2, 5),
  ('4C.14', '4C', 'EVALUACIÓN DEL DESEMPEÑO DE SERVIDORES DE MANDO', 'Administrativo', 2, 5),
  ('4C.15', '4C', 'AFILIACIONES AL INSTITUTO DE SEGURIDAD Y SERVICIOS SOCIALES DE LOS TRABAJADORES DEL ESTADO', 'Administrativo', 2, 5),
  ('4C.16', '4C', 'CONTROL DE PRESTACIONES EN MATERIA ECONÓMICA (FONAC, SISTEMA DE AHORRO PARA EL RETIRO, SEGUROS, ETC.)', 'Administrativo', 2, 5),
  ('4C.17', '4C', 'JUBILACIONES Y PENSIONES', 'Administrativo', 2, 23),
  ('4C.18', '4C', 'PROGRAMAS DE RETIRO VOLUNTARIO', 'Administrativo', 2, 5),
  ('4C.19', '4C', 'BECAS', 'Administrativo', 2, 5),
  ('4C.20', '4C', 'RELACIONES LABORALES (COMISIONES MIXTAS, SINDICATO NACIONAL DE TRABAJADORES AL SERVICIO DEL ESTADO, CONDICIONES LABORALES)', 'Administrativo', 2, 5),
  ('4C.21', '4C', 'SERVICIOS SOCIALES Y CULTURALES Y DE SEGURIDAD E HIGIENE EN EL TRABAJO', 'Administrativo', 2, 5),
  ('4C.22', '4C', 'CAPACITACIÓN CONTINUA Y DESARROLLO PROFESIONAL DEL PERSONAL DE ÁREAS ADMINISTRATIVAS', 'Administrativo', 2, 5),
  ('4C.23', '4C', 'SERVICIO SOCIAL DE ÁREAS ADMINISTRATIVAS', 'Administrativo', 2, 5),
  ('4C.26', '4C', 'EXPEDICIÓN DE CONSTANCIAS Y CREDENCIALES', 'Administrativo', 2, 5),
  ('4C.27', '4C', 'COORDINACIÓN LABORAL CON ORGANISMOS DESCENTRALIZADOS Y PARAESTATALES', 'Administrativo', 2, 5),
  ('4C.28', '4C', 'SERVICIO PROFESIONAL DE CARRERA', 'Administrativo', 2, 5),
  ('5C.1', '5C', 'DISPOSICIONES EN MATERIA DE RECURSOS FINANCIEROS Y CONTABILIDAD GUBERNAMENTAL', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.2', '5C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE RECURSOS FINANCIEROS Y CONTABILIDAD GUBERNAMENTAL', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.3', '5C', 'GASTOS O EGRESOS POR PARTIDA PRESUPUESTAL', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.4', '5C', 'INGRESOS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.5', '5C', 'LIBROS CONTABLES', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.6', '5C', 'REGISTROS CONTABLES (GLOSA)', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.7', '5C', 'VALORES FINANCIEROS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.10', '5C', 'FINANCIAMIENTO EXTERNO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.14', '5C', 'CUENTAS POR LIQUIDAR CERTIFICADAS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.15', '5C', 'TRANSFERENCIAS DE PRESUPUESTO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.16', '5C', 'AMPLIACIONES DEL PRESUPUESTO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.17', '5C', 'REGISTRO Y CONTROL DE PÓLIZAS DE EGRESOS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.18', '5C', 'REGISTRO Y CONTROL DE PÓLIZAS DE INGRESOS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.19', '5C', 'PÓLIZAS DE DIARIO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.22', '5C', 'CONTROL DE CHEQUES', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.23', '5C', 'CONCILIACIONES', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.24', '5C', 'ESTADOS FINANCIEROS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.25', '5C', 'AUXILIARES DE CUENTAS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.26', '5C', 'ESTADO DEL EJERCICIO DEL PRESUPUESTO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.27', '5C', 'FONDO ROTATORIO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('5C.28', '5C', 'PAGO DE DERECHOS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('6C.1', '6C', 'DISPOSICIONES EN MATERIA DE RECURSOS MATERIALES, OBRA PÚBLICA, CONSERVACIÓN Y MANTENIMIENTO', 'Administrativo', 2, 5),
  ('6C.2', '6C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE RECURSOS MATERIALES, OBRA PÚBLICA, CONSERVACIÓN Y MANTENIMIENTO', 'Administrativo', 2, 5),
  ('6C.3', '6C', 'LICITACIONES', 'Administrativo', 2, 5),
  ('6C.4', '6C', 'ADQUISICIONES', 'Administrativo, Legal', 2, 5),
  ('6C.5', '6C', 'SANCIONES, INCONFOMIDADES Y CONCILIACIONES, DERIVADOS DE CONTRATOS', 'Administrativo, Legal', 2, 5),
  ('6C.6', '6C', 'CONTROL DE CONTRATOS', 'Administrativo, Legal', 2, 5),
  ('6C.7', '6C', 'SEGUROS Y FIANZAS', 'Administrativo, Fiscal/Contable', 2, 5),
  ('6C.8', '6C', 'SUSPENSIÓN, RESCISIÓN, TERMINACIÓN DE OBRA PÚBLICA', 'Administrativo', 2, 5),
  ('6C.9', '6C', 'BITÁCORAS DE OBRA PÚBLICA', 'Administrativo', 2, 5),
  ('6C.10', '6C', 'CALIDAD EN MATERIA DE OBRAS, CONSERVACIÓN Y EQUIPAMIENTO', 'Administrativo', 2, 5),
  ('6C.11', '6C', 'PRECIOS UNITARIOS EN OBRA PÚBLICA Y SERVICIOS', 'Administrativo', 2, 5),
  ('6C.12', '6C', 'ASESORÍA TÉCNICA EN MATERIA DE OBRA PÚBLICA', 'Administrativo', 2, 5),
  ('6C.13', '6C', 'CONSERVACIÓN Y MANTENIMIENTO DE LA INFRAESTRUCTURA FÍSICA', 'Administrativo', 2, 5),
  ('6C.14', '6C', 'REGISTRO DE PROVEEDORES Y CONTRATISTAS', 'Administrativo', 2, 5),
  ('6C.15', '6C', 'ARRENDAMIENTOS', 'Administrativo', 2, 5),
  ('6C.16', '6C', 'DISPOSICIONES DE ACTIVO FIJO', 'Administrativo', 2, 5),
  ('6C.17', '6C', 'INVENTARIO FÍSICO Y CONTROL DE BIENES MUEBLES', 'Administrativo, Legal', 2, 5),
  ('6C.18', '6C', 'INVENTARIO FÍSICO Y CONTROL DE BIENES INMUEBLES', 'Administrativo, Legal', 2, 5),
  ('6C.19', '6C', 'ALMACENAMIENTO, CONTROL Y DISTRIBUCIÓN DE BIENES MUEBLES', 'Administrativo', 2, 5),
  ('6C.20', '6C', 'DISPOSICIONES Y SISTEMAS DE ABASTECIMIENTO Y ALMACENES', 'Administrativo', 2, 5),
  ('6C.21', '6C', 'CONTROL DE CALIDAD DE BIENES E INSUMOS', 'Administrativo', 2, 5),
  ('6C.22', '6C', 'CONTROL Y SEGUIMIENTO DE OBRAS Y REMODELACIONES', 'Administrativo', 2, 5),
  ('6C.23', '6C', 'COMITÉS Y SUBCOMITÉS DE ADQUISICIONES, ARRENDAMIENTOS Y SERVICIOS', 'Administrativo', 2, 5),
  ('6C.24', '6C', 'COMITÉ DE ENAJENACIÓN DE BIENES MUEBLES E INMUEBLES', 'Administrativo', 2, 5),
  ('6C.25', '6C', 'COMITÉ DE OBRA PÚBLICA', 'Administrativo', 2, 5),
  ('6C.26', '6C', 'COMISIONES CONSULTIVAS MIXTAS DE ABASTECIMIENTO', 'Administrativo', 2, 5),
  ('7C.1', '7C', 'DISPOSICIONES EN MATERIA DE SERVICIOS GENERALES', 'Administrativo', 2, 5),
  ('7C.2', '7C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE SERVICIOS GENERALES', 'Administrativo', 2, 5),
  ('7C.3', '7C', 'SERVICIOS BÁSICOS (ENERGÍA ELÉCTRICA, AGUA, PREDIAL, ETC.)', 'Administrativo', 2, 5),
  ('7C.4', '7C', 'SERVICIOS DE EMBALAJE, FLETES Y MANIOBRAS', 'Administrativo', 2, 5),
  ('7C.5', '7C', 'SERVICIOS DE SEGURIDAD Y VIGILANCIA', 'Administrativo', 2, 5),
  ('7C.6', '7C', 'SERVICIOS DE LAVANDERÍA, LIMPIEZA, HIGIENE Y FUMIGACIÓN', 'Administrativo', 2, 5),
  ('7C.7', '7C', 'SERVICIOS DE TRANSPORTACIÓN', 'Administrativo', 2, 5),
  ('7C.8', '7C', 'SERVICIOS DE TELEFONÍA, TELEFONÍA CELULAR Y RADIOLOCALIZACIÓN', 'Administrativo', 2, 5),
  ('7C.9', '7C', 'SERVICIO POSTAL', 'Administrativo, Fiscal/Contable', 2, 5),
  ('7C.10', '7C', 'SERVICIOS ESPECIALIZADOS DE MENSAJERÍA', 'Administrativo', 2, 5),
  ('7C.11', '7C', 'MANTENIMIENTO, CONSERVACIÓN E INSTALACIÓN DE MOBILIARIO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('7C.12', '7C', 'MANTENIMIENTO, CONSERVACIÓN E INSTALACIÓN DE EQUIPO DE COMPUTO', 'Administrativo, Fiscal/Contable', 2, 5),
  ('7C.13', '7C', 'CONTROL DE PARQUE VEHICULAR', 'Administrativo', 2, 5),
  ('7C.14', '7C', 'CONTROL DE COMBUSTIBLE', 'Administrativo', 2, 5),
  ('7C.15', '7C', 'CONTROL Y SERVICIOS EN AUDITORIOS Y SALAS', 'Administrativo', 2, 5),
  ('7C.16', '7C', 'PROTECCIÓN CIVIL', 'Administrativo, Legal', 2, 5),
  ('8C.1', '8C', 'DISPOSICIONES EN MATERIA DE TELECOMUNICACIONES', 'Administrativo', 2, 5),
  ('8C.2', '8C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE TELECOMUNICACIONES', 'Administrativo', 2, 5),
  ('8C.3', '8C', 'NORMATIVIDAD TECNOLÓGICA', 'Administrativo', 2, 5),
  ('8C.4', '8C', 'DESARROLLO E INFRAESTRUCTURA DE TELECOMUNICACIONES', 'Administrativo', 2, 5),
  ('8C.5', '8C', 'DESARROLLO E INFRAESTRUCTURA DEL PORTAL DE INTERNET DE LA DEPENDENCIA', 'Administrativo', 2, 5),
  ('8C.6', '8C', 'DESARROLLO REDES DE COMUNICACIÓN DE DATOS Y VOZ', 'Administrativo, Legal', 2, 5),
  ('8C.7', '8C', 'DISPOSICIONES EN MATERIA DE INFORMÁTICA', 'Administrativo', 2, 5),
  ('8C.8', '8C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE INFORMÁTICA', 'Administrativo', 2, 5),
  ('8C.9', '8C', 'DESARROLLO INFORMÁTICO', 'Administrativo', 2, 5),
  ('8C.10', '8C', 'SEGURIDAD INFORMÁTICA', 'Administrativo', 2, 5),
  ('8C.11', '8C', 'DESARROLLO DE SISTEMAS', 'Administrativo, Legal', 2, 5),
  ('8C.12', '8C', 'AUTOMATIZACIÓN DE PROCESOS', 'Administrativo', 2, 5),
  ('8C.13', '8C', 'CONTROL Y DESARROLLO DEL PARQUE INFORMÁTICO', 'Administrativo, Legal', 2, 5),
  ('8C.14', '8C', 'DISPOSICIONES EN MATERIA DE SERVICIOS DE INFORMACIÓN', 'Administrativo, Legal', 2, 5),
  ('8C.15', '8C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE SERVICIOS DE INFORMACIÓN', 'Administrativo', 2, 5),
  ('8C.16', '8C', 'ADMINISTRACIÓN Y SERVICIOS DE ARCHIVO', 'Administrativo', 2, 5),
  ('8C.17', '8C', 'ADMINISTRACIÓN Y SERVICIOS DE CORRESPONDENCIA', 'Administrativo', 2, 5),
  ('8C.20', '8C', 'ADMINISTRACIÓN Y PRESERVACIÓN DE ACERVOS DIGITALES', 'Administrativo', 2, 5),
  ('8C.21', '8C', 'INSTRUMENTOS DE CONSULTA', 'Administrativo, Legal', 2, 5),
  ('8C.25', '8C', 'SERVICIOS Y PRODUCTOS DE INTERNET E INTRANET', 'Administrativo', 2, 5),
  ('9C.1', '9C', 'DISPOSICIONES EN MATERIA DE COMUNICACIÓN SOCIAL', 'Administrativo', 2, 5),
  ('9C.2', '9C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE COMUNICACIÓN SOCIAL', 'Administrativo', 2, 5),
  ('9C.3', '9C', 'PUBLICACIONES E IMPRESOS INSTITUCIONALES', 'Administrativo', 2, 5),
  ('9C.4', '9C', 'MATERIA MULTIMEDIA', 'Administrativo', 2, 5),
  ('9C.5', '9C', 'PUBLICIDAD INSTITUCIONAL', 'Administrativo', 2, 5),
  ('9C.6', '9C', 'BOLETINES Y ENTREVISTAS PARA MEDIOS', 'Administrativo', 2, 5),
  ('9C.7', '9C', 'BOLETINES INFORMATIVOS PARA MEDIOS', 'Administrativo', 2, 5),
  ('9C.8', '9C', 'INSERCIONES Y ANUNCIOS EN PERIÓDICOS Y REVISTAS', 'Administrativo', 2, 5),
  ('9C.9', '9C', 'AGENCIAS PERIODÍSTICAS, DE NOTICIAS, REPORTEROS, ARTICULISTAS, CADENAS TELEVISIVAS Y OTROS MEDIOS DE COMUNICACIÓN SOCIAL', 'Administrativo', 2, 5),
  ('9C.10', '9C', 'NOTAS PARA MEDIOS', 'Administrativo', 2, 5),
  ('9C.11', '9C', 'PRENSA INSTITUCIONAL', 'Administrativo', 2, 5),
  ('9C.14', '9C', 'ACTOS Y EVENTOS OFICIALES', 'Administrativo', 2, 5),
  ('9C.15', '9C', 'REGISTRO DE AUDIENCIAS PÚBLICAS', 'Administrativo', 2, 5),
  ('9C.16', '9C', 'INVITACIONES Y FELICITACIONES', 'Administrativo', 2, 5),
  ('10C.1', '10C', 'DISPOSICIONES EN MATERIA DE CONTROL Y AUDITORÍA', 'Administrativo', 2, 5),
  ('10C.2', '10C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE CONTROL Y AUDITORÍA', 'Administrativo', 2, 5),
  ('10C.3', '10C', 'AUDITORÍA', 'Administrativo, Legal', 2, 5),
  ('10C.4', '10C', 'VISITADURÍAS', 'Administrativo', 2, 5),
  ('10C.5', '10C', 'REVISIONES DE RUBROS ESPECÍFICOS', 'Administrativo', 2, 5),
  ('10C.6', '10C', 'SEGUIMIENTO A LA APLICACIÓN EN MEDIDAS O RECOMENDACIONES', 'Administrativo', 2, 5),
  ('10C.7', '10C', 'PARTICIPANTES EN COMITÉS', 'Administrativo', 2, 5),
  ('10C.8', '10C', 'REQUERIMIENTOS DE INFORMACIÓN A DEPENDENCIAS Y ENTIDADES', 'Administrativo', 2, 5),
  ('10C.9', '10C', 'QUEJAS Y DENUNCIAS DE ACTIVIDADES PÚBLICAS', 'Administrativo', 2, 5),
  ('10C.10', '10C', 'PETICIONES, SUGERENCIAS Y RECOMENDACIONES', 'Administrativo', 2, 5),
  ('10C.11', '10C', 'RESPONSABILIDADES', 'Administrativo', 2, 5),
  ('10C.12', '10C', 'INCONFORMIDADES', 'Administrativo', 2, 5),
  ('10C.13', '10C', 'INHABILITACIONES', 'Administrativo', 2, 5),
  ('10C.14', '10C', 'DECLARACIONES PATRIMONIALES', 'Administrativo, Legal', 2, 5),
  ('10C.15', '10C', 'ENTREGA-RECEPCIÓN', 'Administrativo, Legal', 2, 5),
  ('10C.16', '10C', 'LIBROS BLANCOS', 'Administrativo', 2, 5),
  ('11C.1', '11C', 'DISPOSICIONES EN MATERIA DE PLANEACIÓN', 'Administrativo', 2, 5),
  ('11C.2', '11C', 'DISPOSICIONES EN MATERIA DE INFORMACIÓN Y EVALUACIÓN', 'Administrativo', 2, 5),
  ('11C.3', '11C', 'DISPOSICIONES EN MATERIA DE POLÍTICAS', 'Administrativo', 2, 5),
  ('11C.4', '11C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE INFORMACIÓN Y EVALUACIÓN', 'Administrativo', 2, 5),
  ('11C.5', '11C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE POLÍTICAS', 'Administrativo', 2, 5),
  ('11C.6', '11C', 'PLANES NACIONALES', 'Administrativo', 2, 5),
  ('11C.7', '11C', 'PROGRAMAS A MEDIANO PLAZO', 'Administrativo', 2, 5),
  ('11C.8', '11C', 'PROGRAMAS DE ACCIÓN', 'Administrativo', 2, 5),
  ('11C.9', '11C', 'SISTEMAS DE INFORMACIÓN ESTADÍSTICA DE LA DEPENDENCIA', 'Administrativo', 2, 5),
  ('11C.10', '11C', 'SISTEMA NACIONAL DE INFORMACIÓN ESTADÍSTICA', 'Administrativo', 2, 5),
  ('11C.11', '11C', 'NORMAS DE ELABORACIÓN Y ACTUALIZACIÓN DE LA INFORMACIÓN ESTADÍSTICA', 'Administrativo', 2, 5),
  ('11C.12', '11C', 'CAPTACIÓN, PRODUCCIÓN Y DIFUSIÓN DE LA INFORMACIÓN ESTADÍSTICA', 'Administrativo', 2, 5),
  ('11C.13', '11C', 'DESARROLLO DE ENCUESTAS', 'Administrativo', 2, 5),
  ('11C.14', '11C', 'GRUPO INTERINSTITUCIONAL DE INFORMACIÓN (COMITÉS)', 'Administrativo', 2, 5),
  ('11C.15', '11C', 'EVALUACIÓN DE PROGRAMAS DE ACCIÓN', 'Administrativo', 2, 5),
  ('11C.16', '11C', 'INFORME DE LABORES', 'Administrativo', 2, 5),
  ('11C.17', '11C', 'INFORME DE EJECUCIÓN', 'Administrativo', 2, 4),
  ('11C.18', '11C', 'INFORME DE GOBIERNO', 'Administrativo', 2, 5),
  ('11C.19', '11C', 'INDICADORES', 'Administrativo', 2, 5),
  ('11C.20', '11C', 'INDICADORES DE DESEMPEÑO, CALIDAD Y PRODUCTIVIDAD', 'Administrativo', 2, 5),
  ('11C.21', '11C', 'NORMAS PARA LA EVALUACIÓN', 'Administrativo', 2, 5),
  ('11C.22', '11C', 'MODELOS DE ORGANIZACIÓN', 'Administrativo', 2, 5),
  ('12C.1', '12C', 'DISPOSICIONES EN MATERIA DE ACCESO A LA INFORMACIÓN', 'Administrativo', 2, 5),
  ('12C.2', '12C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE ACCESO A LA INFORMACIÓN', 'Administrativo', 2, 5),
  ('12C.3', '12C', 'PROGRAMAS Y PROYECTOS EN MATERIA DE TRANSPARENCIA Y COMBATE A LA CORRUPCIÓN', 'Administrativo', 2, 5),
  ('12C.4', '12C', 'UNIDADES DE ENLACE', 'Administrativo', 2, 5),
  ('12C.5', '12C', 'COMITÉ DE INFORMACIÓN', 'Administrativo', 2, 5),
  ('12C.6', '12C', 'SOLICITUDES DE ACCESO A LA INFORMACIÓN', 'Administrativo, Legal', 2, 5),
  ('12C.7', '12C', 'PORTAL DE TRANSPARENCIA', 'Administrativo, Legal', 2, 5),
  ('12C.8', '12C', 'CLASIFICACIÓN DE INFORMACIÓN RESERVADA', 'Administrativo, Legal', 2, 5),
  ('12C.9', '12C', 'CLASIFICACIÓN DE INFORMACIÓN CONFIDENCIAL', 'Administrativo, Legal', 2, 5),
  ('12C.10', '12C', 'SISTEMAS DE DATOS PERSONALES', 'Administrativo, Legal', 2, 5),
  ('12C.12', '12C', 'ARCHIVOS DEL PRESIDENTE ELECTO', 'Administrativo, Legal', 2, 5),
  ('1S.1', '1S', 'SISTEMA NACIONAL DE INFORMACIÓN AMBIENTAL Y DE RECURSOS NATURALES', 'Administrativo', 2, 5),
  ('1S.2', '1S', 'ORDENAMIENTO ECOLÓGICO DEL TERRITORIO', 'Administrativo', 2, 5),
  ('2S.1', '2S', 'DISPOSICIONES EN MATERIA DE MEJORA REGULATORIA DEL SECTOR AMBIENTAL', 'Administrativo', 2, 5),
  ('2S.2', '2S', 'INSTRUMENTOS DE FOMENTO AMBIENTAL', 'Administrativo', 2, 5),
  ('2S.3', '2S', 'INFRAESTRUCTURA DE LA CALIDAD DEL SECTOR AMBIENTAL', 'Administrativo', 2, 5),
  ('3S.1', '3S', 'REMEDIACIÓN AMBIENTAL', 'Administrativo', 2, 5),
  ('3S.2', '3S', 'EVALUACIÓN DE RIESGO AMBIENTAL', 'Administrativo', 2, 5),
  ('3S.3', '3S', 'RESIDUOS PELIGROSOS', 'Administrativo', 2, 5),
  ('3S.4', '3S', 'AUTORIZACIONES DE PLAGUICIDAS, NUTRIENTES VEGETALES Y SUSTANCIAS Y MATERIALES TÓXICOS O PELIGROSOS', 'Administrativo', 2, 5),
  ('4S.1', '4S', 'MANIFESTACIONES DE IMPACTO AMBIENTAL (MIA)', 'Administrativo', 5, 10),
  ('4S.2', '4S', 'INFORME PREVENTIVO EN MATERIA DE IMPACTO AMBIENTAL', 'Administrativo', 5, 10),
  ('4S.3', '4S', 'EXPEDICIÓN DE TRÁMITE UNIFICADO DE CAMBIO DE USO DEL SUELO FORESTAL MODALIDAD B', 'Administrativo', 5, 10),
  ('4S.4', '4S', 'EXENCIÓN DE LA PRESENTACIÓN DE MANIFESTACIÓN DE IMPACTO AMBIENTAL', 'Administrativo', 3, 4),
  ('4S.5', '4S', 'AVISOS DE NO REQUERIMIENTO DE AUTORIZACIÓN EN MATERIA DE IMPACTO AMBIENTAL', 'Administrativo', 3, 4),
  ('4S.6', '4S', 'ORGANISMOS GENÉTICAMENTE MODIFICADOS (OGM’S)', 'Administrativo', 2, 5),
  ('5S.1', '5S', 'CERTIFICACIONES FITOSANITARIAS', 'Administrativo', 2, 5),
  ('5S.2', '5S', 'COLECTA DE RECURSOS FORESTALES', 'Administrativo', 2, 5),
  ('5S.3', '5S', 'MEDIDAS FITOSANITARIAS PARA LA PREVENCIÓN, CONTROL Y COMBATE DE PLAGAS Y ENFERMEDADES', 'Administrativo', 2, 5),
  ('5S.4', '5S', 'CAMBIO DE USO DE SUELO EN TERRENOS FORESTALES (CUSTF)', 'Administrativo', 2, 5),
  ('5S.5', '5S', 'PRODUCCIÓN EN MATERIA FORESTAL Y DE SUELOS', 'Administrativo', 2, 5),
  ('5S.6', '5S', 'REGISTRO FORESTAL NACIONAL', 'Administrativo', 2, 5),
  ('5S.7', '5S', 'CENTROS DE ALMACENAMIENTO Y TRANSFORMACIÓN DE MATERIAS PRIMAS FORESTALES', 'Administrativo', 2, 5),
  ('5S.8', '5S', 'PROCEDENCIA DE LAS MATERIAS PRIMAS PRODUCTOS Y SUBPRODUCTOS FORESTALES', 'Administrativo', 2, 5),
  ('5S.9', '5S', 'APROVECHAMIENTOS EN MATERIA FORESTAL', 'Administrativo', 2, 5),
  ('6S.1', '6S', 'UNIDADES DE MANEJO PARA LA CONSERVACIÓN', 'Administrativo', 2, 5),
  ('6S.2', '6S', 'AUTORIZACIONES DE APROVECHAMIENTOS DE LOS ORGANISMOS', 'Administrativo', 2, 5),
  ('6S.3', '6S', 'GESTIÓN DE COLECTA CIENTÍFICA DE LOS ORGANISMOS', 'Administrativo', 2, 5),
  ('6S.4', '6S', 'COORDINACIÓN DE COMERCIALIZACIÓN DE ESPECIES', 'Administrativo', 2, 5),
  ('6S.5', '6S', 'SANIDAD, MANEJO Y CONTROL DE POBLACIONES', 'Administrativo', 2, 5),
  ('6S.6', '6S', 'PADRONES DE CAZA Y MASCOTAS', 'Administrativo', 2, 5),
  ('6S.7', '6S', 'SUBSIDIO PARA EL FOMENTO PARA PROTECCIÓN A LAS ESPECIES', 'Administrativo', 2, 5),
  ('7S.1', '7S', 'PERMISOS DE CONSTRUCCIÓN DE OBRAS, CONCESIONES Y DESINCORPORACIÓN DE TERRENOS GANADOS AL MAR', 'Administrativo, Legal', 5, 10),
  ('7S.2', '7S', 'PERMISOS PARA USO TRANSITORIO Y COMERCIO AMBULANTE', 'Administrativo, Legal', 2, 5),
  ('7S.3', '7S', 'ACUERDOS DE DESTINOS DE LOS BIENES NACIONALES', 'Administrativo, Legal', 5, 10),
  ('7S.4', '7S', 'CARTOGRAFÍA DE DELIMITACIÓN DE BIENES NACIONALES Y AMBIENTES COSTEROS', 'Administrativo, Legal', 5, 10),
  ('8S.1', '8S', 'PROTECCIÓN DE LA ATMÓSFERA', 'Administrativo', 3, 5),
  ('8S.2', '8S', 'FUENTES FIJAS DE JURISDICCIÓN FEDERAL', 'Administrativo', 3, 5),
  ('8S.3', '8S', 'EMISIONES POR FUENTES Y TRANSFERENCIA DE CONTAMINANTES', 'Administrativo', 3, 5),
  ('9S.1', '9S', 'ADMINISTRACIÓN DE LA AGROECOLOGÍA', 'Administrativo', 2, 5),
  ('9S.2', '9S', 'GESTIONES BIOCULTURALES', 'Administrativo', 2, 5),
  ('10S.1', '10S', 'INSTRUMENTOS DE FOMENTO AMBIENTAL EN MATERIA DE BIODIVERSIDAD Y APROVECHAMIENTO SUSTENTABLE', 'Administrativo', 2, 5),
  ('10S.2', '10S', 'DISPOSICIONES EN MATERIA DE REGULACIÓN DE LA BIODIVERSIDAD, BIOSEGURIDAD Y SU APROVECHAMIENTO SUSTENTABLE', 'Administrativo', 2, 5);

DROP PROCEDURE IF EXISTS cargar_cadido_completo_2023;
DELIMITER $$
CREATE PROCEDURE cargar_cadido_completo_2023()
BEGIN
  DECLARE version_2023 BIGINT UNSIGNED;
  DECLARE coincidencias INT;
  DECLARE safe_anterior BOOLEAN DEFAULT @@SESSION.SQL_SAFE_UPDATES;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SET SESSION SQL_SAFE_UPDATES=safe_anterior;
    RESIGNAL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido'
      AND INDEX_NAME='uq_serie_version_codigo' AND NON_UNIQUE=0
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ejecuta primero la migración 008 de versionado CADIDO.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='anios_tramite') THEN
    ALTER TABLE series_cadido ADD COLUMN anios_tramite SMALLINT UNSIGNED NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='anios_concentracion') THEN
    ALTER TABLE series_cadido ADD COLUMN anios_concentracion SMALLINT UNSIGNED NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='series_cadido' AND COLUMN_NAME='valor_documental_oficial') THEN
    ALTER TABLE series_cadido ADD COLUMN valor_documental_oficial VARCHAR(120) NULL;
  END IF;

  SET SESSION SQL_SAFE_UPDATES=0;
  START TRANSACTION;
  INSERT INTO catalogos_cadido_versiones (anio,nombre,referencia,activo)
  VALUES (2023,'CADIDO SEMARNAT 2023','CADIDO VALIDADO (SELLADO).pdf',1)
  ON DUPLICATE KEY UPDATE activo=1;

  SELECT id INTO version_2023 FROM catalogos_cadido_versiones WHERE anio=2023;

  INSERT INTO secciones_cadido (codigo,nombre,es_demostracion)
  SELECT codigo,nombre,0 FROM tmp_cadido_secciones
  ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),es_demostracion=0;

  -- Primero actualiza únicamente los códigos ya presentes en la edición 2023.
  UPDATE series_cadido s
  JOIN tmp_cadido_series src ON CAST(s.codigo AS BINARY)=CAST(src.codigo AS BINARY)
  JOIN secciones_cadido se ON CAST(se.codigo AS BINARY)=CAST(src.seccion AS BINARY)
  SET s.seccion_id=se.id,s.nombre=src.nombre,s.activo=1,s.es_demostracion=0,
      s.valor_documental_oficial=src.valor_documental,
      s.anios_tramite=src.anios_tramite,s.anios_concentracion=src.anios_concentracion
  WHERE s.catalogo_version_id=version_2023;

  -- Después agrega los códigos faltantes de esa edición.
  INSERT INTO series_cadido (seccion_id,codigo,nombre,activo,es_demostracion,
    catalogo_version_id,valor_documental_oficial,anios_tramite,anios_concentracion)
  SELECT se.id,src.codigo,src.nombre,1,0,version_2023,
    src.valor_documental,src.anios_tramite,src.anios_concentracion
  FROM tmp_cadido_series src
  JOIN secciones_cadido se ON CAST(se.codigo AS BINARY)=CAST(src.seccion AS BINARY)
  WHERE NOT EXISTS (
    SELECT 1 FROM series_cadido s WHERE s.catalogo_version_id=version_2023
      AND CAST(s.codigo AS BINARY)=CAST(src.codigo AS BINARY)
  );

  SELECT COUNT(*) INTO coincidencias
  FROM tmp_cadido_series src
  JOIN series_cadido s ON CAST(s.codigo AS BINARY)=CAST(src.codigo AS BINARY)
    AND s.catalogo_version_id=version_2023
  JOIN secciones_cadido se ON se.id=s.seccion_id
  WHERE CAST(se.codigo AS BINARY)=CAST(src.seccion AS BINARY)
    AND CAST(s.nombre AS BINARY)=CAST(src.nombre AS BINARY)
    AND CAST(s.valor_documental_oficial AS BINARY)=CAST(src.valor_documental AS BINARY)
    AND s.activo=1 AND s.anios_tramite=src.anios_tramite AND s.anios_concentracion=src.anios_concentracion;
  IF coincidencias<>260 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La comparación contra las 260 series no coincide. Se revierte la carga.';
  END IF;
  COMMIT;
  SET SESSION SQL_SAFE_UPDATES=safe_anterior;

  SELECT 22 AS secciones_del_pdf, coincidencias AS series_verificadas;
  SELECT codigo AS serie_4S,nombre,anios_tramite AS AT,anios_concentracion AS AC
  FROM series_cadido WHERE catalogo_version_id=version_2023 AND codigo LIKE '4S.%'
  ORDER BY codigo;
  SELECT se.codigo AS seccion,s.codigo AS serie,s.nombre,s.valor_documental_oficial,
    s.anios_tramite AS AT,s.anios_concentracion AS AC,
    s.anios_tramite+s.anios_concentracion AS vigencia_total,s.activo
  FROM series_cadido s JOIN secciones_cadido se ON se.id=s.seccion_id
  JOIN tmp_cadido_series src ON CAST(src.codigo AS BINARY)=CAST(s.codigo AS BINARY)
  WHERE s.catalogo_version_id=version_2023
  ORDER BY LEFT(se.codigo,CHAR_LENGTH(se.codigo)-1)+0, RIGHT(se.codigo,1),
    SUBSTRING_INDEX(s.codigo,'.',-1)+0;
END$$
DELIMITER ;

CALL cargar_cadido_completo_2023();
DROP PROCEDURE cargar_cadido_completo_2023;
DROP TEMPORARY TABLE tmp_cadido_series;
DROP TEMPORARY TABLE tmp_cadido_secciones;
