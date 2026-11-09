// Фиксы вместо реролла. «✎ править» под ответом — всё про правку поста в одном месте, с подписями:
//  • абзац (тап по нему в тексте): жёстче / мягче / короче / голосом (из банка реплик) / пусть промолчит / своё —
//    меняется только он; «отсюда заново» — с фразы, куда тапнула, и до конца переписать; «кадр здесь»;
//  • весь пост: «<персона> — моя» (убрать написанное за героиню), «+ бит», «🐢 притормози» (пробежал момент галопом —
//    тот же кусок медленнее, до места, где нужна реакция героини), «из свайпов» (новым свайпом),
//    «плашки» (починить разметку, текст не трогая), «что записал пост», «вернуть» — как было до последней правки;
//  • ↻ на каждой плашке GC (шапка, «В сцене», заметки, карточки, дневник, матрица…) — заново только она, с подсказкой;
//  • «что где» — гайд по Life.
// Правит дешёвая модель Летописца — дешевле реролла и не трогает удачное.

import { setMesText } from './mend.js';
import { linesOf } from './voice.js';
import { locate } from './slip.js';

let A = null;
export function initFix(api) { A = api; }

const esc = (v) => A.esc(v);
const on = new Set();            // посты в режиме правки
const busy = new Set();
let pick = null;                 // { mes, line, who, sent } — выбранный абзац (who — чья часть в посте на двоих, sent — фраза под пальцем)
let plq = null;                  // { mes, k, label } — выбранная плашка
const user = () => A.canonName(A.ctx().name1) || 'игрок';

function M() {
    const cm = A.chatMeta();
    if (!cm.fix || typeof cm.fix !== 'object') cm.fix = {};
    if (!cm.fix.undo || typeof cm.fix.undo !== 'object') cm.fix.undo = {};
    return cm.fix;
}

// ───────────── абзацы: экран ↔ текст поста ─────────────

