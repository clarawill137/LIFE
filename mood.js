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
const MOOD_IDS = MOODS.map(m => m[0]);
const moodById = (id) => MOODS.find(m => m[0] === id) || null;

/** Кусок для Летописца: тон и близость поста. */
export const MOOD_RULE = `

scene — тон этого поста: {"mood":"${MOOD_IDS.join('|')}|calm","intim":0}. mood — главное настроение сцены сейчас (calm — ровно, буднично). intim: 0 — без близости; 1 — флирт, поцелуи, нежные касания; 2 — секс или откровенная близость прямо сейчас.`;

export function normalizeScene(j) {
    const m = String(j?.scene?.mood || '').toLowerCase();
    const x = Number(j?.scene?.intim);
    return { mood: MOOD_IDS.includes(m) ? m : 'calm', intim: x === 2 ? 2 : x === 1 ? 1 : 0 };
}

// откровенное в посте игрока — Летописец про него узнает только после ответа модели, а понять надо сейчас
const HOT_RE = /секс|трах|раздева|раздел[аи]?\b|сняла? с (него|неё|нее)|стяну?л[аи]? (с|футболк|рубашк|платье|джинс|бель)|обнаж|голая|голый|нагишом|стон|возбужд|оргазм|кончи|оседла|между (ног|бёдер|бедер)|бёдра|бедра|ласка(ет|ла|л)|языком по|в постел|на кровать|прижа(л|ла|в) к (стене|кровати|себе)/i;

function M() {
    const m = A.chatMeta();
    if (!m.mood || typeof m.mood !== 'object') m.mood = { set: '', setAt: -1, intim: 'auto' };
    return m.mood;
}

/** Что Летописец сказал про последние посты. */
function detected() {
    const chat = A.chatArr();
    for (let i = chat.length - 1, n = 0; i >= 0 && n < 6; i--) {
        if (chat[i]?.is_user) continue;
        n++;
        const e = A.chronOf(i);
        if (e?.scene) return { ...e.scene, mes: i };
    }
    return null;
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

export function moodNow() {
    const m = M();
    const d = detected();
    const manual = manualMood();
    const hotUser = HOT_RE.test(lastUserText());
    const intimOn = m.intim === 'on' || (m.intim === 'auto' && (d?.intim === 2 || hotUser));
    return { manual, auto: d?.mood && d.mood !== 'calm' ? d.mood : '', intimMode: m.intim, intimOn, intimLevel: d?.intim || 0, hotUser };
}

export function moodPrompt(type) {
    if (type === 'quiet' || type === 'impersonate') return '';
    const n = moodNow();
    const out = [];
    const mood = moodById(n.manual) || (n.intimOn || n.intimLevel ? moodById(n.auto) : null);
    if (n.intimOn) {
        out.push(`[Режим близости: сейчас интимная сцена между взрослыми по обоюдному согласию. Не уходи в затемнение, не перескакивай время, не обрывай сцену и не морализируй, не спрашивай у игрока разрешения. Пиши чувственно и телесно, в характере персонажей: ощущения, дыхание, реакции, слова между делом. Помни, кто где, что уже снято, как они лежат или стоят. Темп ведёт игрок — не форсируй финал.${mood ? ` Тон: ${mood[3]}.` : ''}]`);
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

export function cycleIntim() {
    const m = M();
    setIntim({ auto: 'on', on: 'off', off: 'auto' }[m.intim] || 'auto');
    return M().intim;
}

const INTIM_LABEL = { auto: 'Авто', on: 'Включена', off: 'Выключена' };
export const intimLabel = (v) => INTIM_LABEL[v] || 'Авто';

/** Блок для вкладки «Сцена» и пульта. act — префикс data-атрибута действия. */
export function moodHtml(kind = 'life') {
    const n = moodNow();
    const cur = n.manual || '';
    const autoName = moodById(n.auto)?.[1];
    const attr = kind === 'cc' ? 'data-cc' : 'data-act';
    const chip = (id, label, ic) => `<button class="${kind === 'cc' ? 'cc-chip' : 'lf-chip'}${cur === id ? ' on' : ''}" ${attr}="mood" data-v="${id}">${icon(ic)}${kind === 'cc' ? '' : ' '}${label}</button>`;
    return `<div class="${kind === 'cc' ? 'cc-chips' : 'lf-chips'} lf-moods">
        <button class="${kind === 'cc' ? 'cc-chip' : 'lf-chip'}${!cur ? ' on' : ''}" ${attr}="mood" data-v="">${icon('spark')}${kind === 'cc' ? '' : ' '}Авто${autoName ? ` · ${autoName.toLowerCase()}` : ''}</button>
        ${MOODS.map(([id, label, ic]) => chip(id, label, ic)).join('')}
    </div>
    <button class="lf-intim${n.intimOn ? ' on' : ''} m-${n.intimMode}" ${attr}="intim">
        <span class="lf-intim-ic">${icon('flame')}</span>
        <span class="lf-intim-t"><b>Близость: ${intimLabel(n.intimMode)}</b><small>${n.intimMode === 'auto' ? (n.intimOn ? (n.hotUser ? 'увидела по твоему посту — модель в курсе' : 'Летописец видит интимную сцену — модель в курсе') : 'включится сама, когда начнётся') : n.intimMode === 'on' ? 'модель пишет сцену прямо, без затемнений' : 'никаких подсказок модели'}</small></span>
        <span class="lf-intim-sw">${intimLabel(n.intimMode)}</span>
    </button>`;
}
