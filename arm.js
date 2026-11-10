// Рука. У кого протез (по карточке и «неизменному» ляп-фикса: «металлическая / бионическая рука», «протез руки» —
// или отмечено руками в настройках) — его состояние отдельным трекером: на нём / снят (где лежит) / повреждён /
// барахлит / на обслуживании (где, у кого). Летописец отмечает по тексту поста, снять и надеть — тапом в Сцене.
// Модель знает, что с рукой сейчас (протеза нет — никаких металлических пальцев, всё одной рукой), ляп-фикс
// сверяет с этим, на кадрах он без руки. Лор в коде не живёт: кто с протезом — из карточек.

import { cardText } from './lore.js';

let A = null;
export function initArm(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');

export const ARM_ST = {
    on: { t: 'на нём', ic: 'check', ask: 'надет, работает' },
    off: { t: 'снят', ic: 'box', ask: 'снят' },
    broken: { t: 'повреждён', ic: 'triangle', ask: 'повреждён' },
    glitch: { t: 'барахлит', ic: 'zap', ask: 'барахлит' },
    service: { t: 'на обслуживании', ic: 'wrench', ask: 'на обслуживании' },
};
const SIDE = { left: ['левой', 'слева', 'left'], right: ['правой', 'справа', 'right'] };

function cfg() {
    const s = A.settings();
    if (!s.arm || typeof s.arm !== 'object') s.arm = {};
    const c = s.arm;
    if (c.on === undefined) c.on = true;
    if (!c.cards || typeof c.cards !== 'object') c.cards = {};
    return c;
}
export const armOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.arm || typeof cm.arm !== 'object') cm.arm = {};
    if (!Array.isArray(cm.arm.hand)) cm.arm.hand = [];
    return cm.arm;
}

// ───────────── у кого протез ─────────────

const ARM_RE = /(?:металлическ|бионическ|кибернетическ|механическ|вибраниумов|стальн|роботизированн)[а-яё]*\s+(?:(?:лев|прав)[а-яё]*\s+)?рук|протез[а-яё]*\s+(?:(?:лев|прав)[а-яё]*\s+)?рук|рук[а-яё]*[\s-]+протез|(?:metal(?:lic)?|bionic|cybernetic|vibranium|prosthetic)\s+(?:(?:left|right)\s+)?arm/i;

/** Протез руки по карточке и «неизменному» ляп-фикса: { what, side } или null. */
export function armDetect(text) {
    const t = String(text || '');
    const m = t.match(ARM_RE);
    if (!m) return null;
    const win = t.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50);
    const side = /лев|left/i.test(m[0]) ? 'left' : /прав|right/i.test(m[0]) ? 'right' : /лев[а-яё]*\s+(?:плеч|рук|сторон)|left (?:arm|shoulder)/i.test(win) ? 'left' : /прав[а-яё]*\s+(?:плеч|рук|сторон)|right (?:arm|shoulder)/i.test(win) ? 'right' : '';
    const what = /вибраниум|vibranium/i.test(win) ? 'вибраниумовый протез' : /бионич|bionic/i.test(win) ? 'бионическая рука' : /металл|стальн|metal/i.test(win) ? 'металлическая рука' : 'протез руки';
    return { what, side };
}

const keyOf = (who) => { const ch = A.cardOf?.(who); return ch?.avatar ? `card:${ch.avatar}` : `name:${A.norm(A.canonName(who))}`; };
const auto = new Map();

/** Протез этого человека ({ what, side }) или null. Руками отмеченное — главнее карточки. */
export function armInfo(who) {
    if (!who) return null;
    const k = keyOf(who);
    const h = cfg().cards[k];
    if (h?.hand) return h.has ? { what: h.what || 'протез руки', side: h.side || '' } : null;
    let a = auto.get(k);
    if (!a || Date.now() - a.at > 60000) {
        const facts = Object.entries(A.settings().slip?.facts || {}).find(([n]) => A.sameName(n, who))?.[1] || '';
        a = { at: Date.now(), d: armDetect(`${cardText(who, 9000)}\n${facts}`) };
        auto.set(k, a);
    }
    return a.d;
}

