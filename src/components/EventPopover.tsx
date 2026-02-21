import { useRef, useEffect, useState } from 'react';
import { X, Trash, PencilSimple, Phone } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent, RecurrenceEditMode } from '../types';
import styles from './EventPopover.module.css';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';
import { RecurrenceActionDialog } from './RecurrenceActionDialog';

interface EventPopoverProps {
    event: CalendarEvent;
    anchorEl: HTMLElement | null;
    onClose: () => void;
}

export function EventPopover({ event, anchorEl, onClose }: EventPopoverProps) {
    const { deleteEvent, openEditModal, events } = useCalendar();
    const { canEditEvent, users } = useAuth();
    const { showToast } = useToast();
    const canEdit = canEditEvent(event.createdBy);
    const creator = users.find(u => u.id === event.createdBy);
    const popoverRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);

    const isRecurringEvent = event.recurrence && event.recurrence !== 'none';

    useEffect(() => {
        if (anchorEl && popoverRef.current) {
            const rect = anchorEl.getBoundingClientRect();
            const popoverRect = popoverRef.current.getBoundingClientRect();

            let top = rect.top;
            let left = rect.left + rect.width + 10;

            if (left + popoverRect.width > window.innerWidth) {
                left = rect.left - popoverRect.width - 10;
            }

            if (top + popoverRect.height > window.innerHeight) {
                top = window.innerHeight - popoverRect.height - 20;
            }

            if (left < 0) left = 8;
            if (top < 0) top = 8;

            setStyle({ top, left });
        }
    }, [anchorEl]);

    if (!anchorEl) return null;

    const handleDelete = () => {
        if (isRecurringEvent) {
            setShowRecurrenceDialog(true);
        } else {
            setShowDeleteConfirm(true);
        }
    };

    const confirmDelete = () => {
        deleteEvent(event.id);
        onClose();
        showToast('Evento excluído', 'info');
        setShowDeleteConfirm(false);
    };

    const handleRecurrenceDeleteConfirm = (mode: RecurrenceEditMode) => {
        setShowRecurrenceDialog(false);
        const instanceDate = format(event.start, 'yyyy-MM-dd');
        deleteEvent(event.id, mode, instanceDate);
        onClose();
        showToast('Evento excluído', 'info');
    };

    const handleEdit = () => {
        const originalId = event.id.split('_')[0];
        const originalEvent = events.find(e => e.id === originalId);
        openEditModal(originalEvent || event, event.start);
        onClose();
    };

    const timeDisplay = event.allDay
        ? format(event.start, 'EEEE, d MMMM', { locale: ptBR })
        : `${format(event.start, 'EEEE, d MMMM', { locale: ptBR })} ⋅ ${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`;

    return (
        <>
            <div className={styles.overlay} onClick={onClose}>
                <div
                    className={styles.popover}
                    style={style}
                    ref={popoverRef}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={styles.actionsHeader}>
                        <div className={styles.actionGroup}>
                            {canEdit && (
                                <>
                                    <button onClick={handleEdit} className={styles.iconBtn} title="Editar evento">
                                        <PencilSimple size={18} />
                                    </button>
                                    <button onClick={handleDelete} className={styles.iconBtn} title="Excluir evento">
                                        <Trash size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className={styles.closeBtn}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.row}>
                            <div className={styles.colorStrip} style={{ backgroundColor: event.color || 'var(--primary)' }}></div>
                            <div className={styles.textContent}>
                                <h3 className={styles.title}>{event.title}</h3>
                                <div className={styles.time}>{timeDisplay}</div>
                            </div>
                        </div>

                        {event.phone && (
                            <div className={styles.detailRow}>
                                <Phone size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                                <span className={styles.description}>{event.phone}</span>
                            </div>
                        )}

                        {event.description && (
                            <div className={styles.detailRow}>
                                <div className={styles.iconSpacer} />
                                <p className={styles.description}>{event.description}</p>
                            </div>
                        )}

                        <div className={styles.footer}>
                            <div className={styles.owner}>
                                Criado por: {creator?.name || 'Desconhecido'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Excluir evento"
                message={`Excluir "${event.title}"?`}
                confirmLabel="Excluir"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />

            <RecurrenceActionDialog
                isOpen={showRecurrenceDialog}
                title="Excluir evento recorrente"
                onConfirm={handleRecurrenceDeleteConfirm}
                onCancel={() => setShowRecurrenceDialog(false)}
            />
        </>
    );
}
