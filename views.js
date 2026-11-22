// Виды блоков. Шесть блоков Life можно смотреть по-разному — выбор вида живёт в настройках и одинаков во всех чатах:
//   доверие пары — полоски · сердца · щит · светофор · орбиты (все, кто вокруг человека, по доверию);
//   страхи (новый блок в Психике: «боится» из слоя «под словами» и шкала «Страх» пары) — термометры · черепа · тучи · радар;
//   секреты пары — список · сейфы · папки · сеть · конверты;
//   маршрут дня (новый блок в Сцене: где сцена побывала по Horae) — схема · лента · карта · билеты;
//   фракции — карточки · щиты · зал совета · оранжерея;
//   словесная дуэль — перетяжка · столкновение · дебаты.
// Данные те же, что у блоков, — вид их только рисует. Идея переключаемых видов — TavernOS HUD (alewwi), см. NOTICE-HUD.md;
// код и вёрстка написаны заново под Life.

import { tiesOf, tiesLabel } from './ties.js';

let A = null;
export function initViews(api) { A = api; }
const esc = (v) => A.esc(v);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
const f1 = (n) => Number(n).toFixed(1);

export const VIEWS = {
    trust: [['bars', 'Полоски'], ['hearts', 'Сердца'], ['shield', 'Щит'], ['light', 'Светофор'], ['orbit', 'Орбиты']],
    fears: [['thermo', 'Термометры'], ['skulls', 'Черепа'], ['clouds', 'Тучи'], ['radar', 'Радар']],
    secrets: [['list', 'Список'], ['safes', 'Сейфы'], ['folders', 'Папки'], ['net', 'Сеть'], ['envelopes', 'Конверты']],
    route: [['scheme', 'Схема'], ['ribbon', 'Лента'], ['map', 'Карта'], ['tickets', 'Билеты']],
    fac: [['cards', 'Карточки'], ['shields', 'Щиты'], ['council', 'Зал совета'], ['garden', 'Оранжерея']],
    duel: [['bar', 'Перетяжка'], ['clash', 'Столкновение'], ['debate', 'Дебаты']],
};

function cfg() {
    const s = A.settings();
    if (!s.views || typeof s.views !== 'object') s.views = {};
    if (s.views.fearsOn === undefined) s.views.fearsOn = true;
    if (s.views.routeOn === undefined) s.views.routeOn = true;
    return s.views;
}
export const viewOf = (b) => { const v = cfg()[b]; return VIEWS[b]?.some(x => x[0] === v) ? v : VIEWS[b][0][0]; };
/** Переключатель вида — строка чипов под заголовком блока. */
export function viewBar(b) {
    const cur = viewOf(b);
    return `<div class="lf-vw">${VIEWS[b].map(([k, l]) => `<button class="${k === cur ? 'on' : ''}" data-act="vw-set" data-b="${b}" data-v="${k}">${l}</button>`).join('')}</div>`;
}
export function viewsClick(act, el) {
    if (!act.startsWith('vw-')) return false;
    const c = cfg();
    if (act === 'vw-set' && VIEWS[el.dataset.b]) c[el.dataset.b] = el.dataset.v;
    else if (act === 'vw-fears') c.fearsOn = !(c.fearsOn !== false);
    else if (act === 'vw-route') c.routeOn = !(c.routeOn !== false);
    else return false;
    A.saveSettings();
    A.render();
    return true;
}

// ───────────── доверие пары ─────────────

// какие шкалы «плохие» — у них полный светофор красный, а не зелёный
const NEG = new Set(['jealousy', 'tension', 'guilt', 'fear', 'resent', 'hostile', 'worry', 'depend']);
const lvl = (v) => (v < 15 ? 0 : v < 35 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4);
const TRUST_WORD = ['не верит ни слову', 'настороже', 'ровно', 'доверяет', 'верит без оглядки'];
/** Цвет лампы: 0 — красный, 1 — жёлтый, 2 — зелёный. */
const lamp = (f, v) => { const g = v < 35 ? 0 : v < 60 ? 1 : 2; return NEG.has(f) ? 2 - g : g; };

