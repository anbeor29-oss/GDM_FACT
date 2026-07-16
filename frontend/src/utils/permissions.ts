/**
 * Permisos por GRUPO DE TRABAJO (espejo de backend/src/middleware/permissions.ts).
 *
 * El rol define autoridad; el grupo define QUÉ módulos ve el usuario de empresa.
 * ADMIN_ALL ve todo. SUPER_ADMIN no usa grupos (opera la plataforma).
 * Si cambian los módulos de un grupo, actualizar TAMBIÉN el backend.
 */

export type WorkGroup = 'ADMIN_ALL' | 'VENTAS' | 'ALMACEN' | 'COMPRAS' | 'TESORERIA';

export type ModuleKey =
  | 'dashboard' | 'invoices' | 'credit_notes' | 'customers' | 'reports'
  | 'products';

/**
 * dashboard es común a todos los grupos.
 *
 * GDM_FAC es SOLO facturación: aquí únicamente se listan módulos que existen
 * y funcionan. Punto de Venta, inventarios, compras, tesorería y proveedores
 * pertenecen al producto ALMACEN (repo GDM_ALMACEN) y NO se anuncian aquí
 * para no confundir al usuario con módulos que este sistema no opera.
 *
 * Los grupos ALMACEN/COMPRAS/TESORERIA se conservan a propósito: si un
 * usuario los tiene guardados en BD y el grupo no existiera en este mapa,
 * canAccess caería en ADMIN_ALL y le mostraría TODO (fail-open).
 */
export const GROUP_MODULES: Record<WorkGroup, ModuleKey[]> = {
  ADMIN_ALL: [
    'dashboard', 'invoices', 'credit_notes', 'customers', 'reports',
    'products',
  ],
  VENTAS:    ['dashboard', 'invoices', 'credit_notes', 'customers', 'reports'],
  ALMACEN:   ['dashboard', 'products'],
  COMPRAS:   ['dashboard'],
  TESORERIA: ['dashboard'],
};

/** Etiquetas legibles de cada grupo (para selectores/tooltips). */
export const WORK_GROUP_LABELS: Record<WorkGroup, string> = {
  ADMIN_ALL: 'Administrador (todos los módulos)',
  VENTAS:    'Ventas (POS, facturación, clientes, NC)',
  ALMACEN:   'Almacén (productos, inventarios, almacenes)',
  COMPRAS:   'Compras (compras y órdenes de compra)',
  TESORERIA: 'Tesorería (proveedores y tesorería)',
};

export function canAccess(group: string | undefined, mod: ModuleKey): boolean {
  const g = (group as WorkGroup) || 'ADMIN_ALL';
  return (GROUP_MODULES[g] || GROUP_MODULES.ADMIN_ALL).includes(mod);
}
