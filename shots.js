// Кадры и кат-сцены внутри постов — ровно в тот момент текста, где они происходят.
// Кадр — одна большая картинка с медленным наездом камеры и живым слоем (дождь, дым, свет).
// Кат-сцена — 3–4 кадра, листаются сами прямо в посте с субтитрами; тап — на весь экран с музыкой.
// Летописец подсказывает, где момент просится на экран; кнопка 🎬 у поста — кадр когда захочется.
// Модель картинки не видит: они живут только в чате у игрока.

import { icon } from './icons.js';
import { playCut, lightbox } from './media.js';
import { moodNow } from './mood.js';

let A = null;
export function initShots(api) { A = api; }

const MOTIONS = ['rain', 'snow', 'steam', 'smoke', 'flicker', 'glow', 'pulse', 'heartbeat', 'drift'];
const busy = new Map(); // id → { key, kind, at, step, total, label }
let pick = null; // открытая под кадром панель «перерисовать»: { id, style, fix }

/** Стили кадров. [id, ярлык, иконка, текст для рисовалки] — у «как у истории» и «своего» текст берётся из настроек. */
export const SHOT_STYLES = [
    ['story', 'Как у истории', 'feather', ''],
    ['pencil', 'Карандаш', 'pencil', 'hand-drawn colored-pencil sketch illustration: crisp ink linework, soft pencil shading and hatching, subtle toned-paper texture, warm natural skin, semi-realistic proportions, not a photo'],
    ['real', 'Реализм', 'camera', 'photorealistic, like a real photograph: natural skin texture, true-to-life proportions and light, 35mm lens, subtle film grain; not an illustration, not a painting, no CGI look'],
    ['cine', 'Кино', 'film', 'cinematic film still from a modern drama: anamorphic lens, shallow depth of field, moody teal-and-amber colour grade, motivated practical lighting, soft haze, film grain'],
    ['noir', 'Нуар', 'moon', 'black-and-white film noir still: high contrast, deep hard shadows, slatted light through blinds, smoke and haze, 1940s cinematography'],
    ['film', 'Плёнка', 'image', 'candid 35mm film photograph: warm faded colours, visible grain, soft light leaks, slightly imperfect focus, like a private snapshot'],
    ['retro', 'Ретро 40-х', 'clock', '1940s Kodachrome colour photograph: rich saturated reds and blues, soft contrast, period atmosphere and film texture'],
    ['oil', 'Масло', 'palette', 'classical oil painting: visible brushstrokes, rich glazes, Rembrandt-like chiaroscuro, canvas texture'],
    ['water', 'Акварель', 'waves', 'loose watercolor and ink illustration: soft washes bleeding into each other, fine ink lines, white paper showing through, airy and emotional'],
    ['comic', 'Комикс', 'zap', 'graphic novel panel: bold confident ink lines, dramatic shadows, flat muted colours with halftone texture, dynamic framing; no speech bubbles, no text'],
    ['anime', 'Аниме', 'star', 'anime feature film still: clean line art, cel shading, painterly detailed backgrounds, soft cinematic lighting'],
    ['custom', 'Свой', 'type', ''],
];
const styleById = (id) => SHOT_STYLES.find(x => x[0] === id) || SHOT_STYLES[0];
/** Стиль кадров в этом чате (Режиссёр), иначе по умолчанию (настройки). */
export function chatStyle() { const v = A.chatMeta().shotStyle || cfg().style || 'story'; return styleById(v)[0]; }
export function styleText(id = chatStyle()) {
    if (id === 'custom') return String(cfg().custom || '').trim() || A.style();
    return styleById(id)[3] || A.style();
}
export const styleName = (id) => styleById(id)[1];
/** Ряд стилей. act — data-act для чипа, cur — выбранный. */
export function styleChips(act, cur, attr = 'data-act') {
    return SHOT_STYLES.map(([id, label, ic]) => `<button class="lf-chip${id === cur ? ' on' : ''}" ${attr}="${act}" data-v="${id}">${icon(ic)} ${label}</button>`).join('');
}

