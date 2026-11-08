// Жизнь вокруг: персонажи живут сами — инициатива, ухаживания, подарки, вкусы, распорядок дня;
// живой дом — следы сцен, записки, «пока тебя не было»; питомцы со своими потребностями; новости и слухи.
// Всё считает Летописец после поста (один запрос), а модели уходит короткая скрытая заметка.

import { icon } from './icons.js';
import { IDEA_KINDS, ideasSystem } from './chronicler.js';
import { initPeople, peopleChronOpts, peopleAfterPost } from './people.js';
import { initAgenda, agendaTick, agendaPrompt, agendaSceneHtml } from './agenda.js';
import { knockSceneHtml } from './knock.js';
import { loreAbout } from './inner.js';
import { initInner, innerChronOpts, innerAfterPost, innerPrompt, innerBrief, renderInner, renderCharacter, innerClick, innerSceneChips } from './inner.js';

let A = null;
export function initSim(api) { A = api; initInner(api); initPeople(api); try { initAgenda(api); } catch (e) { console.warn('[Life] закулисье', e); } }

const DEF = {
    on: true, tease: true, freq: 'mid', kinds: ['care', 'court', 'flirt', 'touch', 'spicy', 'gift', 'own', 'talk'],
    prefs: true, traces: true, pets: true, rumorsAuto: true, who: {}, sched: {}, home: '', inner: true, prof: {},
};

export function simCfg() {
    const s = A.settings();
    if (!s.sim || typeof s.sim !== 'object') s.sim = {};
    for (const [k, v] of Object.entries(DEF)) if (s.sim[k] === undefined) s.sim[k] = JSON.parse(JSON.stringify(v));
    // 0.9: новые виды инициативы — касания и пошлости — там, где уже разрешён флирт
    if (!s.sim._k9) {
        const add = (list) => (list.includes('flirt') ? [...new Set([...list, 'touch', 'spicy'])] : list);
        s.sim.kinds = add(s.sim.kinds);
        for (const w of Object.values(s.sim.who || {})) if (Array.isArray(w.kinds)) w.kinds = add(w.kinds);
        s.sim._k9 = true;
    }
    return s.sim;
}

function M() {
    const m = A.chatMeta();
    for (const k of ['ideas', 'offscreen', 'pets']) if (!Array.isArray(m[k])) m[k] = [];
    for (const k of ['prefs', 'traces', 'itemLog', 'initLast']) if (!m[k] || typeof m[k] !== 'object' || Array.isArray(m[k])) m[k] = {};
    return m;
}

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const isUser = (n) => A.sameName(n, A.ctx().name1);
const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const short = (n) => A.shortName(A.canonName(n));
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ───────────── время истории ─────────────

/** «Сейчас» по Horae: миллисекунды игровой даты (если есть), номер поста и час. */
export function rpNow() {
    const st = A.worldState();
    const mes = A.lastAiIndex();
    const tm = String(st.timestamp?.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
    const hour = tm ? +tm[1] : null;
    const d = A.parseDate(st.timestamp?.story_date);
    if (d && !isNaN(d)) { d.setHours(tm ? +tm[1] : 12, tm ? +tm[2] : 0, 0, 0); return { t: d.getTime(), mes, hour, min: tm ? +tm[1] * 60 + +tm[2] : null }; }
    return { t: null, mes, hour, min: tm ? +tm[1] * 60 + +tm[2] : null };
}

/** Сколько игровых часов прошло; без даты в Horae — по постам (~15 минут на пост). */
export function hoursSince(a, b = rpNow()) {
    if (!a) return 0;
    const h = a.t != null && b.t != null ? (b.t - a.t) / 3.6e6 : (b.mes - (a.mes ?? b.mes)) * 0.25;
    return Math.max(0, Math.min(96, h));
}

// ───────────── вкусы ─────────────

function prefsOf(who) { return M().prefs[A.canonName(who)] || []; }

function addPrefs(list, i) {
    const m = M();
    for (const x of list) {
        const who = A.canonName(x.who);
        if (!who) continue;
        const arr = m.prefs[who] = m.prefs[who] || [];
        const n = A.norm(x.text);
        const old = arr.find(y => A.norm(y.t) === n);
        if (old) { old.k = x.kind; continue; }
        arr.push({ t: x.text, k: x.kind, mes: i });
        if (arr.length > 40) arr.splice(0, arr.length - 40);
    }
}

function prefsLine(names) {
    return names.map(n => {
        const p = prefsOf(n);
        if (!p.length) return '';
        const like = p.filter(x => x.k !== 'dislike').map(x => x.t).slice(-10);
        const dis = p.filter(x => x.k === 'dislike').map(x => x.t).slice(-6);
        return `${short(n)} любит: ${like.join(', ') || '—'}${dis.length ? `; не любит: ${dis.join(', ')}` : ''}`;
    }).filter(Boolean).join('. ');
}

// ───────────── инициатива ─────────────

const FREQ = { off: [0, 0, 'Выкл'], rare: [0.12, 14, 'Редко'], mid: [0.25, 7, 'Умеренно'], often: [0.45, 3, 'Часто'] };
const KIND_ICON = { care: 'coffee', court: 'heart', flirt: 'flame', touch: 'handshake', spicy: 'sparkles', gift: 'gift', own: 'briefcase', talk: 'message', plot: 'feather' };

// ───────────── облик (ядро «Священный таймлайн») ─────────────

let lkMemo = { at: 0, cx: null };
/**
 * Ключ профиля персонажа (увлечения, распорядок, как часто делится): один человек в разных эпохах — разные профили.
 * В эпохе мира по умолчанию — просто имя (всё, что уже заполнено, остаётся на месте); в других эпохах — «имя@облик».
 * Без ядра и вне мира — имя, как раньше.
 */
export function lifeKey(who) {
    const k = A.canonName(who) || who;
    try {
        if (Date.now() - lkMemo.at > 500) lkMemo = { at: Date.now(), cx: globalThis.SacredTimeline?.context?.() || null };
        const cx = lkMemo.cx;
        if (!cx?.era || !cx.world || String(cx.era.id) === String(cx.world.defaultEra || '')) return k;
        const people = cx.people || {};
        const hit = people[who] || Object.entries(people).find(([n]) => A.sameName(n, who))?.[1];
        return hit?.slice ? `${k}@${hit.slice}` : k;
    } catch { return k; }
}

function aiChars() {
    const out = [];
    for (const n of A.groupMembers().map(A.canonName)) if (n && !isUser(n) && !out.some(x => A.sameName(x, n))) out.push(n);
    return out;
}
function whoCfg(n) {
    const c = simCfg();
    const w = c.who[lifeKey(n)] || {};
    return { freq: c.on ? (w.freq || c.freq) : 'off', kinds: Array.isArray(w.kinds) ? w.kinds : c.kinds };
}
function initChars() { return aiChars().filter(n => whoCfg(n).freq !== 'off'); }
function ideaById(id) { return M().ideas.find(x => x.id === Number(id)) || null; }

function addIdeas(list, i) {
    const m = M();
    const allowed = initChars();
    for (const x of list) {
        const who = allowed.find(n => A.sameName(n, x.who));
        if (!who || !whoCfg(who).kinds.includes(x.kind)) continue;
        if (m.ideas.some(y => A.sameName(y.who, who) && A.norm(y.text) === A.norm(x.text))) continue;
        m.ideaSeq = (m.ideaSeq || 0) + 1;
        m.ideas.push({ id: m.ideaSeq, who, kind: x.kind, text: x.text, when: x.when, where: x.where, mes: i, status: 'new' });
    }
    for (const who of new Set(m.ideas.map(y => y.who))) {
        const wait = m.ideas.filter(y => y.who === who && y.status === 'new');
        while (wait.length > 5) wait.shift().status = 'old';
    }
    for (const y of m.ideas) if (y.status === 'new' && i - y.mes > 90) y.status = 'old';
    if (m.ideas.length > 90) m.ideas = m.ideas.filter(y => y.status !== 'old').slice(-90);
}

function doneIdea(x, i) {
    const m = M();
    x.status = 'done';
    x.doneMes = i;
    m.initLast[x.who] = i;
    if (m.armed?.id === x.id) { m.lastInit = { id: x.id, mes: i }; m.armed = null; }
}

function homeLoc() {
    const c = simCfg();
    if (c.home) return c.home;
    const pl = Object.values(A.settings().places || {}).find(p => !String(p.name).includes('·') && (p.icon === 'home' || /квартир|дом\b|апартамент|пентхаус/i.test(p.name)));
    return pl ? (pl.raw || pl.name) : '';
}

function arm(x, i, manual = false) {
    const m = M();
    if (m.armed) { const old = ideaById(m.armed.id); if (old && old.status === 'armed') old.status = 'new'; }
    x.status = 'armed';
    m.armed = { id: x.id, at: i, manual };
}

function goOffscreen(x, i) {
    const m = M();
    const where = resolveWhere(x.where || homeLoc());
    doneIdea(x, i);
    x.off = true;
    m.offscreen.push({ id: A.uid(), idea: x.id, who: x.who, t: x.text, where, mes: i, at: rpNow(), seen: false });
    if (m.offscreen.length > 40) m.offscreen.splice(0, m.offscreen.length - 40);
    if (where) addTrace(where, { t: x.text, k: x.kind === 'gift' ? 'gift' : 'note', by: x.who, off: true }, i);
}

function maybeArm(i) {
    const m = M();
    if (m.armed) return null;
    // не чаще раза в три поста на всех, чтобы инициатива не превратилась в шум
    const lastAny = Math.max(-999, ...Object.values(m.initLast).map(Number).filter(Number.isFinite));
    if (i - lastAny < 3) return null;
    const present = (A.worldState().scene?.characters_present || []).map(A.canonName);
    for (const who of initChars().sort(() => Math.random() - 0.5)) {
        const [p, gap] = FREQ[whoCfg(who).freq] || FREQ.off;
        if (!p || i - (m.initLast[who] ?? -999) < gap || Math.random() > p) continue;
        const here = present.some(n => A.sameName(n, who));
        const pool = m.ideas.filter(x => x.status === 'new' && A.sameName(x.who, who) && (here ? x.when !== 'offscreen' : x.when === 'offscreen'));
        if (!pool.length) continue;
        const pick = rnd(pool);
        if (here) arm(pick, i); else goOffscreen(pick, i);
        return pick;
    }
    return null;
}

// ───────────── следы в местах ─────────────

const ROOM_RE = /кухн|спальн|гостин|ванн|прихож|коридор|балкон|кабинет|комнат|душ|гардеробн|детск|террас|подвал|чердак|гараж|столов/i;
const topKey = (loc) => A.placeKey(A.locTop(loc));

function resolveWhere(where) {
    const cur = A.worldState().scene?.location || '';
    if (!where) return cur;
    const known = A.knownLocations();
    const k = A.placeKey(where);
    if (known.has(k)) return known.get(k);
    const top = A.locTop(cur);
    if (top) {
        const k2 = A.placeKey(`${top}·${where}`);
        if (known.has(k2)) return known.get(k2);
        if (A.norm(A.locLeaf(cur)) === A.norm(where)) return cur;
        if (ROOM_RE.test(where) && !/[·・›>]/.test(where)) return `${top}·${where}`;
    }
    return where;
}

function addTrace(loc, tr, i) {
    const k = A.placeKey(loc);
    if (!k) return null;
    const m = M();
    const arr = m.traces[k] = m.traces[k] || [];
    if (arr.some(t => A.norm(t.t) === A.norm(tr.t))) return null;
    const t = { id: A.uid(), t: tr.t, k: tr.k || 'trace', mes: i, fresh: true, loc, by: tr.by || '', off: !!tr.off };
    arr.push(t);
    if (arr.length > 24) arr.splice(0, arr.length - 24);
    return t;
}

function tracesUnder(loc) {
    const t = topKey(loc);
    if (!t) return [];
    return Object.entries(M().traces).filter(([k, arr]) => (k === t || k.startsWith(t + '·')) && arr.length);
}
function tracesAt(key) { return M().traces[key] || []; }
function findTrace(id) {
    for (const [k, arr] of Object.entries(M().traces)) { const t = arr.find(x => x.id === id); if (t) return [k, t, arr]; }
    return [null, null, null];
}

function applyTraces(list, i) {
    const m = M();
    const cur = topKey(A.worldState().scene?.location || '');
    for (const x of list) {
        if (x.op === 'remove') {
            const n = A.norm(x.text);
            for (const [k, arr] of Object.entries(m.traces)) {
                if (cur && !(k === cur || k.startsWith(cur + '·'))) continue;
                const idx = arr.findIndex(t => { const tn = A.norm(t.t); return tn === n || tn.includes(n) || n.includes(tn); });
                if (idx >= 0) { arr.splice(idx, 1); break; }
            }
            continue;
        }
        addTrace(resolveWhere(x.where), { t: x.text, k: x.kind }, i);
    }
}

function tracesLine(loc) {
    return tracesUnder(loc).map(([k, arr]) => `${A.locLeaf(arr[0]?.loc || k)}: ${arr.map(t => t.t).join('; ')}`).join('. ');
}

// ───────────── вещи с памятью ─────────────

function applyItemStories(ops, i) {
    const m = M();
    for (const o of ops) {
        if (!['set', 'merge'].includes(o.op)) continue;
        const name = String(o.op === 'merge' ? o.into : o.name || '').trim();
        const story = String(o.story || '').trim();
        const from = String(o.from || '').trim();
        if (!name || (!story && !from)) continue;
        const key = A.norm(name);
        const log = m.itemLog[key] = m.itemLog[key] || [];
        if (log.some(e => e.mes === i && e.t === story)) continue;
        log.push({ mes: i, t: story, from: from ? A.canonName(from) : '', to: o.holder ? A.canonName(o.holder) : '', name });
        if (log.length > 30) log.splice(0, log.length - 30);
    }
}

export function itemHistoryHtml(name) {
    const log = M().itemLog[A.norm(name)] || [];
    if (!log.length) return '';
    return `<div class="lf-ihist">${log.slice().reverse().map(e => `<button class="lf-ihist-r" data-act="jump" data-mes="${e.mes}">
        ${icon(e.from ? 'gift' : 'clock')}<span>${e.from ? `<b>${esc(short(e.from))}${e.to && !A.sameName(e.to, e.from) ? ` → ${esc(short(e.to))}` : ''}</b> ` : ''}${esc(e.t || 'передал')}</span><small>#${e.mes}</small></button>`).join('')}</div>`;
}

function giftsOf(who) {
    const out = [];
    for (const log of Object.values(M().itemLog)) for (const e of log) if (e.from && (A.sameName(e.from, who) || A.sameName(e.to, who))) out.push(e);
    return out.sort((a, b) => b.mes - a.mes);
}

// ───────────── распорядок ─────────────

const SCHED_SYSTEM = `Ты составляешь распорядок обычного дня персонажа ролевой истории на русском — чтобы он жил своей жизнью, а не ждал игрока.
6–10 пунктов на сутки, без дыр: сон, работа или служба, тренировки, дела, привычки, время с близкими. Всё в его характере и обстоятельствах.
Ответь только JSON: {"items":[{"from":"07:00","to":"08:00","what":"пробежка","where":"Центральный парк"}]}. what — 1–4 слова, where — место или пусто.`;

function schedOf(who) { return simCfg().sched[lifeKey(who)] || []; }
const toMin = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };

