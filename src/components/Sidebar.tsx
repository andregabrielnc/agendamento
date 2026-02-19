import { Plus, CaretDown } from '@phosphor-icons/react'
import styles from './Sidebar.module.css'
import { useCalendar } from '../context/CalendarContext'
import { MiniCalendar } from './MiniCalendar'

export function Sidebar() {
    const { calendars, toggleCalendar, openCreateModal } = useCalendar();

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
                        <div key={calendar.id} className={styles.calendarItem}>
                            <label className={styles.checkboxWrapper}>
                                <input
                                    type="checkbox"
                                    checked={calendar.visible}
                                    onChange={() => toggleCalendar(calendar.id)}
                                    style={{ accentColor: calendar.color }}
                                />
                                <span className={styles.calendarName}>{calendar.name}</span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    )
}
