// Календарь истории. Всё с датой в одном месте: обещания и планы из постов (Летописец), приёмы врача
// (Зёрнышко), платежи (банк Телефона), планы Horae, годовщины и дни рождения, своё руками.
// Модель знает, что сегодня, что завтра и что на неделе — и что обещали, но не сделали.

import { storyNow, zrVisits } from './zr.js';
import { moneyView } from './money.js';

let A = null;
export function initCal(api) { A = api; }

const esc = (v) => A.esc(v);
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON1 = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MON_RE = [/^янв/, /^фев/, /^мар/, /^апр/, /^ма[йя]/, /^июн/, /^июл/, /^авг/, /^сен/, /^окт/, /^ноя/, /^дек/];
export const dm = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
export const dayLabel = (d) => `${WD[d.getDay()]} ${dm(d)}`;

export const KINDS = {
    promise: ['Обещание', 'handshake'],
    plan: ['План', 'calendar'],
    appointment: ['Приём', 'hospital'],
    anniversary: ['Годовщина', 'rings'],
    birthday: ['День рождения', 'gift'],
    deadline: ['Срок', 'clock'],
    bill: ['Платёж', 'wallet'],
};
const YEARLY = ['anniversary', 'birthday'];

function cfg() {
    const s = A.settings();
    if (!s.cal || typeof s.cal !== 'object') s.cal = {};
    const c = s.cal;
    if (c.on === undefined) c.on = true;
    if (c.posts === undefined) c.posts = true;
    return c;
}
export const calOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.cal || typeof cm.cal !== 'object') cm.cal = {};
    const c = cm.cal;
    if (!Array.isArray(c.list)) c.list = [];
    if (!Number.isFinite(c.seq)) c.seq = 0;
    return c;
}

/** Сегодня в истории (Date, полночь) или null. */
export function today() { const t = storyNow(); if (t == null) return null; const d = new Date(t); d.setHours(0, 0, 0, 0); return d; }

// ───────────── «завтра», «в пятницу», «24 декабря» → дата ─────────────

const NUM = { 'один': 1, 'одну': 1, 'два': 2, 'две': 2, 'пару': 2, 'пара': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'несколько': 3 };
const WD_RE = [/воскресень/, /понедельник/, /вторник/, /сред[уаы]/, /четверг/, /пятниц/, /суббот/];

export function parseWhen(when, base) {
    const w = A.norm(when);
    if (!w || !base) return null;
    const b = new Date(base); b.setHours(0, 0, 0, 0);
    if (/послезавтра/.test(w)) return addDays(b, 2);
    if (/завтра/.test(w)) return addDays(b, 1);
    if (/сегодня|сейчас|этой ночью/.test(w)) return b;
    let m = w.match(/через\s+(\d+|[а-я]+)?\s*(дн|день|дня|недел|месяц|час)/);
    if (m) {
        const n = m[1] ? (/^\d+$/.test(m[1]) ? +m[1] : NUM[m[1]] || 1) : 1;
        if (/час/.test(m[2])) return b;
        if (/недел/.test(m[2])) return addDays(b, 7 * n);
        if (/месяц/.test(m[2])) { const x = new Date(b); x.setMonth(x.getMonth() + n); return x; }
        return addDays(b, n);
    }
    if (/на\s+(эт[иоу][хм]?\s+)?выходн|в\s+(эти\s+)?выходные/.test(w)) { const k = (6 - b.getDay() + 7) % 7; return addDays(b, k); }
    if (/на следующей неделе/.test(w)) return addDays(b, 7);
    m = w.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) return nextOf(+m[1], +m[2] - 1, m[3] ? +(m[3].length === 2 ? `20${m[3]}` : m[3]) : null, b);
    m = w.match(/(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?/);
    if (m) { const mi = MON_RE.findIndex(re => re.test(m[2])); if (mi >= 0) return nextOf(+m[1], mi, m[3] ? +m[3] : null, b); }
    const wi = WD_RE.findIndex(re => re.test(w));
    if (wi >= 0) {
        let k = (wi - b.getDay() + 7) % 7;
        if (k === 0) k = 7;
        if (/следующ/.test(w) && k < 7) k += 7;
        return addDays(b, k);
    }
    if (/вечером|утром|днём|днем|ночью/.test(w)) return b;
    return null;
}
function nextOf(day, mon, year, b) {
    if (year) return new Date(year, mon, day);
    let d = new Date(b.getFullYear(), mon, day);
    if (d < b) d = new Date(b.getFullYear() + 1, mon, day);
    return d;
}

