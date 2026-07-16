/**
 * Permisos por GRUPO DE TRABAJO.
 *
 * El rol (SUPER_ADMIN/ADMIN/MANAGER/USER) define autoridad; el grupo define
 * QUÉ módulos ve/usa un usuario de empresa. Esta es la fuente de verdad — el
 * frontend replica el mismo mapa (frontend/src/utils/permissions.ts). Si
 * cambian los módulos de un grupo, cambiar en AMBOS lados.
 *
 * ADMIN_ALL ve todo. SUPER_ADMIN no usa grupos (opera la plataforma).
 */

import { Request, Response, NextFunction } from 'express';

export type WorkGroup = 'ADMIN_ALL' | 'VENTAS' | 'ALMACEN' | 'COMPRAS' | 'TESORERIA';

/**
 * Claves de módulo protegibles.
 *
 * GDM_FAC es SOLO facturación: aquí únicamente van módulos que existen y
 * funcionan. Punto de Venta, inventarios, compras, tesorería y proveedores
 * pertenecen al producto ALMACEN (repo GDM_ALMACEN) y no se ofrecen aquí.
 *
 * 'pos' sigue declarado como clave porque el módulo backend (modules/pos)
 * todavía existe y usa requireModule('pos'), pero NO se concede a ningún
 * grupo: sus endpoints responden 403 y la UI ya no lo expone. Al migrarlo a
 * ALMACEN se puede borrar el módulo y esta clave.
 */
export type ModuleKey =
  | 'pos' | 'invoices' | 'credit_notes' | 'customers' | 'reports'
  | 'products';

/**
 * Módulos permitidos por grupo (dashboard es común, no se lista).
 * Los grupos ALMACEN/COMPRAS/TESORERIA se conservan para no romper a usuarios
 * que ya los tengan asignados en BD; en facturación solo alcanzan lo que existe.
 */
export const GROUP_MODULES: Record<WorkGroup, ModuleKey[]> = {
  ADMIN_ALL: [
    'invoices', 'credit_notes', 'customers', 'reports',
    'products',
  ],
  VENTAS:    ['invoices', 'credit_notes', 'customers', 'reports'],
  ALMACEN:   ['products'],
  COMPRAS:   [],
  TESORERIA: [],
};

export function groupCanAccess(group: WorkGroup | undefined, mod: ModuleKey): boolean {
  const g = group || 'ADMIN_ALL';
  return (GROUP_MODULES[g] || []).includes(mod);
}

/**
 * Middleware: exige que el usuario pertenezca a un grupo con acceso al módulo.
 * SUPER_ADMIN siempre pasa (opera la plataforma). Usar en rutas sensibles de
 * escritura para que, p.ej., un usuario de VENTAS no modifique inventarios.
 */
export function requireModule(mod: ModuleKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Autenticación requerida' });
    }
    if (req.user.role === 'SUPER_ADMIN') return next();
    const group = (req.user.workGroup as WorkGroup) || 'ADMIN_ALL';
    if (!groupCanAccess(group, mod)) {
      return res.status(403).json({
        success: false,
        message: `Tu grupo de trabajo (${group}) no tiene acceso a este módulo.`,
      });
    }
    return next();
  };
}
