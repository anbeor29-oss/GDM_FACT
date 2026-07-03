/**
 * Super-Admin → Gestión de Empresas (multi-tenant).
 *   · Crear empresa con plan (iguala / renta), cap_timbres, monthly_fee
 *   · Subir CSD (.cer + .key + password) — cifrado en BD
 *   · Ver consumo del mes + facturación estimada
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, FileKey, Trash2, X, ShieldCheck, ScanText, Upload } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/auth';

export function AdminCompaniesPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [csdTarget, setCsdTarget] = useState<any>(null);

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-lg">
        <p className="font-semibold mb-1">Acceso restringido</p>
        <p className="text-sm">Esta sección requiere rol <b>SUPER_ADMIN</b>. Tu rol: <b>{user?.role}</b>.</p>
      </div>
    );
  }

  const q = useQuery({ queryKey: ['admin-companies'], queryFn: () => api.adminListCompanies() });
  const rows = q.data?.data?.companies || [];

  const delCsd = useMutation({
    mutationFn: (id: string) => api.adminDeleteCSD(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="text-indigo-600" size={36}/> Empresas
          </h1>
          <p className="text-gray-600 mt-1">Empresas registradas en la plataforma SaaS, plan y sellos digitales.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow">
          <Plus size={18}/> Nueva empresa
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">RFC</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Razón social</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Plan</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Cap / Usados</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">CSD</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Usuarios</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((c: any) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm font-mono">{c.rfc}</td>
                <td className="px-4 py-2 text-sm font-medium">{c.business_name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    c.billing_plan==='iguala' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {c.billing_plan} · ${c.monthly_fee}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-sm">
                  <b>{c.facturas_mes}</b><span className="text-gray-400"> / {c.cap_timbres}</span>
                </td>
                <td className="px-4 py-2 text-center">
                  {c.has_csd ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                      <ShieldCheck size={12}/> cargado
                    </span>
                  ) : <span className="text-xs text-gray-400 italic">sin CSD</span>}
                </td>
                <td className="px-4 py-2 text-center text-sm">{c.users_active}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button title="Cargar CSD" onClick={() => setCsdTarget(c)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"><FileKey size={16}/></button>
                    {c.has_csd && (
                      <button title="Revocar CSD" onClick={() => { if (confirm(`Revocar el CSD de ${c.rfc}?`)) delCsd.mutate(c.id); }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 italic">Sin empresas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateCompanyModal onClose={()=>setShowCreate(false)}
          onDone={()=>{ setShowCreate(false); qc.invalidateQueries({ queryKey: ['admin-companies'] }); }}/>
      )}
      {csdTarget && (
        <CSDUploadModal company={csdTarget} onClose={()=>setCsdTarget(null)}
          onDone={()=>{ setCsdTarget(null); qc.invalidateQueries({ queryKey: ['admin-companies'] }); }}/>
      )}
    </div>
  );
}

/* ─────────────── Catálogo de planes (espejo de stamp_packages) ─────────────── */

interface StampPlanOption {
  code: string;
  label: string;                // texto que va en el <option>
  billingPlan: 'iguala' | 'renta';
  capTimbres: number;           // 0 = sin cap (pay-per-stamp)
  monthlyFee: number;
}

const PLAN_OPTIONS: StampPlanOption[] = [
  { code:'PKG_100',  label:'Esencial · 100 timbres · $399/mes',    billingPlan:'iguala', capTimbres:100, monthlyFee:399 },
  { code:'PKG_200',  label:'Pyme · 200 timbres · $699/mes',        billingPlan:'iguala', capTimbres:200, monthlyFee:699 },
  { code:'PKG_500',  label:'Empresarial · 500 timbres · $1,399/mes', billingPlan:'iguala', capTimbres:500, monthlyFee:1399 },
  { code:'PKG_FLEX', label:'Uso libre (pay-per-stamp) · sin renta', billingPlan:'renta',  capTimbres:0,   monthlyFee:0 },
];

/* ─────────────── Modal Nueva Empresa ─────────────── */

