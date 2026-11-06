// Настроение сцены и режим секса (эмоциональная близость — не сюда).
// Летописец после каждого поста помечает тон и степень близости; можно задать тон руками.
// Модель получает короткую заметку, чтобы не гадать по контексту, где нежность, где ссора, а где постель.

import { icon } from './icons.js';

let A = null;
export function initMood(api) { A = api; }

export const MOODS = [
    ['tender', 'Нежность', 'heart', 'медленно и бережно: мягкие касания, взгляды, тихие слова, забота друг о друге; без резких поворотов'],
    ['passion', 'Страсть', 'flame', 'горячо и жадно: напор, нетерпение, сбитое дыхание, тело на первом плане'],
    ['play', 'Игриво', 'sparkles', 'легко и игриво: подколки, флирт, смех, дразнят друг друга'],
    ['rough', 'Жёстко', 'zap', 'резко и властно: напор, доминирование, грубость — в рамках того, на что персонажи согласны и что им нравится'],
    ['tension', 'Напряжение', 'eye', 'натянуто: недосказанность, паузы, тяжёлые взгляды; всё может сорваться в любую сторону'],
    ['fight', 'Ссора', 'flame', 'конфликт: обида, острые слова, никто не уступает сразу; без примирения на ровном месте'],
    ['comfort', 'Утешение', 'coffee', 'тихо и тепло: поддержка, объятия, бережность к чужой боли, без спешки'],
    ['drama', 'Тоска', 'moon', 'тяжело и честно: боль, память, недосказанное; внутренний голос громче слов'],
    ['fun', 'Смешно', 'sun', 'комедия: бытовой хаос, абсурд, юмор персонажей'],
    ['danger', 'Опасность', 'activity', 'угроза и экшн: темп, короткие фразы, тело и реакция, ставки высоки'],
];
/** Тон близости — отдельный ряд, работает, когда идёт интимная сцена. [id, ярлык, иконка, группа, текст для модели] */
export const INTIM_TONES = [
    ['tender', 'Нежно', 'heart', 'soft', 'медленно и бережно: много касаний и взглядов, шёпот, ласковые слова и имена, никуда не торопятся; реакция другого важнее финала'],
    ['heal', 'Исцеляюще', 'moon', 'soft', 'после слёз, флешбэка или тяжёлого признания. Близость как принятие: смотреть в глаза, называть вслух, что видишь и любишь, «я здесь», «ты со мной»; медленно, с паузами. Если близость превращается в анестезию или самонаказание («используй меня», «мне всё равно», желание сделать себе больно) — партнёр замечает, останавливается и говорит об этом прямо, а продолжает только бережно'],
    ['sleepy', 'Сонно', 'coffee', 'soft', 'лениво и тепло — утро или глубокая ночь: полусон, медленные движения, тупые шутки в подушку, никто не хочет вылезать из-под одеяла; бытовые помехи (будильник, кот) только смешат'],
    ['play', 'Игриво', 'sparkles', 'soft', 'смех посреди процесса, подколки и дразнилки, соревнование и счёт, тянут время; неловкости не ломают сцену, а смешат'],
    ['passion', 'Страстно', 'flame', 'hot', 'голод и напор: не дошли до кровати, одежда снята наполовину, сбитое дыхание, нетерпение, руки везде; коротко и жадно'],
    ['angry', 'Зло', 'zap', 'hot', 'на эмоциях после ссоры или ревности: злость сидит в теле и колкостях, резкий темп, крепкая хватка; каждый злится по-своему (кто-то тише и холоднее, кто-то нападает), злятся на ситуацию, а не хотят ранить друг друга'],
    ['makeup', 'Примирение', 'handshake', 'hot', 'после ссоры: сначала натянуто и осторожно, кто-то делает первый шаг, потом прорывает; извиняются телом и взглядом больше, чем словами; в конце облегчение, может, смех'],
    ['marks', 'Метки', 'eye', 'hot', 'после ревности или чужого внимания: оставить следы, «пусть видят», ревность с юмором и азартом; без слов-собственности и без унижения'],
    ['he', 'Ведёт он', 'target', 'hot', 'мягкое словесное доминирование: он командует голосом — «смотри на меня», «скажи ещё раз», «не отворачивайся», — а руки бережные; власть через внимание, не через боль'],
    ['she', 'Ведёт она', 'star', 'hot', 'она сверху и командует: режиссёрский голос, указания, дразнит и решает темп; он подчиняется добровольно и с удовольствием'],
    ['rough', 'Жёстко', 'zap', 'hot', 'жёстко и властно — потому что она сама этого хочет, и это желание, а не самонаказание; грубость в рамках оговорённого, стоп-слово уважается, после — забота'],
    ['edge', 'На краю', 'activity', 'special', 'перед опасностью или сразу после неё: адреналин, «а вдруг последний раз», быстро и цепко, держатся друг за друга, проверяют, что живы; эмоции прорываются'],
    ['quiet', 'Тихо', 'ear', 'special', 'шуметь нельзя — за стеной люди: шёпот, ладонь у рта, замирают на каждом звуке, смех в подушку; азарт от риска быть услышанными'],
    ['first', 'Впервые', 'spark', 'special', 'пробуют что-то новое: проговаривают, договариваются, спрашивают «так нормально?», неловко и смешно, стоп-слово наготове; доверие важнее техники'],
];
const TONE_GROUPS = [['soft', 'Мягко'], ['hot', 'Горячо'], ['special', 'Особое']];