const HOURW = {
    'час': 1, 'два': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10, 'одиннадцать': 11, 'двенадцать': 12, 'полдень': 12, 'полночь': 0,
    'часу': 1, 'двум': 2, 'трем': 3, 'четырем': 4, 'пяти': 5, 'шести': 6, 'семи': 7, 'восьми': 8, 'девяти': 9, 'десяти': 10, 'одиннадцати': 11, 'двенадцати': 12, 'полудню': 12, 'полуночи': 0,
};
export function parseTime(when, fallback = '') {
    const w = A.norm(when);
    let m = w.match(/(\d{1,2})[:.](\d{2})/);
    let h = null, mi = 0;
    if (m) { h = +m[1]; mi = +m[2]; } else {
        m = w.match(/(?:^|\s)(?:в|к)\s+(\d{1,2}|[а-я]+)(?:\s+час[а-я]*)?\s*(утра|вечера|дня|ночи)?/);
        if (m) { const n = /^\d+$/.test(m[1]) ? +m[1] : HOURW[m[1]]; if (n != null) { h = n; if ((m[2] === 'вечера' || m[2] === 'дня') && h < 12) h += 12; if (m[2] === 'ночи' && h === 12) h = 0; } }
        else if (/в полдень/.test(w)) h = 12;
    }
    if (h != null && h < 24 && mi < 60) return `${pad(h)}:${pad(mi)}`;
    const f = String(fallback || '').match(/(\d{1,2})[:.](\d{2})/);
    return f ? `${pad(+f[1])}:${f[2]}` : '';
}

// ───────────── все события ─────────────

/** Дата поста i по Horae (последняя записанная на нём или раньше). */
function dateAt(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) {
        const h = chat[j]?.horae_meta?.timestamp;
        if (h?.story_date) { const d = A.parseDate(h.story_date); if (d && !isNaN(d)) { d.setHours(0, 0, 0, 0); return d; } }
    }
    return today();
}

function own(e) { return { key: `own:${e.id}`, id: e.id, d: e.d, time: e.time || '', title: e.t, who: e.who || [], kind: e.kind, src: e.src, st: e.st || 'open', mes: e.mes, own: true, yearly: !!e.yearly }; }

/** События между двумя днями (включительно), по дням. from/to — 'YYYY-MM-DD'. */
export function eventsBetween(from, to) {
    const a = fromYmd(from), b = fromYmd(to);
    const inRange = (d) => d >= from && d <= to;
    const out = [];
    for (const e of M().list) {
        if (!e || e.st === 'del') continue;
        if (e.yearly) {
            const [, mm, dd] = e.d.split('-');
            for (let y = a.getFullYear(); y <= b.getFullYear(); y++) {
                const d = `${y}-${mm}-${dd}`;
                if (inRange(d) && d >= e.d) out.push({ ...own(e), d, st: d === e.d ? (e.st || 'open') : 'open', years: y - +e.d.slice(0, 4) });
            }
        } else if (inRange(e.d)) out.push(own(e));
    }
    // приёмы из Зёрнышка
    try {
        for (const v of zrVisits()) {
            if (v.t == null) continue;
            const d = ymd(new Date(v.t));
            if (inRange(d)) out.push({ key: `zr:${v.kid}:${d}`, d, time: '', title: `${v.text === 'плановый приём' ? 'Приём' : v.text}${v.doc ? ` · ${v.doc}` : ''}`, who: [v.who], kind: 'appointment', src: 'zr', st: 'open', guess: v.guess });
        }
    } catch { /* без Зёрнышка */ }
    // платежи из банка Телефона: каждый месяц в свой день
    try {
        const mv = moneyView();
        const t0 = today();
        const curYm = t0 ? `${t0.getFullYear()}-${pad(t0.getMonth() + 1)}` : '';
        for (const x of [...(mv?.bills || []).map(r => ({ ...r, sumText: r.sum })), ...(mv?.loans || []).map(l => ({ ...l, sumText: l.monthly }))]) {
            if (!x.day) continue;
            for (let y = a.getFullYear(), mo = a.getMonth(); y < b.getFullYear() || (y === b.getFullYear() && mo <= b.getMonth()); mo++, y += mo > 11 ? 1 : 0, mo %= 12) {
                const dd = Math.min(x.day, new Date(y, mo + 1, 0).getDate());
                const d = `${y}-${pad(mo + 1)}-${pad(dd)}`;
                if (!inRange(d)) continue;
                const paid = `${y}-${pad(mo + 1)}` === curYm && x.state === 'paid';
                out.push({ key: `bill:${x.id}:${d}`, d, time: '', title: `${x.name} ${x.sumText || ''}`.trim(), who: [], kind: 'bill', src: 'bank', st: paid ? 'done' : 'open' });
            }
        }
    } catch { /* без банка */ }
    // планы Horae с датой
    try {
        for (const g of A.horaeAgenda?.() || []) {
            const p = g.date ? A.parseDate(g.date) : null;
            if (!p || isNaN(p)) continue;
            const d = ymd(p);
            if (inRange(d) && !out.some(x => x.d === d && flat(x.title) === flat(g.text))) out.push({ key: `horae:${d}:${A.hash(g.text)}`, d, time: '', title: g.text, who: [], kind: 'plan', src: 'horae', st: 'open', mes: g.messageIndex });
        }
    } catch { /* */ }
    return out.sort((x, y) => x.d.localeCompare(y.d) || String(x.time).localeCompare(String(y.time)));
}