const cfg = () => A.settings().shot;
const list = () => (Array.isArray(A.chatMeta().cuts) ? A.chatMeta().cuts : []);
/** Ключ поста для кадров: номер и свайп. Правка текста кадры не сносит — они держатся за слова абзаца. */
export function shotKey(i) { const m = A.chatArr()[i]; return m ? `${i}:${m.swipe_id ?? 0}` : ''; }
const sigOf = (m) => A.hash(A.plainText(m?.mes || '').slice(0, 300));
const nz = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();

function paragraphs(text) {
    const t = String(text || '').trim();
    const big = t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    return (big.length >= 2 ? big : t.split(/\n+/).map(x => x.trim())).filter(x => nz(x));
}

/** Где в списке текстов эти слова: окна по 8, 6, 4 и 3 слова — модели цитируют неточно. */
function locate(texts, quote) {
    const w = nz(quote).split(' ').filter(Boolean);
    if (!w.length) return -1;
    const hay = texts.map(t => ` ${nz(t)} `);
    for (const n of [8, 6, 4, 3]) {
        if (w.length < n && n !== 3) continue;
        const k = Math.min(n, w.length);
        for (const s of [0, Math.max(0, Math.floor((w.length - k) / 2)), Math.max(0, w.length - k)]) {
            const needle = ` ${w.slice(s, s + k).join(' ')} `;
            const at = hay.findIndex(h => h.includes(needle));
            if (at >= 0) return at;
        }
    }
    return -1;
}
const snippet = (t) => nz(t).split(' ').slice(0, 10).join(' ');

const BLOCK = /^(P|BLOCKQUOTE|UL|OL|H[1-6]|PRE|TABLE|DIV)$/;
function blocksOf(mt) { return [...mt.children].filter(x => BLOCK.test(x.tagName) && !x.matches('.lf-shot, .lf-shot-sug, .lf-shot-pick') && nz(x.textContent)); }

// ───── отрисовка в посте ─────

function frameHtml(c) {
    const f = c.frames[0];
    const motion = A.settings().detail?.motion !== false ? ` m-${A.esc(f.motion || 'drift')}` : '';
    return `<figure class="lf-shot lf-mo${motion}" data-shot="${A.esc(c.id)}" contenteditable="false">
        <img src="${A.esc(f.img)}" alt="" loading="lazy" decoding="async"><i class="fx"></i><i class="fx2"></i>
        ${f.caption || c.title ? `<figcaption>${A.esc(f.caption || c.title)}</figcaption>` : ''}
        ${btns(c)}
    </figure>`;
}

function cutHtml(c) {
    const fs = c.frames.filter(f => f.img);
    return `<figure class="lf-shot cut lf-mo" data-shot="${A.esc(c.id)}" contenteditable="false">
        <div class="lf-shot-st">${fs.map((f, k) => `<div class="lf-shot-f k${k % 4}${k ? '' : ' on'}" style="background-image:url('${A.esc(f.img)}')"></div>`).join('')}</div>
        <i class="lf-shot-bar top"></i><i class="lf-shot-bar bot"></i>
        <div class="lf-shot-sub">${fs.map((f, k) => `<span class="${k ? '' : 'on'}">${A.esc(f.caption || '')}</span>`).join('')}</div>
        <span class="lf-shot-dots">${fs.map((_, k) => `<b class="${k ? '' : 'on'}"></b>`).join('')}</span>
        <span class="lf-shot-t">${icon('play')}<b>${A.esc(c.title || 'Кат-сцена')}</b></span>
        ${btns(c)}
    </figure>`;
}

function btns(c) {
    const b = (act, ic, t) => `<button data-sh="${act}" title="${t}">${icon(ic)}</button>`;
    return `<span class="lf-shot-btns">${b('up', 'left', 'Выше')}${b('down', 'right', 'Ниже')}${c.kind === 'frame' ? b('grow', 'film', 'Сделать кат-сценой') : ''}${b('redo', 'refresh', 'Перерисовать')}${b('del', 'x', 'Убрать')}</span>`;
}

