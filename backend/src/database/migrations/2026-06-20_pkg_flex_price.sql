-- ============================================================================
-- Actualiza el precio del plan de uso libre (PKG_FLEX) a $4.99 MXN por timbre.
-- (Precio anterior: $2.00). Idempotente — solo modifica el registro existente.
-- ============================================================================

-- Guard: si stamp_packages aún no existe (fresh install), no-op —
-- 2026-07-01_stamp_packages.sql la crea después y el precio ya nace correcto.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stamp_packages') THEN
    UPDATE stamp_packages SET extra_stamp_mxn = 4.99 WHERE code = 'PKG_FLEX';
  END IF;
END $$;
