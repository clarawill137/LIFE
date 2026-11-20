// Семья. Родословное дерево истории: кто чей родитель, супруг, брат или сестра — поколениями сверху вниз.
// Собирается по карточкам и людям одним тапом, правится руками. Мир → Семья. Модели отдельно не уходит:
// родство и так в карточках, это карта для тебя. Идея — «Генеалогическое дерево» TavernOS HUD (alewwi).

import { str, arr, mains } from './hudkit.js';

let A = null;
export function initKin(api) { A = api; }
const esc = (v) => A.esc(v);

const REL = { parent: 'родитель', spouse: 'супруги', sibling: 'брат/сестра' };

function M() {
    const cm = A.chatMeta();
    if (!cm.kin || typeof cm.kin !== 'object') cm.kin = {};
    if (!Array.isArray(cm.kin.links)) cm.kin.links = [];   // { a, b, rel, note } — parent: a родитель b
    return cm.kin;
}
const same = (x, y) => A.sameName(x, y);
const has = (a, b, rel) => M().links.some(l => l.rel === rel && ((same(l.a, a) && same(l.b, b)) || (rel !== 'parent' && same(l.a, b) && same(l.b, a))));

function add(a, b, rel, note = '') {
    a = A.canonName(str(a, 50)); b = A.canonName(str(b, 50));
    if (!a || !b || same(a, b) || !REL[rel] || has(a, b, rel)) return false;
    M().links.push({ a, b, rel, note: str(note, 60) });
    return true;
}

