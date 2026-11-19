// Дом. Квартира живёт сама по времени истории: пыль копится, посуда в раковине растёт, корзина белья
// наполняется, холодильник пустеет, мусорное ведро ждёт. Летописец замечает, кто что сделал по дому — шкала
// сбрасывается, а «кто сколько» копится (готовый повод для перепалки). Платное — продукты, прачечная, доставка —
// с ценой: чек уходит в «Счета» и списывается одной строкой в конце дня истории. Модели — когда сцена дома и что-то
// запущено: раз в три ответа, сразу — если совсем запущено или только что насорили.
// Идея быта — TavernOS HUD (alewwi), см. NOTICE-HUD.md; шкалы по времени истории — свои.

import { clock, hoursBetween, herPostTail, atHome, str, arr, clamp, mains, present } from './hudkit.js';

let A = null;
export function initHouse(api) { A = api; }
const esc = (v) => A.esc(v);

// id, ярлык, значок, сколько теряет в сутки (из 100), как выглядит по уровням (0 — порядок … 3 — запущено), что сделать
export const HOUSE = [
    ['dust', 'Пыль', '🧹', 7, ['чисто', 'пыль на полках', 'пыльно, видно на свету, кот чихает', 'клоками, по столу можно писать пальцем'], 'убраться'],
    ['dishes', 'Посуда', '🍽', 45, ['раковина пустая', 'пара чашек в раковине', 'гора в раковине', 'чистой не осталось, едят из кастрюли'], 'помыть посуду'],
    ['laundry', 'Стирка', '🧺', 13, ['корзина пустая', 'корзина наполовину', 'корзина белья полная', 'бельё вываливается из корзины, чистых носков нет'], 'постирать'],
    ['fridge', 'Холодильник', '🥛', 16, ['полный', 'початый', 'почти пустой', 'пусто, мышь повесилась'], 'купить продукты'],
    ['trash', 'Мусор', '🗑', 30, ['вынесен', 'ведро наполовину', 'ведро полное', 'не вынесен, уже пахнет'], 'вынести мусор'],
];
const BY = Object.fromEntries(HOUSE.map(x => [x[0], x]));
const lvlOf = (v) => (v >= 75 ? 0 : v >= 45 ? 1 : v >= 20 ? 2 : 3);

function cfg() {
    const s = A.settings();
    if (!s.house || typeof s.house !== 'object') s.house = {};
    const c = s.house;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.people)) c.people = 2;   // сколько живёт в доме
    return c;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.house || typeof cm.house !== 'object') cm.house = {};
    const s = cm.house;
    if (!Array.isArray(s.log)) s.log = [];   // { what, st: done|mess, who, mes, ts, at, cost, src: post|me }
    if (!s.start) s.start = clock(A);       // с какого момента дом «живёт» (тогда — порядок)
    return s;
}

const home = () => { try { return A.homeLoc?.() || ''; } catch { return ''; } };
const pets = () => { try { return (A.petsList?.() || []).length; } catch { return 0; } };

/** Скорость: на двоих — как в таблице; больше людей — быстрее; кот — пыли больше. */
function rate(id) {
    const r = BY[id][3] * (1 + 0.2 * (clamp(cfg().people, 1, 8) - 2));
    return id === 'dust' && pets() ? r * 1.25 : r;
}
const later = (a, b) => (a.mes !== b.mes ? a.mes > b.mes : (a.at || 0) > (b.at || 0));

/** Состояние одной шкалы: { v (0–100), lvl, last (кто и когда сделал) }. */
function stateOf(id, now = clock(A)) {
    const s = M();
    let last = null;
    for (const r of s.log) if (r.what === id && r.st === 'done' && (!last || later(r, last))) last = r;
    const from = last || s.start;
    let v = 100 - rate(id) * (hoursBetween(A, from, now) / 24);
    for (const r of s.log) if (r.what === id && r.st === 'mess' && (!last || later(r, last))) v -= 25;
    v = clamp(Math.round(v), 0, 100);
    return { id, v, lvl: lvlOf(v), last };
}
export function houseState() { return HOUSE.map(([id]) => stateOf(id)); }

