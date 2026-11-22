// Флигель 0.74: Должки, Ивенты, Наружка, Допросная; 0.75 — Доска расследования, Титры, Комикс, Глазами Хеди. Стыки с ядром — здесь (как в annex.js), чтобы index.js почти не
// менялся: клики, заметки модели, Летописец, «Что записал пост», трекеры Сцены и выключатели в Мир → ⚙.

import { initDebts, dkPrompt, dkChron, dkAfterPost, dkSceneHtml, dkClick, dkRecs, dkState } from './debts.js';
import { initEvents, evPrompt, evSceneHtml, evClick, evState } from './events.js';
import { initTail, tailPrompt, tailSceneHtml, tailClick, tailState } from './tail.js';
import { initInterro, iqPrompt, iqSceneHtml, iqClick, iqState } from './interro.js';
import { initBoard, bdPrompt, bdChron, bdAfterPost, bdSceneHtml, bdClick, bdRecs, bdState } from './board.js';
import { initCredits, ttlPrompt, ttlSceneHtml, ttlClick } from './credits.js';
import { initComic, cmxSceneHtml, cmxClick, cmxState } from './comic.js';
import { initEyes, eyeSceneHtml, eyeClick } from './eyes.js';

const KEYS = ['debts', 'events', 'tail', 'interro', 'board', 'credits', 'comic', 'eyes'];

/** host — то же, что ядро отдаёт пристройке (annex.js): hubMods, addRecs, names, hudKeys, tracker, register. */
export function initWing(api, host) {
    for (const k of KEYS) if (!host.hudKeys.includes(k)) host.hudKeys.push(k);
    initDebts(api); initEvents(api); initTail(api); initInterro(api);
    initBoard(api); initCredits(api); initComic(api); initEyes(api);
    host.hubMods.push({ pre: 'dk-', click: dkClick, label: 'Должки' }, { pre: 'ev-', click: evClick, label: 'Ивенты' },
        { pre: 'tl-', click: tailClick, label: 'Наружка' }, { pre: 'iq-', click: iqClick, label: 'Допросная' },
        { pre: 'bd-', click: bdClick, label: 'Доска' }, { pre: 'ttl-', click: ttlClick, label: 'Титры' },
        { pre: 'cmx-', click: cmxClick, label: 'Комикс' }, { pre: 'eye-', click: eyeClick, label: 'Глазами Хеди' });
    host.addRecs(dkRecs, bdRecs);
    Object.assign(host.names, { 'life-debts': 'должки', 'life-events': 'ивент сегодня', 'life-tail': 'наружка: хвост', 'life-interro': 'допросная', 'life-board': 'доска расследования', 'life-credits': 'сцена после титров' });
    const reg = (m) => host.register(m);
    reg({ id: 'life-debts', prompt: (type) => dkPrompt(type), chron: () => dkChron(), afterPost: (i, j) => dkAfterPost(i, j) });
    reg({ id: 'life-events', prompt: (type) => evPrompt(type) });
    reg({ id: 'life-tail', prompt: (type) => tailPrompt(type) });
    reg({ id: 'life-interro', prompt: (type) => iqPrompt(type) });
    reg({ id: 'life-board', prompt: (type) => bdPrompt(type), chron: () => bdChron(), afterPost: (i, j) => bdAfterPost(i, j) });
    reg({ id: 'life-credits', prompt: (type) => ttlPrompt(type) });
    const sOn = (k) => () => api.settings()[k]?.on !== false;
    host.tracker({ id: 'debts', ico: '🤝', name: 'Должки', on: sOn('debts'), hint: 'Кто кому должен по-крупному: услуга, сделка, жизнь, тайна. Крупный должок всплывает сам в неудобный момент.', idle: 'Крупных должков нет.', state: () => dkState(), html: () => dkSceneHtml() });
    host.tracker({ id: 'events', ico: '🥂', name: 'Ивенты', on: sOn('events'), hint: 'Гала, свадьба, вечеринка: гости, кто знает, что Хеди жива, рассадка с драмой, наряд, клятвы, кадры.', idle: 'Ивентов нет.', state: () => evState(), html: () => evSceneHtml() });
    host.tracker({ id: 'tail', ico: '👁', name: 'Наружка', on: sOn('tail'), hint: 'Есть ли хвост, проверочный маршрут, отрыв. Хвост может быть, даже если его не видно.', idle: 'Хвоста не видно.', state: () => tailState(), html: () => tailSceneHtml() });
    host.tracker({ id: 'board', ico: '📌', name: 'Доска', on: sOn('board'), hint: 'Пробка, улики и красные нитки: Летописец кладёт улики из постов, ты связываешь, модель предлагает версии.', idle: 'Дел нет.', state: () => bdState(), html: () => bdSceneHtml() });
    host.tracker({ id: 'credits', ico: '🎬', name: 'Титры', on: sOn('credits'), hint: 'Закрыла сюжетку — титры: в ролях, кадры, музыка, и сцена после титров.', idle: '', state: () => '', html: () => ttlSceneHtml() });
    host.tracker({ id: 'comic', ico: '🗯', name: 'Комикс', on: sOn('comic'), hint: 'Сцена → страница комикса: панели, облачка, звуки. Выпуски God Complex #N.', idle: '', state: () => cmxState(), html: () => cmxSceneHtml() });
    host.tracker({ id: 'eyes', ico: '🧿', name: 'Глазами Хеди', on: sOn('eyes'), hint: 'Экран её глазами: выходы, кто вооружён, кто врёт, что чует нюх на энергию.', idle: '', state: () => '', html: () => eyeSceneHtml() });
    host.tracker({ id: 'interro', ico: '🕵', name: 'Допросная', on: sOn('interro'), hint: 'Допрос с полиграфом: подход, кубик против выучки, сколько выдал. В обе стороны.', idle: 'Никого не допрашивают.', state: () => iqState(), html: () => iqSceneHtml() });
}

/** Мир → ⚙: выключатели. sw — тот же построитель, что у остальных строк. */
export function wingCfgHtml(s, sw) {
    for (const k of KEYS) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; if (s[k].on === undefined) s[k].on = true; }
    return `${sw('on', 'Должки: крупные долги и услуги, всплывают сами', s.debts, 'debts.on')}
        ${sw('on', 'Ивенты: гости, рассадка, клятвы, кадры', s.events, 'events.on')}
        ${sw('on', 'Наружка: хвост, проверочный маршрут, отрыв', s.tail, 'tail.on')}
        ${sw('on', 'Допросная: полиграф и сколько выдал', s.interro, 'interro.on')}
        ${sw('on', 'Доска расследования: улики, нитки, версии', s.board, 'board.on')}
        ${sw('on', 'Титры и сцена после титров', s.credits, 'credits.on')}
        ${sw('on', 'Комикс: сцена → страница', s.comic, 'comic.on')}
        ${sw('on', 'Глазами Хеди', s.eyes, 'eyes.on')}`;
}
