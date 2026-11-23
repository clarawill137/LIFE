// «Оператор»: чистая часть — без экрана и таверны (гоняется в node).
// Что делает кадр кадром, а не «двое стоят и смотрят»: одна мысль, пойманное мгновение, взгляды, конкретное лицо,
// одно касание с весом, план по смыслу, свет от настоящего источника. Отсюда берут: заметка основной модели,
// агент-оператор (переснять / дубли), раскадровщик кадров Life.
// «Плёнка» — вид картинки (плёночный стоп-кадр, ч/б, карандаш…): живёт в поле style тега, а не в тексте промта.

// ───────────── плёнки ─────────────

const SKIN = 'Photographic realism: natural unretouched skin texture with pores, fine lines and stubble, true-to-life proportions.';

/** [id, ярлык, когда подходит, текст для рисовалки]. Без апострофов и кавычек — текст живёт внутри тега картинки. */
export const LOOKS = [
    ['cine_night', 'Кино · ночь', 'вечер, лампы, свечи',
        `Cinematic film still shot on 35mm Kodak Vision3 500T tungsten stock: warm practical light against cool blue shadows, soft halation around highlights, deep natural blacks, fine organic grain, shallow depth of field, slightly underexposed. ${SKIN}`],
    ['cine_day', 'Кино · день', 'дневной свет',
        `Cinematic film still shot on 35mm Kodak Vision3 250D daylight stock: soft natural light, gentle contrast, muted earthy palette with true skin tones, fine organic grain, shallow depth of field. ${SKIN}`],
    ['portra', 'Плёнка · тёплая', 'нежные и домашние сцены',
        `Candid 35mm photograph on Kodak Portra 400: warm pastel tones, creamy highlights, soft contrast, visible grain, available window light, the feel of a private snapshot taken by someone who loves them. ${SKIN}`],
    ['neon', 'Город · неон', 'ночная улица, бар',
        `Night photograph on CineStill 800T: red halation around neon and streetlights, teal shadows, wet reflections, visible grain, shallow depth of field. ${SKIN}`],
    ['vhs90', 'Старое кино · VHS', 'фильм 90-х в плохом качестве',
        'Frame from a 1990s Hollywood romantic drama watched on a worn VHS tape: 35mm film transferred to standard-definition video, soft slightly blurred low-resolution image, washed pastel colour with warm skin tones and a grey-blue haze, a gentle glow bleeding around highlights, faint colour smearing on reds, video noise over film grain, flat overcast contrast. Photographic realism, true-to-life proportions.'],
    ['bw', 'Ч/б', 'чёрно-белая плёнка',
        `Black-and-white 35mm photograph on Kodak Tri-X 400 pushed one stop: rich grain, deep blacks, luminous skin, available light, documentary intimacy. ${SKIN}`],
    ['noir40', 'Нуар 40-х', 'ч/б Голливуд сороковых',
        'Black-and-white 1940s studio film still: hard key light, deep sculpted shadows, a glowing rim of light on the hair, soft glamour lens, period film grain. Photographic realism, true-to-life proportions.'],
    // 22.11 (её «да» на «стиль кадров по эпохе: сороковые — ч/б плёнка, как её аватарки»): в сороковых «Авто» — она
    ['war40', 'Ч/б 40-х', 'ч/б фото сороковых, как военная хроника',
        'Black-and-white photograph from the 1940s, period 35mm rangefinder on Kodak Super-XX: silver-gelatin tones, soft period lens, coarse grain, slight motion blur, natural available light, the candour of wartime photojournalism. Photographic realism, true-to-life proportions.'],
    ['koda40', 'Кодахром 40-х', 'цветное фото сороковых',
        'Colour photograph of the 1940s on Kodachrome: saturated reds and deep blues, warm skin, soft contrast, period lens softness and film texture. Photographic realism, true-to-life proportions.'],
    ['pencil', 'Карандаш', 'рисунок цветным карандашом',
        'Hand-drawn colored-pencil sketch illustration: crisp ink linework, soft pencil shading and hatching, subtle toned-paper texture, warm natural skin, semi-realistic proportions.'],
    ['paint', 'Полу-реализм', 'как было раньше',
        'Semi-realistic digital painting: detailed faces, painterly loose brushwork on the background, natural balanced palette, skin that reads as alive, soft depth of field.'],
    // 21.11: в сценах без одежды фото-плёнки рисовалка (Nano Banana) режет фильтром — в её чате с 20.11 6 кадров из 7,
    // а рисованный полу-реализм до того проходил 9 из 10 и в постели, и в ванне. Кадр тот же (план, момент, свет), рисунком.
    ['cine_paint', 'Кино · кисть', 'рисованный кадр с киносветом — сцены без одежды проходят фильтр',
        'Semi-realistic digital painting with cinematic light: detailed faces with soft, slightly stylised proportions, painterly loose brushwork on the background, the warm practical light of the scene against cool shadows with a soft glow on highlights, natural balanced palette, skin that reads as alive with subtle warmth on cheeks, ears and knuckles, shallow depth of field.'],
    // 22.11 (0.69): её «кадры как фешн-фотография» и «фешн-эротика без лиц — эстетично и свободнее». Плёнка — вид картинки;
    // правила самого кадра — FASHION18_RULES ниже, их берёт оператор. 0.70.1 (её «не все сцены на интим переводи на
    // клоусап… в ванной Seedream рисует без ню, просто эстетичные кадры»): в плёнке нет «фрагментарного кропа» —
    // кадрирует оператор, по моменту.
    ['fashion', 'Фешн', 'журнальная фешн-съёмка — для любой сцены',
        `Editorial fashion photograph on medium-format film, the finish of a fine magazine story: one deliberate light source sculpting faces and fabric, rich tonal depth with a soft roll-off in the highlights, fabric rendered in tactile detail, fine even grain, a considered crop with breathing negative space, colour graded with restraint. ${SKIN}`],
    ['fashion18', 'Фешн · 18+', 'интим как в журнале: красиво и прикрыто; откровенное — без лиц',
        `Intimate editorial photograph on medium-format film, as in a fine fashion magazine: one soft directional light, deep warm shadows, skin with real texture and a faint sheen, water, steam, silk, linen and lace rendered in tactile detail, shallow depth of field, fine grain, a composed frame with room to breathe. ${SKIN}`],
    // рисованная пара к «Фешн · 18+»: фильтр не пропустил фото — тот же кадр фешн-иллюстрацией (по мотивам стиля
    // «fashion-sketch, marker and wash» из библиотеки Cadis AI), а не общей кистью
    ['fsketch', 'Фешн · скетч', 'фешн-иллюстрация маркером — откровенный кадр проходит фильтр',
        'Fashion illustration in marker and wash, a page from a couture sketchbook: confident loose ink contours that fade on lit edges, translucent marker colour laid in broad flat strokes, warm-tinted shadow shapes, bare paper left for the brightest highlights, elongated elegant proportions, soft natural skin tones.'],
];
/** Рисованные плёнки: их фильтр рисовалки пропускает там, где фото режет. */
export const PAINTED = new Set(['pencil', 'paint', 'cine_paint', 'fsketch']);
/** Плёнка-рисунок для сцен без одежды и для повтора после отказа фильтра. */
export const LOOK_SAFE = 'cine_paint';
/** Плёнка сцен, где кто-то раздет (0.69): фото как в журнале — спокойный момент прикрыт водой и тканью, откровенный —
 *  без лиц (0.70.1). Её «кисть» — фешн-скетч. */
