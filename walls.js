// Глухие стены. Кто видел и слышал каждый пост. В группе на ход персонажа из контекста модели уходят посты, где его не
// было: кто был в сцене — по Horae (он пишет это в каждый ответ, так что история размечена задним числом), кто на линии —
// по звонку (call.js), кто слышал из соседней комнаты — суперслух (Баки, Стив), кто подслушал или смотрел через камеру —
// по Летописцу, и её поправки — «глазик» у поста. Вместо вырезанного — одна строка «пропуск: N постов», без скачка.
// Свои заметки Life тоже по свидетелям: «Последние дни» (days.js) — только то, что он видел; кого нет в сцене, тот не
// получает её заметок (мизансцена, близость, под словами, дом…). Вернулся — «Пока тебя не было»: не пересказ, а то,
// что он может знать сам (следы, перемены, что ему сказали). Память (меморибук, векторы, события Horae) этим не режется —
// там остаётся «Кто что знает» (know.js). Идея — Immersion Director (moonnsy): там присутствие ставят руками или
// парсером; здесь его уже ведёт Horae.

import { callAt } from './call.js';
import { duoNames, duoLiveFor } from './duo.js';
import { knockActive } from './knock.js';
import { whereAll } from './whois.js';
import { agendaOf } from './agenda.js';
import { isCutMsg, cutArmedFor } from './cut.js';
import { str, arr } from './hudkit.js';

const duoOf = (mes) => { try { return duoNames(mes); } catch { return []; } };

let A = null;
export function initWalls(api) {
    A = api;
    try {
        const { eventSource, eventTypes: E } = A.ctx();
        if (E?.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, () => { memo = { sig: '', rows: [] }; picked = null; lastRun = null; });
    } catch (e) { console.warn('[Life] глухие стены: события', e); }
}

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const RANK = { author: 6, here: 5, hand: 4, saw: 3, phone: 2, heard: 1 };
export const HOWL = { author: 'пишет пост', here: 'был рядом', saw: 'видел (камера, окно)', phone: 'на линии', heard: 'слышал за стеной', hand: 'ты отметила' };
const OPTS = [['here', 'рядом'], ['phone', 'на линии'], ['heard', 'слышал'], ['saw', 'видел'], ['away', 'не было']];

const DEF = { on: true, eye: true, back: true, scene: true, gap: true, hearText: 'Bucky, Баки, Winter Soldier, Зимний, Steve, Стив' };
export function wallsCfg() {
    const s = A.settings();
    if (!s.wit || typeof s.wit !== 'object') s.wit = {};
    const c = s.wit;
    for (const [k, v] of Object.entries(DEF)) if (c[k] === undefined) c[k] = v;
    return c;
}
const on = () => !!A && A.settings().enabled !== false && wallsCfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.walls || typeof cm.walls !== 'object') cm.walls = {};
    const w = cm.walls;
    if (!w.back || typeof w.back !== 'object') w.back = {};
    if (!Number.isFinite(w.v)) w.v = 0;
    return w;
}
const bump = () => { M().v++; };

/** Главные этой группы без её персоны и рассказчика (канонические имена). */
function mainsNow() {
    const U = A.ctx().name1;
    return (A.groupMembers() || []).map(A.canonName).filter((n, k, a) => n && !NARR.test(n) && !A.sameName(n, U) && a.findIndex(x => A.sameName(x, n)) === k);
}
function present() { try { return (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); } catch { return []; } }
const has = (list, n) => list.some(x => A.sameName(x, n));
function namesIn(text) { try { return A.namesInText?.(text) || []; } catch { return []; } }
const plain = (m) => (A.plainText ? A.plainText(m?.mes || '') : String(m?.mes || ''));

/** Кто слышит через стенку: главные этой группы, чьё имя в списке «суперслух». */
function hearers() {
    const list = String(wallsCfg().hearText || '').split(/[,;\n]/).map(x => A.norm(x)).filter(x => x.length >= 3);
    if (!list.length) return [];
    return mainsNow().filter(n => { const k = A.norm(n); return list.some(h => k === h || k.startsWith(h) || A.sameName(n, h)); });
}

// ───────────── кто видел пост ─────────────

