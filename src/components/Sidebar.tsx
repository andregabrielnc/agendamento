import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, CaretDown, Check, DotsThreeVertical } from '@phosphor-icons/react'
import styles from './Sidebar.module.css'
import { useCalendar } from '../context/CalendarContext'
import { useAuth } from '../context/AuthContext'
import { MiniCalendar } from './MiniCalendar'
import { SettingsModal } from './SettingsModal'

const PRESET_COLORS = [
    '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679', '#0b8043',
    '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161', '#a79b8e',
    '#ad1457', '#d81b60', '#e91e63', '#f09300', '#009688', '#00897b',
    '#4285f4', '#5e6ec7', '#b39ddb', '#9e69af', '#795548', '#bcaaa4',
];

interface MenuPosition {
    top: number;
    left: number;
}

export function Sidebar() {
    const { calendars, toggleCalendar, updateCalendar, openCreateModal } = useCalendar();
    const { isAdmin } = useAuth();
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<MenuPosition>({ top: 0, left: 0 });
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

    // Adjust menu position if it overflows the viewport
    useEffect(() => {
        if (menuOpenFor && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const viewportH = window.innerHeight;
            const viewportW = window.innerWidth;
            let { top, left } = menuPos;

            if (rect.bottom > viewportH - 8) {
                top = Math.max(8, viewportH - rect.height - 8);
            }
            if (rect.right > viewportW - 8) {
                left = Math.max(8, viewportW - rect.width - 8);
            }
            if (top !== menuPos.top || left !== menuPos.left) {
                setMenuPos({ top, left });
            }
        }
    }, [menuOpenFor, menuPos]);

    const openMenu = useCallback((calendarId: string, btnEl: HTMLButtonElement) => {
        if (menuOpenFor === calendarId) {
            setMenuOpenFor(null);
            return;
        }
        const rect = btnEl.getBoundingClientRect();
        setMenuPos({ top: rect.bottom + 4, left: rect.left });
        setMenuOpenFor(calendarId);
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

    const activeCalendar = menuOpenFor ? calendars.find(c => c.id === menuOpenFor) : null;

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
                            {isAdmin && (
                                <button
                                    className={styles.menuBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openMenu(calendar.id, e.currentTarget);
                                    }}
                                >
                                    <DotsThreeVertical size={16} weight="bold" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Fixed-position context menu rendered as portal-like overlay */}
            {menuOpenFor && activeCalendar && (
                <div
                    className={styles.contextMenuOverlay}
                    onMouseDown={() => setMenuOpenFor(null)}
                >
                    <div
                        className={styles.contextMenu}
                        ref={menuRef}
                        style={{ top: menuPos.top, left: menuPos.left }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => handleShowOnly(activeCalendar.id)}
                        >
                            Exibir apenas esta
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => handleHide(activeCalendar.id)}
                        >
                            Ocultar na lista
                        </button>
                        <button
                            className={styles.contextMenuItem}
                            onClick={() => handleOpenSettings(activeCalendar.id)}
                        >
                            Configurações
                        </button>
                        <div className={styles.contextMenuSeparator} />
                        <div className={styles.colorGrid}>
                            {PRESET_COLORS.map(c => (
                                <button
                                    key={c}
                                    className={`${styles.colorCircle} ${activeCalendar.color === c ? styles.colorCircleActive : ''}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => handleColorChange(activeCalendar.id, c)}
                                    title={c}
                                >
                                    {activeCalendar.color === c && <Check size={10} weight="bold" color="#fff" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => { setIsSettingsOpen(false); setSettingsCalendarId(undefined); }}
                initialCalendarId={settingsCalendarId}
            />
        </aside>
    )
}
