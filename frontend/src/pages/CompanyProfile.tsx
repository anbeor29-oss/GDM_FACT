/**
 * CompanyProfile — datos del emisor (la empresa del usuario logueado).
 *
 * Reusa endpoints /companies/:id GET/PATCH. Sólo ADMIN puede editar.
 * Los campos cubren lo que exige el CFDI 4.0 en el bloque Emisor + dirección
 * fiscal, más el logo y contacto.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import api from '@/services/api';
import { ManifestSigner } from '@/components/ManifestSigner';

export function CompanyProfilePage() {
  const { user } = useAuthStore();
  const companyId = user?.companyId || '';
  const [msg, setMsg] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: () => api.getCompany(companyId),
    enabled: !!companyId,
  });

  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (data) {
      const c: any = (data as any)?.data ?? data;
      setForm({
        business_name: c.business_name || '',
        rfc: c.rfc || '',
        fiscal_regime: c.fiscal_regime || '',
        email: c.email || '',
        phone: c.phone || '',
        street: c.street || '',
        exterior_number: c.exterior_number || '',
        interior_number: c.interior_number || '',
        neighborhood: c.neighborhood || '',
        municipality: c.municipality || '',
        state: c.state || '',
        zip_code: c.zip_code || '',
        country: c.country || 'MEX',
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.updateCompany(companyId, form),
    onSuccess: () => { setMsg('✓ Datos guardados'); setTimeout(() => setMsg(''), 3000); },
    onError: (e: any) => setMsg(`⚠ ${e?.message || 'Error al guardar'}`),
  });

  if (isLoading) return <div className="p-6 text-slate-500">Cargando…</div>;

  const canEdit = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const F = (label: string, key: string, opts?: { span?: number; upper?: boolean; maxLen?: number; type?: string; ph?: string }) => (
    <label className={`block ${opts?.span === 2 ? 'col-span-2' : opts?.span === 3 ? 'col-span-3' : opts?.span === 4 ? 'col-span-4' : ''}`}>
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      <input
        type={opts?.type || 'text'}
        value={form[key] || ''}
        onChange={e => setForm({ ...form, [key]: opts?.upper ? e.target.value.toUpperCase() : e.target.value })}
        maxLength={opts?.maxLen}
        placeholder={opts?.ph}
        disabled={!canEdit}
        className={`input ${opts?.upper ? 'font-mono' : ''} ${!canEdit ? 'bg-slate-50' : ''}`}
      />
    </label>
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">🏢 Datos de la empresa (Emisor)</h1>
        {msg && <span className={`text-sm ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{msg}</span>}
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Estos datos aparecen en el bloque <b>Emisor</b> de cada factura y CFDI. Cámbialos con precaución — deben coincidir
        con la Constancia de Situación Fiscal ante el SAT.
      </p>

      <section className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <header className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h2 className="text-sm font-semibold text-slate-700">Datos fiscales</h2>
        </header>
        <div className="p-5 grid grid-cols-4 gap-4">
          {F('Razón social', 'business_name', { span: 3, upper: true })}
          {F('RFC', 'rfc', { upper: true, maxLen: 13 })}
          {F('Régimen fiscal (3)', 'fiscal_regime', { maxLen: 3, ph: '601' })}
          {F('Email de contacto', 'email', { span: 2, type: 'email' })}
          {F('Teléfono', 'phone')}
        </div>
      </section>

      <section className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <header className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h2 className="text-sm font-semibold text-slate-700">Domicilio fiscal</h2>
        </header>
        <div className="p-5 grid grid-cols-4 gap-4">
          {F('Calle', 'street', { span: 2 })}
          {F('No. exterior', 'exterior_number')}
          {F('No. interior', 'interior_number')}
          {F('Colonia', 'neighborhood', { span: 2 })}
          {F('Municipio', 'municipality', { span: 2 })}
          {F('Estado (3)', 'state', { upper: true, maxLen: 3, ph: 'AGU' })}
          {F('CP (5)', 'zip_code', { maxLen: 5 })}
          {F('País (3)', 'country', { upper: true, maxLen: 3 })}
        </div>
      </section>

      {canEdit && (
        <div className="flex justify-end gap-2 mb-6">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
          >
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {save.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* Manifiesto SW Sapien — requisito legal para timbrar CFDI.
          El backend rechaza el timbrado si no está firmado con e.firma.
          Se firma UNA sola vez por empresa; después queda archivado. */}
      {canEdit && (
        <section className="bg-white rounded-lg shadow-sm border border-slate-200">
          <header className="px-5 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <h2 className="text-sm font-semibold text-slate-700">Manifiesto ante el PAC (obligatorio para timbrar)</h2>
          </header>
          <div className="p-5">
            <ManifestSigner />
          </div>
        </section>
      )}
    </div>
  );
}
