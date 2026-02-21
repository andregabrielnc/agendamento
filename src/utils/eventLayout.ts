/**
 * Computes side-by-side column layout for overlapping events,
 * replicating Google Calendar's overlap behavior:
 *
 * 1. Events are grouped into clusters of transitively overlapping events.
 * 2. Within each cluster, columns are assigned greedily (first-fit).
 * 3. Each event expands rightward into empty neighboring columns.
 * 4. Later columns slightly overlap earlier ones for the layered-card look.
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
    /** How many consecutive columns this event spans (expands right) */
    span: number;
}

export function computeEventLayout(events: LayoutEvent[]): Map<string, EventLayout> {
    if (events.length === 0) return new Map();

    // Sort by start time, then longer events first
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

        // Greedy column assignment
        const columns: LayoutEvent[][] = [];

        for (const event of cluster) {
            let placed = false;
            for (let col = 0; col < columns.length; col++) {
                const fits = columns[col].every(
                    e => event.start.getTime() >= e.end.getTime() || event.end.getTime() <= e.start.getTime()
                );
                if (fits) {
                    columns[col].push(event);
                    layoutMap.set(event.id, { column: col, totalColumns: 0, span: 1 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([event]);
                layoutMap.set(event.id, { column: columns.length - 1, totalColumns: 0, span: 1 });
            }
        }

        const totalCols = columns.length;

        // Compute rightward expansion (span) for each event
        for (const event of cluster) {
            const layout = layoutMap.get(event.id)!;
            layout.totalColumns = totalCols;

            let span = 1;
            for (let nextCol = layout.column + 1; nextCol < totalCols; nextCol++) {
                const blocked = columns[nextCol].some(
                    e => event.start.getTime() < e.end.getTime() && event.end.getTime() > e.start.getTime()
                );
                if (blocked) break;
                span++;
            }
            layout.span = span;
        }
    }

    return layoutMap;
}

/**
 * Returns inline style properties for an event based on its layout.
 * Replicates Google Calendar's visual style:
 * - Events expand right to fill available columns
 * - Columns > 0 overlap the previous column slightly (layered look)
 * - Visual separation comes from the event's left border (CSS)
 */
const OVERLAP_PX = 8;

export function getEventColumnStyle(layout: EventLayout | undefined): { left: string; width: string } {
    if (!layout || layout.totalColumns <= 1) {
        return { left: '1px', width: 'calc(100% - 2px)' };
    }

    const { column, totalColumns, span } = layout;
    const colPct = 100 / totalColumns;
    const leftPct = column * colPct;
    const widthPct = span * colPct;

    // Column 0: flush to left edge
    if (column === 0) {
        return {
            left: '1px',
            width: `calc(${widthPct}% - 2px)`,
        };
    }

    // Columns > 0: shift left by OVERLAP_PX for the layered-card effect
    return {
        left: `calc(${leftPct}% - ${OVERLAP_PX}px)`,
        width: `calc(${widthPct}% + ${OVERLAP_PX}px - 2px)`,
    };
}
