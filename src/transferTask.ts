import type { DocumentaryTransfer } from "./transfers";
import type { UserRecord, Role } from "./data";

export function transferTask(transfer: DocumentaryTransfer, user: UserRecord, role: Role, permissions: string[]) {
  const documents = transfer.documents ?? [];
  const has = (kind: string) => documents.some(doc => doc.kind === kind);
  const own = transfer.requestedBy === user.id;
  const manager = role === "Encargado de área" && transfer.areaId === user.areaId;
  const admin = role === "Administrador / Coordinador";
  const document = (step: number, kind: string, label: string, mine: boolean, owner: string) =>
    ({ step, kind, label, mine, owner });
  if (transfer.status === "Cancelada") return { step: -1, label: "Solicitud cancelada", owner: "", mine: false };
  if (transfer.receptionStatus === "Recibida") return { step: 5, label: "Recepción completada", owner: "", mine: false };
  if (transfer.status === "Pendiente de visto bueno del área") {
    const note = documents.map(doc => doc.kind).lastIndexOf("SOLICITUD");
    if (note >= 0 && !documents.slice(note + 1).some(doc => doc.kind === "ACUSE_SOLICITUD" && doc.hasFile))
      return document(0, "ACUSE_SOLICITUD", "Adjuntar acuse de solicitud", own, "Solicitante");
    return { step: 1, label: "Dar visto bueno", owner: transfer.assignedAreaManagerName || "Encargado del área", mine: !own && (admin || (manager && permissions.includes("approve-area-transfers"))) };
  }
  if (transfer.status === "Pendiente de revisión administrativa")
    return { step: 2, label: "Revisar y emitir dictamen", owner: "Administrador", mine: admin && !own && permissions.some(permission => ["review-transfers", "accept-transfers"].includes(permission)) };
  if (transfer.status === "Aceptada") {
    if (has("DICTAMEN_FAVORABLE")) {
      const area = "Encargado del área";
      if (!has("NOTA_TRASLADO")) return document(3, "NOTA_TRASLADO", "Registrar nota de traslado", manager, area);
      if (!has("ACUSE_TRASLADO")) return document(3, "ACUSE_TRASLADO", "Adjuntar acuse de traslado", manager, area);
      if (!has("ENTREGA")) return document(3, "ENTREGA", "Registrar entrega", manager, area);
      if (!has("FORMATO_FIRMADO")) return document(4, "FORMATO_FIRMADO", "Adjuntar formato firmado", admin, "Administrador");
    }
    return { step: 4, label: "Registrar recepción física", owner: "Administrador", mine: admin && permissions.includes("update-location") };
  }
  return { step: 0, label: transfer.status === "Con observaciones" ? "Corregir y reenviar" : "Preparar envío", owner: "Solicitante", mine: own && (admin || ((manager || role === "Personal de área") && permissions.includes("prepare-transfers"))) };
}
