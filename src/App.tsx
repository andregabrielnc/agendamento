import styles from './App.module.css'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CalendarProvider, useCalendar } from './context/CalendarContext'
import { CalendarGrid } from './components/CalendarGrid/CalendarGrid'
import { EventModal } from './components/EventModal'
import { EventPopover } from './components/EventPopover'

function AppContent() {
  const { popoverState, closePopover } = useCalendar();

  return (
    <div className={styles.container}>
      <Sidebar />
      <main className={styles.main}>
        <Header />
        <div className={styles.content}>
          <CalendarGrid />
        </div>
      </main>
      <EventModal />
      {popoverState.isOpen && popoverState.event && (
        <EventPopover
          event={popoverState.event}
          anchorEl={popoverState.anchorEl}
          onClose={closePopover}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <CalendarProvider>
      <AppContent />
    </CalendarProvider>
  )
}

export default App
