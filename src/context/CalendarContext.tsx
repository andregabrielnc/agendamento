import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { startOfToday } from 'date-fns';
import type { CalendarEvent, Calendar, ViewType } from '../types';

interface ModalState {
    isOpen: boolean;
    type: 'create' | 'edit' | null;
    selectedDate?: Date;
    event?: CalendarEvent;
}

interface PopoverState {
    isOpen: boolean;
    event: CalendarEvent | null;
    anchorEl: HTMLElement | null;
}

interface CalendarContextType {
    currentDate: Date;
    view: ViewType;
    events: CalendarEvent[];
    calendars: Calendar[];
    selectedDate: Date | null;
    modalState: ModalState;
    popoverState: PopoverState;

    setCurrentDate: (date: Date) => void;
    setView: (view: ViewType) => void;
    addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
    updateEvent: (event: CalendarEvent) => void;
    deleteEvent: (id: string) => void;
    toggleCalendar: (id: string) => void;
    addCalendar: (calendar: Omit<Calendar, 'id'>) => void;
    updateCalendar: (calendar: Calendar) => void;
    deleteCalendar: (id: string) => void;
    selectDate: (date: Date) => void;

    openCreateModal: (date?: Date) => void;
    openEditModal: (event: CalendarEvent) => void;
    closeModal: () => void;

    openPopover: (event: CalendarEvent, anchorEl: HTMLElement) => void;
    closePopover: () => void;

    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredEvents: CalendarEvent[];

