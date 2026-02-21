import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CalendarEvent } from '../types';

interface ModalState {
    isOpen: boolean;
    type: 'create' | 'edit' | null;
    selectedDate?: Date;
    event?: CalendarEvent;
    instanceDate?: Date;
}

interface PopoverState {
    isOpen: boolean;
    event: CalendarEvent | null;
    anchorEl: HTMLElement | null;
}

interface ModalContextType {
    modalState: ModalState;
    popoverState: PopoverState;
    openCreateModal: (date?: Date) => void;
    openEditModal: (event: CalendarEvent, instanceDate?: Date) => void;
    closeModal: () => void;
    openPopover: (event: CalendarEvent, anchorEl: HTMLElement) => void;
    closePopover: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

const INITIAL_MODAL_STATE: ModalState = { isOpen: false, type: null };
const INITIAL_POPOVER_STATE: PopoverState = { isOpen: false, event: null, anchorEl: null };

export function ModalProvider({ children }: { children: ReactNode }) {
    const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);
    const [popoverState, setPopoverState] = useState<PopoverState>(INITIAL_POPOVER_STATE);

    const closePopover = useCallback(() => {
        setPopoverState(INITIAL_POPOVER_STATE);
    }, []);

    const closeModal = useCallback(() => {
        setModalState(INITIAL_MODAL_STATE);
    }, []);

    const openCreateModal = useCallback((date?: Date) => {
        setPopoverState(INITIAL_POPOVER_STATE);
        setModalState({
            isOpen: true,
            type: 'create',
            selectedDate: date ?? new Date(),
        });
    }, []);

    const openEditModal = useCallback((event: CalendarEvent, instanceDate?: Date) => {
        setPopoverState(INITIAL_POPOVER_STATE);
        setModalState({
            isOpen: true,
            type: 'edit',
            event,
            instanceDate,
        });
    }, []);

    const openPopover = useCallback((event: CalendarEvent, anchorEl: HTMLElement) => {
        setPopoverState({ isOpen: true, event, anchorEl });
    }, []);

    const value = useMemo<ModalContextType>(() => ({
        modalState,
        popoverState,
        openCreateModal,
        openEditModal,
        closeModal,
        openPopover,
        closePopover,
    }), [modalState, popoverState, openCreateModal, openEditModal, closeModal, openPopover, closePopover]);

    return (
        <ModalContext.Provider value={value}>
            {children}
        </ModalContext.Provider>
    );
}

export function useModal(): ModalContextType {
    const context = useContext(ModalContext);
    if (context === undefined) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
}
