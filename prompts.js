// «Промты» — менеджер промтов картинок (0.59).
// У любой картинки в посте — ✎: окно, где виден её промт. Его можно поправить руками или сказать словами
// («ближе кадр», «она в красном») — Летописец переведёт это на язык той рисовалки, что сейчас выбрана в SLAY:
// Nano Banana, GPT Image, Grok, FLUX и NovelAI пишутся по-разному (pmtags.js → DIALECTS).
// Правка остаётся в самом посте: следующий ↻ рисует уже по ней, повторять её не надо. Версии промта и картинок
// хранятся в чате — к любой можно вернуться. Не нарисовалось — в окне причина и «смягчить под фильтр».
// Рисует тот же SLAY, его же кнопкой (со всеми рефами, стилем и описаниями); фото в карточках GC — Гардероб, как и раньше.
// Там же «источники»: тип API, адрес, ключ и модель SLAY запоминаются под именем и переключаются тапом.
// Файлы SLAY не трогаются: всё через его настройки и кнопки, так что его обновление ничего не затрёт.

import { icon } from './icons.js';
import { artBlocks } from './art.js';
import {
    scanTags, tagState, withIns, withSrc, ordOf, replaceNth, sameButSrc, sigOf, parseIns, encodeIns, cleanPrompt,
    ASPECTS, imageModelOf, DIALECTS, dialectNote, explainError, sourceSnap, sourceIsCurrent,
} from './pmtags.js';

let A = null;
const esc = (v) => A.esc(v);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DRAW_MS = 6 * 60 * 1000; // дольше SLAY сам не ждёт

export function initPrompts(api) {
    A = api;
    hookToasts();
    setInterval(() => { try { sweep(); } catch (e) { console.warn('[Life] промты: сверка постов', e); } }, 3000);
    setTimeout(() => { try { firstSource(); } catch (e) { console.warn('[Life] промты: источник', e); } }, 7000);
}

function cfg() {
    const s = A.settings();
    if (!s.pm || typeof s.pm !== 'object') s.pm = {};
    const c = s.pm;
    if (c.on === undefined) c.on = true;           // ✎ на картинках
    if (c.auto === undefined) c.auto = true;       // после «поправить» сразу рисовать
    if (c.dialect === undefined) c.dialect = true; // подсказка основной модели: под какую рисовалку писать промт
    if (!Array.isArray(c.quick)) c.quick = [];     // свои быстрые правки
    if (typeof c.looks !== 'string') c.looks = ''; // приметы персонажей — для рисовалок без рефов
    return c;
}

const slay = () => A.ctx().extensionSettings?.slay_image_gen || null;
/** Какая рисовалка сейчас выбрана в SLAY. */
export const imageModel = () => imageModelOf(slay());
const looks = () => String(cfg().looks || '').trim() || String(slay()?.atlasCharacterPrompt || '').trim();

/** Заметка основной модели (в промпт ответа): как писать промт картинки под выбранную рисовалку. */
export function pmPrompt(type) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate' || !cfg().dialect) return '';
    const st = slay();
    if (!st || st.enabled === false) return '';
    return dialectNote(imageModelOf(st), A.cut(looks(), 700));
}

// ───────────── пост тот же, сменился только путь картинки ─────────────
// SLAY дорисовал или перерисовал картинку — в тексте поста поменялся путь, а с ним и ключ записи Летописца
// (он считается по тексту). Без переезда запись осиротела бы: пропали бы чипы, деталь, «что записал пост».

const seen = new Map(); // номер поста → { mes, sw }
let seenMeta = null;

function rekey(i, oldMes) {
    const m = A.chatArr()[i];
    if (!m || oldMes == null || oldMes === m.mes) return;
    const sw = m.swipe_id ?? 0;
    try { A.rekeyMessage?.(i, oldMes); } catch (e) { console.warn('[Life] промты: переезд записи', e); }
    const oldSuf = `${sw}:${A.hash(oldMes)}`;
    if (m.horae_meta?._lifeFix === oldSuf) m.horae_meta._lifeFix = `${sw}:${A.hash(m.mes)}`;
    seen.set(i, { mes: m.mes, sw });
}

function watch(i, m) {
    const cm = A.chatMeta();
    if (seenMeta !== cm) { seen.clear(); seenMeta = cm; }
    const sw = m.swipe_id ?? 0;
    const prev = seen.get(i);
    if (prev && prev.sw === sw && prev.mes !== m.mes && sameButSrc(prev.mes, m.mes)) { rekey(i, prev.mes); return; }
    seen.set(i, { mes: m.mes, sw });
    if (seen.size > 60) seen.delete(seen.keys().next().value);
}

function sweep() {
    if (!A?.hasChat?.() || document.hidden || A.settings().enabled === false) return;
    const chat = A.chatArr();
    for (let i = chat.length - 1, k = 0; i >= Math.max(0, chat.length - 30) && k < 10; i--) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) continue;
        k++;
        watch(i, m);
    }
}

// ───────────── картинка в тексте ↔ картинка на экране ─────────────

const mesEl = (i) => document.querySelector(`#chat .mes[mesid="${i}"]`);
const NODE_SEL = 'img[data-iig-instruction], video[data-iig-instruction], .iig-error-placeholder[data-iig-instruction]';
function nodesOf(i) {
    const mt = mesEl(i)?.querySelector('.mes_text');
    return mt ? [...mt.querySelectorAll(NODE_SEL)].filter(x => !x.closest('.lf-shot, .lf-detail')) : [];
}
const nodeSig = (x) => { const raw = x.getAttribute('data-iig-instruction') || ''; return sigOf(parseIns(raw), raw); };
const tagsOf = (i) => scanTags(A.chatArr()[i]?.mes);

/** Элемент на экране для k-го тега поста. */
function nodeFor(i, k, tags = tagsOf(i)) {
    const t = tags[k];
    if (!t) return null;
    const want = sigOf(t.data, t.raw);
    const ord = tags.slice(0, k).filter(x => sigOf(x.data, x.raw) === want).length;
    const nodes = nodesOf(i);
    return nodes.filter(x => nodeSig(x) === want)[ord] || (nodes.length === tags.length ? nodes[k] : null);
}

