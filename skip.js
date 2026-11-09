// Перемотка. ⏩ пара часов / до вечера / до утра / до завтра / три дня / неделя / до даты.
// Life сама прокручивает, что знает: тело (что заживёт, что останется), срок из Зёрнышка, календарь за это время
// (приёмы, обещания, платежи — можно остановиться перед событием), чем заняты персонажи по повесткам.
// «Что было за это время» пишет дешёвая модель (можно поправить), а модель истории получает это одной заметкой
// и начинает уже с нового момента. Время и дата ставятся в отметку перемотки — Horae подхватит.

import { storyNow, pregOf, pregnancies } from './zr.js';
import { hurtAt } from './hurt.js';
import { eventsBetween, calMark, ymd, dayLabel, fromYmd, evLine } from './cal.js';
import { agendaOf } from './agenda.js';

let A = null;
export function initSkip(api) { A = api; }

const esc = (v) => A.esc(v);
const H = 36e5;
const pad = (n) => String(n).padStart(2, '0');
const WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
const plusDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export const TARGETS = [
    ['hours', 'Пара часов', 'clock', (d) => new Date(d.getTime() + 3 * H)],
    ['evening', 'До вечера', 'moon', (d) => (d.getHours() < 18 ? at(d, 19) : at(plusDays(d, 1), 19))],
    ['morning', 'До утра', 'sunrise', (d) => (d.getHours() < 5 ? at(d, 8) : at(plusDays(d, 1), 8))],
    ['day', 'До завтра', 'sun', (d) => plusDays(d, 1)],
    ['days3', 'Три дня', 'calendar', (d) => at(plusDays(d, 3), 10)],
    ['week', 'Неделя', 'calendar', (d) => at(plusDays(d, 7), 10)],
];

