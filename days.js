// Последние дни. Horae даёт обрывки событий с датой; здесь из них — «день — дата — всё коротко».
// Закрытый день (дата сменилась) дешёвая модель сжимает в 2–4 предложения + что осталось открытым.
// Модель каждый ответ видит последние N дней и «сегодня, раньше в этот день» — чтобы не забывала недавнее.
// Вид — Мир → Дни: карточки по дням, правка руками, пересобрать.

import { splitSummary } from './hsplit.js';

let A = null;
export function initDays(api) { A = api; }

const esc = (v) => A.esc(v);
// скрытый от модели пост (/hide) — всё равно пост истории: у неё старые посты скрыты, а дни по ним нужны
const isPost = (m) => (A.isPost ? A.isPost(m) : !!m && (!m.is_system || (!m.extra?.type && !m.extra?.life)));
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const pad = (n) => String(n).padStart(2, '0');

function cfg() {
    const s = A.settings();
    if (!s.days || typeof s.days !== 'object') s.days = {};
    const c = s.days;
    if (c.on === undefined) c.on = true;
    if (![0, 3, 5, 7].includes(c.n)) c.n = 5;
    return c;
}
export const daysOn = () => cfg().on !== false && cfg().n > 0;

function M() {
    const cm = A.chatMeta();
    if (!cm.days || typeof cm.days !== 'object') cm.days = {};
    if (!cm.days.sum || typeof cm.days.sum !== 'object') cm.days.sum = {};
    return cm.days;
}

