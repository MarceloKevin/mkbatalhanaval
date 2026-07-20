import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';

export function ProtectedRoute() {
  const { nickname } = useUser();
  const location = useLocation();

  if (!nickname) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
