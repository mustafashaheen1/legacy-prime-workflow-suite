import { useState, useCallback } from 'react';

export interface UploadProgressState {
  isUploading: boolean;
  progress: number; // 0-100
  error: string | null;
  phase: 'idle' | 'compressing' | 'uploading' | 'complete' | 'error';
}

export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>({
    isUploading: false,
    progress: 0,
    error: null,
    phase: 'idle',
  });

  const setIsUploading = useCallback((uploading: boolean) => {
    setState((prev) => ({
      ...prev,
      isUploading: uploading,
      phase: uploading ? 'compressing' : 'idle',
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error,
      phase: error ? 'error' : prev.phase,
      isUploading: error ? false : prev.isUploading,
    }));
  }, []);

  const setPhase = useCallback((phase: UploadProgressState['phase']) => {
    setState((prev) => ({
      ...prev,
      phase,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      phase: 'idle',
    });
  }, []);

  const startCompression = useCallback(() => {
    setState({
      isUploading: true,
      progress: 10,
      error: null,
      phase: 'compressing',
    });
  }, []);

  const startUpload = useCallback(() => {
    setState((prev) => ({
      ...prev,
      progress: 30,
      phase: 'uploading',
    }));
  }, []);

  const complete = useCallback(() => {
    setState({
      isUploading: false,
      progress: 100,
      error: null,
      phase: 'complete',
    });
  }, []);

  return {
    ...state,
    setIsUploading,
    setProgress,
    setError,
    setPhase,
    reset,
    startCompression,
    startUpload,
    complete,
  };
}