export function nowSlot(who, now = rpNow()) {
    const list = schedOf(who);
    if (!list.length || now.min == null) return null;
    return list.find(x => {
        const a = toMin(x.from); const b = toMin(x.to);
        if (a == null || b == null) return false;
        return a <= b ? now.min >= a && now.min < b : now.min >= a || now.min < b;
    }) || null;
}

async function genSched(who) {
    const c = A.ctx();
    const card = (c.characters || []).find(x => x.name === A.canonName(who));
    const desc = [card?.description, card?.personality, card?.scenario].filter(Boolean).join('\n').replace(/\{\{user\}\}/gi, userName()).replace(/\{\{char\}\}/gi, who).slice(0, 4500);
    const out = await A.askModel([{ role: 'system', content: SCHED_SYSTEM }, {
        role: 'user', content: `Персонаж: ${who}\nИгрок пишет за: ${userName()}\n${desc ? `Карточка персонажа:\n${desc}\n` : ''}${prefsLine([who]) ? `Известно: ${prefsLine([who])}\n` : ''}${innerBrief(who) ? `Он сам: ${innerBrief(who)}` : ''}`,
    }], 900);
    const j = A.extractJson(out);
    const items = Array.isArray(j?.items) ? j.items : [];
    const list = items.map(x => ({ from: String(x.from || '').trim(), to: String(x.to || '').trim(), what: String(x.what || '').trim().slice(0, 60), where: String(x.where || '').trim().slice(0, 60) }))
        .filter(x => toMin(x.from) != null && toMin(x.to) != null && x.what);
    if (!list.length) throw new Error('модель не прислала распорядок');
    simCfg().sched[lifeKey(who)] = list;
    A.saveSettings();
}

function parseSched(text) {
    const out = [];
    for (const line of String(text || '').split('\n')) {
        const m = line.trim().match(/^(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})\s+(.+?)(?:\s+[—@|]\s+(.+))?$/);
        if (m) out.push({ from: m[1].replace('.', ':'), to: m[2].replace('.', ':'), what: m[3].trim().slice(0, 60), where: (m[4] || '').trim().slice(0, 60) });
    }
    return out;
}

// ───────────── питомцы ─────────────

const PET_KINDS = {
    cat: { m: 'Домашний кот', f: 'Домашняя кошка', en: 'cat', needs: [['food', 'Сытость', 6], ['play', 'Игра', 5], ['love', 'Ласка', 4], ['tray', 'Лоток', 3], ['health', 'Здоровье', 0]] },
    dog: { m: 'Домашний пёс', f: 'Домашняя собака', en: 'dog', needs: [['food', 'Сытость', 6], ['play', 'Прогулка', 7], ['love', 'Ласка', 5], ['health', 'Здоровье', 0]] },
    other: { m: 'Питомец', f: 'Питомец', en: 'pet', needs: [['food', 'Сытость', 5], ['play', 'Внимание', 4], ['love', 'Ласка', 3], ['health', 'Здоровье', 0]] },
};
const NEED_ICON = { food: 'utensils', play: 'zap', love: 'heart', tray: 'sparkles', health: 'activity' };
// темперамент: [ключ, левый край м/ж, правый край м/ж]
const TEMPER = [
    ['affection', ['Независимый', 'Независимая'], ['Ласковый', 'Ласковая']],
    ['energy', ['Спокойный', 'Спокойная'], ['Шкодливый', 'Шкодливая']],
    ['bold', ['Пугливый', 'Пугливая'], ['Смелый', 'Смелая']],
    ['social', ['Только свои', 'Только свои'], ['Любит гостей', 'Любит гостей']],
];
const guessKind = (t) => { t = String(t || '').toLowerCase(); return /кош|кот|кис|cat/.test(t) ? 'cat' : /соба|пёс|пес|щен|dog/.test(t) ? 'dog' : 'other'; };
const pk = (p) => PET_KINDS[p.kind] || PET_KINDS.other;
/** Пол питомца: по полю, иначе по прилагательным в характере («наглая» → она). */
const isF = (p) => (p.sex ? p.sex === 'f' : (p.traits || []).some(t => /(ая|яя)$/i.test(String(t).trim())));
const pg = (p, m, f) => (isF(p) ? f : m);
const kindLabel = (p) => (isF(p) ? pk(p).f : pk(p).m);
const kindWord = (p) => kindLabel(p).toLowerCase().replace(/^домашн(ий|яя)\s+/, '');

function needOf(p, k, now = rpNow()) {
    const n = p.needs?.[k];
    if (!n) return k === 'health' ? 100 : 75;
    const rate = pk(p).needs.find(x => x[0] === k)?.[2] || 0;
    return clamp(n.v - rate * hoursSince(n.at, now));
}
function setNeed(p, k, v, now = rpNow()) { p.needs = p.needs || {}; p.needs[k] = { v: clamp(v), at: { t: now.t, mes: now.mes } }; }

function needWord(p, k, v) {
    const dog = p.kind === 'dog';
    if (k === 'food') return v >= 70 ? pg(p, 'Сыт', 'Сыта') : v >= 40 ? 'Не прочь перекусить' : v >= 20 ? pg(p, 'Голодный', 'Голодная') : 'Орёт от голода';
    if (k === 'play') return v >= 60 ? (dog ? pg(p, 'Нагулялся', 'Нагулялась') : pg(p, 'Наигрался', 'Наигралась')) : v >= 30 ? (dog ? 'Просится гулять' : 'Хочет играть') : (dog ? 'Скулит у двери' : 'Шкодит от скуки');
    if (k === 'love') return v >= 60 ? pg(p, 'Довольный', 'Довольная') : v >= 30 ? 'Ищет внимания' : pg(p, 'Обиделся', 'Обиделась');
    if (k === 'tray') return v >= 60 ? 'Лоток чистый' : v >= 30 ? 'Пора убрать лоток' : 'Лоток — беда';
    return v >= 70 ? pg(p, 'Здоров', 'Здорова') : v >= 40 ? pg(p, 'Вялый', 'Вялая') : pg(p, 'Болеет', 'Болеет');
}
function sleepy(p, now) {
    const h = now.hour;
    if (h == null) return false;
    return p.kind === 'dog' ? (h >= 23 || h < 6) : ((h >= 13 && h < 16) || (h >= 1 && h < 5));
}
function urgentText(p, k, v) {
    const dog = p.kind === 'dog';
    if (k === 'food' && v < 30) return dog ? pg(p, 'голоден — сидит у миски, скулит, ходит хвостом', 'голодна — сидит у миски, скулит, ходит хвостом') : pg(p, 'давно не ел — голоден, громко орёт, путается под ногами и требует еду', 'давно не ела — голодна, громко орёт, путается под ногами и требует еду');
    if (k === 'play' && v < 25) return dog ? pg(p, 'засиделся без прогулки — носится, тащит поводок, скулит у двери', 'засиделась без прогулки — носится, тащит поводок, скулит у двери') : pg(p, 'заскучал — шкодит, носится по дому, нападает на ноги', 'заскучала — шкодит, носится по дому, нападает на ноги');
    if (k === 'love' && v < 25) return pg(p, 'обижен, что на него не обращают внимания — то лезет на руки, то демонстративно игнорирует', 'обижена, что на неё не обращают внимания — то лезет на руки, то демонстративно игнорирует');
    if (k === 'tray' && v < 25) return 'лоток давно не убирали — демонстративно орёт у лотка, может сделать дела мимо назло';
    if (k === 'health' && v < 45) return `${pg(p, 'нездоров', 'нездорова')}${p.hurt ? ` (${p.hurt})` : ''} — ${pg(p, 'вялый', 'вялая')}, прячется`;
    return '';
}
function favOf(p) {
    if (p.favName) return p.favName;
    const top = (p.people || []).slice().sort((a, b) => (b.love || 0) - (a.love || 0))[0];
    if (top && (top.love || 0) >= 70) return top.name;
    const e = Object.entries(p.fav || {}).sort((a, b) => b[1] - a[1])[0];
    return e && e[1] >= 2 ? e[0] : '';
}
function findPet(name) {
    const n = A.norm(name);
    return M().pets.find(p => A.norm(p.name) === n || A.norm(p.name).split(' ')[0] === n.split(' ')[0]) || null;
}
function petById(id) { return M().pets.find(p => p.id === id) || null; }
function newPet({ name = 'Без имени', kind = 'cat', look = '' } = {}) {
    const p = { id: A.uid(), name, kind, look, traits: [], home: homeLoc(), img: '', fav: {}, favName: '', needs: {}, moments: [], on: true, hurt: '', sex: '', age: '', story: '', owner: '', people: [], likes: [], dislikes: [], habits: [], temper: {}, health: '' };
    const now = rpNow();
    for (const [k] of pk(p).needs) setNeed(p, k, k === 'health' ? 100 : 80, now);
    M().pets.push(p);
    return p;
}
const HOME_RE = /квартир|дом\b|домой|апартамент|пентхаус|кухн|спальн|гостин|комнат/i;
function petHere(p) {
    const loc = A.worldState().scene?.location || '';
    if (p.home) return !!loc && topKey(p.home) === topKey(loc);
    return HOME_RE.test(loc);
}

