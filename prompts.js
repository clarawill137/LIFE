// «Промты» — менеджер промтов картинок (0.59).
// У любой картинки в посте — ✎: окно, где виден её промт. Его можно поправить руками или сказать словами
// («ближе кадр», «она в красном») — Летописец переведёт это на язык той рисовалки, что сейчас выбрана в SLAY:
// Nano Banana, GPT Image, Grok, FLUX и NovelAI пишутся по-разному (pmtags.js → DIALECTS).
// Правка остаётся в самом посте: следующий ↻ рисует уже по ней, повторять её не надо. Версии промта и картинок
// хранятся в чате — к любой можно вернуться. Не нарисовалось — в окне причина и «смягчить под фильтр».
// Рисует тот же SLAY, его же кнопкой (со всеми рефами, стилем и описаниями) — и фото в карточках GC тоже;
// Гардероб подхватывает, только если SLAY выключен или не отозвался.
// Там же «источники»: тип API, адрес, ключ и модель SLAY запоминаются под именем и переключаются тапом.
// Запасной стиль (0.59.1): картинку завернул фильтр — она сама перерисовывается в другом стиле из библиотеки SLAY
// (по умолчанию «Клаус»); обычный стиль при этом остаётся обычным. Такая картинка и по ↻ SLAY рисуется в своём стиле.
// 0.59.2: не с первого отказа, а со второго подряд (настройка 1–3) — до этого ещё попытка как есть.
// Файлы SLAY не трогаются: всё через его настройки и кнопки, так что его обновление ничего не затрёт.
// Оператор (0.63, dp.js): в окне — «Переснять» и «три дубля» (кадр по посту: мысль, мгновение, взгляды, свет), строка
// «Плёнка» (вид картинки — поле style тега). Новый кадр оператор переснимает и сам, до отрисовки, — если SLAY зовёт
// соседей перед запросом (порт 5.1.1: window.slayHooks.beforeGenerate). Новый промт вписывается в пост, когда SLAY дорисует.
// 0.67.1: ✎ сама возвращается на место (движок карточек GC выбрасывает её вместе со старой карточкой после любой генерации,
// даже фоновой); у фото в карточке — своя ↻ (SLAY свою там не держит); на картинке во весь экран — свой ряд кнопок поверх
// окна SLAY («Промт», «Перерисовать»); без кнопок — «/life pm», «/life redraw», «/life reshoot»; «/life pm log» — журнал.
// 0.68.1: «Не удалось записать картинку в чат». Кадр, генерацию которого оборвали (Safari выгрузил вкладку), стоит в
// посте с [IMG:GEN], а на экране — плашка SLAY «прервана». Её «Попробовать снова» помнит промт с момента, когда плашка
// появилась. Life правила промт в посте (оператор, своя метка, правка в окне) и жала эту кнопку — SLAY рисовал и искал
// в посте тег по старому промту, не находил и писал этот тост; картинка держалась только на спасении Life, а после
// правки в окне и тапа по плашке пропадала совсем. Теперь Life кнопку «Попробовать снова» не жмёт — несостоявшиеся
// кадры рисует через двойника (его ↻ SLAY ищет тег по промту из поста, по пути и по месту); тап по устаревшей плашке
// перехватывается и рисуется так же. Журнал картинок (что рисовалось, чем кончилось, что ответил сервер) — ещё и в
// метаданных чата (pm.log): снимок чата с сервера покажет, что было, без скринов.
// 0.67.2: окно промта — свой <dialog> в верхнем слое браузера (showModal), как хаб Life, её окна и Гардероб. Обычным
// слоем (div с z-index) оно на её iPhone открывалось невидимым — «поверх лежит» верхняя панель таверны, и подъём над
// чужими слоями не помогал. Верхний слой не перекрыть ничем и не сдвинуть ничьими трансформами. Тосты на время окна
// переезжают в него — иначе их не видно.

import { icon } from './icons.js';
import { artBlocks } from './art.js';
import {
    scanTags, tagState, isPicture, withIns, withSrc, ordOf, replaceNth, sameButSrc, sigOf, parseIns, encodeIns, cleanPrompt,
    ASPECTS, imageModelOf, DIALECTS, dialectNote, explainError, sourceSnap, sourceIsCurrent,
} from './pmtags.js';
import { dpCfg, reshoot, lookNow, lookChoices, sceneOf } from './dp.js';
import { LOOKS, LOOK_OWN, LOOK_SAFE, PAINTED, lookText, lookOfText, lookById, shotOf, shotLabelRu } from './dpcore.js';

let A = null;
const esc = (v) => A.esc(v);
// журнал последних шагов (тапы, окно, рисование) — для «/life pm log»: в телефоне консоли нет
const LOG = [];
function pmLog(...a) {
    const d = new Date(), two = (n) => String(n).padStart(2, '0');
    LOG.push(`${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())} ${a.filter(x => x !== '' && x != null).join(' ')}`);
    if (LOG.length > 70) LOG.shift();
}
/** Важное о картинках — и в журнал, и в метаданные чата (pm.log, 80 последних): снимок чата с сервера покажет, что было. */
function keepLog(...a) {
    pmLog(...a);
    try {
        if (!A?.hasChat?.()) return;
        const cm = A.chatMeta();
        if (!cm.pm || typeof cm.pm !== 'object') cm.pm = {};
        if (!Array.isArray(cm.pm.log)) cm.pm.log = [];
        cm.pm.log.push([Date.now(), a.filter(x => x !== '' && x != null).join(' ').slice(0, 400)]);
        if (cm.pm.log.length > 240) cm.pm.log.splice(0, cm.pm.log.length - 240);
        A.saveMeta();
    } catch { /* журнал — не главное */ }
}
/** Инструкция картинки в одном виде — с экрана (сущности уже раскрыты) и из текста поста. */
const insKey = (raw) => { const d = parseIns(raw); return d ? JSON.stringify(d) : String(raw || '').trim(); };
const lastAi = () => { const c = A.chatArr(); for (let i = c.length - 1; i >= 0; i--) if (c[i] && !c[i].is_user) return i; return -1; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DRAW_MS = 6 * 60 * 1000; // дольше SLAY сам не ждёт

export function initPrompts(api) {
    A = api;
    hookToasts();
    hookSlayButtons();
    hookPictureTap();
    hookPencilTap();
    try { hookHeal(); } catch (e) { console.warn('[Life] промты: присмотр за ✎', e); }
    try { hookSlayDraw(); } catch (e) { console.warn('[Life] оператор: крючок SLAY', e); }
    setInterval(() => { try { sweep(); } catch (e) { console.warn('[Life] промты: сверка постов', e); } }, 3000);
    for (const ms of [1500, 7000]) setTimeout(() => { try { styleUnstick(true); } catch { /* настройки SLAY ещё не подняты */ } }, ms);
    setTimeout(() => { try { firstSource(); } catch (e) { console.warn('[Life] промты: источник', e); } }, 7000);
}

function cfg() {
    const s = A.settings();
    if (!s.pm || typeof s.pm !== 'object') s.pm = {};
    const c = s.pm;
    if (c.on === undefined) c.on = true;           // ✎ на картинках
    if (c.tap === undefined) c.tap = false;        // тап по картинке открывает не её на весь экран, а сразу окно промта
    if (c.auto === undefined) c.auto = true;       // после «поправить» сразу рисовать
    if (c.dialect === undefined) c.dialect = true; // подсказка основной модели: под какую рисовалку писать промт
    if (!Array.isArray(c.quick)) c.quick = [];     // свои быстрые правки
    if (typeof c.looks !== 'string') c.looks = ''; // приметы персонажей — для рисовалок без рефов
    if (!c.fb || typeof c.fb !== 'object') c.fb = {};   // запасной стиль на случай фильтра
    if (c.fb.auto === undefined) c.fb.auto = true;      // сама перерисовывать в нём
    if (typeof c.fb.name !== 'string') c.fb.name = '';  // имя стиля; пусто — «Клаус», если он есть в библиотеке SLAY
    if (!c.fb.lib || typeof c.fb.lib !== 'object' || Array.isArray(c.fb.lib)) c.fb.lib = {}; // имя → текст стиля
    if (![1, 2, 3].includes(c.fb.after)) c.fb.after = 2;   // с какого отказа фильтра подряд уходить в запасной стиль
    return c;
}

const slay = () => A.ctx().extensionSettings?.slay_image_gen || null;
/** Какая рисовалка сейчас выбрана в SLAY. */
export const imageModel = () => imageModelOf(slay());
const looks = () => String(cfg().looks || '').trim() || String(slay()?.atlasCharacterPrompt || '').trim();
const slayOn = () => { const st = slay(); return !!st && st.enabled !== false; };

// ───────────── стиль отдельной картинки и запасной стиль ─────────────
// Картинка может рисоваться не в общем стиле, а в своём. Какой картинке какой стиль — записано в данных чата,
// а не в посте: пост читает модель (теги последних постов — тоже), и поле в теге она начала бы копировать в новые
// картинки. Ключ записи — метка картинки (pm) и отпечаток её промта: метка, скопированная моделью в другую
// картинку, придёт с другим промтом — и стиль за ней не увяжется. Текст стиля берётся по имени из библиотеки SLAY
// или из настроек Life.

const FB_AUTO = /клаус|klaus/i;
const OWN_STYLE = 'свой';

const stHash = (p) => A.hash(String(p || '').replace(/'/g, '’').replace(/</g, '‹').replace(/>/g, '›').replace(/\s+/g, ' ').trim());
function stStore() {
    const cm = A.chatMeta();
    if (!cm.pm || typeof cm.pm !== 'object') cm.pm = {};
    if (!cm.pm.st || typeof cm.pm.st !== 'object') cm.pm.st = {};
    return cm.pm.st;
}
/** Имя своего стиля картинки по её инструкции; '' — рисуется в общем. */
function styleOf(d) {
    const e = d?.pm ? stStore()[d.pm] : null;
    return Array.isArray(e) && e[1] === stHash(d.prompt) ? String(e[0] || '') : '';
}
function setStyleOf(d, name) {
    if (!d?.pm) return;
    const st = stStore();
    delete st[d.pm];
    if (name) st[d.pm] = [name, stHash(d.prompt)];
    const keys = Object.keys(st);
    if (keys.length > 400) for (const k of keys.slice(0, keys.length - 400)) delete st[k];
    A.saveMeta();
}

/** Библиотека стилей SLAY: то, что он сам уже скачал в этот браузер, и свои стили из его настроек. [{ name, prompt }] */
let libMemo = null;
function slayStyles() {
    if (libMemo && Date.now() - libMemo.at < 15000) return libMemo.list;   // кэш SLAY — пара мегабайт, а окно перерисовывается часто
    const out = [];
    const add = (x) => { const name = String(x?.name || '').trim(), prompt = String(x?.prompt || '').trim(); if (name && prompt && !out.some(y => y.name === name)) out.push({ name, prompt }); };
    for (const key of ['slay_styles_cache_v3', 'slay_styles_cache_v2']) {
        try { for (const x of JSON.parse(localStorage.getItem(key) || 'null')?.styles || []) add(x); } catch { /* кэша нет */ }
    }
    try { const own = slay()?.customStyles; for (const x of (typeof own === 'string' ? JSON.parse(own || '[]') : own) || []) add(x); } catch { /* своих нет */ }
    libMemo = { at: Date.now(), list: out };
    return out;
}

/** Текст стиля по имени: запомненный в настройках Life (он есть на всех устройствах), иначе из библиотеки SLAY. */
function styleText(name) {
    name = String(name || '').trim();
    if (!name) return '';
    return String(cfg().fb.lib[name] || slayStyles().find(x => x.name === name)?.prompt || '').trim();
}

/** Запомнить текст стиля в настройках Life: библиотека SLAY лежит в памяти браузера, на другом устройстве её может не быть. */
function keepStyle(name, prompt) {
    const f = cfg().fb;
    if (!name || !prompt || f.lib[name] === prompt) return;
    f.lib[name] = prompt;
    const keys = Object.keys(f.lib);
    if (keys.length > 8) delete f.lib[keys.find(k => k !== name && k !== f.name && k !== OWN_STYLE) || keys[0]];
    A.saveSettings();
}

/** Запасной стиль: выбранный в настройках окна, иначе «Клаус» из библиотеки SLAY. null — взять неоткуда. */
function fallbackStyle() {
    const f = cfg().fb;
    const name = f.name.trim() || Object.keys(f.lib).find(k => FB_AUTO.test(k)) || slayStyles().find(x => FB_AUTO.test(x.name))?.name || '';
    const prompt = styleText(name);
    if (!prompt) return null;
    keepStyle(name, prompt);
    return { name, prompt };
}

// SLAY берёт стиль из своих настроек (если он там выбран) и только потом из тега картинки, а читает его сразу,
// в самом тапе по своей кнопке. Поэтому на этот тап стиль в настройках подменяется и тут же возвращается:
// картинка рисуется в своём стиле, а общий стиль остаётся каким был — и для соседних картинок, и на потом.
function holdStyle(text, name) {
    const st = slay();
    if (!st || !text) return;
    if (!st.lifePmStyle) st.lifePmStyle = { slayStyle: st.slayStyle || '', slayStyleName: st.slayStyleName || '' };
    st.slayStyle = text;
    st.slayStyleName = name || 'стиль картинки';
    setTimeout(styleUnstick, 0);
}
/** Вернуть общий стиль. save — после сбоя (вкладку закрыли ровно в этот миг, и подмена успела сохраниться). */
function styleUnstick(save = false) {
    const st = slay();
    const b = st?.lifePmStyle;
    if (!b) return;
    st.slayStyle = b.slayStyle || '';
    st.slayStyleName = b.slayStyleName || '';
    delete st.lifePmStyle;
    if (save === true) saveAll();
}

/** Тап по ↻ или «Попробовать снова» SLAY у картинки со своим стилем — она рисуется в нём. И её тап, и наш идут здесь. */
function hookSlayButtons() {
    document.addEventListener('click', (ev) => {
        const b = ev.target?.closest?.('.iig-regen-btn, .iig-error-retry');
        if (!b || !b.closest('#chat')) return;
        const node = b.closest('.iig-error-placeholder') || b.closest('.iig-img-wrap')?.querySelector('img[data-iig-instruction]');
        const name = node ? styleOf(parseIns(node.getAttribute('data-iig-instruction') || '')) : '';
        if (!name) return;
        const text = styleText(name);
        if (text) holdStyle(text, name);
        else console.warn(`[Life] промты: стиль «${name}» не найден ни в настройках, ни в библиотеке SLAY — рисую в общем`);
    }, true);
}

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
    try { fixSplitSrcs(); } catch (e) { console.warn('[Life] промты: разрезанные пути картинок', e); }
    restoreFromLog().catch(e => console.warn('[Life] промты: вернуть версии из журнала', e));
    const chat = A.chatArr();
    for (let i = chat.length - 1, k = 0; i >= Math.max(0, chat.length - 30) && k < 10; i--) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) continue;
        k++;
        watch(i, m);
    }
    heal();
}

// ───────────── присмотр: ✎ на месте ─────────────
// Движок карточек GC собирает карточку заново после любой генерации (и фоновой: Летописец, реплики, мозг) — старую он
// выбрасывает вместе с нашей ✎, а картинку уносит из обёртки SLAY в свою рамку. Событий об этом нет, оформление постов
// Life в этот момент не зовётся — так ✎ и пропадала с фото в карточке. Посты с картинками сверяем сами: по изменениям
// в чате и раз в три секунды (sweep).
let healT = 0;
function heal() {
    if (!A?.hasChat?.() || A.settings().enabled === false) return;
    const chat = A.chatArr();
    for (const el of [...document.querySelectorAll('#chat > .mes[mesid]')].slice(-40)) {
        if (!el.querySelector('.mes_text [data-iig-instruction], .lf-pm-btn, .lf-pm-re')) continue;
        const id = Number(el.getAttribute('mesid'));
        if (!Number.isInteger(id) || !chat[id]) continue;
        try { syncShown(el, id); } catch (e) { console.warn('[Life] промты: сверка картинок', e); }
        const was = el.querySelectorAll('.lf-pm-btn').length;
        try { paintPrompts(el, id); } catch (e) { console.warn('[Life] промты: ✎', e); }
        const now = el.querySelectorAll('.lf-pm-btn').length;
        if (now > was) pmLog(`✎ вернула на место: пост ${id} (${was} → ${now})`);
    }
}
let healAt = 0;
/** Сверить посты чуть погодя (SLAY дорисовал — его тост). Несколько сроков: пост сохраняется и пересобирается не сразу. */
function healSoon(...ms) {
    for (const t of ms) setTimeout(() => { if (Date.now() - healAt < 200) return; healAt = Date.now(); try { heal(); } catch (e) { console.warn('[Life] промты: сверка', e); } }, t);
}

