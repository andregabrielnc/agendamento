import { useState, useEffect } from 'react';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendar } from '../context/CalendarContext';
import styles from './MiniCalendar.module.css';

export function MiniCalendar() {
    const { currentDate, selectDate, selectedDate } = useCalendar();
    const [viewDate, setViewDate] = useState(currentDate);
    const [isManualNav, setIsManualNav] = useState(false);

    // Sync with main calendar only when not manually navigating
    useEffect(() => {
        if (!isManualNav) {
            setViewDate(currentDate);
        }
        setIsManualNav(false);
    }, [currentDate]);

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    const prevMonth = () => { setIsManualNav(true); setViewDate(subMonths(viewDate, 1)); };
    const nextMonth = () => { setIsManualNav(true); setViewDate(addMonths(viewDate, 1)); };

    const handleDateClick = (day: Date) => {
        selectDate(day);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.monthLabel}>
                    {format(viewDate, 'MMMM yyyy', { locale: ptBR })}
                </span>
                <div className={styles.nav}>
                    <button onClick={prevMonth} className={styles.navBtn}>
                        <CaretLeft size={16} />
                    </button>
                    <button onClick={nextMonth} className={styles.navBtn}>
                        <CaretRight size={16} />
                    </button>
                </div>
            </div>

            <div className={styles.grid}>
                {weekDays.map((day, i) => (
                    <div key={`${day}-${i}`} className={styles.dayHeader}>{day}</div>
                ))}
                {days.map(day => (
                    <div
                        key={day.toISOString()}
                        className={`
                    ${styles.dayCell} 
                    ${!isSameMonth(day, viewDate) ? styles.dimmed : ''}
                    ${isToday(day) ? styles.today : ''}
                    ${selectedDate && isSameDay(day, selectedDate) ? styles.selected : ''}
                    ${isSameDay(day, currentDate) && !isToday(day) && !selectedDate ? styles.current : ''}
                `}
                        onClick={() => handleDateClick(day)}
                    >
                        <span className={styles.dayNumber}>{format(day, 'd')}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
