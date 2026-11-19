// Быт. То, что тянется за кадром и забывается первым: что в доме сломано и до сих пор не починено, кто кому
// что должен (деньги, услугу, ужин), сколько кто спал — и долг сна за неделю, и «одет не по погоде»
// (одежда из Гардероба против погоды Horae, когда они не дома). Модель получает это раз в три ответа
// и сразу, если что-то изменилось. Идея — блок «Быт» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyDay, str, arr, clamp, similar } from './hudkit.js';

let A = null;
export function initHome(api) { A = api; }
const esc = (v) => A.esc(v);

const NORM = 7.5;   // сколько сна в сутки считаем нормой
const DWELL = /квартир|(?<![а-яёa-z0-9])дом(?![а-яёa-z0-9])|апартамент|пентхаус|особняк|лофт|спальн|кухн|гостин|ванн|штаб|башн|лаборатор|офис|кафе|ресторан|бар(?![а-яё])|машин|салон/i;
const COLD = /снег|мороз|метел|вьюг|холод|лёд|лед(?![а-яё])|минус|−\s?\d|-\s?\d/i;
const WET = /дожд|ливень|ливн|гроз|морос/i;
const WARM = /пальто|куртк|пуховик|шуб|парк[аеу]|свитер|шарф|плащ|бушлат|шинел|дублёнк|тренч|худи|толстовк|кардиган|пиджак|жакет/i;

function cfg() {
    const s = A.settings();
    if (!s.home || typeof s.home !== 'object') s.home = {};
    if (s.home.on === undefined) s.home.on = true;
    return s.home;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.home || typeof cm.home !== 'object') cm.home = {};
    const s = cm.home;
    if (!Array.isArray(s.broken)) s.broken = [];   // { id, what, where, mes, day, fixed }
    if (!Array.isArray(s.debts)) s.debts = [];     // { id, who, to, what, mes, paid }
    if (!s.sleep || typeof s.sleep !== 'object') s.sleep = {};   // имя → [{ day, h, mes }]
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const broken = () => M().broken.filter(x => !x.fixed);
const debts = () => M().debts.filter(x => !x.paid);
/** Для счетов и перепалок: что сломано и не починено. */
export const homeBroken = () => broken();
export function sleepDebtOf(who) { return sleepDebt(who); }

/** Долг сна: по последним семи записанным ночам. */
function sleepDebt(who) {
    const k = Object.keys(M().sleep).find(n => A.sameName(n, who));
    const nights = (k ? M().sleep[k] : []).slice(-7);
    if (nights.length < 2) return null;
    const debt = nights.reduce((a, x) => a + Math.max(0, NORM - x.h), 0);
    return { debt: Math.round(debt), nights: nights.length, last: nights[nights.length - 1].h };
}

/** Кто одет не по погоде (не дома, холодно или льёт, а на нём ничего тёплого). */
function offWeather() {
    const st = A.worldState();
    const atm = String(st?.scene?.atmosphere || '');
    const loc = String(st?.scene?.location || '');
    const cold = COLD.test(atm), wet = WET.test(atm);
    if ((!cold && !wet) || !loc || DWELL.test(loc)) return [];
    const w = A.ctx().chatMetadata?.wardrobe;
    if (!w?.chars) return [];
    const here = (st?.scene?.characters_present || []).map(A.canonName);
    const out = [];
    for (const [n, c] of Object.entries(w.chars)) {
        if (here.length && !here.some(h => A.sameName(h, n))) continue;
        const worn = (c?.worn || []).map(x => x?.name).filter(Boolean).join(', ');
        if (worn && !WARM.test(worn)) out.push({ who: A.canonName(n), worn: A.cut(worn, 70), why: cold ? 'холодно' : 'дождь' });
    }
    return out.slice(0, 3);
}

