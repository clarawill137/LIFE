// Титры: закрыла сюжетку → титры во весь экран: заставка God Complex, название арки, «в ролях» с аватарками,
// лучшие кадры арки (картинки постов), «музыка» — что играет в Саундтреке, — и сцена после титров: умная модель
// пишет тизер из того, что уже назревает в истории; «в историю» — он ляжет модели подсказкой на будущее.

import { str, arr } from './hudkit.js';

let A = null;
export function initCredits(api) { A = api; }
const esc = (v) => A.esc(v);
const on = () => A.settings().credits?.on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.ttl || typeof cm.ttl !== 'object') cm.ttl = {};
    const s = cm.ttl;
    if (!Array.isArray(s.list)) s.list = [];   // { id, title, from, to, cast, imgs, tag, teaser, at }
    return s;
}
/** Что вошло в арку: кто писал, какие картинки. */
export function gather(from, to) {
    const chat = A.chatArr();
    const cast = [], imgs = [];
    for (let i = Math.max(0, from); i <= Math.min(chat.length - 1, to); i++) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        const n = A.canonName(m.name);
        if (n && !cast.some(x => A.sameName(x, n))) cast.push(n);
        for (const src of [m.extra?.image, ...arr(m.extra?.image_swipes), ...String(m.mes || '').matchAll(/<img[^>]+src="([^"]+)"/g)].map(x => (Array.isArray(x) ? x[1] : x))) {
            const s = str(src, 600);
            if (s && !/^data:image\/svg/.test(s) && !imgs.includes(s)) imgs.push(s);
        }
    }
    return { cast, imgs: imgs.slice(-12) };
}
const NAME_SYS = `Ты — титровальщик ролевой истории God Complex (AU по Marvel). По отрывку дай название арки (2–5 слов, как эпизод сериала) и строку-тэглайн. Только JSON: {"title":"","tag":""}`;
const TEASE_SYS = `Ты — сцена после титров ролевой истории God Complex (AU по Marvel). Напиши тизер 2–4 предложения: короткая сцена где-то в мире истории, которая намекает на будущий поворот, уже посеянный в истории (то, что назревает, чужие планы, старые долги). Без спойлеров её тайных планов, без новых крупных персонажей, кинематографично, в настоящем времени.
Только JSON: {"teaser":"","who":"кто в кадре"}`;
async function ask(sys, user, tokens, what) {
    const msgs = [{ role: 'system', content: sys }, { role: 'user', content: user }];
    return A.askFillJson ? A.askFillJson(msgs, tokens, { what }, {}) : A.extractJson(await A.askModel(msgs, tokens));
}
function excerpt(from, to) {
    const chat = A.chatArr();
    const out = [];
    for (let i = Math.max(from, to - 8); i <= to; i++) { const m = chat[i]; if (m && !m.is_system) out.push(`${m.name}: ${String(m.mes || '').replace(/<[^>]+>/g, ' ').slice(0, 400)}`); }
    return out.join('\n');
}
export async function roll(from, to, title = '') {
    const g = gather(from, to);
    let tag = '';
    if (!title) { try { const j = await ask(NAME_SYS, excerpt(from, to), 500, 'титры: название'); title = str(j?.title, 60); tag = str(j?.tag, 120); } catch { /* */ } }
    let teaser = '', who = '';
    try { const j = await ask(TEASE_SYS, `Арка: ${title || 'без названия'}. Конец арки:\n${excerpt(from, to)}`, 1400, 'сцена после титров'); teaser = str(j?.teaser, 600); who = str(j?.who, 80); } catch (e) { console.warn('[Life] титры', e); }
    const x = { id: `t${Date.now().toString(36)}`, title: title || 'Глава', tag, from, to, cast: g.cast, imgs: g.imgs, teaser, who, at: A.worldState()?.timestamp?.story_date || '' };
    M().list.unshift(x);
    M().list = M().list.slice(0, 20);
    A.saveMeta();
    return x;
}
export function plant(id) {
    const x = M().list.find(y => y.id === id);
    if (!x?.teaser) return false;
    M().seed = { t: x.teaser, until: A.chatArr().length + 12 };
    A.saveMeta();
    return true;
}
export function ttlPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M().seed;
    if (!s || A.chatArr().length > s.until) return '';
    return `[Сцена после титров (подсказка на будущее, не сейчас): ${s.t} Это где-то в мире истории; пусть отзовётся позже — тенью, слухом, деталью, — не в лоб.]`;
}

// ───────────── показ ─────────────

