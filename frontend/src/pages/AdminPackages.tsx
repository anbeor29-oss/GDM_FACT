/**
 * Admin → Paquetes Fiscales.
 *  · Solo accesible para usuarios con rol ADMIN.
 *  · Filtros: compañía + rango de fechas + formato (XML / XML+PDF).
 *  · Descarga ZIP con MANIFEST.json auditable.
 *
 *  Llama a /archive/admin/invoices.zip que ya valida el rol del lado servidor;
 *  el guard del frontend es UX, no seguridad.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Building2, Calendar, Package } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/auth';

export function AdminPackagesPage() {
  const { user } = useAuthStore();
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom]           = useState(() => firstOfMonth());
  const [to, setTo]               = useState(() => todayISO());
  const [format, setFormat]       = useState<'xml' | 'both'>('xml');
  const [limit, setLimit]         = useState(100);
  const [error, setError]         = useState('');
  const [downloading, setDownloading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  // Si el backend aún no expone /companies, mostramos input UUID manual.
  const companiesQ = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.listCompanies(),
    enabled: isAdmin,
    retry: 0,
  });
  const companies = (companiesQ.data?.data?.companies || []) as Array<{
    id: string; rfc: string; business_name: string;
  }>;

  const handleDownload = async () => {
    setError('');
    if (!companyId) { setError('Selecciona o pega un companyId'); return; }
    setDownloading(true);
    try {
      const blob = await api.adminDownloadPackage({ companyId, from, to, format, limit });
      const fname = `paquete-${companyId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`;
      await api.downloadFile(blob, fname);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Error en la descarga');
    } finally {
      setDownloading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-lg">
        <p className="font-semibold mb-1">Acceso restringido</p>
        <p className="text-sm">Esta sección requiere rol <b>ADMIN</b>. Tu rol actual: <b>{user?.role}</b>.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="text-indigo-600" size={36} /> Paquetes fiscales
        </h1>
        <p className="text-gray-600 mt-2">
          Descarga ZIP con los XML (y opcionalmente PDF) de una compañía para respaldo SAT.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4 max-w-3xl">
        <label className="block">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
            <Building2 size={16} /> Compañía
          </span>
          {companies.length > 0 ? (
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="input"
            >
              <option value="">— seleccionar compañía —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.rfc} · {c.business_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value.trim())}
              placeholder="UUID de la compañía (00000000-0000-0000-0000-000000000000)"
              className="input font-mono text-xs"
            />
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
              <Calendar size={16} /> Desde
            </span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
              <Calendar size={16} /> Hasta
            </span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 block mb-1">Formato</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="input">
              <option value="xml">Solo XML (~1 KB / timbre)</option>
              <option value="both">XML + PDF (~12 KB / timbre)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 block mb-1">Límite</span>
            <input
              type="number" min={1} max={1000} value={limit}
              onChange={(e) => setLimit(Math.min(1000, parseInt(e.target.value) || 100))}
              className="input"
            />
          </label>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || !companyId}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg shadow"
        >
          <Download size={18} />
          {downloading ? 'Generando ZIP…' : 'Descargar paquete'}
        </button>

        <p className="text-xs text-gray-500 leading-relaxed">
          El ZIP incluye un <code>MANIFEST.json</code> con metadatos auditables
          (lista de UUIDs, fechas, quién descargó). Para retención SAT de 5 años,
          guarda los paquetes mensuales en almacenamiento frío (S3 Glacier / Azure Archive).
        </p>
      </div>
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonth(): string {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