/** Кто сколько раз что делал по дому: { id: { имя: n } }. */
export function houseCounts() {
    const out = {};
    for (const r of M().log) {
        if (r.st !== 'done' || !r.who) continue;
        const o = out[r.what] = out[r.what] || {};
        const k = Object.keys(o).find(n => A.sameName(n, r.who)) || r.who;
        o[k] = (o[k] || 0) + 1;
    }
    return out;
}
const countLine = (id, c = houseCounts()) => Object.entries(c[id] || {}).sort((a, b) => b[1] - a[1]).map(([n, k]) => `${A.shortName(n)} ${k}`).join(' · ');

const RULE = `
chores — дела по дому в этом посте (и в её посте перед ним, если он дан): [{"what":"dust|dishes|laundry|fridge|trash","st":"done|mess","who":"кто сделал","cost":0}]. done: dust — убрался, пропылесосил, вытер пыль; dishes — помыл посуду, загрузил посудомойку; laundry — постирал, сдал в прачечную; fridge — купил продукты, привезли доставку; trash — вынес мусор. mess — насорили: большая готовка, гости, драка в квартире, что-то разбили или рассыпали (dust или dishes). cost — сколько это стоило в деньгах места и эпохи, если платно (продукты, прачечная, доставка), числом; бесплатно или неясно — 0. Только то, что правда случилось в тексте. Нечего — [].`;

export function houseChron(i) {
    if (!A?.hasChat?.() || !on()) return null;
    const st = houseState().map(x => `${BY[x.id][1].toLowerCase()}: ${BY[x.id][4][x.lvl]}`).join('; ');
    return { key: '"chores": []', rule: RULE, tokens: 110, input: [`Дом сейчас: ${st}`, herPostTail(A, i)].filter(Boolean).join('\n') };
}

export function houseAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    const n0 = s.log.length;
    s.log = s.log.filter(r => !(r.mes === i && r.src === 'post'));
    const now = clock(A);
    const spend = [];
    for (const r of arr(j?.chores).slice(0, 6)) {
        const what = str(r?.what), st = str(r?.st) === 'mess' ? 'mess' : 'done';
        if (!BY[what]) continue;
        const who = A.canonName(str(r?.who, 50));
        s.log.push({ what, st, who, mes: i, ts: now.ts, at: Date.now(), cost: Math.max(0, Math.round(Number(r?.cost) * 100) / 100 || 0), src: 'post' });
        const cost = Number(r?.cost) || 0;
        if (cost > 0 && st === 'done') spend.push({ what: { fridge: 'Продукты', laundry: 'Стирка', dishes: 'Посуда', dust: 'Уборка', trash: 'Вывоз мусора' }[what], amount: Math.round(cost * 100) / 100, who });
    }
    if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
    try { A.billsSpend?.(i, spend); } catch (e) { console.warn('[Life] дом → счета', e); }
    if (s.log.length !== n0 || arr(j?.chores).length) A.saveMeta();
}

export function housePrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    if (!atHome(A, home())) return '';
    const st = houseState().filter(x => x.lvl >= 2);
    if (!st.length) return '';
    const n = A.chatArr().length;
    const s = M();
    const messNow = s.log.some(r => r.st === 'mess' && n - 1 - r.mes <= 2);
    if (n % 3 !== 0 && !st.some(x => x.lvl === 3) && !messNow) return '';
    const c = houseCounts();
    const rows = st.map(x => `${BY[x.id][1].toLowerCase()}: ${BY[x.id][4][x.lvl]}${x.last?.who ? ` (последним — ${A.shortName(x.last.who)})` : ''}`);
    const tally = st.map(x => countLine(x.id, c) && `${BY[x.id][5]}: ${countLine(x.id, c)}`).filter(Boolean);
    return `[Дом — ${rows.join('; ')}. Это фон: всплывает мелочью — нет чистой кружки, корзина под ногами, пустая полка в холодильнике, — и может стать поводом для перепалки.${tally.length ? ` Кто сколько раз делал по дому: ${tally.join('; ')}.` : ''}]`;
}