/**
 * Шкалы пары другим видом (полоски рисует сам index.js). o = { who, other, mine, theirs, pinA, pinB, scales: [[f, label, icon]] }.
 * Возвращает '' для «Полосок» — тогда остаётся как было.
 */
export function trustViewHtml(o) {
    const v = viewOf('trust');
    if (v === 'bars') return '';
    const A1 = A.shortName(A.canonName(o.who)), B1 = A.shortName(A.canonName(o.other));
    const lock = (pin, f) => (Number.isFinite(pin?.[f]) ? `<i class="lf-vw-lock">${A.icon('lock')}</i>` : '');
    if (v === 'orbit') return orbitHtml(o.who, o.other);
    if (v === 'shield') {
        const sh = (val, from, to, pinned) => {
            const n = clamp(val);
            const id = `sh${A.hash(`${from}>${to}`)}`;
            return `<div class="lf-vw-shield"><svg viewBox="0 0 80 96" aria-hidden="true"><defs><clipPath id="${id}"><path d="M40 4 74 16v28c0 24-15 40-34 48C21 84 6 68 6 44V16Z"/></clipPath></defs>
                <path class="bg" d="M40 4 74 16v28c0 24-15 40-34 48C21 84 6 68 6 44V16Z"/>
                <rect class="fill l${lvl(n)}" x="0" y="${f1(96 - (n / 100) * 92)}" width="80" height="96" clip-path="url(#${id})"/>
                <path class="rim" d="M40 4 74 16v28c0 24-15 40-34 48C21 84 6 68 6 44V16Z"/><text x="40" y="58">${n}</text></svg>
                <b>${esc(A.shortName(from))} → ${esc(A.shortName(to))}${pinned ? ` ${A.icon('lock')}` : ''}</b><small>${esc(TRUST_WORD[lvl(n)])}</small></div>`;
        };
        const rest = o.scales.filter(([f]) => f !== 'trust');
        return `<div class="lf-vw-trust shield" data-act="pair-edit"><div class="lf-vw-shields">${sh(o.mine.trust, o.who, o.other, Number.isFinite(o.pinA?.trust))}${sh(o.theirs.trust, o.other, o.who, Number.isFinite(o.pinB?.trust))}</div>
            ${rest.length ? `<div class="lf-vw-mini">${rest.map(([f, label, ic]) => `<span>${A.icon(ic)}${esc(label)} <b>${clamp(o.mine[f])}</b>/<b>${clamp(o.theirs[f])}</b></span>`).join('')}</div>` : ''}</div>`;
    }
    const head = `<div class="lf-vw-th"><span></span><b>${esc(A1)} → ${esc(B1)}</b><b>${esc(B1)} → ${esc(A1)}</b></div>`;
    if (v === 'hearts') {
        const row = (f, ic, val, pin) => { const n = Math.round(clamp(val) / 20); return `<span class="lf-vw-hearts${NEG.has(f) ? ' neg' : ''}">${Array.from({ length: 5 }, (_, k) => `<i class="${k < n ? 'on' : ''}">${A.icon(f === 'trust' || f === 'closeness' || f === 'love' ? 'heart' : ic)}</i>`).join('')}${lock(pin, f)}</span>`; };
        return `<div class="lf-vw-trust" data-act="pair-edit">${head}${o.scales.map(([f, label, ic]) => `<div class="lf-vw-tr"><span>${A.icon(ic)}${esc(label)}</span>${row(f, ic, o.mine[f], o.pinA)}${row(f, ic, o.theirs[f], o.pinB)}</div>`).join('')}</div>`;
    }
    // светофор
    const light = (f, val, pin) => { const c = lamp(f, clamp(val)); return `<span class="lf-vw-light"><i class="${c === 0 ? 'r' : ''}"></i><i class="${c === 1 ? 'y' : ''}"></i><i class="${c === 2 ? 'g' : ''}"></i><b>${clamp(val)}</b>${lock(pin, f)}</span>`; };
    return `<div class="lf-vw-trust" data-act="pair-edit">${head}${o.scales.map(([f, label, ic]) => `<div class="lf-vw-tr${Math.abs(clamp(o.mine[f]) - clamp(o.theirs[f])) >= 25 ? ' asym' : ''}"><span>${A.icon(ic)}${esc(label)}</span>${light(f, o.mine[f], o.pinA)}${light(f, o.theirs[f], o.pinB)}</div>`).join('')}
        <div class="lf-hint-i">Зелёный — хорошо для пары, красный — тревожно. У ревности, напряжения, вины всё наоборот: чем выше, тем краснее.</div></div>`;
}

