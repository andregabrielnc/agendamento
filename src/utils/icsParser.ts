export interface ParsedEvent {
    title: string;
    start: Date;
    end: Date;
    description?: string;
    allDay?: boolean;
}

export function parseICS(icsText: string): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    const vevents = icsText.split('BEGIN:VEVENT');

    for (let i = 1; i < vevents.length; i++) {
        const block = vevents[i].split('END:VEVENT')[0];
        // Unfold lines (RFC 5545: lines starting with space/tab are continuations)
        const unfolded = block.replace(/\r?\n[ \t]/g, '');

        const title = extractField(unfolded, 'SUMMARY') || '(Sem título)';
        const dtstart = extractField(unfolded, 'DTSTART');
        const dtend = extractField(unfolded, 'DTEND');
        const desc = extractField(unfolded, 'DESCRIPTION');

        if (dtstart) {
            const start = parseICSDate(dtstart);
            const end = dtend ? parseICSDate(dtend) : new Date(start.getTime() + 3600000);
            const allDay = dtstart.length === 8;

            events.push({
                title: unescapeICS(title),
                start,
                end,
                description: desc ? unescapeICS(desc).substring(0, 500) : undefined,
                allDay: allDay || undefined,
            });
        }
    }

    return events;
}

function extractField(block: string, fieldName: string): string | null {
    const regex = new RegExp(`^${fieldName}[;:](.*?)$`, 'm');
    const match = block.match(regex);
    if (!match) return null;

    let value = match[1];
    // If there are parameters (e.g. DTSTART;TZID=...:20240115T090000), take the part after the last colon
    const colonIdx = value.lastIndexOf(':');
    if (colonIdx !== -1) {
        value = value.substring(colonIdx + 1);
    }

    return value.trim();
}

function parseICSDate(dateStr: string): Date {
    const clean = dateStr.replace(/[^0-9TZ]/g, '');

    if (clean.length === 8) {
        // All-day: YYYYMMDD
        return new Date(
            parseInt(clean.substring(0, 4)),
            parseInt(clean.substring(4, 6)) - 1,
            parseInt(clean.substring(6, 8))
        );
    }

    // DateTime: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
    const y = parseInt(clean.substring(0, 4));
    const m = parseInt(clean.substring(4, 6)) - 1;
    const d = parseInt(clean.substring(6, 8));
    const h = parseInt(clean.substring(9, 11));
    const min = parseInt(clean.substring(11, 13));
    const s = parseInt(clean.substring(13, 15)) || 0;

    if (clean.endsWith('Z')) {
        return new Date(Date.UTC(y, m, d, h, min, s));
    }

    return new Date(y, m, d, h, min, s);
}

function unescapeICS(text: string): string {
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}
