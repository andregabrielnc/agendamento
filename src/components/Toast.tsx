import { useEffect, useState, useCallback } from 'react';
import styles from './Toast.module.css';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
    onUndo?: () => void;
}

interface ToastItemProps {
    toast: ToastData;
    onDismiss: (id: string) => void;
}

function ToastIcon({ type }: { type: ToastType }) {
    switch (type) {
        case 'success':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            );
        case 'error':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            );
        case 'info':
            return (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
            );
    }
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
    const [exiting, setExiting] = useState(false);

    const handleDismiss = useCallback(() => {
        setExiting(true);
        setTimeout(() => {
            onDismiss(toast.id);
        }, 250);
    }, [onDismiss, toast.id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleDismiss();
        }, toast.duration);
        return () => clearTimeout(timer);
    }, [toast.duration, handleDismiss]);

    const handleUndo = () => {
        if (toast.onUndo) {
            toast.onUndo();
        }
        handleDismiss();
    };

    const toastClassName = [
        styles.toast,
        styles[toast.type],
        exiting ? styles.exiting : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={toastClassName}
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <span className={styles.icon}>
                <ToastIcon type={toast.type} />
            </span>
            <span className={styles.message}>{toast.message}</span>
            <div className={styles.actions}>
                {toast.onUndo && (
                    <button
                        className={styles.undoBtn}
                        onClick={handleUndo}
                        type="button"
                    >
                        Desfazer
                    </button>
                )}
                <button
                    className={styles.closeBtn}
                    onClick={handleDismiss}
                    type="button"
                    aria-label="Fechar notificação"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastData[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    if (toasts.length === 0) return null;

    return (
        <div className={styles.container} aria-label="Notificações">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
}
