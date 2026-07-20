import { Outlet } from 'react-router-dom';
import { OceanBackground } from '../components/OceanBackground/OceanBackground';
import { ToastContainer } from '../components/ToastContainer/ToastContainer';
import { useUser } from '../hooks/useUser';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { toasts, dismissToast } = useUser();

  return (
    <div className={styles.layout}>
      <OceanBackground />
      <Outlet />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
