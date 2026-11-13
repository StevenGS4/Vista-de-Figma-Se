export type RecordStage = "Archivo de trámite" | "Archivo de concentración";
export type RecordAvailability = "En archivo" | "Prestado";

export type ArchivalRecord = {
  id: string;
  inventoryId: string;
  inventoryDate: string;
  responsiblePosition: string;
  initialSheetNumber: string;
  administrativeUnit: string;
  areaId: string;
  responsible: string;
  fund: string;
  consecutive: string;
  recordNumber: string;
  boxNumber: string;
  title: string;
  description: string;
  archiveAddress?: string;
  observations: string;
  cadidoSectionId: string;
  cadidoSeriesId: string;
  cadidoCode: string;
  cadidoYear?: string;
  openDate: string;
  closeDate: string;
  filesCount: string;
  foliosCount: string;
  supportType: string;
  documentaryValues: string[];
  currentValidity: string;
  concentrationValidity: string;
  totalValidity: string;
  archiveZone: string;
  room: string;
  shelf: string;
  level: string;
  physicalSection: string;
  position: string;
  locationBox: string;
  locationNotes: string;
  stage: RecordStage;
  availability: RecordAvailability;
  createdBy: string;
  transferReference: string;
  transferDate: string;
  transferAcceptedDate: string;
  receptionDate: string;
  receptionResponsible: string;
  receptionNotes: string;
};

export type CadidoSection = {
  id: string;
  name: string;
  description: string;
};

export type CadidoSeries = {
  id: string;
  sectionId: string;
  name: string;
  code: string;
  year?: string;
  detail: string;
  enabledAreaIds: string[];
};

export const cadidoSections: CadidoSection[] = [
  {
    id: "SEC-DEMO-01",
    name: "1C — Planeación institucional (demostración)",
    description: "Documentación ficticia relacionada con programas y seguimiento institucional.",
  },
  {
    id: "SEC-DEMO-02",
    name: "4C — Asuntos jurídicos (demostración)",
    description: "Clasificación ficticia para expedientes de apoyo y consulta jurídica.",
  },
  {
    id: "SEC-DEMO-03",
    name: "6C — Recursos materiales (demostración)",
    description: "Clasificación ficticia para gestión de bienes y servicios.",
  },
  {
    id: "SEC-DEMO-04",
    name: "8C — Recursos humanos (demostración)",
    description: "Clasificación ficticia para gestión administrativa del personal.",
  },
];

export const cadidoSeries: CadidoSeries[] = [
  {
    id: "SER-DEMO-011",
    sectionId: "SEC-DEMO-01",
    name: "Programas operativos anuales",
    code: "DEMO-1C.1",
    detail: "Serie ficticia. Vigencias definidas manualmente por el personal autorizado.",
    enabledAreaIds: ["AR-001", "AR-002", "AR-004", "AR-005"],
  },
  {
    id: "SER-DEMO-012",
    sectionId: "SEC-DEMO-01",
    name: "Informes de seguimiento",
    code: "DEMO-1C.2",
    detail: "Serie ficticia para informes internos de seguimiento.",
    enabledAreaIds: ["AR-001", "AR-002", "AR-004", "AR-005"],
  },
  {
    id: "SER-DEMO-041",
    sectionId: "SEC-DEMO-02",
    name: "Opiniones y consultas jurídicas",
    code: "DEMO-4C.1",
    detail: "Serie ficticia habilitada para la Unidad Jurídica.",
    enabledAreaIds: ["AR-002"],
  },
  {
    id: "SER-DEMO-043",
    sectionId: "SEC-DEMO-02",
    name: "Convenios y contratos",
    code: "DEMO-4C.3",
    detail: "Serie ficticia para instrumentos consensuales y seguimiento.",
    enabledAreaIds: ["AR-001", "AR-002"],
  },
  {
    id: "SER-DEMO-061",
    sectionId: "SEC-DEMO-03",
    name: "Adquisiciones y servicios",
    code: "DEMO-6C.1",
    detail: "Serie ficticia habilitada para Recursos Materiales.",
    enabledAreaIds: ["AR-001", "AR-004"],
  },
  {
    id: "SER-DEMO-081",
    sectionId: "SEC-DEMO-04",
    name: "Expedientes administrativos de personal",
    code: "DEMO-8C.1",
    detail: "Serie ficticia habilitada para Recursos Humanos.",
    enabledAreaIds: ["AR-001", "AR-005"],
  },
];

