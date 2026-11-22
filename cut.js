// «Тем временем». По кнопке тот, кого нет в сцене, пишет свою сцену там, где он сейчас: Тони в мастерской на озере,
// Вальден двигает фигуры. Это настоящий пост в чате, только выглядит иначе (плашка «Тем временем», холодный кадр),
// и видят его только те, кто в нём был (глухие стены, walls.js): Баки и Хеди о нём не знают, а ты знаешь.
// Пост не двигает основную сцену: Horae его не считает (_skipHorae), «где мы сейчас» берётся из основной сцены,
// Летописцу сказано, что это отдельная сцена. Текст из поля ввода на это время откладывается и возвращается.
// Идея — Immersion Director (moonnsy): там отсутствующий, которого дёрнули, пишет «там, где он есть».

import { agendaOf } from './agenda.js';

let A = null;
let stash = null;   // текст из поля ввода — вернуть после генерации
let saveT = null;

export function initCut(api) {
    A = api;
    try {
        const { eventSource, eventTypes: E } = A.ctx();
        if (E?.MESSAGE_RECEIVED) eventSource.on(E.MESSAGE_RECEIVED, (id) => { try { markReceived(Number(id)); } catch (e) { console.warn('[Life] тем временем', e); } });
        // оборвали до ответа — «Тем временем» не состоялось
        if (E?.GENERATION_STOPPED) eventSource.on(E.GENERATION_STOPPED, () => { try { const c = M(); if (c.armed?.used) { c.armed = null; A.saveMeta(); } } catch { /* */ } });
        if (E?.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, () => { stash = null; });
    } catch (e) { console.warn('[Life] тем временем: события', e); }
}

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

function M() {
    const cm = A.chatMeta();
    if (!cm.cut || typeof cm.cut !== 'object') cm.cut = {};
    return cm.cut;
}

/** Пост — «Тем временем»? */
export const isCutMsg = (m) => !!m?.extra?.lifeCut;

function agendaSafe(who) { try { return agendaOf(who) || null; } catch { return null; } }

/** Номер участника группы в списке персонажей таверны (для generate с force_chid), −1 — не нашёлся. */
export function chidOf(who) {
    try {
        const c = A.ctx();
        const g = (c.groups || []).find(x => x.id === c.groupId);
        for (const av of g?.members || []) {
            const k = (c.characters || []).findIndex(x => x.avatar === av);
            if (k >= 0 && A.sameName(c.characters[k].name, who)) return k;
        }
    } catch { /* */ }
    return -1;
}

function restore() {
    if (stash == null) return;
    const ta = document.getElementById('send_textarea');
    if (ta && !ta.value.trim()) { ta.value = stash; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    stash = null;
}

/** Запустить «Тем временем» для who: его ход, его сцена там, где он сейчас. */
export async function cutStart(who) {
    const c = A.ctx();
    if (!c.groupId) { A.toast('info', '«Тем временем» — для групповых чатов', '✦ Тем временем'); return false; }
    const name = A.canonName(who);
    const chid = chidOf(name);
    if (chid < 0) { A.toast('warning', `${esc(A.shortName(name))} нет в этой группе`, '✦ Тем временем'); return false; }
    const g = agendaSafe(name);
    M().armed = { who: name, used: false, where: String(g?.where || '').trim().slice(0, 80), at: Date.now() };
    A.saveMeta();
    const ta = document.getElementById('send_textarea');
    if (ta && ta.value.trim()) { stash = ta.value; ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    A.toast('info', `Тем временем у ${esc(A.shortName(name))}…`, '✦ Тем временем', { timeOut: 1800 });
    try {
        await c.generate('normal', { force_chid: chid });
    } catch (e) {
        console.warn('[Life] тем временем', e);
        A.toast('warning', esc(String(e?.message || e)), '✦ Тем временем');
    } finally {
        // ответ пришёл — пометка уже стоит (markReceived); сорвалось — не оставлять взведённым на чужой ход
        if (M().armed) { M().armed = null; A.saveMeta(); }
        setTimeout(restore, 60);
    }
    return true;
}

/** Взведено ли «Тем временем» на этот ход S (или это свайп/продолжение такого поста). */
export function cutArmedFor(S, type) {
    if (!A?.hasChat?.() || !S || NARR.test(S)) return false;
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    if (['swipe', 'regenerate', 'continue'].includes(type)) return !!(last && !last.is_user && isCutMsg(last) && A.sameName(last.extra.lifeCut.who, S));
    if (type === 'quiet' || type === 'impersonate') return false;
    const a = M().armed;
    return !!(a && !a.used && A.sameName(a.who, S) && Date.now() - (a.at || 0) < 10 * 60e3);
}

/** Правила модели на ход «Тем временем» (null — это обычный ход). consume — генерация пошла. */
export function cutLinesFor(S, U, type, consume = false) {
    if (!cutArmedFor(S, type)) return null;
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const redo = ['swipe', 'regenerate', 'continue'].includes(type);
    const a = M().armed;
    const g = agendaSafe(S);
    const where = (redo ? last?.extra?.lifeCut?.where : a?.where) || String(g?.where || '').trim();
    const doing = String(g?.now || '').trim();
    if (consume && !redo && a && !a.used) { a.used = true; a.where = where; A.saveMeta(); }
    return [
        `[CUTAWAY — «Тем временем»: this reply is a separate scene of ${S}, away from ${U}, at the same moment of the story, where ${S} actually is right now${where ? ` (${where})` : ''}${doing ? `; by ${S}'s own life: ${A.cut(doing, 220)}` : ''}. Write ${S}: actions, words, thoughts and what ${S} notices; people who are there with ${S} may act around them.`,
        `- ${U} and everyone in ${U}'s scene are not there: they don't appear and don't speak, and ${S} doesn't know what is happening with them right now. No calls or messages to ${U} in this reply — it is ${S}'s own scene; ${S} may think of ${U}.`,
        `- 3–6 paragraphs, close to ${S}. End on a concrete image or a small hook that can matter later. Nothing in it changes ${U}'s scene.`,
    ];
}

function saveSoon() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { A.ctx().saveChat?.(); } catch { /* */ } }, 900);
}