/** Какой по счёту тег поста стоит за элементом на экране. */
function tagIndexOf(i, node) {
    const tags = tagsOf(i);
    if (!tags.length) return -1;
    const nodes = nodesOf(i);
    const want = nodeSig(node);
    const ord = nodes.filter(x => nodeSig(x) === want).indexOf(node);
    const same = tags.map((t, k) => [t, k]).filter(([t]) => sigOf(t.data, t.raw) === want);
    if (same[ord]) return same[ord][1];
    return nodes.length === tags.length ? nodes.indexOf(node) : -1;
}

/** Кнопка самого SLAY у этой картинки: ↻ на готовой или «Попробовать снова» на несостоявшейся. */
function slayCtl(node) {
    if (!node || slay()?.enabled === false) return null;
    if (node.matches('.iig-error-placeholder')) { const btn = node.querySelector('.iig-error-retry'); return btn ? { kind: 'retry', btn } : null; }
    if (node.tagName !== 'IMG') return null;
    const btn = node.closest('.iig-img-wrap')?.querySelector('.iig-regen-btn');
    return btn ? { kind: 'regen', btn } : null;
}

// ошибки SLAY живут только в его тостах — запоминаем последнюю, чтобы показать в окне причину
let lastSlayErr = null;
function hookToasts() {
    const t = globalThis.toastr;
    if (!t || t.__lifePm || typeof t.error !== 'function') return;
    const fn = t.error;
    t.error = function (message, title, ...rest) {
        try { if (/slay/i.test(String(title || ''))) lastSlayErr = { msg: String(message || '').replace(/^(Перегенерация упала|Ошибка):\s*/i, ''), at: Date.now() }; } catch { /* */ }
        return fn.call(this, message, title, ...rest);
    };
    t.__lifePm = true;
}

async function until(fn, ms, step = 200) {
    const end = Date.now() + ms;
    for (;;) {
        let v = null;
        try { v = fn(); } catch { /* ещё не готово */ }
        if (v) return v;
        if (Date.now() >= end) return null;
        await sleep(step);
    }
}

/** Пост перерисовать из текста: карточки GC и кнопки SLAY собираются заново. */
async function rerender(i) {
    const c = A.ctx();
    const m = c.chat?.[i];
    if (!m) return;
    if (mesEl(i)) { try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] промты: перерисовать пост', e); } }
    try { await c.eventSource.emit((c.eventTypes || c.event_types).MESSAGE_UPDATED, i); } catch { /* */ }
    A.paintSoon?.();
}

/** Заменить один тег в посте — в тексте, показе и текущем свайпе. */
function swapTag(i, m, t, nf) {
    const old = m.mes;
    const ord = ordOf(old, t);
    const fix = (s) => replaceNth(s, t.full, nf, ord);
    m.mes = old.slice(0, t.start) + nf + old.slice(t.end);
    const sw = m.swipe_id ?? 0;
    for (const x of [m.extra, Array.isArray(m.swipe_info) ? m.swipe_info[sw]?.extra : null]) {
        if (!x) continue;
        for (const f of ['display_text', 'extblocks']) if (typeof x[f] === 'string') x[f] = fix(x[f]);
    }
    if (Array.isArray(m.swipes) && typeof m.swipes[sw] === 'string') m.swipes[sw] = m.swipes[sw] === old ? m.mes : fix(m.swipes[sw]);
    rekey(i, old);
}

