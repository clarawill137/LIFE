// Персоны. Своё окно вместо стокового «Persona Management»: галерея и карточка персоны.
//
// Карточка — из четырёх разделов с выключателями: внешность, голос, что о ней известно — и скрытый характер.
// Первые три складываются в описание персоны, которое видит модель. Скрытый характер модели истории НЕ уходит:
// его читают только помощники (подбор факторов шкал пары), чтобы понять, какие её поступки на что влияют.
// При первом открытии всё нынешнее описание целиком ложится в «Что о ней известно» — текст не меняется ни на букву,
// пока не начнёшь править; «Разложить по разделам» переносит фразы как есть, не переписывая.
//
// Обличья эпох («Священный таймлайн»). Ядро держит под каждую эпоху двойника базовой персоны и при входе в чат
// пересобирает его из базовой с заменами эпохи. Но в разные эпохи она — разный человек: другой характер, другие
// отношения, другое знание. Поэтому у двойника может быть СВОЯ карточка: пока её нет — он повторяет базовую,
// завела — живёт отдельно, и после каждой пересборки ядром Life возвращает его текст на место (personaGuard).
//
// Ещё: анкета (имя, фамилия, клички, пол, день рождения), склонения имён (правилом, руками или моделью), описание
// внешности по картинке, карточка по пожеланиям, перевод разделов на английский, лорбук персоны.

import { icon } from './icons.js';
import { openWin, winRender, openSide, closeSide, sideRender, sideBox, winBox, winMod, sure, winOpen } from './win.js';
import { decline, declLine, CASES } from './decl.js';

let A = null;
const esc = (v) => A.esc(v);
const str = (v, n = 4000) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const arr = (v) => (Array.isArray(v) ? v : []);

export const SECTIONS = [
    ['look', 'Внешность', 'как выглядит: лицо, тело, приметы, как держится'],
    ['voice', 'Голос и речь', 'как звучит и говорит: тембр, темп, словечки, акцент'],
    ['pub', 'Что о ней известно', 'то, что знают другие: кто она, чем занята, прошлое, которое на виду'],
    ['hid', 'Скрытый характер', 'что внутри: мотивы, страхи, привычки реакций — модели истории не уходит'],
];
const TO_MODEL = ['look', 'voice', 'pub'];

function cfg() {
    const s = A.settings();
    if (!s.personas || typeof s.personas !== 'object') s.personas = {};
    const c = s.personas;
    if (!c.cards || typeof c.cards !== 'object') c.cards = {};
    if (!Array.isArray(c.dict)) c.dict = [];                 // словарь имён остальных героев: { w, g, kind, ok, forms, hand }
    if (c.names === undefined) c.names = true;               // строка «как склонять имена» — модели
    return c;
}
const pu = () => A.ctx().powerUserSettings || {};
const save = () => { try { A.saveSettings(); } catch { /* */ } };
const desc = (av) => String(pu().persona_descriptions?.[av]?.description ?? '');
const nameOf = (av) => String(pu().personas?.[av] ?? '');
const isPlaceholder = (av) => !desc(av).trim() && (!nameOf(av).trim() || /^\[.*\]$/.test(nameOf(av).trim()));

// ───────────── текущая персона ─────────────

let PM = null;
let curAv = '';
async function personasMod() {
    if (PM) return PM;
    for (const p of ['/scripts/personas.js', '../../../personas.js']) { try { const m = await import(p); if (typeof m?.setUserAvatar === 'function') { PM = m; return m; } } catch { /* следующий путь */ } }
    return null;
}
/** Аватар текущей персоны. Таверна знает точно; без неё — по имени и тексту. */
function currentAv() {
    try { if (PM?.user_avatar) return (curAv = PM.user_avatar); } catch { /* */ }
    // модуль персон таверны не подгрузился — узнаём по имени и «живому» описанию; запомненное — только когда они молчат
    const c = A.ctx();
    const hit = Object.keys(pu().personas || {}).filter(av => nameOf(av) === c.name1);
    const live = String(pu().persona_description ?? '');
    const exact = hit.filter(av => desc(av) === live);
    if (exact.length === 1) return (curAv = exact[0]);
    if (curAv && pu().personas?.[curAv] && (!hit.length || hit.includes(curAv))) return curAv;
    return (curAv = exact[0] || hit[0] || '');
}

// ───────────── обличья эпох (ядро «Священный таймлайн») ─────────────

let reg = { at: 0, twins: {}, bases: {} };   // twins: аватар двойника → { base, label, patches }; bases: базовый → [двойники]

/** Разобрать Реестр ядра: кто чей двойник. data — книга Реестра ({ entries }). Чистая логика. */
export function readRegistry(data) {
    const recs = (type) => Object.values(data?.entries || {}).map(e => e?.gc).filter(g => g && g.type === type);
    const eras = recs('era');
    const twins = {}, bases = {};
    for (const id of recs('identity')) {
        if (!id.persona) continue;
        bases[id.persona] = bases[id.persona] || [];
        for (const sl of arr(id.slices)) {
            if (!sl?.persona || sl.persona === id.persona) continue;
            const mine = eras.filter(e => e.persona === sl.id);
            twins[sl.persona] = { base: id.persona, slice: sl.id, label: str(sl.label, 60) || mine.map(e => str(e.label, 40) || String(e.id)).join(', ') || String(sl.id), eras: mine.map(e => String(e.id)), patches: arr(mine[0]?.personaPatches) };
            if (!bases[id.persona].includes(sl.persona)) bases[id.persona].push(sl.persona);
        }
    }
    return { twins, bases };
}

async function loadReg(force = false) {
    if (!force && Date.now() - reg.at < 60000) return reg;
    let data = null;
    try { data = await globalThis.SacredTimeline?.registry?.(); } catch (e) { console.warn('[Life] персоны: Реестр', e); }
    reg = { at: Date.now(), ...(data ? readRegistry(data) : { twins: {}, bases: {} }) };
    return reg;
}
const twinOf = (av) => reg.twins[av] || null;

/** Замены эпохи (find → replace) к тексту — как у ядра. */
export function patchText(text, patches) {
    let t = String(text ?? '');
    for (const p of arr(patches)) if (p?.find && t.includes(p.find)) t = t.split(p.find).join(p.replace ?? '');
    return t;
}

// ───────────── карточка ─────────────

