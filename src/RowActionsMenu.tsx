import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export type RowAction = {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
};

export default function RowActionsMenu({
  label,
  actions,
  width = 192,
}: {
  label: string;
  actions: RowAction[];
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const menuHeight = actions.length * 36 + 12;
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow >= menuHeight + margin || roomBelow >= rect.top
      ? Math.min(rect.bottom + 5, window.innerHeight - margin - Math.min(menuHeight, window.innerHeight - margin * 2))
      : Math.max(margin, rect.top - menuHeight - 5);
    setPosition({
      top: Math.max(margin, top),
      left: Math.min(
        Math.max(margin, rect.right - width),
        Math.max(margin, window.innerWidth - width - margin),
      ),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!trigger.current?.contains(node) && !menu.current?.contains(node)) {
        setOpen(false);
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const dismissOnMovement = () => setOpen(false);
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    window.addEventListener("scroll", dismissOnMovement, true);
    window.addEventListener("resize", dismissOnMovement);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissEscape);
      window.removeEventListener("scroll", dismissOnMovement, true);
      window.removeEventListener("resize", dismissOnMovement);
    };
  }, [open]);

  if (!actions.length) return null;
  return (
    <div className="record-actions">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && createPortal(
        <div
          ref={menu}
          className="record-actions__menu record-actions__menu--floating"
          role="menu"
          aria-label={label}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width,
            maxHeight: "calc(100vh - 16px)",
            overflowY: "auto",
            zIndex: 1200,
          }}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              role="menuitem"
              className={action.danger ? "danger-text" : undefined}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
