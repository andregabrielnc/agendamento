import { useState, useEffect } from 'react';
import { X, AlignLeft, CaretDown, Check, TextB, TextItalic, TextUnderline, ListNumbers, List, Link, TextStrikethrough, Lock, Phone } from '@phosphor-icons/react';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import styles from './EventModal.module.css';
import { format } from 'date-fns';
import { RecurrenceModal } from './RecurrenceModal';
import { ConfirmDialog } from './ConfirmDialog';
import type { RecurrenceRule } from './RecurrenceModal';

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
    const [calendarId, setCalendarId] = useState(calendars[0]?.id || '');
    const [allDay, setAllDay] = useState(false);
    const [phone, setPhone] = useState('');

    // Recurrence State
    const [recurrence, setRecurrence] = useState<string | 'custom'>('none');
    const [customRule, setCustomRule] = useState<RecurrenceRule | null>(null);
    const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
    const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

    // UI State
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (type === 'create' && selectedDate) {
                setTitle('');
                setDescription('');
                setDate(format(selectedDate, 'yyyy-MM-dd'));
                setEndDateStr(format(selectedDate, 'yyyy-MM-dd'));
                setStart(format(new Date(), 'HH:mm'));
                setEnd(format(new Date(new Date().getTime() + 60 * 60 * 1000), 'HH:mm'));
                setCalendarId(calendars[0]?.id || '');
                setAllDay(false);
                setPhone('');
                setRecurrence('none');
                setCustomRule(null);
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
                setPhone(event.phone || '');

                if (typeof event.recurrence === 'object' && event.recurrence !== null) {
                    setRecurrence('custom');
                    setCustomRule(event.recurrence as RecurrenceRule);
                } else {
                    setRecurrence((event.recurrence as string) || 'none');
                    setCustomRule(null);
                }
            }
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

        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            showToast('Telefone do responsável é obrigatório.', 'error');
            return;
        }

        const eventData = {
            title: title || '(Sem título)',
            start: startDate,
            end: endDate,
            description,
            phone,
            calendarId,
            color: selectedCalendar?.color,
            allDay,
            recurrence: recurrence === 'custom' && customRule ? customRule : (recurrence as any),
            createdBy: event?.createdBy || user?.id,
        };

        if (type === 'create') {
            addEvent(eventData);
            showToast('Evento criado', 'success');
            closeModal();
        } else if (type === 'edit' && event) {
            updateEvent({ ...event, ...eventData });
            showToast('Evento atualizado', 'success');
            closeModal();
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

        const cal = calendars.find(c => c.id === event.calendarId);

        addEvent({
            title: `${event.title} (cópia)`,
            start: event.start,
            end: event.end,
            description: event.description,
            phone: event.phone,
            calendarId: event.calendarId,
            color: cal?.color,
            allDay: event.allDay,
            recurrence: event.recurrence,
        });
        closeModal();
        showToast('Evento duplicado', 'success');
    };

    const handlePrint = () => {
        window.print();
        setShowMoreActions(false);
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

    const selectedCalendar = calendars.find(c => c.id === calendarId);

    const formatPhone = (value: string) => {
        const digits = value.replace(/\D/g, '').substring(0, 11);
        if (digits.length === 0) return '';
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 6) return `(${digits.substring(0, 2)})${digits.substring(2)}`;
        return `(${digits.substring(0, 2)})${digits.substring(2, 6)}-${digits.substring(6)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhone(e.target.value));
    };

    return (
        <div className={styles.overlay} onClick={closeModal}>
            <div className={styles.modal} onClick={e => { e.stopPropagation(); setShowRecurrenceOptions(false); setShowMoreActions(false); }}>

                {/* ===== Header ===== */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        {!canEdit && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                                <Lock size={14} /> Somente leitura
                            </span>
                        )}
                    </div>
                    <div className={styles.headerRight}>
                        <button onClick={closeModal} className={styles.iconBtn} title="Fechar">
                            <X size={20} />
                        </button>
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

                    {/* Form Fields */}
                    <div className={styles.formFields}>

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
                                {selectedCalendar?.description && (
                                    <span className={styles.calendarDescription}>
                                        {selectedCalendar.description}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Phone */}
                        <div className={styles.fieldRow}>
                            <Phone size={20} className={styles.fieldIcon} />
                            <input
                                type="tel"
                                placeholder="Telefone do responsável"
                                className={styles.input}
                                value={phone}
                                onChange={handlePhoneChange}
                            />
                        </div>

                        {/* Description */}
                        <div className={styles.fieldRow}>
                            <AlignLeft size={20} className={styles.fieldIcon} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <textarea
                                    placeholder="Adicionar descrição"
                                    className={styles.textarea}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    maxLength={500}
                                />
                                <span className={styles.charCount}>
                                    {description.length}/500
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== Footer ===== */}
                <div className={styles.modalFooter}>
                    <div className={styles.footerLeft}>
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
                    <div className={styles.footerRight}>
                        {isEditing && canEdit && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    className={styles.moreActionsBtn}
                                    onClick={(e) => { e.stopPropagation(); setShowMoreActions(!showMoreActions); }}
                                >
                                    Mais ações
                                    <CaretDown size={14} weight="bold" />
                                </button>
                                {showMoreActions && (
                                    <div className={styles.actionsDropdown}>
                                        <button onClick={handleDuplicate}>Duplicar</button>
                                        <button onClick={handlePrint}>Imprimir</button>
                                        <button className={styles.deleteAction} onClick={handleDelete}>Excluir</button>
                                    </div>
                                )}
                            </div>
                        )}
                        {canEdit && (
                            <button className={styles.saveBtn} onClick={() => handleSubmit()}>
                                Salvar
                            </button>
                        )}
                    </div>
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