const blank = () => ({ sec: Object.fromEntries(SECTIONS.map(([k]) => [k, { t: '', on: true }])), form: { first: '', last: '', nicks: '', gender: '', bday: '' }, decl: {}, en: {}, lang: 'ru' });

function norm(card) {
    const c = card && typeof card === 'object' ? card : {};
    const b = blank();
    c.sec = c.sec && typeof c.sec === 'object' ? c.sec : {};
    for (const [k] of SECTIONS) { const x = c.sec[k]; c.sec[k] = { t: typeof x?.t === 'string' ? x.t : '', on: x?.on !== false }; }
    c.form = { ...b.form, ...(c.form && typeof c.form === 'object' ? c.form : {}) };
    c.decl = c.decl && typeof c.decl === 'object' ? c.decl : {};
    c.en = c.en && typeof c.en === 'object' ? c.en : {};
    if (c.lang !== 'en') c.lang = 'ru';
    return c;
}

/** Описание для модели из карточки: включённые разделы (кроме скрытого) через пустую строку. */
export function buildDesc(card) {
    const c = norm(card);
    return TO_MODEL.filter(k => c.sec[k].on).map(k => (c.lang === 'en' && str(c.en[k]) ? c.en[k] : c.sec[k].t).trim()).filter(Boolean).join('\n\n');
}

/** Карточка из нынешнего описания: всё целиком — в «Что о ней известно», текст не меняется. */
export function cardFromDesc(text, name = '') {
    const c = blank();
    c.sec.pub.t = String(text ?? '');
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length && !/^\[/.test(parts[0])) { c.form.first = parts[0]; c.form.last = parts.slice(1).join(' '); }
    return c;
}

/** Своя ли карточка у аватара: у базовой — если заведена; у двойника — только когда отмечена «своей». */
const hasOwn = (av) => { const c = cfg().cards[av]; return !!c && (!twinOf(av) || c.own === true); };

/**
 * Что показывать и чем пользоваться: { card, own, twin, base }. У двойника без своей карточки — базовая с заменами
 * эпохи (только для чтения); у базовой без карточки — собранная из описания (ещё не сохранена).
 */
export function viewOf(av) {
    const twin = twinOf(av);
    const cards = cfg().cards;
    if (twin && !hasOwn(av)) {
        const base = norm(JSON.parse(JSON.stringify(cards[twin.base] || cardFromDesc(desc(twin.base), nameOf(twin.base)))));
        for (const [k] of SECTIONS) base.sec[k].t = patchText(base.sec[k].t, twin.patches);
        return { card: base, own: false, twin, inherited: true };
    }
    if (cards[av]) return { card: norm(cards[av]), own: true, twin };
    return { card: cardFromDesc(desc(av), nameOf(av)), own: false, twin, fresh: true };
}

/** Записать описание персоны в таверну (и «живой» текст, если она сейчас выбрана). true — что-то поменялось. */
function writeDesc(av, text) {
    const p = pu();
    if (!p.persona_descriptions) p.persona_descriptions = {};
    const d = p.persona_descriptions[av] || (p.persona_descriptions[av] = { description: '', position: 0, depth: 2, role: 0, lorebook: '', connections: [], title: '' });
    let changed = false;
    if (d.description !== text) { d.description = text; changed = true; }
    if (av === currentAv() && p.persona_description !== text) {
        p.persona_description = text;
        try { const ta = document.getElementById('persona_description'); if (ta) ta.value = text; } catch { /* */ }
        changed = true;
    }
    if (changed) { try { A.ctx().saveSettingsDebounced(); } catch { /* */ } }
    return changed;
}

/**
 * Страж двойников. Ядро эпох при входе в чат пересобирает двойника из базовой персоны; если у двойника своя
 * карточка — возвращаем её текст. Зовётся после смены чата, эпохи и персоны. true — пришлось вернуть.
 */
export function personaGuard() {
    try {
        const av = currentAv();
        const c = cfg().cards[av];
        if (!av || !c || c.own !== true || !twinOf(av)) return false;
        const want = buildDesc(c);
        if (!want.trim()) return false;   // пустую карточку поверх текста ядра не кладём
        let changed = writeDesc(av, want);
        // ядро при пересборке отдаёт двойнику и лорбук базовой персоны — свой, если выбран, возвращаем тоже
        if (typeof c.lore === 'string' && String(pu().persona_descriptions?.[av]?.lorebook || '') !== c.lore) { setLore(av, c.lore, false); changed = true; }
        return changed;
    } catch (e) { console.warn('[Life] персоны: страж', e); return false; }
}

/** Скрытый характер персоны (текущей или по имени) — для помощников. Модели истории не уходит. */
export function personaHidden(name = '') {
    try {
        let av = currentAv();
        if (name && nameOf(av) && !A.sameName(nameOf(av), name)) av = Object.keys(pu().personas || {}).find(x => A.sameName(nameOf(x), name) && hasOwn(x)) || av;
        if (!av) return '';
        const { card } = viewOf(av);
        return card.sec.hid.on ? card.sec.hid.t.trim() : '';
    } catch { return ''; }
}

// ───────────── имена и склонения ─────────────

/** Слова анкеты: [{ w, kind }] — имя, фамилия, клички. */
export function formWords(form) {
    const out = [];
    const add = (w, kind) => { w = String(w || '').trim(); if (w && !out.some(x => x.w.toLowerCase() === w.toLowerCase())) out.push({ w, kind }); };
    for (const w of String(form?.first || '').split(/\s+/)) add(w, 'first');
    for (const w of String(form?.last || '').split(/\s+/)) add(w, 'last');
    for (const w of String(form?.nicks || '').split(/[,;]/)) add(w, 'nick');
    return out;
}
/** Формы слова: вписанные руками (или моделью) важнее правила. */
export function wordForms(card, w, kind) {
    const hand = card.decl?.[w.toLowerCase()];
    if (hand && Array.isArray(hand.forms) && hand.forms.length === 6) return { w, ok: hand.ok !== false, forms: hand.ok === false ? Array(6).fill(w) : hand.forms, hand: true };
    return { w, ...decline(w, card.form?.gender || '', kind) };
}

