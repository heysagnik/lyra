import { AlertCircle, RefreshCw, X } from "lucide-react";

export interface ToastProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function Toast({ message, onRetry, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 shadow-sm animate-in fade-in slide-in-from-top-2">
      <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      <span className="max-w-xs">{message}</span>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      )}

      <button
        onClick={onDismiss}
        className="p-1 text-red-500 hover:text-red-700"
        aria-label="Dismiss error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
