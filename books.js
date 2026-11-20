// Библиотека лорбуков. Стоковый список ST — одна длинная выпадашка, а редактор записи — простыня из сорока полей,
// где легко вставить не туда. Здесь: папки любой глубины (хранятся в настройках Life — сами лорбуки не трогаются),
// вид списком или плитками, поиск; у книги — записи с выключателями; у записи — редактор в боковой панели:
// на виду название, когда срабатывает, ключи, текст, куда вставлять, порядок и вероятность, остальное — в шторке.
//
// Главное правило сохранения: перед каждой записью книга берётся с СЕРВЕРА заново, в ней меняется только то, что
// правили, и она уходит обратно. Иначе окно, открытое час назад, затирало бы правки, которые приехали на сервер мимо него.
// Если сама запись на сервере успела измениться — спросим, чью версию оставить. Метки ядра «Священный таймлайн»
// (эпохи, даты, тайна и кто знает — поле gc) и всё, чего редактор не показывает, сохраняются как были.

import { icon } from './icons.js';
import { openWin, winRender, openSide, closeSide, sideRender, sideBox, winBox, winMod, sure, winOpen, askText } from './win.js';
import { activeBooks } from './lore.js';

let A = null;
export function initBooks(api) { A = api; winMod({ pre: 'lb-', click, change, input }); }
/** Модуль поднят (для соседей, которые сохраняют записи через commitEntry). */
export const booksReady = () => !!A;
const esc = (v) => A.esc(v);
/** Метка ядра «Священный таймлайн» у записи: что именно на ней стоит — эпохи, даты, тайна. */
function gcTag(e) {
    const g = e?.gc;
    if (!g || typeof g !== 'object') return '';
    const eras = Array.isArray(g.eras) ? g.eras.filter(Boolean) : [];
    const bits = [eras.length ? (eras.length <= 2 ? eras.join(', ') : `эпох: ${eras.length}`) : '', !eras.length && (g.from || g.to) ? 'даты' : '', g.secret ? 'тайна' : ''].filter(Boolean);
    return `<em class="gc">${esc(bits.join(' · ') || 'метки ядра')}</em>`;
}
const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function WI() { for (const p of ['/scripts/world-info.js', '../../../world-info.js']) { try { const m = await import(p); if (m?.loadWorldInfo) return m; } catch { /* следующий путь */ } } return null; }

function cfg() {
    const s = A.settings();
    if (!s.books || typeof s.books !== 'object') s.books = {};
    const c = s.books;
    if (!Array.isArray(c.folders)) c.folders = [];          // { id, name, parent }
    if (!c.at || typeof c.at !== 'object') c.at = {};       // книга → папка
    if (c.view !== 'grid') c.view = 'list';
    return c;
}

const ui = { folder: '', q: '', book: '', eq: '', filter: 'all', names: [], active: [], global: [], counts: {}, data: null, err: '', entry: null, moving: false };

// ───────────── папки (чистая логика — проверяется тестами) ─────────────