/** Кто в сцене по Horae у поста модели (null — Horae не записал). */
function presOf(m) {
    if (!m || m.is_user || m.extra?.type === 'comment' || m.extra?.type === 'narrator' || m.extra?.life) return null;
    const p = m.horae_meta?.scene?.characters_present;
    return Array.isArray(p) && p.length ? p.map(A.canonName).filter(Boolean) : null;
}

let memo = { sig: '', rows: [] };
function sigNow() {
    const chat = A.chatArr();
    const n = chat.length;
    let tail = '';
    for (let i = Math.max(0, n - 6); i < n; i++) {
        const m = chat[i];
        tail += `${m?.swipe_id ?? ''}:${String(m?.mes || '').length}:${(m?.horae_meta?.scene?.characters_present || []).join(',')}:${m?.extra?.lifeCut ? 'c' : ''}:${m?.extra?.lifeWit ? JSON.stringify(m.extra.lifeWit) : ''}|`;
    }
    let cs = 0;
    try { cs = Object.keys(A.chronStore?.() || {}).length; } catch { /* */ }
    return `${A.ctx().chatId || A.ctx().groupId}|${n}|${A.chatMeta().ver || 0}|${M().v}|${cs}|${A.hash(tail)}`;
}

function rowsAll() {
    const sig = sigNow();
    if (memo.sig === sig) return memo.rows;
    const chat = A.chatArr();
    const n = chat.length;
    const own = new Array(n).fill(null);
    for (let i = 0; i < n; i++) if (!isCutMsg(chat[i])) own[i] = presOf(chat[i]);
    const prev = new Array(n).fill(-1);
    const next = new Array(n).fill(-1);
    let p = -1;
    for (let i = 0; i < n; i++) { prev[i] = p; if (own[i]) p = i; }
    let q = -1;
    for (let i = n - 1; i >= 0; i--) { next[i] = q; if (own[i]) q = i; }
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
        try { out[i] = rowOf(i, chat[i], own, prev[i], next[i]); } catch (e) { console.warn('[Life] глухие стены: пост', i, e); out[i] = { known: false, w: [] }; }
    }
    memo = { sig, rows: out };
    return out;
}

function rowOf(i, m, own, pi, ni) {
    if (!m || m.extra?.life || m.extra?.lifeGap) return { known: false, w: [] };
    const w = new Map();
    const add = (name, how) => {
        const c = A.canonName(name);
        if (!c) return;
        const k = [...w.keys()].find(x => A.sameName(x, c)) || c;
        if (!w.has(k) || RANK[how] > RANK[w.get(k)]) w.set(k, how);
    };
    let known = false;
    if (isCutMsg(m)) {
        // «Тем временем»: видят только те, кто в этой сцене
        known = true;
        for (const x of m.horae_meta?.scene?.characters_present || []) add(x, 'here');
    } else if (own[i]) {
        known = true;
        own[i].forEach(x => add(x, 'here'));
    } else {
        // её пост, пост без записи Horae, СМС телефона: кто был в сцене до него; кто появился после — если назван в посте
        const base = pi >= 0 ? own[pi] : (ni >= 0 ? own[ni] : null);
        if (base) { known = true; base.forEach(x => add(x, 'here')); }
        if (pi >= 0 && ni >= 0) {
            const named = namesIn(plain(m));
            for (const x of own[ni]) if (has(named, x)) add(x, 'here');
        }
    }
    if (known) {
        // на линии: звонок, который шёл в этом посте
        try { const c = callAt(i)?.c; if (c?.a) add(c.a, 'phone'); if (c?.b) add(c.b, 'phone'); } catch { /* */ }
        // Летописец: кто подслушал, слышал за стенкой, видел через камеру
        const fromChron = (k) => { try { return arr(A.chronOf(k)?.wit); } catch { return []; } };
        for (const r of fromChron(i)) if (r?.who) add(r.who, RANK[r.how] ? r.how : 'heard');
        // её пост между ответами: кто слышал за стенкой ответ до него — слышал и её
        if (m.is_user && pi >= 0) for (const r of fromChron(pi)) if (r?.who && r.how === 'heard') add(r.who, 'heard');
    }
    // её поправки — поверх всего
    const fix = m.extra?.lifeWit;
    if (fix && typeof fix === 'object') {
        for (const [n, how] of Object.entries(fix)) {
            const k = [...w.keys()].find(x => A.sameName(x, n));
            if (how === 'away') { if (k) w.delete(k); } else { if (k) w.delete(k); w.set(A.canonName(n) || n, RANK[how] ? how : 'here'); }
        }
        known = true;
    }
    // автор (и второй голос поста на двоих) видел свой пост всегда — даже если поправкой отмечено «не было»
    if (!m.is_user) {
        for (const x of [m.name, ...duoOf(m.mes)]) {
            const k = [...w.keys()].find(y => A.sameName(y, x));
            if (k) w.delete(k);
            w.set(A.canonName(x) || x, 'author');
        }
    }
    return { known, w: [...w.entries()] };
}

