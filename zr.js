// Мост к Зёрнышку (беременность и малыш) — только чтение его данных в чате (chatMetadata.zernyshko).
// Срок по дате истории (как в самом Зёрнышке: от зачатия + 2 недели), живот по неделям, приёмы врача.

const DAY = 864e5;
let A = null;
export function initZr(api) { A = api; }

function Z() { try { return A.ctx().chatMetadata?.zernyshko || null; } catch { return null; } }

/** «Сейчас» в истории (мс): дата и время Horae. */
export function storyNow() {
    try {
        const st = A.worldState() || {};
        const d = A.parseDate(st.timestamp?.story_date);
        if (!d || isNaN(d)) return null;
        const tm = String(st.timestamp?.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
        d.setHours(tm ? +tm[1] : 12, tm ? +tm[2] : 0, 0, 0);
        return d.getTime();
    } catch { return null; }
}

const BELLY = [
    [12, 'живота ещё не видно', 'flat belly, no visible pregnancy yet'],
    [16, 'живот почти не виден — чуть округлился низ, под одеждой не заметно', 'barely-there lower-belly rounding, not visible under clothes'],
    [20, 'небольшой округлый живот, заметен в облегающем', 'small rounded baby bump, visible in fitted clothes (4 months pregnant)'],
    [24, 'заметный круглый живот', 'clearly visible round pregnancy belly (5 months pregnant)'],
    [28, 'круглый живот, его уже не спрятать', 'obvious round pregnant belly (6 months pregnant)'],
    [32, 'большой живот, меняется походка, тяжело наклоняться', 'large pregnant belly (7 months pregnant)'],
    [36, 'большой тяжёлый живот, одышка, отёки к вечеру', 'big heavy pregnant belly (8 months pregnant)'],
    [99, 'очень большой опустившийся живот — вот-вот рожать', 'very large low-hanging full-term pregnant belly (9 months pregnant)'],
];
export function bellyOf(w) { const b = BELLY.find(([to]) => w < to) || BELLY[BELLY.length - 1]; return { ru: b[1], en: b[2] }; }

function termAt(k, t) {
    if (!k?.conception || t == null) return null;
    const days = Math.floor((t - k.conception) / DAY);
    if (days < 0) return null;
    const ob = days + 14;
    const ow = Math.floor(ob / 7), od = ob % 7;
    return { ow, od, days, tri: ow < 14 ? 1 : ow < 28 ? 2 : 3, label: `${ow} нед${od ? ` ${od} дн` : ''}`, due: k.conception + 266 * DAY, belly: bellyOf(ow) };
}

/** Беременность героини (или любая, если имя не дано) на момент t (по умолчанию — сейчас в истории). */
export function pregOf(name = '', t = storyNow()) {
    const z = Z();
    if (!Array.isArray(z?.kids)) return null;
    const k = z.kids.find(x => x?.stage === 'preg' && x.conception && (!name || A.sameName(x.mother, name)));
    if (!k) return null;
    const tm = termAt(k, t);
    return tm ? { ...tm, kid: k, mother: k.mother } : null;
}

export function pregnancies(t = storyNow()) {
    const z = Z();
    if (!Array.isArray(z?.kids)) return [];
    return z.kids.filter(x => x?.stage === 'preg' && x.conception).map(k => { const tm = termAt(k, t); return tm ? { ...tm, kid: k, mother: k.mother } : null; }).filter(Boolean);
}

const visitEvery = (w) => (w < 28 ? 4 : w < 36 ? 2 : 1);

/** Следующие приёмы врача по Зёрнышку: [{ t, who, doc, text, guess }] (t — мс по истории или null). */
export function zrVisits(now = storyNow()) {
    const z = Z();
    if (!z) return [];
    const out = [];
    const docs = Array.isArray(z.docs) ? z.docs : [];
    const log = Array.isArray(z.medlog) ? z.medlog : [];
    for (const k of (Array.isArray(z.kids) ? z.kids : [])) {
        if (!k) continue;
        const d = docs.find(x => log.some(l => l.kidId === k.id && l.docId === x.id)) || docs[0] || null;
        const last = log.filter(l => l.kidId === k.id).slice(-1)[0] || null;
        const who = k.stage === 'preg' ? k.mother : (k.name || 'малыш');
        let t = null, guess = false;
        const said = String(last?.next || '').trim();
        if (said) { const p = A.parseDate(said); if (p && !isNaN(p)) t = p.getTime(); }
        if (t == null && k.stage === 'preg') {
            const tm = termAt(k, now);
            if (tm && now != null) { t = (last?.at || now) + visitEvery(tm.ow) * 7 * DAY; guess = true; }
        }
        out.push({ t, who, doc: d?.name || '', text: said || (k.stage === 'preg' ? 'плановый приём' : 'осмотр'), guess, kid: k.id });
    }
    return out;
}
