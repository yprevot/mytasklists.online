import { Navigate, Route, Routes } from 'react-router-dom';
import { useAdminAuth } from './context/AdminAuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { ListsPage } from './pages/ListsPage';
import { ActivityPage } from './pages/ActivityPage';
import { SecurityPage } from './pages/SecurityPage';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAdminAuth();
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<OverviewPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/security" element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
