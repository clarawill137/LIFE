// Внутренняя жизнь персонажей: тело (голод, силы, чистота, самочувствие и раны), состояние (дуется, устал, заведён…),
// что на уме (прошлое, семья, вина), свои желания (не про игрока), что заводит, как ухаживает.
// Летописец ведёт это по постам, всё можно поставить руками. Модели — короткая заметка, когда персонаж в сцене.

import { icon } from './icons.js';
import { rpNow, hoursSince, nowSlot, simCfg } from './sim.js';
import { moodNow } from './mood.js';
import { agendaCardHtml } from './agenda.js';

let A = null;
export function initInner(api) { A = api; }

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const isUser = (n) => A.sameName(n, A.ctx().name1);
const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const short = (n) => A.shortName(A.canonName(n));

// ───────────── справочники ─────────────

// [id, он, она, иконка, как играть]
export const STATES = [
    ['good', 'В духе', 'В духе', 'sun', 'хорошее настроение: шутки, легче на подъём'],
    ['playful', 'Игрив', 'Игрива', 'sparkles', 'игривое настроение: дразнит, подкалывает, флиртует'],
    ['thoughtful', 'Задумчив', 'Задумчива', 'moon', 'в своих мыслях: отвечает не сразу, взгляд в никуда'],
    ['sulky', 'Дуется', 'Дуется', 'lock', 'дуется: отвечает коротко, демонстративно возится со своим и ждёт, что заметят; заботиться не перестаёт, отходит не сразу'],
    ['irritated', 'Раздражён', 'Раздражена', 'zap', 'раздражение: колется, терпение короткое'],
    ['restless', 'На взводе', 'На взводе', 'shield', 'на взводе: дёргается, проверяет окна и выходы, не может усидеть на месте'],
    ['tired', 'Устал', 'Устала', 'coffee', 'усталость: всё медленнее и тише, мечтает лечь'],
    ['unwell', 'Нездоровится', 'Нездоровится', 'activity', 'нездоровится: держится и не признаётся, но видно; принимать заботу трудно'],
    ['sad', 'Тоскует', 'Тоскует', 'rain', 'тоска: тихо и тяжело, тянется к теплу, но говорить не спешит'],
    ['aroused', 'Заведён', 'Заведена', 'flame', 'желание: взгляд задерживается, руки сами тянутся, голос ниже'],
];
export const STATE_IDS = STATES.map(s => s[0]);
const stateById = (id) => STATES.find(s => s[0] === id) || null;
const stLabel = (s, fem) => (fem ? s[2] : s[1]);
/** Он/она: g(fem, 'голоден', 'голодна'). */
const g = (fem, m, f) => (fem ? f : m);

const NEEDS = [['food', 'Сытость', 'utensils'], ['energy', 'Силы', 'zap'], ['clean', 'Чистота', 'bath'], ['health', 'Самочувствие', 'activity']];
const DECAY = { food: 12, energy: 5, clean: 3 }; // в час истории при обычном метаболизме
const SHARE = { off: [0, 0, 'Выкл'], rare: [0.15, 10, 'Редко'], mid: [0.3, 6, 'Иногда'], often: [0.5, 3, 'Часто'] };
const ROM = { off: 'Нет', some: 'Иногда', lots: 'Часто' };
const MEAL_RE = /завтрак|обед|ужин|еда|перекус|поесть|ест\b/i;
const SLEEP_RE = /\bсон\b|спит|спать|сплю/i;
const WASH_RE = /душ|ванн|умыва/i;

// ───────────── данные ─────────────

/** Профиль персонажа (общий на все чаты): увлечения, что заводит, ухаживания, метаболизм, как часто делится. */
export function prof(who) {
    const c = simCfg();
    if (!c.prof || typeof c.prof !== 'object') c.prof = {};
    const k = A.canonName(who);
    const p = c.prof[k] || (c.prof[k] = {});
    if (!Array.isArray(p.hobbies)) p.hobbies = [];
    if (!Array.isArray(p.turnons)) p.turnons = [];
    if (!Array.isArray(p.bed)) p.bed = [];
    if (!p.romance || typeof p.romance !== 'object') p.romance = { level: 'off', rel: '', style: '' };
    if (![1, 1.5, 2].includes(p.metab)) p.metab = 1;
    if (!SHARE[p.share]) p.share = 'mid';
    if (p.on === undefined) p.on = true;
    p.fem = !!p.fem;
    return p;
}

function M() {
    const m = A.chatMeta();
    if (!m.inner || typeof m.inner !== 'object' || Array.isArray(m.inner)) m.inner = {};
    return m.inner;
}

/** Состояние персонажа в этом чате. */
function I(who) {
    const all = M();
    const k = A.canonName(who);
    let x = all[k];
    if (!x) {
        x = all[k] = { body: {}, wounds: [], state: null, thoughts: [], wants: [], spark: null, armed: null, last: null, seq: 0, lastShare: -999 };
        const now = rpNow();
        for (const [n] of NEEDS) setNeed(x, n, n === 'health' ? 100 : 80, now);
    }
    for (const f of ['wounds', 'thoughts', 'wants']) if (!Array.isArray(x[f])) x[f] = [];
    if (!x.body) x.body = {};
    return x;
}

export function innerOn(who) { return simCfg().inner !== false && !isUser(who) && prof(who).on !== false; }

function aiChars() {
    const out = [];
    for (const n of A.groupMembers().map(A.canonName)) if (n && !isUser(n) && !out.some(x => A.sameName(x, n))) out.push(n);
    return out;
}
function presentAi() {
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    return aiChars().filter(n => innerOn(n) && here.some(h => A.sameName(h, n)));
}
function userHere() {
    const here = A.worldState().scene?.characters_present || [];
    return !here.length || here.some(h => isUser(h));
}

// ───────────── тело ─────────────

