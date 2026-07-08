# Módulo Facturación y Consumo — diseño

Propuesta del nuevo módulo SUPER_ADMIN que se agrega después de
**Paquetes fiscales**. Cubre 3 escenarios:

1. Plan **iguala** — renta mensual + cap de timbres, **rollover** del sobrante.
2. Plan **renta** — sin cap, se factura el consumo real.
3. Plan **FLEX** — **prepago** por bloques de 30 timbres con recompra automática.

## 1. Estado actual (lo que ya existe)

| Objeto | Función |
|---|---|
| `stamp_packages` | Catálogo de planes (PKG_100/200/500/FLEX) con `monthly_stamps`, `monthly_fee_mxn`, `extra_stamp_mxn`. |
| `companies.stamp_package_code` | Paquete asignado a cada empresa. |
| `companies.billing_period_start` | Fecha del ciclo actual (día 1 del mes en curso). |
| `stamp_usage` | Bitácora inmutable — 1 fila por CFDI timbrado con `billing_period`, `was_extra` y `extra_charge_mxn`. |
| `v_stamp_usage_current` | Vista con `used_current_month`, `remaining`, `percent_used`. |

Lo que **falta** para cerrar el modelo de facturación:

- Contador de **timbres acumulados** (rollover) para plan iguala.
- Registro de **facturación mensual** (una fila por mes por empresa) con el desglose renta + extras.
- **Bolsa prepago** para plan FLEX con recompra.
- **Alertas por correo** al agotarse el saldo prepago o cerca del cap.
- **Job** que corre el día 1 de cada mes y genera los cargos.

---

## 2. Reglas de negocio por plan

### 2.1 Plan iguala (con cap + rollover)

Empresa contrata PKG_100 ($399 con 100 timbres/mes).

```
Mes 1:  timbra 70    → factura $399 · rollover 30 al mes 2
Mes 2:  cap efectivo = 100 + 30 = 130. Timbra 90 → factura $399 · rollover 40
Mes 3:  cap efectivo = 100 + 40 = 140. Timbra 150 → factura $399 + 10 × $2.50 = $424
```

**Política**:
- Rollover **infinito** (no expira) mientras el plan esté activo.
- Al cambiar de plan, el saldo acumulado se **cancela** (o se conserva? — decisión de negocio).
- Cancelar un CFDI **no** devuelve el timbre (SAT ya lo cobró al PAC).

### 2.2 Plan renta (sin cap, pago por uso)

Empresa contrata plan renta ($0 fijo, $2.50/timbre por ejemplo).

```
Mes 1:  timbra 70  → factura 70 × $2.50 = $175
Mes 2:  timbra 200 → factura 200 × $2.50 = $500
```

**Política**:
- No hay rollover, no hay cap.
- La renta base es $0 (o mínima, según convenio).
- Se cobra el consumo mensual exacto.

### 2.3 Plan FLEX (prepago, recompra por bloques de 30)

Empresa compra prepago sin renta.

```
Compra bloque #1 de 30 timbres   → saldo prepago = 30
Timbra 25                        → saldo = 5   → correo automático "quedan 5"
Timbra 3                         → saldo = 2   → correo "quedan 2, recarga urgente"
Timbra 2                         → saldo = 0   → BLOQUEA timbrado hasta recarga
Compra bloque #2 de 30           → saldo = 30
```

**Política**:
- El sistema **bloquea** el timbrado cuando el saldo llega a 0 (con mensaje "Sin timbres — contacta al administrador").
- Correo automático cuando saldo < N (configurable, default 5).
- Precio por bloque: 30 × $4.99 + IVA = ~$174 MXN.
- El pago **debe estar registrado** antes de acreditar el bloque (evita fraude).

---

## 3. Modelo de datos (migraciones nuevas)

### 3.1 Rollover del plan iguala

Nueva columna en `companies` (o tabla `company_stamp_balance` si se prefiere separar).
Opción simple: columna directa.

```sql
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS carried_over_stamps INT DEFAULT 0;
```

Fórmula del cap efectivo del mes en curso:
```
cap_efectivo = stamp_packages.monthly_stamps + companies.carried_over_stamps
```

Al cierre de mes: `carried_over_stamps += max(0, monthly_stamps - used_current_month)`.

### 3.2 Facturación mensual

Nueva tabla `monthly_invoicing`:

```sql
CREATE TABLE monthly_invoicing (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    billing_period     DATE NOT NULL,               -- YYYY-MM-01
    package_code       VARCHAR(16) NOT NULL,
    stamps_included    INT NOT NULL,
    stamps_used        INT NOT NULL,
    stamps_extra       INT NOT NULL DEFAULT 0,
    stamps_rolled_over_from_prev INT DEFAULT 0,
    stamps_rolling_to_next       INT DEFAULT 0,
    monthly_fee_mxn    NUMERIC(8,2) NOT NULL,
    extra_charge_mxn   NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_mxn          NUMERIC(8,2) NOT NULL,
    status             VARCHAR(16) NOT NULL DEFAULT 'PENDING',
                                                    -- PENDING | INVOICED | PAID | CANCELLED
    invoice_folio      VARCHAR(32),                 -- folio de la CFDI que emitimos al cliente
    generated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at            TIMESTAMP,
    UNIQUE (company_id, billing_period)
);
CREATE INDEX ON monthly_invoicing (billing_period);
CREATE INDEX ON monthly_invoicing (company_id, status);
```

