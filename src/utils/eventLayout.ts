/**
 * Computes side-by-side column layout for overlapping events,
 * similar to Google Calendar's overlap behavior.
 */

interface LayoutEvent {
    id: string;
    start: Date;
    end: Date;
}

export interface EventLayout {
    /** Column index (0-based) */
    column: number;
    /** Total columns in this overlap group */
    totalColumns: number;
}

/**
 * Given a list of events for a single day, returns a Map from event.id
 * to its column layout (column index + total columns in its group).
 *
 * Events that don't overlap get column=0, totalColumns=1 (full width).
 * Overlapping events are split into side-by-side columns.
 */
export function computeEventLayout(events: LayoutEvent[]): Map<string, EventLayout> {
    if (events.length === 0) return new Map();

    // Sort by start time, then longer events first (so they get placed in earlier columns)
    const sorted = [...events].sort((a, b) => {
        const diff = a.start.getTime() - b.start.getTime();
        if (diff !== 0) return diff;
        return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    });

    // Build clusters of transitively overlapping events
    const clusters: LayoutEvent[][] = [];

    for (const event of sorted) {
        let merged = false;
        for (const cluster of clusters) {
            const overlaps = cluster.some(
                e => event.start.getTime() < e.end.getTime() && event.end.getTime() > e.start.getTime()
            );
            if (overlaps) {
                cluster.push(event);
                merged = true;
                break;
            }
        }
        if (!merged) {
            clusters.push([event]);
        }
    }

    // Merge clusters that became connected via intermediate events
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const overlaps = clusters[i].some(a =>
                    clusters[j].some(
                        b => a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime()
                    )
                );
                if (overlaps) {
                    clusters[i].push(...clusters[j]);
                    clusters.splice(j, 1);
                    changed = true;
                    break;
                }
            }
            if (changed) break;
        }
    }

    const layoutMap = new Map<string, EventLayout>();

    for (const cluster of clusters) {
        // Re-sort within cluster
        cluster.sort((a, b) => {
            const diff = a.start.getTime() - b.start.getTime();
            if (diff !== 0) return diff;
            return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
        });

        // Greedy column assignment: place each event in the first column where it fits
        const columns: LayoutEvent[][] = [];

        for (const event of cluster) {
            let placed = false;
            for (let col = 0; col < columns.length; col++) {
                const fits = columns[col].every(
                    e => event.start.getTime() >= e.end.getTime() || event.end.getTime() <= e.start.getTime()
                );
                if (fits) {
                    columns[col].push(event);
                    layoutMap.set(event.id, { column: col, totalColumns: 0 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
                layoutMap.set(event.id, { column: columns.length - 1, totalColumns: 0 });
            }
        }

        const totalCols = columns.length;
        for (const event of cluster) {
            const layout = layoutMap.get(event.id)!;
            layout.totalColumns = totalCols;
        }
    }

    return layoutMap;
}

/**
 * Returns inline style properties (left, width) for an event based on its layout.
 * Adds 1px gaps between columns for visual separation.
 */
export function getEventColumnStyle(layout: EventLayout | undefined): { left: string; width: string } {
    if (!layout || layout.totalColumns <= 1) {
        return { left: '2px', width: 'calc(100% - 4px)' };
    }

    const { column, totalColumns } = layout;
    const pct = 100 / totalColumns;
    const leftPct = column * pct;
    const gap = 1; // px gap between events

    return {
        left: `calc(${leftPct}% + ${gap}px)`,
        width: `calc(${pct}% - ${gap * 2}px)`,
    };
}
