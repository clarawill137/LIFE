// Кукольный домик: их дом в разрезе, как в симс. Комнаты — места внутри дома (из истории, Карты и руками),
// в каждой — кто там сейчас (сцена — по Horae, остальные — по Закулисью и «Кто где»), кот, снятая рука на тумбочке,
// следы сцен. Свет — по времени суток и погоде: ночью горят комнаты, где кто-то есть, за окнами дождь и снег.
// Тап по комнате — что там, кто чем занят; «Осмотреть» — комната целиком; «Перейти сюда» — сцена переходит туда.
// Расставить — порядок, ряд и ширина комнат; комната без истории — «+ комната».

import { whereAll } from './whois.js';
import { wxKind } from './weather.js';
import { homeLoc, tracesAt, petsList, petState } from './sim.js';
import { armOwners, armAt, armFig } from './arm.js';

let A = null;
export function initDollhouse(api) { A = api; }

const esc = (v) => A.esc(v);
const ui = { sel: '', edit: false, pick: '' };

// ───────────── комнаты ─────────────

const KINDS = [
    ['kitchen', /кухн|столов|kitchen|dining/i, 'utensils', 1, 2],
    ['bed', /спальн|bedroom/i, 'bed', 0, 0],
    ['nursery', /детск|nursery/i, 'baby', 0, 1],
    ['bath', /ванн|душ|туалет|санузел|bath/i, 'bath', 0, 3],
    ['study', /кабинет|офис|библиотек|study|office/i, 'briefcase', 0, 2],
    ['work', /мастерск|лаборатор|workshop|lab/i, 'wrench', 0, 2],
    ['closet', /гардероб|кладов|closet/i, 'shirt', 0, 4],
    ['living', /гостин|зал(?![а-яё])|living|лаунж/i, 'sofa', 1, 1],
    ['hall', /прихож|коридор|холл|вход|hall/i, 'door', 1, 0],
    ['balcony', /балкон|террас|лоджи|крыш|balcony|terrace/i, 'sun', 1, 3],
    ['garage', /гараж|garage/i, 'car', 1, 4],
    ['gym', /спортзал|зал для|тренаж|gym/i, 'dumbbell', 0, 3],
];
const NO_WIN = new Set(['bath', 'hall', 'closet', 'garage', 'balcony']);
const kindOf = (name) => KINDS.find(k => k[1].test(String(name || ''))) || ['room', null, 'door', 1, 5];

const HOUSE_RE = /(?<![а-яё])дом(?![а-яё])|особняк|коттедж|ферм|хижин|дач[аеиу]|вилл[аеуы]|house|cabin|farm/i;

function levelRaw(key) { const p = A.settings().places[key]; return p?.raw || p?.name || A.knownLocations().get(key) || key; }

/** Комнаты места key (на уровень глубже): [{ key, raw, name, kind, dh }] — с раскладкой. */
export function roomsOf(key) {
    const depth = key.split('·').length + 1;
    const out = [];
    for (const [k, raw] of A.knownLocations()) {
        if (!k.startsWith(`${key}·`) || k.split('·').length !== depth) continue;
        const p = A.settings().places[k];
        if (p?.dh?.hide) continue;
        const name = A.locLeaf(p?.name || raw);
        out.push({ key: k, raw: p?.raw || raw, name, kind: kindOf(name), dh: p?.dh || null, img: p?.imgNow?.src || p?.img || '' });
    }
    return layout(out);
}

/** Раскладка: ряды и порядок — свои (dh.row/ord) или по типу комнаты (наверху — спальни, внизу — кухня и гостиная). */
function layout(rooms) {
    const auto = rooms.filter(r => !r.dh || r.dh.row == null);
    const rowsN = rooms.length <= 3 ? 1 : 2;
    for (const r of auto) { r.row = rowsN === 1 ? 0 : r.kind[3]; r.ord = r.kind[4] * 10; }
    for (const r of rooms) if (r.dh && r.dh.row != null) { r.row = Math.min(rowsN - 1 + (r.dh.row > rowsN - 1 ? 1 : 0), Number(r.dh.row) || 0); r.ord = Number(r.dh.ord) || 0; }
    // перекос: в одном ряду всё — разровнять (только авто-комнаты)
    if (rowsN === 2) {
        for (let guard = 0; guard < 6; guard++) {
            const r0 = rooms.filter(r => r.row === 0);
            const r1 = rooms.filter(r => r.row === 1);
            const [big, small, to] = r0.length > r1.length + 1 ? [r0, r1, 1] : r1.length > r0.length + 1 ? [r1, r0, 0] : [null];
            if (!big) break;
            const mv = big.filter(r => auto.includes(r)).sort((a, b) => (to ? b.ord - a.ord : a.ord - b.ord))[0];
            if (!mv || small.length >= 4) break;
            mv.row = to;
        }
    }
    rooms.sort((a, b) => a.row - b.row || a.ord - b.ord || a.name.localeCompare(b.name));
    const rows = [];
    for (const r of rooms) (rows[r.row] = rows[r.row] || []).push(r);
    return rows.filter(Boolean);
}

