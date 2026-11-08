// Карточки GC-«артефактов» (<art> в посте — их рисует скрипт Tavern Helper «Движок артефактов») с картинкой SLAY.
// Бывает, фото в карточке так и висит «проявляется…»: SLAY дорисовал позже, чем движок перестал ждать
// (он ждёт ~2,5 минуты), или перерисовка поста унесла картинку из чата, или рисовать её никто не начал.
// Life:
//  1) SLAY уже дорисовал (в тексте поста настоящий путь), а карточка не видит — просит движок перерисовать;
//  2) не дорисовал и никто не рисует — кнопка «проявить»: картинку для карточки даёт модуль
//     (Зёрнышко — свой снимок УЗИ), иначе Life рисует сама по промпту из карточки;
//  3) новый пост с карточкой, для которой у модуля есть своя картинка (Зёрнышко — снимок УЗИ на этот срок),
//     — сразу ставит её, до SLAY: в сцене показывают тот самый снимок, что видят боты.

let A = null;
const busy = new Set();   // посты, где сейчас проявляем
const healed = new Set(); // уже просили движок перерисовать (пост|пути)
const BLOCK = /<art\b([^>]*)>([\s\S]*?)<\/art>/gi;
const IMG = /<img\b[^>]*>/gi;
const WAIT_MS = 150e3; // столько ждём SLAY, прежде чем дать кнопку

export function initArt(api) {
    A = api;
    setInterval(() => { try { tick(); } catch (e) { console.warn('[Life] карточки', e); } }, 4000);
}

const on = () => { const s = A?.settings?.(); return !!s && s.enabled !== false && s.artFix !== false; };

function attrs(s) {
    const o = {};
    const re = /([\w-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(s || ''))) o[m[1].toLowerCase()] = m[2];
    return o;
}

/** Карточки поста по порядку: { full, attrs, body, img: { tag, src, ins } | null }. Разбор — как у самого движка. */
export function artBlocks(text) {
    const s = String(text || '');
    const out = [];
    const re = new RegExp(BLOCK.source, 'gi');
    let m;
    while ((m = re.exec(s))) {
        let full = m[0];
        let t = (m[2].match(IMG) || [])[0] || '';
        if (!t) { // модель поставила картинку сразу за карточкой — движок всё равно заберёт её в карточку
            const nx = s.slice(m.index + m[0].length).match(/^\s*(<img\b[^>]*data-iig-instruction[^>]*>)/i);
            if (nx) { t = nx[1]; full = m[0] + nx[0]; }
        }
        const img = t ? {
            tag: t,
            src: (t.match(/\bsrc\s*=\s*["']([^"']*)["']/i) || [])[1] || '',
            ins: (t.match(/data-iig-instruction\s*=\s*'([^']*)'/i) || t.match(/data-iig-instruction\s*=\s*"([^"]*)"/i) || [])[1] || '',
        } : null;
        out.push({ full, attrs: attrs(m[1]), body: m[2], img });
    }
    return out;
}

