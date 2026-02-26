import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, PaperPlaneRight, Trash, CheckCircle, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';

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
    categoria: string | null;
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
    const { showToast } = useToast();

    const CATEGORIAS = ['Dúvidas', 'Sugestões', 'Elogios'] as const;

    const [reports, setReports] = useState<Report[]>([]);
    const [categoria, setCategoria] = useState<string>(CATEGORIAS[0]);
    const [descricao, setDescricao] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [finalizingId, setFinalizingId] = useState<string | null>(null);
    const [finalizingMsg, setFinalizingMsg] = useState('');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

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
            setPage(1);
        }
    }, [isOpen, fetchReports]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(reports.length / ITEMS_PER_PAGE)), [reports.length, ITEMS_PER_PAGE]);
    const paginatedReports = useMemo(() => reports.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [reports, page, ITEMS_PER_PAGE]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!descricao.trim()) {
            showToast('Preencha a descrição', 'error');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/router.php?route=reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sala_id: null,
                    categoria: categoria,
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
                setCategoria(CATEGORIAS[0]);
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

    const handleFinalize = async (id: string, mensagem: string) => {
        try {
            const res = await fetch(`/api/router.php?route=reports/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'finalizar', mensagem: mensagem.trim() }),
            });
            const data = await res.json();
            if (res.ok && !data.error) {
                showToast('Relato finalizado', 'success');
                setFinalizingId(null);
                setFinalizingMsg('');
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
                    <h2 className={styles.title}>Sugestões e Melhorias</h2>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.formRow}>
                        <div className={styles.formField}>
                            <label>Categoria</label>
                            <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                                {CATEGORIAS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className={styles.formFieldFull}>
                        <label>Descrição</label>
                        <div className={styles.textareaWrapper}>
                            <textarea
                                value={descricao}
                                onChange={e => setDescricao(e.target.value.slice(0, 500))}
                                placeholder="Informe aqui"
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
                    {reports.length === 0 ? (
                        <div className={styles.empty}>Nenhum relato registrado</div>
                    ) : (
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
                                {paginatedReports.map(r => (
                                    <tr key={r.id}>
                                        <td className={styles.dateCell} data-label="Data/Hora">
                                            {format(new Date(r.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </td>
                                        {isAdmin && <td className={styles.userCell} data-label="Usuário">{r.usuario_nome}</td>}
                                        <td data-label="Sala">{r.categoria || r.sala_nome || '—'}</td>
                                        <td className={styles.descCell} title={r.descricao} data-label="Relato">
                                            {finalizingId === r.id ? (
                                                <div className={styles.finalizeRow}>
                                                    <input
                                                        type="text"
                                                        className={styles.finalizeInput}
                                                        value={finalizingMsg}
                                                        onChange={e => setFinalizingMsg(e.target.value.slice(0, 120))}
                                                        placeholder="Resposta ao usuário..."
                                                        maxLength={120}
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleFinalize(r.id, finalizingMsg);
                                                            if (e.key === 'Escape') { setFinalizingId(null); setFinalizingMsg(''); }
                                                        }}
                                                    />
                                                    <span className={styles.finalizeCount}>{finalizingMsg.length}/120</span>
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.actionBtnFinalize}`}
                                                        onClick={() => handleFinalize(r.id, finalizingMsg)}
                                                        title="Confirmar"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        className={styles.actionBtn}
                                                        onClick={() => { setFinalizingId(null); setFinalizingMsg(''); }}
                                                        title="Cancelar"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                            ) : r.descricao}
                                        </td>
                                        <td data-label="Status">
                                            <span className={`${styles.badge} ${r.status === 'finalizado' ? styles.badgeFinalizado : styles.badgeAberto}`}>
                                                {r.status === 'finalizado' ? 'Finalizado' : 'Aberto'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className={styles.actions}>
                                                {isAdmin && r.status === 'aberto' && finalizingId !== r.id && (
                                                    <button
                                                        className={`${styles.actionBtn} ${styles.actionBtnFinalize}`}
                                                        onClick={() => { setFinalizingId(r.id); setFinalizingMsg(''); }}
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
                    )}
                </div>

                <div className={styles.footer}>
                    <span className={styles.footerCount}>{reports.length} relato{reports.length !== 1 ? 's' : ''}</span>
                    {reports.length > ITEMS_PER_PAGE && (
                        <div className={styles.pagination}>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                            >
                                <CaretLeft size={14} />
                            </button>
                            <span className={styles.pageInfo}>
                                {page} / {totalPages}
                            </span>
                            <button
                                className={styles.pageBtn}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                <CaretRight size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