export const initialArchivalRecords: ArchivalRecord[] = [
  {
    id: "REG-001",
    inventoryId: "INV-TR-001",
    inventoryDate: "2025-06-12",
    responsiblePosition: "Titular de la Unidad Jurídica",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-002",
    responsible: "Mariana López Rivera",
    fund: "SEMARNAT Nayarit",
    consecutive: "0042",
    recordNumber: "SEMARNAT-NAY/UJ/2025/0042",
    boxNumber: "08",
    title: "Opinión jurídica sobre procedimiento administrativo",
    description: "Integración de antecedentes, consulta y opinión jurídica emitida.",
    observations: "Expediente de demostración.",
    cadidoSectionId: "SEC-DEMO-02",
    cadidoSeriesId: "SER-DEMO-043",
    cadidoCode: "DEMO-4C.3",
    openDate: "2025-02-14",
    closeDate: "",
    filesCount: "1",
    foliosCount: "86",
    supportType: "Físico",
    documentaryValues: ["Administrativo", "Legal"],
    currentValidity: "2",
    concentrationValidity: "4",
    totalValidity: "6",
    archiveZone: "Archivo de trámite — Unidad Jurídica",
    room: "Sala A",
    shelf: "12",
    level: "2",
    physicalSection: "3",
    position: "B-03",
    locationBox: "08",
    locationNotes: "Caja identificada en lomo.",
    stage: "Archivo de trámite",
    availability: "En archivo",
    createdBy: "USR-002",
    transferReference: "",
    transferDate: "",
    transferAcceptedDate: "",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
  },
  {
    id: "REG-002",
    inventoryId: "INV-TR-002",
    inventoryDate: "2025-06-10",
    responsiblePosition: "Jefa de Recursos Materiales",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-004",
    responsible: "Patricia Gómez Medina",
    fund: "SEMARNAT Nayarit",
    consecutive: "0018",
    recordNumber: "SEMARNAT-NAY/RM/2025/0018",
    boxNumber: "03",
    title: "Adquisición de consumibles de oficina",
    description: "Documentación del procedimiento de adquisición.",
    observations: "",
    cadidoSectionId: "SEC-DEMO-03",
    cadidoSeriesId: "SER-DEMO-061",
    cadidoCode: "DEMO-6C.1",
    openDate: "2025-01-22",
    closeDate: "",
    filesCount: "2",
    foliosCount: "144",
    supportType: "Mixto",
    documentaryValues: ["Administrativo", "Fiscal"],
    currentValidity: "2",
    concentrationValidity: "3",
    totalValidity: "5",
    archiveZone: "Archivo de trámite — Recursos Materiales",
    room: "Sala B",
    shelf: "7",
    level: "3",
    physicalSection: "2",
    position: "",
    locationBox: "03",
    locationNotes: "",
    stage: "Archivo de trámite",
    availability: "En archivo",
    createdBy: "USR-004",
    transferReference: "",
    transferDate: "",
    transferAcceptedDate: "",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
  },
  {
    id: "REG-003",
    inventoryId: "INV-TR-003",
    inventoryDate: "2025-06-11",
    responsiblePosition: "Jefe de Recursos Humanos",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-005",
    responsible: "Luis Alberto Ramos",
    fund: "SEMARNAT Nayarit",
    consecutive: "0071",
    recordNumber: "SEMARNAT-NAY/RH/2025/0071",
    boxNumber: "11",
    title: "Actualización de expedientes administrativos",
    description: "Control de actualizaciones administrativas de personal.",
    observations: "",
    cadidoSectionId: "SEC-DEMO-04",
    cadidoSeriesId: "SER-DEMO-081",
    cadidoCode: "DEMO-8C.1",
    openDate: "2025-03-03",
    closeDate: "",
    filesCount: "3",
    foliosCount: "210",
    supportType: "Físico",
    documentaryValues: ["Administrativo", "Legal"],
    currentValidity: "3",
    concentrationValidity: "5",
    totalValidity: "8",
    archiveZone: "Archivo de trámite — Recursos Humanos",
    room: "Sala B",
    shelf: "15",
    level: "1",
    physicalSection: "4",
    position: "D-01",
    locationBox: "11",
    locationNotes: "",
    stage: "Archivo de trámite",
    availability: "En archivo",
    createdBy: "USR-005",
    transferReference: "",
    transferDate: "",
    transferAcceptedDate: "",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
  },
  {
    id: "REG-004",
    inventoryId: "INV-TR-004",
    inventoryDate: "2025-04-18",
    responsiblePosition: "Titular de la Unidad Jurídica",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-002",
    responsible: "Mariana López Rivera",
    fund: "SEMARNAT Nayarit",
    consecutive: "0104",
    recordNumber: "SEMARNAT-NAY/UJ/2019/0104",
    boxNumber: "14",
    title: "Seguimiento de convenio de colaboración institucional",
    description: "Antecedentes, instrumento suscrito y seguimiento administrativo del convenio.",
    observations: "Expediente ficticio transferido administrativamente.",
    cadidoSectionId: "SEC-DEMO-02",
    cadidoSeriesId: "SER-DEMO-043",
    cadidoCode: "DEMO-4C.3",
    openDate: "2019-04-08",
    closeDate: "2021-12-17",
    filesCount: "2",
    foliosCount: "178",
    supportType: "Físico",
    documentaryValues: ["Administrativo", "Legal"],
    currentValidity: "2",
    concentrationValidity: "4",
    totalValidity: "6",
    archiveZone: "Archivo de concentración — Zona general",
    room: "Sala 1",
    shelf: "2",
    level: "3",
    physicalSection: "4",
    position: "C-04",
    locationBox: "14",
    locationNotes: "Caja rotulada con referencia de transferencia.",
    stage: "Archivo de concentración",
    availability: "En archivo",
    createdBy: "USR-002",
    transferReference: "TP-2025-004",
    transferDate: "2025-04-21",
    transferAcceptedDate: "2025-04-24",
    receptionDate: "2025-04-28",
    receptionResponsible: "Carlos Hernández Soto",
    receptionNotes: "Recepción física completa y cotejada.",
  },
  {
    id: "REG-005",
    inventoryId: "INV-TR-005",
    inventoryDate: "2025-03-07",
    responsiblePosition: "Jefa de Recursos Materiales",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-004",
    responsible: "Patricia Gómez Medina",
    fund: "SEMARNAT Nayarit",
    consecutive: "0189",
    recordNumber: "SEMARNAT-NAY/RM/2021/0189",
    boxNumber: "22",
    title: "Contratación de servicios de mantenimiento",
    description: "Documentación administrativa y fiscal del servicio contratado.",
    observations: "",
    cadidoSectionId: "SEC-DEMO-03",
    cadidoSeriesId: "SER-DEMO-061",
    cadidoCode: "DEMO-6C.1",
    openDate: "2021-02-15",
    closeDate: "2021-11-30",
    filesCount: "3",
    foliosCount: "236",
    supportType: "Mixto",
    documentaryValues: ["Administrativo", "Fiscal"],
    currentValidity: "2",
    concentrationValidity: "3",
    totalValidity: "5",
    archiveZone: "Archivo de concentración — Zona general",
    room: "Sala 1",
    shelf: "5",
    level: "2",
    physicalSection: "1",
    position: "A-02",
    locationBox: "22",
    locationNotes: "",
    stage: "Archivo de concentración",
    availability: "Prestado",
    createdBy: "USR-004",
    transferReference: "TP-2025-002",
    transferDate: "2025-03-10",
    transferAcceptedDate: "2025-03-13",
    receptionDate: "2025-03-17",
    receptionResponsible: "Carlos Hernández Soto",
    receptionNotes: "Se recibieron tres legajos sin incidencias.",
  },
  {
    id: "REG-006",
    inventoryId: "INV-TR-006",
    inventoryDate: "2025-05-09",
    responsiblePosition: "Jefe de Recursos Humanos",
    initialSheetNumber: "1",
    administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
    areaId: "AR-005",
    responsible: "Luis Alberto Ramos",
    fund: "SEMARNAT Nayarit",
    consecutive: "0063",
    recordNumber: "SEMARNAT-NAY/RH/2020/0063",
    boxNumber: "09",
    title: "Control administrativo de capacitación del personal",
    description: "Constancias, listas y documentación de seguimiento de capacitación.",
    observations: "",
    cadidoSectionId: "SEC-DEMO-04",
    cadidoSeriesId: "SER-DEMO-081",
    cadidoCode: "DEMO-8C.1",
    openDate: "2020-01-20",
    closeDate: "2020-12-15",
    filesCount: "2",
    foliosCount: "152",
    supportType: "Físico",
    documentaryValues: ["Administrativo"],
    currentValidity: "3",
    concentrationValidity: "5",
    totalValidity: "8",
    archiveZone: "Archivo de concentración — Zona general",
    room: "Sala 2",
    shelf: "9",
    level: "1",
    physicalSection: "2",
    position: "",
    locationBox: "09",
    locationNotes: "Pendiente incorporar etiqueta lateral.",
    stage: "Archivo de concentración",
    availability: "En archivo",
    createdBy: "USR-005",
    transferReference: "TP-2025-006",
    transferDate: "2025-05-12",
    transferAcceptedDate: "2025-05-15",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
  },
];