// ───────────── кто где ─────────────

function hourOf(time) { const m = String(time || '').match(/(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) : null; }
function phaseOf(time) {
    const h = hourOf(time);
    if (h == null) return 'day';
    if (h >= 22 || h < 5) return 'night';
    if (h < 8) return 'dawn';
    if (h < 17) return 'day';
    if (h < 20) return 'evening';
    return 'dusk';
}
const PH_RU = { night: 'ночь', dawn: 'рассвет', day: 'день', evening: 'вечер', dusk: 'сумерки' };
const WX_RU = { rain: 'дождь', storm: 'гроза', snow: 'снег', blizzard: 'метель', fog: 'туман' };

const stemOf = (w) => { const n = A.norm(w); return n.length > 5 ? n.slice(0, -2) : n; };

/** Кто в какой комнате: { rooms: Map(key → [{who, doing, scene}]), loose: [...], out: [...] }. */
function people(key, rows) {
    const flat = rows.flat();
    const res = { rooms: new Map(), loose: [], out: [] };
    let list = [];
    try { list = whereAll(); } catch (e) { console.warn('[Life] домик: кто где', e); }
    const roomOfText = (t) => { const n = A.norm(t); return flat.find(r => n.includes(stemOf(r.name))); };
    const L = A.chatArr().length;
    for (const x of list) {
        if (x.src === 'seen' && Number.isFinite(x.mes) && L - x.mes > 60) continue; // «видели» давно — не знаем, где сейчас
        const k = x.key || A.placeKey(x.loc || '');
        const inHome = k === key || k.startsWith(`${key}·`);
        if (!inHome) { if (x.loc || x.doing) res.out.push(x); continue; }
        let room = flat.find(r => k === r.key || k.startsWith(`${r.key}·`));
        if (!room && x.doing) room = roomOfText(x.doing);
        if (room) { if (!res.rooms.has(room.key)) res.rooms.set(room.key, []); res.rooms.get(room.key).push({ ...x, scene: x.src === 'scene' }); }
        else res.loose.push({ ...x, scene: x.src === 'scene' });
    }
    return res;
}

/** Питомцы дома по комнатам: спит — в спальне (или гостиной), иначе — бродит (по часу истории). */
function petsByRoom(key, rows, hour) {
    const flat = rows.flat().filter(r => r.kind[0] !== 'bath' && r.kind[0] !== 'garage');
    const out = new Map();
    if (!flat.length) return out;
    let pets = [];
    try { pets = petsList().filter(p => !p.home || A.placeKey(A.locTop(p.home)) === key || A.placeKey(p.home) === key); } catch { /* */ }
    for (const p of pets) {
        let sleepy = false;
        try { sleepy = !!petState(p).sleepy; } catch { /* */ }
        const fav = flat.find(r => p.favPlace && A.norm(r.name).includes(stemOf(p.favPlace)));
        const sleepRoom = flat.find(r => r.kind[0] === 'bed') || flat.find(r => r.kind[0] === 'living');
        let h = 0;
        for (const ch of String(p.id || p.name)) h = (h * 31 + ch.charCodeAt(0)) | 0;
        const room = (sleepy && sleepRoom) || fav || flat[Math.abs(h + (hour ?? 12)) % flat.length];
        if (!out.has(room.key)) out.set(room.key, []);
        out.get(room.key).push({ p, sleepy });
    }
    return out;
}

/** Снятый протез — в комнате, где лежит (по словам «где»). */
function armsByRoom(rows) {
    const out = new Map();
    const flat = rows.flat();
    let owners = [];
    try { owners = armOwners(); } catch { /* */ }
    for (const n of owners) {
        const s = armAt(n);
        if (s.st !== 'off' || !s.where) continue;
        const w = A.norm(s.where);
        const room = flat.find(r => w.includes(stemOf(r.name)));
        if (room) { if (!out.has(room.key)) out.set(room.key, []); out.get(room.key).push({ who: n, where: s.where }); }
    }
    return out;
}

// ───────────── рисунок ─────────────

function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }

function neighbours(seed, n, phase) {
    const lit = phase === 'night' || phase === 'dusk' || phase === 'evening' || phase === 'dawn';
    return Array.from({ length: n }, (_, k) => `<i class="${lit && hash(`${seed}${k}`) % 3 === 0 ? 'on' : ''}"></i>`).join('');
}

function roomHtml(r, info) {
    const { ppl, pets, arms, phase, curKey } = info;
    const here = ppl.filter(x => x.scene).length > 0 || curKey === r.key || curKey.startsWith(`${r.key}·`);
    const busy = ppl.length || pets.length;
    const lit = busy && phase !== 'day';
    const tr = (() => { try { return tracesAt(r.key).length; } catch { return 0; } })();
    const w = Math.max(1, Math.min(2, Number(r.dh?.w) || 1));
    const toks = [
        ...ppl.map(x => `<span class="lf-dh-tok${x.scene ? ' scene' : ''}">${A.ava(x.who, 'sm')}<small>${esc(A.shortName(x.who))}</small></span>`),
        ...pets.map(({ p, sleepy }) => `<span class="lf-dh-tok pet${sleepy ? ' sleepy' : ''}"><span class="lf-ava sm">${p.img ? `<img src="${esc(p.img)}" alt="">` : ''}<i>${A.icon('paw')}</i></span><small>${esc(A.shortName(p.name))}${sleepy ? ' 💤' : ''}</small></span>`),
    ].join('');
    return `<div class="lf-dh-room k-${r.kind[0]}${lit ? ' lit' : ''}${here ? ' here' : ''}${ui.sel === r.key ? ' sel' : ''}${ui.edit && ui.pick === r.key ? ' pick' : ''}" style="--w:${w}" data-act="dh-room" data-key="${esc(r.key)}" role="button">
        <i class="lf-dh-wall"${r.img ? ` style="background-image:url('${esc(r.img)}')"` : ''}></i>
        ${NO_WIN.has(r.kind[0]) ? '' : '<i class="lf-dh-win"><b></b></i>'}
        ${r.kind[0] === 'balcony' ? '' : '<i class="lf-dh-lamp"></i>'}
        <span class="lf-dh-ic">${A.icon(r.kind[2])}</span>
        <span class="lf-dh-name">${esc(r.name)}${tr ? `<em>${A.icon('eye')}${tr}</em>` : ''}</span>
        ${arms.length ? `<span class="lf-dh-arm" title="${esc(arms.map(a => `${A.shortName(a.who)}: протез — ${a.where}`).join('; '))}">${armFig()}</span>` : ''}
        <span class="lf-dh-toks">${toks}</span>
        <i class="lf-dh-floor"></i>
        ${here ? '<span class="lf-dh-here">вы здесь</span>' : ''}
    </div>`;
}

