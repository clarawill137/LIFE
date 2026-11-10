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

/** Длинный день (сотни постов) — не обрезать конец: важное (★) всё, остальное — равномерно по дню. */
function spread(list, max, isImp = () => false) {
    const len = (a) => a.reduce((n, x) => n + x.t.length + 3, 0);
    if (len(list) <= max) return list;
    const imp = list.filter(isImp);
    const rest = list.filter(x => !isImp(x));
    let budget = max - Math.min(len(imp), max * 0.6);
    const keep = new Set(imp.slice(0, 60));
    const step = Math.max(1, Math.ceil(rest.length / Math.max(1, Math.floor(budget / 90))));
    for (let k = 0; k < rest.length && budget > 0; k += step) { keep.add(rest[k]); budget -= rest[k].t.length + 3; }
    return list.filter(x => keep.has(x));
}

function dayInput(d, upto = Infinity) {
    const frags = spread(d.frags.filter(f => f.i <= upto), 6500, f => f.imp).map(f => `${f.imp ? '★ ' : ''}${f.t}`);
    const chips = spread(d.chips.filter(c => c.i <= upto), 3000).map(c => c.t);
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
    // «ничего не было», хотя события есть, — не итог: прежний не трогать
    if (hollow({ text }) && (d.frags.length + d.chips.length >= 3)) throw new Error('Летописец ответил «ничего не было», хотя события есть, — оставила как было');
    return { text: text.slice(0, 900), open: (Array.isArray(j?.open) ? j.open : []).map(x => String(x || '').trim().slice(0, 90)).filter(Boolean).slice(0, 3) };
}

/** Собрать итоги: закрытые дни без итога (последние n+2) и «сегодня», если день длинный. */
function wanted(all = false) {
    const days = collectDays();
    const sum = M().sum;
    const out = [];
    const closed = days.slice(0, -1);
    const pool = all ? closed : closed.slice(-(cfg().n + 2));
    const fail = M().fail || {};
    const cool = (d) => !all && fail[d.key] && Date.now() - fail[d.key] < 3 * 3600e3;   // не долбить провайдера
    for (const d of pool) {
        const s = sum[d.key];
        if (s?.edited || !hasStuff(d) || cool(d)) continue;
        if (!s || hollow(s) || (s.to !== d.to && !s.today)) out.push({ d, today: false });
        else if (s.today) out.push({ d, today: false }); // день закрылся — итог по всему дню
    }
    // пустышки, собранные, когда дню не дали материала (скрытые посты), — пересобрать, даже если день старый
    if (!all) for (const d of closed) if (!pool.includes(d) && hollow(sum[d.key]) && hasStuff(d) && !cool(d)) out.push({ d, today: false });
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
                if (M().fail) delete M().fail[w.d.key];
                A.saveMeta();
                n++;
                onStep?.(n);
            } catch (e) {
                console.warn('[Life] дни', e);
                last.err = String(e?.message || e);
                const m = M(); m.fail = { ...(m.fail || {}), [w.d.key]: Date.now() }; A.saveMeta();
                break;
            }
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
const keysOf = (chat) => postDates(chat).raw.map(r => (r ? dayKey(r) : ''));

function setDate(m, date) {
    if (!m.horae_meta || typeof m.horae_meta !== 'object') m.horae_meta = A.emptyMeta ? A.emptyMeta() : { timestamp: {} };
    if (!m.horae_meta.timestamp || typeof m.horae_meta.timestamp !== 'object') m.horae_meta.timestamp = { story_date: '', story_time: '', absolute: '' };
    m.horae_meta.timestamp.story_date = date;
}

