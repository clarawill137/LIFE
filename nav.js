// Навигация хаба (0.67): группы → подгруппы → экраны, с обложками.
// Внизу пять групп: Сцена · Герои · Мир · История · Всё. У группы — «дом» с картинками (портреты, кадры, карта),
// у подгруппы — обложка и её экраны. «Дом» — своя вкладка: ui.tab = 'nv:<группа>'. Поэтому любой переход модуля или
// соседнего расширения (openHub('person'), ui.tab = 'world') сам уводит с «дома» — даже на тот же экран, что был до него.
// Сами экраны прежние: старые id (ui.tab, ui.worldTab, ui.pTab…) не переименованы — навигация только решает, под какой
// группой их показать. Новая вкладка «Мира», о которой дерево не знает, сама встаёт во «Всё → Механика»; новая вкладка
// внизу хаба (TABS в index.js) — чипом во «Всё». Упала навигация — хаб возвращается к прежним пяти вкладкам.
// Выключатель: «Всё» внизу, Мир → ⚙ → «Прочее», /life nav.
// В index.js только крючки: navKey/navSync/navHomeHtml/navAfter в render, hubMods «nv-», выключатель, команда.

let A = null;
let broken = false;           // навигация упала — до перезагрузки работаем по-старому
let oldBar = null;            // стоковая панель вкладок, пока вместо неё стоит наша
let listening = null;
const extraWorld = new Map(); // вкладки «Мира», которых нет в дереве (их добавили позже): id → подпись
const extraTabs = new Map();  // вкладки нижней панели, которых нет в дереве: id → { t, svg }

const HOME = 'nv:';
const STOCK = ['scene', 'map', 'person', 'people', 'world'];
/** Куда ведёт чужая кнопка на «доме» (питомец, малыш соседнего модуля) и куда уходим с «дома», если навигацию выключили. */
const BASE = { heroes: 'person', world: 'world', story: 'scene', all: 'world' };
/** Кнопки на «доме», после которых «дом» остаётся: лист поверх, просмотр картинки. */
const KEEP = ['lightbox', 'cut-play', 'chapter', 'sheet-close'];

const ICON = { scene: 'scene', heroes: 'users', world: 'globe', story: 'book', all: 'layers' };
const w = (id, t, ic, kw = '') => ({ t, ic, kw, go: { tab: 'world', wt: id } });