/** Ключ дня: ГГГГ-ММ-ДД, если дата читается; иначе как записал Horae. */
export function dayKey(date) {
    const d = A.parseDate(date);
    return d && !isNaN(d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : String(date || '').trim().toLowerCase();
}
const keyDate = (k) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

export function dayLabel(k, raw = '', withYear = false) {
    const d = keyDate(k);
    if (!d) return raw || k;
    return `${d.getDate()} ${MON[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

function gapWord(a, b) {
    const da = keyDate(a), db = keyDate(b);
    if (!da || !db) return '';
    const n = Math.round((db - da) / 864e5);
    if (n < 0) return 'назад во времени';
    if (n > 3650) return 'скачок во времени';
    if (n <= 1) return '';
    if (n < 7) return `прошло ${n} ${A.plural(n, 'день', 'дня', 'дней')}`;
    if (n < 60) { const w = Math.round(n / 7); return `прошло ${w} ${A.plural(w, 'неделя', 'недели', 'недель')}`; }
    const mo = Math.round(n / 30);
    return `прошло ${mo} ${A.plural(mo, 'месяц', 'месяца', 'месяцев')}`;
}

// ───────────── дни из чата ─────────────

let cache = { sig: '', days: [] };

/**
 * Дни по порядку: { key, raw, from, to, locs, frags:[{t,i,imp}], chips:[{t,i}], posts, flash:[{key,raw,from,to,frags}] }.
 * Флешбек (короткий заход назад во времени — вернулись в своё время не дальше чем через 8 постов) — часть дня,
 * где он случился, а не отдельный «день». Долгий заход назад (история ушла в другое время) — новая линия дней.
 */
export function collectDays() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const sig = `${A.ctx().chatId || A.ctx().groupId}|${chat.length}|${last?.swipe_id ?? ''}|${String(last?.mes || '').length}|${A.chatMeta().ver || 0}`;
    if (cache.sig === sig) return cache.days;
    // 1) дата у каждого поста (Horae пишет её не в каждом — тянется от прошлого)
    const keyAt = new Array(chat.length).fill('');
    const rawAt = new Array(chat.length).fill('');
    let date = '';
    for (let i = 0; i < chat.length; i++) {
        const meta = chat[i]?.horae_meta;
        if (meta?.timestamp?.story_date && !meta._skipHorae) date = meta.timestamp.story_date;
        keyAt[i] = date ? dayKey(date) : '';
        rawAt[i] = date;
    }
    // 2) флешбеки
    const flash = new Array(chat.length).fill(false);
    let maxD = null;
    for (let i = 0; i < chat.length; i++) {
        const d = keyDate(keyAt[i]);
        if (!d) continue;
        if (maxD && d < maxD) {
            let j = i;
            while (j < chat.length) { const x = keyDate(keyAt[j]); if (x && x >= maxD) break; j++; }
            if (j - i <= 8) { for (let k = i; k < j; k++) flash[k] = true; i = j - 1; continue; }
            maxD = d; // долгий заход — другая линия времени
            continue;
        }
        if (!maxD || d > maxD) maxD = d;
    }
    // 3) дни
    const byKey = new Map();
    const order = [];
    let host = null;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const k = keyAt[i];
        if (!k || !m) continue;
        const meta = m.horae_meta;
        if (flash[i] && host) {
            host.to = Math.max(host.to, i);
            if (!isPost(m)) continue;
            let fl = host.flash.find(f => f.key === k);
            if (!fl) { fl = { key: k, raw: rawAt[i], from: i, to: i, frags: [] }; host.flash.push(fl); }
            fl.to = i;
            for (const ev of meta?.events || []) for (const { t } of splitSummary(ev?.summary)) if (t && !fl.frags.includes(t)) fl.frags.push(t);
            continue;
        }
        let d = byKey.get(k);
        if (!d) { d = { key: k, raw: rawAt[i], from: i, to: i, locs: [], frags: [], chips: [], posts: 0, flash: [] }; byKey.set(k, d); order.push(d); }
        host = d;
        d.to = Math.max(d.to, i);
        if (!isPost(m)) continue;
        d.posts++;
        const loc = String(meta?.scene?.location || '').split(/[·,]/)[0].trim();
        if (loc && !d.locs.includes(loc)) d.locs.push(loc);
        for (const ev of meta?.events || []) {
            for (const p of splitSummary(ev?.summary, ev?.level || '')) {
                if (p.t && !d.frags.some(f => f.t === p.t)) d.frags.push({ t: p.t, i, imp: !!(ev?.is_important || /important|critical|key|major/.test(p.level || '')) });
            }
        }
        if (!m.is_user) { const c = A.chronOf(i)?.chips?.[0]; if (c) d.chips.push({ t: c, i }); }
    }
    // «сегодня» — день последнего поста своего времени
    if (host && order[order.length - 1] !== host) { order.splice(order.indexOf(host), 1); order.push(host); }
    cache = { sig, days: order };
    return order;
}

const todayOf = (days) => days[days.length - 1] || null;
/** Есть из чего собирать: посты, события трекера или плашки. */
const hasStuff = (d) => !!(d && (d.posts || d.frags.length || d.chips.length || d.flash?.length));
/** Итог-пустышка («не зафиксировано событий») — собран, когда дню не дали материала: считать несобранным. */
const hollow = (s) => !!s && !s.edited && (!String(s.text || '').trim() || (String(s.text).length < 220 && /не (было )?зафиксирован|нет (никаких |значимых |записанных )?событий|событий не (было|записано)|ничего (значимого |особенного )?не (происходило|произошло|случилось)|без (значимых )?событий/i.test(s.text)));

// ───────────── сжать день ─────────────

const SUM_SYSTEM = `Ты ведёшь хронику длинной литературной ролевой истории на русском. Тебе дают обрывки событий ОДНОГО игрового дня (из трекера и плашек после постов) — по порядку.
Напиши, что было за этот день: 2–4 коротких предложения, по порядку, конкретно — кто, что, где, чем кончилось. Главное и то, что ещё аукнется: решения, обещания, признания, ссоры и примирения, раны, подарки, новости, планы на потом. Без оценок, без украшений, без пересказа диалогов. Если в дне был флешбек или сон — так и скажи.
Ответь только JSON: {"text":"2–4 предложения","open":["что осталось открытым или обещано на потом, 3–8 слов"]} (open — 0–3 пункта).`;

function dayInput(d, upto = Infinity) {
    const frags = d.frags.filter(f => f.i <= upto).map(f => `${f.imp ? '★ ' : ''}${f.t}`);
    const chips = d.chips.filter(c => c.i <= upto).map(c => c.t);
    const chat = A.chatArr();
    let tail = '';
    for (let i = Math.min(d.to, upto); i >= d.from && !tail; i--) if (isPost(chat[i]) && !chat[i].is_user) tail = A.cut(A.plainText(chat[i].mes), 900);
    const fl = (d.flash || []).filter(f => f.from <= upto).map(f => `Флешбек (${dayLabel(f.key, f.raw, true)}): ${f.frags.join('; ') || 'без записанных событий'}`);
    return [`Дата: ${dayLabel(d.key, d.raw, true)}`, d.locs.length ? `Места: ${d.locs.join(', ')}` : '',
        frags.length ? `События (трекер):\n${A.cut(frags.join('\n'), 5000)}` : '', fl.length ? fl.join('\n') : '', chips.length ? `После постов:\n${A.cut(chips.join('\n'), 3000)}` : '',
        tail ? `Конец дня (последний пост, начало):\n${tail}` : ''].filter(Boolean).join('\n\n');
}

let busy = false;
const queue = [];

async function summarize(d, upto = Infinity) {
    const input = dayInput(d, upto);
    if (!/События \(трекер\)|После постов|Конец дня|Флешбек/.test(input)) throw new Error(`${dayLabel(d.key, d.raw, true)}: в этом дне нет ни постов, ни событий — собирать не из чего`);
    const out = await A.askModel([{ role: 'system', content: SUM_SYSTEM }, { role: 'user', content: input }], 900);
    const j = A.extractJson(out);
    const text = String(j?.text || '').trim();
    if (!text) throw new Error('Летописец не прислал итог дня');
    return { text: text.slice(0, 900), open: (Array.isArray(j?.open) ? j.open : []).map(x => String(x || '').trim().slice(0, 90)).filter(Boolean).slice(0, 3) };
}

/** Собрать итоги: закрытые дни без итога (последние n+2) и «сегодня», если день длинный. */
function wanted(all = false) {
    const days = collectDays();
    const sum = M().sum;
    const out = [];
    const closed = days.slice(0, -1);
    const pool = all ? closed : closed.slice(-(cfg().n + 2));
    for (const d of pool) {
        const s = sum[d.key];
        if (s?.edited || !hasStuff(d)) continue;
        if (!s || hollow(s) || (s.to !== d.to && !s.today)) out.push({ d, today: false });
        else if (s.today) out.push({ d, today: false }); // день закрылся — итог по всему дню
    }
    // пустышки, собранные, когда дню не дали материала (скрытые посты), — пересобрать, даже если день старый
    if (!all) for (const d of closed) if (!pool.includes(d) && hollow(sum[d.key]) && hasStuff(d)) out.push({ d, today: false });
    const t = todayOf(days);
    if (t && t.to - t.from >= 24 && hasStuff(t)) {
        const s = sum[t.key];
        const upto = t.to - 12; // последние посты модель и так видит целиком
        if (!s || (s.today && upto - (s.to ?? 0) >= 14)) out.push({ d: t, today: true, upto });
    }
    return out;
}

let last = { err: '', want: 0, busy: false };
/** Что было в последний прогон: { err, want, busy } — для честного тоста. */
export const daysLast = () => last;

export async function runDays({ all = false, onStep } = {}) {
    if (busy || !A.hasChat()) { last = { err: busy ? 'уже собираю — дождись' : '', want: 0, busy }; return 0; }
    busy = true;
    let n = 0;
    last = { err: '', want: 0, busy: false };
    try {
        const cm = A.chatMeta();
        const list = wanted(all);
        last.want = list.length;
        for (const w of list) {
            await A.genIdle?.();
            if (A.chatMeta() !== cm) break;
            try {
                const r = await summarize(w.d, w.today ? w.upto : Infinity);
                M().sum[w.d.key] = { ...r, from: w.d.from, to: w.today ? w.upto : w.d.to, today: !!w.today, at: Date.now() };
                A.saveMeta();
                n++;
                onStep?.(n);
            } catch (e) { console.warn('[Life] дни', e); last.err = String(e?.message || e); break; }
        }
    } finally { busy = false; }
    if (n) { A.updatePrompt(); A.render?.(); }
    return n;
}

export function daysAfterPost() {
    if (!daysOn()) return;
    setTimeout(() => { runDays().catch(() => { }); }, 2500);
}

// ───────────── заметка модели ─────────────

const dot = (t) => (/[.!?…»)]$/.test(String(t).trim()) ? String(t).trim() : `${String(t).trim()}.`);

export function daysPrompt(type) {
    if (!A?.hasChat?.() || !daysOn() || type === 'quiet' || type === 'impersonate') return '';
    const days = collectDays();
    if (days.length < 1) return '';
    const sum = M().sum;
    const t = todayOf(days);
    const closed = days.slice(0, -1).slice(-cfg().n);
    const ty = t ? t.key.slice(0, 4) : '';
    const lines = [];
    let prev = null;
    for (const d of closed) {
        const s = sum[d.key];
        const gap = prev ? gapWord(prev.key, d.key) : '';
        if (gap) lines.push(`(${gap})`);
        const fb = (d.flash || []).map(f => `флешбек в ${dayLabel(f.key, f.raw, true)}${f.frags.length ? `: ${f.frags[0]}` : ''}`).join('; ');
        const body = s?.text && !s.today && !hollow(s) ? s.text : [d.frags.filter(f => f.imp).concat(d.frags.filter(f => !f.imp)).slice(0, 4).map(f => f.t).join('; '), fb ? `(${fb})` : ''].filter(Boolean).join(' ');
        if (body) lines.push(`• ${dayLabel(d.key, d.raw, d.key.slice(0, 4) !== ty)} — ${dot(body)}${s?.open?.length ? ` Открыто: ${s.open.join('; ')}.` : ''}`);
        prev = d;
    }
    if (t) {
        const gap = prev ? gapWord(prev.key, t.key) : '';
        if (gap) lines.push(`(${gap})`);
        const s = sum[t.key];
        if (s?.today && s.text) lines.push(`• Сегодня, ${dayLabel(t.key, t.raw)}, раньше в этот день — ${dot(s.text)}${s.open?.length ? ` Открыто: ${s.open.join('; ')}.` : ''}`);
        else if (closed.length) lines.push(`• Сегодня — ${dayLabel(t.key, t.raw)}.`);
    }
    if (!lines.some(l => l.startsWith('•'))) return '';
    return `[Последние дни — это уже было; помни, не противоречь и не пересказывай заново:\n${lines.join('\n')}]`;
}

/** Коротко для других модулей (сюжетка, идеи): последние дни без обёртки. */
export function daysBrief() {
    try { return daysPrompt('normal').replace(/^\[Последние дни[^\n]*\n/, '').replace(/\]$/, ''); } catch { return ''; }
}

// ───────────── дата не та ─────────────
// Horae иногда пишет не ту дату (ноябрь стал декабрём). Здесь её правят: в постах дня (или его части — с какого
// по какой пост) переписывается дата Horae в самих постах, посты после — остаются при своей. Таймеры Life,
// отмеченные этими постами (раны, потребности, приступы), сдвигаются на ту же разницу — чтобы не «из будущего».

const MON_RE = [/^янв/, /^фев/, /^мар/, /^апр/, /^ма[йя]/, /^июн/, /^июл/, /^авг/, /^сен/, /^окт/, /^ноя/, /^дек/];
const WD = [
    ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
    ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'],
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
];
const WD_ALT = { среду: 'среда', пятницу: 'пятница', субботу: 'суббота' };
export const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const likeCase = (src, w) => (src === src.toUpperCase() && src.length > 1 ? w.toUpperCase() : src[0] === src[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w);

/** Та же запись даты, что у Horae («2024/12/20», «20.12.2024», «20 декабря 2024»), — с новой датой и днём недели. */
export function restamp(raw, d) {
    let s = String(raw || '').trim();
    let hit = false;
    s = s.replace(/(\d{4})([./-])(\d{1,2})\2(\d{1,2})/, (m, y, sep) => { hit = true; return `${d.getFullYear()}${sep}${pad(d.getMonth() + 1)}${sep}${pad(d.getDate())}`; });
    if (!hit) s = s.replace(/(\d{1,2})([./-])(\d{1,2})\2(\d{4})/, (m, a, sep) => { hit = true; return `${pad(d.getDate())}${sep}${pad(d.getMonth() + 1)}${sep}${d.getFullYear()}`; });
    if (!hit) s = s.replace(/(\d{1,2})(\s+)([а-яё]+)(\s+)(\d{4})/i, (m, a, s1, mo, s2) => {
        if (!MON_RE.some(re => re.test(mo.toLowerCase()))) return m;
        hit = true;
        return `${d.getDate()}${s1}${likeCase(mo, MON[d.getMonth()])}${s2}${d.getFullYear()}`;
    });
    if (!hit) return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    // день недели, если Horae его пишет
    return s.replace(/[а-яё]+|[a-z]+/gi, (w) => {
        const lw = WD_ALT[w.toLowerCase()] || w.toLowerCase();
        for (const list of WD) { const k = list.indexOf(lw); if (k >= 0) return likeCase(w, list[d.getDay()]); }
        return w;
    });
}

/** Дата у каждого поста (Horae пишет её не в каждом — тянется от прошлого) и где она записана своя. */
function postDates(chat) {
    const raw = new Array(chat.length).fill('');
    const own = new Array(chat.length).fill(false);
    let date = '';
    for (let i = 0; i < chat.length; i++) {
        const meta = chat[i]?.horae_meta;
        if (meta?.timestamp?.story_date && !meta._skipHorae) { date = meta.timestamp.story_date; own[i] = true; }
        raw[i] = date;
    }
    return { raw, own };
}

function setDate(m, date) {
    if (!m.horae_meta || typeof m.horae_meta !== 'object') m.horae_meta = A.emptyMeta ? A.emptyMeta() : { timestamp: {} };
    if (!m.horae_meta.timestamp || typeof m.horae_meta.timestamp !== 'object') m.horae_meta.timestamp = { story_date: '', story_time: '', absolute: '' };
    m.horae_meta.timestamp.story_date = date;
}

/** Таймеры Life {t, mes} — сдвинуть на разницу, если отмечены переставленными постами. */
function shiftStamps(root, posts, ms) {
    if (!ms) return 0;
    let n = 0;
    const seen = new Set();
    const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || depth > 12 || seen.has(o)) return;
        seen.add(o);
        if (!Array.isArray(o) && typeof o.t === 'number' && typeof o.mes === 'number' && Math.abs(o.t) > 1e11 && posts.has(o.mes)) { o.t += ms; n++; }
        for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
    };
    walk(root, 0);
    return n;
}

/**
 * Переставить дату постам дня key: с поста from по to (включительно) — только тем, что в этом дне
 * (флешбеки внутри со своей датой не трогаю). date — настоящая дата (Date). Вернёт { posts, wrote, stamps, key }.
 */
export async function redateDay(key, date, from, to) {
    if (!(date instanceof Date) || isNaN(date)) throw new Error('дата не читается');
    const chat = A.chatArr();
    const { raw, own } = postDates(chat);
    const keyAt = raw.map(r => (r ? dayKey(r) : ''));
    const lo = Math.max(0, Math.min(from, to)), hi = Math.min(chat.length - 1, Math.max(from, to));
    const posts = new Set();
    for (let i = lo; i <= hi; i++) if (keyAt[i] === key) posts.add(i);
    if (!posts.size) throw new Error(`в постах #${lo}–#${hi} нет этого дня`);
    const nk = ymdOf(date);
    if (nk === key) throw new Error('это та же дата');
    const oldD = keyDate(key);
    const ms = oldD ? Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - oldD) / 864e5) * 864e5 : 0;
    let wrote = 0;
    let cur = '';
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m) continue;
        const meta = m.horae_meta;
        if (meta?._skipHorae) continue;
        if (posts.has(i)) {
            const want = restamp(raw[i], date);
            if (own[i]) {
                if (meta.timestamp.story_date !== want) { meta.timestamp.story_date = want; wrote++; }
                const ab = meta.timestamp.absolute;
                if (typeof ab === 'string' && A.parseDate(ab)) meta.timestamp.absolute = restamp(ab, date);
                else if (typeof ab === 'number' && Math.abs(ab) > 1e11) meta.timestamp.absolute = ab + ms;
                for (const ev of Array.isArray(meta.events) ? meta.events : []) if (ev?.timestamp?.story_date && dayKey(ev.timestamp.story_date) === key) ev.timestamp.story_date = restamp(ev.timestamp.story_date, date);
                cur = want;
            } else if (dayKey(cur) !== nk) { setDate(m, want); cur = want; wrote++; }
            continue;
        }
        if (own[i]) { cur = meta.timestamp.story_date; continue; }
        // наследовал дату — после правки должен наследовать ту же, что раньше
        if (raw[i] && dayKey(cur) !== keyAt[i]) { setDate(m, raw[i]); cur = raw[i]; wrote++; }
    }
    const stamps = shiftStamps(A.chatMeta(), posts, ms);
    // итоги дней: старый день, если ушёл целиком, — к новому; оба — пересобрать
    const cm = A.chatMeta();
    cm.ver = (cm.ver || 0) + 1;
    cache.sig = '';
    const sum = M().sum;
    const gone = !collectDays().some(d => d.key === key);
    if (gone && sum[key]) {
        const o = sum[key];
        if (!sum[nk]) sum[nk] = { ...o, to: -1, today: false };
        else if (o.edited || sum[nk].edited) sum[nk] = { ...sum[nk], text: [sum[nk].text, o.text].filter(Boolean).join(' ').slice(0, 1800), open: [...(sum[nk].open || []), ...(o.open || [])].slice(0, 4), edited: true };
        else sum[nk].to = -1;
        delete sum[key];
    } else if (sum[nk] && !sum[nk].edited) sum[nk].to = -1;
    if (!gone && sum[key] && !sum[key].edited) sum[key].to = -1;
    try { await A.ctx().saveChat?.(); } catch (e) { console.warn('[Life] дни: сохранить чат', e); }
    A.saveMeta();
    return { posts: posts.size, wrote, stamps, key: nk, gone };
}

