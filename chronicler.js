// Летописец: дешёвая модель после каждого поста чинит инвентарь Horae (дубли, мусор, кто держит),
// пишет короткие плашки «что изменилось», относит место к району карты, двигает шкалы отношений,
// замечает тайны и придумывает названия главам. Здесь — только чистые функции: промпт, разбор, применение.

export const CHRON_SYSTEM = `Ты — Летописец ролевой истории на русском. Ты не пишешь историю, а ведёшь её учёт.
Тебе дают последний пост, персонажей, место и список вещей, который ведёт трекер Horae. Этот трекер часто ошибается: плодит дубли с разными формулировками («ключи», «ключи от машины», «связка ключей»), записывает мусор (еду, жесты, мебель, одежду), путает, у кого вещь.

Верни ТОЛЬКО JSON, без пояснений и без markdown:
{
  "chips": [],
  "items": [],
  "place": null,
  "relations": [],
  "secrets": [],
  "title": ""
}

chips — 0–4 коротких факта о том, что изменилось в ЭТОМ посте, по 2–5 слов: «Приехали в бар», «Ключи у Хеди», «Баки отдал зажигалку». Только настоящие изменения. Ничего не изменилось — [].

items — правки списка вещей:
• Вещь — предмет, который важен для сюжета или ещё пригодится: ключи, телефон, оружие, документы, подарки, фото, машины и мотоциклы. НЕ вещи: одежда, обувь и украшения на теле (их ведёт Гардероб), части тела, съеденное и выпитое, мебель и интерьер, абстракции, чувства, звуки.
• Одна вещь — одна запись с коротким понятным названием («Ключи от купе», а не «ключи (связка, в сумке)»).
• holder — у кого вещь ПРИ СЕБЕ прямо сейчас: в руках, в кармане, в сумке на плече, на шее (имя из списка персонажей). Если вещь дома, в машине, на базе, в номере — holder "" и where — где именно. owner — чья это вещь (может не совпадать с holder: его кольцо у неё в кармане). Недвижимость, брони, мебель, техника для дома и запасы — никогда не при себе.
• Ничего не выдумывай: только то, что есть в посте и в списке.
Операции (названия из списка — ТОЧНО как в списке):
{"op":"merge","names":["…","…"],"into":"итоговое название","holder":"","owner":"","where":"","note":"","icon":"эмодзи","kind":"вещь|транспорт|оружие|документ|техника|подарок|ключи|недвижимость"}
{"op":"drop","name":"…"} — мусор, не вещь, съедено, израсходовано, уничтожено
{"op":"set","name":"…","holder":"","owner":"","where":"","note":"","icon":"","kind":""} — добавить пропущенную или исправить (у кого при себе, чья, где лежит, описание)
{"op":"rename","name":"…","to":"…"}
Если список и так чистый и в посте с вещами ничего не случилось — [].

place — где сейчас сцена, для карты: {"location":"место так, как его пишет Horae","region":"крупная часть карты, где это находится: район, город или страна — «Манхэттен», «Бруклин», «Бухарест», «База в Неваде». Если подходит один из известных районов — бери его","kind":"бар|квартира|штаб|кафе|улица|машина|…","inside":"здание, если место — комната внутри него, иначе пусто"}. Если места не понять — null.

relations — как в этом посте сдвинулись чувства одного персонажа к другому: [{"from":"кто чувствует","to":"к кому","trust":0,"closeness":0,"desire":0,"jealousy":0,"tension":0,"guilt":0,"moment":""}]. Чувства несимметричны: если сдвинулось у обоих — две записи (A→B и B→A), и они могут быть разными (один ревнует, другой нет; один простил, другой нет). Числа — изменение от −20 до +20, только если правда что-то сдвинулось. trust — доверие; closeness — душевная близость и привязанность; desire — чисто физическое, сексуальное влечение (бывает без любви, и любовь бывает без него); jealousy — ревность; tension — раздражение, обида, конфликт; guilt — вина перед другим. moment — ключевой момент пары в 3–8 слов («Оставил ключ от квартиры»), только если он был, и только в одной из двух записей. Ничего не сдвинулось — [].

secrets — новые тайны: [{"text":"что именно скрыто","knows":["кто знает"]}]. Только настоящие тайны, о которых знают не все.

title — {TITLE_RULE}`;

