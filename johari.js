// Узнавание. Она узнаёт его — и он через это узнаёт себя заново (и в обратную сторону: что он видит в ней).
// Окно Джохари (Luft & Ingham, 1955) на двоих, плюс то, что у этой истории своё — обнуления и лёд:
//  • blind   — слепое пятно: видно ей, не ему; в поведении есть признак, которого он за собой не замечает;
//  • hidden  — скрытое: знает он, не она; проговорится краем или расскажет, когда момент;
//  • unknown — неизвестное: не знает никто; откроется впервые в ситуации, которой ещё не было («если впервые…»);
//  • past    — помнит она, не он: эпизод, стёртый обнулениями; расскажет — он вспомнит обрывком или примет с её слов.
// Шаг: 0 — ещё нет; 1 — заметили / проговорился краем / проявилось; 2 — названо вслух / рассказано; 3 — принял.
// Названное не принимается с первого раза, если спорит с тем, как он себя видит (self-verification, Swann):
// модель получает, как он это примет. Принятое уходит в «Кто я теперь» (self-images, Conway) — модели по кругу.
// Для персоны игрока — только чужой взгляд: что он в ней видит, заметил, сказал. Приняла ли — решает она, тапом.
// Её пост разбирается перед ответом вместе с «Не пропусти» (johariJoin), ответ — Летописцем после (johariChron).
// 0.65: подсказки игроку уведомлением (johariHint) — после его ответа Летописец замечает повод узнать о себе новое:
// он увидел в ней то, чего она за собой не знает; с ней впервые то, чего ещё не было; он вернул ей её же слова
// (самопересмотр, «self-overhearing» у Блума). Вопрос — без ответа за неё; в историю и модели не идёт.

import { userIndexFor } from './reply.js';
import { cardText, loreFor } from './lore.js';
import { personaHidden } from './personas.js';
import { CRAFT } from './craft.js';
import { shardTold } from './shards.js';
import { push } from './push.js';

let A = null;
export function initJohari(api) { A = api; cfg(); }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

export const KINDS = {
    blind: { ic: 'eye', name: 'Видит она — не он', sub: 'слепое пятно', steps: ['ещё не заметила', 'заметила', 'назвала вслух', 'принял: «это я»'] },
    hidden: { ic: 'lock', name: 'Знает он — не она', sub: 'скрытое', steps: ['держит при себе', 'проговорился краем', 'рассказал', 'теперь общее'] },
    unknown: { ic: 'moon', name: 'Не знает никто', sub: 'откроется впервые', steps: ['ещё не случилось', 'проявилось впервые', 'назвали', 'принял: «это я»'] },
    past: { ic: 'book', name: 'Помнит она — не он', sub: 'стёрто, но было', steps: ['помнит она', 'всплыло краем', 'рассказала', 'вспомнил или принял'] },
};
// для персоны игрока: что видит в ней другой
const KINDS_ME = {
    blind: { ic: 'eye', name: 'Видит в тебе', sub: 'чего ты за собой не знаешь', steps: ['видит', 'заметил в посте', 'сказал тебе', 'приняла'] },
    unknown: { ic: 'moon', name: 'Неизвестное в тебе', sub: 'может открыться впервые', steps: ['ещё не было', 'случилось', 'названо', 'приняла'] },
};
const PACE = { rare: [4, 'Редко'], mid: [3, 'Иногда'], often: [2, 'Часто'] };
// подсказки игроку: не чаще, чем раз в столько его ответов (сильное — назвал вслух, случилось её «впервые» — сразу)
const HINT = { off: [0, 'Выкл'], rare: [5, 'Редко'], mid: [3, 'Иногда'], often: [1, 'Часто'] };
const HINT_KIND = {
    seen: { ic: 'eye', title: (S) => `${S} видит в тебе`, ok: 'Это про неё — приняла' },
    first: { ic: 'moon', title: () => 'Впервые', ok: 'В «Неизвестное в тебе»: случилось' },
    mirror: { ic: 'sparkles', title: () => 'Твоими же словами', ok: 'Это про неё — приняла' },
};

function cfg() {
    const s = A.settings();
    if (!s.johari || typeof s.johari !== 'object') s.johari = {};
    const c = s.johari;
    if (c.on === undefined) c.on = true;
    if (!PACE[c.pace]) c.pace = 'mid';
    if (!HINT[c.hints]) c.hints = 'mid';
    c.blur = !!c.blur;
    return c;
}
export const johariOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
const hintsOn = () => (HINT[cfg().hints]?.[0] || 0) > 0;

function M() {
    const cm = A.chatMeta();
    if (!cm.johari || typeof cm.johari !== 'object' || Array.isArray(cm.johari)) cm.johari = {};
    const j = cm.johari;
    if (!Array.isArray(j.list)) j.list = [];
    if (!Number.isFinite(j.seq)) j.seq = 0;
    if (!j.used || typeof j.used !== 'object') j.used = {};
    if (!j.pend || typeof j.pend !== 'object') j.pend = {};
    if (!Array.isArray(j.hints)) j.hints = [];
    if (!Number.isFinite(j.hseq)) j.hseq = 0;
    return j;
}

