# BITÁCORA — GDM_FAC

Histórico cronológico de cambios funcionales, decisiones técnicas y deploys.
Formato: cada entrada tiene fecha, contexto, decisión y consecuencia.

---

## 2026-07-02 — Deploy productivo en Render

### Contexto
Necesidad de un ambiente estable donde el servicio no dependa de que la máquina local esté prendida. El desarrollo local se caía intermitentemente (tsx watch, Vite server, y PG).

### Decisión
- **Plataforma**: Render.com con Blueprint (`render.yaml`)
- **Repo**: GitHub público `anbeor29-oss/GDM_FACT`
- **Plan**: Backend Starter ($7 USD), Frontend Static (Free), Postgres Free (90 días)

### Bugs enfrentados y resueltos durante deploy

| # | Error | Causa raíz | Solución |
|---|-------|------------|----------|
| 1 | `no such plan free for service type web` | Render descontinuó `free` para web services vía Blueprint | Cambiar `plan: free` → `plan: starter` en backend; quitar `plan` en static site |
| 2 | `TS5107: 'moduleResolution=node10' is deprecated` en TS 6.x | Render usaba TypeScript global 6.x en lugar del pinneado 5.9 | `build: "./node_modules/.bin/tsc"` (fuerza binario local) |
| 3 | `sh: ./node_modules/.bin/tsc: not found` | Render omite devDependencies con `NODE_ENV=production` | `buildCommand: "npm ci --include=dev && npm run build"` |
| 4 | `Node.js v26.4.0` demasiado nuevo | Render eligió última versión inestable | Pin `engines.node: "20.x"` + `.nvmrc` con `20` |
| 5 | `[migrate] FALLÓ: relation "credit_notes" does not exist` | Tabla `credit_notes` creada manualmente en dev, nunca en git | Nueva migración `2026-06-15_credit_notes.sql` con la definición completa |
| 6 | `Missing required environment variables: DB_HOST, ...` | Validación exigía vars sueltas, Render usa `DATABASE_URL` | Config acepta ambos: `DATABASE_URL` (parseada) o vars discretas |
| 7 | `$PORT` no respetado | Código usaba `APP_PORT` hardcode | Preferir `PORT` (Render) sobre `APP_PORT` (self-hosted) |

### Consecuencia
- 🟢 Backend live: https://gdmfac-backend.onrender.com
- 🟢 Frontend live: https://gdmfac-frontend.onrender.com
- 🟢 Postgres available: `gdmfac-postgres` (uso interno)
- Auto-deploy en cada `git push` a `main`
- Rollback con 1 clic desde el dashboard

### Aprendizaje
Render tiene 3 pitfalls no obvios que deberían estar mejor documentados:
1. Free tier YA NO aplica para web services vía Blueprint (sí manual)
2. `npm ci` con `NODE_ENV=production` omite devDeps por default
3. Node runtime pica versión bleeding-edge si no se pinnea

---

## 2026-07-01 — PDF paginación X/Y a la derecha inferior

### Contexto
Los PDFs generaban 4-6 páginas fantasma con contenido vacío. La paginación aparecía en el pie izquierdo pero con números incorrectos.

### Decisión
- Cambiar posición de "Página X/Y" al pie **derecho** (`x = PAGE_RIGHT - 120`)
- Workaround anti-auto-page en PDFKit: anular `doc.page.margins` temporalmente antes de escribir en zonas cerca del margen inferior
- Comprimir sellos base64 del timbre fiscal a 1 línea con ellipsis para evitar overflow

### Resultado
- Factura simple: 1 sola página con `Página 1/1`
- NC: 1 página `Página 1/1`
- Reporte cobranza (multi-cliente): 3 páginas `1/3, 2/3, 3/3`
- Cero páginas fantasma