// настоящая картинка: не заглушка [IMG:GEN] и не значок ошибки SLAY
const isPath = (src) => !!src && !/\[IMG:/i.test(src) && !/error\.svg/i.test(src) && src !== '#';
const waiting = (b) => !b.img || !isPath(b.img.src);

function parseIns(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/&quot;|&#34;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');
    try { const j = JSON.parse(s); if (j && typeof j === 'object') return j; } catch { /* ниже — по кускам */ }
    const pr = s.match(/"prompt"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"|})/);
    if (!pr) return null;
    return { prompt: pr[1], style: (s.match(/"style"\s*:\s*"([^"]*)"/) || [])[1] || '', aspect_ratio: (s.match(/"aspect_ratio"\s*:\s*"([^"]*)"/) || [])[1] || '' };
}

/** Текст карточки для модулей: тип, подписи, строки, промпт картинки. */
function textOf(b) {
    const a = b.attrs;
    const lines = b.body.replace(IMG, ' ').replace(/<[^>]+>/g, ' ');
    const p = parseIns(b.img?.ins)?.prompt || '';
    return [a.type, a.title, a.caption, a.meta, a.date, a.time, lines, p].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
}

const own = (i, b, auto = false) => { try { return A.artImage?.({ i, text: textOf(b), attrs: b.attrs, auto }) || null; } catch { return null; } };

/** Инструкция картинки для движка: без неё он не забирает <img> в карточку — и картинка висит в посте второй раз. */
function insAttr(prompt) {
    const p = String(prompt || 'photo').replace(/\s+/g, ' ').trim().slice(0, 400);
    return JSON.stringify({ style: 'photo', prompt: p, aspect_ratio: '4:3' }).replace(/'/g, '’').replace(/</g, '‹').replace(/>/g, '›');
}

function withSrc(tag, src, prompt) {
    let t = /\bsrc\s*=/i.test(tag)
        ? tag.replace(/\bsrc\s*=\s*(["'])[^"']*\1/i, () => `src="${src}"`)
        : tag.replace(/^<img\b/i, () => `<img src="${src}"`);
    if (!/data-iig-instruction\s*=/i.test(t)) t = t.replace(/^<img\b/i, () => `<img data-iig-instruction='${insAttr(prompt)}'`);
    return t;
}

/** Поставить картинку в карточку: src у её <img> (или новый <img>) — в тексте поста и во всех его копиях. */
function put(m, b, src, prompt = '') {
    const p = prompt || textOf(b);
    const nb = b.img
        ? b.full.replace(b.img.tag, () => withSrc(b.img.tag, src, p))
        : b.full.replace(/<\/art>\s*$/i, () => `${withSrc('<img>', src, p)}\n</art>`);
    if (nb === b.full) return false;
    const swap = (t) => (typeof t === 'string' && t.includes(b.full) ? t.replace(b.full, () => nb) : t);
    const old = m.mes;
    m.mes = swap(m.mes);
    if (m.extra && typeof m.extra.display_text === 'string') m.extra.display_text = swap(m.extra.display_text);
    if (Array.isArray(m.swipes)) m.swipes = m.swipes.map(swap);
    if (Array.isArray(m.swipe_info)) for (const si of m.swipe_info) if (si?.extra && typeof si.extra.display_text === 'string') si.extra.display_text = swap(si.extra.display_text);
    return m.mes !== old;
}

const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
const rendered = (i) => !!document.querySelector(`#chat .mes[mesid="${i}"]`);

/** Движок артефактов перерисовывает карточки по MESSAGE_UPDATED; full — сначала перерисовать сам пост из текста. */
async function refresh(i, m, full) {
    const c = A.ctx();
    if (full && rendered(i)) { try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] карточка: перерисовать пост', e); } }
    try { await c.eventSource.emit(c.eventTypes.MESSAGE_UPDATED, i); } catch { /* */ }
}

function age(m) {
    const g = m?.gen_finished || m?.send_date;
    const t = g instanceof Date ? g.getTime() : typeof g === 'number' ? g : Date.parse(g || '');
    return Number.isFinite(t) ? Date.now() - t : Infinity;
}

function tick() {
    if (!A || document.hidden || !on()) return;
    const phs = document.querySelectorAll('#chat .mes[mesid] .gca-ph');
    if (!phs.length) return;
    const seen = new Set();
    for (const ph of phs) {
        const el = ph.closest('.mes[mesid]');
        const i = Number(el?.getAttribute('mesid'));
        if (!Number.isFinite(i) || seen.has(i)) continue;
        seen.add(i);
        scan(i, el);
    }
}

function scan(i, el) {
    const m = A.ctx().chat?.[i];
    if (!m || typeof m.mes !== 'string' || busy.has(i)) return;
    const blocks = artBlocks(m.mes);
    if (!blocks.length) return;
    const cards = [...el.querySelectorAll('.mes_text .gca')];
    const slay = !!el.querySelector('.iig-loading-placeholder, .iig-regen-overlay'); // SLAY рисует прямо сейчас
    let heal = '';
    cards.forEach((card, n) => {
        const ph = card.querySelector('.gca-ph');
        if (!ph) return;
        // какая это карточка в тексте: по подписи, иначе по порядку (движок ставит их в порядке текста)
        const cap = norm(card.querySelector('.cap')?.textContent);
        let k = cap ? blocks.findIndex(x => norm(x.attrs.caption) === cap) : -1;
        if (k < 0) k = n;
        const b = blocks[k];
        if (!b) return;
        if (!waiting(b)) { heal += `${k}:${b.img.src};`; return; }
        if (slay || age(m) < WAIT_MS || ph.querySelector('.lf-gca-dev')) return;
        const o = own(i, b);
        ph.classList.add('lf-gca-stuck');
        ph.innerHTML = `<span>не проявилось</span><button type="button" class="lf-gca-dev" data-mes="${i}" data-k="${k}">${o ? `${A.icon('image')} ${A.esc(o.label || 'вставить снимок')}` : `${A.icon('refresh')} проявить`}</button>`;
    });
    if (heal) {
        const sig = `${i}|${heal}`;
        if (!healed.has(sig)) { healed.add(sig); refresh(i, m, false); }
    }
}

/** Клик по «проявить» в чате. true — клик наш. */
export function onArtClick(ev) {
    const b = ev.target.closest?.('.lf-gca-dev');
    if (!b) return false;
    ev.preventDefault();
    ev.stopPropagation();
    develop(Number(b.dataset.mes), Number(b.dataset.k), b);
    return true;
}

async function develop(i, k, btn) {
    const c = A.ctx();
    const chat = c.chat;
    const m = chat?.[i];
    if (!m || busy.has(i)) return;
    const b = artBlocks(m.mes)[k];
    if (!b) return;
    busy.add(i);
    const ph = btn.closest('.gca-ph');
    if (ph) ph.innerHTML = '<span>проявляю…</span>';
    try {
        const o = own(i, b);
        let src = o?.src || '';
        let what = o?.prompt || '';
        if (!src) {
            const ins = parseIns(b.img?.ins);
            what = ins?.prompt || `Photo for a story scene: ${textOf(b)}`;
            const style = ins?.style ? `\nStyle: ${String(ins.style).replace(/_/g, ' ')}.` : '';
            src = await A.drawPicture(`${what}${style}\nNo text, no letters, no watermark.`, { aspect: ins?.aspect_ratio || '4:3', prefix: 'life_art', max: 1600 });
        }
        if (A.ctx().chat !== chat || chat[i] !== m) return; // сменили чат или пост
        const b2 = artBlocks(m.mes)[k];
        if (!b2 || !waiting(b2)) { await refresh(i, m, true); return; } // пока рисовала — дорисовал SLAY
        const old = m.mes;
        if (!put(m, b2, src, what)) return;
        try { A.rekeyMessage?.(i, old); } catch { /* */ }
        await A.ctx().saveChat();
        await refresh(i, m, true);
        A.toast('success', o ? 'В карточке — снимок из Зёрнышка.' : 'Проявилось.', '✦ Life', { timeOut: 2500 });
    } catch (e) {
        console.warn('[Life] проявить', e);
        A.toast('warning', A.esc(String(e?.message || e)), '✦ Life: не проявилось', { timeOut: 6000 });
        if (ph?.isConnected) ph.innerHTML = '<span>не проявилось</span>'; // кнопку вернёт tick
    } finally {
        busy.delete(i);
    }
}

/** Новый пост (MESSAGE_RECEIVED, до SLAY): карточке, для которой у модуля есть своя картинка, — сразу её. */
export function artOnReceived(i) {
    if (!A || !on()) return;
    const c = A.ctx();
    const m = c.chat?.[i];
    if (!m || m.is_user || typeof m.mes !== 'string' || !/<art\b/i.test(m.mes)) return;
    let n = 0;
    for (const b of artBlocks(m.mes)) {
        if (!b.img || isPath(b.img.src)) continue; // картинку модель не просила или она уже есть
        const o = own(i, b, true);
        if (o?.src && put(m, b, o.src, o.prompt)) n++;
    }
    if (!n) return;
    if (rendered(i)) { try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] карточка: перерисовать пост', e); } }
    console.info(`[Life] пост #${i}: в карточку — своя картинка модуля (${n})`);
}

/**
 * Открыли чат: картинка в карточке без инструкции (так её вставляла 0.18.11, бывает и у модели) — движок не забирает её
 * в карточку, и она висит в посте второй раз. Дописать инструкцию и перерисовать только такие посты (из последних 30).
 * Без сохранения — правка уедет со следующим.
 */
export function artTidy() {
    if (!A || !on()) return 0;
    const chat = A.ctx().chat || [];
    let k = 0;
    for (let i = Math.max(0, chat.length - 30); i < chat.length; i++) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !/<art\b/i.test(m.mes)) continue;
        const old = m.mes;
        let n = 0;
        for (const b of artBlocks(m.mes)) if (b.img && !b.img.ins && isPath(b.img.src) && put(m, b, b.img.src)) n++;
        if (!n) continue;
        k++;
        try { A.rekeyMessage?.(i, old); } catch { /* */ }
        if (rendered(i)) refresh(i, m, true);
        console.info(`[Life] пост #${i}: картинке в карточке дописана инструкция — второй копии не будет`);
    }
    return k;
}
