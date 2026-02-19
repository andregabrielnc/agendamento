import { useCalendar } from '../../context/CalendarContext'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'

export function CalendarGrid() {
    const { view } = useCalendar();

    return (
        <div style={{ height: '100%', width: '100%' }}>
            {view === 'month' && <MonthView />}
            {view === 'week' && <WeekView />}
            {view === 'day' && <div style={{ color: 'white', padding: 20 }}>Day View (Coming Soon)</div>}
        </div>
    )
}
