// ✦ Картинки и показ: картинки из самого чата (SLAY и вложения), кат-сцены на весь экран,
// фон сцены с плавной сменой и музыка с перетеканием треков.

import { icon } from './icons.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const unent = (s) => String(s || '').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ───────────── картинки из чата ─────────────

const IMG_TAG = /<img\b[^>]*>/gi;
function attr(tag, name) {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return m ? unent(m[1] ?? m[2] ?? '') : '';
}
const okSrc = (src) => !!src && !/IMG:GEN|^about:|^javascript:/i.test(src) && !(src.startsWith('data:') && src.length < 200);

/** Все картинки одного сообщения: вложения ST и <img> в тексте (SLAY кладёт туда промпт в data-iig-instruction). */
export function messageImages(m) {
    const out = [];
    if (!m || m.is_system && !m.extra?.image) return out;
    const add = (src, ins = '') => { if (okSrc(src) && !out.some(x => x.src === src)) out.push({ src, ins }); };
    const ex = m.extra || {};
    if (typeof ex.image === 'string') add(ex.image, ex.title || '');
    for (const md of Array.isArray(ex.media) ? ex.media : []) if (md && (md.type === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(md.url || ''))) add(md.url, md.title || '');
    const tags = String(m.mes || '').match(IMG_TAG) || [];
    for (const t of tags) add(attr(t, 'src'), attr(t, 'data-iig-instruction') || attr(t, 'alt') || attr(t, 'title'));
    return out;
}

let cache = { sig: '', list: [] };
/** Картинки всего чата по порядку: [{mes, src, ins}]. */
export function chatImages(chat) {
    const last = chat[chat.length - 1];
    const sig = `${chat.length}|${last?.swipe_id ?? ''}|${String(last?.mes || '').length}|${String(chat[0]?.mes || '').length}`;
    if (cache.sig === sig) return cache.list;
    const list = [];
    chat.forEach((m, i) => messageImages(m).forEach(x => list.push({ mes: i, ...x })));
    cache = { sig, list };
    return list;
}
export function resetImages() { cache.sig = ''; }

/** Картинка рядом с сообщением: в нём самом или в паре следующих (картинку часто дорисовывают ответом ниже). */
export function imageNear(list, i, span = 2) {
    return list.find(x => x.mes >= i && x.mes <= i + span) || list.find(x => x.mes === i - 1) || null;
}
export function imagesBetween(list, a, b) { return list.filter(x => x.mes >= a && x.mes <= b); }
/** Картинки, где по промпту есть все эти люди (сравнение по первому слову имени). */
export function imagesWith(list, names) {
    const keys = names.map(n => String(n || '').toLowerCase().replace(/ё/g, 'е').split(/\s+/)[0]).filter(Boolean);
    return list.filter(x => { const t = String(x.ins || '').toLowerCase().replace(/ё/g, 'е'); return t && keys.every(k => t.includes(k)); });
}

// ───────────── просмотр картинки ─────────────

export function lightbox(src, caption = '', onJump = null) {
    document.getElementById('lf-lightbox')?.remove();
    const el = document.createElement('div');
    el.id = 'lf-lightbox';
    el.innerHTML = `<img src="${esc(src)}" alt=""><div class="lf-lb-bar">${caption ? `<span>${esc(caption)}</span>` : '<span></span>'}${onJump ? `<button data-lb="jump">${icon('right')} к посту</button>` : ''}<button data-lb="x">${icon('x')}</button></div>`;
    el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-lb]');
        if (b?.dataset.lb === 'jump') { el.remove(); onJump?.(); return; }
        if (b || e.target === el || e.target.tagName === 'IMG') el.remove();
    });
    ([...document.querySelectorAll('dialog[open]')].pop() || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('on'));
}

// ───────────── кат-сцена ─────────────

let cutTimer = null;
/** Кат-сцена на весь экран: полосы кино, медленный наезд камеры, подпись. Тап — дальше, ✕ — выйти. */
export function playCut(cut, { onEnd = null, music = null } = {}) {
    const frames = (cut?.frames || []).filter(f => f.img);
    if (!frames.length) return;
    stopCut();
    const el = document.createElement('div');
    el.id = 'lf-cut';
    el.innerHTML = `<div class="lf-cut-stage">${frames.map((f, i) => `<div class="lf-cut-f k${i % 4}" data-i="${i}" style="background-image:url('${esc(f.img)}')"><i class="bl"></i><i class="im"></i></div>`).join('')}</div>
        <i class="lf-cut-bar top"></i><i class="lf-cut-bar bot"></i>
        <div class="lf-cut-cap"><small></small><span></span></div>
        <div class="lf-cut-dots">${frames.map((_, i) => `<b data-i="${i}"></b>`).join('')}</div>
        <button class="lf-cut-x" aria-label="Закрыть">${icon('x')}</button>`;
    ([...document.querySelectorAll('dialog[open]')].pop() || document.body).append(el);
    let i = -1;
    const show = (n) => {
        if (n >= frames.length) { stopCut(); onEnd?.(); return; }
        i = n;
        el.querySelectorAll('.lf-cut-f').forEach((f, k) => { f.classList.toggle('on', k === i); if (k === i) { f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; } });
        el.querySelectorAll('.lf-cut-dots b').forEach((b, k) => b.classList.toggle('on', k <= i));
        const cap = el.querySelector('.lf-cut-cap');
        cap.classList.remove('on');
        cap.querySelector('small').textContent = frames[i].title || '';
        cap.querySelector('span').textContent = frames[i].caption || '';
        setTimeout(() => cap.classList.add('on'), 700);
        clearTimeout(cutTimer);
        cutTimer = setTimeout(() => show(i + 1), Math.max(5200, 2600 + String(frames[i].caption || '').length * 55));
    };
    el.addEventListener('click', (e) => {
        if (e.target.closest('.lf-cut-x')) { stopCut(); onEnd?.(); return; }
        show(i + 1);
    });
    if (music) Music.play(music, { cut: true });
    requestAnimationFrame(() => { el.classList.add('on'); setTimeout(() => show(0), 650); });
}
export function stopCut() {
    clearTimeout(cutTimer);
    const el = document.getElementById('lf-cut');
    if (!el) return;
    Music.endCut();
    el.classList.remove('on');
    setTimeout(() => el.remove(), 500);
}