export const emptyRecord = (): ArchivalRecord => ({
  id: "",
  inventoryId: "",
  inventoryDate: new Date().toISOString().slice(0, 10),
  responsiblePosition: "",
  initialSheetNumber: "1",
  administrativeUnit: "Oficina de Representación de SEMARNAT en Nayarit",
  areaId: "",
  responsible: "",
  fund: "SEMARNAT Nayarit",
  consecutive: "",
  recordNumber: "",
  boxNumber: "",
  title: "",
  description: "",
  archiveAddress:
    "Avenida Allende No. 110 Oriente, Colonia Centro, C.P. 63000, Tepic, Nayarit",
  observations: "",
  cadidoSectionId: "",
  cadidoSeriesId: "",
  cadidoCode: "",
  openDate: "",
  closeDate: "",
  filesCount: "1",
  foliosCount: "",
  supportType: "Físico",
  documentaryValues: [],
  currentValidity: "",
  concentrationValidity: "",
  totalValidity: "",
  archiveZone: "",
  room: "",
  shelf: "",
  level: "",
  physicalSection: "",
  position: "",
  locationBox: "",
  locationNotes: "",
  stage: "Archivo de trámite",
  availability: "En archivo",
  createdBy: "",
  transferReference: "",
  transferDate: "",
  transferAcceptedDate: "",
  receptionDate: "",
  receptionResponsible: "",
  receptionNotes: "",
});

export const locationSummary = (record: ArchivalRecord) => {
  const parts = [
    record.shelf && `Estante ${record.shelf}`,
    record.level && `Nivel ${record.level}`,
    record.physicalSection && `Sección ${record.physicalSection}`,
    record.locationBox && `Caja ${record.locationBox}`,
  ].filter(Boolean);
  return parts.join(" / ") || "Ubicación pendiente";
};

/**
 * Catálogo recibido del backend. El catálogo inicial es únicamente ficticio.
 * Conservamos las referencias compartidas por los componentes de Figma.
 */
export function setCadidoCatalog(sections: CadidoSection[],series:CadidoSeries[]) {
 cadidoSections.splice(0,cadidoSections.length,...sections);
 cadidoSeries.splice(0,cadidoSeries.length,...series);
}
