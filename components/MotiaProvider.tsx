"use client";

import { createContext, useContext, ReactNode, useEffect, useState, useRef } from 'react';
import { MotiaStreamProvider as MotiaStreamClientProvider } from '@motiadev/stream-client-react';

interface MotiaContextType {
  address: string;
  call: <T = any>(endpoint: string, options?: RequestInit) => Promise<T>;
  ws: WebSocket | null;
}

const MotiaContext = createContext<MotiaContextType | undefined>(undefined);

export function MotiaProvider({ 
  children,
  address = 'ws://localhost:3000' // Default Motia WebSocket address
}: { 
  children: ReactNode;
  address?: string;
}) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Create WebSocket connection
    const websocket = new WebSocket(address);
    
    websocket.onopen = () => {
      console.log('WebSocket connected to', address);
      setWs(websocket);
      wsRef.current = websocket;
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setWs(null);
      wsRef.current = null;
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [address]);

  const call = async <T = any,>(endpoint: string, options?: RequestInit): Promise<T> => {
    // Convert ws:// to http:// for REST calls
    const httpUrl = address.replace('ws://', 'http://').replace('wss://', 'https://');
    const url = `${httpUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Motia API error: ${response.statusText}`);
    }

    return response.json();
  };

  return (
    <MotiaStreamClientProvider address={address}>
      <MotiaContext.Provider value={{ address, call, ws }}>
        {children}
      </MotiaContext.Provider>
    </MotiaStreamClientProvider>
  );
}

export function useMotia() {
  const context = useContext(MotiaContext);
  if (!context) {
    throw new Error('useMotia must be used within a MotiaProvider');
  }
  return context;
}
