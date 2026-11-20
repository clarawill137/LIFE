// Лестница хроники. «Дни» держат перед моделью последние несколько дней; всё, что раньше, она забывала (старые
// посты к тому же скрыты от неё). Здесь прошлое складывается ступенями и пересобирает себя само:
// день → глава (несколько дней подряд — в 3–5 предложений) → арка (несколько глав — в 2–3 предложения).
// Модель каждый ответ получает «Раньше в истории»: арки, за ними главы, за ними ещё не сложенные дни — а дальше
// уже идут «Последние дни». День под булавкой не сжимается никогда: его итог идёт строкой как есть, через
// модель не проходит. Границы глав считаются от начала чата и не съезжают, когда история растёт.
// Свод (Мир → Свод) — другое: большое досье умной моделью, в каждый пост не уходит. Здесь — дёшево и всегда.

import { collectDays, dayLabel } from './days.js';

let A = null;
export function initSaga(api) { A = api; }
const esc = (v) => A.esc(v);
const str = (v, n = 900) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function cfg() {
    const s = A.settings();
    if (!s.saga || typeof s.saga !== 'object') s.saga = {};
    const c = s.saga;
    if (c.on === undefined) c.on = false;            // сама ходит к дешёвой модели и добавляет блок в промпт — включается руками
    if (![3, 5, 7].includes(c.per)) c.per = 5;       // дней в главе
    if (![3, 4, 6].includes(c.keep)) c.keep = 4;     // сколько последних глав не складывать в арки
    return c;
}
const on = () => cfg().on !== false;
const ARC = 4;        // глав в арке
const GAP = 10;       // разрыв в днях, после которого глава кончается сама

function M() {
    const cm = A.chatMeta();
    if (!cm.saga || typeof cm.saga !== 'object') cm.saga = {};
    const s = cm.saga;
    if (!s.ch || typeof s.ch !== 'object') s.ch = {};       // первый день главы → { sig, text, at, edited }
    if (!s.arcs || typeof s.arcs !== 'object') s.arcs = {}; // первый день арки → { sig, text, at, edited }
    if (!s.pins || typeof s.pins !== 'object') s.pins = {}; // день → true: не сжимать
    return s;
}

const daySum = (k) => { const s = A.chatMeta().days?.sum?.[k]; return s && !s.today && str(s.text) ? s : null; };
const keyDate = (k) => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const gapDays = (a, b) => { const x = keyDate(a), y = keyDate(b); return x && y ? Math.round((y - x) / 864e5) : 0; };
const span = (keys, raw = {}) => { const a = keys[0], b = keys[keys.length - 1]; const y = a.slice(0, 4) !== b.slice(0, 4); return a === b ? dayLabel(a, raw[a], true) : `${dayLabel(a, raw[a], y)} — ${dayLabel(b, raw[b], true)}`; };

/**
 * Разложить старые дни по ступеням. days — закрытые дни по порядку ({ key, raw }), recent — сколько последних
 * показывают «Дни». Возвращает { all, chapters, arcs, loose }: all — все главы от начала чата ({ id, keys });
 * arcs — арки ({ id, ids, keys }); chapters — главы, ещё не ушедшие в арки; loose — дни между последней
 * главой и «Днями». Глава кончается, когда набрала per дней или дальше разрыв во времени.
 */
export function ladder(days, recent, per = 5, keep = 4) {
    const old = days.slice(0, Math.max(0, days.length - recent));
    const all = [];
    let cur = [];
    const close = () => { all.push({ id: cur[0], keys: cur }); cur = []; };
    for (const d of old) {
        const g = cur.length ? gapDays(cur[cur.length - 1], d.key) : 0;
        if (cur.length && (g > GAP || g < 0)) close();   // разрыв или другая линия времени
        cur.push(d.key);
        if (cur.length >= per) close();
    }
    const toArc = all.slice(0, Math.max(0, all.length - keep));
    const arcs = [];
    let k = 0;
    for (; k + ARC <= toArc.length; k += ARC) { const part = toArc.slice(k, k + ARC); arcs.push({ id: part[0].id, ids: part.map(c => c.id), keys: part.flatMap(c => c.keys) }); }
    return { all, chapters: all.slice(k), arcs, loose: cur };
}

/** Сколько последних дней показывают «Дни» (days.js): их лестница не трогает. */
function recentN() { const dc = A.settings().days || {}; return dc.on === false ? 0 : [0, 3, 5, 7].includes(dc.n) ? dc.n : 5; }

function plan() {
    const closed = collectDays().slice(0, -1);
    const l = ladder(closed, recentN(), cfg().per, cfg().keep);
    return { ...l, raw: Object.fromEntries(closed.map(d => [d.key, d.raw])), keysOf: Object.fromEntries(l.all.map(c => [c.id, c.keys])) };
}

