// Звонок как FaceTime. Летописец замечает разговор по телефону или по видео между людьми в разных местах —
// и пост, где звонок начался, открывается сплит-скрином: два окошка рядом (кто и где), время разговора,
// кнопки как на айфоне. Дальше, пока звонок идёт, у постов — зелёная плашка «в звонке · 03:12»,
// в конце — «звонок завершён». Время — по длине реплик, как если бы их сказали вслух.
// Модели, пока звонок идёт: они не рядом — не касаются, видят только то, что в камере (или слышат только голос).

import { knockActive } from './knock.js';
import { quotesOf } from './voice.js';

let A = null;
export function initCall(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const yes = (v) => v === true || v === 'true';

function cfg() {
    const s = A.settings();
    if (!s.call || typeof s.call !== 'object') s.call = {};
    if (s.call.on === undefined) s.call.on = true;
    return s.call;
}
export const callOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

const same = (x, y) => !!x && !!y && ((A.sameName(x.a, y.a) && A.sameName(x.b, y.b)) || (A.sameName(x.a, y.b) && A.sameName(x.b, y.a)));

/** Звонок «Стука», пока Летописец не разобрал пост: он позвонил — значит, звонок. */
function provisional(i) {
    let k = null;
    try { k = knockActive(); } catch { /* */ }
    const m = A.chatArr()[i];
    if (!k || k.how !== 'call' || !k.used || !m || m.is_user || i <= (k.at ?? -1) || !A.sameName(m.name, k.who)) return null;
    return { a: A.canonName(k.who), b: A.canonName(A.ctx().name1), video: false, aWhere: '', bWhere: '', end: false, prov: true };
}

let ver = 0;       // растёт, когда Летописец отметил звонок, — пересчитать
let memo = null;

/**
 * Один проход по последним постам: что показать у каждого ({ c, kind, dur }) и какой звонок идёт после него.
 * Пост, который Летописец не видел, ничего не решает — смотрим дальше; ответ без звонка — звонок кончился.
 */
function scan() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    let k = null;
    try { k = knockActive(); } catch { /* */ }
    const sig = `${chat.length}|${last?.mes?.length}|${last?.swipe_id}|${ver}|${k ? `${k.who}|${k.at}|${k.used}` : ''}`;
    if (memo && memo.chat === chat && memo.sig === sig && Date.now() - memo.at < 250) return memo;
    const show = new Map();
    const after = new Map(); // i → звонок, идущий после поста i
    let cur = null;
    let acc = 0;
    for (let i = Math.max(0, chat.length - 220); i < chat.length; i++) {
        const m = chat[i];
        if (!m || m.is_system) { after.set(i, cur); continue; }
        if (m.is_user) {
            if (cur) { acc += secsOf(m); show.set(i, { c: cur, kind: 'on', dur: acc }); }
            after.set(i, cur);
            continue;
        }
        const e = A.chronOf(i);
        const c = e ? (e.call || null) : provisional(i);
        if (!e && !c) { after.set(i, cur); continue; }
        if (!c) { cur = null; acc = 0; after.set(i, cur); continue; }
        const cont = !!cur && same(cur, c);
        if (!cont) acc = 0;
        acc += secsOf(m);
        const start = cont ? cur.start : i;
        show.set(i, { c, kind: cont ? (c.end ? 'end' : 'on') : 'start', dur: acc });
        cur = c.end ? null : { ...c, start };
        if (!cur) acc = 0;
        after.set(i, cur);
    }
    memo = { chat, sig, at: Date.now(), show, after, len: chat.length };
    return memo;
}

/** Звонок, который идёт к посту t (до него): { ...call, start } или null. */
export function callNow(t = A.chatArr().length) {
    const s = scan();
    for (let j = Math.min(t, s.len) - 1; j >= 0; j--) if (s.after.has(j)) return s.after.get(j) || null;
    return null;
}

// ───────────── Летописец ─────────────

const RULE = `
call — звонок в этом посте: разговор по телефону или по видео между людьми в РАЗНЫХ местах (не переписка, не голосовое, не разговор вживую). {"a":"кто звонит (или кто первый в звонке) — имя","b":"с кем говорит — имя","video":true если видят друг друга (FaceTime, камера),"aWhere":"где a, 1–4 слова","bWhere":"где b, 1–4 слова","end":true если в этом посте звонок закончился}. Шёл до поста — те же a и b. Звонка нет — null.`;

export function callChron(i) {
    if (!A?.hasChat?.() || !callOn()) return null;
    const c = callNow(i);
    return { key: '"call": null', rule: RULE, tokens: 70, input: `Звонок до этого поста: ${c ? `${c.a}${c.aWhere ? ` (${c.aWhere})` : ''} ↔ ${c.b}${c.bWhere ? ` (${c.bWhere})` : ''}${c.video ? ', по видео' : ''}` : 'нет'}` };
}

export function callAfterPost(i, j) {
    if (!callOn()) return;
    const e = A.chronOf(i);
    if (!e) return;
    const c = j?.call;
    const a = A.canonName(str(c?.a));
    const b = A.canonName(str(c?.b));
    if (!c || typeof c !== 'object' || !a || !b || A.sameName(a, b)) { if (e.call) { delete e.call; ver++; A.saveMeta(); } return; }
    e.call = { a, b, video: yes(c.video), aWhere: str(c.aWhere).slice(0, 40), bWhere: str(c.bWhere).slice(0, 40), end: yes(c.end) };
    ver++;
    A.saveMeta();
}

// ───────────── заметка модели ─────────────

