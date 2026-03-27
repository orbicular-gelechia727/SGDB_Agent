/* WebSocket hook for streaming query results */

import { useRef, useCallback, useState } from 'react';
import type { WSMessage, PipelineStage, QueryResponse } from '../types/api';

interface UseWebSocketOptions {
  onStage?: (stage: PipelineStage) => void;
  onResult?: (response: QueryResponse) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

export function useWebSocket(opts: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//biobigdata.nju.edu.cn/scdbAPI/query/stream`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setStreaming(false);
    };

    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);

      switch (msg.type) {
        case 'status':
          opts.onStage?.({
            stage: msg.data.stage as string,
            message: msg.data.message as string,
            timestamp: Date.now(),
            data: msg.data,
          });
          break;
        case 'result':
          opts.onResult?.(msg.data as unknown as QueryResponse);
          break;
        case 'done':
          setStreaming(false);
          opts.onDone?.();
          break;
        case 'error':
          setStreaming(false);
          opts.onError?.(msg.data.message as string);
          break;
      }
    };

    wsRef.current = ws;
  }, [opts]);

  const sendQuery = useCallback(
    (query: string, sessionId = 'default') => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
        // Wait for connection
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({ query, session_id: sessionId }));
          setStreaming(true);
        }, 500);
      } else {
        wsRef.current.send(JSON.stringify({ query, session_id: sessionId }));
        setStreaming(true);
      }
    },
    [connect],
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connected, streaming, connect, sendQuery, disconnect };
}
