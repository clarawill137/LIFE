// Свои статы. Придумай показатель сама — «Ревность», «Подозрения Тони», «Сколько осталось до срыва» —
// напиши, что он значит, и выбери, у кого он: у каждого главного, у одного человека или один на всю историю.
// Летописец ведёт его после каждого поста (число 0–100 или короткий текст); модель получает строку показателей.
// Идея — «Свои статы» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, clamp, mains } from './hudkit.js';

let A = null;
const VIEWS = { bar: 'полоса', ring: 'кольцо', stars: 'звёзды', text: 'текст', tags: 'теги' };
const COLORS = ['#d9687b', '#e8c37a', '#7fb7a4', '#6f86c9', '#b9a4e8', '#e48a5a', '#9fb4c4'];
const viewOf = (d) => (VIEWS[d.view] ? d.view : d.type === 'num' ? 'bar' : 'text');
export function initStats(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    if (s.stats.on === undefined) s.stats.on = true;
    return s.stats;
}
const on = () => cfg().on !== false;
const JUMP = 25;   // больше этого числовой показатель за один пост не сдвигается

function M() {
    const cm = A.chatMeta();
    if (!cm.stats || typeof cm.stats !== 'object') cm.stats = {};
    const s = cm.stats;
    if (!Array.isArray(s.defs)) s.defs = [];           // { id, name, mean, type: num|text, owner: each|story|имя }
    if (!s.vals || typeof s.vals !== 'object') s.vals = {};   // id → { ключ: значение }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const everyone = () => [A.canonName(A.ctx().name1), ...mains(A)].filter(Boolean);
const keysOf = (d) => (d.owner === 'story' ? ['история'] : d.owner === 'each' ? mains(A) : [d.owner]);

export function statsChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const s = M();
    if (!s.defs.length) return null;
    const lines = s.defs.map(d => `${d.id} — «${d.name}»: ${d.mean || 'по названию'}; ${d.type === 'num' ? 'число 0-100' : viewOf(d) === 'tags' ? 'короткий список через запятую, до 5 пунктов по 1-3 слова' : 'короткий текст, 1-6 слов'}; у кого: ${keysOf(d).join(', ')}`);
    const rule = `
stats — показатели, которые автор завёл сам; обнови те, что ИЗМЕНИЛИСЬ в этом посте: {"s1":{"Имя":значение}}. Ключи — как в списке ниже («история» — если показатель один на всю историю). Число двигай плавно, по событиям поста, без скачков на пустом месте. Список: ${lines.join(' | ')}. Ничего не изменилось — {}.`;
    const cur = s.defs.map(d => `${d.name}: ${keysOf(d).map(k => `${A.shortName(k)} ${s.vals[d.id]?.[k] ?? (d.type === 'num' ? 0 : '—')}`).join(', ')}`);
    return { key: '"stats": {}', rule, tokens: 60 + s.defs.length * 30, input: `Свои показатели сейчас: ${cur.join(' | ')}` };
}

export function statsAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    if (s.mes === i && s.before) s.vals = JSON.parse(s.before);
    const before = JSON.stringify(s.vals);
    const raw = j?.stats;
    if (!raw || typeof raw !== 'object') return;
    let changed = false;
    for (const d of s.defs) {
        const row = raw[d.id];
        if (!row || typeof row !== 'object') continue;
        for (const k of keysOf(d)) {
            const hit = Object.keys(row).find(n => A.sameName(n, k) || A.norm(n) === A.norm(k));
            if (hit === undefined) continue;
            let v = d.type === 'num' ? clamp(Math.round(Number(row[hit])), 0, 100) : str(String(row[hit] ?? ''), 60);
            if (d.type === 'num' && !Number.isFinite(Number(row[hit]))) continue;
            s.vals[d.id] = s.vals[d.id] || {};
            // инерция: считает код — показатель не прыгает больше чем на JUMP за один пост, что бы ни назвала модель
            const prev = s.vals[d.id][k];
            if (d.type === 'num' && Number.isFinite(Number(prev))) v = clamp(v, Number(prev) - JUMP, Number(prev) + JUMP);
            if (s.vals[d.id][k] !== v) { s.vals[d.id][k] = v; changed = true; }
        }
    }
    if (changed) { s.mes = i; s.before = before; A.saveMeta(); }
}

