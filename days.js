// Последние дни. Horae даёт обрывки событий с датой; здесь из них — «день — дата — всё коротко».
// Закрытый день (дата сменилась) дешёвая модель сжимает в 2–4 предложения + что осталось открытым.
// Модель каждый ответ видит последние N дней и «сегодня, раньше в этот день» — чтобы не забывала недавнее.
// Вид — Мир → Дни: карточки по дням, правка руками, пересобрать.

let A = null;
export function initDays(api) { A = api; }

const esc = (v) => A.esc(v);
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
            if (m.is_system) continue;
            let fl = host.flash.find(f => f.key === k);
            if (!fl) { fl = { key: k, raw: rawAt[i], from: i, to: i, frags: [] }; host.flash.push(fl); }
            fl.to = i;
            for (const ev of meta?.events || []) { const t = String(ev?.summary || '').trim(); if (t && !fl.frags.includes(t)) fl.frags.push(t); }
            continue;
        }
        let d = byKey.get(k);
        if (!d) { d = { key: k, raw: rawAt[i], from: i, to: i, locs: [], frags: [], chips: [], posts: 0, flash: [] }; byKey.set(k, d); order.push(d); }
        host = d;
        d.to = Math.max(d.to, i);
        if (m.is_system) continue;
        d.posts++;
        const loc = String(meta?.scene?.location || '').split(/[·,]/)[0].trim();
        if (loc && !d.locs.includes(loc)) d.locs.push(loc);
        for (const ev of meta?.events || []) {
            const t = String(ev?.summary || '').trim();
            if (t && !d.frags.some(f => f.t === t)) d.frags.push({ t, i, imp: !!(ev?.is_important || ev?.level === 'important' || ev?.level === 'critical') });
        }
        if (!m.is_user) { const c = A.chronOf(i)?.chips?.[0]; if (c) d.chips.push({ t: c, i }); }
    }
    // «сегодня» — день последнего поста своего времени
    if (host && order[order.length - 1] !== host) { order.splice(order.indexOf(host), 1); order.push(host); }
    cache = { sig, days: order };
    return order;
}

const todayOf = (days) => days[days.length - 1] || null;

// ───────────── сжать день ─────────────

const SUM_SYSTEM = `Ты ведёшь хронику длинной литературной ролевой истории на русском. Тебе дают обрывки событий ОДНОГО игрового дня (из трекера и плашек после постов) — по порядку.
Напиши, что было за этот день: 2–4 коротких предложения, по порядку, конкретно — кто, что, где, чем кончилось. Главное и то, что ещё аукнется: решения, обещания, признания, ссоры и примирения, раны, подарки, новости, планы на потом. Без оценок, без украшений, без пересказа диалогов. Если в дне был флешбек или сон — так и скажи.
Ответь только JSON: {"text":"2–4 предложения","open":["что осталось открытым или обещано на потом, 3–8 слов"]} (open — 0–3 пункта).`;

function dayInput(d, upto = Infinity) {
    const frags = d.frags.filter(f => f.i <= upto).map(f => `${f.imp ? '★ ' : ''}${f.t}`);
    const chips = d.chips.filter(c => c.i <= upto).map(c => c.t);
    const chat = A.chatArr();
    let tail = '';
    for (let i = Math.min(d.to, upto); i >= d.from && !tail; i--) if (chat[i] && !chat[i].is_system && !chat[i].is_user) tail = A.cut(A.plainText(chat[i].mes), 900);
    const fl = (d.flash || []).filter(f => f.from <= upto).map(f => `Флешбек (${dayLabel(f.key, f.raw, true)}): ${f.frags.join('; ') || 'без записанных событий'}`);
    return [`Дата: ${dayLabel(d.key, d.raw, true)}`, d.locs.length ? `Места: ${d.locs.join(', ')}` : '',
        frags.length ? `События (трекер):\n${A.cut(frags.join('\n'), 5000)}` : '', fl.length ? fl.join('\n') : '', chips.length ? `После постов:\n${A.cut(chips.join('\n'), 3000)}` : '',
        tail ? `Конец дня (последний пост, начало):\n${tail}` : ''].filter(Boolean).join('\n\n');
}

let busy = false;
const queue = [];

async function summarize(d, upto = Infinity) {
    const out = await A.askModel([{ role: 'system', content: SUM_SYSTEM }, { role: 'user', content: dayInput(d, upto) }], 900);
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
        if (s?.edited) continue;
        if (!s || (s.to !== d.to && !s.today)) out.push({ d, today: false });
        else if (s.today) out.push({ d, today: false }); // день закрылся — итог по всему дню
    }
    const t = todayOf(days);
    if (t && t.to - t.from >= 24) {
        const s = sum[t.key];
        const upto = t.to - 12; // последние посты модель и так видит целиком
        if (!s || (s.today && upto - (s.to ?? 0) >= 14)) out.push({ d: t, today: true, upto });
    }
    return out;
}