const TITLE_ASK = 'название главы, в которой идёт сцена: 1–3 слова, литературно, как глава романа, без кавычек и без названия места в лоб («После полуночи», «Холодный кофе», «Ключ под ковриком»).';
const TITLE_SKIP = 'пустая строка "".';

export const CLEAN_SYSTEM = `Ты — Летописец ролевой истории. Тебе дают весь список вещей трекера Horae. Он засорён: дубли с разными формулировками, мусор (одежда, еда, мебель, жесты), устаревшее.
Почисти его. Верни ТОЛЬКО JSON: {"items": [операции]} в том же формате:
{"op":"merge","names":["…"],"into":"…","holder":"","owner":"","where":"","note":"","icon":"","kind":""}
{"op":"drop","name":"…"}
{"op":"rename","name":"…","to":"…"}
{"op":"set","name":"…","holder":"","owner":"","where":"","note":"","icon":"","kind":""}
Названия из списка — ТОЧНО как в списке. Одежду, обувь и украшения на теле — drop (их ведёт Гардероб). Ничего не выдумывай.
Главное: в трекере holder часто записан как ВЛАДЕЛЕЦ, даже если вещь давно лежит дома. Исправь каждую такую вещь через set: holder — только если вещь правда при персонаже прямо сейчас (телефон, ключи, кольцо, жетоны, оружие, бумажник — по месту сцены и смыслу), иначе holder "", owner — чья, where — где лежит (дома, в ванной, в машине, на базе). Недвижимость, брони, мебель, техника для дома, аптечки, запасы и упаковки — всегда holder "". Абстракции («фамилия», «план») — drop.`;

const MOTIONS = ['rain', 'snow', 'steam', 'smoke', 'flicker', 'glow', 'pulse', 'heartbeat', 'scan', 'drift'];
const DETAIL_RULE = `

detail — ещё одна картинка к посту: эстетичная ДЕТАЛЬ крупным планом, как вставной кадр в кино. Верни объект:
{"prompt":"по-английски, 35–60 слов: один значимый для поста предмет или фрагмент крупно — руки, вещь, ткань, свет, стекло, экран, след, — макро или extreme close-up, малая глубина резкости, свет и погода сцены, без лиц (лицо — только размыто или частично), без текста","motion":"одно из: ${MOTIONS.join(', ')}","caption":"2–5 слов по-русски, как подпись к кадру"}
motion — какое движение оживит этот кадр: дождь на стекле — rain, пар от кофе — steam, сигаретный дым — smoke, свеча или неон — flicker, тёплый свет — glow, сердцебиение или пульс — heartbeat, экран УЗИ или монитора — scan, снег — snow, всё остальное — drift.
В интимных, откровенных или жестоких сценах — только символ и атмосфера: запотевшее стекло, капли, силуэты за матовым стеклом, смятые простыни в тени, сплетённые пальцы, дым свечи, огни города не в фокусе. Никакой наготы и ничего откровенного. Если деталь не нужна — null.`;

export function detailSystem() {
    return `Ты подбираешь к посту ролевой истории на русском один вставной кадр — деталь крупным планом. Ответь только JSON без пояснений: {"detail": {...}}.${DETAIL_RULE}`;
}

// ───── Жизнь: вкусы, инициатива персонажей, следы в местах, питомцы, память вещей ─────

export const IDEA_KINDS = {
    care: 'забота', court: 'ухаживание', flirt: 'подкат', touch: 'касание', spicy: 'пошлость', gift: 'подарок', own: 'свои дела', talk: 'разговор', plot: 'сюжет',
};

