import type { CalendarEvent } from '../types';
import { getRecurrenceInstances } from './recurrenceUtils';
import { addYears } from 'date-fns';

export interface ConflictResult {
    hasConflict: boolean;
    conflictingEvent?: CalendarEvent;
    conflictingInstance?: { start: Date; end: Date };
    proposedInstance?: { start: Date; end: Date };
}

/**
 * Strict overlap check: two intervals overlap iff aStart < bEnd AND bStart < aEnd.
 * Adjacent endpoints (e.g. 15:00-16:00 and 16:00-17:00) do NOT conflict.
 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/**
 * Normalize allDay events to 07:00-18:00 on the same date.
 */
export function normalizeEventTimes(event: { start: Date; end: Date; allDay?: boolean }): { start: Date; end: Date } {
    if (!event.allDay) {
        return { start: event.start, end: event.end };
    }
    const start = new Date(event.start);
    start.setHours(7, 0, 0, 0);
    const end = new Date(event.start);
    end.setHours(18, 0, 0, 0);
    return { start, end };
}

/**
 * Extract the base event ID (strip recurrence instance suffix like "uuid_3" → "uuid").
 */
function getBaseId(id: string): string {
    return id.split('_')[0];
}

/**
 * Check if a single (non-recurring) proposed event conflicts with any existing event
 * in the same room (calendarId).
 */
export function checkEventConflict(
    proposedEvent: { start: Date; end: Date; allDay?: boolean; calendarId: string },
    allEvents: CalendarEvent[],
    excludeEventId?: string
): ConflictResult {
    const proposed = normalizeEventTimes(proposedEvent);
    const excludeBase = excludeEventId ? getBaseId(excludeEventId) : undefined;

    // Filter to same room, exclude self
    const sameRoom = allEvents.filter(e => {
        if (e.calendarId !== proposedEvent.calendarId) return false;
        if (excludeBase && getBaseId(e.id) === excludeBase) return false;
        return true;
    });

    // Expand each existing event's recurrence instances over a wide range
    const rangeStart = new Date(Math.min(proposed.start.getTime() - 86400000, Date.now() - 86400000 * 365));
    const rangeEnd = new Date(Math.max(proposed.end.getTime() + 86400000, Date.now() + 86400000 * 365));

    for (const existing of sameRoom) {
        const instances = getRecurrenceInstances(existing, rangeStart, rangeEnd);
        for (const instance of instances) {
            const normalized = normalizeEventTimes(instance);
            if (intervalsOverlap(proposed.start, proposed.end, normalized.start, normalized.end)) {
                return {
                    hasConflict: true,
                    conflictingEvent: existing,
                    conflictingInstance: { start: normalized.start, end: normalized.end },
                    proposedInstance: { start: proposed.start, end: proposed.end },
                };
            }
        }
    }

    return { hasConflict: false };
}

/**
 * Check if a recurring proposed event conflicts with any existing event.
 * Expands ALL instances of the proposed event and checks each one.
 */
export function checkRecurringEventConflict(
    proposedEvent: CalendarEvent | Omit<CalendarEvent, 'id'>,
    allEvents: CalendarEvent[],
    excludeEventId?: string,
    fromDate?: Date
): ConflictResult {
    // Build a temporary event with a fake ID for expansion
    const tempEvent: CalendarEvent = {
        ...(proposedEvent as CalendarEvent),
        id: (proposedEvent as CalendarEvent).id || '__proposed__',
    };

    // Expand proposed event instances over a 1-year range
    const now = new Date();
    const rangeStart = new Date(Math.min(tempEvent.start.getTime(), now.getTime()) - 86400000);
    const rangeEnd = addYears(new Date(Math.max(tempEvent.start.getTime(), now.getTime())), 1);

    const proposedInstances = getRecurrenceInstances(tempEvent, rangeStart, rangeEnd);

    // For 'thisAndFollowing' mode, only check instances from the given date forward
    const instancesToCheck = fromDate
        ? proposedInstances.filter(inst => inst.start >= fromDate)
        : proposedInstances;

    // Check each proposed instance for conflicts
    for (const proposedInstance of instancesToCheck) {
        const result = checkEventConflict(
            {
                start: proposedInstance.start,
                end: proposedInstance.end,
                allDay: proposedInstance.allDay,
                calendarId: proposedInstance.calendarId,
            },
            allEvents,
            excludeEventId
        );
        if (result.hasConflict) {
            return {
                ...result,
                proposedInstance: {
                    start: proposedInstance.start,
                    end: proposedInstance.end,
                },
            };
        }
    }

    return { hasConflict: false };
}

/**
 * Build a user-friendly conflict message in Portuguese.
 */
export function buildConflictMessage(result: ConflictResult): string {
    if (!result.hasConflict || !result.conflictingEvent) {
        return '';
    }

    const event = result.conflictingEvent;
    const title = event.title || '(Sem título)';

    if (result.conflictingInstance) {
        const { start, end } = result.conflictingInstance;
        const dateStr = start.toLocaleDateString('pt-BR');
        const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `Conflito de horário com "${title}" em ${dateStr} (${startTime}–${endTime})`;
    }

    return `Conflito de horário com "${title}" nesta sala`;
}

/**
 * Helper: determine if an event has recurrence (not 'none').
 */
export function hasRecurrence(event: { recurrence?: CalendarEvent['recurrence'] }): boolean {
    if (!event.recurrence) return false;
    if (event.recurrence === 'none') return false;
    if (typeof event.recurrence === 'string') return true;
    return true;
}
