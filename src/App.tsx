import { FormEvent, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { authApi, usersApi, tramiteApi, transferApi, concentrationApi, loanApi } from "./api";
import {
  Archive,
  ArrowRight,
  Bell,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileClock,
  FilePlus2,
  Files,
  FolderArchive,
  Home,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  Role,
  UserRecord,
  areaName,
  fullName,
  initialRolePermissions,
  initials,
} from "./data";
import { ArchivalRecord, setCadidoCatalog } from "./records";
import { ArchivalLoan } from "./loans";
import { DocumentaryTransfer } from "./transfers";

const AdminPanel = lazy(() => import("./AdminPanel"));
const ConcentrationPanel = lazy(() => import("./ConcentrationPanel"));
const InventoriesPanel = lazy(() => import("./InventoriesPanel"));
const LoansPanel = lazy(() => import("./LoansPanel"));
const RecordsPanel = lazy(() => import("./RecordsPanel"));
const TransfersPanel = lazy(() => import("./TransfersPanel"));

type ModuleId =
  | "inicio"
  | "tramite"
  | "concentracion"
  | "transferencias"
  | "prestamos"
  | "inventarios"
  | "administracion";

const roleAccess: Record<ModuleId, Role[]> = {
  inicio: [
    "Personal de área",
    "Encargado de área",
    "Encargado de préstamos / Control archivístico",
    "Administrador / Coordinador",
  ],
  tramite: ["Personal de área", "Encargado de área", "Administrador / Coordinador"],
  concentracion: [
    "Personal de área",
    "Encargado de área",
    "Encargado de préstamos / Control archivístico",
    "Administrador / Coordinador",
  ],
  transferencias: [
    "Personal de área",
    "Encargado de área",
    "Administrador / Coordinador",
  ],
  prestamos: ["Encargado de préstamos / Control archivístico", "Administrador / Coordinador"],
  inventarios: [
    "Personal de área",
    "Encargado de área",
    "Encargado de préstamos / Control archivístico",
    "Administrador / Coordinador",
  ],
  administracion: ["Administrador / Coordinador"],
};

const modules = {
  inicio: {
    label: "Inicio",
    short: "Inicio",
    description: "Resumen de actividad, pendientes y accesos autorizados.",
    icon: Home,
  },
  tramite: {
    label: "Archivo de trámite",
    short: "Archivo de trámite",
    description: "Registro, consulta y seguimiento de expedientes activos por área.",
    icon: Files,
  },
  concentracion: {
    label: "Archivo de concentración",
    short: "Concentración",
    description: "Consulta de expedientes transferidos y control de ubicación física.",
    icon: Archive,
  },
  transferencias: {
    label: "Transferencias documentales",
    short: "Transferencias",
    description: "Preparación, revisión y seguimiento de transferencias primarias.",
    icon: FolderArchive,
  },
  prestamos: {
    label: "Préstamos y devoluciones",
    short: "Préstamos",
    description: "Control de salida, disponibilidad y devolución de expedientes.",
    icon: BriefcaseBusiness,
  },
  inventarios: {
    label: "Inventarios Excel",
    short: "Inventarios Excel",
    description: "Generación de inventarios con la información archivística registrada.",
    icon: Download,
  },
  administracion: {
    label: "Administración",
    short: "Administración",
    description: "Gestión de usuarios, áreas, roles y permisos autorizados.",
    icon: Users,
  },
} satisfies Record<
  ModuleId,
  {
    label: string;
    short: string;
    description: string;
    icon: React.ComponentType<{ size?: number }>;
  }
>;

const moduleOrder = Object.keys(modules) as ModuleId[];

function hasModulePermission(id: ModuleId, role: Role, permissions: string[]) {
  if (id === "inicio") return true;
  if (id === "tramite" || id === "concentracion") return permissions.includes("view-records");
  if (id === "transferencias") {
    if (role === "Personal de área") return permissions.includes("prepare-transfers");
    if (role === "Encargado de área") return permissions.includes("approve-area-transfers");
    if (role === "Administrador / Coordinador")
      return permissions.includes("review-transfers") || permissions.includes("accept-transfers");
    return false;
  }
  if (id === "prestamos")
    return permissions.includes("register-loans") || permissions.includes("register-returns");
  if (id === "inventarios") return permissions.includes("download-inventories");
  return permissions.includes("manage-users");
}

function InstitutionalMarks({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`institutional-marks ${inverse ? "institutional-marks--inverse" : ""}`}>
      <div
        aria-label="Espacio reservado para logotipo oficial del Gobierno de México"
        className="mark-slot"
      >
        <span>LOGOTIPO OFICIAL</span>
        <small>GOBIERNO DE MÉXICO</small>
      </div>
      <span className="mark-divider" />
      <div aria-label="Espacio reservado para logotipo oficial de SEMARNAT" className="mark-slot">
        <span>LOGOTIPO OFICIAL</span>
        <small>SEMARNAT</small>
      </div>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: UserRecord) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Completa el correo electrónico y la contraseña.");
      return;
    }
    setLoading(true);
    try {
      const user = await authApi.login(email.trim().toLowerCase(), password);
      setPassword("");
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login">
      <div className="institutional-line">
        <span />
        <span />
        <span />
      </div>
      <header className="login__header">
        <InstitutionalMarks />
        <div className="login__header-meta">
          <ShieldCheck size={17} />
          Sistema institucional de demostración
        </div>
      </header>

      <div className="login__main">
        <section className="login__identity">
          <div className="login__identity-inner">
            <span className="section-kicker">Gestión documental institucional</span>
            <h1>Sistema de Control Archivístico</h1>
            <p className="login__office">Oficina de Representación de SEMARNAT en Nayarit</p>
            <p className="login__description">
              Herramienta interna para registrar, organizar y dar seguimiento al ciclo de vida de
              los expedientes institucionales.
            </p>
            <div className="login__features">
              <div>
                <FileCheck2 size={19} />
                <span>
                  <strong>Control documental</strong>
                  <small>Expedientes y clasificación CADIDO</small>
                </span>
              </div>
              <div>
                <ShieldCheck size={19} />
                <span>
                  <strong>Acceso por permisos</strong>
                  <small>Información según área y rol autorizado</small>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="login__access">
          <div className="login-card">
            <div className="login-card__heading">
              <span className="login-card__icon">
                <LockKeyhole size={21} />
              </span>
              <div>
                <h2>Acceso al sistema</h2>
                <p>Ingresa tus credenciales institucionales</p>
              </div>
            </div>
            <form onSubmit={submit} noValidate>
              <label className="input-field">
                <span>Correo electrónico</span>
                <div className="input-control">
                  <Mail size={18} />
                  <input
                    autoComplete="email"
                    disabled={loading}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@semarnat.gob.mx"
                    type="email"
                    value={email}
                  />
                </div>
              </label>
              <label className="input-field">
                <span>Contraseña</span>
                <div className="input-control">
                  <KeyRound size={18} />
                  <input
                    autoComplete="current-password"
                    disabled={loading}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Ingresa tu contraseña"
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {error && (
                <div className="login-error" role="alert">
                  <CircleAlert size={17} />
                  {error}
                </div>
              )}
              <button className="login-submit" disabled={loading} type="submit">
                {loading ? <span className="loader" /> : <LockKeyhole size={17} />}
                {loading ? "Verificando acceso…" : "Iniciar sesión"}
              </button>
            </form>
            <div className="restricted-note">
              <ShieldCheck size={16} />
              <span>
                <strong>Acceso restringido</strong>
                Exclusivo para personal autorizado.
              </span>
            </div>
          </div>

          <div className="demo-access">
            <div className="demo-access__heading">
              <div>
                <strong>Acceso institucional</strong>
                <span>Utiliza una cuenta creada por la administración. Las contraseñas se verifican en el servidor.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="login__footer">
        <span>SEMARNAT Nayarit · Versión académica</span>
        <span>La información mostrada es ficticia y de uso demostrativo.</span>
      </footer>
    </main>
  );
}

