import {
    List,
    CaretLeft,
    CaretRight,
    MagnifyingGlass,
    CaretDown,
    Sun,
    Moon,
    Gear,
    SignOut,
    UsersThree,
    ShieldCheck
} from '@phosphor-icons/react'
import styles from './Header.module.css'
import { useCalendar } from '../context/CalendarContext'
import { useAuth } from '../context/AuthContext'
import { ptBR } from 'date-fns/locale';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, addYears, subYears, startOfWeek, endOfWeek } from 'date-fns';
import { useState, useRef, useEffect } from 'react';
import { SettingsModal } from './SettingsModal';
import { AdminUsers } from '../pages/AdminUsers';

const VIEW_LABELS: Record<string, string> = {
    day: 'Dia',
    week: 'Semana',
    month: 'Mês',
    year: 'Ano',
    agenda: 'Agenda',
    '4day': '4 dias',
};

export function Header() {
    const { currentDate, setCurrentDate, view, setView, searchQuery, setSearchQuery, theme, toggleTheme, toggleSidebar } = useCalendar();
    const { user, isAdmin, logout } = useAuth();
    const [showViewMenu, setShowViewMenu] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isUsersOpen, setIsUsersOpen] = useState(false);
    const viewMenuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showViewMenu && !showUserMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (showViewMenu && viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
                setShowViewMenu(false);
            }
            if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showViewMenu, showUserMenu]);

    const handlePrev = () => {
        switch (view) {
            case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
            case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
            case 'day': setCurrentDate(subDays(currentDate, 1)); break;
            case 'year': setCurrentDate(subYears(currentDate, 1)); break;
            case '4day': setCurrentDate(subDays(currentDate, 4)); break;
            case 'agenda': setCurrentDate(subDays(currentDate, 30)); break;
        }
    };

    const handleNext = () => {
        switch (view) {
            case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
            case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
            case 'day': setCurrentDate(addDays(currentDate, 1)); break;
            case 'year': setCurrentDate(addYears(currentDate, 1)); break;
            case '4day': setCurrentDate(addDays(currentDate, 4)); break;
            case 'agenda': setCurrentDate(addDays(currentDate, 30)); break;
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const getDateTitle = (): string => {
        switch (view) {
            case 'month':
                return format(currentDate, 'MMMM yyyy', { locale: ptBR });
            case 'week': {
                const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
                const we = endOfWeek(currentDate, { weekStartsOn: 0 });
                return `${format(ws, 'MMM d', { locale: ptBR })} – ${format(we, 'MMM d, yyyy', { locale: ptBR })}`;
            }
            case 'day':
                return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
            case 'year':
                return format(currentDate, 'yyyy');
            case '4day': {
                const end4 = addDays(currentDate, 3);
                return `${format(currentDate, 'MMM d', { locale: ptBR })} – ${format(end4, 'MMM d, yyyy', { locale: ptBR })}`;
            }
            case 'agenda':
                return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
            default:
                return format(currentDate, 'MMMM yyyy', { locale: ptBR });
        }
    };

    const selectView = (v: string) => {
        setView(v as any);
        setShowViewMenu(false);
    };

    const userInitial = user?.name?.charAt(0)?.toUpperCase() || '?';

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <button className={styles.iconBtn} onClick={toggleSidebar} title="Menu">
                    <List size={24} weight="bold" />
                </button>
                <div className={styles.logo}>
                    <img src="/calendar-icon.svg" alt="Logo" width={40} height={40} />
                    <span>Salas de Aula</span>
                </div>
            </div>

            <div className={styles.middle}>
                <button className={styles.todayBtn} onClick={handleToday}>Hoje</button>
                <div className={styles.navigation}>
                    <button className={styles.iconBtn} onClick={handlePrev} title="Anterior">
                        <CaretLeft size={20} weight="bold" />
                    </button>
                    <button className={styles.iconBtn} onClick={handleNext} title="Próximo">
                        <CaretRight size={20} weight="bold" />
                    </button>
                </div>
                <h2 className={styles.dateTitle}>{getDateTitle()}</h2>
            </div>

            <div className={styles.right}>
                <div className={styles.viewSwitcher} ref={viewMenuRef} onClick={() => setShowViewMenu(!showViewMenu)}>
                    <span>{VIEW_LABELS[view] || view}</span>
                    <CaretDown size={14} />
                    {showViewMenu && (
                        <div className={styles.viewMenu} onClick={e => e.stopPropagation()}>
                            <div className={view === 'day' ? styles.viewMenuActive : ''} onClick={() => selectView('day')}>
                                <span>Dia</span><kbd>D</kbd>
                            </div>
                            <div className={view === 'week' ? styles.viewMenuActive : ''} onClick={() => selectView('week')}>
                                <span>Semana</span><kbd>W</kbd>
                            </div>
                            <div className={view === 'month' ? styles.viewMenuActive : ''} onClick={() => selectView('month')}>
                                <span>Mês</span><kbd>M</kbd>
                            </div>
                            <div className={view === 'year' ? styles.viewMenuActive : ''} onClick={() => selectView('year')}>
                                <span>Ano</span><kbd>Y</kbd>
                            </div>
                            <div className={styles.menuSeparator} />
                            <div className={view === 'agenda' ? styles.viewMenuActive : ''} onClick={() => selectView('agenda')}>
                                <span>Agenda</span><kbd>A</kbd>
                            </div>
                            <div className={view === '4day' ? styles.viewMenuActive : ''} onClick={() => selectView('4day')}>
                                <span>4 dias</span>
                            </div>
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
                        data-search-input
                    />
                </div>

                <button className={styles.iconBtn} onClick={toggleTheme} title="Alternar tema">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <button className={styles.iconBtn} onClick={() => setIsSettingsOpen(true)} title="Configurações">
                    <Gear size={24} />
                </button>

                {/* User Avatar with Menu */}
                <div className={styles.userMenuWrapper} ref={userMenuRef}>
                    <button
                        className={styles.avatarBtn}
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        title={user?.name || ''}
                    >
                        {userInitial}
                        {isAdmin && <span className={styles.adminDot} />}
                    </button>
                    {showUserMenu && (
                        <div className={styles.userMenu} onClick={e => e.stopPropagation()}>
                            <div className={styles.userMenuHeader}>
                                <div className={styles.userMenuAvatar}>{userInitial}</div>
                                <div className={styles.userMenuInfo}>
                                    <div className={styles.userMenuName}>
                                        {user?.name}
                                        {isAdmin && <ShieldCheck size={14} className={styles.adminIcon} />}
                                    </div>
                                    <div className={styles.userMenuEmail}>{user?.email}</div>
                                </div>
                            </div>
                            <div className={styles.userMenuDivider} />
                            {isAdmin && (
                                <button
                                    className={styles.userMenuItem}
                                    onClick={() => { setShowUserMenu(false); setIsUsersOpen(true); }}
                                >
                                    <UsersThree size={18} />
                                    Gerenciar Usuários
                                </button>
                            )}
                            <button className={styles.userMenuItem} onClick={() => { setShowUserMenu(false); logout(); }}>
                                <SignOut size={18} />
                                Sair
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
            <AdminUsers isOpen={isUsersOpen} onClose={() => setIsUsersOpen(false)} />
        </header>
    )
}
