import { useState, useEffect, useRef, useCallback } from 'react';
import type { RecurrenceEditMode } from '../types';
import styles from './RecurrenceActionDialog.module.css';

interface RecurrenceActionDialogProps {
    isOpen: boolean;
    title: string;
    onConfirm: (mode: RecurrenceEditMode) => void;
    onCancel: () => void;
}

export function RecurrenceActionDialog({
    isOpen,
    title,
    onConfirm,
    onCancel,
}: RecurrenceActionDialogProps) {
    const [selected, setSelected] = useState<RecurrenceEditMode>('single');
    const dialogRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelected('single');
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            requestAnimationFrame(() => {
                confirmBtnRef.current?.focus();
            });
        }
        return () => {
            if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
                previousFocusRef.current.focus();
                previousFocusRef.current = null;
            }
        };
    }, [isOpen]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
            }
        },
        [onCancel]
    );

    const handleOverlayClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) {
                onCancel();
            }
        },
        [onCancel]
    );

    if (!isOpen) return null;

    const options: { value: RecurrenceEditMode; label: string }[] = [
        { value: 'single', label: 'Somente este evento' },
        { value: 'thisAndFollowing', label: 'Este e os seguintes' },
        { value: 'all', label: 'Todos os eventos' },
    ];

    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
            role="presentation"
        >
            <div
                ref={dialogRef}
                className={styles.dialog}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="recurrence-dialog-title"
            >
                <div className={styles.header}>
                    <h2 id="recurrence-dialog-title" className={styles.title}>
                        {title}
                    </h2>
                </div>
                <div className={styles.body}>
                    {options.map((opt) => (
                        <label key={opt.value} className={styles.radioOption}>
                            <input
                                type="radio"
                                name="recurrenceMode"
                                value={opt.value}
                                checked={selected === opt.value}
                                onChange={() => setSelected(opt.value)}
                            />
                            <span>{opt.label}</span>
                        </label>
                    ))}
                </div>
                <div className={styles.footer}>
                    <button
                        className={styles.cancelBtn}
                        onClick={onCancel}
                        type="button"
                    >
                        Cancelar
                    </button>
                    <button
                        ref={confirmBtnRef}
                        className={styles.confirmBtn}
                        onClick={() => onConfirm(selected)}
                        type="button"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
