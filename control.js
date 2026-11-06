// ✦ Пульт Life: язычок на краю экрана → полноэкранный пульт как на айфоне.
// Плитки Life, агенты (Конвейер, Кластер, Закулисье, Хроника, Летописец), модель, кнопки над вводом
// (Quick Reply и скрипты Tavern Helper) и блоки ExtBlocks, вкладки Кабинета (лорбуки, пресет, память).
// И тема «Графит и вино» на всю Таверну.

import { icon, iconUrl, CANDLE } from './icons.js';

let api = null;

const CC_DEFAULTS = {
    on: true, side: 'left', top: 50, hideFabs: true, qrHidden: true,
    theme: true, killMoonlit: true, killCustom: true, palette: 'graphite', bg: 'dim', read: false, fs: 17, lh: 1.7, width: 760, ava: 'wide',
};

const AGENTS = [
    { key: 'conveyor', label: 'Конвейер', icon: 'bot', cmd: 'conveyor' },
    { key: 'charCluster', label: 'Кластер', icon: 'users', box: 'cl_enabled' },
    { key: 'backstage', label: 'Закулисье', icon: 'moon', box: 'bs_enabled' },
    { key: 'hedyRecall', label: 'Хроника', icon: 'search', box: 'hr_enabled' },
    { key: 'life.chron', label: 'Летописец', icon: 'spark' },
];

// тонкие линейные значки вместо FontAwesome — в верхней панели и у поля ввода
const MASKS = [
    ['#leftNavDrawerIcon', 'sliders'], ['#API-status-top', 'plug'], ['#advanced-formatting-button .drawer-icon', 'type'],
    ['#WIDrawerIcon', 'book'], ['#user-settings-button .drawer-icon', 'settings'], ['#backgrounds-button .drawer-icon', 'image'],
    ['#extensions-settings-button .drawer-icon', 'puzzle'], ['#persona-management-button .drawer-icon', 'user'],
    ['#rightNavDrawerIcon', 'idcard'], ['#options_button', 'menu'], ['#extensionsMenuButton', 'sparkles'],
    ['#send_but', 'arrowUp'], ['#mes_continue', 'right'], ['#mes_impersonate', 'feather'],
    // чужие кнопки у поля ввода и в верхней панели — тем же тонким контуром, чтобы ряд был ровный
    ['#top-settings-holder :is(.fa-clock, .fa-clock-rotate-left, .fa-hourglass, .fa-hourglass-half, .fa-hourglass-start)', 'clock'],
    ['#leftSendForm :is(.fa-shirt, .fa-shirt-long-sleeve, .fa-vest)', 'shirt'],
    ['#leftSendForm :is(.fa-book, .fa-book-open, .fa-book-bookmark, .fa-book-atlas, .fa-book-open-reader)', 'book'],
    ['#leftSendForm :is(.fa-clock, .fa-clock-rotate-left, .fa-hourglass, .fa-hourglass-half)', 'clock'],
    ['#leftSendForm :is(.fa-chevron-down, .fa-angle-down, .fa-caret-down, .fa-circle-chevron-down, .fa-angles-down)', 'chevD'],
    ['#leftSendForm :is(.fa-chevron-up, .fa-angle-up, .fa-caret-up, .fa-circle-chevron-up, .fa-angles-up)', 'chevU'],
    ['#leftSendForm :is(.fa-magic-wand-sparkles, .fa-wand-magic-sparkles, .fa-wand-magic)', 'sparkles'],
    ['#leftSendForm :is(.fa-image, .fa-images, .fa-camera)', 'image'],
    ['#leftSendForm :is(.fa-mobile, .fa-mobile-screen, .fa-mobile-screen-button, .fa-phone)', 'smartphone'],
    ['#leftSendForm :is(.fa-heart, .fa-heart-pulse)', 'heart'], ['#leftSendForm :is(.fa-music, .fa-headphones)', 'music'],
    ['#leftSendForm :is(.fa-gear, .fa-gears, .fa-sliders)', 'settings'], ['#leftSendForm :is(.fa-brain)', 'brain'],
    ['#leftSendForm :is(.fa-feather, .fa-feather-pointed, .fa-pen, .fa-pen-nib)', 'feather'], ['#leftSendForm :is(.fa-paw)', 'paw'],
    ['#leftSendForm :is(.fa-globe, .fa-earth-europe, .fa-map)', 'globe'], ['#leftSendForm :is(.fa-star)', 'star'],
];

// кнопки чата из меню-гамбургера ST
const CHAT_ACTS = [
    ['option_regenerate', 'refresh', 'Реген'], ['option_continue', 'right', 'Дальше'], ['option_impersonate', 'feather', 'За меня'],
    ['option_toggle_AN', 'notes', 'Заметка'], ['option_select_chat', 'message', 'Чаты'],
];

// плавающие кнопки чужих расширений — в пульте они живут плитками
const FABS = [
    ['#fmt_fab', '#fmt_fab_btn', 'brain', 'Факты'], ['#fm-mini-btn', '#fm-mini-btn', 'heart', 'FM'], ['#kab-handle', '#kab-handle', 'book', 'Кабинет'],
];

// стили Moonlit: основной и extension.css, свой CSS, мобильные блоки css-block-*
const KILL_IDS = /^(MoonlitEchosTheme-(style|extension)|moonlit-raw-css|css-block-.+)$/;

