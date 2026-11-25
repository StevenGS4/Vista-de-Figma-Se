import type { PersonalLoan } from "./api";
import type { Role, UserRecord } from "./data";
import type { ArchivalRecord } from "./records";
import type { DocumentaryTransfer } from "./transfers";
import { transferTask } from "./transferTask";

export function personalLoanTiming(loan: PersonalLoan, today: string) {
  if (loan.status === "DEVUELTO") return { label: "Devuelto", reminder: false };
  if (!loan.dueDate) return { label: "Sin fecha prevista", reminder: false };
  const day = (date: string) => Date.parse(date + "T00:00:00Z") / 86400000;
  const days = day(loan.dueDate) - day(today);
  const duration = day(loan.dueDate) - day(loan.loanDate);
  const label = days < 0 ? `Vencido hace ${-days} ${days === -1 ? "día" : "días"}`
    : days === 0 ? "Vence hoy" : `Faltan ${days} ${days === 1 ? "día" : "días"}`;
  return { label, reminder: days <= Math.ceil(Math.max(0, duration) * 0.1) };
}

export const homeToday = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Mazatlan" });

export function assignedTransferTasks(user: UserRecord, role: Role, transfers: DocumentaryTransfer[], permissions: string[]) {
  return transfers.filter(transfer => role === "Administrador / Coordinador"
    || (transfer.areaId === user.areaId && (role === "Encargado de área" || transfer.requestedBy === user.id)))
    .map(transfer => ({ transfer, task: transferTask(transfer, user, role, permissions) }))
    .filter(({ task }) => task.mine);
}

export function lastActiveInventory(user: UserRecord, role: Role, records: ArchivalRecord[]) {
  return records.filter(record => record.stage === "Archivo de trámite" && !record.transferReference
    && !record.recordDeletedAt && !record.inventoryDeletedAt
    && (role === "Administrador / Coordinador" || (record.areaId === user.areaId
      && (role === "Encargado de área" || (record.inventoryCreatedBy ?? record.createdBy) === user.id))))
    .sort((a, b) => b.inventoryDate.localeCompare(a.inventoryDate))[0];
}