/** Эмоциональная близость — не секс. [id, ярлык, иконка, группа, текст для модели] */
export const BOND_TONES = [
    ['talk', 'По душам', 'message', 'words', 'честный разговор без спешки: вопросы, паузы, ответы, которые даются не сразу; слушают друг друга по-настоящему, не сбивают шуткой и не уводят в постель'],
    ['open', 'Открывается', 'moon', 'words', 'кто-то из них (чаще он) сам выкладывает то, что тяготит и что обычно держит в себе: прошлое, вина, страх за семью и будущее; трудно, с паузами и обрывами, но сам; другой просто слушает и не чинит'],
    ['confess', 'Признание', 'heart', 'words', 'важные слова вслух — люблю, боюсь потерять, прости, спасибо; сказать трудно, сказанное меняет воздух в комнате; реакция другого важнее красивых формулировок'],
    ['mend', 'Примирение', 'handshake', 'words', 'примирение словами после ссоры: разобрать, что задело, признать свою часть, извиниться по-настоящему; без мгновенного «всё хорошо» и без секса вместо разговора'],
    ['future', 'Про будущее', 'sunrise', 'words', 'говорят о будущем: дом, дети, мечты, страхи о том, что будет; планы вслух, «а помнишь, мы говорили…»; надежда и тревога рядом'],
    ['comfort', 'Утешение', 'shield', 'near', 'утешение после кошмара, флешбэка или плохого дня: «я здесь», объятия, тишина, дышат вместе; без советов и попыток починить — просто быть рядом, пока не отпустит'],
    ['tender', 'Нежность', 'feather', 'near', 'нежность без эротики: перебирать волосы, поцелуй в лоб или висок, рука в руке, спят в обнимку; тепло, а не желание — к сексу не уводить'],
    ['care', 'Забота', 'coffee', 'near', 'забота о теле: раны, болезнь, усталость, беременность — обработать, накормить, укрыть, уложить, проверить, как ты; бережные руки и ворчание из любви'],
    ['home', 'Тихий быт', 'sofa', 'near', 'тихий быт, просто рядом: готовят, читают, кто-то засыпает на плече, кто-то чинит что-то под боком; близость в мелочах и привычках, сюжет не форсировать'],
    ['silly', 'Дурачатся', 'sun', 'near', 'дурачатся вдвоём: щекотка, глупые шутки, свои приколы пары, дразнилки, дурацкие танцы на кухне; смешно и тепло, без пафоса'],
    ['apart', 'Разлука', 'phone', 'far', 'они далеко друг от друга: звонки, сообщения, голосовые, его футболка вместо него, тоска в мелочах; не своди их вместе раньше времени'],
];
const BOND_GROUPS = [['words', 'Слова'], ['near', 'Рядом'], ['far', 'Далеко']];
const BOND_IDS = BOND_TONES.map(t => t[0]);
const bondById = (id) => BOND_TONES.find(t => t[0] === id) || null;
/** Тяжёлые тона: тут не до подкатов и не до распорядка дня. */
export const BOND_HEAVY = ['open', 'confess', 'mend', 'comfort', 'care', 'apart'];
const TONE_IDS = INTIM_TONES.map(t => t[0]);
const toneById = (id) => INTIM_TONES.find(t => t[0] === id) || null;

