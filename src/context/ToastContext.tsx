import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { ToastContainer } from '../components/Toast';
import type { ToastType, ToastData } from '../components/Toast';

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION = 4000;

interface ToastContextType {
    showToast: (
        message: string,
        type?: ToastType,
        duration?: number,
        onUndo?: () => void
    ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const idCounter = useRef(0);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (
            message: string,
            type: ToastType = 'info',
            duration: number = DEFAULT_DURATION,
            onUndo?: () => void
        ) => {
            const id = `toast-${Date.now()}-${idCounter.current++}`;

            const newToast: ToastData = {
                id,
                message,
                type,
                duration,
                onUndo,
            };

            setToasts((prev) => {
                const updated = [...prev, newToast];
                // Keep only the most recent toasts up to the limit
                if (updated.length > MAX_VISIBLE_TOASTS) {
                    return updated.slice(updated.length - MAX_VISIBLE_TOASTS);
                }
                return updated;
            });
        },
        []
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextType {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
