import { useAuth } from '../context/AuthContext';
import { useCallback, useMemo } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050';
const API_BASE = `${API_URL}/api`;

export const useApi = () => {
  // Call hook unconditionally at top level (Rules of Hooks)
  const { token } = useAuth();

  const request = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const authToken = token || localStorage.getItem('token');
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }, [token]);

  return useMemo(() => ({ request }), [request]);
};