function MandatoryPasswordChange({
  onComplete,
  user,
}: {
  onComplete: (current: string, next: string) => Promise<void>;
  user: UserRecord;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !next || !confirm) return setError("Todos los campos son obligatorios.");
    if (next === current) return setError("La nueva contraseña debe ser diferente de la anterior.");
    if (next !== confirm) return setError("La nueva contraseña y su confirmación no coinciden.");
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next))
      return setError("Utiliza al menos 8 caracteres, mayúscula, minúscula y número.");
    try { await onComplete(current,next); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo actualizar la contraseña."); }
  };
  return (
    <div className="modal-backdrop mandatory-password-backdrop" role="dialog" aria-modal="true">
      <form className="modal mandatory-password-modal" onSubmit={submit}>
        <div className="modal__header">
          <div>
            <span>Primer acceso</span>
            <h2>Cambio de contraseña obligatorio</h2>
          </div>
          <KeyRound size={22} />
        </div>
        <div className="modal__body">
          <p className="modal__intro">
            Por seguridad, debes establecer una contraseña personal antes de continuar utilizando el
            sistema.
          </p>
          <label className="form-field">
            <span>
              Contraseña actual o temporal<b>*</b>
            </span>
            <input
              autoFocus
              onChange={(event) => {
                setCurrent(event.target.value);
                setError("");
              }}
              type="password"
              value={current}
            />
          </label>
          <label className="form-field">
            <span>
              Nueva contraseña<b>*</b>
            </span>
            <input
              onChange={(event) => {
                setNext(event.target.value);
                setError("");
              }}
              type="password"
              value={next}
            />
            <small className="field-hint">
              Mínimo 8 caracteres, mayúscula, minúscula y número.
            </small>
          </label>
          <label className="form-field">
            <span>
              Confirmar nueva contraseña<b>*</b>
            </span>
            <input
              onChange={(event) => {
                setConfirm(event.target.value);
                setError("");
              }}
              type="password"
              value={confirm}
            />
          </label>
          {error && (
            <div className="validation-summary" role="alert">
              <CircleAlert size={17} />
              {error}
            </div>
          )}
          <div className="inline-notice">
            <ShieldCheck size={18} />
            <span>
              <strong>Protección de cuenta.</strong> La validación se realiza en Node.js y la contraseña se almacena mediante hash en MySQL.
            </span>
          </div>
        </div>
        <div className="modal__footer">
          <button className="button button--primary" type="submit">
            <KeyRound size={17} />
            Actualizar contraseña
          </button>
        </div>
      </form>
    </div>
  );
}