export function personasPrompt(type) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate') return '';
    const c = cfg();
    if (c.names === false) return '';
    const words = [];
    try { const av = currentAv(); if (av) { const { card } = viewOf(av); for (const x of formWords(card.form)) words.push(wordForms(card, x.w, x.kind)); } } catch { /* */ }
    for (const x of c.dict) if (x?.w) words.push({ w: x.w, ok: x.ok !== false, forms: x.ok === false ? Array(6).fill(x.w) : (arr(x.forms).length === 6 ? x.forms : decline(x.w, x.g || '', x.kind || 'first').forms) });
    const line = declLine(words.filter(x => /[а-яё]/i.test(x.w)).slice(0, 16));
    return line ? `[Имена по-русски: ${line}.]` : '';
}

/** День рождения персоны — в календарь Life (мост calEvents). */
export function personasCalEvents(from, to) {
    try {
        const av = currentAv();
        if (!av) return [];
        const { card } = viewOf(av);
        const m = /^(\d{1,2})[.\/-](\d{1,2})$/.exec(String(card.form.bday || '').trim());
        if (!m) return [];
        const out = [];
        const y0 = Number(String(from).slice(0, 4)), y1 = Number(String(to).slice(0, 4));
        for (let y = y0; y <= y1 && y - y0 < 3; y++) {
            const d = `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
            if (d >= from && d <= to) out.push({ key: `persona-bday:${av}:${y}`, d, title: `День рождения: ${card.form.first || nameOf(av)}`, kind: 'birthday', who: [nameOf(av)] });
        }
        return out;
    } catch { return []; }
}

// ───────────── окно: галерея ─────────────

const ui = { q: '', av: '', files: null, err: '', hidden: false, tab: 'cards', draft: null, busy: '' };
const headers = () => { try { return A.ctx().getRequestHeaders(); } catch { return {}; } };
const thumb = (av) => { try { return A.ctx().getThumbnailUrl ? A.ctx().getThumbnailUrl('persona', av) : `/thumbnail?type=persona&file=${encodeURIComponent(av)}`; } catch { return `/thumbnail?type=persona&file=${encodeURIComponent(av)}`; } };
const full = (av) => `/User Avatars/${encodeURIComponent(av)}`;

async function loadFiles() {
    try {
        const r = await fetch('/api/avatars/get', { method: 'POST', headers: headers() });
        ui.files = r.ok ? await r.json() : null;
    } catch { ui.files = null; }
    if (!Array.isArray(ui.files)) ui.files = Object.keys(pu().personas || {});
}

function tile(av, sub = false) {
    const cur = av === currentAv();
    const t = twinOf(av);
    const own = hasOwn(av);
    return `<button class="lw-pers${cur ? ' cur' : ''}${sub ? ' sub' : ''}${ui.av === av ? ' sel' : ''}" data-act="ps-open" data-av="${esc(av)}">
        <span class="lw-pers-img"><img src="${esc(thumb(av))}" alt="" loading="lazy" onerror="this.remove()"></span>
        <span class="lw-pers-t"><b>${esc(nameOf(av) || av)}</b><small>${t ? `эпоха: ${esc(t.label)}` : esc(A.cut(pu().persona_descriptions?.[av]?.title || '', 40))}</small>
        <span>${cur ? '<i class="lw-b on">сейчас</i>' : ''}${av === pu().default_persona ? '<i class="lw-b">по умолчанию</i>' : ''}${t ? (own ? '<i class="lw-b ok">своя карточка</i>' : '<i class="lw-b">как базовая</i>') : (cfg().cards[av] ? '' : '<i class="lw-b">без разделов</i>')}</span></span></button>`;
}

function galleryHtml() {
    if (ui.tab === 'names') return namesHtml();
    const tabs = `<div class="lf-seg lw-seg"><button class="on" data-act="ps-tab" data-v="cards">Персоны</button><button data-act="ps-tab" data-v="names">Имена и склонения</button></div>`;
    if (!ui.files) return `${tabs}<div class="lf-empty small">Загружаю…</div>`;
    const q = A.norm(ui.q);
    const all = ui.files.filter(av => pu().personas?.[av] !== undefined || desc(av));
    const real = all.filter(av => !isPlaceholder(av));
    const ghosts = ui.files.filter(av => !real.includes(av));
    const match = (av) => !q || A.norm(`${nameOf(av)} ${av} ${twinOf(av)?.label || ''}`).includes(q);
    const bases = real.filter(av => !twinOf(av) || !real.includes(twinOf(av).base)).filter(av => match(av) || arr(reg.bases[av]).some(match))
        .sort((a, b) => (b === currentAv() ? 1 : 0) - (a === currentAv() ? 1 : 0) || nameOf(a).localeCompare(nameOf(b), 'ru'));
    return `${tabs}<div class="lw-tools"><input type="search" data-in="ps-q" placeholder="Найти персону" value="${esc(ui.q)}"></div>
    <div class="lw-perss">${bases.map(av => `${tile(av)}${arr(reg.bases[av]).filter(t => real.includes(t) || ui.files.includes(t)).map(t => tile(t, true)).join('')}`).join('') || '<div class="lf-empty small">Никого не нашлось.</div>'}</div>
    ${ghosts.length ? `<div class="lf-chips wrap"><button class="lf-chip${ui.hidden ? ' on' : ''}" data-act="ps-ghosts">картинки без персоны · ${ghosts.length}</button></div>${ui.hidden ? `<div class="lw-perss">${ghosts.map(av => tile(av)).join('')}</div>` : ''}` : ''}
    <div class="lf-hint">Обличья эпох (их заводит «Священный таймлайн») стоят под своей базовой персоной. Пока у обличья нет своей карточки, оно повторяет базовую с заменами эпохи; заведёшь свою — живёт отдельно. Новую персону и картинку пока заводи в стоковом окне таверны или загрузкой в User Avatars.</div>`;
}

// ───────────── окно: карточка ─────────────

function cardHtml() {
    const av = ui.av;
    if (!av) return '';
    const d = ui.draft;
    const v = d ? { card: d, own: true, twin: twinOf(av) } : viewOf(av);
    const c = v.card;
    const ro = !!v.inherited && !d;
    const t = v.twin;
    const cur = av === currentAv();
    const built = buildDesc(c);
    const live = desc(av);
    const drift = !ro && !v.fresh && !d && cfg().cards[av] && built.trim() !== live.trim();
    const lore = String(pu().persona_descriptions?.[av]?.lorebook || '');
    const sec = ([k, title, hint]) => `<div class="lw-sec${c.sec[k].on ? '' : ' off'}${k === 'hid' ? ' hid' : ''}">
        <div class="lw-sec-h"><b>${title}</b><small>${hint}</small><label class="lw-sw" title="${k === 'hid' ? 'давать помощникам' : 'давать модели'}"><input type="checkbox" data-in="ps-on-${k}"${c.sec[k].on ? ' checked' : ''}${ro ? ' disabled' : ''}><i></i></label></div>
        <textarea rows="${k === 'pub' ? 7 : 4}" data-in="ps-t-${k}"${ro ? ' readonly' : ''} placeholder="${ro ? '' : 'пусто'}">${esc(c.sec[k].t)}</textarea>
        ${c.lang === 'en' && k !== 'hid' ? `<textarea rows="3" class="en" data-in="ps-en-${k}"${ro ? ' readonly' : ''} placeholder="English — пусто: модели уйдёт русский">${esc(c.en[k] || '')}</textarea>` : ''}
        ${ro ? '' : `<div class="lf-chips wrap">${k === 'look' ? `<button class="lf-chip" data-act="ps-look">${icon('camera')} описать по картинке</button><label class="lf-chip lw-file">${icon('upload')} другой реф<input type="file" accept="image/*" data-in="ps-ref" hidden></label>` : ''}${k === 'voice' ? `<button class="lf-chip" data-act="ps-voice">${icon('mic')} описать голос</button>` : ''}</div>`}
    </div>`;
    const words = formWords(c.form);
    return `<div class="lw-card-head"><span class="lw-card-img"><img src="${esc(full(av))}" alt="" onerror="this.src='${esc(thumb(av))}';this.onerror=null"></span>
            <div><h2>${esc(nameOf(av) || av)}</h2><small>${t ? `обличье эпохи «${esc(t.label)}» · база — ${esc(nameOf(t.base) || t.base)}` : esc(av)}</small>
            <div class="lf-chips wrap">${cur ? '<span class="lf-chip on">выбрана сейчас</span>' : `<button class="lf-chip" data-act="ps-use">${icon('check')} выбрать</button>`}</div></div></div>
        ${ro ? `<div class="lw-note">${icon('layers')} Это обличье повторяет базовую персону${t.patches.length ? ` с заменами эпохи (${t.patches.length})` : ''}. В другой эпохе она — другой человек: другой характер, другие отношения.
            <button class="lf-btn primary full" data-act="ps-own">${icon('pencil')} Своя карточка для этой эпохи</button></div>` : ''}
        ${!ro && t && hasOwn(av) ? `<div class="lw-note ok">${icon('check')} У этого обличья своя карточка: базовую оно больше не повторяет, и ядро эпох его текст не затрёт. <button class="lf-link" data-act="ps-unown">вернуть к базовой</button></div>` : ''}
        ${drift ? `<div class="lw-warn">${icon('flag')} Описание этой персоны в таверне отличается от карточки — его правили в другом месте.<div class="lf-actions"><button class="lf-btn" data-act="ps-pull">Забрать текст из таверны в «Что о ней известно»</button><button class="lf-btn primary" data-act="ps-push">Записать карточку в таверну</button></div></div>` : ''}
        ${ro ? '' : `<div class="lf-chips wrap"><button class="lf-chip" data-act="ps-split">${icon('scissors')} разложить описание по разделам</button><button class="lf-chip" data-act="ps-write">${icon('sparkles')} написать карточку — ИИ</button><button class="lf-chip${c.lang === 'en' ? ' on' : ''}" data-act="ps-lang">${icon('type')} модели — ${c.lang === 'en' ? 'английский' : 'русский'}</button>${c.lang === 'en' ? `<button class="lf-chip" data-act="ps-tr">${icon('refresh')} перевести разделы</button>` : ''}</div>
        <div class="lf-field"><label>Пожелания помощнику <small>для «описать», «написать», «перевести»</small></label><input type="text" data-in="ps-wish" placeholder="без поэзии; волосы короче, чем на картинке; оригинальный персонаж"></div>`}
        ${SECTIONS.map(sec).join('')}
        ${A.sec('Анкета')}
        <div class="lw-row"><div class="lf-field half"><label>Имя</label><input type="text" data-in="ps-first" value="${esc(c.form.first)}"${ro ? ' readonly' : ''}></div><div class="lf-field half"><label>Фамилия</label><input type="text" data-in="ps-last" value="${esc(c.form.last)}"${ro ? ' readonly' : ''}></div></div>
        <div class="lf-field"><label>Клички и прозвища <small>через запятую</small></label><input type="text" data-in="ps-nicks" value="${esc(c.form.nicks)}"${ro ? ' readonly' : ''}></div>
        <div class="lw-row"><div class="lf-field half"><label>Пол</label><select data-in="ps-gender"${ro ? ' disabled' : ''}><option value=""${c.form.gender ? '' : ' selected'}>—</option><option value="f"${c.form.gender === 'f' ? ' selected' : ''}>женский</option><option value="m"${c.form.gender === 'm' ? ' selected' : ''}>мужской</option></select></div>
            <div class="lf-field half"><label>День рождения <small>ДД.ММ</small></label><input type="text" data-in="ps-bday" value="${esc(c.form.bday)}" placeholder="14.03"${ro ? ' readonly' : ''}></div></div>
        ${words.length ? `${A.sec('Склонения', 'тап по слову — формы')}<div class="lw-decl">${words.map(x => { const f = wordForms(c, x.w, x.kind); return `<button class="lw-decl-w${f.ok ? '' : ' fix'}" data-act="ps-decl" data-w="${esc(x.w)}" data-kind="${x.kind}"${ro ? ' disabled' : ''}><b>${esc(x.w)}</b><small>${f.ok ? esc(f.forms.slice(1).join(', ')) : 'не склоняется'}${f.hand ? ' · вписано' : ''}</small></button>`; }).join('')}</div>
            ${ro ? '' : `<div class="lf-chips wrap"><button class="lf-chip" data-act="ps-declai">${icon('sparkles')} проверить склонения — ИИ</button></div>`}` : ''}
        ${A.sec('Лорбук персоны')}
        <div class="lf-field"><select data-in="ps-lore"><option value="">— нет —</option>${ui.books.map(n => `<option value="${esc(n)}"${n === lore ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="lf-chips wrap">${lore ? `<button class="lf-chip" data-act="ps-lore-open" data-name="${esc(lore)}">${icon('book')} открыть в «Лорбуках»</button>` : ''}<button class="lf-chip" data-act="ps-lore-new">${icon('plus')} завести лорбук персоны</button></div>
        <div class="lf-hint">Записи лорбука персоны идут модели, пока выбрана эта персона. Эпоху, даты и «только тем, кто знает» у записи ставишь в «Лорбуках» → запись → «Эпоха и тайна».</div>
        ${A.sec('Что уйдёт модели', `${built.length} зн.`)}
        <pre class="lw-pre">${esc(built) || '<i>пусто — включи хотя бы один раздел</i>'}</pre>
        ${ro ? '' : `<button class="lf-btn primary full" data-act="ps-save">${icon('check')} Сохранить карточку</button>`}`;
}

/** Прочитать форму карточки в черновик (то, что на экране, — чтобы кнопки помощников не теряли несохранённое). */
function readCard() {
    const box = sideBox();
    const av = ui.av;
    const c = norm(JSON.parse(JSON.stringify(ui.draft || viewOf(av).card)));
    if (!box) return c;
    const v = (k) => box.querySelector(`[data-in="${k}"]`);
    for (const [k] of SECTIONS) {
        if (v(`ps-t-${k}`)) c.sec[k].t = v(`ps-t-${k}`).value;
        if (v(`ps-on-${k}`)) c.sec[k].on = v(`ps-on-${k}`).checked;
        if (v(`ps-en-${k}`)) c.en[k] = v(`ps-en-${k}`).value;
    }
    for (const k of ['first', 'last', 'nicks', 'gender', 'bday']) if (v(`ps-${k}`)) c.form[k] = String(v(`ps-${k}`).value).trim();
    return c;
}
const wish = () => str(sideBox()?.querySelector('[data-in="ps-wish"]')?.value, 400);

function saveCard(av, card) {
    const c = norm(card);
    if (twinOf(av)) c.own = true;
    cfg().cards[av] = c;
    save();
    writeDesc(av, buildDesc(c));
    ui.draft = null;
}

function showCard(av) {
    ui.av = av; ui.draft = null;
    openSide({ title: `${icon('idcard')} ${esc(A.cut(nameOf(av) || av, 30))}`, html: cardHtml, onClose: () => { ui.av = ''; ui.draft = null; if (winOpen('personas')) winRender(); } });
    winRender();
}

// ───────────── помощники ─────────────

const LOOK = `Ты описываешь внешность персонажа ролевой истории по картинке — для карточки, по-русски. Только то, что видно: лицо, волосы, глаза, телосложение, рост на вид, кожа, приметы (шрамы, родинки, татуировки), как держится. Одежду — одной фразой и только если она явно «её». Без оценок и поэзии, без догадок о характере и биографии. 4–7 предложений. Пожелания автора важнее картинки. Ответь только JSON: {"look":"…"}`;
const VOICE = `Ты описываешь голос и манеру речи персонажа ролевой истории — для карточки, по-русски: тембр и высота, темп, громкость, акцент или говор, любимые словечки и обороты, как меняется речь, когда злится, нежна или врёт. По тому, что известно о персонаже, без выдумывания биографии. 3–6 предложений. Ответь только JSON: {"voice":"…"}`;
const SPLIT = `Ты раскладываешь готовое описание персонажа по разделам карточки. НЕ переписывай: переноси предложения и абзацы КАК ЕСТЬ, слово в слово, ничего не добавляя и не выбрасывая. look — всё про внешность; voice — про голос и манеру речи; pub — остальное, что о ней известно (кто она, прошлое, занятия, отношения, характер на виду). Каждое предложение — ровно в один раздел. Ответь только JSON: {"look":"…","voice":"…","pub":"…"}`;
const WRITE = `Ты пишешь карточку персоны игрока для литературной ролевой истории на русском — по пожеланиям автора и тому, что уже вписано (вписанное не выбрасывай: дополни и причеши). Четыре раздела:
look — внешность, 4–7 предложений, конкретно. voice — голос и речь, 3–5 предложений. pub — что о ней известно другим: кто она, чем занята, прошлое на виду, 5–9 предложений. hid — скрытый характер: чего хочет на самом деле, чего боится, как реагирует под давлением, что её задевает и что успокаивает, привычные защиты; 5–9 предложений — этот раздел модели истории не показывают, пиши прямо.
Без штампов и общих слов, не решай за автора сюжет. Если автор назвал канонического персонажа — держись канона; если персонаж свой — ничего не заимствуй у известных. Ответь только JSON: {"look":"…","voice":"…","pub":"…","hid":"…"}`;
const TRANSLATE = `Переведи разделы карточки персонажа с русского на английский — точно, тем же тоном, ничего не добавляя и не сокращая; имена собственные — в принятом написании. Ответь только JSON с теми же ключами, что во входе.`;
const DECL = `Просклоняй русские имена, фамилии и клички по падежам. Для каждого слова: ok — склоняется ли оно в литературной речи (иностранные на -и, -о, -у, -е и женские на согласную — нет); forms — шесть форм по порядку: именительный, родительный, дательный, винительный, творительный, предложный (без предлога). Не склоняется — все шесть одинаковые. Пол владельца имени дан. Ответь только JSON: {"words":[{"w":"слово","ok":true,"forms":["…","…","…","…","…","…"]}]}`;

const known = (c) => SECTIONS.map(([k, title]) => (c.sec[k].t.trim() ? `${title}:\n${c.sec[k].t.trim()}` : '')).filter(Boolean).join('\n\n');

async function helper(act, el) {
    const av = ui.av;
    const c = readCard();
    ui.draft = c;
    const name = nameOf(av) || c.form.first;
    const w = wish();
    const fail = (j, k) => { if (!str(j?.[k])) throw new Error('помощник ничего не прислал'); };
    await A.withBusy(el, async () => {
        if (act === 'ps-look') {
            const src = ui.ref || full(av);
            const img = await A.refData(src, 1024);
            if (!img) throw new Error('картинка не прочиталась');
            // с картинкой — без переспроса askJson: он дописывает текст к последнему сообщению, а тут оно из частей
            const out = await A.askModel([{ role: 'system', content: LOOK }, { role: 'user', content: [{ type: 'text', text: `Персонаж: ${name}.${w ? `\nПожелания автора: ${w}` : ''}${c.sec.look.t.trim() ? `\nУже вписано (учти, не противоречь): ${c.sec.look.t.trim()}` : ''}` }, { type: 'image_url', image_url: { url: img } }] }], 900, 'Персоны');
            const j = A.extractJson(out);
            if (!str(j?.look)) throw new Error('модель не описала картинку — похоже, профиль Летописца не видит картинок');
            c.sec.look.t = str(j.look);
        } else if (act === 'ps-voice') {
            const j = await A.askJson([{ role: 'system', content: VOICE }, { role: 'user', content: `Персонаж: ${name}.${w ? `\nПожелания автора: ${w}` : ''}\n\n${known(c) || 'Карточка пока пустая.'}` }], 700, { check: (x) => !!str(x?.voice), what: 'Голос' });
            fail(j, 'voice');
            c.sec.voice.t = str(j.voice);
        } else if (act === 'ps-split') {
            const text = TO_MODEL.map(k => c.sec[k].t.trim()).filter(Boolean).join('\n\n');
            if (!text) throw new Error('раскладывать нечего — описание пустое');
            const j = await A.askJson([{ role: 'system', content: SPLIT }, { role: 'user', content: text }], Math.min(12000, Math.round(text.length / 1.6) + 800), { check: (x) => typeof x?.pub === 'string' || typeof x?.look === 'string', what: 'Разделы' });
            const got = TO_MODEL.map(k => str(j?.[k], 20000)).join('');
            // страховка: модель должна была перенести текст, а не пересказать — если потеряла больше десятой части, не берём
            if (got.replace(/\s+/g, '').length < text.replace(/\s+/g, '').length * 0.9) throw new Error('помощник потерял часть текста — оставила как было');
            for (const k of TO_MODEL) c.sec[k].t = str(j?.[k], 20000);
        } else if (act === 'ps-write') {
            if (!w && !known(c)) throw new Error('напиши пожелания: кто она, откуда, какая');
            const ask = A.askDeepJson || A.askJson;
            const j = await ask([{ role: 'system', content: WRITE }, { role: 'user', content: `Персона: ${name}.${c.form.gender ? ` Пол: ${c.form.gender === 'f' ? 'женский' : 'мужской'}.` : ''}\nПожелания автора: ${w || '—'}\n\nУже вписано:\n${known(c) || '—'}` }], 3500, { check: (x) => !!str(x?.pub) || !!str(x?.look), what: 'Карточка персоны' });
            for (const [k] of SECTIONS) if (str(j?.[k])) c.sec[k].t = str(j[k], 6000);
        } else if (act === 'ps-tr') {
            const src = Object.fromEntries(TO_MODEL.filter(k => c.sec[k].t.trim()).map(k => [k, c.sec[k].t.trim()]));
            if (!Object.keys(src).length) throw new Error('переводить нечего');
            const j = await A.askJson([{ role: 'system', content: TRANSLATE }, { role: 'user', content: `${w ? `Пожелания: ${w}\n` : ''}${JSON.stringify(src)}` }], Math.min(12000, Math.round(JSON.stringify(src).length / 1.5) + 600), { check: (x) => Object.keys(src).some(k => !!str(x?.[k])), what: 'Перевод' });
            for (const k of Object.keys(src)) if (str(j?.[k])) c.en[k] = str(j[k], 12000);
            c.lang = 'en';
        } else if (act === 'ps-declai') {
            const words = formWords(c.form);
            if (!words.length) throw new Error('в анкете нет имён');
            const j = await A.askJson([{ role: 'system', content: DECL }, { role: 'user', content: `Пол: ${c.form.gender === 'f' ? 'женский' : c.form.gender === 'm' ? 'мужской' : 'не указан'}.\nСлова: ${words.map(x => `${x.w} (${x.kind === 'last' ? 'фамилия' : x.kind === 'nick' ? 'кличка' : 'имя'})`).join('; ')}` }], 900, { check: (x) => Array.isArray(x?.words), what: 'Склонения' });
            for (const r of arr(j.words)) {
                const x = words.find(y => y.w.toLowerCase() === str(r?.w, 60).toLowerCase());
                const forms = arr(r?.forms).map(f => str(f, 60));
                if (!x || forms.length !== 6 || forms.some(f => !f)) continue;
                c.decl[x.w.toLowerCase()] = { ok: r.ok !== false && forms.slice(1).some(f => f !== x.w), forms: [x.w, ...forms.slice(1)] };
            }
        }
        sideRender();
        A.toast('success', 'Готово — проверь и сохрани карточку', '✦ Персоны', { timeOut: 2500 });
    }, 'Думаю…');
}

function declSheet(w, kind) {
    const c = readCard();
    ui.draft = c;
    const f = wordForms(c, w, kind);
    ui.declWord = { w, kind };
    openSide({ title: `${icon('type')} ${esc(w)}`, html: () => `
        <label class="lf-switch"><input type="checkbox" data-in="ps-d-ok"${f.ok ? ' checked' : ''}><span></span>Склоняется</label>
        ${CASES.slice(1).map((label, k) => `<div class="lf-field row"><label>${label}</label><input type="text" data-in="ps-d-${k + 1}" value="${esc(f.forms[k + 1])}"></div>`).join('')}
        <div class="lf-actions"><button class="lf-btn primary" data-act="ps-dsave">${icon('check')} Так и есть</button><button class="lf-btn ghost" data-act="ps-dauto">${icon('refresh')} По правилу</button><button class="lf-btn ghost" data-act="ps-dback">${icon('left')} К карточке</button></div>
        <div class="lf-hint">«${esc(w)}» — ${kind === 'last' ? 'фамилия' : kind === 'nick' ? 'кличка' : 'имя'}. Правило подсказывает, но иностранные имена угадывает не всегда — впиши, как говорят у тебя в истории.</div>`,
    onClose: () => { ui.av = ''; ui.draft = null; if (winOpen('personas')) winRender(); } });
}
const backToCard = () => { const av = ui.av, d = ui.draft; openSide({ title: `${icon('idcard')} ${esc(A.cut(nameOf(av) || av, 30))}`, html: cardHtml, onClose: () => { ui.av = ''; ui.draft = null; if (winOpen('personas')) winRender(); } }); ui.draft = d; sideRender(); };

// ───────────── вкладка «Имена и склонения» ─────────────

function namesHtml() {
    const c = cfg();
    const tabs = `<div class="lf-seg lw-seg"><button data-act="ps-tab" data-v="cards">Персоны</button><button class="on" data-act="ps-tab" data-v="names">Имена и склонения</button></div>`;
    const row = (x, k) => { const f = x.ok === false ? { ok: false, forms: Array(6).fill(x.w) } : arr(x.forms).length === 6 ? { ok: true, forms: x.forms } : decline(x.w, x.g || '', x.kind || 'first'); return `<div class="lw-name"><b>${esc(x.w)}</b><small>${f.ok ? esc(f.forms.slice(1).join(', ')) : 'не склоняется'}</small>
        <select data-in="ps-n-g" data-k="${k}"><option value=""${x.g ? '' : ' selected'}>пол —</option><option value="f"${x.g === 'f' ? ' selected' : ''}>ж</option><option value="m"${x.g === 'm' ? ' selected' : ''}>м</option></select>
        <select data-in="ps-n-kind" data-k="${k}"><option value="first"${x.kind === 'last' || x.kind === 'nick' ? '' : ' selected'}>имя</option><option value="last"${x.kind === 'last' ? ' selected' : ''}>фамилия</option><option value="nick"${x.kind === 'nick' ? ' selected' : ''}>кличка</option></select>
        <label class="lw-sw" title="склоняется"><input type="checkbox" data-in="ps-n-ok" data-k="${k}"${f.ok ? ' checked' : ''}><i></i></label><button class="lf-x" data-act="ps-n-del" data-k="${k}">${icon('x')}</button></div>`; };
    let preview = '';
    try { preview = personasPrompt('normal'); } catch { /* нет чата */ }
    return `${tabs}
    <label class="lf-switch"><input type="checkbox" data-in="ps-names"${c.names !== false ? ' checked' : ''}><span></span>Давать модели строку «как склонять имена»</label>
    <div class="lf-hint">Имена твоей персоны берутся из её анкеты. Здесь — остальные: герои и люди истории, чьи имена модель склоняет не так («с Баком», «у Земы»).</div>
    <div class="lw-names">${c.dict.map(row).join('') || '<div class="lf-empty small">Словарь пуст.</div>'}</div>
    <div class="lw-tools"><input type="text" data-in="ps-n-new" placeholder="Баки, Барнс, Наташа, Романофф — через запятую"><button class="lf-chip" data-act="ps-n-add">${icon('plus')} добавить</button></div>
    <div class="lf-chips wrap"><button class="lf-chip" data-act="ps-n-alias">${icon('users')} подтянуть прозвища из настроек Life</button></div>
    ${preview ? `${A.sec('Что уйдёт модели')}<pre class="lw-pre">${esc(preview)}</pre>` : ''}`;
}

function addWords(text) {
    const c = cfg();
    let n = 0;
    for (const w of String(text || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean)) {
        if (!/^[а-яё][а-яё’' -]*$/i.test(w) || c.dict.some(x => x.w.toLowerCase() === w.toLowerCase())) continue;
        c.dict.push({ w, g: '', kind: 'first' });
        n++;
    }
    if (c.dict.length > 60) c.dict.length = 60;
    return n;
}

// ───────────── клики ─────────────

async function click(act, el) {
    const av = ui.av;
    const c = cfg();
    switch (act) {
        case 'ps-tab': ui.tab = el.dataset.v; closeSide(); winRender(); return;
        case 'ps-open': showCard(el.dataset.av); return;
        case 'ps-ghosts': ui.hidden = !ui.hidden; winRender(); return;
        case 'ps-use': {
            const m = await personasMod();
            if (!m) throw new Error('эта версия ST не даёт расширениям выбирать персону');
            await m.setUserAvatar(av, { toastPersonaNameChange: false });
            curAv = av;
            personaGuard();
            try { A.updatePrompt?.(); } catch { /* */ }
            A.toast('success', `Персона: ${esc(nameOf(av) || av)}`, '✦ Персоны', { timeOut: 1800 });
            winRender(); sideRender();
            return;
        }
        case 'ps-own': {
            const v = viewOf(av);
            ui.draft = { ...v.card, own: true };
            sideRender();
            A.toast('info', 'Правь разделы под эту эпоху и сохрани — карточка станет своей', '✦ Персоны', { timeOut: 3500 });
            return;
        }
        case 'ps-unown': {
            if (!sure(el, 'Стереть свою карточку эпохи?')) return;
            const t = twinOf(av);
            delete c.cards[av];
            save();
            if (t) writeDesc(av, patchText(desc(t.base), t.patches));   // как сделало бы ядро при входе в чат
            ui.draft = null;
            winRender(); sideRender();
            return;
        }
        case 'ps-pull': { const cur = norm(c.cards[av]); cur.sec.pub.t = desc(av); cur.sec.look.t = ''; cur.sec.voice.t = ''; c.cards[av] = cur; save(); sideRender(); return; }
        case 'ps-push': writeDesc(av, buildDesc(c.cards[av])); sideRender(); return;
        case 'ps-lang': { const d = readCard(); d.lang = d.lang === 'en' ? 'ru' : 'en'; ui.draft = d; sideRender(); return; }
        case 'ps-look': case 'ps-voice': case 'ps-split': case 'ps-write': case 'ps-tr': case 'ps-declai': await helper(act, el); return;
        case 'ps-decl': declSheet(el.dataset.w, el.dataset.kind); return;
        case 'ps-dback': backToCard(); return;
        case 'ps-dauto': case 'ps-dsave': {
            const d = ui.draft, x = ui.declWord;
            if (!d || !x) return;
            if (act === 'ps-dauto') delete d.decl[x.w.toLowerCase()];
            else {
                const box = sideBox();
                const ok = !!box.querySelector('[data-in="ps-d-ok"]')?.checked;
                const forms = [x.w, ...[1, 2, 3, 4, 5].map(k => str(box.querySelector(`[data-in="ps-d-${k}"]`)?.value, 60) || x.w)];
                d.decl[x.w.toLowerCase()] = { ok: ok && forms.slice(1).some(f => f !== x.w), forms };
            }
            backToCard();
            return;
        }
        case 'ps-save': {
            const d = readCard();
            if (ui.draft?.own) d.own = true;
            saveCard(av, d);
            A.toast('success', 'Карточка сохранена — описание персоны обновлено', '✦ Персоны', { timeOut: 2200 });
            try { A.updatePrompt?.(); } catch { /* */ }
            winRender(); sideRender();
            return;
        }
        case 'ps-lore-open': { const B = await import('./books.js'); closeSide(); await B.openBooks({ book: el.dataset.name }); return; }
        case 'ps-lore-new': {
            const W = await import('/scripts/world-info.js').catch(() => null);
            if (!W?.createNewWorldInfo) throw new Error('эта версия ST не отдаёт лорбуки расширениям');
            const base = `Персона — ${nameOf(av) || av}${twinOf(av) ? ` (${twinOf(av).label})` : ''}`;
            let name = base;
            for (let k = 2; (W.world_names || []).includes(name); k++) name = `${base} ${k}`;
            await W.createNewWorldInfo(name);
            setLore(av, name);
            ui.books = [...(W.world_names || [])].sort((a, b) => a.localeCompare(b, 'ru'));
            sideRender();
            A.toast('success', `Лорбук «${esc(name)}» заведён и привязан`, '✦ Персоны');
            return;
        }
        case 'ps-n-add': { const inp = winBox()?.querySelector('[data-in="ps-n-new"]'); if (addWords(inp?.value)) { save(); try { A.updatePrompt?.(); } catch { /* */ } winRender(); } return; }
        case 'ps-n-alias': {
            // «Имя карточки = прозвища» из настроек Life: берём только кириллицу
            const words = String(A.settings().aliases || '').split('\n').flatMap(l => (l.includes('=') ? l.split('=')[1] : '').split(',')).map(x => x.trim()).filter(Boolean);
            const n = addWords(words.join(','));
            save(); winRender();
            A.toast(n ? 'success' : 'info', n ? `Добавлено слов: ${n} — проставь пол, где имя женское` : 'Новых прозвищ на кириллице нет', '✦ Персоны', { timeOut: 3000 });
            return;
        }
        case 'ps-n-del': c.dict.splice(Number(el.dataset.k), 1); save(); try { A.updatePrompt?.(); } catch { /* */ } winRender(); return;
        default: return;
    }
}

function setLore(av, name, remember = true) {
    const p = pu();
    // своему двойнику эпохи выбор запоминаем в карточке: страж вернёт его после пересборки ядром
    if (remember && twinOf(av) && cfg().cards[av]?.own === true) { cfg().cards[av].lore = name || ''; save(); }
    if (!p.persona_descriptions) p.persona_descriptions = {};
    const d = p.persona_descriptions[av] || (p.persona_descriptions[av] = { description: desc(av), position: 0, depth: 2, role: 0, lorebook: '', connections: [], title: '' });
    d.lorebook = name || '';
    if (av === currentAv()) { p.persona_description_lorebook = name || ''; try { document.getElementById('persona_lore_button')?.classList.toggle('world_set', !!name); } catch { /* */ } }
    try { A.ctx().saveSettingsDebounced(); } catch { /* */ }
}

function change(el) {
    const k = el?.dataset?.in;
    if (!k || !k.startsWith('ps-')) return false;
    const c = cfg();
    if (k === 'ps-lore') { setLore(ui.av, el.value); sideRender(); return true; }
    if (k === 'ps-names') { c.names = el.checked; save(); try { A.updatePrompt?.(); } catch { /* */ } winRender(); return true; }
    if (k === 'ps-n-g' || k === 'ps-n-kind' || k === 'ps-n-ok') {
        const x = c.dict[Number(el.dataset.k)];
        if (!x) return true;
        if (k === 'ps-n-g') { x.g = el.value; delete x.forms; }
        if (k === 'ps-n-kind') { x.kind = el.value; delete x.forms; }
        if (k === 'ps-n-ok') { if (el.checked) delete x.ok; else x.ok = false; }
        save(); try { A.updatePrompt?.(); } catch { /* */ } winRender();
        return true;
    }
    if (k === 'ps-ref') {
        const f = el.files?.[0];
        if (!f) return true;
        (async () => { try { ui.ref = await A.fileToJpeg(f, 1024); A.toast('success', 'Реф загружен — жми «описать по картинке»', '✦ Персоны', { timeOut: 2500 }); } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Персоны'); } })();
        return true;
    }
    return false;
}

let qTimer = null;
function input(el) {
    if (el?.dataset?.in !== 'ps-q') return false;
    ui.q = el.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { const pos = el.selectionStart; winRender(); const again = winBox()?.querySelector('[data-in="ps-q"]'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* */ } } }, 220);
    return true;
}

export async function openPersonas({ av = '' } = {}) {
    ui.q = ''; ui.tab = 'cards'; ui.av = ''; ui.draft = null; ui.ref = ''; ui.books = ui.books || [];
    openWin({ id: 'personas', title: `${icon('user')} Персоны`, html: galleryHtml });
    await Promise.all([personasMod(), loadFiles(), loadReg(true), (async () => { try { const W = await import('/scripts/world-info.js'); ui.books = [...(W.world_names || [])].sort((a, b) => a.localeCompare(b, 'ru')); } catch { ui.books = []; } })()]);
    winRender();
    if (av) showCard(av);
}

export function initPersonas(api) {
    A = api;
    ui.books = [];
    winMod({ pre: 'ps-', click, change, input });
    // текущая персона и страж двойников: после смены чата, эпохи и персоны
    personasMod().then(() => { currentAv(); loadReg().then(() => personaGuard()); }).catch(() => { });
    const again = () => { for (const ms of [700, 2600]) setTimeout(() => { loadReg().then(() => { if (personaGuard()) { try { A.updatePrompt?.(); } catch { /* */ } } }).catch(() => { }); }, ms); };
    try {
        const { eventSource, eventTypes: E } = A.ctx();
        if (E?.PERSONA_CHANGED) eventSource.on(E.PERSONA_CHANGED, (av) => { if (typeof av === 'string' && av) curAv = av; again(); });
        if (E?.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, again);
        // перед самой сборкой промпта: таверна читает описание персоны раньше перехватчиков генерации, а ядро могло
        // только что пересобрать обличье из базовой — своя карточка эпохи должна успеть вернуться до этого
        if (E?.GENERATION_STARTED) eventSource.on(E.GENERATION_STARTED, () => { try { personaGuard(); } catch { /* */ } });
    } catch { /* */ }
    try { window.addEventListener?.('sacred-timeline:changed', again); } catch { /* */ }
}
