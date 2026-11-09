// Банк реплик. Удачная фраза персонажа — тапом в его «голос»: выдели её в посте (долгий тап), снизу всплывёт
// «⭐ в голос» с именами; или открой карточку поста — там его реплики списком со звёздочками.
// Перед ответом говорящий получает 3–4 своих образца: как он звучит, когда попадает в себя (не цитировать).
// Голос общий на все чаты (свой у каждого облика эпохи), закреплённые ★ идут модели всегда, остальные — по кругу.

import { lifeKey } from './sim.js';
import { duoPartner } from './duo.js';

let A = null;
export function initVoice(api) { A = api; hookSelection(); }

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

function cfg() {
    const s = A.settings();
    if (!s.voice || typeof s.voice !== 'object') s.voice = {};
    const v = s.voice;
    if (v.on === undefined) v.on = true;
    if (!Number.isFinite(v.n)) v.n = 3;
    if (!v.lines || typeof v.lines !== 'object') v.lines = {};
    return v;
}
export const voiceOn = () => cfg().on !== false && cfg().n > 0;

const keyOf = (who) => { try { return lifeKey(who); } catch { return A.canonName(who) || who; } };
export function linesOf(who) { return cfg().lines[keyOf(who)] || []; }

const flat = (t) => A.norm(t).replace(/[«»"'“”„.,!?…—–\-:;()]/g, '').replace(/\s+/g, ' ').trim();
function clean(t) {
    return String(t || '').replace(/\s+/g, ' ').trim()
        .replace(/^[—–-]\s*/, '')
        .replace(/^[«"“„]+|[»"”]+$/g, '')
        .trim();
}

/** В голос: true — добавлено, 'dup' — уже есть, false — пусто. */
export function addLine(who, text, mes = null) {
    const t = clean(text);
    if (t.length < 4 || !who) return false;
    const k = keyOf(who);
    const all = cfg().lines;
    const arr = all[k] || (all[k] = []);
    if (arr.some(x => flat(x.t) === flat(t))) return 'dup';
    arr.push({ id: Math.random().toString(36).slice(2, 9), t: t.slice(0, 420), at: Date.now(), mes, chat: chatKey() });
    if (arr.length > 80) { const drop = arr.findIndex(x => !x.pin); if (drop >= 0) arr.splice(drop, 1); }
    A.saveSettings();
    A.updatePrompt();
    return true;
}

function chatKey() { try { const c = A.ctx(); return String(c.chatId || c.getCurrentChatId?.() || ''); } catch { return ''; } }

// ───────────── заметка модели ─────────────

function speakers(type) {
    const c = A.ctx();
    const S = String(c.name2 || '').trim();
    if (!S || NARR.test(S)) return [];
    // пост на двоих — голос и второго
    let P = '';
    try { P = duoPartner(A.canonName(S), type, false); } catch { /* */ }
    return P ? [S, P] : [S];
}

/** Закреплённые — всегда, остальные — по кругу от хода к ходу (свайп того же ответа — те же). */
function pick(arr, n, turn) {
    const pins = arr.filter(x => x.pin).slice(-n);
    const rest = arr.filter(x => !x.pin);
    const out = [...pins];
    if (rest.length && out.length < n) {
        const need = Math.min(n - out.length, rest.length);
        const start = (turn * need) % rest.length;
        for (let k = 0; k < need; k++) out.push(rest[(start + k) % rest.length]);
    }
    return out;
}

export function voicePrompt(type) {
    if (!A?.hasChat?.() || !voiceOn() || type === 'quiet' || type === 'impersonate') return '';
    const L = A.chatArr().length;
    const turn = Math.floor((type === 'swipe' ? L - 1 : L) / 2);
    const out = [];
    for (const who of speakers(type)) {
        const arr = linesOf(who);
        if (!arr.length) continue;
        const got = pick(arr, Math.min(4, cfg().n), turn);
        if (!got.length) continue;
        out.push(`[Голос ${A.shortName(A.canonName(who))} — так звучит, когда попадает в себя. Это образцы ритма, словаря и интонации, а не цитаты: не повторяй их и не пересказывай, говори новое — но так же: ${got.map(x => `«${x.t}»`).join(' · ')}]`);
    }
    return out.join('\n');
}

// ───────────── выделение в чате → ⭐ ─────────────

let sel = null;      // { t, mes, author }
let hideT = null;

function pill() {
    let el = document.getElementById('lf-vpill');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'lf-vpill';
    el.className = 'lf-vpill';
    document.body.append(el);
    const act = (ev) => {
        const b = ev.target.closest('[data-vname]');
        if (!b || !sel) return;
        ev.preventDefault();
        ev.stopPropagation();
        const r = addLine(b.dataset.vname, sel.t, sel.mes);
        A.toast(r === 'dup' ? 'info' : 'success', r === 'dup' ? 'Эта фраза уже в голосе' : `«${esc(A.cut(clean(sel.t), 70))}»`, `⭐ Голос ${esc(A.shortName(b.dataset.vname))}`, { timeOut: 2200 });
        try { window.getSelection()?.removeAllRanges(); } catch { /* */ }
        hide();
    };
    el.addEventListener('pointerdown', act);
    el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    return el;
}

function hide() { clearTimeout(hideT); sel = null; document.getElementById('lf-vpill')?.classList.remove('on'); }

function namesFor(author) {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !NARR.test(n) && !A.sameName(n, A.ctx().name1) && !out.some(x => A.sameName(x, n))) out.push(n); };
    if (author) add(author);
    let here = [];
    try { here = (A.worldState().scene?.characters_present || []); } catch { /* */ }
    for (const n of here) add(n);
    for (const n of A.groupMembers()) add(n);
    return out.slice(0, 5);
}