const plain = (t) => String(t || '').replace(/<[^>]+>/g, ' ').replace(/[*_~`]+/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (t) => A.norm(plain(t)).replace(/[^a-zа-я0-9 ]/gi, ' ').split(/\s+/).filter(w => w.length > 2);

/** Строки поста, которые можно править (без html-блоков плашек). */
function rawLines(mes) {
    const out = [];
    let depth = 0;
    for (const line of String(mes || '').split('\n')) {
        const opens = (line.match(/<(details|div|art|table|style|script|horae\w*)\b/gi) || []).length;
        const closes = (line.match(/<\/(details|div|art|table|style|script|horae\w*)>/gi) || []).length;
        const inBlock = depth > 0 || opens > 0;
        depth = Math.max(0, depth + opens - closes);
        const t = line.trim();
        if (!t || inBlock || /^<[^>]+>$/.test(t) || plain(t).length < 2) continue;
        if (/^(?:\*\*|__|\*|_)?\[\[[^[\]\n]{1,40}\]\](?:\*\*|__|\*|_)?:?$/.test(t)) continue; // метка части в посте на двоих
        out.push(line);
    }
    return out;
}

/** Строка поста, которая лучше всего совпадает с текстом на экране. */
export function matchLine(mes, shown) {
    const want = toks(shown);
    if (!want.length) return null;
    const ws = new Set(want);
    let best = null, score = 0;
    for (const line of rawLines(mes)) {
        const got = toks(line);
        if (!got.length) continue;
        const hit = got.filter(w => ws.has(w)).length;
        const s = hit / Math.max(want.length, got.length);
        if (s > score) { score = s; best = line; }
    }
    return score >= 0.5 ? best : null;
}

/** Текст сегмента абзаца, куда пришёлся тап (абзац может быть строками через <br>). */
function tappedText(p, ev) {
    let node = null;
    try {
        if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(ev.clientX, ev.clientY)?.startContainer || null;
        else if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(ev.clientX, ev.clientY)?.offsetNode || null;
    } catch { /* */ }
    if (!p.querySelector('br') || !node) return p.textContent || '';
    const segs = [[]];
    for (const ch of p.childNodes) { if (ch.nodeName === 'BR') segs.push([]); else segs[segs.length - 1].push(ch); }
    const seg = segs.find(s => s.some(ch => ch === node || ch.contains?.(node))) || segs[0];
    return seg.map(ch => ch.textContent || '').join('');
}

// ───────────── модель ─────────────

const RULES = (who) => `Ты редактор длинной литературной ролевой на русском. Сохраняй факты, имена, время, место, стиль и разметку поста (*курсив*, «кавычки», тире диалогов; строки вида [[Имя]] — метки, чья часть в посте на двоих, — оставляй как есть). Не пиши за ${who}: её слова, действия, мысли и ощущения — только её посты.`;

async function ask(system, input, tokens = 900) {
    const out = await A.askModel([{ role: 'system', content: system }, { role: 'user', content: input }], tokens);
    return String(out || '').replace(/^```\w*\n?|```$/g, '').trim();
}

const HOWS = {
    hard: ['жёстче', 'Сделай абзац жёстче и резче: меньше смягчений и нежности в словах, короче фразы, больше напора — но в характере говорящего.'],
    soft: ['мягче', 'Сделай абзац мягче и теплее: бережнее слова и жесты, больше заботы — без сахара и без смены смысла.'],
    short: ['короче', 'Сократи абзац примерно вдвое: оставь главное действие и лучшую реплику, убери воду и повторы.'],
    voice: ['его голосом', ''],
    quiet: ['пусть промолчит', ''],
    own: ['своё…', ''],
};

function speakerOf(i) { return A.chatArr()[i]?.name || ''; }

async function rewriteLine(i, line, how, custom = '', whoArg = '') {
    const m = A.chatArr()[i];
    if (!m || !String(m.mes).includes(line)) throw new Error('абзац уже поменялся — тапни заново');
    const who = A.canonName(whoArg || speakerOf(i));
    const sh = A.shortName(who);
    let task = HOWS[how]?.[1] || '';
    if (how === 'voice') {
        const vs = linesOf(who).slice(-6).map(x => `«${x.t}»`).join(' ');
        task = `Перепиши реплики и интонацию так, чтобы это звучало как ${who}, когда попадает в себя${vs ? ` — вот голос (образцы ритма и словаря, не вставляй их дословно): ${vs}` : ''}. Действия и смысл — те же.`;
    }
    if (how === 'quiet') task = `Пусть ${sh} здесь промолчит: убери реплики ${sh} из абзаца, вместо слов — молчание, взгляд, жест, действие; смысл можно передать без слов.`;
    if (how === 'own') task = `Что поправить: ${custom}`;
    if (how === 'ooc') {
        const vs = linesOf(who).slice(-6).map(x => `«${x.t}»`).join(' ');
        const core = A.coreOf?.(who) || '';
        task = `Здесь ${who} звучит не как он${custom ? ` (${custom})` : ''}. Перепиши его реплики и поведение в абзаце так, чтобы это был он — его словарь, ритм, манера${vs ? `; его голос (образцы, не вставлять дословно): ${vs}` : ''}${core ? `\nЯдро характера:\n${A.cut(core, 1200)}` : ''}\nСмысл сцены и действия других — те же.`;
    }
    const ctxText = A.cut(A.plainText ? A.plainText(m.mes) : plain(m.mes), 3500);
    const out = await ask(`${RULES(user())}\nПерепиши ТОЛЬКО один абзац по указанию. Длина — примерно та же, если не сказано иначе. Ответь только новым абзацем, без пояснений и кавычек вокруг.`,
        `Пост целиком (для контекста):\n${ctxText}\n\nАбзац, который надо переписать:\n${line}\n\nУказание: ${task}`, 700);
    const nl = out.split('\n').map(x => x.trim()).filter(Boolean).join(' ');
    if (!nl || nl.length < 2) throw new Error('модель вернула пустоту');
    const lead = line.match(/^\s*/)[0];
    await apply(i, String(m.mes).replace(line, () => lead + nl), `абзац: ${how === 'ooc' ? 'не он' : HOWS[how]?.[0] || 'своё'}`);
}

/** Переписать абзац, где цитата q, голосом who (для «⚠ не он»). why — что не так. */
export async function rewriteFor(i, q, who, why = '') {
    const raw = String(A.chatArr()[i]?.mes || '');
    const loc = locate(raw, q);
    const line = loc ? rawLines(raw).find(l => l.includes(loc.from)) || rawLines(raw).find(l => toks(l).join(' ').includes(toks(q).slice(0, 4).join(' '))) : null;
    if (!line) throw new Error('не нашла это место в посте — текст поменялся?');
    await rewriteLine(i, line, 'ooc', why, who);
}

async function apply(i, text, label) {
    const m = A.chatArr()[i];
    const old = m.mes;
    const ok = await setMesText(i, text);
    if (!ok) throw new Error('пост не поменялся');
    const u = M().undo;
    u[i] = { text: old, label, at: Date.now() };
    const keys = Object.keys(u);
    if (keys.length > 6) for (const k of keys.sort((a, b) => u[a].at - u[b].at).slice(0, keys.length - 6)) delete u[k];
    A.saveMeta();
}

// ───────────── целым постом ─────────────

async function mine(i) {
    const m = A.chatArr()[i];
    const U = user();
    const out = await ask(`${RULES(U)}
Модель написала в посте за ${U}: её реплики, действия, мысли, ощущения. Убери это, а нужные моменты передай через восприятие других персонажей — что они видят и слышат со стороны, коротко. Всё остальное оставь как есть, слово в слово, и разметку тоже (блоки <details>, <art>, <img …> — не трогать). Ответь только постом целиком.`, String(m.mes), 6000);
    if (out.length < String(m.mes).length * 0.4) throw new Error('модель вернула слишком мало — не меняю');
    await apply(i, out, `«${A.shortName(U)} — моя»`);
}

/** Куда дописывать: перед хвостом из блоков плашек (<details>, <art>, <div data-gc>), если он есть. */
function splitTail(mes) {
    const s = String(mes || '');
    const m = s.match(/\n\s*(<(?:details|div|art|table)\b[\s\S]*)$/i);
    if (!m) return [s.replace(/\s+$/, ''), s.slice(s.replace(/\s+$/, '').length)];
    const k = s.length - m[1].length;
    return [s.slice(0, k).replace(/\s+$/, ''), `\n\n${s.slice(k)}`];
}

async function beat(i, hint) {
    const m = A.chatArr()[i];
    const who = A.canonName(speakerOf(i));
    const [body, tail] = splitTail(m.mes);
    const out = await ask(`${RULES(user())}\nДопиши к посту ОДИН абзац — продолжение момента от лица ${who}, в том же голосе и стиле. Не закрывай сцену и не пиши за ${user()}. Ответь только новым абзацем.`,
        `Пост:\n${A.cut(body, 5000)}\n\n${hint ? `Что должно случиться в новом абзаце: ${hint}` : 'Добавь ещё один живой бит: действие, деталь, реплику.'}`, 600);
    const nl = out.split('\n').map(x => x.trim()).filter(Boolean).join(' ');
    if (!nl) throw new Error('модель вернула пустоту');
    await apply(i, `${body}\n\n${nl}${tail}`, 'ещё бит');
}

/** Отсюда заново: до выбранной фразы (или абзаца) остаётся, дальше — переписать. */
async function restFrom(i, line, sent, hint) {
    const m = A.chatArr()[i];
    const raw = String(m?.mes || '');
    const li = raw.indexOf(line);
    if (li < 0) throw new Error('абзац уже поменялся — тапни заново');
    let cut = li;
    if (sent) {
        const words = sent.split(/\s+/).filter(Boolean);
        const loc = words.length >= 2 ? locate(line, words.slice(0, 6).join(' ')) : null;
        const k = loc ? line.indexOf(loc.from) : -1;
        if (k > 0) cut = li + k;
    }
    const [body, tail] = splitTail(raw);
    if (cut >= body.length) throw new Error('дальше переписывать нечего');
    const head = raw.slice(0, cut).replace(/\s+$/, '');
    const oldRest = body.slice(cut).trim();
    const who = A.canonName(speakerOf(i));
    const out = await ask(`${RULES(user())}
Перепиши продолжение поста с указанного места: начало остаётся как есть, а дальше напиши заново — по-другому, от лица ${who}, в том же голосе, стиле и разметке, примерно той же длины. Не повторяй начало и не закрывай сцену. Ответь только новым продолжением.`,
        `Начало поста (остаётся):\n${A.cut(head, 4000)}\n\nСтарое продолжение (заменить; удачное можно оставить):\n${A.cut(oldRest, 3500)}${hint ? `\n\nКак должно пойти дальше: ${hint}` : ''}`, 2600);
    const rest = out.trim();
    if (rest.length < 20) throw new Error('модель вернула слишком мало — не меняю');
    const joiner = cut === li ? (head ? '\n\n' : '') : ' ';
    await apply(i, `${head}${joiner}${rest}${tail}`, 'отсюда заново');
}

/** Притормози: пост пробежал момент галопом — тот же кусок медленнее, и стоп там, где нужна реакция героини. */
async function slow(i, line, hint) {
    const m = A.chatArr()[i];
    const raw = String(m?.mes || '');
    const [body, tail] = splitTail(raw);
    const lines = rawLines(body);
    if (!lines.length) throw new Error('в посте нечего замедлять');
    const U = user();
    const who = A.canonName(speakerOf(i));
    const at = line ? lines.indexOf(line) : -1;
    const numbered = lines.map((l, k) => `[${k + 1}] ${l.trim()}`).join('\n');
    const out = await ask(`${RULES(U)}
Пост пробежал сцену галопом: перескочил время, свернул в пару фраз момент, который надо прожить. ${at >= 0 ? `Спешка — с абзаца [${at + 1}]: перепиши кусок с него` : 'Найди абзац, с которого началась спешка, и перепиши кусок с него'} МЕДЛЕННЕЕ — тот же момент, но раскрытый: действия по шагам, взгляды, паузы, детали, реплики; без новых событий и без прыжков во времени. Остановись там, где нужна реакция ${U} — её слова, решение или действие, — и закончи на этом, не пиши за неё. Всё, что в старом тексте шло дальше этой точки, — выбрось.
Ответ: первая строка «С: N» — номер абзаца, с которого переписываешь (всё до него остаётся как есть); дальше — новый текст от лица ${who}, в том же голосе, стиле и разметке, без номеров абзацев.`,
        `Пост по абзацам:\n${A.cut(numbered, 7000)}${hint ? `\n\nГде притормозить, что раскрыть: ${hint}` : ''}`, Math.max(4000, Number(A.settings().chron?.tokens) || 0));
    const mm = out.match(/^\s*[СсCc]\s*[:：.]?\s*(\d{1,3})\s*\n+([\s\S]+)$/);
    let n = at >= 0 ? at : mm ? Number(mm[1]) - 1 : 0;
    n = Math.max(0, Math.min(lines.length - 1, n));
    const text = (mm ? mm[2] : out).replace(/^\s*\[\d{1,3}\]\s*/gm, '').trim();
    if (text.length < 60) throw new Error('модель вернула слишком мало — не меняю');
    const cutAt = body.indexOf(lines[n]);
    if (cutAt < 0) throw new Error('пост уже поменялся — открой правку заново');
    const head = body.slice(0, cutAt).replace(/\s+$/, '');
    await apply(i, `${head}${head ? '\n\n' : ''}${text}${tail}`, 'притормози');
}

// ───────────── плашки: одна заново ─────────────

const ART_NAMES = { sms: 'СМС', chat: 'Переписка', voice: 'Голосовое', song: 'Песня', music: 'Песня', note: 'Записка', letter: 'Письмо', news: 'Новость', post: 'Пост в соцсети', receipt: 'Чек', doc: 'Документ', file: 'Документ', photo: 'Фото' };
const TAGS = { diary: 'Дневник', matrix: 'Матрица отношений', preg: 'Беременность', compass: 'Компас' };

/** Конец парного блока с вложенностью: s[from] — начало «<tag». Возвращает индекс за «</tag>» или -1. */
function closeOf(s, from, tag) {
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = from;
    let depth = 0;
    let m;
    while ((m = re.exec(s))) {
        if (m[1]) { depth--; if (depth === 0) return m.index + m[0].length; }
        else depth++;
    }
    return -1;
}

/** Плашки поста по порядку: { kind: top|details|art|diary|matrix|preg|compass, at, full, label, type }. */
export function plaqueBlocks(mes) {
    const s = String(mes || '');
    const out = [];
    const taken = [];
    const free = (a) => !taken.some(([x, y]) => a >= x && a < y);
    const add = (kind, at, end, label, type = '') => { if (end > at && free(at)) { out.push({ kind, at, full: s.slice(at, end), label, type }); taken.push([at, end]); } };
    for (const m of s.matchAll(/<div\b[^>]*\bdata-gc\s*=\s*["']top["'][^>]*>/gi)) add('top', m.index, closeOf(s, m.index, 'div'), 'Шапка');
    for (const [tag, label] of Object.entries(TAGS)) for (const m of s.matchAll(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi'))) add(tag, m.index, m.index + m[0].length, label);
    for (const m of s.matchAll(/<art\b([^>]*)>[\s\S]*?<\/art>/gi)) {
        const type = ((m[1] || '').match(/\btype\s*=\s*"([^"]*)"/i)?.[1] || '').toLowerCase();
        add('art', m.index, m.index + m[0].length, ART_NAMES[type] || (type ? `Карточка «${type}»` : 'Карточка'), type);
    }
    for (const m of s.matchAll(/<details\b[^>]*>/gi)) {
        if (!free(m.index)) continue;
        const end = closeOf(s, m.index, 'details');
        if (end < 0) continue;
        const full = s.slice(m.index, end);
        const sum = (full.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const scene = /data-gc\s*=\s*["']scene["']/i.test(m[0]);
        add('details', m.index, end, scene ? 'В сцене' : (A ? A.cut(sum, 40) : sum.slice(0, 40)) || 'Свёрнутый блок');
    }
    return out.sort((a, b) => a.at - b.at);
}

/** Эта же плашка в прошлых ответах — для преемственности (числа матрицы, время в шапке…). */
function prevPlaque(i, b) {
    const chat = A.chatArr();
    for (let j = i - 1; j >= 0 && j > i - 40; j--) {
        const m = chat[j];
        if (!m || m.is_user || m.is_system) continue;
        const hit = plaqueBlocks(m.mes).find(x => x.kind === b.kind && (b.kind !== 'details' || A.norm(x.label) === A.norm(b.label)) && (b.kind !== 'art' || x.type === b.type));
        if (hit) return hit.full;
    }
    return '';
}

const IMG_RE = /<img\b[^>]*>/gi;

async function regenPlaque(i, k, hint) {
    const m = A.chatArr()[i];
    const raw = String(m?.mes || '');
    const b = plaqueBlocks(raw)[k];
    if (!b) throw new Error('плашка уже поменялась — тапни ↻ заново');
    let prose = raw;
    for (const x of plaqueBlocks(raw).reverse()) prose = prose.slice(0, x.at) + prose.slice(x.at + x.full.length);
    prose = A.plainText ? A.plainText(prose) : plain(prose);
    const st = A.worldState?.() || {};
    const world = [[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' '), st.scene?.location, st.scene?.atmosphere, (st.scene?.characters_present || []).join(', ')].filter(Boolean).join(' · ');
    const prev = prevPlaque(i, b);
    const out = await ask(`Ты — служебная часть длинной ролевой на русском (пресет God Complex): пишешь плашки к постам. Перепиши ОДНУ плашку заново. Её разметка — образец формата: те же теги и атрибуты, те же маркеры-эмодзи, строки, порядок и язык. Содержание — по посту, к которому она относится, и по прошлой версии этой плашки (если есть — для преемственности чисел, дат и фактов), с учётом подсказки. Картинки <img …> внутри оставь тем же тегом целиком, если подсказка не просит другую картинку. Пост не пересказывай и не меняй. Не пиши за ${user()} её мысли и чувства. Ответь только плашкой — от открывающего тега до закрывающего, без пояснений.`,
        `Плашка «${b.label}» (написать заново):\n${b.full}\n\nПост (текст без плашек):\n${A.cut(prose, 5000)}${prev ? `\n\nЭта же плашка в прошлом ответе:\n${A.cut(prev, 2500)}` : ''}${world ? `\n\nМир сейчас: ${world}` : ''}${hint ? `\n\nЧто поправить: ${hint}` : ''}`,
        Math.max(2500, Math.ceil(b.full.length / 2) + 1200, Number(A.settings().chron?.tokens) || 0));
    const got = plaqueBlocks(out);
    const nb = got.find(x => x.kind === b.kind && (b.kind !== 'details' || A.norm(x.label) === A.norm(b.label))) || got.find(x => x.kind === b.kind);
    if (!nb) throw new Error('модель вернула не плашку — попробуй ещё раз');
    let text = nb.full;
    // картинка: без просьбы — та же (уже нарисованная), а не новая
    const oldImgs = b.full.match(IMG_RE) || [];
    if (oldImgs.length && !/фото|картин|снимок|кадр|изображ|photo|image/i.test(hint || '')) {
        const newImgs = text.match(IMG_RE) || [];
        if (!newImgs.length) {
            const close = text.lastIndexOf('</');
            text = `${text.slice(0, close).replace(/\s+$/, '')}\n${oldImgs.join('\n')}\n${text.slice(close)}`;
        } else {
            let n = 0;
            text = text.replace(IMG_RE, (tag) => oldImgs[n++] || tag);
        }
    }
    if (text.trim() === b.full.trim()) throw new Error('вышла та же плашка — подскажи, что поправить');
    await apply(i, raw.slice(0, b.at) + text + raw.slice(b.at + b.full.length), `плашка «${b.label}»`);
    // скрипты GC перерисуют плашку — вернуть ↻ на место
    setTimeout(() => A.paintSoon?.(), 450);
    setTimeout(() => A.paintSoon?.(), 1600);
}

/** Плашки в посте на экране ↔ блоки текста: [[элемент, k]]. */
function plaqueEls(el, list) {
    const box = el.querySelector('.mes_text');
    if (!box || !list.length) return [];
    const out = [];
    const used = new Set();
    const take = (node, k) => { if (node && k >= 0 && !used.has(node) && !out.some(([, kk]) => kk === k)) { used.add(node); out.push([node, k]); } };
    const arts = list.map((b, k) => [b, k]).filter(([b]) => b.kind === 'art');
    [...box.querySelectorAll('.gca')].filter(c => !c.parentElement?.closest('.gca')).forEach((c, n) => take(c, arts[n]?.[1] ?? -1));
    for (const [kind, sel] of [['diary', '.gc-diary'], ['matrix', '.gc-mx'], ['preg', '.gc-preg'], ['compass', '.cmp']]) take(box.querySelector(sel), list.findIndex(b => b.kind === kind));
    take(box.querySelector('[data-gc="top"]'), list.findIndex(b => b.kind === 'top'));
    const dets = [...box.querySelectorAll('details')].filter(d => !d.matches('.gc-diary, .gc-mx, .gc-preg, .cmp') && !d.closest('.gca, .gc-diary, .gc-mx, .gc-preg, .cmp') && !d.parentElement?.closest('details'));
    for (const d of dets) {
        const lab = A.norm(d.querySelector('summary')?.textContent || '').replace(/[↻▸▾►▼]/g, '').trim();
        const scene = d.matches('[data-gc="scene"]');
        const k = list.findIndex((b, j) => b.kind === 'details' && !out.some(([, kk]) => kk === j) && (scene ? b.label === 'В сцене' : !!lab && (A.norm(b.label) === lab || lab.startsWith(A.norm(b.label)) || A.norm(b.label).startsWith(lab.slice(0, 20)))));
        take(d, k);
    }
    return out;
}

/** ↻ на каждой плашке поста — только в режиме правки. */
function paintPlaques(el, id, open) {
    if (!open) { el.querySelectorAll('.lf-plq').forEach(x => x.remove()); return; }
    const m = A.chatArr()[id];
    const list = plaqueBlocks(m?.mes);
    for (const [node, k] of plaqueEls(el, list)) {
        const host = node.matches('details') ? node.querySelector('summary') || node : node;
        const cur = host.querySelector(':scope > .lf-plq');
        const on = plq?.mes === id && plq.k === k;
        if (cur && cur.dataset.k === String(k)) { cur.classList.toggle('on', on); continue; }
        cur?.remove();
        if (!node.matches('details') && getComputedStyle(node).position === 'static') node.style.position = 'relative';
        host.insertAdjacentHTML('beforeend', `<span class="lf-own lf-plq${on ? ' on' : ''}${host !== node ? ' in-sum' : ''}" data-k="${k}"><button type="button" data-act="fx-plq" data-mes="${id}" data-k="${k}" title="заново только эту плашку">↻</button></span>`);
    }
}

// ───────────── плашки: разметка ─────────────

const PAIRED = ['details', 'summary', 'div', 'art', 'blockquote', 'span', 'center', 'font', 'table'];

/** Починить разметку, не трогая слова. Возвращает { text, fixed: [что] }. */
export function fixMarkup(src) {
    let s = String(src || '');
    const fixed = [];
    // 1) инструкция SLAY: кривые кавычки и битый JSON
    s = s.replace(/data-iig-instruction\s*=\s*(["'])([\s\S]*?)\1(?=[\s>\/])/gi, (all, q, v) => {
        let raw = v.replace(/&quot;|&#34;/g, '"').replace(/&apos;|&#39;/g, "'");
        try { JSON.parse(raw); return all; } catch { /* чиним ниже */ }
        let t = raw.replace(/[“”„«»]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, '$1');
        try { const j = JSON.parse(t); fixed.push('кавычки в инструкции картинки'); return `data-iig-instruction='${JSON.stringify(j).replace(/'/g, '’')}'`; } catch { /* по кускам */ }
        const pr = t.match(/"prompt"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"|})/);
        if (!pr) return all;
        const j = { style: (t.match(/"style"\s*:\s*"([^"]*)"/) || [])[1] || 'photo', prompt: pr[1].replace(/"/g, '\''), aspect_ratio: (t.match(/"aspect_ratio"\s*:\s*"([^"]*)"/) || [])[1] || '4:3' };
        fixed.push('инструкция картинки собрана заново');
        return `data-iig-instruction='${JSON.stringify(j).replace(/'/g, '’')}'`;
    });
    // 2) картинка без тега: голый JSON инструкции в тексте
    s = s.replace(/(^|\n)\s*(\{\s*"(?:style|prompt)"\s*:[^\n]*?"prompt"[^\n]*\})\s*(?=\n|$)/g, (all, lead, json) => {
        let j = null;
        try { j = JSON.parse(json.replace(/[“”„«»]/g, '"')); } catch { return all; }
        if (!j?.prompt) return all;
        fixed.push('картинка без тега');
        return `${lead}<img data-iig-instruction='${JSON.stringify(j).replace(/'/g, '’')}' src="[IMG:GEN]">`;
    });
    // 3) <img …> без закрывающей скобки в конце строки
    s = s.replace(/<img\b([^>\n]*)$/gim, (all, rest) => { fixed.push('незакрытый <img>'); return `<img${rest}>`; });
    // 4) незакрытые парные блоки — закрыть в конце, в обратном порядке
    const stack = [];
    const re = /<(\/?)([a-z]+)\b[^>]*?(\/?)>/gi;
    let m2;
    while ((m2 = re.exec(s))) {
        const [, close, tagRaw, self] = m2;
        const tag = tagRaw.toLowerCase();
        if (!PAIRED.includes(tag) || self) continue;
        if (!close) stack.push(tag);
        else { const k = stack.lastIndexOf(tag); if (k >= 0) stack.splice(k, 1); }
    }
    if (stack.length) {
        fixed.push(`незакрытые блоки: ${stack.map(t => `<${t}>`).join(', ')}`);
        s = `${s.replace(/\s+$/, '')}\n${stack.reverse().map(t => `</${t}>`).join('')}`;
    }
    return { text: s, fixed };
}

