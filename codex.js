// Свод истории. Глобальные вещи (ядро характера, привычки, семья, фракции, ритуалы пары, темперамент) нельзя писать
// из «сейчас»: последние посты и последние дни — это токсикоз третьей недели, а не то, что человек любит на завтрак.
// Свод читает ВСЮ историю один раз умной моделью: чат идёт кусками (в каждом — что случилось, что стало известно
// о людях, что они пережили, что между парами), потом куски вместе с карточками и лорбуками сводятся в одно досье:
// история целиком, периоды, люди, пары, мир, незакрытое. Дорого, зато один раз; новое потом досводится куском.
// Свод лежит в чате, модели в каждый пост НЕ уходит — его берут большие заполнения (A.withStory) и код-мозг.
// Мир → Свод.

import { loreFor, cardText } from './lore.js';
import { extractJson } from './chronicler.js';

let A = null;
let run = null;      // { stop, step, of, what } — идёт сборка
export function initCodex(api) { A = api; }
const esc = (v) => A.esc(v);
const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const EMO = ['fear', 'anger', 'shame', 'low', 'tender', 'playful'];
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

function M() {
    const cm = A.chatMeta();
    if (!cm.codex || typeof cm.codex !== 'object') cm.codex = {};
    const c = cm.codex;
    if (!Array.isArray(c.parts)) c.parts = [];      // { from, to, n, notes } — выписки по кускам чата
    if (c.sum && typeof c.sum !== 'object') c.sum = null;   // итоговый свод
    return c;
}
const cfg = () => A.settings().chron;
const chunkSize = () => Math.round(Math.max(60000, Math.min(700000, num(cfg().codexChunk, 260000))));

// ───────────── текст истории ─────────────

/** Посты истории (скрытые от модели — тоже: у неё начало чата спрятано, а история там была). */
function posts() {
    const chat = A.chatArr();
    const U = A.canonName(A.ctx().name1) || A.ctx().name1 || 'Игрок';
    const out = [];
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!A.isPost(m)) continue;
        const t = A.plainText(m.mes || '').slice(0, 12000);
        if (t.length < 20) continue;
        const ts = m.horae_meta?.timestamp || {};
        const who = m.is_user ? U : (A.canonName(m.name) || m.name || '?');
        out.push({ i, len: t.length + 40, line: `#${i} [${[ts.story_date, ts.story_time].filter(Boolean).join(' ') || '—'}] ${who}: ${t}` });
    }
    return out;
}

/** Нарезка на куски: [{ from, to, n, len, lines }] — по размеру, целыми постами. */
function chunks(list, size = chunkSize()) {
    const out = [];
    let cur = null;
    for (const p of list) {
        if (!cur || cur.len + p.len > size) { cur = { from: p.i, to: p.i, n: 0, len: 0, lines: [] }; out.push(cur); }
        cur.lines.push(p.line); cur.len += p.len; cur.to = p.i; cur.n++;
    }
    return out;
}

/** Что ещё не выписано: куски после последнего готового (хвост меньше трети куска ждёт, пока наберётся, — если не force). */
function pending(force = false) {
    const c = M();
    const done = c.parts.length ? Math.max(...c.parts.map(p => p.to)) : -1;
    const rest = posts().filter(p => p.i > done);
    const list = chunks(rest);
    if (!force && list.length && list[list.length - 1].len < chunkSize() / 3 && c.parts.length) list.pop();
    return { list, done, rest: rest.length, chars: rest.reduce((a, p) => a + p.len, 0) };
}

const cast = () => [A.canonName(A.ctx().name1), ...A.groupMembers().map(A.canonName)].filter((n, k, a) => n && !NARR.test(n) && a.indexOf(n) === k);

// ───────────── запросы ─────────────