function waitHtml(id, w) {
    const what = w.kind === 'cut' ? 'Снимаю кат-сцену' : 'Снимаю кадр';
    return `<div class="lf-shot wait" data-wait="${A.esc(id)}" contenteditable="false"><i class="lf-det-sh"></i><span>${icon(w.kind === 'cut' ? 'film' : 'camera')} ${what}<small>${A.esc(w.label || '')}</small></span></div>`;
}

function pickHtml(c) {
    const cur = pick.style;
    const custom = cur === 'custom' && !String(cfg().custom || '').trim();
    return `<div class="lf-shot-pick" contenteditable="false">
        <div class="lf-shot-pick-h">${icon('palette')}<b>Перерисовать</b><small>${c.kind === 'cut' ? 'все кадры' : 'этот кадр'} · сейчас: ${A.esc(styleName(c.style || 'story').toLowerCase())}</small></div>
        <div class="lf-shot-pick-st">${styleChips('pk-style', cur, 'data-sh')}</div>
        ${custom ? '<div class="lf-shot-pick-note">Свой стиль пустой — впиши его в Режиссёре (Стиль кадров → Свой), пока будет как у истории.</div>' : ''}
        <input type="text" class="lf-shot-fix" placeholder="Что поправить (можно пусто): он без бороды, она в красном платье…" value="${A.esc(pick.fix || '')}">
        <div class="lf-shot-pick-b">
            <button data-sh="pk-go" class="on">${icon('refresh')} Перерисовать</button>
            <button data-sh="pk-new">${icon('camera')} Другой ракурс</button>
            <button data-sh="pk-x" title="Закрыть">${icon('x')}</button>
        </div>
    </div>`;
}

function sugHtml(e) {
    const s = e.shot;
    const main = s.kind === 'cut' ? 'cut' : 'frame';
    const b = (k, label, ic) => `<button data-sh="sug-${k}" class="${k === main ? 'on' : ''}">${icon(ic)} ${label}</button>`;
    return `<div class="lf-shot-sug" contenteditable="false">
        <span class="lf-shot-sug-t">${icon('film')}<span><b>${A.esc(s.caption || 'Просится кадр')}</b>${s.why ? `<small>${A.esc(s.why)}</small>` : ''}</span></span>
        <span class="lf-shot-sug-b">${b('frame', 'Кадр', 'camera')}${b('cut', 'Кат-сцена', 'film')}<button data-sh="sug-x" title="Не надо">${icon('x')}</button></span>
    </div>`;
}

/** Что должно стоять в этом посте: [{ id, html, at, para }]. */
function wanted(i) {
    const m = A.chatArr()[i];
    if (!m || m.is_system) return [];
    const key = shotKey(i);
    const sig = sigOf(m);
    const out = [];
    for (const c of list()) {
        if (c.key !== key || !c.frames?.some(f => f.img)) continue;
        if ([...busy.values()].some(w => w.redo === c.id)) continue; // перерисовывается — на месте заглушка
        out.push({ id: c.id, html: c.kind === 'frame' ? frameHtml(c) : cutHtml(c), at: c.at, para: c.para, sig: c.sig !== sig ? 'loose' : '' });
        if (pick?.id === c.id) out.push({ id: 'pick', html: pickHtml(c), at: c.at, para: c.para, sig: c.sig !== sig ? 'loose' : '' });
    }
    for (const [id, w] of busy) if (w.key === key) out.push({ id: `w-${id}`, html: waitHtml(id, w), at: w.at, para: w.para });
    const e = A.chronOf(i);
    if (cfg().suggest && e?.shot && !e.shotX && !e.shotUsed && ![...busy.values()].some(w => w.key === key && w.sug)) out.push({ id: 'sug', html: sugHtml(e), at: e.shot.at, para: -1 });
    return out;
}