/** Дом в разрезе для места key (обычно — дом). */
export function dollhouseHtml(key) {
    if (!A?.hasChat?.()) return '';
    const raw = levelRaw(key);
    const rows = roomsOf(key);
    const st = A.worldState();
    const phase = phaseOf(st.timestamp?.story_time);
    const wx = wxKind(st.scene?.atmosphere);
    const house = HOUSE_RE.test(A.locLeaf(raw)) || HOUSE_RE.test(raw);
    const curKey = A.placeKey(st.scene?.location || '');
    const ppl = people(key, rows);
    const pets = petsByRoom(key, rows, hourOf(st.timestamp?.story_time));
    const arms = armsByRoom(rows);
    // кто дома, но где именно — неизвестно: в комнату сцены, иначе — в гостиную (пунктиром)
    if (ppl.loose.length && rows.length) {
        const flat = rows.flat();
        const to = flat.find(r => curKey.startsWith(r.key)) || flat.find(r => r.kind[0] === 'living') || flat[0];
        if (!ppl.rooms.has(to.key)) ppl.rooms.set(to.key, []);
        ppl.rooms.get(to.key).push(...ppl.loose.map(x => ({ ...x, maybe: true })));
        ppl.loose = [];
    }
    const sel = ui.sel && rows.flat().find(r => r.key === ui.sel);
    const when = [st.timestamp?.story_time, PH_RU[phase], WX_RU[wx]].filter(Boolean).join(' · ');
    const houseHtml = rows.length ? `<div class="lf-dh ph-${phase}${wx ? ` wx-${wx}` : ''}${house ? ' t-house' : ' t-apt'}${ui.edit ? ' editing' : ''}">
        <div class="lf-dh-sky"><i class="lf-dh-orb"></i><i class="lf-dh-stars"></i><i class="lf-dh-fx"></i></div>
        <div class="lf-dh-bld">
            ${house ? '<div class="lf-dh-roof"><i class="lf-dh-chim"></i></div>' : `<div class="lf-dh-nb">${neighbours(`${key}u`, 8, phase)}</div>`}
            <div class="lf-dh-rows">${rows.map(row => `<div class="lf-dh-row">${row.map(r => roomHtml(r, { ppl: ppl.rooms.get(r.key) || [], pets: pets.get(r.key) || [], arms: arms.get(r.key) || [], phase, curKey })).join('')}</div>`).join('')}</div>
            ${house ? '<div class="lf-dh-ground"></div>' : `<div class="lf-dh-nb">${neighbours(`${key}d`, 8, phase)}</div>`}
        </div>
        <div class="lf-dh-cap"><b>${esc(A.locLeaf(A.placeName(raw)))}</b>${when ? `<span>${esc(when)}</span>` : ''}</div>
    </div>` : `<div class="lf-mapempty">${A.icon('home', 'xl')}<b>Комнат пока нет</b><span>Они появятся сами, когда сцена побывает в кухне, спальне и т. п., — или добавь сейчас.</span></div>`;
    const outHtml = ppl.out.length ? `<div class="lf-dh-out"><span class="lf-dh-out-h">${A.icon('walk')} Не дома</span>${ppl.out.map(x => `<button class="lf-dh-away" data-act="who" data-name="${esc(x.who)}">${A.ava(x.who, 'xs')}<b>${esc(A.shortName(x.who))}</b><small>${esc(A.cut(x.guess ? x.loc : A.locParts(x.loc || '').slice(-1)[0] || x.doing || '', 34))}</small></button>`).join('')}</div>` : '';
    return `${houseHtml}${outHtml}${sel ? cardHtml(sel, { ppl: ppl.rooms.get(sel.key) || [], pets: pets.get(sel.key) || [], arms: arms.get(sel.key) || [], curKey }) : ''}
    ${ui.edit ? editHtml(rows) : ''}
    <div class="lf-actions">
        <button class="lf-btn${ui.edit ? ' primary' : ''}" data-act="dh-edit">${A.icon(ui.edit ? 'check' : 'sliders')} ${ui.edit ? 'Готово' : 'Расставить'}</button>
        <button class="lf-btn" data-act="dh-add" data-key="${esc(key)}">${A.icon('plus')} Комната</button>
    </div>`;
}

