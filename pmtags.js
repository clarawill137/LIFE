// «Промты»: чистая часть — без экрана и таверны (её можно гонять в node).
// Теги картинок SLAY в тексте поста, «диалекты» рисовалок, разбор ошибок, какая модель сейчас рисует.

const MARK = 'data-iig-instruction=';

/** Те же сущности, что раскрывает сам SLAY. */
export const unent = (s) => String(s || '').replace(/&quot;|&#34;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');

export function parseIns(raw) {
    const s = unent(raw);
    try { const j = JSON.parse(s); if (j && typeof j === 'object') return j; } catch { /* ниже — как SLAY */ }
    try { const j = JSON.parse(s.replace(/'/g, '"')); if (j && typeof j === 'object') return j; } catch { /* битая */ }
    return null;
}

/**
 * Все теги картинок SLAY по порядку (разбор — как у самого SLAY, чтобы номера совпадали):
 * [{ start, end, full, raw, data, src, aStart, aEnd, video }] — aStart/aEnd — где внутри тега стоит сама инструкция.
 */
export function scanTags(text) {
    const s = String(text || '');
    const out = [];
    let pos = 0;
    for (;;) {
        const mk = s.indexOf(MARK, pos);
        if (mk < 0) break;
        const st = Math.max(s.lastIndexOf('<img', mk), s.lastIndexOf('<video', mk));
        if (st < 0 || mk - st > 800) { pos = mk + 1; continue; }
        const video = s.startsWith('<video', st);
        const after = mk + MARK.length;
        const js = s.indexOf('{', after);
        if (js < 0 || js > after + 10) { pos = mk + 1; continue; }
        let depth = 0, je = -1, inStr = false, escNext = false;
        for (let i = js; i < s.length; i++) {
            const ch = s[i];
            if (escNext) { escNext = false; continue; }
            if (ch === '\\' && inStr) { escNext = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') depth++;
            else if (ch === '}') { depth--; if (depth === 0) { je = i + 1; break; } }
        }
        if (je < 0) { pos = mk + 1; continue; }
        let end = video ? s.indexOf('</video>', je) : s.indexOf('>', je);
        if (end < 0) { pos = mk + 1; continue; }
        end += video ? '</video>'.length : 1;
        const q = s[after] === "'" || s[after] === '"' ? s[after] : '';
        const full = s.slice(st, end);
        const raw = s.slice(js, je);
        const aStart = mk - st;
        const aEnd = (q && s[je] === q ? je + 1 : je) - st;
        const outside = full.slice(0, aStart) + full.slice(aEnd);
        const src = (outside.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
        out.push({ start: st, end, full, raw, data: parseIns(raw), src, aStart, aEnd, video });
        pos = end;
    }
    return out;
}

/** ok — картинка есть; wait — ещё не рисовалась ([IMG:GEN]); error — SLAY не смог. */
export function tagState(t) {
    if (!t?.src || /\[IMG:/i.test(t.src) || t.src === '#') return 'wait';
    return /error\.svg/i.test(t.src) ? 'error' : 'ok';
}

/** Инструкция для одинарных кавычек атрибута: без ', < и > (их SLAY и таверна не переживают). */
export function encodeIns(obj) {
    return JSON.stringify(obj).replace(/'/g, '’').replace(/</g, '‹').replace(/>/g, '›');
}

/** Тот же тег с новой инструкцией. */
export function withIns(t, obj) {
    return `${t.full.slice(0, t.aStart)}${MARK}'${encodeIns(obj)}'${t.full.slice(t.aEnd)}`;
}

/** Тот же тег с другой картинкой (src ищется вне инструкции — в промте может встретиться что угодно). */
export function withSrc(t, src) {
    const re = /\bsrc\s*=\s*(["'])[^"']*\1/i;
    const head = t.full.slice(0, t.aStart), ins = t.full.slice(t.aStart, t.aEnd), tail = t.full.slice(t.aEnd);
    if (re.test(tail)) return head + ins + tail.replace(re, () => `src="${src}"`);
    if (re.test(head)) return head.replace(re, () => `src="${src}"`) + ins + tail;
    return head + ins + ` src="${src}"` + tail;
}

/** Который по счёту такой же тег в тексте (одинаковые теги бывают: два [IMG:GEN] с одним промтом). */
export function ordOf(text, t) {
    let n = 0, i = -1;
    while ((i = String(text).indexOf(t.full, i + 1)) >= 0 && i < t.start) n++;
    return n;
}

export function replaceNth(str, find, rep, n = 0) {
    if (typeof str !== 'string' || !find) return str;
    let i = -1;
    for (let k = 0; k <= n; k++) { i = str.indexOf(find, i + 1); if (i < 0) return str; }
    return str.slice(0, i) + rep + str.slice(i + find.length);
}

const SRC_RE = /(<(?:img|video)\b[^>]*?\bsrc\s*=\s*)(["'])[^"']*\2/gi;
const POSTER_RE = /(<video\b[^>]*?\bposter\s*=\s*)(["'])[^"']*\2/gi;
const srcless = (s) => String(s || '').replace(SRC_RE, '$1$2$2').replace(POSTER_RE, '$1$2$2');
/** Тексты отличаются только путями картинок (SLAY дорисовал или перерисовал) — пост тот же. */
export function sameButSrc(a, b) { return a !== b && srcless(a) === srcless(b); }

/** По чему узнаём картинку на экране: своя метка, иначе начало промта. */
export function sigOf(data, raw = '') {
    if (data?.pm) return `pm:${data.pm}`;
    const p = data?.prompt ?? unent(raw);
    return String(p || '').toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '').slice(0, 90);
}

export const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/** В одну строку, без кавычек-ёлочек по краям: так промт живёт в инструкции. */
export function cleanPrompt(p) {
    return String(p || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^["'«“\s]+|["'»”\s]+$/g, '').slice(0, 2400);
}

// ───────────── какая рисовалка ─────────────

const MODEL_NAMES = [
    [/nano-banana-pro\/edit-developer/, 'Nano Banana Pro Edit dev'], [/nano-banana-pro\/edit/, 'Nano Banana Pro Edit'], [/nano-banana-pro/, 'Nano Banana Pro'],
    [/nano[ -]?banana/, 'Nano Banana'], [/gpt-image-2\/edit/, 'GPT Image 2 Edit'], [/gpt-image-2/, 'GPT Image 2'], [/gpt-image/, 'GPT Image'],
    [/grok-imagine-image-quality\/edit/, 'Grok Image Edit'], [/grok-imagine/, 'Grok Imagine'], [/grok-pro/, 'Grok Pro'], [/grok/, 'Grok'],
    [/flux-kontext/, 'FLUX Kontext'], [/flux/, 'FLUX'], [/novelai|nai-diffusion/, 'NovelAI'],
];
const API_NAMES = { atlas: 'Atlas', naistera: 'Naistera', gemini: 'Gemini', openai: 'OpenAI-совместимый', custom: 'свой адрес', novelai: 'NovelAI' };

/** Что сейчас выбрано в SLAY: { api, model, kind, name, label }. kind — «диалект» промта. */
export function imageModelOf(st) {
    if (!st || typeof st !== 'object') return { api: '', model: '', kind: 'generic', name: '', label: 'SLAY не настроен' };
    const api = String(st.apiType || 'openai');
    const model = String(api === 'atlas' ? st.atlasModel || 'black-forest-labs/flux-kontext-dev'
        : api === 'naistera' ? st.naisteraModel || 'grok'
            : api === 'novelai' ? st.novelModel || 'novelai' : st.model || '');
    const m = model.toLowerCase();
    let kind = 'generic';
    if (api === 'novelai' || /novelai|nai-diffusion|\bnai\b/.test(m)) kind = 'nai';
    else if (/banana|gemini|imagen/.test(m)) kind = 'banana';
    else if (/gpt-image|gpt image|dall-e|^openai\//.test(m)) kind = 'gpt';
    else if (/grok|^xai\//.test(m)) kind = 'grok';
    else if (/flux|kontext|black-forest/.test(m)) kind = 'flux';
    else if (api === 'gemini') kind = 'banana';
    const name = (MODEL_NAMES.find(([re]) => re.test(m)) || [])[1] || model || '—';
    return { api, model, kind, name, label: `${name} · ${API_NAMES[api] || api}` };
}

// ───────────── диалекты ─────────────
// Как каждая рисовалка любит, чтобы с ней говорили. Собрано по их же руководствам (Google, OpenAI, xAI, NovelAI, BFL).
// guide — для Летописца, когда он правит промт; note — короткая подсказка основной модели, которая пишет промт в посте.

export const DIALECTS = {
    banana: {
        name: 'Nano Banana',
        refs: true,
        guide: 'Google Nano Banana (Gemini image). A narrative scene description in natural language — one dense paragraph, 60-110 words, never a keyword list. Order: shot type, angle and lens → who is in frame (first names) and what they are doing → clothes → place → light → style. Positive framing only: describe what IS there ("an empty street") instead of listing what is not ("no cars"). Reference photos carry the faces — name the people, do not describe faces, hair or eye colour.',
        note: '',
    },
    gpt: {
        name: 'GPT Image',
        refs: true,
        guide: 'OpenAI GPT Image. It reads a prompt like a specification. First say what the picture is and how it is framed; then the subject(s): pose, where they look, what the hands do, relative scale; then the important details — materials, light, colour; finish with short explicit constraints ("no text, no watermark, no extra people"). Plain sentences, 70-130 words. Say "photorealistic" or "real photograph" when realism is wanted. People are named by first name; reference photos keep each face, skin tone and hair exactly — say so once.',
        note: 'GPT Image: write the prompt like a brief spec, 70-130 words — what the picture is and its framing first, then the people (pose, gaze, hands), then materials, light and colour, then one short line of constraints (no text, no watermark, no extra people). Say "photorealistic" for realism.',
    },
    grok: {
        name: 'Grok Imagine',
        refs: true,
        guide: 'xAI Grok Imagine. Write prose that describes ONE photograph, 4-6 sentences, 50-90 words — not instructions. Order: the subject and the setting first → key details with exact counts and the camera angle → light (source, direction, hard or soft) → colour → composition and crop. Name every object precisely. No long "avoid" lists: describe what you want instead; at most one short constraint, paired with what should be there.',
        note: 'Grok Imagine: describe one photograph in 4-6 plain sentences (50-90 words) — subject and setting first, then details with exact counts and the camera angle, then light, colour, crop. Do NOT append the long "Avoid: …" negative list for this model — say what should be in the picture instead.',
    },
    flux: {
        name: 'FLUX',
        refs: true,
        guide: 'FLUX (Kontext / dev). A plain descriptive caption of the finished picture, 40-80 words: subject, action, clothes, place, light, lens. No negative phrasing at all — "no X" and "without X" are ignored or backfire, describe only what is visible. Kontext takes one reference photo of a face: refer to "the same person as in the reference" for the main subject. LoRA trigger words are added by the extension — never invent them.',
        note: 'FLUX: write a plain caption of the finished picture, 40-80 words (subject, action, clothes, place, light, lens). No negative phrasing — skip the "Avoid: …" list for this model and describe only what is visible.',
    },
    nai: {
        name: 'NovelAI',
        refs: false,
        guide: 'NovelAI Diffusion (anime model, no reference photos). Comma-separated tags in lowercase English, danbooru style; a short natural-language phrase is fine for an action. Latin letters only — no Cyrillic, no emoji. Order: people count (1girl, 1boy, 1girl 1boy) → each person\'s look as tags (hair length and colour, eye colour, build, scars and marks) → clothes → pose, action, expression → place → light and mood → framing (close-up, upper body, cowboy shot, from side, from above). Names mean nothing to this model: ALWAYS replace every name with that person\'s look. 25-60 tags.',
        note: 'NovelAI (anime, no reference photos): the prompt is comma-separated lowercase danbooru-style tags, 25-60 of them, Latin letters only. Order: people count (1girl, 1boy) → each person\'s look as tags (hair, eyes, build, scars — names mean nothing to this model, replace every name with the look) → clothes → pose and expression → place → light → framing. No sentences, no style-lock paragraph, no "Avoid" list.',
    },
    generic: {
        name: 'рисовалка',
        refs: true,
        guide: 'A general image model. One clear English paragraph, 50-100 words: framing → who is in frame (first names) and what they do → clothes → place → light → style.',
        note: '',
    },
};

/** Заметка основной модели: под какую рисовалку писать промт в посте. Пусто — правила пресета и так подходят. */
export function dialectNote(im, looks = '') {
    const d = DIALECTS[im?.kind];
    if (!d?.note) return '';
    const who = d.refs ? '' : (looks ? ` Looks to use: ${looks}` : ' Take each look from the character cards.');
    return `[Image prompts — the picture is drawn by ${im.name}. For the "prompt" inside data-iig-instruction follow this instead of the general length and negative-list rules (the tag format, one line and single/double quotes stay exactly as they are): ${d.note}${who}]`;
}

// ───────────── почему не нарисовалось ─────────────

const WHY = [
    ['filter', /moderat|safety|nsfw|sexual|explicit|violen|policy|prohibit|blocked|content.?filter|sensitive|celebrit|public figure|likeness|real person|refus|not allowed|inappropriate|flagged|image_other|recitation|trademark|copyright/i,
        'Похоже, картинку завернул фильтр рисовалки: содержание сцены, узнаваемое лицо или чужая марка в промте.'],
    ['key', /\b40[13]\b|unauthori[sz]ed|invalid.{0,20}(key|token)|api key|forbidden|ключ.{0,20}не принят/i, 'Сервис не принял ключ — проверь источник (ключ мог быть от другого сервиса).'],
    ['money', /\b402\b|insufficient|balance|credit|quota|billing|payment/i, 'У сервиса картинок кончился баланс или квота.'],
    ['busy', /\b429\b|rate.?limit|too many/i, 'Сервис просит подождать — запросов слишком много.'],
    ['slow', /timeout|timed out|слишком долго|aborted|abort/i, 'Не дождались ответа сервиса.'],
    ['down', /\b5\d\d\b|overload|unavailable|bad gateway|не справился/i, 'Сервис картинок сейчас не справляется.'],
    ['none', /не была сгенерирована/i, 'Картинка так и не нарисовалась; причину SLAY после перезагрузки не хранит.'],
];

/** { kind, text } — что случилось, по-русски. */
export function explainError(msg) {
    const t = String(msg || '').trim();
    if (!t) return null;
    const hit = WHY.find(([, re]) => re.test(t));
    return hit ? { kind: hit[0], text: hit[2] } : { kind: 'other', text: '' };
}

// ───────────── источники (подключения SLAY) ─────────────

/** Снимок подключения из настроек SLAY — в том же виде, что у профилей самого SLAY 5.x (connectionProfiles). */
export function sourceSnap(st, name) {
    return {
        name,
        apiType: st.apiType || 'openai',
        endpoint: st.endpoint || '',
        apiKey: st.apiKey || '',
        model: st.model || '',
        customBodyFormat: st.customBodyFormat || 'chat',
        naisteraModel: st.naisteraModel || '',
        naisteraAspectRatio: st.naisteraAspectRatio || '',
        atlasModel: st.atlasModel || '',
    };
}

/** Источник — тот же, что сейчас стоит в SLAY (модель Atlas/Naistera — тоже часть источника). */
export function sourceIsCurrent(p, st) {
    if (!p || !st) return false;
    const same = (a, b) => String(a || '').trim() === String(b || '').trim();
    if (!same(p.apiType, st.apiType) || !same(p.endpoint, st.endpoint) || !same(p.apiKey, st.apiKey)) return false;
    if (p.apiType === 'atlas') return !p.atlasModel || same(p.atlasModel, st.atlasModel);
    if (p.apiType === 'naistera') return !p.naisteraModel || same(p.naisteraModel, st.naisteraModel);
    return same(p.model, st.model);
}