/** Для перепалок: что сейчас запущено. */
export function houseIrritants(P) {
    const short = A.shortName(P);
    const out = [];
    for (const x of houseState()) {
        if (x.lvl < 2) continue;
        if (x.id === 'dishes') out.push(`оставил свою тарелку в раковине поверх горы — «потом помою»`);
        if (x.id === 'laundry') out.push(`снова бросил носки мимо корзины — в шаге от неё`);
        if (x.id === 'fridge') out.push(`съел последнее и не сказал, что продукты кончились`);
        if (x.id === 'trash') out.push(`обещал вынести мусор ещё вчера — ведро так и стоит`);
        if (x.id === 'dust') out.push(`в упор не видит пыль — «где? чисто же»`);
    }
    return out.map(t => ({ act: t, why: '', start: '', dodge: '', src: 'house', who: short }));
}

const bar = (x) => `<div class="lf-hs-r l${x.lvl}"><span class="lf-hs-ic">${BY[x.id][2]}</span><span class="lf-hs-t"><b>${BY[x.id][1]}</b><small>${esc(BY[x.id][4][x.lvl])}${x.last?.who ? ` · последним: ${esc(A.shortName(x.last.who))}` : ''}</small><i><u style="width:${x.v}%"></u></i></span><button data-act="hs-done" data-id="${x.id}" title="${esc(BY[x.id][5])}">${A.icon('check')}</button></div>`;

/** Быт → Дом. */
export function houseHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const st = houseState();
    const c = houseCounts();
    const bad = st.filter(x => x.lvl >= 2).sort((a, b) => a.v - b.v);
    const here = present(A).filter(n => mains(A).some(m => A.sameName(m, n)));
    const tally = HOUSE.map(([id, name, ico]) => countLine(id, c) && `<div><span>${ico}</span><b>${name}</b><small>${esc(countLine(id, c))}</small></div>`).filter(Boolean);
    const chips = bad.length ? [
        ...here.slice(0, 2).map(n => A.cueChip?.('Дом', `hs:${n}`, `${A.shortName(n)} сам берётся за дом: ${BY[bad[0].id][5]}`, { once: true, label: `${A.shortName(n)}: ${BY[bad[0].id][5]}` }) || ''),
        A.cueChip?.('Дом', 'hs:all', 'генеральная уборка вдвоём — с ворчанием и музыкой', { once: true, label: 'генеральная уборка вдвоём' }) || '',
        A.cueChip?.('Дом', 'hs:see', `кто-то замечает, как запущено: ${bad.map(x => BY[x.id][1].toLowerCase()).join(', ')}`, { once: true, label: 'пусть заметят, как запущено' }) || '',
    ].join('') : '';
    return `${A.sec('Дом', bad.length ? `запущено: ${bad.length}` : 'порядок')}
    <div class="lf-hs">${st.map(bar).join('')}</div>
    ${chips ? `<div class="lf-chips wrap">${chips}</div>` : ''}
    ${tally.length ? `<details class="lf-more"><summary>Кто сколько делает по дому</summary><div class="lf-hs-tally">${tally.join('')}</div></details>` : ''}
    <div class="lf-hs-ppl"><small>живёт в доме</small>${[1, 2, 3, 4, 5].map(k => `<button class="lf-chip${cfg().people === k ? ' on' : ''}" data-act="hs-ppl" data-n="${k}">${k}</button>`).join('')}</div>`;
}

export function houseClick(act, el) {
    if (!act.startsWith('hs-')) return false;
    const s = M();
    if (act === 'hs-done' && BY[el.dataset.id]) s.log.push({ what: el.dataset.id, st: 'done', who: '', mes: A.chatArr().length - 1, ts: clock(A).ts, at: Date.now(), cost: 0, src: 'me' });
    if (act === 'hs-ppl') { cfg().people = clamp(Number(el.dataset.n) || 2, 1, 8); A.saveSettings(); }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function houseRecs(i) {
    const s = M();
    return s.log.filter(r => r.mes === i && r.src === 'post').map((r, k) => ({ id: `hs:${k}`, g: 'Дом', icon: 'home', t: `${BY[r.what][2]} ${r.st === 'mess' ? 'насорили' : BY[r.what][5]}${r.who ? ` — ${A.shortName(r.who)}` : ''}${r.cost ? ` (${r.cost})` : ''}`, del: () => { s.log = s.log.filter(x => x !== r); } }));
}
