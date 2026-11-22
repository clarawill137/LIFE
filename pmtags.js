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
        // путь в кавычках — целиком: SLAY кладёт картинки в папку персонажа, «/user/images/Bucky Barnes/…» (с пробелом).
        // До 0.68.4 он читался до пробела — и ↻ двойника резал путь в посте пополам (21.11).
        const sm = outside.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'\s>]+))/i);
        const src = sm ? (sm[1] ?? sm[2] ?? sm[3] ?? '').trim() : '';
        const stamp = /\bdata-iig-error\s*=/i.test(outside);   // SLAY 5.x: метка несостоявшейся картинки на самом теге
        out.push({ start: st, end, full, raw, data: parseIns(raw), src, stamp, aStart, aEnd, video });
        pos = end;
    }
    return out;
}

const BLANK_GIF = /^data:image\/gif;base64,R0lGODlhAQABA/;   // пустой пиксель: так SLAY 5.x пишет ошибку (с меткой) и ожидание
/** Путь настоящей картинки, а не заглушки, значка ошибки или пустого пикселя. */
export const isPicture = (src) => !!src && src !== '#' && !/\[IMG:|error\.svg/i.test(src) && !BLANK_GIF.test(src);
/** ok — картинка есть; wait — ещё не рисовалась ([IMG:GEN]); error — SLAY не смог. */
export function tagState(t) {
    if (!t) return 'wait';
    if (isPicture(t.src)) return 'ok';
    return /error\.svg/i.test(t.src || '') || t.stamp ? 'error' : 'wait';
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
    [/nano[ -]?banana/, 'Nano Banana'], [/gpt-image-2\.6/, 'GPT Image 2.6'], [/gpt-image-2\.5/, 'GPT Image 2.5'], [/gpt-image-2\/edit/, 'GPT Image 2 Edit'], [/gpt-image-2/, 'GPT Image 2'], [/gpt-image/, 'GPT Image'],
    [/grok-imagine-image-2\.0/, 'Grok Imagine 2.0'], [/grok-imagine-image-quality\/edit/, 'Grok Image Edit'], [/grok-imagine/, 'Grok Imagine'], [/grok-pro/, 'Grok Pro'], [/grok/, 'Grok'],
    // 0.69: модели порта SLAY (Atlas, OpenRouter images) и вне Atlas (fal.ai, Higgsfield)
    [/seedream-v5\.5/, 'Seedream 5.5'], [/seedream-v5\.0-pro/, 'Seedream 5.0 Pro'], [/seedream/, 'Seedream'],
    [/midjourney\/v8\.2\/image-to-image/, 'Midjourney V8.2 · образец'], [/midjourney\/v8\.2/, 'Midjourney V8.2'], [/midjourney/, 'Midjourney'],
    [/krea\/k3/, 'Krea 3'], [/krea\/v2\/large/, 'Krea 2 Large'], [/krea\/v2\/medium/, 'Krea 2 Medium'], [/krea-2-turbo|krea-2\/turbo/, 'Krea 2 Turbo'], [/krea/, 'Krea'],
    [/mai-image-2\.7-flash/, 'MAI-Image 2.7 Flash'], [/mai-image-2\.7/, 'MAI-Image 2.7'], [/mai-image-2\.6/, 'MAI-Image 2.6'], [/mai-image/, 'MAI-Image'],
    [/qwen-image-3/, 'Qwen Image 3.0 Pro'], [/qwen-image/, 'Qwen Image'], [/wan-2\.7/, 'Wan 2.7 Pro'], [/\bwan-2/, 'Wan'],
    [/soul\/reference/, 'Higgsfield Soul · реф'], [/soul/, 'Higgsfield Soul'], [/higgsfield/, 'Higgsfield'],
    [/flux-lora/, 'FLUX + твои лоры'], [/flux-3/, 'FLUX 3'],
    [/flux-kontext/, 'FLUX Kontext'], [/flux/, 'FLUX'], [/novelai|nai-diffusion/, 'NovelAI'],
];
const API_NAMES = { atlas: 'Atlas', naistera: 'Naistera', gemini: 'Gemini', openai: 'OpenAI-совместимый', custom: 'свой адрес', novelai: 'NovelAI' };
/** Через что ходит SLAY: у типа Custom — по формату запроса (OpenRouter images, очередь fal / Higgsfield). */
function apiName(st, api, m) {
    if (api === 'custom' && st.customBodyFormat === 'orimages') return 'OpenRouter';
    if (api === 'custom' && st.customBodyFormat === 'falq') return /higgsfield/.test(m) || /higgsfield/i.test(String(st.endpoint || '')) ? 'Higgsfield' : 'fal.ai';
    return API_NAMES[api] || api;
}

/** Диалект по id модели (то же, что в imageModelOf; без SLAY — для каталога моделей). */
export function kindOfModel(model, api = '') {
    const m = String(model || '').toLowerCase();
    if (api === 'novelai' || /novelai|nai-diffusion|\bnai\b/.test(m)) return 'nai';
    if (/banana|gemini|imagen/.test(m)) return 'banana';
    if (/gpt-image|gpt image|dall-e|^openai\//.test(m)) return 'gpt';
    if (/grok|^xai\//.test(m)) return 'grok';
    if (/midjourney/.test(m)) return 'mj';
    if (/seedream/.test(m)) return 'seedream';
    if (/krea/.test(m)) return 'krea';
    if (/mai-image/.test(m)) return 'mai';
    if (/qwen-image/.test(m)) return 'qwen';
    if (/\bwan-2/.test(m)) return 'wan';
    if (/higgsfield|\bsoul\b/.test(m)) return 'soul';
    if (/flux|kontext|black-forest/.test(m)) return 'flux';
    if (api === 'gemini') return 'banana';
    return 'generic';
}
export const modelName = (model) => (MODEL_NAMES.find(([re]) => re.test(String(model || '').toLowerCase())) || [])[1] || String(model || '') || '—';

/** Что сейчас выбрано в SLAY: { api, model, kind, name, label }. kind — «диалект» промта. */
export function imageModelOf(st) {
    if (!st || typeof st !== 'object') return { api: '', model: '', kind: 'generic', name: '', label: 'SLAY не настроен' };
    const api = String(st.apiType || 'openai');
    const model = String(api === 'atlas' ? st.atlasModel || 'black-forest-labs/flux-kontext-dev'
        : api === 'naistera' ? st.naisteraModel || 'grok'
            : api === 'novelai' ? st.novelModel || 'novelai' : st.model || '');
    const m = model.toLowerCase();
    const kind = kindOfModel(m, api);
    const name = modelName(m) === m ? (model || '—') : modelName(m);
    return { api, model, kind, name, label: `${name} · ${apiName(st, api, m)}` };
}

// ───────────── диалекты ─────────────
// Как каждая рисовалка любит, чтобы с ней говорили. Собрано по их же руководствам (Google, OpenAI, xAI, NovelAI, BFL).
// guide — для Летописца, когда он правит промт; note — короткая подсказка основной модели, которая пишет промт в посте.

export const DIALECTS = {
    banana: {
        name: 'Nano Banana',
        refs: true,
        guide: 'Google Nano Banana (Gemini image). A narrative scene description in natural language — one dense paragraph, 60-110 words, never a keyword list. Order: shot type, angle and lens → who is in frame (first names) and what they are doing → clothes → place → light. With two people it follows a short structure best, still on one line: "SCENE: framing, crop line, place, light source and where its shadow falls, two or three colours. FIGURE 1 — Hedy: angle of the torso, tilt of the head, where she looks, what each hand does. FIGURE 2 — Bucky: … and who overlaps whom in depth." The art style usually travels separately (the style field of the tag): keep style words only if the current prompt already carries them. Positive framing only: describe what IS there ("an empty street") instead of listing what is not ("no cars"). Reference photos carry the faces — name the people, do not describe faces, hair or eye colour. Its filter is strict about skin: keep intimate frames covered and faceless.',
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
        guide: 'FLUX (Kontext / dev / FLUX 3). A plain descriptive caption of the finished picture, 40-80 words (FLUX 3 follows longer exact prompts, up to 120): subject, action, clothes, place, light described physically (source, direction, softness, colour), lens. No negative phrasing at all — "no X" and "without X" are ignored or backfire, describe only what is visible. Kontext takes one reference photo of a face: refer to "the same person as in the reference" for the main subject. LoRA trigger words are added by the extension — never invent them.',
        note: 'FLUX: write a plain caption of the finished picture, 40-80 words (subject, action, clothes, place, light, lens). No negative phrasing — skip the "Avoid: …" list for this model and describe only what is visible.',
    },
    seedream: {
        name: 'Seedream',
        refs: true,
        guide: 'ByteDance Seedream 5.x. Natural English sentences, 70-140 words — it follows long, structured descriptions and renders skin, fabric and film texture very well. Order: shot size, camera height and lens → who is in the frame (first names) and the exact action → clothes and fabric → place → the light source, its direction and colour → two or three colours. With two people use a short structure on one line: "SCENE: …. FIGURE 1 — Hedy: torso angle, head, gaze, hands. FIGURE 2 — Bucky: …, overlapping her in depth." Reference photos carry the faces (the extension labels them Image 1, Image 2): name the people, never describe faces, hair or eye colour. Concrete camera words, no lists of negatives.',
        note: 'Seedream: write the prompt in natural English sentences, 70-140 words — shot and lens first, then who is in the frame and the exact action, clothes and fabric, place, the light source with its direction and colour. With two people a short "SCENE: … FIGURE 1 — name: … FIGURE 2 — name: …" structure on one line. No "Avoid: …" list.',
    },
    mj: {
        name: 'Midjourney',
        refs: true,
        guide: 'Midjourney V8. Short and literal, 30-60 words, the most important thing first: what is in the frame and what happens, then the light, then the mood. It keeps no faces (the extension sends at most one picture as a sample), so it shines on frames without faces: hands, fabric, silhouettes, a back, a doorway, a place. Plain words, no negatives, no weights and no parameters — the extension adds them. The art style travels separately.',
        note: 'Midjourney: the prompt is short and literal, 30-60 words — first what is in the frame and what happens, then light, then mood. No negatives, no "Avoid" list, no parameters.',
    },
    krea: {
        name: 'Krea',
        refs: true,
        guide: 'Krea (2 / 3). A photographers caption, 40-90 words: the subject and the exact action, the light source and its direction, the lens, the texture of the film. It loves raw film realism — grain, imperfect light, real skin. With two people say plainly that both are in the frame and how they overlap ("Bucky behind her, his chin on her shoulder") — it tends to drop the second person. No negatives.',
        note: 'Krea: write a photographers caption, 40-90 words — subject and action, light source and direction, lens, film texture. With two people say plainly that both are in the frame and how they overlap. No "Avoid" list.',
    },
    mai: {
        name: 'MAI-Image',
        refs: true,
        guide: 'Microsoft MAI-Image. Clear descriptive sentences, 50-100 words, photographic: the framing first, then the people and what they do, place and light. Its moderation is strict — keep the frame clothed, calm and free of names of real people or brands.',
        note: 'MAI-Image: clear descriptive sentences, 50-100 words — framing first, then the people and the action, place, light. Keep it clothed and calm.',
    },
    qwen: {
        name: 'Qwen Image',
        refs: true,
        guide: 'Alibaba Qwen Image. Clear structured English, 50-120 words: framing → subject and action → place → light. Exact about any text inside the picture: put the words to be written in the scene description plainly (a sign that reads OPEN). No negatives.',
        note: 'Qwen Image: clear structured English, 50-120 words — framing, subject and action, place, light; write any text that must appear in the picture plainly.',
    },
    wan: {
        name: 'Wan',
        refs: true,
        guide: 'Alibaba Wan 2.7. Descriptive English, 50-110 words: framing, subject and action, place, light, colours. The frame shape is added by the extension in words — do not describe it. No negatives.',
        note: 'Wan: descriptive English, 50-110 words — framing, subject and action, place, light, colours. No "Avoid" list.',
    },
    soul: {
        name: 'Higgsfield Soul',
        refs: true,
        guide: 'Higgsfield Soul — a fashion-editorial photo model. Write like an art director briefing a shoot, 40-90 words: styling and fabric, pose and its geometry, the light setup, the location, the mood. Fashion vocabulary works best (editorial, campaign, medium format, hard flash, window light). It keeps no faces: perfect for faceless or anonymous editorial frames. No negatives.',
        note: 'Higgsfield Soul: write like an art director briefing a fashion shoot, 40-90 words — styling and fabric, pose, light setup, location, mood. No "Avoid" list.',
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
        guide: 'A general image model. One clear English paragraph, 50-100 words: framing → who is in frame (first names) and what they do → clothes → place → light; art-style words only if the current prompt already carries them.',
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
        novelModel: st.novelModel || '',               // SLAY 5.x: NovelAI напрямую
        novelCustomModel: st.novelCustomModel || '',
    };
}

/** Источник — тот же, что сейчас стоит в SLAY (модель Atlas/Naistera — тоже часть источника). */
export function sourceIsCurrent(p, st) {
    if (!p || !st) return false;
    const same = (a, b) => String(a || '').trim() === String(b || '').trim();
    if (!same(p.apiType, st.apiType) || !same(p.endpoint, st.endpoint) || !same(p.apiKey, st.apiKey)) return false;
    if (p.apiType === 'atlas') return !p.atlasModel || same(p.atlasModel, st.atlasModel);
    if (p.apiType === 'naistera') return !p.naisteraModel || same(p.naisteraModel, st.naisteraModel);
    if (p.apiType === 'novelai') return !p.novelModel || (same(p.novelModel, st.novelModel) && same(p.novelCustomModel, st.novelCustomModel));
    return same(p.model, st.model);
}
