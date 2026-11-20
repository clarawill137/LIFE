// Окна Life вне хаба: персоны, лорбуки, расширения, подключение. Хаб живёт в чате; эти окна — про саму таверну,
// поэтому открываются и с главной, без открытого чата. Одно окно на экран, у него — боковая панель (редактор
// записи, карточка персоны): на телефоне она закрывает окно целиком, на широком экране стоит рядом и тянется
// за край. Модуль окна даёт префикс своих data-act и обработчики; вёрстку окна он перерисовывает сам.

import { icon } from './icons.js';

let A = null;
const mods = [];          // { pre, click(act, el, ev), change(el), input(el) }
let cur = null;           // { id, title, html, onClose }
let side = null;          // { title, html, onClose }
export function initWin(api) { A = api; }
/** Модуль окна: { pre: 'bk-', click, change, input }. */
export function winMod(m) { if (m?.pre && !mods.some(x => x.pre === m.pre)) mods.push(m); }

const $ = (sel) => document.querySelector(`#lf-win ${sel}`);

function build() {
    let dlg = document.getElementById('lf-win');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'lf-win';
    dlg.innerHTML = `<div class="lw-app">
        <section class="lw-main"><header class="lw-top"><div class="lw-title"></div><button class="lf-x" data-act="lw-close" title="Закрыть">${icon('x')}</button></header><div class="lw-body"></div></section>
        <aside class="lw-side"><header class="lw-top"><button class="lf-x" data-act="lw-side-close" title="Назад">${icon('left')}</button><div class="lw-title"></div><i class="lw-grip" title="потяни — шире или уже"></i></header><div class="lw-body"></div></aside>
    </div>`;
    document.body.append(dlg);
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('change', (ev) => route('change', ev));
    dlg.addEventListener('input', (ev) => route('input', ev));
    dlg.addEventListener('cancel', (ev) => { ev.preventDefault(); if (side) closeSide(); else closeWin(); });
    grip(dlg);
    return dlg;
}

/** Ширина боковой панели на широком экране — за ручку; помнится в настройках. */
function grip(dlg) {
    const g = dlg.querySelector('.lw-grip');
    const app = dlg.querySelector('.lw-app');
    let drag = false;
    const set = (px) => { const w = Math.max(320, Math.min(app.clientWidth - 280, px)); app.style.setProperty('--lw-side', `${w}px`); return w; };
    try { const w = Number(A?.settings?.().win?.side); if (w) app.style.setProperty('--lw-side', `${w}px`); } catch { /* */ }
    g.addEventListener('pointerdown', (ev) => { drag = true; g.setPointerCapture?.(ev.pointerId); ev.preventDefault(); });
    g.addEventListener('pointermove', (ev) => { if (drag) set(app.getBoundingClientRect().right - ev.clientX); });
    const end = (ev) => {
        if (!drag) return;
        drag = false;
        const w = set(app.getBoundingClientRect().right - ev.clientX);
        try { const s = A.settings(); s.win = { ...(s.win || {}), side: w }; A.saveSettings(); } catch { /* */ }
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', () => { drag = false; });
}

function route(kind, ev) {
    const el = ev.target;
    for (const m of mods) { try { if (m[kind]?.(el, ev)) return; } catch (e) { console.warn('[Life] окно', e); } }
}

async function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'LABEL' || el.disabled) return;
    const act = el.dataset.act;
    if (act === 'lw-close') { closeWin(); return; }
    if (act === 'lw-side-close') { closeSide(); return; }
    for (const m of mods) {
        if (!act.startsWith(m.pre) || !m.click) continue;
        try { await m.click(act, el, ev); } catch (e) { console.warn('[Life] окно', e); A.toast('warning', A.esc(String(e?.message || e)), '✦ Life', { timeOut: 7000 }); }
        return;
    }
}

