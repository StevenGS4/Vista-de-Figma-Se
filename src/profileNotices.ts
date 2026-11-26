import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { LoanNotice, OverdueLoanReport } from "./api";
import type { HomeNotice } from "./HomeDashboard";

export type ProfileNotice = HomeNotice & { report?: OverdueLoanReport };
const readEvent = "semarnat-notice-read";
const emptySeen = new Set<string>();
const snapshots = new Map<string, { raw: string; seen: Set<string> }>();

function readSeen(key: string) {
  let raw: string;
  try { raw = window.localStorage.getItem(key) ?? ""; }
  catch { return snapshots.get(key)?.seen ?? emptySeen; }
  const cached = snapshots.get(key);
  if (cached?.raw === raw) return cached.seen;
  let seen = emptySeen;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) seen = new Set(value.filter((id): id is string => typeof id === "string"));
  } catch { /* El almacenamiento anterior puede estar vacío. */ }
  snapshots.set(key, { raw, seen });
  return seen;
}

function subscribe(callback: () => void) {
  window.addEventListener(readEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(readEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useReadNotices(userId: string) {
  const key = "semarnat-notices-read-" + userId;
  const seen = useSyncExternalStore(subscribe, () => readSeen(key), () => emptySeen);
  const markRead = (id: string) => {
    const previous = readSeen(key);
    if (previous.has(id)) return;
    const next = new Set([...previous, id]);
    const raw = JSON.stringify([...next]);
    try { window.localStorage.setItem(key, raw); }
    catch {
      // Conserva las lecturas durante la sesión si no se puede escribir en el navegador.
      snapshots.set(key, { raw: snapshots.get(key)?.raw ?? "", seen: next });
      window.dispatchEvent(new Event(readEvent));
      return;
    }
    snapshots.set(key, { raw, seen: next });
    window.dispatchEvent(new Event(readEvent));
  };
  return { seen, markRead };
}

export function mergeProfileNotices(personal: LoanNotice[], staff: HomeNotice[]): ProfileNotice[] {
  const unique = new Map<string, ProfileNotice>();
  for (const notice of [...staff, ...personal]) unique.set(notice.id, notice);
  return [...unique.values()].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

const historyEvent = "semarnat-notice-history";
const emptyHistory: ProfileNotice[] = [];
const historySnapshots = new Map<string, { raw: string; notices: ProfileNotice[] }>();

function loadHistory(key: string): ProfileNotice[] {
  let raw: string;
  try { raw = window.localStorage.getItem(key) ?? ""; }
  catch { return historySnapshots.get(key)?.notices ?? emptyHistory; }
  const cached = historySnapshots.get(key);
  if (cached?.raw === raw) return cached.notices;
  let notices = emptyHistory;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value)) notices = value.filter(item =>
      typeof item?.id === "string" && typeof item?.date === "string" &&
      typeof item?.title === "string" && typeof item?.detail === "string");
  } catch { /* Un historial local inválido se vuelve a formar con los avisos disponibles. */ }
  historySnapshots.set(key, { raw, notices });
  return notices;
}

export function useNoticeHistory(key: string, current: ProfileNotice[]) {
  const history = useSyncExternalStore(subscribeHistory, () => loadHistory(key), () => emptyHistory);
  useEffect(() => {
    if (!current.length) return;
    const prior = loadHistory(key);
    const byId = new Map(prior.map(notice => [notice.id, notice]));
    current.forEach(notice => byId.set(notice.id, notice));
    const notices = [...byId.values()];
    const raw = JSON.stringify(notices);
    if (JSON.stringify(prior) === raw) return;
    try {
      window.localStorage.setItem(key, raw);
      historySnapshots.set(key, { raw, notices });
    } catch {
      historySnapshots.set(key, { raw: historySnapshots.get(key)?.raw ?? "", notices });
    }
    window.dispatchEvent(new Event(historyEvent));
  }, [current, key]);
  return useMemo(() => {
    const byId = new Map(history.map(notice => [notice.id, notice]));
    current.forEach(notice => byId.set(notice.id, notice));
    return [...byId.values()].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [current, history]);
}

function subscribeHistory(callback: () => void) {
  window.addEventListener(historyEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(historyEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function noticeHistoryKey(userId: string, area: string, role: string) {
  return "semarnat-notice-history-" + JSON.stringify([userId,area,role]);
}
