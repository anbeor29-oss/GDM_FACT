/**
 * Usuarios (equipo) — el ADMIN de la empresa da de alta y de baja a sus USER.
 *
 * Alcance deliberadamente chico: aquí solo se crean usuarios con rol USER de
 * la propia empresa. Los ADMIN y el SUPER_ADMIN los administra la plataforma
 * (HCGM) desde /admin/users. El backend no acepta rol ni empresa del body: los
 * fija desde el JWT.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, KeyRound, Ban, Check, Copy, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/auth';

interface TeamUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  password_change_required: boolean;
  last_login: string | null;
  created_at: string;
  monitoring_enabled: boolean;
  monitoring_email: string | null;
  monitoring_set_at: string | null;
}

export function TeamPage() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [showNew, setShowNew] = useState(false);
  const [monitorTarget, setMonitorTarget] = useState<TeamUser | null>(null);
  // La contraseña temporal se ve UNA vez: el backend no la vuelve a entregar.
  const [tempPass, setTempPass] = useState<{ email: string; pass: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => api.getTeam(),
  });
  const users: TeamUser[] = data?.data || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['team'] });

  const toggle = useMutation({
    mutationFn: (u: TeamUser) => (u.is_active ? api.disableTeamUser(u.id) : api.enableTeamUser(u.id)),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message || 'No se pudo cambiar el estado'),
  });

  const reset = useMutation({
    mutationFn: (u: TeamUser) => api.resetTeamUserPassword(u.id),
    onSuccess: (r, u) => {
      setTempPass({ email: u.email, pass: r.data.temporary_password });
      invalidate();
    },
    onError: (e: any) => alert(e?.response?.data?.message || 'No se pudo generar la contraseña'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600 mt-2">Da de alta y de baja a los usuarios de tu empresa.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold"
        >
          <UserPlus size={18} /> Nuevo usuario
        </button>
      </div>

      {tempPass && (
        <TempPasswordBanner data={tempPass} onClose={() => setTempPass(null)} />
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Usuario</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Correo</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rol</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Último acceso</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reporte mensual</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => {
                const isMe = u.id === me?.userId;
                const isAdmin = u.role === 'ADMIN';
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {u.first_name} {u.last_name}
                      {isMe && <span className="ml-2 text-xs text-gray-500">(tú)</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                        isAdmin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                        {isAdmin && <ShieldCheck size={12} />} {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {u.is_active ? 'Activo' : 'Dado de baja'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {u.last_login ? new Date(u.last_login).toLocaleString('es-MX') : 'Nunca'}
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : u.monitoring_enabled ? (
                        <button
                          onClick={() => setMonitorTarget(u)}
                          className="text-left group/m"
                          title="Cambiar o desactivar el reporte"
                        >
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                            <Eye size={12} /> Activo
                          </span>
                          <span className="block text-xs text-gray-500 mt-1 group-hover/m:underline">
                            {u.monitoring_email}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setMonitorTarget(u)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-100"
                          title="Activar el reporte mensual de este usuario"
                        >
                          <EyeOff size={12} /> Desactivado
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Un ADMIN no se administra a sí mismo ni a otros ADMIN:
                            eso lo hace la plataforma, para no quedar sin acceso. */}
                        {isAdmin ? (
                          <span className="text-xs text-gray-400 italic">Lo administra HCGM</span>
                        ) : (
                          <>
                            <button
                              onClick={() => reset.mutate(u)}
                              disabled={reset.isPending}
                              title="Generar contraseña temporal"
                              className="p-2 rounded text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                            >
                              <KeyRound size={18} />
                            </button>
                            <button
                              onClick={() => {
                                if (u.is_active && !confirm(`¿Dar de baja a ${u.email}? Dejará de poder entrar.`)) return;
                                toggle.mutate(u);
                              }}
                              disabled={toggle.isPending}
                              title={u.is_active ? 'Dar de baja' : 'Reactivar'}
                              className={`p-2 rounded disabled:opacity-40 ${
                                u.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            >
                              {u.is_active ? <Ban size={18} /> : <Check size={18} />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    Todavía no hay usuarios. Crea el primero con "Nuevo usuario".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewUserModal
          onClose={() => setShowNew(false)}
          onCreated={(email, pass) => { setTempPass({ email, pass }); setShowNew(false); invalidate(); }}
        />
      )}

      {monitorTarget && (
        <MonitoringModal
          user={monitorTarget}
          onClose={() => setMonitorTarget(null)}
          onSaved={() => { setMonitorTarget(null); invalidate(); }}
        />
      )}
    </div>
  );
}

/**
 * Activa/desactiva el REPORTE mensual. Deja explícito que la bitácora se
 * registra siempre: el usuario debe entender qué está prendiendo, o creerá
 * que apagarlo detiene el registro (y no es así).
 */
function MonitoringModal({ user, onClose, onSaved }: { user: TeamUser; onClose: () => void; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(user.monitoring_enabled);
  const [email, setEmail] = useState(user.monitoring_email || '');
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.setTeamUserMonitoring(user.id, { enabled, email: email.trim() }),
    onSuccess: onSaved,
    onError: (e: any) => setErr(e?.response?.data?.message || 'No se pudo guardar'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Reporte mensual de actividad</h2>
          <p className="text-sm text-gray-600 mt-1">{user.first_name} {user.last_name} · {user.email}</p>
        </div>

        <div className="p-6 space-y-4">
          {err && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{err}</p>}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            La actividad de <b>todos</b> los usuarios se registra siempre, por auditoría y
            cumplimiento fiscal. Este interruptor solo decide si se <b>envía</b> un resumen
            mensual y a qué correo.
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-1 w-4 h-4" />
            <span className="text-sm">
              <b className="text-gray-900">Enviar el reporte mensual de este usuario</b>
              <span className="block text-gray-600">
                Se manda el día 1 de cada mes con la actividad del mes anterior.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo que recibirá el reporte</label>
            <input type="email" value={email} disabled={!enabled}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@empresa.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            <p className="text-xs text-gray-500 mt-1">
              Confidencial: el reporte llega solo a esta dirección. Al usuario monitoreado no
              se le envía copia.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            Conforme a la cláusula SEXTA del contrato, tu empresa se obliga a informar a sus
            usuarios de este registro y a cumplir la normatividad laboral y de datos personales
            aplicable.
          </div>
        </div>

        <div className="p-6 pt-0 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => { setErr(null); save.mutate(); }}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending && <Loader2 size={16} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/** La contraseña temporal solo se muestra una vez; hay que copiarla ahora. */
function TempPasswordBanner({ data, onClose }: { data: { email: string; pass: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-amber-900">Contraseña temporal de {data.email}</p>
          <p className="text-sm text-amber-800">
            Cópiala y compártela ahora: por seguridad no se guarda y no se puede volver a consultar.
            Se le pedirá cambiarla al entrar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="px-3 py-2 bg-white border border-amber-300 rounded font-mono font-bold text-lg">{data.pass}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(data.pass); setCopied(true); }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            <Copy size={14} /> {copied ? 'Copiada' : 'Copiar'}
          </button>
          <button onClick={onClose} className="px-3 py-2 text-sm text-amber-900 hover:underline">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string, pass: string) => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createTeamUser(form),
    onSuccess: (r) => onCreated(form.email, r.data.temporary_password),
    onError: (e: any) => setErr(e?.response?.data?.message || 'No se pudo crear el usuario'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!form.firstName || !form.lastName || !form.email) {
      setErr('Todos los campos son obligatorios');
      return;
    }
    create.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Nuevo usuario</h2>
          <p className="text-sm text-gray-600 mt-1">
            Se creará con rol <b>USER</b> en tu empresa y una contraseña temporal.
          </p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@empresa.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Crear usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeamPage;
