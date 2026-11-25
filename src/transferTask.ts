import type { DocumentaryTransfer } from "./transfers";
import type { UserRecord, Role } from "./data";

export function transferTask(transfer: DocumentaryTransfer, user: UserRecord, role: Role, permissions: string[]) {
  const documents = transfer.documents ?? [];
  const has = (kind: string) => documents.some(doc => doc.kind === kind);
  const own = transfer.requestedBy === user.id;
  const manager = role === "Encargado de área" && transfer.areaId === user.areaId;
  const admin = role === "Administrador / Coordinador";
  const areaOperator = manager || (admin && own);
  const areaOwner = admin && own ? "Administrador" : "Encargado del área";
  const document = (step: number, kind: string, label: string, mine: boolean, owner: string) =>
    ({ step, kind, label, mine, owner });
  if (transfer.status === "Cancelada") return { step: -1, label: "Solicitud cancelada", owner: "", mine: false };
  if (transfer.receptionStatus === "Recibida") return { step: 5, label: "Recepción completada", owner: "", mine: false };
  if (transfer.status === "Pendiente de visto bueno del área") {
    const note = documents.map(doc => doc.kind).lastIndexOf("SOLICITUD");
    if (note >= 0 && !documents.slice(note + 1).some(doc => doc.kind === "ACUSE_SOLICITUD" && doc.hasFile))
      return document(0, "ACUSE_SOLICITUD", "Adjuntar acuse de solicitud", areaOperator, areaOwner);
    return { step: 1, label: "Dar visto bueno", owner: admin && own ? "Administrador" : transfer.assignedAreaManagerName || "Encargado del área", mine: admin || (manager && permissions.includes("approve-area-transfers")) };
  }
  if (transfer.status === "Pendiente de revisión administrativa")
    return { step: 2, label: "Revisar y emitir dictamen", owner: "Administrador", mine: admin && permissions.some(permission => ["review-transfers", "accept-transfers"].includes(permission)) };
  if (transfer.status === "Aceptada") {
    if (role === "Personal de área") return { step: 3, label: "Traslado y recepción", owner: "Archivo de Concentración", mine: false };
    if (has("DICTAMEN_FAVORABLE")) {
      const area = areaOwner;
      if (!has("NOTA_TRASLADO")) return document(3, "NOTA_TRASLADO", "Registrar nota de traslado", areaOperator, area);
      if (!has("ACUSE_TRASLADO")) return document(3, "ACUSE_TRASLADO", "Adjuntar acuse de traslado", areaOperator, area);
      if (!has("ENTREGA")) return document(3, "ENTREGA", "Registrar entrega", areaOperator, area);
      if (!has("FORMATO_FIRMADO")) return document(4, "FORMATO_FIRMADO", "Adjuntar formato firmado", admin, "Administrador");
    }
    return { step: 4, label: "Registrar recepción física", owner: "Administrador", mine: admin && permissions.includes("update-location") };
  }
  return { step: 0, label: transfer.status === "Con observaciones" ? "Corregir y reenviar" : "Preparar envío", owner: areaOwner, mine: areaOperator };
}
