// Глазами Хеди: в напряжённой сцене — экран в её восприятии. Умная модель читает сцену её глазами: выходы,
// укрытия, кто вооружён и чем, кто врёт (по мимике — какой «тик»), что чует её мутантский нюх на энергию.
// Тап по человеку — её «прочтение» одной-двумя фразами; «в черновик» — в поле ввода, дописать к своему посту.
// Только для неё — модели ничего не уходит.

import { str, arr } from './hudkit.js';

let A = null;
export function initEyes(api) { A = api; }
const esc = (v) => A.esc(v);
const on = () => A.settings().eyes?.on !== false;
function M() { const cm = A.chatMeta(); if (!cm.eyes || typeof cm.eyes !== 'object') cm.eyes = {}; return cm.eyes; }

const SYS = `Ты — восприятие Хеди Барлоу в ролевой истории God Complex (AU по Marvel): гений, выучка Красной комнаты, мутант — чует энергию (Камни, сыворотка, техника, силы). Прочитай сцену ЕЁ глазами — только то, что она может заметить отсюда и сейчас (из последних постов; не выдумывай людей и оружие, которых нет в сцене; можно подметить вероятное, но помечай «похоже»).
Только JSON: {"exits":["коротко"],"cover":["коротко"],"people":[{"who":"","armed":"чем или пусто","where":"где стоит","lie":"тик/признак лжи или пусто","energy":"что чует или пусто","threat":0-3,"read":"её прочтение 1–2 фразы, от первого лица, по-русски"}],"note":"одна фраза — что главное прямо сейчас"}`;
function excerpt() {
    const chat = A.chatArr();
    const out = [];
    for (let i = Math.max(0, chat.length - 4); i < chat.length; i++) { const m = chat[i]; if (m && !m.is_system) out.push(`${m.name}: ${String(m.mes || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1600)}`); }
    return out.join('\n\n');
}
export async function look() {
    const ws = A.worldState() || {};
    const msgs = [{ role: 'system', content: SYS }, { role: 'user', content: `Где: ${ws.scene?.location || '—'}. В сцене: ${arr(ws.scene?.characters_present).join(', ') || '—'}.\n\n${excerpt()}` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 2200, { what: 'глазами Хеди' }, { who: [A.ctx().name1] }) : A.extractJson(await A.askModel(msgs, 1600));
    const x = {
        exits: arr(j?.exits).map(t => str(t, 80)).filter(Boolean).slice(0, 4), cover: arr(j?.cover).map(t => str(t, 80)).filter(Boolean).slice(0, 4),
        people: arr(j?.people).slice(0, 8).map(p => ({ who: str(p?.who, 50), armed: str(p?.armed, 80), where: str(p?.where, 60), lie: str(p?.lie, 100), energy: str(p?.energy, 100), threat: Math.max(0, Math.min(3, Number(p?.threat) || 0)), read: str(p?.read, 300) })).filter(p => p.who),
        note: str(j?.note, 200), at: A.chatArr().length - 1, loc: ws.scene?.location || '',
    };
    M().last = x;
    A.saveMeta();
    return x;
}

const ui = { who: '' };
const TH = ['спокоен', 'настороже', 'опасен', 'сейчас ударит'];
/** Оверлей поверх всего. */
export function show(x) {
    hide();
    const el = document.createElement('div');
    el.className = 'lf-eyes';
    el.innerHTML = `<div class="lf-eyes-scan"></div><div class="lf-eyes-in">
        <div class="lf-eyes-h"><b>👁 ГЛАЗАМИ ХЕДИ</b><span>${esc(x.loc)}</span><button data-act="eye-close">✕</button></div>
        ${x.note ? `<p class="lf-eyes-note">${esc(x.note)}</p>` : ''}
        <div class="lf-eyes-grid"><div><small>ВЫХОДЫ</small>${x.exits.map(t => `<p>⟶ ${esc(t)}</p>`).join('') || '<p>—</p>'}</div><div><small>УКРЫТИЯ</small>${x.cover.map(t => `<p>▣ ${esc(t)}</p>`).join('') || '<p>—</p>'}</div></div>
        <div class="lf-eyes-ppl">${x.people.map((p, i) => `<button class="lf-eyes-p t${p.threat}${ui.who === String(i) ? ' on' : ''}" data-act="eye-who" data-v="${i}">
            <b>${esc(A.shortName(p.who))}</b><span>${esc(TH[p.threat])}${p.where ? ` · ${esc(p.where)}` : ''}</span>
            ${p.armed ? `<em>⚠ ${esc(p.armed)}</em>` : ''}${p.lie ? `<em class="lie">◐ врёт? ${esc(p.lie)}</em>` : ''}${p.energy ? `<em class="en">✦ ${esc(p.energy)}</em>` : ''}
            ${ui.who === String(i) && p.read ? `<q>${esc(p.read)}</q><span class="lf-eyes-act" data-act="eye-draft" data-v="${i}">✎ в черновик</span>` : ''}</button>`).join('')}</div></div>`;
    (document.getElementById('lf-app') || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('on'));
}
export function hide() { document.querySelectorAll('.lf-eyes').forEach(e => e.remove()); }
export function eyeSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const x = M().last;
    return `${A.sec('Глазами Хеди')}
        <button class="lf-btn primary wide" data-act="eye-look">👁 Посмотреть её глазами</button>
        ${x ? `<button class="lf-btn wide" data-act="eye-show">Последний взгляд · пост #${x.at}</button>` : ''}
        <div class="lf-hint">Выходы, укрытия, кто вооружён, кто врёт, что чует её нюх на энергию. Тап по человеку — её прочтение; «в черновик» — в поле ввода. Модели ничего не уходит.</div>`;
}
export const eyeState = () => '';
export async function eyeClick(act, el) {
    if (act === 'eye-look') { const x = await A.withBusy(el, () => look(), 'Смотрит…'); if (x) { ui.who = ''; show(x); } return; }
    if (act === 'eye-show') { const x = M().last; if (x) show(x); return; }
    if (act === 'eye-close') { hide(); return; }
    if (act === 'eye-who') { ui.who = ui.who === el.dataset.v ? '' : el.dataset.v; const x = M().last; if (x) show(x); return; }
    if (act === 'eye-draft') {
        const p = M().last?.people?.[Number(el.dataset.v)];
        const ta = document.getElementById('send_textarea');
        if (p?.read && ta) { ta.value = `${ta.value ? `${ta.value.trimEnd()}\n` : ''}${p.read}`; ta.dispatchEvent(new Event('input', { bubbles: true })); A.toast('success', 'В поле ввода'); }
    }
}
export const _eye = { M, ui };
