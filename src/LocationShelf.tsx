import { Box, Warehouse } from "lucide-react";

export default function LocationShelf({ level, section }: { level: string; section: string }) {
  return (
    <div className="shelf-diagram">
      <div className="shelf-diagram__heading">
        <Warehouse size={18} />
        <span>
          <strong>Esquema del estante</strong>
          <small>Nivel 4 arriba · Nivel 1 abajo</small>
        </span>
      </div>
      <div className="shelf-diagram__columns">
        <span />
        {[1, 2, 3, 4].map((item) => (
          <b key={item}>Sección {item}</b>
        ))}
      </div>
      <div className="shelf-diagram__grid">
        {[4, 3, 2, 1].map((levelItem) => (
          <div className="shelf-row" key={levelItem}>
            <strong>N{levelItem}</strong>
            {[1, 2, 3, 4].map((sectionItem) => (
              <span
                className={
                  level === String(levelItem) && section === String(sectionItem)
                    ? "is-selected"
                    : ""
                }
                key={sectionItem}
              >
                {level === String(levelItem) && section === String(sectionItem) && (
                  <Box size={16} />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="shelf-diagram__axis">
        <span>← Izquierda</span>
        <span>Derecha →</span>
      </div>
    </div>
  );
}
