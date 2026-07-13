/**
 * Punto de Venta (POS) — venta de mostrador al contado.
 *
 * · Busca productos del almacén, arma un carrito y cobra en EFECTIVO o TARJETA.
 * · Precio de MAYOREO automático: si la cantidad de una línea ≥ umbral de la
 *   empresa (default 4), se cobra el precio de mayoreo (si el producto lo tiene).
 * · Clientes a crédito → se facturan en el módulo de Facturas (no aquí).
 * · Al cobrar, el backend descuenta el inventario y devuelve el ticket.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Store, Search, Plus, Minus, Trash2, Banknote, CreditCard, X,
  ShoppingCart, Loader2, CheckCircle, Package, Tag,
} from 'lucide-react';
import api from '@/services/api';

const money = (n: any) =>
  Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CatalogProduct {
  id: string; sku: string; name: string; unit_code: string;
  retail_price: number; wholesale_price: number | null;
  tax_rate: number; is_exempt: boolean; stock: number;
}
interface CartLine { product: CatalogProduct; qty: number; }

export function PointOfSalePage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [ticket, setTicket] = useState<any>(null);

  const catalogQ = useQuery({
    queryKey: ['pos-catalog', search],
    queryFn: () => api.posCatalog(search || undefined),
  });
  const mayoreoMinQty = Number(catalogQ.data?.data?.mayoreo_min_qty) || 4;
  const products: CatalogProduct[] = catalogQ.data?.data?.products || [];

  const addToCart = (p: CatalogProduct) => {
    if (p.stock <= 0) return;
    setCart((prev) => {
      const ix = prev.findIndex((l) => l.product.id === p.id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], qty: Math.min(next[ix].qty + 1, p.stock) };
        return next;
      }
      return [...prev, { product: p, qty: 1 }];
    });
  };
  const setQty = (id: string, qty: number) =>
    setCart((prev) => prev.flatMap((l) => {
      if (l.product.id !== id) return [l];
      const q = Math.max(0, Math.min(qty, l.product.stock));
      return q === 0 ? [] : [{ ...l, qty: q }];
    }));
  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  // Precio aplicado por línea (mayoreo si qty ≥ umbral y hay precio de mayoreo)
  const priced = useMemo(() => cart.map((l) => {
    const isWholesale = l.qty >= mayoreoMinQty && l.product.wholesale_price != null && l.product.wholesale_price > 0;
    const unit = isWholesale ? (l.product.wholesale_price as number) : l.product.retail_price;
    const sub = Math.round(l.qty * unit * 100) / 100;
    const tax = Math.round(sub * l.product.tax_rate * 100) / 100;
    return { ...l, isWholesale, unit, sub, tax, total: Math.round((sub + tax) * 100) / 100 };
  }), [cart, mayoreoMinQty]);

  const subtotal = priced.reduce((s, l) => s + l.sub, 0);
  const tax = priced.reduce((s, l) => s + l.tax, 0);
  const total = Math.round((subtotal + tax) * 100) / 100;

  const clearSale = () => { setCart([]); setPayOpen(false); };

  if (ticket) {
    return <Ticket sale={ticket} onNew={() => { setTicket(null); clearSale(); }} />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)]">
      {/* ── Catálogo ── */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Store className="text-emerald-600" size={24} />
          <h1 className="text-xl font-bold text-gray-900">Punto de Venta</h1>
          <div className="relative flex-1 max-w-md ml-auto">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre, SKU o clave…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {catalogQ.isLoading ? (
            <p className="text-center text-gray-400 py-10">Cargando catálogo…</p>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <Package className="mx-auto mb-2" size={32} />
              No hay productos. Da de alta productos en el módulo Productos.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map((p) => {
                const noStock = p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={noStock}
                    onClick={() => addToCart(p)}
                    className={`text-left border rounded-lg p-3 transition-shadow ${
                      noStock ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:shadow-md hover:border-emerald-300 bg-white'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-900 line-clamp-2 min-h-[2.5rem]">{p.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-lg font-bold text-emerald-700">${money(p.retail_price)}</span>
                      <span className={`text-[10px] font-semibold ${noStock ? 'text-red-500' : 'text-gray-400'}`}>
                        {noStock ? 'Sin stock' : `${p.stock} disp.`}
                      </span>
                    </div>
                    {p.wholesale_price != null && p.wholesale_price > 0 && (
                      <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                        <Tag size={10} /> Mayoreo ${money(p.wholesale_price)} (≥{mayoreoMinQty})
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Carrito ── */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-lg shadow border overflow-hidden">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="text-emerald-600" size={20} />
          <h2 className="font-bold text-gray-900">Venta actual</h2>
          <span className="ml-auto text-xs text-gray-500">Mayoreo desde {mayoreoMinQty} pz</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {priced.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">
              Toca un producto para agregarlo a la venta.
            </p>
          ) : priced.map((l) => (
            <div key={l.product.id} className="border rounded-lg p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 flex-1">{l.product.name}</p>
                <button onClick={() => removeLine(l.product.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(l.product.id, l.qty - 1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={12} /></button>
                  <input
                    type="number" min={1} max={l.product.stock} value={l.qty}
                    onChange={(e) => setQty(l.product.id, parseInt(e.target.value || '0', 10))}
                    className="w-12 text-center border rounded py-0.5 text-sm"
                  />
                  <button onClick={() => setQty(l.product.id, l.qty + 1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={12} /></button>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${money(l.total)}</p>
                  <p className="text-[10px] text-gray-500">
                    {l.qty} × ${money(l.unit)}
                    {l.isWholesale && <span className="ml-1 text-amber-600 font-semibold">MAYOREO</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totales + cobrar */}
        <div className="border-t p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${money(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-gray-600"><span>IVA</span><span>${money(tax)}</span></div>
          <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2"><span>Total</span><span>${money(total)}</span></div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={clearSale}
              disabled={cart.length === 0}
              className="py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 text-sm"
            >Cancelar</button>
            <button
              onClick={() => setPayOpen(true)}
              disabled={cart.length === 0}
              className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-40 text-sm"
            >Cobrar ${money(total)}</button>
          </div>
        </div>
      </div>

      {payOpen && (
        <PaymentModal
          total={total}
          items={cart.map((l) => ({ productId: l.product.id, quantity: l.qty }))}
          onClose={() => setPayOpen(false)}
          onDone={(sale) => setTicket(sale)}
        />
      )}
    </div>
  );
}

/* ─────────────── Modal de cobro ─────────────── */

function PaymentModal({
  total, items, onClose, onDone,
}: {
  total: number;
  items: { productId: string; quantity: number }[];
  onClose: () => void;
  onDone: (sale: any) => void;
}) {
  const [method, setMethod] = useState<'EFECTIVO' | 'TARJETA'>('EFECTIVO');
  const [tendered, setTendered] = useState<number>(total);
  const [cardRef, setCardRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const change = Math.max(0, Math.round((tendered - total) * 100) / 100);
  const quickCash = [total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500]
    .filter((v, i, a) => a.indexOf(v) === i);

  const submit = async () => {
    setError('');
    if (method === 'EFECTIVO' && tendered < total) {
      setError('El efectivo recibido es menor al total.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.posCreateSale({
        items, paymentMethod: method,
        amountTendered: method === 'EFECTIVO' ? tendered : undefined,
        cardRef: method === 'TARJETA' ? cardRef || undefined : undefined,
        customerName: customerName || undefined,
      });
      onDone(r.data);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-gray-900">Cobrar venta</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
            <p className="text-xs text-emerald-700 uppercase tracking-wide">Total a cobrar</p>
            <p className="text-3xl font-bold text-emerald-800">${money(total)}</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMethod('EFECTIVO')}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold ${method === 'EFECTIVO' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'}`}
            ><Banknote size={18} /> Efectivo</button>
            <button
              onClick={() => setMethod('TARJETA')}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-semibold ${method === 'TARJETA' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
            ><CreditCard size={18} /> Tarjeta</button>
          </div>

          {method === 'EFECTIVO' ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 block mb-1">Efectivo recibido</span>
                <input
                  type="number" min={0} step="0.01" value={tendered}
                  onChange={(e) => setTendered(parseFloat(e.target.value || '0'))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-right text-lg font-mono"
                />
              </label>
              <div className="flex gap-1 flex-wrap">
                {quickCash.map((v) => (
                  <button key={v} onClick={() => setTendered(v)}
                    className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">${money(v)}</button>
                ))}
              </div>
              <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-600">Cambio</span>
                <span className="text-2xl font-bold text-gray-900">${money(change)}</span>
              </div>
            </>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-gray-700 block mb-1">Referencia / últimos 4 (opcional)</span>
              <input
                value={cardRef} onChange={(e) => setCardRef(e.target.value)}
                placeholder="•••• 1234"
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700 block mb-1">Cliente (opcional)</span>
            <input
              value={customerName} onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Público en general"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t bg-gray-50">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">Cancelar</button>
          <button onClick={submit} disabled={busy} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {busy ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Ticket ─────────────── */

function Ticket({ sale, onNew }: { sale: any; onNew: () => void }) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
        <div className="bg-emerald-600 text-white p-5 text-center">
          <CheckCircle className="mx-auto mb-2" size={40} />
          <h2 className="text-xl font-bold">Venta registrada</h2>
          <p className="text-emerald-100 text-sm">Ticket #{String(sale.folio).padStart(6, '0')}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>{new Date(sale.created_at).toLocaleString('es-MX')}</span>
            <span>{sale.customer_name}</span>
          </div>
          <div className="divide-y">
            {sale.items.map((it: any, i: number) => (
              <div key={i} className="py-2 flex justify-between text-sm">
                <div>
                  <p className="text-gray-800">{it.description}</p>
                  <p className="text-[11px] text-gray-500">
                    {Number(it.quantity)} × ${money(it.unit_price)}
                    {it.is_wholesale && <span className="ml-1 text-amber-600 font-semibold">MAYOREO</span>}
                  </p>
                </div>
                <span className="font-semibold">${money(it.line_total)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>IVA</span><span>${money(sale.tax)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>${money(sale.total)}</span></div>
            <div className="flex justify-between text-sm text-gray-600 pt-1">
              <span>Pago</span>
              <span>{sale.payment_method === 'EFECTIVO' ? 'Efectivo' : 'Tarjeta'}</span>
            </div>
            {sale.payment_method === 'EFECTIVO' && (
              <>
                <div className="flex justify-between text-sm text-gray-600"><span>Recibido</span><span>${money(sale.amount_tendered)}</span></div>
                <div className="flex justify-between text-sm font-semibold text-emerald-700"><span>Cambio</span><span>${money(sale.change_given)}</span></div>
              </>
            )}
          </div>
        </div>
        <div className="p-4 border-t">
          <button onClick={onNew} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

export default PointOfSalePage;
