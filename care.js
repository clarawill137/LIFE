// Life — обслуживание: чистка выброшенных рероллов (чат худеет, сохраняется быстрее), копия настроек Life
// (файлом и раз в день на сервер), сколько Life ходил к модели, что и сколько уходит в промпт.

let A = null;
export function initCare(api) { A = api; }

const esc = (v) => A.esc(v);
const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
/** Грубо: токенов в тексте (русский с разметкой — около 2,7 знака на токен). */
export const tokensOf = (chars) => Math.round((Number(chars) || 0) / 2.7);

// ───────────── рероллы ─────────────

const KEEP = 20;
const size = (v) => { try { return JSON.stringify(v ?? '').length; } catch { return 0; } };

/** Что можно убрать: у постов старше последних keep — варианты, кроме выбранного. */
export function swipeStats(keep = KEEP) {
    const chat = A.chatArr();
    let posts = 0, swipes = 0, bytes = 0;
    for (let i = 0; i < chat.length - keep; i++) {
        const m = chat[i];
        if (!Array.isArray(m?.swipes) || m.swipes.length < 2) continue;
        const cur = Math.min(Math.max(0, m.swipe_id ?? 0), m.swipes.length - 1);
        posts++;
        m.swipes.forEach((t, k) => { if (k !== cur) { swipes++; bytes += size(t) + size(m.swipe_info?.[k]); } });
    }
    return { posts, swipes, bytes, total: chat.length };
}

/** Убрать выброшенные варианты. Выбранный остаётся единственным; всё, что Life помнит о посте, переезжает за ним. */
export async function swipeClean(keep = KEEP) {
    const chat = A.chatArr();
    const st = swipeStats(keep);
    if (!st.swipes) return st;
    for (let i = 0; i < chat.length - keep; i++) {
        const m = chat[i];
        if (!Array.isArray(m?.swipes) || m.swipes.length < 2) continue;
        const cur = Math.min(Math.max(0, m.swipe_id ?? 0), m.swipes.length - 1);
        const before = () => A.rekeySwipe?.(i, cur);
        const move = before();           // запомнить ключи до смены варианта
        m.swipes = [m.swipes[cur] ?? m.mes];
        if (Array.isArray(m.swipe_info)) m.swipe_info = [m.swipe_info[cur] ?? {}];
        m.swipe_id = 0;
        try { move?.(); } catch (e) { console.warn('[Life] чистка: ключи', e); }
    }
    try { await A.ctx().saveChat?.(); } catch (e) { console.warn('[Life] чистка: сохранить чат', e); }
    A.saveMeta();
    return st;
}

// ───────────── копия настроек ─────────────

const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function settingsDump() {
    const s = { ...A.settings() };
    delete s.stats;
    return JSON.stringify({ life: A.version, at: new Date().toISOString(), settings: s });
}