function VoluntaryPasswordChange({
  onCancel,
  onComplete,
  user,
}: {
  onCancel: () => void;
  onComplete: (current: string, next: string) => Promise<void>;
  user: UserRecord;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !next || !confirm) return setError("Todos los campos son obligatorios.");
    if (next === current) return setError("La nueva contraseña debe ser diferente de la actual.");
    if (next !== confirm) return setError("La nueva contraseña y su confirmación no coinciden.");
    if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next))
      return setError("Utiliza al menos 8 caracteres, mayúscula, minúscula y número.");
    try { await onComplete(current,next); }
    catch (error) { setError(error instanceof Error ? error.message : "No se pudo actualizar la contraseña."); }
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal mandatory-password-modal" onSubmit={submit}>
        <div className="modal__header">
          <div><span>Perfil de usuario</span><h2>Cambiar contraseña</h2></div>
          <button aria-label="Cerrar" className="icon-action" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__intro">
            Actualiza voluntariamente tu contraseña. Este cambio no reactiva el primer acceso.
          </p>
          <label className="form-field"><span>Contraseña actual<b>*</b></span>
            <input autoFocus onChange={(event) => setCurrent(event.target.value)} type="password" />
          </label>
          <label className="form-field"><span>Nueva contraseña<b>*</b></span>
            <input onChange={(event) => setNext(event.target.value)} type="password" />
            <small className="field-hint">Mínimo 8 caracteres, mayúscula, minúscula y número.</small>
          </label>
          <label className="form-field"><span>Confirmar nueva contraseña<b>*</b></span>
            <input onChange={(event) => setConfirm(event.target.value)} type="password" />
          </label>
          {error && <div className="validation-summary" role="alert"><CircleAlert size={17} />{error}</div>}
        </div>
        <div className="modal__footer">
          <button className="button button--secondary" onClick={onCancel} type="button">Cancelar</button>
          <button className="button button--primary" type="submit"><KeyRound size={17} />Actualizar contraseña</button>
        </div>
      </form>
    </div>
  );
}