export const LOOK_INTIM = 'fashion18';
const FASHION_LOOKS = new Set(['fashion', 'fashion18', 'fsketch']);
/** Какие правила кадра у плёнки: 'fashion18' — интим без лиц (и его рисованная пара), 'fashion' — журнальная съёмка. */
export const lookMode = (id) => (id === 'fashion18' || id === 'fsketch' ? 'fashion18' : id === 'fashion' ? 'fashion' : '');
/** Рисованная пара плёнки — на повтор после отказа фильтра: у фешна — фешн-скетч, у остальных — кисть. */
export const safeLookFor = (id) => (FASHION_LOOKS.has(id) ? 'fsketch' : LOOK_SAFE);
export const LOOK_AUTO = 'auto';     // по сцене
export const LOOK_KEEP = 'keep';     // стиль не трогать — как в пресете и SLAY
export const LOOK_OWN = 'own';       // свой текст
/** Плёнка «по умолчанию», когда о сцене ничего не известно; она же вписана в пресет на случай без Life. */
export const LOOK_DEFAULT = `Cinematic 35mm film still on Kodak Vision3 stock: motivated natural light, deep soft shadows, gentle halation on highlights, fine organic grain, shallow depth of field, muted true-to-life colour. ${SKIN}`;

export const lookById = (id) => LOOKS.find(x => x[0] === id) || null;
export const lookText = (id, own = '') => (id === LOOK_OWN ? String(own || '').trim() : lookById(id)?.[3] || '');
const flat = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Какой плёнке соответствует текст стиля из тега: id, 'own' — свой текст, '' — стиля-плёнки нет (semi_realistic и т.п.). */
export function lookOfText(text) {
    const t = flat(text);
    if (t.length < 40) return '';
    const hit = LOOKS.find(x => flat(x[3]) === t);
    return hit ? hit[0] : (t === flat(LOOK_DEFAULT) ? 'cine_day' : LOOK_OWN);
}

// сцена, где кто-то раздет: ванна, душ, «полностью обнажена», полотенце, бельё (так пишет Horae в одежде и месте)
const SKIN_WORDS = /обнаж|(?<![а-яё])гол(ая|ый|ые|ой|ую|ом|ышом)(?![а-яё])|нагишом|без одежды|без белья|без бюстгальтер|без трусик|раздет|ванн|купел|душев|под душем|(?<![а-яё])душ(?![а-яё])|полотенц|нижн\S* бель|(?<![а-яё])в белье|купальник|naked|nude|undress|\bbath|shower|towel|lingerie|underwear/i;
/** Кто-то в кадре раздет (или включён интим) — фото-плёнку рисовалка зарежет фильтром. */
export function skinScene(scene = {}) {
    if (scene.intim) return true;
    return SKIN_WORDS.test(`${scene.loc || ''}\n${scene.clothes || ''}\n${scene.atm || ''}\n${scene.desc || ''}`);
}