/** Рисует сам SLAY — его кнопкой, значит со всеми его рефами, стилем и описаниями. null — у картинки нет кнопки SLAY. */
async function slayDraw(i, k, onStep) {
    const m = A.chatArr()[i];
    let ctl = slayCtl(nodeFor(i, k));
    if (!ctl) {
        // после сохранения пост с несостоявшейся картинкой пересобирается — её плашка встаёт не сразу
        if (slay()?.enabled === false || tagState(tagsOf(i)[k]) !== 'error') return null;
        ctl = await until(() => slayCtl(nodeFor(i, k)), 4000);
        if (!ctl) return null;
    }
    const before = m.mes;
    const t0 = tagsOf(i)[k];
    const oldSrc = t0?.src || '';
    // ↻ SLAY читает промт с самой картинки на экране — там должен стоять ровно тот, что сейчас в посте
    if (ctl.kind === 'regen' && t0?.data) nodeFor(i, k)?.setAttribute('data-iig-instruction', encodeIns(t0.data));
    const started = Date.now();
    onStep?.('рисует SLAY…');
    ctl.btn.click();
    if (ctl.kind === 'regen') {
        await sleep(150);
        await until(() => !ctl.btn.classList.contains('iig-regen-busy'), DRAW_MS, 500);
    } else {
        const loading = () => !!mesEl(i)?.querySelector('.iig-loading-placeholder');
        await until(() => loading() || tagState(tagsOf(i)[k]) !== 'error', 3000, 150);
        await until(() => !loading(), DRAW_MS, 500);
        await sleep(400); // SLAY дописывает путь в пост и сохраняет чат
    }
    if (A.chatArr()[i] !== m) throw new Error('чат сменился, пока рисовалось');
    if (m.mes !== before) rekey(i, before);
    let t = tagsOf(i)[k];
    if (t && tagState(t) !== 'ok') {
        // SLAY нарисовал, а путь в пост не дописал: его «путь значка ошибки» не совпал с тем, что стоит в посте
        // (так бывает, если папку расширения переименовали) — после перезагрузки картинка снова стала бы ошибкой. Дописываем сами.
        const live = nodeFor(i, k);
        const got = live?.tagName === 'IMG' ? live.getAttribute('src') || '' : '';
        if (got && !/error\.svg|\[IMG:/i.test(got)) { swapTag(i, m, t, withSrc(t, got)); await A.ctx().saveChat(); t = tagsOf(i)[k]; }
    }
    if (t && tagState(t) === 'ok' && t.src !== oldSrc) return { src: t.src };
    const why = (lastSlayErr && lastSlayErr.at >= started ? lastSlayErr.msg : '')
        || nodeFor(i, k)?.querySelector?.('.iig-error-msg')?.getAttribute('title') || '';
    throw new Error(why || 'SLAY не нарисовал картинку');
}

/** Рисует Гардероб (как «проявить» у карточек): лица названных в промте — рефами. */
async function lifeDraw(i, cur, onStep) {
    const m = A.chatArr()[i];
    const d = cur()?.data;
    if (!m || !d?.prompt) throw new Error('у картинки нет промта');
    onStep?.('рисует Гардероб…');
    const im = imageModel();
    const refsOk = (DIALECTS[im.kind] || DIALECTS.generic).refs;
    const names = refsOk ? (A.namesInText?.(d.prompt) || []).slice(0, 3) : [];
    const refs = [], got = [];
    for (const n of names) {
        try { const r = await A.faceRef?.(n, 768); if (r) { refs.push(r); got.push(A.canonName?.(n) || n); } } catch { /* без рефа */ }
    }
    const note = refs.length ? `Reference images, in order: ${got.join(', ')} — keep each face, hair, skin tone, scars and marks exactly as in the reference; the references are only for who is who.\n` : '';
    const style = d.style && d.style !== 'photo' && im.kind !== 'nai' ? `Style: ${String(d.style).replace(/_/g, ' ')}.\n` : '';
    const tail = im.kind === 'nai' ? '' : 'No text, no letters, no watermark.';
    const src = await A.drawPicture(`${d.prompt}\n${note}${style}${tail}`.trim(), { aspect: d.aspect_ratio || d.aspectRatio || '4:3', prefix: 'life_pm', max: 1600, refs, who: names });
    if (A.chatArr()[i] !== m) throw new Error('чат сменился, пока рисовалось');
    const t = cur();
    if (!t) throw new Error('картинка пропала из поста');
    swapTag(i, m, t, withSrc(t, src));
    await A.ctx().saveChat();
    await rerender(i);
    return { src };
}

/** Картинка SLAY в посте (k-я по счёту): читать промт, сохранить, нарисовать, вернуть старую. */
function tagAdapter(i, k0) {
    let pm = tagsOf(i)[k0]?.data?.pm || '';
    const msg = () => A.chatArr()[i];
    // тег ищется заново при каждом обращении (текст поста меняется): по своей метке, иначе по номеру
    const pick = (ts) => (pm && ts.find(t => t.data?.pm === pm)) || ts[k0] || null;
    const cur = () => pick(tagsOf(i));
    const idx = () => { const ts = tagsOf(i); const t = pick(ts); return t ? ts.indexOf(t) : -1; };
    const inCard = () => { const t = cur(); const m = msg(); return !!t && !!m && /<art\b/i.test(m.mes) && artBlocks(m.mes).some(b => b.full.includes(t.full)); };
    const engine = () => (!inCard() && (slayCtl(nodeFor(i, idx())) || (tagState(cur()) === 'error' && slay()?.enabled !== false)) ? 'slay' : 'life');
    return {
        kind: 'post', mes: i,
        get title() { return `${inCard() ? 'фото в карточке' : 'картинка'} · пост #${i}`; },
        read() {
            const t = cur();
            if (!t?.data) return null;
            const state = tagState(t);
            const said = state === 'error' ? (nodeFor(i, idx())?.querySelector?.('.iig-error-msg')?.getAttribute('title') || 'Картинка не была сгенерирована') : '';
            return { prompt: String(t.data.prompt || ''), aspect: String(t.data.aspect_ratio || t.data.aspectRatio || ''), src: state === 'ok' ? t.src : '', state, error: said };
        },
        hid: () => (pm ? `t:${pm}` : ''),
        engine,
        extra() {
            // что рисовалка получит сверх этого промта — чтобы было видно, почему имена важны
            if (engine() !== 'slay') return 'Гардероб сам допишет: рефы лиц тех, кто назван по имени, и стиль из тега.';
            const st = slay() || {};
            const style = st.slayStyle ? (st.slayStyleName || 'свой') : String(cur()?.data?.style || '').replace(/_/g, ' ');
            return `SLAY сам допишет: ${style ? `стиль «${style}», ` : ''}рефы тех, кто назван по имени${st.apiType === 'atlas' && String(st.atlasCharacterPrompt || '').trim() ? ', описания персонажей' : ''}.`;
        },
        async save({ prompt, aspect }) {
            const m = msg(), ts = tagsOf(i), t = pick(ts);
            if (!m || !t) throw new Error('картинка пропала из поста');
            const node = nodeFor(i, ts.indexOf(t), ts);
            const next = { ...(t.data || {}), prompt: cleanPrompt(prompt) };
            if (aspect) { next.aspect_ratio = aspect; delete next.aspectRatio; }
            if (!next.pm) next.pm = A.uid();   // своя метка: по ней картинка узнаётся после любых правок промта
            pm = next.pm;
            const nf = withIns(t, next);
            if (nf === t.full) return false;
            const failed = tagState(t) === 'error';
            swapTag(i, m, t, nf);
            if (node) node.setAttribute('data-iig-instruction', encodeIns(next)); // живой элемент: ↻ SLAY читает промт отсюда
            await A.ctx().saveChat();
            if (failed || inCard()) await rerender(i);   // плашка ошибки помнит старый промт; карточку собирает движок GC
            return true;
        },
        async draw(onStep) {
            if (!inCard()) { const r = await slayDraw(i, idx(), onStep); if (r) return r; }
            return lifeDraw(i, cur, onStep);
        },
        async setSrc(src) {
            const m = msg(), t = cur();
            if (!m || !t) throw new Error('картинка пропала из поста');
            const node = nodeFor(i, idx());
            swapTag(i, m, t, withSrc(t, src));
            await A.ctx().saveChat();
            if (node?.tagName === 'IMG' && node.closest('.iig-img-wrap')) node.setAttribute('src', src); else await rerender(i);
        },
    };
}

// ───────────── ✎ на картинках ─────────────

const BTN = (i, k, cls = '') => `<button type="button" class="lf-pm-btn${cls}" data-mes="${i}" data-k="${k}" title="Промт картинки: посмотреть, поправить, перерисовать" contenteditable="false">${icon('pencil')}</button>`;

/** У каждой картинки SLAY в посте — ✎ рядом с его ↻. Зовётся из отрисовки постов. */
export function paintPrompts(el, id) {
    const m = A.chatArr()[id];
    const has = !!m && !m.is_user && typeof m.mes === 'string' && m.mes.includes('data-iig-instruction');
    if (has && id >= A.chatArr().length - 14) watch(id, m);
    if (!has || !A.settings().enabled || !cfg().on) { el.querySelectorAll('.lf-pm-btn').forEach(x => x.remove()); return; }
    const live = new Set();
    for (const node of nodesOf(id)) {
        if (node.tagName === 'VIDEO') continue; // видео Naistera — не картинка, промтом его не перерисовать
        const k = tagIndexOf(id, node);
        if (k < 0) continue;
        const err = node.matches('.iig-error-placeholder');
        const wrap = err ? node : node.closest('.iig-img-wrap') || node.closest('.gca-slot') || null;
        let b = wrap ? wrap.querySelector(':scope > .lf-pm-btn') : (node.nextElementSibling?.classList?.contains('lf-pm-btn') ? node.nextElementSibling : null);
        if (!b) {
            const tmp = document.createElement('div');
            tmp.innerHTML = BTN(id, k, err ? ' err' : wrap ? (wrap.classList.contains('gca-slot') ? ' card' : '') : ' loose');
            b = tmp.firstElementChild;
            if (wrap) { if (wrap.classList.contains('gca-slot') && !wrap.style.position) wrap.style.position = 'relative'; wrap.append(b); } else node.after(b);
        } else if (b.dataset.k !== String(k)) b.dataset.k = String(k);
        live.add(b);
    }
    el.querySelectorAll('.lf-pm-btn').forEach(x => { if (!live.has(x)) x.remove(); });
}

/** Клик в чате. true — клик наш. */
export function onPromptClick(ev) {
    const b = ev.target.closest?.('.lf-pm-btn');
    if (!b) return false;
    ev.preventDefault();
    ev.stopPropagation();
    const i = Number(b.dataset.mes);
    // номер тега — по самой картинке: пост мог перерисоваться с тех пор, как кнопку поставили
    const node = b.classList.contains('err') ? b.closest('.iig-error-placeholder') : b.closest('.iig-img-wrap, .gca-slot')?.querySelector('img[data-iig-instruction]') || b.previousElementSibling;
    let k = node ? tagIndexOf(i, node) : -1;
    if (k < 0) k = Number(b.dataset.k);
    openPromptManager(tagAdapter(i, k));
    return true;
}

// ───────────── версии ─────────────

function store() {
    const cm = A.chatMeta();
    if (!cm.pm || typeof cm.pm !== 'object') cm.pm = {};
    if (!cm.pm.h || typeof cm.pm.h !== 'object') cm.pm.h = {};
    return cm.pm.h;
}
function histOf(my = S) {
    const id = my?.ad.hid();
    const v = id ? store()[id]?.v : null;
    return Array.isArray(v) && v.length ? v : (my?.first ? [my.first] : []);
}
function histPush(my, e) {
    const id = my?.ad.hid();
    if (!id) return;
    const st = store();
    const rec = st[id] = st[id] || { v: [] };
    if (!rec.v.length && my.first) rec.v.push(my.first);
    const last = rec.v[rec.v.length - 1];
    if (!(last && last.p === e.p && last.ar === e.ar && last.src === e.src)) rec.v.push(e);
    if (rec.v.length > 9) rec.v.splice(1, rec.v.length - 9); // исходный остаётся всегда
    rec.at = Date.now();
    const keys = Object.keys(st);
    if (keys.length > 120) keys.sort((a, b) => (st[a].at || 0) - (st[b].at || 0)).slice(0, keys.length - 120).forEach(x => delete st[x]);
    A.saveMeta();
}

// ───────────── источники SLAY ─────────────

function sources() {
    const st = slay();
    if (!st) return [];
    if (!Array.isArray(st.connectionProfiles)) st.connectionProfiles = [];
    return st.connectionProfiles;
}
const saveAll = () => { try { A.ctx().saveSettingsDebounced(); } catch { /* */ } };

/** Что сейчас стоит в SLAY — запомнить сразу, чтобы первое же переключение ничего не потеряло. */
function firstSource() {
    const st = slay();
    if (!st || !String(st.apiKey || '').trim() || sources().length) return;
    sources().push(sourceSnap(st, imageModelOf(st).label));
    saveAll();
    console.info('[Life] промты: текущее подключение SLAY сохранено источником —', imageModelOf(st).label);
}

/** Поле SLAY: значение и событие, на котором он сам его сохраняет. false — поля нет (или в списке нет такого пункта). */
function setCtl(id, value, evName) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === value)) return false;
    el.value = value;
    el.dispatchEvent(new Event(evName, { bubbles: true }));
    return true;
}

