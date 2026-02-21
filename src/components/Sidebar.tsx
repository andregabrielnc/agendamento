import { useState, useRef, useEffect } from 'react'
import { Plus, CaretDown, Check, DotsThreeVertical } from '@phosphor-icons/react'
import styles from './Sidebar.module.css'
import { useCalendar } from '../context/CalendarContext'
import { MiniCalendar } from './MiniCalendar'
import { SettingsModal } from './SettingsModal'

const PRESET_COLORS = [
    '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679', '#0b8043',
    '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161', '#a79b8e',
    '#ad1457', '#d81b60', '#e91e63', '#f09300', '#009688', '#00897b',
    '#4285f4', '#5e6ec7', '#b39ddb', '#9e69af', '#795548', '#bcaaa4',
];

export function Sidebar() {
    const { calendars, toggleCalendar, updateCalendar, openCreateModal } = useCalendar();
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
    const [settingsCalendarId, setSettingsCalendarId] = useState<string | undefined>(undefined);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenFor(null);
            }
        };
        if (menuOpenFor) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [menuOpenFor]);

    const handleShowOnly = (calendarId: string) => {
        calendars.forEach(c => {
            if (c.id === calendarId && !c.visible) {
                toggleCalendar(c.id);
            } else if (c.id !== calendarId && c.visible) {
                toggleCalendar(c.id);
            }
        });
        setMenuOpenFor(null);
    };

    const handleHide = (calendarId: string) => {
        const calendar = calendars.find(c => c.id === calendarId);
        if (calendar && calendar.visible) {
            toggleCalendar(calendarId);
        }
        setMenuOpenFor(null);
    };

    const handleOpenSettings = (calendarId: string) => {
        setMenuOpenFor(null);
        setSettingsCalendarId(calendarId);
        setIsSettingsOpen(true);
    };

    const handleColorChange = (calendarId: string, newColor: string) => {
        const calendar = calendars.find(c => c.id === calendarId);
        if (calendar) {
            updateCalendar({ ...calendar, color: newColor });
        }
        setMenuOpenFor(null);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.createWrapper}>
                <button className={styles.createBtn} onClick={() => openCreateModal()}>
                    <Plus size={24} className={styles.plusIcon} />
                    <span>Criar</span>
                </button>
            </div>

            <div className={styles.miniCalendarWrapper}>
                <MiniCalendar />
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHeader}>
                    <span>Minhas Agendas</span>
                    <CaretDown size={14} />
                </div>
                <div className={styles.calendarList}>
                    {calendars.map(calendar => (
                        <div
                            key={calendar.id}
                            className={styles.calendarItem}
                            style={{ '--cal-color': calendar.color } as React.CSSProperties}
                        >
                            <div
                                className={styles.checkboxWrapper}
                                onClick={() => toggleCalendar(calendar.id)}
                            >
                                <span
                                    className={`${styles.checkbox} ${calendar.visible ? styles.checkboxChecked : ''}`}
                                    style={{
                                        backgroundColor: calendar.visible ? calendar.color : 'transparent',
                                        borderColor: calendar.color,
                                    }}
                                >
                                    {calendar.visible && <Check size={12} weight="bold" color="#fff" />}
                                </span>
                                <span className={styles.calendarName}>{calendar.name}</span>
                            </div>
                            <button
                                className={styles.menuBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenFor(menuOpenFor === calendar.id ? null : calendar.id);
                                }}
                            >
                                <DotsThreeVertical size={16} weight="bold" />
                            </button>

                            {menuOpenFor === calendar.id && (
                                <div className={styles.contextMenu} ref={menuRef} onClick={e => e.stopPropagation()}>
                                    <button
                                        className={styles.contextMenuItem}
                                        onClick={() => handleShowOnly(calendar.id)}
                                    >
                                        Exibir apenas esta
                                    </button>
                                    <button
                                        className={styles.contextMenuItem}
                                        onClick={() => handleHide(calendar.id)}
                                    >
                                        Ocultar na lista
                                    </button>
                                    <button
                                        className={styles.contextMenuItem}
                                        onClick={() => handleOpenSettings(calendar.id)}
                                    >
                                        Configurações
                                    </button>
                                    <div className={styles.contextMenuSeparator} />
                                    <div className={styles.colorGrid}>
                                        {PRESET_COLORS.map(c => (
                                            <button
                                                key={c}
                                                className={`${styles.colorCircle} ${calendar.color === c ? styles.colorCircleActive : ''}`}
                                                style={{ backgroundColor: c }}
                                                onClick={() => handleColorChange(calendar.id, c)}
                                                title={c}
                                            >
                                                {calendar.color === c && <Check size={10} weight="bold" color="#fff" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => { setIsSettingsOpen(false); setSettingsCalendarId(undefined); }}
                initialCalendarId={settingsCalendarId}
            />
        </aside>
    )
}