function cardHtml(r, { ppl, pets, arms, curKey }) {
    const here = curKey === r.key || curKey.startsWith(`${r.key}·`);
    let tr = [];
    try { tr = tracesAt(r.key).slice(-3).reverse(); } catch { /* */ }
    const items = Object.entries(A.worldState().items || {}).filter(([, it]) => !it?.holder && it?.location && (A.placeKey(it.location) === r.key || A.norm(it.location).includes(stemOf(r.name)))).slice(0, 4);
    return `<section class="lf-dh-card k-${r.kind[0]}">
        <div class="lf-dh-card-h"><span class="lf-dh-card-ic">${A.icon(r.kind[2])}</span><b>${esc(r.name)}</b>${here ? `<span class="lf-here">${A.icon('target')} Вы здесь</span>` : ''}<button class="lf-iconbtn sm" data-act="dh-close">${A.icon('x')}</button></div>
        ${ppl.length || pets.length ? `<div class="lf-dh-card-who">${ppl.map(x => `<button class="lf-dh-who" data-act="who" data-name="${esc(x.who)}">${A.ava(x.who, 'sm')}<span><b>${esc(A.shortName(x.who))}</b><small>${esc(x.maybe ? 'где-то дома' : x.scene ? (x.doing && x.doing !== 'в сцене' ? x.doing : 'в сцене') : A.cut(x.doing || 'здесь', 90))}</small></span></button>`).join('')}${pets.map(({ p, sleepy }) => `<button class="lf-dh-who" data-act="sim-pet" data-id="${esc(p.id)}"><span class="lf-ava sm">${p.img ? `<img src="${esc(p.img)}" alt="">` : ''}<i>${A.icon('paw')}</i></span><span><b>${esc(A.shortName(p.name))}</b><small>${sleepy ? 'спит' : 'бродит тут'}</small></span></button>`).join('')}</div>` : '<div class="lf-dim">Сейчас тут никого.</div>'}
        ${arms.length ? `<div class="lf-dh-card-l">${armFig()}<span>${arms.map(a => `${esc(A.shortName(a.who))}: протез лежит — ${esc(a.where)}`).join('; ')}</span></div>` : ''}
        ${tr.length || items.length ? `<div class="lf-dh-card-tr">${tr.map(t => `<span>${A.icon(t.k === 'note' ? 'sticky' : t.k === 'food' ? 'utensils' : t.k === 'gift' ? 'gift' : 'eye')}${esc(A.cut(t.t, 60))}</span>`).join('')}${items.map(([n, it]) => `<span>${esc(it.icon || '✦')} ${esc(A.cut(n, 40))}</span>`).join('')}</div>` : ''}
        <div class="lf-actions tight">
            <button class="lf-btn" data-act="sim-room" data-key="${esc(r.key)}">${A.icon('search')} Осмотреть</button>
            ${here ? '' : `<button class="lf-btn primary serif" data-act="dh-go" data-key="${esc(r.key)}">Перейти сюда ${A.icon('right')}</button>`}
        </div>
    </section>`;
}

function editHtml(rows) {
    const flat = rows.flat();
    const p = flat.find(r => r.key === ui.pick);
    return `<div class="lf-dh-edit">
        ${p ? `<b>${esc(p.name)}</b>
        <div class="lf-chips wrap">
            <button class="lf-chip" data-act="dh-mv" data-d="left">${A.icon('chevL')} левее</button>
            <button class="lf-chip" data-act="dh-mv" data-d="right">${A.icon('chevR')} правее</button>
            <button class="lf-chip" data-act="dh-mv" data-d="up">${A.icon('chevU')} выше</button>
            <button class="lf-chip" data-act="dh-mv" data-d="down">${A.icon('chevD')} ниже</button>
            <button class="lf-chip" data-act="dh-w">${A.icon('swap')} ${Number(A.settings().places[p.key]?.dh?.w) === 2 ? 'уже' : 'шире'}</button>
            <button class="lf-chip" data-act="dh-hide">${A.icon('x')} убрать</button>
        </div>` : '<span class="lf-dim">Тапни комнату — подвинуть, сделать шире или убрать из домика.</span>'}
        <button class="lf-link" data-act="dh-reset">${A.icon('undo')} как было (по типам комнат)</button>
    </div>`;
}

// ───────────── тапы ─────────────

function dhOf(key) {
    const p = A.getPlace(A.knownLocations().get(key) || key, true);
    if (!p.dh || typeof p.dh !== 'object') p.dh = {};
    return p.dh;
}

/** Сохранить раскладку как есть сейчас (ряды и порядок) — чтобы дальше двигать руками. */
function freeze(rows) {
    rows.forEach((row, ri) => row.forEach((r, k) => { const d = dhOf(r.key); d.row = ri; d.ord = k * 10; }));
}