### Archivos afectados
- `backend/src/modules/cfdi/pdf-helpers.ts`
- `backend/src/modules/cfdi/pdf.service.ts`
- `backend/src/modules/cfdi/pdf-credit-note.service.ts`
- `backend/src/modules/cfdi/pdf-payment.service.ts`

---

## 2026-07-01 — Integración SW Sapien PAC

### Contexto
El sistema estaba en modo MOCK PAC. Para producción real necesitamos timbrado ante SAT.

### Decisión
- **PAC elegido**: SW Sapien (`services.test.sw.com.mx` sandbox / `services.sw.com.mx` prod)
- **Modelo**: token JWT del panel `swpanel.mx` en `.env` cifrado, nunca password personal
- **Provider registrado**: `SW_SAPIEN` en el registry, seleccionado por env `PAC_PROVIDER=SW_SAPIEN`
- **Fallback**: MOCK cuando no hay token — permite dev sin dependencia externa

### Endpoints implementados
- `POST /cfdi33/stamp/v4` → timbrado CFDI 4.0
- `POST /cfdi33/cancel/{rfc}` → cancelación
- `GET /account/balance` → saldo de timbres

### Estado actual
- ✅ Sandbox conectado con **501 timbres disponibles**
- ✅ Balance leído correctamente por el ERP (`GET /pac/account-status`)
- ✅ Cuenta dedicada para el proyecto (separada del usuario personal)
- 🟡 Primer timbrado real pendiente
- 🟡 CSD de prueba de SW pendiente cargar en la empresa demo

### Archivos afectados
- `backend/src/modules/pac/providers/sw-sapien.provider.ts` (nuevo)
- `backend/src/modules/pac/pac.service.ts` (registry + selección dinámica)
- `backend/.env` (variable `SW_SAPIEN_TOKEN`)

---

## 2026-07-01 — Reporte de Cobranza detallado

### Contexto
El reporte de cobranza existente solo mostraba totales por cliente. Se pidió un reporte detallado que:
1. Filtre por cliente (o mostrar todos)
2. Liste facturas con saldo pendiente **> $0.20** (umbral anti-redondeo)
3. Muestre abonos (payments) y notas de crédito por factura
4. Exportable a PDF con paginación correcta

### Decisión
- Nueva pestaña **"Cobranza detallada"** en `/reports`
- Endpoint `GET /api/v1/reports/receivables?customerId=…` → JSON
- Endpoint `GET /api/v1/reports/receivables/pdf` → PDF descargable
- Saldo = `total - pagos - créditos`, filtro en memoria (2 decimales)

### Archivos afectados
- `backend/src/modules/reports/reports.service.ts` — nueva función `getReceivablesReport`
- `backend/src/modules/reports/receivables-pdf.service.ts` (nuevo)
- `frontend/src/pages/Reports.tsx` — pestaña nueva
- `frontend/src/services/api.ts` — métodos `getReceivablesReport` + `receivablesPDFUrl`

---

## 2026-06-30 — Importar XML: distinguir Cliente / Proveedor

### Contexto
Al importar un XML CFDI 4.0 externo, el sistema debe:
- Distinguir si la contraparte es CLIENTE (yo emito) o PROVEEDOR (yo recibo)
- Guardar CP y régimen reales del XML (no `'00000'` / `'616'` hardcoded)
- Los proveedores viven en `/suppliers` como vista read-only

### Decisión
**Single-Table Inheritance** con columna `party_type VARCHAR(16)` en `customers`:
- `CUSTOMER` (default) o `SUPPLIER`
- Constraint CHECK + índice parcial en `(company_id, party_type)`
- Sidebar: nuevo menú "Proveedores" con icono `Truck` color ámbar

**Auto-detección server-side**:
- Comparar RFC emisor/receptor del XML contra `companies.rfc` del JWT
- Si yo=emisor → sugerencia `receptor → CUSTOMER`
- Si yo=receptor → sugerencia `emisor → SUPPLIER`
- Si RFC coincide con la propia empresa → guard "no se puede crear como cliente ni proveedor"

