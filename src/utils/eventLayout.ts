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

/**
 * Minimum effective duration (1 minute in ms) for zero-duration events.
 * Events with start === end are treated as having this duration so that
 * overlap detection works correctly.
 */
const MIN_DURATION_MS = 60_000;

/** Return an effective end time that is at least MIN_DURATION_MS after start. */
function effectiveEnd(event: LayoutEvent): number {
    const s = event.start.getTime();
    const e = event.end.getTime();
    return e > s ? e : s + MIN_DURATION_MS;
}

/** Check whether two events overlap (inclusive bounds handle zero-duration). */
function eventsOverlap(a: LayoutEvent, b: LayoutEvent): boolean {
    return a.start.getTime() <= effectiveEnd(b) - 1 && effectiveEnd(a) > b.start.getTime();
}

export function computeEventLayout(events: LayoutEvent[]): Map<string, EventLayout> {
    if (events.length === 0) return new Map();

    // 1. Sort by start time, then by duration descending (longer events first)
    //    O(n log n)
    const sorted = [...events].sort((a, b) => {
        const diff = a.start.getTime() - b.start.getTime();
        if (diff !== 0) return diff;
        return (effectiveEnd(b) - b.start.getTime()) - (effectiveEnd(a) - a.start.getTime());
    });

    // 2. Build clusters in a single pass using max-end tracking  O(n)
    //    Because events are sorted by start time, a new event can only
    //    belong to the current cluster if its start < cluster's max end.
    //    Once it doesn't overlap, we close the current cluster and start
    //    a new one. This replaces the previous O(n^4) merge loop.
    const clusters: LayoutEvent[][] = [];
    let clusterStart = 0;
    let clusterMaxEnd = effectiveEnd(sorted[0]);

    for (let i = 1; i < sorted.length; i++) {
        const ev = sorted[i];
        if (ev.start.getTime() < clusterMaxEnd) {
            // Overlaps with current cluster — extend max end
            const end = effectiveEnd(ev);
            if (end > clusterMaxEnd) clusterMaxEnd = end;
        } else {
            // No overlap — close current cluster, start a new one
            clusters.push(sorted.slice(clusterStart, i));
            clusterStart = i;
            clusterMaxEnd = effectiveEnd(ev);
        }
    }
    // Push the last cluster
    clusters.push(sorted.slice(clusterStart));

    // 3. Within each cluster assign columns and compute layout
    const layoutMap = new Map<string, EventLayout>();

    for (const cluster of clusters) {
        // Cluster is already sorted from the global sort above.

        // Greedy column assignment — for each event, place it in the
        // first column where it doesn't overlap any existing event.
        // Track per-column end times for fast non-overlap checks.
        const columnEnds: number[] = [];           // max effective-end per column
        const columns: LayoutEvent[][] = [];

        for (const event of cluster) {
            const evStart = event.start.getTime();
            let placed = false;

            for (let col = 0; col < columns.length; col++) {
                // Fast check: if the column's latest end is at or before
                // this event's start, the event fits without scanning all
                // events in the column.
                if (columnEnds[col] <= evStart) {
                    columns[col].push(event);
                    const end = effectiveEnd(event);
                    if (end > columnEnds[col]) columnEnds[col] = end;
                    layoutMap.set(event.id, { column: col, totalColumns: 0, span: 1 });
                    placed = true;
                    break;
                }

                // Slower path: column end extends past event start, but
                // there may still be a gap.  Check all events in column.
                const fits = columns[col].every(
                    e => !eventsOverlap(event, e)
                );
                if (fits) {
                    columns[col].push(event);
                    const end = effectiveEnd(event);
                    if (end > columnEnds[col]) columnEnds[col] = end;
                    layoutMap.set(event.id, { column: col, totalColumns: 0, span: 1 });
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                columns.push([event]);
                columnEnds.push(effectiveEnd(event));
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
                    e => eventsOverlap(event, e)
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
const OVERLAP_PX = 12;

export function getEventColumnStyle(layout: EventLayout | undefined): { left: string; width: string; zIndex: number } {
    if (!layout || layout.totalColumns <= 1) {
        return { left: '1px', width: 'calc(100% - 2px)', zIndex: 1 };
    }

    const { column, totalColumns, span } = layout;
    const colPct = 100 / totalColumns;
    const leftPct = column * colPct;
    const widthPct = span * colPct;

    // Higher columns render on top (shorter/later events in front,
    // longer background events behind) — like Google Calendar.
    const zIndex = column + 1;

    // Column 0: flush to left edge
    if (column === 0) {
        return {
            left: '1px',
            width: `calc(${widthPct}% - 2px)`,
            zIndex,
        };
    }

    // Columns > 0: shift left by OVERLAP_PX for the layered-card effect
    return {
        left: `calc(${leftPct}% - ${OVERLAP_PX}px)`,
        width: `calc(${widthPct}% + ${OVERLAP_PX}px - 2px)`,
        zIndex,
    };
}