/** Орбиты: человек в центре, вокруг — все, к кому у него есть чувства; ближе — кому больше доверяет, крупнее — кто ближе. */
function orbitHtml(who, cur) {
    const name = A.canonName(who);
    const list = Object.values(A.relationsState()).filter(p => A.sameName(p.a, name) || A.sameName(p.b, name)).map(p => {
        const other = A.sameName(p.a, name) ? p.b : p.a;
        const sd = A.sameName(p.a, name) ? p.ab : p.ba;
        return { other, trust: clamp(sd.trust), close: clamp(sd.closeness) };
    }).filter(x => x.other && !A.sameName(x.other, name)).sort((a, b) => b.trust - a.trust).slice(0, 10);
    if (!list.length) return '<div class="lf-hint">Пока не с кем — орбиты появятся, когда Летописец запишет чувства.</div>';
    const dots = list.map((x, k) => {
        const ang = (k / list.length) * Math.PI * 2 - Math.PI / 2;
        const r = 14 + (100 - x.trust) * 0.32;
        const sz = x.close >= 70 ? 'md' : x.close >= 35 ? 'sm' : 'xs';
        return `<button class="lf-vw-orb${A.sameName(x.other, cur) ? ' on' : ''}" style="left:${f1(50 + Math.cos(ang) * r)}%;top:${f1(50 + Math.sin(ang) * r)}%" data-act="pair" data-v="${esc(x.other)}" title="${esc(x.other)}: доверие ${x.trust}">${A.ava(x.other, sz)}<small>${x.trust}</small></button>`;
    }).join('');
    return `<div class="lf-vw-orbit"><svg viewBox="0 0 100 100" aria-hidden="true">${[22, 32, 42].map(r => `<circle cx="50" cy="50" r="${r}"/>`).join('')}</svg>
        <span class="lf-vw-orb c">${A.ava(name, 'md')}</span>${dots}</div>
    <div class="lf-hint-i">Ближе к центру — кому ${esc(A.shortName(name))} больше доверяет, крупнее — кто ближе. Тап — открыть пару.</div>`;
}

// ───────────── страхи ─────────────

const stem = (t) => A.norm(t).replace(/[^a-zа-я0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 3).map(w => w.slice(0, 5)).join(' ');
/** Страхи человека: [{ t, v (0–100), n, mes, kind: 'under'|'tie' }] — из слоя «под словами» последних постов и шкалы «Страх» пары. */
export function fearsOf(who, look = 40) {
    const name = A.canonName(who);
    const chat = A.chatArr();
    const by = A.chatMeta().under?.by || {};
    const map = new Map();
    let seen = 0;
    for (let i = chat.length - 1; i >= 0 && seen < look; i--) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        seen++;
        const e = by[i];
        if (!e || e.h !== A.hash(m.mes || '')) continue;
        for (const r of e.list || []) {
            if (!A.sameName(r.who, name) || !r.fear) continue;
            const k = stem(r.fear) || A.norm(r.fear);
            const x = map.get(k) || { t: String(r.fear), n: 0, w: 0, mes: i, kind: 'under' };
            x.n++;
            x.w += seen <= 10 ? 2 : 1;   // свежее весит вдвое
            map.set(k, x);
        }
    }
    // сила: мягкое насыщение — пара упоминаний ≈ 30, полдюжины ≈ 60, постоянный страх под 90
    const out = [...map.values()].map(x => ({ ...x, v: clamp(Math.max(15, 100 * (1 - Math.exp(-x.w / 6)))) }));
    // «Страх» пары (ties): боится самого человека
    try {
        const others = [A.canonName(A.ctx().name1), ...A.groupMembers().map(A.canonName)].filter(n => n && !A.sameName(n, name));
        for (const o of others) {
            const v = tiesOf(name, o)?.fear;
            if (Number.isFinite(v) && v >= 15) out.push({ t: `${A.shortName(o)} — ${tiesLabel('fear').toLowerCase()} перед ним самим`, v: clamp(v), n: 0, kind: 'tie', who: o });
        }
    } catch { /* */ }
    return out.sort((a, b) => b.v - a.v).slice(0, 6);
}