**Parser XML actualizado** para extraer:
- `LugarExpedicion` (CP del emisor)
- `DomicilioFiscalReceptor` (CP del receptor)
- `RegimenFiscalReceptor`
- `UsoCFDI`

### Archivos afectados
- `backend/src/database/migrations/2026-06-23_party_type.sql`
- `backend/src/modules/cfdi-import/cfdi-import.service.ts`
- `backend/src/modules/cfdi-import/cfdi-import.types.ts`
- `backend/src/modules/suppliers/suppliers.routes.ts` (nuevo)
- `frontend/src/pages/Suppliers.tsx` (nuevo)
- `frontend/src/pages/ImportXMLWizard.tsx`
- `frontend/src/components/Layout.tsx`

---

## 2026-06-23 — Auto-memoria: registro de sesión

### Contexto
Necesidad de tener un rastro persistente de las decisiones tomadas entre sesiones del asistente.

### Decisión
Guardar auto-memoria en `C:\Users\EQ-7\.claude\projects\D--Obsidian-GDM-FAC\memory\`:
- `MEMORY.md` (índice)
- `gdm-fac-project.md` (contexto del proyecto)

Regla: no memorizar código o estructura (se puede leer del repo), sí memorizar **decisiones de negocio** y preferencias del usuario.

---

## 2026-06-22 — Paquetes de facturación (100/200/500 timbres)

### Contexto
Modelo comercial SaaS: cobrar renta mensual + cap de timbres. Necesidad de 3 planes con precios competitivos vs Facturama, Bind ERP, Contpaqi.

### Decisión

| Código | Timbres/mes | Renta MXN | Extra c/u |
|--------|-------------|-----------|-----------|
| `PKG_100` | 100 | $399 | $2.50 |
| `PKG_200` | 200 | $699 | $2.25 |
| `PKG_500` | 500 | $1,399 | $2.00 |
| `PKG_FLEX` | 0 (pay-per-stamp) | $0 | $2.00 |

**Margen bruto**: 40-57% (costo interno PAC + infra ~$1.72/timbre).

### Archivos afectados
- `backend/src/database/migrations/2026-07-01_stamp_packages.sql`
- `backend/src/database/migrations/2026-06-22_company_billing_plan.sql`
- `backend/src/database/migrations/2026-06-22_super_admin_module.sql`

---

## Decisiones acumuladas — resumen

- **Redondeo**: bancario (half-even) para centavos; nunca `toFixed(2)` sin verificar
- **Multi-tenant**: `company_id` en JWT, jamás en request body
- **Passwords**: bcrypt cost 12; force-change en primer login
- **CSD**: cifrado en BD con pgp_sym_encrypt + master key en env
- **XML**: parser tolerante para import; estricto para emisión
- **PDFs**: sellos abreviados (60+ellipsis+20) para caber en 1 página
- **API path**: `/api/v1/...` consistente en dev y prod
- **Auto-deploy**: cada push a `main` dispara build en Render (no manual)
- **Migrations**: idempotentes (`IF NOT EXISTS`, `ON CONFLICT DO`)
- **PAC**: switcheable entre MOCK y SW_SAPIEN vía env — cero recompilación

---

## Próximos pasos identificados

- 🟡 **Timbrado real** contra SW sandbox con RFC de prueba `EKU9003173C9`
- 🟡 **Cargar CSD de prueba de SW** en la empresa demo
- 🟡 Evaluar SDK Node.js oficial de SW vs implementación actual con axios
- 🟡 Migrar `CSD_MASTER_KEY` de env efímero a AWS KMS / Vault
- 🟡 Cerrar contrato PAC producción con SW Sapien (mayorista)
- 🟡 Ejecutar `reset_to_training.sql` en Render prod
- 🟡 Cambiar dominio de `.onrender.com` a `.gdmfac.mx` custom