const MAP_SYS = `Ты архивариус длинной ролевой истории. Перед тобой её кусок: посты с номерами (#) и датами истории. Выпиши из него только то, что в нём есть, — плотно, без воды, по-русски, одним JSON:
{"span":"о чём этот кусок, 3–5 предложений","events":[{"day":"ГГГГ-ММ-ДД","mes":123,"t":"что произошло, 8–20 слов","who":["имена"],"w":2}],"people":[{"name":"","facts":["устойчивое о человеке"],"felt":[{"day":"ГГГГ-ММ-ДД","mes":123,"t":"что пережил, 6–14 слов","emo":"low","w":3}]}],"pairs":[{"a":"","b":"","t":"что между ними в этом куске, 2–4 предложения","marks":["веха: дата — что"],"rituals":["свои шутки, слова, ритуалы"]}],"world":["места, правила мира, организации, вещи — что стало известно"],"threads":["незакрытое: обещания, тайны, угрозы, планы"]}
events — до 40 самых значимых, w от 1 до 3 (3 — поворот всей истории). people — каждый, кто действует или о ком узнали важное. facts — до 14 на человека: вкусы (что любит и не любит на самом деле, не разовое), привычки и жесты, страхи, умения, как говорит, что его успокаивает и возвращает в себя, что ранит, во что о себе верит, как ведёт себя, когда ему стыдно, страшно, зло, нежно. Разовое состояние (болезнь на день, каприз, токсикоз) к устойчивому не пиши. felt — до 10 на человека: что он по-настоящему пережил здесь; emo — чем это для него было: fear страх, anger злость, shame стыд и вина, low тоска и утрата, tender нежность, playful радость и кураж; w — сила 1–3. pairs — для пар, между которыми что-то произошло. Не выдумывай и не обобщай за пределы куска. Имена — как в тексте, даты и номера — из меток постов.`;

const SUM_SYS = `Ты сводишь досье длинной ролевой истории. У тебя: выписки по всем её кускам подряд (от начала к концу), карточки и записи лорбуков главных людей. Сведи в ОДИН свод — по всей истории, а не по её концу. Ответь одним JSON по-русски:
{"story":"вся история в 15–25 предложениях: с чего началась, главные повороты, где сейчас","acts":[{"t":"название периода","from":"ГГГГ-ММ-ДД","to":"ГГГГ-ММ-ДД","sum":"3–5 предложений"}],"people":[{"name":"","who":"кто он в истории, 1–2 предложения","arc":"как изменился за историю, 3–5 предложений","traits":[""],"likes":[""],"dislikes":[""],"habits":[""],"fears":[""],"soothes":[""],"wounds":[""],"beliefs":[""],"skills":[""],"speech":"как говорит","shame":"как ведёт себя, когда стыдно","fear":"когда страшно","anger":"когда зол","tender":"когда нежен","now":"где он сейчас в жизни, 1–2 предложения"}],"pairs":[{"a":"","b":"","kind":"пара|семья|друзья|коллеги|враги","story":"история отношений, 4–8 предложений","marks":["веха: дата — что"],"rituals":[""],"love_ab":0,"love_ba":0}],"world":[""],"threads":[""]}
Правила. Устойчивое отделяй от разового: «любит» и «привычка» — только то, что повторялось или прямо сказано в карточке и лорбуке; болезнь, каприз и настроение одного дня сюда не идут. Карточка и лорбук — основа; история дополняет и уточняет их, а где противоречит — верь истории и скажи в arc, что изменилось. traits — до 10, остальные списки — до 8, коротко. beliefs — что человек думает о себе («я испорченный»). soothes — что его на деле успокаивало. love_ab — насколько a любит b сейчас, если судить по ВСЕЙ истории: 0 — нет, 30 — тепло и привязанность, 60 — очень дорог, 85–100 — любит без оговорок; последняя ссора любовь не отменяет. Для врагов и чужих — 0. acts — 4–10 периодов. people — все главные и те второстепенные, о ком набралось. Не выдумывай: чего нет в материалах — оставь пустым.`;

async function askBig(sys, usr, tokens, what) {
    const ask = A.askDeep || A.askModel;
    const once = async (extra, tk) => extractJson(await ask([{ role: 'system', content: sys }, { role: 'user', content: usr + extra }], tk, what));
    let j = null;
    try { j = await once('', tokens); } catch (e) { console.warn('[Life] свод:', e); throw e; }
    if (j && typeof j === 'object') return j;
    j = await once('\n\n[Прошлый ответ не разобрался как JSON. Ответь заново: строго один JSON по схеме, компактнее, без пояснений и markdown.]', Math.min(Math.round(tokens * 1.4), 30000));
    if (j && typeof j === 'object') return j;
    throw new Error(`${what}: модель не вернула JSON — проверь умную модель и токены (Мир → ⚙)`);
}