function useSource(name) {
    const st = slay();
    const p = sources().find(x => x.name === name);
    if (!st || !p) return false;
    // по порядку, как руками: тип API (SLAY сам переложит «настройки модели» и адрес Naistera) → адрес → ключ → модель
    if (st.apiType !== p.apiType && !setCtl('slay_api_type', p.apiType, 'change')) st.apiType = p.apiType;
    if (!setCtl('slay_endpoint', p.endpoint || '', 'input')) st.endpoint = p.endpoint || '';
    if (!setCtl('slay_api_key', p.apiKey || '', 'input')) st.apiKey = p.apiKey || '';
    if (p.apiType === 'atlas') { if (p.atlasModel && st.atlasModel !== p.atlasModel && !setCtl('slay_atlas_model', p.atlasModel, 'change')) st.atlasModel = p.atlasModel; }
    else if (p.apiType === 'naistera') { if (p.naisteraModel && st.naisteraModel !== p.naisteraModel && !setCtl('slay_naistera_model', p.naisteraModel, 'change')) st.naisteraModel = p.naisteraModel; }
    else if (!setCtl('slay_model', p.model || '', 'input')) st.model = p.model || '';
    if (p.customBodyFormat && st.customBodyFormat !== undefined) st.customBodyFormat = p.customBodyFormat;
    saveAll();
    try { A.updatePrompt?.(); } catch { /* заметка о рисовалке — к следующему ответу */ }
    return true;
}