/** Запись поста i: { known, w: [[имя, как]] }. */
export function wallsRow(i) { return A?.hasChat?.() ? rowsAll()[i] || { known: false, w: [] } : { known: false, w: [] }; }

/** Видел ли who (или кто-то из списка) пост i. Нет данных — видели все. */
export function wallsSees(i, who) {
    if (!A?.hasChat?.()) return true;
    const r = rowsAll()[i];
    if (!r || !r.known) return true;
    const list = Array.isArray(who) ? who : [who];
    return r.w.some(([n]) => list.some(x => A.sameName(x, n)));
}

// ───────────── чей ход ─────────────

let picked = null;    // { who, at } — выбрала его в «Кто ответит?»: на её пост он отвечает, даже если его нет в сцене
let lastRun = null;   // { S, removed, at } — для Сцены

/** «Кто ответит?» выбрал этого героя — её последний пост он получает, даже если его нет в сцене (пишет ему, звонит…). */
export function wallsPicked(who) { if (A) picked = { who: A.canonName(who), at: Date.now() }; }

function speaker(type) {
    if (!on() || !A.hasChat() || type === 'quiet' || type === 'impersonate') return null;
    const c = A.ctx();
    if (!c.groupId) return null;
    const S = A.canonName(String(c.name2 || '').trim());
    if (!S || NARR.test(S) || A.sameName(S, c.name1) || !has(mainsNow(), S)) return null;
    let P = '';
    try { P = duoLiveFor(S) || ''; } catch { /* */ }
    return { S, P, writers: P ? [S, P] : [S] };
}

/** Для заметок Life (дни): чьими глазами этот ход — [S] или [S, второй]; [] — без фильтра. */
export function wallsWho(type) { const s = speaker(type); return s ? s.writers : []; }

/** Индекс поста, который сейчас пишется. */
function curT(type) { const n = A.chatArr().length; return ['swipe', 'regenerate', 'continue'].includes(type) ? n - 1 : n; }

/** Говорящего нет в сцене: { S, how } (how: call | text | come | cut | ''), иначе null. */
export function wallsAway(type) {
    const s = speaker(type);
    if (!s || wallsCfg().scene === false) return null;
    const pr = present();
    if (!pr.length || has(pr, s.S) || (s.P && has(pr, s.P))) return null;
    let how = '';
    try { const k = knockActive(); if (k && A.sameName(k.who, s.S)) how = k.how || ''; } catch { /* */ }
    try { if (cutArmedFor(s.S, type)) how = 'cut'; } catch { /* */ }
    return { S: s.S, how };
}

// заметки, привязанные к сцене: кого в ней нет, тот их не получает (входит в дверь — видит место, но не близость)
const SCENE_IDS = new Set(['life-under', 'life-stage', 'life-heat', 'life-lust', 'life-dice', 'life-duel', 'life-bicker', 'life-house', 'life-home', 'life-smell', 'life-crowd', 'life-fight', 'life-stones']);
const ON_ARRIVAL = new Set(['life-stage', 'life-fight', 'life-crowd', 'life-house', 'life-home', 'life-smell']);
/** Не давать эту заметку (id модуля моста или 'mood') тому, кого нет в сцене. */
export function wallsDrop(id, away) {
    if (!away) return false;
    if (id === 'mood') return away.how !== 'come';
    if (!SCENE_IDS.has(id)) return false;
    return !(away.how === 'come' && ON_ARRIVAL.has(id));
}

// ───────────── перехват: что уходит модели ─────────────