const MOOD_IDS = MOODS.map(m => m[0]);
const moodById = (id) => MOODS.find(m => m[0] === id) || null;

/** Кусок для Летописца: тон и близость поста. */
export const MOOD_RULE = `

scene — тон этого поста: {"mood":"${MOOD_IDS.join('|')}|calm","intim":0,"tone":"","end":false,"bond":0,"btone":""}. mood — главное настроение сцены сейчас (calm — ровно, буднично). intim — ТОЛЬКО про секс, эмоциональная близость сюда не относится: 0 — секса нет (объятия, утешение, слёзы, разговор по душам, признания, забота, сон или лежат в обнимку, поцелуй в лоб или в щёку, держатся за руки, нежность без эротики — всё это 0); 1 — сексуальный флирт и прелюдия: страстные поцелуи, откровенные намёки, руки под одеждой, начали раздевать друг друга, явно идёт к сексу; 2 — секс прямо сейчас, в этом посте: ласки ниже пояса, оральный секс, проникновение, оргазм. Сомневаешься — ставь меньше. tone — только при intim 2, оттенок секса: tender — нежно; heal — исцеляюще, после слёз или признаний; sleepy — сонно, лениво; play — игриво, со смехом или счётом; passion — страстно, с напором; angry — зло, после ссоры или ревности; makeup — примирение; marks — метки, ревность; he — ведёт он; she — ведёт она; rough — жёстко; edge — на краю, адреналин; quiet — тихо, шуметь нельзя; first — пробуют что-то впервые. end — true, если в этом посте секс закончился (финал позади или остановились). bond — эмоциональная близость, НЕ секс: 0 — нет; 1 — тепло между делом; 2 — сцена сейчас держится на близости: разговор по душам, утешение, признание, кто-то открывается о больном, нежность без эротики, примирение словами, забота о теле, дурачатся вдвоём, говорят о будущем, тоскуют в разлуке. btone — только при bond 2: ${BOND_TONES.map(t => `${t[0]} — ${t[1].toLowerCase()}`).join('; ')}. Секс и эмоциональная близость бывают одновременно — тогда ставь оба.`;

export function normalizeScene(j) {
    const m = String(j?.scene?.mood || '').toLowerCase();
    const x = Number(j?.scene?.intim);
    const t = String(j?.scene?.tone || '').toLowerCase();
    const intim = x === 2 ? 2 : x === 1 ? 1 : 0;
    const b = Number(j?.scene?.bond);
    const bond = b === 2 ? 2 : b === 1 ? 1 : 0;
    const bt = String(j?.scene?.btone || '').toLowerCase();
    return { mood: MOOD_IDS.includes(m) ? m : 'calm', intim, tone: intim === 2 && TONE_IDS.includes(t) ? t : '', end: j?.scene?.end === true || j?.scene?.end === 'true', bond, btone: bond === 2 && BOND_IDS.includes(bt) ? bt : '' };
}