const user = () => A.canonName(A.ctx().name1) || A.ctx().name1 || '';
const isUser = (n) => !!n && A.sameName(n, A.ctx().name1);
const short = (n) => A.shortName(A.canonName(n));
const words = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
export const similar = (a, b) => { const x = new Set(words(a)), y = words(b); return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= 0.6; };
const keyOf = (i) => { const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}` : ''; };
const kindsFor = (x) => (isUser(x.who) ? KINDS_ME : KINDS);
const stepName = (x) => (kindsFor(x)[x.kind] || KINDS[x.kind] || KINDS.blind).steps[Math.max(0, Math.min(3, x.step || 0))];
const live = (x) => x && !x.off;
const byOf = (x) => x.by || (isUser(x.who) ? '' : user());
const bare = (t) => String(t || '').trim().replace(/[.!…;,\s]+$/u, '');

/** Все записи о человеке (живые). */
export function johariOf(who) { return M().list.filter(x => live(x) && A.sameName(x.who, who)); }

function here() { return (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); }
function inScene(n, h = here()) { return !h.length || h.some(x => A.sameName(x, n)); }

// служебные слова и имена — не повод считать, что пост «про это»
const STOP = new Set(['котор', 'когда', 'тольк', 'потом', 'очень', 'всегд', 'может', 'чтобы', 'этого', 'этому', 'всего', 'своей', 'своих', 'свою', 'ничег', 'сейча', 'будет', 'тебя', 'себя', 'меня', 'него', 'нему', 'если', 'даже', 'было', 'были', 'была', 'этот', 'этой', 'есть', 'тоже', 'того', 'тому', 'раньш', 'опять', 'снова', 'здесь', 'перед', 'после', 'какой', 'какая', 'какие']);
/**
 * Из длинного списка — то, что сейчас вероятнее в ходу: совпало словами с постом, взведено, недавно звучало,
 * уже сдвинулось; остальное — по очереди из каждого вида, чтобы ни один вид не выпал целиком (раньше брались
 * последние N — при большом посеве «видит она» и «знает он» не доходили до разбора вовсе).
 */
function rank(list, text, n) {
    if (list.length <= n) return list;
    const names = new Set([...words(user()), ...words(String(A.ctx().name2 || ''))]);
    const w = new Set(words(text).filter(s => !STOP.has(s) && !names.has(s)));
    const round = {};
    return list.map((x, k) => {
        const g = `${A.canonName(x.who)}:${x.kind}`;
        round[g] = (round[g] ?? -1) + 1;
        const hit = w.size ? new Set(words(`${x.t} ${x.tell || ''} ${x.when || ''}`).filter(s => w.has(s))).size : 0;
        return { x, k, r: round[g], s: (x.armed ? 50 : 0) + Math.min(hit, 4) * 10 + (Number.isFinite(x.last) ? 4 : 0) + ((x.step || 0) > 0 ? 2 : 0) };
    }).sort((a, b) => b.s - a.s || a.r - b.r || a.k - b.k).slice(0, n).sort((a, b) => a.k - b.k).map(o => o.x);
}

// ───────────── добавить / сдвинуть ─────────────

const KIND_RE = /^(blind|hidden|unknown|past)$/;
/** Новая запись. Похожая уже есть — вернёт её и ничего не добавит. */
export function johariAdd(r, src = 'me', mes = null) {
    const who = A.canonName(str(r?.who));
    const kind = KIND_RE.test(str(r?.kind)) ? str(r.kind) : 'blind';
    const t = str(r?.t).slice(0, 240);
    if (!who || !t) return null;
    if (isUser(who) && !['blind', 'unknown'].includes(kind)) return null;   // её скрытое и её прошлое — её дело
    const j = M();
    const old = j.list.find(x => A.sameName(x.who, who) && x.kind === kind && similar(x.t, t));
    if (old) return old.off ? null : old;
    let by = A.canonName(str(r?.by));
    if (/^\{\{user\}\}$/i.test(str(r?.by))) by = user();
    if (!by) by = isUser(who) ? '' : user();
    const x = {
        id: `u${++j.seq}`, who, by, kind, t,
        tell: str(r?.tell).slice(0, 200), when: str(r?.when).slice(0, 160), vs: str(r?.vs).slice(0, 160), react: str(r?.react).slice(0, 200), era: str(r?.era).slice(0, 20),
        step: Math.max(0, Math.min(3, Number(r?.step) || 0)), heavy: !!r?.heavy, src, at: Date.now(), log: [],
        ...(Number.isFinite(mes) ? { mes } : {}),
    };
    j.list.push(x);
    if (j.list.length > 160) j.list.splice(0, j.list.length - 160);
    return x;
}

const MOVE_STEP = { seen: 1, slip: 1, emerged: 1, named: 2, told: 2, owned: 3 };
/** Сдвинуть шаг (только вперёд). Возвращает true, если сдвинулось. */
function move(x, mv, i, t = '', src = 'post') {
    if (!x || x.off) return false;
    if (mv === 'declined') {
        if (isUser(x.who)) return false;                 // за неё не решаем
        x.push = (x.push || 0) + 1;
        x.log.push({ mes: i, mv, t: t.slice(0, 120), src });
        return true;
    }
    if (isUser(x.who) && mv === 'owned') return false;   // приняла или нет — только её тап
    const to = MOVE_STEP[mv];
    if (to == null) return false;
    // что к какому виду подходит: скрытое не «замечают» — о нём проговариваются; неизвестное сначала «проявляется»
    if (mv === 'seen' && x.kind !== 'blind') return false;
    if (mv === 'slip' && !['hidden', 'past'].includes(x.kind)) return false;
    if (mv === 'emerged' && x.kind !== 'unknown') return false;
    if (mv === 'told' && !['hidden', 'past'].includes(x.kind)) return false;
    if (x.log.some(l => l.mes === i && l.mv === mv)) return false;      // этот пост это уже засчитал
    if ((x.step || 0) >= to) {
        // назвали ещё раз (в другом посте) — счёт, чтобы он мог наконец поверить
        if (mv === 'named' && to === 2 && (x.step || 0) === 2) { x.named = (x.named || 1) + 1; x.log.push({ mes: i, mv, t: t.slice(0, 120), src }); return true; }
        return false;
    }
    if (mv === 'named') x.named = (x.named || 0) + 1;
    x.prev = x.step || 0;
    x.step = to;
    x.log.push({ mes: i, mv, t: t.slice(0, 120), src, from: x.prev });
    if (x.log.length > 12) x.log.splice(0, x.log.length - 12);
    if (to >= 2) x.armed = false;
    // рассказанное из стёртого — в «Осколки памяти» с пометкой «с её слов»
    if (x.kind === 'past' && to >= 2 && !x.shard) { try { if (shardTold(x.who, x.t, x.era || 'Тео', i, byOf(x))) x.shard = 1; } catch (e) { console.warn('[Life] узнавание → память', e); } }
    return true;
}

// ───────────── разбор её поста перед ответом (вместе с «Не пропусти») ─────────────

function joinList(u) {
    const h = here();
    const pool = M().list.filter(x => live(x) && !isUser(x.who) && inScene(x.who, h) && isUser(byOf(x)) && (
        (x.kind === 'blind' && x.step < 2) || (x.kind === 'hidden' && x.step < 2) || (x.kind === 'past' && x.step < 2) || (x.kind === 'unknown' && x.step < 1 && x.when)
    ));
    return rank(pool, A.plainText(A.chatArr()[u]?.mes || ''), 18);
}
const joinRow = (x) => `[${x.id}] ${KINDS[x.kind].sub} · ${short(x.who)}: ${A.cut(x.t, 110)}${x.tell ? ` · признак: ${A.cut(x.tell, 70)}` : ''}${x.kind === 'unknown' && x.when ? ` · когда: ${A.cut(x.when, 70)}` : ''}`;

export function johariJoin(u) {
    try {
        if (!johariOn() || !A.hasChat() || u < 0) return null;
        const act = joinList(u);
        const key = keyOf(u);
        if (!act.length || !key) return null;
        const cm = A.chatMeta();
        const U = short(user());
        let taken = false;
        return {
            system: `\nЕщё johari. В конце дан список «Узнавание» — у каждого id. Отметь только то, что ЯВНО есть в посте игрока: [{"id":"u3","move":"seen|named|asked|told|situation"}]. seen — ${U} заметила признак (смотрит, отмечает про себя, улыбается этому), но вслух не назвала; named — назвала это в нём вслух, своими словами; asked — спросила о том, что рядом со скрытым; told — рассказала ему эпизод из «помнит она»; situation — в посте началась ситуация из «когда» (для «откроется впервые»). Ничего — []. Поле johari добавь в тот же JSON.`,
            input: `Узнавание:\n${act.map(joinRow).join('\n')}`,
            tokens: 50 + 30 * Math.min(act.length, 8),
            take: (j) => {
                if (taken) return;
                taken = true;
                try { if (Array.isArray(j?.johari) && A.chatMeta() === cm) joinTake(u, key, j.johari); } catch (e) { console.warn('[Life] узнавание', e); }
            },
        };
    } catch (e) { console.warn('[Life] узнавание', e); return null; }
}

function joinTake(u, key, list) {
    const j = M();
    const rec = [];
    for (const r of list.slice(0, 6)) {
        const x = j.list.find(y => y.id === str(r?.id));
        const mv = str(r?.move);
        if (!x || !live(x) || !['seen', 'named', 'asked', 'told', 'situation'].includes(mv)) continue;
        if (mv === 'asked') { rec.push({ id: x.id, mv }); continue; }
        if (mv === 'situation') { if (x.kind === 'unknown') rec.push({ id: x.id, mv }); continue; }
        if (mv === 'told' && !['past', 'hidden'].includes(x.kind)) continue;
        const before = x.step || 0;
        move(x, mv === 'told' ? 'told' : mv, u, '', 'her');
        rec.push({ id: x.id, mv, from: before });
    }
    j.pend[key] = rec;
    const keys = Object.keys(j.pend).sort((a, b) => parseInt(a) - parseInt(b));
    for (const k of keys.slice(0, Math.max(0, keys.length - 12))) delete j.pend[k];
    A.saveMeta();
    if (rec.some(r => ['named', 'told'].includes(r.mv))) {
        const x = j.list.find(y => y.id === rec.find(r => ['named', 'told'].includes(r.mv)).id);
        if (x) A.toast('info', esc(A.cut(x.t, 120)), `✦ Узнавание · ${esc(short(byOf(x)))} ${x.kind === 'past' ? 'рассказала' : 'назвала'}`, { timeOut: 3500 });
    }
}

// ───────────── Летописец после ответа ─────────────

function chronList(i, her = '') {
    const h = here();
    const pool = M().list.filter(x => live(x) && x.step < 3 && (inScene(x.who, h) || (byOf(x) && inScene(byOf(x), h))));
    return rank(pool, `${A.plainText(A.chatArr()[i]?.mes || '')} ${her}`, 22);
}
const chronRow = (x) => `[${x.id}] ${KINDS[x.kind].sub} · чьё: ${short(x.who)}${byOf(x) ? ` · кто видит: ${short(byOf(x))}` : ''} · ${A.cut(x.t, 100)}${x.tell ? ` · признак: ${A.cut(x.tell, 60)}` : ''}${x.kind === 'unknown' && x.when ? ` · когда: ${A.cut(x.when, 60)}` : ''} · сейчас: ${stepName(x)}`;

function userPostBefore(i) {
    const chat = A.chatArr();
    for (let j = i - 1; j >= 0; j--) { const m = chat[j]; if (!m || m.is_system) continue; return m.is_user ? j : -1; }
    return -1;
}

const RULE = `
johari — УЗНАВАНИЕ: что из списка «Узнавание» сдвинулось в ЭТОМ посте (и в посте игрока перед ним, если он дан): [{"id":"u3","move":"seen|named|owned|slip|told|emerged|declined","t":"как именно, 4–12 слов"}]. seen — тот, «кто видит», заметил признак, но вслух не назвал; named — сказал вслух, назвал словами; owned — носитель сам признал это про себя (сказал «да, я такой», пошутил как над своим, сделал нарочно, вспомнил рассказанное); slip — о скрытом: проговорился краем; told — о скрытом или «помнит она»: рассказано прямо; emerged — о неизвестном: впервые проявилось в новой ситуации; declined — носитель отмахнулся от названного, не согласился. Только явное в тексте. Нечего — [].
johariNew — только если в посте кто-то ЯВНО открыл в другом то, чего тот за собой не знал («ты всегда…, когда…», «знаешь, что ты…?»), или сам с удивлением узнал о себе новое («оказывается, я…»), и этого нет в списке: [{"who":"чьё","by":"кто увидел","kind":"blind|unknown","t":"что, 5–14 слов","tell":"как видно, 3–10 слов"}]. Обычно [].`;

// подсказка игроку: только повод и открытый вопрос — что она почувствует и примет ли, решает она
const HINT_RULE = (U, S) => `
johariHint — подсказка игроку за ${U}: уйдёт ей уведомлением, в историю и модели не попадает. Только если в ЭТОМ посте есть ЯВНЫЙ повод для ${U} узнать о себе новое; нет — null. Один объект: {"kind":"seen|first|mirror","id":"uN или пусто","t":"что случилось, 6–18 слов: его слова, жест или деталь из поста","q":"вопрос ей, 3–12 слов"}. seen — ${S} заметил или сказал о ней то, чего она за собой не знает (если это пункт «чьё: ${U}» из списка — его id); first — сцена впервые поставила её туда, где она ещё не была (пункт с «когда: впервые…» — его id); mirror — он вернул ей её же слова или сделал для неё то, что она делает для других, а себе не позволяет. q — открытый вопрос без ответа за неё («Узнает в этом себя?», «Что она скажет?»). Не решай, что она чувствует; без психологии и слов «травма», «границы», «заслуживает».`;

export function johariChron(i) {
    if (!A?.hasChat?.() || !johariOn()) return null;
    const u = Number.isFinite(i) ? userPostBefore(i) : -1;
    const her = u >= 0 ? A.cut(A.plainText(A.chatArr()[u]?.mes || ''), 1100) : '';
    const act = chronList(i, her);
    const U = user();
    const S = A.canonName(String(A.chatArr()[i]?.name || '').trim());
    const hint = hintsOn() && !!U && inScene(U) && !!S && !isUser(S);
    const Sn = S && !NARR.test(S) ? short(S) : 'кто-то в сцене';
    return {
        key: `"johari": [], "johariNew": []${hint ? ', "johariHint": null' : ''}`, rule: RULE + (hint ? HINT_RULE(short(U), Sn) : ''), tokens: 150 + 25 * Math.min(act.length, 10) + (hint ? 90 : 0),
        input: `Узнавание (что уже есть):\n${act.length ? act.map(chronRow).join('\n') : 'пока ничего'}${her ? `\nПост игрока перед этим ответом (кратко): ${her}` : ''}`,
    };
}

export function johariAfterPost(i, j) {
    if (!johariOn()) return;
    const s = M();
    // перечитка того же поста — сначала откатить то, что он сам записал
    for (const x of s.list) {
        // все записи этого поста, с последней — чтобы шаг вернулся туда, где был до него
        for (let k = x.log.length - 1; k >= 0; k--) {
            const l = x.log[k];
            if (l.mes !== i || l.src !== 'post') continue;
            if (l.mv === 'declined') x.push = Math.max(0, (x.push || 0) - 1);
            else if (Number.isFinite(l.from) && (x.step || 0) === MOVE_STEP[l.mv]) x.step = l.from;
            if (l.mv === 'named') x.named = Math.max(0, (x.named || 0) - 1);
            x.log.splice(k, 1);
        }
    }
    s.list = s.list.filter(x => !(x.src === 'post' && x.mes === i));
    // и подсказку этого поста — заново (темп возвращается к прежнему)
    for (const h of s.hints.filter(y => y.mes === i)) { if (s.hintTurn === h.turn) s.hintTurn = h.prevTurn; }
    s.hints = s.hints.filter(y => y.mes !== i);
    const moved = [];
    const u = userPostBefore(i);
    for (const r of (Array.isArray(j?.johari) ? j.johari : []).slice(0, 6)) {
        const x = s.list.find(y => y.id === str(r?.id));
        const mv = str(r?.move);
        // её пост уже разобран перед ответом — то же самое из него второй раз не считать
        if (x && u >= 0 && ['seen', 'named', 'told'].includes(mv) && x.log.some(l => l.mes === u && l.src === 'her')) continue;
        if (x && move(x, mv, i, str(r?.t), 'post')) moved.push([x, mv]);
    }
    for (const r of (Array.isArray(j?.johariNew) ? j.johariNew : []).slice(0, 1)) {
        const who = A.canonName(str(r?.who));
        if (!who || !(A.castNames?.() || []).concat(A.groupMembers?.() || []).some(n => A.sameName(n, who))) continue;
        const x = johariAdd({ ...r, step: str(r?.kind) === 'unknown' ? 1 : 2 }, 'post', i);
        if (x && x.src === 'post') moved.push([x, 'new']);
    }
    let hint = null;
    try { hint = hintTake(i, j?.johariHint, moved); } catch (e) { console.warn('[Life] подсказка', e); }
    A.saveMeta();
    // о ней самой — подсказкой и в своём темпе, а не общим тостом
    const show = moved.filter(([x]) => !(hintsOn() && isUser(x.who)));
    if (show.length) {
        const W = { seen: 'заметили', named: 'назвали вслух', owned: 'принял: «это я»', slip: 'проговорился краем', told: 'рассказано', emerged: 'впервые', declined: 'отмахнулся', new: 'новое' };
        A.toast('info', show.slice(0, 3).map(([x, mv]) => `<b>${esc(short(x.who))}</b> · ${esc(W[mv] || mv)}: ${esc(A.cut(x.t, 90))}`).join('<br>'), '✦ Узнавание', { timeOut: 5000, escapeHtml: false });
    }
    if (hint) hintPush(hint);
}

// ───────────── подсказки игроку ─────────────

function hintTake(i, r, moved) {
    if (Array.isArray(r)) r = r[0];
    if (!r || typeof r !== 'object' || !hintsOn()) return null;
    const kind = HINT_KIND[str(r.kind)] ? str(r.kind) : '';
    const t = str(r.t).slice(0, 220);
    const q = str(r.q).slice(0, 120);
    const U = user();
    if (!kind || !t || !U || !inScene(U)) return null;
    const s = M();
    const S = A.canonName(String(A.chatArr()[i]?.name || '').trim());
    const by = S && !isUser(S) && !NARR.test(S) ? S : '';
    const x = s.list.find(y => y.id === str(r.id) && live(y) && isUser(y.who)) || null;
    // её пункт сдвинулся этим постом: заметил — «заметил в посте», впервые — «случилось»
    if (x && kind === 'seen' && x.kind === 'blind' && (x.step || 0) < 1 && move(x, 'seen', i, t, 'post')) moved.push([x, 'seen']);
    if (x && kind === 'first' && x.kind === 'unknown' && (x.step || 0) < 1 && move(x, 'emerged', i, t, 'post')) moved.push([x, 'emerged']);
    // то же самое второй раз не подсказывать (разве что шаг ушёл дальше)
    if (s.hints.some(h => h.st !== 'no' && (x ? h.ref === x.id && h.kind === kind && (h.step || 0) >= (x.step || 0) : similar(h.t, t)))) return null;
    const turn = Math.floor(i / 2);
    const gap = HINT[cfg().hints][0];
    // сильное — сразу: назвал её пункт вслух, случилось её «впервые»
    const strong = !!x && moved.some(([y, mv]) => y === x && ['named', 'emerged'].includes(mv));
    if (!strong && Number.isFinite(s.hintTurn) && turn - s.hintTurn < gap) return null;
    const h = { id: `h${++s.hseq}`, mes: i, kind, t, q, ref: x?.id || '', by, step: x?.step || 0, at: Date.now(), turn, prevTurn: Number.isFinite(s.hintTurn) ? s.hintTurn : null, st: 'new' };
    s.hintTurn = turn;
    s.hints.push(h);
    if (s.hints.length > 24) s.hints.splice(0, s.hints.length - 24);
    return h;
}

function hintPush(h) {
    const K = HINT_KIND[h.kind] || HINT_KIND.seen;
    try {
        push({
            app: `Подсказка · ${short(user())}`, icon: K.ic, tint: '#c9b8f2', title: K.title(short(h.by) || 'Он'), text: `${h.t}${h.q ? ` — ${h.q}` : ''}`, ms: 9000,
            onTap: () => { try { A.ui.who = user(); A.ui.pTab = 'life'; A.openHub?.('person'); } catch (e) { console.warn('[Life] подсказка', e); } },
        });
    } catch (e) { console.warn('[Life] подсказка', e); }
}

function hintRow(h) {
    const K = HINT_KIND[h.kind] || HINT_KIND.seen;
    const x = h.ref ? M().list.find(y => y.id === h.ref && live(y)) : null;
    const done = h.st === 'ok' || (!!x && (x.step || 0) >= 3);
    return `<div class="lf-idea lf-jo lf-jo-hint k-${h.kind}${done ? ' done' : ''}">
        <span class="lf-idea-ic">${A.icon(K.ic)}</span>
        <span class="lf-idea-t"><small>${esc(K.title(short(h.by) || 'Он'))} · #${h.mes}${done ? ' · взяла' : ''}</small><b>${esc(h.t)}</b>${h.q ? `<i class="lf-jo-sub">${esc(h.q)}</i>` : ''}</span>
        ${done ? '' : `<button class="lf-iconbtn sm" data-act="jo-hok" data-id="${h.id}" title="${esc(K.ok)}">${A.icon('check')}</button>`}
        <button class="lf-iconbtn sm" data-act="jo-hno" data-id="${h.id}" title="Убрать подсказку">${A.icon('x')}</button></div>`;
}

// ───────────── заметка модели ─────────────

function speaker() {
    const n = String(A.ctx().name2 || '').trim();
    return n && !NARR.test(n) && !isUser(n) ? A.canonName(n) : '';
}
const turnOf = (type) => { const L = A.chatArr().length; return Math.floor((type === 'swipe' ? L - 1 : L) / 2); };

/** Из пула — то, что дольше всех не звучало (этот же ход — то же самое: свайп не меняет). */
function pick(pool, turn, used) {
    if (!pool.length) return null;
    const again = pool.find(x => used[x.id] === turn);
    if (again) return again;
    return pool.map((x, k) => [x, used[x.id] ?? -1e9, (k + turn) % pool.length]).sort((a, b) => a[1] - b[1] || a[2] - b[2])[0][0];
}

export function johariPrompt(type) {
    if (!A?.hasChat?.() || !johariOn() || type === 'quiet' || type === 'impersonate') return '';
    const S = speaker();
    if (!S) return '';
    const s = M();
    const h = here();
    const U = user();
    const Us = short(U);
    const turn = turnOf(type);
    const every = PACE[cfg().pace]?.[0] || 3;
    const rec = (x) => { if (type && type !== 'swipe') { s.used[x.id] = turn; x.last = turn; A.saveMeta(); } };
    const out = [];
    const mine = s.list.filter(x => live(x) && A.sameName(x.who, S));

    // 1) только что в её посте: назвала, рассказала, спросила, началась ситуация — один раз, к этому ответу
    const u = userIndexFor(type);
    const pend = u >= 0 ? (s.pend[keyOf(u)] || []) : [];
    for (const r of pend) {
        const x = s.list.find(y => y.id === r.id);
        if (!x || !live(x) || !A.sameName(x.who, S)) continue;
        const B = short(byOf(x)) || Us;
        if (r.mv === 'named' && ['blind', 'unknown'].includes(x.kind)) {
            const again = (x.named || 0) > 1;
            out.push(`[Узнавание · только что ${B} назвала в ${short(S)} вслух то, чего он за собой не знал: ${bare(x.t)}. ${again ? `Слышит это не впервые (${x.named}-й раз) — может впервые согласиться, неловко и по-своему, или снова не поверить.` : 'Для него это новость о себе.'}${x.vs ? ` Это спорит с тем, как он себя видит (${bare(x.vs)}), — сразу не соглашается.` : ''} Как примет — ${x.react || 'по-своему: отшутиться, замолчать, проверить на ней, переспросить'}. Телом и одной-двумя фразами, без разговора о чувствах.]`);
        } else if (r.mv === 'told' && x.kind === 'past') {
            out.push(`[Узнавание · ${B} только что рассказала ${short(S)} то, что помнит о нём, а он нет: ${bare(x.t)}. Он может вспомнить обрывком — телом, запахом, словом — или не вспомнить и принять с её слов; подробностей сверх рассказанного не выдумывай.]`);
        } else if (r.mv === 'asked' && x.kind === 'hidden') {
            out.push(`[Узнавание · ${B} спросила рядом с тем, что ${short(S)} держит при себе: ${bare(x.t)}. Можно ответить правдой, частью правды или увести в сторону — как он бы; если решится, коротко.]`);
        } else if (r.mv === 'situation' && x.kind === 'unknown' && x.step < 1) {
            out.push(`[Узнавание · сейчас впервые: ${bare(x.when)}. Оказывается, у ${short(S)}: ${bare(x.t)}${x.tell ? ` (видно так: ${bare(x.tell)})` : ''}. Это новость и для него самого — пусть удивит и его: заметит за собой, не поверит, хмыкнет. Без психологии.]`);
        }
    }

    // 2) взведённое руками (⚡) — в этот ответ
    for (const x of mine.filter(y => y.armed)) {
        if (x.kind === 'hidden') out.push(`[Узнавание · сейчас ${short(S)} проговорится о том, чего ${short(byOf(x)) || Us} о нём не знает: ${bare(x.t)}. Краем или прямо — как он бы; одной-двумя фразами.]`);
        else if (x.kind === 'unknown') out.push(`[Узнавание · сведи сцену к тому, чтобы впервые случилось: ${x.when || 'новое для него'} — и оказалось, что ${bare(x.t)}. Новость и для него самого.]`);
        else if (x.kind === 'past') out.push(`[Узнавание · пусть всплывёт краем — телом, словом, жестом — то, что ${short(byOf(x)) || Us} помнит о ${short(S)}, а он нет: ${bare(x.t)}${x.tell ? ` (${bare(x.tell)})` : ''}. Сам он не понимает, откуда это.]`);
        else out.push(`[Узнавание · покажи в ${short(S)} заметно, одной деталью: ${bare(x.tell || x.t)}. Сам он этого за собой не знает и не комментирует.]`);
        if (type && type !== 'swipe') { x.armed = false; rec(x); }
    }

    // 3) признак слепого пятна (или тело помнит то, что голова забыла) — по кругу, не каждый ход
    if (turn % every === 0) {
        const pool = mine.filter(x => !x.armed && x.tell && x.step < 2 && ['blind', 'past'].includes(x.kind));
        const x = pick(pool, turn, s.used);
        if (x) {
            out.push(x.kind === 'past'
                ? `[Узнавание · тело ${short(S)} помнит то, чего не помнит голова: ${bare(x.tell)}. Если к месту — мельком, одной деталью; он не знает, откуда это.]`
                : `[Узнавание · в ${short(S)} есть то, чего он сам за собой не знает: ${bare(x.t)}. Видно со стороны: ${bare(x.tell)}. Если к месту — покажи мельком, одной деталью; сам он этого не замечает и не объясняет.]`);
            rec(x);
        }
    }

    // 4) скрытое — редко и только когда тихо: может проговориться краем, может промолчать
    if (turn % (every * 3) === 2) {
        const pool = mine.filter(x => !x.armed && x.kind === 'hidden' && !x.heavy && x.step < 1 && inScene(byOf(x) || U, h));
        const x = pick(pool, turn, s.used);
        if (x) { out.push(`[Узнавание · у ${short(S)} есть то, чего ${short(byOf(x)) || Us} о нём не знает: ${bare(x.t)}. Если момент правда тихий и близкий — может проговориться краем, одной фразой или деталью; иначе молчит. Целиком не выкладывай.]`); rec(x); }
    }

    // 5) «Кто я теперь» — что он недавно узнал о себе и принял
    if (turn % (every + 1) === 2) {
        const pool = mine.filter(x => x.step >= 3);
        const a = pick(pool, turn, s.used);
        if (a) {
            const b = pick(pool.filter(y => y !== a), turn + 1, s.used);
            out.push(`[Кто я теперь · ${short(S)} недавно узнал о себе и согласился: ${[a, b].filter(Boolean).map(y => bare(y.t)).join('; ')}. Может сослаться, пошутить, поймать себя на этом — к месту, не каждый раз.]`);
            rec(a);
        }
    }

    // 6) что он видит в ней (персона игрока) — его взгляд, не её чувства
    if (U && inScene(U, h) && turn % every === 1) {
        const pool = s.list.filter(x => live(x) && isUser(x.who) && A.sameName(x.by, S) && x.kind === 'blind' && x.step < 2);
        const x = pick(pool, turn, s.used);
        if (x) { out.push(`[Узнавание · ${short(S)} видит в ${Us} то, чего она за собой не знает: ${bare(x.t)}${x.tell ? ` (видно: ${bare(x.tell)})` : ''}. Может заметить молча — взглядом, мыслью; а если момент — сказать ей по-своему, коротко, без лекции. Как она это примет — решает ${Us}, не ты.]`); rec(x); }
    }
    // её «неизвестное», взведённое ею: только создать повод
    for (const x of s.list.filter(y => live(y) && isUser(y.who) && y.armed && y.kind === 'unknown')) {
        out.push(`[Узнавание · подведи сцену к возможности: ${x.when || 'новое для неё'} — где ${Us} может впервые узнать о себе: ${bare(x.t)}. Только создай повод; что она почувствует и поймёт — решает ${Us}.]`);
        if (type && type !== 'swipe') { x.armed = false; rec(x); }
    }
    for (const x of s.list.filter(y => live(y) && isUser(y.who) && y.armed && y.kind === 'blind' && A.sameName(y.by, S))) {
        out.push(`[Узнавание · сейчас ${short(S)} скажет ${Us} вслух, что видит в ней: ${bare(x.t)}. По-своему и коротко; без лекции и без выводов за неё.]`);
        if (type && type !== 'swipe') { x.armed = false; rec(x); }
    }
    return out.join('\n');
}

// ───────────── большое заполнение: карточка, лорбуки, свод — умная модель ─────────────

export { CRAFT };

const FILL_AI = (who, by) => `Ты — внимательный романист и редактор персонажей. Задача — «Узнавание»: что ${who} о себе не знает или скрывает, что ${by} постепенно в нём откроет — и через это он узнает себя заново.
Четыре вида:
• blind — слепое пятно: видно ${by} и читателю, но не ему. Лучше всего — хорошее, в которое он не верит, и то, что спорит с его образом себя (близкие чаще видят в человеке ум, юмор, талант и тепло, чем он сам), плюс мелкое, нелепое, человеческое. tell — признак: одна деталь поведения, которую можно показать в сцене; vs — с каким его убеждением о себе это спорит (если спорит); react — как он примет, когда ему это назовут, в его манере.
• hidden — знает он, не ${by}: личное, а не сюжетные тайны — что делал, пока никто не видел; что хранит; что любит тайком; чего стыдится по-смешному. when — когда может проговориться.
• unknown — не знает никто: что откроется в нём впервые в ситуации, которой в истории ещё не было. when — «впервые …» из ближайшего будущего его жизни по истории; t — «оказывается …»; tell — как это будет видно.
• past — только если в источниках есть такие эпизоды: что ${by} помнит о нём, а он забыл (обнуления, лёд, провалы). t — конкретный эпизод с местом и деталью; tell — как это помнит тело, когда голова не помнит; when — что может это поднять.
${CRAFT}
Не повторяй уже записанное. Ответь только JSON:
{"blind":[{"t":"что, 6–18 слов","tell":"признак, 4–14 слов","vs":"с чем спорит, 3–10 слов или пусто","react":"как примет, 4–14 слов"}],"hidden":[{"t":"6–18 слов","when":"3–10 слов"}],"unknown":[{"when":"впервые …, 3–12 слов","t":"оказывается …, 6–18 слов","tell":"4–12 слов"}],"past":[{"t":"эпизод, 8–24 слова","tell":"как помнит тело, 4–12 слов","when":"что поднимет, 3–10 слов"}]}
blind — 4–6, hidden — 3–4, unknown — 3–5, past — 0–4.`;

const FILL_ME = (who, by) => `Ты — внимательный романист. Задача — «Узнавание»: что ${by} видит в ${who}, чего она сама за собой не знает. ${who} — персонаж игрока: за неё не решай, её чувств и мыслей не пиши, выводов о ней не делай — только то, что видно со стороны его глазами, и ситуации, где она могла бы узнать о себе новое.
• blind — что он в ней видит, а она нет: лучше всего хорошее, в которое она не верит, и то, что спорит с её образом себя, плюс мелкое и смешное. tell — как это видно, одна деталь.
• unknown — ситуации из ближайшего будущего истории, где она может впервые узнать о себе новое: when — «впервые …», t — что могло бы оказаться (это подсказка игроку, не судьба).
${CRAFT}
Не повторяй уже записанное. Ответь только JSON: {"blind":[{"t":"6–18 слов","tell":"4–14 слов"}],"unknown":[{"when":"впервые …, 3–12 слов","t":"6–18 слов"}]}. blind — 5–7, unknown — 3–5.`;

export async function johariFill(who, by) {
    const W = A.canonName(who);
    const me = isUser(W);
    const B = A.canonName(by || (me ? '' : user()));
    if (!W || !B) throw new Error(me ? 'выбери, чьими глазами смотреть' : 'не поняла, чьими глазами');
    const card = cardText(W, 9000);
    let lore = '';
    try { lore = await loreFor(W, { max: 16000 }); } catch { /* */ }
    let hid = '';
    if (me) { try { hid = personaHidden(W) || ''; } catch { /* */ } }
    const other = cardText(B, 3500);
    const have = johariOf(W).filter(x => !me || A.sameName(x.by, B));
    if (!card && !lore && !hid) throw new Error('ни карточки, ни лорбука о ней/нём не нашлось');
    const j = await A.askFillJson([{ role: 'system', content: me ? FILL_ME(W, B) : FILL_AI(W, B) }, {
        role: 'user', content: [`Чьё: ${W}. Чьими глазами: ${B}.`, card ? `Карточка ${W}:\n${card}` : '', hid ? `Скрытый характер (модели истории не уходит, только тебе):\n${A.cut(hid, 2500)}` : '', lore ? `Лорбуки:\n${lore}` : '', other ? `Коротко о ${B}:\n${other}` : '',
            have.length ? `Уже записано (не повторяй):\n${have.map(x => `- ${x.kind}: ${x.t}`).join('\n')}` : ''].filter(Boolean).join('\n\n'),
    }], 4500, { what: 'Узнавание', check: (x) => ['blind', 'hidden', 'unknown', 'past'].some(k => Array.isArray(x?.[k])) }, { who: W, acts: false });
    let n = 0;
    for (const kind of me ? ['blind', 'unknown'] : ['blind', 'hidden', 'unknown', 'past']) {
        for (const r of (Array.isArray(j[kind]) ? j[kind] : []).slice(0, 7)) {
            const x = johariAdd({ ...r, who: W, by: B, kind }, 'ai');
            if (x && x.src === 'ai' && x.at > Date.now() - 5000) n++;
        }
    }
    A.saveMeta();
    A.updatePrompt();
    return n;
}

/** Посев «от Claude»: [{ who, by, kind, t, tell, when, vs, react, step, heavy }]. Правленое руками не трогает. */
export function johariSeed(list) {
    let n = 0;
    for (const r of Array.isArray(list) ? list : []) {
        const who = /^\{\{user\}\}$/i.test(str(r?.who)) ? user() : str(r?.who);
        const x = johariAdd({ ...r, who }, 'claude');
        if (x && x.src === 'claude' && !x.log.length && x.at > Date.now() - 5000) n++;
    }
    if (n) A.saveMeta();
    return n;
}

// ───────────── вид: Персонаж → Жизнь → Психика ─────────────

const ui = { busy: '', open: new Set(), by: '' };

function card(x, me) {
    const K = (me ? KINDS_ME : KINDS)[x.kind] || KINDS.blind;
    const hide = cfg().blur && !ui.open.has(x.id) && (x.step || 0) === 0 && x.kind !== 'past';
    const meta = [stepName(x), x.src === 'claude' ? 'от Claude' : x.src === 'ai' ? 'собрала модель' : x.src === 'post' ? 'из истории' : 'твоё'].filter(Boolean).join(' · ');
    const sub = [x.kind === 'unknown' && x.when ? `когда: ${x.when}` : '', x.tell ? `видно: ${x.tell}` : '', !me && x.vs ? `спорит с: ${x.vs}` : '', x.push ? `отмахнулся ×${x.push}` : '', x.no ? 'отмахнулась' : ''].filter(Boolean);
    const dots = `<span class="lf-jo-dots" title="${esc(stepName(x))}">${[1, 2, 3].map(k => `<i class="${k <= (x.step || 0) ? 'on' : ''}"></i>`).join('')}</span>`;
    const acts = me
        ? `${x.step < 3 ? `<button class="lf-iconbtn sm" data-act="jo-ok" data-id="${x.id}" title="Приняла">${A.icon('check')}</button>` : ''}${!x.no && x.step < 3 ? `<button class="lf-iconbtn sm" data-act="jo-no" data-id="${x.id}" title="Отмахнулась">${A.icon('x')}</button>` : ''}`
        : `${x.step < 3 ? `<button class="lf-iconbtn sm" data-act="jo-next" data-id="${x.id}" title="Отметить следующий шаг: ${esc(K.steps[Math.min(3, (x.step || 0) + 1)])}">${A.icon('chevR')}</button>` : ''}`;
    return `<div class="lf-idea lf-jo k-${x.kind}${x.armed ? ' armed' : ''}${(x.step || 0) >= 3 ? ' done' : ''}">
        <span class="lf-idea-ic">${A.icon(K.ic)}</span>
        <span class="lf-idea-t" data-act="jo-edit" data-id="${x.id}"><small>${esc(meta)}${x.armed ? ' · в следующем ответе' : ''}</small>
            ${hide ? `<b class="lf-blur" data-act="jo-reveal" data-id="${x.id}">${esc(x.t)}</b>` : `<b>${esc(x.t)}</b>`}
            ${sub.length && !hide ? `<i class="lf-jo-sub">${esc(sub.join(' · '))}</i>` : ''}${dots}</span>
        ${(x.step || 0) < 2 || x.kind === 'unknown' ? `<button class="lf-iconbtn sm" data-act="jo-arm" data-id="${x.id}" title="${me ? (x.kind === 'unknown' ? 'Подвести к этому' : 'Пусть скажет') : x.kind === 'hidden' ? 'Пусть проговорится' : x.kind === 'unknown' ? 'Пусть случится' : 'Пусть проявится'}">${A.icon('zap')}</button>` : ''}
        ${acts}<button class="lf-iconbtn sm" data-act="jo-del" data-id="${x.id}" title="Убрать">${A.icon('trash')}</button></div>`;
}

function group(list, kind, me, empty) {
    const K = (me ? KINDS_ME : KINDS)[kind];
    const l = list.filter(x => x.kind === kind && (x.step || 0) < 3);
    if (!l.length && !empty) return '';
    return `<div class="lf-jo-g"><div class="lf-jo-h">${A.icon(K.ic)}<b>${K.name}</b><small>${K.sub}</small></div>
        ${l.length ? l.map(x => card(x, me)).join('') : `<div class="lf-hint">${empty}</div>`}</div>`;
}

export function johariHtml(who) {
    if (!A?.hasChat?.() || !johariOn()) return '';
    const W = A.canonName(who);
    const me = isUser(W);
    const all = johariOf(W);
    const N = esc(W);
    const c = cfg();
    if (me) {
        const obs = [...new Set(all.map(x => x.by).filter(Boolean))];
        const cast = (A.groupMembers?.() || []).map(A.canonName).filter(n => n && !isUser(n));
        const by = ui.by && cast.some(n => A.sameName(n, ui.by)) ? ui.by : (obs[0] || cast[0] || '');
        const list = all.filter(x => !by || A.sameName(x.by, by) || !x.by);
        const owned = list.filter(x => (x.step || 0) >= 3);
        const hs = M().hints.filter(h => h.st !== 'no').slice(-5).reverse();
        return `${A.sec('Узнавание', 'что в тебе видят')}
        <div class="lf-hint">Чужими глазами: то, чего ты за собой не знаешь. Модель ведёт только его взгляд — заметил, сказал; приняла ли ты — решаешь ты (✓ или ✕). «Неизвестное» — подсказки тебе: ⚡ — модель только подведёт сцену к поводу. После его ответов прилетают уведомления-подсказки: что он в тебе увидел, что с тобой впервые, где он вернул тебе твои же слова.</div>
        ${hs.length ? `<div class="lf-jo-g"><div class="lf-jo-h">${A.icon('sparkles')}<b>Подсказки</b><small>из его ответов — решаешь ты</small></div>${hs.map(hintRow).join('')}</div>` : ''}
        ${cast.length > 1 ? `<div class="lf-chips">${cast.map(n => `<button class="lf-chip${A.sameName(n, by) ? ' on' : ''}" data-act="jo-by" data-v="${esc(n)}">${A.ava(n, 'xs')} ${esc(short(n))}</button>`).join('')}</div>` : ''}
        ${group(list, 'blind', true, `Пока пусто. «✦ Собрать» — что ${esc(short(by || 'он'))} видит в тебе, по карточкам, лорбукам и своду.`)}
        ${group(list, 'unknown', true, '')}
        ${owned.length ? `<div class="lf-jo-g"><div class="lf-jo-h">${A.icon('sun')}<b>Ты это приняла</b></div><div class="lf-chips wrap">${owned.map(x => `<span class="lf-chip static">${esc(x.t)}</span>`).join('')}</div></div>` : ''}
        <div class="lf-actions"><button class="lf-btn" data-act="jo-fill" data-name="${N}" data-by="${esc(by)}">${A.icon('sparkles')} ${ui.busy === W ? 'Читаю…' : 'Собрать'}</button><button class="lf-btn ghost" data-act="jo-add" data-name="${N}" data-by="${esc(by)}">${A.icon('plus')} Своё</button></div>
        <div class="lf-field"><label>Подсказки уведомлением</label><div class="lf-seg">${Object.entries(HINT).map(([k, v]) => `<button class="${c.hints === k ? 'on' : ''}" data-act="jo-hint" data-v="${k}">${v[1]}</button>`).join('')}</div></div>
        <label class="lf-switch"><input type="checkbox" data-act="jo-blur" ${c.blur ? 'checked' : ''}><span></span>Сюрприз: прятать то, что ещё не открылось</label>`;
    }
    const owned = all.filter(x => (x.step || 0) >= 3);
    const n = (k) => all.filter(x => x.kind === k && (x.step || 0) < 3).length;
    return `${A.sec('Узнавание', all.length ? `${n('blind')} видит она · ${n('hidden')} знает он · ${n('unknown')} не знает никто${n('past') ? ` · ${n('past')} помнит она` : ''}` : 'пусто')}
    <div class="lf-hint">Она узнаёт его — и он через это узнаёт себя. Шаги: заметила → назвала → он принял (не сразу, если это спорит с тем, каким он себя считает). Летописец отмечает сам; ⚡ — пусть проявится в следующем ответе, › — отметить шаг руками.</div>
    ${group(all, 'blind', false, 'Пусто. «✦ Собрать» — по карточке, лорбукам и своду всей истории.')}
    ${group(all, 'hidden', false, '')}
    ${group(all, 'unknown', false, '')}
    ${group(all, 'past', false, '')}
    ${owned.length ? `<div class="lf-jo-g"><div class="lf-jo-h">${A.icon('sun')}<b>Кто я теперь</b><small>узнал о себе и принял</small></div>${owned.map(x => card(x, false)).join('')}</div>` : ''}
    <div class="lf-actions"><button class="lf-btn" data-act="jo-fill" data-name="${N}">${A.icon('sparkles')} ${ui.busy === W ? 'Читаю…' : 'Собрать'}</button><button class="lf-btn ghost" data-act="jo-add" data-name="${N}">${A.icon('plus')} Своё</button></div>
    <div class="lf-field"><label>Как часто признаки в ответах</label><div class="lf-seg">${Object.entries(PACE).map(([k, v]) => `<button class="${c.pace === k ? 'on' : ''}" data-act="jo-pace" data-v="${k}">${v[1]}</button>`).join('')}</div></div>
    <label class="lf-switch"><input type="checkbox" data-act="jo-blur" ${c.blur ? 'checked' : ''}><span></span>Сюрприз: прятать то, что ещё не открылось</label>`;
}

function editSheet(x, who, by) {
    const me = isUser(x?.who || who);
    const K = me ? KINDS_ME : KINDS;
    const v = x || { kind: 'blind', t: '', tell: '', when: '', vs: '', react: '', step: 0 };
    A.openSheet(`${A.icon('eye')} Узнавание · ${esc(short(x?.who || who))}`, `
        <div class="lf-field"><label>Что это</label><select data-in="jo-k">${Object.entries(K).map(([k, d]) => `<option value="${k}" ${v.kind === k ? 'selected' : ''}>${d.name} — ${d.sub}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Суть</label><textarea rows="3" data-in="jo-t" placeholder="${me ? 'смеётся беззвучно, когда смеётся не для кого-то' : 'вибраниумовой рукой делает самое тонкое — и считает её рукой «для дела»'}">${esc(v.t)}</textarea></div>
        <div class="lf-field"><label>Как это видно со стороны</label><input type="text" data-in="jo-tell" value="${esc(v.tell || '')}" placeholder="заплетает косы металлическими пальцами"></div>
        <div class="lf-field"><label>Когда (для «впервые» и «скрытого»)</label><input type="text" data-in="jo-when" value="${esc(v.when || '')}" placeholder="впервые возьмёт дочь на руки"></div>
        ${me ? '' : `<div class="lf-field"><label>С чем спорит в его образе себя</label><input type="text" data-in="jo-vs" value="${esc(v.vs || '')}" placeholder="«рука — оружие»"></div>
        <div class="lf-field"><label>Как примет, когда назовут</label><input type="text" data-in="jo-react" value="${esc(v.react || '')}" placeholder="посмотрит на руку, будто видит впервые; отшутится"></div>`}
        <div class="lf-field"><label>Шаг</label><select data-in="jo-step">${(K[v.kind] || K.blind).steps.map((s, k) => `<option value="${k}" ${(v.step || 0) === k ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        ${x && x.log?.length ? `<div class="lf-hint">${x.log.slice(-5).map(l => `#${l.mes} · ${esc(l.mv)}${l.t ? ` — ${esc(l.t)}` : ''}`).join('<br>')}</div>` : ''}
        <button class="lf-btn primary full" data-act="jo-save" data-id="${x ? x.id : ''}" data-name="${esc(who || '')}" data-by="${esc(by || '')}">${A.icon('check')} Сохранить</button>`);
}

export async function johariClick(act, el) {
    if (!act.startsWith('jo-')) return false;
    const s = M();
    const x = el.dataset.id ? s.list.find(y => y.id === el.dataset.id) : null;
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    const i = A.chatArr().length - 1;
    switch (act) {
        case 'jo-reveal': if (x) ui.open.add(x.id); A.render(); return true;
        case 'jo-arm': if (x) x.armed = !x.armed; if (x?.armed) A.toast('info', 'В следующем ответе', '✦ Узнавание', { timeOut: 1600 }); return done();
        case 'jo-next': if (x) { const mv = ['seen', 'named', 'owned'][Math.min(2, x.step || 0)]; const to = Math.min(3, (x.step || 0) + 1); x.prev = x.step || 0; x.step = to; x.log.push({ mes: i, mv, t: 'отмечено руками', src: 'me' }); } return done();
        case 'jo-ok': if (x) { x.prev = x.step || 0; x.step = 3; x.no = false; x.log.push({ mes: i, mv: 'owned', t: 'приняла', src: 'me' }); } return done();
        case 'jo-no': if (x) { x.no = true; x.log.push({ mes: i, mv: 'declined', t: 'отмахнулась', src: 'me' }); } return done();
        case 'jo-del': if (x) x.off = true; return done();
        case 'jo-by': ui.by = el.dataset.v || ''; A.render(); return true;
        case 'jo-pace': cfg().pace = PACE[el.dataset.v] ? el.dataset.v : 'mid'; A.saveSettings(); A.updatePrompt(); A.render(); return true;
        case 'jo-hint': cfg().hints = HINT[el.dataset.v] ? el.dataset.v : 'mid'; A.saveSettings(); A.render(); return true;
        case 'jo-hok': {
            const h = s.hints.find(y => y.id === el.dataset.id);
            if (!h) return true;
            const y = h.ref ? s.list.find(z => z.id === h.ref && live(z)) : null;
            if (y) {
                if (h.kind === 'first' && y.kind === 'unknown') { if ((y.step || 0) < 1) { y.prev = y.step || 0; y.step = 1; y.log.push({ mes: h.mes, mv: 'emerged', t: 'случилось', src: 'me' }); } }
                else { y.prev = y.step || 0; y.step = 3; y.no = false; y.log.push({ mes: h.mes, mv: 'owned', t: 'приняла', src: 'me' }); }
            } else {
                const first = h.kind === 'first';
                const z = johariAdd({ who: user(), by: h.by || undefined, kind: first ? 'unknown' : 'blind', t: h.t, step: first ? 1 : 3 }, 'me', h.mes);
                if (z) { z.hand = true; h.ref = z.id; }
            }
            h.st = 'ok';
            return done();
        }
        case 'jo-hno': { const h = s.hints.find(y => y.id === el.dataset.id); if (h) h.st = 'no'; return done(); }
        case 'jo-blur': cfg().blur = !!el.checked; ui.open.clear(); A.saveSettings(); A.render(); return true;
        case 'jo-edit': if (x) editSheet(x, x.who, x.by); return true;
        case 'jo-add': editSheet(null, el.dataset.name, el.dataset.by); return true;
        case 'jo-save': {
            const box = el.closest('.lf-sheet') || document;
            const v = (k) => box.querySelector(`[data-in="${k}"]`)?.value?.trim() ?? '';
            const t = v('jo-t');
            if (!t) return true;
            const kind = v('jo-k') || 'blind';
            const step = Math.max(0, Math.min(3, Number(v('jo-step')) || 0));
            if (x) Object.assign(x, { kind, t: t.slice(0, 240), tell: v('jo-tell').slice(0, 200), when: v('jo-when').slice(0, 160), vs: v('jo-vs').slice(0, 160), react: v('jo-react').slice(0, 200), step, hand: true });
            else {
                const y = johariAdd({ who: el.dataset.name, by: el.dataset.by || undefined, kind, t, tell: v('jo-tell'), when: v('jo-when'), vs: v('jo-vs'), react: v('jo-react'), step }, 'me');
                if (y) y.hand = true;
            }
            A.closeSheet();
            return done();
        }
        case 'jo-fill': {
            const who = el.dataset.name;
            if (ui.busy) return true;
            ui.busy = A.canonName(who);
            A.render();
            try {
                const n = await johariFill(who, el.dataset.by || '');
                A.toast(n ? 'success' : 'info', n ? `Добавила: ${n}` : 'Нового не нашлось', '✦ Узнавание', { timeOut: 3000 });
            } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Узнавание', { timeOut: 5000 }); }
            finally { ui.busy = ''; }
            A.render();
            return true;
        }
    }
    return false;
}

/** Что записал пост i: шаги узнавания. */
export function johariRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.list) {
        if (x.off) continue;
        if (x.src === 'post' && x.mes === i) { out.push({ id: `jo:${x.id}`, g: 'Узнавание', icon: 'eye', t: `${short(x.who)} — новое: ${x.t}`, del: () => { x.off = true; } }); continue; }
        for (const l of x.log) if (l.mes === i && l.src === 'post') out.push({ id: `jo:${x.id}:${l.mv}`, g: 'Узнавание', icon: 'eye', t: `${short(x.who)} — ${l.mv}: ${A.cut(x.t, 80)}`, del: () => { x.log = x.log.filter(y => y !== l); if (Number.isFinite(l.from) && (x.step || 0) === MOVE_STEP[l.mv]) x.step = l.from; } });
    }
    for (const h of s.hints) if (h.mes === i && h.st !== 'no') out.push({ id: `jo:${h.id}`, g: 'Узнавание', icon: 'sparkles', t: `подсказка ${short(user())}: ${A.cut(h.t, 80)}`, del: () => { h.st = 'no'; } });
    return out;
}
