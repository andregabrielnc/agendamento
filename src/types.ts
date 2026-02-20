export type ViewType = 'day' | 'week' | 'month' | 'year' | 'agenda' | '4day';

export type UserRole = 'admin' | 'user';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
    createdAt: Date;
}

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    occurrenceCount?: number;
    endType: 'never' | 'date' | 'count';
}

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface CalendarEvent {
    id: string;
    title: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    description?: string;
    recurrence?: RecurrenceType | RecurrenceRule;
    color?: string;
    calendarId: string;
    createdBy?: string;
}

export interface Calendar {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    description?: string;
    createdBy?: string;
}

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}
