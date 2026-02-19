import { useCalendar } from '../../context/CalendarContext'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { DayView } from './DayView'
import { YearView } from './YearView'
import { AgendaView } from './AgendaView'

export function CalendarGrid() {
    const { view } = useCalendar();

    return (
        <div style={{ height: '100%', width: '100%' }}>
            {view === 'month' && <MonthView />}
            {view === 'week' && <WeekView />}
            {view === 'day' && <DayView />}
            {view === 'year' && <YearView />}
            {view === 'agenda' && <AgendaView />}
            {view === '4day' && <WeekView dayCount={4} />}
        </div>
    )
}
