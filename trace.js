// Что сработало из лорбуков. Таверна сообщает, какие записи World Info попали в промпт ответа; Life запоминает
// их у поста и показывает под ним чип «📚 N» — видно, что модель знала на этом ходу, а чего ей не дали
// (когда «забыла»: запись не сработала — или сработала, и дело не в лорбуке). В промпт ничего не добавляет.

import { mount } from './hudkit.js';

let A = null;
let armed = false;
let last = [];
const opened = new Set();

function cfg() {
    const s = A.settings();
    if (!s.trace || typeof s.trace !== 'object') s.trace = {};
    if (s.trace.on === undefined) s.trace.on = true;
    return s.trace;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.trace || typeof cm.trace !== 'object') cm.trace = {};
    return cm.trace;
}

export function initTrace(api) {
    A = api;
    const { eventSource, eventTypes: E } = A.ctx();
    if (!eventSource || !E) return;
    if (E.GENERATION_STARTED) eventSource.on(E.GENERATION_STARTED, (type, _o, dry) => { if (!dry && type !== 'quiet') { armed = true; last = []; } });
    if (E.WORLD_INFO_ACTIVATED) eventSource.on(E.WORLD_INFO_ACTIVATED, (entries) => {
        if (!armed || !Array.isArray(entries)) return;
        last = entries.slice(0, 80).map(e => ({ w: String(e?.world || ''), c: String(e?.comment || (Array.isArray(e?.key) ? e.key.slice(0, 3).join(', ') : '') || `#${e?.uid ?? '?'}`).slice(0, 80), k: e?.constant ? 'c' : '' }));
    });
    const got = (id) => {
        const i = Number(id);
        if (!armed || !Number.isFinite(i)) return;
        armed = false;
        const m = A.chatArr()[i];
        if (!on() || !m || m.is_user || !last.length) return;
        const t = M();
        t[`${i}:${m.swipe_id ?? 0}`] = last;
        const keys = Object.keys(t);
        for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete t[k];
        last = [];
        A.saveMeta(); A.paintSoon?.();
    };
    if (E.MESSAGE_RECEIVED) eventSource.on(E.MESSAGE_RECEIVED, got);
}

export function paintTrace(el, id) {
    const m = A.chatArr()[id];
    const list = on() && m && !m.is_user ? M()[`${id}:${m.swipe_id ?? 0}`] : null;
    if (!Array.isArray(list) || !list.length) { mount(el, 'lf-lt', '', A.hash); return; }
    const isOpen = opened.has(id);
    const by = {};
    for (const e of list) (by[e.w || 'лорбук'] = by[e.w || 'лорбук'] || []).push(e);
    mount(el, 'lf-lt', `<div class="lf-lt lf-own${isOpen ? ' open' : ''}"><button class="lf-lt-b" data-act="lt-toggle" data-mes="${id}">📚 <span>${list.length}</span></button>${isOpen ? `<div class="lf-lt-box">${Object.entries(by).map(([w, es]) => `<div><b>${A.esc(w)}</b>${es.map(e => `<span${e.k ? ' class="c"' : ''}>${A.esc(e.c)}</span>`).join('')}</div>`).join('')}<small>Записи лорбуков, попавшие в промпт этого ответа; тусклые — постоянные.</small></div>` : ''}</div>`, A.hash);
}

export function traceClick(act, el) {
    if (act !== 'lt-toggle') return false;
    const id = Number(el.dataset.mes);
    if (opened.has(id)) opened.delete(id); else opened.add(id);
    const box = el.closest('.mes');
    if (box) paintTrace(box, id);
    return true;
}
