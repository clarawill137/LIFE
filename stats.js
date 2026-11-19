// Свои статы. Придумай показатель сама — «Ревность», «Подозрения Тони», «Сколько осталось до срыва» —
// напиши, что он значит, и выбери, у кого он: у каждого главного, у одного человека или один на всю историю.
// Летописец ведёт его после каждого поста (число 0–100 или короткий текст); модель получает строку показателей.
// Идея — «Свои статы» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, clamp, mains } from './hudkit.js';

let A = null;
export function initStats(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    if (s.stats.on === undefined) s.stats.on = true;
    return s.stats;
}
const on = () => cfg().on !== false;

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
    const lines = s.defs.map(d => `${d.id} — «${d.name}»: ${d.mean || 'по названию'}; ${d.type === 'num' ? 'число 0-100' : 'короткий текст, 1-6 слов'}; у кого: ${keysOf(d).join(', ')}`);
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
            const v = d.type === 'num' ? clamp(Math.round(Number(row[hit])), 0, 100) : str(String(row[hit] ?? ''), 60);
            if (d.type === 'num' && !Number.isFinite(Number(row[hit]))) continue;
            s.vals[d.id] = s.vals[d.id] || {};
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
    return `${A.sec('Свои статы', String(s.defs.length))}<div class="lf-sv">${s.defs.map(d => `<div class="lf-sv-c"><div class="lf-sv-h"><b>${esc(d.name)}</b><button data-act="sv-del" data-id="${d.id}">${A.icon('x')}</button></div>${d.mean ? `<small>${esc(d.mean)}</small>` : ''}
        ${keysOf(d).map(k => { const v = s.vals[d.id]?.[k]; return d.type === 'num'
        ? `<div class="lf-sv-r">${d.owner === 'story' ? '' : A.ava(k, 'xs')}<i><u style="width:${clamp(v ?? 0, 0, 100)}%"></u></i><b>${v ?? 0}</b><span><button data-act="sv-dn" data-id="${d.id}" data-k="${esc(k)}">−</button><button data-act="sv-up" data-id="${d.id}" data-k="${esc(k)}">+</button></span></div>`
        : `<div class="lf-sv-r txt">${d.owner === 'story' ? '' : A.ava(k, 'xs')}<em>${esc(v || '—')}</em></div>`; }).join('')}</div>`).join('')}</div>
    <button class="lf-btn ghost full" data-act="sv-add">${A.icon('plus')} Свой стат</button>`;
}

/** Кнопка «завести», когда статов ещё нет (для панели трекеров). */
export const statsAddHtml = () => `<button class="lf-btn ghost full" data-act="sv-add">${A.icon('plus')} Свой стат</button>`;

export function statsClick(act, el) {
    if (!act.startsWith('sv-')) return false;
    const s = M();
    const d = s.defs.find(x => x.id === el.dataset.id);
    switch (act) {
        case 'sv-add':
            A.openSheet(`${A.icon('plus')} Свой стат`, `<div class="lf-field"><label>Название</label><input type="text" data-in="sv-name" placeholder="Ревность"></div>
                <div class="lf-field"><label>Что он значит</label><input type="text" data-in="sv-mean" placeholder="0 — спокоен, 100 — сорвётся"></div>
                <div class="lf-field"><label>Вид</label><select data-in="sv-type"><option value="num">шкала 0–100</option><option value="text">короткий текст</option></select></div>
                <div class="lf-field"><label>У кого</label><select data-in="sv-owner"><option value="each">у каждого главного</option><option value="story">один на всю историю</option>${everyone().map(n => `<option value="${esc(n)}">только ${esc(A.shortName(n))}</option>`).join('')}</select></div>
                <button class="lf-btn primary full" data-act="sv-save">${A.icon('check')} Завести</button>`);
            return true;
        case 'sv-save': {
            const box = el.closest('.lf-sheet') || document;
            const name = str(box.querySelector('[data-in="sv-name"]')?.value, 40);
            if (!name) return true;
            s.defs.push({ id: `s${++s.seq}`, name, mean: str(box.querySelector('[data-in="sv-mean"]')?.value, 120), type: box.querySelector('[data-in="sv-type"]')?.value === 'text' ? 'text' : 'num', owner: box.querySelector('[data-in="sv-owner"]')?.value || 'each' });
            if (s.defs.length > 8) s.defs.length = 8;
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
