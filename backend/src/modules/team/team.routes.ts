/**
 * /team — el ADMIN de una empresa gestiona a los USER de SU empresa.
 *
 *  GET    /team                   listado de usuarios de mi empresa
 *  POST   /team                   alta de un USER + contraseña temporal
 *  POST   /team/:id/disable       baja (soft — preserva la auditoría)
 *  POST   /team/:id/enable        re-activa
 *  POST   /team/:id/reset-password nueva contraseña temporal
 *
 * Diferencia con /admin/users (que es SOLO del SUPER_ADMIN de la plataforma):
 * aquí el alcance es UNA empresa y un solo rol. Un ADMIN nunca puede crear
 * otro ADMIN ni tocar usuarios de otra empresa.
 *
 * Seguridad — las tres reglas que sostienen el aislamiento:
 *   1. `company_id` SIEMPRE sale del JWT, nunca del body (si viniera del body,
 *      un ADMIN podría crear usuarios en la empresa de otro).
 *   2. Todo UPDATE/SELECT lleva `AND company_id = $mi_empresa`, así un id de
 *      otra empresa responde 404 en vez de operar.
 *   3. Solo se crean/tocan usuarios con rol USER: los ADMIN y SUPER_ADMIN los
 *      sigue administrando la plataforma.
 */
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../../middleware/authentication';
import { asyncHandler, ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';
import { query } from '../../config/database';
import { audit } from '../admin/admin.middleware';

const router = Router();
router.use(authenticateToken);

/** Solo el ADMIN de una empresa. El SUPER_ADMIN usa /admin/users. */
function requireCompanyAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Solo el administrador de la empresa puede gestionar usuarios',
    });
  }
  if (!req.user.companyId) {
    return res.status(403).json({ success: false, message: 'Tu usuario no tiene empresa asignada' });
  }
  return next();
}
router.use(requireCompanyAdmin);

/** Contraseña temporal legible: "Lima-9248" — fácil de dictar por teléfono. */
function generateTemporaryPassword(): string {
  const words = ['Lima', 'Roma', 'Toro', 'Sole', 'Cima', 'Vega', 'Bahia', 'Rio', 'Mar', 'Sol'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

function validEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/* ────────────────────────  LIST  ──────────────────────── */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const r = await query<any>(
    `SELECT id, email, first_name, last_name, role, is_active,
            password_change_required, last_login, created_at
       FROM users
      WHERE company_id = $1
        AND role IN ('ADMIN', 'USER')
      ORDER BY role, created_at DESC`,
    [req.user!.companyId]
  );
  res.status(200).json({ success: true, data: r.rows });
}));

/* ────────────────────────  CREATE  ──────────────────────── */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email, firstName, lastName } = req.body as any;
  if (!email || !validEmail(email)) throw new ValidationError('Email inválido');
  if (!firstName || !lastName) throw new ValidationError('Nombre y apellido son requeridos');

  const dup = await query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  if (dup.rowCount! > 0) throw new ConflictError('Ya existe un usuario con ese email');

  const tempPass = generateTemporaryPassword();
  const hash = await bcrypt.hash(tempPass, 10);

  // El rol va fijo a USER y la empresa sale del JWT: ninguno de los dos se
  // acepta del body, para que un ADMIN no pueda escalar privilegios ni
  // sembrar usuarios en otra empresa.
  const r = await query<any>(
    `INSERT INTO users (email, first_name, last_name, password_hash, role, work_group,
                        company_id, is_active, password_change_required, created_by_user_id)
     VALUES ($1, $2, $3, $4, 'USER', 'VENTAS', $5, true, true, $6)
     RETURNING id, email, first_name, last_name, role, is_active, created_at`,
    [email.toLowerCase(), firstName, lastName, hash, req.user!.companyId, req.user!.userId]
  );
  const user = r.rows[0];
  await audit(req, {
    action: 'TEAM_USER_CREATED', targetKind: 'user', targetId: user.id,
    payload: { email: user.email, companyId: req.user!.companyId },
  });

  // La contraseña temporal se devuelve UNA sola vez: no se persiste en claro
  // ni se puede volver a consultar. Si se pierde, se usa reset-password.
  res.status(201).json({
    success: true,
    message: 'Usuario creado. Comparte la contraseña temporal; se le pedirá cambiarla al entrar.',
    data: { ...user, temporary_password: tempPass },
  });
}));

/** Carga un USER de MI empresa o 404. Centraliza la regla de aislamiento. */
async function findOwnUser(req: Request, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ValidationError('id inválido');
  const r = await query<any>(
    `SELECT id, email, role, is_active FROM users
      WHERE id = $1 AND company_id = $2 AND role = 'USER' LIMIT 1`,
    [id, req.user!.companyId]
  );
  if (r.rowCount === 0) throw new NotFoundError('Usuario no encontrado en tu empresa');
  return r.rows[0];
}

/* ────────────────────────  DISABLE / ENABLE  ──────────────────────── */
router.post('/:id/disable', asyncHandler(async (req: Request, res: Response) => {
  const u = await findOwnUser(req, req.params.id);
  await query('UPDATE users SET is_active = false WHERE id = $1', [u.id]);
  await audit(req, { action: 'TEAM_USER_DISABLED', targetKind: 'user', targetId: u.id,
    payload: { email: u.email } });
  res.status(200).json({ success: true, message: 'Usuario dado de baja' });
}));

router.post('/:id/enable', asyncHandler(async (req: Request, res: Response) => {
  const u = await findOwnUser(req, req.params.id);
  await query('UPDATE users SET is_active = true WHERE id = $1', [u.id]);
  await audit(req, { action: 'TEAM_USER_ENABLED', targetKind: 'user', targetId: u.id,
    payload: { email: u.email } });
  res.status(200).json({ success: true, message: 'Usuario reactivado' });
}));

/* ────────────────────────  RESET PASSWORD  ──────────────────────── */
router.post('/:id/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const u = await findOwnUser(req, req.params.id);
  const tempPass = generateTemporaryPassword();
  const hash = await bcrypt.hash(tempPass, 10);
  await query(
    'UPDATE users SET password_hash = $1, password_change_required = true WHERE id = $2',
    [hash, u.id]
  );
  await audit(req, { action: 'TEAM_USER_PASSWORD_RESET', targetKind: 'user', targetId: u.id,
    payload: { email: u.email } });
  res.status(200).json({
    success: true,
    message: 'Contraseña temporal generada. Se le pedirá cambiarla al entrar.',
    data: { temporary_password: tempPass },
  });
}));

export default router;