function stamp(i) {
    const chat = A.chatArr();
    for (let j = i; j >= 0 && j > i - 10; j--) { const ts = chat[j]?.horae_meta?.timestamp; if (ts?.story_time || ts?.story_date) return ts; }
    return null;
}
function spanText(a, b) {
    if (!a || !b) return '';
    const t = (x) => String(x?.story_time || '').trim();
    const d = (x) => String(x?.story_date || '').trim();
    if (d(a) && d(a) === d(b)) return t(a) && t(b) && t(a) !== t(b) ? `${t(a)}–${t(b)}` : '';
    if (d(a) && d(b)) return `${[d(a), t(a)].filter(Boolean).join(' ')} — ${[d(b), t(b)].filter(Boolean).join(' ')}`;
    return '';
}

function gapNote(run, S) {
    const chat = A.chatArr();
    const real = run.filter(i => !isCutMsg(chat[i]));
    if (!real.length) return null;   // одни «Тем временем» — время не шло, просто не его сцена
    const span = spanText(stamp(real[0]), stamp(real[real.length - 1]));
    const sh = A.shortName(S);
    return {
        name: 'Life', is_user: false, is_system: false, send_date: '', swipe_id: 0,
        mes: `[Пропуск: ${real.length} ${A.plural(real.length, 'пост', 'поста', 'постов')}${span ? ` (${span})` : ''} — то, чего ${sh} не видит и не слышит. Знает об этом ${sh} только то, что потом скажут, напишут или что видно по следам.]`,
        extra: { type: 'narrator', lifeGap: true },
    };
}

/**
 * Перехват генерации (life_intercept): из chat (копия сообщений, которую таверна отдаёт расширениям) убрать посты,
 * которых говорящий не видел; вместо каждой такой полосы — одна строка-пропуск. Свои посты, посты без данных Horae
 * и её последний пост (если она зовёт его по имени или выбрала его в «Кто ответит?») — остаются.
 */
export function wallsFilter(chat, type) {
    const sp = speaker(type);
    if (!sp || !Array.isArray(chat) || !chat.length) return null;
    const full = A.chatArr();
    const R = rowsAll();
    const nonSys = [];
    full.forEach((m, i) => { if (m && (!m.is_system || Array.isArray(m.extra?.tool_invocations))) nonSys.push(i); });
    const byKey = new Map();
    full.forEach((m, i) => { if (m) { const k = `${m.name}|${m.send_date}`; if (!byKey.has(k)) byKey.set(k, i); } });
    const idxOf = (it) => {
        if (!it || it.extra?.lifeGap) return -1;
        const c = Number.isInteger(it.index) ? nonSys[it.index] : undefined;
        const m = c !== undefined ? full[c] : null;
        if (m && m.name === it.name && String(m.send_date ?? '') === String(it.send_date ?? '')) return c;
        const k = byKey.get(`${it.name}|${it.send_date}`);
        return k === undefined ? -1 : k;
    };
    const W = sp.writers;
    const sees = (c) => { const r = R[c]; return !r || !r.known || r.w.some(([n]) => has(W, n)); };
    const isAuthor = (m) => !m.is_user && (has(W, m.name) || duoOf(m.mes).some(n => has(W, n)));
    // хвост — её посты после последнего ответа: на них сейчас отвечают
    let tailFrom = chat.length;
    for (let k = chat.length - 1; k >= 0; k--) { if (chat[k]?.is_user) tailFrom = k; else break; }
    let cutaway = false;
    try { cutaway = cutArmedFor(sp.S, type); } catch { /* */ }
    const t = curT(type);
    const s = M();
    let keepTail = false;
    if (!cutaway) {
        if (picked && Date.now() - picked.at < 120e3 && A.sameName(picked.who, sp.S)) { s.tail = { who: sp.S, t }; picked = null; A.saveMeta(); }
        keepTail = !!(s.tail && s.tail.t === t && A.sameName(s.tail.who, sp.S));
        if (!keepTail) for (let k = tailFrom; k < chat.length && !keepTail; k++) keepTail = namesIn(plain(chat[k])).some(n => has(W, n));
    }
    const out = [];
    let run = [];
    let removed = 0;
    const flush = () => {
        if (!run.length) return;
        if (wallsCfg().gap !== false) { const note = gapNote(run, sp.S); if (note) out.push(note); }
        run = [];
    };
    for (let k = 0; k < chat.length; k++) {
        const it = chat[k];
        const c = idxOf(it);
        let keep = true;
        if (c >= 0) {
            const m = full[c];
            if (m && !isAuthor(m) && !sees(c)) keep = k >= tailFrom && keepTail;
        }
        if (keep) { flush(); out.push(it); } else { run.push(c); removed++; }
    }
    flush();
    lastRun = { S: sp.S, removed, at: Date.now() };
    if (!removed) return { removed: 0 };
    chat.splice(0, chat.length, ...out);
    return { removed };
}

