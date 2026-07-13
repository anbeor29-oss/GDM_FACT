/**
 * pos.service — Punto de Venta (ventas de mostrador, contado).
 *
 * Reglas:
 *  · Solo contado: EFECTIVO o TARJETA. Los clientes a crédito se facturan en
 *    el módulo de Facturas (no aquí).
 *  · Precio de MAYOREO: si la cantidad de una línea >= companies.pos_mayoreo_min_qty
 *    (default 4) y el producto tiene `wholesale_price`, se cobra ese precio.
 *    Si no, precio de menudeo (`base_price`).
 *  · Al confirmar la venta se DECREMENTA el stock (products.stock_quantity)
 *    dentro de la misma transacción.
 *  · EFECTIVO calcula cambio = recibido − total (rechaza si recibido < total).
 */

import { query, transaction, transactionQuery } from '../../config/database';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import logger from '../../middleware/logger';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface POSCartItem {
  productId: string;
  quantity: number;
}
export interface CreateSaleInput {
  items: POSCartItem[];
  paymentMethod: 'EFECTIVO' | 'TARJETA';
  amountTendered?: number;   // requerido si EFECTIVO
  cardRef?: string;          // últimos 4 / referencia terminal (TARJETA)
  customerName?: string;
  soldBy?: string;
}

/**
 * Catálogo para el POS: productos activos con stock y ambos precios.
 * `search` filtra por nombre/SKU/clave. Devuelve el umbral de mayoreo de la
 * empresa para que el front calcule el precio en vivo.
 */
export async function getPOSCatalog(companyId: string, search?: string) {
  const cfg = await query<{ pos_mayoreo_min_qty: number }>(
    `SELECT pos_mayoreo_min_qty FROM companies WHERE id = $1`,
    [companyId]
  );
  const mayoreoMinQty = Number(cfg.rows[0]?.pos_mayoreo_min_qty) || 4;

  const params: any[] = [companyId];
  let where = `company_id = $1 AND deleted_at IS NULL AND is_active = true`;
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    where += ` AND (name ILIKE $${params.length} OR sku ILIKE $${params.length} OR clave_sat ILIKE $${params.length})`;
  }
  const prods = await query<any>(
    `SELECT id, sku, name, clave_sat, unit_code, base_price, wholesale_price,
            tax_rate, is_exempt, stock_quantity
       FROM products
      WHERE ${where}
      ORDER BY name ASC
      LIMIT 300`,
    params
  );

  return {
    mayoreo_min_qty: mayoreoMinQty,
    products: prods.rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      clave_sat: p.clave_sat,
      unit_code: p.unit_code,
      retail_price: Number(p.base_price) || 0,
      wholesale_price: p.wholesale_price != null ? Number(p.wholesale_price) : null,
      tax_rate: p.is_exempt ? 0 : (Number(p.tax_rate) || 0),
      is_exempt: !!p.is_exempt,
      stock: Number(p.stock_quantity) || 0,
    })),
  };
}

/**
 * Crea una venta POS: valida stock, aplica mayoreo por línea, calcula
 * impuestos y cambio, decrementa inventario e inserta venta + items en una
 * transacción. Devuelve el ticket.
 */