const b64 = (text) => { const bytes = new TextEncoder().encode(text); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const slotName = (n) => `life_backup_${n}.json`;

/** Раз в день — копия настроек Life на сервер (семь файлов по дням недели, по кругу). */
export async function backupAuto() {
    const s = A.settings();
    if (s.backupDay === stamp()) return false;
    const name = slotName(new Date().getDay());
    const r = await fetch('/api/files/upload', { method: 'POST', headers: A.ctx().getRequestHeaders(), body: JSON.stringify({ name, data: b64(settingsDump()) }) });
    if (!r.ok) throw new Error(`копия настроек не загрузилась (${r.status})`);
    s.backupDay = stamp();
    A.saveSettings();
    return true;
}

/** Какие копии лежат на сервере: [{ n, at, life, size, data }] — свежие первыми. */
export async function backupList() {
    const out = [];
    for (let n = 0; n < 7; n++) {
        try {
            const r = await fetch(`/user/files/${slotName(n)}?t=${Date.now()}`, { cache: 'no-store' });
            if (!r.ok) continue;
            const text = await r.text();
            const j = JSON.parse(text);
            if (j?.settings) out.push({ n, at: j.at, life: j.life, size: text.length, data: j });
        } catch { /* нет такой */ }
    }
    return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Вернуть настройки из копии (объект { settings }). Статистика и отметка копии — текущие. */
export function settingsRestore(dump) {
    const src = dump?.settings;
    if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('это не копия настроек Life');
    const s = A.settings();
    const keep = { stats: s.stats, backupDay: s.backupDay };
    for (const k of Object.keys(s)) delete s[k];
    Object.assign(s, JSON.parse(JSON.stringify(src)), keep);
    A.saveSettings();
    return Object.keys(src).length;
}

function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ───────────── вид (Мир → ⚙) ─────────────

const LABELS = { index: 'прочее', reply: 'не пропусти', see: 'покажи им', days: 'дни', fix: 'правки поста', draft: 'черновик', fresh: 'свежесть', agenda: 'закулисье', shots: 'кадры', twists: 'твисты', inner: 'мысли', sim: 'жизнь', arcs: 'сюжетка', slip: 'ляп-фикс', hurt: 'травмы', people: 'люди', canon: 'канон', habits: 'привычки', lang: 'языки', ooc: 'OOC', steps: 'прожитое', shards: 'осколки', skip: 'перемотка', cal: 'календарь', route: 'дорога', ambient: 'запахи', mend: 'дописать пост' };

export function statsHtml() {
    const st = A.settings().stats || {};
    const days = Object.keys(st).sort().reverse();
    if (!days.length) return '<div class="lf-hint">Пока пусто — счёт пойдёт с первого вызова.</div>';
    return days.slice(0, 3).map((d, k) => {
        const rows = Object.entries(st[d]).sort((a, b) => (b[1].i + b[1].o) - (a[1].i + a[1].o));
        const sum = rows.reduce((a, [, r]) => ({ n: a.n + r.n, i: a.i + r.i, o: a.o + r.o }), { n: 0, i: 0, o: 0 });
        return `<details class="lf-more"${k ? '' : ' open'}><summary>${k ? esc(d) : 'сегодня'} — ${sum.n} ${A.plural(sum.n, 'вызов', 'вызова', 'вызовов')}, ~${tokensOf(sum.i).toLocaleString('ru')} токенов туда и ~${tokensOf(sum.o).toLocaleString('ru')} обратно</summary>
            <div class="lf-stats">${rows.map(([l, r]) => `<div><b>${esc(LABELS[l] || l)}</b><span>${r.n}×</span><span>~${tokensOf(r.i).toLocaleString('ru')} → ~${tokensOf(r.o).toLocaleString('ru')}</span></div>`).join('')}</div></details>`;
    }).join('');
}

/** Что уходит модели: по блокам, с размером. parts — [{ label, text }]. */
export function promptHtml(parts) {
    const list = (parts || []).filter(p => p?.text);
    if (!list.length) return '<div class="lf-hint">Сейчас Life ничего не добавляет в промпт.</div>';
    const total = list.reduce((a, p) => a + p.text.length, 0);
    return `<div class="lf-hint">Всего ~${tokensOf(total).toLocaleString('ru')} токенов в конец каждого промпта, блоков — ${list.length}. Самые тяжёлые — сверху; тап — посмотреть текст.</div>
        ${[...list].sort((a, b) => b.text.length - a.text.length).map(p => `<details class="lf-more"><summary><b>${esc(p.label)}</b> — ~${tokensOf(p.text.length).toLocaleString('ru')} (${Math.round(p.text.length / total * 100)}%)</summary><pre class="lf-pre">${esc(p.text)}</pre></details>`).join('')}`;
}

export function careHtml() {
    const sw = swipeStats();
    return `<div class="lf-care">
        <div class="lf-field"><label>Старые рероллы</label>
            <div class="lf-hint">${sw.swipes ? `У ${sw.posts} ${A.plural(sw.posts, 'поста', 'постов', 'постов')} лежит ${sw.swipes} ${A.plural(sw.swipes, 'выброшенный вариант', 'выброшенных варианта', 'выброшенных вариантов')} — около ${mb(sw.bytes)}. Чат целиком сохраняется после каждого поста: чем он легче, тем быстрее.` : 'Выброшенных вариантов нет — чистить нечего.'} Последние ${KEEP} постов не трогаю.</div>
            ${sw.swipes ? `<button class="lf-btn full" data-act="care-swipes">${A.icon('trash')} Почистить старые рероллы…</button>` : ''}</div>
        <div class="lf-field"><label>Копия настроек Life <small>(люди, места, голоса, эмоции, герои — всё, что не в чате)</small></label>
            <div class="lf-hint">Раз в день копия сама уходит на сервер (семь последних дней)${A.settings().backupDay ? ` — последняя ${esc(A.settings().backupDay)}` : ''}.</div>
            <div class="lf-actions"><button class="lf-btn" data-act="care-export">${A.icon('upload')} Скачать</button><button class="lf-btn ghost" data-act="care-copies">Копии на сервере…</button><label class="lf-btn ghost">Из файла…<input type="file" accept=".json,application/json" data-in="care-file" hidden></label></div></div>
    </div>`;
}

export async function careClick(act, el) {
    if (!act.startsWith('care-')) return false;
    switch (act) {
        case 'care-swipes': {
            const sw = swipeStats();
            A.openSheet(`${A.icon('trash')} Старые рероллы`, `<div class="lf-hint">Уберу ${sw.swipes} ${A.plural(sw.swipes, 'выброшенный вариант', 'выброшенных варианта', 'выброшенных вариантов')} у ${sw.posts} ${A.plural(sw.posts, 'поста', 'постов', 'постов')} — чат станет легче примерно на ${mb(sw.bytes)}. У каждого поста останется тот вариант, что выбран сейчас; последние ${KEEP} постов не трогаю. <b>Вернуть убранное будет нельзя.</b></div>
                <button class="lf-btn primary full" data-act="care-swipes-go">${A.icon('trash')} Да, почистить</button>`);
            return true;
        }
        case 'care-swipes-go': {
            let r = null;
            await A.withBusy(el, async () => { r = await swipeClean(); }, 'Чищу…');
            A.closeSheet();
            A.toast('success', `Убрала вариантов: ${r?.swipes || 0} — минус ~${mb(r?.bytes || 0)}`, '✦ Life', { timeOut: 4000 });
            A.render();
            return true;
        }
        case 'care-export': download(`life-settings-${stamp()}.json`, settingsDump()); return true;
        case 'care-copies': {
            let list = [];
            await A.withBusy(el, async () => { list = await backupList(); }, 'Смотрю…');
            care.copies = list;
            A.openSheet(`${A.icon('clock')} Копии настроек`, list.length ? `<div class="lf-hint">Вернуть — настройки Life станут как в копии (то, что в чатах, не меняется). Потом обнови страницу.</div>
                ${list.map((c, k) => `<button class="lf-btn full" data-act="care-restore" data-n="${k}">${esc(String(c.at || '').slice(0, 16).replace('T', ' '))} · Life ${esc(c.life || '?')} · ${mb(c.size)}</button>`).join('')}` : '<div class="lf-hint">На сервере копий пока нет — первая появится сегодня.</div>');
            return true;
        }
        case 'care-restore': {
            const c = care.copies?.[Number(el.dataset.n)];
            if (!c) return true;
            if (el.dataset.sure !== '1') { el.dataset.sure = '1'; el.classList.add('primary'); el.textContent = 'Точно вернуть эту копию? Тапни ещё раз'; return true; }
            try { settingsRestore(c.data); A.closeSheet(); A.toast('success', 'Настройки возвращены — обнови страницу', '✦ Life', { timeOut: 6000 }); }
            catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Life', { timeOut: 4000 }); }
            return true;
        }
    }
    return true;
}
const care = { copies: [] };

/** Файл с копией выбрали. */
export async function careInput(el) {
    if (el?.dataset?.in !== 'care-file' || !el.files?.[0]) return false;
    try {
        const j = JSON.parse(await el.files[0].text());
        settingsRestore(j);
        A.toast('success', 'Настройки из файла возвращены — обнови страницу', '✦ Life', { timeOut: 6000 });
    } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Life', { timeOut: 4000 }); }
    el.value = '';
    return true;
}
