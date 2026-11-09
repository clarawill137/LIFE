// «Покажи им». Картинка в твоём посте (вложение или нарисованная SLAY) — модель Летописца её разглядывает,
// и персонажи в ответе реагируют на то, что на ней: детали, текст, лица, а не «какая милая фотография».
// Под постом — чип «👁 видят: …» (↻ — разглядеть заново, ✕ — не показывать).

let A = null;
export function initSee(api) { A = api; }

const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.see || typeof s.see !== 'object') s.see = {};
    const c = s.see;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.wait)) c.wait = 20;
    return c;
}
export const seeOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.see || typeof cm.see !== 'object') cm.see = {};
    return cm.see;
}
const keyOf = (i) => { const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}:${imagesOf(m).length}` : ''; };

/** Картинки сообщения: вложения таверны и <img> в тексте. */
export function imagesOf(m) {
    if (!m) return [];
    const out = [];
    const add = (u) => { u = String(u || '').trim(); if (u && !out.includes(u) && !/\.(svg)$/i.test(u)) out.push(u); };
    const x = m.extra || {};
    add(x.image);
    add(x.inline_image);
    for (const f of [...(Array.isArray(x.media) ? x.media : []), ...(Array.isArray(x.files) ? x.files : []), ...(Array.isArray(x.images) ? x.images : [])]) {
        if (typeof f === 'string') add(f);
        else if (f && (/image/i.test(f.type || f.mime || '') || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(f.url || f.path || ''))) add(f.url || f.path);
    }
    for (const mm of String(m.mes || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) add(mm[1]);
    for (const mm of String(m.mes || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) add(mm[1]);
    return out.slice(0, 3);
}

const pending = new Map();

const SYSTEM = `Ты — глаза персонажей ролевой истории (русский). Игрок прикрепил к посту картинку — персонажи её сейчас видят.
Опиши, что на ней, для тех, кто будет на неё реагировать: что и кто изображены, детали, которые бросаются в глаза, текст на картинке (дословно), настроение, что тут смешного, трогательного или тревожного. Если на ней кто-то из героев истории (по списку) — скажи, кто похож. 2–5 предложений, только то, что видно, без домыслов.
Ответь только JSON: {"what":"описание","who":["кто из героев похож, если есть"],"hook":"на что они скорее всего отреагируют, 4–12 слов"}`;

async function describe(i) {
    const m = A.chatArr()[i];
    const list = imagesOf(m);
    if (!list.length) return null;
    const key = keyOf(i);
    const parts = [{ type: 'text', text: `Пост игрока (для контекста): ${A.cut(A.plainText(m.mes || ''), 900) || '(без текста)'}\nГерои истории: ${A.groupMembers().map(A.canonName).join(', ')}` }];
    for (const u of list) {
        try { const d = await A.refData(u, 1024); if (d) parts.push({ type: 'image_url', image_url: { url: d } }); } catch (e) { console.warn('[Life] покажи им: картинка', e); }
    }
    if (parts.length < 2) return null;
    const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: parts }], 700);
    const j = A.extractJson(out);
    const what = String(j?.what || '').trim();
    if (!what) throw new Error('модель не описала картинку — похоже, профиль Летописца не видит картинок');
    const rec = { what: what.slice(0, 900), who: (Array.isArray(j.who) ? j.who : []).map(String).filter(Boolean).slice(0, 4), hook: String(j.hook || '').trim().slice(0, 120), at: Date.now(), n: list.length };
    M()[key] = rec;
    A.saveMeta();
    return rec;
}

/** Пост игрока отправлен — сразу разглядывать, пока таверна собирает генерацию. */
export function seeWarm(i) {
    if (!seeOn()) return;
    const m = A.chatArr()[i];
    if (!m?.is_user || !imagesOf(m).length) return;
    const key = keyOf(i);
    if (M()[key] || pending.has(key)) return;
    const p = describe(i).catch(e => { console.warn('[Life] покажи им', e); A.toast('warning', esc(String(e?.message || e)), '👁 Покажи им', { timeOut: 6000 }); return null; }).finally(() => { pending.delete(key); A.paintSoon?.(); });
    pending.set(key, p);
    A.paintSoon?.();
}

function userIndexFor(type) {
    const chat = A.chatArr();
    let end = chat.length - 1;
    if (type === 'swipe') end = chat.length - 2;
    for (let i = end; i >= 0; i--) { const m = chat[i]; if (!m || m.is_system) continue; return m.is_user ? i : -1; }
    return -1;
}

/** Перед ответом: дождаться описания (не дольше нескольких секунд). */
export async function seeReady(type) {
    if (!seeOn() || type === 'quiet' || type === 'impersonate') return;
    const i = userIndexFor(type);
    if (i < 0) return;
    const m = A.chatArr()[i];
    if (!imagesOf(m).length) return;
    const key = keyOf(i);
    if (!M()[key] && !pending.has(key)) seeWarm(i);
    const p = pending.get(key);
    if (p) await Promise.race([p, new Promise(res => setTimeout(res, cfg().wait * 1000))]);
}

export function seePrompt(type) {
    if (!A?.hasChat?.() || !seeOn() || type === 'quiet' || type === 'impersonate') return '';
    const i = userIndexFor(type || 'normal');
    if (i < 0) return '';
    const rec = M()[keyOf(i)];
    if (!rec || rec.off) return '';
    const user = A.shortName(A.canonName(A.ctx().name1));
    return `[${user} показывает картинку — персонажи её видят: ${rec.what}${rec.who?.length ? ` (похоже на: ${rec.who.join(', ')})` : ''}. Реагируйте на конкретное, что на ней, а не общими словами${rec.hook ? `; скорее всего зацепит: ${rec.hook}` : ''}.]`;
}

// ───────────── под постом ─────────────

export function paintSee(el, id) {
    const old = el.querySelector(':scope .lf-see');
    const m = A.chatArr()[id];
    if (!seeOn() || !m?.is_user || !imagesOf(m).length) { old?.remove(); return; }
    const key = keyOf(id);
    const rec = M()[key];
    const busy = pending.has(key);
    const html = busy && !rec ? `<div class="lf-see lf-own busy">👁 <span>разглядывают картинку…</span></div>`
        : rec ? `<div class="lf-see lf-own${rec.off ? ' off' : ''}">👁 <span><b>видят:</b> ${esc(A.cut(rec.what, 160))}</span><button data-act="see-redo" data-mes="${id}" title="разглядеть заново">↻</button><button data-act="see-off" data-mes="${id}" title="${rec.off ? 'показывать' : 'не показывать'}">${rec.off ? '◉' : '✕'}</button></div>`
            : `<div class="lf-see lf-own"><button data-act="see-redo" data-mes="${id}">👁 Покажи им</button></div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

export async function seeClick(act, el) {
    if (!act.startsWith('see-')) return false;
    const i = Number(el.dataset.mes);
    const key = keyOf(i);
    if (act === 'see-off') { const r = M()[key]; if (r) { r.off = !r.off; A.saveMeta(); A.updatePrompt(); } A.paintSoon?.(); return true; }
    if (act === 'see-redo') { delete M()[key]; seeWarm(i); return true; }
    return false;
}
