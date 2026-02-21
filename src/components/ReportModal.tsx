import { useState, useEffect, useCallback } from 'react';
import { X, PaperPlaneRight, Trash, CheckCircle } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './ReportModal.module.css';

interface Report {
    id: string;
    usuario_id: string;
    usuario_nome: string;
    sala_id: string | null;
    sala_nome: string | null;
    descricao: string;
    status: string;
    criado_em: string;
    finalizado_em: string | null;
    finalizado_por: string | null;
}

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNotificationsChange?: () => void;
}

export function ReportModal({ isOpen, onClose, onNotificationsChange }: ReportModalProps) {
    const { user, isAdmin } = useAuth();
    const { calendars } = useCalendar();
    const { showToast } = useToast();

    const [reports, setReports] = useState<Report[]>([]);
    const [salaId, setSalaId] = useState('');
    const [descricao, setDescricao] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchReports = useCallback(async () => {
        try {
            const res = await fetch('/api/router.php?route=reports');
            const data = await res.json();
            if (Array.isArray(data)) {
                setReports(data);
            }
        } catch {
            // silently fail
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchReports();
        }
    }, [isOpen, fetchReports]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!descricao.trim()) {
            showToast('Descreva o problema encontrado', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/router.php?route=reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sala_id: salaId || null,
                    descricao: descricao.trim(),
                }),
            });
            const text = await res.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch {
                showToast('Erro no servidor: resposta inválida', 'error');
                return;
            }
            if (res.ok && !data.error) {
                showToast('Relato enviado com sucesso', 'success');
                setDescricao('');
                setSalaId('');
                fetchReports();
            } else {
                showToast(data.error || 'Erro ao enviar relato', 'error');
            }
        } catch {
            showToast('Erro ao conectar com o servidor', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalize = async (id: string) => {
        try {
            const res = await fetch(`/api/router.php?route=reports/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'finalizar' }),
            });
            const data = await res.json();
            if (res.ok && !data.error) {
                showToast('Relato finalizado', 'success');
                fetchReports();
                onNotificationsChange?.();
            } else {
                showToast(data.error || 'Erro ao finalizar relato', 'error');
            }
        } catch {
            showToast('Erro ao conectar com o servidor', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/router.php?route=reports/${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (res.ok && !data.error) {
                showToast('Relato excluído', 'success');
                fetchReports();
            } else {
                showToast(data.error || 'Erro ao excluir relato', 'error');
            }
        } catch {
            showToast('Erro ao conectar com o servidor', 'error');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Informar Problema</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.formRow}>
                        <div className={styles.formField}>
                            <label>Sala / Agenda</label>
                            <select value={salaId} onChange={e => setSalaId(e.target.value)}>
                                <option value="">Geral (nenhuma sala)</option>
                                {calendars.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={styles.formFieldFull}>
                        <label>Relate o problema</label>
                        <div className={styles.textareaWrapper}>
                            <textarea
                                value={descricao}
                                onChange={e => setDescricao(e.target.value.slice(0, 500))}
                                placeholder="Descreva o problema encontrado..."
                                maxLength={500}
                            />
                            <span className={styles.charCount}>{descricao.length}/500</span>
                        </div>
                    </div>
                    <div className={styles.formActions}>
                        <button
                            className={styles.submitBtn}
                            onClick={handleSubmit}
                            disabled={submitting || !descricao.trim()}
                        >
                            <PaperPlaneRight size={16} />
                            Enviar
                        </button>
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Data/Hora</th>
                                {isAdmin && <th>Usuário</th>}
                                <th>Sala</th>
                                <th>Relato</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map(r => (
                                <tr key={r.id}>
                                    <td className={styles.dateCell}>
                                        {format(new Date(r.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </td>
                                    {isAdmin && <td className={styles.userCell}>{r.usuario_nome}</td>}
                                    <td>{r.sala_nome || '—'}</td>
                                    <td className={styles.descCell} title={r.descricao}>{r.descricao}</td>
                                    <td>
                                        <span className={`${styles.badge} ${r.status === 'finalizado' ? styles.badgeFinalizado : styles.badgeAberto}`}>
                                            {r.status === 'finalizado' ? 'Finalizado' : 'Aberto'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.actions}>
                                            {isAdmin && r.status === 'aberto' && (
                                                <button
                                                    className={`${styles.actionBtn} ${styles.actionBtnFinalize}`}
                                                    onClick={() => handleFinalize(r.id)}
                                                    title="Finalizar relato"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}
                                            {(r.usuario_id === user?.id || isAdmin) && (
                                                <button
                                                    className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                                                    onClick={() => handleDelete(r.id)}
                                                    title="Excluir relato"
                                                >
                                                    <Trash size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {reports.length === 0 && (
                        <div className={styles.empty}>Nenhum relato registrado</div>
                    )}
                </div>

                <div className={styles.footer}>
                    {reports.length} relato{reports.length !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
    );
}
