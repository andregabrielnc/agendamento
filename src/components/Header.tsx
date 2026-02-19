import {
    List,
    CaretLeft,
    CaretRight,
    MagnifyingGlass,
    CaretDown,
    Sun,
    Moon,
    Gear,
    User
} from '@phosphor-icons/react'
import styles from './Header.module.css'
import { useCalendar } from '../context/CalendarContext'
import { ptBR } from 'date-fns/locale';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useState } from 'react';
import { SettingsModal } from './SettingsModal';

export function Header() {
    const { currentDate, setCurrentDate, view, setView, searchQuery, setSearchQuery, theme, toggleTheme } = useCalendar();
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handlePrev = () => {
        if (view === 'month') {
            setCurrentDate(subMonths(currentDate, 1));
        } else if (view === 'week') {
            setCurrentDate(subWeeks(currentDate, 1));
        } else if (view === 'day') {
            setCurrentDate(subDays(currentDate, 1));
        }
    };

    const handleNext = () => {
        if (view === 'month') {
            setCurrentDate(addMonths(currentDate, 1));
        } else if (view === 'week') {
            setCurrentDate(addWeeks(currentDate, 1));
        } else if (view === 'day') {
            setCurrentDate(addDays(currentDate, 1));
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <button className={styles.iconBtn}>
                    <List size={24} weight="bold" />
                </button>
                <div className={styles.logo}>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg" alt="Logo" width={40} />
                    <span>Calendar</span>
                </div>
            </div>

            <div className={styles.middle}>
                <button className={styles.todayBtn} onClick={handleToday}>Hoje</button>
                <div className={styles.navigation}>
                    <button className={styles.iconBtn} onClick={handlePrev}>
                        <CaretLeft size={20} weight="bold" />
                    </button>
                    <button className={styles.iconBtn} onClick={handleNext}>
                        <CaretRight size={20} weight="bold" />
                    </button>
                </div>
                <h2 className={styles.dateTitle}>
                    {view === 'month' && format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    {view === 'week' && (
                        `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d', { locale: ptBR })} - ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d yyyy', { locale: ptBR })}`
                    )}
                    {view === 'day' && format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h2>
            </div>

            <div className={styles.right}>
                <div className={styles.viewSwitcher} onClick={() => setShowViewMenu(!showViewMenu)}>
                    <span>
                        {view === 'month' && 'Mês'}
                        {view === 'week' && 'Semana'}
                        {view === 'day' && 'Dia'}
                    </span>
                    <CaretDown size={14} />
                    {showViewMenu && (
                        <div className={styles.viewMenu}>
                            <div onClick={() => { setView('month'); setShowViewMenu(false); }}>Mês</div>
                            <div onClick={() => { setView('week'); setShowViewMenu(false); }}>Semana</div>
                            <div onClick={() => { setView('day'); setShowViewMenu(false); }}>Dia</div>
                        </div>
                    )}
                </div>

                <div className={styles.searchWrapper}>
                    <MagnifyingGlass size={20} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Pesquisar"
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className={styles.iconBtn} onClick={toggleTheme} title="Alternar tema">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <button className={styles.iconBtn} onClick={() => setIsSettingsOpen(true)} title="Configurações">
                    <Gear size={24} />
                </button>
                <div className={styles.avatarBtn}>
                    <User size={20} />
                </div>
            </div>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </header>
    )
}