const ITEM_STORY_RULE = `
У операций set/merge можно добавить "from" — кто подарил или отдал вещь в ЭТОМ посте, и "story" — 3–10 слов, что с вещью случилось в этом посте («накинул ей на плечи под дождём», «нашла в кармане его куртки»). Только если правда было.`;

const PREFS_RULE = `

prefs — что в этом посте стало ясно про вкусы персонажей: [{"who":"имя","text":"что именно, 1–5 слов","kind":"like|dislike"}]. Любимый кофе, еда, цветы, музыка, книги, привычки, что раздражает, что пугает. Только сказанное или явно показанное, не догадки. Нечего — [].`;

const IDEAS_RULE = `

ideas — 0–2 новые идеи, что персонаж мог бы сделать САМ, по своей инициативе, в ближайших сценах — чтобы он жил своей жизнью и проявлял себя, а не только отвечал игроку. Только для персонажей из строки «Инициатива». Формат: [{"who":"имя","kind":"care|court|flirt|touch|spicy|gift|own|talk|plot","text":"8–20 слов, конкретно и в его характере","when":"scene|later|offscreen","where":"место, если важно"}].
kind: care — забота (принести кофе, укрыть пледом, заметить усталость); court — ухаживание, романтический жест (цветы утром, свидание, старомодная галантность); flirt — подкат, флирт, комплимент, дразнит; touch — касание или поцелуй мимоходом (обнять сзади, поцеловать в висок, рука на талии); spicy — провокационная пошлость или откровенный намёк вслух; gift — подарок, конкретный, с учётом её вкусов; own — свои дела, независимость (тренировка, работа, друзья, хобби, личные планы — он не сидит и не ждёт); talk — сам начинает важный или трудный разговор; plot — сюжетный ход по его линии.
court/flirt/touch/spicy — только если между ними и правда есть романтика или к ней идёт. Опирайся на характер, отношения, вкусы и то, что сейчас происходит. Не повторяй уже задуманное.
when: scene — можно прямо в текущей сцене; later — в другой раз; offscreen — сделает, пока игрока нет рядом (оставит записку, приготовит ужин, купит и спрячет подарок).
text для scene и later — что он сделает («принести ей кофе с корицей, как она любит»); для offscreen — как уже сделанное («приготовил ужин и оставил записку на холодильнике»).

done — номера идей из списка «Уже задумано», которые в ЭТОМ посте сбылись: [3, 7]. Нет — [].`;

const TRACES_RULE = `

traces — следы в местах, которые переживут эту сцену: [{"op":"add|remove","where":"место так, как пишет Horae, можно с комнатой через ·","text":"что осталось, 3–10 слов","kind":"trace|note|food|gift"}]. Бокалы после вечеринки, разбитое зеркало после драки, его футболка после ночёвки, записка на холодильнике (в text — суть записки), ужин в духовке, цветы на столе. remove — если следа больше нет (убрали, съели, выкинули), text — как в списке «Следы». Мелочи, которые завтра никто не вспомнит, не пиши. Нечего — [].`;

const PETS_RULE = `

pets — что в этом посте случилось с питомцами (и с новыми животными в доме): [{"name":"кличка","fed":false,"played":false,"petted":false,"cleaned":false,"hurt":"","with":"кто был с ним","moment":"3–8 слов, если был милый или важный момент","new":false,"kind":"кошка|собака|…","look":"как выглядит"}]. cleaned — убрали лоток или выгуляли. new — true, только если в истории появился новый питомец героев. Ничего — [].`;

