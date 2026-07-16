-- ============================================================================
-- BITÁCORA DE ACTIVIDAD DE USUARIOS + monitoreo confidencial
--
-- Ancla contractual: cláusula SEXTA del contrato de prestación de servicios
-- (ver modules/contracts/contract-text.ts). Esa cláusula dice que el sistema
-- registra la actividad de CADA usuario, y que EL CLIENTE puede activar el
-- envío de reportes periódicos al correo que designe.
--
-- Por eso el diseño separa dos cosas que suelen confundirse:
--   · SE REGISTRA A TODOS  → user_activity_log. Es auditoría fiscal y de
--     seguridad, no vigilancia opcional. Además, si el monitoreo se activa
--     después, el historial previo ya está.
--   · EL REPORTE ES OPT-IN → users.monitoring_enabled / monitoring_email.
--     El interruptor controla a quién se le manda el resumen, no si se graba.
--
-- No se usa audit_log (2026-06-22) porque aquella tabla es de acciones
-- administrativas de plataforma, no lleva company_id y mezclarlas haría que
-- un reporte por empresa tuviera que filtrar por usuario a mano.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ts           TIMESTAMP NOT NULL DEFAULT NOW(),

    company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email   VARCHAR(255),            -- se copia: si el usuario se borra, la bitácora sobrevive
    user_role    VARCHAR(20),

    action       VARCHAR(64)  NOT NULL,   -- INVOICE_CREATED, INVOICE_STAMPED, ...
    entity       VARCHAR(32),             -- 'invoice' | 'customer' | 'payment' | ...
    entity_id    VARCHAR(64),
    method       VARCHAR(8),              -- POST | PUT | PATCH | DELETE
    path         VARCHAR(255),
    status_code  INTEGER,

    ip           VARCHAR(64),
    user_agent   VARCHAR(255),
    payload      JSONB                    -- metadatos sin secretos (audit sanitiza)
);

-- El reporte mensual filtra por empresa + rango de fechas; el detalle, por usuario.
CREATE INDEX IF NOT EXISTS idx_user_activity_company_ts ON user_activity_log(company_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_ts    ON user_activity_log(user_id, ts DESC);

-- ─── Monitoreo por usuario (opt-in del reporte) ─────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monitoring_email   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS monitoring_set_by  UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS monitoring_set_at  TIMESTAMP;

-- No se puede activar el monitoreo sin decir a dónde se manda el reporte:
-- un monitoreo sin destinatario es un interruptor que no hace nada.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_monitoring_email;
ALTER TABLE users ADD CONSTRAINT chk_monitoring_email
    CHECK (monitoring_enabled = FALSE OR monitoring_email IS NOT NULL);