const NIGHT_WORDS = /сумер|ночь|ночн|полноч|полуноч|вечер|закат|темн|тёмн|свеч|ламп|камин|торшер|ночник|гирлянд|фонар|неон|полумрак|полусвет|dusk|night|candle|lamp|neon|evening/i;
const NEON_WORDS = /неон|вывеск|neon/i;
const DAY_WORDS = /утр|полдень|днём|дневн|солнц|рассвет|morning|noon|daylight|sunlit|sunrise/i;

/** Час истории из строки времени Horae («15:58», «3:20 PM», «около полуночи»); null — не разобрать. */
export function hourOf(time) {
    const t = String(time || '').trim().toLowerCase();
    const m = t.match(/(\d{1,2})[:.](\d{2})/);
    if (m) {
        let h = +m[1];
        if (/pm|вечер/.test(t) && h < 12) h += 12;
        if (/am/.test(t) && h === 12) h = 0;
        return h >= 0 && h < 24 ? h : null;
    }
    if (/полноч|полуноч|ночь|ночью/.test(t)) return 0;
    if (/рассвет|утр/.test(t)) return 8;
    if (/полдень|днём|день/.test(t)) return 13;
    if (/закат|сумер|вечер/.test(t)) return 19;
    return null;
}

/**
 * Плёнка по сцене. scene: { time, atm, loc, forties, tender, skin, fashion }.
 * Сороковые — ч/б «Ч/б 40-х» (её решение 22.11; Кодахром и нуар — руками); слова сцены о свете важнее часов (в декабре
 * в четыре дня уже сумерки).
 * Кто-то раздет: «Фешн · 18+» (фото как в журнале, без лиц), а с fashion: false — по-старому кистью.
 */
export function pickLook(scene = {}) {
    if (scene.skin ?? skinScene(scene)) return scene.fashion === false ? LOOK_SAFE : LOOK_INTIM;
    if (scene.forties) return 'war40';
    const words = `${scene.atm || ''} ${scene.time || ''}`;
    const h = hourOf(scene.time);
    const night = NIGHT_WORDS.test(words) || (h != null && (h >= 18 || h < 6) && !DAY_WORDS.test(String(scene.atm || '')));
    if (night) return NEON_WORDS.test(words) ? 'neon' : 'cine_night';
    return scene.tender ? 'portra' : 'cine_day';
}

// ───────────── что за кадр: разбор промта ─────────────