/** Дерево. go — куда ведёт экран: старые id. kw — слова для поиска (что лежит внутри экрана). */
const TREE = [
    { id: 'scene', t: 'Сцена', items: [{ t: 'Сцена', ic: 'scene', kw: 'сейчас трекеры мизансцена настроение сюжетка массовка режиссёр кадр главы', go: { tab: 'scene' } }] },
    { id: 'heroes', t: 'Герои', subs: [
        { id: 'cast', t: 'Персонажи', ic: 'user', items: [
            { t: 'Жизнь · Внутри', ic: 'activity', kw: 'сытость силы самочувствие раны состояние', go: { tab: 'person', pt: 'life', lt: 'inner' } },
            { t: 'Жизнь · Поступки', ic: 'gift', kw: 'инициатива задумки подарки', go: { tab: 'person', pt: 'life', lt: 'acts' } },
            { t: 'Жизнь · Характер', ic: 'idcard', kw: 'ядро вкусы любит', go: { tab: 'person', pt: 'life', lt: 'char' } },
            { t: 'Жизнь · Психика', ic: 'brain', kw: 'триггеры осколки памяти привычки камни голос языки узнавание соавтор письма флаги дневник сны', go: { tab: 'person', pt: 'life', lt: 'mind' } },
            { t: 'Жизнь · День', ic: 'clock', kw: 'распорядок', go: { tab: 'person', pt: 'life', lt: 'day' } },
            { t: 'Гардероб', ic: 'shirt', kw: 'одежда комплекты образ', go: { tab: 'person', pt: 'wardrobe' } },
            { t: 'Вещи', ic: 'box', kw: 'инвентарь', go: { tab: 'person', pt: 'items' } },
            { t: 'Гараж', ic: 'car', kw: 'машина мотоцикл', go: { tab: 'person', pt: 'garage' } },
            { t: 'Связи · Общее', ic: 'heart', kw: 'отношения шкалы пары доверие', go: { tab: 'person', pt: 'rel', rt: 'common' } },
            { t: 'Связи · Прожитое', ic: 'rings', kw: 'ступеньки моменты', go: { tab: 'person', pt: 'rel', rt: 'steps' } },
            { t: 'Связи · Карта', ic: 'route', kw: 'граф людей', go: { tab: 'person', pt: 'rel', rt: 'map' } },
            { t: 'Связи · Альбом', ic: 'camera', kw: 'полароиды фото', go: { tab: 'person', pt: 'rel', rt: 'album' } },
            { t: 'Связи · Трое', ic: 'triangle', kw: 'треугольник', go: { tab: 'person', pt: 'rel', rt: 'tri' } },
            { t: 'Связи · Секреты', ic: 'lock', kw: 'тайны кто что знает легенда', go: { tab: 'person', pt: 'rel', rt: 'secrets' } },
            { t: 'Связи · История', ic: 'book', kw: '', go: { tab: 'person', pt: 'rel', rt: 'history' } },
        ] },
        { id: 'folk', t: 'Люди мира', ic: 'users', items: [
            { t: 'Люди', ic: 'users', kw: 'нпс досье знакомые за кадром повестки', go: { tab: 'people' } },
            w('kin', 'Семья', 'crown', 'родословная дерево родня'),
        ] },
    ] },
    { id: 'world', t: 'Мир', subs: [
        { id: 'places', t: 'Места', ic: 'map', items: [
            { t: 'Карта', ic: 'pin', kw: 'район места кто где маршрут дом комнаты план', go: { tab: 'map' } },
            { t: 'Атлас', ic: 'map', kw: 'районы города страны', go: { tab: 'map', atlas: 1 } },
        ] },
        { id: 'time', t: 'Время', ic: 'clock', items: [
            w('cal', 'Календарь', 'calendar', 'события планы платежи годовщины праздники'),
            w('time', 'Часы и перемотка', 'clock', 'перемотка сезон эпоха погода скачок'),
        ] },
        { id: 'soc', t: 'Общество', ic: 'news', items: [
            w('rumors', 'СМИ', 'news', 'газета таблоид тв слухи'),
            w('city', 'Город', 'building', 'афиша цены сеть'),
            w('heroes', 'Герои и маски', 'shield', 'тайна личности костюм популярность подвиги мемориалы'),
            w('fac', 'Фракции', 'flag', 'группы отношение'),
        ] },
    ] },
    { id: 'story', t: 'История', subs: [
        { id: 'arch', t: 'Главы', ic: 'folder', items: [
            { t: 'Все главы', ic: 'folder', kw: 'архив сцен', go: { tab: 'scene', ch: 1 } },
        ] },
        { id: 'frames', t: 'Кадры', ic: 'film', items: [
            w('gallery', 'Кадры и кат-сцены', 'film', 'галерея картинки детали'),
        ] },
        { id: 'chron', t: 'Хроника', ic: 'book', items: [
            w('days', 'Дни', 'calendar', 'итоги дней лестница хроники ранее'),
            w('events', 'События', 'spark', 'эхо решений'),
            w('codex', 'Свод', 'book', 'вся история'),
            w('arch', 'Архив', 'activity', 'цифры статистика настроение атлас мест'),
        ] },
    ] },
    { id: 'all', t: 'Всё', subs: [
        { id: 'mech', t: 'Механика', ic: 'sliders', items: [
            w('state', 'Летописец', 'spark', 'инвентарь свежесть ляп-фикс звонок планы'),
            w('taste', 'Вкус', 'star', 'штампы золотые посты реролл темп'),
            w('rules', 'Правила', 'notes', 'правила сцены'),
            w('cfg', 'Настройки', 'settings', 'выключатели модули'),
        ] },
    ] },
];

const WINS = { personas: ['Персоны', 'idcard'], books: ['Лорбуки', 'book'], exts: ['Расширения', 'puzzle'], link: ['Подключение', 'plug'] };

const group = (id) => TREE.find(g => g.id === id);
const esc = (v) => A.esc(v);
const icon = (n, c) => A.icon(n, c);

function cfg() {
    const s = A.settings();
    if (!s.nav || typeof s.nav !== 'object') s.nav = { on: true };
    return s.nav;
}

export function initNav(api) {
    A = api;
    cfg();
}

/** Новая навигация включена и жива. */
export function navOn() {
    if (!A || broken) return false;
    return cfg().on !== false;
}

/** Открыт «дом» какой группы ('' — обычный экран). */
const homeOf = () => { const t = String(A?.ui?.tab || ''); return t.startsWith(HOME) ? t.slice(HOME.length) : ''; };

/** Уйти с «дома» на прежний экран группы (навигацию выключили или она упала). */
function leaveHome() { const h = homeOf(); if (h) A.ui.tab = BASE[h] || 'scene'; }