function roster() {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    try { add(A.ctx().name1); } catch { /* */ }
    try { for (const n of A.groupMembers()) add(n); } catch { /* */ }
    return out;
}
export const armOwners = () => (armOn() ? roster().filter(n => armInfo(n)) : []);

// ───────────── что с рукой (по постам) ─────────────

let ver = 0;
let memo = null;

function scan() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const sig = `${chat.length}|${last?.mes?.length}|${last?.swipe_id}|${ver}|${M().hand.length}`;
    if (memo && memo.chat === chat && memo.sig === sig && Date.now() - memo.at < 400) return memo;
    const ev = [];
    for (let i = 0; i < chat.length; i++) {   // весь чат: ключ поста теперь помнится, проход дешёвый
        const m = chat[i];
        if (!m || m.is_user) continue;
        const e = A.chronOf(i);
        for (const x of Array.isArray(e?.arm) ? e.arm : []) ev.push({ ...x, mes: i, src: 'ai' });
    }
    for (const h of M().hand) if (h.mes < chat.length) ev.push({ ...h, src: 'hand' });
    ev.sort((a, b) => a.mes - b.mes || (a.src === 'hand' ? 1 : 0) - (b.src === 'hand' ? 1 : 0));
    memo = { chat, sig, at: Date.now(), ev };
    return memo;
}

/** Что с протезом к посту t (до него): { st, where, note, mes, src }. */
export function armAt(who, t = A.chatArr().length) {
    let s = { st: 'on', where: '', note: '', mes: -1, src: '' };
    for (const x of scan().ev) { if (x.mes >= t) break; if (A.sameName(x.who, who)) s = x; }
    return s;
}

/** Последние перемены (для истории в карточке). */
function armLog(who, n = 5) { return scan().ev.filter(x => A.sameName(x.who, who)).slice(-n).reverse(); }

const stText = (s) => [ARM_ST[s.st]?.t || 'на нём', s.st === 'off' || s.st === 'service' ? (s.where ? `— ${s.where}` : '') : (s.note ? `— ${s.note}` : '')].filter(Boolean).join(' ');

/** Для ляп-фикса: что с протезом до поста i ('' — всё как обычно). */
export function armFact(who, i) {
    if (!armOn() || !armInfo(who)) return '';
    const s = armAt(who, i);
    if (s.st === 'on') return '';
    const inf = armInfo(who);
    const sd = SIDE[inf.side]?.[0] || '';
    return s.st === 'off' || s.st === 'service'
        ? `протез ${stText(s)}: сейчас он без ${sd ? `${sd} ` : ''}руки — металлических пальцев и звона нет`
        : `протез ${stText(s)}`;
}

// ───────────── модели ─────────────

function line(who, s) {
    const inf = armInfo(who) || { what: 'протез', side: '' };
    const sh = A.shortName(who);
    const sd = SIDE[inf.side]?.[0] || '';
    const without = `он без ${sd ? `${sd} ` : ''}руки — культя у плеча; всё одной рукой: одевается, держит, обнимает, дерётся. Никаких металлических пальцев, звона, холода металла`;
    if (s.st === 'off') return `[Рука ${sh}: ${inf.what} снят${s.where ? ` — лежит: ${s.where}` : ''}. Сейчас ${without}, пока не наденет — надеть можно только действием в тексте.]`;
    if (s.st === 'service') return `[Рука ${sh}: ${inf.what} на обслуживании${s.where ? ` — ${s.where}` : ''}; его нет, ${without}.]`;
    if (s.st === 'broken') return `[Рука ${sh}: ${inf.what} повреждён${s.note ? ` — ${s.note}` : ''}. Слушается плохо: хват слабый, пальцы заедают, в месте крепления ноет; он злится или скрывает. Пока не починят — так.]`;
    if (s.st === 'glitch') return `[Рука ${sh}: ${inf.what} барахлит${s.note ? ` — ${s.note}` : ''}: иногда дёргается, не слушается, щёлкает, сжимается сам — одна такая деталь за пост, к месту, не каждый раз.]`;
    return '';
}

export function armPrompt(type) {
    if (!armOn() || !A?.hasChat?.() || type === 'quiet' || type === 'impersonate') return '';
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const t = type === 'swipe' && last && !last.is_user ? chat.length - 1 : chat.length;
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    return armOwners().filter(n => !here.length || here.some(h => A.sameName(h, n))).map(n => line(n, armAt(n, t))).filter(Boolean).join('\n');
}