// ───────────── «Пока тебя не было» ─────────────

const post = (m) => !!m && !m.is_system && !isCutMsg(m) && !m.extra?.lifeGap && (m.is_user || !m.extra?.type);
const authored = (m, S) => !m.is_user && (A.sameName(m.name, S) || duoOf(m.mes).some(n => A.sameName(n, S)));

/** Он только что вернулся (в сцене или входит в дверь), а перед этим ≥2 поста шли без него: { from, to, n }. */
function backGap(S, t) {
    const full = A.chatArr();
    const R = rowsAll();
    let k = null;
    try { k = knockActive(); } catch { /* */ }
    const entering = !!(k && !k.used && A.sameName(k.who, S) && k.how === 'come');
    if (!entering && !has(present(), S)) return null;
    const sees = (i) => !!R[i]?.known && R[i].w.some(([n]) => A.sameName(n, S));
    let i = Math.min(t, full.length) - 1;
    let seen = 0;
    while (i >= 0 && seen <= 6) {
        const m = full[i];
        if (post(m)) {
            if (authored(m, S)) return null;          // он уже писал после возвращения
            if (!R[i]?.known) return null;
            if (!sees(i)) break;
            seen++;
        }
        i--;
    }
    if (i < 0 || seen > 6) return null;
    const to = i;
    let from = i;
    let n = 0;
    while (i >= 0) {
        const m = full[i];
        if (post(m)) { if (!R[i]?.known || sees(i)) break; from = i; n++; }
        i--;
    }
    return n >= 2 ? { from, to, n } : null;
}

const keyOf = (S, g) => `${A.norm(S)}|${g.from}|${g.to}`;
const inflight = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function backText(S, g, see = [], told = [], guess = '') {
    const sh = A.shortName(S);
    const span = spanText(stamp(g.from), stamp(g.to));
    const head = `[${sh} — после отсутствия (${g.n} ${A.plural(g.n, 'пост', 'поста', 'постов')} без этого героя${span ? `, ${span}` : ''}).`;
    if (!see.length && !told.length && !guess) return `${head} Что было за это время, ${sh} не знает: только то, что видно сейчас (место, люди, их вид) и что сообщили сами. Не ссылается и не намекает на остальное.]`;
    return `${head} Вот всё, что ${sh} знает и замечает: ${see.join('; ') || 'ничего особенного'}${told.length ? `. Сообщили сами: ${told.join('; ')}` : ''}${guess ? `. Может догадаться: ${guess}` : ''}. Остального, что было в это время, ${sh} не знает: не ссылается, не намекает, не ведёт себя так, будто знает.]`;
}

async function makeBack(S, g) {
    const full = A.chatArr();
    const st = A.worldState();
    const pr = present();
    const lines = [];
    for (let i = g.from; i <= g.to; i++) { const m = full[i]; if (post(m)) lines.push(`${m.name}: ${A.cut(plain(m), 1500)}`); }
    let ag = null;
    try { ag = agendaOf(S); } catch { /* */ }
    const wear = Object.entries(st.costumes || {}).filter(([n]) => has(pr, n)).map(([n, c]) => `${A.shortName(n)}: ${A.cut(typeof c === 'string' ? c : JSON.stringify(c), 180)}`).join('; ');
    const sys = `Ты помогаешь автору ролевой истории. ${S} возвращается в сцену после отсутствия — этого героя не было, пока шли посты ниже. Напиши, что ${S} может знать или заметить СЕЙЧАС: только видимое, слышимое и то, что ему сообщили сами. Можно: перемены в людях и месте (одежда, раны, следы, беспорядок, запахи, настроение, кто где), то, что говорили по телефону или писали ему самому, что было в новостях. Нельзя: пересказывать разговоры и события, при которых его не было, выдавать мысли, тайны и интимные подробности — если что-то видно по следам, называй след, а не событие. Ответ — строго один JSON по-русски: {"see":["что видно и заметно, 2–5 коротких пунктов"],"told":["что ему сообщили сами, 0–3"],"guess":"о чём можно догадаться по видимому — одна фраза или пусто"}.`;
    const usr = `Кто: ${S}. Где был: ${[ag?.where, ag?.now].filter(Boolean).join(' — ') || 'неизвестно'}.
Сейчас: ${st.scene?.location || '—'}${st.timestamp?.story_date ? `, ${[st.timestamp.story_date, st.timestamp.story_time].filter(Boolean).join(' ')}` : ''}; в сцене: ${pr.join(', ') || '—'}.${wear ? `\nОдежда сейчас: ${wear}.` : ''}
Что было без него (это для тебя, не для него):
${A.cut(lines.join('\n\n'), 9000)}`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 800, { check: (x) => Array.isArray(x?.see), what: 'Пока тебя не было' });
    return backText(S, g, arr(j.see).map(x => str(x, 180)).filter(Boolean).slice(0, 5), arr(j.told).map(x => str(x, 180)).filter(Boolean).slice(0, 3), str(j.guess, 220));
}

