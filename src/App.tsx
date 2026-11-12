import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { SetupRequired } from '@/components/layout/SetupRequired';
import { LoadingState } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '@/modules/auth/AuthPages';

const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'));
const WorkPage = lazy(() => import('@/modules/work/WorkPage'));
const AcademicPage = lazy(() => import('@/modules/academic/AcademicPage'));
const SkillsPage = lazy(() => import('@/modules/skills/SkillsPage'));
const LanguagesPage = lazy(() => import('@/modules/languages/LanguagesPage'));
const FinancePage = lazy(() => import('@/modules/finance/FinancePage'));
const GoalsPage = lazy(() => import('@/modules/goals/GoalsPage'));
const SettingsPage = lazy(() => import('@/modules/settings/SettingsPage'));

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <LoadingState label="Iniciando IVAN OS…" />
    </div>
  );
}

/** Private area: requires a session; recovery sessions must set a new password first. */
function ProtectedRoute() {
  const { initializing, session, recovering, signedOut } = useAuth();
  const location = useLocation();
  if (initializing) return <FullScreenLoader />;
  // Remember the requested page for after login, except when the user just signed out.
  if (!session) return <Navigate to="/login" replace state={signedOut ? null : { from: location.pathname }} />;
  if (recovering) return <Navigate to="/reset-password" replace />;
  return (
    <AppLayout>
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<LoadingState />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

/** Login/register screens: signed-in users are sent to the app. */
function PublicOnlyRoute() {
  const { initializing, session, recovering } = useAuth();
  const location = useLocation();
  if (initializing) return <FullScreenLoader />;
  if (session && recovering) return <Navigate to="/reset-password" replace />;
  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/'} replace />;
  }
  return <Outlet />;
}

export function App() {
  if (!isSupabaseConfigured) return <SetupRequired />;
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<ProtectedRoute />}>
                <Route index element={<DashboardPage />} />
                <Route path="/work" element={<WorkPage />} />
                <Route path="/academic" element={<AcademicPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/languages" element={<LanguagesPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