/** Для кадров: кто в кадре без руки или с разбитой. */
export function armNote(names = []) {
    if (!armOn() || !names?.length) return '';
    const out = [];
    for (const n of names) {
        const inf = armInfo(n);
        if (!inf) continue;
        const s = armAt(n);
        const sh = A.shortName(A.canonName(n));
        const sd = SIDE[inf.side]?.[2] || '';
        if (s.st === 'off' || s.st === 'service') out.push(`${sh}'s prosthetic ${sd ? `${sd} ` : ''}arm is removed right now — show him without it: the ${sd ? `${sd} ` : ''}arm ends in a scarred stump at the shoulder, no metal arm on him`);
        else if (s.st === 'broken') out.push(`${sh}'s metal ${sd ? `${sd} ` : ''}arm is damaged: dented, scratched plates, a gap with exposed wiring`);
    }
    return out.length ? `Body continuity: ${out.join('; ')}.` : '';
}

// ───────────── Летописец ─────────────

const RULE = (who) => `
arm — протез руки (${who}): только если в ЭТОМ посте его сняли, надели, повредили, он начал барахлить или его отдали на обслуживание / забрали оттуда — [{"who":"имя","st":"on|off|broken|glitch|service","where":"где лежит или у кого — для off и service, 1–5 слов","note":"что с ним — для broken и glitch, 2–8 слов"}]; надели обратно или починили — "st":"on". Ничего с протезом не случилось (просто был на нём) — [].`;

export function armChron(i) {
    if (!armOn() || !A?.hasChat?.() || !Number.isFinite(i)) return null;
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const list = armOwners().filter(n => !here.length || here.some(h => A.sameName(h, n)));
    if (!list.length) return null;
    const now = list.map(n => { const inf = armInfo(n); return `${n} — ${inf.what}${inf.side ? ` (${SIDE[inf.side][1]})` : ''}: ${stText(armAt(n, i))}`; }).join('; ');
    return { key: '"arm": []', rule: RULE(list.map(n => A.shortName(n)).join(', ')), input: `Протез до этого поста: ${now}`, tokens: 70 };
}

export function armAfterPost(i, j) {
    if (!armOn()) return;
    const e = A.chronOf(i);
    if (!e) return;
    const raw = Array.isArray(j?.arm) ? j.arm : j?.arm && typeof j.arm === 'object' ? [j.arm] : [];
    const owners = armOwners();
    const out = raw.map(x => {
        const who = owners.find(n => A.sameName(n, A.canonName(str(x?.who))));
        const st = ARM_ST[str(x?.st)] ? str(x.st) : '';
        return who && st ? { who, st, where: st === 'off' || st === 'service' ? str(x.where).slice(0, 60) : '', note: st === 'broken' || st === 'glitch' ? str(x.note).slice(0, 80) : '' } : null;
    }).filter(Boolean);
    const had = !!e.arm;
    if (out.length) e.arm = out; else delete e.arm;
    if (had || out.length) { ver++; A.saveMeta(); }
}

/** «Что записал пост»: перемены протеза — с ✕. */
export function armRecs(i) {
    const e = A.chronOf(i);
    return (Array.isArray(e?.arm) ? e.arm : []).map((x) => ({ id: `arm:${x.who}:${x.st}`, g: 'Раны', icon: ARM_ST[x.st]?.ic || 'zap', t: `${A.shortName(x.who)}: протез ${stText(x)}`, del: () => { e.arm = e.arm.filter(y => y !== x); if (!e.arm.length) delete e.arm; ver++; } }));
}

// ───────────── на экране ─────────────