let player = null;
export function play(x) {
    stop();
    const el = document.createElement('div');
    el.className = 'lf-ttl';
    const cast = x.cast.map(n => `<div class="lf-ttl-p">${A.avatarUrl?.(n, true) ? `<img src="${esc(A.avatarUrl(n, true))}" alt="">` : ''}<b>${esc(A.shortName(n))}</b><small>${esc(n)}</small></div>`).join('');
    const music = (() => { try { return globalThis.Soundtrack?.now?.()?.title || ''; } catch { return ''; } })();
    el.innerHTML = `<div class="lf-ttl-bg">${x.imgs.map((s, i) => `<img src="${esc(s)}" alt="" style="animation-delay:${i * 4}s">`).join('')}</div>
        <div class="lf-ttl-roll"><div class="lf-ttl-logo">GOD COMPLEX</div><h1>${esc(x.title)}</h1>${x.tag ? `<p class="lf-ttl-tag">${esc(x.tag)}</p>` : ''}
            <h2>В ролях</h2><div class="lf-ttl-cast">${cast}</div>
            ${music ? `<h2>Музыка</h2><p>${esc(music)}</p>` : ''}
            <h2>Посты</h2><p>#${x.from} — #${x.to}${x.at ? ` · ${esc(x.at)}` : ''}</p>
            <div class="lf-ttl-end">${x.teaser ? '<p>…но это ещё не всё</p>' : '<p>Конец главы</p>'}</div></div>
        <div class="lf-ttl-post">${x.teaser ? `<small>сцена после титров${x.who ? ` · ${esc(x.who)}` : ''}</small><p>${esc(x.teaser)}</p><div class="lf-actions"><button data-act="ttl-plant" data-id="${x.id}">✦ В историю</button><button data-act="ttl-close">Закрыть</button></div>` : '<div class="lf-actions"><button data-act="ttl-close">Закрыть</button></div>'}</div>
        <button class="lf-ttl-x" data-act="ttl-close" aria-label="Закрыть">✕</button>`;
    (document.getElementById('lf-app') || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('on'));
    const dur = Math.max(22, 10 + x.cast.length * 2.5);
    el.style.setProperty('--dur', `${dur}s`);
    player = setTimeout(() => el.classList.add('post'), dur * 1000);
}
export function stop() { clearTimeout(player); document.querySelectorAll('.lf-ttl').forEach(e => e.remove()); }

// ───────────── экран ─────────────

const ui = { from: '' };
export function ttlSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const last = A.chatArr().length - 1;
    const prevTo = s.list[0]?.to ?? -1;
    const from = ui.from !== '' ? Number(ui.from) : Math.max(prevTo + 1, last - 60);
    return `${A.sec('Титры', s.list.length ? `${s.list.length}` : '')}
        <div class="lf-field"><label>Арка: с поста по последний (#${last})</label><input data-ttlf="from" type="number" value="${from}"></div>
        <div class="lf-field"><input data-ttlf="title" placeholder="Название — или придумает модель"></div>
        <button class="lf-btn primary wide" data-act="ttl-roll">🎬 Титры</button>
        ${s.list.map(x => `<div class="lf-ttl-row"><b>${esc(x.title)}</b><small>#${x.from}–#${x.to}${x.at ? ` · ${esc(x.at)}` : ''}${x.teaser ? ' · есть сцена после титров' : ''}</small><button class="lf-mini" data-act="ttl-play" data-id="${x.id}">▶</button></div>`).join('')}
        <div class="lf-hint">Закрыла сюжетку — титры: «в ролях», кадры арки, музыка. В конце — сцена после титров; «в историю» — она ляжет модели подсказкой на будущее.</div>`;
}
export async function ttlClick(act, el) {
    const box = el.closest('#lf-app') || document;
    const val = (k) => box.querySelector(`[data-ttlf="${k}"]`)?.value || '';
    if (act === 'ttl-roll') {
        const last = A.chatArr().length - 1;
        const from = Math.max(0, Math.min(last, Number(val('from')) || 0));
        const x = await A.withBusy(el, () => roll(from, last, val('title').trim()), 'Монтаж…');
        if (x) play(x);
    } else if (act === 'ttl-play') { const x = M().list.find(y => y.id === el.dataset.id); if (x) play(x); return; }
    else if (act === 'ttl-plant') { if (plant(el.dataset.id)) A.toast('success', 'Сцена после титров ляжет в историю тенью'); stop(); }
    else if (act === 'ttl-close') { stop(); return; }
    else return;
    A.updatePrompt?.(); A.render();
}
export const _ttl = { M, ui };
