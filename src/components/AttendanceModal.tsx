import { useEffect, useState, useRef, useCallback } from 'react';
import { X, FileXls, FilePdf } from '@phosphor-icons/react';
import type { CalendarEvent } from '../types';
import type { AttendanceRecord } from '../services/calendarService';
import { calendarService } from '../services/calendarService';
import { exportToExcel } from '../utils/exportExcel';
import styles from './AttendanceModal.module.css';

interface AttendanceModalProps {
    isOpen: boolean;
    event: CalendarEvent;
    onClose: () => void;
}

export function AttendanceModal({ isOpen, event, onClose }: AttendanceModalProps) {
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement as HTMLElement;
        setLoading(true);

        const eventId = event.id.split('_')[0];
        calendarService.fetchAttendance(eventId)
            .then(data => setRecords(data))
            .catch(() => setRecords([]))
            .finally(() => setLoading(false));

        return () => {
            previousFocusRef.current?.focus();
        };
    }, [isOpen, event.id]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    }, [onClose]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    const formatDateTime = (value: string) => {
        const d = new Date(value);
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleExportExcel = () => {
        exportToExcel(
            records as unknown as Record<string, unknown>[],
            `presencas-${event.title.replace(/\s+/g, '_')}`,
            [
                { key: 'nome_completo', header: 'Nome' },
                { key: 'email', header: 'E-mail' },
                { key: 'sala_nome', header: 'Sala' },
                { key: 'criado_em', header: 'Data/Hora' },
            ]
        );
    };

    const handleExportPdf = () => {
        const rows = records.map((r, i) =>
            `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:center">${i + 1}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #ddd">${r.nome_completo}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #ddd">${r.email}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #ddd">${formatDateTime(r.criado_em)}</td>
            </tr>`
        ).join('');

        const html = `
            <html>
            <head>
                <title>Presenças - ${event.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 24px; color: #333; }
                    h2 { margin-bottom: 4px; }
                    p { color: #666; margin-top: 0; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th { background: #f5f5f5; font-weight: 600; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h2>${event.title}</h2>
                <p>${records.length} pessoa(s) registraram presença</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;text-align:center">#</th>
                            <th>Nome</th>
                            <th>E-mail</th>
                            <th>Data/Hora</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '-9999px';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 250);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={styles.overlay}
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-title"
        >
            <div className={styles.dialog} ref={dialogRef}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <h2 className={styles.title} id="attendance-title">{event.title}</h2>
                        {!loading && (
                            <div className={styles.count}>
                                {records.length} pessoa(s) registraram presença
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className={styles.closeBtn} aria-label="Fechar">
                        <X size={18} />
                    </button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner} />
                            Carregando presenças...
                        </div>
                    ) : records.length === 0 ? (
                        <div className={styles.empty}>
                            Nenhuma presença registrada
                        </div>
                    ) : (
                        <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th className={styles.colNum}>#</th>
                                        <th>Nome</th>
                                        <th>E-mail</th>
                                        <th>Data/Hora</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map((r, i) => (
                                        <tr key={r.id}>
                                            <td className={styles.colNum}>{i + 1}</td>
                                            <td>{r.nome_completo}</td>
                                            <td className={styles.colEmail}>{r.email}</td>
                                            <td className={styles.colDate}>{formatDateTime(r.criado_em)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {!loading && records.length > 0 && (
                    <div className={styles.footer}>
                        <button
                            onClick={handleExportExcel}
                            className={styles.exportBtn}
                            title="Exportar Excel"
                        >
                            <FileXls size={20} />
                        </button>
                        <button
                            onClick={handleExportPdf}
                            className={styles.exportBtn}
                            title="Exportar PDF"
                        >
                            <FilePdf size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
