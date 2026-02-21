import { useState, useEffect } from 'react';
import { GraduationCap, CircleNotch, ArrowLeft, CalendarBlank, MapPin, Clock, Check, CalendarX } from '@phosphor-icons/react';
import { useToast } from '../context/ToastContext';
import { getDeviceFingerprint } from '../utils/fingerprint';
import styles from './Presenca.module.css';

interface ActiveEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    roomName: string;
}

interface PresencaProps {
    onBack: () => void;
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function Presenca({ onBack }: PresencaProps) {
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [events, setEvents] = useState<ActiveEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<ActiveEvent | null>(null);
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch active events
    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        setLoadingEvents(true);
        try {
            const res = await fetch('/api/router.php?route=presencas');
            if (!res.ok) throw new Error('Erro ao buscar eventos');
            const data = await res.json();
            setEvents(data);
        } catch {
            showToast('Erro ao carregar eventos. Tente novamente.', 'error');
        } finally {
            setLoadingEvents(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');

        if (!nome.trim()) {
            setFormError('Informe seu nome completo');
            return;
        }
        if (!email.trim()) {
            setFormError('Informe seu e-mail');
            return;
        }
        if (!selectedEvent) return;

        setSubmitting(true);
        try {
            const fingerprint = await getDeviceFingerprint();
            const res = await fetch('/api/router.php?route=presencas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventoId: selectedEvent.id,
                    nomeCompleto: nome.trim(),
                    email: email.trim().toLowerCase(),
                    fingerprint,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409) {
                    setFormError(data.error || 'Presença já registrada');
                } else {
                    setFormError(data.error || 'Erro ao registrar presença');
                }
                return;
            }

            setStep(3);
        } catch {
            showToast('Erro de conexão. Tente novamente.', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    const formattedTime = currentTime.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
    const formattedDate = currentTime.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <div className={styles.page}>
            <div className={styles.bgPattern} />

            <div className={styles.container}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerIcon}>
                        <GraduationCap size={32} weight="duotone" />
                    </div>
                    <h1 className={styles.headerTitle}>Registrar Presença</h1>
                    <span className={styles.headerTime}>
                        {formattedDate} — {formattedTime}
                    </span>
                </div>

                {/* Step Dots */}
                <div className={styles.stepDots}>
                    <div className={`${styles.dot} ${step >= 1 ? styles.dotActive : ''}`} />
                    <div className={`${styles.dot} ${step >= 2 ? styles.dotActive : ''}`} />
                    <div className={`${styles.dot} ${step >= 3 ? styles.dotActive : ''}`} />
                </div>

                {/* Step 1: Select Event */}
                {step === 1 && (
                    <div className={styles.card}>
                        {loadingEvents ? (
                            <div className={styles.emptyState}>
                                <CircleNotch size={32} className={styles.spinner} />
                            </div>
                        ) : events.length === 0 ? (
                            <div className={styles.emptyState}>
                                <div className={styles.emptyIcon}>
                                    <CalendarX size={48} weight="duotone" />
                                </div>
                                <p className={styles.emptyText}>
                                    Nenhum evento acontecendo neste momento
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.eventsList}>
                                    {events.map(event => (
                                        <div
                                            key={event.id}
                                            className={`${styles.eventCard} ${selectedEvent?.id === event.id ? styles.eventCardSelected : ''}`}
                                            onClick={() => setSelectedEvent(event)}
                                        >
                                            <div className={styles.eventTitle}>{event.title}</div>
                                            <div className={styles.eventMeta}>
                                                {event.roomName && (
                                                    <>
                                                        <span className={styles.eventRoom}>
                                                            <MapPin size={14} />
                                                            {event.roomName}
                                                        </span>
                                                        <span className={styles.metaSeparator}>|</span>
                                                    </>
                                                )}
                                                <span className={styles.eventTime}>
                                                    <Clock size={14} />
                                                    {formatTime(event.start)} – {formatTime(event.end)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={styles.primaryBtn}
                                    disabled={!selectedEvent}
                                    onClick={() => setStep(2)}
                                >
                                    Próximo
                                </button>
                            </>
                        )}

                        <div className={styles.actions}>
                            <button className={styles.backLink} onClick={onBack}>
                                <ArrowLeft size={16} />
                                Voltar ao Login
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Identify Yourself */}
                {step === 2 && selectedEvent && (
                    <div className={styles.card}>
                        <div className={styles.eventSummary}>
                            <div className={styles.eventSummaryTitle}>
                                <CalendarBlank size={16} weight="fill" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                {selectedEvent.title}
                            </div>
                            <div className={styles.eventSummaryMeta}>
                                {selectedEvent.roomName && `${selectedEvent.roomName} · `}
                                {formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}
                            </div>
                        </div>

                        {formError && (
                            <div className={styles.errorBox}>{formError}</div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.label} htmlFor="nome">
                                    Nome Completo
                                </label>
                                <input
                                    id="nome"
                                    type="text"
                                    className={styles.input}
                                    value={nome}
                                    onChange={e => { setNome(e.target.value); setFormError(''); }}
                                    placeholder="Seu nome completo"
                                    autoFocus
                                    disabled={submitting}
                                />
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.label} htmlFor="email">
                                    E-mail
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className={styles.input}
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setFormError(''); }}
                                    placeholder="seu.email@exemplo.com"
                                    disabled={submitting}
                                />
                            </div>

                            <button
                                type="submit"
                                className={styles.primaryBtn}
                                disabled={submitting || !nome.trim() || !email.trim()}
                            >
                                {submitting ? (
                                    <CircleNotch size={20} className={styles.spinner} />
                                ) : (
                                    'Registrar Presença'
                                )}
                            </button>
                        </form>

                        <div className={styles.actions}>
                            <button className={styles.backLink} onClick={() => { setStep(1); setFormError(''); }}>
                                <ArrowLeft size={16} />
                                Voltar
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && selectedEvent && (
                    <div className={styles.card}>
                        <div className={styles.successContainer}>
                            <div className={styles.successCheckWrapper}>
                                <div className={styles.successCircle}>
                                    <Check size={40} weight="bold" className={styles.successCheckIcon} />
                                </div>
                            </div>
                            <h2 className={styles.successTitle}>Sua presença em sala foi registrada!</h2>
                            <p className={styles.successMessage}>
                                Confira os detalhes do evento abaixo.
                            </p>
                            <div className={styles.successDetails}>
                                <div className={styles.successDetailRow}>
                                    <span className={styles.successDetailLabel}>Evento</span>
                                    <span className={styles.successDetailValue}>{selectedEvent.title}</span>
                                </div>
                                {selectedEvent.roomName && (
                                    <div className={styles.successDetailRow}>
                                        <span className={styles.successDetailLabel}>Sala</span>
                                        <span className={styles.successDetailValue}>{selectedEvent.roomName}</span>
                                    </div>
                                )}
                                <div className={styles.successDetailRow}>
                                    <span className={styles.successDetailLabel}>Horário</span>
                                    <span className={styles.successDetailValue}>
                                        {formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}
                                    </span>
                                </div>
                                <div className={styles.successDetailRow}>
                                    <span className={styles.successDetailLabel}>Nome</span>
                                    <span className={styles.successDetailValue}>{nome}</span>
                                </div>
                                <div className={styles.successDetailRow}>
                                    <span className={styles.successDetailLabel}>E-mail</span>
                                    <span className={styles.successDetailValue}>{email}</span>
                                </div>
                            </div>
                            <button className={styles.closeBtn} onClick={onBack}>
                                Fechar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