function trimBack() {
    const b = M().back;
    const keys = Object.keys(b).sort((x, y) => (b[x].at || 0) - (b[y].at || 0));
    for (const k of keys.slice(0, Math.max(0, keys.length - 12))) delete b[k];
}

/** Перед генерацией (перехват): если он только что вернулся — собрать «Пока тебя не было» (не дольше 20 секунд). */
export async function wallsReady(type) {
    if (!on() || wallsCfg().back === false || type === 'quiet' || type === 'impersonate') return;
    const sp = speaker(type);
    if (!sp) return;
    try { if (cutArmedFor(sp.S, type)) return; } catch { /* */ }
    const g = backGap(sp.S, curT(type));
    if (!g) return;
    const key = keyOf(sp.S, g);
    const s = M();
    if (s.back[key]?.text) return;
    let p = inflight.get(key);
    if (!p) {
        p = makeBack(sp.S, g)
            .then((text) => { s.back[key] = { text, at: Date.now() }; trimBack(); A.saveMeta(); })
            .catch((e) => console.warn('[Life] пока тебя не было', e))
            .finally(() => inflight.delete(key));
        inflight.set(key, p);
    }
    await Promise.race([p, sleep(20000)]);
}

/** Заметка модели: «Пока тебя не было» — на ход вернувшегося. */
export function wallsPrompt(type) {
    if (!on() || wallsCfg().back === false) return '';
    const sp = speaker(type);
    if (!sp) return '';
    try { if (cutArmedFor(sp.S, type)) return ''; } catch { /* */ }
    const g = backGap(sp.S, curT(type));
    if (!g) return '';
    return M().back[keyOf(sp.S, g)]?.text || backText(sp.S, g);
}

// ───────────── Летописец ─────────────

const RULE = `
wit — кто из главных, кого НЕТ в сцене, всё же видел или слышал этот пост: из соседней комнаты или за стенкой, по телефону или видео, через камеру, наушник, окно: [{"who":"имя","how":"heard|phone|saw"}]. Только если это прямо следует из текста поста. Нет — [].`;

export function wallsChron(i) {
    if (!on() || !A.hasChat() || !A.ctx().groupId) return null;
    const m = A.chatArr()[i];
    const pr = (m?.horae_meta?.scene?.characters_present?.length ? m.horae_meta.scene.characters_present : present()).map(A.canonName);
    const away = mainsNow().filter(n => !has(pr, n));
    const cut = isCutMsg(m) ? `\nЭтот пост — «Тем временем»: отдельная сцена ${m.extra.lifeCut.who} там, где этот герой сейчас, а не основная сцена. Мизансцену, настроение, близость и «кто в сцене» основной сцены по нему не меняй.` : '';
    if (!away.length && !cut) return null;
    let where = '';
    try { where = whereAll().filter(x => has(away, x.who)).map(x => `${A.shortName(x.who)} — ${x.loc || 'где-то'}${x.doing ? ` (${A.cut(x.doing, 60)})` : ''}`).join('; '); } catch { where = away.map(n => A.shortName(n)).join(', '); }
    return { key: '"wit": []', rule: RULE, tokens: 60, input: `Не в сцене из главных: ${where || '—'}.${cut}` };
}

