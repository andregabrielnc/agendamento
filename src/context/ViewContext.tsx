import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { startOfToday } from 'date-fns';
import type { ViewType } from '../types';

interface ViewContextType {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    view: ViewType;
    setView: (view: ViewType) => void;
    selectedDate: Date | null;
    selectDate: (date: Date) => void;
    sidebarOpen: boolean;
    toggleSidebar: () => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: ReactNode }) {
    const [currentDate, setCurrentDate] = useState<Date>(startOfToday);
    const [view, setView] = useState<ViewType>('month');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

    const selectDate = useCallback((date: Date) => {
        setSelectedDate(date);
        setCurrentDate(date);
    }, []);

    const toggleSidebar = useCallback(() => {
        setSidebarOpen(prev => !prev);
    }, []);

    const stableSetCurrentDate = useCallback((date: Date) => {
        setCurrentDate(date);
    }, []);

    const stableSetView = useCallback((v: ViewType) => {
        setView(v);
    }, []);

    const value = useMemo<ViewContextType>(() => ({
        currentDate,
        setCurrentDate: stableSetCurrentDate,
        view,
        setView: stableSetView,
        selectedDate,
        selectDate,
        sidebarOpen,
        toggleSidebar,
    }), [currentDate, stableSetCurrentDate, view, stableSetView, selectedDate, selectDate, sidebarOpen, toggleSidebar]);

    return (
        <ViewContext.Provider value={value}>
            {children}
        </ViewContext.Provider>
    );
}

export function useView(): ViewContextType {
    const context = useContext(ViewContext);
    if (context === undefined) {
        throw new Error('useView must be used within a ViewProvider');
    }
    return context;
}