const flat = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 2).slice(0, 4).join(' ');

/** Открытые свои события до сегодняшнего дня (обещали — не сделали), не старше n дней. */
function overdue(t0, n = 4) {
    const from = ymd(addDays(t0, -n)), to = ymd(addDays(t0, -1));
    return M().list.filter(e => e && !e.yearly && (e.st || 'open') === 'open' && e.d >= from && e.d <= to && ['promise', 'plan', 'deadline'].includes(e.kind)).map(own);
}

// ───────────── заметка модели ─────────────

function whenWord(d, t0) {
    const k = Math.round((fromYmd(d) - t0) / DAY);
    if (k === 0) return 'сегодня';
    if (k === 1) return `завтра (${dayLabel(fromYmd(d))})`;
    if (k === 2) return `послезавтра (${dayLabel(fromYmd(d))})`;
    return `${dayLabel(fromYmd(d))}${k > 7 ? ` (через ${k} дн)` : ''}`;
}
function evLine(e) {
    const who = (e.who || []).filter(Boolean).map(n => A.shortName(A.canonName(n)));
    const label = e.kind === 'bill' ? `платёж — ${e.title}` : e.kind === 'anniversary' ? `${e.title}${e.years ? ` (${e.years}-я)` : ''}` : e.title;
    return `${label}${e.time ? `, ${e.time}` : ''}${who.length ? ` — ${who.join(', ')}` : ''}${e.guess ? ' (примерно)' : ''}`;
}

export function calPrompt(type) {
    if (!A?.hasChat?.() || !calOn() || type === 'quiet' || type === 'impersonate') return '';
    const t0 = today();
    if (!t0) return '';
    const near = eventsBetween(ymd(t0), ymd(addDays(t0, 7))).filter(e => e.st === 'open');
    const far = eventsBetween(ymd(addDays(t0, 8)), ymd(addDays(t0, 16))).filter(e => e.st === 'open' && YEARLY.includes(e.kind));
    const late = overdue(t0);
    if (!near.length && !far.length && !late.length) return '';
    const byDay = new Map();
    for (const e of [...near, ...far].slice(0, 12)) { if (!byDay.has(e.d)) byDay.set(e.d, []); byDay.get(e.d).push(evLine(e)); }
    const parts = [...byDay.entries()].map(([d, l]) => `${whenWord(d, t0)} — ${l.join('; ')}`);
    if (late.length) parts.push(`обещано и не сделано: ${late.slice(0, 4).map(e => `${evLine(e)} (${dayLabel(fromYmd(e.d))})`).join('; ')}`);
    return `[Календарь — сегодня ${WDF[t0.getDay()]}, ${t0.getDate()} ${MON[t0.getMonth()]}. ${parts.join('. ')}. Персонажи помнят свои планы, приёмы и обещания и живут по ним: готовятся заранее, не путают дни и время.]`;
}

// ───────────── Летописец ─────────────

