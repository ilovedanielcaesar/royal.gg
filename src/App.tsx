import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import GroupProvider from "./components/GroupProvider";
import IndexRoute from "./components/IndexRoute";
import RequireAdmin from "./components/RequireAdmin";
import RequireAuth from "./components/RequireAuth";
import RequireGroupAdmin from "./components/RequireGroupAdmin";
import RequireGroupMember from "./components/RequireGroupMember";
import AdminApprovalsPage from "./pages/AdminApprovalsPage";
import CreateGroupPage from "./pages/CreateGroupPage";
import DashboardPage from "./pages/DashboardPage";
import GroupsPage from "./pages/GroupsPage";
import LoginPage from "./pages/LoginPage";
import MyGroupProfilePage from "./pages/MyGroupProfilePage";
import PendingPage from "./pages/PendingPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import PlayerRatingPage from "./pages/PlayerRatingPage";
import PlayersPage from "./pages/PlayersPage";
import ProfilePage from "./pages/ProfilePage";
import RecordsPage from "./pages/RecordsPage";
import SessionFormPage from "./pages/SessionFormPage";
import SessionsListPage from "./pages/SessionsListPage";
import SignupPage from "./pages/SignupPage";

function GroupRoutes() {
  return <GroupProvider><RequireGroupMember><Outlet /></RequireGroupMember></GroupProvider>;
}

export default function App() {
  return <BrowserRouter><Routes><Route element={<AppLayout />}>
    <Route path="/login" element={<LoginPage />} /><Route path="/signup" element={<SignupPage />} /><Route path="/pending" element={<PendingPage />} />
    <Route index element={<IndexRoute />} />
    <Route path="/groups" element={<RequireAuth><GroupsPage /></RequireAuth>} />
    <Route path="/groups/new" element={<RequireAuth><CreateGroupPage /></RequireAuth>} />
    <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
    <Route path="/admin/approvals" element={<RequireAuth><RequireAdmin><AdminApprovalsPage /></RequireAdmin></RequireAuth>} />
    <Route path="/g/:slug" element={<RequireAuth><GroupRoutes /></RequireAuth>}>
      <Route index element={<DashboardPage />} />
      <Route path="sessions" element={<SessionsListPage />} />
      <Route path="sessions/new" element={<RequireGroupAdmin><SessionFormPage /></RequireGroupAdmin>} />
      <Route path="sessions/:id" element={<RequireGroupAdmin><SessionFormPage /></RequireGroupAdmin>} />
      <Route path="players" element={<PlayersPage />} />
      <Route path="players/:id" element={<PlayerProfilePage />} />
      <Route path="players/:id/rating" element={<PlayerRatingPage />} />
      <Route path="records" element={<RecordsPage />} />
      <Route path="profile" element={<MyGroupProfilePage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes></BrowserRouter>;
}