function cleanPart(j) {
    const day = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : '');
    return {
        span: str(j.span, 900),
        events: arr(j.events).map(e => ({ day: day(e?.day), mes: Math.round(num(e?.mes, -1)), t: str(e?.t, 220), who: arr(e?.who).map(n => str(n, 40)).filter(Boolean).slice(0, 6), w: Math.round(Math.max(1, Math.min(3, num(e?.w, 1)))) })).filter(e => e.t).slice(0, 45),
        people: arr(j.people).map(p => ({
            name: str(p?.name, 50),
            facts: arr(p?.facts).map(f => str(f, 200)).filter(Boolean).slice(0, 16),
            felt: arr(p?.felt).map(f => ({ day: day(f?.day), mes: Math.round(num(f?.mes, -1)), t: str(f?.t, 140), emo: EMO.includes(f?.emo) ? f.emo : '', w: Math.round(Math.max(1, Math.min(3, num(f?.w, 1)))) })).filter(f => f.t && f.emo).slice(0, 12),
        })).filter(p => p.name).slice(0, 30),
        pairs: arr(j.pairs).map(p => ({ a: str(p?.a, 50), b: str(p?.b, 50), t: str(p?.t, 700), marks: arr(p?.marks).map(x => str(x, 160)).filter(Boolean).slice(0, 8), rituals: arr(p?.rituals).map(x => str(x, 140)).filter(Boolean).slice(0, 6) })).filter(p => p.a && p.b).slice(0, 20),
        world: arr(j.world).map(x => str(x, 220)).filter(Boolean).slice(0, 20),
        threads: arr(j.threads).map(x => str(x, 220)).filter(Boolean).slice(0, 14),
    };
}

function cleanSum(j) {
    const list = (v, n = 8, max = 180) => arr(v).map(x => str(x, max)).filter(Boolean).slice(0, n);
    const love = (v) => Math.round(Math.max(0, Math.min(100, num(v, 0))));
    return {
        story: str(j.story, 5000),
        acts: arr(j.acts).map(a => ({ t: str(a?.t, 80), from: str(a?.from, 10), to: str(a?.to, 10), sum: str(a?.sum, 900) })).filter(a => a.t || a.sum).slice(0, 12),
        people: arr(j.people).map(p => ({
            name: str(p?.name, 50), who: str(p?.who, 400), arc: str(p?.arc, 1100),
            traits: list(p?.traits, 10), likes: list(p?.likes), dislikes: list(p?.dislikes), habits: list(p?.habits), fears: list(p?.fears), soothes: list(p?.soothes),
            wounds: list(p?.wounds), beliefs: list(p?.beliefs, 5), skills: list(p?.skills),
            speech: str(p?.speech, 400), shame: str(p?.shame, 300), fear: str(p?.fear, 300), anger: str(p?.anger, 300), tender: str(p?.tender, 300), now: str(p?.now, 400),
        })).filter(p => p.name).slice(0, 40),
        pairs: arr(j.pairs).map(p => ({ a: str(p?.a, 50), b: str(p?.b, 50), kind: str(p?.kind, 20), story: str(p?.story, 1600), marks: list(p?.marks, 10), rituals: list(p?.rituals, 8), love_ab: love(p?.love_ab), love_ba: love(p?.love_ba) })).filter(p => p.a && p.b).slice(0, 30),
        world: list(j.world, 30, 240), threads: list(j.threads, 20, 240),
    };
}

