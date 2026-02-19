import { useRef, useEffect, useState } from 'react';
import { X, Trash, PencilSimple, MapPin, VideoCamera, Users, EnvelopeSimple } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CalendarEvent } from '../types';
import styles from './EventPopover.module.css';
import { useCalendar } from '../context/CalendarContext';

interface EventPopoverProps {
    event: CalendarEvent;
    anchorEl: HTMLElement | null;
    onClose: () => void;
}

export function EventPopover({ event, anchorEl, onClose }: EventPopoverProps) {
    const { deleteEvent, openEditModal, events } = useCalendar();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (anchorEl && popoverRef.current) {
            const rect = anchorEl.getBoundingClientRect();
            const popoverRect = popoverRef.current.getBoundingClientRect();

            // Basic positioning logic (center above or below)
            let top = rect.top;
            let left = rect.left + rect.width + 10; // Right side by default

            // Flip if too close to right edge
            if (left + popoverRect.width > window.innerWidth) {
                left = rect.left - popoverRect.width - 10;
            }

            // Flip if too close to bottom
            if (top + popoverRect.height > window.innerHeight) {
                top = window.innerHeight - popoverRect.height - 20;
            }

            setStyle({ top, left });
        }
    }, [anchorEl]);

    if (!anchorEl) return null;

    const handleDelete = () => {
        if (confirm('Excluir este evento?')) {
            deleteEvent(event.id); // CalendarContext strips the suffix
            onClose();
        }
    };

    const handleEdit = () => {
        // Resolve the original event for editing (instance ID has _N suffix)
        const originalId = event.id.split('_')[0];
        const originalEvent = events.find(e => e.id === originalId);
        openEditModal(originalEvent || event);
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div
                className={styles.popover}
                style={style}
                ref={popoverRef}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.actionsHeader}>
                    <div className={styles.actionGroup}>
                        <button onClick={handleEdit} className={styles.iconBtn} title="Editar evento">
                            <PencilSimple size={18} />
                        </button>
                        <button onClick={handleDelete} className={styles.iconBtn} title="Excluir evento">
                            <Trash size={18} />
                        </button>
                        <button className={styles.iconBtn} title="Enviar email para convidados">
                            <EnvelopeSimple size={18} />
                        </button>
                        <button className={styles.iconBtn} title="Mais opções">
                            <span className={styles.dots}>•••</span>
                        </button>
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
                            <div className={styles.time}>
                                {format(event.start, 'EEEE, d MMMM', { locale: ptBR })} ⋅ {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                            </div>
                        </div>
                    </div>

                    {event.location && (
                        <div className={styles.detailRow}>
                            <MapPin size={20} className={styles.icon} />
                            <span>{event.location}</span>
                        </div>
                    )}

                    {event.meetingLink && (
                        <div className={styles.detailRow}>
                            <VideoCamera size={20} className={styles.icon} />
                            <a href={event.meetingLink} target="_blank" rel="noreferrer" className={styles.link}>
                                Entrar com Google Meet
                            </a>
                        </div>
                    )}

                    {event.guests && event.guests.length > 0 && (
                        <div className={styles.detailRow}>
                            <Users size={20} className={styles.icon} />
                            <div className={styles.guestList}>
                                {event.guests.map((guest, i) => (
                                    <div key={i} className={styles.guest}>{guest}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {event.description && (
                        <div className={styles.detailRow}>
                            <div className={styles.iconSpacer} /> {/* Placeholder for align */}
                            <p className={styles.description}>{event.description}</p>
                        </div>
                    )}

                    <div className={styles.footer}>
                        <div className={styles.owner}>
                            Criado por: Andre Gabriel
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