const esc = (v) => api.esc(v);
const ctx = () => SillyTavern.getContext();

function cc() {
    const s = api.settings();
    if (!s.cc || typeof s.cc !== 'object') s.cc = {};
    for (const [k, v] of Object.entries(CC_DEFAULTS)) if (s.cc[k] === undefined) s.cc[k] = v;
    // 0.5: аватарки баном во всю ширину, старые «крупные/огромные» — в новый режим
    if (!s.cc.v05) { if (s.cc.ava === 'huge' || s.cc.ava === 'big') s.cc.ava = 'wide'; s.cc.v05 = 1; }
    return s.cc;
}
const PALETTES = [['graphite', 'Графит'], ['paper', 'Бумага'], ['moon', 'Луна']];

// ───────────── тема ─────────────

export function applyTheme() {
    const s = api.settings();
    const c = cc();
    const b = document.body;
    const on = s.enabled !== false;
    b.classList.toggle('lf-theme', on && c.theme);
    b.classList.toggle('lf-bg-dim', on && c.theme && c.bg === 'dim');
    b.classList.toggle('lf-bg-flat', on && c.theme && c.bg === 'flat');
    b.classList.toggle('lf-read', on && c.read);
    const th = on && c.theme;
    for (const [k] of PALETTES) b.classList.toggle(`lf-pal-${k}`, th && c.palette === k);
    b.classList.toggle('lf-ava-wide', th && c.ava === 'wide');
    b.classList.toggle('lf-ava-big', th && c.ava === 'big');
    b.classList.remove('lf-ava-huge');
    syncAvatars(th && (c.ava === 'wide' || c.ava === 'big'));
    b.classList.toggle('lf-qr-hidden', on && c.on && c.qrHidden);
    b.classList.toggle('lf-hide-fabs', on && c.on && c.hideFabs);
    b.style.setProperty('--lf-read-fs', `${c.fs}px`);
    b.style.setProperty('--lf-read-lh', String(c.lh));
    b.style.setProperty('--lf-read-w', `${c.width}px`);
    if (!document.getElementById('lf-theme-icons')) {
        const st = document.createElement('style');
        st.id = 'lf-theme-icons';
        st.textContent = MASKS.map(([sel, n]) => {
            const u = iconUrl(n, 1.5);
            return `body.lf-theme ${sel}::before{content:''!important;display:inline-block!important;width:1em!important;height:1em!important;vertical-align:-.125em;background:currentColor!important;-webkit-mask:${u} center/contain no-repeat!important;mask:${u} center/contain no-repeat!important;font-family:inherit!important;}`;
        }).join('\n');
        document.head.append(st);
    }
    // Moonlit со своими !important перебивает всё подряд — пока включена тема Life, его стили выключены
    const kill = on && c.theme && c.killMoonlit;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
        const href = el.getAttribute?.('href') || '';
        if (/MoonlitEchoesTheme\/.+\.css/i.test(href) || KILL_IDS.test(el.id || '')) el.disabled = kill;
    });
    // свой CSS темы ST (поле Custom CSS) часто красит то же самое — пока стоит тема Life, он выключен
    const cs = document.getElementById('custom-style');
    if (cs) cs.disabled = on && c.theme && c.killCustom;
    syncEdge();
}

// ───────────── аватарки в полном размере ─────────────
// ST кладёт в чат превьюшки 96×144 — для баннера во всю ширину они мыльные, подменяем на оригинал.

let avaObs = null;
function fullSrc(src) {
    const m = String(src || '').match(/^\/thumbnail\?type=(avatar|persona)&file=([^&]+)/);
    if (!m) return '';
    const file = decodeURIComponent(m[2]);
    return m[1] === 'avatar' ? `/characters/${encodeURIComponent(file)}` : `/User Avatars/${encodeURIComponent(file)}`;
}
function upgradeAvatars(root) {
    (root || document).querySelectorAll('#chat .mes .avatar img').forEach(img => {
        const full = fullSrc(img.getAttribute('src'));
        if (!full) return;
        img.dataset.lfThumb = img.getAttribute('src');
        img.onerror = () => { if (img.dataset.lfThumb) { img.onerror = null; img.src = img.dataset.lfThumb; } };
        img.src = full;
    });
}
function syncAvatars(on) {
    const chat = document.getElementById('chat');
    if (!on) { avaObs?.disconnect(); avaObs = null; return; }
    if (!chat) return;
    upgradeAvatars(chat);
    if (avaObs) return;
    let t = null;
    avaObs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => upgradeAvatars(chat), 120); });
    avaObs.observe(chat, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

// ───────────── язычок ─────────────

function syncEdge() {
    const c = cc();
    const on = api.settings().enabled !== false && c.on;
    let el = document.getElementById('lf-edge');
    if (!on) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('div');
        el.id = 'lf-edge';
        el.setAttribute('role', 'button');
        el.title = 'Пульт';
        document.body.append(el);
        bindEdge(el);
    }
    el.className = c.side === 'right' ? 'right' : 'left';
    el.innerHTML = icon(c.side === 'right' ? 'chevL' : 'chevR');
    el.style.top = `${Math.min(88, Math.max(8, Number(c.top) || 50))}vh`;
}