/** Персонаж → Психика: страхи с переключателем вида. */
export function fearsHtml(who) {
    if (cfg().fearsOn === false) return '';
    const list = fearsOf(who);
    const head = `${A.sec('Страхи', list.length ? `${list.length}` : '')}${list.length ? viewBar('fears') : ''}`;
    if (!list.length) return `${head}<div class="lf-hint">Страхи соберутся из слоя «под словами» (что персонаж боится в каждом посте) и шкалы «Страх» пары.</div>`;
    const v = viewOf('fears');
    const jump = (x) => (x.mes != null ? ` data-act="jump" data-mes="${x.mes}"` : '');
    let body = '';
    if (v === 'skulls') {
        body = `<div class="lf-vw-fl">${list.map(x => { const n = Math.max(1, Math.round(x.v / 20)); return `<button class="lf-vw-fr"${jump(x)}><span>${esc(x.t)}</span><em class="lf-vw-skulls">${Array.from({ length: 5 }, (_, k) => `<i class="${k < n ? 'on' : ''}">${SKULL}</i>`).join('')}</em></button>`; }).join('')}</div>`;
    } else if (v === 'clouds') {
        body = `<div class="lf-vw-clouds">${list.map(x => `<button class="lf-vw-cloud" style="--s:${f1(0.72 + x.v / 160)};--d:${f1(0.25 + x.v / 140)}"${jump(x)}><svg viewBox="0 0 120 70" aria-hidden="true"><path d="M30 62h62a20 20 0 0 0 2-40 26 26 0 0 0-50-6 18 18 0 0 0-14 46Z"/>${x.v >= 60 ? '<path class="bolt" d="M62 50l-8 14h9l-6 12 14-17h-9l6-9Z"/>' : ''}</svg><span>${esc(x.t)}</span></button>`).join('')}</div>`;
    } else if (v === 'radar') {
        body = radarSvg(list);
    } else {
        body = `<div class="lf-vw-thermos">${list.map(x => `<button class="lf-vw-thermo"${jump(x)}><span class="tube"><i style="height:${x.v}%"></i></span><span class="bulb"></span><small>${esc(x.t)}</small><b>${x.v}</b></button>`).join('')}</div>`;
    }
    return `${head}${body}`;
}
const SKULL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C7 2 4 5.6 4 10c0 2.6 1.1 4.4 3 5.5V19a1 1 0 0 0 1 1h1v-2h2v2h2v-2h2v2h1a1 1 0 0 0 1-1v-3.5c1.9-1.1 3-2.9 3-5.5 0-4.4-3-8-8-8Zm-3.5 9.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Zm7 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z"/></svg>';
function radarSvg(list) {
    const n = Math.max(3, list.length);
    const pts = (k, r) => { const a = (k / n) * Math.PI * 2 - Math.PI / 2; return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; };
    const ring = (r) => Array.from({ length: n }, (_, k) => pts(k, r).map(f1).join(',')).join(' ');
    const poly = Array.from({ length: n }, (_, k) => pts(k, ((list[k]?.v ?? 0) / 100) * 38).map(f1).join(',')).join(' ');
    const labels = list.map((x, k) => { const [x0, y0] = pts(k, 44); return `<text x="${f1(x0)}" y="${f1(y0 + (y0 > 60 ? 4 : y0 < 40 ? -1 : 1.5))}" text-anchor="${x0 < 45 ? 'end' : x0 > 55 ? 'start' : 'middle'}">${esc(A.cut(x.t, 20))}</text>`; }).join('');
    return `<svg class="lf-vw-radar" viewBox="-52 -6 204 114" aria-hidden="true">${[13, 25, 38].map(r => `<polygon class="ring" points="${ring(r)}"/>`).join('')}
        ${Array.from({ length: n }, (_, k) => { const [x, y] = pts(k, 38); return `<line x1="50" y1="50" x2="${f1(x)}" y2="${f1(y)}"/>`; }).join('')}
        <polygon class="val" points="${poly}"/>${labels}</svg>`;
}

