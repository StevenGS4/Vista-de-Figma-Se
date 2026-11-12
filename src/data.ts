export type Role =
  | "Personal de área"
  | "Encargado de área"
  | "Encargado de préstamos / Control archivístico"
  | "Administrador / Coordinador";

export type UserStatus = "Activo" | "Inactivo";

export type UserRecord = {
  id: string;
  firstName: string;
  paternalName: string;
  maternalName: string;
  email: string;
  areaId: string;
  roles: Role[];
  status: UserStatus;
  password: string;
  mustChangePassword: boolean;
};

export type Area = {
  id: string;
  name: string;
  parent: string;
  manager: string;
};

export type Permission = {
  id: string;
  label: string;
};

export const roles: Role[] = [
  "Personal de área",
  "Encargado de área",
  "Encargado de préstamos / Control archivístico",
  "Administrador / Coordinador",
];

export const areas: Area[] = [
  {
    id: "AR-001",
    name: "Coordinación Administrativa",
    parent: "Oficina de Representación",
    manager: "Ana Sofía Martínez Ruiz",
  },
  {
    id: "AR-002",
    name: "Unidad Jurídica",
    parent: "Oficina de Representación",
    manager: "Mariana López Rivera",
  },
  {
    id: "AR-003",
    name: "Archivo de Concentración",
    parent: "Coordinación Administrativa",
    manager: "Carlos Hernández Soto",
  },
  {
    id: "AR-004",
    name: "Recursos Materiales",
    parent: "Coordinación Administrativa",
    manager: "Patricia Gómez Medina",
  },
  {
    id: "AR-005",
    name: "Recursos Humanos",
    parent: "Coordinación Administrativa",
    manager: "Luis Alberto Ramos",
  },
];

// Las cuentas reales se consultan desde MySQL; no publicar contraseñas demo.
export const initialUsers: UserRecord[] = [];

export const permissions: Permission[] = [
  { id: "register-records", label: "Registrar expedientes" },
  { id: "edit-records", label: "Editar expedientes" },
  { id: "view-records", label: "Consultar expedientes" },
  { id: "prepare-transfers", label: "Preparar transferencias" },
  { id: "approve-area-transfers", label: "Dar visto bueno de área" },
  { id: "review-transfers", label: "Revisar transferencias" },
  { id: "accept-transfers", label: "Aceptar transferencias" },
  { id: "register-loans", label: "Registrar préstamos" },
  { id: "register-returns", label: "Registrar devoluciones" },
  { id: "update-location", label: "Actualizar ubicación" },
  { id: "download-inventories", label: "Descargar inventarios" },
  { id: "manage-users", label: "Administrar usuarios" },
];

export const initialRolePermissions: Record<Role, string[]> = {
  "Personal de área": [
    "register-records",
    "edit-records",
    "view-records",
    "prepare-transfers",
    "download-inventories",
  ],
  "Encargado de área": [
    "register-records",
    "edit-records",
    "view-records",
    "prepare-transfers",
    "approve-area-transfers",
    "review-transfers",
    "download-inventories",
  ],
  "Encargado de préstamos / Control archivístico": [
    "view-records",
    "register-loans",
    "register-returns",
    "update-location",
    "download-inventories",
  ],
  "Administrador / Coordinador": permissions.map((permission) => permission.id),
};

export const fullName = (user: UserRecord) =>
  [user.firstName, user.paternalName, user.maternalName].filter(Boolean).join(" ");

export const initials = (user: UserRecord) =>
  `${user.firstName.charAt(0)}${user.paternalName.charAt(0)}`.toUpperCase();

export const areaName = (areaId: string) =>
  areas.find((area) => area.id === areaId)?.name ?? "Área no asignada";
