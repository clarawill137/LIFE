// Входящие — баннером сверху, как пуш на айфоне: стук (звонок, сообщение, визит), списания банка,
// напоминания календаря на сегодня. По одному, сами уезжают; смахни вверх — убрать, тап — к делу.
// Соседние расширения могут звать: globalThis.LifePush({ app, icon | img, title, text, onTap }).

let A = null;
export function initPush(api) {
    A = api;
    globalThis.LifePush = (o) => push(o);
}

const esc = (v) => A.esc(v);
const queue = [];
let showing = false;

function cfg() {
    const s = A.settings();
    if (!s.push || typeof s.push !== 'object') s.push = {};
    if (s.push.on === undefined) s.push.on = true;
    return s.push;
}
export const pushOn = () => cfg().on !== false;

/** { app, icon, img, title, text, onTap, tint, ms } */
export function push(o = {}) {
    if (!A) return;
    if (!pushOn() || document.hidden) {
        A.toast('info', `${o.title ? `<b>${esc(o.title)}</b><br>` : ''}${esc(o.text || '')}`, o.app || '✦ Life', { escapeHtml: false, timeOut: 5000, onclick: o.onTap || undefined });
        return;
    }
    if (queue.some(x => x.title === o.title && x.text === o.text)) return;
    queue.push(o);
    if (!showing) next();
}

function next() {
    const o = queue.shift();
    if (!o) { showing = false; return; }
    showing = true;
    const el = document.createElement('div');
    el.className = 'lf-push';
    if (o.tint) el.style.setProperty('--tint', o.tint);
    el.innerHTML = `<div class="lf-push-ic${o.img ? ' img' : ''}">${o.img ? `<i style="background-image:url('${esc(o.img)}')"></i>` : A.icon(o.icon || 'sparkles')}</div>
        <div class="lf-push-b">
            <div class="lf-push-h"><b>${esc(o.app || 'Life')}</b><span>сейчас</span></div>
            ${o.title ? `<div class="lf-push-t">${esc(o.title)}</div>` : ''}
            ${o.text ? `<div class="lf-push-x">${esc(o.text)}</div>` : ''}
        </div>`;
    document.body.append(el);
    let gone = false;
    const close = () => {
        if (gone) return;
        gone = true;
        clearTimeout(timer);
        el.classList.remove('in');
        el.classList.add('out');
        setTimeout(() => { el.remove(); next(); }, 380);
    };
    let timer = setTimeout(close, o.ms || 5600);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    let y0 = null, dy = 0;
    el.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; clearTimeout(timer); }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy < 0) el.style.transform = `translate(-50%, ${dy}px)`; }, { passive: true });
    el.addEventListener('touchend', () => {
        if (dy < -28) { el.style.transform = ''; close(); return; }
        el.style.transform = '';
        if (Math.abs(dy) < 8) { try { o.onTap?.(); } catch (e) { console.warn('[Life] пуш', e); } close(); return; }
        timer = setTimeout(close, 2600);
        y0 = null;
    });
    el.addEventListener('click', (e) => {
        if ('ontouchstart' in window) return;
        e.preventDefault();
        try { o.onTap?.(); } catch (err) { console.warn('[Life] пуш', err); }
        close();
    });
}

/** Напоминание календаря, когда в истории наступил новый день. */
export function pushDay(list, label) {
    if (!list?.length) return;
    push({ app: 'Календарь', icon: 'calendar', tint: '#e7c77a', title: label, text: list.slice(0, 3).join(' · ') + (list.length > 3 ? ` · ещё ${list.length - 3}` : ''), onTap: () => { A.ui.worldTab = 'cal'; A.openHub('world'); } });
}