/** Выписки одного куска — компактной строкой для сведения. */
function partText(p, k) {
    const n = p.notes;
    const ppl = n.people.map(x => `${x.name}: ${x.facts.join('; ')}${x.felt.length ? ` | пережил: ${x.felt.map(f => `${f.day || ''} ${f.t} (${f.emo} ${f.w})`).join('; ')}` : ''}`).join('\n');
    const prs = n.pairs.map(x => `${x.a} × ${x.b}: ${x.t}${x.marks.length ? ` Вехи: ${x.marks.join('; ')}` : ''}${x.rituals.length ? ` Своё: ${x.rituals.join('; ')}` : ''}`).join('\n');
    return [`## Кусок ${k + 1} (посты #${p.from}–#${p.to})`, n.span, n.events.length ? `События:\n${n.events.map(e => `- ${e.day || ''} ${e.t}${e.w >= 3 ? ' ★' : ''}`).join('\n')}` : '', ppl ? `Люди:\n${ppl}` : '', prs ? `Пары:\n${prs}` : '',
        n.world.length ? `Мир: ${n.world.join('; ')}` : '', n.threads.length ? `Незакрытое: ${n.threads.join('; ')}` : ''].filter(Boolean).join('\n');
}

async function sources() {
    const out = [];
    for (const n of cast()) {
        let card = '';
        try { card = cardText(n, 6000); } catch { /* */ }
        let lore = '';
        try { lore = await loreFor(n, { max: 16000 }); } catch { /* */ }
        if (card || lore) out.push(`### ${n}\n${card ? `Карточка:\n${card}\n` : ''}${lore ? `Лорбук:\n${lore}` : ''}`);
    }
    return out.join('\n\n');
}

// ───────────── сборка ─────────────

async function mapChunk(ch, k, total) {
    const c = M();
    const prev = c.parts.length ? c.parts[c.parts.length - 1].notes.span : '';
    const usr = [`Главные: ${cast().join(', ')}.`, prev ? `До этого куска (для связи, сюда не выписывай): ${prev}` : '', `Кусок ${k} из ${total}, посты #${ch.from}–#${ch.to}:`, ch.lines.join('\n')].filter(Boolean).join('\n\n');
    const j = await askBig(MAP_SYS, usr, 9000, 'Свод: выписки');
    c.parts.push({ from: ch.from, to: ch.to, n: ch.n, notes: cleanPart(j) });
    c.parts.sort((a, b) => a.from - b.from);
    A.saveMeta();
}

async function reduce() {
    const c = M();
    if (!c.parts.length) throw new Error('выписок ещё нет — сначала собери историю');
    let notes = c.parts.map(partText);
    // влезть должно всё: если выписок слишком много, старые куски подрезаются ровнее новых
    const budget = 520000;
    const total = notes.reduce((a, t) => a + t.length, 0);
    if (total > budget) { const k = budget / total; notes = notes.map(t => t.slice(0, Math.max(1500, Math.round(t.length * k)))); }
    const src = await sources();
    const usr = [`Главные: ${cast().join(', ')}. Персонаж игрока: ${A.canonName(A.ctx().name1)}.`, `# Выписки по истории (от начала к концу)\n${notes.join('\n\n')}`, src ? `# Карточки и лорбуки\n${src}` : ''].filter(Boolean).join('\n\n');
    const j = await askBig(SUM_SYS, usr, 24000, 'Свод: итог');
    c.sum = cleanSum(j);
    c.upto = Math.max(...c.parts.map(p => p.to));
    c.at = new Date().toISOString().slice(0, 16).replace('T', ' ');
    c.posts = c.parts.reduce((a, p) => a + p.n, 0);
    A.saveMeta();
    try { applyLove(); } catch (e) { console.warn('[Life] свод: любовь', e); }
}

/** Любовь по истории — только туда, где её ещё никто не ставил (ноль и без замка): руками поставленное не трогается. */
function applyLove() {
    const names = cast();
    const real = (n) => names.find(x => A.sameName(x, n)) || '';
    let n = 0;
    for (const p of arr(M().sum?.pairs)) {
        const a = real(p.a), b = real(p.b);
        if (!a || !b || A.sameName(a, b)) continue;
        for (const [from, to, v] of [[a, b, p.love_ab], [b, a, p.love_ba]]) {
            if (v < 25) continue;
            const cur = A.relOf(from, to);
            if (cur && (num(cur.love) > 0 || Number.isFinite(cur.pin?.love))) continue;
            if (A.relSet?.(from, to, 'love', v)) n++;
        }
    }
    if (n) { A.saveMeta(); A.updatePrompt?.(); }
    return n;
}