// ───────────── из свайпов ─────────────

function swipeParas(m) {
    const out = [];
    (m?.swipes || []).forEach((sw, si) => {
        const [body] = splitTail(sw);
        String(body || '').split(/\n{2,}/).map(x => x.trim()).filter(x => plain(x).length > 1).forEach((p, pi) => out.push({ si, pi, t: p }));
    });
    return out;
}

function mergeSheet(i) {
    const m = A.chatArr()[i];
    const list = swipeParas(m);
    if ((m?.swipes || []).length < 2) { A.toast('info', 'У этого ответа один вариант — свайпни, чтобы было из чего собирать'); return; }
    A.openHub?.('scene');
    setTimeout(() => A.openSheet(`${A.icon('layers')} Собрать из свайпов · #${i}`, `
        <div class="lf-hint">Тапай абзацы в нужном порядке — номер появится рядом. Соберу в один пост и сглажу стыки; это будет новый свайп, старые останутся.</div>
        <div class="lf-mg">${(m.swipes || []).map((_, si) => `<div class="lf-mg-sw"><b>Вариант ${si + 1}${si === m.swipe_id ? ' (сейчас)' : ''}</b>${list.filter(x => x.si === si).map(x => `<button class="lf-mg-p" data-act="fx-mgp" data-k="${si}:${x.pi}"><i></i>${esc(A.cut(plain(x.t), 220))}</button>`).join('')}</div>`).join('')}</div>
        <button class="lf-btn primary full" data-act="fx-mgo" data-mes="${i}">${A.icon('check')} Собрать</button>`), 250);
}

