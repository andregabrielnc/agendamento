import {
    addDays,
    addWeeks,
    addMonths,
    addYears,
    isBefore,
    isAfter,
    getDay,
    getDaysInMonth,
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
            frequency: event.recurrence as RecurrenceRule['frequency'],
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

    // Capture original time components to fix recurrence edge cases:
    // - Monthly day 31 stickiness (Jan 31 -> Feb 28 -> Mar 28 instead of Mar 31)
    // - Yearly Feb 29 stickiness (Feb 29 -> Feb 28 in non-leap, then stuck on 28)
    // - DST hour shifts (+/- 1 hour after crossing DST boundary)
    const originalStartDay = event.start.getDate();
    const originalEndDay = event.end.getDate();
    const originalHours = event.start.getHours();
    const originalMinutes = event.start.getMinutes();
    const originalEndHours = event.end.getHours();
    const originalEndMinutes = event.end.getMinutes();

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

        const isValidInstance = true;

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

        // Fix monthly day-31 stickiness and yearly Feb-29 stickiness:
        // Restore the original day-of-month, capped to the last day of the target month.
        // Use separate originalStartDay/originalEndDay to preserve multi-day event duration.
        if (rule.frequency === 'monthly' || rule.frequency === 'yearly') {
            const cappedStartDay = Math.min(originalStartDay, getDaysInMonth(currentStart));
            currentStart.setDate(cappedStartDay);
            const cappedEndDay = Math.min(originalEndDay, getDaysInMonth(currentEnd));
            currentEnd.setDate(cappedEndDay);
        }

        // Fix DST normalization: restore original hours/minutes after every increment
        currentStart.setHours(originalHours, originalMinutes, 0, 0);
        currentEnd.setHours(originalEndHours, originalEndMinutes, 0, 0);
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
