// «Кто ответит?» Долгий тап по «Отправить» — над кнопкой лица группы: тап — твой пост уходит и отвечает он (как
// «говорить» в списке группы таверны, только под пальцем). Там же второй голос на этот ответ (пост на двоих), Рассказчик
// и «Тем временем» для тех, кого нет в сцене. У её групп ручной режим ответа: пустая отправка звала случайного из всей
// группы (Вальдена в спальню) — теперь отвечает тот, кто в сцене. По желанию и отправка с текстом сразу зовёт ответ
// из сцены. В пульте — ряд лиц группы: тап — ответит сейчас, удержать — молчит (мьют, как в списке группы ST).
// Идея — Immersion Director (moonnsy): быстрая панель на долгий тап и панель группы.

import { cutStart, chidOf } from './cut.js';
import { wallsPicked } from './walls.js';
import { duoClick, duoPin } from './duo.js';

let A = null;
const LP_MS = 480;
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
let lp = null;            // долгий тап: { x, y, timer, fired, kind, el }
let suppressUntil = 0;    // клик сразу после долгого тапа — не отправлять

const DEF = { on: true, empty: true, scene: false };
export function pickCfg() {
    const s = A.settings();
    if (!s.pick || typeof s.pick !== 'object') s.pick = {};
    const c = s.pick;
    for (const [k, v] of Object.entries(DEF)) if (c[k] === undefined) c[k] = v;
    return c;
}

const esc = (v) => A.esc(v);
const ready = () => !!A && A.settings().enabled !== false && !!A.hasChat?.() && !!A.ctx().groupId;

export function initPick(api) {
    A = api;
    try {
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', cancel, true);
        document.addEventListener('click', onClick, true);
        document.addEventListener('contextmenu', (e) => { if (e.target?.closest?.('#send_but, #lf-cc [data-grp-face]') && ready()) e.preventDefault(); }, true);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        window.addEventListener('resize', () => close());
        const { eventSource, eventTypes: E } = A.ctx();
        if (E?.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, () => close());
        if (E?.GENERATION_STARTED) eventSource.on(E.GENERATION_STARTED, () => close());
    } catch (e) { console.warn('[Life] кто ответит: события', e); }
}

// ───────────── кто есть в группе ─────────────

/** Участники группы: [{ name, chid, avatar, muted, narr }]. */
function members() {
    const c = A.ctx();
    const g = (c.groups || []).find(x => x.id === c.groupId);
    if (!g) return [];
    const off = Array.isArray(g.disabled_members) ? g.disabled_members : [];
    const U = c.name1;
    const out = [];
    for (const av of g.members || []) {
        const chid = (c.characters || []).findIndex(x => x.avatar === av);
        const name = chid >= 0 ? c.characters[chid].name : '';
        if (!name || A.sameName(name, U)) continue;
        out.push({ name, chid, avatar: av, muted: off.includes(av), narr: NARR.test(name) });
    }
    return out;
}
function present() { try { return (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); } catch { return []; } }
const has = (list, n) => list.some(x => A.sameName(x, n));
function namesIn(text) { try { return A.namesInText?.(text) || []; } catch { return []; } }

function lastAiName() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) { const m = chat[i]; if (m && !m.is_system && !m.is_user && m.extra?.type !== 'comment') return m.name; }
    return '';
}
function lastPostText() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) { const m = chat[i]; if (m && !m.is_system && m.extra?.type !== 'comment') return A.plainText ? A.plainText(m.mes || '') : String(m.mes || ''); }
    return '';
}

