/**
 * Main App Component
 * Router configuration
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
import { PublicHomePage } from '@/pages/PublicHome';
import { DashboardPage } from '@/pages/Dashboard';
import { InvoicesPage } from '@/pages/Invoices';
import { NewInvoicePage } from '@/pages/NewInvoice';
import { CustomersPage } from '@/pages/Customers';
import { ProductsPage } from '@/pages/Products';
import { ReportsPage } from '@/pages/Reports';
import { CreditNotesPage } from '@/pages/CreditNotes';
import { AdminPackagesPage } from '@/pages/AdminPackages';
import { AdminUsersPage }    from '@/pages/AdminUsers';
import { AdminCompaniesPage } from '@/pages/AdminCompanies';
import { AdminBillingPage }   from '@/pages/AdminBilling';
import { AdminPrepaidPage }   from '@/pages/AdminPrepaid';
import { ImportXMLWizardPage } from '@/pages/ImportXMLWizard';
import { SuppliersPage }      from '@/pages/Suppliers';
import { useAuthStore } from '@/store/auth';
import { PointOfSalePage } from '@/pages/PointOfSale';
import { ComingSoon } from '@/pages/ComingSoon';
import { canAccess, type ModuleKey } from '@/utils/permissions';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * Landing por rol tras login:
 *   · SUPER_ADMIN → /admin/companies (operador de plataforma)
 *   · Otros roles → /dashboard (operativo de empresa)
 */
function HomeRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === 'SUPER_ADMIN' ? '/admin/companies' : '/dashboard'} replace />;
}

/**
 * Redirección desde la raíz "/" según sesión.
 *   · Sin sesión → landing pública con planes y CTA
 *   · Con sesión → HomeRedirect (dashboard o admin/companies)
 */
function RootLanding() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <HomeRedirect />;
  return <PublicHomePage />;
}

/**
 * Rutas operativas (Dashboard, Facturas, etc.) — bloqueadas para SUPER_ADMIN
 * porque son módulos de empresa usuaria, no de plataforma. Si entra a la URL
 * a mano lo mandamos al menú de Empresas.
 */
function CompanyOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role === 'SUPER_ADMIN') {
    return <Navigate to="/admin/companies" replace />;
  }
  return <>{children}</>;
}

/**
 * Ruta de empresa gateada por MÓDULO según el grupo de trabajo del usuario.
 * Un usuario de VENTAS que teclee /products a mano es redirigido al dashboard.
 * (Bloquea también a SUPER_ADMIN vía CompanyOnlyRoute.)
 */
function ModuleRoute({ module, children }: { module: ModuleKey; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/admin/companies" replace />;
  if (!canAccess(user?.workGroup, module)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * Módulos administrativos de plataforma — sólo SUPER_ADMIN.
 * Si un usuario común escribe /import-xml o /admin/... a mano, lo enviamos
 * al dashboard en lugar de renderizar la página.
 */
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/login" element={<LoginPage />} />

          {/* Layout privado — bajo "/" — pero la ruta index es el landing público */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Operación diaria — gateada por grupo de trabajo (SUPER_ADMIN redirigido) */}
            <Route path="dashboard"    element={<CompanyOnlyRoute><DashboardPage /></CompanyOnlyRoute>} />
            {/* Ventas */}
            <Route path="pos"          element={<ModuleRoute module="pos"><PointOfSalePage /></ModuleRoute>} />
            <Route path="invoices"     element={<ModuleRoute module="invoices"><InvoicesPage /></ModuleRoute>} />
            <Route path="invoices/new"       element={<ModuleRoute module="invoices"><NewInvoicePage /></ModuleRoute>} />
            <Route path="invoices/:id/edit"  element={<ModuleRoute module="invoices"><NewInvoicePage /></ModuleRoute>} />
            <Route path="credit-notes" element={<ModuleRoute module="credit_notes"><CreditNotesPage /></ModuleRoute>} />
            <Route path="customers"    element={<ModuleRoute module="customers"><CustomersPage /></ModuleRoute>} />
            <Route path="reports"      element={<ModuleRoute module="reports"><ReportsPage /></ModuleRoute>} />
            {/* Almacén */}
            <Route path="products"     element={<ModuleRoute module="products"><ProductsPage /></ModuleRoute>} />
            <Route path="inventory"           element={<ModuleRoute module="inventory"><ComingSoon title="Inventarios" description="Existencias por producto, kardex de movimientos y valuación." bullets={['Kardex de entradas y salidas','Existencia y costo promedio','Alertas de mínimos y máximos']} /></ModuleRoute>} />
            <Route path="warehouses"          element={<ModuleRoute module="warehouses"><ComingSoon title="Almacenes" description="Alta de almacenes y ubicaciones, traspasos entre ellos." bullets={['Múltiples almacenes por empresa','Traspasos entre almacenes','Existencia por ubicación']} /></ModuleRoute>} />
            <Route path="physical-inventory"  element={<ModuleRoute module="physical_inventory"><ComingSoon title="Inventario físico" description="Conteos físicos y ajustes contra el sistema." bullets={['Hojas de conteo','Diferencias físico vs sistema','Ajustes con folio y motivo']} /></ModuleRoute>} />
            {/* Compras */}
            <Route path="purchases"       element={<ModuleRoute module="purchases"><ComingSoon title="Compras" description="Registro de compras a proveedores que alimentan el inventario." bullets={['Compras con recepción de mercancía','Costeo automático','Vínculo con proveedores']} /></ModuleRoute>} />
            <Route path="purchase-orders" element={<ModuleRoute module="purchase_orders"><ComingSoon title="Órdenes de compra" description="Solicitudes de compra y su seguimiento hasta recepción." bullets={['Órdenes con autorización','Seguimiento pendiente/recibida','Conversión a compra']} /></ModuleRoute>} />
            {/* Tesorería */}
            <Route path="suppliers-tesoreria" element={<ModuleRoute module="suppliers"><SuppliersPage /></ModuleRoute>} />
            <Route path="treasury"            element={<ModuleRoute module="treasury"><ComingSoon title="Tesorería" description="Cuentas por pagar, flujo de efectivo y pagos a proveedores." bullets={['Cuentas por pagar','Programación de pagos','Flujo de efectivo']} /></ModuleRoute>} />

            {/* Módulos de plataforma — SOLO SUPER_ADMIN (guard por URL directa) */}
            <Route path="admin/packages"  element={<SuperAdminRoute><AdminPackagesPage /></SuperAdminRoute>} />
            <Route path="admin/billing"   element={<SuperAdminRoute><AdminBillingPage /></SuperAdminRoute>} />
            <Route path="admin/prepaid"   element={<SuperAdminRoute><AdminPrepaidPage /></SuperAdminRoute>} />
            <Route path="admin/users"     element={<SuperAdminRoute><AdminUsersPage /></SuperAdminRoute>} />
            <Route path="admin/companies" element={<SuperAdminRoute><AdminCompaniesPage /></SuperAdminRoute>} />
            <Route path="import-xml"      element={<SuperAdminRoute><ImportXMLWizardPage /></SuperAdminRoute>} />
            <Route path="suppliers"       element={<SuperAdminRoute><SuppliersPage /></SuperAdminRoute>} />

          </Route>

          {/* Ruta raíz "/" — landing público si no hay sesión, redirect si sí */}
          <Route path="/" element={<RootLanding />} />

          {/* Cualquier URL desconocida → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