function needOf(x, k, now = rpNow(), metab = 1) {
    const e = x.body?.[k];
    if (!e) return k === 'health' ? 100 : 80;
    const h = hoursSince(e.at, now);
    if (k === 'health') return clamp(e.v + h * 1.5 * metab);
    return clamp(e.v - h * DECAY[k] * (k === 'food' ? metab : 1));
}
function setNeed(x, k, v, now = rpNow()) { x.body = x.body || {}; x.body[k] = { v: clamp(v), at: { t: now.t, mes: now.mes } }; }

function needWord(k, v, metab, fem) {
    if (k === 'food') return v >= 70 ? g(fem, 'Сыт', 'Сыта') : v >= 40 ? 'Не прочь перекусить' : v >= 18 ? g(fem, 'Голоден', 'Голодна') : g(fem, metab >= 2 ? 'Зверски голоден' : 'Очень голоден', metab >= 2 ? 'Зверски голодна' : 'Очень голодна');
    if (k === 'energy') return v >= 65 ? g(fem, 'Бодр', 'Бодра') : v >= 35 ? g(fem, 'Подустал', 'Подустала') : v >= 15 ? g(fem, 'Устал', 'Устала') : 'Валится с ног';
    if (k === 'clean') return v >= 60 ? 'Свежесть' : v >= 30 ? 'Пора в душ' : 'Очень нужен душ';
    return v >= 85 ? 'В порядке' : v >= 60 ? 'Побаливает' : v >= 35 ? 'Больно' : 'Плохо';
}

function bodyState(who, now = rpNow()) {
    const x = I(who);
    const p = prof(who);
    const metab = p.metab, fem = p.fem;
    // старые раны у суперсолдата заживают быстрее
    const heal = 48 / metab;
    x.wounds = x.wounds.filter(w => hoursSince(w.at, now) < heal);
    const needs = NEEDS.map(([k, label, ic]) => { const v = needOf(x, k, now, metab); return { k, label, ic, v, word: needWord(k, v, metab, fem) }; });
    const urgent = [];
    const val = (k) => needs.find(n => n.k === k).v;
    const fast = metab >= 2 ? ' (ускоренный метаболизм — ест много и часто)' : metab > 1 ? ' (быстрый метаболизм)' : '';
    if (val('food') < 35) urgent.push(val('food') < 18 ? `зверски ${g(fem, 'голоден', 'голодна')}${fast}` : `${g(fem, 'голоден', 'голодна')}${fast}`);
    if (val('energy') < 30) urgent.push(val('energy') < 15 ? 'валится с ног от усталости' : `${g(fem, 'устал', 'устала')}, клюёт носом`);
    if (val('clean') < 28) urgent.push(`давно не ${g(fem, 'был', 'была')} в душе — хочется помыться`);
    if (val('health') < 75 || x.wounds.length) urgent.push(x.wounds.length ? `болит: ${x.wounds.slice(-2).map(w => w.t).join(', ')}` : 'нездоровится');
    return { needs, urgent, wounds: x.wounds };
}

// ───────────── мысли и желания ─────────────

const words = (t) => A.norm(t).split(/[^a-zа-яё0-9]+/i).filter(w => w.length > 3);
function similar(a, b) {
    const x = new Set(words(a)), y = words(b);
    if (!x.size || !y.length) return false;
    const hit = y.filter(w => x.has(w) || [...x].some(z => z.slice(0, 5) === w.slice(0, 5))).length;
    return hit / Math.min(x.size, y.length) >= 0.6;
}

function addThought(who, t, i, src = 'ai', w = 2) {
    const x = I(who);
    t = String(t || '').trim().replace(/^[«"]|[»"]$/g, '');
    if (!t || x.thoughts.some(y => y.status !== 'gone' && similar(y.t, t))) return null;
    const y = { id: ++x.seq, t: t.slice(0, 180), w, mes: i, src, status: 'on', shared: null };
    x.thoughts.push(y);
    const on = x.thoughts.filter(z => z.status === 'on');
    while (on.length > 8) { const z = on.sort((a, b) => a.w - b.w || a.mes - b.mes).shift(); z.status = 'gone'; }
    if (x.thoughts.length > 40) x.thoughts = x.thoughts.filter(z => z.status === 'on').slice(-40);
    return y;
}

function addWant(who, t, wth, i, src = 'ai') {
    const x = I(who);
    t = String(t || '').trim();
    if (!t || x.wants.some(y => y.status === 'on' && similar(y.t, t))) return null;
    const y = { id: ++x.seq, t: t.slice(0, 180), with: String(wth || '').trim().slice(0, 40), mes: i, src, status: 'on', voiced: null };
    x.wants.push(y);
    const on = x.wants.filter(z => z.status === 'on');
    while (on.length > 6) on.shift().status = 'gone';
    if (x.wants.length > 30) x.wants = x.wants.filter(z => z.status !== 'gone').slice(-30);
    return y;
}

const byId = (x, kind, id) => (kind === 'want' ? x.wants : x.thoughts).find(y => y.id === Number(id)) || null;

// ───────────── Летописец ─────────────

/** Что дать Летописцу: кто в сцене, что их заводит, их желания. */
export function innerChronOpts() {
    if (simCfg().inner === false) return null;
    const list = presentAi();
    if (!list.length) return null;
    const line = list.map(n => {
        const p = prof(n);
        const x = I(n);
        const wants = x.wants.filter(w => w.status === 'on').slice(-4).map(w => `[${w.id}] ${w.t}`).join('; ');
        return `${n}${p.turnons.length ? ` (возбуждает: ${p.turnons.slice(0, 8).join(', ')})` : ''}${wants ? ` — желания: ${wants}` : ''}`;
    }).join('\n');
    return { line, tokens: 220 + list.length * 60 };
}

