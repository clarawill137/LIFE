// Своё — шутки и ритуалы. Летописец замечает, что у пары (или компании) стало «их»: внутренние шутки, прозвища,
// кодовые фразы, ритуалы (кофе ей по утрам, греет руки, «спокойной ночи» по-русски), подколы и игры.
// Модель иногда получает 2–3 из них — живые отсылки к месту, по кругу, не каждый раз. Связи → Общее → «Своё».

let A = null;
export function initRitual(api) { A = api; }

const esc = (v) => A.esc(v);
export const KINDS = { joke: ['шутка', 'smile'], nickname: ['прозвище', 'heart'], phrase: ['фраза', 'message'], ritual: ['ритуал', 'coffee'] };

function cfg() {
    const s = A.settings();
    if (!s.ritual || typeof s.ritual !== 'object') s.ritual = {};
    if (s.ritual.on === undefined) s.ritual.on = true;
    return s.ritual;
}
export const ritualOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.ritual || typeof cm.ritual !== 'object') cm.ritual = {};
    const r = cm.ritual;
    if (!Array.isArray(r.list)) r.list = [];
    if (!Number.isFinite(r.seq)) r.seq = 0;
    return r;
}

const has = (x, n) => (x.who || []).some(w => A.sameName(w, n));
const flat = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
const similar = (a, b) => { const x = new Set(flat(a)), y = flat(b); return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= 0.6; };
const str = (v) => (typeof v === 'string' ? v.trim() : '');

const RULE = `
ritual — СВОЁ у пары или компании, что повторяется и стало «их»: внутренние шутки, прозвища, кодовые фразы, ритуалы и привычки вдвоём (кофе ей по утрам, греет её руки, «спокойной ночи» по-русски), подколы и игры: [{"id":"r2 — если уже есть в «Своём», иначе пусто","t":"что, 3–12 слов","who":["имена"],"kind":"joke|nickname|phrase|ritual","when":"когда бывает, 2–6 слов"}]. Новое — только если в посте это явно стало их (повтор, отсылка, «как всегда», прозвище в ходу); снова случилось — с id. Нечего — [].`;

export function ritualChron() {
    if (!A?.hasChat?.() || !ritualOn()) return null;
    const rows = M().list.filter(x => !x.off).slice(-14).map(x => `[${x.id}] ${(x.who || []).map(n => A.shortName(n)).join('/')} — ${x.t} (${KINDS[x.kind]?.[0] || ''})`);
    return { key: '"ritual": []', rule: RULE, tokens: 110, input: `Своё (у кого что): ${rows.length ? rows.join('; ') : 'пока ничего'}` };
}

export function ritualAfterPost(i, j) {
    if (!ritualOn()) return;
    const r = M();
    r.list = r.list.filter(x => !(x.src === 'post' && x.mes === i));
    for (const x of r.list) if (x.hits?.length && x.hits[x.hits.length - 1] === i) { x.hits.pop(); x.last = x.hits[x.hits.length - 1] ?? x.mes; }
    let changed = false;
    for (const it of (Array.isArray(j?.ritual) ? j.ritual : []).slice(0, 3)) {
        const t = str(it?.t).slice(0, 90);
        const who = (Array.isArray(it?.who) ? it.who : []).map(str).filter(Boolean).map(A.canonName).slice(0, 4);
        let x = r.list.find(y => y.id === str(it?.id)) || (t ? r.list.find(y => similar(y.t, t)) : null);
        if (x) { x.hits = [...(x.hits || []), i].slice(-20); x.last = i; changed = true; continue; }
        if (!t || who.length < 1) continue;
        r.list.push({ id: `r${++r.seq}`, t, who, kind: KINDS[str(it.kind)] ? str(it.kind) : 'ritual', when: str(it.when).slice(0, 50), mes: i, last: i, hits: [], src: 'post', at: Date.now() });
        changed = true;
    }
    if (r.list.length > 120) r.list.splice(0, r.list.length - 120);
    if (changed) A.saveMeta();
}

