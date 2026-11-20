import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Download } from "lucide-react";
import type { Role } from "./data";
import { manualFor } from "./userManualContent";
import "./userManual.css";

export default function UserManualPanel({ role, modules, permissions, onClose }: {
  role: Role;
  modules: readonly string[];
  permissions: readonly string[];
  onClose: () => void;
}) {
  const sections = manualFor(role, modules, permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, []);

  async function download() {
    setBusy(true);
    setError("");
    try {
      const { buildManualPdf } = await import("./userManualPdf");
      const fileRole = role.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
      buildManualPdf(role, sections).save("Manual_SEMARNAT_" + fileRole + ".pdf");
    } catch {
      setError("No se pudo generar el PDF. Intenta descargarlo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="user-manual" id="user-manual" aria-labelledby="user-manual-title">
      <button type="button" className="text-button" onClick={onClose}>
        <ArrowLeft size={17} /> Volver al módulo
      </button>
      <div className="surface user-manual__hero">
        <span className="transfer-detail-hero__icon"><BookOpen size={24} aria-hidden="true" /></span>
        <div>
          <h2 id="user-manual-title" ref={title} tabIndex={-1}>Manual de usuario</h2>
          <p>{role}</p>
        </div>
        <button type="button" className="button button--primary" disabled={busy} onClick={() => void download()}>
          <Download size={16} />{busy ? "Generando PDF…" : "Descargar PDF"}
        </button>
      </div>
      {error && <p className="inline-notice" role="alert">{error}</p>}
      <div className="user-manual__layout">
        <nav className="surface user-manual__index" aria-label="Índice del manual">
          <h3>Contenido</h3>
          <ul>{sections.map(section => <li key={section.id}>
            <button type="button" onClick={() => {
              const target = document.getElementById("manual-" + section.id);
              target?.scrollIntoView({ block: "start" });
              target?.querySelector("h3")?.focus({ preventScroll: true });
            }}>{section.title}</button>
          </li>)}</ul>
        </nav>
        <div className="user-manual__sections">
          {sections.map(section => <section key={section.id} id={"manual-" + section.id} className="surface user-manual__section">
            <h3 tabIndex={-1}>{section.title}</h3>
            <ol>{section.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
          </section>)}
        </div>
      </div>
    </article>
  );
}
