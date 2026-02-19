import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameDay
} from 'date-fns';

export function getMonthViewDays(currentDate: Date): Date[] {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const startDate = startOfWeek(monthStart); // Defaults to Sunday start
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({
        start: startDate,
        end: endDate
    });
}

export function getWeekViewDays(currentDate: Date) {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
}

export function getNDayViewDays(currentDate: Date, count: number): Date[] {
    const start = currentDate;
    const end = new Date(currentDate);
    end.setDate(end.getDate() + count - 1);
    return eachDayOfInterval({ start, end });
}

export const formatDate = (date: Date, formatStr: string) => format(date, formatStr);

export const isToday = (date: Date) => isSameDay(date, new Date());
