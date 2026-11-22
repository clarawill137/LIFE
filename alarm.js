// Глобальная тревога 0.76: когда мир горит. Вторжение, атака на город, катастрофа, биоугроза, взбесившийся ИИ,
// космическая угроза, налёт — включается руками или по подсказке Летописца. Пока тревога идёт: красная полоса над
// чатом с бегущей строкой, экстренное оповещение (как на телефоне; в сороковых — воздушная тревога), масштаб 1–5,
// фаза (сигнал → тревога → пик → перелом → после), паника города, кто из героев откликнулся, сводки в стиле эпохи
// (радио и сводки С.Н.Р. в 1943-м, экстренный канал ЩИТа до его падения в 2014-м, WHIH и соцсети потом). Ход кризиса — d20:
// герои в деле, Хеди сама, масштаб против них. Модель знает, что творится в мире и что правда (персонажи — нет),
// и держит тревогу фоном в каждой сцене, не решая кризис за героев. Отбой — и несколько дней «после».

import { openTracker } from './panel.js';

let A = null;
const esc = (v) => A.esc(v);
const d20 = () => 1 + Math.floor(Math.random() * 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : typeof v === 'number' ? String(v) : '');
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const uid = () => Math.random().toString(36).slice(2, 8);

export const KINDS = [
    ['invasion', '👾', 'Вторжение', 'вторжение извне: корабли, порталы, чужая армия'],
    ['attack', '💥', 'Атака', 'нападение на город: теракт, захват, оружие'],
    ['disaster', '🌋', 'Катастрофа', 'землетрясение, обрушение, падение, пожар'],
    ['bio', '☣️', 'Биоугроза', 'утечка, вирус, заражение, карантин'],
    ['ai', '🤖', 'Взбесившийся ИИ', 'сбой систем, дроны, сеть против людей'],
    ['cosmic', '🌌', 'Космическая угроза', 'энергия, разлом, Камни, что-то с неба'],
    ['raid', '✈️', 'Налёт', 'воздушный налёт, бомбёжка, ракеты'],
];
export const kindOf = (id) => KINDS.find(k => k[0] === id) || KINDS[1];
export const LVL = ['', 'район', 'город', 'страна', 'континент', 'мир'];
export const PHASES = [['signal', 'Сигнал'], ['alarm', 'Тревога'], ['peak', 'Пик'], ['turn', 'Перелом'], ['after', 'После']];
const phaseIdx = (p) => Math.max(0, PHASES.findIndex(x => x[0] === p));
export const phaseRu = (p) => PHASES[phaseIdx(p)][1];

