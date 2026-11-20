// Окно «Подключение». В стоковой таверне это пять разных панелей верхней полосы: соединение, ответ модели,
// форматирование, персона, фон. Здесь — то, что меняют на ходу, одним листом: профиль подключения (модель под
// сцену), пресет, температура, длина ответа и контекст, стриминг, размышления; персона; фон; ссылки.
// Своих настроек у окна нет: оно жмёт стоковые поля таверны и читает их же — что стоит в таверне, то и здесь.
// Всё редкое (ключи, адреса, шаблоны) остаётся в стоковых панелях — их открывают кнопки внизу.

import { icon } from './icons.js';
import { openWin, winRender, closeWin, winMod } from './win.js';

let A = null;
export function initLink(api) { A = api; winMod({ pre: 'ln-', click, change }); }
const esc = (v) => A.esc(v);
const $id = (id) => document.getElementById(id);

// стоковые поля: границы и шаг берём у самих полей таверны (у контекста они зависят от её же галочки «unlocked»)
const FIELDS = [['temp_openai', 'Температура'], ['openai_max_tokens', 'Длина ответа, токенов'], ['openai_max_context', 'Контекст, токенов']];
const EFFORT = { auto: 'сама решит', min: 'минимум', low: 'мало', medium: 'средне', high: 'много', max: 'максимум' };
const DRAWERS = [['sys-settings-button', 'plug', 'Соединение и ключи'], ['ai-config-button', 'sliders', 'Пресет и блоки промпта'], ['advanced-formatting-button', 'type', 'Форматирование'], ['backgrounds-button', 'image', 'Фоны'], ['user-settings-button', 'settings', 'Настройки таверны']];
const LINKS = [['https://docs.sillytavern.app/', 'Документация'], ['https://github.com/SillyTavern/SillyTavern', 'GitHub'], ['https://discord.gg/sillytavern', 'Discord']];

/** Модель чат-комплишена по источнику: у каждого источника своё поле настроек. */
export function modelOf(oai) {
    const src = String(oai?.chat_completion_source || '');
    const key = { makersuite: 'google_model' }[src] || `${src}_model`;
    return { src, model: String(oai?.[key] || '') };
}

/** Поставить значение в стоковое поле так, чтобы таверна его услышала. */
function setStock(id, value) {
    const el = $id(id);
    if (!el) return false;
    if (el.type === 'checkbox') el.checked = !!value; else el.value = String(value);
    for (const ev of ['input', 'change']) el.dispatchEvent(new Event(ev, { bubbles: true }));   // счётчик рядом с ползунком таверна обновит сама
    return true;
}

const bgs = () => [...document.querySelectorAll('#bg_menu_content .bg_example, #bg_custom_content .bg_example, .bg_example')].filter((el, k, a) => el.getAttribute('bgfile') && a.findIndex(x => x.getAttribute('bgfile') === el.getAttribute('bgfile')) === k);