function bindEdge(el) {
    let st = null;
    el.addEventListener('pointerdown', (e) => {
        st = { x: e.clientX, y: e.clientY, top: Number(cc().top) || 50, mode: '' };
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('press');
    });
    el.addEventListener('pointermove', (e) => {
        if (!st) return;
        const dx = e.clientX - st.x, dy = e.clientY - st.y;
        const out = cc().side === 'right' ? -dx : dx;
        if (!st.mode) {
            if (out > 18 && Math.abs(out) > Math.abs(dy)) st.mode = 'pull';
            else if (Math.abs(dy) > 10) st.mode = 'drag';
        }
        if (st.mode === 'drag') {
            const t = Math.min(88, Math.max(8, st.top + (dy / window.innerHeight) * 100));
            el.style.top = `${t}vh`;
            st.now = t;
        } else if (st.mode === 'pull') {
            el.style.transform = `translateX(${(cc().side === 'right' ? -1 : 1) * Math.min(24, out / 3)}px)`;
        }
    });
    const end = () => {
        if (!st) return;
        el.classList.remove('press');
        el.style.transform = '';
        if (st.mode === 'drag') { cc().top = Math.round(st.now ?? st.top); api.saveSettings(); }
        else openCC();
        st = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { st = null; el.classList.remove('press'); el.style.transform = ''; });
}

// ───────────── пульт ─────────────

let ccOpenedAt = 0;

function buildCC() {
    if (document.getElementById('lf-cc')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'lf-cc';
    dlg.innerHTML = `<div id="lf-cc-app"><div class="cc-scroll"><div class="cc-body"></div></div><div class="cc-sheet-host"></div></div>`;
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!closeSheet()) closeCC(); });
    dlg.addEventListener('click', onCCClick);
    dlg.addEventListener('change', onCCChange);
    dlg.addEventListener('input', onCCInput);
    // тап по пустому месту — закрыть
    dlg.querySelector('#lf-cc-app').addEventListener('click', (e) => {
        if (e.target.classList.contains('cc-scroll') || e.target.classList.contains('cc-body')) { if (Date.now() - ccOpenedAt > 400) closeCC(); }
    });
    // смахнуть к своему краю — закрыть; смахнуть вверх, когда пульт уже долистан до низа, — тоже
    let t0 = null;
    const scroller = () => dlg.querySelector('.cc-scroll');
    dlg.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1 || e.target.closest('.cc-sheet-host.on, input, select, .cc-chips:not(.wrap)')) { t0 = null; return; }
        const sc = scroller();
        t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, top: sc.scrollTop, atBottom: sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4 };
    }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
        if (!t0) return;
        const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y;
        const toEdge = cc().side === 'right' ? dx : -dx;
        const sc = scroller();
        if (toEdge > 80 && Math.abs(dx) > Math.abs(dy) * 1.8) closeCC();
        else if (t0.atBottom && sc.scrollTop === t0.top && -dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.8) closeCC();
        t0 = null;
    }, { passive: true });
    document.body.append(dlg);
}

export function openCC() {
    if (!api) return;
    ccOpenedAt = Date.now();
    buildCC();
    renderCC();
    const dlg = document.getElementById('lf-cc');
    dlg.classList.toggle('from-right', cc().side === 'right');
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('on')));
}

export function closeCC() {
    const dlg = document.getElementById('lf-cc');
    if (!dlg) return;
    closeSheet();
    dlg.classList.remove('on');
    const t = ccOpenedAt;
    setTimeout(() => { if (dlg.open && ccOpenedAt === t && !dlg.classList.contains('on')) dlg.close(); }, 320);
}

function agentOn(a) {
    const ext = ctx().extensionSettings || {};
    if (a.key === 'life.chron') return api.settings().chron?.on !== false && api.settings().enabled !== false;
    const s = ext[a.key];
    return s ? s.enabled !== false : null;
}

function profilesInfo() {
    const cm = ctx().extensionSettings?.connectionManager;
    return { list: Array.isArray(cm?.profiles) ? cm.profiles : [], selected: cm?.selectedProfile || '' };
}

// кнопки над вводом: Quick Reply, скрипты Tavern Helper (у них тот же класс qr--button), Guided Generations
const QB_SEL = '#send_form .qr--button, #qr--popout .qr--button, #gg-regular-buttons-container .gg-action-button';

function quickButtons() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll(QB_SEL).forEach((el, i) => {
        if (el.closest('#lf-cc')) return;
        const label = (el.querySelector('.qr--button-label')?.textContent || el.textContent || el.title || '').replace(/\s+/g, ' ').trim()
            || (el.title || '').trim();
        const ic = faClass(el.querySelector('.qr--button-icon') || el);
        if (!label && !ic) return;
        const k = `${label}|${ic}`;
        if (seen.has(k)) return;
        seen.add(k);
        el.dataset.lfQr = String(i);
        out.push({ i, label, ic, title: el.title || '' });
    });
    return out;
}

function faClass(el) {
    const node = el?.matches?.('.fa-solid, .fa-regular, .fa') ? el : el?.querySelector?.('.fa-solid, .fa-regular, .fa, i');
    return [...(node?.classList || [])].find(c => /^fa-(?!solid|regular|fw|lg|xl|brands)/.test(c)) || '';
}