/** Таймеры Life {t, mes} — сдвинуть: delta — Map(номер поста → сколько мс). */
function shiftStamps(root, delta) {
    if (!delta.size) return 0;
    let n = 0;
    const seen = new Set();
    const walk = (o, depth) => {
        if (!o || typeof o !== 'object' || depth > 12 || seen.has(o)) return;
        seen.add(o);
        if (!Array.isArray(o) && typeof o.t === 'number' && typeof o.mes === 'number' && Math.abs(o.t) > 1e11 && delta.has(o.mes)) { o.t += delta.get(o.mes); n++; }
        for (const v of Array.isArray(o) ? o : Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
    };
    walk(root, 0);
    return n;
}

/**
 * Поменять даты постов: mutate(chat) правит horae_meta, а здесь — до/после: у каких постов сменился день,
 * на столько же сдвигаются таймеры Life с этих постов; кэш дней сбрасывается, чат сохраняется.
 */
async function changeDates(mutate) {
    const chat = A.chatArr();
    const before = keysOf(chat);
    const res = mutate(chat) || {};
    const after = keysOf(chat);
    const delta = new Map();
    for (let i = 0; i < chat.length; i++) {
        if (before[i] === after[i] || !before[i] || !after[i]) continue;
        const a = keyDate(before[i]), b = keyDate(after[i]);
        if (a && b) delta.set(i, Math.round((b - a) / 864e5) * 864e5);
    }
    const stamps = shiftStamps(A.chatMeta(), delta);
    const cm = A.chatMeta();
    cm.ver = (cm.ver || 0) + 1;
    cache.sig = '';
    try { await A.ctx().saveChat?.(); } catch (e) { console.warn('[Life] дни: сохранить чат', e); }
    A.saveMeta();
    return { ...res, moved: delta.size, stamps, before, after };
}

/** Где в чате этот день: куски подряд идущих постов (разрыв больше 12 сообщений — уже другой кусок). */
export function dayChunks(key) {
    const keys = keysOf(A.chatArr());
    const out = [];
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] !== key) continue;
        const last = out[out.length - 1];
        if (last && i - last.to <= 12) { last.to = i; last.n++; } else out.push({ from: i, to: i, n: 1 });
    }
    return out;
}

/**
 * Переставить дату постам дня key — только в выбранных кусках [{from,to}] и только тем, что в этом дне
 * (флешбеки внутри со своей датой не трогаю). date — настоящая дата (Date).
 */
export async function redateDay(key, date, chunks) {
    if (!(date instanceof Date) || isNaN(date)) throw new Error('дата не читается');
    const nk = ymdOf(date);
    if (nk === key) throw new Error('это та же дата');
    const list = (Array.isArray(chunks) ? chunks : [chunks]).filter(c => c && Number.isFinite(c.from) && Number.isFinite(c.to));
    if (!list.length) throw new Error('отметь, в каком месте чата дата не та');
    const r = await changeDates((chat) => {
        const { raw, own } = postDates(chat);
        const keyAt = raw.map(x => (x ? dayKey(x) : ''));
        const posts = new Set();
        for (const c of list) for (let i = Math.max(0, Math.min(c.from, c.to)); i <= Math.min(chat.length - 1, Math.max(c.from, c.to)); i++) if (keyAt[i] === key) posts.add(i);
        if (!posts.size) throw new Error('в этих постах нет этого дня');
        let cur = '';
        for (let i = 0; i < chat.length; i++) {
            const m = chat[i];
            if (!m) continue;
            const meta = m.horae_meta;
            if (meta?._skipHorae) continue;
            if (posts.has(i)) {
                const want = restamp(raw[i], date);
                if (own[i]) { meta.timestamp.story_date = want; cur = want; }
                else if (dayKey(cur) !== nk) { setDate(m, want); cur = want; }
                continue;
            }
            if (own[i]) { cur = meta.timestamp.story_date; continue; }
            // наследовал дату — после правки должен наследовать ту же, что раньше
            if (raw[i] && dayKey(cur) !== keyAt[i]) { setDate(m, raw[i]); cur = raw[i]; }
        }
        return { posts: posts.size };
    });
    // итоги: ничего не стирать. День ушёл целиком — его итог переезжает (к уже бывшему — дописывается); оба — «пересобрать» по желанию
    const sum = M().sum;
    const gone = !collectDays().some(d => d.key === key);
    if (gone && sum[key]) {
        const o = sum[key];
        if (!sum[nk] || hollow(sum[nk])) sum[nk] = { ...o, to: -1, today: false };
        else if (!hollow(o)) sum[nk] = { ...sum[nk], text: [sum[nk].text, o.text].filter(Boolean).join(' ').slice(0, 2400), open: [...(sum[nk].open || []), ...(o.open || [])].slice(0, 4), to: -1, edited: !!(sum[nk].edited || o.edited) };
        delete sum[key];
    }
    A.saveMeta();
    return { ...r, key: nk, gone };
}

/** Где в куске полночь: первый пост после позднего вечера с ранним временем (по времени Horae). */
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

// ───────────── вернуть даты Horae ─────────────
// Horae держит дату ещё и в самом тексте поста (<horae>time:…</horae>). Если Life переставил дату, а Horae был прав
// (пост и правда из декабря), — её можно вернуть оттуда.