// ───────────── сжать ─────────────

const CH_SYSTEM = `Ты ведёшь хронику длинной литературной ролевой истории на русском. Тебе дают итоги нескольких игровых дней подряд. Сожми их в одну главу: 3–5 предложений, по порядку, конкретно — что произошло, что решили, что изменилось между людьми, какие раны, обещания и тайны остались. Имена и места — как в итогах. Без оценок, без украшений, ничего не выдумывай. Дни, отмеченные «◆ держать как есть», не пересказывай — они пойдут отдельной строкой.
Ответь только JSON: {"text":"3–5 предложений"}`;
const ARC_SYSTEM = `Ты ведёшь хронику длинной литературной ролевой истории на русском. Тебе дают несколько глав подряд. Сожми их в одну арку: 2–3 предложения — к чему всё пришло: главные события и решения, что изменилось между людьми, что осталось висеть. Имена — как в главах. Без оценок, ничего не выдумывай.
Ответь только JSON: {"text":"2–3 предложения"}`;

const chSig = (keys) => A.hash(keys.map(k => `${k}:${M().pins[k] ? 'pin' : daySum(k)?.text || ''}`).join('|'));
const arcSig = (ids) => A.hash(ids.map(id => `${id}:${M().ch[id]?.text || ''}`).join('|'));
const chReady = (keys) => keys.every(k => daySum(k));
const pinsOf = (keys) => keys.filter(k => M().pins[k] && daySum(k));

async function buildChapter(c, raw) {
    const free = c.keys.filter(k => !M().pins[k]);
    if (!free.length) return '';   // вся глава под булавками — сжимать нечего
    const input = c.keys.map(k => (M().pins[k] ? `◆ держать как есть — ${dayLabel(k, raw[k], true)}` : `${dayLabel(k, raw[k], true)}: ${daySum(k).text}${daySum(k).open?.length ? ` Открыто: ${daySum(k).open.join('; ')}.` : ''}`)).join('\n');
    const j = A.extractJson(await A.askModel([{ role: 'system', content: CH_SYSTEM }, { role: 'user', content: input }], 900, 'Хроника'));
    const text = str(j?.text, 900);
    if (!text) throw new Error('Летописец не прислал главу');
    return text;
}

async function buildArc(a) {
    const s = M();
    const parts = a.ids.map(id => s.ch[id]?.text).filter(Boolean);
    if (!parts.length) return '';   // главы целиком под булавками
    const j = A.extractJson(await A.askModel([{ role: 'system', content: ARC_SYSTEM }, { role: 'user', content: parts.map((t, k) => `Глава ${k + 1}: ${t}`).join('\n') }], 700, 'Хроника'));
    const text = str(j?.text, 600);
    if (!text) throw new Error('Летописец не прислал арку');
    return text;
}

/** Что пора собрать: главы без текста или с изменившимися днями (и те, что уже в арках), арки — когда их главы готовы. */
export function stale() {
    const p = plan();
    const s = M();
    const need = [];
    for (const c of p.all) {
        const cur = s.ch[c.id];
        if (cur?.edited || !chReady(c.keys)) continue;
        if (!cur || cur.sig !== chSig(c.keys)) need.push({ kind: 'ch', id: c.id, keys: c.keys });
    }
    for (const a of p.arcs) {
        const cur = s.arcs[a.id];
        if (cur?.edited || !a.ids.every(id => s.ch[id])) continue;
        if (!cur || cur.sig !== arcSig(a.ids)) need.push({ kind: 'arc', id: a.id, ids: a.ids });
    }
    return need;
}

let busy = false;
let last = { err: '', n: 0 };
export const sagaLast = () => last;

export async function runSaga({ max = 3 } = {}) {
    if (busy || !A?.hasChat?.() || !on()) return 0;
    busy = true;
    last = { err: '', n: 0 };
    let n = 0;
    try {
        const cm = A.chatMeta();
        const raw = Object.fromEntries(collectDays().map(d => [d.key, d.raw]));
        // главы — раньше арок: арка собирается из готовых глав
        for (let round = 0; round < max; round++) {
            const need = stale();
            const w = need.find(x => x.kind === 'ch') || need[0];
            if (!w) break;
            await A.genIdle?.();
            if (A.chatMeta() !== cm) break;
            try {
                const s = M();
                if (w.kind === 'ch') s.ch[w.id] = { text: await buildChapter(w, raw), sig: chSig(w.keys), at: Date.now() };
                else s.arcs[w.id] = { text: await buildArc(w), sig: arcSig(w.ids), at: Date.now() };
                A.saveMeta();
                n++;
            } catch (e) { console.warn('[Life] хроника', e); last.err = String(e?.message || e); break; }
        }
    } finally { busy = false; }
    last.n = n;
    if (n) { A.updatePrompt(); A.render?.(); }
    return n;
}