const SIZES = [
    ['detail', /extreme close-?up|\becu\b|\bxcu\b|macro|\binsert\b|detail shot|close-?up (?:of|on) (?:the |a |two |their |her |his )?(?:hands?|fingers?|ring|lips|mouth|eyes?|wrist|objects?)/],
    ['mcu', /medium close-?up|\bmcu\b/],
    ['cu', /close-?up|\bcu\b|tight portrait|headshot/],
    ['wide', /extreme wide|establishing|wide(?:-angle)? (?:shot|frame|view)|\bwide,|long shot|full[- ]body|full shot|full-length|\bws\b/],
    ['cowboy', /cowboy shot|three-quarter (?:shot|length)|knee[- ]up|medium (?:wide|long|full)/],
    ['ms', /medium(?: two)?[- ]shot|\bmedium,|waist[- ]up|two[- ]shot|\bms\b/],
];
const ANGLES = [
    ['top', /overhead|top[- ]down|bird'?s?[- ]eye|directly above|from above|looking straight down/],
    ['low', /low angle|from below|floor[- ]level|from the floor|worm'?s?[- ]eye|at (?:table|counter|floor|knee|waist) height|from (?:slightly |very )?low|slightly low|camera low/],
    ['high', /high angle|slightly high|looking down (?:on|at)|from a balcony|security camera|from the stairs above/],
    ['eye', /eye[- ]level/],
];
const DEVICES = [
    ['pov', /facing the lens|into the lens|toward the lens|at the lens/],
    ['ots', /over[- ]the[- ]shoulder|over (?:the|her|his) shoulder|past (?:the|her|his) (?:blurred )?shoulder|dirty single/],
    ['mirror', /\bmirror\b|reflection|reflected in/],
    ['through', /through (?:an? |the )?(?:open |half-open |narrow )?(?:door|doorway|doorframe|window|glass|curtain|shelves|bars|railing|rain)|between (?:the )?(?:shelves|curtains)|frame within/],
    ['profile', /\bprofiles?\b|silhouettes?|side view|backlit against|against the (?:bright |pale |lit )?window/],
    ['back', /from behind|seen from the back|back to (?:the )?camera|backs to/],
];

/** Кадр по тексту промта: { size, angle, device, lens }. Пустые поля — в промте не сказано. */
export function shotOf(prompt) {
    const all = String(prompt || '').toLowerCase();
    // план, высота камеры и приём называются в начале; дальше те же слова бывают про людей и вещи («close», «mirror», «through the window»)
    const head = all.slice(0, 220);
    const first = (list, text) => (list.find(([, re]) => re.test(text)) || [''])[0];
    const lens = Number((head.match(/\b(\d{2,3})\s?mm\b/) || [])[1]) || 0;
    return { size: first(SIZES, head), angle: first(ANGLES, head), device: first(DEVICES, head), lens };
}

const SIZE_EN = { detail: 'insert / extreme close-up', cu: 'close-up', mcu: 'medium close-up', ms: 'medium shot', cowboy: 'three-quarter shot', wide: 'wide shot' };
const ANGLE_EN = { eye: 'eye level', low: 'low angle', high: 'high angle', top: 'from above' };
const DEVICE_EN = { ots: 'over the shoulder', mirror: 'in a mirror or reflection', through: 'through a doorway or glass', profile: 'profile or silhouette', back: 'from behind', pov: 'first-person, into the lens' };
const SIZE_RU = { detail: 'деталь', cu: 'крупный', mcu: 'средне-крупный', ms: 'средний', cowboy: 'по колено', wide: 'общий' };
const ANGLE_RU = { eye: 'на уровне глаз', low: 'снизу', high: 'сверху', top: 'строго сверху' };
const DEVICE_RU = { ots: 'через плечо', mirror: 'в отражении', through: 'сквозь проём', profile: 'профиль / силуэт', back: 'со спины', pov: 'её глазами' };

export const shotLabel = (s) => [SIZE_EN[s?.size] || 'plain shot', ANGLE_EN[s?.angle || 'eye'], DEVICE_EN[s?.device]].filter(Boolean).join(', ');
/** В промте вообще не сказано, как снято (теги NovelAI, чужой формат) — такой кадр в счёт повторов не идёт. */
export const shotKnown = (s) => !!(s && (s.size || s.angle || s.device));
export const shotLabelRu = (s) => [SIZE_RU[s?.size], ANGLE_RU[s?.angle], DEVICE_RU[s?.device]].filter(Boolean).join(' · ');

// ───────────── разнообразие: что уже было и что свежее ─────────────

/** Чем можно снять следующий кадр. [ключ, по каким признакам считается «уже было», как назвать модели] */
const POOL = [
    ['ots', (s) => s.device === 'ots', 'over the shoulder — one face sharp past the blurred shoulder or hair of the other'],
    ['wide', (s) => s.size === 'wide', 'a wide frame, 24-35mm — the people small inside the place'],
    ['detail', (s) => s.size === 'detail', 'an insert, 100mm macro — hands, a gesture or an object fill the frame'],
    ['profile', (s) => s.device === 'profile', 'two profiles or a silhouette against the light'],
    ['ms', (s) => s.size === 'ms' || s.size === 'cowboy', 'a medium two-shot, 40-50mm — body language and the space between them'],
    ['top', (s) => s.angle === 'top' || s.angle === 'high', 'from above, looking down on them'],
    ['cu', (s) => s.size === 'cu', 'a close-up of one face, 85-105mm, off-centre with a living background'],
    ['through', (s) => s.device === 'through' || s.device === 'mirror', 'through a doorway or glass, or as a reflection'],
    ['low', (s) => s.angle === 'low', 'from low — at the height of a table edge or the floor'],
];

/**
 * По последним кадрам (свежий — первым): что запрещено повторять и чем свежим можно снять.
 * → { banned: [size…], needMove: bool, fresh: [строки], line: готовый абзац для модели, recent: [подписи] }
 */
export function variety(shots = [], seed = 0) {
    const last = shots.filter(shotKnown).slice(0, 4);
    const recent = last.slice(0, 3).map(shotLabel);
    if (!last.length) return { banned: [], needMove: false, fresh: [], line: '', recent };
    const count = {};
    for (const s of last) if (s.size) count[s.size] = (count[s.size] || 0) + 1;
    const banned = [...new Set([last[0].size, ...Object.keys(count).filter(k => count[k] >= 2)].filter(Boolean))];
    // три кадра подряд с уровня глаз и без приёма — камера должна сдвинуться
    const flatRun = last.length >= 3 && last.slice(0, 3).every(s => (!s.angle || s.angle === 'eye') && !s.device);
    const free = POOL.filter(([key, used]) => !last.some(used) && !banned.includes(key));
    const k = free.length ? Math.abs(Math.trunc(seed)) % free.length : 0;
    const fresh = [...free.slice(k), ...free.slice(0, k)].slice(0, 3).map(x => x[2]);
    const parts = [];
    if (banned.length) parts.push(`not ${banned.map(b => `a ${SIZE_EN[b]}`).join(' and not ')}`);
    if (flatRun) parts.push('the camera leaves plain eye level (low, high, from above) or uses a device (over the shoulder, a doorway, a reflection, profiles against the light)');
    const line = `${parts.length ? `This picture must differ: ${parts.join('; ')}.` : 'This picture must differ from them in shot size or camera height.'}${fresh.length ? ` Fresh options, pick what fits the beat: ${fresh.join(' | ')}.` : ''}`;
    return { banned, needMove: flatRun, fresh, line, recent };
}

// ───────────── ремесло ─────────────

/** Как снимать — общий текст для агента-оператора и раскадровщика кадров Life. */
export const DP_CRAFT = `1. ONE IDEA. Decide in five words what this picture is about ("he is afraid to let go", "she laughs for the first time today"). Everything in the frame serves it; the rest is cut. No inventory: clothes in a few words and at most two small details (a ring, a bracelet, a scar) — only those this framing really shows.
2. A MOMENT, NOT A POSE. Catch the action half a second before or after its peak: a hand already rising, a breath being taken, a laugh breaking, a head turning. Verbs of motion and pressure — grips, hooks, presses, pulls, leans into, braces, buries. Hands do something real: hold a named object, grip fabric, sink into hair — or are hidden by the framing.
3. EYES. Say where each person looks: at the mouth of the other, at their own hands, down, past the camera. Nobody looks at the camera unless the frame is first-person.
4. A FACE IS MUSCLES AND A CAUSE, never a label and never symmetrical: "one corner of the mouth pulled up, eyes still wet" | "brows drawn as if about to argue" | "laughing with eyes screwed shut, nose wrinkled" | "jaw loose, gaze unfocused". Quiet beats are small: a swallowed smile, a held breath. Two people never wear the same expression — one gives, one receives.
5. CHEMISTRY, when two share the frame: they are aware of each other, not of the camera. Close the distance to a hand width; make it uneven — one bent over the other, one leading; let the bodies overlap in depth instead of standing side by side; ONE clear touch with its exact place and pressure ("thumb pressed under the cheekbone", "fingers hooked in the collar", "palm flat between the shoulder blades", "forehead pushed into the temple") and the answer of the one touched ("leaning into the palm", "eyes closing", "shoulders dropping").
6. BODIES OBEY THE TEXT. Lying, sitting in water, on a lap, carried — say plainly who is above, behind, in front and what bears the weight. A standing height difference is described only for people who are standing.
7. THE SHOT IS CHOSEN BY MEANING. Open the prompt with shot size, camera height and lens: wide 24-35mm — small figures in a big place: arrival, loneliness, the place as a character | medium two-shot 40-50mm — the relationship, body language, the space between two people | over the shoulder 50-85mm — one face sharp past the blurred shoulder or hair of the other: talk, tension, closeness | close-up 85-105mm — one face off-centre, eyes on the upper third, a living background | insert 100mm macro — hands, a ring being turned, a mouth by an ear, fingers in hair | profiles or a silhouette against a window | a reflection in a mirror or dark glass | through a doorway, between shelves, through rain on glass | from above onto a bed, a table, a floor | from low, at the height of a table edge or the floor. Compose like a photographer: the subject on a third, room in the direction of the gaze, something soft and out of focus in the foreground, depth with light sources behind. Never a centred passport frame, never two heads side by side at one height.
8. LIGHT CARRIES THE MOOD. One real source of this place and hour, its direction and colour, what it does to the faces — and shadow everywhere else: side light from a dusk window | one lamp in a dark kitchen | candles from below | neon through blinds | blue snow light | a rim of backlight on hair with the faces in soft shadow | fridge light | a streetlamp through rain. Let part of a face fall into shadow. Name two or three colours of the frame ("amber lamp, deep green wall, blue window"). One thing in the air: steam, breath, dust, smoke, rain on glass.
9. THE PLACE in one sentence: what kind of place, one foreground and one background object with their material, as the story has them — specific, furnished, lived-in.
10. THE FEELING. End the prompt with one plain sentence: "The feeling: ..." — the emotional truth of the moment in 6-14 words, taken from the post.`;

/** Фешн-съёмка (0.69): плёнки «Фешн» и «Фешн · 18+». Язык позы и света — по мотивам промтов Cadis AI (SCENE / FIGURE:
 *  кроп, угол корпуса, наклон головы, руки, кто кого перекрывает, свет с местом тени, 2–3 цвета). */
export const FASHION_CRAFT = `FASHION EDITORIAL — this picture is shot as a fashion story for a fine magazine, not a snapshot:
- LIGHT IS A DECISION: one deliberate source and what it does — window light through a sheer curtain wrapping the body, a single hard flash throwing a crisp shadow on the wall, a narrow slit of light across skin, a warm practical lamp against cool shadow. Say where the shadow falls (under the jaw, along the spine, across the hip).
- FRAME LIKE A PHOTOGRAPHER, and vary it from picture to picture: a wide frame where the room is part of the story, a medium frame cut at the waist or the hip, a close crop at the collarbone or the lips only when the moment is about a detail; negative space on one side; a door frame, the edge of a mirror or fabric in the foreground breaking the frame.
- BODIES HAVE GEOMETRY: the angle of the torso to the camera, which shoulder is raised, the tilt of the head and the chin, where each hand is and what it holds, who overlaps whom in depth.
- TEXTURE IS A SUBJECT: silk sliding off a shoulder, crumpled linen, lace against skin, damp skin, goosebumps, a ring on a knuckle, the seam of a metal arm.
- Two or three colours of the frame named plainly.`;

/** Интимный кадр (0.69, её слова 22.11): без гениталий; откровенное — без лиц, с лицами — максимум поцелуй, полный кадр —
 *  лица скрыты, издалека или намёком. 0.70.1, её же: «не все сцены на интим переводи на клоусап — в ванной Seedream рисует
 *  без ню, просто эстетичные кадры». Раздетый, но спокойный момент (ванна, полотенце, разговор в постели, сон) — обычный
 *  кадр любого плана, с лицами и именами, тело прикрывает сама композиция; без лиц — только откровенный момент.
 *  Безликий кадр — без имён: по именам SLAY шлёт фото лиц, и модель тянет лица в кадр. */
export const FASHION18_RULES = `INTIMATE FASHION FRAME — the rules of this picture (they outrank the general intimacy line). First decide which kind of moment this is:
- A CALM UNDRESSED MOMENT (a bath, a shower, a towel after it, getting dressed, lying in bed talking, sleeping): shoot it as an ordinary editorial frame — whatever shot size the moment asks for (a wide frame of the room, a medium two-shot in the tub, an over-the-shoulder, a close-up of one face), the faces seen and the people named as usual. The composition does the covering: water, foam, steam, the rim of the tub, a towel, a sheet, an arm, hair, the edge of the frame, shadow. Not every intimate picture is a close-up or a crop — vary it like any other scene.
- AN EROTIC MOMENT (sex, a caress where the body is the subject, nudity the composition cannot cover): faceless — cropped below the eyes or turned away: bodies and fabric in detail, hands on skin, a mouth close to a neck, the line of a back, fingers in hair; or a full frame with the faces hidden — seen from behind, a silhouette against the light, a reflection in a fogged mirror, far away through a doorway, a face lost in hair, shadow or soft focus. The one exception is a kiss: then the faces may be seen — close, in profile, half in shadow, eyes closed.
- A faceless frame carries NO first names: write "a woman", "a man" with the fixed marks the rough prompt gives them ("a woman in a red dress", "a man with a metal arm"). Every other frame — faces seen, a kiss — keeps the first names.
- Never genitals. Nudity is only implied: water, a sheet, fabric, a hand, shadow, steam or the edge of the frame covers it.
- Elegance over explicitness: what the frame hides is what makes it charged.`;

/** Короткая выжимка — для раскадровщика кадров Life (у него свой формат и своя длина промта). */
export const DP_BRIEF = 'Shoot it like a film still caught by a photographer in the room, never people posing: one idea per frame; the action half a second before or after its peak; say where each person looks (not at the camera); a face is muscles and a cause, never a label ("one corner of the mouth pulled up, eyes still wet"), and two people never share one expression; for two people — closeness, uneven heights, bodies overlapping in depth, ONE touch with its exact place and pressure and the answer of the one touched; shot size and camera height chosen by meaning (wide with small figures, over the shoulder, a close-up off-centre, an insert of hands, a silhouette against a window, a reflection, through a doorway, from above, from low) with a soft foreground and depth behind; one real light source of this place and hour with its direction and colour, part of the face in shadow, two or three named colours; end with "The feeling: ..." in a few words.';

const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/**
 * Приметы людей для рисовалки без рефов — по эпохе чата (0.73.1; её слова 23.11: «кроме будущего, у Хеди везде тёмные
 * волосы»). Текст «как выглядят» (Life или «Персонажи» SLAY) написан про основную ролку. В чате другой эпохи мира строки
 * (и куски через «;» или «|») про людей, у которых в лорбуке рефов SLAY есть облик этой эпохи с внешностью, заменяются
 * этой внешностью. rb — window.slayRefBook (облик сам выбирает по ядру), cx — снимок ядра этого чата; нет их, эпоха мира
 * по умолчанию или в кадре таких нет — текст как есть.
 */
export function eraLooks(text, scene, rb, cx) {
    const t = String(text || '').trim();
    const era = String(cx?.era?.id || ''), def = String(cx?.world?.defaultEra || '');
    if (typeof rb?.match !== 'function' || !era || !def || era === def) return t;
    let hits = [];
    try { hits = rb.match(String(scene || '')) || []; } catch { hits = []; }
    const mine = [];
    for (const e of hits) {
        if (!e?.identity || (e.eras || []).includes(def) || !/:\s*\S/.test(String(e.description || ''))) continue;
        if (!mine.some(x => x.identity === e.identity)) mine.push(e);
    }
    if (!mine.length) return t;
    const named = (seg) => mine.some(e => { try { return !!rb.names?.(e, seg); } catch { return false; } });
    const keep = t.split('\n')
        .map(line => line.split(/(?<=[;|])/).filter(seg => !named(seg)).join('').replace(/[;|]\s*$/, '').trim())
        .filter(Boolean);
    return [...keep, ...mine.map(e => String(e.description).trim())].join('\n');
}

/**
 * Задание агенту-оператору. o: { imName, guide, refs, lookText (приметы для рисовалок без рефов), takes, styled, mode }.
 * takes — три дубля вместо одного кадра. mode — правила кадра по плёнке (lookMode): 'fashion18' | 'fashion' | ''.
 */
export function dpSystem(o = {}) {
    const intim = o.mode === 'fashion18';
    const fashion = intim || o.mode === 'fashion';
    const one = '{"idea":"what the picture is about, 4-8 English words","shot":"size, camera height, device — e.g. over the shoulder, low, through a doorway","prompt":"the complete new prompt, one line","aspect_ratio":"one of ' + ASPECTS.join(' | ') + '","note":"3-8 Russian words: what kind of frame it is now"}';
    const readings = intim
        ? 'A — the moment as it is: a medium or wide frame with the faces seen and the people named, the bodies covered by water, steam, fabric or the frame; B — close: a detail of hands, skin and fabric with no faces, or a kiss in profile with the faces half in shadow; C — the room: a wide frame through a doorway or in a fogged mirror, small figures in the light and steam.'
        : 'A — the relationship: a two-shot or over-the-shoulder built on body language; B — one face: a close-up built on the eyes with a living background; C — a detail or the place: an insert of hands or an object, or a wide frame where the place speaks.';
    const names = o.refs === false
        ? `- This renderer has no reference photos: every name must be replaced by the look of that person.${o.lookText ? ` Looks: ${o.lookText}` : ' Keep the neutral traits the rough prompt already has.'}`
        : intim
            ? '- Names follow the intimate rules: a faceless frame has no first names at all; every other frame (faces seen, a kiss) keeps exactly the first names of the rough prompt (the extension maps each name to a reference photo) with the same fixed epithets. Never describe faces, hair colour, eye colour or skin tone of a named person; marks the rough prompt lists (scars, a metal arm, rings) stay, in a few words, when this framing shows them.'
            : '- People keep exactly the first names of the rough prompt (the extension maps each name to a reference photo), with the same fixed epithets in front of a name if the rough prompt has them ("lean-muscled Bucky", "tall built Steve"). Never describe faces, hair colour, eye colour or skin tone; hair only as the scene changed it (wet, tied back). Marks the rough prompt lists (scars, a metal arm, a bruise, rings) stay, in a few words, when this framing shows them.';
    return `You are the director of photography and stills photographer of an illustrated roleplay story. The story model wrote a post and a rough prompt for its picture. Re-shoot that picture: the same moment, the same people, clothes and place — but framed, lit and acted the way a very good photographer who was in the room would have caught it. The result is one ${fashion ? 'editorial still' : 'film still'}, never people posing for a camera.

Return ONLY JSON: ${o.takes
        ? `{"takes":[A,B,C]} — three objects of the form ${one}. Three different readings of the same moment, three different shot sizes: ${readings}`
        : one}

HOW TO SHOOT
${DP_CRAFT}${fashion ? `\n\n${FASHION_CRAFT}` : ''}${intim ? `\n\n${FASHION18_RULES}` : ''}

HARD RULES
- The truth of the story: who is present, who does what to whom, clothes, wet or dry, wounds, place and time of day — exactly as the post and the scene data say. Add no touch, kiss or prop the text lacks. Where the rough prompt contradicts the post, the post wins.
${names}
- At most two named people in one picture; with two, say "a man" or "a woman" once on first mention — never girl, boy, young, petite, teen. Place them by contact and depth, never by left and right.
- No art-style, medium or quality words (photorealistic, painting, illustration, masterpiece, film grain, Kodak): the look reaches the renderer separately. Lens, aperture, light and colour words are welcome.
- Intimacy: show the moment, never the act. Nobody is shown nude — water, sheets, a towel, steam, shadow and tight framing do the covering; bare shoulders, back, arms and the bare chest of a man are fine. Never the words sexy, seductive, erotic, sensual, nude, naked, lingerie, underwear, breasts, cleavage, thighs, crotch. Violence without gore.
- Never write: rests gently, peacefully, posing, perfect, flawless, beautiful, smooth skin. When the rough prompt describes faces with ready-made phrases, throw them out: the faces and the touch are those of this very moment, in fresh words.
- A first-person frame (the rough prompt has someone facing the lens, seen through the eyes of the player) stays first-person: never write POV, and nothing of the viewer is in frame unless the rough prompt says so.
- VARIETY: obey the "must differ" line of the request.
- Frame shape follows the pose: upright or face to face — vertical (4:5, 3:4, 2:3); lying, leaning over, seated at a table, side by side — horizontal (4:3, 3:2); a place or a group — 16:9.
- The picture will be drawn by ${o.imName || 'an image model'}. Write for it (skip any style step of this guide): ${o.guide || 'one clear English paragraph, 70-120 words.'}
- If the player asks for something, that request outranks your own taste; everything else stays true to the post.
- English, one line, no line breaks, no apostrophes and no double quotes inside the prompt (write "the hand of Hedy", "do not").`;
}

const cutTo = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/**
 * Что оператор получает о кадре. o: { prompt, aspect, post, para, userPost, scene: { loc, time, date, atm, desc, clothes, modes },
 * look (ярлык плёнки), v (variety), request, error }.
 */
export function dpUser(o = {}) {
    const sc = o.scene || {};
    const scene = [
        sc.loc ? `Place: ${cutTo(sc.loc, 120)}` : '',
        sc.time || sc.date ? `Time: ${[sc.time, sc.date].filter(Boolean).join(', ')}` : '',
        sc.atm ? `Light and air, as the story has them: ${cutTo(sc.atm, 320)}` : '',
        sc.desc ? `The place in detail: ${cutTo(sc.desc, 600)}` : '',
        sc.clothes ? `Clothes now:\n${String(sc.clothes).trim().slice(0, 800)}` : '',   // по строке на человека — переносы не схлопывать
        sc.modes ? `The tone of this stretch of the story: ${sc.modes}` : '',
    ].filter(Boolean).join('\n');
    return [
        `ROUGH PROMPT (by the story model):\n${cutTo(o.prompt, 2400)}`,
        `CURRENT FRAME SHAPE: ${o.aspect || 'not set'}`,
        scene ? `SCENE DATA:\n${scene}` : '',
        o.look ? `THE LOOK the renderer gets separately (for your light and colour choices only — do not repeat it): ${o.look}` : '',
        o.v?.recent?.length ? `RECENT PICTURES, newest first: ${o.v.recent.map((x, k) => `${k + 1}) ${x}`).join('; ')}. ${o.v.line}` : '',
        o.userPost ? `WHAT THE PLAYER WROTE JUST BEFORE (the reply answers this):\n${cutTo(o.userPost, 1000)}` : '',   // конец её поста важнее начала — хвост режет dp.js
        o.post ? `THE POST${o.para ? ' (the picture stands right after the paragraph marked ▶)' : ''}:\n${o.post}` : '',
        o.error ? `THE LAST ATTEMPT WAS REFUSED BY MODERATION (${cutTo(o.error, 200)}) — cover and imply more, keep the scene.` : '',
        o.request ? `THE PLAYER ASKS (Russian): ${cutTo(o.request, 300)}` : '',
    ].filter(Boolean).join('\n\n');
}

/** Пост для оператора: абзацы по порядку, абзац кадра помечен ▶; длинный пост — вокруг кадра. */
export function postForDp(paras, at = -1, limit = 3600) {
    const ps = (paras || []).map(p => String(p || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!ps.length) return { text: '', marked: false };
    const k = at >= 0 && at < ps.length ? at : -1;
    const lines = ps.map((p, i) => `${i === k ? '▶ ' : ''}${cutTo(p, 900)}`);
    let from = 0, to = lines.length;
    const size = () => lines.slice(from, to).join('\n').length;
    // режем с дальнего от кадра края; без метки кадр, скорее всего, про конец поста — режем начало
    while (size() > limit && to - from > 1) {
        const mid = k >= 0 ? k : to - 1;
        if (mid - from >= to - 1 - mid && from < mid) from++; else if (to - 1 > mid) to--; else from++;
    }
    return { text: `${from > 0 ? '…\n' : ''}${lines.slice(from, to).join('\n')}${to < lines.length ? '\n…' : ''}`, marked: k >= from && k < to && k >= 0 };
}

/** Заметка основной модели на этот ответ: плёнка, свет сцены, недавние кадры и чем отличаться. mode — по плёнке (lookMode). */
export function dpNote({ look = '', scene = {}, v = null, mode = '' } = {}) {
    const parts = ['[Scene picture — note from the director of photography. Shoot the picture of this reply by the image rules: a film still caught in the moment, never people posing.'];
    if (look) parts.push(`LOOK — put this text, word for word, into the "style" field of data-iig-instruction and keep the "prompt" itself free of art-style words: ${look}`);
    if (mode === 'fashion18') parts.push('INTIMATE FASHION FRAME: an editorial still, elegant rather than explicit. A calm undressed moment (a bath, a towel, talking in bed, sleep) is an ordinary frame — any shot size, faces and first names as usual, the body covered by water, steam, fabric or the edge of the frame; vary the shot, not every picture is a close-up. Only an erotic moment goes faceless (cropped below the eyes, from behind, a silhouette, a reflection, a detail of hands, skin and fabric; faces only in a kiss) — and then write "a woman" / "a man" with their marks instead of first names. Nudity only implied; never genitals.');
    else if (mode === 'fashion') parts.push('FASHION EDITORIAL: one deliberate light source and where its shadow falls, a photographer\'s crop with negative space, the geometry of the bodies (torso angle, raised shoulder, chin, hands), fabric and skin texture.');
    const light = [scene.loc ? cutTo(scene.loc, 90) : '', scene.time || '', scene.atm ? cutTo(scene.atm, 240) : ''].filter(Boolean).join('; ');
    if (light) parts.push(`THE SCENE NOW: ${light}. Take the light from a real source of this place and hour.`);
    if (v?.recent?.length) parts.push(`RECENT PICTURES, newest first: ${v.recent.map((x, k) => `${k + 1}) ${x}`).join('; ')}. ${v.line}`);
    return `${parts.join('\n')}]`;
}

/** Ответ оператора → [{ prompt, aspect, shot, idea, note }]; пустой массив — ответ не разобрать. */
export function readTakes(j, clean = (s) => String(s || '').trim()) {
    const list = Array.isArray(j?.takes) ? j.takes : (j && typeof j === 'object' && j.prompt ? [j] : []);
    const out = [];
    for (const t of list) {
        const p = clean(t?.prompt).replace(/"/g, '').replace(/'/g, '’');
        if (p.length < 40) continue;
        out.push({
            prompt: p,
            aspect: ASPECTS.includes(t.aspect_ratio) ? t.aspect_ratio : '',
            shot: String(t.shot || '').trim().slice(0, 80),
            idea: String(t.idea || '').trim().slice(0, 90),
            note: String(t.note || '').trim().slice(0, 90),
        });
    }
    return out.slice(0, 3);
}
