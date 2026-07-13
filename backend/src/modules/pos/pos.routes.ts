/**
 * /pos — Punto de Venta. Solo usuarios cuyo grupo tenga acceso al módulo POS
 * (VENTAS o ADMIN_ALL); SUPER_ADMIN opera plataforma, no vende.
 *
 *  GET  /pos/catalog?search=   productos con stock + precios + umbral mayoreo
 *  POST /pos/sales             crea venta (efectivo/tarjeta) y decrementa stock
 *  GET  /pos/sales             historial de ventas
 *  GET  /pos/summary?date=     corte del día por método de pago
 */
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middleware/authentication';
import { asyncHandler, ValidationError } from '../../middleware/errorHandler';
import { requireModule } from '../../middleware/permissions';
import * as posService from './pos.service';

const router = Router();
router.use(authenticateToken);
router.use(requireModule('pos'));

function companyId(req: Request): string {
  if (!req.user?.companyId) throw new ValidationError('Company ID is required');
  return req.user.companyId;
}

router.get('/catalog', asyncHandler(async (req: Request, res: Response) => {
  const data = await posService.getPOSCatalog(companyId(req), String(req.query.search || ''));
  res.status(200).json({ success: true, data });
}));

router.post('/sales', asyncHandler(async (req: Request, res: Response) => {
  const sale = await posService.createSale(companyId(req), {
    items: req.body?.items,
    paymentMethod: req.body?.paymentMethod,
    amountTendered: req.body?.amountTendered,
    cardRef: req.body?.cardRef,
    customerName: req.body?.customerName,
    soldBy: req.user?.userId,
  });
  res.status(201).json({ success: true, message: `Venta #${sale.folio} registrada`, data: sale });
}));

router.get('/sales', asyncHandler(async (req: Request, res: Response) => {
  const list = await posService.listSales(companyId(req), {
    limit: parseInt(String(req.query.limit || '50'), 10),
  });
  res.status(200).json({ success: true, data: { count: list.length, sales: list } });
}));

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const s = await posService.getDailySummary(companyId(req), String(req.query.date || ''));
  res.status(200).json({ success: true, data: s });
}));

export default router;
