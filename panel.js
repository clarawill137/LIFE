// Трекеры: одна полка для всего, что появляется «само, когда к месту». В Сцене — ряд чипов: горит тот, где
// сейчас что-то есть; тап открывает сам трекер или объясняет, когда он оживёт. Последний чип «что где» —
// карта: где лежит каждая из новых штук, с переходом на страницу персонажа.

let A = null;
let list = [];
export function initPanel(api, trackers) { A = api; list = trackers || []; }
const esc = (v) => A.esc(v);

const safe = (f, d = '') => { try { return f?.() ?? d; } catch { return d; } };

const bodyOf = (t) => `${safe(t.html) || `<div class="lf-empty small">${esc(t.idle || 'Сейчас пусто.')}</div>`}${safe(t.extra)}`;

/** Пока открыт лист трекера — подтягивать его содержимое, когда состояние поменялось (тап внутри, ответ Летописца). */
let timer = null;
function watch() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        const w = document.querySelector('.lf-trk-body');
        if (!w) { clearInterval(timer); timer = null; return; }
        if (w.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
        const t = list.find(x => x.id === w.dataset.trk);
        const html = t ? bodyOf(t) : '';
        if (t && w.dataset.sig !== A.hash(html)) { w.dataset.sig = A.hash(html); w.innerHTML = html; }
    }, 700);
}

/** Открыть лист трекера по id (и из других модулей: «Почта» → Счета). */
export function openTracker(id) {
    const t = list.find(x => x.id === id);
    if (!t) return false;
    A.openSheet(`${t.ico} ${esc(t.name)}`, `<div class="lf-hint">${esc(t.hint)}</div><div class="lf-trk-body" data-trk="${t.id}">${bodyOf(t)}</div>`);
    watch();
    return true;
}

export function trackersBar() {
    if (!A?.hasChat?.()) return '';
    const shown = list.filter(t => safe(t.on, true) !== false);
    if (!shown.length) return '';
    return `<div class="lf-trk">${shown.map(t => { const st = safe(t.state); return `<button class="lf-trk-c${st ? ' on' : ''}" data-act="trk-open" data-id="${t.id}"><span>${t.ico}</span><b>${esc(t.name)}</b>${st ? `<small>${esc(st)}</small>` : ''}</button>`; }).join('')}<button class="lf-trk-c map" data-act="trk-map"><span>🧭</span><b>что где</b></button></div>`;
}

function people() {
    const user = A.canonName(A.ctx().name1);
    return A.groupMembers().map(A.canonName).filter(n => n && !A.sameName(n, user));
}

export function panelClick(act, el) {
    if (!act.startsWith('trk-')) return false;
    if (act === 'trk-open') { openTracker(el.dataset.id); return true; }
    if (act === 'trk-map') {
        const row = (ico, name, where) => `<div class="lf-trk-m"><span>${ico}</span><div><b>${name}</b><small>${where}</small></div></div>`;
        A.openSheet('🧭 Что где', `
            <div class="lf-hint">Под ответом в чате</div>
            ${row('💭', 'Под словами', 'чип под ответом — после того как Летописец дочитает пост')}
            ${row('📚', 'Лорбуки', 'чип под ответом: какие записи попали в промпт')}
            ${row('⚠', 'Не мог знать', 'появляется под ответом, только если персонаж проговорился')}
            <div class="lf-hint">Здесь, в Сцене — чипы сверху</div>
            ${list.map(t => row(t.ico, esc(t.name), esc(t.hint))).join('')}
            <div class="lf-hint">Деньги</div>
            ${row('📨', 'Счета', 'чип в полке и вкладка Деньги: почта раз в неделю, коммуналка раз в месяц, чеки быта')}
            <div class="lf-hint">На странице персонажа → Жизнь → Психика</div>
            ${row('📓', 'Дневник, сны, дневник тела', 'страница пишется сама с новым днём истории')}
            ${row('🩹', 'Шрамы доверия и следы на теле', 'за что сдвигалось доверие; что ещё не сошло')}
            ${row('⚡', 'Способности и пределы', '«Собрать по карточке» — и правь руками')}
            ${row('💞', 'Тропы, курс пары, хедканоны', 'задаёшь сама, модель держит за правду')}
            <div class="lf-trk-p">${people().map(n => `<button class="lf-pers" data-act="person" data-name="${esc(n)}">${A.ava(n, 'md')}<span class="lf-pers-n">${esc(A.shortName(n))}</span></button>`).join('')}</div>
            <div class="lf-hint">Во вкладке Мир</div>
            ${row('🚩', 'Фракции', 'как к героям относятся группы людей')}
            ${row('🏙', 'Город', 'афиша, службы, цены, что говорят люди — на сегодня')}
            ${row('🌳', 'Семья', 'родословное дерево')}
            ${row('📊', 'Архив', 'цифры по всему чату, календарь настроения, атлас мест')}
            ${row('⚙', 'Выключатели', 'Мир → ⚙ → «Трекеры сцены и нутро»')}`);
        return true;
    }
    return false;
}