function CreateCompanyModal({ onClose, onDone }: any) {
  const [form, setForm] = useState({
    rfc:'', businessName:'', fiscalRegime:'601', postalCode:'',
    // Default: plan Pyme (PKG_200) — el más recomendado.
    planCode:'PKG_200',
    billingPlan:'iguala' as 'iguala'|'renta',
    capTimbres:200, monthlyFee:699,
    // Timbre extra fijo $2.00 MXN — se puede ajustar por empresa si se negocia.
    extraStampFee:2.00,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [csfLoading, setCsfLoading] = useState(false);

  // Aplica un plan al form (autollena billing_plan + cap + fee)
  const applyPlan = (code: string) => {
    const p = PLAN_OPTIONS.find((x) => x.code === code);
    if (!p) return;
    setForm((f) => ({
      ...f,
      planCode: p.code,
      billingPlan: p.billingPlan,
      capTimbres: p.capTimbres,
      monthlyFee: p.monthlyFee,
    }));
  };

  // Lector de CIF: sube PDF a /csf/extract y autollena RFC + razón + régimen + CP.
  const handleReadCIF = async (file: File) => {
    setError(''); setCsfLoading(true);
    try {
      const r = await api.extractCSF(file);
      const d = r.data || {};
      setForm((f) => ({
        ...f,
        rfc: (d.rfc || f.rfc).toUpperCase(),
        businessName: (d.businessName || d.razonSocial || f.businessName).toUpperCase(),
        fiscalRegime: d.fiscalRegime || d.regimenFiscal || f.fiscalRegime,
        postalCode: d.postalCode || d.cp || f.postalCode,
      }));
    } catch (e: any) {
      setError(e.response?.data?.message || 'No se pudo leer el CIF. Verifica que sea un PDF de Constancia de Situación Fiscal SAT.');
    } finally { setCsfLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      // Enviamos también `stampPackageCode` para que el backend lo guarde
      // en la nueva columna `stamp_package_code` cuando esté disponible.
      await api.adminCreateCompany({
        ...form,
        stampPackageCode: form.planCode,
      });
      onDone();
    } catch (e: any) {
      setError(e.response?.data?.message || e.message);
    } finally { setBusy(false); }
  };

  const currentPlan = PLAN_OPTIONS.find((x) => x.code === form.planCode)!;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold">Nueva empresa</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded"><X size={20}/></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}

          {/* ─── Botón lector de CIF (CSF SAT) ─── */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-1 flex items-center gap-2">
              <ScanText size={16}/> Leer Constancia de Situación Fiscal (CIF)
            </p>
            <p className="text-xs text-blue-700 mb-2">
              Sube el PDF de la CSF del SAT y autollenamos RFC, razón social, régimen y CP.
            </p>
            <label className="inline-flex items-center gap-2 cursor-pointer bg-white border border-blue-300 rounded px-3 py-1.5 hover:bg-blue-100 text-sm">
              <Upload size={14}/> {csfLoading ? 'Leyendo PDF…' : 'Seleccionar PDF'}
              <input type="file" accept="application/pdf,.pdf" className="hidden"
                disabled={csfLoading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReadCIF(f); }}/>
            </label>
          </div>

          {/* ─── Datos fiscales (llenados a mano o por CIF) ─── */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm font-medium block mb-1">RFC *</span>
              <input required className="input w-full font-mono uppercase" maxLength={13}
                value={form.rfc} onChange={(e)=>setForm({...form,rfc:e.target.value.toUpperCase()})}/></label>
            <label className="block"><span className="text-sm font-medium block mb-1">Régimen fiscal *</span>
              <input required className="input w-full" value={form.fiscalRegime}
                onChange={(e)=>setForm({...form,fiscalRegime:e.target.value})}/></label>
          </div>
          <label className="block"><span className="text-sm font-medium block mb-1">Razón social *</span>
            <input required className="input w-full uppercase" value={form.businessName}
              onChange={(e)=>setForm({...form,businessName:e.target.value.toUpperCase()})}/></label>
          <label className="block"><span className="text-sm font-medium block mb-1">CP fiscal</span>
            <input className="input w-full" maxLength={5} value={form.postalCode}
              onChange={(e)=>setForm({...form,postalCode:e.target.value})}/></label>

          {/* ─── Plan de cobro con selector ─── */}
          <div className="border-t pt-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Plan de cobro</p>

            <label className="block">
              <span className="text-sm block mb-1">Paquete de timbres</span>
              <select className="input w-full" value={form.planCode}
                onChange={(e)=>applyPlan(e.target.value)}>
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </label>

            {/* Resumen del plan seleccionado (read-only, autollenado) */}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-gray-50 border rounded px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Cap timbres/mes</p>
                <p className="text-lg font-bold text-gray-900">
                  {currentPlan.capTimbres || '∞'}
                </p>
              </div>
              <div className="bg-gray-50 border rounded px-3 py-2">
                <p className="text-[10px] uppercase text-gray-500">Renta mensual</p>
                <p className="text-lg font-bold text-gray-900">
                  ${currentPlan.monthlyFee.toLocaleString('es-MX')}
                </p>
              </div>
              <label className="block bg-white border rounded px-3 py-2">
                <span className="text-[10px] uppercase text-gray-500 block">Timbre extra</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900">$</span>
                  <input type="number" step="0.01" min="0"
                    className="text-lg font-bold text-gray-900 border-0 p-0 w-full focus:ring-0"
                    value={form.extraStampFee}
                    onChange={(e)=>setForm({...form,extraStampFee:parseFloat(e.target.value)||0})}/>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
            {busy?'Creando…':'Crear empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CSDUploadModal({ company, onClose, onDone }: any) {
  const [form, setForm] = useState({ noCertificado:'', keyPassword:'', validFrom:'', validTo:'' });
  const [cerFile, setCerFile] = useState<File|null>(null);
  const [keyFile, setKeyFile] = useState<File|null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);

  async function fileToB64(f: File): Promise<string> {
    const buf = new Uint8Array(await f.arrayBuffer());
    let s = ''; for (let i=0;i<buf.length;i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!cerFile || !keyFile) return setError('Selecciona los archivos .cer y .key');
    setBusy(true);
    try {
      await api.adminUploadCSD(company.id, {
        noCertificado: form.noCertificado,
        cerBase64: await fileToB64(cerFile),
        keyBase64: await fileToB64(keyFile),
        keyPassword: form.keyPassword,
        validFrom: form.validFrom || undefined,
        validTo:   form.validTo   || undefined,
      });
      onDone();
    } catch (e: any) { setError(e.response?.data?.message || e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="font-bold">Cargar CSD</h2>
            <p className="text-xs text-gray-500">{company.rfc} · {company.business_name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded"><X size={20}/></button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <label className="block"><span className="text-sm font-medium block mb-1">No. Certificado (20 dígitos) *</span>
            <input required className="input w-full font-mono" maxLength={20} pattern="\d{20}"
              value={form.noCertificado} onChange={(e)=>setForm({...form,noCertificado:e.target.value})}/></label>
          <label className="block"><span className="text-sm font-medium block mb-1">Archivo .cer (público) *</span>
            <input required type="file" accept=".cer" onChange={(e)=>setCerFile(e.target.files?.[0]||null)}/></label>
          <label className="block"><span className="text-sm font-medium block mb-1">Archivo .key (privado) *</span>
            <input required type="file" accept=".key" onChange={(e)=>setKeyFile(e.target.files?.[0]||null)}/></label>
          <label className="block"><span className="text-sm font-medium block mb-1">Password del .key *</span>
            <input required type="password" className="input w-full"
              value={form.keyPassword} onChange={(e)=>setForm({...form,keyPassword:e.target.value})}/></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm block mb-1">Vigente desde</span>
              <input type="date" className="input w-full" value={form.validFrom}
                onChange={(e)=>setForm({...form,validFrom:e.target.value})}/></label>
            <label className="block"><span className="text-sm block mb-1">Vigente hasta</span>
              <input type="date" className="input w-full" value={form.validTo}
                onChange={(e)=>setForm({...form,validTo:e.target.value})}/></label>
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            El .key y su password se cifran con pgcrypto antes de almacenarse. Nunca se devuelven por API.
          </p>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
          <button type="submit" disabled={busy} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
            {busy?'Subiendo…':'Cargar CSD'}
          </button>
        </div>
      </form>
    </div>
  );
}