/** Расставить кадры по абзацам поста. Вызывается из paintChips на каждый пост. */
export function paintShots(el, i) {
    const mt = el.querySelector('.mes_text');
    if (!mt || mt.querySelector('textarea')) return; // идёт правка
    shotButton(el, i);
    const want = A.settings().enabled ? wanted(i) : [];
    const have = [...mt.querySelectorAll(':scope > .lf-shot, :scope > .lf-shot-sug, :scope > .lf-shot-pick')];
    if (!want.length) { have.forEach(x => x.remove()); return; }
    mt.style.setProperty('--lf-mtpr', getComputedStyle(mt).paddingRight || '0px'); // чтобы кадр в широком режиме вставал во всю ширину
    const blocks = blocksOf(mt);
    const texts = blocks.map(b => b.textContent);
    const ids = new Set(want.map(w => w.id));
    have.forEach(x => { if (!ids.has(x.dataset.lfid)) x.remove(); });
    const placed = new Set();
    for (const w of want) {
        let k = w.at ? locate(texts, w.at) : -1;
        if (k < 0 && Number.isFinite(w.para) && w.para >= 0) k = Math.min(w.para, blocks.length - 1);
        if (k < 0 && w.sig === 'loose') { mt.querySelector(`:scope > [data-lfid="${CSS.escape(w.id)}"]`)?.remove(); continue; } // пост уже другой
        const after = k >= 0 ? blocks[k] : blocks[blocks.length - 1] || null;
        const sig = A.hash(w.html);
        let node = mt.querySelector(`:scope > [data-lfid="${CSS.escape(w.id)}"]`);
        if (node && node.dataset.sig !== sig) { node.remove(); node = null; }
        if (!node) {
            const tmp = document.createElement('div');
            tmp.innerHTML = w.html.trim();
            node = tmp.firstElementChild;
            node.dataset.lfid = w.id;
            node.dataset.sig = sig;
        }
        // после нужного абзаца, а если там уже встали кадры из этого прохода — за ними
        let ref = after;
        while (ref?.nextElementSibling && ref.nextElementSibling !== node && placed.has(ref.nextElementSibling.dataset.lfid)) ref = ref.nextElementSibling;
        if (ref) { if (ref.nextElementSibling !== node) ref.after(node); } else if (node.parentNode !== mt) mt.append(node);
        placed.add(w.id);
    }
    tickOn();
}

function shotButton(el, i) {
    const mb = el.querySelector('.mes_buttons');
    if (!mb) return;
    const m = A.chatArr()[i];
    const on = A.settings().enabled && cfg().btn && m && !m.is_system && !m.extra?.life;
    let b = mb.querySelector(':scope > .lf-shot-btn');
    if (!on) { b?.remove(); return; }
    if (b) return;
    b = document.createElement('div');
    b.className = 'mes_button lf-shot-btn';
    b.title = 'Кадр в этот момент';
    b.innerHTML = icon('film');
    const edit = mb.querySelector(':scope > .mes_edit');
    if (edit) edit.before(b); else mb.append(b);
}

// кат-сцены в посте листаются сами, пока видны на экране
let tick = null;
function tickOn() {
    if (tick) return;
    tick = setInterval(() => {
        const ps = document.querySelectorAll('#chat .lf-shot.cut.play');
        if (!ps.length) return;
        ps.forEach(fig => step(fig, 1));
    }, 5600);
}
function step(fig, d) {
    const fs = [...fig.querySelectorAll('.lf-shot-f')];
    if (fs.length < 2) return;
    const k = (fs.findIndex(x => x.classList.contains('on')) + d + fs.length) % fs.length;
    fs.forEach((x, j) => { x.classList.toggle('on', j === k); if (j === k) { x.style.animation = 'none'; void x.offsetWidth; x.style.animation = ''; } });
    fig.querySelectorAll('.lf-shot-sub span').forEach((x, j) => x.classList.toggle('on', j === k));
    fig.querySelectorAll('.lf-shot-dots b').forEach((x, j) => x.classList.toggle('on', j === k));
}