const FIG = `<svg viewBox="0 0 64 64" class="lf-arm-svg" aria-hidden="true">
    <defs><linearGradient id="lf-arm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef2f6"/><stop offset=".45" stop-color="#a7b2bd"/><stop offset="1" stop-color="#56616d"/></linearGradient></defs>
    <g class="lf-arm-b">
        <path class="lf-arm-p" d="M6.5 15.5 Q15 5 27 10.5 L24.5 20 Q16 23.5 9.5 20.5 Z"/>
        <path class="lf-arm-p" d="M21.2 16.2 L30.2 42.4 A6 6 0 0 1 18.8 46.4 L9.8 20.2 A6 6 0 0 1 21.2 16.2 Z"/>
        <path class="lf-arm-p" d="M27.3 48.2 L49.3 30.2 A5 5 0 0 0 42.9 22.4 L20.9 40.4 A5 5 0 0 0 27.3 48.2 Z"/>
        <circle class="lf-arm-p" cx="24.2" cy="44.4" r="5.6"/>
        <rect class="lf-arm-p" x="42.5" y="10.5" width="14" height="13" rx="4.2" transform="rotate(-36 49.5 17)"/>
        <circle class="lf-arm-p" cx="44.6" cy="21.4" r="3"/>
        <path class="lf-arm-l" d="M12.6 28.6 L24 24.7 M14.9 35.3 L26.3 31.4 M16.7 40.3 L27.7 36.5 M27.6 34.9 L34 42.7 M33.1 30.4 L39.5 38.2 M38.6 25.9 L45 33.7 M45.7 13.6 L52.4 22.6 M48.6 11.3 L54.8 19.8 M51.3 9.6 L56.6 17.2"/>
        <circle class="lf-arm-j" cx="24.2" cy="44.4" r="1.6"/>
    </g>
    <path class="lf-arm-crack" d="M15.5 23 l2.6 3.4 -1.8 2.4 2.6 3.4 -1.4 2.2 M32.6 37.2 l1.6 2.6 -2 1.4 1.8 2.6"/>
    <g class="lf-arm-spark"><path d="M41 29.5 l-3.6 2.4"/><path d="M44.4 30.6 l1 4.2"/><path d="M40.2 26.2 l-4.2 -.6"/></g>
</svg>`;

/** Значок руки (для кукольного домика: протез лежит в комнате). */
export const armFig = () => FIG;

