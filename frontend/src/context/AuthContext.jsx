// context/AuthContext.jsx
//
// React Context = a way to share state across all components
// without passing props through every level.
//
// Any component can call useAuth() to get:
//   { user, login, logout, loading }
//
// The token is stored in localStorage so it persists
// across page refreshes. The user object is kept in
// React state so components re-render on login/logout.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Create the context object
const AuthContext = createContext(null);

// Configure axios base URL — all API calls go to the backend
const api = axios.create({
  baseURL: '/api',    // React proxies this to http://localhost:5000/api
});

// Intercept every request to attach the JWT token
// This runs before every axios call automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dv_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses — auto-logout on 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dv_token');
      localStorage.removeItem('dv_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Export the configured axios instance so other files can use it
export { api };

// ─── PROVIDER COMPONENT ──────────────────────────────────────
// Wrap your entire app with this so all children can call useAuth()
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while checking localStorage

  // On mount: check if there's a saved token and restore the session
  useEffect(() => {
    const token    = localStorage.getItem('dv_token');
    const userData = localStorage.getItem('dv_user');

    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        // Verify token is still valid with the server
        api.get('/auth/me')
          .then(res => setUser(res.data))
          .catch(() => {
            localStorage.removeItem('dv_token');
            localStorage.removeItem('dv_user');
            setUser(null);
          })
          .finally(() => setLoading(false));
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // ── LOGIN ─────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user: userData } = response.data;

    // Save to localStorage (persists across browser sessions)
    localStorage.setItem('dv_token', token);
    localStorage.setItem('dv_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  }, []);

  // ── REGISTER ─────────────────────────────────────────────
  const register = useCallback(async (formData) => {
    const response = await api.post('/auth/register', formData);
    const { token, user: userData } = response.data;

    localStorage.setItem('dv_token', token);
    localStorage.setItem('dv_user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  }, []);

  // ── LOGOUT ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {}  // Even if server call fails, clear client state
    localStorage.removeItem('dv_token');
    localStorage.removeItem('dv_user');
    setUser(null);
    toast.success('Signed out successfully');
  }, []);

  const value = { user, login, register, logout, loading, isAuthenticated: !!user };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── CUSTOM HOOK ─────────────────────────────────────────────
// Any component calls: const { user, login, logout } = useAuth();
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
