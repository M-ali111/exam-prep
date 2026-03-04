import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface User {
  id: string;
  email: string;
  username: string;
  rating: number;
  currentDifficulty: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  console.log('[AuthProvider] Mounted - token initialized:', !!token);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('zerekIqJustSignedUp');
  };

  const isTokenExpired = (jwtToken: string): boolean => {
    try {
      const payload = jwtToken.split('.')[1];
      if (!payload) return true;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(normalized));
      if (!decoded?.exp) return true;
      return decoded.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      clearAuth();
      return;
    }

    if (isTokenExpired(storedToken)) {
      clearAuth();
      return;
    }

    setToken(storedToken);

    const restoreSession = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!response.ok) {
          // Handle 400, 401, or any other error by clearing auth
          console.warn('Session restore failed:', response.status);
          clearAuth();
          return;
        }

        const user = await response.json();
        setUser(user);
      } catch (error) {
        console.error('Session restore error:', error);
        clearAuth();
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const { user, token } = await response.json();
    setUser(user);
    setToken(token);
    localStorage.setItem('token', token);
  };

  const signup = async (email: string, username: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    const { user, token } = await response.json();
    setUser(user);
    setToken(token);
    localStorage.setItem('token', token);
  };

  const logout = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.error('[useAuth] Called outside AuthProvider! Context is undefined.');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  console.log('[useAuth] Hook called, user:', context.user?.username || 'null');
  return context;
};
