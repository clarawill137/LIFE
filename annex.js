// Пристройка 0.62: шкалы пары, секреты с легендой, лестница хроники, знакомства, перемены внешности — и окна вне
// хаба: персоны, лорбуки, расширения, подключение. Список того, чего в Life не было, взят из описания функций
// расширения «Закулисье» (Слива) в канале автора — по описанию, без его кода: всё написано заново на устройстве
// Life (Летописец после поста, записи при посте, мост для соседей).
//
// Стыки с ядром собраны здесь, чтобы index.js почти не менялся: модули, их клики, заметки модели, «Что записал
// пост», трекеры Сцены, блоки «Психики», переключатели в Мир → ⚙ и плашка выделения в посте.

import { initTies, tiesPrompt, tiesChron, tiesAfterPost, tiesPairHtml, tiesClick, tiesRecs, tiesHas, tiesView } from './ties.js';
import { initVault, vaultPrompt, vaultHtml, vaultPairHtml, vaultClick, vaultFromPost, vaultCount } from './vault.js';
import { initSaga, sagaPrompt, sagaAfterPost, sagaHtml, sagaClick } from './saga.js';
import { initMeet, meetPrompt, meetChron, meetAfterPost, meetHtml, meetClick, meetRecs, meetSceneHtml, meetCount, meetOf } from './meet.js';
import { initAlter, alterPrompt, alterChron, alterAfterPost, alterHtml, alterClick, alterRecs, alterOf } from './alter.js';
import { initWin } from './win.js';
import { initBooks, openBooks } from './books.js';
import { initExts, openExts } from './exts.js';
import { initPersonas, openPersonas, personasPrompt, personasCalEvents, personaHidden, personaGuard } from './personas.js';
import { initLink, openLink } from './link.js';

export { tiesHas, tiesPairHtml, vaultPairHtml, sagaHtml };

let A = null;
const KEYS = ['ties', 'saga', 'meet', 'alter'];
const WINDOWS = { personas: openPersonas, books: openBooks, exts: openExts, link: openLink };

/** Открыть окно вне хаба: personas | books | exts | link. Хаб и пульт сами закрывать не нужно — окно встаёт поверх. */
export function annexOpen(id, opts = {}) {
    const f = WINDOWS[id];
    if (!f) return false;
    Promise.resolve().then(() => f(opts)).catch(e => { console.warn('[Life] окно', e); try { A.toast('warning', A.esc(String(e?.message || e)), '✦ Life'); } catch { /* */ } });
    return true;
}

/**
 * host — то, что ядро отдаёт пристройке: hubMods, mindParts, addRecs, names (подписи блоков в «что уходит модели»),
 * hudKeys (ключи настроек с выключателем), tracker (полка трекеров Сцены), register (мост).
 */
