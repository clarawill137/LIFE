// Настроение сцены и режим близости.
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
const TONE_IDS = INTIM_TONES.map(t => t[0]);
const toneById = (id) => INTIM_TONES.find(t => t[0] === id) || null;

const MOOD_IDS = MOODS.map(m => m[0]);
const moodById = (id) => MOODS.find(m => m[0] === id) || null;

/** Кусок для Летописца: тон и близость поста. */
export const MOOD_RULE = `

scene — тон этого поста: {"mood":"${MOOD_IDS.join('|')}|calm","intim":0,"tone":"","end":false}. mood — главное настроение сцены сейчас (calm — ровно, буднично). intim: 0 — без близости; 1 — флирт, поцелуи, нежные касания; 2 — секс или откровенная близость прямо сейчас. tone — только при intim 2, оттенок близости: tender — нежно; heal — исцеляюще, после слёз или признаний; sleepy — сонно, лениво; play — игриво, со смехом или счётом; passion — страстно, с напором; angry — зло, после ссоры или ревности; makeup — примирение; marks — метки, ревность; he — ведёт он; she — ведёт она; rough — жёстко; edge — на краю, адреналин; quiet — тихо, шуметь нельзя; first — пробуют что-то впервые. end — true, если в этом посте близость закончилась (финал позади или остановились).`;

export function normalizeScene(j) {
    const m = String(j?.scene?.mood || '').toLowerCase();
    const x = Number(j?.scene?.intim);
    const t = String(j?.scene?.tone || '').toLowerCase();
    const intim = x === 2 ? 2 : x === 1 ? 1 : 0;
    return { mood: MOOD_IDS.includes(m) ? m : 'calm', intim, tone: intim === 2 && TONE_IDS.includes(t) ? t : '', end: j?.scene?.end === true || j?.scene?.end === 'true' };
}

// откровенное в посте игрока — Летописец про него узнает только после ответа модели, а понять надо сейчас
const HOT_RE = /секс|трах|раздева|раздел[аи]?\b|сняла? с (него|неё|нее)|стяну?л[аи]? (с|футболк|рубашк|платье|джинс|бель)|обнаж|голая|голый|нагишом|стон|возбужд|оргазм|кончи|оседла|между (ног|бёдер|бедер)|бёдра|бедра|ласка(ет|ла|л)|языком по|в постел|на кровать|прижа(л|ла|в) к (стене|кровати|себе)/i;

