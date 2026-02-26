import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CalendarEvent, Calendar, RecurrenceEditMode } from '../types';
import { calendarService } from '../services/calendarService';
import { useAuth } from './AuthContext';

interface EventOperationResult {
    success: boolean;
    error?: string;
    data?: any;
}

interface EventContextType {
    events: CalendarEvent[];
    calendars: Calendar[];
    addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<EventOperationResult>;
    updateEvent: (event: CalendarEvent, mode?: RecurrenceEditMode, instanceDate?: string) => Promise<EventOperationResult>;
    deleteEvent: (id: string, mode?: RecurrenceEditMode, instanceDate?: string) => Promise<EventOperationResult>;
    addCalendar: (calendar: Omit<Calendar, 'id'>) => Promise<EventOperationResult>;
    updateCalendar: (calendar: Calendar) => Promise<EventOperationResult>;
    deleteCalendar: (id: string) => Promise<EventOperationResult>;
    toggleCalendar: (id: string) => Promise<EventOperationResult>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredEvents: CalendarEvent[];
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const { isAdmin } = useAuth();

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedEvents, loadedCalendars] = await Promise.all([
                    calendarService.fetchEvents(),
                    calendarService.fetchCalendars(),
                ]);
                setEvents(loadedEvents);

                // Non-admin: enforce single calendar visibility (default to "10º andar")
                if (!isAdmin) {
                    const target = loadedCalendars.find(c => c.name.includes('10'));
                    const defaultId = target?.id ?? loadedCalendars[0]?.id;
                    setCalendars(loadedCalendars.map(c => ({
                        ...c,
                        visible: c.id === defaultId,
                    })));
                } else {
                    setCalendars(loadedCalendars);
                }
            } catch (error) {
                console.error('Failed to load calendar data:', error);
            }
        };
        loadData();
    }, [isAdmin]);

    const visibleCalendarIds = useMemo(() => {
        return new Set(calendars.filter(c => c.visible).map(c => c.id));
    }, [calendars]);

    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (!visibleCalendarIds.has(event.calendarId)) return false;
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
                event.title.toLowerCase().includes(q) ||
                (!!event.description && event.description.toLowerCase().includes(q))
            );
        });
    }, [events, visibleCalendarIds, searchQuery]);

    const addEvent = useCallback(async (eventData: Omit<CalendarEvent, 'id'>): Promise<EventOperationResult> => {
        try {
            const newEvent = await calendarService.createEvent(eventData);
            setEvents(prev => [...prev, newEvent]);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create event';
            console.error('Failed to create event:', error);
            return { success: false, error: message };
        }
    }, []);

    const reloadEvents = useCallback(async () => {
        try {
            const loadedEvents = await calendarService.fetchEvents();
            setEvents(loadedEvents);
        } catch (error) {
            console.error('Failed to reload events:', error);
        }
    }, []);

    const updateEvent = useCallback(async (updatedEvent: CalendarEvent, mode?: RecurrenceEditMode, instanceDate?: string): Promise<EventOperationResult> => {
        const originalId = updatedEvent.id.split('_')[0];
        const eventToUpdate = { ...updatedEvent, id: originalId };

        if (mode && mode !== 'all') {
            try {
                await calendarService.updateEvent(eventToUpdate, mode, instanceDate);
                await reloadEvents();
                return { success: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to update event';
                console.error('Failed to update event:', error);
                return { success: false, error: message };
            }
        }

        const previousEvents = events;
        setEvents(prev => prev.map(e => (e.id === originalId ? eventToUpdate : e)));

        try {
            await calendarService.updateEvent(eventToUpdate, mode, instanceDate);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update event';
            console.error('Failed to update event:', error);
            setEvents(previousEvents);
            return { success: false, error: message };
        }
    }, [events, reloadEvents]);

    const deleteEvent = useCallback(async (id: string, mode?: RecurrenceEditMode, instanceDate?: string): Promise<EventOperationResult> => {
        const originalId = id.split('_')[0];

        if (mode && mode !== 'all') {
            try {
                await calendarService.deleteEvent(originalId, mode, instanceDate);
                await reloadEvents();
                return { success: true };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete event';
                console.error('Failed to delete event:', error);
                return { success: false, error: message };
            }
        }

        const previousEvents = events;
        setEvents(prev => prev.filter(e => e.id !== originalId));

        try {
            await calendarService.deleteEvent(originalId, mode, instanceDate);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete event';
            console.error('Failed to delete event:', error);
            setEvents(previousEvents);
            return { success: false, error: message };
        }
    }, [events, reloadEvents]);

    const toggleCalendar = useCallback(async (id: string): Promise<EventOperationResult> => {
        const calendar = calendars.find(c => c.id === id);
        if (!calendar) {
            return { success: false, error: `Calendar with id ${id} not found` };
        }

        // Visibility toggle is a local viewing preference — no API call needed.
        // The DB 'visivel' column stores the admin-configured default, not the user's session toggle.
        setCalendars(prev => prev.map(c => (c.id === id ? { ...c, visible: !c.visible } : c)));
        return { success: true };
    }, [calendars]);

    const addCalendar = useCallback(async (calendarData: Omit<Calendar, 'id'>): Promise<EventOperationResult> => {
        try {
            const newCalendar = await calendarService.createCalendar(calendarData);
            setCalendars(prev => [...prev, newCalendar]);
            return { success: true, data: newCalendar };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add calendar';
            console.error('Failed to add calendar:', error);
            return { success: false, error: message };
        }
    }, []);

    const updateCalendar = useCallback(async (updatedCalendar: Calendar): Promise<EventOperationResult> => {
        const currentCalendar = calendars.find(c => c.id === updatedCalendar.id);
        const colorChanged = currentCalendar && currentCalendar.color !== updatedCalendar.color;

        const previousCalendars = calendars;
        const previousEvents = events;

        setCalendars(prev => prev.map(c => (c.id === updatedCalendar.id ? updatedCalendar : c)));

        if (colorChanged) {
            setEvents(prev => prev.map(e =>
                e.calendarId === updatedCalendar.id
                    ? { ...e, color: updatedCalendar.color }
                    : e
            ));
        }

        try {
            await calendarService.updateCalendar(updatedCalendar);

            if (colorChanged) {
                const affectedEvents = events.filter(e => e.calendarId === updatedCalendar.id);
                await Promise.all(
                    affectedEvents.map(e =>
                        calendarService.updateEvent({ ...e, color: updatedCalendar.color })
                    )
                );
            }

            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update calendar';
            console.error('Failed to update calendar:', error);
            setCalendars(previousCalendars);
            if (colorChanged) {
                setEvents(previousEvents);
            }
            return { success: false, error: message };
        }
    }, [calendars, events]);

    const deleteCalendar = useCallback(async (id: string): Promise<EventOperationResult> => {
        const previousCalendars = calendars;
        const previousEvents = events;

        setCalendars(prev => prev.filter(c => c.id !== id));
        setEvents(prev => prev.filter(e => e.calendarId !== id));

        try {
            await calendarService.deleteCalendar(id);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete calendar';
            console.error('Failed to delete calendar:', error);
            setCalendars(previousCalendars);
            setEvents(previousEvents);
            return { success: false, error: message };
        }
    }, [calendars, events]);

    const stableSetSearchQuery = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    const value = useMemo<EventContextType>(() => ({
        events,
        calendars,
        addEvent,
        updateEvent,
        deleteEvent,
        addCalendar,
        updateCalendar,
        deleteCalendar,
        toggleCalendar,
        searchQuery,
        setSearchQuery: stableSetSearchQuery,
        filteredEvents,
    }), [
        events,
        calendars,
        addEvent,
        updateEvent,
        deleteEvent,
        addCalendar,
        updateCalendar,
        deleteCalendar,
        toggleCalendar,
        searchQuery,
        stableSetSearchQuery,
        filteredEvents,
    ]);

    return (
        <EventContext.Provider value={value}>
            {children}
        </EventContext.Provider>
    );
}

export function useEvents(): EventContextType {
    const context = useContext(EventContext);
    if (context === undefined) {
        throw new Error('useEvents must be used within an EventProvider');
    }
    return context;
}
