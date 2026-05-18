import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from './api/supabase';
import { useAppStore } from './store/useAppStore';

// Layout
import Sidebar from './components/layout/Sidebar';

// Pages
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import EstimatorWorkspace from './pages/EstimatorWorkspace';
import PriceBook from './pages/PriceBook';
import Settings from './pages/Settings';
import ClientPortal from './pages/ClientPortal';
import LandingPage from './pages/LandingPage';

// Shows landing page to guests, redirects authenticated users to /dashboard
function SmartRoot() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const fetchProfile = useAppStore(s => s.fetchProfile);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-60">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        {/* Public landing page (smart: redirects to /dashboard if logged in) */}
        <Route path="/" element={<SmartRoot />} />

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        {/* /signup only reachable via Supabase invite magic link */}
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Public client portal */}
        <Route path="/approve/:shareToken" element={<ClientPortal />} />

        {/* Protected app routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><AppLayout><Projects /></AppLayout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><EstimatorWorkspace /></AppLayout></ProtectedRoute>} />
        <Route path="/price-book" element={<ProtectedRoute><AppLayout><PriceBook /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />

        {/* Catch-all → landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