function checkSel() {
    if (!A?.hasChat?.() || !A.settings().enabled || !voiceOn()) return;
    let s = null;
    try { s = window.getSelection(); } catch { /* */ }
    const t = s && !s.isCollapsed ? String(s).trim() : '';
    if (!t) { if (sel) { clearTimeout(hideT); hideT = setTimeout(hide, 2600); } return; }
    const node = s.anchorNode?.nodeType === 1 ? s.anchorNode : s.anchorNode?.parentElement;
    const mesEl = node?.closest?.('#chat .mes');
    if (!mesEl || !node.closest('.mes_text') || mesEl.getAttribute('is_user') === 'true' || mesEl.getAttribute('is_system') === 'true') { hide(); return; }
    if (t.length < 4 || t.length > 420) { hide(); return; }
    const mes = Number(mesEl.getAttribute('mesid'));
    const author = node.closest('[data-duo]')?.dataset.duo || A.chatArr()[mes]?.name || mesEl.getAttribute('ch_name') || ''; // в посте на двоих — чья часть
    clearTimeout(hideT);
    sel = { t, mes, author };
    const el = pill();
    const names = namesFor(author);
    if (!names.length) { hide(); return; }
    el.innerHTML = `<span class="lf-vpill-q">⭐ «${esc(A.cut(clean(t), 60))}»</span><span class="lf-vpill-who">${names.map((n, k) => `<button class="${k ? '' : 'main'}" data-vname="${esc(n)}">${k ? '' : '<b>в голос</b> '}${esc(A.shortName(n))}</button>`).join('')}</span>`;
    el.classList.add('on');
}

function hookSelection() {
    let t = null;
    document.addEventListener('selectionchange', () => { clearTimeout(t); t = setTimeout(() => { try { checkSel(); } catch (e) { console.warn('[Life] голос', e); } }, 260); });
}

// ───────────── в карточке поста: реплики списком ─────────────

/** Прямая речь поста: «…» и строки диалога с тире (без авторской ремарки). */
export function quotesOf(text) {
    const t = String(text || '');
    const out = [];
    const add = (q) => { q = clean(q); if (q.length >= 4 && q.length <= 420 && !out.some(x => flat(x) === flat(q))) out.push(q); };
    for (const m of t.matchAll(/«([^«»]{4,420})»/g)) add(m[1]);
    for (const m of t.matchAll(/“([^“”]{4,420})”/g)) add(m[1]);
    // «— Иди сюда, — сказал он. — И не спорь.» → реплики без ремарки (чётные куски между тире)
    const alt = (line) => { const parts = line.split(/\s[—–]\s/); for (let k = 0; k < parts.length; k += 2) add(parts[k].replace(/[,]$/, '')); };
    for (const m of t.matchAll(/(?:^|\n)\s*[—–]\s*([^\n]{4,500})/g)) alt(m[1]);
    // «Пей», — говорит он. — Не спорь. → продолжение реплики после ремарки
    for (const m of t.matchAll(/[»”]\s*[,.!?…]?\s*[—–]\s*[а-яёa-z][^—–\n]{0,80}?[.,!?…]\s*[—–]\s*([^\n]{4,500})/g)) alt(m[1]);
    return out.slice(0, 14);
}

