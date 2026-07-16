-- ============================================================================
-- TIMBRADO IDEMPOTENTE — reclamo atómico contra el doble timbrado
--
-- Problema: entre el `if (invoice.is_stamped)` de pac.service y el UPDATE que
-- lo marca hay una ventana de carrera. Dos peticiones simultáneas (doble toque,
-- o un reintento mientras la primera sigue en vuelo — cotidiano con datos
-- móviles) leen DRAFT las dos, llaman al PAC las dos y **gastan dos timbres**
-- para una sola factura. Un timbre consumido no se recupera: cancelar ante el
-- SAT no lo devuelve.
--
-- Solución: reclamo atómico. Antes de llamar al PAC, se intenta marcar la
-- factura con `UPDATE ... WHERE stamping_started_at IS NULL`. Postgres decide
-- el ganador: quien obtiene la fila llama al PAC; el otro recibe 409.
--
-- Por qué un TIMESTAMP y no un status 'STAMPING':
--   Medio sistema filtra con `status NOT IN ('CANCELLED','DRAFT')` — reportes,
--   dashboard, cobranza. Un estado nuevo contaría como venta real en todos
--   ellos y habría que auditar cada consulta. Una columna aparte no altera a
--   nadie: el status sigue siendo DRAFT hasta que el timbre existe de verdad.
--
-- Por qué se libera por antigüedad y no solo al terminar:
--   Si el proceso muere entre el reclamo y el PAC, la factura quedaría
--   reclamada para siempre y sería imposible timbrarla. El reclamo caduca a los
--   2 minutos (el timeout hacia el PAC es de 30s, así que 2 min es holgado).
-- ============================================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stamping_started_at TIMESTAMP;

COMMENT ON COLUMN invoices.stamping_started_at IS
  'Reclamo de timbrado en curso. NULL = libre. Caduca a los 2 min por si el '
  'proceso murió a media operación. No confundir con pac_timestamp (fecha real '
  'del timbre).';

-- Diagnóstico: encontrar reclamos colgados sin escanear la tabla entera.
CREATE INDEX IF NOT EXISTS idx_invoices_stamping_claim
    ON invoices(stamping_started_at)
    WHERE stamping_started_at IS NOT NULL;