export function initAnnex(api, host) {
    A = api;
    // хроника одна здесь сама ходит к модели — она выключена, пока не включат (остальным ключам ядро ставит «вкл»)
    try { const st = api.settings(); if (!st.saga || typeof st.saga !== 'object') st.saga = {}; if (st.saga.on === undefined) st.saga.on = false; } catch { /* настройки ещё не поднялись — saga.js поставит сам */ }
    for (const k of KEYS) if (!host.hudKeys.includes(k)) host.hudKeys.push(k);
    initTies(api); initVault(api); initSaga(api); initMeet(api); initAlter(api);
    initWin(api); initBooks(api); initExts(api); initPersonas(api); initLink(api);
    host.hubMods.push({ pre: 'ty-', click: tiesClick, label: 'Шкалы пары' }, { pre: 'vt-', click: vaultClick, label: 'Секреты' }, { pre: 'sg-', click: sagaClick, label: 'Хроника' },
        { pre: 'mt-', click: meetClick, label: 'Знакомства' }, { pre: 'alt-', click: alterClick, label: 'Облик' },
        { pre: 'wn-', click: (act, el) => annexOpen(el.dataset.v), label: 'Окна' });
    host.mindParts.push((who) => meetHtml(who), (who) => alterHtml(who));
    host.addRecs(tiesRecs, meetRecs, alterRecs);
    Object.assign(host.names, { 'life-ties': 'шкалы пары: новые и замысел', 'life-vault': 'тайны, которые держат', 'life-saga': 'раньше в истории', 'life-meet': 'знакомства', 'life-alter': 'облик сейчас', 'life-names': 'имена по-русски' });
    const reg = (m) => host.register(m);
    reg({ id: 'life-ties', prompt: (type) => tiesPrompt(type), chron: () => tiesChron(), afterPost: (i, j) => tiesAfterPost(i, j) });
    reg({ id: 'life-vault', prompt: (type) => vaultPrompt(type) });
    reg({ id: 'life-saga', prompt: (type) => sagaPrompt(type), afterPost: () => sagaAfterPost() });
    reg({ id: 'life-meet', prompt: (type) => meetPrompt(type), chron: () => meetChron(), afterPost: (i, j) => meetAfterPost(i, j) });
    reg({ id: 'life-alter', prompt: (type) => alterPrompt(type), chron: () => alterChron(), afterPost: (i, j) => alterAfterPost(i, j) });
    reg({ id: 'life-names', prompt: (type) => personasPrompt(type), calEvents: (from, to) => personasCalEvents(from, to) });
    const sOn = (k) => () => api.settings()[k]?.on !== false;
    host.tracker({ id: 'vault', ico: '🔒', name: 'Секреты', on: sOn('know'), hint: 'Тайны с легендой: кого касается, кто знает и что видят остальные. Вписать, собрать из выделенного в посте куска или подтянуть из лорбука.', state: () => (vaultCount() ? String(vaultCount()) : ''), html: () => vaultHtml() });
    host.tracker({ id: 'meet', ico: '🤝', name: 'Знакомства', on: sOn('meet'), hint: 'Кто с кем ещё не знаком или только слышал. Расставляется в Персонаж → Жизнь → Психика; встретятся в сцене — Летописец отметит.', idle: 'Сейчас все знакомы.', state: () => (meetCount() ? String(meetCount()) : ''), html: () => meetSceneHtml() });
    // соседям (код-мозг, кадры): новые шкалы пары, облик, знакомства, скрытый характер персоны
    try { const s = globalThis.LifeBridge?.api?.senses; if (s) Object.assign(s, { relx: (a, b) => tiesView(a, b), looks: (who) => alterOf(who), met: (a, b) => meetOf(a, b), hidden: (who) => personaHidden(who) }); } catch { /* */ }
    globalThis.LifePersona = { hidden: (who) => personaHidden(who), guard: () => personaGuard(), open: (o) => annexOpen('personas', o) };
    globalThis.LifeWin = { open: (id, o) => annexOpen(id, o), list: () => Object.keys(WINDOWS) };
}

/** Мир → ⚙: выключатели модулей пристройки. sw — тот же построитель, что у остальных строк. */
export function annexCfgHtml(s, sw) {
    for (const k of KEYS) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; if (s[k].on === undefined) s[k].on = k !== 'saga'; }
    return `${sw('on', 'Шкалы пары: свой набор, что двигает и куда идёт', s.ties, 'ties.on')}
        ${sw('on', 'Хроника — раньше в истории: дни складываются в главы и арки', s.saga, 'saga.on')}
        ${sw('on', 'Знакомства: кто кого ещё не знает', s.meet, 'meet.on')}
        ${sw('on', 'Облик сейчас: перемены внешности по ходу истории', s.alter, 'alter.on')}`;
}

/** Плашка выделения в посте (voice.js): своя кнопка. */
export function annexPill(sel) {
    try { if (A?.settings?.().know?.on === false) return ''; } catch { return ''; }
    return sel?.t && sel.t.length >= 12 ? '<button data-vx="secret">🔒 в секрет</button>' : '';
}
export function annexPillAct(id, sel) { if (id === 'secret') vaultFromPost(sel.t, sel.mes); }

/** Плитки окон — для пульта и Фойе. */
export const annexTiles = () => [['personas', 'user', 'Персоны'], ['books', 'book', 'Лорбуки'], ['exts', 'puzzle', 'Расширения'], ['link', 'plug', 'Подключение']];