// откровенное в посте игрока — Летописец про него узнает только после ответа модели, а понять надо сейчас.
// Только явный секс: объятия, «прижал к себе», «в постели» (там и спят), стон от боли — не секс.
// В JS \b не работает с кириллицей — границы слова руками.
const L = '(?:^|[^а-яё])';
const R = '(?![а-яё])';
const HOT_STRONG = [
    `${L}секс(?:а|у|ом|е)?${R}`, `${L}(?:от|за|по)?трах(?!е)`, 'оргазм', `${L}кончи(?:л|ла|ли|ть|т|шь|м)${R}`, `${L}конча(?:ю|ет|ешь|ем|ла|л)${R}`,
    `${L}(?:отсос|минет|кунилинг|оральн|клитор|стояк|эрекци)`, `${L}соск(?:и|ов|ом|ами|ах)${R}`, `${L}сосок${R}`,
    `${L}(?:трусы|трусики|трусиков|трусах|лифчик|бюстгальтер)[а-яё]*\\s+(?:на\\s+пол|в\\s+сторону|долой)`,
    `(?:сня|стяну|стащи|сдёрну|сдерну|спусти)(?:л|ла|ть|ю|ет)\\s+(?:с\\s+(?:него|неё|нее|меня|тебя)\\s+)?(?:трусы|трусики|бель[её]|лифчик|бюстгальтер)`,
    `раздева(?:ет|ла|л|ть|ю|я)\\s+(?:его|её|ее|меня|тебя)${R}`, `оседла(?:л|ла|ть|ет|ю)\\s+(?:его|её|ее|меня|тебя)${R}`,
    `(?:вош[её]л|входит|войти|войд[её]т|толкнулся|толкается)\\s+в\\s+(?:неё|нее|него|меня|тебя)${R}\\s*[,.—–-]?\\s*(?:до\\s+конца|глубже|медленно|резко|одним)`,
].map(x => new RegExp(x, 'i'));
const HOT_SOFT = [
    `${L}(?:голая|голый|голые|голышом|нагишом|нагая|нагой|обнаж[её]нн?(?:ая|ый|ые|ое))${R}`, `${L}(?:за|про)?стон(?:ет|ала|ал|ы|ов|ом)?${R}`,
    `${L}возбужд[её]н(?:а|ный|ная|ным|ную)?${R}`, `${L}(?:раздела?сь|разделись|раздевается|раздеваются)${R}`, 'между\\s+(?:её\\s+|его\\s+|ее\\s+)?(?:ног|бёдер|бедер)',
    'языком\\s+(?:по|вдоль|вниз)', `${L}(?:бёдра|бедра|ягодиц|член)`, `${L}(?:вош[её]л|входит|войти)\\s+в\\s+(?:неё|нее|него|меня)${R}`,
].map(x => new RegExp(x, 'i'));
/** Секс в тексте: одно явное слово или три разных намёка сразу. */
export function hotText(t, strict = false) {
    const s = String(t || '');
    if (!s) return false;
    if (HOT_STRONG.some(r => r.test(s))) return true;
    return !strict && HOT_SOFT.filter(r => r.test(s)).length >= 3;
}

function M() {
    const m = A.chatMeta();
    if (!m.mood || typeof m.mood !== 'object') m.mood = { set: '', setAt: -1, intim: 'auto' };
    const x = m.mood;
    if (x.tone === undefined) { x.tone = ''; x.toneAt = -1; x.preg = false; x.care = true; x.after = -1; }
    if (x.bond === undefined) { x.bond = 'auto'; x.btone = ''; x.btoneAt = -1; }
    return x;
}

/** Что Летописец сказал про последние посты: последний размеченный пост + оттенок близости из текущей сцены. */
function detected() {
    const chat = A.chatArr();
    let first = null;
    for (let i = chat.length - 1, n = 0; i >= 0 && n < 6; i--) {
        if (chat[i]?.is_user) continue;
        n++;
        const e = A.chronOf(i);
        if (!e?.scene) continue;
        if (!first) { first = { ...e.scene, mes: i }; first.bondOpen = e.scene.bond === 2; }
        if (first.bondOpen) { if (e.scene.bond !== 2) first.bondOpen = false; else if (e.scene.btone && !first.btoneSeen) first.btoneSeen = e.scene.btone; }
        if (first.toneDone) continue;
        if (e.scene.end && i !== first.mes) { first.toneDone = true; continue; } // до прошлой развязки не смотрим
        if (e.scene.tone) first.toneSeen = e.scene.tone, first.toneDone = true;
    }
    return first;
}

function lastUserText() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0 && i >= chat.length - 3; i--) if (chat[i]?.is_user) return String(chat[i].mes || '');
    return '';
}

/** Ручной тон действует до конца главы: сменилось место — снова авто. */
function manualMood() {
    const m = M();
    if (!m.set) return '';
    const list = A.chapters();
    const cur = list[list.length - 1];
    if (cur && m.setAt >= 0 && cur.start > m.setAt) { m.set = ''; A.saveMeta(); return ''; }
    return m.set;
}

/** Ручной оттенок близости — до конца этой сцены близости (или до новой главы). */
function manualTone(d) {
    const m = M();
    if (!m.tone) return '';
    const list = A.chapters();
    const cur = list[list.length - 1];
    if ((cur && m.toneAt >= 0 && cur.start > m.toneAt) || (d?.end && d.mes > m.toneAt)) { m.tone = ''; A.saveMeta(); return ''; }
    return m.tone;
}