/** Что-то сломалось внутри навигации: хаб не роняем, возвращаем старые вкладки. */
function fail(where, e) {
    console.error(`[Life] навигация: ${where}`, e);
    if (broken) return;
    broken = true;
    try { leaveHome(); swapBar(document.getElementById('lf-app')); } catch { /* */ }
    try { A.toast('warning', 'Навигация группами споткнулась — вернула старые вкладки. Сделай скрин консоли и кинь Claude.', '✦ Life', { timeOut: 7000 }); } catch { /* */ }
    setTimeout(() => { try { if (A.ui.open) A.render(); } catch { /* */ } }, 0);
}

/** Выключатель в Мир → ⚙ (и на «Всё»). */
export function navCfgHtml() {
    return `<label class="lf-switch"><input type="checkbox" data-set="nav.on" ${cfg().on !== false ? 'checked' : ''}><span></span>Навигация группами: Сцена · Герои · Мир · История · Всё</label>`;
}

/** /life nav — переключить. */
export function navToggle() {
    const c = cfg();
    c.on = c.on === false;
    broken = false;
    A.saveSettings();
    if (!c.on) leaveHome();
    if (A.ui.open) A.render();
    return c.on;
}

// ───────────── где мы ─────────────

/** Экран «Мира» → [группа, подгруппа]. Незнакомая вкладка — во «Всё → Механика». */
function worldPlace(wt) {
    for (const g of TREE) for (const sb of g.subs || []) if (sb.items.some(it => it.go.tab === 'world' && it.go.wt === wt)) return [g, sb];
    const all = group('all');
    return [all, all.subs[0]];
}

/** Группа и подгруппа открытого сейчас экрана. */
function here() {
    const u = A.ui;
    const h = homeOf();
    if (h) return [group(h) || group('scene'), null];
    if (u.tab === 'person') return [group('heroes'), null];
    if (u.tab === 'people') return [group('heroes'), group('heroes').subs[1]];
    if (u.tab === 'map') return [group('world'), group('world').subs[0]];
    if (u.tab === 'world') return worldPlace(u.worldTab);
    if (extraTabs.has(u.tab)) return [group('all'), null];
    return [group('scene'), null];
}

/** Вкладки «Мира» этой подгруппы (с незнакомыми — у «Механики»). */
function worldTabsOf(sb) {
    const own = sb.items.filter(it => it.go.tab === 'world').map(it => it.go.wt);
    return sb.id === 'mech' ? [...own, ...extraWorld.keys()] : own;
}

/** Для render(): ключ страницы «дома» ('nv:<группа>') или '' — обычный экран. */
export function navKey() {
    try {
        if (!A) return '';
        const h = homeOf();
        if (!h) return '';
        if (!navOn() || !group(h)?.subs) { leaveHome(); return ''; }
        return HOME + h;
    } catch (e) { fail('ключ', e); return ''; }
}

// ───────────── панель внизу ─────────────

function barHtml() {
    return `${TREE.map(g => `<button class="lf-tab" data-act="nv-g" data-g="${g.id}">${icon(ICON[g.id])}<span>${g.t}</span></button>`).join('')}<i class="lf-tab-ink"></i>`;
}

/** Поставить нашу панель вместо стоковой или вернуть стоковую — по выключателю. */
function swapBar(app) {
    if (!app) return;
    const cur = app.querySelector('nav.lf-tabs');
    if (!cur) return;
    const mine = cur.classList.contains('lf-nv');
    const want = navOn();
    if (want && !mine) {
        // вкладки, которые добавили в хаб после нас, — не прячем: они уйдут чипами во «Всё»
        extraTabs.clear();
        for (const b of cur.querySelectorAll('.lf-tab[data-tab]')) {
            const id = b.dataset.tab;
            if (id && !STOCK.includes(id)) extraTabs.set(id, { t: b.textContent.trim() || id, svg: b.querySelector('svg.lf-i')?.outerHTML || '' });
        }
        const nav = document.createElement('nav');
        nav.className = 'lf-tabs lf-nv';
        nav.innerHTML = barHtml();
        oldBar = cur;
        cur.replaceWith(nav);
    } else if (!want && mine && oldBar) {
        // стоковая панель лежала снятой — её подсветка устарела, а render() свою уже отработал по нашей
        [...oldBar.querySelectorAll('.lf-tab')].forEach((b, i) => {
            const on = b.dataset.tab === A.ui.tab;
            b.classList.toggle('on', on);
            if (on) { const ink = oldBar.querySelector('.lf-tab-ink'); if (ink) ink.style.transform = `translateX(${i * 100}%)`; }
        });
        cur.replaceWith(oldBar);
        oldBar = null;
    }
    app.classList.toggle('lf-nv-on', want);
}