/** Дата из тега Horae в тексте поста (последний блок со строкой time:) или ''. */
export function horaeTagDate(mes) {
    const blocks = [...String(mes || '').matchAll(/<horae>([\s\S]*?)<\/horae>/gi)];
    for (let k = blocks.length - 1; k >= 0; k--) {
        const line = blocks[k][1].split('\n').map(x => x.trim()).find(x => /^time\s*[:：]/i.test(x));
        if (!line) continue;
        const t = line.replace(/^time\s*[:：]/i, '').trim();
        const clock = t.match(/(\d{1,2}:\d{2})\s*$/);
        return clock ? t.slice(0, t.lastIndexOf(clock[1])).trim() : t;
    }
    return '';
}

let movedMemo = { sig: '', list: [] };
/** Посты, где дата Horae в метке не та, что в тексте поста (её переставили): [{ i, cur, tag }]. */
export function movedDates() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const sig = `${A.ctx().chatId || A.ctx().groupId}|${chat.length}|${String(last?.mes || '').length}|${A.chatMeta().ver || 0}`;
    if (movedMemo.sig === sig) return movedMemo.list;
    const list = [];
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const meta = m?.horae_meta;
        if (!meta?.timestamp?.story_date || meta._skipHorae || m.extra?.life) continue;
        const tag = horaeTagDate(m.mes);
        if (tag && dayKey(tag) && dayKey(tag) !== dayKey(meta.timestamp.story_date)) list.push({ i, cur: meta.timestamp.story_date, tag });
    }
    movedMemo = { sig, list };
    return list;
}

/**
 * Вернуть даты из текста постов. smart — только там, где дата Horae ложится в ход истории (между соседними
 * датами), а переставленная — нет: так уходит лишнее, а настоящая правка остаётся. Иначе — все.
 */
export async function restoreDates({ smart = true } = {}) {
    const moved = movedDates();
    if (!moved.length) return { restored: 0, kept: 0, cleared: 0, moved: 0, stamps: 0 };
    return changeDates((chat) => {
        const set = new Map(moved.map(x => [x.i, x]));
        const curKeys = new Set(moved.map(x => dayKey(x.cur)));
        // посты со своей датой по порядку; соседи куска — ближайшие непереставленные. Даты, которые Life дописал
        // постам без тега (той же переставленной датой), — не опора: их ставила та же правка
        const seq = [];
        for (let i = 0; i < chat.length; i++) {
            const m = chat[i];
            const meta = m?.horae_meta;
            if (!meta?.timestamp?.story_date || meta._skipHorae || !dayKey(meta.timestamp.story_date)) continue;
            if (!set.has(i) && !m.extra?.life && !horaeTagDate(m.mes) && curKeys.has(dayKey(meta.timestamp.story_date))) continue;
            seq.push(i);
        }
        const back = [];
        let kept = 0;
        for (let k = 0; k < seq.length; k++) {
            if (!set.has(seq[k])) continue;
            let a = k; while (a > 0 && set.has(seq[a - 1])) a--;
            let b = k; while (b < seq.length - 1 && set.has(seq[b + 1])) b++;
            const prev = a > 0 ? keyDate(dayKey(chat[seq[a - 1]].horae_meta.timestamp.story_date)) : null;
            const next = b < seq.length - 1 ? keyDate(dayKey(chat[seq[b + 1]].horae_meta.timestamp.story_date)) : null;
            for (let q = a; q <= b; q++) {
                const x = set.get(seq[q]);
                const T = keyDate(dayKey(x.tag)), C = keyDate(dayKey(x.cur));
                let ret = !smart;
                if (smart && T && C) {
                    const fits = (d) => (!prev || prev <= d) && (!next || d <= next);
                    const near = (d) => Math.abs(d - (prev || next || d));
                    ret = fits(T) && !fits(C) ? true : fits(C) && !fits(T) ? false : near(T) < near(C);
                }
                if (ret) back.push({ ...x, from: a > 0 ? seq[a - 1] + 1 : 0, to: b < seq.length - 1 ? seq[b + 1] - 1 : chat.length - 1 });
                else kept++;
            }
            k = b;
        }
        const backKeys = new Set(back.map(x => dayKey(x.cur)));
        for (const x of back) chat[x.i].horae_meta.timestamp.story_date = x.tag;
        // даты, которые Life дописал постам без своей (чтобы тянулась новая), — снять там, где вернули
        let cleared = 0;
        for (const x of back) {
            for (let i = x.from; i <= x.to; i++) {
                const m = chat[i];
                const meta = m?.horae_meta;
                if (!meta?.timestamp?.story_date || meta._skipHorae || m.extra?.life || horaeTagDate(m.mes)) continue;
                if (backKeys.has(dayKey(meta.timestamp.story_date))) { meta.timestamp.story_date = ''; cleared++; }
            }
        }
        return { restored: back.length, kept, cleared };
    });
}