/** Голос эпохи: как мир узнаёт о беде. */
export function eraOf(y) {
    if (y < 1950) return { id: 'war', alert: 'ВОЗДУШНАЯ ТРЕВОГА', title: 'Сирены воют', feeds: ['радио Би-би-си', 'сводка С.Н.Р.', 'полевая связь', 'слухи в лагере'], btn: '📻 Сводка', busy: 'Ловим волну…', how: 'сирены, затемнение, радио и полевые сводки; телефонов и телевидения нет', people: 'укрытия, затемнение окон, сирены, бег к бомбоубежищам' };
    if (y < 2014) return { id: 'shield', alert: 'ЩИТ: ТРЕВОГА', title: 'Экстренный канал', feeds: ['экстренный канал ЩИТа', 'WHIH Newsfront', 'CNN', 'соцсети'], btn: '📺 Экстренный канал', busy: 'Выходим в эфир…', how: 'экстренный канал ЩИТа, телевидение, смс-оповещения, соцсети', people: 'пробки на мостах, очереди на заправках, все смотрят новости в телефонах' };
    if (y < 2016) return { id: 'avengers', alert: 'ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ', title: 'Экстренное оповещение', feeds: ['WHIH Newsfront', 'CNN', 'соцсети', 'экстренное оповещение'], btn: '📺 Экстренный выпуск', busy: 'Выходим в эфир…', how: 'телевидение, оповещения на телефонах, соцсети; ЩИТа больше нет — все ждут Мстителей', people: 'все смотрят в телефоны и в небо над Башней Мстителей, пробки на мостах, слухи в соцсетях' };
    if (y < 2023) return { id: 'split', alert: 'ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ', title: 'Экстренное оповещение', feeds: ['WHIH Newsfront', 'CNN', 'соцсети', 'экстренное оповещение'], btn: '📺 Экстренный выпуск', busy: 'Выходим в эфир…', how: 'экстренные оповещения на телефонах, телевидение, соцсети; Мстители расколоты', people: 'телефоны воют одновременно, пробки, слухи в соцсетях, кто-то снимает на видео' };
    return { id: 'now', alert: 'ЭКСТРЕННОЕ ОПОВЕЩЕНИЕ', title: 'Экстренное оповещение', feeds: ['WHIH Newsfront', 'Daily Bugle', 'соцсети', 'экстренное оповещение'], btn: '📺 Экстренный выпуск', busy: 'Выходим в эфир…', how: 'экстренные оповещения на телефонах, стримы, соцсети, WHIH', people: 'телефоны воют разом, все снимают, пробки, магазины пустеют' };
}
function year() { try { const d = A.parseDate(A.worldState()?.timestamp?.story_date); return d && !isNaN(d) ? d.getFullYear() : 2024; } catch { return 2024; } }
function nowStamp() { const ts = A.worldState()?.timestamp || {}; return [ts.story_date, ts.story_time].filter(Boolean).join(' '); }
function storyDayIso() { try { const d = A.parseDate(A.worldState()?.timestamp?.story_date); return d && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; } catch { return ''; } }
const addDaysIso = (iso, n) => { const d = new Date(`${iso}T12:00:00`); if (isNaN(d)) return ''; d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const cfg = () => { const s = A.settings(); if (!s.alarm || typeof s.alarm !== 'object') s.alarm = {}; if (s.alarm.on === undefined) s.alarm.on = true; if (s.alarm.bar === undefined) s.alarm.bar = true; return s.alarm; };
const on = () => !!A && A.settings().enabled !== false && cfg().on !== false;
export function M() {
    const cm = A.chatMeta();
    if (!cm.ga || typeof cm.ga !== 'object') cm.ga = {};
    const s = cm.ga;
    if (!Array.isArray(s.feed)) s.feed = [];
    if (!Array.isArray(s.heroes)) s.heroes = [];
    if (!Array.isArray(s.log)) s.log = [];
    if (!Array.isArray(s.past)) s.past = [];
    return s;
}
/** Без создания: чаты, где тревоги не было, не получают пустой ga в метаданные. */
const peek = () => { try { const g = A?.chatMeta?.()?.ga; return g && typeof g === 'object' ? g : null; } catch { return null; } };
export const active = () => !!peek()?.on;
const save = () => { A.saveMeta(); A.updatePrompt?.(); paintBar(); };

// ───────────── включить, ход, отбой ─────────────

/** Включить тревогу: { kind, name, where, lvl, pub, truth } — что знают все и что правда. */
export function start(x = {}) {
    const s = M();
    const k = kindOf(x.kind)[0];
    Object.assign(s, {
        on: true, id: uid(), kind: k, name: str(x.name, 90) || kindOf(k)[2], where: str(x.where, 80) || 'Нью-Йорк', lvl: clamp(Number(x.lvl) || 2, 1, 5),
        phase: 'alarm', pub: str(x.pub, 500), truth: str(x.truth, 500), start: nowStamp(), startMes: A.chatArr().length - 1,
        feed: [], heroes: arr(x.heroes).map(h => ({ who: A.canonName(str(h?.who, 60)), st: str(h?.st, 40) || 'в пути' })).filter(h => h.who).slice(0, 8),
        panic: clamp(25 + 12 * (Number(x.lvl) || 2), 0, 100), log: [], after: null, pend: null, pendStep: null, people: '', pushed: false, seen: '',
    });
    const E = eraOf(year());
    s.feed.unshift({ src: E.feeds[E.feeds.length - 1] || 'оповещение', t: `${E.alert}: ${s.name} — ${s.where}. ${s.pub || 'Оставайтесь в укрытии, следите за сообщениями.'}`.slice(0, 260), kind: 'push', at: nowStamp() });
    save();
    return s;
}
/** Ход кризиса: d20 + герои на месте + Хеди сама − масштаб. 1 на кубике или ≤6 — хуже, 7–13 — держится, 14–22 — перелом, 20 на кубике или 23+ — решающий перелом. */
export function modOf(s = M(), hedy = false) {
    const engaged = s.heroes.filter(h => /на месте|в бою|в деле|держит/i.test(h.st)).length;
    const parts = [];
    let m = 0;
    if (engaged) { const v = Math.min(6, engaged * 2); m += v; parts.push(`+${v}: героев на месте — ${engaged}`); }
    if (hedy) { m += 3; parts.push('+3 Хеди сама'); }
    if (s.lvl > 2) { m -= s.lvl - 2; parts.push(`−${s.lvl - 2} масштаб`); }
    return { mod: clamp(m, -4, 8), parts };
}
export function stepOutcome(roll, total) {
    if (roll === 20 || total >= 23) return 'win';
    if (roll === 1 || total <= 6) return 'worse';
    if (total <= 13) return 'hold';
    return 'turn';
}
export const OUT_RU = { worse: 'хуже', hold: 'держится', turn: 'перелом', win: 'решающий перелом' };
export function step({ roll = d20(), hedy = false } = {}) {
    const s = M();
    if (!s.on) return null;
    const { mod, parts } = modOf(s, hedy);
    const total = roll + mod;
    const out = stepOutcome(roll, total);
    const pi = phaseIdx(s.phase);
    if (out === 'worse') { if (s.phase === 'turn') s.phase = 'peak'; else if (pi < 2) s.phase = PHASES[pi + 1][0]; else s.lvl = clamp(s.lvl + 1, 1, 5); s.panic = clamp(s.panic + 15, 0, 100); }
    else if (out === 'hold') { if (pi < 2) s.phase = PHASES[pi + 1][0]; s.panic = clamp(s.panic + 5, 0, 100); }
    else if (out === 'turn') { s.phase = pi < 3 ? 'turn' : s.phase; s.lvl = clamp(s.lvl - (pi >= 3 ? 1 : 0), 1, 5); s.panic = clamp(s.panic - 12, 0, 100); }
    else { s.phase = 'turn'; s.lvl = clamp(s.lvl - 1, 1, 5); s.panic = clamp(s.panic - 25, 0, 100); }
    const r = { roll, mod, total, out, parts, phase: s.phase, lvl: s.lvl, at: nowStamp(), hedy, mes: A.chatArr().length - 1 };
    s.log.unshift(r);
    s.log = s.log.slice(0, 12);
    s.pendStep = r;
    save();
    return r;
}
/** Отбой: тревога снята, несколько дней «после» — город залечивает раны. */
export function stand(text = '') {
    const s = M();
    if (!s.on) return null;
    const day = storyDayIso();
    s.after = { until: day ? addDaysIso(day, 3) : '', text: str(text, 400), name: s.name, where: s.where, kind: s.kind };
    s.past.unshift({ id: s.id, name: s.name, where: s.where, kind: s.kind, lvl: s.lvl, start: s.start, end: nowStamp(), text: str(text, 300) });
    s.past = s.past.slice(0, 10);
    s.on = false; s.phase = 'after'; s.pendStep = null;
    save();
    return s.after;
}
export function setHero(who, st) {
    const s = M();
    who = A.canonName(str(who, 60));
    if (!who) return;
    const h = s.heroes.find(x => A.sameName(x.who, who));
    if (!st) s.heroes = s.heroes.filter(x => x !== h);
    else if (h) h.st = st; else s.heroes.push({ who, st });
    save();
}

// ───────────── модель: что случилось, сводка ─────────────

const SYS_NEW = `Ты — мастер мира ролевой истории God Complex (AU по Marvel, по-русски). Придумай глобальную угрозу, которая прямо сейчас обрушивается на мир истории, — по виду ниже, верную эпохе, канону и тому, что уже было в истории. Масштаб — 1 район, 2 город, 3 страна, 4 континент, 5 мир. Разведи: что знают все (официально, в новостях) и правду, которую почти никто не знает (кто или что стоит за этим на самом деле). Не решай кризис и не делай героев всесильными. Кто из героев этой эпохи откликнется — только те, кто в эту эпоху жив и на Земле.
Только JSON: {"name":"короткое имя кризиса, как в новостях","where":"где","lvl":2,"pub":"что знают все, 1–2 предложения","truth":"правда за кадром, 1–2 предложения","heroes":[{"who":"","st":"на месте|в пути|не отвечает"}]}`;
export async function invent(kind = 'attack', ask = '') {
    const E = eraOf(year());
    const K = kindOf(kind);
    const msgs = [{ role: 'system', content: SYS_NEW }, { role: 'user', content: `Вид: ${K[2]} — ${K[3]}.\nДата истории: ${nowStamp() || '?'}; эпоха: как мир узнаёт о беде — ${E.how}.${ask ? `\nПожелание: ${str(ask, 300)}` : ''}` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 1800, { what: 'глобальная тревога', check: (x) => str(x?.name) }, { world: true }) : A.extractJson(await A.askModel(msgs, 1400));
    if (!str(j?.name)) throw new Error('Модель не придумала — ещё раз');
    return start({ kind: K[0], ...j });
}
const SYS_NEWS = `Ты — новостная лента мира ролевой истории God Complex (AU по Marvel, по-русски) во время глобальной тревоги. Напиши свежие сообщения в стиле эпохи (источники ниже): коротко, живо, как настоящие новости, сводки или посты; разные голоса. Ты знаешь только то, что знают все, — не правду за кадром. Учти фазу и масштаб; без решения кризиса за героев.
Только JSON: {"feed":[{"src":"источник","t":"одна строка новости или сообщения","kind":"tv|radio|push|social|official"}],"people":"что сейчас делают люди в городе, одной фразой"}`;
export async function bulletin() {
    const s = M();
    if (!s.on) throw new Error('Тревоги нет');
    const E = eraOf(year());
    const last = s.log[0];
    const usr = [`Кризис: ${s.name} (${kindOf(s.kind)[2]}) — ${s.where}. Масштаб ${s.lvl}/5 (${LVL[s.lvl]}), фаза: ${phaseRu(s.phase)}, паника ${s.panic}/100.`,
        `Что знают все: ${s.pub || '—'}`, last ? `Последний поворот: ${OUT_RU[last.out]}.` : '', s.heroes.length ? `Герои: ${s.heroes.map(h => `${h.who} — ${h.st}`).join('; ')}.` : '',
        `Источники эпохи: ${E.feeds.join(', ')}. Дата: ${nowStamp()}.`, `Уже было (не повторяй): ${s.feed.slice(0, 6).map(f => f.t).join(' | ')}`].filter(Boolean).join('\n');
    const msgs = [{ role: 'system', content: SYS_NEWS }, { role: 'user', content: usr }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 1400, { what: 'тревога: сводка', check: (x) => Array.isArray(x?.feed) && x.feed.length }, { world: true }) : A.extractJson(await A.askModel(msgs, 1000));
    const add = arr(j?.feed).map(f => ({ src: str(f?.src, 40) || E.feeds[0], t: str(f?.t, 260), kind: ['tv', 'radio', 'push', 'social', 'official'].includes(f?.kind) ? f.kind : 'tv', at: nowStamp() })).filter(f => f.t).slice(0, 5);
    if (!add.length) throw new Error('Лента пустая — ещё раз');
    s.feed = [...add, ...s.feed].slice(0, 30);
    if (str(j?.people)) s.people = str(j.people, 200);
    save();
    return add;
}

// ───────────── модель знает ─────────────

export function alarmPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate' || !peek()) return '';
    const s = M();
    const E = eraOf(year());
    if (s.on) {
        const hs = s.heroes.length ? ` Герои: ${s.heroes.map(h => `${A.shortName(h.who)} — ${h.st}`).join('; ')}.` : '';
        const step = s.pendStep ? ` Только что поворот: ${OUT_RU[s.pendStep.out]} — покажи его в мире (новости, звук, люди), без цифр и кубиков.` : '';
        const news = s.feed.slice(0, 2).map(f => `${f.src}: «${f.t}»`).join(' ');
        return `[Глобальная тревога: ${s.name} — ${s.where}. Масштаб ${s.lvl}/5 (${LVL[s.lvl]}), фаза: ${phaseRu(s.phase)}${s.start ? `, началось: ${s.start}` : ''}. Что знают все: ${s.pub || kindOf(s.kind)[3]}. ${news ? `В новостях: ${news} ` : ''}Мир сейчас: ${s.people || E.people}; паника ${s.panic >= 70 ? 'сильная' : s.panic >= 40 ? 'заметная' : 'сдержанная'}.${hs}${s.truth ? ` Правда за кадром (персонажи не знают, не раскрывай без причины): ${s.truth}.` : ''}${step} Пусть тревога проступает в каждой сцене — фоном или впрямую, по месту: ${E.how}. Не решай кризис за героев.]`;
    }
    const a = s.after;
    const day = storyDayIso();
    if (a && (!a.until || !day || day <= a.until)) return `[После глобальной тревоги («${a.name}», ${a.where}): город залечивает раны — разрушения, траур, очереди, герои в новостях, люди говорят об этом${a.text ? `; ${a.text}` : ''}. Пусть это чувствуется в мелочах.]`;
    return '';
}
export function alarmAfterPost(i, j) {
    if (!on()) return;
    const g = j?.ga && typeof j.ga === 'object' ? j.ga : null;
    if (!peek() && !str(g?.what)) return;
    const s = M();
    let dirty = false;
    if (s.pendStep && i > (s.pendStep.mes ?? -1)) { s.pendStep = null; dirty = true; }
    if (g && !s.on && str(g.what)) { s.pend = { what: str(g.what, 200), where: str(g.where, 80), lvl: clamp(Number(g.lvl) || 2, 1, 5), kind: KINDS.some(k => k[0] === g.kind) ? g.kind : 'attack', mes: i }; dirty = true; }
    if (g && s.on && ['up', 'down', 'over'].includes(g.step)) {
        if (g.step === 'over') { stand(''); s.after.mes = i; }
        else { s.lvl = clamp(s.lvl + (g.step === 'up' ? 1 : -1), 1, 5); s.log.unshift({ out: g.step === 'up' ? 'worse' : 'turn', from: 'post', mes: i, at: nowStamp(), lvl: s.lvl, phase: s.phase }); }
        dirty = true;
    }
    if (dirty) { A.saveMeta(); A.updatePrompt?.(); paintBar(); }
}
export function alarmChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const s = M();
    return s.on
        ? { key: '"ga": {}', tokens: 80, rule: `ga — идёт глобальная тревога «${s.name}» (масштаб ${s.lvl}/5). По ЭТОМУ посту: {"step":"up — стало хуже, масштаб вырос | down — угроза отступает | over — угроза снята совсем | пусто"}. Нечего — {}.`, input: `Тревога: ${s.name}, ${s.where}, фаза ${phaseRu(s.phase)}.` }
        : { key: '"ga": {}', tokens: 90, rule: 'ga — ТОЛЬКО если в ЭТОМ посте начинается угроза мирового или городского масштаба (вторжение, атака на город, катастрофа, эпидемия, взбесившийся ИИ, налёт): {"what":"что, 3–10 слов","where":"где","lvl":1-5,"kind":"invasion|attack|disaster|bio|ai|cosmic|raid"}. Бытовое, драки и стычки — нет. Нечего — {}.', input: '' };
}
export function alarmRecs(i) {
    if (!peek()) return [];
    const s = M();
    const out = [];
    if (s.pend && s.pend.mes === i) out.push({ id: 'ga:pend', g: 'Тревога', icon: 'alert', t: `похоже на глобальную тревогу: ${s.pend.what}${s.pend.where ? ` (${s.pend.where})` : ''} — включить в Сцене → 🚨`, del: () => { s.pend = null; } });
    for (const r of s.log) if (r.from === 'post' && r.mes === i) out.push({ id: `ga:${r.at}:${i}`, g: 'Тревога', icon: 'alert', t: r.out === 'worse' ? 'тревога: стало хуже' : 'тревога: угроза отступает', del: () => { s.log = s.log.filter(y => y !== r); } });
    if (s.after?.mes === i) out.push({ id: 'ga:over', g: 'Тревога', icon: 'alert', t: `отбой тревоги: ${s.after.name}`, del: () => {} });
    return out;
}