/** Панель и свои слушатели (поиск; уход с «дома» по чужой кнопке). Зовётся из navSync на каждом render — ставит один раз. */
function mount(app) {
    try {
        if (!A || !app) return;
        swapBar(app);
        if (listening === app) return;
        listening = app;
        app.addEventListener('input', onInput);
        // Чужая кнопка на «доме» (питомец, малыш соседнего модуля) ведёт на свой экран, но не всегда сама меняет вкладку —
        // до её обработчика ставим вкладку группы, чтобы экран не остался под «домом».
        app.addEventListener('click', (ev) => {
            try {
                const h = homeOf();
                if (!h) return;
                const el = ev.target.closest('[data-act]');
                if (!el || !el.closest('.lf-nv-home') || el.closest('.lf-sheet')) return;
                const act = el.dataset.act || '';
                if (act.startsWith('nv-') || KEEP.includes(act)) return;
                A.ui.tab = BASE[h] || 'scene';
            } catch { /* */ }
        }, true);
    } catch (e) { fail('панель', e); }
}

/** Зовёт render() перед страницей: какая группа горит внизу. */
export function navSync(app) {
    try {
        mount(app);
        if (!navOn()) return;
        const cur = homeOf() || here()[0].id;
        const tabs = [...app.querySelectorAll('nav.lf-nv .lf-tab')];
        tabs.forEach((b, i) => {
            const on = b.dataset.g === cur;
            b.classList.toggle('on', on);
            if (on) { const ink = app.querySelector('nav.lf-nv .lf-tab-ink'); if (ink) ink.style.transform = `translateX(${i * 100}%)`; }
        });
    } catch (e) { fail('подсветка', e); }
}

// ───────────── обложки ─────────────

const bg = (src) => (src ? ` style="background-image:url('${esc(src)}')"` : '');
function pressImg() {
    try { for (const it of [...(A.chatMeta().press || [])].reverse()) { const p = (it.data?.photos || []).find(x => x?.img); if (p) return p.img; } } catch { /* */ }
    return '';
}
function mapImg() {
    try { const s = A.settings(); const r = (s.regions || []).find(x => x.id === A.ui.region) || (s.regions || [])[0]; return r?.map || r?.cover || ''; } catch { return ''; }
}
const curLoc = () => A.worldState().scene?.location || '';

/** Подгруппа: обложка с подписью и её экраны чипами. */
function subCard(g, sb, { cover = '', line = '', big = false, extra = '' } = {}) {
    const first = sb.items[0];
    return `<section class="lf-nv-sub">
        <button class="lf-nv-cover${big ? ' big' : ''}${cover ? '' : ' empty'}" ${goAttrs(first.go)}${bg(cover)}>
            ${cover ? '' : icon(sb.ic, 'xl')}
            <span class="lf-nv-cap"><b>${esc(sb.t)}</b>${line ? `<small>${esc(line)}</small>` : ''}</span>
        </button>
        ${sb.items.length > 1 || extra ? `<div class="lf-chips wrap lf-nv-items">${sb.items.map(it => `<button class="lf-chip" ${goAttrs(it.go)}>${icon(it.ic)} ${esc(it.t)}</button>`).join('')}${extra}</div>` : ''}
    </section>`;
}

function goAttrs(go) {
    return `data-act="nv-go"${Object.entries(go).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`;
}

// ───────────── оформление ─────────────

const OFF_SW = ['#3a3a3c', '#d8d8d8', '#8e8e93', '#b0b0b5', '#636366'];

/** «Оформление» (0.68): темы плитками — маленький экран Life в цветах темы, с портретами из чата. Тап — сразу, без Пульта.
 *  Стоит наверху «Всё» и в «Настройках»: в Пульте (Пульт → Вид) их не находили. */
export function navThemeHtml() {
    const pals = A?.palettes || [];
    if (!pals.length) return '';
    const c = A.settings().cc || {};
    let faces = [];
    try {
        const st = A.worldState();
        const me = A.ctx().name1;
        const names = A.personNames(st);
        const present = (st.scene?.characters_present || []).map(A.canonName);
        const other = names.find(n => !A.sameName(n, me) && present.some(p => A.sameName(p, n))) || names.find(n => !A.sameName(n, me));
        faces = [me, other].filter(Boolean).map(n => A.avatarUrl(n) || '');
    } catch (e) { console.warn('[Life] навигация: портреты для тем', e); }
    const ph = faces.length ? faces.map(src => `<i${bg(src)}></i>`).join('') : '<i></i><i></i>';
    const tile = (k, t, sw, on) => `<button class="lf-nv-pal${on ? ' on' : ''}" data-act="nv-pal" data-v="${esc(k)}" style="--p-bg:${sw[0]};--p-text:${sw[1]};--p-dim:${sw[2]};--p-acc:${sw[3]};--p-fill:${sw[4]}">
        <span class="lf-nv-pal-scr"><i class="k"></i><i class="h"></i><span class="ph">${ph}</span><span class="bar"><b></b><b class="on"></b><b></b><b></b><b></b></span></span>
        <span class="lf-nv-pal-l">${esc(t)}</span></button>`;
    return `${A.sec('Оформление')}
    <div class="lf-nv-pals">${pals.map(([k, t, sw]) => tile(k, t, sw, c.theme !== false && c.palette === k)).join('')}${tile('off', 'Без темы', OFF_SW, c.theme === false)}</div>
    <div class="lf-hint">Баклажан, Слива и Монтажная красят и это окно, и всю Таверну; Графит, Бумага и Луна — только Таверну. Фон, аватарки и чтение — в Пульте.</div>`;
}

