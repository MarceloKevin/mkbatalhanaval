import { UserProvider } from './contexts/UserContext';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  );
}
