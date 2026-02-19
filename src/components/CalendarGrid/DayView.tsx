import { useRef, useEffect, useState, useMemo } from 'react';
import { useCalendar } from '../../context/CalendarContext';
import { isToday } from '../../utils/dateUtils';
import { format, isSameDay, addMinutes, startOfDay, endOfDay, roundToNearestMinutes, differenceInMinutes } from 'date-fns';
import styles from './DayView.module.css';
import { ptBR } from 'date-fns/locale';
import { getRecurrenceInstances } from '../../utils/recurrenceUtils';

export function DayView() {
    const { currentDate, filteredEvents: events, openPopover, openCreateModal, updateEvent } = useCalendar();
    const day = currentDate;
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const scrollRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    // Recurrence Expansion
    const displayEvents = useMemo(() => {
        const start = startOfDay(day);
        const end = endOfDay(day);
        return events.flatMap(event => getRecurrenceInstances(event, start, end));
    }, [events, day]);

    // Drag to Create State
    const [isDraggingCreate, setIsDraggingCreate] = useState(false);
    const [draftEvent, setDraftEvent] = useState<{ start: Date; end: Date; date: Date } | null>(null);

    // Resize State
    const [resizeEventId, setResizeEventId] = useState<string | null>(null);
    const [draftEndTime, setDraftEndTime] = useState<Date | null>(null);

    // Drag to Move State
    const [dragEventId, setDragEventId] = useState<string | null>(null);

    // Scroll to current time on mount
    useEffect(() => {
        if (scrollRef.current) {
            const currentHour = new Date().getHours();
            scrollRef.current.scrollTop = (currentHour - 1) * 60;
        }
    }, []);

    // Helpers
    const getYFromTime = (date: Date) => {
        return (date.getHours() * 60) + date.getMinutes();
    };

    const getTimeFromY = (y: number, targetDate: Date) => {
        const minutes = Math.floor(y); // 1px = 1min
        return addMinutes(startOfDay(targetDate), minutes);
    };

    // Global Mouse Handling for robust dragging
    useEffect(() => {
        const handleWindowMouseMove = (e: MouseEvent) => {
            if (!gridRef.current) return;

            if (isDraggingCreate || resizeEventId) {
                const gridRect = gridRef.current.getBoundingClientRect();
                const y = e.clientY - gridRect.top;

                let targetDate = new Date();
                if (isDraggingCreate && draftEvent) targetDate = draftEvent.date;
                else if (resizeEventId) {
                    const originalId = resizeEventId.split('_')[0];
                    const ev = events.find(evt => evt.id === originalId);
                    if (ev) targetDate = ev.start;
                }

                if (!targetDate) return;

                const time = getTimeFromY(y, targetDate);
                const snappedTime = roundToNearestMinutes(time, { nearestTo: 15 });

                if (resizeEventId) {
                    const originalId = resizeEventId.split('_')[0];
                    const instance = events.find(evt => evt.id === originalId);

                    if (instance && snappedTime > instance.start) {
                        setDraftEndTime(snappedTime);
                    }
                } else if (isDraggingCreate && draftEvent) {
                    if (snappedTime > draftEvent.start) {
                        setDraftEvent(prev => prev ? { ...prev, end: snappedTime } : null);
                    }
                }
            }
        };

        const handleWindowMouseUp = () => {
            if (isDraggingCreate && draftEvent) {
                openCreateModal(draftEvent.start);
            }

            if (resizeEventId && draftEndTime) {
                const originalId = resizeEventId.split('_')[0];
                const original = events.find(evt => evt.id === originalId);
                if (original && draftEndTime > original.start) {
                    updateEvent({ ...original, end: draftEndTime });
                }
            }

            if (isDraggingCreate || resizeEventId || dragEventId) {
                setIsDraggingCreate(false);
                setDraftEvent(null);
                setResizeEventId(null);
                setDraftEndTime(null);
                setDragEventId(null);
            }
        };

        if (isDraggingCreate || resizeEventId || dragEventId) {
            window.addEventListener('mousemove', handleWindowMouseMove);
            window.addEventListener('mouseup', handleWindowMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleWindowMouseMove);
            window.removeEventListener('mouseup', handleWindowMouseUp);
        };
    }, [isDraggingCreate, draftEvent, resizeEventId, draftEndTime, dragEventId, events, openCreateModal, updateEvent]);

    // --- Handlers ---

    const handleGridMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest(`.${styles.eventCard}`)) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;

        const time = getTimeFromY(y, day);
        const snappedTime = roundToNearestMinutes(time, { nearestTo: 15 });

        setIsDraggingCreate(true);
        setDraftEvent({
            start: snappedTime,
            end: addMinutes(snappedTime, 60),
            date: day,
        });
    };

    const handleColumnMouseMove = (e: React.MouseEvent) => {
        if (resizeEventId) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top;
            const time = getTimeFromY(y, day);
            const snappedTime = roundToNearestMinutes(time, { nearestTo: 15 });

            const instance = displayEvents.find(evt => evt.id === resizeEventId);
            if (instance && snappedTime > instance.start) {
                setDraftEndTime(snappedTime);
            }
            return;
        }

        if (isDraggingCreate && draftEvent && isSameDay(day, draftEvent.date)) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top;

            const time = getTimeFromY(y, day);
            const snappedTime = roundToNearestMinutes(time, { nearestTo: 15 });

            if (snappedTime > draftEvent.start) {
                setDraftEvent(prev => prev ? { ...prev, end: snappedTime } : null);
            }
        }
    };

    const handleDragStart = (e: React.DragEvent, eventId: string) => {
        setDragEventId(eventId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', eventId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const instanceId = e.dataTransfer.getData('text/plain');
        const originalId = instanceId.split('_')[0];
        const originalEvent = events.find(ev => ev.id === originalId);

        if (originalEvent) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const y = e.clientY - rect.top;

            const time = getTimeFromY(y, day);
            const newStart = roundToNearestMinutes(time, { nearestTo: 15 });

            const duration = differenceInMinutes(originalEvent.end, originalEvent.start);

            const cleanNewStart = new Date(day);
            cleanNewStart.setHours(newStart.getHours());
            cleanNewStart.setMinutes(newStart.getMinutes());

            const cleanNewEnd = addMinutes(cleanNewStart, duration);

            updateEvent({ ...originalEvent, start: cleanNewStart, end: cleanNewEnd });
        }
        setDragEventId(null);
    };

    // Current Time Indicator
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const nowY = getYFromTime(now);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.headerRow}>
                <div className={styles.timeGutterHeader}></div>
                <div className={`${styles.headerCell} ${isToday(day) ? styles.todayHeader : ''}`}>
                    <div className={styles.dayName}>
                        {format(day, 'EEE', { locale: ptBR }).toUpperCase()}
                    </div>
                    <div className={`${styles.dayNumber} ${isToday(day) ? styles.todayNumber : ''}`}>
                        {format(day, 'd')}
                    </div>
                </div>
            </div>

            {/* Time Grid */}
            <div className={styles.scrollArea} ref={scrollRef}>
                <div className={styles.grid} ref={gridRef}>
                    {/* Time Gutter */}
                    <div className={styles.timeGutter}>
                        {hours.map(hour => (
                            <div key={hour} className={styles.timeLabel}>
                                {hour === 0 ? '' : `${hour}:00`}
                            </div>
                        ))}
                    </div>

                    {/* Single Day Column */}
                    <div
                        className={styles.dayColumn}
                        onMouseDown={handleGridMouseDown}
                        onMouseMove={handleColumnMouseMove}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {hours.map(hour => (
                            <div key={hour} className={styles.hourCell}></div>
                        ))}

                        {/* Current Time Indicator */}
                        {isSameDay(now, day) && (
                            <div className={styles.nowIndicator} style={{ top: `${nowY}px` }}>
                                <div className={styles.nowDot} />
                                <div className={styles.nowLine} />
                            </div>
                        )}

                        {/* Events Layer */}
                        {displayEvents
                            .filter(evt => isSameDay(evt.start, day))
                            .map(event => {
                                const startY = getYFromTime(event.start);
                                const endY = resizeEventId === event.id && draftEndTime
                                    ? getYFromTime(draftEndTime)
                                    : getYFromTime(event.end);

                                const height = Math.max(20, endY - startY);

                                return (
                                    <div
                                        key={event.id}
                                        className={styles.eventCard}
                                        style={{
                                            top: `${startY}px`,
                                            height: `${height}px`,
                                            backgroundColor: event.color,
                                            zIndex: resizeEventId === event.id ? 10 : 1,
                                            opacity: dragEventId === event.id ? 0.5 : 1,
                                        }}
                                        draggable={!resizeEventId}
                                        onDragStart={(e) => {
                                            if (resizeEventId) { e.preventDefault(); return; }
                                            handleDragStart(e, event.id);
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (resizeEventId || dragEventId) return;
                                            openPopover(event, e.currentTarget);
                                        }}
                                    >
                                        <div className={styles.eventTitle}>{event.title}</div>
                                        <div className={styles.eventTime}>
                                            {format(event.start, 'H:mm')} - {format(resizeEventId === event.id && draftEndTime ? draftEndTime : event.end, 'H:mm')}
                                        </div>

                                        {/* Resize Handle */}
                                        <div
                                            className={styles.resizeHandle}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                setResizeEventId(event.id);
                                                setDraftEndTime(event.end);
                                            }}
                                        />
                                    </div>
                                );
                            })
                        }

                        {/* Draft Event (Creation) */}
                        {isDraggingCreate && draftEvent && isSameDay(day, draftEvent.date) && (
                            <div
                                className={`${styles.eventCard} ${styles.draftEvent}`}
                                style={{
                                    top: `${getYFromTime(draftEvent.start)}px`,
                                    height: `${getYFromTime(draftEvent.end) - getYFromTime(draftEvent.start)}px`,
                                }}
                            >
                                <div className={styles.eventTitle}>(Sem titulo)</div>
                                <div className={styles.eventTime}>
                                    {format(draftEvent.start, 'H:mm')} - {format(draftEvent.end, 'H:mm')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