// ───────────── секреты пары ─────────────

/** Секреты пары другим видом (список рисует index.js). list — secretsState() пары; who/other — пара. */
export function secretsViewHtml(list, who, other) {
    const v = viewOf('secrets');
    if (v === 'list' || !list.length) return '';
    const names = (x) => (x.knows || []).map(n => A.shortName(A.canonName(n)));
    const knowsBoth = (x) => (x.knows || []).some(k => A.sameName(k, who)) && (x.knows || []).some(k => A.sameName(k, other));
    if (v === 'safes') {
        return `<div class="lf-vw-safes">${list.map(x => { const open = knowsBoth(x); const one = (x.knows || []).length === 1; return `<button class="lf-vw-safe${open ? ' open' : one ? ' shut' : ''}" data-act="jump" data-mes="${x.mes}">
            <svg viewBox="0 0 64 64" aria-hidden="true"><rect class="box" x="6" y="8" width="52" height="46" rx="5"/>${open ? '<path class="door" d="M6 8h20v46H6z" transform="skewY(-12) translate(0 6)"/>' : '<rect class="door" x="11" y="13" width="42" height="36" rx="3"/><circle class="dial" cx="32" cy="31" r="8"/><path class="dial" d="M32 23v4M32 35v4M24 31h4M36 31h4"/>'}<rect class="leg" x="12" y="54" width="8" height="4"/><rect class="leg" x="44" y="54" width="8" height="4"/></svg>
            <b>${esc(names(x).join(', ') || '—')}</b><span>${esc(A.cut(x.text, 90))}</span></button>`; }).join('')}</div>`;
    }
    if (v === 'folders') {
        return `<div class="lf-vw-folders">${list.map(x => `<button class="lf-vw-folder${(x.knows || []).length === 1 ? ' top' : ''}" data-act="jump" data-mes="${x.mes}"><em>${(x.knows || []).length === 1 ? 'Совершенно секретно' : 'Для служебного'}</em><b>Знает: ${esc(names(x).join(', ') || '—')}</b><span>${esc(x.text)}</span><small>пост #${x.mes}</small></button>`).join('')}</div>`;
    }
    if (v === 'envelopes') {
        return `<div class="lf-vw-envs">${list.map(x => { const sealed = !knowsBoth(x); return `<button class="lf-vw-env${sealed ? ' sealed' : ''}" data-act="jump" data-mes="${x.mes}"><svg viewBox="0 0 80 52" aria-hidden="true"><rect x="2" y="2" width="76" height="48" rx="3"/><path d="M2 4l38 26L78 4"/>${sealed ? '<circle class="wax" cx="40" cy="30" r="8"/>' : ''}</svg><b>${sealed ? `запечатано · ${esc(names(x).join(', '))}` : 'вскрыто — знают оба'}</b><span>${esc(A.cut(x.text, 110))}</span></button>`; }).join('')}</div>`;
    }
    // сеть: тайны — узлы в середине, кто знает — по кругу, линии «знает»
    const people = [];
    for (const x of list) for (const k of x.knows || []) if (!people.some(p => A.sameName(p, k))) people.push(A.canonName(k));
    const P = people.slice(0, 8);
    const S = list.slice(0, 7);
    const pp = (k) => { const a = (k / Math.max(1, P.length)) * Math.PI * 2 - Math.PI / 2; return [50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40]; };
    const sp = (k) => [50 + (S.length > 1 ? ((k / (S.length - 1)) - 0.5) * 44 : 0), 50 + (k % 2 ? 7 : -7)];
    const lines = S.flatMap((x, k) => (x.knows || []).map(n => { const j = P.findIndex(p => A.sameName(p, n)); if (j < 0) return ''; const [a, b] = sp(k); const [c, d] = pp(j); return `<line x1="${f1(a)}" y1="${f1(b)}" x2="${f1(c)}" y2="${f1(d)}"/>`; })).join('');
    return `<div class="lf-vw-net"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${P.map((n, k) => { const [x, y] = pp(k); return `<span class="lf-vw-np" style="left:${f1(x)}%;top:${f1(y)}%">${A.ava(n, 'sm')}</span>`; }).join('')}
        ${S.map((x, k) => { const [a, b] = sp(k); return `<button class="lf-vw-ns" style="left:${f1(a)}%;top:${f1(b)}%" data-act="jump" data-mes="${x.mes}" title="${esc(x.text)}">${A.icon('lock')}<small>${k + 1}</small></button>`; }).join('')}</div>
    <ol class="lf-vw-netl">${S.map(x => `<li>${esc(A.cut(x.text, 120))} <small>— ${esc(names(x).join(', '))}</small></li>`).join('')}</ol>`;
}