let timer = null;
/** После поста: «Дни» собирают свои итоги первыми (их таймер — 2.5 с), лестница — следом. */
export function sagaAfterPost() {
    if (!on()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { runSaga().catch(() => { }); }, 12000);
}

// ───────────── заметка модели ─────────────

const dot = (t) => (/[.!?…»)]$/.test(String(t).trim()) ? String(t).trim() : `${String(t).trim()}.`);
const first = (t) => { const m = /^[\s\S]*?[.!?…](?=\s|$)/.exec(String(t)); return (m ? m[0] : String(t)).trim(); };

/** Строки «Раньше в истории» — от давнего к недавнему. */
export function sagaLines() {
    const p = plan();
    const s = M();
    const lines = [];
    const pinLines = (keys) => pinsOf(keys).map(k => `  ◆ ${dayLabel(k, p.raw[k], true)} — ${dot(daySum(k).text)}`);
    const chLine = (id, keys, short = false) => {
        const c = s.ch[id];
        // глава ещё не собрана — её дни первыми предложениями, чтобы в памяти не было дыры
        const body = c?.text ? (short ? first(c.text) : c.text) : keys.filter(k => !s.pins[k] && daySum(k)).map(k => first(daySum(k).text)).join(' ');
        return body ? `▪ ${span(keys, p.raw)} — ${dot(body)}` : '';
    };
    p.arcs.forEach((a, k) => {
        const old = p.arcs.length > 6 && k < p.arcs.length - 6;     // давних арок много — от них по одной фразе
        const t = s.arcs[a.id]?.text;
        if (t) lines.push(`▬ ${span(a.keys, p.raw)} — ${dot(old ? first(t) : t)}`);
        else for (const id of a.ids) { const l = chLine(id, p.keysOf[id] || [], true); if (l) lines.push(l); }
        lines.push(...pinLines(a.keys));
    });
    for (const c of p.chapters) { const l = chLine(c.id, c.keys); if (l) lines.push(l); lines.push(...pinLines(c.keys)); }
    for (const k of p.loose) { const d = daySum(k); if (d) lines.push(`• ${dayLabel(k, p.raw[k], true)} — ${dot(s.pins[k] ? d.text : A.cut(d.text, 260))}`); }
    return lines;
}

export function sagaPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    let lines = [];
    try { lines = sagaLines(); } catch (e) { console.warn('[Life] хроника: заметка', e); }
    if (!lines.length) return '';
    return `[Раньше в истории — сжато, от давнего к недавнему (▬ арка, ▪ глава, • день, ◆ важное как есть); это было, персонажи это помнят — не противоречь и не пересказывай:\n${lines.join('\n')}]`;
}

// ───────────── вид: Мир → Дни, внизу ─────────────

