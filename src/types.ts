export type ViewType = 'day' | 'week' | 'month' | 'year' | 'agenda' | '4day';

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    occurrenceCount?: number;
    endType: 'never' | 'date' | 'count';
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface EventReminder {
    type: 'notification' | 'email';
    minutes: number;
}

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    description?: string;
    location?: string;
    guests?: string[];
    meetingLink?: string;
    recurrence?: RecurrenceType | RecurrenceRule;
    color?: string;
    calendarId: string;
    reminders?: EventReminder[];
    busyStatus?: 'busy' | 'free';
    visibility?: 'default' | 'public' | 'private';
}

export interface Calendar {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    description?: string;
}

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}
