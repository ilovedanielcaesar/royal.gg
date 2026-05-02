import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import IndexRoute from "./components/IndexRoute";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import AdminApprovalsPage from "./pages/AdminApprovalsPage";
import LoginPage from "./pages/LoginPage";
import PendingPage from "./pages/PendingPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import PlayerRatingPage from "./pages/PlayerRatingPage";
import PlayersPage from "./pages/PlayersPage";
import ProfilePage from "./pages/ProfilePage";
import RecordsPage from "./pages/RecordsPage";
import SessionFormPage from "./pages/SessionFormPage";
import SessionsListPage from "./pages/SessionsListPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/pending" element={<PendingPage />} />

          {/* Index: login form for guests, dashboard for approved users. */}
          <Route index element={<IndexRoute />} />
          <Route
            path="/sessions"
            element={
              <RequireAuth>
                <SessionsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/sessions/new"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <SessionFormPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/sessions/:id"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <SessionFormPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            path="/players"
            element={
              <RequireAuth>
                <PlayersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/players/:id"
            element={
              <RequireAuth>
                <PlayerProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/players/:id/rating"
            element={
              <RequireAuth>
                <PlayerRatingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/records"
            element={
              <RequireAuth>
                <RecordsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/approvals"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminApprovalsPage />
                </RequireAdmin>
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