export function innerAfterPost(i, res, msg) {
    if (simCfg().inner === false) return;
    const now = { ...rpNow(), mes: i };
    for (const r of res.inner || []) {
        const who = aiChars().find(n => A.sameName(n, r.who));
        if (!who || !innerOn(who)) continue;
        const x = I(who);
        const metab = prof(who).metab;
        if (r.ate) setNeed(x, 'food', 100, now);
        if (r.slept) setNeed(x, 'energy', 100, now);
        if (r.washed) setNeed(x, 'clean', 100, now);
        if (r.tired) {
            setNeed(x, 'energy', needOf(x, 'energy', now, metab) - r.tired, now);
            if (r.tired >= 10 && !r.washed) setNeed(x, 'clean', needOf(x, 'clean', now, metab) - 15, now);
        }
        if (r.hurt) { x.wounds.push({ id: ++x.seq, t: r.hurt, mes: i, at: { t: now.t, mes: i } }); setNeed(x, 'health', needOf(x, 'health', now, metab) - 25, now); }
        if (r.healed && x.wounds.length) { x.wounds.shift(); setNeed(x, 'health', needOf(x, 'health', now, metab) + 20, now); }
        if (r.state && !x.state?.manual) x.state = r.state === 'ok' ? null : { id: r.state, why: r.why || '', mes: i };
        if (r.thought) addThought(who, r.thought, i, 'ai');
        if (r.want) addWant(who, r.want, r.with, i, 'ai');
        for (const id of r.done || []) { const w = byId(x, 'want', id); if (w) { w.status = 'done'; w.doneMes = i; } }
        if (r.spark) {
            x.spark = { t: r.spark, mes: i, used: null };
            if (!x.state || (!x.state.manual && ['good', 'playful', 'thoughtful'].includes(x.state.id))) x.state = { id: 'aroused', why: r.spark, mes: i };
        }
    }
    for (const who of aiChars().filter(innerOn)) {
        const x = I(who);
        // за кадром — по распорядку: поел, поспал, сходил в душ
        const here = presentAi().some(n => A.sameName(n, who));
        const sl = nowSlot(who);
        if (!here && sl) {
            if (MEAL_RE.test(sl.what)) setNeed(x, 'food', 95, now);
            if (SLEEP_RE.test(sl.what)) setNeed(x, 'energy', 100, now);
            if (WASH_RE.test(sl.what)) setNeed(x, 'clean', 100, now);
        }
        if (x.state && !x.state.manual && i - x.state.mes > 20) x.state = null;
        if (x.state?.manual && x.state.until != null) {
            const ch = A.chapters?.() || [];
            const cur = ch[ch.length - 1];
            if (cur && cur.start > x.state.until) x.state = null;
        }
        if (x.spark && !x.spark.used && i > x.spark.mes) x.spark.used = i;
        if (x.armed && i > x.armed.at) {
            if (msg && A.sameName(msg.name, who)) {
                const y = byId(x, x.armed.kind, x.armed.id);
                if (y) { if (x.armed.kind === 'want') y.voiced = i; else y.shared = i; }
                x.last = { ...x.armed, mes: i };
                x.lastShare = i;
                x.armed = null;
            } else if (i - x.armed.at > 4 && !x.armed.manual) x.armed = null;
        }
    }
    maybeShare(i);
}

function maybeShare(i) {
    if (moodNow().intimOn) return;
    const sm = A.chatMeta();
    const simArmedWho = sm.armed ? (sm.ideas || []).find(y => y.id === sm.armed.id)?.who : '';
    for (const who of presentAi().sort(() => Math.random() - 0.5)) {
        const x = I(who);
        if (x.armed || (simArmedWho && A.sameName(simArmedWho, who))) continue;
        const [p, gap] = SHARE[prof(who).share] || SHARE.off;
        if (!p || i - (x.lastShare ?? -999) < gap || Math.random() > p) continue;
        const th = x.thoughts.filter(y => y.status === 'on');
        const wa = x.wants.filter(y => y.status === 'on' && (!y.voiced || i - y.voiced > 30));
        if (!th.length && !wa.length) continue;
        let kind = th.length && (!wa.length || Math.random() < 0.6) ? 'thought' : 'want';
        let pick;
        if (kind === 'thought') {
            // тяжёлые мысли всплывают чаще, недавно сказанные — реже
            const bag = th.flatMap(y => Array(Math.max(1, y.w * 2 - (y.shared && i - y.shared < 25 ? 3 : 0))).fill(y));
            pick = bag[Math.floor(Math.random() * bag.length)];
        } else pick = wa[Math.floor(Math.random() * wa.length)];
        x.armed = { kind, id: pick.id, at: i };
        return;
    }
}

// ───────────── заметка модели ─────────────