// ───── клики ─────

/** true — клик был по кадру или кнопке 🎬, дальше не передавать. */
export function onShotClick(ev) {
    const pb = ev.target.closest('.lf-shot-btn');
    if (pb) {
        ev.preventDefault(); ev.stopPropagation();
        const i = Number(pb.closest('.mes[mesid]')?.getAttribute('mesid'));
        if (Number.isFinite(i)) shoot(i, { kind: 'frame' });
        return true;
    }
    const fig = ev.target.closest('.lf-shot, .lf-shot-sug, .lf-shot-pick');
    if (!fig) return false;
    ev.stopPropagation();
    if (ev.target.closest('input')) return true; // поле «что поправить» — дать фокус
    ev.preventDefault();
    if (fig.classList.contains('wait')) return true;
    const i = Number(fig.closest('.mes[mesid]')?.getAttribute('mesid'));
    const b = ev.target.closest('[data-sh]');
    const act = b?.dataset.sh || '';
    if (fig.classList.contains('lf-shot-sug')) {
        const e = A.chronOf(i);
        if (!e?.shot) return true;
        if (act === 'sug-x') { e.shotX = true; A.saveMeta(); A.repaint(); return true; }
        if (act === 'sug-frame' || act === 'sug-cut') shoot(i, { kind: act === 'sug-cut' ? 'cut' : 'frame', at: e.shot.at, caption: e.shot.caption, sug: true });
        return true;
    }
    if (fig.classList.contains('lf-shot-pick')) { pickClick(fig, act, b); return true; }
    const c = list().find(x => x.id === fig.dataset.shot);
    if (!c) return true;
    if (act === 'del') { if (confirm(c.kind === 'cut' ? 'Убрать кат-сцену из поста?' : 'Убрать кадр из поста?')) { A.chatMeta().cuts = list().filter(x => x.id !== c.id); A.saveMeta(); A.repaint(); } return true; }
    if (act === 'up' || act === 'down') { move(c, fig, act === 'up' ? -1 : 1); return true; }
    if (act === 'redo') {
        pick = pick?.id === c.id ? null : { id: c.id, style: c.style || chatStyle(), fix: c.fix || '' };
        A.repaint();
        if (pick) requestAnimationFrame(() => fig.parentNode?.querySelector(':scope > .lf-shot-pick')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
        return true;
    }
    if (act === 'grow') { shoot(i, { kind: 'cut', at: c.at, caption: c.frames[0]?.caption, replace: c.id }); return true; }
    if (c.kind === 'cut') playCut(c, { music: A.cutMusic(c) });
    else { const f = c.frames[0]; lightbox(f.img, f.caption || c.title || '', null, A.settings().detail?.motion !== false ? (f.motion || 'drift') : ''); }
    return true;
}

function pickClick(box, act, b) {
    if (!pick) return;
    const c = list().find(x => x.id === pick.id);
    pick.fix = box.querySelector('.lf-shot-fix')?.value?.trim() || '';
    if (act === 'pk-x' || !c) { pick = null; A.repaint(); return; }
    if (act === 'pk-style') { if (b?.dataset.v) pick.style = b.dataset.v; A.repaint(); return; }
    const { style, fix } = pick;
    pick = null;
    if (act === 'pk-go') redraw(c, { style, fix });
    if (act === 'pk-new') shoot(c.mes, { kind: c.kind, at: c.at, caption: c.frames[0]?.caption, replace: c.id, style, fix });
}

function move(c, fig, d) {
    const mt = fig.closest('.mes_text');
    if (!mt) return;
    const blocks = blocksOf(mt);
    let k = -1;
    for (let p = fig.previousElementSibling; p; p = p.previousElementSibling) { k = blocks.indexOf(p); if (k >= 0) break; }
    const nk = Math.max(0, Math.min(blocks.length - 1, k + d));
    if (nk === k) { A.toast('info', d < 0 ? 'Выше уже некуда' : 'Это уже конец поста'); return; }
    c.at = snippet(blocks[nk].textContent);
    c.para = nk;
    A.saveMeta();
    A.repaint();
    requestAnimationFrame(() => mt.querySelector(`[data-shot="${CSS.escape(c.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

// ───── съёмка ─────

const SHOT_SYSTEM = (kind) => `You are a film director's storyboard assistant for an illustrated roleplay story. The post is split into numbered paragraphs.
Return ONLY JSON: {"para":2,"title":"2-4 Russian words, name of the moment","frames":[{"title":"Russian frame label, 1-3 words","who":["exact names of people in the frame"],"caption":"one short Russian line from or about this moment, max 90 chars","motion":"${MOTIONS.join('|')}","prompt":"English image prompt, 45-70 words: shot type and angle, who is in frame BY NAME ONLY (never describe their faces, hair, eye or skin colour), pose, gesture, expression, clothing as listed, setting, light, weather, mood; do not name an art style"}]}
para — the number of the paragraph where the moment happens; the picture goes right after it.
${kind === 'cut'
        ? 'Make 3 or 4 frames that show this moment unfolding like a short film scene: first a wider shot of the place and the people, then closer shots of the key gestures and reactions, ending on the strongest beat. The frames are cuts of one continuous moment.'
        : 'Make exactly 1 frame: the single strongest image of this moment — the shot a director would put on the poster for this scene.'}
Follow the story exactly: same place, time of day, weather, clothes, who is present and where they stand. motion — what moves in the frame: rain on glass rain, falling snow snow, coffee steam steam, cigarette smoke smoke, candle or neon flicker, warm lamp or sun glow, slow breathing pulse, heartbeat heartbeat, otherwise drift.
Intimate or sexual moments: only atmosphere and emotion — faces close, foreheads touching, hands, silhouettes against a window, tangled sheets in shadow; everyone clothed or covered; no nudity, no underwear, nothing explicit. Violence: no gore.`;

/** Место, время, погода на момент поста i (а не сейчас). */
function stateAt(i) {
    const chat = A.chatArr();
    const st = A.worldState();
    let loc = '', date = '', time = '', atm = '';
    for (let j = i; j >= 0 && !(loc && time); j--) {
        const h = chat[j]?.horae_meta;
        if (!h) continue;
        loc = loc || h.scene?.location || '';
        atm = atm || h.scene?.atmosphere || '';
        time = time || h.timestamp?.story_time || '';
        date = date || h.timestamp?.story_date || '';
    }
    return { loc: loc || st.scene?.location || '', atm: atm || st.scene?.atmosphere || '', time: time || st.timestamp?.story_time || '', date: date || st.timestamp?.story_date || '', st };
}

function clothesLine(st) {
    const out = [];
    for (const n of A.castNames(st)) {
        const hc = String(Object.entries(st.costumes || {}).find(([k]) => A.sameName(k, n))?.[1] || '');
        const have = nz(hc);
        const wd = (A.wardrobeWorn(n) || []).map(x => x?.name).filter(x => x && !have.includes(nz(x))); // Гардероб — только то, чего Horae не написал
        const v = [hc, wd.join(', ')].filter(Boolean).join('; ');
        if (v) out.push(`${n}: ${A.cut(v, 220)}`);
    }
    return out.join('\n');
}

function sexNow(i) {
    try {
        const e = A.chronOf(i);
        if (e?.scene?.intim === 2 && !e.scene.end) return true;
        return i === A.lastAiIndex() && moodNow().intimOn;
    } catch { return false; }
}

async function refsFor(who, loc) {
    const refs = [];
    const faces = [];
    for (const n of who.slice(0, 2)) {
        try { const r = await A.faceRef(n); if (r) { refs.push(r); faces.push(n); } } catch { /* без лица */ }
    }
    let place = false;
    const cover = loc ? A.placeCover(loc) : '';
    if (cover) { try { const r = await A.refData(cover, 768); if (r) { refs.push(r); place = true; } } catch { /* без места */ } }
    const note = refs.length ? `Reference images, in order: ${[...faces.map(n => `${n} (keep the face recognisable)`), ...(place ? ['the place (keep its look and light)'] : [])].join(', ')}.\n` : '';
    return { refs, note };
}

function imagePrompt(f, note, sex, sid, fix) {
    return `${f.prompt}${fix ? `\nCorrection from the player (follow it exactly): ${fix}` : ''}\n${note}${note ? 'The references are only for who is who and what the place looks like — draw everything in the style below, even if they look different.\n' : ''}Style: ${styleText(sid)}.\n16:9 frame, film-like composition, no text, no letterbox, no watermark. No nudity, no lingerie${sex ? '; tasteful and atmospheric: clothed or covered, the emotion carried by faces, hands and light' : ''}.`;
}

/**
 * Снять кадр или кат-сцену к посту i. at — слова абзаца (подсказка Летописца или старый кадр);
 * нет — модель сама выбирает момент. replace — id кадра, который станет этой кат-сценой.
 */
export async function shoot(i, { kind = 'frame', at = '', caption = '', sug = false, replace = '', play = false, onStep = null, style = '', fix = '' } = {}) {
    const chat = A.chatArr();
    const m = chat[i];
    if (!m) return null;
    const key = shotKey(i);
    if ([...busy.values()].some(w => w.key === key && w.kind === kind && w.at === at)) return null;
    const id = A.uid();
    const sid = styleById(style || chatStyle())[0];
    const ps = paragraphs(A.plainText(m.mes));
    let para = at ? locate(ps, at) : -1;
    const w = { key, kind, at: at || '', para, step: 0, total: kind === 'cut' ? 4 : 1, label: 'раскадровка…', sug };
    busy.set(id, w);
    const upd = (label, frac) => { w.label = label; A.repaint(); onStep?.(label, frac); };
    upd('раскадровка…', 0.1);
    try {
        const { loc, atm, time, date, st } = stateAt(i);
        const sex = sexNow(i);
        const numbered = ps.map((p, k) => `[${k + 1}] ${A.cut(p, 900)}`).join('\n');
        const hint = para >= 0
            ? `The moment to show: paragraph ${para + 1} — «${A.cut(at, 160)}»${caption ? ` (${caption})` : ''}.`
            : 'Pick the single most cinematic moment of the post yourself.';
        const user = [
            `Place: ${loc || '?'}. Time: ${time || '?'}${date ? `, ${date}` : ''}. Weather: ${atm || '?'}.`,
            `People in the story: ${A.castNames(st).join(', ')}.`,
            `Clothes now:\n${clothesLine(st) || '?'}`,
            sex ? 'Right now the scene is sexual — keep the picture atmospheric and covered.' : '',
            hint,
            fix ? `Player's correction for the picture: ${fix}` : '',
            '',
            `POST by ${m.name}:\n${A.cut(numbered, 7000)}`,
        ].filter(x => x !== '').join('\n');
        const raw = await A.askModel([{ role: 'system', content: SHOT_SYSTEM(kind) }, { role: 'user', content: user }], 1800);
        const j = A.extractJson(raw);
        const frames = (Array.isArray(j?.frames) ? j.frames : []).filter(f => String(f?.prompt || '').length > 20).slice(0, kind === 'cut' ? 4 : 1);
        if (!frames.length) throw new Error('раскадровка не вышла');
        if (para < 0) {
            const p = Math.round(Number(j?.para)) - 1;
            para = p >= 0 && p < ps.length ? p : ps.length - 1;
        }
        w.para = para;
        w.at = at || snippet(ps[para] || '');
        w.total = frames.length;
        const obj = { id, key, mes: i, sig: sigOf(m), kind, style: sid, fix: fix || '', at: w.at, para, title: String(j?.title || caption || (kind === 'cut' ? 'Кат-сцена' : 'Кадр')).slice(0, 40), ts: Date.now(), frames: [] };
        for (let k = 0; k < frames.length; k++) {
            upd(frames.length > 1 ? `кадр ${k + 1} из ${frames.length}…` : 'рисую…', (k + 1) / (frames.length + 1));
            const f = frames[k];
            const who = (Array.isArray(f.who) ? f.who : []).map(A.canonName).filter(Boolean);
            const { refs, note } = await refsFor(who, loc);
            const img = await A.drawPicture(imagePrompt(f, note, sex, sid, fix), { aspect: '16:9', refs, prefix: kind === 'cut' ? 'life_cut' : 'life_shot', max: 1600 });
            const mo = String(f.motion || '').toLowerCase();
            obj.frames.push({ title: String(f.title || '').slice(0, 30), caption: String(f.caption || '').slice(0, 120), img, prompt: String(f.prompt).slice(0, 900), who, motion: MOTIONS.includes(mo) ? mo : 'drift' });
        }
        if (A.chatArr()[i] !== m) throw new Error('чат сменился, пока снимала');
        const cm = A.chatMeta();
        cm.cuts = [...list().filter(x => x.id !== replace), obj].slice(-300);
        if (sug) { const e = A.chronOf(i); if (e) e.shotUsed = true; }
        A.saveMeta();
        busy.delete(id);
        A.repaint();
        if (play && kind === 'cut') playCut(obj, { music: A.cutMusic(obj) });
        else if (kind === 'cut') A.toast('success', 'Тапни по ней — откроется на весь экран с музыкой', '✦ Кат-сцена готова', { timeOut: 3500 });
        return obj;
    } catch (e) {
        busy.delete(id);
        A.repaint();
        A.toast('error', A.esc(String(e?.message || e)), kind === 'cut' ? '✦ Кат-сцена' : '✦ Кадр');
        return null;
    }
}

/** Перерисовать те же кадры по тем же раскадровкам. */
async function redraw(c, { style = '', fix = '' } = {}) {
    const i = c.mes;
    const key = c.key;
    if ([...busy.values()].some(w => w.key === key && w.redo === c.id)) return;
    const w = { key, kind: c.kind, at: c.at, para: c.para, label: 'перерисовываю…', redo: c.id };
    const id = A.uid();
    busy.set(id, w);
    const hidden = c.frames;
    A.repaint();
    try {
        const { loc } = stateAt(i);
        const sex = sexNow(i);
        const sid = styleById(style || c.style || chatStyle())[0];
        const out = [];
        for (let k = 0; k < hidden.length; k++) {
            w.label = hidden.length > 1 ? `кадр ${k + 1} из ${hidden.length}…` : 'перерисовываю…';
            A.repaint();
            const f = hidden[k];
            const { refs, note } = await refsFor(f.who || [], loc);
            out.push({ ...f, img: await A.drawPicture(imagePrompt(f, note, sex, sid, fix), { aspect: '16:9', refs, prefix: c.kind === 'cut' ? 'life_cut' : 'life_shot', max: 1600 }) });
        }
        c.frames = out;
        c.style = sid;
        c.fix = fix;
    } catch (e) {
        A.toast('error', A.esc(String(e?.message || e)), '✦ Кадр');
    } finally {
        busy.delete(id);
        A.saveMeta();
        A.repaint();
    }
}

export function shotsBusy() { return busy.size; }

/** Режиссёр: стиль кадров в этом чате. */
export function shotAct(act, el) {
    if (act === 'sh-chat-style') {
        const cm = A.chatMeta();
        cm.shotStyle = el.dataset.v;
        A.saveMeta();
        A.toast('info', `${styleName(cm.shotStyle)} — для новых кадров и деталей в этом чате. Готовые — ↻ на кадре.`, '✦ Стиль кадров', { timeOut: 2600 });
    }
}
