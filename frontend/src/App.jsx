// App.jsx — Root component, sets up routing and auth
//
// React Router v6 handles navigation between pages.
// ProtectedRoute wraps any page that requires login.
// If not logged in, redirects to /login automatically.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';

// ─── PROTECTED ROUTE ─────────────────────────────────────────
// Wraps any component that requires authentication.
// If user is not logged in, redirects to /login.
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // Show nothing while checking auth status
  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#05060b', display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#5b8ff9', fontSize: 14, fontFamily: 'monospace' }}>
          Loading…
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ─── APP ROOT ────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage mode="login" />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <AuthPage mode="register" />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Toast notification system */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1b1f30',
              color: '#eef0fa',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#05060b' } },
            error:   { iconTheme: { primary: '#fb7185', secondary: '#05060b' } },
          }}
        />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
