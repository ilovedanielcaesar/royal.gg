import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import AppLayout from "./components/AppLayout";
import GroupProvider from "./components/GroupProvider";
import IndexRoute from "./components/IndexRoute";
import RequireAppOwner from "./components/RequireAppOwner";
import RequireAuth from "./components/RequireAuth";
import RequireGroupAdmin from "./components/RequireGroupAdmin";
import RequireGroupMember from "./components/RequireGroupMember";
import AdminOverviewPage from "./pages/AdminOverviewPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import DashboardPage from "./pages/DashboardPage";
import GroupMembersPage from "./pages/GroupMembersPage";
import GroupSettingsPage from "./pages/GroupSettingsPage";
import GroupsPage from "./pages/GroupsPage";
import JoinPage from "./pages/JoinPage";
import LoginPage from "./pages/LoginPage";
import MyGroupProfilePage from "./pages/MyGroupProfilePage";
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

          {/* Index: login form for guests, group redirect once signed in. */}
          <Route index element={<IndexRoute />} />
          <Route
            path="/groups"
            element={
              <RequireAuth>
                <GroupsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/groups/new"
            element={
              <RequireAuth>
                <CreateGroupPage />
              </RequireAuth>
            }
          />
          <Route
            path="/join"
            element={
              <RequireAuth>
                <JoinPage />
              </RequireAuth>
            }
          />
          <Route
            path="/join/:code"
            element={
              <RequireAuth>
                <JoinPage />
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
            path="/admin"
            element={
              <RequireAuth>
                <RequireAppOwner>
                  <AdminOverviewPage />
                </RequireAppOwner>
              </RequireAuth>
            }
          />
          <Route
            path="/g/:slug"
            element={
              <RequireAuth>
                <GroupProvider>
                  <RequireGroupMember>
                    <Outlet />
                  </RequireGroupMember>
                </GroupProvider>
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<MyGroupProfilePage />} />
            <Route
              path="members"
              element={
                <RequireGroupAdmin>
                  <GroupMembersPage />
                </RequireGroupAdmin>
              }
            />
            <Route
              path="settings"
              element={
                <RequireGroupAdmin>
                  <GroupSettingsPage />
                </RequireGroupAdmin>
              }
            />
            <Route path="sessions" element={<SessionsListPage />} />
            <Route path="sessions/new" element={<SessionFormPage />} />
            <Route path="sessions/:id" element={<SessionFormPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="players/:id" element={<PlayerProfilePage />} />
            <Route
              path="players/:id/rating"
              element={<PlayerRatingPage />}
            />
            <Route path="records" element={<RecordsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