// ───────────── маршрут дня ─────────────

/** Где сцена побывала: остановки по Horae (место, время, пост). Сегодня по дате истории, иначе — последние восемь. */
export function routeStops() {
    const chat = A.chatArr();
    const all = [];
    let loc = '', date = '', time = '', lastDay = '';
    for (let i = 0; i < chat.length; i++) {
        const meta = chat[i]?.horae_meta;
        if (!meta || meta._skipHorae) continue;
        if (meta.timestamp?.story_date) date = meta.timestamp.story_date;
        if (meta.timestamp?.story_time) time = meta.timestamp.story_time;
        const l = meta.scene?.location || loc;
        if (!l) continue;
        const k = A.placeKey(l);
        if (!k) continue;
        // новая остановка — смена места; новый день начинается с того места, где проснулись
        if (k !== A.placeKey(loc) || (date && date !== lastDay)) all.push({ loc: l, key: k, date, time, mes: i, who: (meta.scene?.characters_present || []).map(A.canonName).filter(Boolean).slice(0, 4) });
        loc = l;
        if (date) lastDay = date;
    }
    const today = all.length ? all[all.length - 1].date : '';
    const day = today ? all.filter(s => s.date === today) : [];
    return (day.length >= 2 ? day : all.slice(-8)).map(s => ({ ...s, name: A.placeName ? A.placeName(A.locTop(s.loc)) || s.loc : s.loc }));
}
const hm = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
/** Сцена → Маршрут дня. */
export function routeSceneHtml() {
    if (!A?.hasChat?.() || cfg().routeOn === false) return '';
    const st = routeStops();
    if (st.length < 2) return '';
    const v = viewOf('route');
    const jump = (s) => `data-act="jump" data-mes="${s.mes}"`;
    let body = '';
    if (v === 'ribbon') {
        body = `<div class="lf-vw-ribbon">${st.map((s, k) => `<button class="${k === st.length - 1 ? 'now' : ''}" ${jump(s)}><small>${esc(hm(s.time) || '—')}</small><i></i><b>${esc(A.cut(s.name, 26))}</b></button>`).join('')}</div>`;
    } else if (v === 'map') {
        // место — по хэшу названия (одно место — всегда в одной точке), подпись справа — потому левее середины
        const pos = st.map(s => { const h = parseInt(A.hash(s.key), 36) || 0; return [8 + (h % 52), 12 + (Math.floor(h / 97) % 70)]; });
        const path = pos.map((p, k) => `${k ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
        body = `<div class="lf-vw-rmap"><svg viewBox="0 0 100 92" preserveAspectRatio="none" aria-hidden="true"><path d="${path}"/></svg>${st.map((s, k) => `<button class="${k === st.length - 1 ? 'now' : ''}" style="left:${pos[k][0]}%;top:${pos[k][1]}%" ${jump(s)}><i>${k + 1}</i><span>${esc(A.cut(s.name, 18))}${s.time ? ` · ${esc(hm(s.time))}` : ''}</span></button>`).join('')}</div>`;
    } else if (v === 'tickets') {
        body = `<div class="lf-vw-tickets">${st.slice(1).map((s, k) => `<button class="lf-vw-ticket" ${jump(s)}><span class="from"><small>откуда</small><b>${esc(A.cut(st[k].name, 22))}</b></span><span class="to"><small>куда</small><b>${esc(A.cut(s.name, 22))}</b></span><em>${esc(hm(s.time) || '—')}</em><i class="stub">${String(k + 1).padStart(2, '0')}</i></button>`).join('')}</div>`;
    } else {
        body = `<div class="lf-vw-scheme">${st.map((s, k) => `<button class="${k === st.length - 1 ? 'now' : ''}" ${jump(s)}><small>${esc(hm(s.time) || '')}</small><i></i><span><b>${esc(s.name)}</b>${s.who.length ? `<em>${s.who.map(n => esc(A.shortName(n))).join(', ')}</em>` : ''}</span></button>`).join('')}</div>`;
    }
    return `${A.sec('Маршрут дня', `${st.length} ${A.plural(st.length, 'место', 'места', 'мест')}`)}${viewBar('route')}${body}`;
}

// ───────────── фракции ─────────────

/** Фракции другим видом (карточки рисует factions.js). */
export function facViewHtml(list) {
    const v = viewOf('fac');
    if (v === 'cards' || !list.length) return '';
    const heroes = [];
    for (const f of list) for (const n of Object.keys(f.to || {})) if (!heroes.some(h => A.sameName(h, n))) heroes.push(n);
    const col = (val) => (val >= 40 ? 'g' : val >= 10 ? 'lg' : val > -10 ? 'n' : val > -40 ? 'o' : 'r');
    if (v === 'shields') {
        return `<div class="lf-vw-heralds">${list.map(f => `<div class="lf-vw-herald"><svg viewBox="0 0 60 72" aria-hidden="true"><path d="M30 3 56 12v20c0 18-11 31-26 37C15 63 4 50 4 32V12Z"/><text x="30" y="40">${esc(String(f.name).trim().charAt(0).toUpperCase())}</text></svg>
            <b>${esc(f.name)}</b><span>${Object.entries(f.to || {}).map(([n, x]) => `<em class="${col(x.v)}">${esc(A.shortName(n))} ${x.v > 0 ? '+' : ''}${x.v}</em>`).join('')}</span></div>`).join('')}</div>`;
    }
    if (v === 'council') {
        // полукруг мест: каждое место — фракция, цвет — как она к герою; герой выбирается чипами
        const cur = heroes.find(h => A.sameName(h, cfg().facHero)) || heroes[0] || '';
        const n = list.length;
        const seats = list.map((f, k) => { const a = Math.PI - (n === 1 ? Math.PI / 2 : (k / (n - 1)) * Math.PI); const x = 50 + Math.cos(a) * 40, y = 52 - Math.sin(a) * 40; const val = Object.entries(f.to || {}).find(([nm]) => A.sameName(nm, cur))?.[1]?.v; return `<span class="lf-vw-seat ${val == null ? 'none' : col(val)}" style="left:${f1(x)}%;top:${f1(y)}%"><i></i><small>${esc(A.cut(f.name, 14))}</small></span>`; }).join('');
        return `<div class="lf-chips">${heroes.map(h => `<button class="lf-chip${A.sameName(h, cur) ? ' on' : ''}" data-act="vw-hero" data-v="${esc(h)}">${esc(A.shortName(h))}</button>`).join('')}</div>
            <div class="lf-vw-council"><svg viewBox="0 0 100 56" preserveAspectRatio="none" aria-hidden="true"><path d="M8 52a42 42 0 0 1 84 0"/><path d="M22 52a28 28 0 0 1 56 0"/></svg>${seats}<span class="lf-vw-podium">${A.ava(cur, 'sm')}</span></div>
            <div class="lf-vw-legend"><span><i class="g"></i>свои</span><span><i class="n"></i>ровно</span><span><i class="r"></i>враги</span><span><i class="none"></i>нет отношения</span></div>`;
    }
    // оранжерея: у каждой фракции — росток на каждого героя: выше — лучше, ниже нуля — вянет
    return `<div class="lf-vw-garden">${list.map(f => `<div class="lf-vw-pot"><div class="plants">${Object.entries(f.to || {}).map(([nm, x]) => { const h = Math.max(6, Math.abs(x.v) * 0.6 + 6); return `<span class="plant ${x.v < 0 ? 'wilt' : ''}" title="${esc(nm)}: ${x.v}"><i style="height:${f1(h)}px"></i>${x.v >= 40 ? '<u></u>' : ''}<small>${esc(A.shortName(nm))}</small></span>`; }).join('')}</div><b>${esc(f.name)}</b></div>`).join('')}</div>`;
}
export function facHeroClick(act, el) {
    if (act !== 'vw-hero') return false;
    cfg().facHero = el.dataset.v;
    A.saveSettings();
    A.render();
    return true;
}

// ───────────── словесная дуэль ─────────────

const HEAT = { spar: 'спор', jab: 'уколы', quarrel: 'ссора', shout: 'крик', cold: 'холод', truce: 'примирение' };
/** Дуэль другим видом (перетяжку рисует duel.js). c — текущая дуэль. */
export function duelViewHtml(c) {
    const v = viewOf('duel');
    if (v === 'bar' || !c) return '';
    const left = A.sameName(c.lead, c.a) ? c.score : 100 - c.score;
    const a = A.shortName(c.a), b = A.shortName(c.b);
    if (v === 'clash') {
        const pa = clamp(left), pb = 100 - pa;
        return `<div class="lf-vw-clash h-${esc(c.heat)}"><span class="side l" style="--p:${pa}">${A.ava(c.a, 'md')}<b>${esc(a)}</b><em>${pa}</em></span>
            <span class="spark" style="left:${f1(18 + pa * 0.64)}%">${A.icon('zap')}</span><span class="side r" style="--p:${pb}">${A.ava(c.b, 'md')}<b>${esc(b)}</b><em>${pb}</em></span>
            <i class="beam l" style="width:${f1(pa * 0.64)}%"></i><i class="beam r" style="width:${f1(pb * 0.64)}%"></i></div>`;
    }
    const pts = (who) => c.rounds.filter(r => r.gave?.who && !A.sameName(r.gave.who, who)).length;
    return `<div class="lf-vw-debate"><div class="pod l">${A.ava(c.a, 'md')}<b>${esc(a)}</b><em>${pts(c.a)}</em><i style="height:${f1(20 + left * 0.5)}px"></i></div>
        <div class="mid"><small>${esc(HEAT[c.heat] || '')}</small><b>${c.rounds.length}</b><small>${A.plural(c.rounds.length, 'обмен', 'обмена', 'обменов')}</small></div>
        <div class="pod r">${A.ava(c.b, 'md')}<b>${esc(b)}</b><em>${pts(c.b)}</em><i style="height:${f1(20 + (100 - left) * 0.5)}px"></i></div></div>
    <div class="lf-hint-i">Очки — сколько раз уступил соперник; высота трибуны — кто сейчас ведёт.</div>`;
}
