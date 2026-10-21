import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Subscribe to a socket event for the lifetime of a component.
 * Usage: useSocketEvent('new-order', (order) => { ... })
 */
export function useSocketEvent(eventName, handler) {
  const { socket } = useContext(SocketContext) || {};
  useEffect(() => {
    if (!socket) return;
    socket.on(eventName, handler);
    return () => socket.off(eventName, handler);
  }, [socket, eventName, handler]);
}

export function useSocket() {
  return useContext(SocketContext);
}
