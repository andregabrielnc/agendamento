import { useMemo } from 'react';
import { useCalendar } from '../../context/CalendarContext';
import { useAuth } from '../../context/AuthContext';
import { getMonthViewDays, isToday } from '../../utils/dateUtils';
import { format, isSameMonth, isSameDay, startOfDay, endOfDay } from 'date-fns';
import styles from './MonthView.module.css';
import { getRecurrenceInstances } from '../../utils/recurrenceUtils';

export function MonthView() {
    const { currentDate, filteredEvents: events, openPopover, updateEvent, openCreateModal } = useCalendar();
    const { canEditEvent } = useAuth();
    const days = getMonthViewDays(currentDate);

    // Generate expanded events for the visible range
    const displayEvents = useMemo(() => {
        if (days.length === 0) return [];
        const start = startOfDay(days[0]);
        const end = endOfDay(days[days.length - 1]);

        return events.flatMap(event => getRecurrenceInstances(event, start, end));
    }, [events, days]);

    const handleDragStart = (e: React.DragEvent, eventId: string, event: { createdBy?: string; start: Date }) => {
        if (!canEditEvent(event.createdBy, event.start)) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', eventId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        const eventId = e.dataTransfer.getData('text/plain');
        const originalId = eventId.split('_')[0];
        const event = events.find(ev => ev.id === originalId);

        if (event) {
            const newStart = new Date(date);
            newStart.setHours(event.start.getHours());
            newStart.setMinutes(event.start.getMinutes());

            const duration = event.end.getTime() - event.start.getTime();
            const newEnd = new Date(newStart.getTime() + duration);

            updateEvent({ ...event, start: newStart, end: newEnd });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    return (
        <div className={styles.container}>
            <div className={styles.grid}>
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
                    <div key={day} className={styles.dayHeader}>{day}</div>
                ))}
                {days.map(day => (
                    <div
                        key={day.toISOString()}
                        className={`
                ${styles.dayCell} 
                ${!isSameMonth(day, currentDate) ? styles.dimmed : ''}
            `}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day)}
                        onClick={() => openCreateModal(day)}
                    >
                        <div className={`${styles.dayNumber} ${isToday(day) ? styles.today : ''}`}>
                            {format(day, 'd')}
                        </div>
                        <div className={styles.eventsStack}>
                            {displayEvents
                                .filter(e => isSameDay(e.start, day))
                                .sort((a, b) => a.start.getTime() - b.start.getTime())
                                .map(event => (
                                    <div
                                        key={event.id}
                                        className={styles.eventCard}
                                        style={{ backgroundColor: event.color }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const originalId = event.id.split('_')[0];
                                            const originalEvent = events.find(ev => ev.id === originalId);
                                            if (originalEvent) {
                                                openPopover(event, e.currentTarget);
                                            }
                                        }}
                                        draggable={canEditEvent(event.createdBy, event.start)}
                                        onDragStart={(e) => handleDragStart(e, event.id, event)}
                                    >
                                        <span className={styles.eventTime}>{format(event.start, 'HH:mm')}</span>
                                        <span className={styles.eventTitle}>{event.title}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
