import { useState, useCallback } from 'react';
import { useMotia } from '@/components/MotiaProvider';

interface StreamMessage {
  type: string;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface UseMotiaStreamOptions {
  onMessage?: (message: StreamMessage) => void;
  onComplete?: (message: StreamMessage) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook to call Motia endpoints with streaming support
 * 
 * @example
 * const { execute, loading, messages } = useMotiaStream({
 *   onMessage: (msg) => console.log('Progress:', msg),
 *   onComplete: (msg) => console.log('Done!', msg),
 * });
 * 
 * await execute('/oracle-games/set-all-rankings', { year: 2025 });
 */
export function useMotiaStream(options: UseMotiaStreamOptions = {}) {
  const { address, ws } = useMotia();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (endpoint: string, body: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    setLoading(true);
    setError(null);
    setMessages([]);

    try {
      // Convert ws:// to http:// for the API call
      const httpUrl = address.replace('ws://', 'http://').replace('wss://', 'https://');
      const url = `${httpUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      // Set up WebSocket listener for streaming messages
      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
          setMessages(prev => [...prev, message]);
          
          if (options.onMessage) {
            options.onMessage(message);
          }
          
          if (message.type === 'complete' && options.onComplete) {
            options.onComplete(message);
          }
        } catch (err) {
          console.error('Error parsing stream message:', err);
        }
      };

      if (ws) {
        ws.addEventListener('message', messageHandler);
      }

      // Make the API call
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Clean up listener
      if (ws) {
        ws.removeEventListener('message', messageHandler);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [address, ws, options]);

  return { execute, loading, messages, error };
}