const RULE = `
broke — что в этом посте СЛОМАЛОСЬ или ПОЧИНЕНО из вещей и техники дома и вокруг (кран, замок, машина, телефон, окно, рука-протез сюда не идёт): [{"what":"что","where":"где, или пусто","st":"broke|fixed"}]. Для fixed бери название как в «Сломано». Нечего — [].
owes — бытовые долги между людьми, появившиеся или отданные в этом посте (деньги, услуга, вещь, обещанный ужин; пари сюда не идут): [{"who":"кто должен","to":"кому","what":"что, 1-8 слов","st":"new|paid"}]. Нечего — [].
slept — кто в этом посте проснулся или лёг и ясно, сколько он проспал этой ночью: [{"who":"имя","h":5}]. Не ясно — не пиши. Нечего — [].`;

export function homeChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const b = broken().slice(-6).map(x => x.what), d = debts().slice(-6).map(x => `${x.who} → ${x.to}: ${x.what}`);
    return { key: '"broke": [], "owes": [], "slept": []', rule: RULE, tokens: 170, input: `Сломано: ${b.length ? b.join('; ') : 'ничего'}. Долги: ${d.length ? d.join('; ') : 'нет'}` };
}

export function homeAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    // свайп: откатить записанное этим постом
    s.broken = s.broken.filter(x => x.mes !== i); for (const x of s.broken) if (x.fixed === i) delete x.fixed;
    s.debts = s.debts.filter(x => x.mes !== i); for (const x of s.debts) if (x.paid === i) delete x.paid;
    for (const k of Object.keys(s.sleep)) s.sleep[k] = s.sleep[k].filter(x => x.mes !== i);
    let changed = false;
    for (const r of arr(j?.broke).slice(0, 4)) {
        const what = str(r?.what, 70);
        if (!what) continue;
        const old = broken().find(x => similar(A, x.what, what, 0.5) || A.norm(x.what) === A.norm(what));
        if (str(r?.st) === 'fixed') { if (old) { old.fixed = i; changed = true; } }
        else if (!old) { s.broken.push({ id: `x${++s.seq}`, what, where: str(r?.where, 50), mes: i, day: storyDay(A) }); changed = true; }
    }
    for (const r of arr(j?.owes).slice(0, 4)) {
        const who = A.canonName(str(r?.who, 50)), to = A.canonName(str(r?.to, 50)), what = str(r?.what, 70);
        if (!who || !to || !what) continue;
        const old = debts().find(x => A.sameName(x.who, who) && A.sameName(x.to, to) && (similar(A, x.what, what, 0.5) || A.norm(x.what) === A.norm(what)));
        if (str(r?.st) === 'paid') { if (old) { old.paid = i; changed = true; } }
        else if (!old) { s.debts.push({ id: `x${++s.seq}`, who, to, what, mes: i }); changed = true; }
    }
    const day = storyDay(A);
    for (const r of arr(j?.slept).slice(0, 4)) {
        const who = A.canonName(str(r?.who, 50)), h = Number(r?.h);
        if (!who || !Number.isFinite(h) || h < 0 || h > 16) continue;
        const k = Object.keys(s.sleep).find(n => A.sameName(n, who)) || who;
        s.sleep[k] = (s.sleep[k] || []).filter(x => !(day && x.day === day));
        s.sleep[k].push({ day, h: clamp(h, 0, 16), mes: i });
        if (s.sleep[k].length > 21) s.sleep[k].splice(0, s.sleep[k].length - 21);
        changed = true;
    }
    if (s.broken.length > 60) s.broken.splice(0, s.broken.length - 60);
    if (s.debts.length > 60) s.debts.splice(0, s.debts.length - 60);
    if (changed) { s.touch = i; A.saveMeta(); }
}

function rows() {
    const s = M();
    const out = [];
    const b = broken().slice(-4);
    if (b.length) out.push(`не починено — ${b.map(x => `${x.what}${x.where ? ` (${x.where})` : ''}`).join('; ')}`);
    const d = debts().slice(-4);
    if (d.length) out.push(`должки — ${d.map(x => `${A.shortName(x.who)} должен(на) ${A.shortName(x.to)}: ${x.what}`).join('; ')}`);
    const sl = Object.keys(s.sleep).map(n => ({ n, d: sleepDebt(n) })).filter(x => x.d && x.d.debt >= 6);
    if (sl.length) out.push(`недосып — ${sl.map(x => `${A.shortName(x.n)}: не добрал ~${x.d.debt} ч за ${x.d.nights} ночей (видно: раздражён, тупит, тянется к кофе, засыпает на ходу)`).join('; ')}`);
    const ow = offWeather();
    if (ow.length) out.push(`одеты не по погоде — ${ow.map(x => `${A.shortName(x.who)} (${x.worn}; ${x.why})`).join('; ')}: мёрзнут, мокнут, кто-то отдаёт своё`);
    return out;
}