/** Кто отвечает из сцены: названный в тексте → (с текстом) тот, с кем она говорит → (пустая) кто дольше молчит. '' — не знаю. */
export function pickResponder(text = '') {
    if (!ready()) return '';
    const pr = present();
    if (!pr.length) return '';
    const here = members().filter(x => !x.muted && !x.narr && has(pr, x.name));
    if (!here.length) return '';
    if (here.length === 1) return here[0].name;
    const typed = !!String(text).trim();
    const last = lastAiName();
    const src = typed ? text : lastPostText();
    const named = namesIn(src).map(n => here.find(h => A.sameName(h.name, n))).filter(Boolean).filter(h => typed || !A.sameName(h.name, last));
    if (named.length) return named[0].name;
    if (typed) { const l = here.find(h => A.sameName(h.name, last)); if (l) return l.name; }
    const chat = A.chatArr();
    const ago = (n) => { for (let i = chat.length - 1, k = 0; i >= 0 && k < 80; i--) { const m = chat[i]; if (!m || m.is_system || m.is_user) continue; k++; if (A.sameName(m.name, n)) return k; } return 999; };
    const pool = here.filter(h => !A.sameName(h.name, last));
    return (pool.length ? pool : here).slice().sort((a, b) => ago(b.name) - ago(a.name))[0].name;
}

/** Ход — ему: её текст из поля уходит постом, отвечает он (как «говорить» в списке группы). */
function go(who, { picked = false } = {}) {
    const chid = chidOf(who);
    if (chid < 0) { A.toast('warning', `${esc(A.shortName(who))} нет в группе`, '✦ Кто ответит'); return false; }
    if (picked) { try { wallsPicked(who); } catch { /* */ } }
    try {
        Promise.resolve(A.ctx().generate('normal', { force_chid: chid })).catch((e) => { console.warn('[Life] кто ответит', e); A.toast('warning', esc(String(e?.message || e)), '✦ Кто ответит'); });
    } catch (e) {
        console.warn('[Life] кто ответит', e);
        A.toast('warning', esc(String(e?.message || e)), '✦ Кто ответит');
        return false;
    }
    return true;
}

// ───────────── долгий тап ─────────────

function onDown(e) {
    const send = e.target?.closest?.('#send_but');
    const face = send ? null : e.target?.closest?.('#lf-cc [data-grp-face]');
    if (!send && !face) return;
    if (!ready() || (send && pickCfg().on === false)) return;
    cancel();
    lp = { x: e.clientX, y: e.clientY, fired: false, kind: send ? 'send' : 'face', el: send || face };
    lp.timer = setTimeout(() => {
        if (!lp) return;
        lp.fired = true;
        suppressUntil = Date.now() + 800;
        try { window.getSelection?.()?.removeAllRanges?.(); } catch { /* */ }
        try { navigator.vibrate?.(25); } catch { /* */ }
        if (lp.kind === 'send') openPanel(); else toggleMute(lp.el.dataset.who);
    }, LP_MS);
}
function onMove(e) { if (lp && !lp.fired && (Math.abs(e.clientX - lp.x) > 12 || Math.abs(e.clientY - lp.y) > 12)) cancel(); }
function onUp() { if (lp && !lp.fired) clearTimeout(lp.timer); lp = null; }
function cancel() { if (lp) clearTimeout(lp.timer); lp = null; }

