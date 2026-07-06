/**
 * Página pública de inicio — se muestra ANTES del login.
 *
 * Contiene:
 *   · Hero con nombre del sistema y CTA "Iniciar sesión"
 *   · Los 4 planes de timbrado (misma info que /admin/packages)
 *   · Sección de módulos y features (CIF, XML, PDF, timbrado real)
 *   · CTA final para entrar al sistema
 *
 * Ruta: `/` (redirige a `/dashboard` o `/admin/companies` si ya hay sesión).
 */
import { Link } from 'react-router-dom';
import {
  Sparkles, Zap, Star, Rocket, Coins, Check,
  FileText, ScanText, FileUp, FileMinus2, Users, Boxes, BarChart3,
  ShieldCheck, LogIn,
} from 'lucide-react';

const PLANS = [
  {
    code: 'PKG_100', name: 'Esencial',
    price: '$399', stamps: 100, extra: '$2.50',
    color: 'emerald', highlight: false,
    icon: <Zap size={28} className="text-emerald-600" />,
    bullets: [
      '100 timbres CFDI 4.0 al mes',
      'Reportes de cobranza, ventas y fiscal',
      'Notas de crédito y complementos de pago',
      'Multi-usuario (Admin + operativos)',
    ],
  },
  {
    code: 'PKG_200', name: 'Pyme',
    price: '$699', stamps: 200, extra: '$2.25',
    color: 'indigo', highlight: true,
    icon: <Star size={28} className="text-indigo-600" />,
    bullets: [
      '200 timbres CFDI 4.0 al mes',
      'Todo lo del plan Esencial',
      'Importación de XMLs recibidos',
      'Gestión de proveedores',
      'Reporte de cobranza detallado',
    ],
  },
  {
    code: 'PKG_500', name: 'Empresarial',
    price: '$1,399', stamps: 500, extra: '$2.00',
    color: 'violet', highlight: false,
    icon: <Rocket size={28} className="text-violet-600" />,
    bullets: [
      '500 timbres CFDI 4.0 al mes',
      'Todo lo del plan Pyme',
      'Prioridad en soporte',
      'Backup mensual SAT en ZIP',
      'Multi-empresa (multi-tenant)',
    ],
  },
  {
    code: 'PKG_FLEX', name: 'Uso libre',
    price: 'Sin renta', stamps: null, extra: '$4.99',
    color: 'slate', highlight: false,
    icon: <Coins size={28} className="text-slate-600" />,
    bullets: [
      'Sin renta mensual',
      'Timbre a $4.99 MXN + IVA',
      'Ideal para bajo volumen (< 30/mes)',
      'Sin compromiso de permanencia',
    ],
  },
];

const MODULES = [
  { icon: <ScanText size={22}/>,     title: 'Lector CIF',       desc: 'Sube el PDF de la Constancia de Situación Fiscal SAT y el sistema autollena RFC, razón social, régimen y CP.' },
  { icon: <FileUp size={22}/>,       title: 'Importar XMLs',    desc: 'Al leer un XML recibido, detecta si el emisor es cliente o proveedor y crea el catálogo automáticamente.' },
  { icon: <FileText size={22}/>,     title: 'Facturación CFDI 4.0', desc: 'Emisión con retenciones RESICO, honorarios, arrendamiento; timbrado real ante el SAT con PAC autorizado.' },
  { icon: <FileMinus2 size={22}/>,   title: 'Notas de crédito', desc: 'Aplica descuentos o cancelaciones con prorrateo automático de IVA. CFDI tipo E vinculado a la factura origen.' },
  { icon: <Users size={22}/>,        title: 'Clientes y Proveedores', desc: 'Catálogo con dirección fiscal, régimen, uso CFDI por defecto y saldo de cuenta.' },
  { icon: <Boxes size={22}/>,        title: 'Productos',        desc: 'Preset fiscal por producto (IVA 16, 8, 0, exento, RESICO, honorarios, IEPS). 52 mil claves SAT indexadas.' },
  { icon: <BarChart3 size={22}/>,    title: 'Reportes',         desc: 'Cobranza total, cobranza detallada por cliente con saldo > $0.20, ventas por período, fiscal y auditable.' },
  { icon: <ShieldCheck size={22}/>,  title: 'Compliance SAT',   desc: 'CSD cifrado con pgcrypto, bitácora inmutable 5 años, XML timbrado firmado por el SAT, PDF Anexo 20.' },
];

