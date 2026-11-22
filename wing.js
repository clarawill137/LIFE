// Флигель 0.74: Должки, Ивенты, Наружка, Допросная. Стыки с ядром — здесь (как в annex.js), чтобы index.js почти не
// менялся: клики, заметки модели, Летописец, «Что записал пост», трекеры Сцены и выключатели в Мир → ⚙.

import { initDebts, dkPrompt, dkChron, dkAfterPost, dkSceneHtml, dkClick, dkRecs, dkState } from './debts.js';
import { initEvents, evPrompt, evSceneHtml, evClick, evState } from './events.js';
import { initTail, tailPrompt, tailSceneHtml, tailClick, tailState } from './tail.js';
import { initInterro, iqPrompt, iqSceneHtml, iqClick, iqState } from './interro.js';

const KEYS = ['debts', 'events', 'tail', 'interro'];

/** host — то же, что ядро отдаёт пристройке (annex.js): hubMods, addRecs, names, hudKeys, tracker, register. */
export function initWing(api, host) {
    for (const k of KEYS) if (!host.hudKeys.includes(k)) host.hudKeys.push(k);
    initDebts(api); initEvents(api); initTail(api); initInterro(api);
    host.hubMods.push({ pre: 'dk-', click: dkClick, label: 'Должки' }, { pre: 'ev-', click: evClick, label: 'Ивенты' },
        { pre: 'tl-', click: tailClick, label: 'Наружка' }, { pre: 'iq-', click: iqClick, label: 'Допросная' });
    host.addRecs(dkRecs);
    Object.assign(host.names, { 'life-debts': 'должки', 'life-events': 'ивент сегодня', 'life-tail': 'наружка: хвост', 'life-interro': 'допросная' });
    const reg = (m) => host.register(m);
    reg({ id: 'life-debts', prompt: (type) => dkPrompt(type), chron: () => dkChron(), afterPost: (i, j) => dkAfterPost(i, j) });
    reg({ id: 'life-events', prompt: (type) => evPrompt(type) });
    reg({ id: 'life-tail', prompt: (type) => tailPrompt(type) });
    reg({ id: 'life-interro', prompt: (type) => iqPrompt(type) });
    const sOn = (k) => () => api.settings()[k]?.on !== false;
    host.tracker({ id: 'debts', ico: '🤝', name: 'Должки', on: sOn('debts'), hint: 'Кто кому должен по-крупному: услуга, сделка, жизнь, тайна. Крупный должок всплывает сам в неудобный момент.', idle: 'Крупных должков нет.', state: () => dkState(), html: () => dkSceneHtml() });
    host.tracker({ id: 'events', ico: '🥂', name: 'Ивенты', on: sOn('events'), hint: 'Гала, свадьба, вечеринка: гости, кто знает, что Хеди жива, рассадка с драмой, наряд, клятвы, кадры.', idle: 'Ивентов нет.', state: () => evState(), html: () => evSceneHtml() });
    host.tracker({ id: 'tail', ico: '👁', name: 'Наружка', on: sOn('tail'), hint: 'Есть ли хвост, проверочный маршрут, отрыв. Хвост может быть, даже если его не видно.', idle: 'Хвоста не видно.', state: () => tailState(), html: () => tailSceneHtml() });
    host.tracker({ id: 'interro', ico: '🕵', name: 'Допросная', on: sOn('interro'), hint: 'Допрос с полиграфом: подход, кубик против выучки, сколько выдал. В обе стороны.', idle: 'Никого не допрашивают.', state: () => iqState(), html: () => iqSceneHtml() });
}

/** Мир → ⚙: выключатели. sw — тот же построитель, что у остальных строк. */
export function wingCfgHtml(s, sw) {
    for (const k of KEYS) { if (!s[k] || typeof s[k] !== 'object') s[k] = {}; if (s[k].on === undefined) s[k].on = true; }
    return `${sw('on', 'Должки: крупные долги и услуги, всплывают сами', s.debts, 'debts.on')}
        ${sw('on', 'Ивенты: гости, рассадка, клятвы, кадры', s.events, 'events.on')}
        ${sw('on', 'Наружка: хвост, проверочный маршрут, отрыв', s.tail, 'tail.on')}
        ${sw('on', 'Допросная: полиграф и сколько выдал', s.interro, 'interro.on')}`;
}
