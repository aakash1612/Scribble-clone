import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socketInstance = null;

export function useSocket(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    const socket = socketInstance;

    const eventNames = Object.keys(handlersRef.current);
    eventNames.forEach(event => {
      socket.on(event, (...args) => handlersRef.current[event]?.(...args));
    });

    return () => {
      eventNames.forEach(event => socket.off(event));
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketInstance?.connected) {
      socketInstance.emit(event, data);
    }
  }, []);

  return { emit, socket: socketInstance };
}

export function getSocket() {
  return socketInstance;
}
