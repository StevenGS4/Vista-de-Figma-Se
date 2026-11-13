import { FormEvent, useMemo, useState } from "react";
import { usersApi } from "./api";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  KeyRound,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  Role,
  UserRecord,
  UserStatus,
  areaName,
  areas,
  fullName,
  permissions,
  roles,
} from "./data";

type AdminTab = "users" | "areas" | "permissions";
type AdminView = "list" | "form" | "detail";
type FieldErrors = Partial<Record<keyof UserFormState | "roles", string>>;

type UserFormState = {
  firstName: string;
  paternalName: string;
  maternalName: string;
  email: string;
  areaId: string;
  password: string;
  confirmPassword: string;
  roles: Role[];
  status: UserStatus;
};

const emptyForm: UserFormState = {
  firstName: "",
  paternalName: "",
  maternalName: "",
  email: "",
  areaId: "",
  password: "",
  confirmPassword: "",
  roles: [],
  status: "Activo",
};

function Button({
  children,
  className = "",
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button className={`button ${className}`} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`badge badge--${status === "Activo" ? "active" : "inactive"}`}>
      <span />
      {status}
    </span>
  );
}

function UserForm({
  editing,
  onCancel,
  onSave,
  saveError,
  isSaving,
  onErrorClear,
  users,
}: {
  editing: UserRecord | null;
  onCancel: () => void;
  onSave: (user: UserRecord) => void;
  saveError: string;
  isSaving: boolean;
  onErrorClear: () => void;
  users: UserRecord[];
}) {
  const [form, setForm] = useState<UserFormState>(
    editing
      ? {
          firstName: editing.firstName,
          paternalName: editing.paternalName,
          maternalName: editing.maternalName,
          email: editing.email,
          areaId: editing.areaId,
          password: "",
          confirmPassword: "",
          roles: editing.roles,
          status: editing.status,
        }
      : emptyForm,
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  const update = <K extends keyof UserFormState>(field: K, value: UserFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    onErrorClear();
  };

  const toggleRole = (role: Role) => {
    update(
      "roles",
      form.roles.includes(role)
        ? form.roles.filter((item) => item !== role)
        : [...form.roles, role],
    );
    setErrors((current) => ({ ...current, roles: undefined }));
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (!form.firstName.trim()) next.firstName = "Ingresa el nombre.";
    if (!form.paternalName.trim()) next.paternalName = "Ingresa el apellido paterno.";
    if (!form.email.trim()) next.email = "Ingresa el correo electrónico.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Ingresa un correo válido.";
    else if (
      users.some(
        (user) =>
          user.email.toLowerCase() === form.email.trim().toLowerCase() && user.id !== editing?.id,
      )
    )
      next.email = "Este correo ya está registrado.";
    if (!form.areaId) next.areaId = "Selecciona un área administrativa.";
    if (!form.roles.length) next.roles = "Selecciona al menos un rol.";
    if (!editing) {
      if (form.password.length < 8 || form.password.length > 128 || !/[A-Z]/.test(form.password) ||
          !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password))
        next.password = "La contraseña debe tener entre 8 y 128 caracteres, mayúscula, minúscula y número.";
      if (form.password !== form.confirmPassword)
        next.confirmPassword = "Las contraseñas no coinciden.";
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isSaving || !validate()) return;
    onSave({
      id: editing?.id ?? `USR-${String(users.length + 1).padStart(3, "0")}`,
      firstName: form.firstName.trim(),
      paternalName: form.paternalName.trim(),
      maternalName: form.maternalName.trim(),
      email: form.email.trim().toLowerCase(),
      areaId: form.areaId,
      roles: form.roles,
      status: form.status,
      password: editing?.password ?? form.password,
      mustChangePassword: editing?.mustChangePassword ?? true,
    });
  };

  return (
    <div className="admin-form-page">
      <button className="text-button" onClick={onCancel}>
        <ArrowLeft size={17} />
        Volver al listado
      </button>
      <div className="surface form-surface">
        <div className="surface-heading">
          <div className="heading-icon">
            <UserCog size={22} />
          </div>
          <div>
            <h2>{editing ? "Editar usuario" : "Registrar usuario"}</h2>
            <p>
              {editing
                ? "Actualiza la información autorizada y los roles asignados."
                : "Captura la información de la nueva cuenta institucional."}
            </p>
          </div>
        </div>

        <form onSubmit={submit}>
          {saveError && (
            <div className="inline-notice" role="alert" aria-live="assertive" style={{marginBottom: 20}}>
              <span><strong>No se pudo guardar el usuario.</strong> {saveError}</span>
            </div>
          )}
          <div className="form-section">
            <div className="form-section__title">
              <span>01</span>
              <div>
                <h3>Información personal</h3>
                <p>Datos de identificación de la persona usuaria.</p>
              </div>
            </div>
            <div className="form-grid">
              <FormField label="Nombre" error={errors.firstName} required>
                <input
                  onChange={(event) => update("firstName", event.target.value)}
                  placeholder="Ej. María Elena"
                  value={form.firstName}
                />
              </FormField>
              <FormField label="Apellido paterno" error={errors.paternalName} required>
                <input
                  onChange={(event) => update("paternalName", event.target.value)}
                  placeholder="Ej. Hernández"
                  value={form.paternalName}
                />
              </FormField>
              <FormField label="Apellido materno" error={errors.maternalName}>
                <input
                  onChange={(event) => update("maternalName", event.target.value)}
                  placeholder="Ej. García"
                  value={form.maternalName}
                />
              </FormField>
              <FormField label="Correo electrónico" error={errors.email} required>
                <input
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="nombre@semarnat.gob.mx"
                  type="email"
                  value={form.email}
                />
              </FormField>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__title">
              <span>02</span>
              <div>
                <h3>Adscripción y acceso</h3>
                <p>Área, estado y credenciales de la cuenta.</p>
              </div>
            </div>
            <div className="form-grid">
              <FormField label="Área administrativa" error={errors.areaId} required>
                <select
                  onChange={(event) => update("areaId", event.target.value)}
                  value={form.areaId}
                >
                  <option value="">Selecciona un área</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Estado de la cuenta" required>
                <select
                  onChange={(event) => update("status", event.target.value as UserStatus)}
                  value={form.status}
                >
                  <option>Activo</option>
                  <option>Inactivo</option>
                </select>
              </FormField>
              {!editing && (
                <>
                  <FormField label="Contraseña" error={errors.password} required>
                    <input
                      onChange={(event) => update("password", event.target.value)}
                      placeholder="8 caracteres, mayúscula, minúscula y número"
                      type="password"
                      value={form.password}
                    />
                  </FormField>
                  <FormField label="Confirmar contraseña" error={errors.confirmPassword} required>
                    <input
                      onChange={(event) => update("confirmPassword", event.target.value)}
                      placeholder="Repite la contraseña"
                      type="password"
                      value={form.confirmPassword}
                    />
                  </FormField>
                </>
              )}
            </div>
            {editing && (
              <div className="inline-notice">
                <KeyRound size={18} />
                <span>
                  <strong>La contraseña actual permanece protegida.</strong>
                  Este formulario no muestra ni modifica credenciales existentes.
                </span>
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="form-section__title">
              <span>03</span>
              <div>
                <h3>Roles autorizados</h3>
                <p>Una persona puede disponer de más de un rol.</p>
              </div>
            </div>
            <div className="role-options">
              {roles.map((role) => (
                <label className={form.roles.includes(role) ? "is-checked" : ""} key={role}>
                  <input
                    checked={form.roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    type="checkbox"
                  />
                  <span className="check-control">
                    {form.roles.includes(role) && <Check size={14} />}
                  </span>
                  <span>
                    <strong>{role}</strong>
                    <small>
                      {role === "Personal de área"
                        ? "Registro y consulta de expedientes de su área."
                        : role === "Encargado de área"
                          ? "Supervisión de inventarios y transferencias de su área."
                          : role === "Encargado de préstamos / Control archivístico"
                            ? "Resguardo, préstamos y devoluciones documentales."
                            : "Administración, revisión y coordinación institucional."}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            {errors.roles && <p className="field-error">{errors.roles}</p>}
          </div>

          <div className="form-actions">
            <Button className="button--secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <button className="button button--primary" type="submit" disabled={isSaving} aria-busy={isSaving}>
              <Check size={17} />
              {isSaving ? "Guardando en MySQL..." : editing ? "Guardar cambios" : "Registrar usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  children,
  error,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className={`form-field ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b>*</b>}
      </span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function UserDetail({
  onBack,
  onEdit,
  onPermissions,
  user,
}: {
  onBack: () => void;
  onEdit: () => void;
  onPermissions: () => void;
  user: UserRecord;
}) {
  return (
    <div className="admin-form-page">
      <button className="text-button" onClick={onBack}>
        <ArrowLeft size={17} />
        Volver al listado
      </button>
      <div className="surface detail-surface">
        <div className="detail-header">
          <div className="detail-avatar">
            {user.firstName.charAt(0)}
            {user.paternalName.charAt(0)}
          </div>
          <div>
            <span className="record-id">{user.id}</span>
            <h2>{fullName(user)}</h2>
            <p>{user.email}</p>
          </div>
          <StatusBadge status={user.status} />
          <div className="detail-header__actions">
            <Button className="button--secondary" onClick={onPermissions}>
              <ShieldCheck size={17} />
              Permisos
            </Button>
            <Button className="button--primary" onClick={onEdit}>
              <Pencil size={17} />
              Editar
            </Button>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <span>Área administrativa</span>
            <strong>{areaName(user.areaId)}</strong>
          </div>
          <div>
            <span>Estado de cuenta</span>
            <strong>{user.status}</strong>
          </div>
          <div>
            <span>Correo institucional</span>
            <strong>{user.email}</strong>
          </div>
          <div>
            <span>Roles asignados</span>
            <div className="role-tags">
              {user.roles.map((role) => (
                <span key={role}>{role}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="detail-note">
          <ShieldCheck size={20} />
          <div>
            <strong>Cuenta registrada en MySQL</strong>
            <p>Los cambios confirmados se conservan en la base de datos y pueden consultarse al iniciar sesión nuevamente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionsDialog({
  onClose,
  onSave,
  rolePermissions,
  user,
}: {
  onClose: () => void;
  onSave: (roles: Role[]) => void;
  rolePermissions: Record<Role, string[]>;
  user: UserRecord;
}) {
  const [selected, setSelected] = useState<Role[]>(user.roles);
  const effective = useMemo(
    () => new Set(selected.flatMap((role) => rolePermissions[role])),
    [rolePermissions, selected],
  );

  const toggle = (role: Role) =>
    setSelected((current) => {
      if (current.includes(role) && current.length === 1) return current;
      return current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    });

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="permissions-title" aria-modal="true" className="modal" role="dialog">
        <div className="modal__header">
          <div>
            <span>Permisos de usuario</span>
            <h2 id="permissions-title">{fullName(user)}</h2>
          </div>
          <button aria-label="Cerrar" className="icon-action" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="modal__body">
          <p className="modal__intro">
            Asigna uno o varios roles. Los permisos efectivos se calculan a partir de esta
            selección.
          </p>
          <div className="modal-role-list">
            {roles.map((role) => (
              <label className={selected.includes(role) ? "is-selected" : ""} key={role}>
                <input
                  checked={selected.includes(role)}
                  onChange={() => toggle(role)}
                  type="checkbox"
                />
                <span className="check-control">
                  {selected.includes(role) && <Check size={14} />}
                </span>
                <span>{role}</span>
              </label>
            ))}
          </div>
          <div className="effective-permissions">
            <strong>Permisos efectivos ({effective.size})</strong>
            <div>
              {permissions.map((permission) => (
                <span
                  className={effective.has(permission.id) ? "is-granted" : ""}
                  key={permission.id}
                >
                  {effective.has(permission.id) ? <Check size={13} /> : <X size={13} />}
                  {permission.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <Button className="button--secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="button--primary"
            onClick={() => {
              if (selected.length) onSave(selected);
            }}
          >
            <Check size={17} />
            Guardar permisos
          </Button>
        </div>
      </div>
    </div>
  );
}

function UsersList({
  onCreate,
  onEdit,
  onPermissions,
  onView,
  users,
}: {
  onCreate: () => void;
  onEdit: (user: UserRecord) => void;
  onPermissions: (user: UserRecord) => void;
  onView: (user: UserRecord) => void;
  users: UserRecord[];
}) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const query = search.toLowerCase();
        return (
          (!query ||
            fullName(user).toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)) &&
          (!area || user.areaId === area) &&
          (!role || user.roles.includes(role as Role))
        );
      }),
    [area, role, search, users],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="surface table-surface">
      <div className="table-titlebar">
        <div>
          <h2>Usuarios registrados</h2>
          <p>{users.length} cuentas en el catálogo de demostración</p>
        </div>
        <Button className="button--primary" onClick={onCreate}>
          <Plus size={17} />
          Registrar usuario
        </Button>
      </div>
      <div className="table-filters">
        <label className="search-box">
          <Search size={17} />
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre o correo..."
            value={search}
          />
        </label>
        <label className="filter-select">
          <MapPin size={16} />
          <select
            aria-label="Filtrar por área"
            onChange={(event) => {
              setArea(event.target.value);
              setPage(1);
            }}
            value={area}
          >
            <option value="">Todas las áreas</option>
            {areas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select">
          <Filter size={16} />
          <select
            aria-label="Filtrar por rol"
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            value={role}
          >
            <option value="">Todos los roles</option>
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Usuario</th>
              <th>Área administrativa</th>
              <th>Rol</th>
              <th>Estado</th>
              <th className="align-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id}>
                <td>
                  <span className="record-id">{user.id}</span>
                </td>
                <td>
                  <div className="user-cell">
                    <span>
                      {user.firstName.charAt(0)}
                      {user.paternalName.charAt(0)}
                    </span>
                    <div>
                      <strong>{fullName(user)}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                </td>
                <td>{areaName(user.areaId)}</td>
                <td>
                  <span className="role-label">
                    {user.roles[0]}
                    {user.roles.length > 1 && <b>+{user.roles.length - 1}</b>}
                  </span>
                </td>
                <td>
                  <StatusBadge status={user.status} />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      aria-label={`Ver ${fullName(user)}`}
                      onClick={() => onView(user)}
                      title="Ver detalles"
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      aria-label={`Editar ${fullName(user)}`}
                      onClick={() => onEdit(user)}
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Modificar permisos de ${fullName(user)}`}
                      onClick={() => onPermissions(user)}
                      title="Modificar permisos"
                    >
                      <ShieldCheck size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <div className="empty-state">
            <Users size={30} />
            <strong>No encontramos usuarios</strong>
            <p>Ajusta la búsqueda o limpia los filtros seleccionados.</p>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setArea("");
                setRole("");
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          Mostrando {visible.length ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, filtered.length)} de {filtered.length}
        </span>
        <div>
          <button
            aria-label="Página anterior"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Página {page} de {pages}
          </span>
          <button
            aria-label="Página siguiente"
            disabled={page === pages}
            onClick={() => setPage((current) => current + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AreasCatalog({ items }: { items: Area[] }) {
  return (
    <div className="surface table-surface">
      <div className="table-titlebar">
        <div>
          <h2>Catálogo de áreas</h2>
          <p>Estructura administrativa utilizada para clasificar el acceso.</p>
        </div>
        <span className="demo-label">Datos de demostración</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Nombre del área</th>
              <th>Área superior</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>
            {items.map((area) => (
              <tr key={area.id}>
                <td>
                  <span className="record-id">{area.id}</span>
                </td>
                <td>
                  <strong className="cell-primary">{area.name}</strong>
                </td>
                <td>{area.parent}</td>
                <td>{area.manager}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="catalog-note">
        Este catálogo utiliza información ficticia y no modifica la estructura institucional real.
      </div>
    </div>
  );
}

function PermissionMatrix({
  onChange,
  rolePermissions,
}: {
  onChange: (permissions: Record<Role, string[]>) => void;
  rolePermissions: Record<Role, string[]>;
}) {
  const [matrix, setMatrix] = useState(rolePermissions);
  const [saved, setSaved] = useState(false);

  const toggle = (role: Role, permission: string) => {
    setSaved(false);
    setMatrix((current) => ({
      ...current,
      [role]: current[role].includes(permission)
        ? current[role].filter((item) => item !== permission)
        : [...current[role], permission],
    }));
  };

  return (
    <div className="surface permission-surface">
      <div className="table-titlebar">
        <div>
          <h2>Roles y permisos</h2>
          <p>Configura las operaciones autorizadas para cada perfil del sistema.</p>
        </div>
        <Button
          className="button--primary"
          onClick={() => {
            onChange(matrix);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2200);
          }}
        >
          <Check size={17} />
          Guardar configuración
        </Button>
      </div>
      {saved && (
        <div className="success-banner" role="status">
          <Check size={17} />
          La matriz de permisos se actualizó para esta sesión.
        </div>
      )}
      <div className="permission-scroll">
        <table className="permission-table">
          <thead>
            <tr>
              <th>Permiso</th>
              {roles.map((role) => (
                <th key={role}>
                  <span>{role}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.label}</td>
                {roles.map((role) => (
                  <td key={role}>
                    <label className="matrix-check">
                      <input
                        aria-label={`${permission.label}: ${role}`}
                        checked={matrix[role].includes(permission.id)}
                        disabled
                        type="checkbox"
                      />
                      <span>{matrix[role].includes(permission.id) && <Check size={14} />}</span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="permission-legend">
        <ShieldCheck size={18} />
        <span>
          <strong>Control de acceso por rol.</strong> La matriz de permisos es ilustrativa en esta etapa. Los permisos reales se verifican en el servidor.
        </span>
      </div>
    </div>
  );
}

export default function AdminPanel({
  onRolePermissionsChange,
  onUsersChange,
  rolePermissions,
  users,
}: {
  onRolePermissionsChange: (permissions: Record<Role, string[]>) => void;
  onUsersChange: (users: UserRecord[]) => void;
  rolePermissions: Record<Role, string[]>;
  users: UserRecord[];
}) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [view, setView] = useState<AdminView>("list");
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserRecord | null>(null);
  const [toast, setToast] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveUser = async (user: UserRecord) => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");
    setToast("");
    const exists = users.some((item) => item.id === user.id);
    try {
      const saved = await usersApi.save(user);
      onUsersChange(exists ? users.map((item) => (item.id === saved.id ? saved : item)) : [saved,...users]);
      setToast(exists ? "Los cambios del usuario se guardaron en MySQL." : "El usuario fue registrado en MySQL.");
      setView("list");
      setSelected(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo guardar el usuario.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateRoles = async (nextRoles: Role[]) => {
    if (!permissionsUser) return;
    try {
      const saved = await usersApi.save({...permissionsUser,roles:nextRoles});
      onUsersChange(users.map((user)=>(user.id===saved.id?saved:user)));
      if (selected?.id === saved.id) setSelected(saved);
      setPermissionsUser(null);
      setToast("Los roles del usuario se actualizaron en MySQL.");
    } catch(error) {
      setToast(error instanceof Error ? error.message : "No se pudieron actualizar los roles.");
    }
  };

  if (view === "form")
    return (
      <UserForm
        editing={selected}
        onCancel={() => {
          setView("list");
          setSelected(null);
        }}
        onSave={saveUser}
        saveError={saveError}
        isSaving={isSaving}
        onErrorClear={() => setSaveError("")}
        users={users}
      />
    );

  if (view === "detail" && selected)
    return (
      <>
        <UserDetail
          onBack={() => {
            setView("list");
            setSelected(null);
          }}
          onEdit={() => setView("form")}
          onPermissions={() => setPermissionsUser(selected)}
          user={selected}
        />
        {permissionsUser && (
          <PermissionsDialog
            onClose={() => setPermissionsUser(null)}
            onSave={updateRoles}
            rolePermissions={rolePermissions}
            user={permissionsUser}
          />
        )}
      </>
    );

  return (
    <>
      <div className="admin-tabs" role="tablist">
        <button
          aria-selected={tab === "users"}
          className={tab === "users" ? "is-active" : ""}
          onClick={() => setTab("users")}
          role="tab"
        >
          <Users size={17} />
          Usuarios
        </button>
        <button
          aria-selected={tab === "areas"}
          className={tab === "areas" ? "is-active" : ""}
          onClick={() => setTab("areas")}
          role="tab"
        >
          <MapPin size={17} />
          Catálogo de áreas
        </button>
        <button
          aria-selected={tab === "permissions"}
          className={tab === "permissions" ? "is-active" : ""}
          onClick={() => setTab("permissions")}
          role="tab"
        >
          <SlidersHorizontal size={17} />
          Roles y permisos
        </button>
      </div>

      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}

      {tab === "users" && (
        <UsersList
          onCreate={() => {
            setSaveError("");
            setToast("");
            setSelected(null);
            setView("form");
          }}
          onEdit={(user) => {
            setSaveError("");
            setToast("");
            setSelected(user);
            setView("form");
          }}
          onPermissions={setPermissionsUser}
          onView={(user) => {
            setSelected(user);
            setView("detail");
          }}
          users={users}
        />
      )}
      {tab === "areas" && <AreasCatalog items={areas} />}
      {tab === "permissions" && (
        <PermissionMatrix onChange={onRolePermissionsChange} rolePermissions={rolePermissions} />
      )}
      {permissionsUser && (
        <PermissionsDialog
          onClose={() => setPermissionsUser(null)}
          onSave={updateRoles}
          rolePermissions={rolePermissions}
          user={permissionsUser}
        />
      )}
    </>
  );
}
