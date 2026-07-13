/**
 * Permisos por GRUPO DE TRABAJO (espejo de backend/src/middleware/permissions.ts).
 *
 * El rol define autoridad; el grupo define QUÉ módulos ve el usuario de empresa.
 * ADMIN_ALL ve todo. SUPER_ADMIN no usa grupos (opera la plataforma).
 * Si cambian los módulos de un grupo, actualizar TAMBIÉN el backend.
 */

export type WorkGroup = 'ADMIN_ALL' | 'VENTAS' | 'ALMACEN' | 'COMPRAS' | 'TESORERIA';

export type ModuleKey =
  | 'dashboard' | 'pos' | 'invoices' | 'credit_notes' | 'customers' | 'reports'
  | 'products' | 'inventory' | 'warehouses' | 'physical_inventory'
  | 'purchases' | 'purchase_orders'
  | 'suppliers' | 'treasury';

/** dashboard es común a todos los grupos. */
export const GROUP_MODULES: Record<WorkGroup, ModuleKey[]> = {
  ADMIN_ALL: [
    'dashboard', 'pos', 'invoices', 'credit_notes', 'customers', 'reports',
    'products', 'inventory', 'warehouses', 'physical_inventory',
    'purchases', 'purchase_orders', 'suppliers', 'treasury',
  ],
  VENTAS:    ['dashboard', 'pos', 'invoices', 'credit_notes', 'customers', 'reports'],
  ALMACEN:   ['dashboard', 'products', 'inventory', 'warehouses', 'physical_inventory'],
  COMPRAS:   ['dashboard', 'purchases', 'purchase_orders'],
  TESORERIA: ['dashboard', 'suppliers', 'treasury'],
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