// пункты из волшебной палочки (меню расширений ST), кроме самого Life
function wandItems() {
    const out = [];
    document.querySelectorAll('#extensionsMenu .list-group-item, #extensionsMenu > div:not(.extension_container)').forEach((el, i) => {
        if (/^lf-/.test(el.id) || el.style.display === 'none' || el.classList.contains('displayNone')) return;
        const label = (el.textContent || el.title || '').replace(/\s+/g, ' ').trim();
        if (!label) return;
        el.dataset.lfWand = String(i);
        out.push({ i, label, ic: faClass(el) });
    });
    return out;
}

function fabItems() {
    return FABS.filter(([sel]) => document.querySelector(sel)).map(([, sel, ic, label]) => ({ sel, ic, label }));
}

function extBlocks() {
    const eb = ctx().extensionSettings?.ExtBlocks;
    const set = eb?.sets?.[eb.active_set_idx] || eb?.sets?.find(x => x.name === eb.active_set);
    return (set?.global_blocks || []).filter(b => b?.name && b.enabled !== false);
}

function toggleTile(key, label, ic, on, extra = '') {
    return `<button class="cc-tog${on ? ' on' : ''}${on === null ? ' na' : ''}" data-cc="toggle" data-k="${esc(key)}" ${extra}>
        <span class="cc-tog-ic">${icon(ic)}</span><span class="cc-tog-l">${esc(label)}</span>
    </button>`;
}

function renderCC() {
    const host = document.querySelector('#lf-cc .cc-body');
    if (!host) return;
    const c = cc();
    const s = api.settings();
    const st = api.worldState();
    const list = api.chapters();
    const fch = api.focusChapter(list) || list[list.length - 1];
    const cover = fch ? api.chapterCover(fch) : '';
    const time = st.timestamp?.story_time || '';
    const date = [api.weekday(st.timestamp?.story_date), st.timestamp?.story_date].filter(Boolean).join(', ');
    const loc = st.scene?.location || fch?.loc || '';
    const { list: profs, selected } = profilesInfo();
    const qbs = quickButtons();
    const blocks = extBlocks();
    const bal = api.balance?.() || '';
    const wand = wandItems();
    const fabs = c.hideFabs ? fabItems() : [];
    host.innerHTML = `
    <div class="cc-head">
        <div class="cc-time">
            <b>${esc(time || '—:—')}</b>
            <span>${esc(date || 'дата не записана')}</span>
            ${st.scene?.atmosphere || loc ? `<small>${esc([api.weatherWord(st.scene?.atmosphere), loc ? api.placeName(api.locTop(loc)) : ''].filter(Boolean).join(' · '))}</small>` : ''}
            ${bal ? `<button class="cc-money" data-cc="money">${icon('wallet')} ${esc(bal)}</button>` : ''}
        </div>
        <button class="cc-x" data-cc="close">${icon('x')}</button>
    </div>

    <div class="cc-grid">
        <button class="cc-tile cc-scene" data-cc="scene"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>
            <span class="cc-scene-in"><i>${fch ? `Глава ${String(fch.num).padStart(2, '0')}` : 'Сцена'}</i><b>${esc(fch?.title || 'Сцена')}</b><small>${esc(loc ? api.placeName(api.locTop(loc)) : '')}</small></span>
        </button>
        <button class="cc-tile" data-cc="map">${icon('map')}<span>Карта</span></button>
        <button class="cc-tile" data-cc="person">${icon('users')}<span>Персонаж</span></button>
        <button class="cc-tile" data-cc="wardrobe">${icon('shirt')}<span>Гардероб</span></button>
        <button class="cc-tile" data-cc="phone">${icon('smartphone')}<span>Телефон</span></button>
        <button class="cc-tile" data-cc="director">${icon('scene')}<span>Режиссёр</span></button>
        <button class="cc-tile" data-cc="newch">${icon('feather')}<span>Глава</span></button>
        <button class="cc-tile" data-cc="world">${icon('globe')}<span>Память</span></button>
        <button class="cc-tile" data-cc="morning">${icon('sunrise')}<span>Утро</span></button>
    </div>

    ${api.moodHtml ? (() => { const h = api.moodHtml(); return h ? `<div class="cc-label">Настроение сцены</div>${h}` : ''; })() : ''}

    <div class="cc-label">Чат</div>
    <div class="cc-row">${CHAT_ACTS.map(([id, ic, l]) => `<button class="cc-tog act" data-cc="chat" data-v="${id}"><span class="cc-tog-ic">${icon(ic)}</span><span class="cc-tog-l">${l}</span></button>`).join('')}</div>

    ${qbs.length ? `<div class="cc-label">Кнопки</div>
    <div class="cc-chips wrap">${qbs.map(q => `<button class="cc-chip btn" data-cc="qr" data-v="${q.i}" title="${esc(q.title)}">${q.ic ? `<i class="fa-solid ${esc(q.ic)}"></i>` : ''}${esc(q.label)}</button>`).join('')}</div>` : ''}

    ${blocks.length ? `<div class="cc-label">ExtBlocks</div>
    <div class="cc-chips wrap">${blocks.map(b => `<button class="cc-chip btn" data-cc="block" data-v="${esc(b.name)}" data-t="${esc(b.block_type || '')}">${icon(b.block_type === 'rewrite' ? 'pencil' : b.block_type === 'script' ? 'zap' : 'blocks')}${esc(b.name)}</button>`).join('')}</div>` : ''}

    <div class="cc-label">Агенты</div>
    <div class="cc-row">${AGENTS.map(a => toggleTile(a.key, a.label, a.icon, agentOn(a))).join('')}</div>

    ${profs.length ? `<div class="cc-label">Модель</div>
    <div class="cc-chips">${profs.map(p => `<button class="cc-chip${p.id === selected ? ' on' : ''}" data-cc="profile" data-v="${esc(p.name)}">${esc(p.name)}</button>`).join('')}</div>` : ''}

    ${fabs.length || wand.length ? `<div class="cc-label">Расширения</div>
    <div class="cc-chips wrap">${fabs.map(f => `<button class="cc-chip" data-cc="fab" data-v="${esc(f.sel)}">${icon(f.ic)}${esc(f.label)}</button>`).join('')}${wand.map(w => `<button class="cc-chip" data-cc="wand" data-v="${w.i}">${w.ic ? `<i class="fa-solid ${esc(w.ic)}"></i>` : icon('puzzle')}${esc(w.label)}</button>`).join('')}</div>` : ''}

    <div class="cc-label">Вид</div>
    <div class="cc-row">
        ${toggleTile('cc.theme', c.theme ? (PALETTES.find(p => p[0] === c.palette) || PALETTES[0])[1] : 'Тема выкл', 'palette', c.theme)}
        ${toggleTile('cc.bg', c.bg === 'flat' ? 'Без фона' : c.bg === 'dim' ? 'Фон тише' : 'Фон как есть', 'image', c.bg !== 'off')}
        ${toggleTile('cc.scene', 'Фон сцены', 'film', !!api.sceneBg?.())}
        ${toggleTile('cc.ava', c.ava === 'wide' ? 'Баннер' : c.ava === 'big' ? 'Портрет' : 'Аватарки', 'user', c.ava !== 'off')}
        ${toggleTile('cc.detail', 'Детали', 'image', !!api.detail?.())}
        ${toggleTile('cc.read', 'Чтение', 'book', c.read)}
        ${toggleTile('cc.qrShown', 'Над вводом', 'keyboard', !c.qrHidden)}
        ${toggleTile('cc.fabs', 'Плавающие', 'pointer', !c.hideFabs)}
    </div>
    ${c.read ? `<div class="cc-slider"><span>${icon('type')} Текст</span><input type="range" min="14" max="24" step="1" value="${c.fs}" data-cc-set="fs"><b>${c.fs}</b></div>
        <div class="cc-slider"><span>${icon('menu')} Строки</span><input type="range" min="1.3" max="2.2" step="0.05" value="${c.lh}" data-cc-set="lh"><b>${c.lh}</b></div>` : ''}

    <div class="cc-label">Кабинет</div>
    <div class="cc-grid small">
        <button class="cc-tile" data-cc="lore">${icon('book')}<span>Лорбуки</span></button>
        <button class="cc-tile" data-cc="preset">${icon('sliders')}<span>Пресет</span></button>
        <button class="cc-tile" data-cc="days">${icon('calendar')}<span>Дни</span></button>
        <button class="cc-tile" data-cc="edge">${icon(c.side === 'right' ? 'chevL' : 'chevR')}<span>${c.side === 'right' ? 'Справа' : 'Слева'}</span></button>
    </div>
    <div class="cc-foot">Life ${esc(api.version || '')} · <span>смахни к краю или тапни по пустому — закроется</span></div>`;
}