/** Собрать: выписать всё невыписанное и свести. mode: 'all' — заново, 'new' — только новое, 'sum' — только свести. */
async function build(mode) {
    if (run) return;
    const c = M();
    if (mode === 'all') { c.parts = []; c.sum = null; c.upto = -1; }
    const list = mode === 'sum' ? [] : pending(true).list;
    run = { stop: false, step: 0, of: list.length + 1, what: 'готовлюсь' };
    A.render();
    try {
        for (let k = 0; k < list.length; k++) {
            if (run.stop) throw new Error('остановлено — выписанное сохранено, можно продолжить');
            run.step = k + 1; run.what = `читаю кусок ${k + 1} из ${list.length} (посты #${list[k].from}–#${list[k].to})`;
            A.render();
            await mapChunk(list[k], c.parts.length + 1, c.parts.length + list.length - k);
        }
        if (run.stop) throw new Error('остановлено — выписанное сохранено, можно продолжить');
        run.step = list.length + 1; run.what = 'свожу вместе с карточками и лорбуками';
        A.render();
        await reduce();
        A.toast('success', `Свод готов: ${c.sum.people.length} людей, ${c.sum.pairs.length} пар, ${c.sum.acts.length} периодов`, '✦ Свод истории', { timeOut: 6000 });
    } catch (e) {
        c.err = String(e?.message || e).slice(0, 300);
        A.saveMeta();
        A.toast('warning', esc(c.err), '✦ Свод истории', { timeOut: 9000 });
    } finally { run = null; A.render(); }
}

// ───────────── что отдаём другим ─────────────

export const codexReady = () => { try { return !!M().sum; } catch { return false; } };
/** Сколько постов истории ещё не в своде. */
export function codexBehind() { try { const c = M(); return c.sum ? posts().filter(p => p.i > num(c.upto, -1)).length : 0; } catch { return 0; } }
const personOf = (who) => arr(M().sum?.people).find(p => A.sameName(p.name, who)) || null;
const pairOf = (a, b) => arr(M().sum?.pairs).find(p => (A.sameName(p.a, a) && A.sameName(p.b, b)) || (A.sameName(p.a, b) && A.sameName(p.b, a))) || null;

function personText(p) {
    const row = (l, v) => (arr(v).length ? `${l}: ${v.join('; ')}` : '');
    const one = (l, v) => (v ? `${l}: ${v}` : '');
    return [`${p.name} — ${p.who}`, one('Как изменился', p.arc), row('Черты', p.traits), row('Любит', p.likes), row('Не любит', p.dislikes), row('Привычки', p.habits), row('Страхи', p.fears),
        row('Что успокаивает', p.soothes), row('Что ранит', p.wounds), row('Что думает о себе', p.beliefs), row('Умеет', p.skills), one('Речь', p.speech),
        one('Когда стыдно', p.shame), one('Когда страшно', p.fear), one('Когда зол', p.anger), one('Когда нежен', p.tender), one('Сейчас', p.now)].filter(Boolean).join('\n');
}
function pairText(p) {
    return [`${p.a} и ${p.b}${p.kind ? ` (${p.kind})` : ''}: ${p.story}`, p.marks.length ? `Вехи: ${p.marks.join('; ')}` : '', p.rituals.length ? `Своё: ${p.rituals.join('; ')}` : ''].filter(Boolean).join('\n');
}

/**
 * Свод текстом для большого заполнения. who — чьё досье нужно подробно (строка или список); pairs — и его пары;
 * world — мир и незакрытое; max — сколько знаков. Пусто, если свода нет.
 */
