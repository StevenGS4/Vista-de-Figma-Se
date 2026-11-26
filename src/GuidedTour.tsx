import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";
import { actionDescription, cleanText, contextDescription, fieldDescription, filterDescription, homeTour, moduleTour } from "./guidedTourContent";
import "./guidedTour.css";

type Step = { target: HTMLElement | null; title: string; description: string };
type Rect = { top: number; left: number; width: number; height: number };

function isVisible(node: HTMLElement) {
  if (!node.isConnected || node.closest('[aria-hidden="true"],[hidden],dialog:not([open])')) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility === "visible";
}

function collectSteps(module: string): Step[] {
  const steps: Step[] = [];
  const used = new Set<HTMLElement>();
  const add = (target: HTMLElement | null, title: string, description: string) => {
    if (!title || !description || (target && (used.has(target) || !isVisible(target)))) return;
    if (target) used.add(target);
    steps.push({ target, title, description });
  };

  const modals = [...document.querySelectorAll<HTMLElement>(
    'dialog[open]:not(.guided-tour), .modal-backdrop > .modal, .archive-confirm-dialog, [role="dialog"][aria-modal="true"]'
  )].filter(isVisible);
  const modal = modals.at(-1);
  if (module === "inicio" && !modal) {
    for (const [selector, title, description] of homeTour) {
      const nodes = [...document.querySelectorAll<HTMLElement>(selector)];
      const visible = nodes.filter(node => isVisible(node) && node.getBoundingClientRect().right > 0);
      if (selector === ".sidebar__nav button") {
        for (const node of visible) {
          const label = cleanText(node.textContent) || node.title || node.getAttribute("aria-label") || title;
          const moduleHelp = moduleTour[node.dataset.tourModule ?? ""]?.[1];
          add(node, label, moduleHelp ?? description);
        }
      } else if (visible[0]) add(visible[0], title, description);
    }
    return steps;
  }

  const root = modal ?? document.querySelector<HTMLElement>(".workspace");
  if (!root) return steps;
  const heading = (!modal && [...root.querySelectorAll<HTMLElement>(".step-heading h3")].find(isVisible))
    || [...root.querySelectorAll<HTMLElement>("h2,h3")].find(isVisible);
  const [title, description] = moduleTour[module] ?? ["Ayuda de la pantalla", "Revisa el encabezado para identificar el registro que tienes abierto. El recorrido señala los campos y acciones visibles. Avanza para entender qué dato se usa en cada control y regresa a la pantalla cuando estés listo para capturarlo. Puedes abrir la ayuda de nuevo en el paso siguiente."];
  const headingText = cleanText(heading?.textContent);
  const stepHeading = heading?.closest<HTMLElement>(".step-heading");
  const stepDescription = cleanText(stepHeading?.querySelector("p")?.textContent);
  const screenDescription = contextDescription(headingText) || actionDescription(headingText)?.[1]
    || (stepDescription ? `${stepDescription} Revisa el folio y los datos que aparecen en este paso antes de continuar. Los siguientes puntos explican qué debes verificar en los campos y cómo se usa lo que captures. Si necesitas revisar otro paso, cierra la ayuda y ábrela de nuevo en esa pantalla.` : description);
  add(stepHeading ?? heading ?? root, headingText || title, screenDescription);

  const picker = root.querySelector<HTMLElement>(".record-selector-strip,.inventory-expedients__toolbar");
  if (picker) add(picker, "Expediente en edición", "Elige la ficha que quieres revisar por su número o posición en el inventario. Los campos de abajo corresponden a la ficha seleccionada. Antes de cambiar de expediente, identifica cuál estás editando y coteja sus datos en el resumen para evitar capturar información en la fila equivocada.");
  for (const option of root.querySelectorAll<HTMLElement>(".inventory-type-card")) {
    const label = cleanText(option.querySelector("h3")?.textContent);
    const help = /concentrado|primaria/i.test(label)
      ? "Abre el Concentrado documental para reunir expedientes específicos en una sola hoja Excel. Filtra por etapa, sección y serie, abre cada grupo y selecciona los expedientes individuales. Comprueba en la vista previa que estén todos los que quieres incluir antes de descargar."
      : /concentraci/i.test(label)
        ? "Genera un inventario por serie con los expedientes que se resguardan en Concentración. Elige la sección, la serie y el periodo. Si el trabajo requiere conocer dónde está cada expediente, marca Incluir ubicación física. Comprueba las columnas y el total en la vista previa."
        : "Genera el inventario de Trámite por serie documental. Selecciona sección y serie, acota el periodo por fecha de apertura y agrega los filtros de área o usuario que correspondan. Revisa la vista previa, en especial el encabezado y el número de expedientes, antes de descargar la plantilla en Excel.";
    add(option, label, help);
  }

  const seenLabels = new Set<string>();
  for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:not([type="hidden"]),select,textarea')) {
    if (!isVisible(input)) continue;
    const label = input.labels?.[0] ?? input.closest<HTMLElement>("label,.form-field");
    const labelText = label && (cleanText(label.querySelector(":scope > span")?.textContent)
      || [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" "));
    const text = cleanText(input.getAttribute("aria-label") || labelText || input.getAttribute("placeholder")).replace(/\s*\*$/, "");
    const key = text.replace(/^(seleccionar expediente|transferir expediente|recibido|estado de) .+/i, "$1");
    if (!text || seenLabels.has(key)) continue;
    seenLabels.add(key);
    const isFilter = input.matches('[type="search"]') || /^(filtrar|buscar)/i.test(text)
      || Boolean(input.closest('.records-filters,.concentration-filters,.table-filters,[class*="filterbar"],[class*="__filters"]'));
    const target = label && isVisible(label) && root.contains(label) ? label : input;
    add(target, text, isFilter ? filterDescription(text) : fieldDescription(text, input));
  }

  for (const node of root.querySelectorAll<HTMLElement>("h3, h2")) {
    if (node === heading) continue;
    const text = cleanText(node.textContent);
    const help = contextDescription(text);
    if (help) add(node, text, help);
  }

  const tabs = [...root.querySelectorAll<HTMLElement>('[role="tab"],.transfer-tabs button,.primary-builder__tabs button,nav[aria-label="Detalle de la transferencia"] button')].filter(isVisible);
  for (const tab of tabs) {
    const label = cleanText(tab.textContent);
    const name = label.replace(/^\d+\.\s*/, "").replace(/\s+\d+$/, "");
    add(tab, label, contextDescription(name) ?? `Abre «${name}» para consultar la parte del registro que indica su nombre. Revisa qué información cambia al seleccionarla. Las pestañas pueden mostrar estados de una bandeja, evidencias de un folio o pasos de preparación. Si necesitas modificar datos, busca la acción del registro dentro de la vista correspondiente.`);
  }

  for (const table of root.querySelectorAll<HTMLElement>("table")) {
    const head = table.querySelector<HTMLElement>("thead") ?? table;
    const columns = [...head.querySelectorAll("th")].map(node => cleanText(node.textContent)).filter(Boolean);
    if (!columns.length) continue;
    add(head, "Columnas del listado", `Las columnas describen los datos de la tabla: ${columns.join(", ")}. Recorre la fila de izquierda a derecha y coteja sus identificadores antes de abrirla. Si hay una columna de estado o acciones, usa el folio para asegurarte de que consultas el registro correcto.`);
  }

  const seenActions = new Set<string>();
  for (const button of root.querySelectorAll<HTMLElement>('button,a[download],a[aria-label^="Descargar"]')) {
    if (!isVisible(button) || used.has(button) || button.closest(".wizard-progress,.guided-tour-help")) continue;
    const label = cleanText(button.getAttribute("aria-label") || button.textContent || button.title);
    const action = actionDescription(label);
    if (!label || !action) continue;
    const [pattern, help] = action;
    const key = button.closest("tbody") ? pattern.source
      : label.replace(/^(Quitar selección de|Quitar|Ver ubicación de|Ocultar ubicación de|Acciones (?:del|para)) .+/i, "$1");
    if (seenActions.has(key)) continue;
    seenActions.add(key);
    add(button, /^acciones/i.test(label) ? "Acciones por fila" : label, help);
  }
  return steps;
}

