// «Под этот кадр» (0.69): какая рисовалка лучше снимет этот кадр — по сцене, плёнке и словам промта.
// Её просьба 22.11: «анализ сцены, чтоб выбирало модель под ситуацию и кидало мне подсказку; я б её ставила,
// и была кнопка адаптировать промт под разные модели». Чистая часть — без экрана и таверны (гоняется в node).
// Каталог — модели порта SLAY: Atlas, OpenRouter images, очередь fal / Higgsfield (вне Atlas). Свойства — по её тестам
// 21–22.11 (Seedream 5.5 держит лица и свободный, Krea 2 Turbo в паре рисует одну Хеди, Nano Banana режет кожу,
// Midjourney красивый, но рефов не берёт) и по описаниям моделей.

import { kindOfModel, modelName } from './pmtags.js';
import { shotOf } from './dpcore.js';

/**
 * via — через что SLAY до неё дотянется: 'atlas' (ключ Atlas), 'or' (профиль «OpenRouter images»), 'fal' / 'hf' (профиль
 * «Очередь fal / Higgsfield»). refs — держит лица по фото рефов (или лорами: lora). filter — strict | medium | soft | none.
 * tags — в чём сильна. bonus — её опыт. note — коротко для окна.
 */
const RAW = [
    ['bytedance/seedream-v5.5/edit', 'atlas', { refs: true, filter: 'soft', tags: ['faces', 'pair', 'photo', 'fashion', 'skin'], bonus: 2, note: 'твой фаворит: держит лица, красиво, свободный' }],
    ['bytedance/seedream-v5.0-pro/edit', 'atlas', { refs: true, filter: 'soft', tags: ['photo', 'skin', 'pair'], note: 'красиво и свободно, лица держит слабее 5.5' }],
    ['google/nano-banana-pro/edit', 'atlas', { refs: true, filter: 'strict', tags: ['faces', 'pair', 'text', 'everyday'], bonus: 1, note: 'Хеди — «точно Хеди», но кожу режет' }],
    ['black-forest-labs/flux-3/edit', 'atlas', { refs: true, filter: 'soft', tags: ['photo', 'skin', 'detail', 'pair'], note: 'мягкий фильтр, слушает промт дословно' }],
    ['midjourney/v8.2/text-to-image', 'atlas', { refs: false, filter: 'strict', tags: ['faceless', 'aesthetic', 'detail', 'place', 'fashion', 'solo'], bonus: 1, note: 'самый красивый; лиц не держит' }],
    ['krea-2-turbo/text-to-image', 'atlas', { refs: false, filter: 'medium', tags: ['faceless', 'photo', 'detail', 'solo'], note: 'плёночный «сырой» вид; в паре рисует одного' }],
    ['openai/gpt-image-2.5-sunburst-developer/edit', 'atlas', { refs: true, filter: 'strict', tags: ['text', 'faces', 'pair', 'everyday'], note: 'надписи и точность; фильтр строгий' }],
    ['xai/grok-imagine-image-2.0/edit', 'atlas', { refs: true, filter: 'medium', tags: ['cartoon', 'pair'], note: 'мультяшно, комикс' }],
    ['microsoft/mai-image-2.6/edit', 'atlas', { refs: true, filter: 'strict', tags: ['photo', 'everyday'], note: 'фотореализм; фильтр строгий' }],
    ['qwen-image-3.0-pro/edit', 'atlas', { refs: true, filter: 'medium', tags: ['text', 'photo'], note: 'надписи в кадре; на Atlas бета' }],
    ['alibaba/wan-2.7-pro/image-edit', 'atlas', { refs: true, filter: 'medium', tags: ['photo', 'place'], note: 'фото и места' }],
    ['krea/k3-edit', 'or', { refs: true, filter: 'medium', tags: ['faces', 'photo', 'fashion'], note: 'лица по рефам, плёночный вид' }],
    ['microsoft/mai-image-2.7', 'or', { refs: true, filter: 'strict', tags: ['photo', 'everyday'], note: 'фотореализм; фильтр строгий' }],
    ['krea/v2/large/text-to-image', 'fal', { refs: false, filter: 'medium', tags: ['faceless', 'aesthetic', 'fashion', 'photo', 'detail', 'place'], bonus: 1, note: 'большая Krea 2 — эстетика; на Atlas её нет' }],
    ['fal-ai/flux-lora', 'fal', { refs: false, lora: true, filter: 'medium', tags: ['faces', 'photo', 'skin'], note: 'лица — твоими лорами Хеди и Баки' }],
    ['higgsfield-ai/soul/standard', 'hf', { refs: false, filter: 'medium', tags: ['faceless', 'fashion', 'aesthetic', 'photo'], bonus: 1, note: 'журнальная фешн-модель' }],
];
export const MODELS = RAW.map(([id, via, t]) => ({ id, via, name: modelName(id), kind: kindOfModel(id), lora: false, bonus: 0, ...t }));
export const VIA_RU = { atlas: 'Atlas', or: 'OpenRouter', fal: 'fal.ai', hf: 'Higgsfield', gpu: 'своя видюха' };