export function statsPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const rows = s.defs.map(d => { const v = s.vals[d.id] || {}; const parts = keysOf(d).filter(k => v[k] !== undefined && v[k] !== '').map(k => `${d.owner === 'story' ? '' : `${A.shortName(k)} `}${v[k]}${d.type === 'num' ? '/100' : ''}`); return parts.length ? `${d.name}${d.mean ? ` (${d.mean})` : ''} — ${parts.join(', ')}` : ''; }).filter(Boolean);
    return rows.length ? `[Показатели автора: ${rows.join('; ')}. Веди персонажей в согласии с ними; цифры вслух не называй.]` : '';
}

export function statsSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    if (!s.defs.length) return '';
    return `${A.sec('Свои статы', String(s.defs.length))}<div class="lf-sv">${s.defs.map(d => `<div class="lf-sv-c" style="--sv:${esc(d.color || COLORS[0])}"><div class="lf-sv-h"><b>${d.icon ? `${esc(d.icon)} ` : ''}${esc(d.name)}</b><span><button data-act="sv-edit" data-id="${d.id}" title="править">${A.icon('pencil')}</button><button data-act="sv-del" data-id="${d.id}">${A.icon('x')}</button></span></div>${d.mean ? `<small>${esc(d.mean)}</small>` : ''}
        ${keysOf(d).map(k => rowHtml(d, k, s.vals[d.id]?.[k])).join('')}</div>`).join('')}</div>
    <button class="lf-btn ghost full" data-act="sv-add">${A.icon('plus')} Свой стат</button>`;
}

const pm = (d, k) => `<span><button data-act="sv-dn" data-id="${d.id}" data-k="${esc(k)}">−</button><button data-act="sv-up" data-id="${d.id}" data-k="${esc(k)}">+</button></span>`;
function rowHtml(d, k, v) {
    const who = d.owner === 'story' ? '' : A.ava(k, 'xs');
    const n = clamp(Number(v) || 0, 0, 100);
    switch (viewOf(d)) {
        case 'ring': {
            const r = 15, L = 2 * Math.PI * r;
            return `<div class="lf-sv-r">${who}<svg class="lf-sv-ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="${r}" class="bg"/><circle cx="20" cy="20" r="${r}" class="fg" stroke-dasharray="${(L * n / 100).toFixed(1)} ${L.toFixed(1)}"/><text x="20" y="24">${n}</text></svg><span class="lf-sv-k">${d.owner === 'story' ? '' : esc(A.shortName(k))}</span>${pm(d, k)}</div>`;
        }
        case 'stars': { const st = Math.round(n / 20); return `<div class="lf-sv-r">${who}<span class="lf-sv-stars">${'★'.repeat(st)}<i>${'★'.repeat(5 - st)}</i></span><b>${n}</b>${pm(d, k)}</div>`; }
        case 'tags': { const tags = String(v || '').split(/[,;]/).map(x => x.trim()).filter(Boolean); return `<div class="lf-sv-r txt">${who}<span class="lf-sv-tags">${tags.length ? tags.map(x => `<i>${esc(x)}</i>`).join('') : '<em>—</em>'}</span></div>`; }
        case 'text': return `<div class="lf-sv-r txt">${who}<em>${esc(v || '—')}</em></div>`;
        default: return `<div class="lf-sv-r">${who}<i><u style="width:${n}%"></u></i><b>${v ?? 0}</b>${pm(d, k)}</div>`;
    }
}