// ───────────── «дома» групп ─────────────

function heroesHome() {
    const st = A.worldState();
    const names = A.personNames(st);
    const me = A.ctx().name1;
    const present = (st.scene?.characters_present || []).map(A.canonName);
    const inScene = names.filter(n => present.some(p => A.sameName(p, n)));
    const off = names.filter(n => !inScene.includes(n));
    const face = (n) => {
        const src = A.avatarUrl(n, true) || A.avatarUrl(n);
        const mood = A.moodOf(n, st);
        return `<button class="lf-nv-face${src ? '' : ' empty'}" data-act="nv-go" data-tab="person" data-who="${esc(n)}"${bg(src)}>
            ${src ? '' : `<i>${esc(String(n).trim().charAt(0).toUpperCase())}</i>`}
            <span class="lf-nv-cap"><b>${esc(A.shortName(n))}</b><small>${esc(A.sameName(n, me) ? 'это ты' : mood ? A.cut(mood, 26) : inScene.includes(n) ? 'в сцене' : 'за кадром')}</small></span>
        </button>`;
    };
    let pets = '';
    try { pets = A.petsRow?.('') || ''; } catch (e) { console.warn('[Life] навигация: питомцы', e); }
    const folk = group('heroes').subs[1];
    let npcs = [];
    try { npcs = A.peopleList() || []; } catch { /* */ }
    const npcCover = npcs.map(p => { try { return A.npcImg(p.name); } catch { return ''; } }).find(Boolean) || '';
    return `<div class="lf-pagehead"><h1>Герои</h1><span class="lf-subtitle">${names.length} ${A.plural(names.length, 'персонаж', 'персонажа', 'персонажей')}</span></div>
    ${inScene.length ? `${A.sec('В сцене')}<div class="lf-nv-faces">${inScene.map(face).join('')}</div>` : ''}
    ${off.length ? `${A.sec('За кадром')}<div class="lf-nv-faces">${off.map(face).join('')}</div>` : ''}
    ${!names.length ? '<div class="lf-empty small">В этом чате пока никого.</div>' : ''}
    ${pets ? `${A.sec('Питомцы и малыши')}<div class="lf-people">${pets}</div>` : ''}
    ${A.sec('Люди мира')}
    ${subCard(group('heroes'), folk, { cover: npcCover, line: npcs.length ? `${npcs.length} ${A.plural(npcs.length, 'человек', 'человека', 'человек')} вокруг` : 'пока никого' })}`;
}

function worldHome() {
    const st = A.worldState();
    const g = group('world');
    const loc = curLoc();
    const date = st.timestamp?.story_date || '';
    const time = st.timestamp?.story_time || '';
    const weather = A.weatherWord(st.scene?.atmosphere);
    let places = 0;
    try { places = A.knownLocations().size; } catch { /* */ }
    const placeLine = [loc ? A.placeName(A.locTop(loc)) : '', places ? `${places} ${A.plural(places, 'место', 'места', 'мест')}` : ''].filter(Boolean).join(' · ');
    const [sPlaces, sTime, sSoc] = g.subs;
    return `<div class="lf-pagehead"><h1>Мир</h1></div>
    ${subCard(g, sPlaces, { cover: mapImg() || A.placeCover(loc), line: placeLine, big: true })}
    <section class="lf-nv-sub">
        <button class="lf-nv-cover clock" ${goAttrs(sTime.items[1].go)}>
            <span class="lf-nv-clock"><b>${esc(time || '—:—')}</b><small>${esc([A.weekday(date) || '', date].filter(Boolean).join(', ') || 'дата не записана')}${weather ? ` · ${esc(weather)}` : ''}</small></span>
            <span class="lf-nv-cap"><b>${esc(sTime.t)}</b></span>
        </button>
        <div class="lf-chips wrap lf-nv-items">${sTime.items.map(it => `<button class="lf-chip" ${goAttrs(it.go)}>${icon(it.ic)} ${esc(it.t)}</button>`).join('')}</div>
    </section>
    ${subCard(g, sSoc, { cover: pressImg(), line: 'что говорят и пишут' })}`;
}

