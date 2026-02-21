function djb2Hash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function getDeviceFingerprint(): Promise<string> {
    const parts: string[] = [];
    parts.push(String(screen.width), String(screen.height), String(screen.colorDepth));
    parts.push(navigator.language, navigator.platform || '');
    parts.push(String(navigator.hardwareConcurrency || 0));
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('fingerprint', 2, 2);
            parts.push(canvas.toDataURL());
        }
    } catch { /* ignore */ }

    return djb2Hash(parts.join('|'));
}