export function innerPrompt(type) {
    if (type === 'impersonate' || type === 'quiet' || simCfg().inner === false) return '';
    const L = A.chatArr().length;
    const swipe = type === 'swipe' || type === 'regenerate';
    const redo = (mes) => mes != null && ((type === 'swipe' && L - 1 === mes) || (type === 'regenerate' && L === mes));
    const U = short(userName());
    const intim = moodNow().intimOn;
    const out = [];
    for (const who of presentAi()) {
        const p = prof(who);
        const x = I(who);
        const W = short(who);
        const f = p.fem;
        const his = g(f, 'его', 'её');
        // кто он сам по себе
        const hob = p.hobbies.slice(0, 6).join(', ');
        const turn = p.turnons.slice(0, 8).join(', ');
        const rom = p.romance.level !== 'off' && userHere() && !intim
            ? ` С ${U}${p.romance.rel ? ` (${p.romance.rel})` : ''} ${g(f, 'сам', 'сама')} проявляет инициативу и не ждёт первого шага: ${p.romance.style || 'ухаживает, флиртует, делает комплименты, касается и целует мимоходом'}. ${p.romance.level === 'lots' ? `Это ${his} норма — часто и без повода.` : 'Время от времени, к месту.'}`
            : '';
        out.push(`[${W} — живой человек со своей жизнью, а не только ответ на ${U}: свои мысли, желания, дела, тело.${hob ? ` Увлечения: ${hob}.` : ''}${turn ? ` Сексуально ${g(f, 'его', 'её')} заводит: ${turn} — если такое сейчас случилось или ${U} это делает, пусть желание прорвётся.` : ''}${rom}]`);
        if (intim && p.bed.length) out.push(`[${W} в постели: ${p.bed.slice(0, 8).join('; ')}. Играй это телом, руками и голосом, в ${his} характере.]`);
        const st = stateById(x.state?.id);
        if (st && !(intim && st[0] === 'aroused')) out.push(`[Состояние ${W}: ${st[4]}${x.state.why ? ` — ${x.state.why}` : ''}. Играй в поведении, не называя.]`);
        const sl = !intim ? nowSlot(who) : null;
        if (sl && !SLEEP_RE.test(sl.what)) out.push(`[По распорядку у ${W} сейчас: ${sl.what}${sl.from ? ` (${sl.from}–${sl.to})` : ''}. ${g(f, 'Он', 'Она')} живёт своим днём: может заняться этим, позвать ${U} с собой или отложить ради того, что происходит, — но помнит.]`);
        const b = bodyState(who);
        if (b.urgent.length) out.push(`[Тело ${W}: ${b.urgent.join('; ')}. Пусть это проявится само — полезет в холодильник, зевнёт, пойдёт в душ, поморщится; без цифр и без нытья.]`);
        const sp = x.spark && (!x.spark.used || redo(x.spark.used)) ? x.spark : null;
        if (sp && !intim) out.push(`[${W} только что зацепило: ${sp.t}. Пусть желание прорвётся в поведении — задержанный взгляд, комплимент, касание, поцелуй мимоходом или провокационная фраза; первого шага от ${U} не ждёт.]`);
        const arm = x.armed || (swipe && x.last && redo(x.last.mes) ? x.last : null);
        const y = arm ? byId(x, arm.kind, arm.id) : null;
        if (y && !intim) {
            if (arm.kind === 'thought') out.push(`[У ${W} на уме: «${y.t}». Пусть это прорвётся само, в ${his} манере: поделится с ${U} ${g(f, 'сам', 'сама')}, без вопроса, — или просто видно по ${g(f, 'нему', 'ней')} (замолчать, выйти на балкон, крутить что-то в руках). Один честный кусок, без решения за один пост.]`);
            else out.push(`[${W} хочется: ${y.t}${y.with ? ` (с ${y.with})` : ''}. Это ${his} собственное желание, не про ${U}: пусть ${g(f, 'сам', 'сама')} заговорит об этом, предложит, договорится или отпросится — к месту.]`);
        }
    }
    return out.join('\n');
}

/** Строчка для генератора задумок и распорядка: увлечения, желания, ухаживания. */
export function innerBrief(who) {
    if (!innerOn(who)) return '';
    const p = prof(who);
    const x = I(who);
    const bits = [];
    if (p.hobbies.length) bits.push(`увлечения: ${p.hobbies.join(', ')}`);
    const wa = x.wants.filter(w => w.status === 'on').map(w => w.t);
    if (wa.length) bits.push(`хочет сам: ${wa.slice(-4).join('; ')}`);
    const th = x.thoughts.filter(t => t.status === 'on').map(t => t.t);
    if (th.length) bits.push(`на уме: ${th.slice(-3).join('; ')}`);
    if (p.romance.level !== 'off') bits.push(`ухаживает за ${short(userName())} ${g(p.fem, 'сам', 'сама')}: ${p.romance.style || 'по-своему'}`);
    if (p.turnons.length) bits.push(`сексуально заводит: ${p.turnons.join(', ')}`);
    return bits.join('. ');
}

// ───────────── заполнить по карточке / подумать за него ─────────────

const FILL_SYSTEM = `Ты помогаешь оживить персонажа ролевой истории на русском: чтобы у него была своя жизнь, а не только реакции на игрока.
По карточке и последним событиям ответь только JSON:
{"fem":false,"hobbies":["1–4 слова"],"turnons":["что его сексуально возбуждает в партнёре, 2–8 слов"],"bed":["как он в сексе, 3–10 слов"],"romance":{"level":"off|some|lots","rel":"кто ему игрок: жена, девушка…","style":"2–4 предложения: как он сам ухаживает, флиртует и проявляет нежность, в его манере"},"metab":1,"thoughts":[{"t":"что его тяготит или занимает, 6–14 слов","w":2}],"wants":[{"t":"его собственное желание или план, не про игрока, 6–14 слов","with":"с кем или пусто"}]}
fem — true, если персонаж женщина. hobbies — 3–8 увлечений и привычек из карточки (книги, техника, руками по дереву, спорт, пробежка по утрам…). turnons — 4–8 конкретных сексуальных триггеров: части тела, жесты, одежда, запахи, слова, ситуации, то, что делает партнёр (взрослые, по обоюдному согласию; откровенно, без цензуры, но без мата); bed — 4–8 пунктов, какой он в сексе: темп, мягкость или напор, что любит делать и слышать, привычки, что после. turnons и bed — только если между ним и игроком есть романтика, иначе []. romance.level: off — романтики с игроком нет; some — есть, но сдержанно; lots — пара, он открыто ухаживает. metab — 2, если у него ускоренный метаболизм (суперсолдат, сыворотка), иначе 1. thoughts — 3–5 внутренних тем и конфликтов: прошлое, вина, служба, будущее семьи, друзья, страхи; w — 1 (фоном), 2 (тяготит), 3 (сильно давит). wants — 2–4 его желания: с друзьями, хобби, дела, планы для дома и семьи. Всё конкретно и в его характере.`;

const THINK_SYSTEM = `Ты пишешь внутреннюю жизнь персонажа ролевой истории на русском — то, что у него на уме и чего он сам хочет, помимо игрока.
Ответь только JSON: {"thoughts":[{"t":"6–14 слов","w":2}],"wants":[{"t":"6–14 слов","with":"с кем или пусто"}]}. 2–3 мысли (что тяготит или занимает: прошлое, вина, будущее, семья, друзья, работа; w 1–3 — насколько давит) и 1–2 желания (его собственные: друзья, хобби, дела, планы). Опирайся на свежие события. Не повторяй то, что уже есть.`;

