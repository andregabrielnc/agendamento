import { useState } from 'react';
import { X, ArrowLeft, Plus, Lock, UploadSimple, Check } from '@phosphor-icons/react';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseICS } from '../utils/icsParser';
import styles from './SettingsModal.module.css';
import type { Calendar } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCalendarId?: string;
}

type View = 'general' | 'calendars' | 'calendar-details';

const PRESET_COLORS = [
    '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679', '#0b8043',
    '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161', '#a79b8e',
    '#ad1457', '#d81b60', '#e91e63', '#f09300', '#009688', '#00897b',
    '#4285f4', '#5e6ec7', '#b39ddb', '#9e69af', '#795548', '#bcaaa4',
];

export function SettingsModal({ isOpen, onClose, initialCalendarId }: SettingsModalProps) {
    const { calendars, addCalendar, updateCalendar, deleteCalendar, addEvent } = useCalendar();
    const { isAdmin } = useAuth();
    const { showToast } = useToast();
    const [activeView, setActiveView] = useState<View>('general');
    const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);
    const [initializedFor, setInitializedFor] = useState<string | undefined>(undefined);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#818cf8');

    // Navigate to specific calendar when initialCalendarId is provided
    if (isOpen && initialCalendarId && initializedFor !== initialCalendarId) {
        const cal = calendars.find(c => c.id === initialCalendarId);
        if (cal) {
            setSelectedCalendar(cal);
            setName(cal.name);
            setDescription(cal.description || '');
            setColor(cal.color);
            setActiveView('calendar-details');
            setInitializedFor(initialCalendarId);
        }
    }
    if (!isOpen && initializedFor) {
        setInitializedFor(undefined);
    }

    // ICS Import State
    const [icsFile, setIcsFile] = useState<File | null>(null);
    const [icsEventCount, setIcsEventCount] = useState(0);

    if (!isOpen) return null;

    const handleCalendarClick = (calendar: Calendar) => {
        if (!isAdmin) return;
        setSelectedCalendar(calendar);
        setName(calendar.name);
        setDescription(calendar.description || '');
        setColor(calendar.color);
        setActiveView('calendar-details');
    };

    const handleAddClick = () => {
        if (!isAdmin) return;
        setSelectedCalendar(null);
        setName('');
        setDescription('');
        setColor('#818cf8');
        setIcsFile(null);
        setIcsEventCount(0);
        setActiveView('calendar-details');
    };

    const handleIcsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.ics')) {
            showToast('Selecione um arquivo .ics', 'error');
            return;
        }

        const text = await file.text();
        const parsed = parseICS(text);
        setIcsFile(file);
        setIcsEventCount(parsed.length);
    };

    const handleSave = async () => {
        if (!name.trim() || !isAdmin) return;

        if (selectedCalendar) {
            updateCalendar({
                ...selectedCalendar,
                name,
                description,
                color
            });
        } else {
            const result = await addCalendar({
                name,
                description,
                color,
                visible: true
            });

            if (icsFile && result.success && result.data) {
                const newCalId = result.data.id;
                const text = await icsFile.text();
                const parsedEvents = parseICS(text);

                for (const evt of parsedEvents) {
                    await addEvent({
                        title: evt.title,
                        start: evt.start,
                        end: evt.end,
                        description: evt.description,
                        calendarId: newCalId,
                        color,
                        allDay: evt.allDay,
                    });
                }
                showToast(`${parsedEvents.length} evento${parsedEvents.length !== 1 ? 's' : ''} importado${parsedEvents.length !== 1 ? 's' : ''}`, 'success');
            }
        }

        setIcsFile(null);
        setIcsEventCount(0);
        setActiveView('calendars');
    };

    const handleDelete = () => {
        if (selectedCalendar && isAdmin) {
            deleteCalendar(selectedCalendar.id);
            setActiveView('calendars');
        }
    };

    const renderContent = () => {
        switch (activeView) {
            case 'general':
                return (
                    <div className={styles.body}>
                        <h3>Geral</h3>
                        <p>Configurações gerais do calendário (idioma, fuso horário) seriam exibidas aqui.</p>
                        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
                            Atualmente, o idioma está definido como <strong>Português (Brasil)</strong> e o tema segue sua preferência (Claro/Escuro).
                        </p>
                    </div>
                );
            case 'calendars':
                return (
                    <div className={styles.body}>
                        {isAdmin ? (
                            <button className={styles.addBtn} onClick={handleAddClick}>
                                <Plus size={16} />
                                Adicionar sala / agenda
                            </button>
                        ) : (
                            <div className={styles.readOnlyNotice}>
                                <Lock size={16} />
                                <span>Somente administradores podem criar ou editar salas</span>
                            </div>
                        )}
                        <div className={styles.calendarList}>
                            {calendars.map(calendar => (
                                <div
                                    key={calendar.id}
                                    className={`${styles.calendarItem} ${!isAdmin ? styles.calendarItemReadOnly : ''}`}
                                    onClick={() => handleCalendarClick(calendar)}
                                >
                                    <div className={styles.calendarInfo}>
                                        <div className={styles.colorDot} style={{ backgroundColor: calendar.color }} />
                                        <span className={styles.calendarName}>{calendar.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'calendar-details':
                return (
                    <div className={styles.body}>
                        <div className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>Nome da Sala / Agenda</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Ex: Sala 101 - Bloco A"
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Descrição</label>
                                <textarea
                                    className={styles.textarea}
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Capacidade, equipamentos disponíveis..."
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Cor</label>
                                <div className={styles.colorPalette}>
                                    {PRESET_COLORS.map(c => {
                                        const usedBy = calendars.find(
                                            cal => cal.color === c && cal.id !== selectedCalendar?.id
                                        );
                                        const isSelected = color === c;
                                        const isDisabled = !!usedBy;
                                        return (
                                            <button
                                                key={c}
                                                className={`${styles.paletteColor} ${isSelected ? styles.paletteColorSelected : ''} ${isDisabled ? styles.paletteColorDisabled : ''}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => !isDisabled && setColor(c)}
                                                title={isDisabled ? `Já utilizada por ${usedBy.name}` : c}
                                                type="button"
                                            >
                                                {isSelected && <Check size={14} weight="bold" color="#fff" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {!selectedCalendar && (
                                <div className={styles.formGroup}>
                                    <label>Importar eventos (.ics)</label>
                                    <div className={styles.icsUpload}>
                                        <label className={styles.icsUploadBtn}>
                                            <UploadSimple size={16} />
                                            {icsFile ? icsFile.name : 'Selecionar arquivo .ics'}
                                            <input
                                                type="file"
                                                accept=".ics"
                                                onChange={handleIcsFileChange}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                        {icsEventCount > 0 && (
                                            <span className={styles.icsCount}>
                                                {icsEventCount} evento{icsEventCount !== 1 ? 's' : ''} encontrado{icsEventCount !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className={styles.buttonGroup}>
                                <button className={styles.saveBtn} onClick={handleSave}>Salvar</button>
                                <button className={styles.cancelBtn} onClick={() => setActiveView('calendars')}>Cancelar</button>
                                {selectedCalendar && (
                                    <button className={styles.deleteBtn} onClick={handleDelete}>Excluir</button>
                                )}
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.sidebar}>
                    <div className={styles.sidebarTitle}>Configurações</div>

                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionTitle}>Geral</div>
                        <button
                            className={`${styles.navItem} ${activeView === 'general' ? styles.active : ''}`}
                            onClick={() => setActiveView('general')}
                        >
                            Geral
                        </button>
                    </div>

                    <div className={styles.sidebarSection}>
                        <div className={styles.sectionTitle}>Salas / Agendas</div>
                        <button
                            className={`${styles.navItem} ${activeView === 'calendars' || activeView === 'calendar-details' ? styles.active : ''}`}
                            onClick={() => setActiveView('calendars')}
                        >
                            Configurações das salas
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={styles.header}>
                        <div className={styles.headerTitle}>
                            {activeView === 'calendar-details' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        onClick={() => setActiveView('calendars')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    {selectedCalendar ? 'Detalhes da sala' : 'Nova sala'}
                                </div>
                            ) : (
                                activeView === 'general' ? 'Configurações' : 'Configurações'
                            )}
                        </div>
                        <button onClick={onClose} className={styles.closeBtn}>
                            <X size={20} />
                        </button>
                    </div>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
