/**
 * /admin/billing — módulo de Facturación y Consumo para SUPER_ADMIN.
 *
 *  GET   /admin/billing/current-month           consumo del mes en curso por empresa
 *  GET   /admin/billing/history                 histórico de meses cerrados (todas)
 *  GET   /admin/billing/company/:id/history     histórico de UNA empresa
 *  POST  /admin/billing/close-month             dispara el cierre manualmente
 *  PATCH /admin/billing/:invoicingId/mark-paid  marca un cargo como pagado
 *
 * Todos protegidos por requireSuperAdmin.
 */
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/authentication';
import { asyncHandler, ValidationError, NotFoundError } from '../../middleware/errorHandler';
import { query } from '../../config/database';
import { requireSuperAdmin, audit } from './admin.middleware';
import * as closeMonthService from '../billing/close-month.service';

const router = Router();
router.use(authenticateToken);
router.use(requireSuperAdmin);

/* ─────────────── Consumo del mes en curso ─────────────── */

router.get('/current-month', asyncHandler(async (_req: Request, res: Response) => {
  // La vista v_stamp_usage_current ya agrega cap_efectivo, remaining y prepago.
  const r = await query<any>(
    `SELECT c.id, c.rfc, c.business_name,
            v.stamp_package_code, v.quota, v.carried_over_stamps,
            v.effective_cap, v.used_current_month, v.remaining,
            v.percent_used, v.monthly_fee_mxn, v.extra_stamp_mxn,
            v.is_prepaid, v.prepaid_balance, v.prepaid_low_threshold,
            -- Total estimado del mes (para vista, no persistido)
            CASE
              WHEN v.is_prepaid THEN 0
              ELSE v.monthly_fee_mxn +
                   GREATEST(0, v.used_current_month - v.effective_cap) * v.extra_stamp_mxn
            END::numeric(10,2) AS estimated_total_mxn
       FROM companies c
       JOIN v_stamp_usage_current v ON v.company_id = c.id
      ORDER BY c.business_name`
  );

  res.status(200).json({
    success: true,
    data: {
      count: r.rows.length,
      companies: r.rows,
    },
  });
}));

/* ─────────────── Histórico de meses cerrados (todas) ─────────────── */

router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
  const r = await query<any>(
    `SELECT mi.*, c.rfc, c.business_name,
            i.serie AS invoice_serie, i.folio AS invoice_folio_num
       FROM monthly_invoicing mi
       JOIN companies c ON c.id = mi.company_id
       LEFT JOIN invoices i ON i.id = mi.invoice_id
      WHERE EXTRACT(YEAR FROM mi.billing_period) = $1
      ORDER BY mi.billing_period DESC, c.business_name`,
    [year]
  );

  res.status(200).json({
    success: true,
    data: {
      year,
      count: r.rows.length,
      records: r.rows,
    },
  });
}));

/* ─────────────── Histórico por empresa ─────────────── */

router.get('/company/:id/history', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const compR = await query<any>(
    `SELECT id, rfc, business_name FROM companies WHERE id = $1`,
    [id]
  );
  if (compR.rows.length === 0) throw new NotFoundError('Empresa no encontrada');

  const r = await query<any>(
    `SELECT mi.*, i.serie AS invoice_serie, i.folio AS invoice_folio_num
       FROM monthly_invoicing mi
       LEFT JOIN invoices i ON i.id = mi.invoice_id
      WHERE mi.company_id = $1
      ORDER BY mi.billing_period DESC`,
    [id]
  );

  res.status(200).json({
    success: true,
    data: {
      company: compR.rows[0],
      count: r.rows.length,
      records: r.rows,
    },
  });
}));

/* ─────────────── Cerrar mes manualmente ─────────────── */

router.post('/close-month', asyncHandler(async (req: Request, res: Response) => {
  // Body opcional:
  //   period: "YYYY-MM"  (default = mes anterior al actual)
  const rawPeriod = String(req.body?.period || '').trim();
  let periodDate: Date;
  if (rawPeriod) {
    const m = rawPeriod.match(/^(\d{4})-(\d{2})$/);
    if (!m) {
      throw new ValidationError('period debe ser YYYY-MM (ej. "2026-06")');
    }
    periodDate = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, 1);
  } else {
    periodDate = closeMonthService.prevMonthStart();
  }

  const results = await closeMonthService.closeMonth({
    billingPeriod: periodDate,
    triggeredBy: req.user?.userId,
  });

  await audit(req, {
    action: 'billing.close_month',
    payload: {
      period: periodDate.toISOString().slice(0, 10),
      created: results.filter(r => r.action === 'created').length,
      total_companies: results.length,
    },
  } as any).catch(() => {});

  res.status(200).json({
    success: true,
    data: {
      period: periodDate.toISOString().slice(0, 10),
      total_processed: results.length,
      created: results.filter(r => r.action === 'created').length,
      skipped_exists: results.filter(r => r.action === 'skipped_exists').length,
      skipped_flex: results.filter(r => r.action === 'skipped_flex').length,
      results,
    },
  });
}));

/* ─────────────── Marcar cargo como pagado ─────────────── */

router.patch('/:invoicingId/mark-paid', asyncHandler(async (req: Request, res: Response) => {
  const { invoicingId } = req.params;
  const r = await query<any>(
    `UPDATE monthly_invoicing
        SET status = 'PAID', paid_at = NOW()
      WHERE id = $1 AND status != 'CANCELLED'
    RETURNING id, company_id, billing_period, total_mxn, status`,
    [invoicingId]
  );
  if (r.rows.length === 0) {
    throw new NotFoundError('Cargo mensual no encontrado o ya cancelado');
  }

  await audit(req, {
    action: 'billing.mark_paid',
    targetId: invoicingId,
    payload: r.rows[0],
  } as any).catch(() => {});

  res.status(200).json({ success: true, data: r.rows[0] });
}));

export default router;