const SPICE_SYSTEM = `Ты помогаешь вести интимную линию ролевой истории для взрослых на русском. Персонажи — взрослые, в отношениях по обоюдному согласию.
По карточке и записям лорбуков о персонаже ответь только JSON: {"turnons":["2–8 слов"],"bed":["3–12 слов"]}.
turnons — 5–8 конкретных сексуальных триггеров: что в партнёре и в ситуации его возбуждает (части тела, жесты, одежда, запахи, слова, её поведение, обстоятельства). bed — 5–8 пунктов, какой он в сексе: темп, мягкость или напор, доминирование, что любит делать и слышать, что говорит, привычки, что после. Откровенно и телесно, без цензуры, но без мата и без пошлых штампов; в его характере и строго по тому, что есть в записях. Не повторяй уже записанное.`;

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

/** Записи активных лорбуков про персонажа и близость. */
async function loreAbout(who, re) {
    const W = await wiMod();
    if (!W?.loadWorldInfo) return '';
    const c = A.ctx();
    const books = new Set();
    if (c.chatMetadata?.world_info) books.add(c.chatMetadata.world_info);
    for (const ch of c.characters || []) {
        if (!A.groupMembers().some(n => A.sameName(n, ch.name))) continue;
        if (ch?.data?.extensions?.world) books.add(ch.data.extensions.world);
        const extra = (W.world_info?.charLore || []).find(e => e.name === ch.avatar)?.extraBooks || [];
        extra.forEach(b => books.add(b));
    }
    (W.selected_world_info || []).forEach(b => books.add(b));
    const name = A.norm(A.canonName(who)).split(' ')[0];
    const out = [];
    let total = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        for (const e of Object.values(data?.entries || {})) {
            const t = String(e?.content || '');
            if (e?.disable || !t || !re.test(t)) continue;
            const hay = A.norm(`${e.comment || ''} ${(e.key || []).join(' ')} ${t.slice(0, 600)}`);
            if (name && !hay.includes(name.slice(0, Math.max(3, name.length - 1)))) continue;
            const piece = `### ${e.comment || (e.key || []).join(', ')}\n${t.slice(0, 3000)}`;
            if (total + piece.length > 12000) break;
            out.push(piece); total += piece.length;
        }
    }
    return out.join('\n\n');
}

async function innerSpice(who) {
    const p = prof(who);
    const lore = await loreAbout(who, /секс|близост|постел|возбужд|интим|желани|ласк|оргазм|кончи|прелюд|касани/i);
    const input = [`Персонаж: ${A.canonName(who)}. Партнёр — ${userName()}${p.romance.rel ? ` (${p.romance.rel})` : ''}.`,
        cardText(who) ? `Карточка:\n${cardText(who)}` : '', lore ? `Лорбуки:\n${lore}` : '',
        p.turnons.length ? `Уже записано, что заводит: ${p.turnons.join('; ')}` : '', p.bed.length ? `Уже записано про постель: ${p.bed.join('; ')}` : ''].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: SPICE_SYSTEM }, { role: 'user', content: input }], 1200);
    const j = A.extractJson(out);
    if (!j) throw new Error('модель не прислала JSON (возможно, отказалась — попробуй профиль Летописца с другой моделью)');
    const take = (v) => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean);
    const a = take(j.turnons), b = take(j.bed);
    p.turnons = [...new Set([...p.turnons, ...a])].slice(0, 14);
    p.bed = [...new Set([...p.bed, ...b])].slice(0, 14);
    A.saveSettings();
    A.updatePrompt();
    return a.length + b.length;
}

function cardText(who) {
    const c = A.ctx();
    const card = (c.characters || []).find(x => x.name === A.canonName(who)) || (c.characters || []).find(x => A.sameName(x.name, who));
    return [card?.description, card?.personality, card?.scenario].filter(Boolean).join('\n').replace(/\{\{user\}\}/gi, userName()).replace(/\{\{char\}\}/gi, who).slice(0, 6000);
}

function recentChips() {
    const store = A.chronStore();
    return Object.entries(store).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 12).map(([, e]) => (e.chips || []).join('; ')).filter(Boolean).reverse().join('\n');
}

async function innerFill(who, mode) {
    who = A.canonName(who);
    const x = I(who);
    const p = prof(who);
    const card = cardText(who);
    const rel = A.relOf?.(who, userName());
    const input = [
        `Персонаж: ${who}. Игрок пишет за: ${userName()}.`,
        mode === 'fill' && card ? `Карточка:\n${card}` : '',
        mode !== 'fill' && p.hobbies.length ? `Увлечения: ${p.hobbies.join(', ')}` : '',
        rel ? `Чувства ${short(who)} к ${short(userName())}: доверие ${rel.trust}, близость ${rel.closeness}, влечение ${rel.desire}, вина ${rel.guilt}.` : '',
        recentChips() ? `Последнее в истории:\n${recentChips()}` : '',
        x.thoughts.some(t => t.status === 'on') ? `Уже на уме (не повторяй): ${x.thoughts.filter(t => t.status === 'on').map(t => t.t).join('; ')}` : '',
        x.wants.some(t => t.status === 'on') ? `Уже хочет (не повторяй): ${x.wants.filter(t => t.status === 'on').map(t => t.t).join('; ')}` : '',
    ].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: mode === 'fill' ? FILL_SYSTEM : THINK_SYSTEM }, { role: 'user', content: input }], mode === 'fill' ? 1400 : 700);
    const j = A.extractJson(out);
    if (!j) throw new Error('модель не прислала JSON');
    const str = (v) => typeof v === 'string' ? v.trim() : '';
    const arr = (v) => Array.isArray(v) ? v : [];
    const i = A.lastAiIndex();
    let n = 0;
    if (mode === 'fill') {
        const hob = arr(j.hobbies).map(str).filter(Boolean).slice(0, 8);
        if (hob.length) p.hobbies = [...new Set([...p.hobbies, ...hob])].slice(0, 10);
        const ton = arr(j.turnons).map(str).filter(Boolean).slice(0, 8);
        if (ton.length) p.turnons = [...new Set([...p.turnons, ...ton])].slice(0, 12);
        const bed = arr(j.bed).map(str).filter(Boolean).slice(0, 8);
        if (bed.length) p.bed = [...new Set([...p.bed, ...bed])].slice(0, 12);
        const r = j.romance || {};
        if (ROM[str(r.level)]) p.romance.level = str(r.level);
        if (str(r.rel)) p.romance.rel = str(r.rel).slice(0, 100);
        if (str(r.style)) p.romance.style = str(r.style).slice(0, 1500);
        if (Number(j.metab) >= 2) p.metab = 2;
        if (typeof j.fem === 'boolean') p.fem = j.fem;
        p.filled = true;
        A.saveSettings();
        n++;
    }
    for (const t of arr(j.thoughts)) if (addThought(who, str(t?.t || t), i, mode === 'fill' ? 'card' : 'ai', [1, 2, 3].includes(Number(t?.w)) ? Number(t.w) : 2)) n++;
    for (const w of arr(j.wants)) if (addWant(who, str(w?.t || w), str(w?.with), i, mode === 'fill' ? 'card' : 'ai')) n++;
    A.saveMeta();
    A.updatePrompt();
    return n;
}