export function voiceRowHtml(i) {
    if (!voiceOn()) return '';
    const m = A.chatArr()[i];
    if (!m || m.is_user || m.is_system) return '';
    const qs = quotesOf(A.plainText(m.mes));
    if (!qs.length) return '';
    const names = namesFor(m.name);
    const have = new Set(names.flatMap(n => linesOf(n).map(x => flat(x.t))));
    return `${A.sec('Реплики в голос', 'тапни ⭐')}
    ${names.length > 1 ? `<div class="lf-field"><label>Чей голос</label><select data-in="vo-who">${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div>` : `<input type="hidden" data-in="vo-who" value="${esc(names[0] || m.name || '')}">`}
    <div class="lf-vo-qs">${qs.map((q, n) => `<button class="lf-vo-q${have.has(flat(q)) ? ' on' : ''}" data-act="vo-add" data-mes="${i}" data-n="${n}">${A.icon('star')}<span>«${esc(q)}»</span></button>`).join('')}</div>`;
}

// ───────────── вид в «Персонаже» ─────────────

export function voiceHtml(who) {
    if (!A?.hasChat?.()) return '';
    who = A.canonName(who);
    if (A.sameName(who, A.ctx().name1)) return '';
    const arr = linesOf(who);
    const c = cfg();
    const N = esc(who);
    if (!arr.length) return `<div class="lf-vo-cta">${A.icon('star')}<span><b>Голос ${esc(A.shortName(who))}</b><small>Выдели удачную фразу в его посте — снизу появится ⭐ «в голос». Модели перед его ответом уйдут 3–4 таких образца.</small></span></div>`;
    const sorted = [...arr].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.at - a.at);
    return `${A.sec('Голос', `${arr.length} · модели по ${c.n}${voiceOn() ? '' : ' · выкл'}`)}
    <div class="lf-vo-list">${sorted.slice(0, ui.all ? 80 : 6).map(x => `<div class="lf-vo${x.pin ? ' pin' : ''}">
        <q>${esc(x.t)}</q>
        <span class="lf-vo-b">
            <button data-act="vo-pin" data-name="${N}" data-id="${x.id}" title="${x.pin ? 'открепить' : 'всегда давать модели'}">${A.icon('star')}</button>
            ${x.chat === chatKey() && Number.isFinite(x.mes) ? `<button data-act="jump" data-mes="${x.mes}" title="к посту">${A.icon('chevR')}</button>` : ''}
            <button data-act="vo-del" data-name="${N}" data-id="${x.id}" title="убрать">${A.icon('x')}</button>
        </span>
    </div>`).join('')}</div>
    ${arr.length > 6 ? `<button class="lf-btn ghost full" data-act="vo-all">${ui.all ? 'Свернуть' : `Все ${arr.length}`}</button>` : ''}
    <div class="lf-field"><label>Образцов модели</label><div class="lf-seg">${[[0, 'Выкл'], [2, '2'], [3, '3'], [4, '4']].map(([v, l]) => `<button class="${(c.on === false ? 0 : c.n) === v ? 'on' : ''}" data-act="vo-n" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="lf-hint">★ — давать всегда; остальные идут по кругу, чтобы модель не заучила одни и те же.</div>`;
}

const ui = { all: false };

export function voiceClick(act, el) {
    if (!act.startsWith('vo-')) return false;
    const c = cfg();
    const who = el.dataset.name || '';
    const arr = who ? linesOf(who) : [];
    const done = () => { A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'vo-n': { const v = Number(el.dataset.v); c.on = v > 0; if (v > 0) c.n = v; return done(); }
        case 'vo-all': ui.all = !ui.all; A.render(); return true;
        case 'vo-pin': { const x = arr.find(y => y.id === el.dataset.id); if (x) x.pin = !x.pin; return done(); }
        case 'vo-del': { const k = arr.findIndex(y => y.id === el.dataset.id); if (k >= 0) arr.splice(k, 1); return done(); }
        case 'vo-add': {
            const i = Number(el.dataset.mes);
            const m = A.chatArr()[i];
            const q = quotesOf(A.plainText(m?.mes || ''))[Number(el.dataset.n)];
            const box = el.closest('.lf-sheet') || document;
            const name = box.querySelector('[data-in="vo-who"]')?.value || m?.name || '';
            if (!q || !name) return true;
            if (el.classList.contains('on')) {
                const list = linesOf(name);
                const k = list.findIndex(y => flat(y.t) === flat(q));
                if (k >= 0) { list.splice(k, 1); el.classList.remove('on'); A.saveSettings(); A.updatePrompt(); }
                return true;
            }
            const r = addLine(name, q, i);
            if (r) el.classList.add('on');
            if (r === true) A.toast('success', `«${esc(A.cut(q, 60))}»`, `⭐ Голос ${esc(A.shortName(name))}`, { timeOut: 1600 });
            return true;
        }
    }
    return false;
}
