import {
    addDays,
    addWeeks,
    addMonths,
    addYears,
    isBefore,
    isAfter,
    getDay,
    startOfDay,
    isValid,
    format
} from 'date-fns';
import type { CalendarEvent, RecurrenceRule } from '../types';

export function getRecurrenceInstances(
    event: CalendarEvent,
    rangeStart: Date,
    rangeEnd: Date
): CalendarEvent[] {
    if (!event.recurrence || event.recurrence === 'none') {
        if (isBefore(event.start, rangeEnd) && isAfter(event.end, rangeStart)) {
            return [event];
        }
        return [];
    }

    const instances: CalendarEvent[] = [];
    let currentStart = new Date(event.start);
    let currentEnd = new Date(event.end);
    let count = 0;

    let rule: RecurrenceRule;

    if (typeof event.recurrence === 'string') {
        rule = {
            frequency: event.recurrence as any,
            interval: 1,
            endType: 'never'
        };
    } else {
        rule = event.recurrence;
    }

    const MAX_INSTANCES = 365;

    // Year-end cap: use the later of event start year or current year
    const capYear = Math.max(event.start.getFullYear(), new Date().getFullYear());
    const yearEnd = new Date(capYear, 11, 31, 23, 59, 59);

    // Build set of exception dates to skip
    const exceptionDates = new Set<string>();
    if (rule.exceptions) {
        for (const ex of rule.exceptions) {
            exceptionDates.add(ex);
        }
    }

    while (count < MAX_INSTANCES) {
        // Hard year-end cap
        if (isAfter(currentStart, yearEnd)) break;

        // Safe check for endDate — compare at date level so the last day is included
        if (rule.endType === 'date' && rule.endDate) {
            const endDate = rule.endDate instanceof Date ? rule.endDate : new Date(rule.endDate);
            if (isValid(endDate) && isAfter(startOfDay(currentStart), startOfDay(endDate))) break;
        }
        if (rule.endType === 'count' && rule.occurrenceCount && count >= rule.occurrenceCount) break;

        if (isAfter(currentStart, rangeEnd)) break;

        let isValidInstance = true;

        // Simple logic for weekly with specific days handled in separate block below
        if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
            break;
        }

        if (isValidInstance) {
            const dateKey = format(currentStart, 'yyyy-MM-dd');
            if (!exceptionDates.has(dateKey)) {
                if (isBefore(currentStart, rangeEnd) && isAfter(currentEnd, rangeStart)) {
                    instances.push({
                        ...event,
                        id: `${event.id}_${count}`,
                        start: new Date(currentStart),
                        end: new Date(currentEnd),
                    });
                }
            }
            count++;
        }

        switch (rule.frequency) {
            case 'daily':
                currentStart = addDays(currentStart, rule.interval);
                currentEnd = addDays(currentEnd, rule.interval);
                break;
            case 'weekly':
                currentStart = addWeeks(currentStart, rule.interval);
                currentEnd = addWeeks(currentEnd, rule.interval);
                break;
            case 'monthly':
                currentStart = addMonths(currentStart, rule.interval);
                currentEnd = addMonths(currentEnd, rule.interval);
                break;
            case 'yearly':
                currentStart = addYears(currentStart, rule.interval);
                currentEnd = addYears(currentEnd, rule.interval);
                break;
        }
    }

    // specialized logic for Weekly with Days
    if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        let specializedCount = 0;
        const duration = event.end.getTime() - event.start.getTime();

        let cursorDate = new Date(event.start);

        while (specializedCount < (rule.occurrenceCount || MAX_INSTANCES)) {
            const sortedDays = [...rule.daysOfWeek].sort((a, b) => a - b);

            for (const dayIndex of sortedDays) {
                const currentDay = getDay(cursorDate);
                const diff = dayIndex - currentDay;
                const targetDate = addDays(cursorDate, diff);

                if (isBefore(targetDate, startOfDay(event.start))) continue;

                const instanceStart = new Date(targetDate);
                instanceStart.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0);
                const instanceEnd = new Date(instanceStart.getTime() + duration);

                // Hard year-end cap
                if (isAfter(instanceStart, yearEnd)) return instances;

                if (rule.endType === 'date' && rule.endDate) {
                    const endDate = rule.endDate instanceof Date ? rule.endDate : new Date(rule.endDate);
                    if (isValid(endDate) && isAfter(startOfDay(instanceStart), startOfDay(endDate))) return instances;
                }
                if (rule.endType === 'count' && specializedCount >= rule.occurrenceCount!) return instances;

                const specializedDateKey = format(instanceStart, 'yyyy-MM-dd');
                if (!exceptionDates.has(specializedDateKey)) {
                    if (isBefore(instanceStart, rangeEnd) && isAfter(instanceEnd, rangeStart)) {
                        instances.push({
                            ...event,
                            id: `${event.id}_${specializedCount}`,
                            start: instanceStart,
                            end: instanceEnd,
                        });
                    }
                }
                specializedCount++;
            }

            cursorDate = addWeeks(cursorDate, rule.interval);

            if (isAfter(cursorDate, rangeEnd) && rule.endType !== 'count') break;
            if (specializedCount > MAX_INSTANCES) break;
        }
    }

    return instances;
}
