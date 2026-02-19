import { useMemo } from 'react';
import { useCalendar } from '../../context/CalendarContext';
import {
    format,
    startOfDay,
    endOfDay,
    addDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getRecurrenceInstances } from '../../utils/recurrenceUtils';
import { isToday } from '../../utils/dateUtils';
import styles from './AgendaView.module.css';
import type { CalendarEvent } from '../../types';

interface DayGroup {
    date: Date;
    events: CalendarEvent[];
}

export function AgendaView() {
    const { currentDate, filteredEvents: events, openPopover } = useCalendar();

    const rangeStart = startOfDay(currentDate);
    const rangeEnd = endOfDay(addDays(currentDate, 29));

    // Expand recurrence instances over the 30-day range
    const displayEvents = useMemo(() => {
        return events
            .flatMap(event => getRecurrenceInstances(event, rangeStart, rangeEnd))
            .sort((a, b) => a.start.getTime() - b.start.getTime());
    }, [events, rangeStart, rangeEnd]);

    // Group events by date
    const dayGroups = useMemo(() => {
        const groups: DayGroup[] = [];
        const groupMap = new Map<string, CalendarEvent[]>();

        for (const event of displayEvents) {
            const key = format(event.start, 'yyyy-MM-dd');
            const existing = groupMap.get(key);
            if (existing) {
                existing.push(event);
            } else {
                groupMap.set(key, [event]);
            }
        }

        // Build ordered groups
        for (let i = 0; i < 30; i++) {
            const date = addDays(currentDate, i);
            const key = format(date, 'yyyy-MM-dd');
            const dayEvents = groupMap.get(key);
            if (dayEvents && dayEvents.length > 0) {
                groups.push({ date, events: dayEvents });
            }
        }

        return groups;
    }, [displayEvents, currentDate]);

    const handleEventClick = (event: CalendarEvent, element: HTMLElement) => {
        openPopover(event, element);
    };

    if (dayGroups.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    Nenhum evento nos proximos 30 dias
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.agendaList}>
                {dayGroups.map(group => (
                    <div key={format(group.date, 'yyyy-MM-dd')} className={styles.dayGroup}>
                        <div className={`${styles.dateHeader} ${isToday(group.date) ? styles.dateHeaderToday : ''}`}>
                            <div className={styles.dateHeaderDay}>
                                {format(group.date, 'EEEE', { locale: ptBR })}
                            </div>
                            <div className={styles.dateHeaderFull}>
                                {format(group.date, "d 'de' MMMM", { locale: ptBR })}
                            </div>
                        </div>
                        <div className={styles.eventsList}>
                            {group.events.map(event => (
                                <div
                                    key={event.id}
                                    className={styles.eventRow}
                                    onClick={(e) => handleEventClick(event, e.currentTarget)}
                                >
                                    <div
                                        className={styles.eventDot}
                                        style={{ backgroundColor: event.color || 'var(--primary)' }}
                                    />
                                    <div className={styles.eventTimeRange}>
                                        {event.allDay
                                            ? 'Dia inteiro'
                                            : `${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`
                                        }
                                    </div>
                                    <div className={styles.eventDetails}>
                                        <div className={styles.eventTitle}>{event.title}</div>
                                        {event.location && (
                                            <div className={styles.eventLocation}>{event.location}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