// ───────────── вкладка «Внутри» и «Характер» ─────────────

const SRC = { card: 'по карточке', ai: 'заметил Летописец', me: 'твоё' };
const dots = (w) => `<span class="lf-in-w" title="Насколько давит">${[1, 2, 3].map(k => `<i class="${k <= w ? 'on' : ''}"></i>`).join('')}</span>`;

function addRow(k, who, ph) {
    return `<div class="lf-inline lf-in-add"><input type="text" data-in="in-${k}" placeholder="${esc(ph)}"><button class="lf-btn" data-act="in-add" data-k="${k}" data-name="${esc(who)}">${icon('plus')}</button></div>`;
}

export function renderInner(who) {
    if (simCfg().inner === false) return `<div class="lf-empty small">Внутренняя жизнь выключена (Мир → ⚙ → Жизнь вокруг).</div>`;
    const p = prof(who);
    const x = I(who);
    const W = esc(short(who));
    const b = bodyState(who);
    const st = stateById(x.state?.id);
    const arm = x.armed ? byId(x, x.armed.kind, x.armed.id) : null;
    const th = x.thoughts.filter(t => t.status === 'on').reverse();
    const wa = x.wants.filter(t => t.status === 'on').reverse();
    const done = x.wants.filter(t => t.status === 'done').slice(-4).reverse();
    const stChip = (id, label, ic, on) => `<button class="lf-chip${on ? ' on' : ''}" data-act="in-state" data-name="${esc(who)}" data-v="${id}">${icon(ic)} ${label}</button>`;
    const f = p.fem;
    return `${!p.filled && !p.hobbies.length ? `<button class="lf-in-setup" data-act="in-fill" data-name="${esc(who)}">${icon('sparkles')}<span><b>Оживить ${W} по карточке</b><small>увлечения, что заводит, как ухаживает, что тяготит и чего хочет сам — потом всё правится руками</small></span></button>` : ''}
    ${(() => { try { return agendaCardHtml(who); } catch (e) { console.warn('[Life] закулисье: внутри', e); return ''; } })()}
    ${A.sec('Состояние', x.state?.manual ? 'твоё — до конца главы' : st ? 'видит Летописец' : '')}
    <div class="lf-chips lf-in-states">${stChip('', 'Авто', 'spark', !x.state?.manual)}${STATES.map(s => stChip(s[0], stLabel(s, f), s[3], x.state?.id === s[0] && x.state?.manual)).join('')}</div>
    ${st ? `<div class="lf-in-now">${icon(st[3])}<span><b>${stLabel(st, f)}</b>${x.state.why ? ` — ${esc(x.state.why)}` : ''}<small>${esc(A.cap(st[4].replace(/^[^:]+:\s*/, '')))}</small></span></div>` : ''}
    ${A.sec('Тело', p.metab >= 2 ? 'метаболизм ×2' : '')}
    <div class="lf-bars lf-in-body" data-act="in-body" data-name="${esc(who)}">${b.needs.map(n => `<div class="lf-bar-row${n.v < 30 ? ' low' : ''}">${icon(n.ic)}<span>${esc(n.word)}</span><i class="lf-meter"><b style="width:${n.v}%"></b></i><small>${n.v}</small></div>`).join('')}</div>
    ${b.wounds.length ? `<div class="lf-chips wrap">${b.wounds.map(w => `<span class="lf-pref no">${icon('activity')}${esc(w.t)}<button data-act="in-heal" data-name="${esc(who)}" data-id="${w.id}" title="Зажило">${icon('check')}</button></span>`).join('')}</div>` : ''}
    ${A.sec('На уме', th.length ? 'что тяготит и занимает' : '')}
    ${th.length ? th.map(t => `<div class="lf-idea${arm === t ? ' armed' : ''}"><span class="lf-idea-ic" data-act="in-w" data-name="${esc(who)}" data-id="${t.id}">${dots(t.w)}</span>
        <span class="lf-idea-t"><small>${arm === t ? 'поделится в следующем ответе' : t.shared ? `${g(f, 'делился', 'делилась')} · #${t.shared}` : SRC[t.src] || ''}</small><b>${esc(t.t)}</b></span>
        ${arm === t ? '' : `<button class="lf-iconbtn sm" data-act="in-arm" data-k="thought" data-name="${esc(who)}" data-id="${t.id}" title="Пусть поделится">${icon('zap')}</button>`}<button class="lf-iconbtn sm" data-act="in-del" data-k="thought" data-name="${esc(who)}" data-id="${t.id}" title="Отпустило">${icon('x')}</button></div>`).join('')
        : `<div class="lf-empty small">Пока ничего. Летописец заметит, что его гложет, — или подумаю за него.</div>`}
    ${addRow('thought', who, 'Что тяготит…')}
    ${A.sec('Хочет сам', 'не про тебя')}
    ${wa.length ? wa.map(t => `<div class="lf-idea${arm === t ? ' armed' : ''}"><span class="lf-idea-ic">${icon('target')}</span>
        <span class="lf-idea-t"><small>${arm === t ? 'заговорит в следующем ответе' : t.voiced ? `${g(f, 'говорил', 'говорила')} · #${t.voiced}` : [t.with ? `с ${esc(t.with)}` : '', SRC[t.src] || ''].filter(Boolean).join(' · ')}</small><b>${esc(t.t)}</b></span>
        ${arm === t ? '' : `<button class="lf-iconbtn sm" data-act="in-arm" data-k="want" data-name="${esc(who)}" data-id="${t.id}" title="Пусть заговорит">${icon('zap')}</button>`}<button class="lf-iconbtn sm" data-act="in-done" data-name="${esc(who)}" data-id="${t.id}" title="Сбылось">${icon('check')}</button><button class="lf-iconbtn sm" data-act="in-del" data-k="want" data-name="${esc(who)}" data-id="${t.id}" title="Не надо">${icon('x')}</button></div>`).join('')
        : `<div class="lf-empty small">Своих желаний пока нет — например, «сходить с Сэмом на хоккей».</div>`}
    ${addRow('want', who, 'Чего хочется (с кем — через «с»)…')}
    ${done.length ? `<div class="lf-in-done">${done.map(t => `<span>${icon('check')} ${esc(t.t)}</span>`).join('')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="in-think" data-name="${esc(who)}">${icon('sparkles')} Что у него на уме</button>
    ${A.sec('Как часто делится сам')}
    <div class="lf-seg">${Object.entries(SHARE).map(([k, v]) => `<button class="${p.share === k ? 'on' : ''}" data-act="in-share" data-name="${esc(who)}" data-v="${k}">${v[2]}</button>`).join('')}</div>
    <div class="lf-hint">Когда ${W} в сцене, модель знает его тело, состояние и что его заводит. Иногда он сам заговорит о том, что на уме, или о своём желании — ⚡ чтобы прямо в следующем ответе.</div>`;
}

export function renderCharacter(who) {
    const p = prof(who);
    const W = esc(short(who));
    const chips = (k, list) => `<div class="lf-prefs">${list.length ? list.map(t => `<span class="lf-pref">${esc(t)}<button data-act="in-chip-del" data-k="${k}" data-name="${esc(who)}" data-t="${esc(t)}">${icon('x')}</button></span>`).join('') : '<span class="lf-dim">Пусто.</span>'}</div>`;
    return `<button class="lf-btn ghost full" data-act="in-fill" data-name="${esc(who)}">${icon('sparkles')} ${p.filled ? 'Дополнить по карточке' : 'Заполнить по карточке'}</button>
    ${A.sec('Увлечения', 'чем живёт сам')}
    ${chips('hobbies', p.hobbies)}${addRow('hobby', who, 'читать, резьба по дереву, пробежка…')}
    ${A.sec('Что заводит', 'сексуально')}
    ${chips('turnons', p.turnons)}${addRow('turnon', who, 'она в его рубашке, укус в шею, когда командует…')}
    ${A.sec('В постели', 'для интимных сцен')}
    ${chips('bed', p.bed)}${addRow('bed', who, 'медленно и внимательно, комментирует голосом…')}
    <button class="lf-btn ghost full" data-act="in-spice" data-name="${esc(who)}">${icon('flame')} Подсказать по карточке и лорбукам</button>
    ${A.sec('Кто это')}
    <div class="lf-seg">${[[false, 'Он'], [true, 'Она']].map(([k, v]) => `<button class="${p.fem === k ? 'on' : ''}" data-act="in-fem" data-name="${esc(who)}" data-v="${k ? 1 : 0}">${v}</button>`).join('')}</div>
    ${A.sec(`Ухаживания за ${esc(short(userName()))}`, 'не ждёт первого шага')}
    <div class="lf-seg">${Object.entries(ROM).map(([k, v]) => `<button class="${p.romance.level === k ? 'on' : ''}" data-act="in-rom" data-name="${esc(who)}" data-v="${k}">${v}</button>`).join('')}</div>
    ${p.romance.level !== 'off' ? `<div class="lf-field"><label>Кто ты ${g(p.fem, 'ему', 'ей')}</label><div class="lf-inline"><input type="text" data-in="in-rel" value="${esc(p.romance.rel || '')}" placeholder="жена"><button class="lf-btn" data-act="in-rel" data-name="${esc(who)}">OK</button></div></div>
    <div class="lf-field"><label>Как ухаживает</label><textarea data-in="in-style" rows="7" placeholder="по-старомодному: цветы утром, подарки без повода, комплименты; целует и трогает мимоходом; иногда выдаёт пошлость — научился у неё">${esc(p.romance.style || '')}</textarea>
        <button class="lf-btn full" data-act="in-style" data-name="${esc(who)}">${icon('check')} Сохранить</button></div>` : ''}
    ${A.sec('Метаболизм', 'как быстро голодает и заживает')}
    <div class="lf-seg">${[[1, 'Обычный'], [1.5, 'Быстрый'], [2, 'Суперсолдат']].map(([k, v]) => `<button class="${p.metab === k ? 'on' : ''}" data-act="in-metab" data-name="${esc(who)}" data-v="${k}">${v}</button>`).join('')}</div>
    <label class="lf-switch"><input type="checkbox" data-act="in-on" data-name="${esc(who)}" ${p.on !== false ? 'checked' : ''}><span></span>Внутренняя жизнь ${W} включена</label>`;
}

function bodySheet(who) {
    const b = bodyState(who);
    A.openSheet(`${icon('activity')} Тело · ${esc(short(who))}`, `${b.needs.map(n => `<div class="lf-field"><label>${n.label}: <b data-out>${n.v}</b></label><input type="range" min="0" max="100" value="${n.v}" data-rng="${n.k}"></div>`).join('')}
        <div class="lf-field"><label>Новая рана или травма</label><input type="text" data-in="in-wound" placeholder="ножевое в бок, ушиб плеча…"></div>
        <button class="lf-btn primary full" data-act="in-body-save" data-name="${esc(who)}">${icon('check')} Сохранить</button>
        <div class="lf-hint">Голод, усталость и душ тают по времени истории; ест, спит и моется — в постах (Летописец заметит) или по распорядку, пока его нет рядом.</div>`);
}

// ───────────── клики ─────────────

export async function innerClick(act, el) {
    const who = A.canonName(el.dataset.name || '');
    if (!who) return false;
    const x = I(who);
    const p = prof(who);
    const box = el.closest('.lf-sheet') || el.closest('.lf-body') || document;
    const i = A.lastAiIndex();
    const done = (meta = true) => { meta ? A.saveMeta() : A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'in-state': {
            const id = el.dataset.v;
            if (!id || (x.state?.manual && x.state.id === id)) x.state = null;
            else { const ch = A.chapters?.() || []; x.state = { id, why: '', mes: i, manual: true, until: ch[ch.length - 1]?.start ?? -1 }; }
            return done();
        }
        case 'in-body': bodySheet(who); return true;
        case 'in-body-save': {
            const now = rpNow();
            for (const [k] of NEEDS) { const v = box.querySelector(`[data-rng="${k}"]`)?.value; if (v != null) setNeed(x, k, Number(v), now); }
            const w = box.querySelector('[data-in="in-wound"]')?.value?.trim();
            if (w) x.wounds.push({ id: ++x.seq, t: w, mes: i, at: { t: now.t, mes: now.mes } });
            A.closeSheet();
            return done();
        }
        case 'in-heal': x.wounds = x.wounds.filter(w => w.id !== Number(el.dataset.id)); return done();
        case 'in-w': { const t = byId(x, 'thought', el.dataset.id); if (t) t.w = t.w >= 3 ? 1 : t.w + 1; return done(); }
        case 'in-arm': {
            const y = byId(x, el.dataset.k, el.dataset.id);
            if (!y) return true;
            x.armed = { kind: el.dataset.k, id: y.id, at: i, manual: true };
            A.toast('info', el.dataset.k === 'want' ? `${esc(short(who))} заговорит об этом в следующем ответе` : `${esc(short(who))} поделится этим в следующем ответе`, '✦ Внутри', { timeOut: 2200 });
            return done();
        }
        case 'in-del': { const y = byId(x, el.dataset.k, el.dataset.id); if (y) { y.status = 'gone'; if (x.armed?.id === y.id) x.armed = null; } return done(); }
        case 'in-done': { const y = byId(x, 'want', el.dataset.id); if (y) { y.status = 'done'; y.doneMes = i; if (x.armed?.id === y.id) x.armed = null; } return done(); }
        case 'in-add': {
            const k = el.dataset.k;
            const inp = el.parentElement?.querySelector('input');
            const v = inp?.value?.trim();
            if (!v) return true;
            if (k === 'thought') addThought(who, v, i, 'me', 2);
            else if (k === 'want') { const m = v.match(/^(.*?)\s+с\s+([А-ЯЁA-Z][^,.;]{1,30})$/); addWant(who, m ? m[1] : v, m ? m[2] : '', i, 'me'); }
            else if (k === 'hobby') { p.hobbies = [...new Set([...p.hobbies, v])]; return done(false); }
            else if (k === 'turnon') { p.turnons = [...new Set([...p.turnons, v])]; return done(false); }
            else if (k === 'bed') { p.bed = [...new Set([...p.bed, v])]; return done(false); }
            return done();
        }
        case 'in-chip-del': { const k = el.dataset.k; p[k] = (p[k] || []).filter(t => t !== el.dataset.t); return done(false); }
        case 'in-share': p.share = el.dataset.v; return done(false);
        case 'in-rom': p.romance.level = el.dataset.v; if (p.romance.level !== 'off' && !p.romance.rel) p.romance.rel = ''; return done(false);
        case 'in-rel': p.romance.rel = el.parentElement?.querySelector('input')?.value?.trim().slice(0, 100) || ''; A.toast('success', 'Сохранила', '✦ Life', { timeOut: 1000 }); return done(false);
        case 'in-style': p.romance.style = el.parentElement?.querySelector('textarea')?.value?.trim().slice(0, 2000) || ''; A.toast('success', 'Сохранила', '✦ Life', { timeOut: 1000 }); return done(false);
        case 'in-metab': p.metab = Number(el.dataset.v) || 1; return done(false);
        case 'in-fem': p.fem = el.dataset.v === '1'; return done(false);
        case 'in-on': p.on = !!el.checked; return done(false);
        case 'in-fill':
        case 'in-think':
            await A.withBusy(el, async () => {
                const n = await innerFill(who, act === 'in-fill' ? 'fill' : 'think');
                A.toast('success', act === 'in-fill' ? `${esc(short(who))}: характер, увлечения и что на уме — заполнено` : `Добавила: ${n}`, '✦ Внутри', { timeOut: 2500 });
                A.render();
            }, 'Думаю…');
            return true;
        case 'in-spice':
            await A.withBusy(el, async () => {
                const n = await innerSpice(who);
                A.toast('success', n ? `Добавила: ${n}` : 'Нового не нашлось', '✦ Характер', { timeOut: 2500 });
                A.render();
            }, 'Читаю лорбуки…');
            return true;
    }
    return false;
}

/** Плашка «внутри» для сцены: кто в каком состоянии и что срочно с телом. */
export function innerSceneChips() {
    if (simCfg().inner === false) return [];
    const out = [];
    for (const who of presentAi()) {
        const x = I(who);
        const st = stateById(x.state?.id);
        const b = bodyState(who);
        const bits = [st ? stLabel(st, prof(who).fem).toLowerCase() : '', ...b.urgent.map(u => u.split(' (')[0].split(' — ')[0])].filter(Boolean);
        if (bits.length) out.push({ who, text: bits.slice(0, 3).join(', '), ic: st ? st[3] : 'activity' });
    }
    return out;
}