export function codexText({ who = null, pairs = true, world = false, acts = true, max = 14000 } = {}) {
    const s = (() => { try { return M().sum; } catch { return null; } })();
    if (!s) return '';
    const names = (Array.isArray(who) ? who : who ? [who] : []).filter(Boolean);
    const out = [`История целиком: ${s.story}`];
    if (acts && s.acts.length) out.push(`Периоды:\n${s.acts.map(a => `- ${a.t}${a.from ? ` (${a.from}${a.to && a.to !== a.from ? ` — ${a.to}` : ''})` : ''}: ${a.sum}`).join('\n')}`);
    const ppl = names.length ? names.map(personOf).filter(Boolean) : s.people.slice(0, 8);
    if (ppl.length) out.push(`Люди:\n${ppl.map(personText).join('\n\n')}`);
    if (pairs) {
        const prs = names.length ? s.pairs.filter(p => names.some(n => A.sameName(p.a, n) || A.sameName(p.b, n))) : s.pairs.slice(0, 6);
        if (prs.length) out.push(`Пары:\n${prs.map(pairText).join('\n\n')}`);
    }
    if (world && s.world.length) out.push(`Мир: ${s.world.join('; ')}`);
    if (world && s.threads.length) out.push(`Незакрытое: ${s.threads.join('; ')}`);
    let t = out.join('\n\n');
    if (t.length > max) t = `${t.slice(0, max - 1).trimEnd()}…`;
    return t;
}

/** Что человек пережил за всю историю — для памяти с чувством: [{ day, mes, t, emo, w }], от старого к новому. */
export function codexFelt(who, minW = 2) {
    const out = [];
    try { for (const p of M().parts) for (const x of p.notes.people) if (A.sameName(x.name, who)) for (const f of x.felt) if (f.w >= minW) out.push({ ...f }); } catch { /* */ }
    return out.sort((a, b) => a.mes - b.mes);
}
export const codexPerson = (who) => { try { return personOf(who); } catch { return null; } };
export const codexPair = (a, b) => { try { return pairOf(a, b); } catch { return null; } };

/** Добавить свод в запрос большого заполнения: вторым системным сообщением. Нет свода — запрос как был. */
export function withStory(messages, opts = {}) {
    const t = codexText(opts);
    if (!t) return messages;
    const note = { role: 'system', content: `Свод всей истории (собран по всему чату, карточкам и лорбукам — опирайся на него, а не только на последние дни; устойчивое отделяй от разового):\n${t}` };
    const k = messages.findIndex(m => m.role !== 'system');
    return k < 0 ? [...messages, note] : [...messages.slice(0, k), note, ...messages.slice(k)];
}

// ───────────── Мир → Свод ─────────────

const kch = (n) => (n >= 1000000 ? `${(n / 1000000).toFixed(1)} млн` : `${Math.round(n / 1000)} тыс.`);

