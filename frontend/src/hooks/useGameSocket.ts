import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useGameSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
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
      console.warn('[useGameSocket] Called outside AuthProvider, using localStorage token');
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
    
    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      newSocket.emit('authenticate', { token });
    });

    newSocket.on('authenticated', () => {
      console.log('Socket authenticated successfully');
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token]);

  return { socket, connected };
};
