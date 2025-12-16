/**
 * Toast Notification System for NyayaSutra
 * Provides context-based toast notifications with auto-dismiss and actions
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, RefreshCw } from 'lucide-react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast action button
export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

// Single toast notification
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // in ms, 0 = no auto-dismiss
  actions?: ToastAction[];
  dismissible?: boolean;
  createdAt: number;
}

// Toast context type
interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  // Convenience methods
  success: (title: string, message?: string, options?: Partial<Toast>) => string;
  error: (title: string, message?: string, options?: Partial<Toast>) => string;
  warning: (title: string, message?: string, options?: Partial<Toast>) => string;
  info: (title: string, message?: string, options?: Partial<Toast>) => string;
}

// Default toast durations
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 8000, // Errors stay longer
  warning: 6000,
  info: 5000
};

// Create context
const ToastContext = createContext<ToastContextType | null>(null);

// Generate unique ID
const generateId = () => `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add a new toast
  const addToast = useCallback((toast: Omit<Toast, 'id' | 'createdAt'>): string => {
    const id = generateId();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? DEFAULT_DURATIONS[toast.type],
      dismissible: toast.dismissible ?? true
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'success', title, message, ...options });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'error', title, message, ...options });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'warning', title, message, ...options });
  }, [addToast]);

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'info', title, message, ...options });
  }, [addToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        clearAllToasts,
        success,
        error,
        warning,
        info
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook to use toast context
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast container component
const ToastContainer: React.FC<{
  toasts: Toast[];
  onRemove: (id: string) => void;
}> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

// Individual toast item
const ToastItem: React.FC<{
  toast: Toast;
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300); // Wait for animation
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onRemove]);

  // Handle dismiss
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  // Get styles based on type
  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          icon: <CheckCircle className="text-green-500" size={20} />,
          titleColor: 'text-green-800',
          messageColor: 'text-green-600'
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: <AlertCircle className="text-red-500" size={20} />,
          titleColor: 'text-red-800',
          messageColor: 'text-red-600'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: <AlertTriangle className="text-yellow-500" size={20} />,
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-600'
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: <Info className="text-blue-500" size={20} />,
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-600'
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`
        ${styles.bg} border rounded-lg shadow-lg p-4
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        animate-slideIn
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm ${styles.titleColor}`}>
            {toast.title}
          </h4>
          {toast.message && (
            <p className={`mt-1 text-sm ${styles.messageColor}`}>
              {toast.message}
            </p>
          )}

          {/* Action buttons */}
          {toast.actions && toast.actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {toast.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    handleDismiss();
                  }}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                    ${action.variant === 'primary'
                      ? 'bg-saffron text-white hover:bg-saffron/90'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-full hover:bg-white/50 transition-colors"
            aria-label="Dismiss notification"
          >
            <X size={16} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current opacity-30 animate-shrink"
            style={{
              animationDuration: `${toast.duration}ms`,
              animationTimingFunction: 'linear'
            }}
          />
        </div>
      )}
    </div>
  );
};

// CSS for animations (add to your global CSS or include inline)
const ToastStyles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes shrink {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }

  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }

  .animate-shrink {
    animation: shrink linear forwards;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = ToastStyles;
  document.head.appendChild(styleSheet);
}

export default ToastProvider;