/** Где в дне полночь: первый пост после позднего вечера с ранним временем (по времени Horae). */
export function midnightIn(d) {
    const chat = A.chatArr();
    let prev = null;
    for (let i = d.from; i <= d.to; i++) {
        const t = String(chat[i]?.horae_meta?.timestamp?.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
        if (!t || chat[i]?.horae_meta?._skipHorae) continue;
        const min = +t[1] * 60 + +t[2];
        if (prev && prev.min >= 17 * 60 && min < 9 * 60) return { before: prev.i, after: i };
        prev = { i, min };
    }
    return null;
}

/** Пересобрать итоги этих дней (после перестановки дат) — фоном. */
async function rebuildKeys(keys) {
    for (const k of keys) {
        const d = collectDays().find(x => x.key === k);
        const s = M().sum[k];
        if (!d || !hasStuff(d) || s?.edited) continue;
        const isToday = d === todayOf(collectDays());
        if (isToday && d.to - d.from < 24) continue;
        const upto = isToday ? d.to - 12 : Infinity;
        try {
            const r = await summarize(d, upto);
            M().sum[k] = { ...r, from: d.from, to: isToday ? upto : d.to, today: isToday, at: Date.now() };
            A.saveMeta();
        } catch (e) { console.warn('[Life] дни: пересобрать', e); }
    }
    A.updatePrompt();
    A.render?.();
}

// ───────────── вид: Мир → Дни ─────────────

export function daysHtml() {
    if (!A?.hasChat?.()) return '';
    const days = collectDays();
    const c = cfg();
    const sum = M().sum;
    const head = `<div class="lf-field"><label>Модели — последние дни</label><div class="lf-seg">${[[0, 'Выкл'], [3, '3'], [5, '5'], [7, '7']].map(([v, l]) => `<button class="${c.n === v ? 'on' : ''}" data-act="days-n" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    if (!days.length) return `${head}<div class="lf-empty small">Horae ещё не записал ни одной даты — дни появятся, как только у постов будет дата истории.</div>`;
    const imgs = A.imgs?.() || [];
    const list = [...days].reverse();
    const out = [];
    for (let n = 0; n < list.length; n++) {
        const d = list[n];
        const s = sum[d.key];
        const isToday = n === 0;
        const cover = A.imagesBetween?.(imgs, d.from, d.to)?.slice(-1)[0]?.src || '';
        const stale = s && !s.edited && !s.today && s.to !== d.to;
        out.push(`<article class="lf-day${isToday ? ' today' : ''}">
            ${cover ? `<div class="lf-day-img" style="background-image:url('${esc(cover)}')"></div>` : ''}
            <header><b>${esc(dayLabel(d.key, d.raw, true))}</b><small>${isToday ? 'сегодня · ' : ''}${esc(d.locs.slice(0, 3).join(' · '))}${d.locs.length ? ' · ' : ''}${d.posts} ${A.plural(d.posts, 'пост', 'поста', 'постов')}</small></header>
            ${s?.text && !hollow(s) ? `<p>${esc(s.text)}${s.today ? ' <i>(до этого места)</i>' : ''}</p>` : `<p class="lf-dim">${d.frags.length ? esc(d.frags.slice(0, 3).map(f => f.t).join(' · ')) : hasStuff(d) ? 'Итога ещё нет — «Собрать».' : 'В этом дне нет ни постов, ни событий.'}</p>`}
            ${s?.open?.length ? `<div class="lf-day-open">${s.open.map(o => `<span>${A.icon('pin')} ${esc(o)}</span>`).join('')}</div>` : ''}
            ${d.flash?.length ? `<div class="lf-day-flash">${d.flash.map(f => `<button class="lf-chip" data-act="jump" data-mes="${f.from}">${A.icon('film')} флешбек · ${esc(dayLabel(f.key, f.raw, true))}</button>`).join('')}</div>` : ''}
            <div class="lf-day-acts">
                <button class="lf-chip" data-act="jump" data-mes="${d.from}">${A.icon('arrowUp')} #${d.from}</button>
                ${(!isToday || d.to - d.from >= 24) && hasStuff(d) ? `<button class="lf-chip" data-act="day-redo" data-k="${esc(d.key)}">${A.icon('refresh')} ${s?.text && !hollow(s) ? (stale ? 'Пересобрать (день вырос)' : 'Пересобрать') : 'Собрать'}</button>` : ''}
                <button class="lf-chip" data-act="day-edit" data-k="${esc(d.key)}">${A.icon('pencil')}</button>
            </div>
        </article>`);
        const older = list[n + 1];
        const gap = older ? gapWord(older.key, d.key) : '';
        if (gap) out.push(`<div class="lf-day-gap">⟶ ${esc(gap)}</div>`);
    }
    const missing = days.slice(0, -1).filter(d => hasStuff(d) && (!sum[d.key]?.text || sum[d.key].today || hollow(sum[d.key]))).length;
    return `${head}
    ${missing ? `<button class="lf-btn full" data-act="days-all">${A.icon('sparkles')} Собрать все дни (${missing})</button>` : ''}
    <div class="lf-days">${out.join('')}</div>
    <div class="lf-hint">Закрытый день Летописец сжимает сам (последние дни — сразу, старые — кнопкой). Модель каждый ответ видит последние дни парой строк и «сегодня, раньше в этот день», если день длинный. Правка руками держится — Летописец её не перезапишет.</div>`;
}

export async function daysClick(act, el) {
    if (!act.startsWith('day')) return false;
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'days-n': cfg().n = Number(el.dataset.v) || 0; cfg().on = cfg().n > 0; A.saveSettings(); A.updatePrompt(); A.render(); return true;
        case 'days-all': await A.withBusy(el, async () => {
            const n = await runDays({ all: true });
            const r = daysLast();
            if (r.err) A.toast('warning', `${n ? `Собрала ${n} из ${r.want}. ` : ''}${esc(r.err)}`, '✦ Дни', { timeOut: 6000 });
            else if (n) A.toast('success', `Собрала дней: ${n}`, '✦ Дни', { timeOut: 2000 });
            else A.toast('info', 'Все дни, где что-то было, уже собраны', '✦ Дни', { timeOut: 2500 });
        }, 'Собираю…'); A.render(); return true;
        case 'day-redo': {
            const d = collectDays().find(x => x.key === el.dataset.k);
            if (!d) return true;
            const isToday = d === todayOf(collectDays());
            await A.withBusy(el, async () => {
                const upto = isToday ? d.to - 12 : Infinity;
                try {
                    const r = await summarize(d, upto);
                    M().sum[d.key] = { ...r, from: d.from, to: isToday ? upto : d.to, today: isToday, at: Date.now() };
                } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Дни', { timeOut: 5000 }); }
            }, 'Собираю…');
            return done();
        }
        case 'day-edit': {
            const d = collectDays().find(x => x.key === el.dataset.k);
            const s = M().sum[el.dataset.k] || {};
            const kd = d ? keyDate(d.key) : null;
            const mid = d && kd ? midnightIn(d) : null;
            const K = esc(el.dataset.k);
            A.openSheet(`${A.icon('calendar')} ${esc(d ? dayLabel(d.key, d.raw, true) : el.dataset.k)}`, `
                <div class="lf-field"><label>Что было за день</label><textarea data-in="day-text" rows="6">${esc(s.text || '')}</textarea></div>
                <div class="lf-field"><label>Открыто (через ;)</label><input type="text" data-in="day-open" value="${esc((s.open || []).join('; '))}"></div>
                <button class="lf-btn primary full" data-act="day-save" data-k="${K}">${A.icon('check')} Сохранить</button>
                ${s.text ? `<button class="lf-btn ghost full" data-act="day-clear" data-k="${K}">${A.icon('trash')} Стереть итог</button>` : ''}
                ${d && kd ? `<div class="lf-day-fix">
                    <label>${A.icon('calendar')} Дата не та?</label>
                    <small>Horae записал ${esc(dayLabel(d.key, d.raw, true))} — посты #${d.from}–#${d.to}. Поставь настоящую: перепишу дату в самих постах (увидят Horae, Life и модель), посты после останутся при своей.</small>
                    <div class="lf-day-fix-row">
                        <input type="date" data-in="day-date" value="${esc(d.key)}">
                        <span>#<input type="number" inputmode="numeric" data-in="day-from" value="${d.from}" min="0"></span>
                        <span>– #<input type="number" inputmode="numeric" data-in="day-to" value="${d.to}" min="0"></span>
                    </div>
                    ${mid ? `<div class="lf-chips wrap">
                        <button class="lf-chip" data-act="day-night" data-k="${K}" data-from="${d.from}" data-to="${mid.before}" data-shift="-1">${A.icon('moon')} до полуночи (#${d.from}–#${mid.before}) — днём раньше</button>
                        <button class="lf-chip" data-act="day-night" data-k="${K}" data-from="${mid.after}" data-to="${d.to}" data-shift="1">${A.icon('sun')} после полуночи (#${mid.after}–#${d.to}) — днём позже</button>
                    </div>` : ''}
                    <button class="lf-btn full" data-act="day-redate" data-k="${K}">${A.icon('calendar')} Переставить дату</button>
                </div>` : ''}`);
            return true;
        }
        case 'day-night': {
            const box = el.closest('.lf-sheet') || document;
            const kd = keyDate(el.dataset.k);
            if (!kd) return true;
            const cur = box.querySelector('[data-in="day-date"]');
            const base = cur?.value && keyDate(cur.value) ? keyDate(cur.value) : kd;
            const d = new Date(base); d.setDate(d.getDate() + (Number(el.dataset.shift) || 0));
            if (cur) cur.value = ymdOf(d);
            const f = box.querySelector('[data-in="day-from"]'); if (f) f.value = el.dataset.from;
            const t = box.querySelector('[data-in="day-to"]'); if (t) t.value = el.dataset.to;
            return true;
        }
        case 'day-redate': {
            const box = el.closest('.lf-sheet') || document;
            const v = (k) => box.querySelector(`[data-in="${k}"]`)?.value ?? '';
            const date = keyDate(v('day-date'));
            if (!date) { A.toast('warning', 'Выбери дату', '✦ Дни', { timeOut: 2000 }); return true; }
            let r = null;
            await A.withBusy(el, async () => {
                try { r = await redateDay(el.dataset.k, date, Number(v('day-from')), Number(v('day-to'))); }
                catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Дни', { timeOut: 4000 }); }
            }, 'Переставляю…');
            if (!r) return true;
            A.closeSheet();
            A.toast('success', `${r.posts} ${A.plural(r.posts, 'пост', 'поста', 'постов')} → ${esc(dayLabel(r.key, '', true))}${r.stamps ? ` · таймеров сдвинула: ${r.stamps}` : ''}<br><small>итоги дня пересоберу сама</small>`, '✦ Дни', { timeOut: 4500, escapeHtml: false });
            done();
            rebuildKeys([r.key, el.dataset.k]).catch(() => { });
            return true;
        }
        case 'day-save': {
            const box = el.closest('.lf-sheet') || document;
            const text = box.querySelector('[data-in="day-text"]')?.value?.trim() || '';
            const open = (box.querySelector('[data-in="day-open"]')?.value || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 4);
            const d = collectDays().find(x => x.key === el.dataset.k);
            M().sum[el.dataset.k] = { text, open, from: d?.from ?? 0, to: d?.to ?? 0, edited: true, at: Date.now() };
            A.closeSheet();
            return done();
        }
        case 'day-clear': delete M().sum[el.dataset.k]; A.closeSheet(); return done();
    }
    return false;
}
