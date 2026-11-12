export type TransferStatus =
  | "En preparación"
  | "Pendiente de visto bueno del área"
  | "Pendiente de revisión administrativa"
  | "Con observaciones"
  | "Aceptada";

export type ReceptionStatus = "Pendiente" | "Recibida" | "Diferencias pendientes";

export type TransferHistoryEvent = {
  id: string;
  type:
    | "Preparación"
    | "Envío"
    | "Visto bueno de área"
    | "Revisión"
    | "Observaciones"
    | "Reenvío"
    | "Aceptación"
    | "Recepción física";
  date: string;
  actor: string;
  detail: string;
};

export type DocumentaryTransfer = {
  id: string;
  folio: string;
  areaId: string;
  requestedBy: string;
  createdAt: string;
  submittedAt: string;
  status: TransferStatus;
  recordIds: string[];
  reviewerId: string;
  areaApproverId?: string;
  areaApprovedAt?: string;
  reviewedAt: string;
  acceptedAt: string;
  observation: string;
  receptionStatus: ReceptionStatus;
  receptionDate: string;
  receptionResponsible: string;
  receptionNotes: string;
  history: TransferHistoryEvent[];
};

export const initialTransfers: DocumentaryTransfer[] = [
  {
    id: "TR-001",
    folio: "TP-2025-002",
    areaId: "AR-004",
    requestedBy: "USR-004",
    createdAt: "2025-03-07",
    submittedAt: "2025-03-10",
    status: "Aceptada",
    recordIds: ["REG-005"],
    reviewerId: "USR-001",
    reviewedAt: "2025-03-13",
    acceptedAt: "2025-03-13",
    observation: "",
    receptionStatus: "Recibida",
    receptionDate: "2025-03-17",
    receptionResponsible: "USR-003",
    receptionNotes: "Se recibieron tres legajos sin incidencias.",
    history: [
      {
        id: "H-001-1",
        type: "Preparación",
        date: "2025-03-07",
        actor: "USR-004",
        detail: "Solicitud preparada con un expediente.",
      },
      {
        id: "H-001-2",
        type: "Envío",
        date: "2025-03-10",
        actor: "USR-004",
        detail: "Solicitud enviada para revisión administrativa.",
      },
      {
        id: "H-001-3",
        type: "Revisión",
        date: "2025-03-13",
        actor: "USR-001",
        detail: "Inventario y expedientes revisados por la coordinación.",
      },
      {
        id: "H-001-4",
        type: "Aceptación",
        date: "2025-03-13",
        actor: "USR-001",
        detail: "Transferencia aceptada. El expediente cambió a concentración.",
      },
      {
        id: "H-001-5",
        type: "Recepción física",
        date: "2025-03-17",
        actor: "USR-003",
        detail: "Recepción física completa y sin diferencias.",
      },
    ],
  },
  {
    id: "TR-002",
    folio: "TP-2025-004",
    areaId: "AR-002",
    requestedBy: "USR-002",
    createdAt: "2025-04-18",
    submittedAt: "2025-04-21",
    status: "Aceptada",
    recordIds: ["REG-004"],
    reviewerId: "USR-001",
    reviewedAt: "2025-04-24",
    acceptedAt: "2025-04-24",
    observation: "",
    receptionStatus: "Recibida",
    receptionDate: "2025-04-28",
    receptionResponsible: "USR-003",
    receptionNotes: "Recepción física completa y cotejada.",
    history: [
      {
        id: "H-002-1",
        type: "Preparación",
        date: "2025-04-18",
        actor: "USR-002",
        detail: "Solicitud preparada con un expediente.",
      },
      {
        id: "H-002-2",
        type: "Envío",
        date: "2025-04-21",
        actor: "USR-002",
        detail: "Inventario enviado para revisión.",
      },
      {
        id: "H-002-3",
        type: "Revisión",
        date: "2025-04-24",
        actor: "USR-001",
        detail: "Inventario y expedientes revisados por la coordinación.",
      },
      {
        id: "H-002-4",
        type: "Aceptación",
        date: "2025-04-24",
        actor: "USR-001",
        detail: "Transferencia aceptada por la coordinación.",
      },
      {
        id: "H-002-5",
        type: "Recepción física",
        date: "2025-04-28",
        actor: "USR-003",
        detail: "Expediente recibido y cotejado.",
      },
    ],
  },
  {
    id: "TR-003",
    folio: "TP-2025-006",
    areaId: "AR-005",
    requestedBy: "USR-005",
    createdAt: "2025-05-09",
    submittedAt: "2025-05-12",
    status: "Aceptada",
    recordIds: ["REG-006"],
    reviewerId: "USR-001",
    reviewedAt: "2025-05-15",
    acceptedAt: "2025-05-15",
    observation: "",
    receptionStatus: "Pendiente",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
    history: [
      {
        id: "H-003-1",
        type: "Preparación",
        date: "2025-05-09",
        actor: "USR-005",
        detail: "Solicitud preparada con un expediente.",
      },
      {
        id: "H-003-2",
        type: "Envío",
        date: "2025-05-12",
        actor: "USR-005",
        detail: "Solicitud enviada a revisión.",
      },
      {
        id: "H-003-3",
        type: "Revisión",
        date: "2025-05-15",
        actor: "USR-001",
        detail: "Inventario y expedientes revisados por la coordinación.",
      },
      {
        id: "H-003-4",
        type: "Aceptación",
        date: "2025-05-15",
        actor: "USR-001",
        detail: "Transferencia aceptada; recepción física pendiente.",
      },
    ],
  },
  {
    id: "TR-004",
    folio: "TP-2025-007",
    areaId: "AR-002",
    requestedBy: "USR-002",
    createdAt: "2025-06-03",
    submittedAt: "2025-06-05",
    status: "Con observaciones",
    recordIds: ["REG-001"],
    reviewerId: "USR-001",
    reviewedAt: "2025-06-06",
    acceptedAt: "",
    observation: "Verificar el número total de folios antes de reenviar el inventario.",
    receptionStatus: "Pendiente",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
    history: [
      {
        id: "H-004-1",
        type: "Preparación",
        date: "2025-06-03",
        actor: "USR-002",
        detail: "Solicitud preparada con un expediente.",
      },
      {
        id: "H-004-2",
        type: "Envío",
        date: "2025-06-05",
        actor: "USR-002",
        detail: "Solicitud enviada para revisión.",
      },
      {
        id: "H-004-3",
        type: "Revisión",
        date: "2025-06-06",
        actor: "USR-001",
        detail: "Inventario revisado por la coordinación.",
      },
      {
        id: "H-004-4",
        type: "Observaciones",
        date: "2025-06-06",
        actor: "USR-001",
        detail: "Se solicitó verificar el número total de folios.",
      },
    ],
  },
  {
    id: "TR-005",
    folio: "TP-2025-008",
    areaId: "AR-004",
    requestedBy: "USR-004",
    createdAt: "2025-06-09",
    submittedAt: "",
    status: "En preparación",
    recordIds: ["REG-002"],
    reviewerId: "",
    reviewedAt: "",
    acceptedAt: "",
    observation: "",
    receptionStatus: "Pendiente",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
    history: [
      {
        id: "H-005-1",
        type: "Preparación",
        date: "2025-06-09",
        actor: "USR-004",
        detail: "Solicitud guardada en preparación.",
      },
    ],
  },
  {
    id: "TR-006",
    folio: "TP-2025-009",
    areaId: "AR-005",
    requestedBy: "USR-005",
    createdAt: "2025-06-11",
    submittedAt: "2025-06-12",
    status: "Pendiente de visto bueno del área",
    recordIds: ["REG-003"],
    reviewerId: "",
    reviewedAt: "",
    acceptedAt: "",
    observation: "",
    receptionStatus: "Pendiente",
    receptionDate: "",
    receptionResponsible: "",
    receptionNotes: "",
    history: [
      {
        id: "H-006-1",
        type: "Preparación",
        date: "2025-06-11",
        actor: "USR-005",
        detail: "Solicitud preparada con un expediente.",
      },
      {
        id: "H-006-2",
        type: "Envío",
        date: "2025-06-12",
        actor: "USR-005",
        detail: "Solicitud enviada para revisión.",
      },
    ],
  },
];

export const todayIso = () => new Date().toISOString().slice(0, 10);