/** Ручной оттенок близости — до конца главы. */
function manualBond() {
    const m = M();
    if (!m.btone) return '';
    const list = A.chapters();
    const cur = list[list.length - 1];
    if (cur && m.btoneAt >= 0 && cur.start > m.btoneAt) { m.btone = ''; A.saveMeta(); return ''; }
    return m.btone;
}

export function moodNow() {
    const m = M();
    const d = detected();
    const manual = manualMood();
    const btoneManual = manualBond();
    const btoneAuto = d?.bond === 2 ? (d.btone || d.btoneSeen || '') : '';
    const bondOn = m.bond === 'on' || (m.bond === 'auto' && (d?.bond === 2 || !!btoneManual));
    // пока сцена держится на чувствах — секс только по явному слову, намёки не считаются
    const hotUser = hotText(lastUserText(), bondOn);
    const ended = !!d?.end;
    const intimOn = m.intim === 'on' || (m.intim === 'auto' && ((d?.intim === 2 && !ended) || hotUser));
    const toneManual = manualTone(d);
    const toneAuto = !ended ? (d?.tone || d?.toneSeen || '') : '';
    // сцена близости только что закончилась — один ответ на «после»
    const after = ended && m.care !== false && !hotUser && m.intim !== 'off';
    return { manual, auto: d?.mood && d.mood !== 'calm' ? d.mood : '', intimMode: m.intim, intimOn, intimLevel: d?.intim || 0, hotUser, toneManual, toneAuto, tone: toneManual || toneAuto, preg: !!m.preg, care: m.care !== false, after,
        bondMode: m.bond, bondOn, bondLevel: d?.bond || 0, btoneManual, btoneAuto, btone: btoneManual || btoneAuto };
}

export function moodPrompt(type) {
    if (type === 'quiet' || type === 'impersonate') return '';
    const n = moodNow();
    const out = [];
    const mood = moodById(n.manual) || (n.intimOn || n.intimLevel ? moodById(n.auto) : null);
    const tone = toneById(n.tone);
    if (n.intimOn) {
        const how = tone ? ` Оттенок — ${tone[1].toLowerCase()}: ${tone[4]}.` : mood ? ` Тон: ${mood[3]}.` : '';
        const preg = n.preg ? ' Она беременна: учитывай живот и чувствительную грудь, позы без давления на живот, вес на локтях; желание и силы могут меняться от минуты к минуте — это не повод останавливаться, а повод быть внимательнее.' : '';
        out.push(`[Режим секса: сейчас сексуальная сцена между взрослыми по обоюдному согласию. Не уходи в затемнение, не перескакивай время, не обрывай сцену и не морализируй, не спрашивай у игрока разрешения. Пиши чувственно и телесно, в характере персонажей: ощущения, дыхание, реакции, слова между делом. Помни, кто где, что уже снято, как они лежат или стоят. Темп ведёт игрок — не форсируй финал.${how}${preg}]`);
    } else {
        if (n.after) out.push(`[Секс только что закончился — дай сцене «после»: дыхание, тишина, забота (вода, полотенце, плед, что-нибудь перекусить), разговор вполголоса, шутки, касания без продолжения.${n.preg ? ' Она беременна — забота с учётом этого.' : ''} Не прыгай сразу к сюжету и не перескакивай время.]`);
        if (n.bondOn) {
            const b = bondById(n.btone);
            out.push(`[Эмоциональная близость: сцена сейчас держится на чувствах, а не на сюжете и не на сексе. Не перескакивай время, не обрывай паузы, не торопи развязку и не своди к постели; дай место взглядам, мелочам, недосказанному и реакциям, в характере персонажей.${b ? ` Оттенок — ${b[1].toLowerCase()}: ${b[4]}.` : ''}${n.preg && b?.[0] === 'care' ? ' Она беременна — забота с учётом этого.' : ''}]`);
        }
        if (n.manual && mood) out.push(`[Настроение сцены (задано игроком): ${mood[1].toLowerCase()} — ${mood[3]}.${n.after || n.bondOn ? '' : ' Держи его, пока сцена идёт.'}]`);
    }
    return out.join('\n');
}

export function setMood(id) {
    const m = M();
    const list = A.chapters();
    m.set = m.set === id || !moodById(id) ? '' : id;
    m.setAt = list[list.length - 1]?.start ?? -1;
    A.saveMeta();
    A.updatePrompt();
}