async function slash(cmd) {
    try { await ctx().executeSlashCommandsWithOptions?.(cmd); } catch (e) { api.toast('warning', esc(String(e?.message || e))); }
}

function setAgent(a, on) {
    const ext = ctx().extensionSettings;
    if (a.key === 'life.chron') { api.settings().chron.on = on; api.saveSettings(); return; }
    if (a.cmd) return slash(`/${a.cmd} ${on ? 'on' : 'off'}`);
    const box = a.box && document.getElementById(a.box);
    if (box) { box.checked = on; box.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (ext[a.key]) { ext[a.key].enabled = on; ctx().saveSettingsDebounced(); }
}

async function onCCClick(ev) {
    const el = ev.target.closest('[data-cc]');
    if (!el) return;
    const act = el.dataset.cc;
    const c = cc();
    const goLife = (tab, after) => { closeCC(); setTimeout(() => { api.openHub(tab); if (after) setTimeout(after, 380); }, 280); };
    switch (act) {
        case 'close': closeCC(); break;
        case 'money': closeCC(); setTimeout(() => api.openMoney?.(), 280); break;
        case 'mood': api.setMood?.(el.dataset.v); renderCC(); break;
        case 'intim': api.cycleIntim?.(); renderCC(); break;
        case 'tone': api.setTone?.(el.dataset.v); renderCC(); break;
        case 'iopt': api.toggleIntimOpt?.(el.dataset.v); renderCC(); break;
        case 'sheet-close': closeSheet(); break;
        case 'scene': goLife('scene'); break;
        case 'map': goLife('map'); break;
        case 'person': goLife('person'); break;
        case 'world': goLife('world'); break;
        case 'director': goLife('scene', api.directorSheet); break;
        case 'newch': goLife('scene', () => api.newChapterSheet()); break;
        case 'morning': goLife('scene', () => api.newChapterSheet({ title: 'Утро', note: 'Прошла ночь, наступило утро.' })); break;
        case 'wardrobe': {
            closeCC();
            setTimeout(() => { if (window.Wardrobe?.open) window.Wardrobe.open('worn'); else slash('/wardrobe'); }, 300);
            break;
        }
        case 'phone': {
            closeCC();
            setTimeout(async () => {
                try { (await import('/scripts/extensions/third-party/Phone-ST/ui.js')).openPhone(); }
                catch { document.getElementById('gp-fab')?.click(); }
            }, 300);
            break;
        }
        case 'toggle': {
            const k = el.dataset.k;
            const a = AGENTS.find(x => x.key === k);
            if (a) { const on = !agentOn(a); el.classList.toggle('on', on); await setAgent(a, on); setTimeout(renderCC, 400); break; }
            if (k === 'cc.theme') {
                // Графит → Бумага → Луна → выкл → Графит
                if (!c.theme) { c.theme = true; c.palette = 'graphite'; }
                else { const i = PALETTES.findIndex(p => p[0] === c.palette); if (i >= PALETTES.length - 1) c.theme = false; else c.palette = PALETTES[i + 1][0]; }
            }
            else if (k === 'cc.detail') api.detail?.(!api.detail?.());
            else if (k === 'cc.bg') c.bg = c.bg === 'dim' ? 'flat' : c.bg === 'flat' ? 'off' : 'dim';
            else if (k === 'cc.scene') api.sceneBg?.(!api.sceneBg?.());
            else if (k === 'cc.ava') c.ava = c.ava === 'wide' ? 'big' : c.ava === 'big' ? 'off' : 'wide';
            else if (k === 'cc.read') c.read = !c.read;
            else if (k === 'cc.qrShown') c.qrHidden = !c.qrHidden;
            else if (k === 'cc.fabs') c.hideFabs = !c.hideFabs;
            api.saveSettings();
            applyTheme();
            renderCC();
            break;
        }
        case 'profile': {
            el.parentElement.querySelectorAll('.cc-chip').forEach(x => x.classList.toggle('on', x === el));
            await slash(`/profile "${el.dataset.v.replace(/"/g, '\\"')}"`);
            api.toast('success', `Модель: ${esc(el.dataset.v)}`, '✦ Пульт', { timeOut: 1500 });
            setTimeout(renderCC, 900);
            break;
        }
        case 'qr': {
            const orig = [...document.querySelectorAll(QB_SEL)].find(x => x.dataset.lfQr === el.dataset.v);
            if (!orig) { api.toast('info', 'Кнопка пропала — открой пульт заново'); break; }
            closeCC();
            setTimeout(() => orig.click(), 250);
            break;
        }
        case 'chat': {
            const id = el.dataset.v;
            closeCC();
            setTimeout(() => { const $ = window.jQuery; if ($) $(`#${id}`).trigger('click'); else document.getElementById(id)?.click(); }, 260);
            break;
        }
        case 'fab': {
            const sel = el.dataset.v;
            closeCC();
            setTimeout(() => document.querySelector(sel)?.click(), 260);
            break;
        }
        case 'wand': {
            const orig = document.querySelector(`#extensionsMenu [data-lf-wand="${CSS.escape(el.dataset.v)}"]`);
            closeCC();
            if (orig) setTimeout(() => orig.click(), 260);
            break;
        }
        case 'block': {
            const n = el.dataset.v.replace(/"/g, '\\"');
            const t = el.dataset.t;
            closeCC();
            await slash(t === 'rewrite' ? `/extblocks-rewrite name="${n}"` : t === 'script' ? `/extblocks-execute-script name="${n}"` : `/extblocks-generate name="${n}"`);
            break;
        }
        case 'edge': { c.side = c.side === 'right' ? 'left' : 'right'; api.saveSettings(); syncEdge(); renderCC(); break; }
        case 'lore': await loreSheet(); break;
        case 'preset': presetSheet(); break;
        case 'days': await daysSheet(); break;
        case 'lore-entry': el.closest('.cc-card')?.classList.toggle('open'); break;
        case 'days-entry': el.classList.toggle('open'); break;
        case 'days-order': { c.newestFirst = !c.newestFirst; api.saveSettings(); await daysSheet(); break; }
    }
}

function onCCInput(ev) {
    const el = ev.target;
    if (el.dataset.ccSet) {
        const c = cc();
        c[el.dataset.ccSet] = Number(el.value);
        const out = el.parentElement.querySelector('b');
        if (out) out.textContent = el.value;
        applyTheme();
        api.saveSettings();
    }
    if (el.dataset.ccSearch !== undefined) sheetFilter?.(el.value);
}

async function onCCChange(ev) {
    const el = ev.target;
    if (el.dataset.loreUid !== undefined) await toggleLoreEntry(el);
    if (el.dataset.pm !== undefined) {
        const li = document.querySelector(`#completion_prompt_manager_list li[data-pm-identifier="${CSS.escape(el.dataset.pm)}"]`);
        li?.querySelector('.prompt-manager-toggle-action')?.click();
        setTimeout(() => sheetFilter?.(document.querySelector('#lf-cc [data-cc-search]')?.value || ''), 300);
    }
    if (el.dataset.ccPreset !== undefined) {
        const sel = document.getElementById('settings_preset_openai');
        if (sel) { window.jQuery?.(sel).val(el.value).trigger('change'); setTimeout(presetSheet, 900); }
    }
    if (el.dataset.ccBook !== undefined) { loreState.book = el.value; await loreSheet(); }
}

// ───────────── листы пульта (бывший Кабинет) ─────────────

let sheetFilter = null;

function openSheet(title, html) {
    const host = document.querySelector('#lf-cc .cc-sheet-host');
    if (!host) return null;
    host.innerHTML = `<div class="cc-sheet-back" data-cc="sheet-close"></div><div class="cc-sheet"><div class="cc-sheet-head"><b>${title}</b><button class="cc-x" data-cc="sheet-close">${icon('x')}</button></div><div class="cc-sheet-body">${html}</div></div>`;
    host.classList.add('on');
    requestAnimationFrame(() => host.classList.add('in'));
    return host.querySelector('.cc-sheet-body');
}

function closeSheet() {
    const host = document.querySelector('#lf-cc .cc-sheet-host');
    if (!host?.classList.contains('on')) return false;
    host.classList.remove('in');
    setTimeout(() => { host.classList.remove('on'); host.innerHTML = ''; }, 220);
    sheetFilter = null;
    return true;
}

async function WI() {
    try { return await import('../../../world-info.js'); } catch { return null; }
}

async function activeBooks(wi) {
    const c = ctx();
    const set = new Set();
    // сначала лорбук чата, потом персонажей, потом глобальные
    if (c.chatMetadata?.world_info) set.add(c.chatMetadata.world_info);
    const chars = c.characters || [];
    let members = [];
    if (c.groupId) {
        const g = (c.groups || []).find(x => String(x.id) === String(c.groupId));
        members = (g?.members || []).map(a => chars.find(ch => ch.avatar === a)).filter(Boolean);
    } else if (c.characterId !== undefined && chars[c.characterId]) members = [chars[c.characterId]];
    const charLore = wi.world_info?.charLore || [];
    for (const ch of members) {
        if (ch.data?.extensions?.world) set.add(ch.data.extensions.world);
        const extra = charLore.find(e => e.name === ch.avatar || e.name === String(ch.avatar).replace(/\.[^/.]+$/, ''))?.extraBooks || [];
        extra.forEach(n => n && set.add(n));
    }
    (wi.selected_world_info || []).forEach(n => n && set.add(n));
    const names = wi.world_names || [];
    return [...set].filter(n => names.includes(n));
}

const isMemoryEntry = (e) => !!e?.stmemorybooks || /^\s*\d{1,4}\s*[-–—.:]\s*\S/.test(e?.comment || '');
const loreState = { book: '', data: null };

async function loreSheet() {
    const wi = await WI();
    if (!wi?.loadWorldInfo) { openSheet(`${icon('book')} Лорбуки`, '<div class="cc-empty">Эта версия ST не отдаёт лорбуки расширениям</div>'); return; }
    const all = [...(wi.world_names || [])];
    const active = await activeBooks(wi);
    const rest = all.filter(n => !active.includes(n)).sort((a, b) => a.localeCompare(b));
    if (!loreState.book || !all.includes(loreState.book)) loreState.book = active[0] || all[0] || '';
    const body = openSheet(`${icon('book')} Лорбуки`, `
        <select class="cc-select" data-cc-book>
            ${active.length ? `<optgroup label="Подключены к чату">${active.map(n => `<option value="${esc(n)}" ${n === loreState.book ? 'selected' : ''}>● ${esc(n)}</option>`).join('')}</optgroup>` : ''}
            <optgroup label="Остальные">${rest.map(n => `<option value="${esc(n)}" ${n === loreState.book ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>
        </select>
        <input class="cc-input" type="search" placeholder="Поиск по названию и ключам" data-cc-search>
        <div class="cc-note" data-note></div>
        <div class="cc-list" data-list><div class="cc-empty">Загружаю…</div></div>`);
    if (!body || !loreState.book) return;
    loreState.data = await wi.loadWorldInfo(loreState.book);
    const draw = (q = '') => {
        const entries = Object.values(loreState.data?.entries || {}).sort((a, b) => (a.displayIndex ?? a.uid) - (b.displayIndex ?? b.uid));
        const qq = q.trim().toLowerCase();
        const shown = qq ? entries.filter(e => `${e.comment} ${(e.key || []).join(' ')}`.toLowerCase().includes(qq)) : entries;
        body.querySelector('[data-note]').textContent = `${entries.length} записей · включено ${entries.filter(e => !e.disable).length}`;
        body.querySelector('[data-list]').innerHTML = shown.length ? shown.map(e => `<div class="cc-card${e.disable ? ' off' : ''}">
            <div class="cc-card-main" data-cc="lore-entry">
                <b>${esc(e.comment || '(без названия)')}${e.constant ? '<em>постоянная</em>' : ''}${isMemoryEntry(e) ? '<em class="mem">память</em>' : ''}</b>
                <small>${esc((e.key || []).join(', ') || 'без ключей')}</small>
                <p>${esc(e.content || '')}</p>
            </div>
            <label class="cc-sw"><input type="checkbox" data-lore-uid="${e.uid}" ${e.disable ? '' : 'checked'}><i></i></label>
        </div>`).join('') : '<div class="cc-empty">Ничего не нашлось</div>';
    };
    sheetFilter = draw;
    draw();
}

async function toggleLoreEntry(inp) {
    const wi = await WI();
    const entry = loreState.data?.entries?.[inp.dataset.loreUid];
    if (!wi || !entry) return;
    entry.disable = !inp.checked;
    inp.closest('.cc-card')?.classList.toggle('off', entry.disable);
    try {
        await wi.saveWorldInfo(loreState.book, loreState.data, true);
        try { wi.reloadEditor?.(loreState.book); } catch { /* редактор закрыт */ }
    } catch (e) {
        entry.disable = !entry.disable;
        inp.checked = !entry.disable;
        api.toast('error', `Не сохранилось: ${esc(e?.message || e)}`);
    }
}

function pmItems() {
    return [...document.querySelectorAll('#completion_prompt_manager_list li.completion_prompt_manager_prompt')].map(li => {
        const toggle = li.querySelector('.prompt-manager-toggle-action');
        const nameEl = li.querySelector('[data-pm-name]');
        return {
            id: li.dataset.pmIdentifier,
            name: (nameEl?.dataset.pmName || nameEl?.textContent || li.dataset.pmIdentifier || '').trim(),
            on: toggle ? toggle.classList.contains('fa-toggle-on') : !li.classList.contains('completion_prompt_manager_prompt_disabled'),
            toggle: !!toggle,
            tokens: li.querySelector('[data-pm-tokens]')?.dataset.pmTokens || '',
        };
    }).filter(x => x.id);
}

function presetSheet() {
    const presetSel = document.getElementById('settings_preset_openai');
    const opts = presetSel ? [...presetSel.options].map(o => `<option value="${esc(o.value)}" ${o.selected ? 'selected' : ''}>${esc(o.textContent)}</option>`).join('') : '';
    const items = pmItems();
    const body = openSheet(`${icon('sliders')} Пресет`, `
        ${presetSel ? `<select class="cc-select" data-cc-preset>${opts}</select>` : ''}
        <input class="cc-input" type="search" placeholder="Поиск по блокам" data-cc-search>
        <div class="cc-note">${items.length ? `Блоков: ${items.length} · включено ${items.filter(i => i.on).length}` : 'Список блоков пуст — открой разок панель пресета в ST и вернись сюда'}</div>
        <div class="cc-list" data-list></div>`);
    if (!body) return;
    const draw = (q = '') => {
        const cur = pmItems().filter(i => !q || i.name.toLowerCase().includes(q.toLowerCase()));
        body.querySelector('[data-list]').innerHTML = cur.map(i => `<div class="cc-card slim${i.on ? '' : ' off'}">
            <div class="cc-card-main"><b>${esc(i.name)}</b>${Number(i.tokens) > 0 ? `<small>${esc(i.tokens)} ток.</small>` : ''}</div>
            ${i.toggle ? `<label class="cc-sw"><input type="checkbox" data-pm="${esc(i.id)}" ${i.on ? 'checked' : ''}><i></i></label>` : '<span class="cc-fixed">всегда</span>'}
        </div>`).join('');
    };
    sheetFilter = draw;
    draw();
}

async function daysSheet() {
    const wi = await WI();
    if (!wi?.loadWorldInfo) { openSheet(`${icon('calendar')} Дни`, '<div class="cc-empty">Эта версия ST не отдаёт лорбуки расширениям</div>'); return; }
    const c = cc();
    const books = await activeBooks(wi);
    const mem = [];
    for (const b of books) {
        const d = await wi.loadWorldInfo(b);
        for (const e of Object.values(d?.entries || {})) {
            if (!isMemoryEntry(e)) continue;
            const m = (e.comment || '').match(/^\s*(\d{1,4})\s*[-–—.:]\s*(.+)$/);
            mem.push({ n: m ? Number(m[1]) : 9999, num: m ? m[1] : '•', title: m ? m[2] : (e.comment || 'Воспоминание'), content: e.content || '', off: !!e.disable });
        }
    }
    const newest = c.newestFirst !== false;
    mem.sort((a, b) => newest ? b.n - a.n : a.n - b.n);
    openSheet(`${icon('calendar')} Дни`, mem.length ? `
        <div class="cc-days-head"><span>${mem.length} отрезков памяти</span><button class="cc-chip" data-cc="days-order">${newest ? 'новые ↑' : 'старые ↑'}</button></div>
        <div class="cc-days">${mem.map(m => `<div class="cc-day${m.off ? ' off' : ''}" data-cc="days-entry"><span class="cc-day-n">${esc(m.num)}</span><div><b>${esc(m.title)}</b><p>${esc(m.content)}</p></div></div>`).join('')}</div>`
        : `<div class="cc-empty">${books.length ? 'В подключённых лорбуках воспоминаний пока нет' : 'К этому чату не подключено ни одного лорбука'}</div>`);
}

// ───────────── старт ─────────────

export function initControl(a) {
    api = a;
    cc();
    applyTheme();
    const again = () => applyTheme();
    setTimeout(again, 1500);
    setTimeout(again, 5000);
    const { eventSource, eventTypes: E } = ctx();
    if (E.APP_READY) eventSource.on(E.APP_READY, again);
    if (E.SETTINGS_LOADED) eventSource.on(E.SETTINGS_LOADED, again);
    // Moonlit и темы ST могут подкинуть свои <style> позже — следим за <head>
    try { new MutationObserver(() => { if (cc().theme && cc().killMoonlit) again(); }).observe(document.head, { childList: true }); } catch { /* */ }
}