export function homePrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const r = rows();
    if (!r.length) return '';
    const n = A.chatArr().length;
    const freshTouch = Number.isFinite(M().touch) && n - 1 - M().touch <= 2;
    if (!freshTouch && n % 3 !== 0) return '';
    return `[Быт: ${r.join('. ')}. Это фон: всплывает мелочью к месту — капающий кран, напоминание о долге, зевок, — не темой ответа.]`;
}

export function homeSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const b = broken(), d = debts();
    const sl = Object.keys(s.sleep).map(n => ({ n, d: sleepDebt(n) })).filter(x => x.d);
    const ow = offWeather();
    if (!b.length && !d.length && !sl.length && !ow.length) return '';
    const item = (t, sub, act, id, ico) => `<div class="lf-hm-i"><span><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${act ? `<button data-act="${act}" data-id="${id}">${A.icon(ico)}</button>` : ''}</div>`;
    return `${A.sec('Быт', [b.length && `сломано ${b.length}`, d.length && `долгов ${d.length}`].filter(Boolean).join(' · '))}
    <div class="lf-hm">
        ${b.map(x => item(`🔧 ${esc(x.what)}`, esc([x.where, x.day && `с ${x.day}`].filter(Boolean).join(' · ')), 'hm-fix', x.id, 'check')).join('')}
        ${d.map(x => item(`🤝 ${esc(A.shortName(x.who))} → ${esc(A.shortName(x.to))}`, esc(x.what), 'hm-paid', x.id, 'check')).join('')}
        ${sl.map(x => item(`😴 ${esc(A.shortName(x.n))}: ${x.d.debt >= 6 ? `недосып ~${x.d.debt} ч` : 'высыпается'}`, `за ${x.d.nights} ночей · последняя ${x.d.last} ч`, '', '', '')).join('')}
        ${ow.map(x => item(`🧥 ${esc(A.shortName(x.who))} — не по погоде`, esc(`${x.worn} · ${x.why}`), '', '', '')).join('')}
    </div>`;
}

export function homeClick(act, el) {
    if (!act.startsWith('hm-')) return false;
    const s = M();
    const i = A.chatArr().length - 1;
    if (act === 'hm-fix') { const x = s.broken.find(y => y.id === el.dataset.id); if (x) x.fixed = i; }
    if (act === 'hm-paid') { const x = s.debts.find(y => y.id === el.dataset.id); if (x) x.paid = i; }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function homeRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.broken) { if (x.mes === i) out.push({ id: `hm:${x.id}`, g: 'Быт', icon: 'home', t: `сломалось: ${x.what}`, del: () => { s.broken = s.broken.filter(y => y !== x); } }); else if (x.fixed === i) out.push({ id: `hm:${x.id}:f`, g: 'Быт', icon: 'home', t: `починили: ${x.what}`, del: () => { delete x.fixed; } }); }
    for (const x of s.debts) { if (x.mes === i) out.push({ id: `hm:${x.id}`, g: 'Быт', icon: 'home', t: `долг: ${A.shortName(x.who)} → ${A.shortName(x.to)}, ${x.what}`, del: () => { s.debts = s.debts.filter(y => y !== x); } }); else if (x.paid === i) out.push({ id: `hm:${x.id}:p`, g: 'Быт', icon: 'home', t: `долг отдан: ${x.what}`, del: () => { delete x.paid; } }); }
    for (const [n, list] of Object.entries(s.sleep)) for (const x of list) if (x.mes === i) out.push({ id: `hm:sl:${n}`, g: 'Быт', icon: 'home', t: `${A.shortName(n)} спал(а) ${x.h} ч`, del: () => { s.sleep[n] = s.sleep[n].filter(y => y !== x); } });
    return out;
}