export function codexHtml() {
    const c = M();
    const all = posts();
    const pend = pending(true);
    const s = c.sum;
    const tok = Math.round(pend.chars / 2.6);       // русский текст: примерно 2.6 знака на токен
    const deep = cfg().deepModel || cfg().deepProfile || '';
    const head = `${A.sec('Свод истории')}<div class="lf-hint">Вся история, прочитанная целиком умной моделью: периоды, люди, пары, мир. Из него берут контекст большие заполнения — ядро характера, привычки, «Своё», семья, фракции, ритуалы, сюжетка, помощник, темперамент в «Мозге», — чтобы глобальное не писалось из последних дней. В каждый пост свод не уходит.</div>`;
    if (run) {
        return `${head}<div class="lf-cx-run"><b>${esc(run.what)}</b><i class="lf-meter"><b style="width:${Math.round(100 * run.step / Math.max(1, run.of))}%"></b></i><small>шаг ${run.step} из ${run.of} · не уходи со страницы: готовые куски сохраняются, прерванное можно продолжить</small></div>
            <button class="lf-btn full" data-act="cx-stop">${A.icon('pause')} Остановить после этого куска</button>`;
    }
    const status = s
        ? `<div class="lf-cx-stat"><b>Собран ${esc(c.at || '')}</b><span>постов в своде: ${num(c.posts)} из ${all.length}${pend.rest ? ` · новых: ${pend.rest}` : ''}</span></div>`
        : `<div class="lf-cx-stat"><b>${c.parts.length ? `Выписано кусков: ${c.parts.length} — не сведено` : 'Ещё не собран'}</b><span>постов в истории: ${all.length}</span></div>`;
    const est = pend.list.length ? `<div class="lf-hint">Осталось прочитать: ${kch(pend.chars)} знаков ≈ ${kch(tok)} токенов, запросов: ${pend.list.length} + 1 на сведение. ${deep ? `Умная модель: ${esc(deep)}.` : '<b>Умная модель не выбрана</b> — пойдёт обычным Летописцем; выбери её в Мир → ⚙.'}</div>` : '';
    const btns = `<div class="lf-actions">
        ${pend.list.length ? `<button class="lf-btn primary" data-act="cx-new">${A.icon('sparkles')} ${c.parts.length ? (s ? 'Досвести новое' : 'Продолжить') : 'Собрать по всей истории'}</button>` : ''}
        ${c.parts.length ? `<button class="lf-btn" data-act="cx-sum">${A.icon('refresh')} Свести заново</button>` : ''}
        ${c.parts.length ? `<button class="lf-btn" data-act="cx-all">${A.icon('trash')} С нуля</button>` : ''}
    </div>${c.err ? `<div class="lf-hint">В прошлый раз: ${esc(c.err)}</div>` : ''}`;
    if (!s) return `${head}${status}${est}${btns}`;
    const chips = (v) => (arr(v).length ? `<div class="lf-chips wrap">${v.map(x => `<span class="lf-chip">${esc(x)}</span>`).join('')}</div>` : '');
    const person = (p) => `<details class="lf-more"><summary><b>${esc(A.shortName(p.name))}</b> — ${esc(A.cut(p.who, 90))}</summary><div class="lf-cx-p">
        ${p.arc ? `<p>${esc(p.arc)}</p>` : ''}${[['Черты', p.traits], ['Любит', p.likes], ['Не любит', p.dislikes], ['Привычки', p.habits], ['Страхи', p.fears], ['Успокаивает', p.soothes], ['Ранит', p.wounds], ['О себе', p.beliefs]].filter(x => x[1].length).map(([l, v]) => `<small>${l}</small>${chips(v)}`).join('')}
        ${p.now ? `<p><small>Сейчас</small> ${esc(p.now)}</p>` : ''}</div></details>`;
    const pair = (p) => `<details class="lf-more"><summary><b>${esc(A.shortName(p.a))} × ${esc(A.shortName(p.b))}</b>${p.kind ? ` — ${esc(p.kind)}` : ''}${p.love_ab || p.love_ba ? ` · любовь ${p.love_ab} / ${p.love_ba}` : ''}</summary><div class="lf-cx-p"><p>${esc(p.story)}</p>${p.marks.length ? `<small>Вехи</small>${chips(p.marks)}` : ''}${p.rituals.length ? `<small>Своё</small>${chips(p.rituals)}` : ''}</div></details>`;
    return `${head}${status}${est}${btns}
        ${A.sec('История целиком')}<div class="lf-cx-story">${esc(s.story)}</div>
        ${s.acts.length ? `${A.sec('Периоды')}<div class="lf-list">${s.acts.map(a => `<div class="lf-row"><span><b>${esc(a.t)}</b>${a.from ? ` <small>${esc(a.from)}${a.to && a.to !== a.from ? ` — ${esc(a.to)}` : ''}</small>` : ''}<br>${esc(a.sum)}</span></div>`).join('')}</div>` : ''}
        ${s.people.length ? `${A.sec('Люди', String(s.people.length))}${s.people.map(person).join('')}` : ''}
        ${s.pairs.length ? `${A.sec('Пары', String(s.pairs.length))}${s.pairs.map(pair).join('')}<div class="lf-hint">«Любовь» из свода ставится в «Отношения» только там, где её ещё никто не ставил; запертое и поставленное руками не трогается.</div>` : ''}
        ${s.threads.length ? `${A.sec('Незакрытое')}${chips(s.threads)}` : ''}`;
}

export async function codexClick(act) {
    if (act === 'cx-stop') { if (run) { run.stop = true; run.what = 'останавливаюсь после этого куска…'; A.render(); } return true; }
    if (act === 'cx-new') { build('new'); return true; }
    if (act === 'cx-sum') { build('sum'); return true; }
    if (act === 'cx-all') { if (globalThis.confirm?.('Стереть выписки и свод и прочитать всю историю заново? Это снова будет стоить денег.') ?? true) build('all'); return true; }
    return false;
}

// для проверки без Таверны
export const _test = { posts, chunks, pending, cleanPart, cleanSum, partText, applyLove, build: (m) => build(m), M };