function onClick(e) {
    const send = e.target?.closest?.('#send_but');
    const face = send ? null : e.target?.closest?.('#lf-cc [data-grp-face]');
    if ((send || face) && Date.now() < suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (send) onSend(e);
}

/** Обычный тап по «Отправить» в группе: пустая отправка — отвечает тот, кто в сцене; с текстом — по настройке. */
function onSend(e) {
    if (!ready()) return;
    const c = pickCfg();
    const ta = document.getElementById('send_textarea');
    const text = String(ta?.value || '');
    if (text.trim().startsWith('/')) return;   // команда — таверне
    const empty = !text.trim();
    if (empty ? c.empty === false : c.scene !== true) return;
    const who = pickResponder(text);
    if (!who) return;                          // не знаю, кто в сцене, — пусть решает таверна
    e.preventDefault();
    e.stopImmediatePropagation();
    go(who);
}

// ───────────── панель «Кто ответит?» ─────────────

function close() { document.getElementById('lf-pick')?.remove(); document.removeEventListener('pointerdown', outside, true); }
function outside(e) { if (!e.target?.closest?.('#lf-pick, #send_but')) close(); }

function faceHtml(x, away) {
    const url = A.avatarUrl?.(x.name) || '';
    const letter = esc(String(x.name || '?').trim().charAt(0).toUpperCase());
    return `<div class="lf-pk-it${away ? ' away' : ''}${x.muted ? ' muted' : ''}">
        <button class="lf-pk-f" data-pk="go" data-who="${esc(x.name)}" title="${esc(x.name)}${x.muted ? ' (молчит — ответит, раз позвала)' : ''}">
            <span class="lf-pk-ava">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i>${letter}</i></span>
            <span class="lf-pk-n">${esc(A.shortName(x.name))}${x.muted ? ' 🔇' : ''}</span>
        </button>
        ${away ? `<button class="lf-pk-cut" data-pk="cut" data-who="${esc(x.name)}" title="Его сцена там, где он сейчас; остальные её не увидят">${A.icon('film')}тем временем</button>` : ''}
    </div>`;
}

function panelHtml() {
    const ms = members();
    const pr = present();
    const isHere = (n) => !pr.length || has(pr, n);
    const mains = ms.filter(x => !x.narr);
    const here = mains.filter(x => isHere(x.name));
    const away = pr.length ? mains.filter(x => !isHere(x.name)) : [];
    const narr = ms.filter(x => x.narr);
    const ta = document.getElementById('send_textarea');
    const typed = !!ta?.value.trim();
    const pin = (() => { try { return duoPin(); } catch { return null; } })();
    const armed = String(A.chatMeta().duo?.armed || '');
    const duoRow = here.length >= 2 || pin
        ? `<div class="lf-pk-l">Второй голос на этот ответ</div><div class="lf-pk-chips">${here.map(x => `<button class="lf-pk-chip${armed && armed !== '*' && A.sameName(armed, x.name) ? ' on' : ''}" data-pk="duo" data-who="${esc(x.name)}">${esc(A.shortName(x.name))}</button>`).join('')}${pin?.p ? `<span class="lf-pk-pin">📌 ${esc(A.shortName(pin.p))} — до конца сцены</span>` : ''}</div>`
        : '';
    const c = pickCfg();
    return `<div class="lf-pk-h"><b>Кто ответит?</b><small>${typed ? 'твой пост уйдёт, ответит он' : 'ответит сейчас'}</small><button class="lf-pk-x" data-pk="close" title="Закрыть">${A.icon('x')}</button></div>
        ${here.length ? `<div class="lf-pk-l">В сцене</div><div class="lf-pk-row">${here.map(x => faceHtml(x, false)).join('')}</div>` : ''}
        ${away.length ? `<div class="lf-pk-l">Не в сцене <small>ответит оттуда, где он сейчас</small></div><div class="lf-pk-row">${away.map(x => faceHtml(x, true)).join('')}</div>` : ''}
        ${!here.length && !away.length ? '<div class="lf-pk-l">В группе никого, кроме тебя</div>' : ''}
        ${duoRow}
        ${narr.length ? `<div class="lf-pk-chips">${narr.map(x => `<button class="lf-pk-chip" data-pk="go" data-who="${esc(x.name)}">${A.icon('feather')}${esc(A.shortName(x.name))}</button>`).join('')}</div>` : ''}
        <div class="lf-pk-opt"><span>Обычный тап «Отправить»:</span><button class="${c.scene ? '' : 'on'}" data-pk="tap" data-v="send">только пост</button><button class="${c.scene ? 'on' : ''}" data-pk="tap" data-v="scene">сразу ответ из сцены</button></div>`;
}

function place(el) {
    const send = document.getElementById('send_but');
    const vw = window.innerWidth || 390;
    const w = Math.min(380, vw - 16);
    el.style.width = `${w}px`;
    const r = send?.getBoundingClientRect?.();
    if (!r || !r.width) { el.style.left = `${Math.round((vw - w) / 2)}px`; el.style.bottom = '90px'; return; }
    const left = Math.max(8, Math.min(vw - w - 8, r.right - w));
    const top = Math.max(8, r.top - el.offsetHeight - 10);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
}

function openPanel() {
    close();
    if (!ready() || !members().length) return;
    const el = document.createElement('div');
    el.id = 'lf-pick';
    el.innerHTML = panelHtml();
    el.addEventListener('click', onPanelClick);
    document.body.append(el);
    place(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
}

function refresh() {
    const el = document.getElementById('lf-pick');
    if (!el) return;
    el.innerHTML = panelHtml();
    place(el);
}

async function onPanelClick(e) {
    const b = e.target.closest('[data-pk]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const act = b.dataset.pk;
    const who = b.dataset.who || '';
    if (act === 'close') { close(); return; }
    if (act === 'go') { close(); go(who, { picked: true }); return; }
    if (act === 'cut') { close(); await cutStart(who); return; }
    if (act === 'duo') { try { duoClick('duo-arm', { dataset: { v: who } }); } catch (err) { console.warn('[Life] вдвоём', err); } refresh(); return; }
    if (act === 'tap') { pickCfg().scene = b.dataset.v === 'scene'; A.saveSettings(); refresh(); }
}

// ───────────── пульт: ряд лиц группы ─────────────

/** Пульт → «Группа»: тап — ответит сейчас, удержать — молчит. */
export function pickCCHtml() {
    if (!ready() || pickCfg().on === false) return '';
    const ms = members();
    if (!ms.length) return '';
    const pr = present();
    return `<div class="cc-chips wrap lf-grp">${ms.map(x => {
        const here = !pr.length || x.narr || has(pr, x.name);
        return `<button class="cc-chip lf-grp-f${here ? '' : ' away'}${x.muted ? ' muted' : ''}" data-cc="grp-go" data-grp-face data-who="${esc(x.name)}" title="${esc(x.name)}: тап — ответит, удержать — ${x.muted ? 'снова отвечает' : 'молчит'}">${A.ava(x.name, 'xs')}<span>${esc(A.shortName(x.name))}</span>${x.muted ? '<i>🔇</i>' : ''}</button>`;
    }).join('')}</div>`;
}

export async function pickCC(act, el) {
    if (act !== 'grp-go') return null;
    const who = el.dataset.who;
    if (!who) return null;
    setTimeout(() => go(who, { picked: true }), 320);
    return 'close';
}

/** Мьют, как в списке группы таверны: сохраняется в группу. */
async function toggleMute(who) {
    const c = A.ctx();
    const g = (c.groups || []).find(x => x.id === c.groupId);
    const x = members().find(m => A.sameName(m.name, who));
    if (!g || !x) return;
    if (!Array.isArray(g.disabled_members)) g.disabled_members = [];
    const k = g.disabled_members.indexOf(x.avatar);
    const muting = k < 0;
    if (muting) g.disabled_members.push(x.avatar); else g.disabled_members.splice(k, 1);
    try { const mod = await import('/scripts/group-chats.js'); await mod.editGroup?.(g.id, false, false); } catch (e) { console.warn('[Life] мьют: в группу не записалось', e); }
    A.toast('info', muting ? `${esc(A.shortName(x.name))} молчит — сам в группе не ответит, только если позовёшь` : `${esc(A.shortName(x.name))} снова отвечает`, '✦ Группа', { timeOut: 1800 });
    const btn = document.querySelector(`#lf-cc [data-grp-face][data-who="${CSS.escape(x.name)}"]`);
    if (btn) {
        btn.classList.toggle('muted', muting);
        btn.querySelector('i')?.remove();
        if (muting) btn.insertAdjacentHTML('beforeend', '<i>🔇</i>');
    }
}