const PEOPLE_RULE = `

people — люди-NPC (не главные герои) в ЭТОМ посте: [{"name":"имя","fact":"","status":"","new":false,"who":""}]. Для людей из строки «Люди»: fact — что о нём стало известно или что с ним случилось, 5–12 слов (только новое и важное, не пересказ сцены), status — active|away|hurt|missing|dead, только если сменился. new — true для НОВОГО постоянного человека с именем, которого нет ни в «Люди», ни среди героев, и который, похоже, ещё появится (не прохожий и не официант); who — кто это, 3–8 слов. Ничего — [].`;

const INNER_STATES = ['good', 'playful', 'thoughtful', 'sulky', 'irritated', 'restless', 'tired', 'unwell', 'sad', 'aroused'];
const INNER_RULE = `

inner — внутренняя жизнь персонажей из строки «Внутри» по ЭТОМУ посту: [{"who":"имя","ate":false,"slept":false,"washed":false,"tired":0,"hurt":"","healed":false,"state":"","why":"","thought":"","want":"","with":"","done":[],"spark":""}]. ate — нормально поел; slept — поспал; washed — душ или ванна; tired — насколько вымотался в посте, 0–30 (тренировка, драка, бессонная ночь); hurt — новая рана или травма, коротко, иначе ""; healed — рану обработали или она зажила. state — его состояние, только если сменилось: good|playful|thoughtful|sulky|irritated|restless|tired|unwell|sad|aroused, ok — если прошло и он снова ровный; why — почему, 3–8 слов. thought — если всплыла мысль или внутренний конфликт (прошлое, вина, будущее семьи, друзья, страхи), 6–14 слов, иначе "". want — его собственное новое желание, не про игрока (сходить с другом на хоккей, доделать полку), 6–14 слов, иначе ""; with — с кем. done — номера его желаний из строки «Внутри», которые в этом посте сбылись. spark — если в посте случилось то, что его сексуально заводит (из строки «Внутри» или очевидное: она надела красивое платье, вышла из душа, прикусила губу) — что именно, 3–8 слов, иначе "". Только то, что правда видно в посте. Ничего — [].`;

export function chronSystem(askTitle, askDetail = false, sim = {}) {
    let s = CHRON_SYSTEM.replace('{TITLE_RULE}', askTitle ? TITLE_ASK : TITLE_SKIP);
    const keys = [];
    let rules = '';
    if (askDetail) { keys.push('"detail": null'); rules += DETAIL_RULE; }
    if (sim.prefs) { keys.push('"prefs": []'); rules += PREFS_RULE; }
    if (sim.ideas) { keys.push('"ideas": []', '"done": []'); rules += IDEAS_RULE; }
    if (sim.traces) { keys.push('"traces": []'); rules += TRACES_RULE; }
    if (sim.pets) { keys.push('"pets": []'); rules += PETS_RULE; }
    if (sim.inner) { keys.push('"inner": []'); rules += INNER_RULE; }
    if (sim.people) { keys.push('"people": []'); rules += PEOPLE_RULE; }
    if (sim.moodRule) { keys.push('"scene": {"mood": "calm", "intim": 0}'); rules += sim.moodRule; }
    for (const x of sim.ext || []) if (x?.key) { keys.push(x.key); rules += x.rule || ''; }
    if (sim.itemStory) s = s.replace('Если список и так чистый', `${ITEM_STORY_RULE.trim()}\nЕсли список и так чистый`);
    if (keys.length) s = s.replace('  "secrets": [],', `  "secrets": [],\n  ${keys.join(',\n  ')},`);
    return s + rules;
}

/** Отдельный запрос: только идеи инициативы (кнопка «Придумать»). */
export function ideasSystem() {
    return `Ты — сценарист ролевой истории на русском. Придумай, что персонаж может сделать сам, по своей инициативе. Ответь только JSON: {"ideas": [...]}, 3–4 идеи разных видов.${IDEAS_RULE.split('done —')[0]}`;
}

