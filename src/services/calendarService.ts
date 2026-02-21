import type { CalendarEvent, Calendar, RecurrenceEditMode } from '../types';

class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const DATE_KEYS = new Set(['start', 'end', 'endDate', 'createdAt']);

function reviveDates<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) {
        return data.map(item => reviveDates(item)) as unknown as T;
    }
    if (typeof data === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            if (DATE_KEYS.has(key) && typeof value === 'string') {
                result[key] = new Date(value);
            } else if (typeof value === 'object' && value !== null) {
                result[key] = reviveDates(value);
            } else {
                result[key] = value;
            }
        }
        return result as T;
    }
    return data;
}

async function apiCall<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error || `Request failed: ${res.status}`);
    }

    const data = await res.json();
    return reviveDates(data);
}

class CalendarService {
    // --- Events API ---

    async fetchEvents(): Promise<CalendarEvent[]> {
        return apiCall<CalendarEvent[]>('/api/router.php?route=events');
    }

    async createEvent(eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
        return apiCall<CalendarEvent>('/api/router.php?route=events', {
            method: 'POST',
            body: JSON.stringify(eventData),
        });
    }

    async updateEvent(event: CalendarEvent, mode?: RecurrenceEditMode, instanceDate?: string): Promise<CalendarEvent> {
        return apiCall<CalendarEvent>(`/api/router.php?route=events/${event.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...event, _recurrenceMode: mode, _instanceDate: instanceDate }),
        });
    }

    async deleteEvent(id: string, mode?: RecurrenceEditMode, instanceDate?: string): Promise<void> {
        await apiCall<{ success: boolean }>(`/api/router.php?route=events/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ _recurrenceMode: mode, _instanceDate: instanceDate }),
        });
    }

    // --- Calendars API ---

    async fetchCalendars(): Promise<Calendar[]> {
        return apiCall<Calendar[]>('/api/router.php?route=calendars');
    }

    async createCalendar(calendarData: Omit<Calendar, 'id'>): Promise<Calendar> {
        return apiCall<Calendar>('/api/router.php?route=calendars', {
            method: 'POST',
            body: JSON.stringify(calendarData),
        });
    }

    async updateCalendar(calendar: Calendar): Promise<Calendar> {
        return apiCall<Calendar>(`/api/router.php?route=calendars/${calendar.id}`, {
            method: 'PUT',
            body: JSON.stringify(calendar),
        });
    }

    async deleteCalendar(id: string): Promise<void> {
        await apiCall<{ success: boolean }>(`/api/router.php?route=calendars/${id}`, {
            method: 'DELETE',
        });
    }
}

export const calendarService = new CalendarService();