export async function createSale(companyId: string, data: CreateSaleInput) {
  if (!data.items || data.items.length === 0) {
    throw new ValidationError('La venta no tiene artículos');
  }
  if (data.paymentMethod !== 'EFECTIVO' && data.paymentMethod !== 'TARJETA') {
    throw new ValidationError('Método de pago inválido (EFECTIVO | TARJETA)');
  }

  return transaction(async (client) => {
    // Umbral de mayoreo
    const cfgR = await transactionQuery<{ pos_mayoreo_min_qty: number }>(
      client, `SELECT pos_mayoreo_min_qty FROM companies WHERE id = $1`, [companyId]
    );
    const minQty = Number(cfgR.rows[0]?.pos_mayoreo_min_qty) || 4;

    let subtotal = 0, tax = 0;
    const lines: any[] = [];

    for (const it of data.items) {
      if (!it.quantity || it.quantity <= 0) {
        throw new ValidationError('Cantidad inválida en un artículo');
      }
      const pR = await transactionQuery<any>(
        client,
        `SELECT id, sku, name, base_price, wholesale_price, tax_rate, is_exempt,
                stock_quantity
           FROM products
          WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
        [it.productId, companyId]
      );
      const p = pR.rows[0];
      if (!p) throw new NotFoundError(`Producto ${it.productId} no encontrado`);

      const stock = Number(p.stock_quantity) || 0;
      if (stock < it.quantity) {
        throw new ValidationError(
          `Stock insuficiente de "${p.name}": disponibles ${stock}, se pidieron ${it.quantity}`
        );
      }

      // Precio: mayoreo si qty >= umbral y hay precio de mayoreo
      const isWholesale =
        it.quantity >= minQty && p.wholesale_price != null && Number(p.wholesale_price) > 0;
      const unitPrice = isWholesale ? Number(p.wholesale_price) : Number(p.base_price) || 0;
      const rate = p.is_exempt ? 0 : (Number(p.tax_rate) || 0);

      const lineSubtotal = r2(it.quantity * unitPrice);
      const lineTax = r2(lineSubtotal * rate);
      const lineTotal = r2(lineSubtotal + lineTax);

      subtotal += lineSubtotal;
      tax += lineTax;

      lines.push({
        product_id: p.id, sku: p.sku, description: p.name,
        quantity: it.quantity, unit_price: unitPrice, is_wholesale: isWholesale,
        tax_rate: rate, line_subtotal: lineSubtotal, line_tax: lineTax, line_total: lineTotal,
      });

      // Decrementar stock
      await transactionQuery(
        client,
        `UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3`,
        [it.quantity, p.id, companyId]
      );
    }

    subtotal = r2(subtotal);
    tax = r2(tax);
    const total = r2(subtotal + tax);

    // Cobro
    let amountTendered: number | null = null;
    let change = 0;
    if (data.paymentMethod === 'EFECTIVO') {
      amountTendered = Number(data.amountTendered) || 0;
      if (amountTendered < total - 0.001) {
        throw new ValidationError(
          `Efectivo recibido ($${amountTendered.toFixed(2)}) es menor al total ($${total.toFixed(2)})`
        );
      }
      change = r2(amountTendered - total);
    }

    // Folio POS
    const folioR = await transactionQuery<{ folio: number }>(
      client,
      `UPDATE companies SET next_pos_folio = next_pos_folio + 1, updated_at = NOW()
        WHERE id = $1 RETURNING (next_pos_folio - 1) AS folio`,
      [companyId]
    );
    const folio = folioR.rows[0].folio;

    const saleR = await transactionQuery<any>(
      client,
      `INSERT INTO pos_sales
         (company_id, folio, customer_name, subtotal, tax, total,
          payment_method, amount_tendered, change_given, card_ref, sold_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, folio, created_at`,
      [
        companyId, folio, data.customerName?.trim() || 'Público en general',
        subtotal, tax, total, data.paymentMethod,
        amountTendered, change, data.cardRef?.trim() || null, data.soldBy || null,
      ]
    );
    const sale = saleR.rows[0];

    for (const l of lines) {
      await transactionQuery(
        client,
        `INSERT INTO pos_sale_items
           (sale_id, product_id, sku, description, quantity, unit_price,
            is_wholesale, tax_rate, line_subtotal, line_tax, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [sale.id, l.product_id, l.sku, l.description, l.quantity, l.unit_price,
         l.is_wholesale, l.tax_rate, l.line_subtotal, l.line_tax, l.line_total]
      );
    }

    logger.info(`Venta POS #${folio} creada: $${total} (${data.paymentMethod})`);

    return {
      id: sale.id,
      folio: sale.folio,
      created_at: sale.created_at,
      customer_name: data.customerName?.trim() || 'Público en general',
      payment_method: data.paymentMethod,
      subtotal, tax, total,
      amount_tendered: amountTendered,
      change_given: change,
      card_ref: data.cardRef?.trim() || null,
      items: lines,
    };
  });
}

/** Lista las ventas POS recientes (para historial/corte). */
export async function listSales(companyId: string, opts: { limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  const r = await query<any>(
    `SELECT s.id, s.folio, s.customer_name, s.subtotal, s.tax, s.total,
            s.payment_method, s.change_given, s.status, s.created_at,
            u.email AS sold_by_email,
            (SELECT COUNT(*)::int FROM pos_sale_items i WHERE i.sale_id = s.id) AS item_count
       FROM pos_sales s
       LEFT JOIN users u ON u.id = s.sold_by
      WHERE s.company_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2`,
    [companyId, limit]
  );
  return r.rows;
}

/** Corte del día: totales por método de pago para una fecha (default hoy). */
export async function getDailySummary(companyId: string, date?: string) {
  const day = date || new Date().toISOString().slice(0, 10);
  const r = await query<any>(
    `SELECT payment_method,
            COUNT(*)::int AS sales,
            COALESCE(SUM(total), 0)::numeric AS total
       FROM pos_sales
      WHERE company_id = $1 AND status = 'COMPLETED'
        AND created_at::date = $2::date
      GROUP BY payment_method`,
    [companyId, day]
  );
  const byMethod: Record<string, { sales: number; total: number }> = {};
  let grandTotal = 0, grandSales = 0;
  for (const row of r.rows) {
    byMethod[row.payment_method] = { sales: Number(row.sales), total: Number(row.total) };
    grandTotal += Number(row.total);
    grandSales += Number(row.sales);
  }
  return { date: day, by_method: byMethod, total: r2(grandTotal), sales: grandSales };
}