function storyHome() {
    const g = group('story');
    const [sArch, sFrames, sChron] = g.subs;
    const list = A.chapters();
    let images = [];
    try { images = A.imgs(); } catch { /* */ }
    const strip = images.slice(-12).reverse();
    let cutsN = 0;
    try { cutsN = (A.chatMeta().cuts || []).length; } catch { /* */ }
    let lastEv = '';
    try { const ev = A.horaeEvents(); lastEv = ev[ev.length - 1]?.event?.summary || ''; } catch { /* */ }
    // главы деревом: день → главы
    const days = [];
    for (const ch of [...list].reverse()) {
        const d = ch.endDate || ch.date || '';
        let day = days[days.length - 1];
        if (!day || day.d !== d) { day = { d, list: [] }; days.push(day); }
        day.list.push(ch);
    }
    const shownDays = days.slice(0, 40);
    const fch = A.focusChapter(list);
    const dayHtml = (day, i) => {
        const covers = day.list.map(c => { try { return A.chapterCover(c); } catch { return ''; } }).filter(Boolean).slice(0, 3);
        return `<details class="lf-nv-day"${i === 0 ? ' open' : ''}>
            <summary>${icon('folder')}<span><b>${esc(A.weekday(day.d) ? `${A.cap(A.weekday(day.d))}, ${day.d}` : day.d || 'Без даты')}</b><small>${day.list.length} ${A.plural(day.list.length, 'глава', 'главы', 'глав')}</small></span>
                <span class="lf-nv-minis">${covers.map(c => `<i${bg(c)}></i>`).join('')}</span>${icon('chevD', 'dim')}</summary>
            <div class="lf-chlist">${day.list.map(c => A.chapterCard(c, fch?.start)).join('')}</div>
        </details>`;
    };
    return `<div class="lf-pagehead"><h1>История</h1><span class="lf-subtitle">${list.length} ${A.plural(list.length, 'глава', 'главы', 'глав')}</span></div>
    ${strip.length ? `<div class="lf-nv-film"><div class="lf-nv-reel">${strip.map(x => `<button data-act="lightbox" data-src="${esc(x.src)}" data-mes="${x.mes}"${bg(x.src)}></button>`).join('')}</div></div>` : ''}
    ${subCard(g, sFrames, { cover: strip[0]?.src || '', line: [images.length ? `${images.length} ${A.plural(images.length, 'кадр', 'кадра', 'кадров')}` : 'пока нет картинок', cutsN ? `${cutsN} ${A.plural(cutsN, 'кат-сцена', 'кат-сцены', 'кат-сцен')}` : ''].filter(Boolean).join(' · ') })}
    ${subCard(g, sChron, { cover: (() => { try { return list.length ? A.chapterCover(list[list.length - 1]) : ''; } catch { return ''; } })(), line: lastEv ? A.cut(lastEv, 60) : 'дни, события, свод' })}
    ${A.sec(sArch.t, `${list.length} · один чат, модель видит всё`)}
    ${shownDays.length ? shownDays.map(dayHtml).join('') : '<div class="lf-empty small">Чат пуст.</div>'}
    ${days.length > shownDays.length ? `<button class="lf-btn ghost full" ${goAttrs(sArch.items[0].go)}>Все главы списком</button>` : ''}`;
}

/** Все экраны плоским списком — для поиска. */
function allItems() {
    const out = [];
    for (const g of TREE) {
        if (g.items) for (const it of g.items) out.push({ ...it, path: g.t });
        for (const sb of g.subs || []) {
            for (const it of sb.items) out.push({ ...it, path: `${g.t} · ${sb.t}` });
            if (sb.id === 'mech') for (const [id, t] of extraWorld) out.push({ t, ic: 'puzzle', kw: '', go: { tab: 'world', wt: id }, path: `${g.t} · ${sb.t}` });
        }
    }
    for (const [id, x] of extraTabs) out.push({ t: x.t, ic: 'puzzle', kw: '', go: { tab: id }, path: 'Всё' });
    return out;
}

const findText = (it) => A.norm(`${it.t} ${it.path} ${it.kw || ''}`);
const matches = (text, q) => { const words = A.norm(q).split(' ').filter(Boolean); return words.every(wd => text.includes(wd)); };
const rowHtml = (it, hide = false) => `<button class="lf-row lf-nv-row" ${goAttrs(it.go)} data-find="${esc(findText(it))}"${hide ? ' hidden' : ''}>${icon(it.ic || 'chevR')}<span><b>${esc(it.t)}</b><small>${esc(it.path)}</small></span>${icon('chevR', 'dim')}</button>`;

