// Окно расширений. Стоковое «Manage extensions» — один длинный список, который при каждом открытии опрашивает
// git у всех подряд. Здесь: папки (в настройках Life), вкладки «все / нужно обновить / выключенные / системные»,
// проверка обновлений по кнопке и массовое обновление одним тапом.
//
// Осторожность с обновлениями: у автора часть чужих расширений пропатчена на сервере — `git pull` поверх патча
// либо упадёт, либо сломает его молча. Поэтому у каждого расширения есть замок «не обновлять»: под замком оно
// в массовое обновление не идёт, а поодиночке — только со второго тапа. Свои расширения можно тянуть
// и из терминала — окно этому не мешает: оно дёргает ту же команду git, что и стоковая кнопка таверны.

import { icon } from './icons.js';
import { openWin, winRender, winMod, sure, askText, winBox } from './win.js';

let A = null;
export function initExts(api) { A = api; winMod({ pre: 'ex-', click, change, input }); }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.exts || typeof s.exts !== 'object') s.exts = {};
    const c = s.exts;
    if (!Array.isArray(c.folders)) c.folders = [];        // { id, name }
    if (!c.at || typeof c.at !== 'object') c.at = {};     // расширение → папка
    if (!c.lock || typeof c.lock !== 'object') c.lock = {};
    return c;
}

