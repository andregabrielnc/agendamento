import { useState, useEffect } from 'react';
import { X, MapPin, AlignLeft, VideoCamera, Users, CaretDown, Check, Bell, TextB, TextItalic, TextUnderline, ListNumbers, List, Link, TextStrikethrough, Info, Palette, Lock } from '@phosphor-icons/react';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { calendarService } from '../services/calendarService';
import styles from './EventModal.module.css';
import { format } from 'date-fns';
import { RecurrenceModal } from './RecurrenceModal';
import { ConfirmDialog } from './ConfirmDialog';
import type { RecurrenceRule } from './RecurrenceModal';

const EVENT_COLORS = [
    { name: 'Tomate', color: '#d50000' },
    { name: 'Flamingo', color: '#e67c73' },
    { name: 'Tangerina', color: '#f4511e' },
    { name: 'Banana', color: '#f6bf26' },
    { name: 'Sálvia', color: '#33b679' },
    { name: 'Manjericão', color: '#0b8043' },
    { name: 'Pavão', color: '#039be5' },
    { name: 'Mirtilo', color: '#3f51b5' },
    { name: 'Lavanda', color: '#7986cb' },
    { name: 'Uva', color: '#8e24aa' },
    { name: 'Grafite', color: '#616161' },
];

export function EventModal() {
    const { modalState, closeModal, addEvent, updateEvent, deleteEvent, calendars } = useCalendar();
    const { user, canEditEvent } = useAuth();
    const { showToast } = useToast();
    const { isOpen, type, event, selectedDate } = modalState;

    const isEditing = type === 'edit';
    const canEdit = !isEditing || canEditEvent(event?.createdBy);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [date, setDate] = useState('');
    const [endDateStr, setEndDateStr] = useState('');
    const [calendarId, setCalendarId] = useState(calendars[0]?.id || '1');
    const [allDay, setAllDay] = useState(false);
    const [location, setLocation] = useState('');
    const [guestInput, setGuestInput] = useState('');
    const [guests, setGuests] = useState<string[]>([]);
    const [eventColor, setEventColor] = useState<string | undefined>(undefined);

    // Recurrence State
    const [recurrence, setRecurrence] = useState<string | 'custom'>('none');
    const [customRule, setCustomRule] = useState<RecurrenceRule | null>(null);
    const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
    const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'details' | 'time'>('details');
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Meeting Link State
    const [generatedLink, setGeneratedLink] = useState<string | undefined>(undefined);

    // Status fields
    const [busyStatus, setBusyStatus] = useState('busy');
    const [visibility, setVisibility] = useState('default');

    // Notification State
    const [reminderMinutes, setReminderMinutes] = useState(30);

    useEffect(() => {
        if (isOpen) {
            if (type === 'create' && selectedDate) {
                setTitle('');
                setDescription('');
                setDate(format(selectedDate, 'yyyy-MM-dd'));
                setEndDateStr(format(selectedDate, 'yyyy-MM-dd'));
                setStart(format(new Date(), 'HH:mm'));
                setEnd(format(new Date(new Date().getTime() + 60 * 60 * 1000), 'HH:mm'));
                setCalendarId(calendars[0]?.id || '1');
                setAllDay(false);
                setLocation('');
                setGuests([]);
                setRecurrence('none');
                setCustomRule(null);
                setGeneratedLink(undefined);
                setBusyStatus('busy');
                setVisibility('default');
                setEventColor(undefined);
                setReminderMinutes(30);
            } else if (type === 'edit' && event) {
                setTitle(event.title);
                setDescription(event.description || '');
                setDate(format(event.start, 'yyyy-MM-dd'));
                setEndDateStr(format(event.end, 'yyyy-MM-dd'));
                if (event.allDay) {
                    setAllDay(true);
                    setStart('00:00');
                    setEnd('23:59');
                } else {
                    setAllDay(false);
                    setStart(format(event.start, 'HH:mm'));
                    setEnd(format(event.end, 'HH:mm'));
                }
                setCalendarId(event.calendarId);
                setLocation(event.location || '');
                setGuests(event.guests || []);
                setEventColor(event.color);
                setReminderMinutes(event.reminders?.[0]?.minutes ?? 30);

                if (typeof event.recurrence === 'object' && event.recurrence !== null) {
                    setRecurrence('custom');
                    setCustomRule(event.recurrence as RecurrenceRule);
                } else {
                    setRecurrence((event.recurrence as string) || 'none');
                    setCustomRule(null);
                }
                setGeneratedLink(undefined);
                setBusyStatus(event.busyStatus || 'busy');
                setVisibility(event.visibility || 'default');
            }
            setShowColorPicker(false);
            setShowDeleteConfirm(false);
        }
    }, [isOpen, type, event, selectedDate, calendars]);

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const startDate = new Date(`${date}T${start}`);
        const endDate = new Date(`${endDateStr}T${end}`);
        const selectedCalendar = calendars.find(c => c.id === calendarId);

        if (startDate >= endDate && !allDay) {
            showToast('A data de término deve ser posterior à data de início.', 'error');
            return;
        }

        const resolvedColor = eventColor || selectedCalendar?.color;

        const eventData = {
            title: title || '(Sem título)',
            start: startDate,
            end: endDate,
            description,
            calendarId,
            color: resolvedColor,
            allDay,
            location,
            guests,
            recurrence: recurrence === 'custom' && customRule ? customRule : (recurrence as any),
            meetingLink: generatedLink || event?.meetingLink || undefined,
            busyStatus: busyStatus as 'busy' | 'free',
            visibility: visibility as 'default' | 'public' | 'private',
            reminders: [{ type: 'notification' as const, minutes: reminderMinutes }],
            createdBy: event?.createdBy || user?.id,
        };

        if (type === 'create') {
            addEvent(eventData);
            showToast('Evento criado', 'success');
        } else if (type === 'edit' && event) {
            updateEvent({ ...event, ...eventData });
            showToast('Evento atualizado', 'success');
        }
    };

    const handleDelete = () => {
        setShowMoreActions(false);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (event) {
            deleteEvent(event.id);
            closeModal();
            showToast('Evento excluído', 'info', undefined, () => {
                // Undo would re-add, but for simplicity just notify
            });
        }
        setShowDeleteConfirm(false);
    };

    const handleDuplicate = () => {
        if (!event) return;
        setShowMoreActions(false);

        const selectedCalendar = calendars.find(c => c.id === calendarId);
        const resolvedColor = eventColor || selectedCalendar?.color;

        addEvent({
            title: `${event.title} (cópia)`,
            start: event.start,
            end: event.end,
            description: event.description,
            calendarId: event.calendarId,
            color: resolvedColor,
            allDay: event.allDay,
            location: event.location,
            guests: event.guests ? [...event.guests] : undefined,
            recurrence: event.recurrence,
            meetingLink: undefined,
        });
        closeModal();
        showToast('Evento duplicado', 'success');
    };

    const handlePrint = () => {
        window.print();
        setShowMoreActions(false);
    };

    const addGuest = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && guestInput.trim()) {
            e.preventDefault();
            setGuests([...guests, guestInput.trim()]);
            setGuestInput('');
        }
    };

    const removeGuest = (index: number) => {
        setGuests(guests.filter((_, i) => i !== index));
    };

    const getRecurrenceLabel = (currentRecurrence: string) => {
        if (currentRecurrence === 'none') return 'Não se repete';
        if (currentRecurrence === 'daily') return 'Todos os dias';
        if (currentRecurrence === 'weekly') return 'Semanalmente';
        if (currentRecurrence === 'monthly') return 'Mensalmente';
        if (currentRecurrence === 'custom' && customRule) {
            const freqMap: Record<string, string> = { daily: 'dia', weekly: 'semana', monthly: 'mês', yearly: 'ano' };
            const intervalStr = customRule.interval > 1 ? `Cada ${customRule.interval} ${freqMap[customRule.frequency]}s` : `Cada ${freqMap[customRule.frequency]}`;
            return intervalStr;
        }
        return currentRecurrence;
    };

    const onAddMeetClick = async () => {
        try {
            const link = await calendarService.generateMeetingLink();
            if (type === 'edit' && event) {
                updateEvent({ ...event, meetingLink: link });
            }
            setGeneratedLink(link);
            showToast('Link do Google Meet adicionado', 'success');
        } catch (e) {
            showToast('Erro ao gerar link do Meet', 'error');
            console.error("Failed to generate meet link", e);
        }
    };

    const selectedCalendar = calendars.find(c => c.id === calendarId);
    const displayColor = eventColor || selectedCalendar?.color || '#818cf8';

    return (
        <div className={styles.overlay} onClick={closeModal}>
            <div className={styles.modal} onClick={e => { e.stopPropagation(); setShowRecurrenceOptions(false); setShowMoreActions(false); setShowColorPicker(false); }}>

                {/* ===== Header ===== */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button onClick={closeModal} className={styles.iconBtn} title="Fechar">
                            <X size={20} />
                        </button>
                    </div>
                    <div className={styles.headerRight}>
                        {!canEdit && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                                <Lock size={14} /> Somente leitura
                            </span>
                        )}
                        {canEdit && (
                            <button className={styles.saveBtn} onClick={() => handleSubmit()}>
                                Salvar
                            </button>
                        )}
                        <div style={{ position: 'relative' }}>
                            <button
                                className={styles.moreActionsBtn}
                                onClick={(e) => { e.stopPropagation(); setShowMoreActions(!showMoreActions); }}
                            >
                                Mais ações
                                <CaretDown size={12} weight="bold" />
                            </button>
                            {showMoreActions && (
                                <div className={styles.actionsDropdown}>
                                    <button onClick={handlePrint}>Imprimir</button>
                                    {type === 'edit' && canEdit && <button onClick={handleDuplicate}>Duplicar</button>}
                                    {type === 'edit' && canEdit && <button onClick={handleDelete} className={styles.deleteAction}>Excluir</button>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ===== Body ===== */}
                <div className={styles.body}>

                    {/* Title */}
                    <div className={styles.titleSection}>
                        <input
                            type="text"
                            placeholder="Adicionar título"
                            className={styles.titleInput}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Date/Time Row */}
                    <div className={styles.dateTimeSection}>
                        <div className={styles.dateTimeRow}>
                            <input
                                type="date"
                                className={styles.dateChip}
                                value={date}
                                onChange={e => { setDate(e.target.value); if (!endDateStr || endDateStr < e.target.value) setEndDateStr(e.target.value); }}
                            />
                            {!allDay && (
                                <>
                                    <input
                                        type="time"
                                        className={styles.timeChip}
                                        value={start}
                                        onChange={e => setStart(e.target.value)}
                                    />
                                    <span className={styles.timeSeparator}>até</span>
                                    <input
                                        type="time"
                                        className={styles.timeChip}
                                        value={end}
                                        onChange={e => setEnd(e.target.value)}
                                    />
                                </>
                            )}
                            <input
                                type="date"
                                className={styles.dateChip}
                                value={endDateStr}
                                onChange={e => setEndDateStr(e.target.value)}
                            />
                        </div>

                        <div className={styles.optionsRow}>
                            <div className={styles.allDayGroup}>
                                <input
                                    type="checkbox"
                                    id="allDay"
                                    checked={allDay}
                                    onChange={e => setAllDay(e.target.checked)}
                                />
                                <label htmlFor="allDay">Dia inteiro</label>
                            </div>

                            <div className={styles.recurrenceWrapper}>
                                <button
                                    type="button"
                                    className={styles.recurrenceBtn}
                                    onClick={(e) => { e.stopPropagation(); setShowRecurrenceOptions(!showRecurrenceOptions); }}
                                >
                                    {getRecurrenceLabel(recurrence)}
                                    <CaretDown size={14} weight="bold" />
                                </button>
                                {showRecurrenceOptions && (
                                    <div className={styles.recurrenceDropdown}>
                                        <div className={styles.recurrenceOption} onClick={() => { setRecurrence('none'); setShowRecurrenceOptions(false); }}>
                                            Não se repete
                                            {recurrence === 'none' && <Check size={14} />}
                                        </div>
                                        <div className={styles.recurrenceOption} onClick={() => { setRecurrence('daily'); setShowRecurrenceOptions(false); }}>
                                            Todos os dias
                                            {recurrence === 'daily' && <Check size={14} />}
                                        </div>
                                        <div className={styles.recurrenceOption} onClick={() => { setRecurrence('weekly'); setShowRecurrenceOptions(false); }}>
                                            Semanalmente
                                            {recurrence === 'weekly' && <Check size={14} />}
                                        </div>
                                        <div className={styles.recurrenceOption} onClick={() => { setRecurrence('monthly'); setShowRecurrenceOptions(false); }}>
                                            Mensalmente no dia {date ? format(new Date(date + 'T12:00:00'), 'd') : '?'}
                                            {recurrence === 'monthly' && <Check size={14} />}
                                        </div>
                                        <div className={styles.separator} />
                                        <div className={styles.recurrenceOption} onClick={() => { setShowRecurrenceOptions(false); setIsRecurrenceModalOpen(true); }}>
                                            Personalizar...
                                            {recurrence === 'custom' && <Check size={14} />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className={styles.tabs}>
                        <button
                            className={`${styles.tab} ${activeTab === 'details' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('details')}
                        >
                            Detalhes do evento
                        </button>
                        <button
                            className={`${styles.tab} ${activeTab === 'time' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('time')}
                        >
                            Encontrar um horário
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'details' ? (
                        <div className={styles.formFields}>

                            {/* Google Meet */}
                            <div className={styles.meetRow}>
                                <VideoCamera size={20} className={styles.fieldIcon} weight="fill" />
                                {((event?.meetingLink) || generatedLink) ? (
                                    <div className={styles.meetLink}>
                                        <a href={event?.meetingLink || generatedLink} target="_blank" rel="noreferrer">
                                            Entrar no Google Meet
                                        </a>
                                        <X
                                            size={16}
                                            className={styles.removeMeet}
                                            onClick={() => {
                                                if (event) updateEvent({ ...event, meetingLink: undefined });
                                                setGeneratedLink(undefined);
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <button type="button" className={styles.meetBtn} onClick={onAddMeetClick}>
                                        Adicionar videoconferência do Google Meet
                                    </button>
                                )}
                            </div>

                            {/* Location */}
                            <div className={styles.fieldRow}>
                                <MapPin size={20} className={styles.fieldIcon} />
                                <input
                                    type="text"
                                    placeholder="Adicionar local"
                                    className={styles.input}
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                />
                            </div>

                            {/* Notification */}
                            <div className={styles.notificationRow}>
                                <Bell size={20} className={styles.fieldIcon} />
                                <select
                                    className={styles.notificationSelect}
                                    value={reminderMinutes}
                                    onChange={e => setReminderMinutes(Number(e.target.value))}
                                >
                                    <option value={0}>No horário do evento</option>
                                    <option value={5}>5 minutos antes</option>
                                    <option value={10}>10 minutos antes</option>
                                    <option value={15}>15 minutos antes</option>
                                    <option value={30}>30 minutos antes</option>
                                    <option value={60}>1 hora antes</option>
                                    <option value={1440}>1 dia antes</option>
                                </select>
                            </div>

                            {/* Guests */}
                            <div className={styles.fieldRow}>
                                <Users size={20} className={styles.fieldIcon} />
                                <div className={styles.guestsWrapper}>
                                    <input
                                        type="text"
                                        placeholder="Adicionar convidados"
                                        className={styles.input}
                                        value={guestInput}
                                        onChange={e => setGuestInput(e.target.value)}
                                        onKeyDown={addGuest}
                                    />
                                    {guests.length > 0 && (
                                        <div className={styles.guestList}>
                                            {guests.map((guest, i) => (
                                                <div key={i} className={styles.guestChip}>
                                                    <span>{guest}</span>
                                                    <X size={12} onClick={() => removeGuest(i)} className={styles.removeGuest} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Color Picker */}
                            <div className={styles.fieldRow}>
                                <Palette size={20} className={styles.fieldIcon} />
                                <div className={styles.colorPickerContainer}>
                                    <button
                                        type="button"
                                        className={styles.colorPickerBtn}
                                        onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                                    >
                                        <div className={styles.colorSample} style={{ backgroundColor: displayColor }} />
                                        <span>{EVENT_COLORS.find(c => c.color === eventColor)?.name || 'Cor da agenda'}</span>
                                        <CaretDown size={14} />
                                    </button>
                                    {showColorPicker && (
                                        <div className={styles.colorDropdown} onClick={e => e.stopPropagation()}>
                                            <div
                                                className={`${styles.colorOption} ${!eventColor ? styles.colorOptionActive : ''}`}
                                                onClick={() => { setEventColor(undefined); setShowColorPicker(false); }}
                                            >
                                                <div className={styles.colorSwatch} style={{ backgroundColor: selectedCalendar?.color || '#039be5' }} />
                                                <span>Cor da agenda</span>
                                            </div>
                                            {EVENT_COLORS.map(c => (
                                                <div
                                                    key={c.color}
                                                    className={`${styles.colorOption} ${eventColor === c.color ? styles.colorOptionActive : ''}`}
                                                    onClick={() => { setEventColor(c.color); setShowColorPicker(false); }}
                                                >
                                                    <div className={styles.colorSwatch} style={{ backgroundColor: c.color }} />
                                                    <span>{c.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Calendar Selector */}
                            <div className={styles.fieldRow}>
                                <div className={styles.colorPickerTrigger}>
                                    <div className={styles.colorSample} style={{ backgroundColor: selectedCalendar?.color || '#818cf8' }}></div>
                                </div>
                                <div className={styles.calendarSelector}>
                                    <select
                                        value={calendarId}
                                        onChange={e => setCalendarId(e.target.value)}
                                        className={styles.select}
                                    >
                                        {calendars.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Status Row: Ocupado + Visibilidade */}
                            <div className={styles.statusRow}>
                                <select
                                    className={styles.statusSelect}
                                    value={busyStatus}
                                    onChange={e => setBusyStatus(e.target.value)}
                                >
                                    <option value="busy">Ocupado</option>
                                    <option value="free">Livre</option>
                                </select>
                                <select
                                    className={styles.statusSelect}
                                    value={visibility}
                                    onChange={e => setVisibility(e.target.value)}
                                >
                                    <option value="default">Visibilidade padrão</option>
                                    <option value="public">Público</option>
                                    <option value="private">Privado</option>
                                </select>
                                <span className={styles.infoIcon} title="Ocupado: outros verão que você está indisponível. Visibilidade: controla quem vê os detalhes do evento.">
                                    <Info size={18} />
                                </span>
                            </div>

                            {/* Description */}
                            <div className={styles.fieldRow}>
                                <AlignLeft size={20} className={styles.fieldIcon} />
                                <textarea
                                    placeholder="Adicionar descrição"
                                    className={styles.textarea}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.findTimePlaceholder}>
                            <span>Recurso "Encontrar um horário" em breve</span>
                        </div>
                    )}
                </div>

                {/* ===== Formatting Toolbar ===== */}
                <div className={styles.formattingToolbar}>
                    <button className={styles.toolbarBtn} title="Negrito"><TextB size={18} /></button>
                    <button className={styles.toolbarBtn} title="Itálico"><TextItalic size={18} /></button>
                    <button className={styles.toolbarBtn} title="Sublinhado"><TextUnderline size={18} /></button>
                    <div className={styles.toolbarSeparator} />
                    <button className={styles.toolbarBtn} title="Lista numerada"><ListNumbers size={18} /></button>
                    <button className={styles.toolbarBtn} title="Lista com marcadores"><List size={18} /></button>
                    <div className={styles.toolbarSeparator} />
                    <button className={styles.toolbarBtn} title="Link"><Link size={18} /></button>
                    <button className={styles.toolbarBtn} title="Tachado"><TextStrikethrough size={18} /></button>
                </div>
            </div>

            <RecurrenceModal
                isOpen={isRecurrenceModalOpen}
                onClose={() => setIsRecurrenceModalOpen(false)}
                initialRule={customRule || undefined}
                onSave={(rule) => {
                    setCustomRule(rule);
                    setRecurrence('custom');
                }}
            />

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Excluir evento"
                message={`Tem certeza que deseja excluir "${title || event?.title || 'este evento'}"?`}
                confirmLabel="Excluir"
                destructive
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    )
}