function allHome() {
    const g = group('all');
    const q = A.ui.nvQ || '';
    const has = !!A.norm(q);
    // фильтр — и при отрисовке: хаб перерисовывается сам (пост, Horae), а набранное в поиске должно остаться
    const items = allItems();
    const ok = items.map(it => !has || matches(findText(it), q));
    let wins = [];
    try { wins = globalThis.LifeWin?.list?.() || []; } catch { /* */ }
    const winChips = wins.map(id => `<button class="lf-chip" data-act="nv-win" data-id="${esc(id)}">${icon(WINS[id]?.[1] || 'layers')} ${esc(WINS[id]?.[0] || id)}</button>`).join('');
    const tabChips = [...extraTabs].map(([id, x]) => `<button class="lf-chip" ${goAttrs({ tab: id })}>${x.svg || icon('puzzle')} ${esc(x.t)}</button>`).join('');
    const groups = TREE.filter(x => x.subs && x.id !== 'all');
    return `<div class="lf-pagehead"><h1>Всё</h1></div>
    <label class="lf-nv-search">${icon('search')}<input type="search" data-in="nv-q" placeholder="Найти экран: календарь, гардероб, штампы…" value="${esc(q)}" autocomplete="off" enterkeyhint="search"></label>
    <div class="lf-list lf-nv-found"${has ? '' : ' hidden'}>${items.map((it, i) => rowHtml(it, !ok[i])).join('')}<div class="lf-empty small lf-nv-none"${has && !ok.some(Boolean) ? '' : ' hidden'}>Такого экрана нет. Попробуй другое слово.</div></div>
    <div class="lf-nv-rest"${has ? ' hidden' : ''}>
        ${navThemeHtml()}
        ${subCard(g, g.subs[0], { line: 'Летописец, вкус, правила, выключатели', extra: [...extraWorld].map(([id, t]) => `<button class="lf-chip" ${goAttrs({ tab: 'world', wt: id })}>${icon('puzzle')} ${esc(t)}</button>`).join('') })}
        ${tabChips ? `${A.sec('Ещё вкладки')}<div class="lf-chips wrap">${tabChips}</div>` : ''}
        ${A.sec('Окна и вид')}
        <div class="lf-chips wrap">${winChips}<button class="lf-chip" data-act="nv-cc">${icon('sliders')} Пульт и темы</button></div>
        ${groups.map(x => `<details class="lf-nv-day"><summary>${icon(ICON[x.id])}<span><b>${esc(x.t)}</b><small>${x.subs.reduce((n, sb) => n + sb.items.length, 0)} экранов</small></span>${icon('chevD', 'dim')}</summary>
            <div class="lf-list">${x.subs.flatMap(sb => sb.items.map(it => rowHtml({ ...it, path: sb.t }))).join('')}</div></details>`).join('')}
        ${A.sec('Навигация')}
        ${navCfgHtml()}
        <div class="lf-hint">Выключишь — вернутся прежние пять вкладок. Обратно: Мир → ⚙ или команда /life nav.</div>
    </div>`;
}

/** Зовёт render(): страница «дома» группы. */
export function navHomeHtml() {
    const id = homeOf();
    try {
        const html = id === 'heroes' ? heroesHome() : id === 'world' ? worldHome() : id === 'story' ? storyHome() : allHome();
        return `<div class="lf-nv-home" data-g="${esc(id)}">${html}</div>`;
    } catch (e) {
        fail(`дом «${id}»`, e);
        return `<div class="lf-empty small">Навигация споткнулась. Нажми любую вкладку внизу.</div>`;
    }
}

// ───────────── обычный экран: «крошки» и только свои вкладки ─────────────

