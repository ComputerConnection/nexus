import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseTauriIPCOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export function useTauriIPC<T, P = void>(
  command: string,
  options: UseTauriIPCOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (params?: P) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await invoke<T>(command, params as Record<string, unknown>);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage = String(err);
        setError(errorMessage);
        options.onError?.(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [command, options.onSuccess, options.onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  };
}

export function useSystemStatus() {
  return useTauriIPC<{
    version: string;
    activeAgents: number;
    databaseConnected: boolean;
    uptimeSeconds: number;
  }>('get_system_status');
}

export function useDatabaseStatus() {
  return useTauriIPC<{
    connected: boolean;
    poolSize?: number;
    idleConnections?: number;
  }>('get_database_status');
}