export default function GuidedTour({ module }: { module: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [nativeModal, setNativeModal] = useState<HTMLDialogElement | null>(null);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [position, setPosition] = useState({ top: 16, left: 16 });
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = steps[index];
  const isOpen = Boolean(active);

  useEffect(() => {
    const trackModal = () => {
      const open = [...document.querySelectorAll<HTMLDialogElement>("dialog[open]:not(.guided-tour)")].filter(isVisible);
      setNativeModal(open.at(-1) ?? null);
    };
    const observer = new MutationObserver(trackModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    trackModal();
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const layer = dialog.current;
    if (layer && !layer.open) layer.showModal();
    return () => { if (layer?.open) layer.close(); };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!active) return;
    const target = active.target;
    target?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "instant" });
    heading.current?.focus({ preventScroll: true });

    function measure() {
      if (!card.current) return;
      const margin = 12;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const box = card.current.getBoundingClientRect();
      const bounds = target && isVisible(target) ? target.getBoundingClientRect() : null;
      const left = bounds ? Math.max(margin, bounds.left - 6) : 0;
      const top = bounds ? Math.max(margin, bounds.top - 6) : 0;
      const right = bounds ? Math.min(width - margin, bounds.right + 6) : 0;
      const bottom = bounds ? Math.min(height - margin, bounds.bottom + 6) : 0;
      const focus = right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
      setSpot(focus);
      const clampX = (x: number) => Math.max(margin, Math.min(x, width - box.width - margin));
      const clampY = (y: number) => Math.max(margin, Math.min(y, height - box.height - margin));
      if (!focus) setPosition({ left: clampX((width - box.width) / 2), top: clampY((height - box.height) / 2) });
      else if (bottom + box.height + margin * 2 <= height) setPosition({ left: clampX(left), top: bottom + margin });
      else if (top >= box.height + margin * 2) setPosition({ left: clampX(left), top: top - box.height - margin });
      else if (right + box.width + margin * 2 <= width) setPosition({ left: right + margin, top: clampY(top) });
      else if (left >= box.width + margin * 2) setPosition({ left: left - box.width - margin, top: clampY(top) });
      else setPosition({ left: clampX(width - box.width - margin), top: clampY(height - box.height - margin) });
    }

    measure();
    const observer = new ResizeObserver(measure);
    if (target) observer.observe(target);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active]);

  const close = () => { dialog.current?.close(); setSteps([]); };
  const start = () => {
    const available = collectSteps(module);
    setIndex(0);
    setSteps(available.length ? available : [{
      target: null, title: "Ayuda de la pantalla", description: "Espera a que el panel termine de cargar y vuelve a abrir la ayuda.",
    }]);
  };

  const helpButton = (
    <button type="button" className="guided-tour-help" title="Ayuda guiada" aria-label="Abrir ayuda guiada" onClick={start}>
      <CircleHelp size={22} aria-hidden="true" />
    </button>
  );

  return (
    <>
      {nativeModal ? createPortal(helpButton, nativeModal) : helpButton}
      {active && createPortal(
        <dialog ref={dialog} className="guided-tour" aria-labelledby="guided-tour-title" aria-describedby="guided-tour-description"
          onCancel={event => { event.preventDefault(); close(); }}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setIndex(current => Math.max(0, Math.min(steps.length - 1, current + (event.key === "ArrowRight" ? 1 : -1))));
          }}>
          {spot ? <div className="guided-tour__spot" style={spot} aria-hidden="true" />
            : <div className="guided-tour__shade" aria-hidden="true" />}
          <div className="guided-tour__card" ref={card} style={position}>
            <button type="button" className="icon-action guided-tour__close" aria-label="Cerrar recorrido" onClick={close}>
              <X size={18} />
            </button>
            <p className="guided-tour__count">Paso {index + 1} de {steps.length}</p>
            <h2 id="guided-tour-title" ref={heading} tabIndex={-1}>{active.title}</h2>
            <p key={index} id="guided-tour-description">{active.description}</p>
            <div className="guided-tour__dots" aria-hidden="true">
              {steps.map((_, step) => <span key={step} data-status={step === index ? "current" : step < index ? "previous" : "pending"} />)}
            </div>
            <div className="guided-tour__navigation">
              <button type="button" className="button button--secondary" disabled={index === 0}
                onClick={() => setIndex(index - 1)}><ChevronLeft size={17} />Anterior</button>
              <button type="button" className="button button--primary" onClick={() => {
                if (index + 1 === steps.length) close();
                else setIndex(index + 1);
              }}>{index + 1 === steps.length ? "Finalizar" : "Siguiente"}<ChevronRight size={17} /></button>
            </div>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
