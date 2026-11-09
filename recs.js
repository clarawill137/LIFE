// Что записал пост. Всё, что Life и Летописец взяли из одного поста, — строкой на запись, по разделам:
// тон, отношения, тайны, вещи, лица, деталь, мизансцена, звонок, календарь, споры, своё, прожитое, память,
// триггеры, раны, вкусы, инициатива, следы, на уме; у твоего поста — «не пропусти» и решение со ставками.
// ✕ у строки — записи будто и не было: связи, тайны, тон, вещи пересчитываются сами, модель её больше не видит.

let A = null;
const providers = [];
export function initRecs(api) { A = api; }

/** Модуль сообщает, что он записал из поста i: fn(i) → [{ id, g, icon, t, del }]. */
export function addRecs(...fns) { for (const f of fns) if (typeof f === 'function') providers.push(f); }

const ORDER = ['Тон', 'Отношения', 'Тайны', 'Вещи', 'Лица', 'Деталь', 'Мизансцена', 'Звонок', 'Ляпы', 'Календарь', 'Споры', 'Своё', 'Прожитое', 'Память', 'Триггеры', 'Раны', 'Вкусы', 'Инициатива', 'Следы', 'На уме', 'Хочет сам', 'Не пропусти', 'Эхо решений'];

export function recsOf(i) {
    const out = [];
    for (const f of providers) {
        try { for (const r of f(i) || []) if (r?.t) out.push(r); } catch (e) { console.warn('[Life] что записал пост', e); }
    }
    const rank = (g) => { const k = ORDER.indexOf(g); return k < 0 ? ORDER.length : k; };
    return out.sort((a, b) => rank(a.g) - rank(b.g));
}

export function recsSheet(i) {
    const esc = (v) => A.esc(v);
    const m = A.chatArr()[i];
    if (!m) return;
    const list = recsOf(i);
    const groups = [];
    for (const r of list) { let g = groups.find(x => x.g === r.g); if (!g) groups.push(g = { g: r.g, rows: [] }); g.rows.push(r); }
    const html = `<div class="lf-hint">${m.is_user ? 'Что Life взяла из твоего поста' : 'Что Life и Летописец взяли из этого ответа'}. ✕ — записи будто и не было: модель её больше не видит, всё, что на ней держится, пересчитается.</div>
        ${groups.length ? groups.map(g => `${A.sec(esc(g.g), String(g.rows.length))}<div class="lf-list lf-recs">${g.rows.map(r => `<div class="lf-row lf-rec">${A.icon(r.icon || 'spark')}<span>${esc(r.t)}</span>${r.del ? `<button class="lf-iconbtn sm" data-act="rec-x" data-mes="${i}" data-id="${esc(r.id)}" title="Убрать">${A.icon('x')}</button>` : ''}</div>`).join('')}</div>`).join('')
            : '<div class="lf-empty small">Из этого поста ничего не записано.</div>'}
        ${!m.is_user ? `<div class="lf-actions"><button class="lf-btn ghost" data-act="chron-rerun" data-mes="${i}">${A.icon('refresh')} Перечитать пост заново</button></div>` : ''}`;
    const show = () => A.openSheet(`${A.icon('spark')} Что записал пост · #${i}`, html);
    if (A.ui?.open) show();
    else { A.openHub?.('scene'); setTimeout(show, 260); }
}

export async function recsClick(act, el) {
    if (act !== 'rec-x') return false;
    const i = Number(el.dataset.mes);
    const r = recsOf(i).find(x => x.id === el.dataset.id);
    if (!r?.del) return true;
    try { await r.del(); } catch (e) { console.warn('[Life] что записал пост', e); A.toast('warning', A.esc(String(e?.message || e)), '✦ Что записал пост'); return true; }
    A.saveMeta();
    A.saveSettings?.();
    try { A.invalidate?.(); } catch { /* */ }
    try { A.updatePrompt?.(); } catch { /* */ }
    A.paintSoon?.();
    recsSheet(i);
    return true;
}
