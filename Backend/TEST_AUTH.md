# Etapa 1: autenticación MySQL

Esta rama implementa la API de autenticación, administración de usuarios y la integración de la pantalla de Login y cambio de contraseña de Figma.

## Instalación
1. Configura `Backend/.env` a partir de `.env.example`. `FRONTEND_ORIGIN` debe coincidir con la URL exacta de Vite (por ejemplo `http://localhost:8443`).
2. Genera un secreto: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; ponlo en `JWT_SECRET`. **Nunca lo subas a GitHub**.
3. Ejecuta `cd Backend && npm install`.
4. Para crear una cuenta administradora local: define `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en tu .env y ejecuta `npm run seed:admin`. Borra esas dos variables después de crearla.
5. Inicia backend: `npm run dev`. Inicia frontend desde raíz: `npm run dev`.

## Rutas
- `POST /api/auth/login`: {email,password}, crea cookie HttpOnly.
- `GET /api/auth/me`: devuelve perfil autenticado.
- `POST /api/auth/change-password`: {currentPassword,newPassword}, actualiza bcrypt en MySQL.
- `POST /api/auth/logout`: revoca sesión.
- `GET /api/users`, `POST /api/users`, `PUT /api/users/:id`: administración protegida.
- `GET /api/users/areas`: catálogo (solo admin).
- `GET /api/users/role-permissions`: permisos (solo admin).

## Pruebas manuales
1. Accede con credenciales temporales; el cambio obligatorio debe bloquear el resto de la aplicación.
2. Contraseña incorrecta: 401; usuario inactivo: 401.
3. Cambia contraseña: comprueba en MySQL que `cambiar_password=0` y que `password_hash` comienza con `$2b$`, sin texto plano.
4. Cierra sesión; `/api/auth/me` debe devolver 401.
5. Entra con nueva contraseña. Desde perfil cambia de nuevo la contraseña.
6. Como admin crea usuario con rol y área válidos: debe persistir y solicitar cambio inicial.
7. Inicia con ese usuario y confirma que no puede llamar `/api/users` (403).
8. Reinicia React y backend: usuarios siguen en MySQL.
9. Con origen distinto de `FRONTEND_ORIGIN`, mutaciones deben responder 403.

## Alcance / limitaciones
Los módulos archivísticos de Figma siguen simulados en esta etapa; no persistir inventarios hasta implementar los siguientes módulos. El catálogo de áreas de Figma es ilustrativo, mientras el catálogo real debe poblarse y validarse en MySQL. No usar registros reales todavía. La aplicación local requiere integración y pruebas adicionales antes de producción.
