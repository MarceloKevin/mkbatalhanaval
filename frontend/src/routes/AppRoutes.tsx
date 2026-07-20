import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute/ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { GamePage } from '../pages/Game/Game';
import { HomePage } from '../pages/Home/Home';
import { LobbyPage } from '../pages/Lobby/Lobby';
import { NotFoundPage } from '../pages/NotFound/NotFound';
import { RoomPage } from '../pages/Room/Room';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="lobby" element={<LobbyPage />} />
            <Route path="sala/:roomId" element={<RoomPage />} />
            <Route path="jogando/:roomId" element={<GamePage />} />
          </Route>
          <Route path="404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/home" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
