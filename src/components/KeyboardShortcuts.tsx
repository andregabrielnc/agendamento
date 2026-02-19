import { useCallback, useEffect, useState, type JSX } from 'react';
import { useCalendar } from '../context/CalendarContext';
import type { ViewType } from '../types';
import styles from './KeyboardShortcuts.module.css';

/** Tags whose focus should suppress keyboard shortcuts. */
const INTERACTIVE_TAGS = new Set<string>(['INPUT', 'TEXTAREA', 'SELECT']);

interface ShortcutEntry {
    key: string;
    description: string;
}

interface ShortcutSection {
    title: string;
    shortcuts: ShortcutEntry[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
    {
        title: 'Navigation',
        shortcuts: [
            { key: 'D', description: 'Day view' },
            { key: 'W', description: 'Week view' },
            { key: 'M', description: 'Month view' },
            { key: 'Y', description: 'Year view' },
            { key: 'A', description: 'Agenda view' },
            { key: 'T', description: 'Go to today' },
        ],
    },
    {
        title: 'Actions',
        shortcuts: [
            { key: 'C', description: 'Create new event' },
            { key: '/', description: 'Focus search' },
        ],
    },
    {
        title: 'General',
        shortcuts: [
            { key: '?', description: 'Show keyboard shortcuts' },
            { key: 'Esc', description: 'Close this dialog' },
        ],
    },
];

/**
 * Maps a single key press (case-insensitive) to a ViewType.
 * Returns undefined when the key does not correspond to a view change.
 */
const VIEW_KEY_MAP: Record<string, ViewType> = {
    d: 'day',
    w: 'week',
    m: 'month',
    y: 'year',
    a: 'agenda',
};

/* ---------- Help modal sub-component ---------- */

interface ShortcutsHelpProps {
    onClose: () => void;
}

function ShortcutsHelp({ onClose }: ShortcutsHelpProps): JSX.Element {
    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="presentation"
        >
            <div
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard shortcuts"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>Keyboard shortcuts</h2>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close"
                        type="button"
                    >
                        &#x2715;
                    </button>
                </div>

                {/* Body */}
                <div className={styles.body}>
                    {SHORTCUT_SECTIONS.map((section) => (
                        <div key={section.title} className={styles.section}>
                            <h3 className={styles.sectionTitle}>{section.title}</h3>
                            <div className={styles.shortcutList}>
                                {section.shortcuts.map((shortcut) => (
                                    <div key={shortcut.key} className={styles.shortcutRow}>
                                        <kbd className={styles.keyBadge}>{shortcut.key}</kbd>
                                        <span className={styles.shortcutDescription}>
                                            {shortcut.description}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <p className={styles.footerHint}>
                        Shortcuts are disabled when an input field is focused.
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ---------- Main component ---------- */

/**
 * KeyboardShortcuts registers global keydown listeners and optionally renders
 * a help modal that describes every available shortcut.
 *
 * Mount this component once near the root of the application tree (inside
 * CalendarProvider) so that shortcuts work on every page.
 */
export function KeyboardShortcuts(): JSX.Element | null {
    const { setView, openCreateModal, setCurrentDate } = useCalendar();
    const [helpOpen, setHelpOpen] = useState<boolean>(false);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent): void => {
            // Ignore when a modifier key is held (except Shift for "?").
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            // Ignore when focus is inside an interactive form element.
            const target = event.target as HTMLElement | null;
            if (target && INTERACTIVE_TAGS.has(target.tagName)) {
                return;
            }

            // Also ignore contentEditable elements.
            if (target?.isContentEditable) {
                return;
            }

            const key = event.key;

            // --- Escape: always close help modal ---
            if (key === 'Escape') {
                if (helpOpen) {
                    setHelpOpen(false);
                    event.preventDefault();
                }
                return;
            }

            // --- "?" (Shift + / on most keyboards) ---
            if (key === '?') {
                setHelpOpen((prev) => !prev);
                event.preventDefault();
                return;
            }

            // --- "/" : focus search ---
            if (key === '/') {
                const searchInput = document.querySelector<HTMLElement>(
                    '[data-search-input]',
                );
                if (searchInput) {
                    searchInput.focus();
                    event.preventDefault();
                }
                return;
            }

            const lowerKey = key.toLowerCase();

            // --- View shortcuts ---
            const viewType = VIEW_KEY_MAP[lowerKey];
            if (viewType !== undefined) {
                setView(viewType);
                event.preventDefault();
                return;
            }

            // --- "C" : create event ---
            if (lowerKey === 'c') {
                openCreateModal();
                event.preventDefault();
                return;
            }

            // --- "T" : go to today ---
            if (lowerKey === 't') {
                setCurrentDate(new Date());
                event.preventDefault();
                return;
            }
        },
        [helpOpen, openCreateModal, setCurrentDate, setView],
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    if (!helpOpen) {
        return null;
    }

    return <ShortcutsHelp onClose={() => setHelpOpen(false)} />;
}