function defSheet(d) {
    const e = d || {};
    const user = A.canonName(A.ctx().name1);
    A.openSheet(`${A.icon(d ? 'pencil' : 'plus')} ${d ? 'Править стат' : 'Свой стат'}`, `<div class="lf-field"><label>Название</label><input type="text" data-in="sv-name" placeholder="Ревность" value="${esc(e.name || '')}"></div>
        <div class="lf-field"><label>Что он значит</label><input type="text" data-in="sv-mean" placeholder="0 — спокоен, 100 — сорвётся" value="${esc(e.mean || '')}"></div>
        <div class="lf-field"><label>Вид</label><select data-in="sv-view">${Object.entries(VIEWS).map(([k, l]) => `<option value="${k}"${(d ? viewOf(d) : 'bar') === k ? ' selected' : ''}>${l}${k === 'text' || k === 'tags' ? ' (слова)' : ' (0–100)'}</option>`).join('')}</select></div>
        <div class="lf-field"><label>У кого</label><select data-in="sv-owner"><option value="each"${e.owner === 'each' || !e.owner ? ' selected' : ''}>у каждого главного</option><option value="story"${e.owner === 'story' ? ' selected' : ''}>один на всю историю</option>${[user, ...mains(A)].filter(Boolean).map(n => `<option value="${esc(n)}"${e.owner === n ? ' selected' : ''}>только ${esc(A.shortName(n))}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Значок (эмодзи)</label><input type="text" data-in="sv-icon" maxlength="4" placeholder="💢" value="${esc(e.icon || '')}"></div>
        <div class="lf-field"><label>Цвет</label><div class="lf-chips wrap">${COLORS.map(c => `<label class="lf-sv-col"><input type="radio" name="sv-col" data-in="sv-color" value="${c}"${(e.color || COLORS[0]) === c ? ' checked' : ''}><i style="background:${c}"></i></label>`).join('')}</div></div>
        <button class="lf-btn primary full" data-act="sv-save"${d ? ` data-id="${d.id}"` : ''}>${A.icon('check')} ${d ? 'Сохранить' : 'Завести'}</button>`);
}

/** Кнопка «завести», когда статов ещё нет (для панели трекеров). */
export const statsAddHtml = () => `<button class="lf-btn ghost full" data-act="sv-add">${A.icon('plus')} Свой стат</button>`;

export function statsClick(act, el) {
    if (!act.startsWith('sv-')) return false;
    const s = M();
    const d = s.defs.find(x => x.id === el.dataset.id);
    switch (act) {
        case 'sv-add': defSheet(null); return true;
        case 'sv-edit': if (d) defSheet(d); return true;
        case 'sv-save': {
            const box = el.closest('.lf-sheet') || document;
            const name = str(box.querySelector('[data-in="sv-name"]')?.value, 40);
            if (!name) return true;
            const view = VIEWS[box.querySelector('[data-in="sv-view"]')?.value] ? box.querySelector('[data-in="sv-view"]').value : 'bar';
            const type = view === 'text' || view === 'tags' ? 'text' : 'num';
            const fields = { name, mean: str(box.querySelector('[data-in="sv-mean"]')?.value, 120), type, view, owner: box.querySelector('[data-in="sv-owner"]')?.value || 'each', icon: str(box.querySelector('[data-in="sv-icon"]')?.value, 4), color: box.querySelector('[data-in="sv-color"]:checked')?.value || COLORS[0] };
            if (d) { if (d.type !== type) delete s.vals[d.id]; Object.assign(d, fields); } else { s.defs.push({ id: `s${++s.seq}`, ...fields }); if (s.defs.length > 8) s.defs.length = 8; }
            A.closeSheet();
            break;
        }
        case 'sv-del': if (d) { s.defs = s.defs.filter(x => x !== d); delete s.vals[d.id]; } break;
        case 'sv-up': case 'sv-dn': if (d) { const k = el.dataset.k; s.vals[d.id] = s.vals[d.id] || {}; s.vals[d.id][k] = clamp((Number(s.vals[d.id][k]) || 0) + (act === 'sv-up' ? 5 : -5), 0, 100); } break;
        default: return false;
    }
    delete s.before;
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}