export async function runDays({ all = false, onStep } = {}) {
    if (busy || !A.hasChat()) return 0;
    busy = true;
    let n = 0;
    try {
        const cm = A.chatMeta();
        for (const w of wanted(all)) {
            await A.genIdle?.();
            if (A.chatMeta() !== cm) break;
            try {
                const r = await summarize(w.d, w.today ? w.upto : Infinity);
                M().sum[w.d.key] = { ...r, from: w.d.from, to: w.today ? w.upto : w.d.to, today: !!w.today, at: Date.now() };
                A.saveMeta();
                n++;
                onStep?.(n);
            } catch (e) { console.warn('[Life] дни', e); if (all) A.toast('warning', esc(String(e?.message || e)), '✦ Дни', { timeOut: 4000 }); break; }
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
        const body = s?.text && !s.today ? s.text : [d.frags.filter(f => f.imp).concat(d.frags.filter(f => !f.imp)).slice(0, 4).map(f => f.t).join('; '), fb ? `(${fb})` : ''].filter(Boolean).join(' ');
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
            ${s?.text ? `<p>${esc(s.text)}${s.today ? ' <i>(до этого места)</i>' : ''}</p>` : `<p class="lf-dim">${d.frags.length ? esc(d.frags.slice(0, 3).map(f => f.t).join(' · ')) : 'Событий не записано.'}</p>`}
            ${s?.open?.length ? `<div class="lf-day-open">${s.open.map(o => `<span>${A.icon('pin')} ${esc(o)}</span>`).join('')}</div>` : ''}
            ${d.flash?.length ? `<div class="lf-day-flash">${d.flash.map(f => `<button class="lf-chip" data-act="jump" data-mes="${f.from}">${A.icon('film')} флешбек · ${esc(dayLabel(f.key, f.raw, true))}</button>`).join('')}</div>` : ''}
            <div class="lf-day-acts">
                <button class="lf-chip" data-act="jump" data-mes="${d.from}">${A.icon('arrowUp')} #${d.from}</button>
                ${!isToday || d.to - d.from >= 24 ? `<button class="lf-chip" data-act="day-redo" data-k="${esc(d.key)}">${A.icon('refresh')} ${s?.text ? (stale ? 'Пересобрать (день вырос)' : 'Пересобрать') : 'Собрать'}</button>` : ''}
                <button class="lf-chip" data-act="day-edit" data-k="${esc(d.key)}">${A.icon('pencil')}</button>
            </div>
        </article>`);
        const older = list[n + 1];
        const gap = older ? gapWord(older.key, d.key) : '';
        if (gap) out.push(`<div class="lf-day-gap">⟶ ${esc(gap)}</div>`);
    }
    const missing = days.slice(0, -1).filter(d => !sum[d.key]?.text || sum[d.key].today).length;
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
        case 'days-all': await A.withBusy(el, async () => { const n = await runDays({ all: true }); A.toast('success', n ? `Собрала дней: ${n}` : 'Нечего собирать', '✦ Дни', { timeOut: 2000 }); }, 'Собираю…'); return true;
        case 'day-redo': {
            const d = collectDays().find(x => x.key === el.dataset.k);
            if (!d) return true;
            const isToday = d === todayOf(collectDays());
            await A.withBusy(el, async () => {
                const upto = isToday ? d.to - 12 : Infinity;
                const r = await summarize(d, upto);
                M().sum[d.key] = { ...r, from: d.from, to: isToday ? upto : d.to, today: isToday, at: Date.now() };
            }, 'Собираю…');
            return done();
        }
        case 'day-edit': {
            const d = collectDays().find(x => x.key === el.dataset.k);
            const s = M().sum[el.dataset.k] || {};
            A.openSheet(`${A.icon('calendar')} ${esc(d ? dayLabel(d.key, d.raw, true) : el.dataset.k)}`, `
                <div class="lf-field"><label>Что было за день</label><textarea data-in="day-text" rows="6">${esc(s.text || '')}</textarea></div>
                <div class="lf-field"><label>Открыто (через ;)</label><input type="text" data-in="day-open" value="${esc((s.open || []).join('; '))}"></div>
                <button class="lf-btn primary full" data-act="day-save" data-k="${esc(el.dataset.k)}">${A.icon('check')} Сохранить</button>
                ${s.text ? `<button class="lf-btn ghost full" data-act="day-clear" data-k="${esc(el.dataset.k)}">${A.icon('trash')} Стереть итог</button>` : ''}`);
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