/** Модель каталога по id (и близкие варианты: Nano Banana dev, Midjourney с образцом, t2i-пара edit-модели). */
export function modelById(id) {
    const m = String(id || '').toLowerCase().trim();
    if (!m) return null;
    const hit = MODELS.find(x => x.id === m);
    if (hit) return hit;
    const stem = (s) => s.replace(/-developer(?=\/|$)/, '').replace(/\/(?:edit|text-to-image|image-edit|image-to-image)$/, '');
    return MODELS.find(x => stem(x.id) === stem(m)) || null;
}

const FACELESS_WORDS = /cropped (?:below|under|at) the (?:eyes|lips|mouth|nose)|faces? (?:out of|outside|beyond) (?:the )?frame|faces? (?:are |is )?(?:hidden|turned away|lost in|in shadow|unseen)|from behind|back to (?:the )?camera|seen from the back|silhouettes?|faceless|no faces|headless crop/;
const KISS_WORDS = /\bkiss(?:es|ing|ed)?\b|mouths? meet|lips (?:meet|press|brush|lock)|поцел/;
const TEXT_WORDS = /\b(?:a sign|signboard|neon sign|that reads|which reads|reads ["“]|the words|handwritten note|a letter|newspaper|headline|the screen shows|screen reading|text on|label reading|poster with)\b|надпис/;
const CARTOON_WORDS = /\b(?:comic|cartoon|anime|manga|cel[- ]shad|chibi)/;

/**
 * Что за кадр: { faces, faceless, kiss, pair, skin, fashion, text, cartoon, detail, place, forties }.
 * o: { prompt, look — id плёнки кадра, names — сколько людей названо по имени, scene — { skin, forties } }.
 */
export function frameFacts({ prompt = '', look = '', names = 0, scene = {} } = {}) {
    const p = String(prompt || '').toLowerCase();
    const s = shotOf(prompt);
    const intimLook = look === 'fashion18' || look === 'fsketch';
    const kiss = KISS_WORDS.test(p);
    const hidden = FACELESS_WORDS.test(p);
    const faceless = names === 0 && (intimLook || hidden || s.size === 'detail');
    return {
        faces: names > 0 && !hidden,
        faceless,
        kiss,
        pair: names >= 2,
        skin: !!(scene.skin || intimLook),
        fashion: look === 'fashion' || intimLook,
        text: TEXT_WORDS.test(p),
        cartoon: look === 'pencil' || CARTOON_WORDS.test(p),
        detail: s.size === 'detail',
        place: s.size === 'wide' && names === 0,
        forties: !!scene.forties,
    };
}

const FILTER_SKIN = { none: 6, soft: 4, medium: 0, strict: -6 };

/** Модели по пригодности к кадру, лучшая — первой: [{ ...модель, score, why: [причины по-русски] }]. */
export function suggestModels(f, { avail = MODELS } = {}) {
    const out = [];
    for (const m of avail) {
        let score = m.bonus || 0;
        const why = [];
        const add = (n, w) => { score += n; if (w && n > 0 && !why.includes(w)) why.push(w); };
        const faceKeeper = m.refs || m.lora;
        if (f.skin) add(FILTER_SKIN[m.filter] ?? 0, m.filter === 'none' ? 'раздеты — фильтра нет совсем' : m.filter === 'soft' ? 'раздеты — фильтр мягкий' : '');
        if (f.faces) add(faceKeeper ? 3 : -4, m.lora ? 'лица держит лорами' : 'лица держит по рефам');
        if (f.kiss) add(faceKeeper ? 2 : -2, 'поцелуй — лица в кадре');
        if (f.pair) add(m.tags.includes('pair') ? 2 : m.tags.includes('solo') ? -3 : 0, 'двое в кадре — держит обоих');
        if (f.faceless) add(m.tags.includes('faceless') ? 4 : 0, 'без лиц — рефы не нужны, а она красивее');
        if (f.fashion) add(m.tags.includes('fashion') ? 2 : 0, 'фешн — её конёк');
        if (f.text) add(m.tags.includes('text') ? 4 : 0, 'надпись в кадре');
        if (f.cartoon) add(m.tags.includes('cartoon') ? 4 : 0, 'рисованный вид');
        if (f.place || f.detail) add(m.tags.includes('aesthetic') ? 2 : 0, 'красивый кадр без лиц в центре');
        if (!f.skin && !f.faceless && m.tags.includes('everyday')) add(1, 'обычный кадр с лицами');
        out.push({ ...m, score, why });
    }
    return out.sort((a, b) => b.score - a.score);
}

/** Чем текущая рисовалка не подходит кадру. null — подходит. { key, text } — для подсказки (тост не чаще раза в 15 минут на key). */
export function verdict(f, cur) {
    if (!cur) return null;
    if (f.skin && cur.filter === 'strict') return { key: 'skin', text: `Кадр интимный, а рисует ${cur.name} — её фильтр, скорее всего, зарежет` };
    if (f.faces && f.pair && cur.tags?.includes('solo')) return { key: 'pair', text: `В кадре двое, а ${cur.name} рисует одного` };
    if (f.faces && !cur.refs && !cur.lora) return { key: 'faces', text: `В кадре лица, а ${cur.name} их не держит` };
    return null;
}