function itemLine(name, it) {
    const bits = [];
    if (it?.holder) bits.push(`у ${it.holder}`);
    if (it?.owner && it.owner !== it.holder) bits.push(`чья: ${it.owner}`);
    if (it?.location) bits.push(`лежит: ${it.location}`);
    if (it?.description) bits.push(String(it.description).slice(0, 120));
    return `- ${name}${bits.length ? ` — ${bits.join('; ')}` : ''}`;
}

export function chronInput({ cast, location, when, regions, items, post, speaker, prev, chapterTitle, sim = null, extra = [] }) {
    const list = Object.entries(items || {});
    return [
        `Персонажи (так их и называй): ${cast.join('; ') || '—'}`,
        sim?.user ? `Игрок пишет за: ${sim.user}` : '',
        sim?.prefs ? `Известные вкусы: ${sim.prefs}` : '',
        sim?.init ? `Инициатива: ${sim.init}` : '',
        sim?.sched ? `Сейчас по распорядку: ${sim.sched}` : '',
        sim?.ideas ? `Уже задумано:\n${sim.ideas}` : '',
        sim?.traces ? `Следы в этом месте: ${sim.traces}` : '',
        sim?.pets ? `Питомцы: ${sim.pets}` : '',
        sim?.inner ? `Внутри:\n${sim.inner}` : '',
        sim?.people != null && sim?.peopleOn ? `Люди: ${sim.people || '— пока никого —'}` : '',
        ...(extra || []),
        `Место по Horae: ${location || 'не записано'}${when ? `. Время: ${when}` : ''}`,
        `Известные районы карты: ${regions.length ? regions.join(', ') : 'пока нет'}`,
        chapterTitle ? `Текущее название главы: ${chapterTitle}` : '',
        `Вещи сейчас (Horae, ${list.length}):`,
        list.length ? list.map(([n, it]) => itemLine(n, it)).join('\n') : '— пусто —',
        prev ? `\nПредыдущий пост (коротко):\n${prev}` : '',
        `\nПОСЛЕДНИЙ ПОСТ (${speaker || 'персонаж'}):\n${post}`,
    ].filter(Boolean).join('\n');
}

export function cleanInput({ cast, items }) {
    const list = Object.entries(items || {});
    return `Персонажи: ${cast.join('; ')}\nВещи (${list.length}):\n${list.map(([n, it]) => itemLine(n, it)).join('\n')}`;
}

