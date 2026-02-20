import styles from './App.module.css'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { CalendarProvider, useCalendar } from './context/CalendarContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CalendarGrid } from './components/CalendarGrid/CalendarGrid'
import { EventModal } from './components/EventModal'
import { EventPopover } from './components/EventPopover'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'
import { Login } from './pages/Login'

function CalendarApp() {
  const { popoverState, closePopover, sidebarOpen, toggleSidebar } = useCalendar();

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.body}>
        <div className={`${styles.sidebarWrapper} ${sidebarOpen ? styles.sidebarVisible : styles.sidebarHidden}`}>
          <Sidebar />
        </div>
        {sidebarOpen && <div className={styles.sidebarOverlay} onClick={toggleSidebar} />}
        <main className={styles.main}>
          <div className={styles.content}>
            <CalendarGrid />
          </div>
        </main>
      </div>
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

function AppContent() {
  const { user } = useAuth();

  if (!user) {
    return <Login />;
  }

  return (
    <CalendarProvider>
      <CalendarApp />
    </CalendarProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