function cardHtml(who, { full = false } = {}) {
    const inf = armInfo(who);
    if (!inf) return '';
    const s = armAt(who);
    const n = esc(who);
    const loc = A.worldState().scene?.location || '';
    const room = loc ? A.locLeaf(loc) : '';
    const btn = (st, label, cls = '') => `<button class="lf-chip${cls ? ` ${cls}` : ''}" data-act="arm-set" data-name="${n}" data-st="${st}">${A.icon(ARM_ST[st].ic)} ${label}</button>`;
    const acts = s.st === 'on'
        ? `${btn('off', 'Снять')}${btn('glitch', 'Барахлит')}${btn('broken', 'Повреждён')}${btn('service', 'На обслуживание')}`
        : s.st === 'off' || s.st === 'service'
            ? `${btn('on', 'Надеть', 'on')}${s.st === 'off' ? btn('service', 'На обслуживание') : btn('off', 'Забрали — лежит')}`
            : `${btn('on', 'Починили', 'on')}${btn('off', 'Снять')}${s.st === 'glitch' ? btn('broken', 'Повреждён') : btn('service', 'На обслуживание')}`;
    const log = full ? armLog(who) : [];
    return `<section class="lf-arm st-${s.st}">
        <div class="lf-arm-fig">${FIG}${s.st === 'service' ? `<i class="lf-arm-badge">${A.icon('wrench')}</i>` : s.st === 'off' ? `<i class="lf-arm-badge">${A.icon('box')}</i>` : ''}</div>
        <div class="lf-arm-t"><small>${esc(A.cap(inf.what))}${inf.side ? ` · ${SIDE[inf.side][1]}` : ''}</small><b>${esc(ARM_ST[s.st].t)}</b>${s.st === 'off' || s.st === 'service' ? `<em>${s.where ? esc(s.where) : 'где — не сказано'}</em>` : s.note ? `<em>${esc(s.note)}</em>` : ''}${s.src ? `<span class="lf-arm-src">${s.src === 'hand' ? 'отмечено тобой' : `по посту #${s.mes}`}</span>` : ''}</div>
        <div class="lf-arm-acts"><div class="lf-chips wrap">${acts}</div>
            <input type="text" class="lf-arm-in" data-name="${n}" placeholder="${s.st === 'on' ? `снял — где оставил${room ? ` (иначе: ${esc(room)})` : ''}; барахлит — что с ним` : s.st === 'off' || s.st === 'service' ? 'где лежит / у кого — для кнопки справа' : 'что с ним (необязательно)'}"></div>
        ${log.length ? `<div class="lf-arm-log">${log.map(x => `<span>${A.icon(ARM_ST[x.st]?.ic || 'zap')} ${esc(stText(x))}<small>${x.src === 'hand' ? 'тапом' : `#${x.mes}`}</small></span>`).join('')}</div>` : ''}
    </section>`;
}

/** Сцена: у кого из тех, кто здесь, протез. */
export function armSceneHtml() {
    if (!armOn() || !A?.hasChat?.()) return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const list = armOwners().filter(n => !here.length || here.some(h => A.sameName(h, n)));
    if (!list.length) return '';
    return `${A.sec(list.length > 1 ? 'Протезы' : `Рука ${esc(A.shortName(list[0]))}`, 'модель знает, что с ней сейчас')}${list.map(n => cardHtml(n)).join('')}`;
}

/** Персонаж → Внутри: карточка протеза с историей. */
export function armSection(who) {
    if (!armOn() || !armInfo(who)) return '';
    return `${A.sec('Протез', 'что с ним сейчас')}${cardHtml(who, { full: true })}`;
}

/** Настройки: у кого протез. */
export function armCfgHtml() {
    const c = cfg();
    const names = roster();
    return `<label class="lf-switch"><input type="checkbox" data-act="arm-on" ${armOn() ? 'checked' : ''}><span></span>Протезы: что с рукой сейчас (снята, барахлит…) — модель знает</label>
    ${armOn() ? `<div class="lf-chips wrap">${names.map(n => { const on = !!armInfo(n); const hand = !!c.cards[keyOf(n)]?.hand; return `<button class="lf-chip${on ? ' on' : ''}" data-act="arm-who" data-name="${esc(n)}" title="${hand ? 'отмечено руками' : 'по карточке'}">${A.icon(on ? 'check' : 'plus')} ${esc(A.shortName(n))}${hand ? ' ·' : ''}</button>`; }).join('')}</div>
    <div class="lf-hint">У кого протез — видно по карточке («металлическая рука», «протез руки»); тап — отметить или снять руками.</div>` : ''}`;
}

export async function armClick(act, el) {
    if (!act.startsWith('arm-')) return false;
    if (act === 'arm-on') { cfg().on = !!el.checked; A.saveSettings(); A.updatePrompt?.(); A.render?.(); return true; }
    if (act === 'arm-who') {
        const who = el.dataset.name;
        const c = cfg();
        const k = keyOf(who);
        const has = !armInfo(who);
        const d = armDetect(cardText(who, 9000));
        c.cards[k] = { hand: true, has, what: d?.what || 'металлическая рука', side: d?.side || 'left' };
        auto.delete(k);
        A.saveSettings();
        A.updatePrompt?.();
        A.render?.();
        return true;
    }
    if (act === 'arm-set') {
        const who = A.canonName(el.dataset.name);
        const st = ARM_ST[el.dataset.st] ? el.dataset.st : 'on';
        const box = el.closest('.lf-arm');
        const typed = str(box?.querySelector('.lf-arm-in')?.value);
        const loc = A.worldState().scene?.location || '';
        const prev = armAt(who);
        const where = st === 'off' ? (typed || (prev.st === 'service' ? '' : (loc ? A.locLeaf(loc) : ''))) : st === 'service' ? (typed || '') : '';
        const note = st === 'broken' || st === 'glitch' ? typed : '';
        const h = M().hand;
        h.push({ who, st, where, note, mes: A.chatArr().length - 1, at: Date.now() });
        if (h.length > 30) h.splice(0, h.length - 30);
        ver++;
        A.saveMeta();
        A.updatePrompt?.();
        A.toast?.('info', `${A.shortName(who)}: протез — ${ARM_ST[st].t}${where ? `, ${where}` : ''}. Модель узнает в следующем ответе.`, '🦾 Рука', { timeOut: 2200 });
        A.render?.();
        return true;
    }
    return false;
}