export function extractJson(text) {
    const t = String(text || '').replace(/```(?:json)?/gi, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* попробуем подчистить */ }
    try { return JSON.parse(t.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

export function normalizeResult(j) {
    const arr = (v) => Array.isArray(v) ? v : [];
    const str = (v) => typeof v === 'string' ? v.trim() : '';
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-20, Math.min(20, Math.round(n))) : 0; };
    return {
        chips: arr(j?.chips).map(str).filter(Boolean).slice(0, 4),
        items: arr(j?.items).filter(o => o && typeof o === 'object' && ['merge', 'drop', 'set', 'rename'].includes(o.op)),
        place: j?.place && typeof j.place === 'object' && str(j.place.location) ? {
            location: str(j.place.location), region: str(j.place.region), kind: str(j.place.kind), inside: str(j.place.inside),
        } : null,
        // направленные записи (from → to); старый формат a/b — общий на пару
        relations: arr(j?.relations).filter(r => (str(r?.from) && str(r?.to)) || (str(r?.a) && str(r?.b))).map(r => ({
            a: str(r.from) || str(r.a), b: str(r.to) || str(r.b), dir: !!(str(r.from) && str(r.to)),
            trust: num(r.trust), closeness: num(r.closeness), desire: num(r.desire), jealousy: num(r.jealousy), tension: num(r.tension), guilt: num(r.guilt), moment: str(r.moment),
        })).filter(r => r.trust || r.closeness || r.desire || r.jealousy || r.tension || r.guilt || r.moment),
        secrets: arr(j?.secrets).filter(s => str(s?.text)).map(s => ({ text: str(s.text), knows: arr(s.knows).map(str).filter(Boolean) })),
        title: str(j?.title).replace(/^[«"']|[»"']$/g, ''),
        prefs: arr(j?.prefs).filter(x => str(x?.who) && str(x?.text)).map(x => ({ who: str(x.who), text: str(x.text).slice(0, 60), kind: str(x.kind) === 'dislike' ? 'dislike' : 'like' })).slice(0, 6),
        ideas: arr(j?.ideas).filter(x => str(x?.who) && str(x?.text).length > 5).map(x => ({
            who: str(x.who), kind: IDEA_KINDS[str(x.kind)] ? str(x.kind) : 'care', text: str(x.text).slice(0, 200),
            when: ['scene', 'later', 'offscreen'].includes(str(x.when)) ? str(x.when) : 'later', where: str(x.where).slice(0, 80),
        })).slice(0, 4),
        done: arr(j?.done).map(Number).filter(Number.isFinite),
        traces: arr(j?.traces).filter(x => str(x?.text)).map(x => ({
            op: str(x.op) === 'remove' ? 'remove' : 'add', where: str(x.where).slice(0, 80), text: str(x.text).slice(0, 120),
            kind: ['trace', 'note', 'food', 'gift'].includes(str(x.kind)) ? str(x.kind) : 'trace',
        })).slice(0, 8),
        pets: arr(j?.pets).filter(x => str(x?.name)).map(x => ({
            name: str(x.name).slice(0, 40), fed: !!x.fed, played: !!x.played, petted: !!x.petted, cleaned: !!x.cleaned, hurt: str(x.hurt).slice(0, 80),
            with: str(x.with), moment: str(x.moment).slice(0, 80), new: !!x.new, kind: str(x.kind).slice(0, 30), look: str(x.look).slice(0, 160),
        })).slice(0, 4),
        people: arr(j?.people).filter(x => str(x?.name)).map(x => ({
            name: str(x.name).slice(0, 60), fact: str(x.fact).slice(0, 160), who: str(x.who).slice(0, 80),
            status: ['active', 'away', 'hurt', 'missing', 'dead'].includes(str(x.status).toLowerCase()) ? str(x.status).toLowerCase() : '',
            new: x.new === true || x.new === 'true',
        })).slice(0, 6),
        inner: arr(j?.inner).filter(x => str(x?.who)).map(x => {
            const yes = (v) => v === true || v === 'true' || v === 1;
            const stt = str(x.state).toLowerCase();
            return {
                who: str(x.who), ate: yes(x.ate), slept: yes(x.slept), washed: yes(x.washed), healed: yes(x.healed),
                tired: Math.max(0, Math.min(40, Math.round(Number(x.tired) || 0))), hurt: str(x.hurt).slice(0, 80),
                state: INNER_STATES.includes(stt) || stt === 'ok' ? stt : '', why: str(x.why).slice(0, 80),
                thought: str(x.thought).slice(0, 180), want: str(x.want).slice(0, 180), with: str(x.with).slice(0, 40),
                done: arr(x.done).map(Number).filter(Number.isFinite).slice(0, 4), spark: str(x.spark).slice(0, 100),
            };
        }).slice(0, 6),
        detail: j?.detail && typeof j.detail === 'object' && str(j.detail.prompt).length > 20 ? {
            prompt: str(j.detail.prompt).slice(0, 700),
            motion: MOTIONS.includes(str(j.detail.motion).toLowerCase()) ? str(j.detail.motion).toLowerCase() : 'drift',
            caption: str(j.detail.caption).slice(0, 60),
        } : null,
    };
}

const lc = (v) => String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'`]/g, '').replace(/\s+/g, ' ').trim();

/** Базовое имя как у Horae: «Вода (2 л)» → «Вода»; «Кольцо (помолвочное)» не трогаем. */
export function baseName(name) {
    return String(name || '').replace(/\s*[(（]\s*\d[^)）]*[)）]\s*$/, '').trim();
}