export function sagaHtml() {
    if (!A?.hasChat?.()) return '';
    const c = cfg();
    const head = A.sec('Хроника', c.on ? 'дни → главы → арки' : 'выключена');
    const cfgRow = `<div class="lf-chips wrap">
        <button class="lf-chip${c.on ? ' on' : ''}" data-act="sg-on">${A.icon('power')} ${c.on ? 'идёт модели' : 'не идёт'}</button>
        ${[3, 5, 7].map(n => `<button class="lf-chip${c.per === n ? ' on' : ''}" data-act="sg-per" data-v="${n}">глава — ${n} ${A.plural(n, 'день', 'дня', 'дней')}</button>`).join('')}
        ${[3, 4, 6].map(n => `<button class="lf-chip${c.keep === n ? ' on' : ''}" data-act="sg-keep" data-v="${n}">главами — последние ${n}</button>`).join('')}</div>`;
    if (!c.on) return `${head}${cfgRow}<div class="lf-hint">Выключена. Включишь («не идёт» → «идёт модели») — старые дни сами сложатся в главы, главы — в арки, и модель будет видеть всё прошлое сжато. Складывает дешёвая модель, по три главы за раз после поста: в длинном чате сначала догонит историю (запрос на каждые ${c.per} закрытых ${A.plural(c.per, 'день', 'дня', 'дней')}), дальше — один запрос на новую главу.</div>`;
    const p = plan();
    const s = M();
    const need = stale();
    const dayRow = (k) => { const d = daySum(k); return `<div class="lf-sg-d${s.pins[k] ? ' pin' : ''}"><button data-act="sg-pin" data-k="${esc(k)}" title="${s.pins[k] ? 'сжимать как все' : 'не сжимать'}">${s.pins[k] ? '◆' : '◇'}</button><span><b>${esc(dayLabel(k, p.raw[k], true))}</b> ${d ? esc(A.cut(d.text, 150)) : '<i>итог дня ещё не собран</i>'}</span></div>`; };
    const card = (kind, id, keys, text, edited, ready) => `<details class="lf-sg-c ${kind}"><summary><b>${kind === 'arc' ? '▬ Арка' : '▪ Глава'} · ${esc(span(keys, p.raw))}</b><span>${text ? esc(text) : ready ? '<i>ещё не собрана</i>' : '<i>ждёт итогов дней (Мир → Дни → «Собрать все дни»)</i>'}</span></summary>
        <div class="lf-chips wrap"><button class="lf-chip" data-act="sg-edit" data-kind="${kind}" data-id="${esc(id)}">${A.icon('pencil')} править</button><button class="lf-chip" data-act="sg-redo" data-kind="${kind}" data-id="${esc(id)}">${A.icon('refresh')} пересобрать</button>${edited ? '<span class="lf-sg-ed">правлено руками — сама не перезапишется</span>' : ''}</div>
        ${keys.map(dayRow).join('')}</details>`;
    const arcs = p.arcs.map(a => card('arc', a.id, a.keys, s.arcs[a.id]?.text || '', s.arcs[a.id]?.edited, a.ids.every(id => s.ch[id]))).join('');
    const chs = p.chapters.map(ch => card('ch', ch.id, ch.keys, s.ch[ch.id]?.text || '', s.ch[ch.id]?.edited, chReady(ch.keys))).join('');
    const loose = p.loose.length ? `<div class="lf-sg-loose"><small>Ещё не сложены в главу:</small>${p.loose.map(dayRow).join('')}</div>` : '';
    const empty = !arcs && !chs && !loose;
    return `${head}${cfgRow}
    ${empty ? '<div class="lf-hint">Пока всё прошлое помещается в «Последние дни». Когда дней станет больше, старые сами сложатся в главы, главы — в арки.</div>' : `<div class="lf-sg">${arcs}${chs}${loose}</div>`}
    ${need.length ? `<button class="lf-btn full" data-act="sg-run">${A.icon('refresh')} Собрать сейчас · ${need.length}</button>` : ''}
    <div class="lf-hint">◇ у дня — булавка «не сжимать»: его итог пойдёт модели как есть, на любой ступени. Свод (Мир → Свод) — отдельное большое досье, в каждый пост не уходит.</div>`;
}

export async function sagaClick(act, el) {
    if (!act.startsWith('sg-')) return false;
    const c = cfg();
    const s = M();
    const kind = el.dataset.kind === 'arc' ? 'arcs' : 'ch';
    const id = el.dataset.id;
    switch (act) {
        case 'sg-on': c.on = !c.on; A.saveSettings(); break;
        case 'sg-per': c.per = Number(el.dataset.v); A.saveSettings(); break;
        case 'sg-keep': c.keep = Number(el.dataset.v); A.saveSettings(); break;
        case 'sg-pin': { const k = el.dataset.k; if (s.pins[k]) delete s.pins[k]; else s.pins[k] = true; A.saveMeta(); sagaAfterPost(); break; }
        case 'sg-run': await A.withBusy(el, async () => { const n = await runSaga({ max: 12 }); A.toast(last.err ? 'warning' : 'success', last.err ? esc(last.err) : n ? `Собрано: ${n}` : 'Всё уже собрано', '✦ Хроника', { timeOut: 3000 }); }, 'Собираю…'); break;
        case 'sg-redo': if (s[kind][id]) { delete s[kind][id]; A.saveMeta(); } await A.withBusy(el, () => runSaga({ max: 2 }), 'Собираю…'); break;
        case 'sg-edit': {
            A.openSheet(`${A.icon('pencil')} ${kind === 'arcs' ? 'Арка' : 'Глава'}`, `<div class="lf-field"><textarea rows="7" data-in="sg-text">${esc(s[kind][id]?.text || '')}</textarea></div>
                <button class="lf-btn primary full" data-act="sg-save" data-kind="${el.dataset.kind}" data-id="${esc(id)}">${A.icon('check')} Сохранить</button>
                <div class="lf-hint">Правленое руками Летописец не перезапишет. «Пересобрать» — вернуть ему.</div>`);
            return true;
        }
        case 'sg-save': {
            const t = str((el.closest('.lf-sheet') || document).querySelector('[data-in="sg-text"]')?.value, 900);
            if (t) s[kind][id] = { ...(s[kind][id] || {}), text: t, edited: true, at: Date.now() }; else delete s[kind][id];
            A.saveMeta(); A.closeSheet();
            break;
        }
        default: return false;
    }
    A.updatePrompt(); A.render();
    return true;
}