/** Пришёл ответ: если это был ход «Тем временем» — пометить пост. */
function markReceived(id) {
    const a = M().armed;
    if (!a?.used || !Number.isFinite(id)) return;
    const m = A.chatArr()[id];
    if (!m || m.is_user || m.is_system || !A.sameName(m.name, a.who)) return;
    m.extra = m.extra || {};
    m.extra.lifeCut = { who: a.who, where: a.where || '' };
    if (m.horae_meta) m.horae_meta._skipHorae = true;
    M().armed = null;
    A.saveMeta();
    saveSoon();
    try { A.updatePrompt?.(); } catch { /* */ }
    A.paintSoon?.();
}

/** Horae перечитал пост и снял свою пометку — вернуть (вызывается при отрисовке). */
function heal(m) {
    if (isCutMsg(m) && m.horae_meta && !m.horae_meta._skipHorae) { m.horae_meta._skipHorae = true; saveSoon(); }
}

/** В чате: плашка «Тем временем» и холодный кадр. */
export function paintCut(el, id) {
    const m = A.chatArr()[id];
    const cut = !!(m && isCutMsg(m) && A.settings().enabled !== false);
    const textEl = el.querySelector('.mes_text');
    const old = el.querySelector(':scope .lf-cutlabel');
    el.classList.toggle('lf-cut', cut);
    if (!cut || !textEl) { old?.remove(); return; }
    heal(m);
    const c = m.extra.lifeCut;
    const sig = `${c.who}|${c.where}`;
    if (old && old.dataset.sig === sig && old.nextElementSibling === textEl) return;
    old?.remove();
    const label = document.createElement('div');
    label.className = 'lf-cutlabel lf-own';
    label.dataset.sig = sig;
    label.innerHTML = `<span>${A.icon('film')}<b>Тем временем</b><i>${c.where ? esc(A.cut(c.where, 48)) : esc(A.shortName(c.who))}</i></span><button data-act="cut-undo" data-mes="${id}" title="Это не «Тем временем» — сделать обычным постом">${A.icon('x')}</button>`;
    textEl.before(label);
}

export async function cutClick(act, el) {
    if (!act.startsWith('cut-')) return false;
    if (act === 'cut-go') {
        const who = el.dataset.who;
        A.closeSheet?.();
        try { A.closeHub?.(); } catch { /* */ }
        setTimeout(() => { cutStart(who); }, 260);
        return true;
    }
    if (act === 'cut-undo') {
        const i = Number(el.dataset.mes);
        const m = A.chatArr()[i];
        if (!m?.extra?.lifeCut) return true;
        delete m.extra.lifeCut;
        if (m.horae_meta) delete m.horae_meta._skipHorae;
        A.saveMeta();
        try { await A.ctx().saveChat?.(); } catch { /* */ }
        try { A.updatePrompt?.(); } catch { /* */ }
        A.paintSoon?.();
        A.toast('info', 'Обычный пост — его снова видят все, кто был в сцене', '✦ Тем временем', { timeOut: 2200 });
        return true;
    }
    return false;
}