function findKey(items, name) {
    if (!name) return null;
    if (items[name]) return name;
    const n = lc(name);
    for (const k of Object.keys(items)) if (lc(k) === n) return k;
    const b = lc(baseName(name));
    for (const k of Object.keys(items)) if (lc(baseName(k)) === b) return k;
    return null;
}

/**
 * Применить правки вещей к horae_meta сообщения. state — вещи Horae ПОСЛЕ этого сообщения.
 * Возвращает { undo, kinds, touched } — undo кладём рядом, чтобы откатить.
 */
export function applyItemOps(meta, state, ops) {
    meta.items = meta.items && typeof meta.items === 'object' ? meta.items : {};
    meta.deletedItems = Array.isArray(meta.deletedItems) ? meta.deletedItems : [];
    const undo = { items: JSON.parse(JSON.stringify(meta.items)), deletedItems: [...meta.deletedItems] };
    const all = { ...state, ...meta.items };
    const drops = new Set();
    const sets = new Map();
    const kinds = {};
    const touched = [];

    const drop = (name) => {
        const k = findKey(all, name);
        if (!k) return;
        if (meta.items[k]) delete meta.items[k];
        drops.add(k);
        touched.push(k);
    };
    const set = (name, o, fromKey) => {
        name = String(name || '').trim();
        if (!name) return;
        const base = all[fromKey] || all[findKey(all, name)] || {};
        const it = {
            icon: o.icon || base.icon || '',
            importance: base.importance || '',
            holder: o.holder !== undefined ? String(o.holder) : (base.holder || ''),
            // владелец не теряется, когда вещь «уходит» с рук: раньше трекер писал владельца в holder
            owner: o.owner ? String(o.owner) : (base.owner || base.holder || o.holder || ''),
            location: o.where !== undefined ? String(o.where) : (base.location || ''),
            description: o.note || base.description || '',
        };
        if (it.holder) it.location = it.location && o.where ? it.location : '';
        meta.items[name] = it;
        sets.set(name, it);
        if (o.kind) kinds[name] = o.kind;
        touched.push(name);
    };

    for (const o of ops) {
        try {
            if (o.op === 'drop') drop(o.name);
            else if (o.op === 'rename') {
                const k = findKey(all, o.name);
                if (!k || !o.to) continue;
                const keep = { ...all[k] };
                drop(k);
                set(o.to, { icon: o.icon, holder: keep.holder, owner: keep.owner, where: keep.location, note: keep.description, kind: o.kind }, null);
                all[o.to] = meta.items[o.to];
            } else if (o.op === 'merge') {
                const into = String(o.into || '').trim();
                const keys = (Array.isArray(o.names) ? o.names : []).map(n => findKey(all, n)).filter(Boolean);
                if (!into || !keys.length) continue;
                const first = { ...all[keys[0]] };
                for (const k of keys) if (lc(k) !== lc(into)) drop(k);
                all[into] = all[into] || first;
                set(into, o, into);
            } else if (o.op === 'set') {
                set(o.name, o, findKey(all, o.name));
            }
        } catch (e) { console.warn('[Life] правка вещи', o, e); }
    }
    // удаления, у которых базовое имя совпадает с новой записью, не нужны: Horae сам заменит старую запись новой
    const setBases = new Set([...sets.keys()].map(n => lc(baseName(n))));
    const keepDel = new Set(meta.deletedItems);
    for (const d of drops) if (!setBases.has(lc(baseName(d)))) keepDel.add(d);
    meta.deletedItems = [...keepDel].filter(d => !setBases.has(lc(baseName(d))));
    return { undo, kinds, touched };
}

export function restoreItems(meta, undo) {
    if (!meta || !undo) return;
    meta.items = JSON.parse(JSON.stringify(undo.items || {}));
    meta.deletedItems = [...(undo.deletedItems || [])];
}