    theme: 'light' | 'dark';
    toggleTheme: () => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

import { calendarService } from '../services/calendarService';



export function CalendarProvider({ children }: { children: ReactNode }) {
    const [currentDate, setCurrentDate] = useState<Date>(startOfToday());
    const [view, setView] = useState<ViewType>('month');
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [calendars, setCalendars] = useState<Calendar[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('calendar_theme');
        return (saved as 'light' | 'dark') || 'dark'; // Default to dark preference
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('calendar_theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const [modalState, setModalState] = useState<ModalState>({ isOpen: false, type: null });
    const [popoverState, setPopoverState] = useState<PopoverState>({ isOpen: false, event: null, anchorEl: null });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedEvents, loadedCalendars] = await Promise.all([
                    calendarService.fetchEvents(),
                    calendarService.fetchCalendars()
                ]);
                setEvents(loadedEvents);
                setCalendars(loadedCalendars);
            } catch (error) {
                console.error("Failed to load calendar data:", error);
            }
        };
        loadData();
    }, []);

    // Removed direct localStorage effect, service handles persistence now

    const addEvent = async (eventData: Omit<CalendarEvent, 'id'>) => {
        try {
            const newEvent = await calendarService.createEvent(eventData);
            setEvents(prev => [...prev, newEvent]);
            closeModal();
        } catch (error) {
            console.error("Failed to create event:", error);
            alert("Failed to create event");
        }
    };

    const [searchQuery, setSearchQuery] = useState('');

    // Filter events based on calendar visibility AND search query
    const visibleCalendarIds = calendars.filter(c => c.visible).map(c => c.id);
    const filteredEvents = events.filter(event => {
        // Must be in a visible calendar
        if (!visibleCalendarIds.includes(event.calendarId)) return false;
        // Must match search query (if any)
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return event.title.toLowerCase().includes(q) ||
            (event.description && event.description.toLowerCase().includes(q)) ||
            (event.location && event.location.toLowerCase().includes(q));
    });

    const updateEvent = async (updatedEvent: CalendarEvent) => {
        // Handle instance updates: update the ORIGINAL series
        const originalId = updatedEvent.id.split('_')[0];
        const eventToUpdate = { ...updatedEvent, id: originalId };

        // Optimistic Update
        const previousEvents = events;
        setEvents(prev => prev.map(e => e.id === originalId ? eventToUpdate : e));
        closeModal();

        if (popoverState.isOpen) {
            closePopover();
        }

        try {
            await calendarService.updateEvent(eventToUpdate);
        } catch (error) {
            console.error("Failed to update event:", error);
            alert("Failed to update event");
            setEvents(previousEvents); // Revert
        }
    };

    const deleteEvent = async (id: string) => {
        const originalId = id.split('_')[0];

        // Optimistic Update
        const previousEvents = events;
        setEvents(prev => prev.filter(e => e.id !== originalId));
        closeModal();
        closePopover();

        try {
            await calendarService.deleteEvent(originalId);
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert("Failed to delete event");
            setEvents(previousEvents); // Revert
        }
    };

    const toggleCalendar = async (id: string) => {
        const calendar = calendars.find(c => c.id === id);
        if (calendar) {
            const updatedCalendar = { ...calendar, visible: !calendar.visible };
            try {
                // Optimistic update
                setCalendars(prev => prev.map(c => c.id === id ? updatedCalendar : c));
                await calendarService.updateCalendar(updatedCalendar);
            } catch (error) {
                console.error("Failed to toggle calendar:", error);
                // Revert
                setCalendars(prev => prev.map(c => c.id === id ? calendar : c));
            }
        }
    };

    const addCalendar = async (calendarData: Omit<Calendar, 'id'>) => {
        try {
            const newCalendar = await calendarService.createCalendar(calendarData);
            setCalendars(prev => [...prev, newCalendar]);
        } catch (error) {
            console.error("Failed to add calendar:", error);
            alert("Failed to add calendar");
        }
    };

    const updateCalendar = async (updatedCalendar: Calendar) => {
        const previousCalendars = calendars;
        setCalendars(prev => prev.map(c => c.id === updatedCalendar.id ? updatedCalendar : c));

        try {
            await calendarService.updateCalendar(updatedCalendar);
        } catch (error) {
            console.error("Failed to update calendar:", error);
            alert("Failed to update calendar");
            setCalendars(previousCalendars);
        }
    };

    const deleteCalendar = async (id: string) => {
        if (!confirm('Are you sure you want to delete this calendar and all its events?')) return;

        const previousCalendars = calendars;
        const previousEvents = events;

        setCalendars(prev => prev.filter(c => c.id !== id));
        setEvents(prev => prev.filter(e => e.calendarId !== id));

        try {
            await calendarService.deleteCalendar(id);
        } catch (error) {
            console.error("Failed to delete calendar:", error);
            alert("Failed to delete calendar");
            setCalendars(previousCalendars);
            setEvents(previousEvents);
        }
    };

    const selectDate = (date: Date) => {
        setSelectedDate(date);
        setCurrentDate(date);
    };

    const openCreateModal = (date?: Date) => {
        closePopover();
        setModalState({
            isOpen: true,
            type: 'create',
            selectedDate: date || new Date()
        });
    };

    const openEditModal = (event: CalendarEvent) => {
        closePopover();
        setModalState({
            isOpen: true,
            type: 'edit',
            event
        });
    };

    const closeModal = () => {
        setModalState({ isOpen: false, type: null });
    };

    const openPopover = (event: CalendarEvent, anchorEl: HTMLElement) => {
        setPopoverState({ isOpen: true, event, anchorEl });
    };

    const closePopover = () => {
        setPopoverState({ isOpen: false, event: null, anchorEl: null });
    };

    return (
        <CalendarContext.Provider value={{
            currentDate,
            view,
            events,
            calendars,
            selectedDate,
            modalState,
            popoverState,
            setCurrentDate,
            setView,
            addEvent,
            updateEvent,
            deleteEvent,
            toggleCalendar,
            addCalendar,
            updateCalendar,
            deleteCalendar,
            selectDate,
            openCreateModal,
            openEditModal,
            closeModal,
            openPopover,
            closePopover,
            searchQuery,
            setSearchQuery,
            filteredEvents,
            theme,
            toggleTheme
        }}>
            {children}
        </CalendarContext.Provider>
    );
}

export function useCalendar() {
    const context = useContext(CalendarContext);
    if (context === undefined) {
        throw new Error('useCalendar must be used within a CalendarProvider');
    }
    return context;
}