export async function dhClick(act, el) {
    if (!act.startsWith('dh-')) return false;
    const level = A.mapLevelKey?.() || '';
    const rows = level ? roomsOf(level) : [];
    switch (act) {
        case 'dh-room': {
            const k = el.dataset.key;
            if (ui.edit) ui.pick = ui.pick === k ? '' : k;
            else ui.sel = ui.sel === k ? '' : k;
            A.render();
            return true;
        }
        case 'dh-close': ui.sel = ''; A.render(); return true;
        case 'dh-edit': ui.edit = !ui.edit; ui.pick = ''; A.render(); return true;
        case 'dh-mv': {
            if (!ui.pick) return true;
            freeze(rows);
            const d = dhOf(ui.pick);
            const dir = el.dataset.d;
            const row = rows.find(rw => rw.some(r => r.key === ui.pick)) || [];
            const i = row.findIndex(r => r.key === ui.pick);
            if (dir === 'up' || dir === 'down') {
                // в соседний ряд — в тот же столбец (перед тем, кто там стоит на этом месте)
                d.row = dir === 'up' ? Math.max(0, d.row - 1) : Math.min(rows.length, d.row + 1);
                d.ord = i * 10 - 5;
            } else {
                const j = dir === 'left' ? i - 1 : i + 1;
                if (j >= 0 && j < row.length) { const o = dhOf(row[j].key); [d.ord, o.ord] = [o.ord, d.ord]; }
            }
            A.saveSettings();
            A.render();
            return true;
        }
        case 'dh-w': { if (!ui.pick) return true; const d = dhOf(ui.pick); d.w = Number(d.w) === 2 ? 1 : 2; A.saveSettings(); A.render(); return true; }
        case 'dh-hide': { if (!ui.pick) return true; dhOf(ui.pick).hide = true; ui.pick = ''; A.saveSettings(); A.render(); return true; }
        case 'dh-reset': {
            for (const [k, p] of Object.entries(A.settings().places)) if (level && k.startsWith(`${level}·`) && p.dh) delete p.dh;
            ui.pick = '';
            A.saveSettings();
            A.render();
            return true;
        }
        case 'dh-add': {
            A.openSheet(`${A.icon('door')} Новая комната`, `
                <div class="lf-field"><label>Как называется</label><input type="text" data-in="dh-name" placeholder="кухня, спальня, детская, мастерская…"></div>
                <div class="lf-chips wrap">${['Кухня', 'Спальня', 'Гостиная', 'Ванная', 'Прихожая', 'Кабинет', 'Детская', 'Балкон'].map(n => `<button class="lf-chip" data-act="dh-add-ok" data-key="${esc(el.dataset.key)}" data-name="${n}">${A.icon(kindOf(n)[2])} ${n}</button>`).join('')}</div>
                <button class="lf-btn primary full" data-act="dh-add-ok" data-key="${esc(el.dataset.key)}">${A.icon('plus')} Добавить</button>`);
            return true;
        }
        case 'dh-add-ok': {
            const key = el.dataset.key;
            const box = el.closest('.lf-sheet');
            const name = String(el.dataset.name || box?.querySelector('[data-in="dh-name"]')?.value || '').trim();
            if (!name) return true;
            const raw = `${levelRaw(key)}·${name}`;
            const p = A.getPlace(raw, true);
            p.raw = raw;
            const pk = A.placeKey(raw);
            if (A.settings().places[pk]?.dh?.hide) delete A.settings().places[pk].dh.hide;
            A.saveSettings();
            A.closeSheet();
            A.render();
            return true;
        }
        case 'dh-go': {
            const k = el.dataset.key;
            const raw = A.knownLocations().get(k) || levelRaw(k);
            const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
            ui.sel = '';
            await A.goRoom?.(A.settings().places[k]?.raw || raw, here);
            return true;
        }
    }
    return false;
}

/** Для Карты: домик или план (если у места есть свой план-картинка). */
/** Как открывать место: что выбрала сама (запоминается), иначе её план, если он есть, иначе — в разрезе. */
export function dhDefault(key) {
    const own = A.settings().dhModes?.[key];
    if (own === 'cut' || own === 'plan') return own;
    const p = A.settings().places[key];
    return p?.plan ? 'plan' : 'cut';
}
export function dhRemember(key, mode) {
    const s = A.settings();
    if (!s.dhModes || typeof s.dhModes !== 'object') s.dhModes = {};
    s.dhModes[key] = mode === 'plan' ? 'plan' : 'cut';
    A.saveSettings();
}

export function dhHomeKey() {
    let home = '';
    try { home = homeLoc(); } catch { /* */ }
    return home ? A.placeKey(A.locTop(home)) : '';
}