// ───────────── полоса над чатом, оповещение, сирена ─────────────

let barSig = '';
export function paintBar() {
    if (typeof document === 'undefined') return;
    let s = null;
    try { s = A?.hasChat?.() && on() && cfg().bar !== false && peek()?.on ? M() : null; } catch { s = null; }
    const show = !!s?.on;
    document.body?.classList.toggle('lf-alarm-on', show);
    let bar = document.getElementById('lf-alarm-bar');
    if (!show) { bar?.remove(); document.getElementById('lf-alarm-glow')?.remove(); barSig = ''; return; }
    const E = eraOf(year());
    const sig = `${s.id}|${s.lvl}|${s.phase}|${s.feed[0]?.t || ''}`;
    if (!document.getElementById('lf-alarm-glow')) { const g = document.createElement('div'); g.id = 'lf-alarm-glow'; document.body.append(g); }
    if (!bar) { bar = document.createElement('div'); bar.id = 'lf-alarm-bar'; bar.addEventListener('click', () => openSheet()); document.body.append(bar); }
    if (sig !== barSig) {
        barSig = sig;
        bar.className = `lvl${s.lvl} ph-${s.phase} era-${E.id}`;
        const tick = s.feed.slice(0, 4).map(f => `${f.src}: ${f.t}`).join('   ✦   ');
        bar.innerHTML = `<b>⚠ ${esc(E.alert)}</b><span class="lf-alarm-meta">${esc(s.name)} · ${esc(s.where)} · ур. ${s.lvl} · ${esc(phaseRu(s.phase))}</span><span class="lf-alarm-tick"><i>${esc(tick || s.pub || '')}</i></span>`;
    }
    if (!s.pushed) { s.pushed = true; A.saveMeta(); push(s, E); }
}
function push(s, E) {
    const el = document.createElement('div');
    el.className = `lf-alarm-push era-${E.id}`;
    el.innerHTML = `<div class="lf-alarm-push-h">${E.id === 'war' ? '📻' : '⚠'} ${esc(E.alert)}</div><b>${esc(s.name)} — ${esc(s.where)}</b><p>${esc(s.pub || kindOf(s.kind)[3])}</p><small>тап — что происходит</small>`;
    el.addEventListener('click', () => { el.remove(); openSheet(); });
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 9000);
}
function openSheet() { try { A.openHub?.('scene'); setTimeout(() => openTracker('alarm'), 120); } catch (e) { console.warn('[Life] тревога', e); } }
let audio = null;
/** Сирена: в сороковых — воздушная (низкий вой), потом — городская. Только по тапу (айфон иначе не даст звук). */
export function siren(sec = 4) {
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audio = audio || new AC();
        const war = eraOf(year()).id === 'war';
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = war ? 'sawtooth' : 'square';
        const t0 = audio.currentTime;
        const lo = war ? 260 : 620, hi = war ? 520 : 1180, per = war ? 2 : 0.9;
        for (let t = 0; t < sec; t += per) { o.frequency.linearRampToValueAtTime(hi, t0 + t + per / 2); o.frequency.linearRampToValueAtTime(lo, t0 + t + per); }
        o.frequency.setValueAtTime(lo, t0);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.3); g.gain.setValueAtTime(0.07, t0 + sec - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + sec);
        o.connect(g).connect(audio.destination);
        o.start(t0); o.stop(t0 + sec + 0.05);
        return true;
    } catch { return false; }
}

