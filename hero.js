// Герои: как кого знает публика — по годам истории. У кого лицо под маской миру неизвестно, того без костюма
// как героя не узнают (разве что как гражданского, если тот сам на виду), в костюме — узнают героя;
// кого мир считает погибшим — в эти годы не узнают, а помнят и оплакивают; вернулся под своим именем — узнают под ним.
// На каждого — периоды «с какого по какой год: как узнают в жизни / в костюме, статус». Собирает Летописец
// из карточек, лорбуков и канона (лор живёт у неё, в коде его нет), правится руками. Берут Массовка и СМИ.

import { storyYear } from './era.js';
import { loreFor, cardText } from './lore.js';
import { canonText } from './canon.js';

let A = null;
export function initHero(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

export const STATUS = {
    active: 'действует',
    retired: 'в отставке',
    dead: '«мёртв» для мира',
    wanted: 'в розыске',
    hidden: 'в тени',
    civil: 'не герой',
};
/** Как сказать модели: «<геройское имя> — погиб(ла), так считает мир». */
export const STATUS_SAY = {
    active: 'действует',
    retired: 'в отставке',
    dead: 'погиб(ла) — так считает мир',
    wanted: 'в розыске',
    hidden: 'в тени — о нём не знают',
    civil: '',
};

function cfg() {
    const s = A.settings();
    if (!s.hero || typeof s.hero !== 'object') s.hero = {};
    const c = s.hero;
    if (c.on === undefined) c.on = true;
    if (!c.list || typeof c.list !== 'object') c.list = {};
    if (!c.migrated) migrate(c);
    return c;
}
export const heroOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

/** Старое «кого как узнают» Массовки (одна строка на все эпохи) — первым периодом «всегда», до сборки по годам. */
function migrate(c) {
    c.migrated = 1;
    const fame = A.settings().crowd?.fame || {};
    for (const [n, t] of Object.entries(fame)) {
        if (!str(t) || keyOf(c, n)) continue;
        c.list[n] = { alias: '', eras: [{ from: '', to: '', plain: str(t), suit: '', status: '' }], legacy: true };
    }
    try { A.saveSettings(); } catch { /* */ }
}

function keyOf(c, name) { return Object.keys(c.list).find(k => A.sameName(k, name)) || ''; }
/** Запись героя (периоды, псевдоним, костюм, кто знает тайну, подвиги из лора) или null. */
export function heroOf(name) { const c = cfg(); const k = keyOf(c, name); return k ? c.list[k] : null; }

/** Кто в истории: персона и участники группы. */
export function heroRoster() {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    try { add(A.ctx().name1); } catch { /* */ }
    try { for (const n of A.groupMembers()) add(n); } catch { /* */ }
    for (const k of Object.keys(cfg().list)) add(k);
    return out;
}

const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

/** Период, куда попадает год (самый узкий); без года — только период «всегда». */
export function rowFor(h, y) {
    const rows = (h?.eras || []).filter(r => r && (str(r.plain) || str(r.suit) || r.status));
    if (!rows.length) return null;
    if (!y) return rows.find(r => num(r.from) == null && num(r.to) == null) || null;
    let best = null;
    let span = Infinity;
    for (const r of rows) {
        const f = num(r.from) ?? -Infinity;
        const t = num(r.to) ?? Infinity;
        if (y < f || y > t) continue;
        if (!best || t - f < span) { best = r; span = t - f; }
    }
    return best;
}

/** Как знают этого человека сейчас (по году истории): { alias, plain, suit, status, from, to } или null. */
export function fameNow(name, y = undefined) {
    if (!heroOn()) return null;
    const h = heroOf(name);
    if (!h) return null;
    let yr = y;
    if (yr === undefined) { try { yr = storyYear(); } catch { yr = null; } }
    const r = rowFor(h, yr);
    return r ? { alias: str(h.alias), plain: str(r.plain), suit: str(r.suit), status: str(r.status), law: str(r.law), pop: Number.isFinite(Number(r.pop)) && r.pop !== '' ? Number(r.pop) : null, from: r.from, to: r.to } : null;
}

const unknown = (t) => !t || /^(не узна|никто не узна|не известн|неизвестн|—|-)/i.test(t);

/** Одна строка для модели: «Имя — в жизни: …; в костюме (Псевдоним): …; статус». */
export function fameLine(name, y = undefined) {
    const f = fameNow(name, y);
    if (!f) return '';
    const bits = [];
    bits.push(`в жизни: ${f.plain || 'не узнают'}`);
    if (f.suit) bits.push(`в костюме${f.alias ? ` (${f.alias})` : ''}: ${f.suit}`);
    if (f.status && STATUS_SAY[f.status]) bits.push(`${f.alias || 'для мира'} — ${STATUS_SAY[f.status]}${f.law ? ` (${f.law})` : ''}`);
    return `${A.shortName(A.canonName(name))} — ${bits.join('; ')}`;
}

/** Строки для модели про тех, кого назвали (или всех). */
export function fameLines(names = null, y = undefined) {
    return (names || heroRoster()).map(n => fameLine(n, y)).filter(Boolean);
}

/** Узнают ли вообще (в жизни или в костюме) — для подписи в Сцене. */
export function famous(name) {
    const f = fameNow(name);
    return !!f && (!unknown(f.plain) || !!f.suit);
}

// ───────────── сборка из лора ─────────────

const FAME_RE = /костюм|маск|супергеро|герой|геро[ия]н|мстител|публи|узна|папарацци|пресс|сми|таблоид|газет|розыск|договор|амнист|помил|погиб|похорон|мемориал|памятник|мёртв|мертв|воскрес|вернул|слава|знаменит|светск|псевдоним|прозвищ|под маской|личность|суперсил|способност|броня|доспех/i;

const SYSTEM = `Ты ведёшь лор длинной ролевой (фанфик по MCU, своя AU). Нужно: как публика — люди на улице, пресса — узнаёт каждого персонажа в разные годы истории.
Правила:
• Тайная личность (лицо героя под маской миру неизвестно): в обычной жизни как героя его не узнают — разве что как гражданского, если тот сам на виду; в костюме узнают героя.
• Кого мир считает погибшим или пропавшим — в эти годы не узнают, а помнят и оплакивают (статус dead); вернулся под своим именем — с этого года узнают под ним, а прежний геройский образ может так и остаться «погибшим».
• Канон MCU и отличия этой AU — из лора; годы — по канону и лору. Если персонаж жил в 1940-х — тот период тоже.
• Только то, что знает публика: кто под маской, если это тайна, — в plain и suit не раскрывать.
На каждого — 1–5 периодов по порядку, без дыр и наложений; у последнего "to": "".
plain — как узнают в обычной жизни (или «не узнают» и почему), suit — как узнают в костюме или геройском образе ("" если такого нет). 5–20 слов каждое, с живой реакцией людей (косятся, просят селфи, шепчутся, крестятся, плачут).
status: active (действует) | retired (в отставке) | dead («мёртв» для мира) | wanted (в розыске) | hidden (в тени, о нём не знают) | civil (не герой).
law — что с ним по закону в эти годы (договор, розыск, помилование, амнистия), 3–12 слов, или "". pop — популярность у публики 0–100 (как у других Мстителей того времени), или "" если не на виду.
Ещё на каждого: secret — true, если в какие-то годы лицо героя под маской публике неизвестно; knows — кто из персонажей знает эту тайну (по лору); suit — как выглядит костюм / геройский образ, 12–30 слов, или ""; feats — 0–5 подвигов на виду у людей по канону и лору: год, что сделал(а) (4–10 слов), как это видели люди (8–20 слов).
Ответь только JSON: {"heroes":[{"name":"имя как в списке","alias":"геройское имя или ''","secret":false,"knows":[],"suit":"","eras":[{"from":2014,"to":2023,"plain":"…","suit":"…","status":"active","law":"","pop":70}],"feats":[{"year":2014,"t":"…","public":"…"}]}]}`;

let busy = false;
let tried = '';
const SCHEMA = 2;

async function collectInput(names) {
    const parts = [];
    for (const n of names) {
        let lore = '';
        try { lore = await loreFor(n, { re: FAME_RE, max: 4500 }); } catch { /* */ }
        const card = cardText(n, 1400);
        parts.push(`## ${n}\n${card ? `Карточка:\n${card}\n` : ''}${lore ? `Лор:\n${lore}` : ''}`);
    }
    const canon = canonText();
    return { text: `Персонажи: ${names.join(', ')}\n\n${canon ? `Канон и хронология:\n${canon}\n\n` : ''}${parts.join('\n\n')}`.slice(0, 22000), lore: parts.some(p => p.includes('Лор:')) || !!canon };
}

function cleanEras(list) {
    const rows = (Array.isArray(list) ? list : []).map(r => ({
        from: num(r?.from) ?? '', to: num(r?.to) ?? '',
        plain: str(r?.plain).slice(0, 220), suit: str(r?.suit).slice(0, 220),
        status: STATUS[str(r?.status)] ? str(r.status) : '',
        law: str(r?.law).slice(0, 140),
        pop: Number.isFinite(Number(r?.pop)) && str(r?.pop) !== '' ? Math.max(0, Math.min(100, Math.round(Number(r.pop)))) : '',
    })).filter(r => r.plain || r.suit || r.status);
    rows.sort((a, b) => (num(a.from) ?? -9999) - (num(b.from) ?? -9999));
    return rows.slice(0, 6);
}

/** Собрать периоды из лора. force — и тех, кого правили руками. Вернёт, скольких обновила. */
export async function fameCollect({ force = false } = {}) {
    if (busy) throw new Error('уже собираю');
    busy = true;
    try {
        const names = heroRoster();
        if (!names.length) throw new Error('в чате никого');
        const { text, lore } = await collectInput(names);
        if (!lore) throw new Error('в подключённых лорбуках про это ничего не нашлось — впиши руками');
        tried = A.hash(text);
        const j = await A.askJson([{ role: 'system', content: SYSTEM }, { role: 'user', content: text }], 3000, { what: 'Кого как узнают', check: (x) => Array.isArray(x?.heroes) && x.heroes.length });
        const c = cfg();
        let n = 0;
        for (const h of j.heroes) {
            const who = names.find(x => A.sameName(x, A.canonName(str(h?.name))));
            if (!who) continue;
            const eras = cleanEras(h.eras);
            const k = keyOf(c, who) || who;
            const extra = {
                secret: h.secret === true || h.secret === 'true',
                knows: (Array.isArray(h.knows) ? h.knows : []).map(x => A.canonName(str(x))).filter(Boolean).slice(0, 12),
                suitLook: str(h.suit).slice(0, 320),
                feats: (Array.isArray(h.feats) ? h.feats : []).map(f => ({ year: num(f?.year) ?? '', t: str(f?.t).slice(0, 120), public: str(f?.public).slice(0, 220) })).filter(f => f.t).slice(0, 6),
            };
            const cur = c.list[k];
            if (cur?.hand && !force) {
                // правлено руками — периоды не трогаю, дописываю только пустое
                if (!cur.suitLook && extra.suitLook) cur.suitLook = extra.suitLook;
                if (!cur.knows?.length && extra.knows.length) cur.knows = extra.knows;
                if (!cur.feats?.length && extra.feats.length) cur.feats = extra.feats;
                if (cur.secret === undefined) cur.secret = extra.secret;
                continue;
            }
            if (!eras.length) continue;
            c.list[k] = { ...(cur || {}), alias: str(h.alias).slice(0, 40), eras, hand: false, legacy: false, at: Date.now(), ...extra, suitImg: cur?.suitImg || '' };
            delete c.list[k].legacy;
            // что правила в «Героях» руками — оставить
            if (cur?.suitHand) c.list[k].suitLook = cur.suitLook;
            if (cur?.knowsHand) c.list[k].knows = cur.knows;
            if (cur?.featsHand) c.list[k].feats = cur.feats;
            n++;
        }
        c.sig = tried;
        c.schema = SCHEMA;
        c.at = Date.now();
        A.saveSettings();
        try { A.updatePrompt(); } catch { /* */ }
        return n;
    } finally { busy = false; }
}

/** Фоном (открыли чат): у кого-то из своих нет периодов или только старая строка — собрать. Раз на версию лора. */
export async function fameEnsure() {
    if (!heroOn() || busy || !A?.hasChat?.()) return;
    const c = cfg();
    const names = heroRoster();
    if (!names.length) return;
    const stale = c.schema !== SCHEMA; // 0.46: из лора берутся ещё тайна, кто знает, костюм, закон, слава, подвиги
    const need = stale || names.some(n => { const h = heroOf(n); return !h || (h.legacy && !h.hand); });
    if (!need) return;
    const { text, lore } = await collectInput(names).catch(() => ({ text: '', lore: false }));
    if (!lore) return;
    const sig = A.hash(text);
    if (sig === tried || (!stale && sig === c.sig && !names.some(n => !heroOf(n)))) return;
    tried = sig;
    try { await fameCollect(); } catch (e) { console.warn('[Life] кого как узнают', e); }
}

// ───────────── правка ─────────────

const yr = (v) => (num(v) == null ? '' : String(num(v)));

function eraRow(name, r, k, now) {
    const n = esc(name);
    return `<div class="lf-hero-era${now ? ' now' : ''}">
        <div class="lf-hero-yr">
            <input type="number" inputmode="numeric" data-in="hero-f" data-name="${n}" data-k="${k}" data-f="from" value="${esc(yr(r.from))}" placeholder="с">
            <i>–</i>
            <input type="number" inputmode="numeric" data-in="hero-f" data-name="${n}" data-k="${k}" data-f="to" value="${esc(yr(r.to))}" placeholder="по">
            <select data-in="hero-f" data-name="${n}" data-k="${k}" data-f="status"><option value="">статус —</option>${Object.entries(STATUS).map(([v, t]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
            ${now ? '<b class="lf-hero-now">сейчас</b>' : ''}
            <button class="lf-iconbtn sm" data-act="hero-del" data-name="${n}" data-k="${k}" title="Убрать период">${A.icon('x')}</button>
        </div>
        <input type="text" data-in="hero-f" data-name="${n}" data-k="${k}" data-f="plain" value="${esc(r.plain || '')}" placeholder="в жизни: как узнают (пусто — не узнают)">
        <input type="text" data-in="hero-f" data-name="${n}" data-k="${k}" data-f="suit" value="${esc(r.suit || '')}" placeholder="в костюме / геройском образе (если есть)">
        <input type="text" data-in="hero-f" data-name="${n}" data-k="${k}" data-f="law" value="${esc(r.law || '')}" placeholder="закон: договор, розыск, помилование (если есть)">
    </div>`;
}

function personHtml(name, y) {
    const h = heroOf(name) || { alias: '', eras: [] };
    const cur = rowFor(h, y);
    return `<div class="lf-hero-p">
        <div class="lf-hero-h">${A.ava(name, 'sm')}<b>${esc(A.shortName(name))}</b>
            <input type="text" data-in="hero-alias" data-name="${esc(name)}" value="${esc(h.alias || '')}" placeholder="геройское имя">
            ${h.hand ? '<small>правлено</small>' : h.legacy ? '<small>старое, на все годы</small>' : ''}</div>
        ${(h.eras || []).map((r, k) => eraRow(name, r, k, r === cur)).join('') || '<div class="lf-dim">Не узнают никогда — или собери из лора.</div>'}
        <button class="lf-link" data-act="hero-add" data-name="${esc(name)}">${A.icon('plus')} период</button>
    </div>`;
}

let extra = '';
/** Лист «Кого как узнают — по годам». tail — что добавить снизу (переключатель Массовки). */
export function fameSheet(tail = extra) {
    extra = tail;
    let y = null;
    try { y = storyYear(); } catch { /* */ }
    const names = heroRoster();
    A.openSheet(`${A.icon('users')} Кого как узнают — по годам`, `
        <div class="lf-hint">${y ? `В истории сейчас ${y}-й — подсвечен период, который идёт в Массовку и СМИ.` : 'Год истории не записан — берётся период без годов.'} Пусто «в жизни» — не узнают. Тайну личности сюда не пиши — это то, что знает публика.</div>
        ${names.map(n => personHtml(n, y)).join('')}
        <div class="lf-actions"><button class="lf-btn" data-act="hero-collect">${A.icon('book')} ${Object.keys(cfg().list).length ? 'Собрать заново из лора' : 'Собрать из лора'}</button></div>
        <div class="lf-hint">Из карточек, лорбуков и канона: годы, маски, «гибели» и возвращения. Кого правила руками — не трогаю.</div>
        ${tail}`);
}

function rowsOf(name, make = false) {
    const c = cfg();
    let k = keyOf(c, name);
    if (!k) { if (!make) return null; k = A.canonName(name) || name; c.list[k] = { alias: '', eras: [] }; }
    const h = c.list[k];
    if (!Array.isArray(h.eras)) h.eras = [];
    return h;
}

export function heroInput(el) {
    const f = el.dataset.in;
    if (f !== 'hero-f' && f !== 'hero-alias') return false;
    const h = rowsOf(el.dataset.name, true);
    if (f === 'hero-alias') h.alias = str(el.value).slice(0, 40);
    else {
        const r = h.eras[Number(el.dataset.k)];
        if (!r) return true;
        const k = el.dataset.f;
        r[k] = k === 'from' || k === 'to' ? (num(el.value) ?? '') : str(el.value).slice(0, k === 'law' ? 140 : 220);
    }
    h.hand = true;
    delete h.legacy;
    A.saveSettings();
    try { A.updatePrompt(); } catch { /* */ }
    return true;
}

export async function heroClick(act, el) {
    if (!act.startsWith('hero-')) return false;
    if (act === 'hero-fame') { fameSheet(''); return true; }
    if (act === 'hero-add') {
        const h = rowsOf(el.dataset.name, true);
        const last = h.eras[h.eras.length - 1];
        let y = null;
        try { y = storyYear(); } catch { /* */ }
        h.eras.push({ from: last ? (num(last.to) != null ? num(last.to) + 1 : '') : (y || ''), to: '', plain: '', suit: '', status: '' });
        h.hand = true;
        delete h.legacy;
        A.saveSettings();
        fameSheet();
        return true;
    }
    if (act === 'hero-del') {
        const h = rowsOf(el.dataset.name);
        if (!h) return true;
        h.eras.splice(Number(el.dataset.k), 1);
        h.hand = true;
        delete h.legacy;
        A.saveSettings();
        try { A.updatePrompt(); } catch { /* */ }
        fameSheet();
        return true;
    }
    if (act === 'hero-collect') {
        await A.withBusy(el, async () => {
            const n = await fameCollect();
            A.toast('success', n ? `Собрала по годам: ${n}` : 'Все, кого нашла, правлены руками — не трогала', '✦ Кого как узнают', { timeOut: 2400 });
            fameSheet();
        }, 'Читаю лор…');
        return true;
    }
    return false;
}
