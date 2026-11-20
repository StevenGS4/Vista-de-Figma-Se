import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

type Confirmation = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
};
type PendingConfirmation = Confirmation & { resolve: (confirmed: boolean) => void };

export function useConfirmAction() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const current = useRef<PendingConfirmation | null>(null);
  const close = (confirmed: boolean) => {
    const action = current.current;
    current.current = null;
    setPending(null);
    action?.resolve(confirmed);
  };
  const confirm = (options: Confirmation): Promise<boolean> => new Promise(resolve => {
    if (current.current) current.current.resolve(false);
    const next = { ...options, resolve };
    current.current = next;
    setPending(next);
  });

  useEffect(() => () => {
    current.current?.resolve(false);
    current.current = null;
  }, []);

  useEffect(() => {
    if (!pending) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [pending]);

  const dialog = pending && createPortal(
    <div className="archive-confirm-overlay" role="presentation">
      <section className="archive-confirm-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="archive-confirm-heading" aria-describedby="archive-confirm-desc">
        <div className="archive-confirm-dialog__top">
          <span className="archive-confirm-dialog__icon"><AlertTriangle size={23}/></span>
          <button type="button" className="archive-confirm-dialog__close"
            aria-label="Cerrar confirmación" onClick={() => close(false)}><X size={20}/></button>
        </div>
        <h3 id="archive-confirm-heading">{pending.title}</h3>
        <p id="archive-confirm-desc">{pending.message}</p>
        <div className="archive-confirm-dialog__buttons">
          <button type="button" className="button button--secondary" onClick={() => close(false)}
            autoFocus>Cancelar</button>
          <button type="button" className={pending.danger ? "button archive-confirm-dialog__danger" : "button button--primary"}
            onClick={() => close(true)}>{pending.confirmText || "Confirmar"}</button>
        </div>
      </section>
    </div>, document.body
  );
  return { confirm, dialog };
}