// ───────────── Сцена → 🚨 ─────────────

const ui = { kind: 'attack', ask: '', truth: false, hedy: false, for: '' };
const FEED_ICO = { tv: '📺', radio: '📻', push: '📳', social: '💬', official: '🏛' };
export function alarmSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const E = eraOf(year());
    if (!s.on) {
        const k = kindOf(ui.kind);
        return `${s.pend ? `<div class="lf-ga-pend"><b>⚠ Похоже на глобальную тревогу</b><p>${esc(s.pend.what)}${s.pend.where ? ` — ${esc(s.pend.where)}` : ''} · масштаб ${s.pend.lvl}/5</p><div class="lf-actions"><button class="lf-btn primary" data-act="ga-pend">🚨 Включить</button><button class="lf-btn ghost" data-act="ga-nope">Нет</button></div></div>` : ''}
            ${A.sec('Включить тревогу', E.title)}
            <div class="lf-chips wrap">${KINDS.map(([id, ic, n]) => `<button class="lf-chip${ui.kind === id ? ' on' : ''}" data-act="ga-kind" data-v="${id}">${ic} ${esc(n)}</button>`).join('')}</div>
            <div class="lf-hint">${esc(k[3])}</div>
            <input type="text" class="lf-input" data-gaf="ask" placeholder="пожелание (необязательно): где, кто стоит за этим" value="${esc(ui.ask)}">
            <div class="lf-actions"><button class="lf-btn primary" data-act="ga-invent">🎲 Что случилось — модель</button><button class="lf-btn" data-act="ga-own">✍️ Своё</button></div>
            ${ui.own ? `<div class="lf-ga-own"><input type="text" class="lf-input" data-gaf="name" placeholder="как это называют в новостях"><input type="text" class="lf-input" data-gaf="where" placeholder="где — Нью-Йорк"><textarea class="lf-input" data-gaf="pub" rows="2" placeholder="что знают все"></textarea><textarea class="lf-input" data-gaf="truth" rows="2" placeholder="правда за кадром (необязательно)"></textarea><div class="lf-chips wrap">${[1, 2, 3, 4, 5].map(n => `<button class="lf-chip${(ui.lvl || 2) === n ? ' on' : ''}" data-act="ga-lvl" data-v="${n}">${n} · ${LVL[n]}</button>`).join('')}</div><div class="lf-actions"><button class="lf-btn primary" data-act="ga-start">🚨 Включить</button></div></div>` : ''}
            ${s.after && (!s.after.until || !storyDayIso() || storyDayIso() <= s.after.until) ? `<div class="lf-note">После тревоги «${esc(s.after.name)}»: город залечивает раны до ${esc(s.after.until || '…')}.</div>` : ''}
            ${s.past.length ? `${A.sec('Были')}<div class="lf-timeline">${s.past.slice(0, 5).map(p => `<div class="lf-tl"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${kindOf(p.kind)[1]} ${esc(p.name)}</b><small>${esc([p.where, p.start, p.end && `отбой ${p.end}`].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div>` : ''}
            <div class="lf-hint">Пока тревога идёт — над чатом красная полоса, модель держит её фоном в каждой сцене. Летописец сам подскажет, если в посте начнётся беда мирового масштаба.</div>`;
    }
    if (ui.for !== s.id) { ui.for = s.id; ui.hedy = false; ui.truth = false; }
    const pi = phaseIdx(s.phase);
    const md = modOf(s, ui.hedy);
    const ps = s.pendStep;
    const last = ps ? `🎲 ${ps.roll}${ps.mod ? ` ${ps.mod > 0 ? '+' : '−'} ${Math.abs(ps.mod)}` : ''} = ${ps.total} — ${OUT_RU[ps.out]}: фаза «${phaseRu(ps.phase)}», масштаб ${ps.lvl}/5. Уйдёт в следующий пост.` : '';
    const hero = (h) => `<div class="lf-ga-hero"><b>${esc(A.shortName(h.who))}</b><span>${['на месте', 'в пути', 'не отвечает', 'ранен'].map(t => `<button class="lf-chip small${h.st === t ? ' on' : ''}" data-act="ga-hero" data-who="${esc(h.who)}" data-v="${t}">${t}</button>`).join('')}<button class="lf-chip small" data-act="ga-hero" data-who="${esc(h.who)}" data-v="">✕</button></span></div>`;
    return `<div class="lf-ga-card lvl${s.lvl}">
            <div class="lf-ga-top"><span>${kindOf(s.kind)[1]} ${esc(E.alert)}</span><em>${esc(s.start || '')}</em></div>
            <b class="lf-ga-name">${esc(s.name)}</b><small>${esc(s.where)} · масштаб: ${esc(LVL[s.lvl])}</small>
            <div class="lf-ga-lvl">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= s.lvl ? 'on' : ''}"></i>`).join('')}</div>
            <div class="lf-ga-ph">${PHASES.map(([id, n], k) => `<span class="${k === pi ? 'on' : k < pi ? 'done' : ''}">${esc(n)}</span>`).join('')}</div>
            <p>${esc(s.pub || kindOf(s.kind)[3])}</p>
            ${s.truth ? `<button class="lf-ga-truth${ui.truth ? ' open' : ''}" data-act="ga-truth">${ui.truth ? `👁 ${esc(s.truth)}` : '👁 правда за кадром — тап (персонажи не знают)'}</button>` : ''}
            <div class="lf-ga-panic"><small>паника</small><i><b style="width:${s.panic}%"></b></i><em>${s.panic}</em></div>
        </div>
        ${last ? `<div class="lf-note">${esc(last)}</div>` : ''}
        <div class="lf-actions"><button class="lf-btn primary" data-act="ga-step">🎲 Ход кризиса</button><button class="lf-btn" data-act="ga-news">${esc(E.btn)}</button><button class="lf-btn ghost" data-act="ga-siren">🔊 Сирена</button></div>
        <label class="lf-ga-hedy"><button class="lf-chip${ui.hedy ? ' on' : ''}" data-act="ga-hedy">⚡ Хеди вмешивается сама</button><small>d20 ${md.mod >= 0 ? '+' : '−'} ${Math.abs(md.mod)}${md.parts.length ? ` (${esc(md.parts.join(', '))})` : ''}: ≤6 хуже · 7–13 держится · 14–22 перелом · 23+ или чистая 20 — решающий</small></label>
        ${A.sec('Лента', E.feeds.slice(0, 3).join(' · '))}
        <div class="lf-ga-feed">${s.feed.slice(0, 8).map(f => `<div class="lf-ga-f k-${esc(f.kind)}"><span>${FEED_ICO[f.kind] || '📺'}</span><div><small>${esc(f.src)}${f.at ? ` · ${esc(f.at)}` : ''}</small><p>${esc(f.t)}</p></div></div>`).join('') || `<div class="lf-empty small">Лента пустая — «${esc(E.btn.replace(/^\S+\s/, ''))}».</div>`}</div>
        ${A.sec('Герои', s.heroes.length ? String(s.heroes.length) : 'никто')}
        ${s.heroes.map(hero).join('')}
        <div class="lf-ga-addh"><input type="text" class="lf-input" data-gaf="hero" placeholder="кто откликнулся"><button class="lf-btn small" data-act="ga-addhero">＋</button></div>
        ${s.log.length ? `${A.sec('Повороты')}<div class="lf-timeline">${s.log.slice(0, 6).map(r => `<div class="lf-tl"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(OUT_RU[r.out] || r.out)}${r.from === 'post' ? ' (по посту)' : ''}</b><small>${esc([r.roll ? `d20 ${r.roll}${r.mod ? `${r.mod > 0 ? '+' : '−'}${Math.abs(r.mod)}` : ''} = ${r.total}` : '', `ур. ${r.lvl}`, r.phase && phaseRu(r.phase), r.at].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div>` : ''}
        <input type="text" class="lf-input" data-gaf="after" placeholder="чем кончилось (для «после», необязательно)">
        <div class="lf-actions"><button class="lf-btn ghost" data-act="ga-stand">✅ Отбой тревоги</button></div>`;
}
export const alarmState = () => { const s = peek(); return s?.on ? `ур. ${s.lvl}` : s?.pend ? '?' : ''; };

export async function alarmClick(act, el) {
    const v = el.dataset.v;
    const box = el.closest?.('.lf-trk-body') || (typeof document !== 'undefined' ? document : null);
    const val = (k) => box?.querySelector?.(`[data-gaf="${k}"]`)?.value || '';
    if (act === 'ga-kind') ui.kind = v;
    else if (act === 'ga-own') ui.own = !ui.own;
    else if (act === 'ga-lvl') ui.lvl = Number(v) || 2;
    else if (act === 'ga-invent') { ui.ask = val('ask'); await A.withBusy(el, () => invent(ui.kind, ui.ask), 'Мир содрогается…'); A.toast('warning', `🚨 ${esc(M().name)}`); }
    else if (act === 'ga-start') { if (!val('name').trim() && !val('pub').trim()) { A.toast('info', 'Назови, что случилось'); return; } start({ kind: ui.kind, name: val('name'), where: val('where'), pub: val('pub'), truth: val('truth'), lvl: ui.lvl || 2 }); ui.own = false; }
    else if (act === 'ga-pend') { const p = M().pend; if (p) { start({ kind: p.kind, name: p.what, where: p.where, lvl: p.lvl, pub: p.what }); } }
    else if (act === 'ga-nope') { M().pend = null; A.saveMeta(); }
    else if (act === 'ga-truth') ui.truth = !ui.truth;
    else if (act === 'ga-hedy') ui.hedy = !ui.hedy;
    else if (act === 'ga-step') step({ hedy: ui.hedy });
    else if (act === 'ga-news') { const add = await A.withBusy(el, () => bulletin(), eraOf(year()).busy); A.toast('info', esc(add[0]?.t || '')); }
    else if (act === 'ga-siren') { if (!siren()) A.toast('info', 'Звук не пустили'); return; }
    else if (act === 'ga-hero') setHero(el.dataset.who, v);
    else if (act === 'ga-addhero') { const w = val('hero').trim(); if (!w) return; setHero(w, 'в пути'); }
    else if (act === 'ga-stand') { if (!confirm('Отбой тревоги?')) return; stand(val('after')); A.toast('success', 'Отбой. Несколько дней — «после».'); }
    else return;
    A.saveMeta(); A.updatePrompt?.(); paintBar(); A.render?.();
}

export function initAlarm(api) {
    A = api;
    if (typeof setInterval === 'function' && typeof document !== 'undefined') { const iv = setInterval(() => { try { paintBar(); } catch { /* */ } }, 1500); iv?.unref?.(); }
}
export const _ga = { M, ui, eraOf };