function applyPets(list, i) {
    const now = { ...rpNow(), mes: i };
    for (const e of list) {
        let p = findPet(e.name);
        if (!p && e.new) { p = newPet({ name: A.cap(e.name), kind: guessKind(e.kind), look: e.look }); A.toast('info', `В доме питомец: ${esc(p.name)}. Карточка — в «Персонаж».`, '✦ Life', { timeOut: 5000 }); }
        if (!p) continue;
        if (e.fed) setNeed(p, 'food', 100, now);
        if (e.played) setNeed(p, 'play', 100, now);
        if (e.petted) setNeed(p, 'love', needOf(p, 'love', now) + 45, now);
        if (e.cleaned && pk(p).needs.some(n => n[0] === 'tray')) setNeed(p, 'tray', 100, now);
        if (e.hurt) { setNeed(p, 'health', needOf(p, 'health', now) - 35, now); p.hurt = e.hurt; p.moments.push({ t: e.hurt, mes: i, bad: true }); }
        if (e.with) { const w = A.canonName(e.with); if (w) p.fav[w] = (p.fav[w] || 0) + 1; }
        if (e.moment) p.moments.push({ t: e.moment, mes: i, with: e.with ? A.canonName(e.with) : '' });
        if (p.moments.length > 40) p.moments.splice(0, p.moments.length - 40);
    }
}

function petState(p, now = rpNow()) {
    const needs = pk(p).needs.map(([k, label]) => { const v = needOf(p, k, now); return { k, label, v, word: needWord(p, k, v) }; });
    const urgent = needs.map(n => urgentText(p, n.k, n.v)).filter(Boolean);
    return { needs, urgent, sleepy: sleepy(p, now) && !urgent.length };
}

// ───────────── новости и слухи ─────────────

const RUMORS_SYSTEM = `Ты — городская хроника и сарафанное радио мира ролевой истории на русском (AU по Marvel).
Новости — как в СМИ этого мира: о публичных персонажах и компаниях, о городе и событиях, которые перекликаются с историей. Сухо, как заголовки и лиды.
Слухи — что говорят о героях знакомые, соседи, бармены, коллеги, таблоиды, соцсети: смесь правды, полуправды и вранья. Тайны в слухах — только искажённо или намёком, никогда не целиком.
Опирайся на свежие события. Не противоречь фактам истории (слухи могут ошибаться, но новости — нет). Без пошлости.
Ответь только JSON: {"news":[{"title":"заголовок","text":"1–2 предложения","about":["имя"]}],"rumors":[{"text":"что говорят, 1–2 предложения","source":"кто и где","about":["имя"],"truth":"правда|полуправда|враньё"}]}. 3 новости, 4 слуха.`;

async function makeRumors() {
    const st = A.worldState();
    const m = M();
    const ev = A.horaeEvents().slice(-15).map(e => `- ${e.event?.summary}`).join('\n');
    const store = A.chronStore();
    const chips = Object.entries(store).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 20).map(([, e]) => (e.chips || []).join('; ')).filter(Boolean).reverse().join('\n');
    const moments = Object.values(A.relationsState()).flatMap(p => (p.moments || []).slice(-3).map(x => `${short(p.a)} и ${short(p.b)}: ${x.text}`)).slice(-10).join('\n');
    const secrets = A.secretsState().slice(-6).map(x => `- ${x.text} (знает: ${x.knows.join(', ')})`).join('\n');
    const tris = (A.triangles?.() || []).filter(t => t.on !== false && t.who?.length === 3).map(t => `- ${t.who.map(short).join(' — ')} (в центре ${short(t.center)}${t.note ? `; ${t.note}` : ''})`).join('\n');
    const input = [
        `Дата: ${[A.weekday(st.timestamp?.story_date), st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(', ') || 'не записана'}. Место: ${st.scene?.location || '—'}`,
        `Герои: ${A.castNames(st).join(', ')}. Игрок пишет за ${userName()}.`,
        ev ? `Свежие события:\n${ev}` : '',
        chips ? `Что менялось в последних постах:\n${chips}` : '',
        moments ? `Моменты пар:\n${moments}` : '',
        secrets ? `ТАЙНЫ (в слухах — только искажённо или намёком):\n${secrets}` : '',
        tris ? `Треугольники (сплетники это чуют — можно намекнуть, но без пошлости):\n${tris}` : '',
        m.rumors?.rumors?.length ? `Прошлые слухи (не повторяй):\n${m.rumors.rumors.map(r => `- ${r.text}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: RUMORS_SYSTEM }, { role: 'user', content: input }], 1600);
    const j = A.extractJson(out);
    const str = (v) => typeof v === 'string' ? v.trim() : '';
    const news = (Array.isArray(j?.news) ? j.news : []).filter(x => str(x?.title)).slice(0, 4).map(x => ({ title: str(x.title).slice(0, 140), text: str(x.text).slice(0, 400), about: (Array.isArray(x.about) ? x.about : []).map(str).filter(Boolean).slice(0, 4), img: '' }));
    const rumors = (Array.isArray(j?.rumors) ? j.rumors : []).filter(x => str(x?.text)).slice(0, 5).map(x => ({ text: str(x.text).slice(0, 400), source: str(x.source).slice(0, 80), about: (Array.isArray(x.about) ? x.about : []).map(str).filter(Boolean).slice(0, 4), truth: str(x.truth) || 'полуправда' }));
    if (!news.length && !rumors.length) throw new Error('хроника ответила пусто');
    if (m.rumors) { m.rumorsOld = [m.rumors, ...(m.rumorsOld || [])].slice(0, 3); }
    m.rumors = { day: st.timestamp?.story_date || '', mes: A.lastAiIndex(), at: Date.now(), news, rumors };
    A.saveMeta();
}

let rumorBusy = false;
async function rumorsAuto() {
    const c = simCfg();
    const m = M();
    const day = A.worldState().timestamp?.story_date || '';
    if (!c.rumorsAuto || !day || rumorBusy) return;
    if (!m.rumorDay) { m.rumorDay = day; return; }
    if (m.rumorDay === day) return;
    m.rumorDay = day;
    rumorBusy = true;
    try { await makeRumors(); A.toast('info', 'Свежие слухи — Мир → Слухи', '✦ Новый день', { timeOut: 3500 }); } catch (e) { console.warn('[Life] слухи', e); } finally { rumorBusy = false; }
}

// ───────────── Летописец: что спросить и что сделать с ответом ─────────────

export function simChronOpts() {
    const c = simCfg();
    const st = A.worldState();
    const m = M();
    const loc = st.scene?.location || '';
    const inits = c.on ? initChars() : [];
    const needIdeas = inits.filter(n => m.ideas.filter(x => A.sameName(x.who, n) && x.status === 'new').length < 4);
    const ideasNow = m.ideas.filter(x => x.status === 'new' || x.status === 'armed').slice(-12);
    const people = [userName(), ...inits];
    const pets = m.pets.filter(p => p.on !== false);
    const inn = innerChronOpts();
    const ppl = peopleChronOpts();
    return {
        flags: { prefs: c.prefs, ideas: inits.length > 0, traces: c.traces, pets: c.pets, itemStory: true, inner: !!inn, people: !!ppl },
        tokens: (c.prefs ? 150 : 0) + (inits.length ? 350 : 0) + (c.traces ? 200 : 0) + (c.pets && pets.length ? 150 : 0) + (inn?.tokens || 0) + (ppl?.tokens || 0) + 120,
        input: {
            user: userName(),
            prefs: c.prefs || inits.length ? prefsLine(people) : '',
            init: needIdeas.length ? needIdeas.map(n => { const br = innerBrief(n); return `${n} (${FREQ[whoCfg(n).freq][2].toLowerCase()}; можно: ${whoCfg(n).kinds.map(k => IDEA_KINDS[k]).join(', ')}${br ? `; ${A.cut(br, 300)}` : ''})`; }).join('; ') : (inits.length ? 'новых идей не нужно, только отметь сбывшиеся' : ''),
            inner: inn?.line || '',
            people: ppl ? ppl.line : null, peopleOn: !!ppl,
            sched: inits.map(n => { const sl = nowSlot(n); return sl ? `${short(n)} — ${sl.what}${sl.where ? ` (${sl.where})` : ''}` : ''; }).filter(Boolean).join('; '),
            ideas: ideasNow.map(x => `[${x.id}] ${x.who}: ${x.text}`).join('\n'),
            traces: c.traces ? tracesLine(loc) : '',
            pets: c.pets && pets.length ? pets.map(p => `${p.name} (${kindWord(p)}${p.home ? `, живёт: ${p.home}` : ''})`).join('; ') : '',
        },
    };
}

export function simAfterPost(i, res, msg) {
    const c = simCfg();
    const m = M();
    if (c.prefs) addPrefs(res.prefs || [], i);
    if (c.traces) applyTraces(res.traces || [], i);
    if (c.pets) applyPets(res.pets || [], i);
    applyItemStories(res.items || [], i);
    for (const id of res.done || []) { const x = ideaById(id); if (x && x.status !== 'done') doneIdea(x, i); }
    if (m.armed) {
        const x = ideaById(m.armed.id);
        if (!x) m.armed = null;
        else if (i > m.armed.at) {
            if (x.status === 'done' || (msg && A.sameName(msg.name, x.who))) { if (x.status !== 'done') doneIdea(x, i); }
            else if (i - m.armed.at > 4 && !m.armed.manual) { x.status = 'new'; m.armed = null; }
        }
    }
    if (c.on) addIdeas(res.ideas || [], i);
    // «пока тебя не было» раскрыто, если сцена пришла туда
    const cur = topKey(A.worldState().scene?.location || '');
    for (const ev of m.offscreen) if (!ev.seen && i > ev.mes && cur && topKey(ev.where) === cur) { ev.seen = true; ev.seenMes = i; }
    for (const arr of Object.values(m.traces)) for (const t of arr) if (t.fresh && i - t.mes > 8) t.fresh = false;
    if (m.rumorPush && i > m.rumorPush.at) m.rumorPush = null;
    if (c.on) maybeArm(i);
    try { innerAfterPost(i, res, msg); } catch (e) { console.warn('[Life] внутренняя жизнь', e); }
    try { peopleAfterPost(i, res); } catch (e) { console.warn('[Life] люди', e); }
    try { agendaTick(i); } catch (e) { console.warn('[Life] закулисье', e); }
    A.saveMeta();
    rumorsAuto();
}