export function whenText(d) { return `${WDF[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
/** Сколько прошло — в винительном: «на 9 часов», «через сутки», «на неделю». До 20 часов — часами, дальше — по датам. */
export function spanText(ms, from = null, to = null) {
    const h = Math.round(ms / H);
    if (h < 1) return 'полчаса';
    if (h < 20) return h === 1 ? 'час' : `${h} ${A.plural(h, 'час', 'часа', 'часов')}`;
    let d = Math.max(1, Math.round(h / 24));
    if (from && to) { const a = new Date(from), b = new Date(to); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); d = Math.max(1, Math.round((b - a) / 864e5)); }
    if (d === 1) return 'сутки';
    if (d < 7) return `${d} ${A.plural(d, 'день', 'дня', 'дней')}`;
    const w = Math.floor(d / 7), r = d % 7;
    return `${w === 1 ? 'неделю' : `${w} ${A.plural(w, 'неделю', 'недели', 'недель')}`}${r ? ` и ${r} ${A.plural(r, 'день', 'дня', 'дней')}` : ''}`;
}

/** Дата в том же виде, как её пишет Horae в этом чате. */
export function storyDateLike(d, sample) {
    const s = String(sample || '');
    let m = s.match(/\d{4}([./-])\d{1,2}\1\d{1,2}/);
    if (m) return `${d.getFullYear()}${m[1]}${pad(d.getMonth() + 1)}${m[1]}${pad(d.getDate())}`;
    m = s.match(/\d{1,2}([./-])\d{1,2}\1\d{4}/);
    if (m) return `${pad(d.getDate())}${m[1]}${pad(d.getMonth() + 1)}${m[1]}${d.getFullYear()}`;
    if (/[а-яё]{3,}\s+\d{4}/i.test(s)) return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function cast() {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    add(A.ctx().name1);
    for (const n of A.groupMembers()) add(n);
    return out;
}

/** Что Life прокрутит сама: тело, срок, календарь, повестки. */
export function plan(fromT, toT) {
    const from = new Date(fromT), to = new Date(toT);
    const body = [];
    for (const n of cast()) {
        const f = hurtAt(n, toT);
        if (f.length) body.push({ who: n, list: f });
    }
    const preg = [];
    try {
        for (const p of pregnancies(fromT)) {
            const q = pregOf(p.mother, toT);
            if (q) preg.push({ who: p.mother, from: p.label, to: q.label, belly: q.belly.ru, changed: q.belly.ru !== p.belly.ru });
        }
    } catch { /* без Зёрнышка */ }
    let events = [];
    try {
        events = eventsBetween(ymd(from), ymd(to)).filter(e => e.st === 'open').filter(e => {
            const t = fromYmd(e.d).getTime() + (e.time ? (+e.time.slice(0, 2) * 60 + +e.time.slice(3, 5)) * 6e4 : 12 * H);
            return t > fromT && t <= toT;
        });
    } catch { /* */ }
    const agendas = [];
    for (const n of cast().slice(1)) {
        let a = null;
        try { a = agendaOf(n); } catch { /* */ }
        if (a && (a.now || a.next || a.want)) agendas.push({ who: n, now: a.now || '', next: a.next || '', want: a.want || '' });
    }
    return { from, to, span: spanText(toT - fromT, fromT, toT), body, preg, events, agendas };
}

// ───────────── что было за это время ─────────────

const SYSTEM = `Ты помогаешь рассказчику длинной литературной ролевой на русском. Время в истории перематывают вперёд.
Напиши, что было за пропущенное время — коротко, правдоподобно, по характерам, повесткам и планам персонажей, с учётом тела (раны заживают, срок идёт) и календаря.
Игрок — {user}: не решай за неё, не пиши её чувств, слов и поступков — о ней только нейтральный фон, если без него никак. Без реплик, без пафоса.
Ответь только JSON: {"summary":"3–6 предложений, что было","chars":{"Имя":"чем занят к концу перемотки, 5–15 слов"},"done":["id событий календаря, что за это время случились"],"start":"с какого момента начать новую сцену, 1 фраза"}`;

export async function writeGap(p) {
    const user = A.canonName(A.ctx().name1) || 'игрок';
    const st = A.worldState();
    let days = '';
    try { days = A.daysBrief?.() || ''; } catch { /* */ }
    const input = [
        `Перемотка: с ${whenText(p.from)} до ${whenText(p.to)} (на ${p.span}). Где были: ${st.scene?.location || '—'}; кто рядом: ${(st.scene?.characters_present || []).join(', ') || '—'}.`,
        days ? `Последние дни:\n${A.cut(days, 1600)}` : '',
        p.agendas.length ? `Повестки:\n${p.agendas.map(a => `- ${a.who}: сейчас — ${a.now || '—'}; дальше — ${a.next || '—'}; хочет — ${a.want || '—'}`).join('\n')}` : '',
        p.events.length ? `Календарь за это время:\n${p.events.map(e => `- ${e.own ? `[${e.id}] ` : ''}${dayLabel(fromYmd(e.d))} — ${evLine(e)}`).join('\n')}` : '',
        p.body.length ? `Тело к концу: ${p.body.map(b => `${b.who}: ${b.list.map(x => x.line).join('; ')}`).join(' | ')}` : '',
        p.preg.length ? `Срок: ${p.preg.map(x => `${x.who} — ${x.from} → ${x.to} (${x.belly})`).join('; ')}` : '',
    ].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: SYSTEM.replace('{user}', user) }, { role: 'user', content: input }], 900);
    const j = A.extractJson(out);
    if (!j) throw new Error('модель ответила не JSON');
    const chars = {};
    for (const [n, v] of Object.entries(j.chars || {})) if (typeof v === 'string' && v.trim() && !A.sameName(n, user)) chars[A.canonName(n)] = v.trim().slice(0, 160);
    return { summary: String(j.summary || '').trim().slice(0, 1400), chars, done: (Array.isArray(j.done) ? j.done : []).map(String), start: String(j.start || '').trim().slice(0, 200) };
}

/** Строка для модели истории: что прошло и с чего начать. */
export function gapNote(p, g = {}) {
    const bits = [`Перемотка времени на ${p.span} — теперь ${whenText(p.to)}.`];
    if (g.summary) bits.push(`За это время: ${g.summary}`);
    const heal = p.body.map(b => `${A.shortName(b.who)} — ${b.list.map(x => (x.healed ? `${x.t} — зажило` : x.line)).join('; ')}`);
    if (heal.length) bits.push(`Тело сейчас: ${heal.join('; ')}.`);
    if (p.preg.length) bits.push(p.preg.map(x => `${A.shortName(x.who)} — ${x.to} беременности (${x.belly}).`).join(' '));
    const ch = Object.entries(g.chars || {}).map(([n, v]) => `${A.shortName(n)} — ${v}`);
    if (ch.length) bits.push(`Где кто: ${ch.join('; ')}.`);
    if (g.start) bits.push(`Начни отсюда: ${g.start}`);
    bits.push('Не пересказывай пропущенное подробно — только штрихами, если к слову; пиши уже новый момент.');
    return bits.join(' ');
}

// ───────────── вид: Мир → Время ─────────────

const ui = { to: null, gap: null, busy: false };

export function skipHtml() {
    const now = storyNow();
    if (now == null) return `<div class="lf-hint">В истории ещё нет даты и времени — перемотка появится, когда Horae их запишет. Пока — простой скачок:</div>`;
    const d = new Date(now);
    return `<div class="lf-skip-grid">${TARGETS.map(([k, l, ic, fn]) => { const t = fn(d); return `<button class="lf-skip-b" data-act="sk-go" data-k="${k}">${A.icon(ic)}<b>${l}</b><small>${dayLabel(t)} ${pad(t.getHours())}:${pad(t.getMinutes())}</small></button>`; }).join('')}
        <label class="lf-skip-b date">${A.icon('calendar')}<b>До даты…</b><input type="date" data-in="sk-date" min="${ymd(d)}"></label>
    </div>
    <div class="lf-hint">⏩ Life прокрутит тело, срок, календарь и повестки и напишет «что было за это время» — модель начнёт уже с нового момента.</div>`;
}

function sheet() {
    const p = plan(storyNow(), ui.to);
    const g = ui.gap;
    const from = p.from, to = p.to;
    const evRow = (e) => `<div class="lf-skip-ev">${A.icon('calendar')}<span><b>${esc(dayLabel(fromYmd(e.d)))}${e.time ? ` ${esc(e.time)}` : ''}</b> — ${esc(evLine(e))}</span><button class="lf-btn ghost" data-act="sk-stop" data-d="${e.d}" data-time="${esc(e.time || '')}">остановиться перед</button></div>`;
    A.openSheet(`${A.icon('sunrise')} Перемотка`, `
        <div class="lf-skip-head"><span>${esc(whenText(from))}</span><b>→ ${esc(whenText(to))}</b><small>через ${esc(p.span)}</small></div>
        <div class="lf-field two"><div><label>День</label><input type="date" data-in="sk-d" value="${ymd(to)}" min="${ymd(from)}"></div><div><label>Время</label><input type="time" data-in="sk-t" value="${pad(to.getHours())}:${pad(to.getMinutes())}"></div></div>
        ${p.body.length ? `${A.sec('Тело к тому времени')}<div class="lf-list">${p.body.map(b => `<div class="lf-row">${A.icon('bandage')}<span><b>${esc(A.shortName(b.who))}</b>: ${b.list.map(x => `${x.healed ? '<s>' : ''}${esc(x.line)}${x.healed ? '</s> ✓' : ''}`).join('; ')}</span></div>`).join('')}</div>` : ''}
        ${p.preg.length ? `${A.sec('Срок')}<div class="lf-list">${p.preg.map(x => `<div class="lf-row">${A.icon('baby')}<span><b>${esc(A.shortName(x.who))}</b>: ${esc(x.from)} → ${esc(x.to)}${x.changed ? ` · ${esc(x.belly)}` : ''}</span></div>`).join('')}</div>` : ''}
        ${p.events.length ? `${A.sec('В календаре за это время', String(p.events.length))}<div class="lf-list">${p.events.map(evRow).join('')}</div>` : ''}
        ${A.sec('Что было за это время')}
        ${g ? `<textarea class="lf-skip-sum" data-in="sk-sum" rows="5">${esc(g.summary)}</textarea>
            ${Object.keys(g.chars || {}).length ? `<div class="lf-list">${Object.entries(g.chars).map(([n, v]) => `<div class="lf-row">${A.ava ? A.ava(n, 'sm') : ''}<span><b>${esc(A.shortName(n))}</b> — ${esc(v)}</span></div>`).join('')}</div>` : ''}
            <div class="lf-field"><label>Начать с</label><input type="text" data-in="sk-start" value="${esc(g.start || '')}"></div>`
            : `<div class="lf-hint">${p.agendas.length ? `По повесткам: ${p.agendas.map(a => `${esc(A.shortName(a.who))} — ${esc(a.now || a.next)}`).join('; ')}.` : 'Можно перемотать и без этого — модель получит время, тело и срок.'}</div>`}
        <div class="lf-actions">
            <button class="lf-btn" data-act="sk-gap">${A.icon('sparkles')} ${g ? 'Написать заново' : 'Что было за это время'}</button>
            <button class="lf-btn primary" data-act="sk-do">${A.icon('sunrise')} Перемотать</button>
        </div>
        <div class="lf-hint">Модель получит это одной заметкой и начнёт с нового момента; Horae подхватит дату и время из отметки перемотки.</div>`);
}

function readTarget(box) {
    const d = box?.querySelector('[data-in="sk-d"]')?.value;
    const t = box?.querySelector('[data-in="sk-t"]')?.value || '10:00';
    if (!d) return null;
    const x = fromYmd(d);
    const [h, m] = t.split(':').map(Number);
    x.setHours(h || 0, m || 0, 0, 0);
    return x.getTime();
}

export async function skipClick(act, el) {
    if (!act.startsWith('sk-')) return false;
    const box = el.closest('.lf-sheet');
    switch (act) {
        case 'sk-go': {
            const now = storyNow();
            const tg = TARGETS.find(x => x[0] === el.dataset.k);
            if (now == null || !tg) return true;
            ui.to = tg[3](new Date(now)).getTime();
            ui.gap = null;
            sheet();
            return true;
        }
        case 'sk-stop': {
            const d = fromYmd(el.dataset.d);
            const t = el.dataset.time;
            if (t) { d.setHours(+t.slice(0, 2), +t.slice(3, 5), 0, 0); d.setTime(d.getTime() - H); } else d.setHours(9, 0, 0, 0);
            if (d.getTime() <= storyNow()) { A.toast('info', 'Это уже почти сейчас'); return true; }
            ui.to = d.getTime();
            ui.gap = null;
            sheet();
            return true;
        }
        case 'sk-gap': {
            const t = readTarget(box);
            if (t && t > storyNow()) ui.to = t;
            if (ui.busy) return true;
            ui.busy = true;
            try { await A.withBusy(el, async () => { ui.gap = await writeGap(plan(storyNow(), ui.to)); }, 'Пишу…'); } finally { ui.busy = false; }
            sheet();
            return true;
        }
        case 'sk-do': {
            const t = readTarget(box) || ui.to;
            const now = storyNow();
            if (!t || now == null || t <= now) { A.toast('info', 'Время должно идти вперёд'); return true; }
            const p = plan(now, t);
            const g = ui.gap ? { ...ui.gap, summary: box?.querySelector('[data-in="sk-sum"]')?.value?.trim() ?? ui.gap.summary, start: box?.querySelector('[data-in="sk-start"]')?.value?.trim() ?? ui.gap.start } : {};
            const to = new Date(t);
            const sample = A.worldState().timestamp?.story_date || '';
            await A.insertMarker({ title: `⏩ ${WDF[to.getDay()][0].toUpperCase()}${WDF[to.getDay()].slice(1)}, ${to.getDate()} ${MON[to.getMonth()]}, ${pad(to.getHours())}:${pad(to.getMinutes())}`, note: gapNote(p, g), date: storyDateLike(to, sample), time: `${pad(to.getHours())}:${pad(to.getMinutes())}` });
            // повестки: чем заняты теперь; календарь: что за это время случилось
            for (const [n, v] of Object.entries(g.chars || {})) { try { const a = agendaOf(n); if (a) { a.now = v; a.upd = Date.now(); } } catch { /* */ } }
            if (g.done?.length) calMark(g.done, 'done');
            A.saveMeta();
            ui.gap = null;
            A.closeSheet();
            A.afterSkip?.();
            A.toast('success', `${esc(whenText(to))} — пиши пост или жми «продолжить»`, '⏩ Перемотано', { timeOut: 4000 });
            return true;
        }
    }
    return false;
}

export function skipInput(el) {
    if (el.dataset.in !== 'sk-date') return false;
    const now = storyNow();
    if (!el.value || now == null) return true;
    const d = fromYmd(el.value);
    d.setHours(10, 0, 0, 0);
    if (d.getTime() <= now) { A.toast('info', 'Только вперёд'); return true; }
    ui.to = d.getTime();
    ui.gap = null;
    sheet();
    return true;
}
