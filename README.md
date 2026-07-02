# GDM_FAC — ERP CFDI 4.0 México

Sistema de facturación electrónica CFDI 4.0 para México. Backend en Node/Express + TypeScript, frontend React + Vite, PostgreSQL 15. Integrado con **SW Sapien** como PAC para timbrado real.

**Estado**: 🟢 **Live en producción** (Render.com)

## 🔗 URLs de producción

| Servicio | URL |
|----------|-----|
| Frontend | https://gdmfac-frontend.onrender.com |
| Backend API | https://gdmfac-backend.onrender.com/api/v1 |
| Health check | https://gdmfac-backend.onrender.com/health |
| Repo | https://github.com/anbeor29-oss/GDM_FACT |

## 🔐 Credenciales de capacitación

| Rol | Email | Contraseña |
|-----|-------|------------|
| SUPER_ADMIN | `superadmin@plataforma.local` | `Super123!` |
| MANAGER (demo) | `manager@demo.com` | `admin123` |
| USER (demo) | *pendiente creación por SUPER_ADMIN* | *forzará cambio* |

> Cambiar contraseñas al primer acceso en producción.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                       RENDER.COM                        │
│                                                         │
│  ┌────────────────────┐          ┌──────────────────┐   │
│  │  gdmfac-frontend   │  HTTPS   │  gdmfac-backend  │   │
│  │  React + Vite      ├─────────►│  Node/Express    │   │
│  │  (Static site)     │          │  TypeScript 5.9  │   │
│  └────────────────────┘          └────────┬─────────┘   │
│                                           │             │
│                                    ┌──────▼──────┐      │
│                                    │  Postgres 15│      │
│                                    │  gdmfac-pg  │      │
│                                    └─────────────┘      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS bearer token
                          ▼
                ┌────────────────────┐
                │   SW SAPIEN (PAC)  │
                │  services.test     │
                │  .sw.com.mx        │
                └────────────────────┘
```

## 📦 Módulos funcionales

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Autenticación JWT | ✅ | Roles: SUPER_ADMIN, ADMIN, MANAGER, USER; force password change; impersonation |
| Facturas CFDI 4.0 | ✅ | Emisión con retenciones RESICO/Honorarios; UUID SAT; PDF con paginación |
| Notas de Crédito | ✅ | % de descuento y monto fijo; prorrateo de IVA |
| Complemento de Pago | ✅ | REP con desglose por parcialidades |
| Clientes / Proveedores | ✅ | STI con `party_type`; RFC + CP + régimen desde XML |
| Productos | ✅ | Impuestos por producto; catálogo SAT ~52K claves |
| Importar XML | ✅ | Preview + auto-sugerencia (yo=emisor → receptor=CUSTOMER) |
| Reportes | ✅ | Cobranza, cobranza detallada (saldo > 0.20), ventas, fiscal |
| Paquetes de timbres | ✅ | PKG_100 ($399), PKG_200 ($699), PKG_500 ($1,399), PKG_FLEX |
| Panel SUPER_ADMIN | ✅ | Gestión de usuarios, empresas, paquetes, CSDs |
| PDFs con paginación | ✅ | Página X/Y en pie derecho, sin páginas fantasma |
| PAC real (SW Sapien) | 🟡 | Provider listo, sandbox conectado; timbrado prueba pendiente |

## 🛠️ Stack técnico

**Backend**
- Node 20 LTS + TypeScript 5.9 (pinneada exact)
- Express 4 + JWT + bcryptjs
- PostgreSQL 15 con pg (pool)
- pdfkit para PDF, xml2js para CFDI, sharp para logos
- Axios para SW Sapien PAC

**Frontend**
- React 18 + Vite 5 + TypeScript
- TailwindCSS + Lucide icons
- React Router + React Query + Zustand
- Recharts para gráficas

**Infraestructura**
- Render Blueprint (`render.yaml`)
- Auto-deploy en push a `main` de GitHub
- Migraciones idempotentes con control `schema_migrations`

## 🚀 Ciclo de desarrollo

### Local

```bash
# Servicios
scripts/start-all.ps1        # levanta PG + Backend + Frontend con watchdog
scripts/healthcheck.ps1      # ver estado
scripts/stop-all.ps1         # apagar
```

Backend en http://localhost:3000, Frontend en http://localhost:5173, PG en localhost:5432.

### Deploy a producción

```bash
git add .
git commit -m "feat/fix: descripción"
git push
```

Render detecta el push y deploya automáticamente (3–5 min). Se puede seguir los logs en dashboard.render.com.

### Rollback

Cada deploy en Render se puede revertir con 1 click desde **Deploys → Rollback**.

## 🔒 Variables de entorno

Copiar `backend/.env.example` a `backend/.env` y llenar:

| Variable | Uso | Ejemplo |
|----------|-----|---------|
| `DATABASE_URL` | Conexión PG (Render la inyecta) | `postgres://…` |
| `JWT_SECRET` | Firma tokens (Render la genera) | 32+ chars |
| `JWT_REFRESH_SECRET` | Refresh tokens | 32+ chars |
| `CSD_MASTER_KEY` | Cifrado de .key SAT | 32+ chars |
| `PAC_PROVIDER` | `MOCK` o `SW_SAPIEN` | `SW_SAPIEN` |
| `SW_SAPIEN_ENV` | `sandbox` o `production` | `sandbox` |
| `SW_SAPIEN_TOKEN` | Bearer token del panel SW | JWT largo |

## 📊 Costos operativos

| Concepto | Costo mensual |
|----------|---------------|
| Render Backend Starter | $7 USD (~$140 MXN) |
| Render Postgres Free (90 días) | $0 |
| Render Frontend Static | $0 |
| Cloudflare DNS + SSL | $0 |
| **Total** | **~$140 MXN/mes** |

Cuando pases a producción con clientes reales: upgrade a Postgres Basic ($7/mes) → **~$280 MXN/mes total**.

## 📚 Documentación adicional

- [DEPLOY_RENDER.md](DEPLOY_RENDER.md) — Guía paso a paso del deploy inicial
- [BITACORA.md](BITACORA.md) — Histórico de cambios y decisiones técnicas
- [ARCHITECTURE.md](ARCHITECTURE.md) — Detalles de arquitectura interna
- [ESTRUCTURA_PROYECTO.md](ESTRUCTURA_PROYECTO.md) — Layout de carpetas

## 🧪 Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm run lint

# E2E (Playwright)
npx playwright test
```

Suite E2E completa en `tests/e2e/` con 14 archivos que cubren: smoke, auth, productos, facturas, NC + saldo, UI, a11y, performance, multi-tenant, paquetes de timbres, import XML hardening, WCAG 2.2.

## 🏥 Soporte

- Bugs: crear issue en el repo con etiqueta `bug`
- Emergencias PAC: soporte SW Sapien 33 1380 9988
- Reset de contraseña admin: acceso a Render Shell + SQL

---

**Copyright** © 2026 — Antonio Bernal / HCGM