export function setIntim(v) {
    const m = M();
    m.intim = ['auto', 'on', 'off'].includes(v) ? v : 'auto';
    A.saveMeta();
    A.updatePrompt();
}

export function setTone(id) {
    const m = M();
    m.tone = m.tone === id || !toneById(id) ? '' : id;
    m.toneAt = A.chatArr().length - 1;
    A.saveMeta();
    A.updatePrompt();
    return m.tone;
}

export function setBondTone(id) {
    const m = M();
    m.btone = m.btone === id || !bondById(id) ? '' : id;
    const list = A.chapters();
    m.btoneAt = list[list.length - 1]?.start ?? -1;
    A.saveMeta();
    A.updatePrompt();
    return m.btone;
}

export function cycleBond() {
    const m = M();
    m.bond = { auto: 'on', on: 'off', off: 'auto' }[m.bond] || 'auto';
    A.saveMeta();
    A.updatePrompt();
    return m.bond;
}

export function toggleIntimOpt(k) {
    const m = M();
    if (k === 'preg') m.preg = !m.preg;
    if (k === 'care') m.care = m.care === false;
    A.saveMeta();
    A.updatePrompt();
}

export function cycleIntim() {
    const m = M();
    setIntim({ auto: 'on', on: 'off', off: 'auto' }[m.intim] || 'auto');
    return M().intim;
}

const INTIM_LABEL = { auto: 'Авто', on: 'Включён', off: 'Выключен' };
export const intimLabel = (v) => INTIM_LABEL[v] || 'Авто';
const BOND_LABEL = { auto: 'Авто', on: 'Включена', off: 'Выключена' };

/** Блок для вкладки «Сцена» и пульта. kind: life | cc */
export function moodHtml(kind = 'life') {
    const n = moodNow();
    const cur = n.manual || '';
    const autoName = moodById(n.auto)?.[1];
    const cc = kind === 'cc';
    const attr = cc ? 'data-cc' : 'data-act';
    const cls = cc ? 'cc-chip' : 'lf-chip';
    const sp = cc ? '' : ' ';
    const chip = (act, id, on, label, ic) => `<button class="${cls}${on ? ' on' : ''}" ${attr}="${act}" data-v="${id}">${icon(ic)}${sp}${label}</button>`;
    const moods = `<div class="${cc ? 'cc-chips' : 'lf-chips'} lf-moods">
        ${chip('mood', '', !cur, `Авто${autoName ? ` · ${autoName.toLowerCase()}` : ''}`, 'spark')}
        ${MOODS.map(([id, label, ic]) => chip('mood', id, cur === id, label, ic)).join('')}
    </div>`;
    const sub = n.after ? 'секс позади — модель даст сцене «после»'
        : n.intimMode === 'auto' ? (n.intimOn ? (n.hotUser ? 'увидел по твоему посту — модель в курсе' : 'Летописец видит секс — модель в курсе') : 'включится сам, только когда дойдёт до секса')
        : n.intimMode === 'on' ? 'модель пишет сцену прямо, без затемнений' : 'никаких подсказок модели';
    const bond = bondHtml(n, cc, chip, attr);
    const intim = `<button class="lf-intim${n.intimOn ? ' on' : ''} m-${n.intimMode}" ${attr}="intim">
        <span class="lf-intim-ic">${icon('flame')}</span>
        <span class="lf-intim-t"><b>Секс: ${intimLabel(n.intimMode)}</b><small>${sub}</small></span>
        <span class="lf-intim-sw">${intimLabel(n.intimMode)}</span>
    </button>`;
    if (n.intimMode === 'off') return moods + bond + intim;
    const autoTone = toneById(n.toneAuto)?.[1];
    const tAuto = chip('tone', '', !n.toneManual, `Авто${autoTone ? ` · ${autoTone.toLowerCase()}` : ''}`, 'spark');
    const opts = `${chip('iopt', 'preg', n.preg, 'Беременность', 'baby')}${chip('iopt', 'care', n.care, 'Забота после', 'bath')}`;
    if (cc) {
        return `${moods}${bond}${intim}<div class="cc-chips lf-moods lf-tones">${tAuto}${TONE_GROUPS.map(([g]) => INTIM_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('tone', id, n.toneManual === id, label, ic)).join('')).join('<i class="lf-tone-sep"></i>')}</div>
        <div class="cc-chips lf-moods lf-tone-opts">${opts}</div>`;
    }
    const sel = toneById(n.tone);
    return `${moods}${bond}${intim}
    <div class="lf-tones${n.intimOn ? ' on' : ''}">
        <div class="lf-tones-h">Оттенок секса <small>${n.toneManual ? 'твой — до конца этой сцены' : 'Летописец угадывает сам'}</small></div>
        <div class="lf-chips wrap">${tAuto}</div>
        ${TONE_GROUPS.map(([g, gl]) => `<div class="lf-tone-g"><span>${gl}</span><div class="lf-chips wrap">${INTIM_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('tone', id, n.toneManual === id, label, ic)).join('')}</div></div>`).join('')}
        ${sel ? `<div class="lf-tone-d">${icon(sel[2])}<span><b>${sel[1]}</b> — ${sel[4]}</span></div>` : ''}
        <div class="lf-chips wrap lf-tone-opts">${opts}</div>
    </div>`;
}