/** Суперслух: кто из «слышащих» не в сцене, но в том же доме или месте (в другой комнате) — слышит пост. */
function hearWho(i) {
    const m = A.chatArr()[i];
    const loc = m?.horae_meta?.scene?.location || A.worldState().scene?.location || '';
    const top = A.norm(A.locTop(loc));
    if (!top) return [];
    const pr = (m?.horae_meta?.scene?.characters_present || []).map(A.canonName);
    const all = whereAll();
    const out = [];
    for (const h of hearers()) {
        if (has(pr, h)) continue;
        const x = all.find(y => A.sameName(y.who, h));
        if (x?.loc && x.src === 'agenda' && A.norm(A.locTop(x.loc)) === top) out.push(h);
    }
    return out;
}

export function wallsAfterPost(i, j, m) {
    if (!on()) return;
    let changed = false;
    const e = A.chronOf(i);
    if (e && A.ctx().groupId) {
        const mains = mainsNow();
        const list = arr(j?.wit).map(r => ({ who: A.canonName(str(r?.who, 50)), how: ['heard', 'phone', 'saw'].includes(str(r?.how)) ? str(r.how) : 'heard' }))
            .filter(r => r.who && has(mains, r.who)).slice(0, 4);
        try { for (const h of hearWho(i)) if (!list.some(r => A.sameName(r.who, h))) list.push({ who: h, how: 'heard' }); } catch { /* */ }
        if (list.length) { e.wit = list; changed = true; } else if (e.wit) { delete e.wit; changed = true; }
    }
    if (m && isCutMsg(m) && m.horae_meta && !m.horae_meta._skipHorae) { m.horae_meta._skipHorae = true; changed = true; try { A.ctx().saveChat?.(); } catch { /* */ } }
    bump();   // звонок, кадр, что угодно из этого поста — пересчитать, кто что видел
    if (changed) A.saveMeta();
}

// ───────────── глазик у поста ─────────────

function faceHtml(n, how) {
    const url = A.avatarUrl?.(n) || '';
    const letter = esc(String(n || '?').trim().charAt(0).toUpperCase());
    return `<span class="lf-wit-f h-${how}" title="${esc(A.shortName(n))}: ${esc(HOWL[how] || '')}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i>${letter}</i></span>`;
}

export function paintWalls(el, id) {
    const m = A.chatArr()[id];
    const nameEl = el.querySelector('.ch_name .name_text') || el.querySelector('.name_text');
    let box = el.querySelector('.lf-wit');
    const show = on() && wallsCfg().eye !== false && !!A.ctx().groupId && m && !m.is_system && m.extra?.type !== 'comment' && m.extra?.type !== 'narrator' && !!nameEl;
    const r = show ? wallsRow(id) : null;
    if (!show || !r?.known) { box?.remove(); return; }
    const U = A.ctx().name1;
    const others = r.w.filter(([n, how]) => how !== 'author' && !A.sameName(n, U) && !(!m.is_user && A.sameName(n, m.name)));
    const fixed = !!m.extra?.lifeWit;
    const html = `<button class="lf-wit-b${others.length ? '' : ' solo'}${fixed ? ' fixed' : ''}" data-act="wit-open" data-mes="${id}" title="Кто видел и слышал этот пост — тап, чтобы поправить">${A.icon('eye')}${others.map(([n, how]) => faceHtml(n, how)).join('')}</button>`;
    const sig = A.hash(html);
    if (box && box.dataset.sig === sig) return;
    if (!box) { box = document.createElement('span'); box.className = 'lf-wit lf-own'; }
    box.dataset.sig = sig;
    box.innerHTML = html;
    const after = nameEl.parentElement?.querySelector(':scope > .lf-duo-nm') || nameEl;
    if (box.previousElementSibling !== after) after.after(box);
}

