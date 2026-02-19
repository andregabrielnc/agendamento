export type ViewType = 'day' | 'week' | 'month' | 'year';

export interface RecurrenceRule {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    endDate?: Date;
    occurrenceCount?: number;
    endType: 'never' | 'date' | 'count';
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
    // Allows simplified string 'daily' etc. OR a complex rule object
    recurrence?: 'daily' | 'weekly' | 'monthly' | 'none' | RecurrenceRule;
    color?: string;
    calendarId: string;
}

export interface Calendar {
    id: string;
    name: string;
    color: string;
    visible: boolean;
    description?: string;
}