/** Блок эмоциональной близости — над сексом, устроен так же. */
function bondHtml(n, cc, chip, attr) {
    const tl = bondById(n.btone)?.[1];
    const sub = n.btoneManual && n.bondOn ? `твой оттенок: ${tl.toLowerCase()} — модель в курсе`
        : n.bondMode === 'auto' ? (n.bondOn ? `Летописец видит${tl ? `: ${tl.toLowerCase()}` : ' сцену про чувства'} — модель в курсе` : 'включится сама, когда сцена про чувства')
        : n.bondMode === 'on' ? 'модель держит сцену на чувствах, без спешки и без постели' : 'никаких подсказок модели';
    const btn = `<button class="lf-intim lf-bond${n.bondOn ? ' on' : ''} m-${n.bondMode}" ${attr}="bond">
        <span class="lf-intim-ic">${icon('heart')}</span>
        <span class="lf-intim-t"><b>Близость: ${BOND_LABEL[n.bondMode] || 'Авто'}</b><small>${sub}</small></span>
        <span class="lf-intim-sw">${BOND_LABEL[n.bondMode] || 'Авто'}</span>
    </button>`;
    if (n.bondMode === 'off') return btn;
    const autoT = bondById(n.btoneAuto)?.[1];
    const tAuto = chip('btone', '', !n.btoneManual, `Авто${autoT ? ` · ${autoT.toLowerCase()}` : ''}`, 'spark');
    if (cc) return `${btn}<div class="cc-chips lf-moods lf-tones lf-btones">${tAuto}${BOND_GROUPS.map(([g]) => BOND_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('btone', id, n.btoneManual === id, label, ic)).join('')).join('<i class="lf-tone-sep"></i>')}</div>`;
    const sel = bondById(n.btone);
    return `${btn}
    <div class="lf-tones lf-btones${n.bondOn ? ' on' : ''}">
        <div class="lf-tones-h">Оттенок близости <small>${n.btoneManual ? 'твой — до конца главы' : 'Летописец угадывает сам'}</small></div>
        <div class="lf-chips wrap">${tAuto}</div>
        ${BOND_GROUPS.map(([g, gl]) => `<div class="lf-tone-g"><span>${gl}</span><div class="lf-chips wrap">${BOND_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('btone', id, n.btoneManual === id, label, ic)).join('')}</div></div>`).join('')}
        ${sel ? `<div class="lf-tone-d">${icon(sel[2])}<span><b>${sel[1]}</b> — ${sel[4]}</span></div>` : ''}
    </div>`;
}

/** Подпись тона поста для листа Летописца. */
export function sceneLabel(sc) {
    if (!sc) return '';
    const bits = [];
    const md = moodById(sc.mood);
    bits.push(md ? md[1] : 'ровно');
    if (sc.intim) bits.push(sc.intim === 2 ? 'секс' : 'прелюдия');
    const t = toneById(sc.tone);
    if (t) bits.push(`оттенок: ${t[1].toLowerCase()}`);
    if (sc.end) bits.push('секс позади');
    if (sc.bond === 2) { const b = bondById(sc.btone); bits.push(b ? `близость: ${b[1].toLowerCase()}` : 'близость'); }
    return bits.join(' · ');
}