/** Заметка модели перед ответом. type — тип генерации таверны. */
export function simPrompt(type) {
    if (type === 'impersonate' || type === 'quiet') return '';
    const c = simCfg();
    const m = M();
    const st = A.worldState();
    const loc = st.scene?.location || '';
    const u = userName();
    const out = [];
    const L = A.chatArr().length;
    const regen = (type === 'swipe' && m.lastInit && L - 1 === m.lastInit.mes) || (type === 'regenerate' && m.lastInit && L === m.lastInit.mes);
    const a = m.armed ? ideaById(m.armed.id) : regen ? ideaById(m.lastInit.id) : null;
    if (c.on && a) out.push(`[Инициатива: если в этом ответе действует ${a.who} — по собственной инициативе, без подсказки игрока: ${a.text}. Естественно, из характера персонажа и того, что сейчас происходит; не ломай сцену и не объявляй это заранее.]`);
    const offs = m.offscreen.filter(e => !e.seen && A.lastAiIndex() - e.mes < 40).slice(-2);
    for (const e of offs) out.push(`[За кадром, пока ${u} не было рядом, ${e.who}: ${e.t}${e.where ? ` (${A.placeName(e.where)})` : ''}. Это уже случилось. Если ${u} сейчас там или придёт туда — это можно обнаружить.]`);
    if (c.traces && loc) {
        const hidden = new Set(m.offscreen.filter(e => !e.seen).map(e => A.norm(e.t)));
        const tl = tracesUnder(loc).map(([k, arr]) => [k, arr.filter(t => !(t.off && hidden.has(A.norm(t.t))))]).filter(([, arr]) => arr.length)
            .map(([k, arr]) => `${A.locLeaf(arr[0]?.loc || k)} — ${arr.slice(-4).map(t => t.t).join('; ')}`).join('. ');
        if (tl) out.push(`[Что сейчас есть в «${A.placeName(A.locTop(loc))}» после прошлых сцен: ${A.cut(tl, 500)}.]`);
    }
    if (c.pets) {
        const now = rpNow();
        const L = A.chatArr().length;
        for (const p of m.pets.filter(x => x.on !== false && petHere(x))) {
            const s = petState(p, now);
            const traits = (p.traits || []).slice(0, 4).join(', ');
            const fam = petFamily(p);
            const who = `${kindWord(p)} ${p.name}${traits ? ` (${traits})` : ''}${fam ? `. ${A.cap(fam)}` : ''}`;
            if (s.urgent.length) out.push(`[Питомец: ${who} — ${s.urgent.join('; ')}. Если ${pg(p, 'он', 'она')} рядом в сцене — покажи это, пусть требует своего.]`);
            else if (L % 6 === 0) {
                const bits = [...(p.habits || []), ...(p.likes || []).map(x => `любит ${x}`)];
                const pick = bits.length ? bits[Math.floor(L / 6) % bits.length] : '';
                out.push(`[Дома ${who}. Живёт своей жизнью${pick ? `: ${pick}` : ''}. Может мелькнуть в сцене, если к месту, — не делай ${pg(p, 'его', 'её')} центром сцены.]`);
            }
        }
    }
    if (m.rumorPush?.text) out.push(`[Слух, который сейчас ходит: «${m.rumorPush.text}». Кто-то из персонажей может его упомянуть или на него отреагировать.]`);
    try { const ip = innerPrompt(type); if (ip) out.push(ip); } catch (e) { console.warn('[Life] внутренняя жизнь: заметка', e); }
    try { const ap = agendaPrompt(type); if (ap) out.push(ap); } catch (e) { console.warn('[Life] закулисье: заметка', e); }
    return out.join('\n');
}

// ───────────── вкладка «Жизнь» у персонажа ─────────────