function sheetHtml(i) {
    const m = A.chatArr()[i];
    if (!m) return '<div class="lf-empty small">Поста нет.</div>';
    const r = wallsRow(i);
    const fix = m.extra?.lifeWit || {};
    const row = (n) => {
        const cur = r.w.find(([x]) => A.sameName(x, n))?.[1] || 'away';
        const manual = Object.keys(fix).some(k => A.sameName(k, n));
        const author = !m.is_user && (A.sameName(m.name, n) || duoOf(m.mes).some(x => A.sameName(x, n)));
        const chips = author ? '<small class="lf-wit-me">пишет этот пост</small>'
            : `<div class="lf-chips wrap">${OPTS.map(([k, l]) => `<button class="lf-chip${cur === k || (k === 'here' && cur === 'hand') ? ' on' : ''}" data-act="wit-set" data-mes="${i}" data-who="${esc(n)}" data-v="${k}">${l}</button>`).join('')}${manual ? `<button class="lf-chip ghost" data-act="wit-set" data-mes="${i}" data-who="${esc(n)}" data-v="auto" title="Как было по Horae">↺</button>` : ''}</div>`;
        return `<div class="lf-wit-row${cur === 'away' && !author ? ' away' : ''}">${A.ava(n, 'sm')}<div class="lf-wit-rt"><b>${esc(A.shortName(n))}</b>${chips}</div></div>`;
    };
    const mains = mainsNow();
    const src = r.known ? (fix && Object.keys(fix).length ? 'по Horae и твоим поправкам' : 'по Horae, звонкам и Летописцу') : 'Horae про этот пост ничего не записал — пока его видят все';
    return `<div class="lf-hint">${esc(m.is_user ? 'Твой пост' : `Пост ${A.shortName(m.name)}`)} · ${src}. На ход героя модель получает только посты, которые он видел или слышал; кого «не было», тот получит вместо них строку «пропуск».</div>
        <div class="lf-wit-list">${mains.map(row).join('') || '<div class="lf-empty small">В группе никого, кроме тебя.</div>'}</div>`;
}

function openSheet(i) {
    const show = () => A.openSheet(`${A.icon('eye')} Кто видел пост · #${i}`, sheetHtml(i));
    if (A.ui?.open) show(); else { A.openHub?.('scene'); setTimeout(show, 260); }
}

export async function wallsClick(act, el) {
    if (!act.startsWith('wit-')) return false;
    const i = Number(el.dataset.mes);
    if (act === 'wit-open') { if (Number.isFinite(i)) openSheet(i); return true; }
    if (act === 'wit-set') {
        const m = A.chatArr()[i];
        if (!m) return true;
        const who = A.canonName(el.dataset.who);
        const v = el.dataset.v;
        const fix = { ...(m.extra?.lifeWit || {}) };
        for (const k of Object.keys(fix)) if (A.sameName(k, who)) delete fix[k];
        if (v && v !== 'auto') fix[who] = v;
        m.extra = m.extra || {};
        if (Object.keys(fix).length) m.extra.lifeWit = fix; else delete m.extra.lifeWit;
        bump();
        A.saveMeta();
        try { await A.ctx().saveChat?.(); } catch { /* */ }
        A.paintSoon?.();
        try { A.updatePrompt?.(); } catch { /* */ }
        A.openSheet(`${A.icon('eye')} Кто видел пост · #${i}`, sheetHtml(i));
        return true;
    }
    return false;
}

// ───────────── Сцена ─────────────

function whereShort(n) {
    try { const x = whereAll().find(y => A.sameName(y.who, n)); return x ? [x.loc ? A.cut(x.loc, 40) : '', x.doing ? A.cut(x.doing, 60) : ''].filter(Boolean).join(' · ') : ''; } catch { return ''; }
}

export function wallsSceneHtml() {
    if (!on() || !A.hasChat() || !A.ctx().groupId) return '';
    const pr = present();
    const away = pr.length ? mainsNow().filter(n => !has(pr, n)) : [];
    const last = lastRun && Date.now() - lastRun.at < 60 * 60e3 ? lastRun : null;
    return `${A.sec('Глухие стены', away.length ? `${away.length} за стеной` : pr.length ? 'все здесь' : '')}
        <div class="lf-hint">На ход героя модель получает только посты, которые он видел и слышал: по Horae, звонкам, суперслуху и 👁 у постов (тап — поправить).${last ? ` Последний ход — ${esc(A.shortName(last.S))}: ${last.removed ? `не видел ${last.removed} ${A.plural(last.removed, 'пост', 'поста', 'постов')}` : 'видел всё'}.` : ''}</div>
        ${away.length ? `<div class="lf-wit-away">${away.map(n => { const w = whereShort(n); return `<div class="lf-wit-aw">${A.ava(n, 'sm')}<span><b>${esc(A.shortName(n))}</b>${w ? `<small>${esc(w)}</small>` : ''}</span><button class="lf-btn ghost" data-act="cut-go" data-who="${esc(n)}" title="Его сцена там, где он сейчас; остальные её не увидят">${A.icon('film')} Тем временем</button></div>`; }).join('')}</div>` : ''}`;
}
