// Дорога. Сколько ехать отсюда туда и как: дешёвая модель один раз прикидывает маршрут по городу истории
// (минуты, как ехать, что по дороге — пробки, погода), Life запоминает. На карте — пунктир маршрута между метками
// и время в пути; при «Отправиться» модель получает: сколько ехать, как, что за окном и когда приедут.

let A = null;
export function initRoute(api) { A = api; }

const esc = (v) => A.esc(v);
const pad = (n) => String(n).padStart(2, '0');

function cfg() {
    const s = A.settings();
    if (!s.route || typeof s.route !== 'object') s.route = {};
    const c = s.route;
    if (c.on === undefined) c.on = true;
    if (!c.cache || typeof c.cache !== 'object') c.cache = {};
    return c;
}
export const routeOn = () => cfg().on !== false;

export function howKey(how) {
    const h = A.norm(how);
    if (/пешк|walk/.test(h)) return 'walk';
    if (/мотоцикл|байк|bike/.test(h)) return 'bike';
    if (/квинджет|самол|джет|plane/.test(h)) return 'jet';
    if (/метро|подземк|subway/.test(h)) return 'subway';
    return 'car';
}
const HOW_RU = { walk: 'пешком', bike: 'на мотоцикле', jet: 'на квинджете', subway: 'на метро', car: 'на машине' };
const keyOf = (a, b, how) => `${A.placeKey(a)}>${A.placeKey(b)}|${howKey(how)}`;

export function cached(from, to, how) {
    if (!from || !to) return null;
    const c = cfg().cache;
    return c[keyOf(from, to, how)] || c[keyOf(to, from, how)] || null;
}

const SYSTEM = `Ты знаешь город и мир ролевой истории (MCU, в основном Нью-Йорк, но бывает и другие места). Прикинь дорогу.
Ответь только JSON: {"min":минут_в_пути_число,"route":"как ехать, 3–9 слов (через Бруклинский мост, по FDR)","road":"что по дороге в это время и в эту погоду, 4–12 слов"}`;

let busy = false;
export async function estimate(from, to, how, { force = false } = {}) {
    const have = cached(from, to, how);
    if (!from || !to || busy || (have && !force)) return have;
    busy = true;
    try {
        const st = A.worldState();
        const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: `Откуда: ${A.locParts(from).join(', ')}\nКуда: ${A.locParts(to).join(', ')}\nКак: ${HOW_RU[howKey(how)]}\nКогда: ${[A.weekday?.(st.timestamp?.story_date), st.timestamp?.story_time].filter(Boolean).join(', ') || '—'}; погода: ${st.scene?.atmosphere || '—'}` }], 260);
        const j = A.extractJson(out);
        const min = Math.round(Number(j?.min));
        if (!Number.isFinite(min) || min <= 0) return cached(from, to, how);
        const rec = { min: Math.min(min, 60 * 48), route: String(j.route || '').trim().slice(0, 90), road: String(j.road || '').trim().slice(0, 120), at: Date.now() };
        cfg().cache[keyOf(from, to, how)] = rec;
        const keys = Object.keys(cfg().cache);
        if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete cfg().cache[k];
        A.saveSettings();
        return rec;
    } catch (e) { console.warn('[Life] дорога', e); return cached(from, to, how); } finally { busy = false; }
}

export function minText(m) {
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60), r = m % 60;
    return `${h} ч${r ? ` ${r} мин` : ''}`;
}

function arrival(min) {
    try {
        const tm = String(A.worldState().timestamp?.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
        if (!tm) return '';
        const t = (+tm[1] * 60 + +tm[2] + min) % (24 * 60);
        return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    } catch { return ''; }
}

/** Строчка для модели при «Отправиться». */
export function routeNote(from, to, how) {
    const r = cached(from, to, how);
    if (!r) return '';
    const at = arrival(r.min);
    return `Дорога: ${HOW_RU[howKey(how)]} ~${minText(r.min)}${r.route ? `, ${r.route}` : ''}${r.road ? `; по дороге — ${r.road}` : ''}${at ? `; приедут примерно к ${at}` : ''}.`;
}

/** Плашка в листе «Отправиться» и в карточке места. */
export function routeHtml(from, to, how = '') {
    if (!routeOn() || !from || !to || A.placeKey(from) === A.placeKey(to)) return '';
    const r = cached(from, to, how);
    return `<div class="lf-route" data-from="${esc(from)}" data-to="${esc(to)}">${A.icon('route')}${r
        ? `<span><b>~${esc(minText(r.min))}</b> ${esc(HOW_RU[howKey(how)])}${r.route ? ` · ${esc(r.route)}` : ''}${r.road ? `<small>${esc(r.road)}</small>` : ''}</span>`
        : `<span>Сколько ехать — <button class="lf-link" data-act="rt-est" data-from="${esc(from)}" data-to="${esc(to)}" data-how="${esc(how)}">прикинуть</button></span>`}</div>`;
}

/** Пунктир маршрута на карте: обе метки на этой карте. pins — [[key, place]]; from/to — места как в истории. */
export function routeSvg(pins, fromLoc, toLoc, how = '') {
    if (!routeOn() || !fromLoc || !toLoc) return '';
    const fk = A.placeKey(fromLoc), tk = A.placeKey(toLoc);
    if (!fk || !tk || fk === tk) return '';
    const find = (k) => pins.find(([pk]) => k === pk || k.startsWith(`${pk}·`))?.[1];
    const a = find(fk), b = find(tk);
    if (!a || !b || a === b) return '';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.abs(a.x - b.x) * 0.15;
    const r = cached(fromLoc, toLoc, how);
    return `<svg class="lf-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M ${a.x} ${a.y} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x} ${b.y}" vector-effect="non-scaling-stroke"/></svg>${r ? `<span class="lf-route-eta" style="left:${mx.toFixed(1)}%;top:${Math.max(3, my).toFixed(1)}%">~${esc(minText(r.min))}</span>` : ''}`;
}

export async function routeClick(act, el) {
    if (act !== 'rt-est') return false;
    await A.withBusy(el, async () => { await estimate(el.dataset.from, el.dataset.to, el.dataset.how || ''); }, '…');
    const box = el.closest('.lf-route');
    if (box) box.outerHTML = routeHtml(box.dataset.from, box.dataset.to, el.dataset.how || '');
    else A.render();
    return true;
}
