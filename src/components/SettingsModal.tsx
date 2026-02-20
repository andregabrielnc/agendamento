import { useState } from 'react';
import { X, ArrowLeft, Plus, Lock } from '@phosphor-icons/react';
import { useCalendar } from '../context/CalendarContext';
import { useAuth } from '../context/AuthContext';
import styles from './SettingsModal.module.css';
import type { Calendar } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type View = 'general' | 'calendars' | 'calendar-details';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { calendars, addCalendar, updateCalendar, deleteCalendar } = useCalendar();
    const { isAdmin } = useAuth();
    const [activeView, setActiveView] = useState<View>('general');
    const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('#818cf8');

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
        setActiveView('calendar-details');
    };

    const handleSave = () => {
        if (!name.trim() || !isAdmin) return;

        if (selectedCalendar) {
            updateCalendar({
                ...selectedCalendar,
                name,
                description,
                color
            });
        } else {
            addCalendar({
                name,
                description,
                color,
                visible: true
            });
        }
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
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    style={{ width: 60, height: 40, padding: 0, border: 'none' }}
                                />
                            </div>
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
