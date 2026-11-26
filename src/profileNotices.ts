import { useCallback, useEffect, useState } from "react";
import { homeApi, type StoredNotice } from "./api";
import type { Role } from "./data";

export type ProfileNotice = StoredNotice;
const noticeRead = "semarnat-notice-reviewed";
const migrations = new Map<string, Promise<string[]>>();

async function migrateLegacyReads(userId: string, role: Role, roles: Role[], notices: StoredNotice[]) {
  const key = "semarnat-notices-read-" + userId;
  const prefix = 'semarnat-notice-history-["' + userId + '",';
  let raw: string | null;
  try { raw = window.localStorage.getItem(key); } catch { return []; }
  let ids: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) ids = [...new Set(parsed.filter((id): id is string => typeof id === "string"))];
  } catch { /* No hay marcas válidas que recuperar. */ }
  const migrated = new Set<string>();
  if (ids.length) {
    for (const assigned of new Set([role,...roles])) {
      const available = new Set((assigned === role ? notices : await homeApi.notifications(assigned)).map(notice => notice.id));
      const visible = ids.filter(id => available.has(id));
      for (let start = 0; start < visible.length; start += 250)
        await homeApi.markNoticesRead(assigned,visible.slice(start,start + 250));
      visible.forEach(id => migrated.add(id));
    }
  }
  try {
    window.localStorage.removeItem(key);
    for (const candidate of Object.keys(window.localStorage))
      if (candidate.startsWith(prefix)) window.localStorage.removeItem(candidate);
  } catch { /* El sistema ya conserva en MySQL las marcas recuperadas. */ }
  return [...migrated];
}

export function useProfileNotices(userId: string, role: Role, roles: Role[], enabled = true) {
  const scope = userId + "|" + role;
  const [source, setSource] = useState<{scope:string;notices:StoredNotice[]}>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{userId: string; ids: string[]}>).detail;
      if (detail?.userId !== userId) return;
      const ids = new Set(detail.ids);
      setSource(current => current && {...current,notices:current.notices.map(notice => ids.has(notice.id) ? {...notice,read:true} : notice)});
      setRevision(value => value + 1);
    };
    window.addEventListener(noticeRead, onRead);
    return () => window.removeEventListener(noticeRead, onRead);
  }, [enabled,userId]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let fetching = false;
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const items = await homeApi.notifications(role);
        if (!active) return;
        let migration = migrations.get(userId);
        if (!migration) {
          migration = migrateLegacyReads(userId,role,roles,items).catch(error => {
            migrations.delete(userId);
            throw error;
          });
          migrations.set(userId,migration);
        }
        const migrated = new Set(await migration);
        if (!active) return;
        const notices = items.map(notice => migrated.has(notice.id) ? {...notice,read:true} : notice)
          .sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        setSource({scope,notices});
        setError("");
      } catch {
        if (active) setError("No se pudieron consultar tus notificaciones.");
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh,30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [enabled,userId,role,roles,scope,revision]);

  const markRead = async (id: string) => {
    try {
      await homeApi.markNoticesRead(role,[id]);
      window.dispatchEvent(new CustomEvent(noticeRead,{detail:{userId,ids:[id]}}));
      setError("");
      return true;
    } catch {
      setError("No se pudo guardar el estado de lectura. Inténtalo de nuevo.");
      return false;
    }
  };
  return { notices:source?.scope===scope?source.notices:[], loading, error, markRead, reload };
}