// ───────────── перевод «словами» → промт ─────────────

const TR_SYSTEM = (d, im, lookText) => `You edit image-generation prompts for an illustrated roleplay story. You get the current prompt and, usually, what the player wants changed (in Russian). Return the full new prompt.
Return ONLY JSON: {"prompt":"the complete new prompt, one line","aspect_ratio":"one of ${ASPECTS.join(' | ')} — only if the request changes the frame shape, else repeat the current one","note":"3-10 Russian words: what you changed"}

The picture will be drawn by ${im.name}. Write for it:
${d.guide}

Rules:
- Do exactly what the player asks and nothing else: who is in frame, clothes, place, time of day, light and the art-style sentences stay as they are unless the request touches them.
- "ближе" / "крупнее" means a tighter shot type and a longer lens; "дальше" / "общий план" — a wider one; "другой ракурс" — a new camera angle on the same moment.
${d.refs
        ? '- People keep their first names exactly as written — the extension maps each name to a reference photo. Never replace a name with a description and never describe faces, hair or eye colour of named people.'
        : `- This model has no reference photos: every name must be replaced by that person's look.${lookText ? ` Looks: ${lookText}` : ' If a look is unknown, keep the neutral traits already in the prompt.'}`}
- If there is no request, only re-write the same picture in this model's manner.
- If the last attempt was refused by moderation, remove or soften what most likely caused it — bare skin becomes covered or implied, wounds lose graphic detail, names of real actors, celebrities, brands and franchises go away — and keep the scene, the people and the mood. Say in the note what you softened.
- English only, one line, no line breaks, no quotation marks inside the prompt.`;

async function translate({ prompt, aspect, request = '', error = '', soften = false }) {
    const im = imageModel();
    const d = DIALECTS[im.kind] || DIALECTS.generic;
    const user = [
        `CURRENT PROMPT:\n${prompt}`,
        `CURRENT ASPECT RATIO: ${aspect || 'not set'}`,
        request ? `THE PLAYER ASKS (Russian): ${request}` : soften ? 'THE PLAYER ASKS: make it pass moderation, as the rules say.' : 'NO REQUEST: only re-write this picture in the model\'s manner.',
        error ? `THE LAST ATTEMPT FAILED WITH: ${A.cut(error, 400)}` : '',
    ].filter(Boolean).join('\n\n');
    const raw = await A.askModel([{ role: 'system', content: TR_SYSTEM(d, im, A.cut(looks(), 900)) }, { role: 'user', content: user }], 1500, 'Промты');
    const j = A.extractJson(raw);
    const p = cleanPrompt(j?.prompt);
    if (p.length < 12) throw new Error('Летописец не вернул промт — попробуй ещё раз');
    return { prompt: p, aspect: ASPECTS.includes(j.aspect_ratio) ? j.aspect_ratio : '', note: String(j.note || '').trim().slice(0, 120) };
}

// ───────────── окно ─────────────

let S = null;   // состояние открытого окна
let box = null;

const QUICK = [
    ['ближе', 'ближе кадр'], ['дальше', 'общий план, дальше от камеры'], ['другой ракурс', 'другой ракурс, тот же момент'],
    ['только он', 'в кадре только он'], ['только она', 'в кадре только она'], ['оба в кадре', 'в кадре оба, видно обоих'],
    ['со спины', 'снято со спины'], ['светлее', 'светлее, чтобы лица читались'], ['без текста', 'без надписей и текста в кадре'],
    ['как фото', 'реалистичнее, как настоящая фотография'],
];
const AR_SHOWN = ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9'];

function topDialog() {
    const ds = [...document.querySelectorAll('dialog[open]')].filter(d => { try { return d.matches(':modal'); } catch { return true; } });
    return ds[ds.length - 1] || null;
}

/** Открыть окно промта. ad — «переходник» картинки: read / save / draw / setSrc / hid / engine (см. tagAdapter). */
export function openPromptManager(ad) {
    closeManager();
    let cur = null;
    try { cur = ad?.read(); } catch (e) { console.warn('[Life] промты: чтение', e); }
    if (!cur) { A.toast('warning', 'Не нашла промт этой картинки в посте.', '✎ Промт'); return; }
    S = {
        ad, prompt: cur.prompt, aspect: cur.aspect, base: cur.prompt, baseAspect: cur.aspect, src: cur.src, state: cur.state,
        err: cur.error ? { msg: cur.error, ...(explainError(cur.error) || {}) } : null,
        fix: '', note: '', busy: '', step: '', prev: null, fold: '',
        first: { p: cur.prompt, ar: cur.aspect, src: cur.src, note: '', at: Date.now(), by: '' },
    };
    box = document.createElement('div');
    box.id = 'lf-pm';
    box.addEventListener('click', onBoxClick);
    box.addEventListener('input', onBoxInput);
    box.addEventListener('keydown', onBoxKey);
    (topDialog() || document.body).append(box);
    paint();
    requestAnimationFrame(() => box?.classList.add('on'));
}

function closeManager() {
    box?.remove();
    box = null;
    S = null;
}

const dirty = () => !!S && (S.prompt.trim() !== String(S.base || '').trim() || S.aspect !== S.baseAspect);
const wordsOf = (t) => (String(t).trim() ? String(t).trim().split(/\s+/).length : 0);

function previewHtml() {
    const pic = S.src ? `<div class="lf-pm-prev"><img src="${esc(S.src)}" alt="" data-pm="zoom"></div>` : (S.err ? '' : `<div class="lf-pm-prev empty">${icon('image')}<span>картинки пока нет</span></div>`);
    if (!S.err) return pic;
    return `${pic}<div class="lf-pm-err">${icon('shield')}<div>
        <b>Не нарисовалось</b>
        <p>${esc(S.err.text || 'Сервис картинок ответил ошибкой.')}</p>
        ${S.err.msg ? `<details><summary>Что ответил сервис</summary><code>${esc(A.cut(S.err.msg, 600))}</code></details>` : ''}
        ${S.err.kind === 'filter' ? `<button data-pm="soften">${icon('feather')} Смягчить под фильтр</button>` : ''}
        ${S.err.kind === 'key' || S.err.kind === 'money' ? `<button data-pm="fold" data-v="src">${icon('plug')} Источники</button>` : ''}
    </div></div>`;
}

function sourcesHtml() {
    const st = slay();
    if (!st) return '<div class="lf-pm-sub"><div class="lf-pm-dim">SLAY Images не найден — источники живут в его настройках.</div></div>';
    const list = sources();
    const cur = list.find(p => sourceIsCurrent(p, st)) || null;
    return `<div class="lf-pm-sub">
        <div class="lf-pm-chips src">${list.map(p => `<button class="lf-pm-chip${p === cur ? ' on' : ''}" data-pm="src-use" data-v="${esc(p.name)}">${esc(p.name)}</button>`).join('') || '<span class="lf-pm-dim">Пока ни одного.</span>'}</div>
        <div class="lf-pm-row">
            ${cur ? '' : `<button data-pm="src-save">${icon('plus')} Запомнить то, что стоит сейчас</button>`}
            ${cur ? `<button data-pm="src-del" data-v="${esc(cur.name)}">${icon('trash')} Убрать «${esc(cur.name)}»</button>` : ''}
        </div>
        <div class="lf-pm-dim">Источник — тип API, адрес, ключ и модель из настроек SLAY. Тап — и SLAY переключён целиком, руками вводить ничего не надо.${cur ? '' : ' Сейчас в SLAY стоит несохранённое подключение.'} Описания персонажей, стиль и рефы у каждой модели остаются свои.</div>
    </div>`;
}

function histHtml(hist) {
    if (!hist.length) return '<div class="lf-pm-sub"><div class="lf-pm-dim">Версий пока нет — появятся после первой перерисовки.</div></div>';
    const when = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
    return `<div class="lf-pm-sub">${hist.map((v, k) => `<div class="lf-pm-v${v.src && v.src === S.src ? ' on' : ''}">
        ${v.src ? `<img src="${esc(v.src)}" alt="" loading="lazy" data-pm="zoom">` : `<i>${icon('image')}</i>`}
        <div><b>${k === 0 ? 'Исходный' : esc(v.note || 'правка')}</b><small>${[when(v.at), v.by].filter(Boolean).map(esc).join(' · ')}</small>
            <p>${esc(A.cut(v.p, 150))}</p>
            <span><button data-pm="hist-load" data-k="${k}">взять промт</button>${v.src && v.src !== S.src ? `<button data-pm="hist-back" data-k="${k}">вернуть картинку</button>` : ''}</span>
        </div>
    </div>`).reverse().join('')}</div>`;
}

function setHtml() {
    const c = cfg();
    const tg = (k, label) => `<button class="lf-pm-tg${c[k] ? ' on' : ''}" data-pm="set" data-v="${k}"><i></i><span>${label}</span></button>`;
    return `<div class="lf-pm-sub">
        ${tg('auto', 'После «поправить» сразу рисовать')}
        ${tg('dialect', 'Подсказывать модели, под какую рисовалку писать промт в посте')}
        ${tg('on', '✎ на картинках в постах')}
        <label class="lf-pm-l"><span>Приметы</span><small>для NovelAI — рефов у неё нет</small></label>
        <textarea class="lf-pm-ta small" data-in="looks" rows="3" placeholder="По-английски, коротко: Hedy — …; Bucky — … Пусто — возьму описания персонажей из настроек SLAY.">${esc(c.looks)}</textarea>
        ${c.quick.length ? `<label class="lf-pm-l"><span>Свои быстрые правки</span><small>тап — убрать</small></label><div class="lf-pm-chips">${c.quick.map((q, k) => `<button class="lf-pm-chip" data-pm="quick-del" data-k="${k}">${esc(q)} ✕</button>`).join('')}</div>` : ''}
        <div class="lf-pm-dim">Переводит Летописец (профиль — Мир → ⚙). Манера письма берётся по модели, выбранной в SLAY: Nano Banana, GPT Image, Grok, FLUX, NovelAI.</div>
    </div>`;
}

function paint() {
    if (!box || !S) return;
    const im = imageModel();
    const d = DIALECTS[im.kind] || DIALECTS.generic;
    const hist = histOf();
    const eng = (() => { try { return S.ad.engine(); } catch { return 'life'; } })();
    const extra = (() => { try { return S.ad.extra?.() || ''; } catch { return ''; } })();
    const n = wordsOf(S.prompt);
    const chev = (k) => icon(S.fold === k ? 'chevU' : 'chevD');
    const top = box.querySelector('.lf-pm-body')?.scrollTop || 0;
    box.innerHTML = `<div class="lf-pm-back" data-pm="x"></div>
    <div class="lf-pm-card${S.busy ? ' busy' : ''}" role="dialog" aria-label="Промт картинки">
        <div class="lf-pm-grab"></div>
        <header class="lf-pm-h"><b>${icon('pencil')} Промт картинки</b><small>${esc(S.ad.title || '')}</small><button data-pm="x" class="lf-pm-x" title="Закрыть">${icon('x')}</button></header>
        <div class="lf-pm-body">
            ${previewHtml()}
            <button class="lf-pm-model" data-pm="fold" data-v="src">${icon('plug')}<span><b>${esc(im.name)}</b><small>${esc(im.label.split(' · ')[1] || '')}${eng === 'life' ? ' · эту рисует Гардероб' : ''} · пишу под ${esc(d.name)}</small></span>${chev('src')}</button>
            ${S.fold === 'src' ? sourcesHtml() : ''}
            <label class="lf-pm-l"><span>Что поправить</span><small>словами — переведу в промт</small></label>
            <div class="lf-pm-fix"><input type="text" data-in="fix" enterkeyhint="go" placeholder="ближе кадр · она в красном · он без бороды…" value="${esc(S.fix)}"><button data-pm="quick-add" title="Запомнить как быструю правку">${icon('plus')}</button><button data-pm="fix" class="main" title="Перевести в промт${cfg().auto ? ' и нарисовать' : ''}">${icon('wand')}</button></div>
            <div class="lf-pm-chips quick">${[...QUICK, ...cfg().quick.map(q => [q, q])].map(([t, v]) => `<button class="lf-pm-chip" data-pm="chip" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
            ${S.note ? `<div class="lf-pm-note">${icon('sparkles')}<span>${esc(S.note)}</span>${S.prev ? '<button data-pm="undo">вернуть как было</button>' : ''}</div>` : ''}
            <label class="lf-pm-l"><span>Промт</span><small class="lf-pm-cnt">${n} ${A.plural(n, 'слово', 'слова', 'слов')}${dirty() ? ' · изменён' : ''}</small></label>
            <textarea class="lf-pm-ta" data-in="prompt" rows="6" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(S.prompt)}</textarea>
            ${extra ? `<div class="lf-pm-dim">${esc(extra)}</div>` : ''}
            ${S.ad.fixedAspect ? '' : `<div class="lf-pm-chips ar">${AR_SHOWN.map(a => `<button class="lf-pm-chip${a === S.aspect ? ' on' : ''}" data-pm="ar" data-v="${a}">${a}</button>`).join('')}</div>`}
            <button class="lf-pm-fold" data-pm="fold" data-v="hist">${icon('clock')}<span>Версии${hist.length > 1 ? ` · ${hist.length}` : ''}</span>${chev('hist')}</button>
            ${S.fold === 'hist' ? histHtml(hist) : ''}
            <button class="lf-pm-fold" data-pm="fold" data-v="set">${icon('sliders')}<span>Настройки</span>${chev('set')}</button>
            ${S.fold === 'set' ? setHtml() : ''}
        </div>
        <footer class="lf-pm-foot">
            ${S.busy ? `<div class="lf-pm-wait"><i></i><span>${esc(S.step)}</span></div>` : ''}
            <div class="lf-pm-go">
                <button data-pm="draw" class="main">${icon('camera')} ${S.state === 'ok' ? 'Перерисовать' : 'Нарисовать'}</button>
                <button data-pm="model" title="Переписать этот же кадр в манере ${esc(d.name)}">${icon('swap')} под модель</button>
                <button data-pm="save" class="lf-pm-save"${dirty() ? '' : ' disabled'} title="Оставить промт в посте, не рисуя">${icon('check')}</button>
            </div>
        </footer>
    </div>`;
    const body = box.querySelector('.lf-pm-body');
    if (body) body.scrollTop = top;
}

/** Пока печатает — обновлять только счётчик слов и «сохранить», фокус не трогать. */
function tick() {
    if (!box || !S) return;
    const n = wordsOf(S.prompt);
    const cnt = box.querySelector('.lf-pm-cnt');
    if (cnt) cnt.textContent = `${n} ${A.plural(n, 'слово', 'слова', 'слов')}${dirty() ? ' · изменён' : ''}`;
    const sv = box.querySelector('.lf-pm-save');
    if (sv) sv.disabled = !dirty();
}

function onBoxInput(ev) {
    const el = ev.target;
    const k = el?.dataset?.in;
    if (!k || !S) return;
    if (k === 'prompt') { S.prompt = el.value; tick(); }
    else if (k === 'fix') S.fix = el.value;
    else if (k === 'looks') { cfg().looks = el.value.slice(0, 1200); A.saveSettings(); try { A.updatePrompt?.(); } catch { /* */ } }
}

function onBoxKey(ev) {
    if (ev.key === 'Enter' && ev.target?.dataset?.in === 'fix') { ev.preventDefault(); fixNow(S.fix); }
    else if (ev.key === 'Escape') closeManager();
}

async function onBoxClick(ev) {
    const b = ev.target.closest('[data-pm]');
    if (!b || !S) return;
    const act = b.dataset.pm;
    if (b.tagName === 'BUTTON' && b.disabled) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (act === 'x') { closeManager(); return; }
    if (act === 'zoom') { const src = b.getAttribute('src'); if (src) A.lightbox?.(src, ''); return; }
    if (act === 'fold') { S.fold = S.fold === b.dataset.v ? '' : b.dataset.v; paint(); return; }
    if (act === 'set') { const c = cfg(); c[b.dataset.v] = !c[b.dataset.v]; A.saveSettings(); try { A.updatePrompt?.(); } catch { /* */ } A.paintSoon?.(); paint(); return; }
    if (act === 'quick-del') { cfg().quick.splice(Number(b.dataset.k), 1); A.saveSettings(); paint(); return; }
    if (act === 'quick-add') {
        const t = S.fix.trim();
        if (!t) { A.toast('info', 'Сначала напиши правку в поле — потом ＋ запомнит её кнопкой.', '✎ Промт'); return; }
        const q = cfg().quick;
        if (!q.includes(t)) { q.push(t.slice(0, 60)); if (q.length > 12) q.shift(); A.saveSettings(); }
        paint();
        return;
    }
    if (act === 'src-use') { srcUse(b.dataset.v); return; }
    if (act === 'src-save') { srcSave(); return; }
    if (act === 'src-del') { if (confirm(`Убрать источник «${b.dataset.v}»? Само подключение в SLAY останется как есть.`)) { const l = sources(); const k = l.findIndex(x => x.name === b.dataset.v); if (k >= 0) l.splice(k, 1); saveAll(); paint(); } return; }
    if (S.busy) return;
    if (act === 'ar') { S.aspect = b.dataset.v; paint(); return; }
    if (act === 'undo') { if (S.prev) { S.prompt = S.prev.prompt; S.aspect = S.prev.aspect; S.prev = null; S.note = ''; paint(); } return; }
    if (act === 'chip') { fixNow(b.dataset.v); return; }
    if (act === 'fix') { fixNow(S.fix); return; }
    if (act === 'soften') { fixNow('', { soften: true }); return; }
    if (act === 'model') { fixNow('', { convert: true }); return; }
    if (act === 'draw') { drawNow(); return; }
    if (act === 'save') { saveNow(); return; }
    if (act === 'hist-load') { const v = histOf()[Number(b.dataset.k)]; if (v) { S.prev = { prompt: S.prompt, aspect: S.aspect }; S.prompt = v.p; if (v.ar && !S.ad.fixedAspect) S.aspect = v.ar; S.note = 'промт из версии — можно править и рисовать'; paint(); } return; }
    if (act === 'hist-back') { backTo(histOf()[Number(b.dataset.k)]); }
}

function srcUse(name) {
    if (S.busy === 'draw') { A.toast('info', 'Дорисую — тогда переключу.', '✎ Промт'); return; }
    if (!useSource(name)) { A.toast('warning', 'Не нашла такой источник.', '✎ Промт'); return; }
    const im = imageModel();
    A.toast('success', `SLAY переключён: ${esc(im.label)}. Переписать этот промт в её манере — «под модель».`, '✎ Источник', { timeOut: 4200 });
    paint();
}

function srcSave() {
    const st = slay();
    if (!st) return;
    const name = (prompt('Как назвать источник?', imageModelOf(st).label) || '').trim();
    if (!name) return;
    const l = sources();
    const k = l.findIndex(x => x.name === name);
    const snap = sourceSnap(st, name);
    if (k >= 0) l[k] = snap; else l.push(snap);
    saveAll();
    paint();
}

/** Сказала словами → Летописец переписал промт → (если включено) сразу рисуем. */
async function fixNow(request, { soften = false, convert = false } = {}) {
    const my = S;
    if (!my || my.busy) return;
    request = String(request || '').trim();
    if (!request && !soften && !convert) { A.toast('info', 'Напиши, что поправить, или тапни быструю правку.', '✎ Промт'); return; }
    if (!my.prompt.trim()) { A.toast('info', 'Промт пустой — впиши хоть пару слов о кадре.', '✎ Промт'); return; }
    my.busy = 'tr';
    my.step = soften ? 'смягчаю под фильтр…' : convert ? 'переписываю под рисовалку…' : 'перевожу в промт…';
    paint();
    let ok = false;
    try {
        const out = await translate({ prompt: my.prompt, aspect: my.aspect, request, error: my.err?.msg || '', soften });
        if (S !== my) return;
        my.prev = { prompt: my.prompt, aspect: my.aspect };
        my.prompt = out.prompt;
        if (out.aspect && !my.ad.fixedAspect) my.aspect = out.aspect;
        my.note = out.note || request || (convert ? 'переписан под рисовалку' : 'смягчён');
        my.fix = '';
        ok = true;
    } catch (e) {
        console.warn('[Life] промты: перевод', e);
        A.toast('warning', esc(String(e?.message || e)), '✎ Промт', { timeOut: 6000 });
    } finally {
        my.busy = '';
        if (S === my) paint();
    }
    if (ok && S === my && cfg().auto && !convert) await drawNow();
}

async function saveNow() {
    const my = S;
    if (!my || my.busy) return;
    my.busy = 'save';
    my.step = 'сохраняю…';
    paint();
    try {
        await my.ad.save({ prompt: my.prompt, aspect: my.aspect });
        my.base = my.prompt;
        my.baseAspect = my.aspect;
        histPush(my, { p: my.prompt, ar: my.aspect, src: my.src, note: my.note || 'правка руками', at: Date.now(), by: '' });
        A.toast('success', 'Промт в посте. ↻ нарисует уже по нему.', '✎ Промт', { timeOut: 2200 });
    } catch (e) {
        A.toast('warning', esc(String(e?.message || e)), '✎ Промт', { timeOut: 6000 });
    } finally {
        my.busy = '';
        if (S === my) paint();
    }
}

async function drawNow() {
    const my = S;
    if (!my || my.busy) return;
    if (!my.prompt.trim()) { A.toast('info', 'Промт пустой.', '✎ Промт'); return; }
    my.busy = 'draw';
    my.step = 'сохраняю промт…';
    paint();
    const by = imageModel().name;
    try {
        await my.ad.save({ prompt: my.prompt, aspect: my.aspect });
        my.base = my.prompt;
        my.baseAspect = my.aspect;
        const r = await my.ad.draw((step) => { my.step = step; if (S === my) { const el = box?.querySelector('.lf-pm-wait span'); if (el) el.textContent = step; } });
        my.src = r.src;
        my.state = 'ok';
        my.err = null;
        histPush(my, { p: my.prompt, ar: my.aspect, src: r.src, note: my.note || 'перерисовка', at: Date.now(), by });
        my.note = '';
        my.prev = null;
        if (S !== my) A.toast('success', 'Картинка готова.', '✎ Промт', { timeOut: 2200 });
    } catch (e) {
        const msg = String(e?.message || e);
        console.warn('[Life] промты: рисование', e);
        my.err = { msg, ...(explainError(msg) || {}) };
        if (S !== my) A.toast('warning', esc(A.cut(msg, 200)), '✎ Промт: не нарисовалось', { timeOut: 7000 });
    } finally {
        my.busy = '';
        if (S === my) { paint(); if (my.err) box?.querySelector('.lf-pm-body')?.scrollTo({ top: 0, behavior: 'smooth' }); }
        A.paintSoon?.();
    }
}

/** Вернуть картинку и промт из старой версии. */
async function backTo(v) {
    const my = S;
    if (!v?.src || !my || my.busy) return;
    my.busy = 'save';
    my.step = 'возвращаю…';
    paint();
    try {
        await my.ad.save({ prompt: v.p, aspect: v.ar || my.aspect });
        await my.ad.setSrc(v.src);
        my.prompt = my.base = v.p;
        if (v.ar) my.aspect = my.baseAspect = v.ar;
        my.src = v.src;
        my.state = 'ok';
        my.err = null;
        my.note = '';
    } catch (e) {
        A.toast('warning', esc(String(e?.message || e)), '✎ Промт', { timeOut: 6000 });
    } finally {
        my.busy = '';
        if (S === my) paint();
        A.paintSoon?.();
    }
}