const freqSeg = (who) => {
    const cur = whoCfg(who).freq;
    return `<div class="lf-seg">${Object.entries(FREQ).map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-act="sim-freq" data-name="${esc(who)}" data-v="${k}">${v[2]}</button>`).join('')}</div>`;
};

function ideaRow(x, tease) {
    const hide = tease && x.status !== 'done';
    return `<div class="lf-idea${x.status === 'armed' ? ' armed' : ''}${x.status === 'done' ? ' done' : ''}">
        <span class="lf-idea-ic">${icon(KIND_ICON[x.kind] || 'spark')}</span>
        <span class="lf-idea-t"><small>${esc(IDEA_KINDS[x.kind] || '')}${x.status === 'armed' ? ' · в следующем ответе' : x.when === 'offscreen' ? ' · пока тебя нет' : x.when === 'scene' ? ' · в этой сцене' : ''}</small>
            ${hide ? `<b class="lf-blur" data-act="sim-peek">${esc(x.text)}</b>` : `<b>${esc(x.text)}</b>`}</span>
        ${x.status === 'done' ? `<button class="lf-iconbtn sm" data-act="jump" data-mes="${x.doneMes}">${icon('right')}</button>`
        : `${x.status !== 'armed' ? `<button class="lf-iconbtn sm" data-act="sim-idea-now" data-id="${x.id}" title="В следующем ответе">${icon('zap')}</button>` : ''}<button class="lf-iconbtn sm" data-act="sim-idea-del" data-id="${x.id}" title="Не надо">${icon('x')}</button>`}
    </div>`;
}

function prefsHtml(who) {
    const p = prefsOf(who);
    const chip = (x) => `<span class="lf-pref${x.k === 'dislike' ? ' no' : ''}">${icon(x.k === 'dislike' ? 'x' : 'heart')}${esc(x.t)}<button data-act="sim-pref-del" data-name="${esc(who)}" data-t="${esc(x.t)}">${icon('x')}</button></span>`;
    return `<div class="lf-prefs">${p.length ? p.map(chip).join('') : '<span class="lf-dim">Пока ничего — Летописец запишет, как только это прозвучит в истории.</span>'}
        <button class="lf-chip" data-act="sim-pref-add" data-name="${esc(who)}">${icon('plus')}</button></div>`;
}

function giftsHtml(who) {
    const g = giftsOf(who).slice(0, 12);
    if (!g.length) return '<div class="lf-empty small">Подарков пока не было.</div>';
    return `<div class="lf-list">${g.map(e => `<button class="lf-row" data-act="jump" data-mes="${e.mes}">${icon('gift')}<span><b>${esc(e.name)}</b> · ${esc(short(e.from))} → ${esc(short(e.to || '?'))}${e.t ? `<small class="lf-sub">${esc(e.t)}</small>` : ''}</span></button>`).join('')}</div>`;
}

function schedHtml(who) {
    const list = schedOf(who);
    const cur = nowSlot(who);
    return `${list.length ? `<div class="lf-sched">${list.map(x => `<div class="lf-sched-r${x === cur ? ' on' : ''}"><span>${esc(x.from)}</span><b>${esc(x.what)}</b><small>${esc(x.where || '')}</small></div>`).join('')}</div>` : '<div class="lf-empty small">Распорядка нет. Составлю по карточке персонажа — потом поправишь.</div>'}
    <div class="lf-actions"><button class="lf-btn" data-act="sim-sched-gen" data-name="${esc(who)}">${icon('sparkles')} ${list.length ? 'Заново' : 'Составить'}</button>
    <button class="lf-btn" data-act="sim-sched-edit" data-name="${esc(who)}">${icon('pencil')} Изменить</button></div>`;
}

export function renderLife(who) {
    const c = simCfg();
    const m = M();
    const st = A.worldState();
    if (isUser(who)) {
        const unseen = m.offscreen.filter(e => !e.seen).slice(-6).reverse();
        const homes = [...A.knownLocations()].filter(([k]) => !k.includes('·')).slice(0, 30);
        return `<div class="lf-pagehead"><h1>Жизнь</h1><span class="lf-subtitle">Что о тебе знают и что творится вокруг</span></div>
        ${unseen.length ? `${A.sec('Пока тебя не было')}${offHtml(unseen)}` : ''}
        ${A.sec('Что о тебе знают', 'вкусы для подарков и заботы')}${prefsHtml(who)}
        ${A.sec('Подарки')}${giftsHtml(who)}
        ${A.sec('Дом', 'сюда идут записки и питомцы')}
        <div class="lf-chips wrap">${homes.map(([k, raw]) => `<button class="lf-chip${A.placeKey(homeLoc()) === k ? ' on' : ''}" data-act="sim-home" data-loc="${esc(raw)}">${icon('home')} ${esc(A.placeName(raw))}</button>`).join('') || '<span class="lf-dim">Мест пока нет.</span>'}</div>
        ${A.sec('Инициатива персонажей')}
        <label class="lf-switch"><input type="checkbox" data-set="sim.on" ${c.on ? 'checked' : ''}><span></span>Персонажи проявляют инициативу сами</label>
        <label class="lf-switch"><input type="checkbox" data-set="sim.tease" ${c.tease ? 'checked' : ''}><span></span>Их намерения — сюрприз (размыто, пока не случится)</label>
        <div class="lf-hint">Частоту и что именно можно — настраиваешь у каждого в его «Жизни».</div>`;
    }
    const here = (st.scene?.characters_present || []).some(n => A.sameName(n, who));
    const slot = nowSlot(who);
    const pool = m.ideas.filter(x => A.sameName(x.who, who) && (x.status === 'new' || x.status === 'armed')).reverse();
    const done = m.ideas.filter(x => A.sameName(x.who, who) && x.status === 'done').slice(-8).reverse();
    const wc = whoCfg(who);
    const ui = A.ui;
    if (!['inner', 'acts', 'char', 'day'].includes(ui.lifeTab)) ui.lifeTab = 'inner';
    const t = ui.lifeTab;
    let body = '';
    if (t === 'inner') body = renderInner(who);
    else if (t === 'acts') body = `${A.sec('Инициатива', c.on ? 'как часто — по своей воле' : 'выключена у тебя в «Жизни»')}
    ${freqSeg(who)}
    <div class="lf-chips wrap">${Object.entries(IDEA_KINDS).map(([k, tt]) => `<button class="lf-chip${wc.kinds.includes(k) ? ' on' : ''}" data-act="sim-kind" data-name="${esc(who)}" data-v="${k}">${icon(KIND_ICON[k] || 'spark')} ${tt}</button>`).join('')}</div>
    ${A.sec('Задумки', pool.length ? String(pool.length) : '')}
    ${pool.length ? pool.map(x => ideaRow(x, c.tease)).join('') : '<div class="lf-empty small">Пока ничего. Летописец подкинет идеи по ходу истории — или придумаю сейчас.</div>'}
    <button class="lf-btn ghost full" data-act="sim-ideas-gen" data-name="${esc(who)}">${icon('sparkles')} Придумать ещё</button>
    ${done.length ? `${A.sec('Уже сделано')}${done.map(x => ideaRow(x, false)).join('')}` : ''}
    ${A.sec('Подарки')}${giftsHtml(who)}`;
    else if (t === 'char') body = `${renderCharacter(who)}
    ${A.sec(`Любит ${esc(short(who))}`, 'для твоих подарков')}${prefsHtml(who)}`;
    else body = `${A.sec('Распорядок дня', 'живёт по нему, пока его нет рядом')}${schedHtml(who)}`;
    return `<section class="lf-life-now">${A.ava(who, 'md')}<div><span class="lf-kicker">Сейчас</span>
        <b>${here ? `Рядом с ${esc(short(userName()))}` : slot ? esc(A.cap(slot.what)) : 'Живёт своей жизнью'}</b>
        <small>${slot ? `${esc(slot.from)}–${esc(slot.to)}${slot.where ? ` · ${esc(slot.where)}` : ''}` : here ? 'в этой сцене' : 'распорядок не задан'}</small></div></section>
    ${A.seg([['inner', 'Внутри'], ['acts', 'Поступки'], ['char', 'Характер'], ['day', 'День']], t, 'sim-ltab')}
    ${body}`;
}

function offHtml(list) {
    return `<div class="lf-offs">${list.map(e => `<div class="lf-off">${A.ava(e.who, 'sm')}<span><b>${esc(short(e.who))}</b> ${esc(e.t)}<small>${e.where ? esc(A.placeName(e.where)) : ''}</small></span>
        <button class="lf-iconbtn sm" data-act="sim-off-seen" data-id="${esc(e.id)}" title="Уже видела">${icon('check')}</button></div>`).join('')}</div>`;
}

// ───────────── питомец ─────────────

export function petsRowHtml(cur) {
    const m = M();
    if (!simCfg().pets && !m.pets.length) return '';
    return `${m.pets.map(p => `<button class="lf-pers pet${cur === `pet:${p.id}` ? ' on' : ''}" data-act="sim-pet" data-id="${esc(p.id)}">
        <span class="lf-ava md">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}<i>${icon('paw')}</i></span><span class="lf-pers-n">${esc(A.shortName(p.name))}</span></button>`).join('')}
    <button class="lf-pers add" data-act="sim-pet-new"><span class="lf-ava md"><i>${icon('plus')}</i></span><span class="lf-pers-n">Питомец</span></button>`;
}

function petFamily(p) {
    const bits = [];
    const owner = p.owner;
    const ppl = p.people || [];
    const feel = (x) => ((x.love ?? 50) >= 75 ? ', обожает' : (x.love ?? 50) < 30 ? ', сторонится' : '');
    if (owner) {
        const x = ppl.find(y => A.sameName(y.name, owner)) || {};
        bits.push(`хозяин${x.role ? ` и «${x.role}»` : ''} — ${short(owner)}${feel(x)}`);
    }
    for (const x of ppl) {
        if (owner && A.sameName(x.name, owner)) continue;
        if (!x.role && (x.love ?? 50) < 70) continue;
        bits.push(`${x.role ? `«${x.role}» — ` : ''}${short(x.name)}${feel(x)}`);
    }
    return bits.length ? `семья: ${bits.join('; ')}` : '';
}

const petList = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);
/** Списки, где внутри пунктов бывают запятые: по строке на пункт (или через «;»). */
const petLines = (v) => String(v || '').split(/\n|;/).map(x => x.trim()).filter(Boolean).slice(0, 14);
const uniq = (list) => { const seen = new Set(); return list.filter(x => { const k = A.norm(x); if (seen.has(k)) return false; seen.add(k); return true; }); };

export function renderPet(id) {
    const p = petById(id);
    if (!p) return '<div class="lf-empty small">Питомец не найден.</div>';
    const now = rpNow();
    const s = petState(p, now);
    const where = p.home ? A.placeName(A.locTop(p.home)) : '';
    const last = p.moments.slice(-1)[0];
    const words = s.needs.filter(n => n.k !== 'health' || n.v < 70).sort((a, b) => a.v - b.v).map(n => [NEED_ICON[n.k], n.word]);
    if (s.sleepy) words.unshift(['moon', pg(p, 'Сонный', 'Сонная')]);
    const ppl = (p.people || []).slice().sort((a, b) => (A.sameName(b.name, p.owner) ? 1 : 0) - (A.sameName(a.name, p.owner) ? 1 : 0) || (b.love ?? 50) - (a.love ?? 50));
    const together = (n) => p.fav?.[A.canonName(n)] || 0;
    const chips = (list, cls = '') => `<div class="lf-chips wrap">${list.map(t => `<span class="lf-chip static${cls}">${esc(t)}</span>`).join('')}</div>`;
    const t = p.temper || {};
    const f = isF(p);
    return `<section class="lf-pethero${p.img ? ' lf-fit' : ''}"${A.fitAttr(p.img)}>${p.img ? '<i class="lf-fit-i"></i>' : `<span class="lf-pethero-ic">${icon('paw')}</span>`}
        <button class="lf-glass" data-act="sim-pet-pic" data-id="${esc(p.id)}">${icon('camera')} ${p.img ? 'Фото' : 'Нарисовать'}</button>
        <div class="lf-pethero-t"><h2>${esc(p.name)}</h2><span>${esc([kindLabel(p), p.age, where].filter(Boolean).join(' · '))}</span></div>
    </section>
    ${(p.traits || []).length ? `<div class="lf-chips wrap lf-pet-traits">${p.traits.map(x => `<span class="lf-chip static">${icon('paw')} ${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="lf-petwords">${words.slice(0, 3).map(([ic, w]) => `<span>${icon(ic)}<b>${esc(w)}</b></span>`).join('')}</div>
    ${s.urgent.length ? `<div class="lf-note">${icon('activity')} ${esc(A.cap(s.urgent[0]))}. Модель это увидит, когда сцена дома.</div>` : ''}
    ${ppl.length || p.owner ? `${A.sec('Семья', 'кто для неё кто'.replace('неё', pg(p, 'него', 'неё')))}
    <div class="lf-pet-fam">${(ppl.length ? ppl : [{ name: p.owner, role: '', love: 80 }]).map(x => `<div class="lf-pet-p">${A.ava(x.name, 'sm')}
        <span class="lf-pet-p-t"><b>${esc(short(x.name))}${A.sameName(x.name, p.owner) ? ` <i class="lf-pet-own">${icon('crown')} хозяин</i>` : ''}</b>${x.role ? `<small>«${esc(x.role)}»</small>` : ''}</span>
        <span class="lf-pet-p-m"><i class="lf-meter"><b style="width:${x.love ?? 50}%"></b></i><small>${(x.love ?? 50) >= 80 ? 'обожает' : (x.love ?? 50) >= 60 ? 'любит' : (x.love ?? 50) >= 35 ? 'терпит' : 'сторонится'}${together(x.name) ? ` · ${together(x.name)} момент.` : ''}</small></span></div>`).join('')}</div>` : ''}
    ${A.sec('Сейчас', s.sleepy ? 'сонное время' : '')}
    <div class="lf-bars">${s.needs.map(n => `<div class="lf-bar-row${n.v < 30 ? ' low' : ''}">${icon(NEED_ICON[n.k])}<span>${esc(n.label)}</span><i class="lf-meter"><b style="width:${n.v}%"></b></i><small>${n.v}</small></div>`).join('')}</div>
    ${A.sec('Темперамент')}
    <div class="lf-temper">${TEMPER.map(([k, l, r]) => { const v = t[k] ?? 50; return `<div class="lf-temper-r"><span class="${v < 40 ? 'on' : ''}">${f ? l[1] : l[0]}</span><i class="lf-temper-b"><b style="left:${v}%"></b></i><span class="${v > 60 ? 'on' : ''}">${f ? r[1] : r[0]}</span></div>`; }).join('')}</div>
    ${(p.likes || []).length ? `${A.sec('Любит')}${chips(p.likes)}` : ''}
    ${(p.dislikes || []).length ? `${A.sec('Не любит')}${chips(p.dislikes, ' no')}` : ''}
    ${(p.habits || []).length ? `${A.sec('Привычки')}<div class="lf-pet-habits">${p.habits.map(x => `<span>${icon('sparkles')} ${esc(x)}</span>`).join('')}</div>` : ''}
    ${p.story ? `${A.sec('История')}<div class="lf-pet-story">${esc(p.story)}</div>` : ''}
    ${p.health ? `${A.sec('Здоровье')}<div class="lf-pet-story dim">${esc(p.health)}</div>` : ''}
    ${last ? `<button class="lf-petmem" data-act="jump" data-mes="${last.mes}"><b>${esc(A.cap(last.t))}</b><small>${icon('image')} Воспоминание · #${last.mes}</small>${icon('right')}</button>` : ''}
    ${p.moments.length > 1 ? `${A.sec('Воспоминания', String(p.moments.length))}<div class="lf-timeline">${p.moments.slice(0, -1).reverse().slice(0, 20).map(x => `<button class="lf-tl" data-act="jump" data-mes="${x.mes}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(x.t)}</b><small>#${x.mes}${x.with ? ` · с ${esc(short(x.with))}` : ''}</small></span></button>`).join('')}</div>` : ''}
    <div class="lf-actions"><button class="lf-btn" data-act="sim-pet-edit" data-id="${esc(p.id)}">${icon('pencil')} Характер и семья</button><button class="lf-btn ghost" data-act="sim-pet-fill" data-id="${esc(p.id)}">${icon('sparkles')} По истории</button></div>
    <div class="lf-hint">Кормят, гладят, играют${pk(p).needs.some(n => n[0] === 'tray') ? ', убирают лоток' : ''} — в постах: Летописец заметит, а голод и скука растут сами по времени Horae. «По истории» — дочитаю лорбуки и чат и дополню пустое.</div>`;
}

function petEditSheet(p) {
    const now = rpNow();
    const homes = [...A.knownLocations()].filter(([k]) => !k.includes('·')).slice(0, 30);
    const names = [...new Set([...A.castNames().map(A.canonName), ...(p.people || []).map(x => x.name)])].filter(Boolean);
    const per = (n) => (p.people || []).find(x => A.sameName(x.name, n)) || {};
    const t = p.temper || {};
    const f = isF(p);
    A.openSheet(`${icon('paw')} ${p.id ? esc(p.name) : 'Новый питомец'}`, `
        <div class="lf-field"><label>Кличка</label><input type="text" data-in="pname" value="${esc(p.name || '')}"></div>
        <div class="lf-field"><label>Кто</label><div class="lf-chips" data-kind>${[['cat', 'Кошка / кот'], ['dog', 'Собака'], ['other', 'Другое']].map(([k, v]) => `<button class="lf-chip${p.kind === k ? ' on' : ''}" data-act="kind" data-v="${k}">${v}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Пол</label><div class="lf-chips" data-sex>${[['f', 'Девочка'], ['m', 'Мальчик']].map(([k, v]) => `<button class="lf-chip${(p.sex || (f ? 'f' : 'm')) === k ? ' on' : ''}" data-act="kind" data-v="${k}">${v}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Возраст</label><input type="text" data-in="page" value="${esc(p.age || '')}" placeholder="около года"></div>
        <div class="lf-field"><label>Как выглядит</label><input type="text" data-in="plook" value="${esc(p.look || '')}" placeholder="белая пушистая, голубые глаза"></div>
        <div class="lf-field"><label>Характер <small>(через запятую)</small></label><input type="text" data-in="ptraits" value="${esc((p.traits || []).join(', '))}" placeholder="любопытная, наглая, ревнивая"></div>
        <div class="lf-field"><label>Темперамент</label>${TEMPER.map(([k, l, r]) => `<div class="lf-temper-in"><span>${f ? l[1] : l[0]}</span><input type="range" min="0" max="100" data-in="tmp-${k}" value="${t[k] ?? 50}"><span>${f ? r[1] : r[0]}</span></div>`).join('')}</div>
        <div class="lf-field"><label>Любит <small>(по строке на пункт)</small></label><textarea data-in="plikes" rows="3" placeholder="спать на подушке Баки&#10;курица с его тарелки&#10;коробки">${esc((p.likes || []).join('\n'))}</textarea></div>
        <div class="lf-field"><label>Не любит</label><textarea data-in="pdislikes" rows="2" placeholder="пылесос&#10;ветеринар">${esc((p.dislikes || []).join('\n'))}</textarea></div>
        <div class="lf-field"><label>Привычки</label><textarea data-in="phabits" rows="3" placeholder="встречает у двери&#10;будит в 6 утра, топчась по груди">${esc((p.habits || []).join('\n'))}</textarea></div>
        <div class="lf-field"><label>История</label><textarea data-in="pstory" rows="4" placeholder="как ${f ? 'она' : 'он'} попал${f ? 'а' : ''} в дом">${esc(p.story || '')}</textarea></div>
        <div class="lf-field"><label>Здоровье</label><input type="text" data-in="phealth" value="${esc(p.health || '')}" placeholder="стерилизована, прививки, аллергия на…"></div>
        <div class="lf-field"><label>Хозяин</label><div class="lf-chips wrap" data-owner>${names.map(n => `<button class="lf-chip${A.sameName(n, p.owner) ? ' on' : ''}" data-act="how" data-v="${esc(n)}">${icon('crown')} ${esc(short(n))}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Кто для ${f ? 'неё' : 'него'} кто</label>${names.map(n => { const x = per(n); return `<div class="lf-pet-fam-in" data-pn="${esc(n)}"><b>${esc(short(n))}</b><input type="text" data-in="role" value="${esc(x.role || '')}" placeholder="батя, мама, друг…"><input type="range" min="0" max="100" data-in="love" value="${x.love ?? 50}" title="Привязанность"></div>`; }).join('')}
            <div class="lf-hint">Ползунок — привязанность: слева сторонится, справа обожает.</div></div>
        <div class="lf-field"><label>Живёт</label><select data-in="phome"><option value="">— где и все —</option>${homes.map(([k, raw]) => `<option value="${esc(raw)}" ${A.placeKey(p.home || '') === k ? 'selected' : ''}>${esc(A.placeName(raw))}</option>`).join('')}</select></div>
        ${p.id ? `<div class="lf-field"><label>Поправить потребности</label>${pk(p).needs.map(([k, label]) => `<div class="lf-inline"><span class="lf-need-l">${esc(label)}</span><input type="range" min="0" max="100" data-in="need-${k}" value="${needOf(p, k, now)}"></div>`).join('')}</div>` : ''}
        <label class="lf-switch"><input type="checkbox" data-in="pon" ${p.on !== false ? 'checked' : ''}><span></span>Участвует в истории</label>
        <button class="lf-btn primary serif full big" data-act="sim-pet-save" data-id="${esc(p.id || '')}">${icon('check')} Сохранить</button>
        ${p.id ? `<button class="lf-btn ghost full" data-act="sim-pet-del" data-id="${esc(p.id)}">${icon('trash')} Убрать питомца</button>` : ''}`);
}

const PET_FILL = `Ты собираешь карточку домашнего животного из ролевой истории на русском. По записям лорбуков и событиям чата ответь только JSON:
{"sex":"f|m","age":"","look":"","traits":["1–2 слова, в роде питомца"],"likes":["…"],"dislikes":["…"],"habits":["3–8 слов"],"story":"как попал(а) в дом и кто выхаживал, 2–4 предложения","health":"","owner":"имя хозяина","people":[{"name":"имя","role":"кем считает: хозяин, батя, мама, друг…","love":0}],"temper":{"affection":50,"energy":50,"bold":50,"social":50}}
love — привязанность 0–100. temper — 0–100: affection (независимость → ласковость), energy (спокойствие → шкодливость), bold (пугливость → смелость), social (только свои → любит гостей). Пиши только то, что есть в записях или прямо следует из них; чего нет — пустые поля.`;

async function petFill(p) {
    const lore = await loreAbout(p.name, /./);
    const chips = Object.entries(A.chronStore()).map(([, e]) => (e.chips || []).join('; ')).filter(t => A.norm(t).includes(A.norm(p.name).slice(0, 4))).slice(-15).join('\n');
    const mem = (p.moments || []).slice(-15).map(x => `- ${x.t}${x.with ? ` (с ${x.with})` : ''}`).join('\n');
    const input = [`Питомец: ${p.name} (${kindWord(p)}). Люди в истории: ${A.castNames().join(', ')}. Игрок пишет за: ${A.ctx().name1}.`,
        lore ? `Лорбуки:\n${lore}` : '', chips ? `События чата:\n${chips}` : '', mem ? `Моменты:\n${mem}` : '',
        `Уже записано: ${JSON.stringify({ sex: p.sex, age: p.age, look: p.look, traits: p.traits, likes: p.likes, owner: p.owner, people: p.people, story: p.story })}`].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: PET_FILL }, { role: 'user', content: input }], 1500);
    const j = A.extractJson(out);
    if (!j) throw new Error('модель не прислала JSON');
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const arr = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
    if (!p.sex && ['f', 'm'].includes(str(j.sex))) p.sex = str(j.sex);
    for (const k of ['age', 'look', 'story', 'health']) if (!p[k] && str(j[k])) p[k] = str(j[k]).slice(0, 1200);
    for (const k of ['traits', 'likes', 'dislikes', 'habits']) { const add = arr(j[k]); if (add.length) p[k] = uniq([...(p[k] || []), ...add]).slice(0, 12); }
    if (!p.owner && str(j.owner)) p.owner = A.canonName(str(j.owner));
    p.people = p.people || [];
    for (const x of Array.isArray(j.people) ? j.people : []) {
        const n = A.canonName(str(x?.name));
        if (!n) continue;
        const cur = p.people.find(y => A.sameName(y.name, n));
        const love = Math.max(0, Math.min(100, Math.round(Number(x.love) || 50)));
        if (cur) { if (!cur.role && str(x.role)) cur.role = str(x.role).slice(0, 40); }
        else p.people.push({ name: n, role: str(x.role).slice(0, 40), love });
    }
    if (j.temper && typeof j.temper === 'object' && !Object.keys(p.temper || {}).length) {
        p.temper = Object.fromEntries(TEMPER.map(([k]) => [k, Math.max(0, Math.min(100, Math.round(Number(j.temper[k]) || 50)))]));
    }
    A.saveMeta();
    A.updatePrompt();
}

// ───────────── живой дом: комната ─────────────

export function roomButton(key) { return `<button class="lf-link" data-act="sim-room" data-key="${esc(key)}">${icon('search')} Осмотреть</button>`; }

export function renderRoom(key) {
    const s = A.settings();
    const p = s.places[key] || null;
    const raw = p?.raw || p?.name || A.knownLocations().get(key) || key;
    const st = A.worldState();
    const here = A.placeKey(st.scene?.location || '') === key || A.placeKey(st.scene?.location || '').startsWith(key + '·');
    const img = p?.imgNow?.src || p?.img || A.placeCover(raw);
    const traces = tracesAt(key);
    const depth = key.split('·').length + 1;
    const rooms = [...A.knownLocations()].filter(([k]) => k.startsWith(key + '·') && k.split('·').length === depth);
    const siblings = key.includes('·') ? [...A.knownLocations()].filter(([k]) => k !== key && k.startsWith(key.split('·').slice(0, -1).join('·') + '·') && k.split('·').length === key.split('·').length) : [];
    const items = Object.entries(st.items || {}).filter(([, it]) => !it?.holder && it?.location && (A.placeKey(it.location) === key || A.placeKey(it.location).startsWith(key + '·') || A.norm(it.location).includes(A.norm(A.locLeaf(raw)))));
    const offs = M().offscreen.filter(e => A.placeKey(e.where || '') === key || topKey(e.where || '') === key).slice(-4).reverse();
    const present = here ? (st.scene?.characters_present || []).map(A.canonName) : [];
    const pets = M().pets.filter(x => x.home && (topKey(x.home) === key || A.placeKey(x.home) === key));
    const sig = traces.map(t => t.t).join('|');
    const stale = traces.length && p?.img && p?.imgNow?.sig !== sig;
    const parent = key.includes('·') ? key.split('·').slice(0, -1).join('·') : '';
    const pins = traces.filter(t => t.x != null);
    const trRow = (t) => `<div class="lf-trace k-${esc(t.k)}${t.fresh ? ' fresh' : ''}">
        <span class="lf-trace-ic">${icon(t.k === 'note' ? 'sticky' : t.k === 'food' ? 'utensils' : t.k === 'gift' ? 'gift' : 'eye')}</span>
        <span class="lf-trace-t">${t.fresh ? '<em>новое</em>' : ''}${t.by ? `<small>${esc(short(t.by))}</small>` : ''}${esc(t.t)}</span>
        <button class="lf-iconbtn sm${A.ui.tracePin === t.id ? ' on' : ''}" data-act="sim-trace-pin" data-id="${esc(t.id)}" title="Отметить на картинке">${icon('pin')}</button>
        ${t.fresh ? `<button class="lf-iconbtn sm" data-act="sim-trace-ok" data-id="${esc(t.id)}" title="Так и есть">${icon('check')}</button>` : ''}
        <button class="lf-iconbtn sm" data-act="sim-trace-del" data-id="${esc(t.id)}" title="Убрать">${icon('x')}</button></div>`;
    return `<div class="lf-pagehead"><button class="lf-iconbtn" data-act="sim-room-back">${icon('left')}</button><div class="lf-grow"><span class="lf-kicker">${esc(parent ? A.placeName(A.knownLocations().get(parent) || parent) : 'Место')}</span><h1>${esc(A.locLeaf(A.placeName(raw)))}</h1></div>
</div>
    <section class="lf-room${img ? '' : ' empty'}">
        <div class="lf-room-in" data-act="sim-room-tap">${img ? `<img src="${esc(img)}" alt="" draggable="false">` : `<span class="lf-room-ph">${icon('door', 'xl')}</span>`}
            ${pins.map(t => `<button class="lf-hot" data-act="sim-trace" data-id="${esc(t.id)}" style="left:${t.x}%;top:${t.y}%"><span>${esc(A.cut(t.t, 22))}</span></button>`).join('')}
        </div>
        <div class="lf-room-acts">
            ${img ? `<button class="lf-glass${stale ? ' hot' : ''}" data-act="sim-room-draw" data-key="${esc(key)}">${icon('refresh')} ${stale ? 'Обновить по следам' : 'Перерисовать'}</button>` : `<button class="lf-glass" data-act="sim-room-draw" data-key="${esc(key)}">${icon('wand')} Нарисовать</button>`}
            <button class="lf-glass" data-act="place-menu" data-loc="${esc(raw)}">${icon('more')}</button>
        </div>
    </section>
    ${A.ui.tracePin ? `<div class="lf-note">${icon('pin')} Тапни на картинке, где это лежит.</div>` : ''}
    ${present.length || pets.length ? `<div class="lf-present">${present.map(n => `<button class="lf-pers" data-act="person" data-name="${esc(n)}">${A.ava(n, 'md')}<span class="lf-pers-n">${esc(A.shortName(n))}</span></button>`).join('')}${pets.map(x => `<button class="lf-pers pet" data-act="sim-pet" data-id="${esc(x.id)}"><span class="lf-ava md">${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}<i>${icon('paw')}</i></span><span class="lf-pers-n">${esc(A.shortName(x.name))}</span><span class="lf-pers-m">${esc(petState(x).needs[0].word)}</span></button>`).join('')}</div>` : ''}
    ${offs.length ? `${A.sec('Пока тебя не было')}${offHtml(offs)}` : ''}
    ${A.sec('Здесь', traces.length + items.length ? String(traces.length + items.length) : '')}
    ${traces.length ? traces.slice().reverse().map(trRow).join('') : ''}
    ${items.map(([n, it]) => `<div class="lf-trace k-item"><span class="lf-trace-ic emoji">${esc(it.icon || '✦')}</span><span class="lf-trace-t">${esc(n)}<small>${esc(it.location)}</small></span></div>`).join('')}
    ${!traces.length && !items.length ? '<div class="lf-empty small">Пока пусто. Летописец оставит тут следы сцен: бокалы, записки, чью-то футболку.</div>' : ''}
    ${rooms.length || siblings.length ? `${A.sec(rooms.length ? 'Комнаты' : 'Соседние комнаты')}<div class="lf-chips wrap">${(rooms.length ? rooms : siblings).map(([k, r]) => { const n = tracesUnder(r).filter(([kk]) => kk === k || kk.startsWith(k + '·')).reduce((a, [, arr]) => a + arr.length, 0); return `<button class="lf-chip" data-act="sim-room" data-key="${esc(k)}">${icon(A.placeIcon(r))} ${esc(A.locLeaf(r))}${n ? ` <i class="lf-cnt">${n}</i>` : ''}</button>`; }).join('')}</div>` : ''}
    <div class="lf-actions">
        ${here ? `<span class="lf-here">${icon('target')} Вы здесь</span>` : `<button class="lf-btn primary serif" data-act="travel" data-loc="${esc(raw)}">Отправиться ${icon('right')}</button>`}
        <button class="lf-btn" data-act="sim-trace-add" data-key="${esc(key)}" data-loc="${esc(raw)}">${icon('plus')} Записка или след</button>
    </div>`;
}

async function drawRoom(key) {
    const s = A.settings();
    const p = s.places[key] || A.getPlace(A.knownLocations().get(key) || key, true);
    const raw = p.raw || p.name;
    const traces = tracesAt(key);
    const what = traces.map(t => t.t).join('; ');
    const base = p.img || A.placeCover(raw);
    if (base) {
        const ref = await A.refData(base);
        const src = await A.drawPicture(`The SAME room as in the reference image: same composition, camera angle, furniture and light.${what ? ` Now visible in it: ${what}.` : ''} Style: ${A.style()}. No people, no text.`, { aspect: '16:9', refs: [ref], prefix: 'life_room' });
        if (!p.img) p.img = src;
        p.imgNow = { src, sig: traces.map(t => t.t).join('|') };
    } else {
        p.img = await A.drawPicture(`Interior of ${A.locParts(raw).join(', ')}, lived-in, atmospheric.${what ? ` Visible: ${what}.` : ''} Style: ${A.style()}. Wide cinematic composition, no people, no text.`, { aspect: '16:9', prefix: 'life_room' });
        p.imgNow = { src: p.img, sig: traces.map(t => t.t).join('|') };
    }
    A.saveSettings();
}

// ───────────── Мир → Слухи ─────────────

export function renderRumors() {
    const m = M();
    const r = m.rumors;
    const truthCls = (t) => /^правд/i.test(t) ? 'yes' : /вран|лож/i.test(t) ? 'no' : 'half';
    const aboutAv = (list) => (list || []).map(n => A.ava(A.canonName(n), 'xs')).join('');
    const head = `<div class="lf-actions"><button class="lf-btn primary serif" data-act="sim-rumors">${icon('refresh')} ${r ? 'Свежие слухи' : 'Что говорят в городе'}</button></div>`;
    if (!r) return `<div class="lf-empty small">${icon('ear', 'xl')}Новости мира и слухи о героях: что пишут газеты и шепчутся в барах — по свежим событиям истории. ${simCfg().rumorsAuto ? 'Сами обновятся с новым игровым днём.' : ''}</div>${head}`;
    return `${A.sec('Новости', esc([A.weekday(r.day), r.day].filter(Boolean).join(', ')))}
    ${r.news.map((n, k) => `<article class="lf-news">${n.img ? `<div class="lf-news-img lf-fit"${A.fitAttr(n.img)}><i class="lf-fit-i"></i></div>` : ''}
        <h3>${esc(n.title)}</h3>${n.text ? `<p>${esc(n.text)}</p>` : ''}
        <div class="lf-news-foot"><span class="lf-avs">${aboutAv(n.about)}</span>${n.img ? '' : `<button class="lf-iconbtn sm" data-act="sim-news-img" data-i="${k}" title="Фото к новости">${icon('camera')}</button>`}</div></article>`).join('')}
    ${A.sec('Слухи', 'тап по метке — правда ли')}
    ${r.rumors.map((x, k) => `<div class="lf-rumor"><q>${esc(x.text)}</q>
        <div class="lf-rumor-f"><span class="lf-avs">${aboutAv(x.about)}</span><small>${icon('ear')} ${esc(x.source || 'говорят')}</small>
        <button class="lf-truth ${truthCls(x.truth)}" data-act="sim-truth">${esc(x.truth)}</button>
        <button class="lf-iconbtn sm${m.rumorPush?.text === x.text ? ' on' : ''}" data-act="sim-rumor-push" data-i="${k}" title="Пусть кто-то в сцене это упомянет">${icon('message')}</button></div></div>`).join('')}
    ${head}
    <label class="lf-switch"><input type="checkbox" data-set="sim.rumorsAuto" ${simCfg().rumorsAuto ? 'checked' : ''}><span></span>Обновлять самому с новым игровым днём</label>`;
}

// ───────────── сцена: «пока тебя не было», питомцы рядом, задумки ─────────────

export function simSceneHtml() {
    const c = simCfg();
    const m = M();
    const st = A.worldState();
    const cur = topKey(st.scene?.location || '');
    const offs = m.offscreen.filter(e => !e.seen && (!cur || topKey(e.where || '') === cur || !e.where)).slice(-3).reverse();
    const pets = m.pets.filter(p => p.on !== false && petHere(p));
    const a = m.armed ? ideaById(m.armed.id) : null;
    const now = rpNow();
    let html = '';
    if (offs.length) html += `<section class="lf-offcard"><div class="lf-offcard-h">${icon('home')} Пока тебя не было</div>${offHtml(offs)}</section>`;
    if (pets.length) html += `<div class="lf-chips wrap">${pets.map(p => { const s = petState(p, now); const w = s.urgent.length ? s.needs.find(n => n.v < 30)?.word : s.sleepy ? pg(p, 'Сонный', 'Сонная') : s.needs[0].word; return `<button class="lf-chip${s.urgent.length ? ' warn' : ''}" data-act="sim-pet" data-id="${esc(p.id)}">${icon('paw')} ${esc(p.name)} · ${esc(w)}</button>`; }).join('')}</div>`;
    if (c.on && a) html += `<button class="lf-teaser" data-act="who" data-name="${esc(a.who)}">${A.ava(a.who, 'xs')}<span>${esc(short(a.who))} ${c.tease ? 'что-то затевает…' : `затевает: ${esc(a.text)}`}</span>${icon('sparkles')}</button>`;
    try { html += agendaSceneHtml(); } catch (e) { console.warn('[Life] закулисье: сцена', e); }
    try { html += knockSceneHtml(); } catch (e) { console.warn('[Life] стук: сцена', e); }
    try {
        const inn = innerSceneChips();
        if (inn.length) html += `<div class="lf-chips wrap">${inn.map(x => `<button class="lf-chip" data-act="who" data-name="${esc(x.who)}">${icon(x.ic)} ${esc(short(x.who))} · ${esc(x.text)}</button>`).join('')}</div>`;
    } catch (e) { console.warn('[Life] внутренняя жизнь: сцена', e); }
    return html;
}

/** Метка под постом, где персонаж сам проявил инициативу. */
export function initChipFor(i) {
    const x = M().ideas.find(y => y.status === 'done' && y.doneMes === i && !y.off);
    return x ? `${short(x.who)}: ${IDEA_KINDS[x.kind] || 'инициатива'}` : '';
}

// ───────────── клики ─────────────

function chipVals(box, sel) { return [...(box?.querySelectorAll(`${sel} .lf-chip.on`) || [])].map(x => x.dataset.v); }

export async function simClick(act, el, ev) {
    const ui = A.ui;
    const c = simCfg();
    const m = M();
    const box = el.closest('.lf-sheet');
    const val = (sel) => box?.querySelector(sel)?.value?.trim() || '';
    if (act.startsWith('in-')) return innerClick(act, el);
    switch (act) {
        case 'sim-ltab': A.ui.lifeTab = el.dataset.v; A.render(); return true;
        case 'sim-freq': { const n = lifeKey(el.dataset.name); c.who[n] = { ...(c.who[n] || {}), freq: el.dataset.v }; A.saveSettings(); A.render(); return true; }
        case 'sim-kind': {
            const n = lifeKey(el.dataset.name);
            const kinds = new Set(whoCfg(el.dataset.name).kinds);
            kinds.has(el.dataset.v) ? kinds.delete(el.dataset.v) : kinds.add(el.dataset.v);
            c.who[n] = { ...(c.who[n] || {}), kinds: [...kinds] };
            A.saveSettings(); A.render(); return true;
        }
        case 'sim-peek': el.classList.toggle('lf-blur'); el.classList.toggle('peek'); return true;
        case 'sim-idea-now': { const x = ideaById(el.dataset.id); if (x) { arm(x, A.lastAiIndex(), true); A.saveMeta(); A.updatePrompt(); A.toast('info', `${esc(short(x.who))} сделает это в следующем ответе`, '✦ Инициатива', { timeOut: 2500 }); A.render(); } return true; }
        case 'sim-idea-del': { const x = ideaById(el.dataset.id); if (x) { if (m.armed?.id === x.id) m.armed = null; x.status = 'skip'; A.saveMeta(); A.updatePrompt(); A.render(); } return true; }
        case 'sim-ideas-gen': await A.withBusy(el, async () => {
            const who = A.canonName(el.dataset.name);
            const st = A.worldState();
            const rel = A.relOf(who, userName());
            const back = A.relOf(userName(), who);
            const store = A.chronStore();
            const chips = Object.entries(store).sort((x, y) => parseInt(y[0]) - parseInt(x[0])).slice(0, 10).map(([, e]) => (e.chips || []).join('; ')).filter(Boolean).reverse().join('\n');
            const sl = nowSlot(who);
            const input = [
                `Персонаж: ${who}. Игрок пишет за: ${userName()}. Можно: ${whoCfg(who).kinds.map(k => IDEA_KINDS[k]).join(', ')}.`,
                prefsLine([userName(), who]) ? `Вкусы: ${prefsLine([userName(), who])}` : '',
                innerBrief(who) ? `Он сам: ${innerBrief(who)}` : '',
                rel ? `Чувства ${short(who)} к ${short(userName())}: доверие ${rel.trust}, близость ${rel.closeness}, влечение ${rel.desire}, ревность ${rel.jealousy}, напряжение ${rel.tension}, вина ${rel.guilt}. В ответ ${short(userName())} к ${short(who)}: доверие ${back?.trust ?? '—'}, близость ${back?.closeness ?? '—'}, напряжение ${back?.tension ?? '—'}. Моменты: ${(rel.moments || []).slice(-5).map(x => x.text).join('; ')}` : '',
                `Сейчас: ${st.scene?.location || '—'}, ${[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' ')}. В сцене: ${(st.scene?.characters_present || []).join(', ') || '—'}.${sl ? ` По распорядку у ${short(who)}: ${sl.what}.` : ''}`,
                chips ? `Последнее в истории:\n${chips}` : '',
                `Уже задумано (не повторяй): ${m.ideas.filter(x => A.sameName(x.who, who) && x.status !== 'old').slice(-10).map(x => x.text).join('; ') || '—'}`,
            ].filter(Boolean).join('\n');
            const out = await A.askModel([{ role: 'system', content: ideasSystem() }, { role: 'user', content: input }], 900);
            const j = A.extractJson(out);
            const list = A.normalizeResult({ ideas: j?.ideas || [] }).ideas.map(x => ({ ...x, who }));
            const before = m.ideas.length;
            addIdeas(list, A.lastAiIndex());
            A.saveMeta();
            A.toast(m.ideas.length > before ? 'success' : 'info', m.ideas.length > before ? 'Задумки готовы' : 'Новых задумок не вышло', '✦ Инициатива', { timeOut: 2000 });
            A.render();
        }, 'Думаю…'); return true;
        case 'sim-pref-del': { const n = A.canonName(el.dataset.name); const arr = m.prefs[n] || []; const k = arr.findIndex(x => x.t === el.dataset.t); if (k >= 0) arr.splice(k, 1); A.saveMeta(); A.render(); return true; }
        case 'sim-pref-add': {
            A.openSheet(`${icon('heart')} ${esc(short(el.dataset.name))}`, `<div class="lf-field"><label>Что</label><input type="text" data-in="ptext" placeholder="кофе с корицей, пионы, старый джаз"></div>
                <div class="lf-actions"><button class="lf-btn primary" data-act="sim-pref-save" data-name="${esc(el.dataset.name)}" data-k="like">${icon('heart')} Любит</button>
                <button class="lf-btn" data-act="sim-pref-save" data-name="${esc(el.dataset.name)}" data-k="dislike">${icon('x')} Не любит</button></div>`);
            return true;
        }
        case 'sim-pref-save': {
            const t = val('[data-in="ptext"]');
            if (t) for (const part of t.split(/[,;]/).map(x => x.trim()).filter(Boolean)) addPrefs([{ who: el.dataset.name, text: part, kind: el.dataset.k }], A.lastAiIndex());
            A.saveMeta(); A.closeSheet(); A.render(); return true;
        }
        case 'sim-home': c.home = el.dataset.loc; A.saveSettings(); A.render(); return true;
        case 'sim-off-seen': { const e = m.offscreen.find(x => x.id === el.dataset.id); if (e) { e.seen = true; A.saveMeta(); A.updatePrompt(); A.render(); } return true; }
        case 'sim-sched-gen': await A.withBusy(el, async () => { await genSched(el.dataset.name); A.render(); }, 'Составляю…'); return true;
        case 'sim-sched-edit': {
            const list = schedOf(el.dataset.name);
            A.openSheet(`${icon('clock')} Распорядок: ${esc(short(el.dataset.name))}`, `<div class="lf-field"><label>По строчке: <small>07:00–08:00 Пробежка — Центральный парк</small></label>
                <textarea rows="10" data-in="sched">${esc(list.map(x => `${x.from}–${x.to} ${x.what}${x.where ? ` — ${x.where}` : ''}`).join('\n'))}</textarea></div>
                <button class="lf-btn primary serif full" data-act="sim-sched-save" data-name="${esc(el.dataset.name)}">${icon('check')} Сохранить</button>`);
            return true;
        }
        case 'sim-sched-save': { c.sched[lifeKey(el.dataset.name)] = parseSched(box?.querySelector('[data-in="sched"]')?.value || ''); A.saveSettings(); A.closeSheet(); A.render(); return true; }
        // питомцы
        case 'sim-pet': ui.who = `pet:${el.dataset.id}`; ui.tab = 'person'; A.closeSheet(); A.render(); return true;
        case 'sim-pet-new': petEditSheet({ id: '', name: '', kind: 'cat', look: '', traits: [], home: homeLoc(), on: true, fav: {}, needs: {} }); return true;
        case 'sim-pet-edit': { const p = petById(el.dataset.id); if (p) petEditSheet(p); return true; }
        case 'sim-pet-save': {
            const name = val('[data-in="pname"]');
            if (!name) { A.toast('info', 'Как зовут?'); return true; }
            const p = petById(el.dataset.id) || newPet({ name, kind: chipVals(box, '[data-kind]')[0] || 'cat' });
            p.name = name;
            p.kind = chipVals(box, '[data-kind]')[0] || p.kind;
            p.sex = chipVals(box, '[data-sex]')[0] || p.sex || '';
            p.age = val('[data-in="page"]');
            p.look = val('[data-in="plook"]');
            p.traits = uniq(petList(val('[data-in="ptraits"]')));
            const lines = (sel) => uniq(petLines(box?.querySelector(sel)?.value || ''));
            p.likes = lines('[data-in="plikes"]');
            p.dislikes = lines('[data-in="pdislikes"]');
            p.habits = lines('[data-in="phabits"]');
            p.story = (box?.querySelector('[data-in="pstory"]')?.value || '').trim().slice(0, 2000);
            p.health = val('[data-in="phealth"]');
            p.owner = chipVals(box, '[data-owner]')[0] || '';
            p.favName = '';
            p.temper = Object.fromEntries(TEMPER.map(([k]) => [k, Number(box?.querySelector(`[data-in="tmp-${k}"]`)?.value ?? 50)]));
            p.people = [...(box?.querySelectorAll('[data-pn]') || [])].map(r => ({ name: r.dataset.pn, role: r.querySelector('[data-in="role"]')?.value.trim().slice(0, 40) || '', love: Number(r.querySelector('[data-in="love"]')?.value ?? 50) }))
                .filter(x => x.role || x.love !== 50 || A.sameName(x.name, p.owner));
            p.home = box?.querySelector('[data-in="phome"]')?.value || '';
            p.on = !!box?.querySelector('[data-in="pon"]')?.checked;
            const now = rpNow();
            for (const [k] of pk(p).needs) { const r = box?.querySelector(`[data-in="need-${k}"]`); if (r && Number(r.value) !== needOf(p, k, now)) setNeed(p, k, Number(r.value), now); }
            A.saveMeta(); A.closeSheet(); ui.who = `pet:${p.id}`; ui.tab = 'person'; A.render(); A.updatePrompt();
            return true;
        }
        case 'sim-pet-fill': {
            const p = petById(el.dataset.id);
            if (!p) return true;
            await A.withBusy(el, async () => { await petFill(p); A.toast('success', 'Дополнила то, что было пустым', '✦ Питомец', { timeOut: 2200 }); A.render(); }, 'Читаю…');
            return true;
        }
        case 'sim-pet-del': { m.pets = m.pets.filter(p => p.id !== el.dataset.id); ui.who = ''; A.saveMeta(); A.closeSheet(); A.render(); return true; }
        case 'sim-pet-pic': {
            const p = petById(el.dataset.id);
            if (!p) return true;
            A.openSheet(`${icon('camera')} ${esc(p.name)}`, `<div class="lf-actions">
                <button class="lf-btn primary" data-act="sim-pet-draw" data-id="${esc(p.id)}">${icon('wand')} Нарисовать</button>
                <label class="lf-btn">${icon('upload')} Своё фото<input type="file" accept="image/*" data-file="pet" data-id="${esc(p.id)}" hidden></label></div>`);
            return true;
        }
        case 'sim-pet-draw': await A.withBusy(el, async () => {
            const p = petById(el.dataset.id);
            p.img = await A.drawPicture(`Portrait of a ${isF(p) ? 'female ' : ''}${pk(p).en}${p.look ? `: ${p.look}` : ''}${p.traits?.length ? `, character: ${p.traits.join(', ')}` : ''}, at home on a sofa, cozy evening light. Style: ${A.style()}. No people, no text.`, { aspect: '4:3', prefix: 'life_pet' });
            A.saveMeta(); A.closeSheet(); A.render();
        }); return true;
        // комнаты
        case 'sim-room': ui.room = el.dataset.key; ui.tab = 'map'; ui.tracePin = ''; A.closeSheet(); A.render(); return true;
        case 'sim-room-back': ui.room = ''; ui.tracePin = ''; A.render(); return true;
        case 'sim-room-draw': await A.withBusy(el, async () => { await drawRoom(el.dataset.key); A.render(); }); return true;
        case 'sim-trace-pin': ui.tracePin = ui.tracePin === el.dataset.id ? '' : el.dataset.id; A.render(); return true;
        case 'sim-room-tap': {
            if (!ui.tracePin) { const im = el.querySelector('img'); if (im) A.lightbox(im.getAttribute('src'), ''); return true; }
            const r = el.getBoundingClientRect();
            const [, t] = findTrace(ui.tracePin);
            if (t && ev) { t.x = Math.round(((ev.clientX - r.left) / r.width) * 1000) / 10; t.y = Math.round(((ev.clientY - r.top) / r.height) * 1000) / 10; A.saveMeta(); }
            ui.tracePin = '';
            A.render();
            return true;
        }
        case 'sim-trace': {
            const [, t] = findTrace(el.dataset.id);
            if (!t) return true;
            A.openSheet(`${icon(t.k === 'note' ? 'sticky' : 'eye')} ${esc(A.cut(t.t, 40))}`, `${t.k === 'note' ? `<div class="lf-paper">${esc(t.t)}${t.by ? `<i>— ${esc(short(t.by))}</i>` : ''}</div>` : `<div class="lf-hint">${esc(t.t)}</div>`}
                <div class="lf-actions"><button class="lf-btn" data-act="jump" data-mes="${t.mes}">${icon('right')} К сцене #${t.mes}</button>
                <button class="lf-btn" data-act="sim-trace-del" data-id="${esc(t.id)}">${icon('trash')} Убрать</button></div>`);
            return true;
        }
        case 'sim-trace-ok': { const [, t] = findTrace(el.dataset.id); if (t) { t.fresh = false; A.saveMeta(); A.render(); } return true; }
        case 'sim-trace-del': { const [, t, arr] = findTrace(el.dataset.id); if (t) { arr.splice(arr.indexOf(t), 1); A.saveMeta(); A.updatePrompt(); A.closeSheet(); A.render(); } return true; }
        case 'sim-trace-add': {
            A.openSheet(`${icon('sticky')} ${esc(A.placeName(el.dataset.loc))}`, `<div class="lf-field"><label>Что здесь</label><input type="text" data-in="ttext" placeholder="записка на холодильнике: «Ужин в духовке. Не жди меня. — Б.»"></div>
                <div class="lf-field"><label>Это</label><div class="lf-chips" data-kind>${[['note', 'записка'], ['trace', 'след'], ['food', 'еда'], ['gift', 'подарок']].map(([k, t], n) => `<button class="lf-chip${n === 0 ? ' on' : ''}" data-act="kind" data-v="${k}">${t}</button>`).join('')}</div></div>
                <button class="lf-btn primary serif full" data-act="sim-trace-save" data-loc="${esc(el.dataset.loc)}">${icon('check')} Оставить</button>
                <div class="lf-hint">Модель увидит это, когда сцена окажется здесь.</div>`);
            return true;
        }
        case 'sim-trace-save': {
            const t = val('[data-in="ttext"]');
            if (t) { const tr = addTrace(el.dataset.loc, { t, k: chipVals(box, '[data-kind]')[0] || 'note', by: '' }, A.lastAiIndex()); if (tr) tr.fresh = false; }
            A.saveMeta(); A.closeSheet(); A.updatePrompt(); A.render(); return true;
        }
        // слухи
        case 'sim-rumors': await A.withBusy(el, async () => { await makeRumors(); m.rumorDay = A.worldState().timestamp?.story_date || m.rumorDay; A.render(); }, 'Слушаю город…'); return true;
        case 'sim-truth': el.classList.toggle('show'); return true;
        case 'sim-rumor-push': {
            const x = m.rumors?.rumors?.[Number(el.dataset.i)];
            if (!x) return true;
            m.rumorPush = m.rumorPush?.text === x.text ? null : { text: x.text, at: A.lastAiIndex() };
            A.saveMeta(); A.updatePrompt(); A.render();
            if (m.rumorPush) A.toast('info', 'Слух уйдёт модели в следующем ответе', '✦ Слухи', { timeOut: 2200 });
            return true;
        }
        case 'sim-news-img': await A.withBusy(el, async () => {
            const n = m.rumors?.news?.[Number(el.dataset.i)];
            if (!n) return;
            n.img = await A.drawPicture(`Editorial news photograph for the headline: "${n.title}". ${n.text} Style: ${A.style()}. Photojournalism framing, no text, no captions, no logos.`, { aspect: '16:9', prefix: 'life_news' });
            A.saveMeta(); A.render();
        }, ''); return true;
        default: return false;
    }
}

/** Фото питомца загрузили. */
export function simSetPetImg(id, path) { const p = petById(id); if (p) { p.img = path; A.saveMeta(); } }
