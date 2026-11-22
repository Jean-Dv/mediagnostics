# Mediagnostics

Plataforma segura de gestión documental para un laboratorio clínico. Permite cargar, procesar, publicar y consultar resultados de laboratorio y consentimientos informados con control de acceso RBAC, auditoría y procesamiento asíncrono.

## Requisitos

- Node.js 24 LTS (24.7 o superior) y pnpm 12.
- Docker Engine con Docker Compose.
- 4 GiB de RAM recomendados para desarrollo local.

## Inicio local

1. Copia `.env.example` como `.env` y reemplaza todos los valores indicados.
2. Inicia la infraestructura:

   ```bash
   docker compose --env-file .env -f compose.local.yaml up -d
   ```

3. Instala dependencias y prepara Prisma:

   ```bash
   corepack enable
   pnpm install
   pnpm prisma:generate
   pnpm db:migrate
   pnpm db:seed
   ```

   El seed crea el administrador inicial usando `INITIAL_ADMIN_EMAIL`,
   `INITIAL_ADMIN_NAME` e `INITIAL_ADMIN_PASSWORD`. Si la cuenta ya existe, no
   modifica su contraseña.

4. En terminales separadas, ejecuta:

   ```bash
   pnpm dev:api
   pnpm dev:worker
   pnpm dev:web
   ```

El frontend queda en `http://localhost:5173`, el API en `http://localhost:3000/api/v1` y Swagger en `http://localhost:3000/api/docs` solamente fuera de producción.

## Comandos principales

- `pnpm build`: compila API, Worker y frontend.
- `pnpm build:image:api`: construye la imagen mínima del API.
- `pnpm build:image:web`: construye el frontend estático servido por Caddy.
- `pnpm build:image:worker`: construye la imagen del Worker con las herramientas PDF.
- `pnpm lint`: ejecuta las reglas estrictas de ESLint.
- `pnpm test`: ejecuta pruebas con Vitest.
- `pnpm test:coverage`: verifica cobertura de dominio y aplicación.
- `pnpm format:check`: comprueba el formato con Prettier.
- `docker compose --env-file .env -f compose.local.yaml down`: detiene servicios sin eliminar volúmenes.

## Estructura

- `apps/api`: punto de entrada HTTP de NestJS.
- `apps/worker`: punto de entrada del procesador asíncrono.
- `apps/web`: aplicación React, Vite y shadcn/ui.
- `src/modules`: lógica de negocio organizada por módulos y capas.
- `prisma`: esquema, migraciones y datos iniciales.
- `infrastructure`: despliegue reproducible para AWS Academy.
- `docs`: arquitectura, seguridad y evidencias técnicas.

No uses datos clínicos reales ni versiones credenciales. Consulta [la arquitectura](docs/architecture.md), [la matriz RBAC](docs/access-control.md) y [la guía de despliegue](docs/deployment.md) antes de añadir funcionalidades.
