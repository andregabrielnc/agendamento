import { useMemo, useCallback } from 'react';
import { useCalendar } from '../../context/CalendarContext';
import {
    startOfYear,
    addMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    format,
    getYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import styles from './YearView.module.css';

interface MiniCalendarProps {
    month: Date;
    today: Date;
    onDayClick: (date: Date) => void;
}

function MiniCalendar({ month, today, onDayClick }: MiniCalendarProps) {
    const days = useMemo(() => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: calStart, end: calEnd });
    }, [month]);

    const weekDayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div className={styles.miniCalendar}>
            <div className={styles.miniMonthName}>
                {format(month, 'MMMM', { locale: ptBR })}
            </div>
            <div className={styles.miniGrid}>
                {weekDayLabels.map((label, index) => (
                    <div key={`header-${index}`} className={styles.miniWeekDayHeader}>
                        {label}
                    </div>
                ))}
                {days.map((day, index) => {
                    const inMonth = isSameMonth(day, month);
                    const isCurrentDay = isSameDay(day, today);

                    return (
                        <div
                            key={index}
                            className={`
                                ${styles.miniDay}
                                ${!inMonth ? styles.miniDayOutside : ''}
                                ${isCurrentDay ? styles.miniDayToday : ''}
                            `}
                            onClick={() => onDayClick(day)}
                        >
                            {inMonth ? format(day, 'd') : ''}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function YearView() {
    const { currentDate, selectDate, setView } = useCalendar();
    const today = useMemo(() => new Date(), []);

    const months = useMemo(() => {
        const yearStart = startOfYear(currentDate);
        return Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
    }, [currentDate]);

    const handleDayClick = useCallback((date: Date) => {
        selectDate(date);
        setView('day');
    }, [selectDate, setView]);

    return (
        <div className={styles.container}>
            <div className={styles.yearTitle}>
                {getYear(currentDate)}
            </div>
            <div className={styles.yearGrid}>
                {months.map(month => (
                    <MiniCalendar
                        key={month.toISOString()}
                        month={month}
                        today={today}
                        onDayClick={handleDayClick}
                    />
                ))}
            </div>
        </div>
    );
}
