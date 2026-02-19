import type { CalendarEvent, Calendar } from '../types';
import { v4 as uuidv4 } from 'uuid';

const EVENTS_STORAGE_KEY = 'calendar_events';
const CALENDARS_STORAGE_KEY = 'calendar_calendars';

// Mock simulation delay
const SIMULATE_DELAY = 300; // ms

const initialCalendars: Calendar[] = [
    { id: '1', name: 'Andre Gabriel', color: '#818cf8', visible: true },
    { id: '2', name: 'Personal', color: '#34d399', visible: true },
    { id: '3', name: 'Family', color: '#fbbf24', visible: true },
];

const initialEvents: CalendarEvent[] = [
    {
        id: '1',
        title: 'Project Kickoff',
        start: new Date(new Date().setHours(10, 0, 0, 0)),
        end: new Date(new Date().setHours(11, 30, 0, 0)),
        calendarId: '1',
        color: '#818cf8',
        location: 'Conference Room A',
        description: 'Initial planning meeting for the Q1 roadmap.'
    },
    {
        id: '2',
        title: 'Lunch with Team',
        start: new Date(new Date().setHours(13, 0, 0, 0)),
        end: new Date(new Date().setHours(14, 0, 0, 0)),
        calendarId: '2',
        color: '#34d399'
    }
];

// Helper to simulate async network request
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class CalendarService {
    private getStoredEvents(): CalendarEvent[] {
        const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved, (key, value) => {
                // Revive dates
                if (key === 'start' || key === 'end' || key === 'endDate') return new Date(value);
                return value;
            });
        }
        return initialEvents;
    }

    private saveEvents(events: CalendarEvent[]): void {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    }

    private getStoredCalendars(): Calendar[] {
        const saved = localStorage.getItem(CALENDARS_STORAGE_KEY);
        return saved ? JSON.parse(saved) : initialCalendars;
    }

    private saveCalendars(calendars: Calendar[]): void {
        localStorage.setItem(CALENDARS_STORAGE_KEY, JSON.stringify(calendars));
    }

    // --- Events API ---

    async fetchEvents(): Promise<CalendarEvent[]> {
        await delay(SIMULATE_DELAY);
        return this.getStoredEvents();
    }

    async createEvent(eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
        await delay(SIMULATE_DELAY);
        const events = this.getStoredEvents();
        const newEvent: CalendarEvent = { ...eventData, id: uuidv4() };
        events.push(newEvent);
        this.saveEvents(events);
        return newEvent;
    }

    async updateEvent(event: CalendarEvent): Promise<CalendarEvent> {
        await delay(SIMULATE_DELAY);
        const events = this.getStoredEvents();
        const index = events.findIndex(e => e.id === event.id);
        if (index !== -1) {
            events[index] = event;
            this.saveEvents(events);
            return event;
        }
        throw new Error(`Event with id ${event.id} not found`);
    }

    async deleteEvent(id: string): Promise<void> {
        await delay(SIMULATE_DELAY);
        const events = this.getStoredEvents();
        const filtered = events.filter(e => e.id !== id);
        this.saveEvents(filtered);
    }

    // --- Calendars API ---

    async fetchCalendars(): Promise<Calendar[]> {
        await delay(SIMULATE_DELAY);
        return this.getStoredCalendars();
    }

    async updateCalendar(calendar: Calendar): Promise<Calendar> {
        await delay(SIMULATE_DELAY); // Fast
        const calendars = this.getStoredCalendars();
        const index = calendars.findIndex(c => c.id === calendar.id);
        if (index !== -1) {
            calendars[index] = calendar;
            this.saveCalendars(calendars);
            return calendar;
        }
        throw new Error(`Calendar with id ${calendar.id} not found`);
    }

    async createCalendar(calendarData: Omit<Calendar, 'id'>): Promise<Calendar> {
        await delay(SIMULATE_DELAY);
        const calendars = this.getStoredCalendars();
        const newCalendar: Calendar = { ...calendarData, id: uuidv4() };
        calendars.push(newCalendar);
        this.saveCalendars(calendars);
        return newCalendar;
    }

    async deleteCalendar(id: string): Promise<void> {
        await delay(SIMULATE_DELAY);
        const calendars = this.getStoredCalendars();
        const filtered = calendars.filter(c => c.id !== id);
        this.saveCalendars(filtered);

        // Also delete associated events
        const events = this.getStoredEvents();
        const filteredEvents = events.filter(e => e.calendarId !== id);
        this.saveEvents(filteredEvents);
    }

    // --- Utils ---

    async generateMeetingLink(): Promise<string> {
        await delay(500); // Simulate API call to Google Meet
        return `https://meet.google.com/${uuidv4().substring(0, 3)}-${uuidv4().substring(0, 4)}-${uuidv4().substring(0, 3)}`;
    }
}

export const calendarService = new CalendarService();
