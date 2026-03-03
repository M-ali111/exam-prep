import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
const API_BASE = `${API_URL}/api`;

export const useApi = () => {
  // Safely call useAuth with error protection
  let token: string | null = null;
  
  try {
    const auth = useAuth();
    token = auth.token;
  } catch (error) {
    // useAuth failed (not inside provider)
    // Fall back to localStorage
    token = localStorage.getItem('token');
    if (!token) {
      console.warn('[useApi] Called outside AuthProvider, using localStorage token');
    }
  }

  const request = async (endpoint: string, options: RequestInit = {}) => {
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
  };

  return { request };
};