const RULE = `
cal — новые договорённости и даты из ЭТОГО поста: [{"t":"что, 3–8 слов","when":"как сказано в посте: завтра / в пятницу / 24 декабря / через неделю / в 7 вечера","date":"ДД.ММ.ГГГГ — посчитай от «Сегодня»","time":"ЧЧ:ММ или пусто","who":["кто обещал, идёт или чей это день"],"kind":"promise|plan|appointment|anniversary|birthday|deadline"}]. Только конкретное, у чего есть день: обещания («в субботу свожу тебя на каток»), планы и встречи, приёмы у врача, дедлайны и сроки, дни рождения и годовщины. Без дня («как-нибудь», «потом») — не пиши. Уже есть в «Календаре» — не повторяй. Нечего — [].
calDone — id из «Календаря», что в этом посте случилось или отменилось: [{"id":"c3","how":"done|cancel"}]. Нечего — [].`;

export function calChron(i) {
    if (!A?.hasChat?.() || !calOn() || cfg().posts === false) return null;
    const t0 = Number.isFinite(i) ? dateAt(i) : today();
    if (!t0) return null;
    const open = M().list.filter(e => e && (e.st || 'open') === 'open' && !e.yearly && e.d >= ymd(addDays(t0, -4)) && e.d <= ymd(addDays(t0, 30))).slice(-14);
    return {
        key: '"cal": [], "calDone": []', rule: RULE, tokens: 180,
        input: `Сегодня (для cal): ${WDF[t0.getDay()]}, ${pad(t0.getDate())}.${pad(t0.getMonth() + 1)}.${t0.getFullYear()}\nКалендарь (открытое): ${open.length ? open.map(e => `[${e.id}] ${dayLabel(fromYmd(e.d))}${e.time ? ` ${e.time}` : ''} — ${e.t}`).join('; ') : 'пусто'}`,
    };
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function calAfterPost(i, j) {
    if (!calOn()) return;
    const c = M();
    // этот пост уже разбирали (свайп, перечитать) — откатить его прошлые записи
    c.list = c.list.filter(e => !(e.src === 'post' && e.mes === i));
    for (const e of c.list) if (e.doneMes === i) { e.st = 'open'; delete e.doneMes; }
    const base = dateAt(i);
    const added = [];
    for (const r of (Array.isArray(j?.cal) ? j.cal : []).slice(0, 4)) {
        const t = str(r?.t).slice(0, 80);
        if (!t || !base) continue;
        let d = parseWhen(str(r.when), base);
        if (!d) { const p = A.parseDate(str(r.date)); if (p && !isNaN(p)) d = p; }
        if (!d) continue;
        const kind = KINDS[str(r.kind)] && str(r.kind) !== 'bill' ? str(r.kind) : 'plan';
        const dd = ymd(d);
        if (c.list.some(e => e.d === dd && flat(e.t) === flat(t))) continue;
        const e = { id: `c${++c.seq}`, t, d: dd, time: parseTime(str(r.when), str(r.time)), who: (Array.isArray(r.who) ? r.who : []).map(str).filter(Boolean).slice(0, 4), kind, src: 'post', mes: i, st: 'open', yearly: YEARLY.includes(kind), at: Date.now() };
        c.list.push(e);
        added.push(e);
    }
    for (const r of Array.isArray(j?.calDone) ? j.calDone : []) {
        const e = c.list.find(x => x.id === str(r?.id));
        if (e && (e.st || 'open') === 'open') { e.st = str(r.how) === 'cancel' ? 'cancel' : 'done'; e.doneMes = i; }
    }
    if (c.list.length > 300) c.list.splice(0, c.list.length - 300);
    A.saveMeta();
    if (added.length) A.toast('info', added.map(e => `${esc(dayLabel(fromYmd(e.d)))}${e.time ? ` ${e.time}` : ''} — ${esc(e.t)}`).join('<br>'), '📅 В календарь', { timeOut: 3500, escapeHtml: false });
}

/** Отметить события (перемотка): done/cancel. */
export function calMark(ids, st = 'done') {
    const c = M();
    let n = 0;
    for (const id of ids || []) { const e = c.list.find(x => x.id === id); if (e && (e.st || 'open') === 'open') { e.st = st; n++; } }
    if (n) A.saveMeta();
    return n;
}

// ───────────── вид: Мир → Календарь ─────────────

const ui = { month: null, day: null };

export function calHtml() {
    if (!A?.hasChat?.()) return '';
    const t0 = today();
    if (!t0) return `<div class="lf-empty small">${A.icon('calendar', 'xl')}В истории ещё нет даты — календарь появится, когда Horae запишет первую.</div>`;
    if (!ui.month) ui.month = `${t0.getFullYear()}-${pad(t0.getMonth() + 1)}`;
    const [Y, Mo] = ui.month.split('-').map(Number);
    const first = new Date(Y, Mo - 1, 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    const end = addDays(new Date(Y, Mo, 0), 6 - ((new Date(Y, Mo, 0).getDay() + 6) % 7));
    const evs = eventsBetween(ymd(start), ymd(end));
    const byDay = new Map();
    for (const e of evs) { if (!byDay.has(e.d)) byDay.set(e.d, []); byDay.get(e.d).push(e); }
    const td = ymd(t0);
    const sel = ui.day || td;
    const cells = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
        const k = ymd(d);
        const list = byDay.get(k) || [];
        cells.push(`<button class="lf-cal-c${d.getMonth() !== Mo - 1 ? ' out' : ''}${k === td ? ' today' : ''}${k === sel ? ' sel' : ''}${k < td ? ' past' : ''}" data-act="cal-d" data-d="${k}"><span>${d.getDate()}</span><i>${list.slice(0, 4).map(e => `<b class="k-${e.kind}${e.st !== 'open' ? ' off' : ''}"></b>`).join('')}</i></button>`);
    }
    const dayList = (byDay.get(sel) || eventsBetween(sel, sel));
    const soon = eventsBetween(td, ymd(addDays(t0, 14))).filter(e => e.st === 'open');
    const late = overdue(t0, 7);
    const row = (e) => {
        const [label, ic] = KINDS[e.kind] || KINDS.plan;
        const who = (e.who || []).filter(Boolean).map(n => A.shortName(A.canonName(n))).join(', ');
        return `<div class="lf-cal-ev k-${e.kind}${e.st !== 'open' ? ` st-${e.st}` : ''}">
            <span class="lf-cal-ic">${A.icon(ic)}</span>
            <span class="lf-cal-t"><b>${esc(e.title)}${e.years ? ` <small>${e.years}-я</small>` : ''}</b><small>${[e.d !== sel ? dayLabel(fromYmd(e.d)) : '', e.time, who, label, e.guess ? 'примерно' : '', e.src === 'post' && Number.isFinite(e.mes) ? `#${e.mes}` : ''].filter(Boolean).map(esc).join(' · ')}</small></span>
            ${e.own ? `<span class="lf-cal-b"><button data-act="cal-st" data-id="${e.id}" title="${e.st === 'open' ? 'сделано' : 'вернуть'}">${A.icon(e.st === 'open' ? 'check' : 'undo')}</button><button data-act="cal-del" data-id="${e.id}" title="убрать">${A.icon('x')}</button></span>` : ''}
        </div>`;
    };
    return `<div class="lf-cal">
        <div class="lf-cal-head">
            <button data-act="cal-m" data-v="-1">${A.icon('chevL')}</button>
            <b>${MON1[Mo - 1]} ${Y}</b>
            <button data-act="cal-m" data-v="1">${A.icon('chevR')}</button>
        </div>
        <div class="lf-cal-wd">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="lf-cal-grid">${cells.join('')}</div>
        <div class="lf-cal-legend">${Object.entries(KINDS).map(([k, [l]]) => `<span><b class="k-${k}"></b>${l}</span>`).join('')}</div>
    </div>
    ${A.sec(sel === td ? 'Сегодня' : dayLabel(fromYmd(sel)), dayList.length ? String(dayList.length) : '')}
    <div class="lf-cal-list">${dayList.length ? dayList.map(row).join('') : '<div class="lf-empty small">Ничего не записано.</div>'}</div>
    <div class="lf-actions"><button class="lf-btn" data-act="cal-add" data-d="${sel}">${A.icon('plus')} Событие</button>${sel !== td ? `<button class="lf-btn ghost" data-act="cal-today">К сегодня</button>` : ''}</div>
    ${late.length ? `${A.sec('Обещано — не сделано')}<div class="lf-cal-list">${late.map(row).join('')}</div>` : ''}
    ${A.sec('Ближайшие две недели', soon.length ? String(soon.length) : '')}
    <div class="lf-cal-list">${soon.length ? soon.map(row).join('') : '<div class="lf-empty small">Пусто. Обещания и планы из постов Летописец запишет сам.</div>'}</div>
    <label class="lf-switch"><input type="checkbox" data-act="cal-posts" ${cfg().posts !== false ? 'checked' : ''}><span></span>Летописец записывает даты из постов</label>
    <label class="lf-switch"><input type="checkbox" data-act="cal-on" ${calOn() ? 'checked' : ''}><span></span>Модель знает календарь (сегодня и неделя вперёд)</label>`;
}

export async function calClick(act, el) {
    if (!act.startsWith('cal-')) return false;
    const c = M();
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'cal-m': {
            const [y, m] = (ui.month || ymd(today() || new Date()).slice(0, 7)).split('-').map(Number);
            const d = new Date(y, m - 1 + Number(el.dataset.v), 1);
            ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
            ui.day = null;
            A.render();
            return true;
        }
        case 'cal-d': ui.day = el.dataset.d; A.render(); return true;
        case 'cal-today': ui.day = null; ui.month = null; A.render(); return true;
        case 'cal-on': cfg().on = !!el.checked; A.saveSettings(); A.updatePrompt(); return true;
        case 'cal-posts': cfg().posts = !!el.checked; A.saveSettings(); return true;
        case 'cal-st': { const e = c.list.find(x => x.id === el.dataset.id); if (e) { e.st = (e.st || 'open') === 'open' ? 'done' : 'open'; delete e.doneMes; } return done(); }
        case 'cal-del': { const k = c.list.findIndex(x => x.id === el.dataset.id); if (k >= 0) c.list.splice(k, 1); return done(); }
        case 'cal-add': {
            const names = A.groupMembers().map(A.canonName);
            const me = A.canonName(A.ctx().name1);
            if (me && !names.some(n => A.sameName(n, me))) names.unshift(me);
            A.openSheet(`${A.icon('calendar')} Событие`, `
                <div class="lf-field"><label>Что</label><input type="text" data-in="cal-t" placeholder="ужин у Старков, годовщина, приём у Васкез"></div>
                <div class="lf-field two"><div><label>День</label><input type="date" data-in="cal-d" value="${esc(el.dataset.d || ymd(today() || new Date()))}"></div><div><label>Время</label><input type="time" data-in="cal-time"></div></div>
                <div class="lf-field"><label>Что это</label><select data-in="cal-k">${Object.entries(KINDS).filter(([k]) => k !== 'bill').map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                <div class="lf-field"><label>Кто</label><div class="lf-chips wrap">${names.map(n => `<label class="lf-chip"><input type="checkbox" data-in="cal-who" value="${esc(n)}"> ${esc(A.shortName(n))}</label>`).join('')}</div></div>
                <label class="lf-switch"><input type="checkbox" data-in="cal-y"><span></span>Каждый год</label>
                <button class="lf-btn primary full" data-act="cal-save">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'cal-save': {
            const box = el.closest('.lf-sheet') || document;
            const v = (k) => box.querySelector(`[data-in="${k}"]`)?.value?.trim() || '';
            const t = v('cal-t');
            const d = v('cal-d');
            if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(d)) { A.toast('info', 'Нужно «что» и день'); return true; }
            const kind = v('cal-k') || 'plan';
            const who = [...box.querySelectorAll('[data-in="cal-who"]:checked')].map(x => x.value);
            c.list.push({ id: `c${++c.seq}`, t: t.slice(0, 80), d, time: v('cal-time'), who, kind, src: 'me', mes: null, st: 'open', yearly: !!box.querySelector('[data-in="cal-y"]')?.checked || YEARLY.includes(kind), at: Date.now() });
            ui.day = d;
            ui.month = d.slice(0, 7);
            A.closeSheet();
            return done();
        }
    }
    return false;
}

/** Для «Ранее…» и перемотки: ближайшее открытое (n дней вперёд). */
export function calSoon(n = 7) {
    const t0 = today();
    if (!t0) return [];
    return eventsBetween(ymd(t0), ymd(addDays(t0, n))).filter(e => e.st === 'open');
}
export { evLine, whenWord };