// ───────────── фон сцены ─────────────

/** Части суток по времени из Horae. */
export function periodOf(time) {
    const m = String(time || '').match(/(\d{1,2})[:.](\d{2})/);
    if (!m) return '';
    const h = Number(m[1]);
    if (h >= 22 || h < 5) return 'night';
    if (h < 8) return 'dawn';
    if (h < 17) return 'day';
    return 'evening';
}
export const PERIODS = { dawn: 'Рассвет', day: 'День', evening: 'Вечер', night: 'Ночь' };

let bgNow = '';
/** Фон Life за чатом: два слоя, новый плавно проявляется поверх старого, когда загрузится. */
export function setSceneBg(url) {
    let host = document.getElementById('lf-bg');
    if (!url) { if (host) { host.classList.remove('on'); } bgNow = ''; document.body.classList.remove('lf-has-bg'); return; }
    if (!host) {
        host = document.createElement('div');
        host.id = 'lf-bg';
        host.innerHTML = '<i></i><i></i>';
        const bg1 = document.getElementById('bg1');
        if (bg1?.parentNode) bg1.parentNode.insertBefore(host, bg1.nextSibling); else document.body.prepend(host);
    }
    document.body.classList.add('lf-has-bg');
    host.classList.add('on');
    if (url === bgNow) return;
    bgNow = url;
    const img = new Image();
    img.onload = () => {
        if (bgNow !== url) return;
        const [a, b] = host.querySelectorAll('i');
        const top = a.classList.contains('show') ? b : a;
        const under = top === a ? b : a;
        top.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
        top.classList.add('show');
        under.classList.remove('show');
    };
    img.src = url;
}

// ───────────── музыка ─────────────

/** Два плеера: новый трек вступает, пока старый затихает (~2 с). Треки — файлы, которые ты загрузила. */
export const Music = (() => {
    let a = null, b = null, cur = null, track = null, beforeCut = null, vol = 0.6, fadeIv = null;
    const make = () => { const x = new Audio(); x.loop = true; x.preload = 'auto'; x.volume = 0; return x; };
    const ensure = () => { if (!a) { a = make(); b = make(); } };
    function fade(el, to, ms, done) {
        const from = el.volume, t0 = performance.now();
        const step = () => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
            if (k < 1) requestAnimationFrame(step); else done?.();
        };
        requestAnimationFrame(step);
    }
    function play(t, { cut = false } = {}) {
        if (!t?.url) return;
        ensure();
        if (cut && !beforeCut) beforeCut = track;
        if (track?.url === t.url && cur && !cur.paused) return;
        const next = cur === a ? b : a, prev = cur;
        next.src = t.url;
        next.volume = 0;
        const p = next.play();
        if (p?.catch) p.catch(() => {});
        fade(next, vol, 2000);
        if (prev && !prev.paused) fade(prev, 0, 2000, () => { prev.pause(); });
        cur = next; track = t;
        window.dispatchEvent(new CustomEvent('lf-music'));
    }
    function stop() {
        if (cur && !cur.paused) { const c = cur; fade(c, 0, 1200, () => c.pause()); }
        track = null;
        window.dispatchEvent(new CustomEvent('lf-music'));
    }
    function endCut() {
        if (beforeCut === null) return;
        const back = beforeCut; beforeCut = null;
        if (back) play(back); else stop();
    }
    return {
        play, stop, endCut,
        now: () => (cur && !cur.paused ? track : null),
        setVolume(v) { vol = Math.max(0, Math.min(1, Number(v) || 0)); if (cur && !cur.paused) cur.volume = vol; },
        toggle(t) { if (track?.url === t?.url && cur && !cur.paused) stop(); else play(t); },
    };
})();

/** Загрузка своего трека в файлы таверны. */
export async function uploadTrack(file) {
    const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(file); });
    const ext = (file.name.match(/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|webm)$/i)?.[1] || 'mp3').toLowerCase();
    const name = `life_${Date.now().toString(36)}.${ext}`;
    const r = await fetch('/api/files/upload', { method: 'POST', headers: SillyTavern.getContext().getRequestHeaders(), body: JSON.stringify({ name, data }) });
    if (!r.ok) throw new Error(`файл не загрузился (${r.status})`);
    const j = await r.json();
    return j.path?.startsWith('/') ? j.path : `/${j.path || `user/files/${name}`}`;
}