// ───────────── картинка в посте ↔ картинка на экране ─────────────
// SLAY ставит готовую картинку на место своей плашки «рисуется». Если пост за это время перерисовали (ExtBlocks дописал
// блок, кто угодно прислал MESSAGE_UPDATED — таверна пересобирает пост из текста), плашки на экране уже нет: путь SLAY
// в пост впишет, а на экране так и останется сырой тег [IMG:GEN] — «?» в карточке, хотя картинка нарисована и в окне
// промта видна (21.11). Сверяем сами: в посте картинка, на экране пустышка — ставим из поста; в посте ошибка или картинка
// легла под старую плашку — пост пересобираем; картинка есть только на экране — вписываем её в пост. Пока SLAY рисует,
// сырой тег показываем как «Рисуется…», а не «?» (и без ↻: перерисовка пустышки задела бы все такие теги поста).
const shownSeen = new Map();     // «пост:картинка» → { sig, at, n } — расхождение видели; чиним со второго взгляда
const shownNoted = new Set();    // о чём уже записали в журнал
const cardFirst = new WeakMap(); // плашка SLAY на экране → каким был тег, когда её увидели впервые
const drawingIn = new Map();     // пост → сколько картинок в нём сейчас рисует сама Life
const slayBusy = new Map();      // пост → когда SLAY начал в нём рисовать (его крючок перед рисованием)
const BUSY_SEL = '.iig-loading-placeholder, .iig-regen-overlay, .iig-regen-active, .lf-pm-proxy, .lf-pm-drawing';
const fakeSrc = (s) => /^data:,life-pm-/.test(String(s || ''));
const rawGen = (s) => /^\s*\[IMG:GEN\]\s*$/i.test(String(s || ''));
function shownSrc(s) {
    let x = String(s || '').trim().replace(/&amp;/g, '&');
    try { if (/^https?:\/\//i.test(x)) { const u = new URL(x); if (u.origin === location.origin) x = u.pathname + u.search; } } catch { /* как есть */ }
    try { x = decodeURI(x); } catch { /* как есть */ }
    return x;
}
const fileOf = (s) => { const x = String(s || ''); if (!x) return 'пусто'; if (/^\[IMG:/i.test(x)) return x.slice(0, 40); if (fakeSrc(x)) return 'путь двойника'; if (/^data:/.test(x)) return 'пустышка'; return x.split(/[?#]/)[0].split('/').pop().slice(0, 60); };
const drawIn = (i, d) => { const n = (drawingIn.get(i) || 0) + d; if (n > 0) drawingIn.set(i, n); else drawingIn.delete(i); };
function slayBusyIn(i) {
    const at = slayBusy.get(i);
    if (!at) return false;
    if (Date.now() - at > DRAW_MS) { slayBusy.delete(i); return false; }
    return true;
}

/** Сырой [IMG:GEN] на экране, пока SLAY рисует: вместо «?» — «Рисуется…». */
function pend(node, on) {
    if (!node || node.tagName !== 'IMG') return;
    const box = node.closest('.iig-img-wrap') || node.closest('.gca-slot');
    if (!on) {
        if (!node.classList.contains('lf-pm-pending')) return;
        node.classList.remove('lf-pm-pending');
        if (box) { box.classList.remove('lf-pm-pending-box'); box.querySelectorAll(':scope > .lf-pm-pend').forEach(x => x.remove()); }
        return;
    }
    if (!box) return;   // без рамки «Рисуется» поставить некуда — пусть остаётся как есть
    node.classList.add('lf-pm-pending');
    box.classList.add('lf-pm-pending-box');
    if (!box.querySelector(':scope > .lf-pm-pend')) {
        const d = document.createElement('div');
        d.className = 'lf-pm-pend';
        d.setAttribute('contenteditable', 'false');
        d.innerHTML = '<i></i><span>Рисуется…</span>';
        box.append(d);
    }
}

/** Пост в тексте и на экране — об одних картинках? Нет — поставить то, что в посте (или вписать в пост то, что на экране). */
function syncShown(el, i) {
    const m = A.chatArr()[i];
    if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) return;
    const tags = tagsOf(i);
    if (!tags.length) return;
    if (!tags.some(t => !t.video && tagState(t) === 'wait')) slayBusy.delete(i);
    // кто-то рисует в этом посте прямо сейчас — он сам поставит картинку, не мешаем
    const busy = !!el.querySelector(BUSY_SEL) || drawingIn.has(i) || drawAs?.i === i || !!(S?.busy && S.ad?.kind === 'post' && S.ad.mes === i) || [...quick].some(q => q.startsWith(`${i}:`));
    const nodes = nodesOf(i);
    const now = Date.now();
    let redo = '';
    tags.forEach((t, k) => {
        if (t.video) return;
        const key = `${i}:${k}`;
        const st = tagState(t);
        const node = nodeFor(i, k, tags);
        const img = node?.tagName === 'IMG';
        const on = img ? node.getAttribute('src') || '' : '';
        const onD = shownSrc(on);   // таверна могла закодировать скобки: %5BIMG:GEN%5D
        pend(node, img && st === 'wait' && rawGen(onD) && slayBusyIn(i));
        if (!node) { shownSeen.delete(key); return; }
        const card = node.matches('.iig-error-placeholder');
        if (card && !cardFirst.has(node)) cardFirst.set(node, st);
        const real = img && isPicture(onD) && !fakeSrc(onD);
        let what = '';
        if (img && onD !== shownSrc(t.src)) {
            if (!real) what = st === 'ok' ? 'put' : st === 'error' ? 'redo' : '';
            else if (st === 'ok') what = 'other';
            else if (!/^data:/i.test(onD)) what = 'lost';
        } else if (card && st === 'ok' && cardFirst.get(node) !== 'ok') what = 'redo';   // картинка вписалась под плашку, а та осталась
        if (!what) { shownSeen.delete(key); return; }
        if (busy) return;
        const sig = `${what}|${t.src}|${on}`;
        if (what === 'other') {   // обе — картинки, обе бывают правдой (SLAY сам переводит старые пути на новые) — только в журнал
            if (!shownNoted.has(`${key}|${sig}`)) { shownNoted.add(`${key}|${sig}`); keepLog(`на экране другая картинка, чем в посте: пост ${i}, картинка ${k} — на экране ${fileOf(on)}, в посте ${fileOf(t.src)}`); }
            return;
        }
        if (what === 'put') {
            // в посте картинка, на экране сырой тег / пустышка / путь двойника: ставим из поста, сразу — ждать тут нечего
            node.setAttribute('src', t.src);
            node.removeAttribute('data-iig-error');
            if (t.data && nodeSig(node) !== sigOf(t.data, t.raw)) node.setAttribute('data-iig-instruction', encodeIns(t.data));
            pend(node, false);
            shownSeen.delete(key);
            keepLog(`картинка не показывалась: пост ${i}, картинка ${k} — на экране ${fileOf(on)}, в посте ${fileOf(t.src)} → поставила из поста`);
            return;
        }
        const rec = shownSeen.get(key);
        if (!rec || rec.sig !== sig) { shownSeen.set(key, { sig, at: now, n: 0 }); return; }
        if (now - rec.at < (what === 'lost' ? 3000 : 1200) || rec.n >= 2) return;
        rec.n++;
        if (what === 'lost') {
            // нарисованная картинка есть только на экране (SLAY не вписал путь в пост) — после перезагрузки она пропала бы.
            // Вписываем, только если ясно, чья она: инструкция та же, или картинка в посте одна.
            const mine = nodeSig(node) === sigOf(t.data, t.raw) || (tags.length === 1 && nodes.length === 1);
            if (!mine) { if (rec.n === 1) keepLog(`картинка только на экране, чья — не ясно: пост ${i}, картинка ${k} — ${fileOf(on)}`); return; }
            const m0 = m.mes;
            swapTag(i, m, t, withSrc(t, on));
            if (m.mes !== m0) {
                A.ctx().saveChat?.();
                shownSeen.delete(key);
                keepLog(`картинка была только на экране: пост ${i}, картинка ${k} — ${fileOf(on)} → вписала в пост`);
            }
            return;
        }
        redo = redo || `пост ${i}, картинка ${k} — в посте ${st === 'ok' ? fileOf(t.src) : 'ошибка'}, на экране ${card ? 'старая плашка' : fileOf(on)}`;
    });
    if (redo) {
        keepLog(`картинка не показывалась: ${redo} → пересобрала пост`);
        rerender(i).catch(e => console.warn('[Life] промты: пересобрать пост', e));
    }
}

// ───────────── путь с пробелом, разрезанный пополам (до 0.68.4) ─────────────
// SLAY кладёт картинки в папку персонажа: «/user/images/Bucky Barnes/…». Life читала путь тега до первого пробела
// («/user/images/Bucky») и ставила его двойнику; ↻ SLAY заменял этот кусок новым путём во всём посте — во всех свайпах
// и показах: «/user/images/generated/new.jpg Barnes/old.png». На экране «?», а Life (тоже до пробела) видела новую
// картинку — в окне промта она была (21.11, пост 833: свайпы 17 и 2). Чиним при открытии чата: картинке, которую
// перерисовывали (новый путь — в её «Версиях»), — новый путь; кого задело заодно — прежний путь целиком (начало папки
// берём с других картинок той же папки). Заодно «Версии» с путём до пробела — целиком.
const IMG_EXT = '(?:png|jpe?g|webp|gif|avif|mp4|webm)';
const SPLIT_RE = new RegExp(`^(\\S+?\\.${IMG_EXT}(?:\\?\\S*)?)(\\s+\\S[\\s\\S]*?\\.${IMG_EXT}(?:\\?\\S*)?)$`, 'i');
const SRC_ATTR_RE = /\bsrc\s*=\s*(["'])([^"']*)\1/gi;
const dirKey = (rest) => { const r = String(rest || ''); const k = r.lastIndexOf('/'); return k > 0 ? r.slice(0, k + 1) : ''; };
function textStores(m) {
    const out = [];
    if (typeof m.mes === 'string') out.push([m, 'mes', -1]);
    if (Array.isArray(m.swipes)) m.swipes.forEach((s, j) => { if (typeof s === 'string') out.push([m.swipes, j, j]); });
    for (const f of ['display_text', 'extblocks']) if (m.extra && typeof m.extra[f] === 'string') out.push([m.extra, f, -1]);
    if (Array.isArray(m.swipe_info)) m.swipe_info.forEach((si, j) => { const x = si?.extra; if (x) for (const f of ['display_text', 'extblocks']) if (typeof x[f] === 'string') out.push([x, f, j]); });
    return out;
}
let splitChat = '';
function fixSplitSrcs() {
    const key = chatKey();
    const chat = A.chatArr();
    if (!key || key === splitChat || !Array.isArray(chat) || !chat.length) return;
    splitChat = key;
    const bad = [], heads = new Map(), full = new Map();   // full: метка картинки → её путь целиком (с пробелом)
    chat.forEach((m, i) => {
        if (!m || typeof m !== 'object') return;
        for (const [obj, f, j] of textStores(m)) {
            const s = obj[f];
            if (!s.includes('src') || !s.includes('data-iig-instruction')) continue;
            for (const mm of s.matchAll(SRC_ATTR_RE)) {
                const v = mm[2];
                if (!/\s/.test(v.trim())) continue;
                const sp = v.trim().match(SPLIT_RE);
                if (sp) { bad.push({ obj, f, v, i, j, head: sp[1], rest: sp[2] }); continue; }
                const ws = v.search(/\s/), X = v.slice(0, ws), dk = dirKey(v.slice(ws));
                if (!dk) continue;
                const c = heads.get(dk) || new Map();
                c.set(X, (c.get(X) || 0) + 1);
                heads.set(dk, c);
            }
            if (f === 'mes' && /\s/.test(s)) for (const t of scanTags(s)) if (t.data?.pm && /\s/.test(t.src) && !SPLIT_RE.test(t.src)) full.set(t.data.pm, t.src);
        }
    });
    const hs = store();
    const headOf = (rest) => { const c = heads.get(dirKey(rest)); return c ? [...c.entries()].sort((a, b) => b[1] - a[1])[0][0] : ''; };
    const touched = new Set();
    let metaDirty = false;
    for (const b of bad) {
        const cur = b.obj[b.f];
        const t = scanTags(cur).find(x => x.src === b.v.trim());
        const pm = t?.data?.pm || '';
        const vers = pm && Array.isArray(hs[`t:${pm}`]?.v) ? hs[`t:${pm}`].v : [];
        const X = headOf(b.rest), old = X ? X + b.rest : '';
        const own = vers.some(v => shownSrc(v.src) === shownSrc(b.head));
        const to = own || !old ? b.head : old;
        const next = cur.split(`"${b.v}"`).join(`"${to}"`).split(`'${b.v}'`).join(`'${to}'`);
        if (next === cur) continue;
        b.obj[b.f] = next;
        if (own && X) for (const v of vers) if (v.src === X) { v.src = old; metaDirty = true; }   // версия «до перерисовки» — целиком
        if (b.f === 'mes' || b.j < 0 || b.j === (chat[b.i].swipe_id ?? 0)) touched.add(b.i);
        const where = typeof b.f === 'number' ? '' : b.f === 'mes' ? ' (текст)' : b.f === 'display_text' ? ' (показ)' : ' (блоки)';
        keepLog(`путь картинки был разрезан пополам: пост ${b.i}${b.j >= 0 ? `, свайп ${b.j}` : ''}${where} → ${own ? 'её новая картинка' : old ? 'прежняя картинка' : 'новая картинка'} ${fileOf(to)}`);
    }
    // «Версии», записанные с путём до пробела: целиком — если картинка всё та же, что в посте
    for (const [id, rec] of Object.entries(hs)) {
        const pm = id.startsWith('t:') ? id.slice(2) : '';
        const f = pm ? full.get(pm) : '';
        if (!f || !Array.isArray(rec?.v)) continue;
        const X = f.slice(0, f.search(/\s/));
        for (const v of rec.v) if (v && v.src === X) { v.src = f; metaDirty = true; }
    }
    if (metaDirty) A.saveMeta();
    if (!bad.length) return;
    A.ctx().saveChat?.();
    for (const i of touched) if (mesEl(i)) rerender(i).catch(e => console.warn('[Life] промты: пересобрать пост', e));
}

function hookHeal() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) { setTimeout(() => { try { hookHeal(); } catch { /* чата ещё нет */ } }, 1500); return; }
    if (chatEl.dataset.lfPmHeal) return;
    chatEl.dataset.lfPmHeal = '1';
    const ours = (n) => n.nodeType !== 1 || n.classList?.contains('lf-pm-btn') || n.classList?.contains('lf-pm-re') || n.classList?.contains('lf-pm-pend');
    new MutationObserver((list) => {
        if (healT) return;
        // свои же кнопки — не повод (иначе сверка будила бы сама себя); посты без картинок — тоже
        const hit = list.some(r => [...r.addedNodes, ...r.removedNodes].some(n => !ours(n)) && !!r.target.closest?.('.mes')?.querySelector('[data-iig-instruction]'));
        if (!hit) return;
        healT = setTimeout(() => { healT = 0; try { heal(); } catch (e) { console.warn('[Life] промты: присмотр за ✎', e); } }, 350);
    }).observe(chatEl, { childList: true, subtree: true });
}

// ───────────── картинка в тексте ↔ картинка на экране ─────────────

const mesEl = (i) => document.querySelector(`#chat .mes[mesid="${i}"]`);
const NODE_SEL = 'img[data-iig-instruction], video[data-iig-instruction], .iig-error-placeholder[data-iig-instruction]';
function nodesOf(i) {
    const mt = mesEl(i)?.querySelector('.mes_text');
    return mt ? [...mt.querySelectorAll(NODE_SEL)].filter(x => !x.closest('.lf-shot, .lf-detail, .lf-pm-proxy')) : [];
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
    // картинка должна лежать прямо в обёртке SLAY. Движок карточек кладёт её в свою рамку — и тогда ↻ SLAY остаётся
    // привязана к прежнему элементу: рисует по его старому промту и путь в пост не вписывает. Для таких — двойник.
    const wrap = node.parentElement;
    const btn = wrap?.classList?.contains('iig-img-wrap') ? wrap.querySelector(':scope > .iig-regen-btn') : null;
    return btn ? { kind: 'regen', btn } : null;
}

/** Что SLAY написал на плашке ошибки. Полный текст он кладёт в подсказку, но кавычки в ней не экранирует — она рвётся
 *  на первой же (а ответы сервисов — это JSON); на самой плашке текст целый, но обрезан. Берём что длиннее. */
function errOf(node) {
    const el = node?.querySelector?.('.iig-error-msg');
    const a = String(el?.getAttribute('title') || '').trim(), b = String(el?.textContent || '').trim();
    return a.length >= b.length ? a : b;
}

// ошибки SLAY живут только в его тостах — запоминаем последнюю, чтобы показать в окне причину
let lastSlayErr = null;
function hookToasts() {
    const t = globalThis.toastr;
    if (!t || t.__lifePm || typeof t.error !== 'function') return;
    // SLAY 5.x часть отказов (фильтр, например) показывает не ошибкой, а предупреждением — слушаем оба вида;
    // готово и «найдено тегов» — только в журнал
    for (const kind of ['error', 'warning', 'success', 'info']) {
        const fn = t[kind];
        if (typeof fn !== 'function') continue;
        t[kind] = function (message, title, ...rest) {
            try {
                if (/slay/i.test(String(title || ''))) {
                    const txt = String(message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (!(kind === 'info' && !/Найдено|Генерац/i.test(txt))) keepLog(`SLAY ${kind === 'success' ? '✓' : kind === 'info' ? '·' : '✗'} ${txt.slice(0, 300)}`, `(последний пост ${lastAi()})`);
                    // SLAY дорисовал или сдался — путь (или ошибка) уже в посте; на экране его может не быть, если пост пересобрали
                    if (kind !== 'info') healSoon(350, 1700);
                    if (kind === 'success' || kind === 'info') return fn.call(this, message, title, ...rest);
                    const msg = String(message || '').replace(/^(Перегенерация упала|Ошибка):\s*/i, '');
                    const filter = explainError(msg)?.kind === 'filter';
                    // предупреждения у SLAY бывают и не про рисование («каталог не загрузился») — из них берём только отказ фильтра
                    if (kind === 'error' || filter) lastSlayErr = { msg, at: Date.now() };
                    // фильтр — через пару секунд (SLAY дорисует плашку ошибки) посмотреть, не перерисовать ли в запасном стиле
                    if (filter) setTimeout(() => { try { scanFiltered(); } catch (e) { console.warn('[Life] промты: запасной стиль', e); } }, 1500);
                }
            } catch { /* */ }
            return fn.call(this, message, title, ...rest);
        };
    }
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
    for (const ms of [60, 250]) setTimeout(() => seePost(i), ms);   // SLAY соберёт плашки ошибок заново — попыток за ними нет
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

/** Дождаться, пока SLAY дорисует по своей кнопке. */
async function slayWait(ctl, el) {
    if (ctl.kind === 'regen') {
        await sleep(150);
        await until(() => !ctl.btn.classList.contains('iig-regen-busy'), DRAW_MS, 500);
        return;
    }
    const loading = () => !!el?.querySelector('.iig-loading-placeholder');
    await until(loading, 3000, 150);
    await until(() => !loading(), DRAW_MS, 500);
    await sleep(400); // SLAY дописывает путь в пост и сохраняет чат
}

/**
 * Двойник картинки для SLAY — скрытый <img> с тем же промтом в том же посте: SLAY сам вешает на него свою ↻,
 * по ней и рисуем. Нужен, когда своей кнопки SLAY у картинки нет (карточка GC унесла её из его обёртки) и когда
 * его кнопка вписала бы новый путь сразу в несколько картинок поста (см. slayDraw).
 * own — дать двойнику путь самой картинки: тогда SLAY сам впишет новый на его место. Иначе путь-пустышка,
 * которой в посте нет: SLAY нарисует, а путь в нужный тег впишем мы.
 */
async function slayProxy(i, t, own) {
    const mt = mesEl(i)?.querySelector('.mes_text');
    if (!mt) return null;
    const box = document.createElement('span');
    box.className = 'lf-pm-proxy';
    box.hidden = true;
    box.style.display = 'none';
    box.setAttribute('contenteditable', 'false');
    const img = document.createElement('img');
    img.setAttribute('data-iig-instruction', encodeIns(t.data));
    img.setAttribute('src', own ? t.src : `data:,life-pm-${A.uid()}`);
    box.append(img);
    mt.append(box);
    const node = () => box.querySelector('img[data-iig-instruction]');
    const ctl = await until(() => { const c = slayCtl(node()); return c?.kind === 'regen' ? c : null; }, 3000, 100);
    if (!ctl) { box.remove(); return null; }
    return { box, ctl, node };
}

/** Сколько тегов поста SLAY задел бы, вписывая новый путь на место этого (он меняет путь по всему тексту поста). */
function srcTwins(i, t) {
    const all = tagsOf(i);
    if (tagState(t) === 'ok') return all.filter(x => x.src === t.src).length;
    return all.filter(x => tagState(x) !== 'ok').length;   // значок ошибки и «ещё не рисовалась» — у всех таких путь один
}

const busyMark = (i, k, on) => { try { nodeFor(i, k)?.classList?.toggle('lf-pm-drawing', on); } catch { /* */ } };

/** Рисует сам SLAY — его кнопкой, значит со всеми его рефами, стилем и описаниями. null — SLAY выключен или не отозвался. */
async function slayDraw(i, k, onStep) {
    if (!slayOn() || !mesEl(i)) return null;
    const m = A.chatArr()[i];
    let t0 = tagsOf(i)[k];
    if (!t0?.data) return null;
    // тег — в одном виде с тем, что получит двойник: ↻ SLAY находит тег в посте по инструкции, и она должна совпасть знак в знак
    const canon = withIns(t0, t0.data);
    if (canon !== t0.full) { swapTag(i, m, t0, canon); await A.ctx().saveChat(); t0 = tagsOf(i)[k]; if (!t0?.data) return null; }
    const sig = sigOf(t0.data, t0.raw);
    const alone = srcTwins(i, t0) <= 1;
    let node = () => nodeFor(i, k);
    // «Попробовать снова» SLAY не жмём: плашка помнит промт с момента ошибки, а он мог с тех пор поменяться (оператор,
    // своя метка, правка в окне) — тогда SLAY рисует старый кадр и не может вписать его в пост. Двойник берёт промт из поста.
    let ctl = alone ? slayCtl(node()) : null;
    if (ctl?.kind !== 'regen') ctl = null;
    let proxy = null;
    if (!ctl) {
        proxy = await slayProxy(i, t0, alone && tagState(t0) === 'ok');
        if (!proxy) return null;
        ctl = proxy.ctl;
        node = proxy.node;
    }
    const before = m.mes;
    const oldSrc = t0.src || '';
    // ↻ SLAY читает промт с самой картинки на экране — там должен стоять ровно тот, что сейчас в посте
    if (ctl.kind === 'regen') node()?.setAttribute('data-iig-instruction', encodeIns(t0.data));
    const started = Date.now();
    onStep?.('рисует SLAY…');
    if (proxy) busyMark(i, k, true);
    // SLAY с крючком (порт 5.1.1): что бы его кнопка ни прочитала с экрана, рисовать он будет ровно то, что сейчас в посте
    drawAs = { i, prompt: String(t0.data.prompt || ''), aspect: String(t0.data.aspect_ratio || t0.data.aspectRatio || ''), style: typeof t0.data.style === 'string' ? t0.data.style : null, at: started };
    try {
        ctl.btn.click();
        await slayWait(ctl, mesEl(i));
        if (A.chatArr()[i] !== m) throw new Error('чат сменился, пока рисовалось');
        if (m.mes !== before) rekey(i, before);
        let t = tagsOf(i)[k];
        if (t && !(tagState(t) === 'ok' && t.src !== oldSrc)) {
            // SLAY нарисовал, а путь в пост не вписал: рисовали через двойника с путём-пустышкой, или его «путь значка
            // ошибки» не совпал с тем, что стоит в посте (тогда после перезагрузки картинка снова стала бы ошибкой).
            // Новый путь стоит на картинке на экране — вписываем его в свой тег сами.
            const seenImgs = [node(), nodeFor(i, k), ...[...(mesEl(i)?.querySelectorAll('.mes_text img[data-iig-instruction]') || [])].filter(x => nodeSig(x) === sig)];
            const got = seenImgs.map(x => (x?.tagName === 'IMG' ? x.getAttribute('src') || '' : '')).find(src => isPicture(src) && src !== oldSrc && !src.startsWith('data:'));
            if (got) {
                const m0 = m.mes;
                swapTag(i, m, t, withSrc(t, got));
                if (m.mes !== m0) await A.ctx().saveChat();
                t = tagsOf(i)[k];
            }
        }
        if (t && tagState(t) === 'ok' && t.src !== oldSrc) { keepLog(`нарисовано: пост ${i}, картинка ${k}${proxy ? ' (двойник)' : ''} → ${t.src.split('/').pop()}`); return { src: t.src }; }
        const why = (lastSlayErr && lastSlayErr.at >= started ? lastSlayErr.msg : '') || errOf(node()) || errOf(nodeFor(i, k)) || '';
        keepLog(`не нарисовано: пост ${i}, картинка ${k} —`, A.cut(why || 'SLAY не ответил', 300));
        throw new Error(why || 'SLAY не нарисовал картинку');
    } finally {
        if (drawAs?.at === started) drawAs = null;   // SLAY без крючка его не забирает; с крючком — уже забрал
        if (proxy) {
            proxy.box.remove();
            busyMark(i, k, false);
            try { if (A.chatArr()[i] === m) await rerender(i); } catch { /* пост перерисуется сам */ }
        }
    }
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
    const own = styleText(styleOf(d));
    const style = own ? `Style: ${own}\n` : d.style && d.style !== 'photo' && im.kind !== 'nai' ? `Style: ${String(d.style).replace(/_/g, ' ')}.\n` : '';
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
    // метка должна быть только у этой картинки; стоит в посте выше — значит, модель списала её оттуда вместе с тегом
    let copied = !!pm && A.chatArr().some((m, j) => j < i && typeof m?.mes === 'string' && m.mes.includes(pm));
    const msg = () => A.chatArr()[i];
    // тег ищется заново при каждом обращении (текст поста меняется): по своей метке, иначе по номеру
    const pick = (ts) => (pm && !copied && ts.find(t => t.data?.pm === pm)) || ts[k0] || null;
    const cur = () => pick(tagsOf(i));
    const idx = () => { const ts = tagsOf(i); const t = pick(ts); return t ? ts.indexOf(t) : -1; };
    const inCard = () => { const t = cur(); const m = msg(); return !!t && !!m && /<art\b/i.test(m.mes) && artBlocks(m.mes).some(b => b.full.includes(t.full)); };
    const engine = () => (slayOn() && mesEl(i) ? 'slay' : 'life');
    return {
        kind: 'post', mes: i, styled: true,
        get title() { return `${inCard() ? 'фото в карточке' : 'картинка'} · пост #${i}`; },
        read() {
            const t = cur();
            if (!t?.data) return null;
            const state = tagState(t);
            const said = state === 'error' ? (errOf(nodeFor(i, idx())) || 'Картинка не была сгенерирована') : '';
            return { prompt: String(t.data.prompt || ''), aspect: String(t.data.aspect_ratio || t.data.aspectRatio || ''), src: state === 'ok' ? t.src : '', state, error: said, pmStyle: copied ? '' : styleOf(t.data), look: String(t.data.style || '') };
        },
        hid: () => (pm && !copied ? `t:${pm}` : ''),
        tag: () => cur(),
        engine,
        extra(own = '') {
            // что рисовалка получит сверх этого промта — чтобы было видно, почему имена важны
            if (engine() !== 'slay') return `Гардероб сам допишет: рефы лиц тех, кто назван по имени, и стиль${own ? ` «${own}»` : ' из тега'}.`;
            const st = slay() || {};
            const d = cur()?.data || {};
            const lk = lookOfText(d.style);
            const film = !own && !st.slayStyle && lk ? (lookById(lk)?.[1] || 'своя') : '';
            const style = own || (st.slayStyle ? (st.slayStyleName || 'свой') : film ? '' : A.cut(String(d.style || '').replace(/_/g, ' '), 40));
            return `SLAY сам допишет: ${film ? `плёнку «${film}», ` : style ? `стиль «${style}», ` : ''}рефы тех, кто назван по имени${st.apiType === 'atlas' && String(st.atlasCharacterPrompt || '').trim() ? ', описания персонажей' : ''}.`;
        },
        /** style: имя своего стиля картинки, '' — общий, не задан — оставить как было. look: текст плёнки (поле style тега); пусто или не задан — как было. */
        async save({ prompt, aspect, style, look }) {
            const m = msg(), ts = tagsOf(i), t = pick(ts);
            if (!m || !t) throw new Error('картинка пропала из поста');
            const node = nodeFor(i, ts.indexOf(t), ts);
            const next = { ...(t.data || {}), prompt: cleanPrompt(prompt) };
            if (aspect) { next.aspect_ratio = aspect; delete next.aspectRatio; }
            if (look && String(look).trim()) next.style = String(look).replace(/["']/g, '').replace(/\s+/g, ' ').trim().slice(0, 700);
            const was = copied ? '' : styleOf(t.data);
            if (!next.pm || copied) next.pm = A.uid();   // своя метка: по ней картинка узнаётся после любых правок промта
            pm = next.pm;
            copied = false;
            const want = style === undefined ? was : String(style || '');
            if (want !== styleOf(next)) setStyleOf(next, want);   // стиль едет за промтом: отпечаток — по новому
            const nf = withIns(t, next);
            if (nf === t.full) return false;
            const failed = tagState(t) === 'error';
            swapTag(i, m, t, nf);
            // живой картинке: её ↻ SLAY читает промт отсюда. Плашке ошибки — нет: её «Попробовать снова» помнит промт в себе,
            // и по атрибуту видно, что плашка устарела (её тап перехватит Life — staleRetry)
            if (node?.tagName === 'IMG') node.setAttribute('data-iig-instruction', encodeIns(next));
            await A.ctx().saveChat();
            if (failed) await rerender(i);   // плашка ошибки помнит старый промт — пусть SLAY соберёт её заново
            return true;
        },
        async draw(onStep) {
            drawIn(i, 1);
            try { return (await slayDraw(i, idx(), onStep)) || await lifeDraw(i, cur, onStep); } finally { drawIn(i, -1); }
        },
        /** Вернуть в пост прежнюю картинку. Отдаёт путь, каким он записан. */
        async setSrc(src) {
            const m = msg(), t = cur();
            if (!m || !t) throw new Error('картинка пропала из поста');
            const node = nodeFor(i, idx());
            // SLAY 5.x помнит «старый путь → новый» и при каждой перерисовке поста «лечит» старые пути на новые. Прежняя
            // картинка — как раз старый путь, и он вернул бы на её место последнюю. Метка в адресе делает путь для него
            // незнакомым; файл тот же (сервер метку не читает).
            const put = src.includes('/user/images/') ? `${src.split(/[?#]/)[0]}?lf=${String(A.uid()).slice(0, 6)}` : src;
            swapTag(i, m, t, withSrc(t, put));
            await A.ctx().saveChat();
            if (node?.tagName === 'IMG' && node.closest('.iig-img-wrap')) node.setAttribute('src', put); else await rerender(i);
            return put;
        },
    };
}

// ───────────── ✎ на картинках ─────────────

const BTN = (i, k, cls = '') => `<button type="button" class="lf-pm-btn${cls}" data-mes="${i}" data-k="${k}" title="Промт картинки: посмотреть, поправить, перерисовать" contenteditable="false">${icon('pencil')}</button>`;
// своя ↻ — там, где у картинки нет ↻ самого SLAY (фото в карточке GC: движок унёс его из обёртки SLAY). Рисует тот же SLAY.
const RE = (i, k, cls = '') => `<button type="button" class="lf-pm-re${cls}" data-mes="${i}" data-k="${k}" title="Перерисовать по этому же промту" contenteditable="false">${icon('refresh')}</button>`;

/** У каждой картинки SLAY в посте — ✎ рядом с его ↻. Зовётся из отрисовки постов. */
export function paintPrompts(el, id) {
    const m = A.chatArr()[id];
    const has = !!m && !m.is_user && typeof m.mes === 'string' && m.mes.includes('data-iig-instruction');
    if (has && id >= A.chatArr().length - 14) watch(id, m);
    if (!has || !A.settings().enabled || !cfg().on) { el.querySelectorAll('.lf-pm-btn, .lf-pm-re').forEach(x => x.remove()); return; }
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
        if (err || node.tagName !== 'IMG' || slayCtl(node)) continue;
        let r = wrap ? wrap.querySelector(':scope > .lf-pm-re') : (b.nextElementSibling?.classList?.contains('lf-pm-re') ? b.nextElementSibling : null);
        if (!r) {
            const tmp = document.createElement('div');
            tmp.innerHTML = RE(id, k, wrap ? '' : ' loose');
            r = tmp.firstElementChild;
            b.after(r);
        } else if (r.dataset.k !== String(k)) r.dataset.k = String(k);
        r.classList.toggle('busy', quick.has(`${id}:${k}`));
        live.add(r);
    }
    el.querySelectorAll('.lf-pm-btn, .lf-pm-re').forEach(x => { if (!live.has(x)) x.remove(); });
}

/** Открыть окно промта по кнопке ✎. Что бы ни пошло не так — сказать об этом, а не промолчать. */
let pencilAt = 0;   // когда ✎ сработала в последний раз
function openFromButton(b) {
    pencilAt = Date.now();
    try {
        const i = Number(b.dataset.mes);
        pmLog(`тап ✎: пост ${i}`);
        // номер тега — по самой картинке: пост мог перерисоваться с тех пор, как кнопку поставили
        const node = b.classList.contains('err') ? b.closest('.iig-error-placeholder') : b.closest('.iig-img-wrap, .gca-slot')?.querySelector('img[data-iig-instruction]') || b.previousElementSibling;
        let k = node ? tagIndexOf(i, node) : -1;
        if (k < 0) k = Number(b.dataset.k);
        openPromptManager(tagAdapter(i, k));
    } catch (e) {
        console.warn('[Life] промты: ✎', e);
        A.toast('error', `Окно промта не открылось: ${String(e?.message || e).slice(0, 160)}`, '✎ Промт');
    }
}

/** ↻ Life у фото в карточке: перерисовать по тому же промту, окна не открывая. */
function redrawFromButton(b) {
    pencilAt = Date.now();
    const i = Number(b.dataset.mes);
    const node = b.closest('.iig-img-wrap, .gca-slot')?.querySelector('img[data-iig-instruction]') || null;
    let k = node ? tagIndexOf(i, node) : -1;
    if (k < 0) k = Number(b.dataset.k);
    pmLog(`тап ↻: пост ${i}, картинка ${k}`);
    quickDraw(i, k);
}

const TAP_SEL = '.lf-pm-btn, .lf-pm-re, #lf-pm-lbx button';
/** Нажата наша кнопка: ✎, ↻ или одна из двух на картинке во весь экран. Что бы ни пошло не так — сказать. */
function press(b) {
    try {
        if (b.closest('#lf-pm-lbx')) { pencilAt = Date.now(); lightboxPress(b); }
        else if (b.classList.contains('lf-pm-re')) redrawFromButton(b);
        else openFromButton(b);
    } catch (e) {
        console.warn('[Life] промты: кнопка', e);
        pmLog('кнопка: ошибка —', String(e?.message || e));
        A.toast('error', `Кнопка не сработала: ${String(e?.message || e).slice(0, 160)}`, '✎ Промт');
    }
}

/** Клик в чате. true — клик наш. Запасной путь: обычно тап по ✎ ловится раньше, в hookPencilTap. */
export function onPromptClick(ev) {
    const b = ev.target.closest?.('.lf-pm-btn, .lf-pm-re');
    if (!b) return false;
    ev.preventDefault();
    ev.stopPropagation();
    if (Date.now() - pencilAt > 700) press(b);
    return true;
}

/**
 * Тап по ✎ ловится на window в фазе перехвата — раньше любых слушателей чата: до кнопки в посте клик доходит через
 * таверну, SLAY, карточки GC и чужие расширения, и любой из них может его остановить. И второй путь, для телефона:
 * если палец коснулся ✎ и отпустил, а клика так и не случилось (его съели по дороге или не выдал браузер) — окно
 * открывается по самому касанию.
 */
function hookPencilTap() {
    const live = (b) => !!b && (!!b.closest('#chat') || !!b.closest('#lf-pm-lbx')) && !!A && A.settings().enabled !== false;
    // ✎ под пальцем, но тап достался тому, что лежит поверх неё: прозрачной накладке или кнопке SLAY из пустой обёртки
    // (картинку из неё унёс движок карточек). Чужую живую кнопку не трогаем — это её тап.
    const under = (ev) => {
        const t = ev.target;
        if (!t?.closest?.('#chat') || typeof document.elementsFromPoint !== 'function') return null;
        const ctl = t.closest('button, a, input, textarea, select, summary, label, [role="button"], [contenteditable="true"]');
        const wrap = ctl?.closest('.iig-img-wrap');
        if (ctl && !(wrap && !wrap.querySelector('img, video'))) return null;
        return document.elementsFromPoint(ev.clientX, ev.clientY).find(e => e.classList?.contains('lf-pm-btn') || e.classList?.contains('lf-pm-re')) || null;
    };
    window.addEventListener('click', (ev) => {
        const r = ev.target?.closest?.('.iig-error-retry');
        if (r && staleRetry(r, ev)) return;
        const b = ev.target?.closest?.(TAP_SEL) || under(ev);
        if (!live(b)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (Date.now() - pencilAt > 700) press(b);
    }, true);
    let down = null;
    window.addEventListener('pointerdown', (ev) => {
        const b = ev.pointerType === 'mouse' ? null : ev.target?.closest?.(TAP_SEL);
        down = live(b) ? { b, id: ev.pointerId, x: ev.clientX, y: ev.clientY, at: Date.now() } : null;
    }, true);
    window.addEventListener('pointercancel', () => { down = null; }, true);   // палец повёл страницу — это прокрутка
    window.addEventListener('pointerup', (ev) => {
        const d = down;
        down = null;
        if (!d || ev.pointerId !== d.id || Date.now() - d.at > 700 || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 12) return;
        setTimeout(() => {
            if (Date.now() - pencilAt < 900 || !d.b.isConnected) return;   // клик пришёл и сработал — или кнопки уже нет
            pmLog('тап без клика — открываю по касанию');
            press(d.b);
            if (S) S.ghost = Date.now();   // запоздалый клик того же касания попадёт уже в окно — его пропустить
        }, 380);
    }, true);
}

/**
 * «Попробовать снова» SLAY на плашке, промт которой уже не тот, что в посте (Life его переписала — оператор, своя метка,
 * правка в окне, — а плашка помнит промт с момента ошибки). SLAY нарисовал бы старый кадр и не вписал бы его в пост:
 * «Не удалось записать картинку в чат». Такой тап берёт Life и рисует по промту из поста. true — тап наш.
 */
function staleRetry(btn, ev) {
    const card = btn.closest('.iig-error-placeholder');
    if (!card || card.closest('.lf-pm-proxy') || !card.closest('#chat') || !A?.hasChat?.() || A.settings().enabled === false || !cfg().on) return false;
    const i = Number(card.closest('.mes')?.getAttribute('mesid'));
    if (!Number.isInteger(i) || !A.chatArr()[i]) return false;
    const tags = tagsOf(i);
    const key = insKey(card.getAttribute('data-iig-instruction'));
    if (key && tags.some(t => insKey(t.raw) === key)) return false;   // плашка свежая — её кнопка сработает как надо
    let k = tagIndexOf(i, card);
    if (k < 0) { const open = tags.map((t, j) => [t, j]).filter(([t]) => !t.video && tagState(t) !== 'ok'); if (open.length === 1) k = open[0][1]; }
    if (k < 0) return false;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    keepLog(`«Попробовать снова» на устаревшей плашке: пост ${i}, картинка ${k} — рисует Life по промту из поста`);
    quickDraw(i, k);
    return true;
}

// ───────────── открыть окно с самой картинки ─────────────
// Тап по картинке SLAY открывает её на весь экран. Туда и ставится кнопка «Промт»: один тап по картинке, второй —
// по большой кнопке под ней. По настройке тап открывает окно промта сразу (на весь экран тогда — тапом по картинке
// уже в окне).

let lastTap = null;   // какую картинку поста тапнули последней: { i, k, at }

function hookPictureTap() {
    // на window, а не на document: SLAY 5.x открывает картинку своим слушателем на document в той же фазе — и он старше
    window.addEventListener('click', (ev) => {
        const img = ev.target;
        if (img?.tagName !== 'IMG' || !img.hasAttribute('data-iig-instruction') || !img.closest('#chat')) return;
        if (img.closest('.lf-pm-proxy, .iig-error-placeholder, .lf-shot, .lf-detail')) return;
        if (!A?.hasChat?.() || A.settings().enabled === false || !cfg().on || !isPicture(img.getAttribute('src') || '')) return;
        const i = Number(img.closest('.mes')?.getAttribute('mesid'));
        if (!Number.isInteger(i) || !A.chatArr()[i]) return;
        const k = tagIndexOf(i, img);
        if (k < 0) return;
        if (cfg().tap) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openPromptManager(tagAdapter(i, k));
            return;
        }
        lastTap = { i, k, at: Date.now() };
        pmLog(`тап по картинке: пост ${i}, картинка ${k}`);
        for (const ms of [0, 120, 400]) setTimeout(lightboxBar, ms);   // SLAY откроет картинку сам — кнопки ставим следом
    }, true);
}

/**
 * Кнопки «Промт» и «Перерисовать» у картинки во весь экран. Стоят не в окне SLAY, а своим рядом поверх него (в <body>).
 * Прежняя кнопка жила в его ряду под картинкой (четвёртой — на телефоне уходила на вторую строку); в живой таверне в
 * Safari на iPhone «Промт» там не срабатывал. Почему — не установлено: на стенде в Chrome срабатывает. Свой ряд от
 * вёрстки SLAY не зависит. Только когда окно SLAY открыл тап по картинке поста.
 */
function lightboxBar() {
    const lb = document.getElementById('slay_lightbox');
    if (!lb) return;
    lb.querySelector('.lf-pm-lb')?.remove();   // кнопка прежних версий, в ряду SLAY
    if (!(lastTap && Date.now() - lastTap.at < 2500 && lb.classList.contains('open'))) return;
    let bar = document.getElementById('lf-pm-lbx');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'lf-pm-lbx';
        bar.innerHTML = `<button type="button" data-lb="open">${icon('pencil')}<span>Промт</span></button><button type="button" data-lb="redraw">${icon('refresh')}<span>Перерисовать</span></button>`;
        document.body.append(bar);
    }
    if (!lb.dataset.lfPm) {
        lb.dataset.lfPm = '1';
        // закрыли — кнопки убрать: в следующий раз это окно может открыть галерея стилей, а не картинка поста
        new MutationObserver(() => { if (!lb.classList.contains('open')) { const x = document.getElementById('lf-pm-lbx'); if (x) x.hidden = true; } }).observe(lb, { attributes: true, attributeFilter: ['class'] });
    }
    bar._tap = lastTap;
    bar.hidden = false;
}

function lightboxPress(b) {
    const bar = document.getElementById('lf-pm-lbx');
    const t = bar?._tap;
    const act = b.dataset.lb;
    pmLog(`картинка во весь экран: «${act === 'redraw' ? 'Перерисовать' : 'Промт'}»`, t ? `пост ${t.i}, картинка ${t.k}` : '— картинка неизвестна');
    document.querySelector('#slay_lightbox .iig-lightbox-close')?.click();
    if (bar) bar.hidden = true;
    if (!t || !A.chatArr()[t.i]) { A.toast('warning', 'Не поняла, какая это картинка, — тапни её в посте ещё раз.', '✎ Промт'); return; }
    if (act === 'redraw') quickDraw(t.i, t.k);
    else openPromptManager(tagAdapter(t.i, t.k));
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
// «Версии» картинки: сколько помнить. До 0.68.6 — 9 на картинку (исходная + 8 последних): при упорной перерисовке ранние
// уходили (22.11: у ванны в посте 833 из 20 перерисовок в «Версиях» осталось 8). Теперь до 60 на картинку и до 400
// картинок в чате, но весь журнал версий — не больше ~1,2 млн знаков (он лежит в шапке чата и сохраняется с ним):
// сверх этого первыми уходят картинки, которых дольше всех не трогали; у текущей — самые ранние, исходная остаётся.
const VERS_MAX = 60, PICS_MAX = 400, HIST_CHARS = 1200000;
function histTrim(st, keep) {
    const old = (a, b) => (st[a]?.at || 0) - (st[b]?.at || 0);
    const keys = Object.keys(st);
    if (keys.length > PICS_MAX) keys.sort(old).slice(0, keys.length - PICS_MAX).forEach(x => { if (x !== keep) delete st[x]; });
    const len = {};
    let size = 0;
    for (const k of Object.keys(st)) size += (len[k] = JSON.stringify(st[k]).length + k.length + 4);   // + «"ключ":» и запятая
    for (const k of Object.keys(st).sort(old)) {
        if (size <= HIST_CHARS) return;
        if (k !== keep) { size -= len[k]; delete st[k]; }
    }
    const v = st[keep]?.v;
    while (size > HIST_CHARS && Array.isArray(v) && v.length > 2) size -= JSON.stringify(v.splice(1, 1)[0]).length + 1;
}
function histPush(my, e) {
    const id = my?.ad.hid();
    if (!id) return;
    const st = store();
    const rec = st[id] = st[id] || { v: [] };
    if (!rec.v.length && my.first) rec.v.push(my.first);
    const last = rec.v[rec.v.length - 1];
    if (!(last && last.p === e.p && last.ar === e.ar && last.src === e.src && (last.sn || '') === (e.sn || ''))) rec.v.push(e);
    if (rec.v.length > VERS_MAX) rec.v.splice(1, rec.v.length - VERS_MAX); // исходный остаётся всегда
    rec.at = Date.now();
    histTrim(st, id);
    A.saveMeta();
}

// Перерисовки, что выпали из «Версий» по прежнему пределу (9), — вернуть по журналу картинок (там пост, номер картинки
// и файл; журнал помнит последние строки, так что вернётся то, что в нём осталось). Чья — по времени: у картинки этого
// поста, чьи «Версии» охватывают это время. Папку файла проверяем запросом к таверне. Промт у таких — как у соседней
// версии до неё (перерисовка без окна рисует промт поста как есть).
let logChat = '';
async function restoreFromLog() {
    const key = chatKey();
    if (!key || key === logChat) return;
    logChat = key;
    const log = A.chatMeta()?.pm?.log;
    const st = store();
    if (!Array.isArray(log) || !log.length || !Object.keys(st).length) return;
    const name = (src) => String(src || '').split(/[?#]/)[0].split('/').pop();
    const have = new Set(Object.values(st).flatMap(r => (Array.isArray(r?.v) ? r.v : []).map(v => name(v.src)).filter(Boolean)));
    const lost = [];
    for (const [at, t] of log) {
        const m = /^нарисовано: пост (\d+), картинка (\d+)[^→]*→ (\S+)/.exec(String(t || ''));
        if (m && !have.has(name(m[3]))) { have.add(name(m[3])); lost.push({ at: Number(at) || 0, i: +m[1], k: +m[2], file: m[3] }); }
    }
    if (!lost.length) return;
    const chat = A.chatArr();
    // папки картинок этого чата — самые частые первыми, generated (туда SLAY кладёт перерисовки) — в начало
    const dirs = new Map([['/user/images/generated/', 1e6]]);
    for (const r of Object.values(st)) for (const v of r?.v || []) { const s = String(v?.src || ''); const d = s.slice(0, s.lastIndexOf('/') + 1); if (d.startsWith('/user/images/')) dirs.set(d, (dirs.get(d) || 0) + 1); }
    const dirList = [...dirs.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 5);
    // файл есть, и это картинка (не страница таверны вместо 404)
    const exists = async (u) => { try { let r = await fetch(u, { method: 'HEAD', cache: 'no-store' }); if (r.status === 405) r = await fetch(u, { cache: 'no-store' }); return r.ok && /^(image|video)\//i.test(r.headers.get('content-type') || ''); } catch { return false; } };
    const back = new Map();
    for (const x of lost) {
        const m = chat[x.i];
        if (!m) continue;
        const pms = new Set();
        for (const s of [m.mes, ...(Array.isArray(m.swipes) ? m.swipes : [])]) { const t = typeof s === 'string' ? scanTags(s)[x.k] : null; if (t?.data?.pm) pms.add(t.data.pm); }
        const own = [...pms].map(pm => `t:${pm}`).filter(id => { const v = st[id]?.v; return Array.isArray(v) && v.length && (v[0].at || 0) <= x.at && x.at <= (st[id].at || v[v.length - 1].at || 0); });
        if (own.length !== 1) continue;
        let src = '';
        for (const d of dirList) { if (await exists(d + x.file)) { src = d + x.file; break; } }
        if (!src || A.chatArr() !== chat) continue;
        const v = st[own[0]].v;
        let at = v.findIndex(y => (y.at || 0) > x.at);
        if (at < 1) at = at === 0 ? 1 : v.length;
        const near = v[at - 1];
        v.splice(at, 0, { p: near.p, ar: near.ar, src, note: 'перерисовка · вернула из журнала', at: x.at, by: near.by || '', sn: near.sn || '' });
        back.set(x.i, (back.get(x.i) || 0) + 1);
    }
    if (!back.size) return;
    for (const id of Object.keys(st)) if (st[id].v?.length > VERS_MAX) st[id].v.splice(1, st[id].v.length - VERS_MAX);
    histTrim(st, '');
    A.saveMeta();
    for (const [i, n] of back) keepLog(`вернула в «Версии» ${n} перерисовок поста ${i}, что выпали по прежнему пределу`);
    if (S && S.ad?.kind === 'post' && back.has(S.ad.mes)) paint();
}

// ───────────── источники SLAY ─────────────

function sources() {
    const st = slay();
    if (!st) return [];
    if (!Array.isArray(st.connectionProfiles)) st.connectionProfiles = [];
    return st.connectionProfiles;
}
const saveAll = () => { try { A.ctx().saveSettingsDebounced(); } catch { /* */ } syncSlayProfiles(); };
/** SLAY 5.x показывает те же профили подключений своим списком и собирает его один раз, при загрузке. Источник добавили
 *  или убрали здесь — список в его панели обновляем сами, тем же видом (значение и подпись — имя профиля). */
function syncSlayProfiles() {
    try {
        const sel = document.getElementById('slay_conn_profile');
        const list = slay()?.connectionProfiles;
        if (!sel || !Array.isArray(list)) return;
        const names = list.map(p => String(p?.name || '')).filter(Boolean);
        const have = [...sel.options].map(o => o.value).filter(Boolean);
        if (names.length === have.length && names.every((n, i) => n === have[i])) return;
        const cur = sel.value;
        for (const o of [...sel.options]) if (o.value) o.remove();
        for (const n of names) { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.append(o); }
        sel.value = names.includes(cur) ? cur : '';
    } catch { /* панель SLAY не открыта или устроена иначе */ }
}

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
    else if (p.apiType === 'novelai') {
        // SLAY 5.x: модель NovelAI — список готовых или свой id; пишем в настройки, а список в панели просто показываем верно
        if (p.novelModel) { st.novelModel = p.novelModel; st.novelCustomModel = p.novelCustomModel || ''; }
        const sel = document.getElementById('slay_novel_model');
        if (sel && p.novelModel) sel.value = [...sel.options].some(o => o.value === p.novelModel) ? p.novelModel : 'custom';
    } else if (!setCtl('slay_model', p.model || '', 'input')) st.model = p.model || '';
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
- If the request is RESTYLE: delete every sentence or phrase about art style, medium, rendering technique, brushwork, palette, "lens feel" or a style reference, and add none — the new style reaches the renderer separately. Who, pose, clothes, place and light stay word for word where possible.
- If the last attempt was refused by moderation, remove or soften what most likely caused it — bare skin becomes covered or implied, wounds lose graphic detail, names of real actors, celebrities, brands and franchises go away — and keep the scene, the people and the mood. Say in the note what you softened.
- English only, one line, no line breaks, no quotation marks inside the prompt.`;

async function translate({ prompt, aspect, request = '', error = '', soften = false, restyle = false, styled = false }) {
    const im = imageModel();
    const d = DIALECTS[im.kind] || DIALECTS.generic;
    const user = [
        `CURRENT PROMPT:\n${prompt}`,
        `CURRENT ASPECT RATIO: ${aspect || 'not set'}`,
        restyle ? 'THE PLAYER ASKS: RESTYLE — strip the style words, as the rules say; change nothing else.'
            : request ? `THE PLAYER ASKS (Russian): ${request}` : soften ? 'THE PLAYER ASKS: make it pass moderation, as the rules say.' : 'NO REQUEST: only re-write this picture in the model\'s manner.',
        styled && !restyle ? 'NOTE: the art style of this picture reaches the renderer separately — keep the prompt free of art-style, medium and rendering-technique words.' : '',
        error ? `THE LAST ATTEMPT FAILED WITH: ${A.cut(error, 400)}` : '',
    ].filter(Boolean).join('\n\n');
    const raw = await A.askModel([{ role: 'system', content: TR_SYSTEM(d, im, A.cut(looks(), 900)) }, { role: 'user', content: user }], 1500, 'Промты');
    const j = A.extractJson(raw);
    const p = cleanPrompt(j?.prompt);
    if (p.length < 12) throw new Error('Летописец не вернул промт — попробуй ещё раз');
    return { prompt: p, aspect: ASPECTS.includes(j.aspect_ratio) ? j.aspect_ratio : '', note: String(j.note || '').trim().slice(0, 120) };
}

// ───────────── фильтр → запасной стиль ─────────────
// Отказ фильтра часто случаен: тот же промт со второго раза проходит. Поэтому в запасной стиль картинка уходит
// не с первого отказа, а с N-го (настройка, по умолчанию со второго); до этого Life сама пробует ещё раз как есть.

const fbRec = new Map();           // картинка → { n: сколько раз её не пропустил фильтр, done: с ней закончили, at }
const fbSeen = new WeakSet();      // плашки ошибок, уже посчитанные: каждая неудачная попытка SLAY — новая плашка
const fbBusy = new Set();          // картинки в очереди
const fbAlias = new Map();         // прежнее имя картинки → новое: оператор вписал в пост свой промт, пока она стояла в очереди
let fbChain = Promise.resolve();   // по одной: каждая — это вызовы рисовалки и Летописца
let fbHinted = false;
let fbChat = null;

const fbAfter = () => Math.min(3, Math.max(1, Number(cfg().fb.after) || 2));
const fbId = (i, t) => `${i}:${sigOf(t.data, t.raw)}`;
const fbOpen = (t) => !t.video && tagState(t) === 'error' && !!t.data?.prompt && !styleOf(t.data);   // в своём стиле ещё не пробовали
const chatKey = () => { try { const c = A.ctx(); return String(c.getCurrentChatId?.() ?? c.chatId ?? ''); } catch { return ''; } };
/** Плашки ошибок поста — «уже видели»: после пересборки поста они новые, но попыток за ними нет. */
const seePost = (i) => { for (const n of mesEl(i)?.querySelectorAll('.iig-error-placeholder') || []) fbSeen.add(n); };

/** Посчитать новые отказы фильтра у картинок поста. */
function noteRefusals(i, newest) {
    const fresh = newest && lastSlayErr && Date.now() - lastSlayErr.at < 20000 ? lastSlayErr : null;
    tagsOf(i).forEach((t, k) => {
        if (!fbOpen(t)) return;
        const id = fbId(i, t);
        const node = nodeFor(i, k);
        const rec = fbRec.get(id) || { n: 0, done: false, at: 0 };
        if (node?.matches?.('.iig-error-placeholder')) {
            if (fbSeen.has(node)) return;
            fbSeen.add(node);
            if (fbBusy.has(id) || explainError(errOf(node))?.kind !== 'filter') return;   // свои попытки очередь считает сама
        } else {
            // у фото в карточке GC плашки нет — судим по отказу, который пришёл только что (и один раз на отказ)
            if (!fresh || fbBusy.has(id) || rec.at === fresh.at || explainError(fresh.msg)?.kind !== 'filter') return;
            rec.at = fresh.at;
        }
        rec.n++;
        rec.done = false;
        fbRec.set(id, rec);
    });
}

/** SLAY сообщил об отказе фильтра — посчитать отказы в последних постах и поставить такие картинки в очередь. */
function scanFiltered() {
    if (!A?.hasChat?.() || A.settings().enabled === false || !slayOn()) return;
    const key = chatKey();
    if (key !== fbChat) { fbChat = key; fbRec.clear(); }
    const chat = A.chatArr();
    for (let i = chat.length - 1, posts = 0; i >= 0 && posts < 3; i--) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) continue;
        posts++;
        if (!mesEl(i)) continue;   // пост не на экране
        noteRefusals(i, posts === 1);
        if (!cfg().fb.auto || (S && S.ad.mes === i)) continue;   // выключено; открыто окно картинки из этого поста — там своя кнопка
        tagsOf(i).forEach((t, k) => {
            if (!fbOpen(t)) return;
            const id = fbId(i, t), rec = fbRec.get(id);
            if (!rec || rec.done || fbBusy.has(id)) return;
            fbBusy.add(id);
            fbChain = fbChain.then(() => autoFallback(i, k, rec)).catch(e => console.warn('[Life] промты: запасной стиль', e)).finally(() => {
                fbBusy.delete(id);
                const al = fbAlias.get(id);
                if (al) { fbBusy.delete(al); fbAlias.delete(id); }
            });
        });
    }
}

/** Одна картинка, которую не пропустил фильтр: до порога — ещё попытка как есть, на пороге — в запасном стиле. */
async function autoFallback(i, k, rec) {
    const m = A.chatArr()[i];
    if (!m) return;
    // SLAY ещё дорисовывает соседние картинки этого поста — не пересобирать пост у него под руками
    await until(() => !mesEl(i)?.querySelector('.iig-loading-placeholder'), DRAW_MS, 500);
    if (A.chatArr()[i] !== m) return;
    await until(() => !adopting.has(i), 20000, 250);   // оператор вписывает в пост свой промт — повторять будем уже по нему
    if (A.chatArr()[i] !== m) return;
    scanFiltered();   // соседей посчитать сейчас: после пересборки поста причина отказа с их плашек пропадёт
    const stop = () => A.chatArr()[i] !== m || !cfg().fb.auto || (S && S.ad.mes === i);
    if (stop()) return;
    const ad = tagAdapter(i, k);
    const cur = ad.read();
    if (!cur || cur.state !== 'error' || cur.pmStyle) { rec.done = true; return; }
    const need = fbAfter();
    const T = '✎ Запасной стиль';
    try {
        // до порога — ещё раз в общем стиле. Плёнка была фото (кино, Portra, неон…) — повтор тем же кадром, но рисунком
        // («Кино · кисть»): тот же промт фильтр второй раз почти всегда режет так же, а рисованный кадр пропускает.
        while (rec.n < need) {
            const was = ad.read();
            const photo = !!was && !PAINTED.has(lookOfText(was.look)) && !!lookOfText(was.look);
            A.toast('info', photo ? `Фильтр не пропустил фото — рисую тот же кадр кистью (отказ ${rec.n} из ${need}).` : `Фильтр не пропустил картинку — пробую ещё раз (отказ ${rec.n} из ${need}).`, T, { timeOut: 4000 });
            keepLog(`отказ фильтра: пост ${i}, картинка ${k} — ${photo ? 'повтор рисунком («Кино · кисть»)' : 'повтор как есть'} (отказ ${rec.n} из ${need})`);
            busyMark(i, k, true);
            try {
                if (photo) await ad.save({ prompt: was.prompt, aspect: was.aspect, look: lookById(LOOK_SAFE)[3] });
                await ad.draw();
                rec.done = true;
                A.toast('success', photo ? 'Рисунком прошло. Вернуть фото — ✎ → «Плёнка».' : 'Повторная попытка прошла — картинка в общем стиле.', T, { timeOut: 3500 });
                return;
            } catch (e) {
                seePost(i);
                if (explainError(String(e?.message || e))?.kind !== 'filter') { rec.done = true; console.warn('[Life] промты: повторная попытка не вышла, и это не фильтр', e); return; }   // запасной стиль тут не поможет
                rec.n++;
            }
            if (stop()) return;
        }
        const fb = fallbackStyle();
        if (!fb) {
            rec.done = true;
            if (!fbHinted) { fbHinted = true; A.toast('info', 'Фильтр не пропускает картинку. Запасной стиль ещё не выбран: ✎ на картинке → Настройки → «Запасной стиль».', '✎ Промт', { timeOut: 7000 }); }
            return;
        }
        A.toast('info', `Фильтр не пропустил картинку${need > 1 ? ` ${need} раза подряд` : ''} — перерисовываю в стиле «${esc(fb.name)}».`, T, { timeOut: 5000 });
        busyMark(i, k, true);
        const my = { ad, first: { p: cur.prompt, ar: cur.aspect, src: '', note: '', at: Date.now(), by: '', sn: '' } };
        let prompt = cur.prompt;
        try { prompt = (await translate({ prompt, aspect: cur.aspect, restyle: true })).prompt; }
        catch (e) { console.warn('[Life] промты: прежний стиль с промта не сняла — рисую как есть', e); }
        if (stop()) return;
        rec.done = true;   // в запасном — одна попытка
        const by = imageModel().name;
        try {
            await ad.save({ prompt, aspect: cur.aspect, style: fb.name });
            const r = await ad.draw();
            histPush(my, { p: prompt, ar: cur.aspect, src: r.src, note: `фильтр → стиль «${fb.name}»`, at: Date.now(), by, sn: fb.name });
            A.toast('success', `Готово, в стиле «${esc(fb.name)}». Не то — ✎ на картинке.`, T, { timeOut: 3500 });
        } catch (e) {
            A.toast('warning', `И в стиле «${esc(fb.name)}» не вышло: ${esc(A.cut(String(e?.message || e), 160))}`, T, { timeOut: 7000 });
        }
    } finally {
        seePost(i);
        busyMark(i, k, false);
        A.paintSoon?.();
    }
}

// ───────────── без окна: перерисовать, переснять ─────────────

const quick = new Set();   // «пост:картинка» — что сейчас рисуется без окна

/** Перерисовать картинку поста, не открывая окна: тем же промтом или (shoot) — сперва оператор переснимет кадр по посту. */
async function quickDraw(i, k, { shoot = false } = {}) {
    const T = shoot ? '✎ Оператор' : '✎ Перерисовать';
    const key = `${i}:${k}`;
    if (quick.has(key) || (S && S.busy && S.ad.kind === 'post' && S.ad.mes === i)) { A.toast('info', 'Эта картинка уже рисуется — появится на своём месте.', T); return false; }
    const ad = tagAdapter(i, k);
    let cur = null;
    try { cur = ad.read(); } catch (e) { console.warn('[Life] промты: чтение', e); }
    if (!cur) { pmLog(`без окна: промт не найден (пост ${i}, картинка ${k})`); A.toast('warning', 'Не нашла промт этой картинки в посте.', T); return false; }
    if (!cur.prompt.trim()) { A.toast('info', 'У картинки пустой промт — открой ✎ и впиши кадр.', T); return false; }
    // SLAY её ещё рисует (на экране «Рисуется…» — его плашку снесла пересборка поста): второй раз не запускаем
    if (cur.state === 'wait' && slayBusyIn(i) && nodeFor(i, k)?.classList?.contains('lf-pm-pending')) { pmLog(`без окна: пост ${i}, картинка ${k} — SLAY ещё рисует`); A.toast('info', 'SLAY ещё рисует эту картинку — появится на своём месте.', T); return false; }
    quick.add(key);
    busyMark(i, k, true);
    try { const el = mesEl(i); if (el) paintPrompts(el, i); } catch { /* */ }
    keepLog(`без окна: ${shoot ? 'переснять' : 'перерисовать'} — пост ${i}, картинка ${k} (${cur.state === 'ok' ? 'была картинка' : cur.state === 'error' ? 'была ошибка' : 'не рисовалась'}), рисует ${ad.engine() === 'slay' ? 'SLAY' : 'Гардероб'}`);
    const first = { p: cur.prompt, ar: cur.aspect, src: cur.src, note: '', at: Date.now(), by: '', sn: cur.pmStyle || '' };
    const by = imageModel().name;
    const tr = globalThis.toastr;
    const hold = (text) => { try { return tr?.info?.(text, T, { timeOut: 0, extendedTimeOut: 0 }) || null; } catch { return null; } };
    const drop = (t) => { try { if (t) tr?.clear?.(t); } catch { /* */ } };
    let prompt = cur.prompt, aspect = cur.aspect, note = 'перерисовка', tw = null;
    try {
        if (shoot) {
            tw = hold('Оператор ставит кадр по посту…');
            const [t] = await reshoot({ i, t: ad.tag(), prompt, aspect, error: cur.state === 'error' && explainError(cur.error)?.kind === 'filter' ? cur.error : '' });
            prompt = t.prompt;
            if (t.aspect) aspect = t.aspect;
            note = `оператор: ${t.note || t.shot || 'кадр переснят'}`;
            drop(tw);
        }
        tw = hold('Рисую — картинка сменится на своём месте.');
        await ad.save({ prompt, aspect });
        const r = await ad.draw();
        histPush({ ad, first }, { p: prompt, ar: aspect, src: r.src, note, at: Date.now(), by, sn: cur.pmStyle || '' });
        pmLog(`без окна: готово — пост ${i}`);
        drop(tw);
        A.toast('success', 'Готово. Прежняя картинка — в ✎ → «Версии».', T, { timeOut: 3500 });
        return true;
    } catch (e) {
        const msg = String(e?.message || e);
        console.warn('[Life] промты: без окна', e);
        keepLog('без окна: не вышло —', msg.slice(0, 300));
        drop(tw);
        A.toast('warning', esc(explainError(msg)?.text || A.cut(msg, 220)), `${T}: не вышло`, { timeOut: 8000 });
        return false;
    } finally {
        quick.delete(key);
        busyMark(i, k, false);
        A.paintSoon?.();
        setTimeout(() => { try { heal(); } catch { /* */ } }, 600);
    }
}

/** Последняя картинка чата (не видео): { i, k }. */
function lastPicture() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) continue;
        const ts = scanTags(m.mes);
        for (let k = ts.length - 1; k >= 0; k--) if (!ts[k].video && ts[k].data?.prompt) return { i, k };
    }
    return null;
}

/** Как картинка стоит в посте и какие кнопки при ней — для журнала. */
function domOf(i, k) {
    const node = nodeFor(i, k);
    if (!node) return 'на экране не найдена';
    const mt = mesEl(i)?.querySelector('.mes_text');
    const chain = [];
    for (let e = node; e && e !== mt && chain.length < 6; e = e.parentElement) chain.push(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    const seenBtn = (b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? 'видна' : 'скрыта'; };
    const btns = [...(mt?.querySelectorAll('.lf-pm-btn, .lf-pm-re, .iig-regen-btn') || [])].map(b => `${b.classList.contains('lf-pm-btn') ? '✎' : b.classList.contains('lf-pm-re') ? '↻ Life' : '↻ SLAY'} ${seenBtn(b)}`);
    return `${chain.join(' < ')}; кнопки: ${btns.join(', ') || 'нет'}`;
}

function showLog() {
    const last = lastPicture();
    const head = [
        `Life ${A.version || ''} · SLAY ${slayOn() ? 'включён' : 'выключен'}${hookAlive() ? ', зовёт соседей' : ', соседей не зовёт'} · ✎ ${cfg().on ? 'вкл' : 'выкл'}`,
        `${viewNow()} · ${String(navigator.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 110)}`,
        `открытые окна: ${dialogsNow().join('; ') || 'нет'}`,
        last ? `последняя картинка: пост ${last.i}, №${last.k} — ${domOf(last.i, last.k)}` : 'картинок в чате нет',
        '—',
    ];
    const kept = (() => { try { return (A.chatMeta().pm?.log || []).slice(-25).map(([at, t]) => { const d = new Date(at), two = (n) => String(n).padStart(2, '0'); return `${two(d.getDate())}.${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())} ${t}`; }); } catch { return []; } })();
    const text = [...head, ...(LOG.length ? LOG : ['с загрузки страницы кнопки картинок не трогали']), ...(kept.length ? ['— из чата (последние):', ...kept] : [])].join('\n');
    const c = A.ctx();
    const html = `<div style="text-align:left;font:12px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word">${esc(text)}</div>`;
    try {
        if (typeof c.callGenericPopup === 'function') { c.callGenericPopup(html, c.POPUP_TYPE?.TEXT ?? 1, '', { wide: true, allowVerticalScrolling: true }); return text; }
    } catch (e) { console.warn('[Life] промты: журнал', e); }
    A.toast('info', esc(text).replace(/\n/g, '<br>'), '✎ Журнал', { timeOut: 0, extendedTimeOut: 0, escapeHtml: false });
    return text;
}

/**
 * Команды без кнопок: «/life pm» — окно промта последней картинки чата; «/life pm log» — журнал;
 * «/life redraw» — перерисовать её по тому же промту; «/life reshoot» — оператор переснимет кадр по посту и нарисует.
 * true — команда наша.
 */
export function pmCommand(word) {
    const m = /^(pm|промт|redraw|перерисовать|reshoot|переснять)(?:\s+(\S+))?$/.exec(String(word || '').trim().toLowerCase());
    if (!m || !A) return false;
    const act = /^(pm|промт)$/.test(m[1]) ? 'pm' : /^(redraw|перерисовать)$/.test(m[1]) ? 'redraw' : 'reshoot';
    if (act === 'pm' && /^(log|лог|журнал)$/.test(m[2] || '')) { showLog(); return true; }
    if (!A.hasChat?.()) { A.toast('info', 'Сначала открой чат.', '✎ Промт'); return true; }
    const last = lastPicture();
    if (!last) { A.toast('info', 'В чате нет картинок SLAY.', '✎ Промт'); return true; }
    pmLog(`команда /life ${m[1]}: пост ${last.i}, картинка ${last.k}`);
    if (act === 'pm') openPromptManager(tagAdapter(last.i, last.k));
    else quickDraw(last.i, last.k, { shoot: act === 'reshoot' });
    return true;
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

/** Открытые <dialog> — для журнала: модальный ли, виден ли. Невидимый модальный — главный подозреваемый, если окна не видно. */
function dialogsNow() {
    return [...document.querySelectorAll('dialog[open]')].filter(d => d.id !== 'lf-pm').map(d => {
        let modal = '?';
        try { modal = d.matches(':modal') ? 'модальный' : 'обычный'; } catch { /* */ }
        const r = d.getBoundingClientRect(), cs = getComputedStyle(d);
        return `${d.id ? '#' + d.id : d.className ? '.' + String(d.className).split(/\s+/)[0] : 'dialog'} (${modal}, ${Math.round(r.width)}×${Math.round(r.height)}, ${cs.visibility}, opacity ${cs.opacity})`;
    });
}

/** Окно промта в верхнем слое браузера. false — не вышло (старый браузер): тогда обычным слоем, как раньше. */
function showOnTop(d) {
    try {
        if (typeof d.showModal !== 'function') return false;
        d.showModal();
        return d.matches(':modal');
    } catch (e) {
        console.warn('[Life] промты: верхний слой', e);
        pmLog('окно: в верхний слой не встало —', String(e?.message || e));
        return false;
    }
}

// тосты таверны живут в обычном слое — пока окно открыто, их контейнер едет в окно, иначе их не видно
let toastHome = null, toastWatch = null;
function toastsIn(d) {
    const grab = () => {
        const tc = document.getElementById('toast-container');
        if (!tc || tc.parentElement === d) return;
        toastHome = toastHome || tc.parentElement;
        d.append(tc);
    };
    grab();
    try { toastWatch = new MutationObserver(grab); toastWatch.observe(document.body, { childList: true }); } catch { /* */ }
}
function toastsOut() {
    try { toastWatch?.disconnect(); } catch { /* */ }
    toastWatch = null;
    const tc = document.getElementById('toast-container');
    if (tc && tc.closest('#lf-pm')) (toastHome && toastHome.isConnected ? toastHome : document.body).append(tc);
    toastHome = null;
}

/** Открыть окно промта. ad — «переходник» картинки: read / save / draw / setSrc / hid / engine (см. tagAdapter). */
export function openPromptManager(ad) {
    closeManager();
    let cur = null;
    try { cur = ad?.read(); } catch (e) { console.warn('[Life] промты: чтение', e); }
    if (!cur) { pmLog('окно: промт картинки в посте не найден'); A.toast('warning', 'Не нашла промт этой картинки в посте.', '✎ Промт'); return; }
    pmLog('окно: открываю —', (() => { try { return ad.title || ''; } catch { return ''; } })());
    S = {
        ad, prompt: cur.prompt, aspect: cur.aspect, base: cur.prompt, baseAspect: cur.aspect, src: cur.src, state: cur.state,
        err: cur.error ? { msg: cur.error, ...(explainError(cur.error) || {}) } : null,
        pmStyle: cur.pmStyle || '', basePm: cur.pmStyle || '',   // имя своего стиля картинки; пусто — общий
        look: cur.look || '', baseLook: cur.look || '',           // плёнка: текст поля style тега (только у картинок постов)
        takes: [],                                                 // дубли оператора
        fix: '', note: '', busy: '', step: '', prev: null, fold: '',
        first: { p: cur.prompt, ar: cur.aspect, src: cur.src, note: '', at: Date.now(), by: '', sn: cur.pmStyle || '' },
    };
    box = document.createElement('dialog');
    box.id = 'lf-pm';
    box.innerHTML = '<div class="lf-pm-in"></div>';   // перерисовывается только это — тосты и прочее рядом остаются
    box.addEventListener('click', onBoxClick);
    box.addEventListener('input', onBoxInput);
    box.addEventListener('change', onBoxInput);   // список стилей: не всякий браузер шлёт input на <select>
    box.addEventListener('keydown', onBoxKey);
    box.addEventListener('cancel', (ev) => { ev.preventDefault(); closeManager(); });   // Esc и «назад»
    document.body.append(box);
    const dl = dialogsNow();
    if (dl.length) pmLog('окно: уже открыты —', dl.join('; '));
    try { paint(); } catch (e) {
        // пустое окно осталось бы невидимым поверх всей таверны и глотало бы тапы
        console.warn('[Life] промты: окно', e);
        pmLog('окно: не нарисовалось —', String(e?.message || e));
        closeManager();
        A.toast('error', `Окно промта не нарисовалось: ${String(e?.message || e).slice(0, 160)}`, '✎ Промт');
        return;
    }
    const mine = box;
    const onTop = showOnTop(mine);
    if (!onTop) mine.setAttribute('open', '');   // обычным слоем, как до 0.67.2
    else toastsIn(mine);
    pmLog(`окно: ${onTop ? 'в верхнем слое' : 'обычным слоем'}`);
    requestAnimationFrame(() => mine.classList.add('on'));
    setTimeout(() => {
        if (box !== mine) return;
        mine.classList.add('on');   // вкладка была не на экране — кадр анимации мог не прийти
        // оформление окна лежит в style.css Life: без него окно — голый текст в самом низу страницы
        if (getComputedStyle(mine).position !== 'fixed') { pmLog('окно: стили Life не загрузились'); A.toast('warning', 'Окно промта открылось, но стили Life не загрузились — обнови страницу.', '✎ Промт'); }
        else windowSeen(mine);
    }, 500);
}

const whoIs = (el) => { const out = []; for (let e = el, n = 0; e && e.nodeType === 1 && n < 3; e = e.parentElement, n++) out.push(e.tagName.toLowerCase() + (e.id ? `#${e.id}` : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); return out.join(' < '); };

const viewNow = () => {
    const v = window.visualViewport;
    return `экран ${window.innerWidth}×${window.innerHeight}${v ? `, видно ${Math.round(v.width)}×${Math.round(v.height)} со сдвигом ${Math.round(v.offsetLeft)},${Math.round(v.offsetTop)} ×${Math.round(v.scale * 100) / 100}` : ''}, прокрутка ${Math.round(window.scrollY)}`;
};

/** Окно открыто — а видно ли его? Обычным слоем: поверх чужой слой — поднять над всем. Не видно — сказать, почему. */
function windowSeen(mine, lifted = false) {
    const card = mine.querySelector('.lf-pm-card');
    if (!card || !mine.isConnected) return;
    const r = card.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const x = Math.min(vw - 2, Math.max(2, r.left + r.width / 2)), y = Math.min(vh - 2, Math.max(2, r.top + Math.min(60, r.height / 2)));
    const top = document.elementFromPoint(x, y);
    const cs = getComputedStyle(mine);
    let modal = false;
    try { modal = mine.matches(':modal'); } catch { /* */ }
    const rect = `карточка ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}; ${viewNow()}; окно ${cs.display}/${cs.visibility}/${cs.opacity}`;
    const ok = r.width > 80 && r.height > 120 && r.top < vh - 40 && r.bottom > 40 && !!top && mine.contains(top) && cs.display !== 'none' && cs.visibility !== 'hidden';
    if (ok) { pmLog(`окно: видно (${Math.round(r.width)}×${Math.round(r.height)}${modal ? ', верхний слой' : ''}${lifted ? ', поднято над чужим слоем' : ''})`); return; }
    const why = top && !mine.contains(top) ? `в точке карточки — ${whoIs(top)}` : 'карточка не на экране';
    pmLog(lifted ? 'окно: не видно и после подъёма —' : 'окно: не видно —', `${why}; ${rect}`);
    if (modal || lifted || mine.parentElement !== document.body) {
        A.toast('warning', `Окно промта открылось, но его не видно (${esc(why)}). Пришли Claude скрин «/life pm log». Перерисовать можно и без окна: ↻ на картинке или «/life redraw».`, '✎ Промт', { timeOut: 10000 });
        return;
    }
    mine.classList.add('top');   // самый верхний слой, без анимации
    document.documentElement.append(mine);
    setTimeout(() => { if (box === mine) windowSeen(mine, true); }, 250);
}

function closeManager() {
    toastsOut();
    try { if (box?.open && typeof box.close === 'function') box.close(); } catch { /* */ }
    box?.remove();
    box = null;
    S = null;
    setTimeout(() => { try { scanFiltered(); } catch { /* */ } }, 400);   // пока окно было открыто, его пост запасной стиль не трогал
}

const dirty = () => !!S && (S.prompt.trim() !== String(S.base || '').trim() || S.aspect !== S.baseAspect || S.pmStyle !== S.basePm || S.look !== S.baseLook);
const saveArgs = (my) => ({ prompt: my.prompt, aspect: my.aspect, style: my.ad.styled ? my.pmStyle : undefined, look: my.ad.kind === 'post' ? my.look : undefined });
const wordsOf = (t) => (String(t).trim() ? String(t).trim().split(/\s+/).length : 0);

function previewHtml() {
    const pic = S.src ? `<div class="lf-pm-prev"><img src="${esc(S.src)}" alt="" data-pm="zoom"></div>` : (S.err ? '' : `<div class="lf-pm-prev empty">${icon('image')}<span>картинки пока нет</span></div>`);
    if (!S.err) return pic;
    return `${pic}<div class="lf-pm-err">${icon('shield')}<div>
        <b>Не нарисовалось</b>
        <p>${esc(S.err.text || 'Сервис картинок ответил ошибкой.')}</p>
        ${S.err.msg ? `<details><summary>Что ответил сервис</summary><code>${esc(A.cut(S.err.msg, 600))}</code></details>` : ''}
        ${S.err.kind === 'filter' ? `<button data-pm="soften">${icon('feather')} Смягчить под фильтр</button>` : ''}
        ${S.err.kind === 'filter' && S.ad.styled && !S.pmStyle && fallbackStyle() ? `<button data-pm="style" data-v="${esc(fallbackStyle().name)}">${icon('palette')} В стиле «${esc(fallbackStyle().name)}»</button>` : ''}
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
        <div><b>${k === 0 ? 'Исходный' : esc(v.note || 'правка')}</b><small>${[when(v.at), v.by, v.sn ? `стиль «${v.sn}»` : ''].filter(Boolean).map(esc).join(' · ')}</small>
            <p>${esc(A.cut(v.p, 150))}</p>
            <span><button data-pm="hist-load" data-k="${k}">взять промт</button>${v.src && v.src !== S.src ? `<button data-pm="hist-back" data-k="${k}">вернуть картинку</button>` : ''}</span>
        </div>
    </div>`).reverse().join('')}</div>`;
}

/** Строка «Стиль» под промтом: общий (как у всех картинок) или свой — запасной. */
function styleRowHtml() {
    if (!S.ad.styled) return '';
    const names = [...new Set([S.pmStyle, fallbackStyle()?.name].filter(Boolean))];
    if (!names.length) return '';
    return `<div class="lf-pm-chips st"><span>Стиль</span><button class="lf-pm-chip${S.pmStyle ? '' : ' on'}" data-pm="style" data-v="">общий</button>${names.map(n => `<button class="lf-pm-chip${S.pmStyle === n ? ' on' : ''}" data-pm="style" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
}

// ───────────── оператор в окне ─────────────

const DP_ASK = [
    ['химия', 'больше химии между ними: они заняты друг другом, а не камерой — взгляды, одно касание с весом, тела ближе и неровно'],
    ['живые лица', 'живые лица: у каждого своя конкретная эмоция этого момента, без одинаковых полуулыбок'],
    ['свет сцены', 'свет и настроение как в сцене: настоящий источник света этого места и часа, тени, цвет'],
    ['другой план', 'другой план и другая высота камеры, не как сейчас'],
    ['шире: место', 'общий план: место тоже герой кадра, фигуры небольшие'],
    ['деталь', 'деталь крупно: руки или жест вместо лиц'],
];
/** SLAY сам зовёт соседей перед отрисовкой (порт 5.1.1+) — значит, новый кадр можно переснять до запроса. */
const hookAlive = () => Number(globalThis.slayHooks?.version) >= 1;

function operatorHtml() {
    if (S.ad.kind === 'detail') return '';   // деталь — предмет крупным планом, людей и сцены в ней нет
    return `<label class="lf-pm-l"><span>Оператор</span><small>переснять кадр по посту</small></label>
        <div class="lf-pm-chips dp"><button class="lf-pm-chip go" data-pm="dp">${icon('film')} Переснять</button><button class="lf-pm-chip" data-pm="dp-takes">${icon('layers')} три дубля</button>${DP_ASK.map(([t, v]) => `<button class="lf-pm-chip" data-pm="dp-ask" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>
        ${S.takes.length ? `<div class="lf-pm-takes">${S.takes.map((t, k) => `<button class="lf-pm-take" data-pm="take" data-k="${k}"><b>${esc(t.note || shotLabelRu(shotOf(t.prompt)) || `дубль ${k + 1}`)}</b><small>${esc([t.shot, S.ad.fixedAspect ? '' : t.aspect].filter(Boolean).join(' · '))}</small><p>${esc(A.cut(t.prompt, 170))}</p></button>`).join('')}</div>` : ''}`;
}

/** Строка «Плёнка»: вид картинки — текст в поле style её тега. Первой стоит плёнка этой сцены. */
function lookRowHtml() {
    if (S.ad.kind !== 'post') return '';
    const cur = lookOfText(S.look);
    let def = '';
    try { def = lookNow(sceneOf(S.ad.mes)).id; } catch { /* сцена не читается */ }
    const list = [...LOOKS].sort((a, b) => ((b[0] === cur) - (a[0] === cur)) || ((b[0] === def) - (a[0] === def)));   // выбранная — первой, за ней плёнка сцены
    const st = slay();
    const general = !S.pmStyle && String(st?.slayStyle || '').trim() ? String(st.slayStyleName || 'свой') : '';
    return `<div class="lf-pm-chips lk"><span>Плёнка</span>${list.map(([id, label, hint]) => `<button class="lf-pm-chip${cur === id ? ' on' : ''}" data-pm="look" data-v="${id}" title="${esc(id === def ? `${hint} — плёнка этой сцены` : hint)}">${id === def ? '✦ ' : ''}${esc(label)}</button>`).join('')}${cur === LOOK_OWN ? '<button class="lf-pm-chip on" disabled>своя</button>' : ''}</div>
        ${S.pmStyle ? `<div class="lf-pm-dim">У этой картинки свой стиль «${esc(S.pmStyle)}» — он сильнее плёнки.</div>`
        : general ? `<div class="lf-pm-note warn">${icon('palette')}<span>В SLAY выбран общий стиль «${esc(general)}» — он сильнее плёнки.</span><button data-pm="slay-style-off">снять</button></div>`
            : cur ? '' : `<div class="lf-pm-dim">Плёнки у этой картинки нет${S.look ? ` (в теге: ${esc(A.cut(S.look, 30))})` : ''} — вид идёт из промта. Тапни плёнку: вид уйдёт рисовалке отдельно, промт останется про кадр.</div>`}`;
}

function dpSetHtml() {
    const c = dpCfg();
    const tg = (k, label) => `<button class="lf-pm-tg${c[k] ? ' on' : ''}" data-pm="dpset" data-v="${k}"><i></i><span>${label}</span></button>`;
    let now = null;
    try { now = lookNow(sceneOf()); } catch { /* */ }
    return `<label class="lf-pm-l"><span>Оператор</span><small>кадр как у фотографа</small></label>
        ${tg('on', 'Подсказывать модели на каждый ответ: плёнку, свет сцены и какие кадры уже были')}
        ${tg('auto', 'Новый кадр переснимать самой, до отрисовки')}
        ${c.auto && !hookAlive() ? '<div class="lf-pm-dim">Этот SLAY перед отрисовкой соседей не зовёт — сама пересниму после переезда на SLAY 5.1.1 (порт). Пока — кнопкой «Переснять» в окне.</div>' : ''}
        <select class="lf-pm-sel" data-in="dplook">${lookChoices().map(([id, label, hint]) => `<option value="${id}"${c.look === id ? ' selected' : ''}>${esc(`Плёнка: ${label} — ${hint}`)}</option>`).join('')}</select>
        ${c.look === LOOK_OWN ? `<textarea class="lf-pm-ta small" data-in="dpown" rows="3" placeholder="По-английски, как описывают вид картинки: film stock, light, grain, texture…">${esc(c.own)}</textarea>` : ''}
        <div class="lf-pm-dim">Плёнка — вид картинки: она уходит рисовалке отдельно от промта (поле style тега), так что сам промт остаётся про кадр.${now?.text ? ` Сейчас у сцены: «${esc(now.name)}».` : ''} Запасной стиль от фильтра сильнее плёнки; общий стиль, выбранный в SLAY, — тоже.</div>`;
}

function fbSetHtml() {
    const f = cfg().fb;
    const lib = slayStyles();
    // автор библиотеки мог поправить стиль — запомненный текст обновить
    let fresh = false;
    for (const x of lib) if (f.lib[x.name] && f.lib[x.name] !== x.prompt) { f.lib[x.name] = x.prompt; fresh = true; }
    if (fresh) A.saveSettings();
    const names = [...new Set([...lib.map(x => x.name), ...Object.keys(f.lib).filter(k => k !== OWN_STYLE)])].sort((a, b) => a.localeCompare(b));
    const auto = names.find(n => FB_AUTO.test(n)) || '';
    const opt = (v, label) => `<option value="${esc(v)}"${f.name === v ? ' selected' : ''}>${esc(label)}</option>`;
    return `<label class="lf-pm-l"><span>Запасной стиль</span><small>когда фильтр не пропустил</small></label>
        <button class="lf-pm-tg${f.auto ? ' on' : ''}" data-pm="set" data-v="fb.auto"><i></i><span>Фильтр не пропустил картинку — сама перерисую её в запасном стиле</span></button>
        <div class="lf-pm-chips af"><span>с какого отказа подряд</span>${[1, 2, 3].map(n => `<button class="lf-pm-chip${f.after === n ? ' on' : ''}" data-pm="fbafter" data-v="${n}">${n}-го</button>`).join('')}</div>
        <select class="lf-pm-sel" data-in="fbname">
            ${opt('', auto ? `сам: «${auto}»` : 'сам: «Клаус» из библиотеки SLAY')}
            ${names.map(n => opt(n, n)).join('')}
            ${opt(OWN_STYLE, 'свой текст…')}
        </select>
        ${f.name === OWN_STYLE ? `<textarea class="lf-pm-ta small" data-in="fbtext" rows="3" placeholder="По-английски, как описывают стиль: flat 2D cartoon, bold clean outlines, soft cel shading…">${esc(f.lib[OWN_STYLE] || '')}</textarea>` : ''}
        <div class="lf-pm-dim">${lib.length
        ? `Отказ фильтра часто случаен, поэтому до выбранного отказа пробую ещё раз как есть. Общий стиль не меняется: в запасном рисуется только та картинка, которую фильтр так и не пропустил, — и её ↻ потом тоже. Стили — из библиотеки SLAY (${lib.length}).`
        : 'Библиотека стилей SLAY в этом браузере ещё не скачана: открой в настройках SLAY «Выбрать стиль» один раз — список появится здесь.'}${fallbackStyle() ? '' : ' Сейчас запасного стиля нет.'}</div>`;
}

function setHtml() {
    const c = cfg();
    const tg = (k, label) => `<button class="lf-pm-tg${c[k] ? ' on' : ''}" data-pm="set" data-v="${k}"><i></i><span>${label}</span></button>`;
    return `<div class="lf-pm-sub">
        ${tg('auto', 'После «поправить» сразу рисовать')}
        ${tg('dialect', 'Подсказывать модели, под какую рисовалку писать промт в посте')}
        ${tg('on', '✎ на картинках в постах')}
        ${tg('tap', 'Тап по картинке — сразу окно промта (а не на весь экран)')}
        ${dpSetHtml()}
        ${fbSetHtml()}
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
    const extra = (() => { try { return S.ad.extra?.(S.pmStyle) || ''; } catch { return ''; } })();
    const chev = (k) => icon(S.fold === k ? 'chevU' : 'chevD');
    const top = box.querySelector('.lf-pm-body')?.scrollTop || 0;
    const host = box.querySelector(':scope > .lf-pm-in') || box;
    host.innerHTML = `<div class="lf-pm-back" data-pm="x"></div>
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
            ${operatorHtml()}
            ${S.note ? `<div class="lf-pm-note">${icon('sparkles')}<span>${esc(S.note)}</span>${S.prev ? '<button data-pm="undo">вернуть как было</button>' : ''}</div>` : ''}
            <label class="lf-pm-l"><span>Промт</span><small class="lf-pm-cnt">${cntText()}</small></label>
            <textarea class="lf-pm-ta" data-in="prompt" rows="6" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(S.prompt)}</textarea>
            ${extra ? `<div class="lf-pm-dim">${esc(extra)}</div>` : ''}
            ${S.ad.fixedAspect ? '' : `<div class="lf-pm-chips ar">${AR_SHOWN.map(a => `<button class="lf-pm-chip${a === S.aspect ? ' on' : ''}" data-pm="ar" data-v="${a}">${a}</button>`).join('')}</div>`}
            ${lookRowHtml()}
            ${styleRowHtml()}
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

/** Под промтом: как снят кадр (план, высота камеры, приём — по словам промта), сколько слов, изменён ли. */
function cntText() {
    const n = wordsOf(S.prompt);
    const shot = S.ad.kind === 'detail' ? '' : shotLabelRu(shotOf(S.prompt));
    return `${shot ? `${shot} · ` : ''}${n} ${A.plural(n, 'слово', 'слова', 'слов')}${dirty() ? ' · изменён' : ''}`;
}

/** Пока печатает — обновлять только счётчик слов и «сохранить», фокус не трогать. */
function tick() {
    if (!box || !S) return;
    const cnt = box.querySelector('.lf-pm-cnt');
    if (cnt) cnt.textContent = cntText();
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
    else if (k === 'fbtext') { cfg().fb.lib[OWN_STYLE] = el.value.slice(0, 1500); A.saveSettings(); if (ev.type === 'change') paint(); }   // дописала и вышла из поля — обновить строку «Стиль»
    else if (k === 'dpown') { dpCfg().own = el.value.slice(0, 700); A.saveSettings(); if (ev.type === 'change') { try { A.updatePrompt?.(); } catch { /* */ } } }
    else if (k === 'dplook') {
        const c = dpCfg();
        if (c.look === el.value) return;
        c.look = el.value;
        dpCfg();   // незнакомое значение вернётся к «авто»
        A.saveSettings();
        try { A.updatePrompt?.(); } catch { /* */ }
        paint();
    }
    else if (k === 'fbname') {
        const f = cfg().fb;
        if (f.name === el.value) return;
        f.name = el.value;
        if (f.name && f.name !== OWN_STYLE) keepStyle(f.name, styleText(f.name));
        A.saveSettings();
        paint();
    }
}

function onBoxKey(ev) {
    if (ev.key === 'Enter' && ev.target?.dataset?.in === 'fix') { ev.preventDefault(); fixNow(S.fix); }
    else if (ev.key === 'Escape') closeManager();
}

async function onBoxClick(ev) {
    const b = ev.target.closest('[data-pm]');
    if (!b || !S) return;
    if (S.ghost && Date.now() - S.ghost < 450) return;
    const act = b.dataset.pm;
    if (b.tagName === 'BUTTON' && b.disabled) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (act === 'x') { closeManager(); return; }
    if (act === 'zoom') { const src = b.getAttribute('src'); if (src) A.lightbox?.(src, ''); return; }
    if (act === 'fold') { S.fold = S.fold === b.dataset.v ? '' : b.dataset.v; paint(); return; }
    if (act === 'set') { const c = cfg(); if (b.dataset.v === 'fb.auto') c.fb.auto = !c.fb.auto; else c[b.dataset.v] = !c[b.dataset.v]; A.saveSettings(); try { A.updatePrompt?.(); } catch { /* */ } A.paintSoon?.(); paint(); return; }
    if (act === 'dpset') { const c = dpCfg(); c[b.dataset.v] = !c[b.dataset.v]; A.saveSettings(); try { A.updatePrompt?.(); } catch { /* */ } paint(); return; }
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
    if (act === 'fbafter') { cfg().fb.after = Number(b.dataset.v) || 2; A.saveSettings(); paint(); return; }
    if (act === 'undo') { if (S.prev) { S.prompt = S.prev.prompt; S.aspect = S.prev.aspect; S.pmStyle = S.prev.pmStyle ?? S.pmStyle; S.prev = null; S.note = ''; paint(); } return; }
    if (act === 'style') { if (b.dataset.v) restyleNow(b.dataset.v); else plainNow(); return; }
    if (act === 'chip') { fixNow(b.dataset.v); return; }
    if (act === 'dp') { dpNow({ request: S.fix }); return; }
    if (act === 'dp-ask') { dpNow({ request: b.dataset.v }); return; }
    if (act === 'dp-takes') { dpNow({ request: S.fix, takes: true }); return; }
    if (act === 'take') { takeUse(Number(b.dataset.k)); return; }
    if (act === 'look') { S.look = S.look && lookOfText(S.look) === b.dataset.v ? S.baseLook : lookText(b.dataset.v); paint(); return; }
    if (act === 'slay-style-off') { slayStyleOff(); return; }
    if (act === 'fix') { fixNow(S.fix); return; }
    if (act === 'soften') { fixNow('', { soften: true }); return; }
    if (act === 'model') { fixNow('', { convert: true }); return; }
    if (act === 'draw') { drawNow(); return; }
    if (act === 'save') { saveNow(); return; }
    if (act === 'hist-load') { const v = histOf()[Number(b.dataset.k)]; if (v) { S.prev = { prompt: S.prompt, aspect: S.aspect, pmStyle: S.pmStyle }; S.prompt = v.p; if (v.ar && !S.ad.fixedAspect) S.aspect = v.ar; if (S.ad.styled) S.pmStyle = v.sn || ''; S.note = 'промт из версии — можно править и рисовать'; paint(); } return; }
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
        const out = await translate({ prompt: my.prompt, aspect: my.aspect, request, error: my.err?.msg || '', soften, styled: !!my.pmStyle });
        if (S !== my) return;
        my.prev = { prompt: my.prompt, aspect: my.aspect, pmStyle: my.pmStyle };
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

/** Оператор: переснять кадр по посту (или снять три дубля на выбор). request — что она попросила словами. */
async function dpNow({ request = '', takes = false } = {}) {
    const my = S;
    if (!my || my.busy) return;
    if (!my.prompt.trim()) { A.toast('info', 'Промт пустой — впиши хоть пару слов о кадре.', '✎ Промт'); return; }
    my.busy = 'tr';
    my.step = takes ? 'оператор снимает три дубля…' : 'оператор ставит кадр…';
    paint();
    let ok = false;
    try {
        const list = await reshoot({
            i: Number.isInteger(my.ad.mes) ? my.ad.mes : -1, t: my.ad.tag?.() || null, prompt: my.prompt, aspect: my.aspect,
            request: String(request || '').trim(), takes, error: my.err?.kind === 'filter' ? my.err.msg : '',
        });
        if (S !== my) return;
        if (takes) { my.takes = list; my.fix = ''; return; }
        const t = list[0];
        my.prev = { prompt: my.prompt, aspect: my.aspect, pmStyle: my.pmStyle };
        my.prompt = t.prompt;
        if (t.aspect && !my.ad.fixedAspect) my.aspect = t.aspect;
        my.note = `оператор: ${t.note || t.shot || 'кадр переснят'}`;
        my.fix = '';
        my.takes = [];
        ok = true;
    } catch (e) {
        console.warn('[Life] оператор', e);
        A.toast('warning', esc(String(e?.message || e)), '✎ Оператор', { timeOut: 6000 });
    } finally {
        my.busy = '';
        if (S === my) { paint(); if (takes && my.takes.length) box?.querySelector('.lf-pm-takes')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    if (ok && S === my && cfg().auto) await drawNow();
}

/** Взять дубль: его промт — в окно (прежний можно вернуть), дальше как после любой правки. */
async function takeUse(k) {
    const my = S;
    const t = my?.takes?.[k];
    if (!t || my.busy) return;
    my.prev = { prompt: my.prompt, aspect: my.aspect, pmStyle: my.pmStyle };
    my.prompt = t.prompt;
    if (t.aspect && !my.ad.fixedAspect) my.aspect = t.aspect;
    my.note = `дубль: ${t.note || t.shot || k + 1}`;
    paint();
    if (cfg().auto) await drawNow();
}

/** Снять общий стиль SLAY (он сильнее плёнки): его же кнопкой «Сбросить», чтобы он сам всё пересохранил. */
function slayStyleOff() {
    const st = slay();
    if (!st) return;
    const btn = document.getElementById('slay_style_reset_btn');
    if (btn) btn.click();
    if (String(st.slayStyle || '').trim()) { st.slayStyle = ''; st.slayStyleName = ''; st.slayStyleCustomId = ''; saveAll(); }
    A.toast('success', 'Общий стиль SLAY снят — картинки рисуются в плёнке. Вернуть: SLAY → Стиль → «Выбрать».', '✎ Плёнка', { timeOut: 5000 });
    paint();
}

// ───────────── оператор сам: новый кадр — до отрисовки ─────────────
// SLAY (порт 5.1.1) перед каждым запросом зовёт window.slayHooks.beforeGenerate. Если это кадр, который ещё ни разу не
// рисовался, оператор переснимает его промт по посту и отдаёт SLAY новый. В пост новый промт вписывается, когда SLAY
// дорисует: раньше нельзя — он ищет в посте свой тег по старому тексту, чтобы вписать путь картинки.
// ↻, «попробовать снова» и всё, что рисуется из окна, идёт как есть: там промт уже чей-то выбор.

const adopting = new Map();   // пост → сколько его кадров ждут, пока SLAY дорисует
let dpHinted = false;
// Life сама жмёт кнопку SLAY (окно промта, запасной стиль): какой промт должен уйти рисовалке. ↻ SLAY читает промт
// с того элемента, к которому когда-то привязалась, — а карточки и перерисовка поста этот элемент подменяют.
let drawAs = null;

function hookSlayDraw() {
    const g = globalThis;
    if (!g.slayHooks || typeof g.slayHooks !== 'object') g.slayHooks = {};
    if (!Array.isArray(g.slayHooks.beforeGenerate)) g.slayHooks.beforeGenerate = [];
    if (!g.slayHooks.beforeGenerate.includes(onSlayDraw)) g.slayHooks.beforeGenerate.push(onSlayDraw);
}

const promptSig = (p) => sigOf({ prompt: p });

async function onSlayDraw(req) {
    try {
        if (!A?.hasChat?.() || A.settings().enabled === false) return null;
        { const bi = Number(req?.messageId); if (req?.messageId != null && Number.isInteger(bi) && bi >= 0) slayBusy.set(bi, Date.now()); }
        const mine = drawAs;
        // номер поста SLAY берёт с того же элемента; если тот уже не на экране, номера нет — тогда узнаём свой тап по времени
        if (mine && Date.now() - mine.at < 10000 && (req?.messageId == null || Number.isNaN(Number(req.messageId)) || Number(req.messageId) === mine.i)) {
            drawAs = null;
            const fix = {};
            if (mine.prompt && mine.prompt.replace(/\s+/g, ' ').trim() !== String(req.prompt || '').replace(/\s+/g, ' ').trim()) fix.prompt = mine.prompt;
            if (mine.aspect && mine.aspect !== req.aspectRatio) fix.aspectRatio = mine.aspect;
            if (mine.style != null && mine.style !== req.style) fix.style = mine.style;
            return Object.keys(fix).length ? fix : null;
        }
        if (!dpCfg().auto || imageModel().kind === 'nai') return null;
        const i = Number(req?.messageId);
        const m = Number.isInteger(i) ? A.chatArr()[i] : null;
        if (!m || m.is_user || typeof m.mes !== 'string' || !String(req?.prompt || '').trim()) return null;
        const want = promptSig(req.prompt);
        const tags = scanTags(m.mes);
        const t = tags.find(x => !x.video && x.data?.prompt && tagState(x) === 'wait' && promptSig(x.data.prompt) === want);
        if (!t) return null;   // кадр уже рисовался (↻, повтор после ошибки) — рисуем как написано
        // своя метка Life на теге — промт уже правили в окне; метка, списанная моделью из поста выше, не в счёт
        if (t.data.pm && !A.chatArr().some((x, j) => j < i && typeof x?.mes === 'string' && x.mes.includes(t.data.pm))) return null;
        req.status?.('Оператор ставит кадр…');
        adopting.set(i, (adopting.get(i) || 0) + 1);
        let take = null;
        try {
            [take] = await reshoot({ i, t, prompt: t.data.prompt, aspect: String(t.data.aspect_ratio || t.data.aspectRatio || req.aspectRatio || '') });
        } catch (e) {
            adoptDone(i);
            console.warn('[Life] оператор: кадр остаётся как написала модель —', e?.message || e);
            if (!dpHinted && /профиль Летописца/i.test(String(e?.message || ''))) { dpHinted = true; A.toast('info', 'Оператору нужен профиль Летописца: Мир → ⚙. Пока кадры идут как их написала модель.', '✎ Оператор', { timeOut: 7000 }); }
            return null;
        }
        if (A.chatArr()[i] !== m) { adoptDone(i); return null; }
        // кто-то в кадре раздет, а в теге фото-плёнка (модель не взяла её из заметки или списала со старого тега):
        // фото раздетых рисовалка режет фильтром — тот же кадр кистью. Только когда плёнка «Авто»: свою выбранную не трогаем.
        let look = '';
        try {
            const lk = lookOfText(t.data.style);
            if (dpCfg().look === 'auto' && lk && lk !== LOOK_OWN && !PAINTED.has(lk) && sceneOf(i).skin) look = lookById(LOOK_SAFE)[3];
        } catch { /* сцена не прочиталась — как в теге */ }
        req.status?.('Генерация…');
        adoptLater(i, m, t.data.prompt, take, look).catch(e => console.warn('[Life] оператор: вписать промт в пост', e)).finally(() => adoptDone(i));
        return { prompt: take.prompt, aspectRatio: take.aspect || undefined, ...(look ? { style: look } : {}) };
    } catch (e) {
        console.warn('[Life] оператор', e);
        return null;
    }
}

function adoptDone(i) {
    const n = (adopting.get(i) || 1) - 1;
    if (n > 0) adopting.set(i, n); else adopting.delete(i);
}

/** SLAY дорисовал кадр по промту оператора — вписать этот промт в пост: ↻, окно и версии дальше работают с ним. */
async function adoptLater(i, m, old, take, look = '') {
    const want = promptSig(old);
    const find = () => { const ts = tagsOf(i); const k = ts.findIndex(x => !x.video && x.data?.prompt && promptSig(x.data.prompt) === want); return k >= 0 ? { k, t: ts[k] } : null; };
    const hit = await until(() => {
        if (A.chatArr()[i] !== m) return 'gone';
        const f = find();
        if (!f) return 'gone';
        return tagState(f.t) !== 'wait' && !mesEl(i)?.querySelector('.iig-loading-placeholder') ? f : null;
    }, DRAW_MS + 90000, 700);
    if (!hit || hit === 'gone') return;
    await sleep(600);   // SLAY дописывает путь и сохраняет чат
    if (A.chatArr()[i] !== m) return;
    const f = find();
    if (!f) return;
    const ad = tagAdapter(i, f.k);
    const cur = ad.read();
    if (!cur) return;
    // Кадр не нарисовался: отказ фильтра считаем сейчас — после сохранения пост пересоберётся, и причина с плашки пропадёт.
    const oldId = fbId(i, f.t);
    keepLog(`оператор: пост ${i} — ${cur.state === 'ok' ? 'нарисовано' : `не нарисовано: ${A.cut(errOf(nodeFor(i, f.k)) || (lastSlayErr && Date.now() - lastSlayErr.at < 120000 ? lastSlayErr.msg : '') || 'причина неизвестна', 300)}`} · кадр: ${take.note || take.shot || ''} · плёнка: ${look ? LOOK_SAFE : lookOfText(f.t.data?.style) || 'нет'}`);
    if (cur.state === 'error') { try { noteRefusals(i, true); } catch (e) { console.warn('[Life] оператор: счёт отказов', e); } }
    const first = { p: old, ar: cur.aspect, src: '', note: '', at: Date.now(), by: 'как написала модель', sn: '' };
    await ad.save({ prompt: take.prompt, aspect: take.aspect || cur.aspect, look });
    // у картинки теперь своя метка — запись об отказах и место в очереди запасного стиля переезжают на новое имя
    const now = ad.tag();
    const newId = now ? fbId(i, now) : oldId;
    if (newId !== oldId && fbRec.has(oldId)) {
        fbRec.set(newId, fbRec.get(oldId));
        fbRec.delete(oldId);
        if (fbBusy.has(oldId)) { fbBusy.add(newId); fbAlias.set(oldId, newId); }
        setTimeout(() => { try { scanFiltered(); } catch (e) { console.warn('[Life] промты: запасной стиль', e); } }, 50);
    }
    histPush({ ad, first }, { p: take.prompt, ar: take.aspect || cur.aspect, src: cur.src, note: `оператор: ${take.note || take.shot || 'кадр переснят'}`, at: Date.now(), by: imageModel().name, sn: cur.pmStyle || '' });
    // окно этой же картинки открыто и в нём ничего не трогали — показать то, что теперь в посте
    if (S && S.ad.mes === i && S.ad.kind === 'post' && promptSig(S.base) === want && !dirty()) {
        S.prompt = S.base = take.prompt;
        if (take.aspect) S.aspect = S.baseAspect = take.aspect;
        S.src = cur.src || S.src;
        if (cur.src) S.state = 'ok';
        paint();
    }
    A.paintSoon?.();
}

/** Эту картинку — в своём стиле (запасном): слова о прежнем стиле из промта убрать, стиль уйдёт рисовалке отдельно. */
async function restyleNow(name) {
    const my = S;
    if (!my || my.busy || my.pmStyle === name) return;
    if (!styleText(name)) { A.toast('warning', `Не нашла текст стиля «${esc(name)}» — выбери запасной стиль в настройках окна.`, '✎ Промт', { timeOut: 6000 }); return; }
    const prev = { prompt: my.prompt, aspect: my.aspect, pmStyle: my.pmStyle };
    let lost = false;
    if (!my.pmStyle && my.prompt.trim()) {
        my.busy = 'tr';
        my.step = 'снимаю с промта прежний стиль…';
        paint();
        try {
            const out = await translate({ prompt: my.prompt, aspect: my.aspect, restyle: true });
            if (S !== my) return;
            my.prompt = out.prompt;
        } catch (e) {
            console.warn('[Life] промты: снять стиль', e);
            lost = true;
        } finally {
            my.busy = '';
        }
    }
    my.prev = prev;
    my.pmStyle = name;
    my.note = lost ? `стиль «${name}»; слова о прежнем стиле из промта убери руками — Летописец не ответил` : `стиль «${name}»`;
    if (S !== my) return;
    paint();
    if (cfg().auto) await drawNow();
}

/** Обратно в общий стиль: промт — из последней версии, где слова о стиле ещё были на месте. */
function plainNow() {
    const my = S;
    if (!my || my.busy || !my.pmStyle) return;
    const v = [...histOf(my)].reverse().find(x => !x.sn && x.p);
    my.prev = { prompt: my.prompt, aspect: my.aspect, pmStyle: my.pmStyle };
    if (v) my.prompt = v.p;
    my.pmStyle = '';
    my.note = v ? 'общий стиль — промт вернула из версии до смены стиля' : 'общий стиль';
    paint();
}

async function saveNow() {
    const my = S;
    if (!my || my.busy) return;
    my.busy = 'save';
    my.step = 'сохраняю…';
    paint();
    try {
        await my.ad.save(saveArgs(my));
        my.base = my.prompt;
        my.baseAspect = my.aspect;
        my.basePm = my.pmStyle;
        my.baseLook = my.look;
        histPush(my, { p: my.prompt, ar: my.aspect, src: my.src, note: my.note || 'правка руками', at: Date.now(), by: '', sn: my.pmStyle });
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
        await my.ad.save(saveArgs(my));
        my.base = my.prompt;
        my.baseAspect = my.aspect;
        my.basePm = my.pmStyle;
        my.baseLook = my.look;
        const r = await my.ad.draw((step) => { my.step = step; if (S === my) { const el = box?.querySelector('.lf-pm-wait span'); if (el) el.textContent = step; } });
        my.src = r.src;
        my.state = 'ok';
        my.err = null;
        histPush(my, { p: my.prompt, ar: my.aspect, src: r.src, note: my.note || 'перерисовка', at: Date.now(), by, sn: my.pmStyle });
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
        await my.ad.save({ prompt: v.p, aspect: v.ar || my.aspect, style: my.ad.styled ? v.sn || '' : undefined });
        const put = await my.ad.setSrc(v.src);
        my.prompt = my.base = v.p;
        my.pmStyle = my.basePm = my.ad.styled ? v.sn || '' : '';
        if (v.ar) my.aspect = my.baseAspect = v.ar;
        my.src = put || v.src;
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
