/**
 * Reporte mensual de la bitácora de usuarios monitoreados.
 *
 * Ancla contractual: cláusula SEXTA — EL CLIENTE puede activar el envío de
 * reportes periódicos al correo que designe. Se envía UN correo por usuario
 * monitoreado, al correo que su ADMIN configuró.
 *
 * Confidencialidad: el correo va SOLO a `monitoring_email`. No se manda copia
 * al usuario monitoreado ni a la plataforma.
 */
import { query } from '../../config/database';
import { sendPlainMail } from '../mailer/mailer.service';
import logger from '../../middleware/logger';

export interface MonitoringReport {
  user_email: string;
  user_name: string;
  report_to: string;
  period: string;
  total: number;
  by_action: Array<{ action: string; n: number }>;
  by_day: Array<{ day: string; n: number }>;
  first_at: string | null;
  last_at: string | null;
}

/**
 * Rango del mes anterior en hora de México. Las fechas se calculan en la zona
 * local, no en UTC: un corte a medianoche UTC parte el día mexicano en dos
 * (error nº3 del README).
 */
export function previousMonthRange(now = new Date()): { from: Date; to: Date; label: string } {
  const mx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const from = new Date(mx.getFullYear(), mx.getMonth() - 1, 1, 0, 0, 0);
  const to = new Date(mx.getFullYear(), mx.getMonth(), 1, 0, 0, 0);
  const label = from.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return { from, to, label };
}

/** Arma el reporte de un usuario para un periodo. */
export async function buildReport(userId: string, from: Date, to: Date, label: string): Promise<MonitoringReport | null> {
  const uR = await query<any>(
    `SELECT id, email, first_name, last_name, company_id, monitoring_email
       FROM users WHERE id = $1 AND monitoring_enabled = TRUE AND monitoring_email IS NOT NULL`,
    [userId]
  );
  if (uR.rowCount === 0) return null;
  const u = uR.rows[0];

  const [tot, act, day] = await Promise.all([
    query<any>(
      `SELECT COUNT(*)::int n, MIN(ts) first_at, MAX(ts) last_at
         FROM user_activity_log WHERE user_id = $1 AND ts >= $2 AND ts < $3`,
      [userId, from, to]
    ),
    query<any>(
      `SELECT action, COUNT(*)::int n FROM user_activity_log
        WHERE user_id = $1 AND ts >= $2 AND ts < $3
        GROUP BY action ORDER BY n DESC`,
      [userId, from, to]
    ),
    // `day` es palabra reservada en Postgres: como alias exige AS explícito
    // (sin él, "… 'YYYY-MM-DD' day" es un error de sintaxis).
    query<any>(
      `SELECT TO_CHAR(ts, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM user_activity_log
        WHERE user_id = $1 AND ts >= $2 AND ts < $3
        GROUP BY 1 ORDER BY 1`,
      [userId, from, to]
    ),
  ]);

  return {
    user_email: u.email,
    user_name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
    report_to: u.monitoring_email,
    period: label,
    total: tot.rows[0].n,
    by_action: act.rows,
    by_day: day.rows,
    first_at: tot.rows[0].first_at,
    last_at: tot.rows[0].last_at,
  };
}

function renderMessage(r: MonitoringReport): string {
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('es-MX') : '—');
  const acciones = r.by_action.length
    ? r.by_action.map((a) => `  · ${a.action.padEnd(28)} ${a.n}`).join('\n')
    : '  (sin actividad registrada en el periodo)';
  const dias = r.by_day.length
    ? r.by_day.map((d) => `  · ${d.day}   ${d.n}`).join('\n')
    : '  (sin días con actividad)';

  return `Reporte de actividad — ${r.period}

Usuario:   ${r.user_name || r.user_email}
Correo:    ${r.user_email}
Periodo:   ${r.period}

RESUMEN
  Operaciones registradas: ${r.total}
  Primera actividad:       ${fmt(r.first_at)}
  Última actividad:        ${fmt(r.last_at)}

POR TIPO DE OPERACIÓN
${acciones}

POR DÍA
${dias}

──────────────────────────────────────────────
Este reporte es confidencial y se envía únicamente a la dirección que el
administrador de la empresa configuró para este usuario. Se registra la
actividad conforme a la cláusula SEXTA del contrato de prestación de
servicios aceptado por la empresa.

Para dejar de recibirlo: Usuarios → el usuario → desactivar el monitoreo.
`;
}

/**
 * Envía el reporte del mes anterior a cada usuario monitoreado.
 * Tolerante a fallos por fila: si un correo rebota, los demás siguen.
 */
export async function sendMonthlyReports(now = new Date()): Promise<{ sent: number; failed: number; skipped: number }> {
  const { from, to, label } = previousMonthRange(now);
  const r = await query<{ id: string }>(
    `SELECT id FROM users
      WHERE monitoring_enabled = TRUE AND monitoring_email IS NOT NULL AND is_active = TRUE`
  );

  let sent = 0, failed = 0, skipped = 0;
  for (const { id } of r.rows) {
    try {
      const rep = await buildReport(id, from, to, label);
      if (!rep) { skipped++; continue; }
      await sendPlainMail({
        to: rep.report_to,
        subject: `Reporte de actividad de ${rep.user_email} — ${label}`,
        message: renderMessage(rep),
      });
      sent++;
    } catch (e) {
      failed++;
      logger.warn(`[monitoring] reporte de ${id} falló: ${(e as Error).message}`);
    }
  }
  logger.info(`[monitoring] reportes ${label}: ${sent} enviados, ${failed} fallidos, ${skipped} omitidos`);
  return { sent, failed, skipped };
}

export default { sendMonthlyReports, buildReport, previousMonthRange };