export function PublicHomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-md">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 tracking-tight leading-tight">Sistema de Facturación</p>
              <p className="text-xs text-slate-500 leading-tight">CFDI 4.0 México · HCGM</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow font-medium transition-colors"
          >
            <LogIn size={16} /> Iniciar sesión
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-12 md:py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight leading-tight">
          Facturación <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">CFDI 4.0</span><br/>
          sin complicaciones
        </h1>
        <p className="text-lg text-slate-600 mt-6 max-w-2xl mx-auto">
          Emite, timbra y respalda tus facturas ante el SAT. Importa XMLs recibidos,
          lee la Constancia de Situación Fiscal y genera PDFs listos para descarga en segundos.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-lg shadow-lg font-semibold text-base transition-transform hover:scale-105"
          >
            <LogIn size={18} /> Entrar al sistema
          </Link>
          <a
            href="#planes"
            className="inline-flex items-center gap-2 border-2 border-slate-300 hover:border-indigo-400 text-slate-700 px-8 py-3.5 rounded-lg font-semibold text-base transition-colors"
          >
            Ver planes
          </a>
        </div>
      </section>

      {/* Módulos */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-2">Módulos incluidos</h2>
        <p className="text-slate-600 text-center mb-10">Todo lo que necesita tu empresa en un solo sistema</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((m) => (
            <div key={m.title} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="w-11 h-11 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-3">
                {m.icon}
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{m.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-2">Planes de timbrado</h2>
        <p className="text-slate-600 text-center mb-10">Elige el plan que se adapta al volumen de tu operación</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.code}
              className={`bg-white rounded-xl border-2 p-5 flex flex-col relative overflow-hidden ${
                p.highlight
                  ? 'border-indigo-400 shadow-xl'
                  : 'border-slate-200 shadow-sm hover:shadow-md transition-shadow'
              }`}
            >
              {p.highlight && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                  Recomendado
                </div>
              )}
              <div className={`w-14 h-14 bg-${p.color}-50 rounded-xl flex items-center justify-center mb-3`}>
                {p.icon}
              </div>
              <h3 className={`text-xl font-bold text-${p.color}-700`}>{p.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-3">{p.code}</p>
              <div className="mb-1">
                <span className="text-3xl font-bold text-slate-900">{p.price}</span>
                {' '}
                <span className="text-sm text-slate-500">
                  MXN {p.stamps !== null ? '/ mes' : 'pay-per-stamp'}
                </span>
              </div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-4">Precios más IVA</p>

              {p.stamps !== null && (
                <div className={`bg-${p.color}-50 rounded-lg px-3 py-2 mb-4 flex items-center justify-between`}>
                  <span className="text-xs text-slate-600">Timbres/mes</span>
                  <span className={`font-bold text-${p.color}-700`}>{p.stamps}</span>
                </div>
              )}

              <ul className="space-y-1.5 flex-1 text-sm text-slate-700">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check size={16} className={`text-${p.color}-600 shrink-0 mt-0.5`} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-4 border-t border-slate-100 text-[11px] text-slate-500">
                Timbre extra: <b>{p.extra} MXN</b> <span className="text-slate-400">(+ IVA)</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-gradient-to-br from-indigo-600 to-blue-600 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">¿Listo para empezar?</h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-xl mx-auto">
            Ingresa al sistema para comenzar a emitir tus facturas. Si aún no tienes cuenta,
            contáctanos para elegir el plan que mejor te acomode.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-slate-50 px-10 py-4 rounded-lg shadow-lg font-bold text-lg transition-transform hover:scale-105"
          >
            <LogIn size={20} /> Entrar al sistema
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <p>© {new Date().getFullYear()} HCGM · Sistema de facturación CFDI 4.0</p>
          <p>PAC autorizado: SW Sapien · Anexo 20 SAT</p>
        </div>
      </footer>
    </div>
  );
}