const ui = { tab: 'all', folder: '', q: '', list: [], ver: {}, checking: false, done: 0, changed: false, err: '', log: [] };
const headers = () => { try { return A.ctx().getRequestHeaders(); } catch { return { 'Content-Type': 'application/json' }; } };
const short = (name) => String(name || '').replace(/^third-party\//, '');
const disabledList = () => { const e = A.ctx().extensionSettings; if (!Array.isArray(e.disabledExtensions)) e.disabledExtensions = []; return e.disabledExtensions; };
const isOff = (x) => disabledList().includes(x.name);

// Папки, где на сервере лежат свои правки (патчи чужих расширений). Сама таверна этого не говорит — список кладёт
// в её файлы мост с сервером, при каждом синке; такие расширения под замком сами. Файла нет — замки только ручные.
let dirty = new Set();
async function loadDirty() {
    try {
        const r = await fetch('/user/files/life-ext-dirty.json', { cache: 'no-cache' });
        if (!r.ok) return;
        const d = await r.json();
        dirty = new Set((Array.isArray(d?.dirty) ? d.dirty : []).map(x => String(x).toLowerCase()));
    } catch { /* файла нет или он битый — как будто правок нет */ }
}
const isDirty = (name, set = dirty) => !!set?.has?.(String(name || '').replace(/^third-party\//, '').toLowerCase());
/**
 * Замок расширения: 'hand' — поставлен руками, 'auto' — на сервере свои правки, '' — нет.
 * Снятый руками (false) остаётся снятым, даже если правки есть: это её решение.
 */
export const lockOf = (name, lock, set = dirty) => (lock?.[name] === true ? 'hand' : lock?.[name] === false ? '' : isDirty(name, set) ? 'auto' : '');
/** Все замки разом — в том виде, в каком их ждёт updatable. */
export const lockMap = (list, lock, set = dirty) => Object.fromEntries(list.filter(x => lockOf(x.name, lock, set)).map(x => [x.name, true]));

async function load() {
    ui.err = '';
    try {
        const r = await fetch('/api/extensions/discover', { headers: headers(), cache: 'no-cache' });
        if (!r.ok) throw new Error(`сервер не отдал список расширений (${r.status})`);
        const list = await r.json();
        const out = [];
        await Promise.all(list.map(async (x) => {
            let m = null;
            try { const mr = await fetch(`/scripts/extensions/${x.name}/manifest.json`, { cache: 'no-cache' }); if (mr.ok) m = await mr.json(); } catch { /* без манифеста */ }
            out.push({ name: x.name, type: x.type, title: m?.display_name || short(x.name), version: String(m?.version || ''), author: String(m?.author || ''), home: String(m?.homePage || ''), noManifest: !m });
        }));
        ui.list = out.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } catch (e) { ui.err = String(e?.message || e); }
}

/** Что показать во вкладке (чистая логика — проверяется тестами). */
export function pick(list, { tab, folder, q, off, ver, at }) {
    const third = list.filter(x => x.type !== 'system');
    let rows = tab === 'system' ? list.filter(x => x.type === 'system') : third;
    if (tab === 'update') rows = rows.filter(x => ver[x.name]?.isUpToDate === false);
    if (tab === 'off') rows = rows.filter(x => off.includes(x.name));
    if (tab === 'all' && folder) rows = rows.filter(x => (at[x.name] || '') === (folder === '-' ? '' : folder));
    const qq = String(q || '').toLowerCase().trim();
    if (qq) rows = rows.filter(x => `${x.title} ${x.name} ${x.author}`.toLowerCase().includes(qq));
    return rows;
}
/** Кого обновит «Обновить все»: есть обновление, не под замком, не выключено из списка руками. */
export const updatable = (list, ver, lock, skip = []) => list.filter(x => x.type !== 'system' && ver[x.name]?.isUpToDate === false && !lock[x.name] && !skip.includes(x.name));

async function versionOf(x) {
    const r = await fetch('/api/extensions/version', { method: 'POST', headers: headers(), body: JSON.stringify({ extensionName: short(x.name), global: x.type === 'global' }) });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
}

async function checkAll() {
    if (ui.checking) return;
    ui.checking = true; ui.done = 0;
    const third = ui.list.filter(x => x.type !== 'system');
    winRender();
    await loadDirty();   // список правок мог обновиться с последнего синка
    // по три за раз: каждый запрос — git fetch на сервере
    let k = 0;
    const worker = async () => {
        while (k < third.length) {
            const x = third[k++];
            try { const v = await versionOf(x); ui.ver[x.name] = { isUpToDate: v.isUpToDate !== false, branch: v.currentBranchName || '', hash: String(v.currentCommitHash || '').slice(0, 7), repo: v.remoteUrl || '', git: !!v.currentCommitHash, at: Date.now() }; }
            catch (e) { ui.ver[x.name] = { err: String(e?.message || e), at: Date.now() }; }
            ui.done++;
            if (ui.done % 3 === 0) progress();
        }
    };
    await Promise.all([worker(), worker(), worker()]);
    ui.checking = false;
    winRender();
}
const progress = () => { const el = winBox()?.querySelector('[data-out="ex-progress"]'); if (el) el.textContent = `проверяю ${ui.done} из ${ui.list.filter(x => x.type !== 'system').length}…`; };

async function updateOne(x) {
    const r = await fetch('/api/extensions/update', { method: 'POST', headers: headers(), body: JSON.stringify({ extensionName: short(x.name), global: x.type === 'global' }) });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(t && t.length < 200 ? t : `сервер ответил ${r.status} — обычно это локальные правки в папке расширения (патч) или нет сети`); }
    const d = await r.json();
    ui.ver[x.name] = { ...(ui.ver[x.name] || {}), isUpToDate: true, hash: d.shortCommitHash || ui.ver[x.name]?.hash || '', at: Date.now() };
    ui.changed = ui.changed || d.isUpToDate === false;
    return d;
}

function row(x) {
    const c = cfg();
    const v = ui.ver[x.name];
    const off = isOff(x);
    const lk = lockOf(x.name, c.lock);
    const locked = !!lk;
    const state = !v ? '' : v.err ? `<i class="lw-b warn" title="${esc(v.err)}">не проверилось</i>` : !v.git ? '<i class="lw-b" title="папка без git — обновляется не отсюда">без git</i>' : v.isUpToDate ? '<i class="lw-b ok">свежее</i>' : '<i class="lw-b on">есть обновление</i>';
    const folders = c.folders.length ? `<select data-in="ex-move" data-name="${esc(x.name)}" title="папка"><option value="">— без папки —</option>${c.folders.map(f => `<option value="${esc(f.id)}"${c.at[x.name] === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>` : '';
    return `<div class="lw-ext${off ? ' off' : ''}">
        <div class="lw-ext-m"><b>${esc(x.title)}</b><small>${esc([x.version && `v${x.version}`, x.author, v?.branch && v.branch !== 'main' && v.branch !== 'master' ? `ветка ${v.branch}` : '', v?.hash].filter(Boolean).join(' · ') || short(x.name))}${state}${locked ? `<i class="lw-b lock">${lk === 'auto' ? 'замок: правки на сервере' : 'под замком'}</i>` : ''}</small></div>
        ${x.type === 'system' ? '' : `<div class="lw-ext-a">
            ${v && v.git && v.isUpToDate === false ? `<button class="lf-chip on" data-act="ex-up" data-name="${esc(x.name)}">${icon('upload')} обновить</button>` : ''}
            <button class="lf-chip${locked ? ' on' : ''}" data-act="ex-lock" data-name="${esc(x.name)}" title="${lk === 'auto' ? 'на сервере у него свои правки — под замком само' : 'не обновлять: пропатчено или так надо'}">${icon('lock')}</button>
            ${folders}</div>`}
        <label class="lw-sw" title="${off ? 'выключено' : 'включено'}"><input type="checkbox" data-in="ex-on" data-name="${esc(x.name)}"${off ? '' : ' checked'}><i></i></label>
    </div>`;
}

function html() {
    const c = cfg();
    if (ui.err) return `<div class="lf-empty small">${esc(ui.err)}</div>`;
    if (!ui.list.length) return '<div class="lf-empty small">Загружаю…</div>';
    const off = disabledList();
    const third = ui.list.filter(x => x.type !== 'system');
    const nUp = third.filter(x => ui.ver[x.name]?.isUpToDate === false).length;
    const nOff = third.filter(x => off.includes(x.name)).length;
    const checked = third.some(x => ui.ver[x.name]);
    const tabs = [['all', `все ${third.length}`], ['update', `обновить${checked ? ` ${nUp}` : ''}`], ['off', `выкл ${nOff}`], ['system', `система ${ui.list.length - third.length}`]];
    const rows = pick(ui.list, { tab: ui.tab, folder: ui.folder, q: ui.q, off, ver: ui.ver, at: c.at });
    const locks = lockMap(ui.list, c.lock);
    const canUp = updatable(ui.list, ui.ver, locks);
    const lockedUp = third.filter(x => ui.ver[x.name]?.isUpToDate === false && locks[x.name]).length;
    return `<div class="lw-tools"><input type="search" data-in="ex-q" placeholder="Найти расширение" value="${esc(ui.q)}"></div>
    <div class="lf-seg lw-seg">${tabs.map(([k, l]) => `<button class="${ui.tab === k ? 'on' : ''}" data-act="ex-tab" data-v="${k}">${l}</button>`).join('')}</div>
    ${ui.tab === 'all' ? `<div class="lf-chips"><button class="lf-chip${!ui.folder ? ' on' : ''}" data-act="ex-folder" data-id="">все</button>${c.folders.map(f => `<button class="lf-chip${ui.folder === f.id ? ' on' : ''}" data-act="ex-folder" data-id="${esc(f.id)}">${icon('folder')} ${esc(f.name)} · ${third.filter(x => c.at[x.name] === f.id).length}</button>`).join('')}${c.folders.length ? `<button class="lf-chip${ui.folder === '-' ? ' on' : ''}" data-act="ex-folder" data-id="-">без папки</button>` : ''}<button class="lf-chip" data-act="ex-fnew">${icon('plus')} папка</button>${ui.folder && ui.folder !== '-' ? `<button class="lf-chip" data-act="ex-fdel" data-id="${esc(ui.folder)}">${icon('trash')} убрать папку</button>` : ''}</div>` : ''}
    ${ui.tab === 'update' ? `<div class="lf-actions"><button class="lf-btn" data-act="ex-check"${ui.checking ? ' disabled' : ''}>${icon('refresh')} ${checked ? 'Проверить ещё раз' : 'Проверить обновления'}</button>${canUp.length ? `<button class="lf-btn primary" data-act="ex-upall">${icon('upload')} Обновить все · ${canUp.length}</button>` : ''}</div>
        <div class="lf-hint" data-out="ex-progress">${ui.checking ? `проверяю ${ui.done} из ${third.length}…` : checked ? `${nUp ? `Обновления есть у ${nUp}` : 'Всё свежее'}${lockedUp ? ` · под замком ${lockedUp} — их «Обновить все» не трогает` : ''}.` : 'Проверка идёт по кнопке: каждому расширению — запрос к его репозиторию.'}</div>` : ''}
    <div class="lw-exts">${rows.map(row).join('') || `<div class="lf-empty small">${ui.tab === 'update' ? (checked ? 'Обновлять нечего.' : 'Сначала проверь обновления.') : 'Пусто.'}</div>`}</div>
    ${ui.log.length ? `${A.sec('Что сделано')}<div class="lw-log">${ui.log.slice(-12).map(l => `<div class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✕'} <b>${esc(l.title)}</b> ${esc(l.t)}</div>`).join('')}</div>` : ''}
    ${ui.changed ? `<button class="lf-btn primary full" data-act="ex-reload">${icon('refresh')} Перезагрузить таверну — изменения вступят в силу</button>` : ''}
    <div class="lf-hint">Замок ${icon('lock')} — «не обновлять». ${dirty.size ? `Там, где на сервере лежат свои правки (сейчас таких ${dirty.size}), он стоит сам: список приносит мост с сервером при каждом синке.` : 'На расширения со своими правками на сервере он встаёт сам — когда мост с сервером принесёт их список; пока списка нет, ставь руками.'} Обновление поверх патча мешает новый код со старыми правками — так расширения и ломаются. «Обновить» здесь — тот же git pull, что у стоковой кнопки таверны и в терминале: можно и так, и так.</div>`;
}

async function click(act, el) {
    const c = cfg();
    const x = ui.list.find(y => y.name === el.dataset.name);
    switch (act) {
        case 'ex-tab': ui.tab = el.dataset.v; winRender(); return;
        case 'ex-folder': ui.folder = el.dataset.id || ''; winRender(); return;
        case 'ex-fnew': {
            const name = (await askText('Название папки')).slice(0, 40);
            if (!name) return;
            c.folders.push({ id: `f${Date.now().toString(36)}`, name });
            A.saveSettings(); winRender();
            return;
        }
        case 'ex-fdel': {
            if (!sure(el, 'Убрать папку?')) return;
            const id = el.dataset.id;
            c.folders = c.folders.filter(f => f.id !== id);
            for (const [n, f] of Object.entries(c.at)) if (f === id) delete c.at[n];
            ui.folder = '';
            A.saveSettings(); winRender();
            return;
        }
        case 'ex-lock': {
            if (!x) return;
            if (lockOf(x.name, c.lock)) {
                // снять: у расширения с правками на сервере — только осознанно, и «снято» запоминается
                if (isDirty(x.name)) { if (!sure(el, 'Там правки. Снять?')) return; c.lock[x.name] = false; } else delete c.lock[x.name];
            } else if (isDirty(x.name)) delete c.lock[x.name];   // было снято руками — вернуть замок по списку правок
            else c.lock[x.name] = true;
            A.saveSettings(); winRender();
            return;
        }
        case 'ex-check': await checkAll(); return;
        case 'ex-up': {
            if (!x) return;
            if (lockOf(x.name, c.lock) && !sure(el, 'Под замком. Точно?')) return;
            await A.withBusy(el, async () => {
                try { const d = await updateOne(x); ui.log.push({ ok: true, title: x.title, t: d.isUpToDate ? 'уже было свежим' : `обновлено до ${d.shortCommitHash || 'новой версии'}` }); }
                catch (e) { ui.log.push({ ok: false, title: x.title, t: String(e?.message || e) }); }
            }, 'Тяну…');
            winRender();
            return;
        }
        case 'ex-upall': {
            const list = updatable(ui.list, ui.ver, lockMap(ui.list, c.lock));
            if (!list.length || !sure(el, `Обновить ${list.length}?`)) return;
            await A.withBusy(el, async () => {
                for (const y of list) {
                    try { const d = await updateOne(y); ui.log.push({ ok: true, title: y.title, t: d.isUpToDate ? 'уже было свежим' : `обновлено до ${d.shortCommitHash || 'новой версии'}` }); }
                    catch (e) { ui.log.push({ ok: false, title: y.title, t: String(e?.message || e) }); }
                }
            }, 'Тяну по очереди…');
            winRender();
            return;
        }
        case 'ex-reload': try { A.ctx().saveSettingsDebounced(); } catch { /* */ } await A.withBusy(el, () => new Promise(r => setTimeout(r, 1600)), 'Сохраняю настройки…'); location.reload(); return;
        default: return;
    }
}

function change(el) {
    const k = el?.dataset?.in;
    if (k === 'ex-move') { const c = cfg(); if (el.value) c.at[el.dataset.name] = el.value; else delete c.at[el.dataset.name]; A.saveSettings(); return true; }
    if (k === 'ex-on') {
        const name = el.dataset.name;
        const list = disabledList();
        const e = A.ctx().extensionSettings;
        // сама Life: выключить её отсюда — остаться без этого окна
        if (!el.checked && /(^|\/)life$/i.test(name)) { el.checked = true; A.toast('info', 'Life выключается командой /life off или в стоковом списке расширений', '✦ Расширения'); return true; }
        const want = el.checked;
        (async () => {
            // тем же путём, что стоковая кнопка: у расширения срабатывает его hook, настройки пишутся сразу
            try {
                const E = await import('/scripts/extensions.js');
                if (want && E.enableExtension) await E.enableExtension(name, false);
                else if (!want && E.disableExtension) await E.disableExtension(name, false);
                else throw new Error('нет функций таверны');
            } catch {
                e.disabledExtensions = want ? list.filter(n => n !== name) : [...list.filter(n => n !== name), name];
                try { A.ctx().saveSettingsDebounced(); } catch { /* */ }
            }
            ui.changed = true;
            winRender();
        })();
        return true;
    }
    return false;
}

let qTimer = null;
function input(el) {
    if (el?.dataset?.in !== 'ex-q') return false;
    ui.q = el.value;
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { const pos = el.selectionStart; winRender(); const again = winBox()?.querySelector('[data-in="ex-q"]'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch { /* */ } } }, 220);
    return true;
}

export async function openExts() {
    ui.tab = 'all'; ui.q = ''; ui.folder = '';
    openWin({ id: 'exts', title: `${icon('puzzle')} Расширения`, html });
    await Promise.all([load(), loadDirty()]);
    winRender();
}