function paint() {
    const dlg = build();
    dlg.dataset.win = cur?.id || '';
    dlg.classList.toggle('has-side', !!side);
    const body = $('.lw-main .lw-body');
    const top = body.scrollTop;
    $('.lw-main .lw-title').innerHTML = cur?.title || '';
    let html = '';
    try { html = typeof cur?.html === 'function' ? cur.html() : String(cur?.html || ''); } catch (e) { console.warn('[Life] окно', e); html = `<div class="lf-empty small">${A.esc(String(e?.message || e))}</div>`; }
    body.innerHTML = html;
    body.scrollTop = top;
}

function paintSide() {
    const dlg = build();
    dlg.classList.toggle('has-side', !!side);
    if (!side) { $('.lw-side .lw-body').innerHTML = ''; return; }
    const body = $('.lw-side .lw-body');
    const top = body.scrollTop;
    $('.lw-side .lw-title').innerHTML = side.title || '';
    let html = '';
    try { html = typeof side.html === 'function' ? side.html() : String(side.html || ''); } catch (e) { console.warn('[Life] окно', e); html = `<div class="lf-empty small">${A.esc(String(e?.message || e))}</div>`; }
    body.innerHTML = html;
    body.scrollTop = top;
}

/** Открыть окно: { id, title, html: () => строка, onClose }. Прежнее окно закрывается. */
export function openWin(w) {
    if (cur && cur.id !== w.id) { try { side?.onClose?.(); cur.onClose?.(); } catch { /* */ } side = null; }
    cur = w;
    const dlg = build();
    paint();
    paintSide();
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    requestAnimationFrame(() => dlg.classList.add('on'));
}

/** Перерисовать окно (и боковую панель, если она сама себя рисует). */
export function winRender({ sideToo = false } = {}) { if (!cur) return; paint(); if (sideToo && side) paintSide(); }
export function winTitle(html) { if (cur) { cur.title = html; const t = $('.lw-main .lw-title'); if (t) t.innerHTML = html; } }

/** Боковая панель: { title, html: () => строка, onClose }. */
export function openSide(s) { side = s; paintSide(); $('.lw-side .lw-body').scrollTop = 0; }
export function sideRender() { if (side) paintSide(); }
export function closeSide() { if (!side) return false; try { side.onClose?.(); } catch { /* */ } side = null; paintSide(); return true; }
export const sideBox = () => $('.lw-side .lw-body');
export const winBox = () => $('.lw-main .lw-body');
export const winOpen = (id) => !!cur && (!id || cur.id === id) && !!document.getElementById('lf-win')?.open;
export const sideOpen = () => !!side;

export function closeWin() {
    const dlg = document.getElementById('lf-win');
    try { side?.onClose?.(); cur?.onClose?.(); } catch { /* */ }
    side = null; cur = null;
    if (!dlg) return;
    dlg.classList.remove('on', 'has-side');
    setTimeout(() => { if (cur) return; try { if (dlg.open) dlg.close(); } catch { dlg.removeAttribute('open'); } }, 180);   // успели открыть другое окно — не закрывать
}

/** «Точно?» — опасная кнопка срабатывает со второго тапа за четыре секунды. true — можно делать. */
export function sure(el, label = 'Точно?') {
    if (el.dataset.armed && Date.now() - Number(el.dataset.armed) < 4000) { delete el.dataset.armed; return true; }
    const html = el.innerHTML;
    el.dataset.armed = String(Date.now());
    el.classList.add('armed');
    el.innerHTML = label;
    setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.classList.remove('armed'); el.innerHTML = html; } }, 4000);
    return false;
}

/** Значение поля окна или боковой панели. */
export const val = (box, name) => String((box || document.getElementById('lf-win'))?.querySelector(`[data-in="${name}"]`)?.value ?? '').trim();

/** Спросить строку (название папки, лорбука): окном таверны, а где его нет — системным. Пусто — отмена. */
export async function askText(title, def = '') {
    try {
        const c = A.ctx();
        if (c.callGenericPopup && c.POPUP_TYPE?.INPUT !== undefined) { const r = await c.callGenericPopup(title, c.POPUP_TYPE.INPUT, def); return typeof r === 'string' ? r.trim() : ''; }
    } catch (e) { console.warn('[Life] окно: вопрос', e); }
    return String(globalThis.prompt?.(title, def) || '').trim();
}