function html() {
    const c = A.ctx();
    const cm = c.extensionSettings?.connectionManager || {};
    const profs = Array.isArray(cm.profiles) ? cm.profiles : [];
    const chat = c.mainApi === 'openai';
    const { src, model } = modelOf(c.chatCompletionSettings);
    const online = c.onlineStatus && c.onlineStatus !== 'no_connection';
    const preset = $id('settings_preset_openai');
    const eff = $id('openai_reasoning_effort');
    const stream = $id('stream_toggle');
    const p = c.powerUserSettings || {};
    const list = bgs();
    const curBg = String(document.getElementById('bg1')?.style?.backgroundImage || '');
    return `<div class="lw-status ${online ? 'ok' : 'bad'}">${icon('plug')}<span><b>${online ? 'На связи' : 'Нет связи'}</b><small>${esc([chat ? src : c.mainApi, chat ? model : ''].filter(Boolean).join(' · ') || 'источник не выбран')}</small></span></div>
    ${profs.length ? `${A.sec('Профиль подключения', 'модель под сцену')}<div class="lf-chips wrap">${profs.map(x => `<button class="lf-chip${x.id === cm.selectedProfile ? ' on' : ''}" data-act="ln-profile" data-name="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div>` : `<div class="lf-hint">Профилей подключения нет — заведи их в стоковой панели «Соединение» (Connection Profiles): тогда модель под сцену меняется одним тапом.</div>`}
    ${chat ? `${A.sec('Ответ модели')}
        ${preset ? `<div class="lf-field"><label>Пресет</label><select data-in="ln-preset">${[...preset.options].map(o => `<option value="${esc(o.value)}"${o.selected ? ' selected' : ''}>${esc(o.textContent)}</option>`).join('')}</select></div>` : ''}
        ${FIELDS.map(([id, label]) => { const el = $id(id); return el ? `<div class="lf-field row"><label>${label}</label><input type="number" data-in="ln-f" data-id="${id}" min="${esc(el.min || '0')}" max="${esc(el.max || '')}" step="${esc(el.step || '1')}" value="${esc(el.value)}"></div>` : ''; }).join('')}
        ${eff ? `<div class="lf-field row"><label>Размышления</label><select data-in="ln-f" data-id="openai_reasoning_effort">${[...eff.options].map(o => `<option value="${esc(o.value)}"${o.selected ? ' selected' : ''}>${esc(EFFORT[o.value] || o.textContent)}</option>`).join('')}</select></div>` : ''}
        ${stream ? `<label class="lf-switch"><input type="checkbox" data-in="ln-f" data-id="stream_toggle"${stream.checked ? ' checked' : ''}><span></span>Стриминг — ответ печатается по ходу</label>` : ''}
        <div class="lf-hint">Значения — пресета: поменяла здесь — поменялось в нём (сохрани пресет в стоковой панели, если надо оставить насовсем).</div>` : `<div class="lf-hint">Быстрые настройки ответа есть только для чат-комплишена; сейчас выбран «${esc(c.mainApi || '?')}».</div>`}
    ${A.sec('Персона')}
    <button class="lw-pers cur" data-act="ln-personas"><span class="lw-pers-img">${A.ava(c.name1, 'md')}</span><span class="lw-pers-t"><b>${esc(c.name1 || '—')}</b><small>${esc(A.cut(String(p.persona_description || '').replace(/\s+/g, ' '), 90) || 'без описания')}</small></span></button>
    ${list.length ? `${A.sec('Фон', String(list.length))}<div class="lw-bgs">${list.slice(0, 60).map(el => { const f = el.getAttribute('bgfile'); return `<button class="lw-bg${curBg.includes(encodeURIComponent(f)) || curBg.includes(f) ? ' on' : ''}" data-act="ln-bg" data-f="${esc(f)}" title="${esc(f)}" style="background-image:url('/thumbnail?type=bg&file=${encodeURIComponent(f)}')"></button>`; }).join('')}</div>
        <div class="lf-hint">Фон таверны. Если в Life включён «Фон сцены», в чате поверх него встаёт картинка места.</div>` : ''}
    ${A.sec('Стоковые панели', 'всё остальное')}
    <div class="lf-chips wrap">${DRAWERS.filter(([id]) => $id(id)).map(([id, ic, label]) => `<button class="lf-chip" data-act="ln-drawer" data-id="${id}">${icon(ic)} ${label}</button>`).join('')}</div>
    <div class="lf-chips wrap">${LINKS.map(([u, l]) => `<a class="lf-chip" href="${u}" target="_blank" rel="noopener">${icon('enter')} ${l}</a>`).join('')}</div>`;
}

async function click(act, el) {
    switch (act) {
        case 'ln-profile': {
            const name = el.dataset.name;
            el.parentElement.querySelectorAll('.lf-chip').forEach(x => x.classList.toggle('on', x === el));
            try { await A.ctx().executeSlashCommandsWithOptions?.(`/profile "${name.replace(/"/g, '\\"')}"`); A.toast('success', `Профиль: ${esc(name)}`, '✦ Подключение', { timeOut: 1500 }); } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Подключение'); }
            setTimeout(winRender, 1200);   // таверна применяет профиль не мгновенно
            return;
        }
        case 'ln-personas': { const P = await import('./personas.js'); await P.openPersonas(); return; }
        case 'ln-bg': {
            const f = el.dataset.f;
            const src = bgs().find(x => x.getAttribute('bgfile') === f);
            if (src) src.click();
            el.parentElement.querySelectorAll('.lw-bg').forEach(x => x.classList.toggle('on', x === el));
            return;
        }
        case 'ln-drawer': {
            const t = $id(el.dataset.id)?.querySelector('.drawer-toggle');
            closeWin();
            if (t) setTimeout(() => t.click(), 240);
            return;
        }
        default: return;
    }
}

function change(el) {
    const k = el?.dataset?.in;
    if (k === 'ln-preset') { setStock('settings_preset_openai', el.value); setTimeout(winRender, 900); return true; }
    if (k === 'ln-f') {
        const id = el.dataset.id;
        if (el.type === 'checkbox') setStock(id, el.checked);
        else if (el.tagName === 'SELECT') setStock(id, el.value);
        else {
            const n = Number(el.value);
            if (!Number.isFinite(n)) return true;
            const lo = el.min === '' ? -Infinity : Number(el.min), hi = el.max === '' ? Infinity : Number(el.max);
            const v = Math.max(lo, Math.min(hi, n));
            if (v !== n) el.value = String(v);
            setStock(id, v);
        }
        return true;
    }
    return false;
}

export function openLink() { openWin({ id: 'link', title: `${icon('plug')} Подключение`, html }); }
