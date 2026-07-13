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

/** Claves de módulo protegibles. */
export type ModuleKey =
  | 'pos' | 'invoices' | 'credit_notes' | 'customers' | 'reports'
  | 'products' | 'inventory' | 'warehouses' | 'physical_inventory'
  | 'purchases' | 'purchase_orders'
  | 'suppliers' | 'treasury';

/** Módulos permitidos por grupo (dashboard es común, no se lista). */
export const GROUP_MODULES: Record<WorkGroup, ModuleKey[]> = {
  ADMIN_ALL: [
    'pos', 'invoices', 'credit_notes', 'customers', 'reports',
    'products', 'inventory', 'warehouses', 'physical_inventory',
    'purchases', 'purchase_orders', 'suppliers', 'treasury',
  ],
  VENTAS:    ['pos', 'invoices', 'credit_notes', 'customers', 'reports'],
  ALMACEN:   ['products', 'inventory', 'warehouses', 'physical_inventory'],
  COMPRAS:   ['purchases', 'purchase_orders'],
  TESORERIA: ['suppliers', 'treasury'],
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