async function collect() {
    const user = A.canonName(A.ctx().name1);
    const cards = mains(A).map(n => { const c = A.cardOf(n); return `${n}: ${A.cut([c?.description, c?.personality].filter(Boolean).join(' '), 1200)}`; });
    let persona = '';
    try { const c = A.ctx(); persona = String(c.powerUserSettings?.persona_descriptions?.[c.chatMetadata?.persona || '']?.description || c.powerUserSettings?.persona_description || '').slice(0, 1500); } catch { /* */ }
    let people = '';
    try { people = arr(A.peopleList?.()).slice(0, 50).map(p => `${p.name}${p.role ? ` — ${p.role}` : ''}${p.group ? ` (${p.group})` : ''}`).join('; '); } catch { /* */ }
    const have = M().links.map(l => `${l.a} ${l.rel} ${l.b}`).join('; ');
    const sys = `Ты помощник автора ролевой истории. Выпиши РОДСТВО между людьми истории — только то, что прямо следует из описаний. Ответ — строго один JSON по-русски: {"kin":[{"a":"имя","b":"имя","rel":"parent|spouse|sibling","note":"приёмный, покойный, бывшие — 1-3 слова или пусто"}]}. parent — a родитель b (включая приёмных и опекунов); spouse — муж и жена, жених и невеста; sibling — братья и сёстры. Имена — как в списках. Дружбу, команду и романы без брака не пиши. Не уверен — не пиши.`;
    const usr = `${user}: ${persona || '(описания нет)'}\n${cards.join('\n')}${people ? `\nЛюди вокруг: ${people}` : ''}${have ? `\nУже записано (не повторяй): ${have}` : ''}`;
    const j = await (A.askFillJson || A.askJson)([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1200, { check: (x) => Array.isArray(x?.kin), what: 'Семья' }, { acts: false });
    let n = 0;
    for (const r of arr(j.kin).slice(0, 40)) if (add(r?.a, r?.b, str(r?.rel), r?.note)) n++;
    A.saveMeta();
    return n;
}

/** Поколения: ребёнок ниже родителя, супруги и братья — на одной строке. */
function layout() {
    const links = M().links;
    const gen = new Map();
    for (const l of links) { if (!gen.has(l.a)) gen.set(l.a, 0); if (!gen.has(l.b)) gen.set(l.b, 0); }
    for (let k = 0; k < 24; k++) {
        let moved = false;
        for (const l of links) {
            const ga = gen.get(l.a), gb = gen.get(l.b);
            if (l.rel === 'parent') { if (gb < ga + 1) { gen.set(l.b, ga + 1); moved = true; } }
            else if (ga !== gb) { const m = Math.max(ga, gb); gen.set(l.a, m); gen.set(l.b, m); moved = true; }
        }
        if (!moved) break;
    }
    const rows = [];
    for (const [n, g] of gen) (rows[g] = rows[g] || []).push(n);
    // супруги рядом
    return rows.filter(Boolean).map(row => {
        const out = [];
        for (const n of row) {
            if (out.includes(n)) continue;
            out.push(n);
            for (const l of links) if (l.rel === 'spouse' && (same(l.a, n) || same(l.b, n))) { const o = same(l.a, n) ? l.b : l.a; if (row.includes(o) && !out.includes(o)) out.push(o); }
        }
        return out;
    });
}

/** Мир → Семья. */
export function kinHtml() {
    const s = M();
    const tools = `<div class="lf-actions tight"><button class="lf-btn" data-act="kin-collect">${A.icon('sparkles')} ${s.links.length ? 'Дособрать по карточкам' : 'Собрать по карточкам'}</button><button class="lf-btn ghost" data-act="kin-add">${A.icon('plus')} Связь</button></div>`;
    if (!s.links.length) return `${A.sec('Семья')}<div class="lf-hint">Родословное дерево: кто чей родитель, супруг, брат или сестра. Соберу по карточкам и людям — поправишь руками.</div>${tools}`;
    const rows = layout();
    const spouse = (n) => s.links.filter(l => l.rel === 'spouse' && (same(l.a, n) || same(l.b, n))).map(l => (same(l.a, n) ? l.b : l.a));
    const kids = (n) => s.links.filter(l => l.rel === 'parent' && same(l.a, n)).map(l => l.b);
    const note = (n) => s.links.filter(l => l.note && (same(l.b, n) || (l.rel !== 'parent' && same(l.a, n)))).map(l => l.note)[0] || '';
    return `${A.sec('Семья', `${rows.length} ${A.plural(rows.length, 'поколение', 'поколения', 'поколений')}`)}
    <div class="lf-kin">${rows.map((row, g) => `<div class="lf-kin-g"><small>${g === 0 ? 'старшие' : g === rows.length - 1 && g > 0 ? 'младшие' : ''}</small><div class="lf-kin-r">${row.map(n => `<button class="lf-kin-p" data-act="person" data-name="${esc(n)}">${A.ava(n, 'md')}<b>${esc(A.shortName(n))}</b>${spouse(n).length ? `<i>⚭ ${esc(spouse(n).map(A.shortName).join(', '))}</i>` : ''}${kids(n).length ? `<i>↓ ${esc(kids(n).map(A.shortName).join(', '))}</i>` : ''}${note(n) ? `<em>${esc(note(n))}</em>` : ''}</button>`).join('')}</div></div>`).join('')}</div>
    <details class="lf-more"><summary>Все связи — ${s.links.length}</summary><div class="lf-kin-l">${s.links.map((l, k) => `<div><span>${esc(A.shortName(l.a))} <i>${l.rel === 'parent' ? '— родитель →' : l.rel === 'spouse' ? '⚭' : '— брат/сестра —'}</i> ${esc(A.shortName(l.b))}${l.note ? ` <em>(${esc(l.note)})</em>` : ''}</span><button data-act="kin-del" data-n="${k}">${A.icon('x')}</button></div>`).join('')}</div></details>
    ${tools}`;
}

export async function kinClick(act, el) {
    if (!act.startsWith('kin-')) return false;
    const s = M();
    switch (act) {
        case 'kin-collect': { const n = await A.withBusy(el, () => collect(), 'Собираю…'); if (n === 0) A.toast('info', 'Новых родственных связей не нашлось.', '✦ Семья'); break; }
        case 'kin-del': s.links.splice(Number(el.dataset.n), 1); break;
        case 'kin-add': {
            const names = [...new Set([A.canonName(A.ctx().name1), ...mains(A), ...s.links.flatMap(l => [l.a, l.b])].filter(Boolean))];
            const opts = names.map(n => `<option value="${esc(n)}">`).join('');
            A.openSheet(`${A.icon('plus')} Родственная связь`, `<datalist id="lf-kin-names">${opts}</datalist>
                <div class="lf-field"><label>Кто</label><input type="text" list="lf-kin-names" data-in="kin-a" placeholder="Тони"></div>
                <div class="lf-field"><label>Кем приходится</label><select data-in="kin-rel"><option value="parent">родитель →</option><option value="spouse">супруг(а)</option><option value="sibling">брат / сестра</option></select></div>
                <div class="lf-field"><label>Кому</label><input type="text" list="lf-kin-names" data-in="kin-b" placeholder="Хеди"></div>
                <div class="lf-field"><label>Пометка</label><input type="text" data-in="kin-note" placeholder="приёмный, покойная…"></div>
                <button class="lf-btn primary full" data-act="kin-save">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'kin-save': {
            const box = el.closest('.lf-sheet') || document;
            const v = (q) => box.querySelector(`[data-in="${q}"]`)?.value?.trim() || '';
            if (!add(v('kin-a'), v('kin-b'), v('kin-rel'), v('kin-note'))) return true;
            A.closeSheet();
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.render();
    return true;
}
