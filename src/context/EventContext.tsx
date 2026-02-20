import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CalendarEvent, Calendar } from '../types';
import { calendarService } from '../services/calendarService';

interface EventOperationResult {
    success: boolean;
    error?: string;
}

interface EventContextType {
    events: CalendarEvent[];
    calendars: Calendar[];
    addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<EventOperationResult>;
    updateEvent: (event: CalendarEvent) => Promise<EventOperationResult>;
    deleteEvent: (id: string) => Promise<EventOperationResult>;
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

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedEvents, loadedCalendars] = await Promise.all([
                    calendarService.fetchEvents(),
                    calendarService.fetchCalendars(),
                ]);
                setEvents(loadedEvents);
                setCalendars(loadedCalendars);
            } catch (error) {
                console.error('Failed to load calendar data:', error);
            }
        };
        loadData();
    }, []);

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
                (event.description !== undefined && event.description.toLowerCase().includes(q)) ||
                (event.location !== undefined && event.location.toLowerCase().includes(q))
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

    const updateEvent = useCallback(async (updatedEvent: CalendarEvent): Promise<EventOperationResult> => {
        const originalId = updatedEvent.id.split('_')[0];
        const eventToUpdate = { ...updatedEvent, id: originalId };

        const previousEvents = events;
        setEvents(prev => prev.map(e => (e.id === originalId ? eventToUpdate : e)));

        try {
            await calendarService.updateEvent(eventToUpdate);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update event';
            console.error('Failed to update event:', error);
            setEvents(previousEvents);
            return { success: false, error: message };
        }
    }, [events]);

    const deleteEvent = useCallback(async (id: string): Promise<EventOperationResult> => {
        const originalId = id.split('_')[0];

        const previousEvents = events;
        setEvents(prev => prev.filter(e => e.id !== originalId));

        try {
            await calendarService.deleteEvent(originalId);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete event';
            console.error('Failed to delete event:', error);
            setEvents(previousEvents);
            return { success: false, error: message };
        }
    }, [events]);

    const toggleCalendar = useCallback(async (id: string): Promise<EventOperationResult> => {
        const calendar = calendars.find(c => c.id === id);
        if (!calendar) {
            return { success: false, error: `Calendar with id ${id} not found` };
        }

        const updatedCalendar = { ...calendar, visible: !calendar.visible };
        const previousCalendars = calendars;
        setCalendars(prev => prev.map(c => (c.id === id ? updatedCalendar : c)));

        try {
            await calendarService.updateCalendar(updatedCalendar);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to toggle calendar';
            console.error('Failed to toggle calendar:', error);
            setCalendars(previousCalendars);
            return { success: false, error: message };
        }
    }, [calendars]);

    const addCalendar = useCallback(async (calendarData: Omit<Calendar, 'id'>): Promise<EventOperationResult> => {
        try {
            const newCalendar = await calendarService.createCalendar(calendarData);
            setCalendars(prev => [...prev, newCalendar]);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add calendar';
            console.error('Failed to add calendar:', error);
            return { success: false, error: message };
        }
    }, []);

    const updateCalendar = useCallback(async (updatedCalendar: Calendar): Promise<EventOperationResult> => {
        const previousCalendars = calendars;
        setCalendars(prev => prev.map(c => (c.id === updatedCalendar.id ? updatedCalendar : c)));

        try {
            await calendarService.updateCalendar(updatedCalendar);
            return { success: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update calendar';
            console.error('Failed to update calendar:', error);
            setCalendars(previousCalendars);
            return { success: false, error: message };
        }
    }, [calendars]);

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