/** Итог дня руками (или посевом «от Claude»): правленый — Летописец его не перезапишет. */
export function setDaySummary(key, text, open = []) {
    const d = collectDays().find(x => x.key === key);
    M().sum[key] = { text: String(text || '').trim(), open: (Array.isArray(open) ? open : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 4), from: d?.from ?? 0, to: d?.to ?? 0, edited: true, at: Date.now() };
    if (M().fail) delete M().fail[key];
    A.saveMeta();
}

// ───────────── страж дат ─────────────
// Всё время в Life — из даты Horae. Модель ошиблась месяцем — и поехали раны, счета, срок. Поэтому прыжок даты
// (вперёд больше трёх дней или назад — и это не сон/флешбек, не перемотка Life) сразу виден чипом под постом:
// «так и надо» или «дата не та» — пока неверных постов один-два, а не сто.

const FRAME_OFF = ['flashback', 'dream', 'vision', 'memory'];
let jumpMemo = { sig: '', map: new Map() };
/** Прыжки дат: Map(номер поста → { from, to, days }) — только неподтверждённые. */
export function dateJumps() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const ok = M().okJump || {};
    // пометки «флешбек/сон» Летописец ставит позже поста — их тоже в подпись (свежие 40 постов)
    let fr = '';
    for (let i = Math.max(0, chat.length - 40); i < chat.length; i++) { const k = chat[i] && !chat[i].is_user ? A.chronOf?.(i)?.frame?.kind : ''; if (k) fr += `${i}${k[0]}`; }
    const sig = `${A.ctx().chatId || A.ctx().groupId}|${chat.length}|${String(last?.mes || '').length}|${A.chatMeta().ver || 0}|${Object.keys(ok).length}|${last?.horae_meta?.timestamp?.story_date || ''}|${fr}`;
    if (jumpMemo.sig === sig) return jumpMemo.map;
    const map = new Map();
    let prev = null;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const meta = m?.horae_meta;
        if (!meta?.timestamp?.story_date || meta._skipHorae) continue;
        const k = dayKey(meta.timestamp.story_date);
        if (!keyDate(k)) continue;
        if (m.extra?.life || m.is_user || !prev || prev === k) { prev = k; continue; }   // отметка Life (перемотка) — дата верная по определению
        const days = Math.round((keyDate(k) - keyDate(prev)) / 864e5);
        const fk = A.chronOf?.(i)?.frame?.kind;
        if (days < 0 && fk && FRAME_OFF.includes(fk)) continue;                       // флешбек: «сейчас» не меняется
        if ((days > 3 || days < 0) && ok[i] !== k) map.set(i, { from: prev, to: k, days });
        prev = k;
    }
    jumpMemo = { sig, map };
    return map;
}

export function paintDateGuard(el, id) {
    const old = el.querySelector(':scope .lf-dguard');
    const chat = A.chatArr();
    const j = id >= chat.length - 80 ? dateJumps().get(id) : null;
    if (!j) { old?.remove(); return; }
    const html = `<div class="lf-dguard lf-slip lf-own"><span class="lf-slip-chip">⚠ <b>Дата прыгнула:</b> ${esc(dayLabel(j.from, '', true))} → ${esc(dayLabel(j.to, '', true))} (${j.days > 0 ? '+' : '−'}${Math.abs(j.days)} ${A.plural(Math.abs(j.days), 'день', 'дня', 'дней')})
        <button data-act="day-jump-ok" data-mes="${id}">так и надо</button><button class="main" data-act="day-jump-fix" data-mes="${id}">дата не та</button></span></div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

// ───────────── лист «Дата не та?» ─────────────

function nightChips(key, chunks) {
    const kd = keyDate(key);
    if (!kd) return '';
    const out = [];
    for (const c of chunks) {
        const mid = midnightIn(c);
        if (!mid) continue;
        out.push(`<button class="lf-chip" data-act="day-night" data-k="${esc(key)}" data-from="${c.from}" data-to="${mid.before}" data-shift="-1">${A.icon('moon')} до полуночи (#${c.from}–#${mid.before}) — днём раньше</button>`,
            `<button class="lf-chip" data-act="day-night" data-k="${esc(key)}" data-from="${mid.after}" data-to="${c.to}" data-shift="1">${A.icon('sun')} после полуночи (#${mid.after}–#${c.to}) — днём позже</button>`);
    }
    return out.join('');
}