export function callPrompt(type) {
    if (!A?.hasChat?.() || !callOn() || type === 'quiet' || type === 'impersonate') return '';
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const t = type === 'swipe' && last && !last.is_user ? chat.length - 1 : chat.length;
    const c = callNow(t);
    if (!c) return '';
    const sh = (n) => A.shortName(A.canonName(n));
    return `[Идёт звонок${c.video ? ' по видео' : ''}: ${sh(c.a)}${c.aWhere ? ` (${c.aWhere})` : ''} ↔ ${sh(c.b)}${c.bWhere ? ` (${c.bWhere})` : ''}. Они не рядом: не касаются друг друга и ничего не передают из рук в руки; ${c.video ? 'видят только то, что попадает в камеру (лицо, плечо, кусок комнаты за спиной, свет), картинка может подвиснуть' : 'слышат только голос и фон — дыхание, паузы, шум вокруг'}. Пока никто не положил трубку, разговор продолжается; приехать друг к другу — только дорогой, без телепорта.]`;
}

// ───────────── время разговора ─────────────

const durMemo = new WeakMap();
/** Секунды разговора в посте: реплики вслух (≈2,3 слова в секунду) и паузы. */
function secsOf(m) {
    const was = durMemo.get(m);
    if (was && was.mes === m.mes) return was.s;
    let words = 0;
    try { for (const q of quotesOf(m.mes)) words += String(q).split(/\s+/).filter(Boolean).length; } catch { /* */ }
    const s = Math.round(words / 2.3) + 6;
    durMemo.set(m, { mes: m.mes, s });
    return s;
}
export function fmtDur(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${String(mm).padStart(2, '0')}:${ss}`;
}

// ───────────── в чате ─────────────

/** Что показать у поста i: { c, kind: 'start' | 'on' | 'end', dur } или null. */
export function callAt(i) { return scan().show.get(i) || null; }

function faceSrc(i, who) {
    let src = '';
    try { src = A.emoSrc?.(i, who) || ''; } catch { /* */ }
    return src || A.avatarUrl(who, true) || A.avatarUrl(who) || '';
}

function tile(i, who, where, video, me) {
    const src = faceSrc(i, who);
    const letter = esc(String(who || '?').trim().charAt(0).toUpperCase());
    const face = video
        ? (src ? `<img class="lf-ft-v" src="${esc(src)}" alt="" loading="lazy">` : `<i class="lf-ft-l">${letter}</i>`)
        : `${src ? `<span class="lf-ft-blur" style="background-image:url('${esc(src)}')"></span><img class="lf-ft-round" src="${esc(src)}" alt="" loading="lazy">` : `<i class="lf-ft-l">${letter}</i>`}`;
    return `<div class="lf-ft-tile${me ? ' me' : ''}">${face}<div class="lf-ft-cap"><b>${esc(A.shortName(who))}</b>${where ? `<small>${A.icon('pin')}${esc(where)}</small>` : ''}</div></div>`;
}

export function callCardHtml(i, x) {
    const { c } = x;
    const U = A.ctx().name1;
    // слева — тот, кто на другом конце, справа — ты (как на айфоне: своё окошко — второе)
    let L = c.a; let R = c.b; let Lw = c.aWhere; let Rw = c.bWhere;
    if (A.sameName(c.a, U)) { L = c.b; R = c.a; Lw = c.bWhere; Rw = c.aWhere; }
    const ended = c.end;
    return `<div class="lf-ft ${c.video ? 'video' : 'audio'}${ended ? ' ended' : ''}">
        <div class="lf-ft-top"><span class="lf-ft-app">${A.icon(c.video ? 'video' : 'phone')}FaceTime${c.video ? '' : ' Audio'}</span><span class="lf-ft-t">${ended ? 'завершён · ' : ''}${fmtDur(x.dur)}</span></div>
        <div class="lf-ft-split">${tile(i, L, Lw, c.video, false)}${tile(i, R, Rw, c.video, A.sameName(R, U))}</div>
        <div class="lf-ft-ctl"><span>${A.icon('mic')}</span><span>${A.icon(c.video ? 'video' : 'volume')}</span><span class="end">${A.icon('phone')}</span></div>
    </div>`;
}

function pillHtml(x) {
    const U = A.ctx().name1;
    const { c } = x;
    const other = A.sameName(c.a, U) ? c.b : A.sameName(c.b, U) ? c.a : '';
    const who = other ? A.shortName(other) : `${A.shortName(c.a)} ↔ ${A.shortName(c.b)}`;
    return `<div class="lf-ft-pill${x.kind === 'end' ? ' end' : ''}">${A.icon(c.video ? 'video' : 'phone')}<span>${x.kind === 'end' ? 'звонок завершён' : 'в звонке'} · ${esc(who)}</span><b>${fmtDur(x.dur)}</b></div>`;
}

/** Сплит-скрин в начале звонка, плашка — пока идёт. Вызывается на каждый пост. */
export function paintCall(el, id) {
    const host = el.querySelector('.mes_block') || el;
    const old = host.querySelector(':scope > .lf-ft, :scope > .lf-ft-pill');
    const x = callOn() ? callAt(id) : null;
    if (!x) { old?.remove(); return; }
    const html = x.kind === 'start' ? callCardHtml(id, x) : pillHtml(x);
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.before(node); else host.prepend(node);
}

// ───────────── настройка ─────────────

export function callCfgHtml() {
    const on = cfg().on !== false;
    return `<label class="lf-switch"><input type="checkbox" data-set="call.on" ${on ? 'checked' : ''}><span></span>Звонок как FaceTime: сплит-скрин в начале звонка, плашка «в звонке» дальше</label>`;
}