/** Модели — 2–3 штуки для тех, кто сейчас вместе, по кругу и не то, что звучало только что. */
export function ritualPrompt(type) {
    if (!A?.hasChat?.() || !ritualOn() || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    if (here.length < 2) return '';
    const L = A.chatArr().length;
    const pool = M().list.filter(x => !x.off && (x.who || []).length && x.who.every(n => here.some(h => A.sameName(h, n))) && (x.who.length > 1 || here.length > 1));
    if (!pool.length) return '';
    const turn = Math.floor((type === 'swipe' ? L - 1 : L) / 2);
    if (turn % 2) return ''; // не каждый ход — иначе модель начинает тыкать ими в каждый пост
    const fresh = pool.filter(x => (x.last ?? x.mes ?? 0) < L - 6);
    const src = (fresh.length ? fresh : pool);
    const pick = [];
    for (let k = 0; k < Math.min(3, src.length); k++) pick.push(src[(turn + k * 7) % src.length]);
    const uniq = [...new Set(pick)];
    return `[Своё у ${[...new Set(uniq.flatMap(x => x.who))].map(n => A.shortName(n)).join(' и ')} — живые отсылки, можно вплести к месту (не все сразу и не обязательно): ${uniq.map(x => `${x.t}${x.when ? ` (${x.when})` : ''}`).join('; ')}.]`;
}

// ───────────── вид: Связи → Общее ─────────────

export function ritualHtml(a, b) {
    if (!A?.hasChat?.() || !ritualOn()) return '';
    const list = M().list.filter(x => !x.off && has(x, a) && (!b || has(x, b)));
    const N = (n) => esc(n || '');
    return `${A.sec('Своё', list.length ? String(list.length) : '')}
    ${list.length ? `<div class="lf-rit">${list.slice().reverse().map(x => `<span class="lf-rit-c k-${x.kind}">${A.icon(KINDS[x.kind]?.[1] || 'sparkles')}<b>${esc(x.t)}</b>${x.when ? `<small>${esc(x.when)}</small>` : ''}${x.hits?.length ? `<i>×${x.hits.length + 1}</i>` : ''}<button data-act="rit-del" data-id="${x.id}">${A.icon('x')}</button></span>`).join('')}</div>`
        : '<div class="lf-hint">Внутренние шутки, прозвища и ритуалы появятся, когда Летописец заметит, что что-то стало «вашим».</div>'}
    <button class="lf-btn ghost full" data-act="rit-add" data-a="${N(a)}" data-b="${N(b)}">${A.icon('plus')} Своё</button>`;
}

export function ritualClick(act, el) {
    if (!act.startsWith('rit-')) return false;
    const r = M();
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'rit-del': { const x = r.list.find(y => y.id === el.dataset.id); if (x) x.off = true; return done(); }
        case 'rit-add': {
            A.openSheet(`${A.icon('heart')} Своё`, `
                <div class="lf-field"><label>Что</label><input type="text" data-in="rit-t" placeholder="«куколка»; кофе с корицей по утрам"></div>
                <div class="lf-field"><label>Что это</label><select data-in="rit-k">${Object.entries(KINDS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                <div class="lf-field"><label>Когда бывает</label><input type="text" data-in="rit-w" placeholder="по утрам; когда она злится"></div>
                <button class="lf-btn primary full" data-act="rit-save" data-a="${esc(el.dataset.a || '')}" data-b="${esc(el.dataset.b || '')}">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'rit-save': {
            const box = el.closest('.lf-sheet') || document;
            const t = box.querySelector('[data-in="rit-t"]')?.value?.trim();
            if (!t) return true;
            const who = [el.dataset.a, el.dataset.b].filter(Boolean).map(A.canonName);
            r.list.push({ id: `r${++r.seq}`, t: t.slice(0, 90), who, kind: box.querySelector('[data-in="rit-k"]')?.value || 'ritual', when: (box.querySelector('[data-in="rit-w"]')?.value || '').trim().slice(0, 50), mes: -1, last: -1, hits: [], src: 'me', at: Date.now() });
            A.closeSheet();
            return done();
        }
    }
    return false;
}

/** Что записал пост i: шутки и ритуалы из него. */
export function ritualRecs(i) {
    const r = M();
    return r.list.filter(x => x.mes === i && x.src === 'post').map(x => ({
        id: `rit:${x.id}`, g: 'Своё', icon: 'sparkles', t: `${x.t}${x.who?.length ? ` — ${x.who.map(n => A.shortName(n)).join(' и ')}` : ''}`,
        del: () => { r.list = r.list.filter(y => y !== x); },
    }));
}