/** Зовёт render() после страницы. */
export function navAfter(app, body) {
    try {
        if (!navOn() || !body || homeOf()) return;
        const u = A.ui;
        const [g, sb0] = here();
        if (g.id === 'scene') return;
        let sb = sb0;
        if (u.tab === 'world') {
            const segEl = [...body.querySelectorAll('.lf-seg')].find(x => x.querySelector('button[data-act="world-tab"]'));
            if (segEl) {
                const known = new Set(TREE.flatMap(x => (x.subs || []).flatMap(s2 => s2.items.filter(it => it.go.tab === 'world').map(it => it.go.wt))));
                for (const b of segEl.querySelectorAll('button[data-act="world-tab"]')) {
                    const id = b.dataset.v;
                    if (id && !known.has(id) && !extraWorld.has(id)) extraWorld.set(id, b.textContent.trim() || id);
                }
                const mine = new Set(worldTabsOf(sb));
                const names = Object.fromEntries(sb.items.filter(it => it.go.tab === 'world').map(it => [it.go.wt, it.t]));
                let left = 0;
                for (const b of [...segEl.querySelectorAll('button')]) {
                    if (!mine.has(b.dataset.v)) { b.remove(); continue; }
                    left++;
                    // кнопка-шестерёнка без подписи — в короткой полоске ей нужно имя; подписи с цифрами-счётчиками не трогаем
                    if (names[b.dataset.v] && !b.textContent.trim()) b.textContent = names[b.dataset.v];
                }
                if (left <= 1) segEl.remove();
                else { segEl.classList.remove('cfg', 'many'); segEl.classList.add('lf-nv-seg'); if (left > 4) segEl.classList.add('many'); }
                const head = body.firstElementChild;
                if (head?.classList.contains('lf-pagehead')) {
                    const h1 = head.querySelector('h1');
                    const cur = sb.items.find(it => it.go.wt === u.worldTab);
                    if (h1) h1.textContent = left <= 1 ? (cur?.t || extraWorld.get(u.worldTab) || sb.t) : sb.t;
                    head.querySelector('.lf-subtitle')?.remove();
                }
            }
        }
        const gg = group(g.id) || g;
        const crumbs = document.createElement('div');
        crumbs.className = 'lf-nv-crumbs';
        crumbs.innerHTML = `<button class="lf-nv-back" data-act="nv-g" data-g="${gg.id}">${icon('left')}<span>${esc(gg.t)}</span></button>${sb ? `<i>·</i><b>${esc(sb.t)}</b>` : ''}`;
        body.prepend(crumbs);
    } catch (e) { fail('крошки', e); }
}

// ───────────── клики и поиск ─────────────

function goTo(d) {
    const u = A.ui;
    u.editPins = false; u.atlas = !!d.atlas; u.room = ''; u.tracePin = '';
    u.tab = d.tab || 'scene';
    if (d.wt) u.worldTab = d.wt;
    if (d.who) { u.who = d.who; u.item = ''; u.pair = ''; u.wset = ''; }
    if (d.tab === 'people') u.npc = '';
    if (d.pt) u.pTab = d.pt;
    if (d.lt) u.lifeTab = d.lt;
    if (d.rt) u.relTab = d.rt;
    A.closeSheet();
    A.render();
    A.scrollTop?.();
    if (d.ch) setTimeout(() => document.getElementById('lf-chapters')?.scrollIntoView({ behavior: 'smooth' }), 80);
}

export async function navClick(act, el) {
    const u = A.ui;
    if (act === 'nv-g') {
        const g = group(el.dataset.g);
        if (!g) return;
        if (!g.subs) { goTo({ tab: 'scene' }); return; }
        u.tab = HOME + g.id;
        u.editPins = false; u.atlas = false; u.room = ''; u.tracePin = '';
        if (g.id !== 'all') u.nvQ = '';
        A.closeSheet();
        A.render();
        A.scrollTop?.();
        return;
    }
    if (act === 'nv-go') { goTo(el.dataset); return; }
    if (act === 'nv-win') { try { globalThis.LifeWin?.open?.(el.dataset.id); } catch (e) { console.warn('[Life] навигация: окно', e); } return; }
    if (act === 'nv-cc') { try { A.openCC?.(); } catch (e) { console.warn('[Life] навигация: пульт', e); } return; }
    if (act === 'nv-pal') { try { A.setPalette?.(el.dataset.v); } catch (e) { console.warn('[Life] навигация: тема', e); } return; }
}

/** Поиск на «Всё»: фильтруем уже нарисованные строки, без перерисовки (чтобы не терять фокус в поле). */
function onInput(ev) {
    try {
        const el = ev.target;
        if (el?.dataset?.in !== 'nv-q') return;
        const home = el.closest('.lf-nv-home');
        if (!home) return;
        A.ui.nvQ = el.value;
        const has = !!A.norm(el.value);
        const found = home.querySelector('.lf-nv-found');
        const rest = home.querySelector('.lf-nv-rest');
        if (found) found.hidden = !has;
        if (rest) rest.hidden = has;
        if (!found || !has) return;
        let n = 0;
        for (const r of found.querySelectorAll('.lf-nv-row')) {
            const ok = matches(r.dataset.find || '', el.value);
            r.hidden = !ok;
            if (ok) n++;
        }
        const none = found.querySelector('.lf-nv-none');
        if (none) none.hidden = n > 0;
    } catch (e) { console.warn('[Life] навигация: поиск', e); }
}

/** Для тестов: дерево и разбор «где мы». */
export const _nav = { TREE, here, worldPlace, worldTabsOf, allItems, extraWorld, extraTabs, reset: () => { broken = false; oldBar = null; listening = null; extraWorld.clear(); extraTabs.clear(); } };
