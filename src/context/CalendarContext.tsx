/**
 * CalendarContext - Barrel / convenience module
 *
 * Combines all focused contexts (Theme, View, Event, Modal) into a single
 * CalendarProvider wrapper and a backwards-compatible useCalendar() hook so
 * that existing components can continue to work without immediate refactoring.
 *
 * New code should prefer the individual hooks:
 *   useTheme()  - from ThemeContext
 *   useView()   - from ViewContext
 *   useEvents() - from EventContext
 *   useModal()  - from ModalContext
 */

import type { ReactNode } from 'react';
import type { CalendarEvent, Calendar, ViewType } from '../types';

import { ThemeProvider, useTheme } from './ThemeContext';
import { ViewProvider, useView } from './ViewContext';
import { EventProvider, useEvents } from './EventContext';
import { ModalProvider, useModal } from './ModalContext';

// Re-export individual providers and hooks so consumers can import from one place
export { ThemeProvider, useTheme } from './ThemeContext';
export { ViewProvider, useView } from './ViewContext';
export { EventProvider, useEvents } from './EventContext';
export { ModalProvider, useModal } from './ModalContext';

/**
 * Combined interface that matches the original CalendarContextType for
 * backwards compatibility with existing components.
 */
interface CalendarContextType {
    // Theme
    theme: 'light' | 'dark';
    toggleTheme: () => void;

    // View
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    view: ViewType;
    setView: (view: ViewType) => void;
    selectedDate: Date | null;
    selectDate: (date: Date) => void;
    sidebarOpen: boolean;
    toggleSidebar: () => void;

    // Events / Calendars
    events: CalendarEvent[];
    calendars: Calendar[];
    addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<{ success: boolean; error?: string }>;
    updateEvent: (event: CalendarEvent) => Promise<{ success: boolean; error?: string }>;
    deleteEvent: (id: string) => Promise<{ success: boolean; error?: string }>;
    addCalendar: (calendar: Omit<Calendar, 'id'>) => Promise<{ success: boolean; error?: string }>;
    updateCalendar: (calendar: Calendar) => Promise<{ success: boolean; error?: string }>;
    deleteCalendar: (id: string) => Promise<{ success: boolean; error?: string }>;
    toggleCalendar: (id: string) => Promise<{ success: boolean; error?: string }>;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filteredEvents: CalendarEvent[];

    // Modal / Popover
    modalState: {
        isOpen: boolean;
        type: 'create' | 'edit' | null;
        selectedDate?: Date;
        event?: CalendarEvent;
    };
    popoverState: {
        isOpen: boolean;
        event: CalendarEvent | null;
        anchorEl: HTMLElement | null;
    };
    openCreateModal: (date?: Date) => void;
    openEditModal: (event: CalendarEvent) => void;
    closeModal: () => void;
    openPopover: (event: CalendarEvent, anchorEl: HTMLElement) => void;
    closePopover: () => void;
}

/**
 * CalendarProvider wraps all focused providers in the correct nesting order.
 * Theme is outermost (no dependencies), then View, Event, and Modal.
 */
export function CalendarProvider({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <ViewProvider>
                <EventProvider>
                    <ModalProvider>
                        {children}
                    </ModalProvider>
                </EventProvider>
            </ViewProvider>
        </ThemeProvider>
    );
}

/**
 * useCalendar() - Backwards-compatible hook that merges all context values.
 *
 * Existing components that call `const { view, events, openCreateModal } = useCalendar()`
 * will continue to work as-is. Over time, components should migrate to the
 * individual hooks for better re-render isolation.
 */
export function useCalendar(): CalendarContextType {
    const themeCtx = useTheme();
    const viewCtx = useView();
    const eventCtx = useEvents();
    const modalCtx = useModal();

    return {
        // Theme
        theme: themeCtx.theme,
        toggleTheme: themeCtx.toggleTheme,

        // View
        currentDate: viewCtx.currentDate,
        setCurrentDate: viewCtx.setCurrentDate,
        view: viewCtx.view,
        setView: viewCtx.setView,
        selectedDate: viewCtx.selectedDate,
        selectDate: viewCtx.selectDate,
        sidebarOpen: viewCtx.sidebarOpen,
        toggleSidebar: viewCtx.toggleSidebar,

        // Events / Calendars
        events: eventCtx.events,
        calendars: eventCtx.calendars,
        addEvent: eventCtx.addEvent,
        updateEvent: eventCtx.updateEvent,
        deleteEvent: eventCtx.deleteEvent,
        addCalendar: eventCtx.addCalendar,
        updateCalendar: eventCtx.updateCalendar,
        deleteCalendar: eventCtx.deleteCalendar,
        toggleCalendar: eventCtx.toggleCalendar,
        searchQuery: eventCtx.searchQuery,
        setSearchQuery: eventCtx.setSearchQuery,
        filteredEvents: eventCtx.filteredEvents,

        // Modal / Popover
        modalState: modalCtx.modalState,
        popoverState: modalCtx.popoverState,
        openCreateModal: modalCtx.openCreateModal,
        openEditModal: modalCtx.openEditModal,
        closeModal: modalCtx.closeModal,
        openPopover: modalCtx.openPopover,
        closePopover: modalCtx.closePopover,
    };
}
