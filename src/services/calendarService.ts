import type { CalendarEvent, Calendar } from '../types';
import { v4 as uuidv4 } from 'uuid';

const EVENTS_STORAGE_KEY = 'calendar_events';
const CALENDARS_STORAGE_KEY = 'calendar_calendars';

const SIMULATE_DELAY = 300;

const initialCalendars: Calendar[] = [
    { id: '1', name: 'Sala 101 - Bloco A', color: '#039be5', visible: true, createdBy: 'admin-001' },
    { id: '2', name: 'Sala 202 - Bloco B', color: '#33b679', visible: true, createdBy: 'admin-001' },
    { id: '3', name: 'Auditório Principal', color: '#f6bf26', visible: true, createdBy: 'admin-001' },
    { id: '4', name: 'Lab. Informática', color: '#d50000', visible: true, createdBy: 'admin-001' },
    { id: '5', name: 'Sala de Reuniões', color: '#8e24aa', visible: true, createdBy: 'admin-001' },
];

function buildInitialEvents(): CalendarEvent[] {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();

    const makeDate = (dayOffset: number, hour: number, minute = 0): Date => {
        const dt = new Date(y, m, d + dayOffset);
        dt.setHours(hour, minute, 0, 0);
        return dt;
    };

    return [
        {
            id: 'evt-1',
            title: 'Reunião de Planejamento Q1',
            start: makeDate(0, 9, 0),
            end: makeDate(0, 10, 30),
            calendarId: '1',
            color: '#039be5',
            location: 'Sala de Conferência A',
            description: 'Reunião inicial de planejamento para o roadmap do primeiro trimestre.',
            guests: ['maria@empresa.com', 'joao@empresa.com'],
            busyStatus: 'busy',
            visibility: 'default',
            reminders: [{ type: 'notification', minutes: 30 }],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-2',
            title: 'Almoço com Equipe',
            start: makeDate(0, 12, 0),
            end: makeDate(0, 13, 0),
            calendarId: '2',
            color: '#33b679',
            location: 'Restaurante Sabor & Arte',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-3',
            title: 'Code Review - Frontend',
            start: makeDate(0, 14, 0),
            end: makeDate(0, 15, 0),
            calendarId: '4',
            color: '#d50000',
            description: 'Revisão de código dos componentes React do painel de controle.',
            meetingLink: 'https://meet.google.com/abc-defg-hij',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-4',
            title: 'Aniversário da Maria',
            start: makeDate(1, 0, 0),
            end: makeDate(1, 23, 59),
            calendarId: '3',
            color: '#f6bf26',
            allDay: true,
            description: 'Não esquecer o presente!',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-5',
            title: 'Sprint Review',
            start: makeDate(1, 10, 0),
            end: makeDate(1, 11, 0),
            calendarId: '4',
            color: '#d50000',
            guests: ['time-dev@empresa.com', 'pm@empresa.com'],
            meetingLink: 'https://meet.google.com/xyz-abcd-efg',
            recurrence: 'weekly',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-6',
            title: 'Yoga',
            start: makeDate(1, 7, 0),
            end: makeDate(1, 8, 0),
            calendarId: '2',
            color: '#33b679',
            location: 'Studio Zen',
            recurrence: 'weekly',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-7',
            title: 'Dentista',
            start: makeDate(2, 14, 30),
            end: makeDate(2, 15, 30),
            calendarId: '2',
            color: '#33b679',
            location: 'Clínica Sorrir, Sala 203',
            reminders: [{ type: 'notification', minutes: 60 }],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-8',
            title: 'Deploy para Produção',
            start: makeDate(2, 16, 0),
            end: makeDate(2, 17, 0),
            calendarId: '4',
            color: '#d50000',
            description: 'Deploy v2.4.0 - nova funcionalidade de relatórios.',
            guests: ['devops@empresa.com'],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-9',
            title: 'Jantar em Família',
            start: makeDate(3, 19, 0),
            end: makeDate(3, 21, 0),
            calendarId: '3',
            color: '#f6bf26',
            location: 'Casa da Mamãe',
            guests: ['mae@familia.com', 'pai@familia.com', 'irmao@familia.com'],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-10',
            title: 'Estudo - TypeScript Avançado',
            start: makeDate(0, 18, 0),
            end: makeDate(0, 19, 30),
            calendarId: '2',
            color: '#33b679',
            description: 'Capítulos 8-10 do livro de TypeScript.',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-11',
            title: '1:1 com Gerente',
            start: makeDate(3, 10, 0),
            end: makeDate(3, 10, 30),
            calendarId: '4',
            color: '#d50000',
            recurrence: 'weekly',
            meetingLink: 'https://meet.google.com/one-on-one',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-12',
            title: 'Treino na Academia',
            start: makeDate(0, 6, 30),
            end: makeDate(0, 7, 30),
            calendarId: '2',
            color: '#33b679',
            location: 'SmartFit Centro',
            recurrence: 'daily',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-13',
            title: 'Conferência Tech Summit 2026',
            start: makeDate(5, 0, 0),
            end: makeDate(6, 23, 59),
            calendarId: '4',
            color: '#d50000',
            allDay: true,
            location: 'Centro de Convenções',
            description: 'Evento de 2 dias sobre tendências de tecnologia.',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-14',
            title: 'Reunião de Pais - Escola',
            start: makeDate(4, 18, 30),
            end: makeDate(4, 19, 30),
            calendarId: '3',
            color: '#f6bf26',
            location: 'Escola Municipal',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-15',
            title: 'Carnaval',
            start: makeDate(7, 0, 0),
            end: makeDate(7, 23, 59),
            calendarId: '5',
            color: '#8e24aa',
            allDay: true,
            createdBy: 'admin-001',
        },
        {
            id: 'evt-16',
            title: 'Retrospectiva do Sprint',
            start: makeDate(4, 15, 0),
            end: makeDate(4, 16, 0),
            calendarId: '4',
            color: '#d50000',
            meetingLink: 'https://meet.google.com/retro-sprint',
            guests: ['time-dev@empresa.com'],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-17',
            title: 'Happy Hour',
            start: makeDate(4, 18, 0),
            end: makeDate(4, 20, 0),
            calendarId: '1',
            color: '#039be5',
            location: 'Bar do Zé',
            guests: ['amigo1@gmail.com', 'amigo2@gmail.com'],
            createdBy: 'admin-001',
        },
        {
            id: 'evt-18',
            title: 'Consulta Médica',
            start: makeDate(-1, 9, 0),
            end: makeDate(-1, 9, 45),
            calendarId: '2',
            color: '#33b679',
            location: 'Hospital Santa Cruz',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-19',
            title: 'Daily Standup',
            start: makeDate(0, 9, 30),
            end: makeDate(0, 9, 45),
            calendarId: '4',
            color: '#d50000',
            recurrence: 'daily',
            meetingLink: 'https://meet.google.com/daily-standup',
            createdBy: 'admin-001',
        },
        {
            id: 'evt-20',
            title: 'Entregar Relatório Mensal',
            start: makeDate(6, 0, 0),
            end: makeDate(6, 23, 59),
            calendarId: '4',
            color: '#d50000',
            allDay: true,
            description: 'Prazo final para envio do relatório mensal de progresso.',
            createdBy: 'admin-001',
        },
    ];
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class CalendarService {
    private getStoredEvents(): CalendarEvent[] {
        const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved, (key, value) => {
                if (key === 'start' || key === 'end' || key === 'endDate') return new Date(value);
                return value;
            });
        }
        return buildInitialEvents();
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
        await delay(SIMULATE_DELAY);
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

        const events = this.getStoredEvents();
        const filteredEvents = events.filter(e => e.calendarId !== id);
        this.saveEvents(filteredEvents);
    }

    // --- Utils ---

    async generateMeetingLink(): Promise<string> {
        await delay(500);
        return `https://meet.google.com/${uuidv4().substring(0, 3)}-${uuidv4().substring(0, 4)}-${uuidv4().substring(0, 3)}`;
    }

    /**
     * Clears stored data and reloads with fresh initial data.
     */
    resetToDefaults(): void {
        localStorage.removeItem(EVENTS_STORAGE_KEY);
        localStorage.removeItem(CALENDARS_STORAGE_KEY);
    }
}

export const calendarService = new CalendarService();
