export type LoanStatus = "Activo" | "Devuelto";

export type LoanMovement = {
  id: string;
  type: "Entrega" | "Devolución";
  date: string;
  responsible: string;
  detail: string;
};

export type ArchivalLoan = {
  id: string;
  folio: string;
  recordId: string;
  recordIds?: string[];
  deliveredRecordIds?: string[];
  mode?: "Expediente individual" | "Inventario completo";
  requestingAreaId: string;
  requesterName: string;
  loanDate: string;
  expectedReturnDate: string;
  authorizedBy: string;
  deliveredBy: string;
  receivedBy: string;
  observations: string;
  status: LoanStatus;
  actualReturnDate: string;
  returnReceivedBy: string;
  returnObservations: string;
  history: LoanMovement[];
};

const isoOffset = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const initialLoans: ArchivalLoan[] = [
  {
    id: "LOAN-001",
    folio: "PRE-2025-001",
    recordId: "REG-005",
    requestingAreaId: "AR-001",
    requesterName: "Laura Méndez Castillo",
    loanDate: isoOffset(-18),
    expectedReturnDate: isoOffset(-4),
    authorizedBy: "Ana Sofía Martínez Ruiz",
    deliveredBy: "Carlos Hernández Soto",
    receivedBy: "Laura Méndez Castillo",
    observations: "Consulta para seguimiento administrativo.",
    status: "Activo",
    actualReturnDate: "",
    returnReceivedBy: "",
    returnObservations: "",
    history: [
      {
        id: "MOV-001",
        type: "Entrega",
        date: isoOffset(-18),
        responsible: "Carlos Hernández Soto",
        detail: "Expediente entregado físicamente a Laura Méndez Castillo.",
      },
    ],
  },
  {
    id: "LOAN-002",
    folio: "PRE-2025-002",
    recordId: "REG-004",
    requestingAreaId: "AR-002",
    requesterName: "Mariana López Rivera",
    loanDate: isoOffset(-32),
    expectedReturnDate: isoOffset(-20),
    authorizedBy: "Ana Sofía Martínez Ruiz",
    deliveredBy: "Carlos Hernández Soto",
    receivedBy: "Mariana López Rivera",
    observations: "Consulta de antecedentes del convenio.",
    status: "Devuelto",
    actualReturnDate: isoOffset(-22),
    returnReceivedBy: "Carlos Hernández Soto",
    returnObservations: "Expediente devuelto completo y sin daños visibles.",
    history: [
      {
        id: "MOV-002",
        type: "Entrega",
        date: isoOffset(-32),
        responsible: "Carlos Hernández Soto",
        detail: "Expediente entregado físicamente a Mariana López Rivera.",
      },
      {
        id: "MOV-003",
        type: "Devolución",
        date: isoOffset(-22),
        responsible: "Carlos Hernández Soto",
        detail: "Expediente recibido completo y reintegrado al archivo.",
      },
    ],
  },
];

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const effectiveLoanStatus = (loan: ArchivalLoan): "Activo" | "Vencido" | "Devuelto" => {
  if (loan.status === "Devuelto") return "Devuelto";
  return loan.expectedReturnDate < todayIso() ? "Vencido" : "Activo";
};