const mg = { order: [] };

async function merge(i) {
    const m = A.chatArr()[i];
    const list = swipeParas(m);
    const parts = mg.order.map(k => list.find(x => `${x.si}:${x.pi}` === k)).filter(Boolean);
    if (parts.length < 2) throw new Error('выбери хотя бы два абзаца');
    const out = await ask(`${RULES(user())}\nСклей эти куски из разных вариантов ответа в один пост, в данном порядке. Сгладь стыки: переходы, повторы, противоречия на стыке, — но сами куски меняй как можно меньше. Ответь только постом.`,
        parts.map((x, n) => `### Кусок ${n + 1} (вариант ${x.si + 1})\n${x.t}`).join('\n\n'), 4000);
    if (!out) throw new Error('модель вернула пустоту');
    const [, tail] = splitTail(m.swipes?.[m.swipe_id] || m.mes);
    const text = `${out}${tail}`;
    // новым свайпом: старые варианты целы
    const c = A.ctx();
    if (!Array.isArray(m.swipes)) m.swipes = [m.mes];
    if (!Array.isArray(m.swipe_info)) m.swipe_info = m.swipes.map(() => ({ send_date: m.send_date, extra: {} }));
    const prevId = m.swipe_id ?? 0;
    const old = m.mes;
    m.swipes.push(text);
    m.swipe_info.push({ ...(m.swipe_info[prevId] || {}), send_date: m.send_date, extra: { ...(m.swipe_info[prevId]?.extra || {}), display_text: undefined } });
    m.swipe_id = m.swipes.length - 1;
    m.mes = text;
    if (m.extra?.display_text) delete m.extra.display_text;
    try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] собрать из свайпов', e); }
    // Летописец: у последнего поста новый вариант разбирается заново, как после свайпа;
    // у старого поста — берёт записи варианта, из которого собирали (перезапуск задним числом сдвинул бы всё, что было после)
    try {
        if (i === A.lastAiIndex?.()) A.queueChron?.(i);
        else {
            const st = A.chronStore?.();
            const from = st?.[`${i}:${prevId}:${A.hash(old)}`];
            if (from) { st[`${i}:${m.swipe_id}:${A.hash(text)}`] = JSON.parse(JSON.stringify(from)); A.saveMeta(); }
        }
    } catch (e) { console.warn('[Life] собрать из свайпов: Летописец', e); }
    try { await c.eventSource.emit(c.eventTypes.MESSAGE_UPDATED, i); } catch { /* */ }
    await c.saveChat();
    mg.order = [];
}