function dateFixHtml(d, K, pick = -1, toKey = '') {
    const chunks = dayChunks(d.key);
    const one = chunks.length === 1;
    const on = (c) => one || (pick >= c.from && pick <= c.to);
    return `<div class="lf-day-fix">
        <label>${A.icon('calendar')} Дата не та?</label>
        <small>${one ? `Horae записал ${esc(dayLabel(d.key, d.raw, true))} — посты #${chunks[0].from}–#${chunks[0].to}.` : `<b>Эта дата стоит в чате в ${chunks.length} местах</b> — это могут быть разные дни. Отметь только то место, где дата не та.`} Перепишу дату в самих постах (увидят Horae, Life и модель); остальные посты — при своей, итоги дней не трогаю.</small>
        <div class="lf-chips wrap">${chunks.map(c => `<button class="lf-chip${on(c) ? ' on' : ''}" data-act="day-chunk" data-k="${K}" data-from="${c.from}" data-to="${c.to}">#${c.from}–#${c.to} · ${c.n} ${A.plural(c.n, 'сообщение', 'сообщения', 'сообщений')}</button>`).join('')}</div>
        <div class="lf-day-fix-row"><input type="date" data-in="day-date" value="${esc(toKey || d.key)}"><span class="lf-day-part" hidden></span></div>
        <div class="lf-chips wrap lf-day-night">${nightChips(d.key, chunks.filter(on))}</div>
        <button class="lf-btn full" data-act="day-redate" data-k="${K}">${A.icon('calendar')} Переставить дату</button>
    </div>`;
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
            <header><b>${esc(dayLabel(d.key, d.raw, true))}</b><small>${isToday ? 'сегодня · ' : ''}${esc(d.locs.slice(0, 3).join(' · '))}${d.locs.length ? ' · ' : ''}${d.posts} ${A.plural(d.posts, 'пост', 'поста', 'постов')}${(() => { const ch = dayChunks(d.key); return ch.length > 1 ? ` · <span class="lf-warn">в ${ch.length} местах чата</span>` : ''; })()}</small></header>
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
    const moved = movedDates();
    return `${head}
    ${moved.length ? `<div class="lf-day-moved"><b>${A.icon('calendar')} Даты переставлены в ${moved.length} ${A.plural(moved.length, 'посте', 'постах', 'постах')}</b><small>В тексте этих постов у Horae своя дата. «Вернуть, где Horae прав» — только там, где его дата ложится между соседними днями (правка ноября останется, а настоящий декабрь вернётся); «Вернуть все» — как было до правок.</small>
        <div class="lf-actions"><button class="lf-btn" data-act="days-restore">${A.icon('refresh')} Вернуть, где Horae прав</button><button class="lf-btn ghost" data-act="days-restore" data-all="1">Вернуть все</button></div></div>` : ''}
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
            const K = esc(el.dataset.k);
            A.openSheet(`${A.icon('calendar')} ${esc(d ? dayLabel(d.key, d.raw, true) : el.dataset.k)}`, `
                <div class="lf-field"><label>Что было за день</label><textarea data-in="day-text" rows="6">${esc(s.text || '')}</textarea></div>
                <div class="lf-field"><label>Открыто (через ;)</label><input type="text" data-in="day-open" value="${esc((s.open || []).join('; '))}"></div>
                <button class="lf-btn primary full" data-act="day-save" data-k="${K}">${A.icon('check')} Сохранить</button>
                ${s.text ? `<button class="lf-btn ghost full" data-act="day-clear" data-k="${K}">${A.icon('trash')} Стереть итог</button>` : ''}
                ${d && kd ? dateFixHtml(d, K) : ''}`);
            return true;
        }
        case 'day-jump-ok': {
            const i = Number(el.dataset.mes);
            const j = dateJumps().get(i);
            if (j) { const m = M(); m.okJump = { ...(m.okJump || {}), [i]: j.to }; A.saveMeta(); }
            A.paintSoon?.();
            return true;
        }
        case 'day-jump-fix': {
            const i = Number(el.dataset.mes);
            const j = dateJumps().get(i);
            const d = j && collectDays().find(x => x.key === j.to);
            if (!d) return true;
            A.openSheet(`${A.icon('calendar')} Дата прыгнула`, `<div class="lf-hint">Было ${esc(dayLabel(j.from, '', true))}, в посте #${i} стало ${esc(dayLabel(j.to, d.raw, true))}. Поставь настоящую дату — перепишу её в посте (и в следующих с той же датой рядом).</div>${dateFixHtml(d, esc(j.to), i, j.from)}`);
            return true;
        }
        case 'day-chunk': {
            // отметить кусок — заново посчитать полночь в отмеченных
            const box = el.closest('.lf-sheet') || document;
            el.classList.toggle('on');
            const sel = [...box.querySelectorAll('[data-act="day-chunk"].on')].map(x => ({ from: Number(x.dataset.from), to: Number(x.dataset.to) }));
            const nb = box.querySelector('.lf-day-night');
            if (nb) nb.innerHTML = nightChips(el.dataset.k, sel);
            return true;
        }
        case 'day-night': {
            const box = el.closest('.lf-sheet') || document;
            const kd = keyDate(el.dataset.k);
            if (!kd) return true;
            const cur = box.querySelector('[data-in="day-date"]');
            const d = new Date(kd); d.setDate(d.getDate() + (Number(el.dataset.shift) || 0));
            if (cur) cur.value = ymdOf(d);
            box.querySelectorAll('[data-act="day-chunk"]').forEach(x => x.classList.remove('on'));
            const part = box.querySelector('.lf-day-part');
            if (part) { part.dataset.from = el.dataset.from; part.dataset.to = el.dataset.to; part.textContent = `только посты #${el.dataset.from}–#${el.dataset.to}`; part.hidden = false; }
            return true;
        }
        case 'day-redate': {
            const box = el.closest('.lf-sheet') || document;
            const date = keyDate(box.querySelector('[data-in="day-date"]')?.value || '');
            if (!date) { A.toast('warning', 'Выбери дату', '✦ Дни', { timeOut: 2000 }); return true; }
            const part = box.querySelector('.lf-day-part');
            const chunks = part && !part.hidden ? [{ from: Number(part.dataset.from), to: Number(part.dataset.to) }]
                : [...box.querySelectorAll('[data-act="day-chunk"].on')].map(x => ({ from: Number(x.dataset.from), to: Number(x.dataset.to) }));
            if (!chunks.length) { A.toast('warning', 'Отметь, в каком месте чата дата не та', '✦ Дни', { timeOut: 3000 }); return true; }
            let r = null;
            await A.withBusy(el, async () => {
                try { r = await redateDay(el.dataset.k, date, chunks); }
                catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Дни', { timeOut: 4000 }); }
            }, 'Переставляю…');
            if (!r) return true;
            A.closeSheet();
            A.toast('success', `${r.posts} ${A.plural(r.posts, 'пост', 'поста', 'постов')} → ${esc(dayLabel(r.key, '', true))}${r.stamps ? ` · таймеров сдвинула: ${r.stamps}` : ''}<br><small>итоги не трогала: поправь ✎ или «Пересобрать»</small>`, '✦ Дни', { timeOut: 5000, escapeHtml: false });
            return done();
        }
        case 'days-restore': {
            let r = null;
            await A.withBusy(el, async () => {
                try { r = await restoreDates({ smart: el.dataset.all !== '1' }); }
                catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Дни', { timeOut: 4000 }); }
            }, 'Возвращаю…');
            if (!r) return true;
            A.toast('success', `Вернула дату Horae: ${r.restored} ${A.plural(r.restored, 'посту', 'постам', 'постам')}${r.kept ? ` · оставила как поправлено: ${r.kept}` : ''}${r.stamps ? ` · таймеров сдвинула: ${r.stamps}` : ''}`, '✦ Дни', { timeOut: 5000 });
            return done();
        }
        case 'day-save': {
            const box = el.closest('.lf-sheet') || document;
            const text = box.querySelector('[data-in="day-text"]')?.value?.trim() || '';
            const open = (box.querySelector('[data-in="day-open"]')?.value || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 4);
            setDaySummary(el.dataset.k, text, open);
            A.closeSheet();
            return done();
        }
        case 'day-clear': delete M().sum[el.dataset.k]; A.closeSheet(); return done();
    }
    return false;
}
