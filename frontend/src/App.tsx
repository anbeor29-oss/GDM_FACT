/**
 * Main App Component
 * Router configuration
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/Login';
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
import { ImportXMLWizardPage } from '@/pages/ImportXMLWizard';
import { SuppliersPage }      from '@/pages/Suppliers';
import { useAuthStore } from '@/store/auth';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="invoices/new" element={<NewInvoicePage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="credit-notes" element={<CreditNotesPage />} />
            <Route path="admin/packages"  element={<AdminPackagesPage />} />
            <Route path="admin/users"     element={<AdminUsersPage />} />
            <Route path="admin/companies" element={<AdminCompaniesPage />} />
            <Route path="import-xml"      element={<ImportXMLWizardPage />} />
            <Route path="suppliers"       element={<SuppliersPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