// ───────────── в чате: одна кнопка, всё внутри, с подписями ─────────────

const row = (act, id, title, sub, extra = '') => `<button class="lf-fix-a" data-act="${act}" data-mes="${id}"${extra}><b>${title}</b><small>${sub}</small></button>`;

export function paintFix(el, id) {
    const m = A.chatArr()[id];
    const old = el.querySelector(':scope .lf-fix');
    if (!m || m.is_user || m.is_system || !A.settings().enabled) { old?.remove(); el.querySelectorAll('.lf-plq').forEach(x => x.remove()); return; }
    const open = on.has(id);
    const u = M().undo[id];
    const sel = pick?.mes === id ? pick : null;
    const psel = plq?.mes === id ? plq : null;
    const U = esc(A.shortName(user()));
    const owner = esc(A.shortName(A.canonName(sel?.who || speakerOf(id))));
    const html = !open
        ? `<div class="lf-fix lf-own"><button class="lf-fix-btn" data-act="fx-open" data-mes="${id}" title="Правка поста вместо реролла">✎ <span>править</span></button></div>`
        : `<div class="lf-fix lf-own open${busy.has(id) ? ' busy' : ''}">
            <div class="lf-fix-top"><b>✎ Правка поста</b>${busy.has(id) ? '<span class="lf-fix-wait">правлю…</span>' : ''}<button data-act="fx-guide" data-mes="${id}">что где</button><button data-act="fx-open" data-mes="${id}" title="закрыть">✕</button></div>
            <div class="lf-fix-sec">
                <div class="lf-fix-h">Абзац</div>
                ${sel ? `<q>${esc(A.cut(plain(sel.sent || sel.line), 160))}</q>
                <div class="lf-fix-row">${Object.entries(HOWS).filter(([k]) => k !== 'own').map(([k, [l]]) => `<button data-act="fx-p" data-mes="${id}" data-how="${k}">${k === 'voice' ? `голосом ${owner}` : l}</button>`).join('')}</div>
                <div class="lf-fix-own"><input type="text" class="lf-fix-in" placeholder="своё: что поправить — или как пойти дальше"><button data-act="fx-p" data-mes="${id}" data-how="own" title="поправить абзац по-своему">✓</button></div>
                <div class="lf-fix-grid">
                    ${row('fx-rest', id, '⤵ Отсюда заново', sel.sent ? 'с этой фразы и до конца — переписать; подсказка — в поле' : 'с этого абзаца и до конца — переписать; подсказка — в поле')}
                    ${A.shootPost ? row('fx-shot', id, '🎞 Кадр здесь', 'картинка этого момента прямо в посте') : ''}
                </div>` : '<div class="lf-fix-hint">Тапни абзац в тексте — появятся правки абзаца, «отсюда заново» и кадр в этом месте. ↻ на плашке — заново только она.</div>'}
            </div>
            ${psel ? `<div class="lf-fix-sec">
                <div class="lf-fix-h">Плашка</div>
                <q>${esc(psel.label)}</q>
                <div class="lf-fix-own"><input type="text" class="lf-fix-plq" placeholder="что поправить (необязательно)"><button data-act="fx-plq-go" data-mes="${id}" title="заново только эту плашку">↻</button></div>
                <div class="lf-fix-hint">Заново только она — текст поста и остальные плашки не трогаю${/<img/i.test(plaqueBlocks(m.mes)[psel.k]?.full || '') ? '; картинка внутри останется, если не попросишь другую' : ''}.</div>
            </div>` : ''}
            <div class="lf-fix-sec">
                <div class="lf-fix-h">Весь пост</div>
                <input type="text" class="lf-fix-in beat" placeholder="подсказка для «+ бит» и «притормози» (необязательно)">
                <div class="lf-fix-grid">
                    ${row('fx-mine', id, `${U} — моя`, `убрать всё, что модель написала за ${U}`)}
                    ${row('fx-beat', id, '+ бит', 'дописать абзац в конец, по подсказке или сам')}
                    ${row('fx-slow', id, '🐢 Притормози', sel ? 'с выбранного абзаца — медленнее, до твоей реакции' : 'пробежал момент галопом — раскрыть медленнее и встать там, где нужна твоя реакция')}
                    ${(m.swipes || []).length > 1 ? row('fx-merge', id, 'Из свайпов', 'собрать из абзацев разных вариантов') : ''}
                    ${row('fx-mark', id, 'Плашки', 'починить разметку GC, текст не трогать')}
                    ${A.recsSheet ? row('fx-recs', id, 'Что записал пост', 'что Life взяла из поста — убрать лишнее') : ''}
                    ${u ? row('fx-undo', id, '↩ Вернуть', `как было до «${esc(u.label)}»`) : ''}
                </div>
            </div>
        </div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) { markParas(el, open, id); try { paintPlaques(el, id, open); } catch (e) { console.warn('[Life] плашки: ↻', e); } return; }
    const typed = old?.querySelector('.lf-fix-in:not(.beat)')?.value;
    const typedBeat = old?.querySelector('.lf-fix-in.beat')?.value;
    const typedPlq = old?.querySelector('.lf-fix-plq')?.value;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    if (typed && node.querySelector('.lf-fix-in:not(.beat)')) node.querySelector('.lf-fix-in:not(.beat)').value = typed;
    if (typedBeat && node.querySelector('.lf-fix-in.beat')) node.querySelector('.lf-fix-in.beat').value = typedBeat;
    if (typedPlq && node.querySelector('.lf-fix-plq')) node.querySelector('.lf-fix-plq').value = typedPlq;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
    markParas(el, open, id);
    try { paintPlaques(el, id, open); } catch (e) { console.warn('[Life] плашки: ↻', e); }
}

function markParas(el, open, id) {
    const want = open && pick?.mes === id ? toks(pick.line).slice(0, 8).join(' ') : '';
    el.querySelectorAll('.mes_text > p:not(.lf-duo-h), .mes_text > blockquote').forEach(p => {
        p.classList.toggle('lf-fix-p', open);
        p.classList.toggle('lf-fix-on', !!want && toks(p.textContent).slice(0, 8).join(' ') === want);
    });
    el.classList.toggle('lf-fixing', open);
}

/** Фраза абзаца под пальцем: от конца прошлого предложения до конца этого. */
function sentenceAt(p, ev) {
    let node = null;
    let off = 0;
    try {
        if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(ev.clientX, ev.clientY); node = r?.startContainer; off = r?.startOffset || 0; }
        else if (document.caretPositionFromPoint) { const r = document.caretPositionFromPoint(ev.clientX, ev.clientY); node = r?.offsetNode; off = r?.offset || 0; }
    } catch { /* */ }
    if (!node || node.nodeType !== 3 || !p.contains(node)) return '';
    let pos = 0;
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n === node) { pos += off; break; } pos += n.nodeValue.length; }
    const t = p.textContent || '';
    let a = pos;
    while (a > 0 && !/[.!?…]/.test(t[a - 1])) a--;
    let b = pos;
    while (b < t.length && !/[.!?…]/.test(t[b])) b++;
    while (b < t.length && /[.!?…»"”)]/.test(t[b])) b++;
    const sent = t.slice(a, b).replace(/^[\s»"”)]+/, '').trim();
    return sent.length >= 6 && sent.length < t.trim().length ? sent : '';
}

/** Тап по абзацу в режиме правки (из onChatClick, до остальных). true — тап наш. */
export function fixTap(ev) {
    const mesEl = ev.target.closest?.('#chat .mes.lf-fixing');
    if (!mesEl) return false;
    const p = ev.target.closest('.mes_text > p:not(.lf-duo-h), .mes_text > blockquote');
    if (!p) return false;
    const i = Number(mesEl.getAttribute('mesid'));
    const m = A.chatArr()[i];
    const line = matchLine(m?.mes, tappedText(p, ev));
    if (!line) { A.toast('info', 'Не нашла этот кусок в тексте поста — тапни по обычному абзацу', '✎', { timeOut: 2200 }); return true; }
    ev.preventDefault();
    ev.stopPropagation();
    let sent = '';
    try { sent = sentenceAt(p, ev); } catch { /* */ }
    pick = { mes: i, line, who: p.closest?.('[data-duo]')?.dataset.duo || '', sent };
    A.paintSoon?.();
    return true;
}

export async function fixClick(act, el) {
    if (!act.startsWith('fx-')) return false;
    const i = Number(el.dataset.mes);
    const box = el.closest?.('.lf-fix');
    const run = async (fn, done) => {
        if (busy.has(i)) return;
        busy.add(i);
        A.paintSoon?.();
        try { await fn(); if (done) A.toast('success', done, '✎ Правка', { timeOut: 1800 }); }
        catch (e) { A.toast('warning', esc(String(e?.message || e)), '✎ Правка', { timeOut: 5000 }); }
        finally { busy.delete(i); A.paintSoon?.(); }
    };
    switch (act) {
        case 'fx-open': if (on.has(i)) { on.delete(i); if (pick?.mes === i) pick = null; if (plq?.mes === i) plq = null; } else on.add(i); A.paintSoon?.(); return true;
        case 'fx-plq': {
            const k = Number(el.dataset.k);
            const b = plaqueBlocks(A.chatArr()[i]?.mes)[k];
            if (!b) return true;
            plq = plq?.mes === i && plq.k === k ? null : { mes: i, k, label: b.label };
            on.add(i);
            A.paintSoon?.();
            return true;
        }
        case 'fx-plq-go': {
            const sel = plq?.mes === i ? plq : null;
            if (!sel) return true;
            const hint = box?.querySelector('.lf-fix-plq')?.value?.trim() || '';
            await run(async () => { await regenPlaque(i, sel.k, hint); plq = null; }, `«${sel.label}» — заново`);
            return true;
        }
        case 'fx-slow': {
            const sel = pick?.mes === i ? pick : null;
            const hint = box?.querySelector('.lf-fix-in.beat')?.value?.trim() || '';
            await run(async () => { await slow(i, sel?.line || '', hint); pick = null; }, 'Притормозила');
            return true;
        }
        case 'fx-guide': A.guideSheet?.('fix'); return true;
        case 'fx-p': {
            const sel = pick?.mes === i ? pick : null;
            if (!sel) return true;
            const custom = (el.parentElement?.querySelector('.lf-fix-in') || box?.querySelector('.lf-fix-in:not(.beat)'))?.value?.trim() || '';
            if (el.dataset.how === 'own' && !custom) { A.toast('info', 'Напиши, что поправить'); return true; }
            await run(async () => { await rewriteLine(i, sel.line, el.dataset.how, custom, sel.who); pick = null; });
            return true;
        }
        case 'fx-rest': {
            const sel = pick?.mes === i ? pick : null;
            if (!sel) return true;
            const hint = box?.querySelector('.lf-fix-in:not(.beat)')?.value?.trim() || '';
            await run(async () => { await restFrom(i, sel.line, sel.sent, hint); pick = null; }, 'Переписала дальше');
            return true;
        }
        case 'fx-shot': {
            const sel = pick?.mes === i ? pick : null;
            try { A.shootPost?.(i, 'frame', sel ? plain(sel.sent || sel.line) : ''); } catch (e) { A.toast('warning', esc(String(e?.message || e)), '🎞 Кадр'); }
            return true;
        }
        case 'fx-recs': A.recsSheet?.(i); return true;
        case 'fx-mine': await run(() => mine(i), `${A.shortName(user())} — снова твоя`); return true;
        case 'fx-beat': { const hint = box?.querySelector('.lf-fix-in.beat')?.value?.trim() || ''; await run(() => beat(i, hint), 'Дописала бит'); return true; }
        case 'fx-mark': {
            const m = A.chatArr()[i];
            const r = fixMarkup(m.mes);
            if (!r.fixed.length) { A.toast('info', 'Разметка в порядке', '✎ Плашки', { timeOut: 1800 }); return true; }
            await run(() => apply(i, r.text, 'плашки'), `Починила: ${r.fixed.join('; ')}`);
            return true;
        }
        case 'fx-undo': {
            const u = M().undo[i];
            if (!u) return true;
            await run(async () => { await setMesText(i, u.text); delete M().undo[i]; A.saveMeta(); }, `Вернула (${u.label})`);
            return true;
        }
        case 'fx-merge': mg.order = []; mergeSheet(i); return true;
        case 'fx-mgp': {
            const k = el.dataset.k;
            const at = mg.order.indexOf(k);
            if (at >= 0) mg.order.splice(at, 1); else mg.order.push(k);
            el.closest('.lf-mg')?.querySelectorAll('.lf-mg-p').forEach(b => { const n = mg.order.indexOf(b.dataset.k); b.classList.toggle('on', n >= 0); b.querySelector('i').textContent = n >= 0 ? String(n + 1) : ''; });
            return true;
        }
        case 'fx-mgo': {
            await A.withBusy(el, async () => { await merge(i); A.closeSheet(); A.closeHub?.(); A.toast('success', 'Собрала — это новый свайп', '✎ Из свайпов', { timeOut: 2200 }); }, 'Собираю…');
            return true;
        }
    }
    return false;
}
