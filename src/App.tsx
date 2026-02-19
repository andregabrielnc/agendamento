import styles from './App.module.css'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CalendarProvider, useCalendar } from './context/CalendarContext'
import { ToastProvider } from './context/ToastContext'
import { CalendarGrid } from './components/CalendarGrid/CalendarGrid'
import { EventModal } from './components/EventModal'
import { EventPopover } from './components/EventPopover'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'

function AppContent() {
  const { popoverState, closePopover, sidebarOpen, toggleSidebar } = useCalendar();

  return (
    <div className={styles.container}>
      <div className={`${styles.sidebarWrapper} ${sidebarOpen ? styles.sidebarVisible : styles.sidebarHidden}`}>
        <Sidebar />
      </div>
      {sidebarOpen && <div className={styles.sidebarOverlay} onClick={toggleSidebar} />}
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
      <KeyboardShortcuts />
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <CalendarProvider>
        <AppContent />
      </CalendarProvider>
    </ToastProvider>
  )
}

export default App
