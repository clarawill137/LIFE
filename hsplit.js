// Horae иногда склеивает несколько событий в одно: «…event:Important|… event:Normal|…».
// Здесь — разрезать обратно: каждое событие своей строкой, со своей важностью.

const GLUE = /(?:^|\s*[|;]?\s*)event\s*:\s*(important|normal|minor|critical|key|major|важное|обычное)\s*\|\s*/gi;

/** Текст события → [{ t, level }]; без склейки — одно. */
export function splitSummary(text, level = '') {
    const s = String(text || '');
    if (!/event\s*:\s*\w+\s*\|/i.test(s)) return s.trim() ? [{ t: s.trim(), level }] : [];
    const out = [];
    const re = new RegExp(GLUE.source, 'gi');
    let last = 0;
    let lv = level;
    let m;
    while ((m = re.exec(s))) {
        if (m.index > last) out.push({ t: s.slice(last, m.index), level: lv });
        lv = m[1].toLowerCase();
        last = re.lastIndex;
    }
    out.push({ t: s.slice(last), level: lv });
    return out.map(x => ({ t: x.t.replace(/^[\s|;,.]+|[\s|;,]+$/g, '').trim(), level: x.level })).filter(x => x.t.length > 2);
}

/** Событие Horae ({ messageIndex, eventIndex, timestamp, event }) → одно или несколько. */
export function splitEvent(e) {
    const parts = splitSummary(e?.event?.summary, e?.event?.level || '');
    if (parts.length <= 1) return parts.length ? [parts[0].t === e.event.summary ? e : { ...e, event: { ...e.event, summary: parts[0].t } }] : [];
    return parts.map((p, k) => ({ ...e, eventIndex: `${e.eventIndex ?? 0}.${k}`, event: { ...e.event, summary: p.t, level: p.level || e.event.level, is_important: /important|critical|key|major|важн/.test(p.level) || undefined } }));
}