function M() {
    const m = A.chatMeta();
    if (!m.mood || typeof m.mood !== 'object') m.mood = { set: '', setAt: -1, intim: 'auto' };
    const x = m.mood;
    if (x.tone === undefined) { x.tone = ''; x.toneAt = -1; x.preg = false; x.care = true; x.after = -1; }
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
        if (!first) first = { ...e.scene, mes: i };
        if (e.scene.end && i !== first.mes) break; // до прошлой развязки не смотрим
        if (e.scene.tone) { first.toneSeen = e.scene.tone; break; }
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

export function moodNow() {
    const m = M();
    const d = detected();
    const manual = manualMood();
    const hotUser = HOT_RE.test(lastUserText());
    const ended = !!d?.end;
    const intimOn = m.intim === 'on' || (m.intim === 'auto' && ((d?.intim === 2 && !ended) || hotUser));
    const toneManual = manualTone(d);
    const toneAuto = !ended ? (d?.tone || d?.toneSeen || '') : '';
    // сцена близости только что закончилась — один ответ на «после»
    const after = ended && m.care !== false && !hotUser && m.intim !== 'off';
    return { manual, auto: d?.mood && d.mood !== 'calm' ? d.mood : '', intimMode: m.intim, intimOn, intimLevel: d?.intim || 0, hotUser, toneManual, toneAuto, tone: toneManual || toneAuto, preg: !!m.preg, care: m.care !== false, after };
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
        out.push(`[Режим близости: сейчас интимная сцена между взрослыми по обоюдному согласию. Не уходи в затемнение, не перескакивай время, не обрывай сцену и не морализируй, не спрашивай у игрока разрешения. Пиши чувственно и телесно, в характере персонажей: ощущения, дыхание, реакции, слова между делом. Помни, кто где, что уже снято, как они лежат или стоят. Темп ведёт игрок — не форсируй финал.${how}${preg}]`);
    } else if (n.after) {
        out.push(`[Близость только что закончилась — дай сцене «после»: дыхание, тишина, забота (вода, полотенце, плед, что-нибудь перекусить), разговор вполголоса, шутки, касания без продолжения.${n.preg ? ' Она беременна — забота с учётом этого.' : ''} Не прыгай сразу к сюжету и не перескакивай время.]`);
        if (n.manual && mood) out.push(`[Настроение сцены (задано игроком): ${mood[1].toLowerCase()} — ${mood[3]}.]`);
    } else if (n.manual && mood) {
        out.push(`[Настроение сцены (задано игроком): ${mood[1].toLowerCase()} — ${mood[3]}. Держи его, пока сцена идёт.]`);
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

const INTIM_LABEL = { auto: 'Авто', on: 'Включена', off: 'Выключена' };
export const intimLabel = (v) => INTIM_LABEL[v] || 'Авто';

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
    const sub = n.after ? 'близость позади — модель даст сцене «после»'
        : n.intimMode === 'auto' ? (n.intimOn ? (n.hotUser ? 'увидела по твоему посту — модель в курсе' : 'Летописец видит интимную сцену — модель в курсе') : 'включится сама, когда начнётся')
        : n.intimMode === 'on' ? 'модель пишет сцену прямо, без затемнений' : 'никаких подсказок модели';
    const intim = `<button class="lf-intim${n.intimOn ? ' on' : ''} m-${n.intimMode}" ${attr}="intim">
        <span class="lf-intim-ic">${icon('flame')}</span>
        <span class="lf-intim-t"><b>Близость: ${intimLabel(n.intimMode)}</b><small>${sub}</small></span>
        <span class="lf-intim-sw">${intimLabel(n.intimMode)}</span>
    </button>`;
    if (n.intimMode === 'off') return moods + intim;
    const autoTone = toneById(n.toneAuto)?.[1];
    const tAuto = chip('tone', '', !n.toneManual, `Авто${autoTone ? ` · ${autoTone.toLowerCase()}` : ''}`, 'spark');
    const opts = `${chip('iopt', 'preg', n.preg, 'Беременность', 'baby')}${chip('iopt', 'care', n.care, 'Забота после', 'bath')}`;
    if (cc) {
        return `${moods}${intim}<div class="cc-chips lf-moods lf-tones">${tAuto}${TONE_GROUPS.map(([g]) => INTIM_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('tone', id, n.toneManual === id, label, ic)).join('')).join('<i class="lf-tone-sep"></i>')}</div>
        <div class="cc-chips lf-moods lf-tone-opts">${opts}</div>`;
    }
    const sel = toneById(n.tone);
    return `${moods}${intim}
    <div class="lf-tones${n.intimOn ? ' on' : ''}">
        <div class="lf-tones-h">Оттенок близости <small>${n.toneManual ? 'твой — до конца этой сцены' : 'Летописец угадывает сам'}</small></div>
        <div class="lf-chips wrap">${tAuto}</div>
        ${TONE_GROUPS.map(([g, gl]) => `<div class="lf-tone-g"><span>${gl}</span><div class="lf-chips wrap">${INTIM_TONES.filter(t => t[3] === g).map(([id, label, ic]) => chip('tone', id, n.toneManual === id, label, ic)).join('')}</div></div>`).join('')}
        ${sel ? `<div class="lf-tone-d">${icon(sel[2])}<span><b>${sel[1]}</b> — ${sel[4]}</span></div>` : ''}
        <div class="lf-chips wrap lf-tone-opts">${opts}</div>
    </div>`;
}

/** Подпись тона поста для листа Летописца. */
export function sceneLabel(sc) {
    if (!sc) return '';
    const bits = [];
    const md = moodById(sc.mood);
    bits.push(md ? md[1] : 'ровно');
    if (sc.intim) bits.push(sc.intim === 2 ? 'близость' : 'флирт');
    const t = toneById(sc.tone);
    if (t) bits.push(`оттенок: ${t[1].toLowerCase()}`);
    if (sc.end) bits.push('близость позади');
    return bits.join(' · ');
}