export const folderPath = (folders, id) => { const out = []; const seen = new Set(); for (let f = folders.find(x => x.id === id); f && !seen.has(f.id); f = folders.find(x => x.id === f.parent)) { seen.add(f.id); out.unshift(f); } return out; };
export const folderKids = (folders, id) => folders.filter(f => (f.parent || '') === (id || '')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
/** Все папки внутри (и сама): чтобы не дать вложить папку в собственную внучку. */
export function folderTree(folders, id) { const out = [id]; for (let k = 0; k < out.length; k++) for (const f of folders) if ((f.parent || '') === out[k] && !out.includes(f.id)) out.push(f.id); return out; }
/** Книги папки; у корня — те, что ни в одной (или в папке, которой уже нет). */
export function booksIn(names, at, folders, id) { const live = new Set(folders.map(f => f.id)); return names.filter(n => (live.has(at[n]) ? at[n] : '') === (id || '')); }
/** Сколько книг в папке вместе с вложенными. */
export const folderCount = (names, at, folders, id) => { const tree = new Set(folderTree(folders, id)); return names.filter(n => tree.has(at[n])).length; };
/** Предложить папки по началу названия («2014 · Город», «2014 · Люди»): [{ name, books }] — только где книг две и больше. */
export function suggestFolders(names) {
    const by = new Map();
    for (const n of names) { const m = /^(.{2,24}?)\s*(?:·|—|–| - |:)\s+\S/.exec(n); if (!m) continue; const k = m[1].trim(); by.set(k, [...(by.get(k) || []), n]); }
    return [...by.entries()].filter(([, v]) => v.length >= 2).map(([name, books]) => ({ name, books })).sort((a, b) => b.books.length - a.books.length);
}

// ───────────── сервер ─────────────

const headers = () => { try { return A.ctx().getRequestHeaders(); } catch { return { 'Content-Type': 'application/json' }; } };

/** Книга прямо с сервера, мимо кэша таверны. */
async function fresh(name) {
    const r = await fetch('/api/worldinfo/get', { method: 'POST', headers: headers(), body: JSON.stringify({ name }), cache: 'no-cache' });
    if (!r.ok) throw new Error(`сервер не отдал лорбук «${name}» (${r.status})`);
    const data = await r.json();
    if (!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') throw new Error(`лорбук «${name}» пришёл пустым — не сохраняю поверх`);
    return data;
}

export const entrySig = (e) => A.hash(JSON.stringify(e ?? null));

/**
 * Применить правку к записи на свежей книге. patch — { поле: значение } (поля записи ST), del — убрать запись.
 * baseSig — какой запись была, когда её открыли: изменилась на сервере — вернём { conflict } и ничего не запишем
 * (force — записать всё равно). Возвращает { ok, entry, data } или { conflict: записьССервера }.
 */
export async function commitEntry(W, name, uid, patch, { baseSig = '', force = false, del = false, freshFn = fresh } = {}) {
    const data = await freshFn(name);
    const e = data.entries[uid];
    if (!e) throw new Error('этой записи на сервере уже нет — обнови список');
    if (baseSig && !force && entrySig(e) !== baseSig) return { conflict: e };
    if (del) {
        delete data.entries[uid];
        try { W.deleteWIOriginalDataValue?.(data, uid); } catch { /* */ }
    } else {
        for (const [k, v] of Object.entries(patch || {})) {
            if (v === undefined) { delete e[k]; continue; }   // «убрать поле» (метки ядра, когда их не осталось)
            e[k] = v;
            // книги из карточек держат вторую копию записей (originalData) — её правит та же функция, что у редактора ST
            const key = W.originalWIDataKeyMap?.[k];
            if (key) { try { W.setWIOriginalDataValue?.(data, e.uid, key, v); } catch { /* */ } }
        }
        if ('disable' in (patch || {})) { try { W.setWIOriginalDataValue?.(data, e.uid, 'enabled', !e.disable); } catch { /* */ } }
    }
    await W.saveWorldInfo(name, data, true);
    try { W.reloadEditor?.(name); } catch { /* стоковый редактор закрыт */ }
    return { ok: true, entry: del ? null : e, data };
}

async function reloadNames() {
    const W = await WI();
    if (!W) { ui.err = 'Эта версия ST не отдаёт лорбуки расширениям.'; return null; }
    ui.err = '';
    ui.names = [...(W.world_names || [])].sort((a, b) => a.localeCompare(b, 'ru'));
    ui.global = [...(W.selected_world_info || [])];
    try { ui.active = A.hasChat?.() ? (await activeBooks(W)).books : []; } catch { ui.active = []; }
    return W;
}

async function openBook(name) {
    ui.book = name; ui.eq = ''; ui.filter = 'all'; ui.data = null; ui.entry = null;
    closeSide();
    winRender();
    try { ui.data = await fresh(name); ui.counts[name] = Object.keys(ui.data.entries).length; } catch (e) { ui.err = String(e?.message || e); }
    if (ui.book === name) winRender();
}

// ───────────── вид: библиотека ─────────────

const isMemory = (e) => !!e?.stmemorybooks || /^\s*\d{1,4}\s*[-–—.:]\s*\S/.test(e?.comment || '');
const POS = [[0, 'до карточки'], [1, 'после карточки'], [5, 'до примеров'], [6, 'после примеров'], [2, 'над заметкой автора'], [3, 'под заметкой автора'], [4, 'в чат, на глубину'], [7, 'в свой слот (outlet)']];
const LOGIC = [[0, 'и любой из них'], [3, 'и все они'], [2, 'и ни одного из них'], [1, 'и не все они']];
const ROLE = [[0, 'системная'], [1, 'от игрока'], [2, 'от персонажа']];

function libraryHtml() {
    const c = cfg();
    if (ui.err && !ui.names.length) return `<div class="lf-empty small">${esc(ui.err)}</div>`;
    const q = A.norm(ui.q);
    const badge = (n) => `${ui.active.includes(n) ? '<i class="lw-b on" title="подключён к этому чату">в чате</i>' : ''}${ui.global.includes(n) ? '<i class="lw-b" title="глобальный: во всех чатах">везде</i>' : ''}`;
    const bookCard = (n) => `<button class="lw-book" data-act="lb-open" data-name="${esc(n)}">${c.view === 'grid' ? `<span class="lw-book-l">${esc(n.trim().charAt(0).toUpperCase())}</span>` : icon('book')}<span class="lw-book-t"><b>${esc(n)}</b><small>${ui.counts[n] !== undefined ? `${ui.counts[n]} ${A.plural(ui.counts[n], 'запись', 'записи', 'записей')}` : ''}${badge(n)}</small></span></button>`;
    const tools = `<div class="lw-tools"><input type="search" data-in="lb-q" placeholder="Найти лорбук" value="${esc(ui.q)}">
        <button class="lf-chip${c.view === 'grid' ? ' on' : ''}" data-act="lb-view" title="список или плитки">${icon(c.view === 'grid' ? 'blocks' : 'menu')}</button></div>`;
    if (q) {
        const hit = ui.names.filter(n => A.norm(n).includes(q));
        return `${tools}<div class="lw-books ${c.view}">${hit.map(bookCard).join('') || '<div class="lf-empty small">Ничего не нашлось.</div>'}</div>`;
    }
    const path = folderPath(c.folders, ui.folder);
    if (ui.folder && !path.length) ui.folder = '';
    const crumbs = `<div class="lw-crumbs"><button data-act="lb-folder" data-id="">${icon('folder')} Все</button>${path.map(f => `<i>›</i><button data-act="lb-folder" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>`;
    const kids = folderKids(c.folders, ui.folder);
    const books = booksIn(ui.names, c.at, c.folders, ui.folder);
    const cur = path[path.length - 1];
    const sug = !ui.folder && !c.folders.length ? suggestFolders(ui.names).slice(0, 8) : [];
    return `${tools}${crumbs}
    ${kids.length ? `<div class="lw-folders">${kids.map(f => `<button class="lw-folder" data-act="lb-folder" data-id="${esc(f.id)}">${icon('folder')}<b>${esc(f.name)}</b><small>${folderCount(ui.names, c.at, c.folders, f.id)}</small></button>`).join('')}</div>` : ''}
    <div class="lw-books ${c.view}">${books.map(bookCard).join('') || (kids.length ? '' : `<div class="lf-empty small">${ui.folder ? 'В папке пусто — открой лорбук и выбери ему эту папку.' : 'Лорбуков нет.'}</div>`)}</div>
    <div class="lf-chips wrap"><button class="lf-chip" data-act="lb-fnew">${icon('plus')} Папка${cur ? ` в «${esc(A.cut(cur.name, 16))}»` : ''}</button><button class="lf-chip" data-act="lb-new">${icon('plus')} Лорбук</button>
        ${cur ? `<button class="lf-chip" data-act="lb-fren" data-id="${esc(cur.id)}">${icon('pencil')} Переименовать папку</button><button class="lf-chip" data-act="lb-fdel" data-id="${esc(cur.id)}">${icon('trash')} Убрать папку</button>` : ''}</div>
    ${sug.length ? `${A.sec('Папки по названию', 'тап — создать')}<div class="lf-chips wrap">${sug.map(g => `<button class="lf-chip" data-act="lb-sug" data-name="${esc(g.name)}">${icon('folder')} ${esc(g.name)} · ${g.books.length}</button>`).join('')}</div>` : ''}
    <div class="lf-hint">Папки живут в настройках Life: сами лорбуки и их подключения не меняются. Убрать папку — книги вернутся на уровень выше.</div>`;
}

// ───────────── вид: книга ─────────────

function bookHtml() {
    const c = cfg();
    const n = ui.book;
    const back = `<div class="lw-crumbs"><button data-act="lb-back">${icon('left')} К библиотеке</button></div>`;
    if (!ui.data) return `${back}<div class="lf-empty small">${ui.err ? esc(ui.err) : 'Загружаю…'}</div>`;
    const all = Object.values(ui.data.entries).sort((a, b) => (a.displayIndex ?? a.uid) - (b.displayIndex ?? b.uid));
    const q = A.norm(ui.eq);
    const pass = { all: () => true, on: (e) => !e.disable, const: (e) => !!e.constant && !e.disable, off: (e) => !!e.disable, mem: isMemory, gc: (e) => !!e.gc }[ui.filter] || (() => true);
    const shown = all.filter(pass).filter(e => !q || A.norm(`${e.comment} ${(e.key || []).join(' ')} ${e.content}`).includes(q));
    const cnt = (f) => all.filter(f).length;
    const chips = [['all', `все ${all.length}`], ['on', `включены ${cnt(e => !e.disable)}`], ['const', `постоянные ${cnt(e => e.constant && !e.disable)}`], ['off', `выключены ${cnt(e => e.disable)}`],
        ...(cnt(isMemory) ? [['mem', `память ${cnt(isMemory)}`]] : []), ...(cnt(e => e.gc) ? [['gc', `с метками эпох ${cnt(e => e.gc)}`]] : [])];
    const folders = c.folders.map(f => ({ f, label: folderPath(c.folders, f.id).map(x => x.name).join(' › ') })).sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    const globalOk = !n.includes(',');   // команда /world делит имена по запятой
    const mark = (e) => (e.disable ? '<i class="lw-dot off" title="выключена"></i>' : e.constant ? '<i class="lw-dot const" title="постоянная"></i>' : e.vectorized ? '<i class="lw-dot vec" title="по смыслу (векторы)"></i>' : '<i class="lw-dot" title="по ключам"></i>');
    return `${back}
    <div class="lw-bookhead"><h2>${esc(n)}</h2><small>${all.length} ${A.plural(all.length, 'запись', 'записи', 'записей')}${ui.active.includes(n) ? ' · подключён к этому чату' : ''}${ui.global.includes(n) ? ' · глобальный' : ''}</small></div>
    <div class="lf-field row"><label>Папка</label><select data-in="lb-move"><option value="">— без папки —</option>${folders.map(({ f, label }) => `<option value="${esc(f.id)}"${c.at[n] === f.id ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
    <div class="lw-tools"><input type="search" data-in="lb-eq" placeholder="Название, ключи, текст" value="${esc(ui.eq)}"><button class="lf-chip" data-act="lb-enew">${icon('plus')} Запись</button></div>
    <div class="lf-chips">${chips.map(([k, l]) => `<button class="lf-chip${ui.filter === k ? ' on' : ''}" data-act="lb-filter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="lw-entries">${shown.map(e => `<div class="lw-entry${e.disable ? ' off' : ''}${ui.entry?.uid === e.uid ? ' cur' : ''}">
        <button class="lw-entry-m" data-act="lb-edit" data-uid="${e.uid}">${mark(e)}<span><b>${esc(e.comment || '(без названия)')}${isMemory(e) ? '<em>память</em>' : ''}${gcTag(e)}</b><small>${esc(A.cut((e.key || []).join(', ') || (e.constant ? 'всегда в промпте' : 'без ключей'), 90))}</small></span></button>
        <label class="lw-sw" title="включена"><input type="checkbox" data-in="lb-on" data-uid="${e.uid}"${e.disable ? '' : ' checked'}><i></i></label></div>`).join('') || '<div class="lf-empty small">Ничего не нашлось.</div>'}</div>
    <div class="lf-chips wrap">${globalOk ? `<button class="lf-chip${ui.global.includes(n) ? ' on' : ''}" data-act="lb-global">${icon('globe')} ${ui.global.includes(n) ? 'глобальный — снять' : 'сделать глобальным'}</button>` : ''}
        <button class="lf-chip" data-act="lb-reload">${icon('refresh')} С сервера заново</button><button class="lf-chip" data-act="lb-del">${icon('trash')} Удалить лорбук</button></div>
    <div class="lf-hint">Каждое сохранение берёт книгу с сервера заново и меняет в ней одну запись — правки, приехавшие на сервер мимо этого окна, не затираются. Переименовать книгу — в стоковом окне ST: там же перепривязываются карточки и чаты.</div>`;
}

const mainHtml = () => (ui.book ? bookHtml() : libraryHtml());

// ───────────── вид: запись ─────────────

const gcText = (g) => { try { return JSON.stringify(g, null, 1); } catch { return ''; } };
const strategy = (e) => (e.disable ? 'off' : e.constant ? 'const' : e.vectorized ? 'vec' : 'keys');

function entryHtml() {
    const d = ui.entry;
    if (!d) return '';
    const e = d.e;
    const st = strategy(e);
    const num = (k, label, v, ph = '') => `<div class="lf-field half"><label>${label}</label><input type="number" data-in="lb-${k}" value="${v ?? ''}" placeholder="${ph}"></div>`;
    const sel = (k, list, v) => `<select data-in="lb-${k}">${list.map(([id, l]) => `<option value="${id}"${Number(v ?? 0) === id ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    const chk = (k, label, v) => `<label class="lf-switch"><input type="checkbox" data-in="lb-${k}"${v ? ' checked' : ''}><span></span>${label}</label>`;
    const tri = (k, label, v) => `<div class="lf-field half"><label>${label}</label><select data-in="lb-${k}"><option value=""${v === null || v === undefined ? ' selected' : ''}>как в таверне</option><option value="1"${v === true ? ' selected' : ''}>да</option><option value="0"${v === false ? ' selected' : ''}>нет</option></select></div>`;
    const g = e.gc && typeof e.gc === 'object' ? e.gc : null;
    return `${d.conflict ? `<div class="lw-warn">${icon('flag')} Пока запись была открыта, она изменилась на сервере (её правили в другом окне или правка приехала на сервер мимо него).
            <div class="lf-actions"><button class="lf-btn" data-act="lb-theirs">Взять с сервера</button><button class="lf-btn primary" data-act="lb-mine">Сохранить моё поверх</button></div></div>` : ''}
        <div class="lf-field"><label>Название</label><input type="text" data-in="lb-comment" value="${esc(e.comment || '')}"></div>
        <div class="lf-field"><label>Когда срабатывает</label><div class="lf-seg lw-seg">${[['keys', 'по ключам'], ['const', 'всегда'], ...(st === 'vec' ? [['vec', 'по смыслу']] : []), ['off', 'выключена']].map(([k, l]) => `<button class="${st === k ? 'on' : ''}" data-act="lb-strat" data-v="${k}">${l}</button>`).join('')}</div><input type="hidden" data-in="lb-strat" value="${st}"></div>
        <div class="lf-field"><label>Ключи <small>через запятую; /регулярка/ — как есть</small></label><textarea rows="2" data-in="lb-key">${esc((e.key || []).join(', '))}</textarea></div>
        <div class="lf-field"><label>Дополнительные ключи</label><div class="lf-inline">${sel('selectiveLogic', LOGIC, e.selectiveLogic)}</div><textarea rows="2" data-in="lb-keysecondary" placeholder="пусто — хватит основных">${esc((e.keysecondary || []).join(', '))}</textarea></div>
        <div class="lf-field"><label>Содержимое <small data-out="lb-len">${String(e.content || '').length} зн.</small></label><textarea rows="12" class="lw-content" data-in="lb-content">${esc(e.content || '')}</textarea></div>
        <div class="lw-row"><div class="lf-field"><label>Куда вставлять</label>${sel('position', POS, e.position)}</div>${num('order', 'Порядок', e.order)}${num('probability', 'Вероятность, %', e.probability ?? 100)}</div>
        <details class="lw-more"${d.more ? ' open' : ''}><summary data-act="lb-more">Тонкие настройки</summary>
            <div class="lw-row">${num('depth', 'Глубина (для «в чат»)', e.depth)}<div class="lf-field half"><label>От чьего имени</label>${sel('role', ROLE, e.role)}</div>${num('scanDepth', 'Сколько постов смотреть', e.scanDepth, 'как в таверне')}</div>
            <div class="lw-row">${num('sticky', 'Держится постов', e.sticky, '—')}${num('cooldown', 'Отдыхает постов', e.cooldown, '—')}${num('delay', 'Не раньше поста', e.delay, '—')}</div>
            <div class="lw-row">${tri('caseSensitive', 'Регистр важен', e.caseSensitive)}${tri('matchWholeWords', 'Слово целиком', e.matchWholeWords)}<div class="lf-field half"><label>Группа</label><input type="text" data-in="lb-group" value="${esc(e.group || '')}"></div></div>
            ${chk('useProbability', 'Учитывать вероятность', e.useProbability !== false)}
            ${chk('excludeRecursion', 'Не срабатывать от других записей', e.excludeRecursion)}
            ${chk('preventRecursion', 'Не будить другие записи', e.preventRecursion)}
            ${chk('ignoreBudget', 'Не считать в бюджет лорбуков', e.ignoreBudget)}
            ${e.outletName || Number(e.position) === 7 ? `<div class="lf-field"><label>Имя слота (outlet)</label><input type="text" data-in="lb-outletName" value="${esc(e.outletName || '')}"></div>` : ''}
            <div class="lf-hint">Остальные поля записи (их тут нет) сохраняются как были.</div>
        </details>
        <details class="lw-more"${d.gcOpen ? ' open' : ''}><summary data-act="lb-gcmore">Эпоха и тайна <small>метки ядра «Священный таймлайн»${g ? '' : ' — нет'}</small></summary>
            <div class="lf-field"><label>Только в эпохах <small>id через запятую; пусто — во всех</small></label><input type="text" data-in="lb-gc-eras" value="${esc(Array.isArray(g?.eras) ? g.eras.join(', ') : '')}"></div>
            <div class="lw-row"><div class="lf-field half"><label>Действует с <small>ГГГГ-ММ[-ДД]</small></label><input type="text" data-in="lb-gc-from" value="${esc(g?.from ?? '')}"></div><div class="lf-field half"><label>по</label><input type="text" data-in="lb-gc-to" value="${esc(g?.to ?? '')}"></div></div>
            ${chk('gc-secret', 'Тайна: только тем, кто её знает', !!g?.secret)}
            ${g ? `<div class="lf-field"><label>Метки целиком <small>только смотреть: карту знания (knows) и остальное ведут скрипты ядра</small></label><pre class="lw-pre">${esc(gcText(g))}</pre></div>` : ''}
            <div class="lf-hint">Здесь правятся только эпохи, даты и флаг тайны. Кто знает тайну (knows), личное время и вид записи остаются как были.</div>
        </details>
        <div class="lf-actions"><button class="lf-btn primary" data-act="lb-save">${icon('check')} Сохранить</button><button class="lf-btn ghost" data-act="lb-dup">${icon('layers')} Копия</button><button class="lf-btn ghost" data-act="lb-edel">${icon('trash')} Удалить</button></div>`;
}

// ───────────── чтение формы ─────────────

/** Ключи из поля: через запятую или с новой строки; /регулярка/флаги — целиком, запятые внутри неё не делят. */
export function parseKeys(t) {
    const s = String(t || '').replace(/\r?\n/g, ',');
    const out = [];
    let i = 0;
    while (i < s.length) {
        while (i < s.length && /[\s,]/.test(s[i])) i++;
        if (i >= s.length) break;
        if (s[i] === '/') {
            let j = i + 1, closed = false;
            for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '/') { closed = true; break; } }
            if (closed) {
                let k = j + 1;
                while (k < s.length && /[a-z]/i.test(s[k])) k++;
                if (/^\s*(,|$)/.test(s.slice(k))) { out.push(s.slice(i, k)); i = k; continue; }
            }
        }
        let j = s.indexOf(',', i);
        if (j < 0) j = s.length;
        const w = s.slice(i, j).trim();
        if (w) out.push(w);
        i = j + 1;
    }
    return out;
}
const splitKeys = parseKeys;

const numOr = (v, d) => { const s = String(v ?? '').trim(); if (!s) return d; const n = Number(s); return Number.isFinite(n) ? n : d; };
const triOf = (v) => (v === '1' ? true : v === '0' ? false : null);

/** Правка из формы: только поля, которые в ней есть; чего в форме нет — в патч не попадает. */
function readEntry(box, e) {
    const has = (k) => !!box.querySelector(`[data-in="lb-${k}"]`);
    const v = (k) => box.querySelector(`[data-in="lb-${k}"]`)?.value ?? '';
    const on = (k) => !!box.querySelector(`[data-in="lb-${k}"]`)?.checked;
    const st = v('strat') || strategy(e);
    const p = {
        comment: String(v('comment')).trim(), key: splitKeys(v('key')), keysecondary: splitKeys(v('keysecondary')), content: String(v('content')),
        selectiveLogic: numOr(v('selectiveLogic'), 0), position: numOr(v('position'), 0), order: numOr(v('order'), 100), probability: Math.max(0, Math.min(100, numOr(v('probability'), 100))),
        disable: st === 'off', constant: st === 'const' ? true : st === 'off' ? !!e.constant : false,
    };
    if (st === 'keys') p.vectorized = false;
    if (st === 'vec') { p.vectorized = true; p.constant = false; }
    if (has('depth')) Object.assign(p, {
        depth: numOr(v('depth'), e.depth ?? 4), role: numOr(v('role'), 0), scanDepth: numOr(v('scanDepth'), null), sticky: numOr(v('sticky'), null), cooldown: numOr(v('cooldown'), null), delay: numOr(v('delay'), null),
        caseSensitive: triOf(v('caseSensitive')), matchWholeWords: triOf(v('matchWholeWords')), group: String(v('group')).trim(),
        useProbability: on('useProbability'), excludeRecursion: on('excludeRecursion'), preventRecursion: on('preventRecursion'), ignoreBudget: on('ignoreBudget'),
    });
    if (has('outletName')) p.outletName = String(v('outletName')).trim();
    // метки ядра: меняем только три поля, остальное в gc — как было; пустые метки не заводим
    if (has('gc-eras')) {
        const g = e.gc && typeof e.gc === 'object' ? { ...e.gc } : {};
        const eras = String(v('gc-eras')).split(',').map(x => x.trim()).filter(Boolean);
        if (eras.length) g.eras = eras; else delete g.eras;
        for (const k of ['from', 'to']) { const t = String(v(`gc-${k}`)).trim(); if (t) g[k] = t; else delete g[k]; }
        if (on('gc-secret')) g.secret = true; else delete g.secret;
        if (Object.keys(g).length || e.gc) p.gc = Object.keys(g).length ? g : undefined;
    }
    // в патч — только то, что правда изменилось: меньше трогаем — меньше шансов что-то затереть
    const out = {};
    for (const [k, val2] of Object.entries(p)) if (JSON.stringify(val2 ?? null) !== JSON.stringify(e[k] ?? null)) out[k] = val2;
    return out;
}
export const readEntryForm = readEntry;

// ───────────── клики ─────────────

function showEntry(e, extra = {}) {
    ui.entry = { uid: e.uid, e, sig: entrySig(e), more: false, gcOpen: false, ...extra };
    openSide({ title: `${icon('pencil')} ${esc(A.cut(e.comment || 'Запись', 40))}`, html: entryHtml, onClose: () => { ui.entry = null; if (winOpen('books')) winRender(); } });
    winRender();
}

async function saveEntry(force = false) {
    const d = ui.entry;
    const W = await WI();
    if (!d || !W) return;
    const patch = readEntry(sideBox(), d.e);
    if (!Object.keys(patch).length && !force) { A.toast('info', 'Ничего не менялось', '✦ Лорбуки', { timeOut: 1500 }); return; }
    const r = await commitEntry(W, ui.book, d.uid, patch, { baseSig: d.sig, force });
    if (r.conflict) { d.conflict = r.conflict; sideRender(); return; }
    ui.data = r.data;
    A.toast('success', 'Сохранено', '✦ Лорбуки', { timeOut: 1500 });
    showEntry(r.data.entries[d.uid], { more: d.more, gcOpen: d.gcOpen });
}

async function click(act, el) {
    const c = cfg();
    const save = () => A.saveSettings();
    switch (act) {
        case 'lb-view': c.view = c.view === 'grid' ? 'list' : 'grid'; save(); winRender(); return;
        case 'lb-folder': ui.folder = el.dataset.id || ''; winRender(); return;
        case 'lb-back': ui.book = ''; ui.data = null; closeSide(); await reloadNames(); winRender(); return;
        case 'lb-open': await openBook(el.dataset.name); return;
        case 'lb-fnew': {
            const name = (await askText('Название папки')).slice(0, 60);
            if (!name) return;
            c.folders.push({ id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, parent: ui.folder || '' });
            save(); winRender();
            return;
        }
        case 'lb-fren': {
            const f = c.folders.find(x => x.id === el.dataset.id);
            if (!f) return;
            const name = (await askText('Название папки', f.name)).slice(0, 60);
            if (name) { f.name = name; save(); winRender(); }
            return;
        }
        case 'lb-fdel': {
            const f = c.folders.find(x => x.id === el.dataset.id);
            if (!f || !sure(el, 'Убрать папку?')) return;
            // книги и вложенные папки — на уровень выше
            for (const [n, id] of Object.entries(c.at)) if (id === f.id) { if (f.parent) c.at[n] = f.parent; else delete c.at[n]; }
            for (const x of c.folders) if (x.parent === f.id) x.parent = f.parent || '';
            c.folders = c.folders.filter(x => x !== f);
            ui.folder = f.parent || '';
            save(); winRender();
            return;
        }
        case 'lb-sug': {
            const g = suggestFolders(ui.names).find(x => x.name === el.dataset.name);
            if (!g) return;
            const f = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: g.name, parent: '' };
            c.folders.push(f);
            for (const n of g.books) c.at[n] = f.id;
            save(); winRender();
            return;
        }
        case 'lb-new': {
            const W = await WI();
            const name = await askText('Название лорбука');
            if (!W || !name) return;
            if (ui.names.includes(name)) { A.toast('info', 'Лорбук с таким названием уже есть', '✦ Лорбуки'); return; }
            await W.createNewWorldInfo(name);
            if (ui.folder) { c.at[name] = ui.folder; save(); }
            await reloadNames();
            await openBook(name);
            return;
        }
        case 'lb-filter': ui.filter = el.dataset.v; winRender(); return;
        case 'lb-reload': await openBook(ui.book); A.toast('success', 'Взято с сервера', '✦ Лорбуки', { timeOut: 1200 }); return;
        case 'lb-global': {
            const n = ui.book;
            try { await A.ctx().executeSlashCommandsWithOptions?.(`/world state=toggle silent=true ${n}`); } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Лорбуки'); }
            await reloadNames(); winRender();
            return;
        }
        case 'lb-del': {
            if (!sure(el, 'Удалить лорбук совсем?')) return;
            const W = await WI();
            const n = ui.book;
            if (!W) return;
            await W.deleteWorldInfo(n);
            delete c.at[n]; save();
            ui.book = ''; ui.data = null; closeSide();
            await reloadNames(); winRender();
            A.toast('success', `«${esc(n)}» удалён`, '✦ Лорбуки');
            return;
        }
        case 'lb-edit': { const e = ui.data?.entries?.[el.dataset.uid]; if (e) showEntry(e); return; }
        case 'lb-strat': {
            const box = sideBox();
            const h = box.querySelector('[data-in="lb-strat"]');
            if (h) h.value = el.dataset.v;
            el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
            return;
        }
        case 'lb-more': if (ui.entry) ui.entry.more = !el.parentElement.open; return;
        case 'lb-gcmore': if (ui.entry) ui.entry.gcOpen = !el.parentElement.open; return;
        case 'lb-save': await A.withBusy(el, () => saveEntry(false), 'Сохраняю…'); return;
        case 'lb-mine': await A.withBusy(el, () => saveEntry(true), 'Сохраняю…'); return;
        case 'lb-theirs': { const d = ui.entry; if (d?.conflict) { ui.data = await fresh(ui.book); const e = ui.data.entries[d.uid]; if (e) showEntry(e); else { closeSide(); winRender(); } } return; }
        case 'lb-enew': {
            const W = await WI();
            if (!W) return;
            const data = await fresh(ui.book);
            const e = W.createWorldInfoEntry(ui.book, data);
            if (!e) throw new Error('таверна не выдала номер новой записи');
            e.comment = 'Новая запись';
            await W.saveWorldInfo(ui.book, data, true);
            try { W.reloadEditor?.(ui.book); } catch { /* */ }
            ui.data = data; ui.counts[ui.book] = Object.keys(data.entries).length;
            showEntry(data.entries[e.uid]);
            return;
        }
        case 'lb-dup': {
            const W = await WI();
            const d = ui.entry;
            if (!W || !d) return;
            const data = await fresh(ui.book);
            const src = data.entries[d.uid];
            if (!src) throw new Error('этой записи на сервере уже нет');
            const copy = W.duplicateWorldInfoEntry ? W.duplicateWorldInfoEntry(data, d.uid) : null;
            if (!copy) throw new Error('таверна не смогла сделать копию');
            copy.comment = `${src.comment || 'Запись'} (копия)`;
            await W.saveWorldInfo(ui.book, data, true);
            try { W.reloadEditor?.(ui.book); } catch { /* */ }
            ui.data = data; ui.counts[ui.book] = Object.keys(data.entries).length;
            showEntry(data.entries[copy.uid]);
            return;
        }
        case 'lb-edel': {
            const d = ui.entry;
            if (!d || !sure(el, 'Удалить запись?')) return;
            const W = await WI();
            if (!W) return;
            const r = await commitEntry(W, ui.book, d.uid, null, { del: true });
            ui.data = r.data; ui.counts[ui.book] = Object.keys(r.data.entries).length;
            closeSide(); winRender();
            return;
        }
        default: return;
    }
}

function change(el) {
    const k = el?.dataset?.in;
    if (!k || !k.startsWith('lb-')) return false;
    if (k === 'lb-move') { const c = cfg(); if (el.value) c.at[ui.book] = el.value; else delete c.at[ui.book]; A.saveSettings(); return true; }
    if (k === 'lb-on') {
        const uid = el.dataset.uid;
        const want = !el.checked;
        (async () => {
            const W = await WI();
            try {
                const r = await commitEntry(W, ui.book, uid, { disable: want });
                ui.data = r.data;
                if (ui.entry?.uid === Number(uid) || String(ui.entry?.uid) === String(uid)) showEntry(r.data.entries[uid], { more: ui.entry.more, gcOpen: ui.entry.gcOpen }); else winRender();
            } catch (e) { el.checked = !el.checked; A.toast('error', `Не сохранилось: ${esc(String(e?.message || e))}`, '✦ Лорбуки'); }
        })();
        return true;
    }
    return false;
}

let qTimer = null;
function input(el) {
    const k = el?.dataset?.in;
    if (k === 'lb-q' || k === 'lb-eq') {
        if (k === 'lb-q') ui.q = el.value; else ui.eq = el.value;
        clearTimeout(qTimer);
        // перерисовать список, не теряя фокус в поле поиска
        qTimer = setTimeout(() => { const pos = el.selectionStart; winRender(); const again = winBox()?.querySelector(`[data-in="${k}"]`); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* */ } } }, 220);
        return true;
    }
    if (k === 'lb-content') { const out = sideBox()?.querySelector('[data-out="lb-len"]'); if (out) out.textContent = `${el.value.length} зн.`; return true; }
    return false;
}

/** Открыть библиотеку; book — сразу книгу, uid — сразу запись. */
export async function openBooks({ book = '', uid = null } = {}) {
    ui.book = ''; ui.data = null; ui.q = ''; ui.entry = null;
    openWin({ id: 'books', title: `${icon('book')} Лорбуки`, html: mainHtml });
    const W = await reloadNames();
    winRender();
    if (W && book && ui.names.includes(book)) {
        await openBook(book);
        const e = uid !== null ? ui.data?.entries?.[uid] : null;
        if (e) showEntry(e);
    }
}