Una fila por empresa por mes. Sirve para:
- Reporte histórico de facturación.
- Origen del CFDI que HCGM emite al cliente (self-billing).
- Auditoría de rollover.

### 3.3 Bolsa prepago del plan FLEX

Nueva tabla `prepaid_stamp_balance`:

```sql
CREATE TABLE prepaid_stamp_balance (
    company_id       UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    balance          INT NOT NULL DEFAULT 0,
    low_threshold    INT NOT NULL DEFAULT 5,        -- correo al llegar aquí
    zero_notified_at TIMESTAMP,                     -- para no spamear
    low_notified_at  TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Y bitácora de compras:

```sql
CREATE TABLE prepaid_stamp_purchases (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stamps_bought     INT NOT NULL,                 -- típico 30
    unit_price_mxn    NUMERIC(6,2) NOT NULL,        -- $4.99 default
    total_mxn         NUMERIC(8,2) NOT NULL,
    payment_method    VARCHAR(20),                  -- transferencia | efectivo | tarjeta
    payment_reference VARCHAR(64),
    granted_by        UUID REFERENCES users(id),
    granted_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 4. Endpoints nuevos (SUPER_ADMIN)

### Consumo y facturación

```
GET  /admin/billing/current-month          → lista de empresas con estado del mes en curso
GET  /admin/billing/history?year=2026      → matriz por mes por empresa
POST /admin/billing/close-month            → cierra el mes: calcula rollover + genera monthly_invoicing
                                            (idempotente, solo la primera vez del mes)
GET  /admin/billing/company/:id/history    → detalle histórico de una empresa
PATCH /admin/billing/:id/mark-paid         → marca un cargo como PAID
```

### Prepago FLEX

```
GET  /admin/prepaid/balances               → todas las empresas FLEX con saldo actual
POST /admin/prepaid/:companyId/recharge    → suma un bloque al saldo (registra compra)
                                            body: { stamps_bought, unit_price_mxn, payment_reference }
PATCH /admin/prepaid/:companyId/threshold  → ajusta low_threshold
```

### Validación de timbrado

En `stampInvoice` del `pac.service`, ANTES de llamar al PAC:

```
if (company.plan === FLEX) {
  if (prepaid_balance < 1) throw ValidationError('Sin timbres prepago');
}
// después de timbrar exitoso:
if (company.plan === FLEX) {
  UPDATE prepaid_stamp_balance SET balance = balance - 1
  if (balance <= low_threshold && !low_notified_at) → mail alerta
  if (balance == 0) → mail bloqueo + notified_at
}
```

---

## 5. UI SUPER_ADMIN

### Nuevo menú (después de "Paquetes fiscales")

```
🧾 Paquetes fiscales           (ya existe)
💰 Facturación y consumo       ← NUEVO
🛒 Compras prepago             ← NUEVO (subitem o vista aparte)
```

### 5.1 Facturación y consumo — vista principal

Tabla con filtro por mes:

| RFC | Empresa | Plan | Cap+Roll | Usados | Extras | Renta | Extra $ | Total | Estado |
|---|---|---|---|---|---|---|---|---|---|
| EKU… | Escuela Kemper | PKG_200 | 200+40=240 | 180 | 0 | $699 | $0 | $699 | PENDING |
| GHC… | Grupo HCGM | PKG_100 | 100+15=115 | 130 | 15 | $399 | $37.50 | $436.50 | INVOICED |
| SAJ… | Servicios Jomar | FLEX | prepago 27 | 3 | — | — | — | — | (prepago) |

Botones:
- **Cerrar mes** (naranja, big) — corre el job manualmente (o esperar al día 1).
- **Ver histórico** por empresa — modal con tabla mes por mes.
- **Marcar pagado** por fila — cambia estado a PAID.
- **Descargar CFDI** que HCGM emitió al cliente (link al invoice_folio).

### 5.2 Compras prepago

Tabla:

| RFC | Empresa | Saldo | Umbral aviso | Última recarga | Compras totales | Acciones |
|---|---|---|---|---|---|---|
| SAJ… | Servicios Jomar | **3** ⚠ | 5 | 2026-06-15 (30) | 90 | [+ Recargar] |

Botón **Recargar** abre modal:
```
Timbres a agregar: [ 30  ]
Precio unitario:   [ $4.99 ]
Total:             $149.70 + IVA
Referencia pago:   [                   ]  (folio SPEI, etc.)
Método:            [ ▼ Transferencia   ]

[ Cancelar ]  [ Registrar recarga ]
```

Historial: link "Ver compras" abre lista de `prepaid_stamp_purchases`.

---

## 6. Jobs automáticos

### Job 1 — Cierre mensual (`monthly-close.job.ts`)

Corre el **día 1 de cada mes a las 03:00** (cron o Render Cron Jobs).

Para cada empresa NO FLEX:
1. Cuenta timbres usados en el mes anterior.
2. Calcula `stamps_extra = max(0, used - (cap + roll_previo))`.
3. Calcula `roll_nuevo = max(0, (cap + roll_previo) - used)`.
4. Inserta `monthly_invoicing` con desglose.
5. Actualiza `companies.carried_over_stamps = roll_nuevo`.
6. Envía correo al cliente con el CFDI de cobro (opcional en fase 2).

Es **idempotente**: usa `ON CONFLICT (company_id, billing_period) DO NOTHING`.

### Job 2 — Alerta prepago (`prepaid-alert.job.ts`)

Corre cada **hora**. Para cada empresa FLEX:
- Si `balance == 0` y `zero_notified_at IS NULL` → correo urgente + set flag.
- Si `balance <= low_threshold` y `low_notified_at IS NULL` → correo aviso + set flag.
- Al recargar (balance > threshold+5) → limpiar los flags para volver a poder notificar.

### Job 3 — Recordatorio de mensualidad (opcional)

Cada día 10 del mes, correos automáticos a empresas con `monthly_invoicing.status='INVOICED'` y sin `paid_at`.

---

## 7. Correos automáticos (templates)

Usan el módulo `mailer.service` existente. Tres tipos:

### `prepaid_low`
```
Asunto: Timbres prepago casi agotados — {rfc}
Cuerpo: Actualmente te quedan {balance} timbres del bloque de {last_purchase}.
        Para no interrumpir tu operación, comunícate con nosotros para recargar.
        Facturación: facturas@hcgm.com.mx · WhatsApp: [número]
```

### `prepaid_zero`
```
Asunto: URGENTE — Timbrado detenido, sin saldo prepago
Cuerpo: El timbrado ha sido bloqueado. Recarga para continuar operando.
```

### `monthly_bill`
```
Asunto: Cargo del mes {YYYY-MM} — {business_name}
Cuerpo: Renta plan {PKG_XXX}: ${monthly_fee}
        Extras ({stamps_extra} × ${extra_stamp_mxn}): ${extra_charge_mxn}
        ─────────────────────────
        TOTAL: ${total_mxn}
        (Adjunto: CFDI emitida por HCGM)
```

---

## 8. Fases de implementación

**Fase 1 — Datos y contadores** (foundational, 1 día)
- 2 migraciones: rollover en `companies` + tabla `prepaid_stamp_balance`.
- Ampliar `v_stamp_usage_current` para incluir `carried_over_stamps` y `cap_efectivo`.
- Backend: helper `getCompanyEffectiveCap(companyId)` reutilizable.

**Fase 2 — UI SUPER_ADMIN de consumo** (½ día)
- Página "Facturación y consumo" (read-only + botón cerrar mes).
- Modal "Ver histórico".

**Fase 3 — Prepago FLEX** (1 día)
- Migración `prepaid_stamp_balance` + `prepaid_stamp_purchases`.
- Endpoint recarga.
- Validación en `stampInvoice` (bloqueo si saldo = 0).
- Página "Compras prepago" con modal de recarga.

**Fase 4 — Job cierre mensual** (½ día)
- Script `monthly-close.job.ts` + Cron en Render.
- Endpoint `POST /admin/billing/close-month` para dispararlo manualmente.
- Tabla `monthly_invoicing` con historia.

**Fase 5 — Correos** (½ día)
- Job `prepaid-alert.job.ts` que corre cada hora.
- Templates HTML + integración con `sendInvoiceMail`.

**Total estimado**: ~3.5 días de trabajo. Se puede hacer por fases sin
bloquear producción — cada fase entrega valor por sí sola.

---

## 9. Preguntas de decisión (para el usuario)

Antes de arrancar la implementación, definir:

1. **Rollover al cambiar de plan** — ¿se cancela o se conserva el saldo acumulado?
2. **Facturación al cliente** — ¿la CFDI de cobro la emite HCGM automáticamente desde el ERP, o se registra manualmente el folio en `monthly_invoicing.invoice_folio`?
3. **Precio prepago** — ¿$4.99 fijo o variable por empresa?
4. **Umbral de alerta prepago** — ¿5 timbres por default o configurable por empresa?
5. **Bloqueo con saldo 0** — ¿bloqueo total o "gracia" de 3 timbres cortesía antes de bloqueo real?
6. **Job de cierre mensual** — ¿día 1 a las 03:00 o esperar hasta el día 5 (por si hay ajustes de fin de mes)?

Cuando definas estas 6, puedo empezar la Fase 1.