function Sidebar({
  active,
  allowed,
  collapsed,
  mobileOpen,
  onCollapse,
  onLogout,
  onMobileClose,
  onNavigate,
}: {
  active: ModuleId;
  allowed: ModuleId[];
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onLogout: () => void;
  onMobileClose: () => void;
  onNavigate: (id: ModuleId) => void;
}) {
  return (
    <>
      {mobileOpen && (
        <button aria-label="Cerrar navegación" className="nav-overlay" onClick={onMobileClose} />
      )}
      <aside
        className={`sidebar ${collapsed ? "sidebar--collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}
      >
        <div className="sidebar__top">
          <div className="sidebar__monogram">SCA</div>
          {!collapsed && (
            <div className="sidebar__title">
              <strong>Control Archivístico</strong>
              <span>SEMARNAT Nayarit</span>
            </div>
          )}
          <button
            aria-label="Cerrar navegación"
            className="sidebar__mobile-close"
            onClick={onMobileClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar__institution">
          {!collapsed ? (
            <InstitutionalMarks inverse />
          ) : (
            <span title="Oficina de Representación en Nayarit">NAY</span>
          )}
        </div>
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {!collapsed && <span className="nav-section-label">MENÚ PRINCIPAL</span>}
          {allowed.map((id) => {
            const item = modules[id];
            const ItemIcon = item.icon;
            return (
              <button
                className={active === id ? "is-active" : ""}
                key={id}
                onClick={() => {
                  onNavigate(id);
                  onMobileClose();
                }}
                title={collapsed ? item.short : undefined}
              >
                <ItemIcon size={19} />
                {!collapsed && <span>{item.short}</span>}
                {active === id && !collapsed && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar__bottom">
          <button onClick={onLogout} title={collapsed ? "Cerrar sesión" : undefined}>
            <LogOut size={18} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
          <button
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="collapse-button"
            onClick={onCollapse}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>Contraer menú</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function Header({
  active,
  onChangePassword,
  onLogout,
  onMenu,
  onRoleChange,
  role,
  user,
}: {
  active: ModuleId;
  onChangePassword: () => void;
  onLogout: () => void;
  onMenu: () => void;
  onRoleChange: (role: Role) => void;
  role: Role;
  user: UserRecord;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return (
    <header className="app-header">
      <button aria-label="Abrir navegación" className="mobile-menu" onClick={onMenu}>
        <Menu size={21} />
      </button>
      <div className="app-header__page">
        <h1>{modules[active].label}</h1>
        <div>
          <span>Sistema archivístico</span>
          <ChevronRight size={12} />
          <strong>{modules[active].label}</strong>
        </div>
      </div>
      <div className="app-header__actions">
        <button
          aria-expanded={searchOpen}
          aria-label="Buscar"
          className="header-icon"
          onClick={() => {
            setSearchOpen((current) => !current);
            setNotificationsOpen(false);
          }}
        >
          <Search size={19} />
        </button>
        <button
          aria-expanded={notificationsOpen}
          aria-label="Notificaciones"
          className="header-icon"
          onClick={() => {
            setNotificationsOpen((current) => !current);
            setSearchOpen(false);
          }}
        >
          <Bell size={19} />
          <i />
        </button>
        {searchOpen && (
          <div className="header-popover header-popover--search">
            <strong>Búsqueda rápida</strong>
            <label>
              <Search size={16} />
              <input autoFocus placeholder="Buscar expediente o folio…" />
            </label>
            <small>La búsqueda global se habilitará en una siguiente etapa.</small>
          </div>
        )}
        {notificationsOpen && (
          <div className="header-popover header-popover--notifications">
            <strong>Notificaciones</strong>
            <div>
              <span>
                <FileCheck2 size={16} />
              </span>
              <p>
                <b>Transferencia en revisión</b>
                La solicitud TP-2025-008 tiene actividad reciente.
              </p>
            </div>
            <small>Información de demostración</small>
          </div>
        )}
        <span className="header-divider" />
        <div className="profile-menu">
          <button className="profile-trigger" onClick={() => setProfileOpen((current) => !current)}>
            <span className="profile-avatar">{initials(user)}</span>
            <span className="profile-copy">
              <strong>{fullName(user)}</strong>
              <small>{areaName(user.areaId)}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <div className="profile-popover__head">
                <span className="profile-avatar">{initials(user)}</span>
                <div>
                  <strong>{fullName(user)}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              <div className="profile-popover__section">
                <span>Rol activo</span>
                {user.roles.map((item) => (
                  <button
                    className={role === item ? "is-selected" : ""}
                    key={item}
                    onClick={() => {
                      onRoleChange(item);
                      setProfileOpen(false);
                    }}
                  >
                    <span>{item}</span>
                    {role === item && <Check size={15} />}
                  </button>
                ))}
              </div>
              <button
                className="profile-logout"
                onClick={() => {
                  setProfileOpen(false);
                  onChangePassword();
                }}
              >
                <KeyRound size={17} />
                Cambiar contraseña
              </button>
              <button className="profile-logout" onClick={onLogout}>
                <LogOut size={17} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const activity = [
  {
    icon: FileCheck2,
    title: "Expediente actualizado",
    detail: "SEMARNAT-NAY/UJ/2025/0042",
    meta: "Hace 18 minutos",
    color: "green",
  },
  {
    icon: FolderArchive,
    title: "Transferencia enviada a revisión",
    detail: "Solicitud TP-2025-008 · Unidad Jurídica",
    meta: "Hoy, 10:24",
    color: "wine",
  },
  {
    icon: BriefcaseBusiness,
    title: "Devolución registrada",
    detail: "SEMARNAT-NAY/DA/2021/0189",
    meta: "Ayer, 16:42",
    color: "gold",
  },
];

function Dashboard({
  allowedModules,
  onNavigate,
  role,
}: {
  allowedModules: ModuleId[];
  onNavigate: (id: ModuleId) => void;
  role: Role;
}) {
  const pendingTarget =
    role === "Administrador / Coordinador" && allowedModules.includes("administracion")
      ? "administracion"
      : allowedModules.includes("tramite")
        ? "tramite"
        : allowedModules.includes("transferencias")
          ? "transferencias"
          : null;
  return (
    <div className="dashboard">
      <div className="dashboard-grid dashboard-grid--focused">
        <section className="surface activity-panel">
          <div className="section-heading">
            <div>
              <h2>Actividad reciente</h2>
              <p>Movimientos relacionados con tus permisos.</p>
            </div>
            <span className="demo-label">Datos de demostración</span>
          </div>
          <div className="activity-list">
            {activity.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div className="activity-item" key={item.title}>
                  <span className={`activity-item__icon activity-item__icon--${item.color}`}>
                    <ItemIcon size={17} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <time>
                    <Clock3 size={14} />
                    {item.meta}
                  </time>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="surface pending-panel">
          <div className="section-heading">
            <div>
              <h2>Pendientes operativos</h2>
              <p>Atención sugerida para hoy.</p>
            </div>
          </div>
          <div className="pending-list">
            {!pendingTarget ? (
              <div className="empty-state compact-empty">
                <Check size={26} />
                <strong>Sin pendientes operativos</strong>
                <p>No hay acciones disponibles para este perfil.</p>
              </div>
            ) : (
              <>
                <button onClick={() => onNavigate(pendingTarget)}>
                  <span>03</span>
                  <div>
                    <strong>
                      {role === "Administrador / Coordinador"
                        ? "Cuentas por revisar"
                        : "Expedientes incompletos"}
                    </strong>
                    <small>Requieren validación</small>
                  </div>
                  <ChevronRight size={15} />
                </button>
                <button onClick={() => onNavigate("transferencias")}>
                  <span>02</span>
                  <div>
                    <strong>Transferencias pendientes</strong>
                    <small>En proceso de seguimiento</small>
                  </div>
                  <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

const previewRows: Record<Exclude<ModuleId, "inicio" | "administracion">, string[][]> = {
  tramite: [
    ["SEMARNAT-NAY/UJ/2025/0042", "Unidad Jurídica", "4C.3 — Asuntos jurídicos", "En trámite"],
    ["SEMARNAT-NAY/DA/2025/0018", "Recursos Materiales", "6C.6 — Adquisiciones", "En trámite"],
  ],
  concentracion: [
    ["SEMARNAT-NAY/DA/2021/0189", "E-02 · N-03 · C-14", "2021", "En archivo"],
    ["SEMARNAT-NAY/RH/2020/0071", "E-01 · N-02 · C-06", "2020", "Prestado"],
  ],
  transferencias: [
    ["TP-2025-008", "Unidad Jurídica", "12 jun 2025", "En revisión"],
    ["TP-2025-007", "Recursos Humanos", "09 jun 2025", "Con observaciones"],
  ],
  prestamos: [
    ["SEMARNAT-NAY/RH/2020/0071", "Dirección Administrativa", "20 jun 2025", "Prestado"],
    ["SEMARNAT-NAY/UJ/2019/0104", "Unidad Jurídica", "11 jun 2025", "Devuelto"],
  ],
  inventarios: [
    ["Inventario archivo de trámite", "Unidad Jurídica · 2025", "12 jun 2025", "XLSX"],
    ["Inventario de concentración", "Todas las áreas · 2020–2024", "10 jun 2025", "XLSX"],
  ],
};

function ModulePreview({ id }: { id: Exclude<ModuleId, "inicio" | "administracion"> }) {
  const ItemIcon = modules[id].icon;
  const columns =
    id === "tramite"
      ? ["Código de expediente", "Área", "Clasificación CADIDO", "Estado"]
      : id === "concentracion"
        ? ["Código de expediente", "Ubicación", "Año", "Disponibilidad"]
        : id === "transferencias"
          ? ["Folio", "Área solicitante", "Fecha de envío", "Estado"]
          : id === "prestamos"
            ? ["Expediente", "Solicitante", "Fecha límite", "Estado"]
            : ["Nombre del inventario", "Alcance", "Última generación", "Formato"];
  return (
    <section className="surface module-preview">
      <div className="table-titlebar">
        <div className="module-preview__title">
          <span>
            <ItemIcon size={21} />
          </span>
          <div>
            <h2>Registros recientes</h2>
            <p>Vista preliminar con información ficticia.</p>
          </div>
        </div>
        <span className="demo-label">Datos de demostración</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows[id].map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td key={cell}>
                    {index === row.length - 1 ? (
                      <span className="badge badge--neutral">{cell}</span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="module-placeholder">
        <FileClock size={19} />
        <div>
          <strong>Módulo preparado para la siguiente etapa.</strong>
          <span>Las operaciones completas se incorporarán en los siguientes incrementos.</span>
        </div>
      </div>
    </section>
  );
}

function Application({
  archivalRecords,
  currentUser,
  loans,
  onLogout,
  onChangePassword,
  onLoansChange,
  onRecordsChange,
  onRolePermissionsChange,
  onTransfersChange,
  onUsersChange,
  transfers,
  users,
  rolePermissions,
  recordsLoadError,
}: {
  archivalRecords: ArchivalRecord[];
  recordsLoadError: string;
  currentUser: UserRecord;
  loans: ArchivalLoan[];
  onLogout: () => void;
  onChangePassword: () => void;
  onLoansChange: (loans: ArchivalLoan[]) => void;
  onRecordsChange: (records: ArchivalRecord[]) => void;
  onRolePermissionsChange: (permissions: Record<Role, string[]>) => void;
  onTransfersChange: (transfers: DocumentaryTransfer[]) => void;
  onUsersChange: (users: UserRecord[]) => void;
  transfers: DocumentaryTransfer[];
  users: UserRecord[];
  rolePermissions: Record<Role, string[]>;
}) {
  const [active, setActive] = useState<ModuleId>("inicio");
  const [role, setRole] = useState<Role>(currentUser.roles[0]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPermissions = rolePermissions[role];
  const allowed = useMemo(
    () =>
      moduleOrder.filter(
        (id) => roleAccess[id].includes(role) && hasModulePermission(id, role, currentPermissions),
      ),
    [currentPermissions, role],
  );

  useEffect(() => {
    if (!currentUser.roles.includes(role)) {
      setRole(currentUser.roles[0]);
      setActive("inicio");
      return;
    }
    if (!allowed.includes(active)) setActive("inicio");
  }, [active, allowed, currentUser.roles, role]);

  const navigate = (id: ModuleId) => {
    if (allowed.includes(id)) setActive(id);
  };

  const changeRole = (next: Role) => {
    setRole(next);
    if (!roleAccess[active].includes(next)) setActive("inicio");
  };

  const moduleFallback = (
    <div className="surface module-loading" role="status">
      <span className="loader" />
      Cargando módulo…
    </div>
  );

  return (
    <div className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}>
      <Sidebar
        active={active}
        allowed={allowed}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCollapse={() => setCollapsed((current) => !current)}
        onLogout={onLogout}
        onMobileClose={() => setMobileOpen(false)}
        onNavigate={navigate}
      />
      <div className="app-main">
        <Header
          active={active}
          onChangePassword={onChangePassword}
          onLogout={onLogout}
          onMenu={() => {
            setCollapsed(false);
            setMobileOpen(true);
          }}
          onRoleChange={changeRole}
          role={role}
          user={currentUser}
        />
        <main className="workspace">
          {active !== "tramite" &&
            active !== "concentracion" &&
            active !== "transferencias" &&
            active !== "prestamos" &&
            active !== "inventarios" && (
              <div className="page-intro">
                <div>
                  <h2>{modules[active].label}</h2>
                  <p>{modules[active].description}</p>
                </div>
                {active === "administracion" && (
                  <span className="access-chip">
                    <ShieldCheck size={15} />
                    Acceso de administrador
                  </span>
                )}
              </div>
            )}
          {active === "inicio" ? (
            <Dashboard allowedModules={allowed} onNavigate={navigate} role={role} />
          ) : active === "tramite" ? (
            <Suspense fallback={moduleFallback}>
              <RecordsPanel
                loadError={recordsLoadError}
                onRecordsChange={onRecordsChange}
                records={archivalRecords}
                role={role}
                permissions={currentPermissions}
                protectedRecordIds={
                  new Set(
                    transfers
                      .filter((transfer) => transfer.status !== "Aceptada")
                      .flatMap((transfer) => transfer.recordIds),
                  )
                }
                user={currentUser}
              />
            </Suspense>
          ) : active === "concentracion" ? (
            <Suspense fallback={moduleFallback}>
              <ConcentrationPanel
                currentUser={currentUser}
                onRecordsChange={onRecordsChange}
                records={archivalRecords}
                role={role}
                permissions={currentPermissions}
              />
            </Suspense>
          ) : active === "transferencias" ? (
            <Suspense fallback={moduleFallback}>
              <TransfersPanel
                currentUser={currentUser}
                onRecordsChange={onRecordsChange}
                onTransfersChange={onTransfersChange}
                records={archivalRecords}
                role={role}
                permissions={currentPermissions}
                transfers={transfers}
                users={users}
              />
            </Suspense>
          ) : active === "prestamos" ? (
            <Suspense fallback={moduleFallback}>
              <LoansPanel
                currentUser={currentUser}
                loans={loans}
                onLoansChange={onLoansChange}
                onRecordsChange={onRecordsChange}
                records={archivalRecords}
                role={role}
                permissions={currentPermissions}
              />
            </Suspense>
          ) : active === "inventarios" ? (
            <Suspense fallback={moduleFallback}>
              <InventoriesPanel
                currentUser={currentUser}
                records={archivalRecords}
                role={role}
                transfers={transfers}
              />
            </Suspense>
          ) : active === "administracion" &&
            role === "Administrador / Coordinador" &&
            currentPermissions.includes("manage-users") ? (
            <Suspense fallback={moduleFallback}>
              <AdminPanel
                onRolePermissionsChange={onRolePermissionsChange}
                onUsersChange={onUsersChange}
                rolePermissions={rolePermissions}
                users={users}
              />
            </Suspense>
          ) : (
            <ModulePreview id={active as Exclude<ModuleId, "inicio" | "administracion">} />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [archivalRecords, setArchivalRecords] = useState<ArchivalRecord[]>([]);
  const [recordsLoadError, setRecordsLoadError] = useState("");
  const [loans, setLoans] = useState<ArchivalLoan[]>([]);
  const [transfers, setTransfers] = useState<DocumentaryTransfer[]>([]);
  const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [voluntaryPasswordOpen, setVoluntaryPasswordOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    authApi.me().then((user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setUsers([user]);
    }).catch(() => {
      if (mounted) setCurrentUser(null);
    }).finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!currentUser?.roles.includes("Administrador / Coordinador")) return;
    let active = true;
    usersApi.list().then((list) => { if (active) setUsers(list); }).catch((err) => {
      console.error("No se pudieron cargar los usuarios:",err);
    });
    return () => {active=false;};
  }, [currentUser?.id, currentUser?.roles.join(",")]);

  useEffect(() => {
    if (!currentUser || currentUser.mustChangePassword) return;
    let alive = true;
    setRecordsLoadError("");
    // Trámite solo está disponible para sus roles. Concentración es visible
    // también para control archivístico. Ambas consultas llegan desde MySQL.
    const canTramite = currentUser.roles.some(r=>
      r==="Personal de área" || r==="Encargado de área" || r==="Administrador / Coordinador");
    Promise.all([
      tramiteApi.catalog(),
      canTramite ? tramiteApi.list() : Promise.resolve([] as ArchivalRecord[]),
      concentrationApi.list(),
    ]).then(([catalog, tramite, concentracion]) => {
      if (!alive) return;
      setCadidoCatalog(catalog.sections, catalog.series);
      setArchivalRecords([
        ...tramite.filter(record => record.stage !== "Archivo de concentración"),
        ...concentracion,
      ]);
      setRecordsLoadError("");
    }).catch(error => {
      if (!alive) return;
      setArchivalRecords([]);
      setRecordsLoadError(error instanceof Error ? error.message : "Error consultando archivos en MySQL");
      console.error("Error cargando Trámite o Concentración desde MySQL:",error);
    });
    return () => { alive = false; };
  }, [currentUser?.id, currentUser?.mustChangePassword]);


  useEffect(()=>{
    if(!currentUser||currentUser.mustChangePassword)return;
    if(!currentUser.roles.some(r=>r==="Personal de área"||r==="Encargado de área"||r==="Administrador / Coordinador"))return;
    let active=true;
    transferApi.list().then((list)=>{if(active)setTransfers(list);})
     .catch(error=>{if(active){setTransfers([]);console.error("No fue posible consultar transferencias en MySQL:",error);}});
    return ()=>{active=false;};
  },[currentUser?.id,currentUser?.mustChangePassword]);

  useEffect(()=>{
    if(!currentUser||currentUser.mustChangePassword)return;
    if(!currentUser.roles.some(r=>r==="Encargado de préstamos / Control archivístico"||r==="Administrador / Coordinador"))return;
    let alive=true;
    loanApi.list().then(list=>{if(alive)setLoans(list);})
      .catch(error=>{if(alive){setLoans([]);console.error("No se pudieron cargar préstamos en MySQL:",error);}});
    return ()=>{alive=false;};
  },[currentUser?.id,currentUser?.mustChangePassword]);

  const logout = async () => {
    try { await authApi.logout(); }
    catch (error) { console.error("Error de cierre de sesión:",error); }
    setCurrentUser(null);
    setUsers([]);
    setArchivalRecords([]);
    setLoans([]);
    setTransfers([]);
    setRecordsLoadError("");
    setVoluntaryPasswordOpen(false);
  };

  if (authLoading) return <main className="login"><p style={{padding:"3rem"}}>Verificando sesión...</p></main>;
  return currentUser ? (
    <>
      <Application
        archivalRecords={archivalRecords}
        recordsLoadError={recordsLoadError}
        currentUser={currentUser}
        loans={loans}
        onLogout={logout}
        onChangePassword={() => setVoluntaryPasswordOpen(true)}
        onLoansChange={setLoans}
        onRecordsChange={setArchivalRecords}
        onRolePermissionsChange={setRolePermissions}
        onTransfersChange={setTransfers}
        onUsersChange={setUsers}
        transfers={transfers}
        users={users}
        rolePermissions={rolePermissions}
      />
      {currentUser.mustChangePassword && (
        <MandatoryPasswordChange
          onComplete={async (current,next) => {
            const user = await authApi.changePassword(current,next);
            setCurrentUser(user);
            setUsers((all)=>all.map(u=>u.id===user.id?user:u));
          }}
          user={currentUser}
        />
      )}
      {voluntaryPasswordOpen && !currentUser.mustChangePassword && (
        <VoluntaryPasswordChange
          onCancel={() => setVoluntaryPasswordOpen(false)}
          onComplete={async (current,next) => {
            const user = await authApi.changePassword(current,next);
            setCurrentUser(user);
            setUsers((all)=>all.map(u=>u.id===user.id?user:u));
            setVoluntaryPasswordOpen(false);
          }}
          user={currentUser}
        />
      )}
    </>
  ) : (
    <Login onLogin={(user) => {
      setArchivalRecords([]);
      setLoans([]);
      setTransfers([]);
      setRecordsLoadError("");
      setUsers([user]);
      setCurrentUser(user);
    }} />
  );
}
