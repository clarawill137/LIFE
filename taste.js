// Life — «Вкус»: чтобы первый ответ был хорошим и не приходилось рероллить.
//  · учится на игроке: причина реролла (и прицельный реролл), её правки постов → редакторские правила, ⭐ золотые посты — образцы;
//  · чинит сам, до неё: редактор после ответа (за игрока, штампы, правила) и контролёр (грубый провал → один прицельный реролл);
//  · перед ответом: чего каждый хочет сейчас, нити сцены, темп и стоп-точка, строчка OOC-пожелания над полем ввода.
// Ничего не режет «на всякий случай»: штампов — короткий список с переключателем на каждый, правки редактора — с ↩.

import { eraId } from './scope.js';

let A = null;
export function initTaste(api) {
    A = api;
    try {
        document.addEventListener('input', (ev) => { if (ev.target?.id === 'lf-ooc-in') oocSet(ev.target.value); }, true);
        document.addEventListener('focusin', (ev) => { if (ev.target?.id === 'send_textarea') paintOocBar(); }, true);
    } catch { /* без документа (тесты) */ }
}

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const user = () => A.canonName(A.ctx().name1) || 'игрок';
const U = () => A.shortName(user());

// ───────────── штампы ─────────────
// Коротко и только бесячее; всё включено с порога, каждый выключается своим переключателем.

const W = '[а-яё]*';
export const SLOP = [
    { id: 'air', t: 'воздух загустел / наэлектризовался', re: `воздух${W}\\s+(?:между\\s+ними\\s+)?(?:словно\\s+|будто\\s+|как\\s+будто\\s+)?(?:за|с)?густ${W}|воздух${W}\\s+(?:словно\\s+|будто\\s+)?(?:на)?электриз${W}|воздух${W}\\s+(?:за)?треща${W}`, on: true },
    { id: 'dark', t: 'что-то тёмное мелькнуло в глазах', re: `что-то\\s+(?:т[её]мн${W}|опасн${W}|хищн${W}|нечитаем${W}|первобытн${W})[^.!?]{0,40}(?:мелькну${W}|промелькну${W}|вспыхну${W}|шевельну${W})`, on: true },
    { id: 'breath', t: 'не заметил, что задержал дыхание', re: `(?:не\\s+(?:заметил${W}|знал${W}|осознавал${W}|понял${W})[^.!?]{0,30}(?:задерж${W}|затаил${W})\\s+дыхани${W}|выдохну${W}[^.!?]{0,40}не\\s+(?:зная|замечая|осознавая)[^.!?]{0,30}(?:задерж${W}|затаи${W}))`, on: true },
    { id: 'heart', t: 'сердце пропустило удар', re: `сердц${W}\\s+(?:пропусти${W}|сбил${W}\\s+с)\\s+(?:удар|ритм${W})`, on: true },
    { id: 'world', t: 'мир сузился до…', re: `(?:весь\\s+)?мир${W}\\s+(?:словно\\s+|будто\\s+)?(?:сузи${W}|сжа${W})\\s+до`, on: true },
    { id: 'ozone', t: 'запах озона', re: `(?:запах${W}|пахл${W}|пахну${W})\\s+озон${W}|озон${W}\\s+и\\s+`, on: true },
    { id: 'chop', t: 'рубленые предложения в одно слово («Сильно. Много.»)', chop: true, on: true },
    { id: 'chill', t: 'мурашки / холодок по спине', re: `по\\s+(?:спин${W}|позвоночник${W}|коже)\\s+(?:пробежа${W}|прош[её]л${W}|прокати${W})[^.!?]{0,20}(?:мурашк${W}|холод${W}|дрожь)|(?:мурашк${W}|холодок)\\s+(?:пробежа${W}|прош[её]л${W})\\s+по`, on: true },
    { id: 'smile', t: 'хищный взгляд / улыбка, «как хищник»', re: `хищн${W}\\s+(?:улыбк${W}|ухмылк${W}|усмешк${W}|оскал${W}|взгляд${W}|прищур${W}|блеск${W}|граци${W})|(?:улыбк${W}|ухмылк${W}|усмешк${W}|взгляд${W})[^.!?]{0,12}хищн${W}|(?:как|словно|будто|точно)\\s+(?:у\\s+)?хищник${W}|по-хищному|хищно\\s+(?:улыбну${W}|усмехну${W}|оскали${W}|прищури${W}|смотре${W}|посмотре${W}|гляде${W})`, on: true },
    { id: 'velvet', t: 'низкий бархатный голос', re: `бархатн${W}\\s+голос${W}|голос${W}[^.!?]{0,20}(?:как|словно|будто)\\s+(?:бархат${W}|грави${W})`, on: true },
    { id: 'time', t: 'время остановилось / замерло', re: `время\\s+(?:словно\\s+|будто\\s+|как\\s+будто\\s+)?(?:остановил${W}|замерл${W}|застыл${W})`, on: true },
    { id: 'notx', t: '«Это был не вопрос. Это было…»', re: `это\\s+был${W}\\s+не\\s+[^.!?]{2,40}[.!?]\\s+это\\s+был${W}`, on: true },
];

function T() {
    const s = A.settings();
    if (!s.taste || typeof s.taste !== 'object') s.taste = {};
    const t = s.taste;
    if (t.on === undefined) t.on = true;
    if (!t.auto || typeof t.auto !== 'object') t.auto = {};
    for (const [k, v] of Object.entries({ fix: true, reroll: true, slip: true, ooc: true })) if (t.auto[k] === undefined) t.auto[k] = v;
    if (!t.why || typeof t.why !== 'object') t.why = {};
    if (!Array.isArray(t.whyOwn)) t.whyOwn = [];
    if (!Array.isArray(t.rules)) t.rules = [];
    if (!Array.isArray(t.pairs)) t.pairs = [];
    if (!Array.isArray(t.gold)) t.gold = [];
    if (!t.slop || typeof t.slop !== 'object') t.slop = {};         // id → true/false (поверх on по умолчанию)
    if (!Array.isArray(t.slopOwn)) t.slopOwn = [];                 // [{ id, t }] — свои фразы
    if (!Array.isArray(t.slopSug)) t.slopSug = [];                 // предложения из её правок — ждут ✓
    if (t.tempo === undefined) t.tempo = 'auto';
    if (t.pulse === undefined) t.pulse = true;
    if (t.bar === undefined) t.bar = true;
    return t;
}
function CM() {
    const cm = A.chatMeta();
    if (!cm.taste || typeof cm.taste !== 'object') cm.taste = {};
    if (!cm.taste.polish || typeof cm.taste.polish !== 'object') cm.taste.polish = {};
    return cm.taste;
}
export const tasteOn = () => !!A && A.settings().enabled !== false && T().on !== false;

const reEsc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function slopList() {
    const t = T();
    const base = SLOP.map(x => ({ ...x, on: t.slop[x.id] ?? x.on }));
    const own = t.slopOwn.map(x => ({ id: x.id, t: x.t, re: reEsc(A.norm(x.t)).replace(/\s+/g, '\\s+'), on: t.slop[x.id] ?? true, own: true }));
    return [...base, ...own];
}

/** Тело поста без служебных блоков (Horae, свёрнутые блоки, мысли) — разметка остаётся, чтобы цитаты находились в тексте. */
export function bodyOf(mes) {
    return String(mes || '').replace(/<(horae\w*|details|think|thinking|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/\n{3,}/g, '\n\n').trim();
}

// подряд два и больше предложений в одно слово: «Сильно. Много.» (двусловные «Он кивнул.» — обычная проза, не трогаем)
const CHOP_RE = /((?:^|[.!?…]\s+)(?:[А-ЯЁA-Z][а-яёa-z-]{1,15}[.!?…]+\s*){2,})/g;
const isSpeech = (line) => /^\s*(?:[—–-]\s|[«"“„])/.test(line);
/** Штампы в тексте: [{ id, t, q }] — q — фраза как в посте. Рубленые — только в авторской речи, не в репликах. */
export function slopHits(text) {
    const out = [];
    const body = bodyOf(text);
    for (const s of slopList()) {
        if (!s.on) continue;
        if (s.chop) {
            for (const line of body.split(/\n+/)) {
                if (isSpeech(line)) continue;
                const plain = line.replace(/[*_]+/g, '');
                for (const m of plain.matchAll(CHOP_RE)) {
                    const q = m[1].replace(/^[.!?…]\s+/, '').trim();
                    if (q.split(/[.!?…]+/).filter(x => x.trim()).length >= 2 && !/[—«"]/.test(q)) out.push({ id: s.id, t: s.t, q });
                }
            }
            continue;
        }
        let re = null;
        try { re = new RegExp(`[^.!?…\\n]*(?:${s.re})[^.!?…\\n]*[.!?…]?`, 'gi'); } catch { continue; }
        for (const m of body.replace(/ё/g, 'е').matchAll(re)) {
            const q = body.slice(m.index, m.index + m[0].length).trim();   // та же позиция в исходном (ё → е длину не меняет)
            if (q) out.push({ id: s.id, t: s.t, q });
        }
    }
    return out.slice(0, 8);
}

// ───────────── 1. причина реролла ─────────────

export const REASONS = [
    ['ooc', 'не он', 'Персонаж вышел не собой: реплики и поведение не в характере. Держи его голос, манеру и сдержанность — как в карточке и его удачных репликах.'],
    ['gallop', 'галоп', 'Пост пробежал сцену: перескочил время, свернул момент. Медленнее: один момент, подробно, и остановись там, где нужна реакция игрока.'],
    ['god', 'за {U}', 'Пост писал действия, реплики, мысли или чувства за персонажа игрока. Ни слова за него — только свой персонаж и мир вокруг.'],
    ['water', 'вода', 'Много воды: описания ради описаний, повторы, красивости. Плотнее: действие, реплика, деталь по делу.'],
    ['deaf', 'не ответил', 'Пост не ответил на то, что сделал и сказал персонаж игрока. Сначала — реакция на его реплики, жесты и вопросы.'],
    ['flat', 'скучно', 'Пресно и предсказуемо: ничего не случилось. Дай инициативу, неожиданную, но в характере реакцию, живую деталь.'],
    ['long', 'длинно', 'Слишком длинно — вдвое короче.'],
    ['short', 'коротко', 'Слишком скупо — разверни: больше реплик, действий, деталей.'],
];
const reasonBy = (id) => REASONS.find(r => r[0] === id);
const speakerOf = (i) => A.canonName(A.chatArr()[i]?.name || '') || '';

/** Записать причину и запомнить её для следующей попытки. text — своё (для id 'own'). */
export function whySet(i, id, text = '', learn = true) {
    const m = A.chatArr()[i];
    if (!m || m.is_user) return false;
    const who = speakerOf(i);
    const t = T();
    const own = str(text).slice(0, 200);
    if (id === 'own') {
        if (!own) return false;
        const hit = t.whyOwn.find(x => x.who === who && A.norm(x.t) === A.norm(own));
        if (hit) hit.n++; else t.whyOwn.push({ who, t: own, n: 1 });
        if (t.whyOwn.length > 40) t.whyOwn.splice(0, t.whyOwn.length - 40);
    } else {
        if (!reasonBy(id)) return false;
        if (learn) {   // мнение контролёра в её статистику не идёт — только её собственные тапы
            const row = t.why[who] = t.why[who] || {};
            row[id] = (row[id] || 0) + 1;
        }
    }
    CM().why = { i, id, text: id === 'own' ? own : (own || ''), old: A.cut(A.plainText(bodyOf(m.mes)), 1100), at: Date.now() };
    A.saveSettings();
    A.saveMeta();
    return true;
}

/** Свайп последнего ответа «вправо» — новый вариант (как тап по стрелке). Стоит не на последнем варианте — долистать. */
function reroll() {
    try {
        const btn = document.querySelector('#chat .mes.last_mes .swipe_right');
        if (!btn) return false;
        const chat = A.chatArr();
        const m = chat[chat.length - 1];
        let tries = 0;
        const go = () => {
            if (A.genActive?.() || tries++ > 12) return;
            const more = Array.isArray(m?.swipes) && (m.swipe_id ?? 0) < m.swipes.length - 1;   // после клика покажется готовый вариант, а не новый
            btn.click();
            if (more) setTimeout(go, 1200);   // таверна листает с анимацией — не частить
        };
        go();
        return true;
    } catch { return false; }
}

function whyOnce(type) {
    const w = CM().why;
    if (!w || !['swipe', 'regenerate'].includes(type)) return '';
    if (w.i !== A.lastAiIndex() && w.i !== A.chatArr().length - 1) return '';
    const r = reasonBy(w.id);
    const what = w.id === 'own' ? w.text : `${r ? r[2].replaceAll('{U}', U()) : ''}${w.text ? ` (${w.text})` : ''}`;
    w.used = true;
    return `[Прошлый вариант этого ответа игроку не подошёл. Что не так: ${what}\nНапиши заново, иначе — не пересказывай и не правь старый вариант.${w.old ? `\nОтвергнутый вариант (так НЕ надо):\n«${w.old}»` : ''}]`;
}

function whyStanding(S) {
    const t = T();
    const row = Object.entries(t.why[S] || {}).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const own = t.whyOwn.filter(x => x.who === S && x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3);
    if (!row.length && !own.length) return '';
    const parts = [...row.map(([id]) => { const r = reasonBy(id); return r ? `«${r[1].replace('{U}', U())}» — ${r[2].replaceAll('{U}', U()).split('. ')[0].toLowerCase()}` : ''; }).filter(Boolean), ...own.map(x => x.t)];
    return `Игрок чаще всего отвергает ответы ${A.shortName(S)} из-за этого — не повторяй: ${parts.join('; ')}.`;
}

// ───────────── 2. учится на правках ─────────────

const snap = new Map();   // номер поста → текст, каким его видел Life (до правки игрока)
/** Life сам поменял текст (фикс, дописка) или пост только что пришёл — запомнить, каким он был. */
export function tasteSnap(i) { const m = A?.chatArr?.()[i]; if (m && !m.is_user) snap.set(i, m.mes); }

const paras = (t) => A.plainText(bodyOf(t)).split(/\n+|(?<=[.!?…»])\s{2,}/).map(x => x.trim()).filter(Boolean);
/** Что поменялось между версиями: только отличающиеся куски. null — правка мелкая (опечатка). */
export function diffPair(before, after) {
    const a = paras(before), b = paras(after);
    const sb = new Set(b.map(A.norm)), sa = new Set(a.map(A.norm));
    const cutA = a.filter(x => !sb.has(A.norm(x))), newB = b.filter(x => !sa.has(A.norm(x)));
    const da = cutA.join('\n'), db = newB.join('\n');
    if (!da && !db) return null;
    // опечатка или запятая: изменённая сердцевина (без общего начала и конца) — меньше дюжины знаков
    let p = 0;
    while (p < da.length && p < db.length && da[p] === db[p]) p++;
    let q = 0;
    while (q < da.length - p && q < db.length - p && da[da.length - 1 - q] === db[db.length - 1 - q]) q++;
    if (Math.max(da.length, db.length) - p - q < 12) return null;
    return { a: A.cut(da, 900), b: A.cut(db, 900) };
}

/** Игрок поправил пост модели руками. */
export function tasteEdited(i) {
    if (!tasteOn()) return false;
    const m = A.chatArr()[i];
    if (!m || m.is_user || m.is_system) return false;
    const old = snap.get(i);
    snap.set(i, m.mes);
    if (old == null || old === m.mes) return false;
    const d = diffPair(old, m.mes);
    if (!d) return false;
    const t = T();
    t.pairs.push({ who: speakerOf(i), ...d, at: Date.now() });
    if (t.pairs.length > 12) t.pairs.splice(0, t.pairs.length - 12);
    A.saveSettings();
    if (t.pairs.length >= 3) distill().catch(e => console.warn('[Life] вкус: правила из правок', e));
    return true;
}

const similar = (a, b) => { const x = A.norm(a), y = A.norm(b); return x === y || (x.length > 14 && (y.includes(x.slice(0, Math.floor(x.length * 0.7))) || x.includes(y.slice(0, Math.floor(y.length * 0.7))))); };

const DISTILL_SYSTEM = `Игрок ролевой игры правит руками посты модели. Даны пары «было → стало» (только изменённые куски). Выведи её редакторские правила — что она систематически убирает, сокращает, заменяет, добавляет. Только то, что видно в правках хотя бы дважды или очень явно; коротко, в повелительном наклонении, по-русски («Не писать внутренние монологи за …», «Реплики … — короче, без объяснений»).
Отдельно — slop: конкретные фразы-штампы, которые она вырезает (дословно, 2–6 слов), если такие есть.
Уже известные правила не повторяй. Ответь только JSON: {"rules":["до 5 новых правил"],"slop":["до 3 фраз"]}.`;

let distilling = false;
export async function distill() {
    const t = T();
    if (distilling || !t.pairs.length) return 0;
    distilling = true;
    try {
        const pairs = t.pairs.slice();
        const j = await A.askJson([{ role: 'system', content: DISTILL_SYSTEM }, {
            role: 'user', content: [`Персонаж игрока: ${user()}.`, t.rules.length ? `Уже известные правила:\n${t.rules.map(r => `- ${r.t}`).join('\n')}` : '',
                `Правки:\n${pairs.map((p, k) => `#${k + 1} (${A.shortName(p.who)})\nБЫЛО: ${p.a || '—'}\nСТАЛО: ${p.b || '— (убрано)'}`).join('\n\n')}`].filter(Boolean).join('\n\n'),
        }], 1400, { what: 'Вкус', check: (x) => Array.isArray(x?.rules) });
        let n = 0;
        for (const r of arr(j.rules).map(str).filter(x => x.length > 8).slice(0, 5)) {
            if (t.rules.some(x => similar(x.t, r))) continue;
            t.rules.push({ id: A.uid(), t: r.slice(0, 180), src: 'edit', at: Date.now() });
            n++;
        }
        if (t.rules.length > 14) t.rules.splice(0, t.rules.length - 14);
        for (const s of arr(j.slop).map(str).filter(x => x.length > 4 && x.length < 60).slice(0, 3)) {
            if ([...t.slopOwn, ...t.slopSug].some(x => A.norm(x.t) === A.norm(s))) continue;
            t.slopSug.push({ id: A.uid(), t: s });
        }
        t.pairs = t.pairs.filter(p => !pairs.includes(p));
        A.saveSettings();
        if (n) { A.toast('info', `Новых правил из твоих правок: ${n} — Мир → Вкус`, '✦ Вкус', { timeOut: 4000 }); A.updatePrompt(); }
        return n;
    } finally { distilling = false; }
}

// ───────────── 3. золотые посты ─────────────

const goldMemo = new WeakMap();   // пост → его «отпечаток» (не считать на каждой перерисовке)
function goldId(m) {
    const c = goldMemo.get(m);
    if (c && c.mes === m.mes) return c;
    const text = A.plainText(bodyOf(m.mes)).slice(0, 1600);
    const r = { mes: m.mes, text, id: A.hash(text) };
    goldMemo.set(m, r);
    return r;
}
export function goldHas(i) { const m = A.chatArr()[i]; if (!m || m.is_user || !T().gold.length) return false; const id = goldId(m).id; return T().gold.some(g => g.id === id); }
export function goldToggle(i) {
    const m = A.chatArr()[i];
    if (!m || m.is_user) return false;
    const t = T();
    const { text, id } = goldId(m);
    const k = t.gold.findIndex(g => g.id === id);
    if (k >= 0) t.gold.splice(k, 1);
    else {
        t.gold.push({ id, who: speakerOf(i), era: eraId(), tag: A.modesOn?.()[0] || '', text, at: Date.now() });
        if (t.gold.length > 40) t.gold.splice(0, t.gold.length - 40);
    }
    A.saveSettings();
    A.updatePrompt();
    return k < 0;
}
function goldFor(S) {
    const all = T().gold.filter(g => !g.off && (!g.era || !eraId() || g.era === eraId()));
    let pool = all.filter(g => A.sameName(g.who, S));
    if (!pool.length) return [];
    const tag = A.modesOn?.()[0] || '';
    const same = pool.filter(g => g.tag === tag);
    if (same.length) pool = same;
    const k = Math.max(0, A.lastAiIndex()) % pool.length;
    return pool.length > 1 ? [pool[k], pool[(k + 1) % pool.length]] : [pool[0]];
}

// ───────────── 7 и 9. чего хотят и нити сцены (Летописец) ─────────────

const PULSE_RULE = `
want — чего хочет прямо сейчас каждый персонаж сцены, кроме персонажа игрока: [{"who":"имя","goal":"чего добивается в этой сцене, 3–9 слов","mood":"в каком состоянии, 1–3 слова","move":"что может сделать сам в следующий момент — в характере, 3–10 слов"}]. По посту, не выдумывая событий.
threads — нити сцены: висящие мелочи, о которых нельзя забыть (недопитый кофе, расстёгнутая рубашка, вопрос без ответа, брошенная фраза, вещь в руке): ["3–8 слов"]. Возьми прежние нити (даны ниже), убери закрытые в этом посте, добавь новые; всего до 5, самые живые.`;

function pulseAt(t = A.chatArr().length) {
    for (let i = t - 1; i >= 0 && i > t - 8; i--) {
        const m = A.chatArr()[i];
        if (m?.extra?.life?.location) break;   // смена сцены — прежние нити не тянуть
        const e = m && !m.is_user ? A.chronOf(i) : null;
        if (e && (e.want || e.threads)) return { want: arr(e.want), threads: arr(e.threads) };
    }
    return { want: [], threads: [] };
}

export function tasteChron(i) {
    if (!tasteOn() || !T().pulse || !A.hasChat()) return null;
    const p = pulseAt(i);
    return { key: '"want": [], "threads": []', rule: PULSE_RULE, tokens: 260, input: `Нити сцены до этого поста: ${p.threads.length ? p.threads.join('; ') : 'пока нет'}` };
}

export function tasteAfterPost(i, j) {
    if (!tasteOn()) return;
    const e = A.chronOf(i);
    if (e && T().pulse) {
        e.want = arr(j?.want).map(x => ({ who: A.canonName(str(x?.who)), goal: str(x?.goal).slice(0, 90), mood: str(x?.mood).slice(0, 40), move: str(x?.move).slice(0, 100) }))
            .filter(x => x.who && x.goal && !A.sameName(x.who, user())).slice(0, 4);
        e.threads = arr(j?.threads).map(x => str(x).slice(0, 80)).filter(Boolean).slice(0, 5);
        A.saveMeta();
    }
    // готовые правки ляп-фикса и «не он» — сами (у каждой своя отмена в её чипе)
    const chat = A.chatArr();
    if (i < chat.length - 3 || CM().polish[pkey(i)]?.off) return;
    (async () => {
        try { if (T().auto.slip) await A.slipAuto?.(i); } catch (err) { console.warn('[Life] вкус: ляп-фикс сам', err); }
        try { if (T().auto.ooc) await A.oocAuto?.(i); } catch (err) { console.warn('[Life] вкус: «не он» сам', err); }
        A.paintSoon?.();
    })();
}

// ───────────── 8. темп, стоп-точка и строчка OOC ─────────────

const TEMPO = { auto: 'сам по её посту', slow: 'медленно', norm: 'ровно', fast: 'быстрее', off: 'не трогать' };
function tempoLine() {
    const mode = T().tempo;
    if (mode === 'off') return '';
    const chat = A.chatArr();
    let L = 0;
    for (let i = chat.length - 1; i >= 0 && i > chat.length - 6; i--) if (chat[i]?.is_user) { L = A.plainText(chat[i].mes).length; break; }
    const stop = `Закончи на том, что требует реакции ${U()}, — не закрывай сцену и не решай за неё.`;
    if (mode === 'slow') return `Темп: медленно. Один момент сцены, подробно — жест, взгляд, реплика; время не перескакивает. ${stop}`;
    if (mode === 'fast') return `Темп: живее. Можно сдвинуть сцену вперёд на шаг, без долгих описаний. ${stop}`;
    if (mode === 'norm' || !L) return `Темп: один-два момента сцены, без перескока времени. ${stop}`;
    const n = Math.round(Math.max(500, Math.min(2400, L * 1.4)) / 100) * 100;
    return `Темп: пост игрока — около ${Math.round(L / 50) * 50 || 50} знаков; ответ — соразмерный, ориентир ~${n} знаков текста (плашки не в счёт), ${L < 350 ? 'один момент сцены' : 'один-два момента сцены'}, время не перескакивает. ${stop}`;
}

export function oocGet() { return CM().ooc || { text: '', sticky: false }; }
export function oocSet(text, sticky) {
    const cm = CM();
    const cur = cm.ooc || { text: '', sticky: false };
    cm.ooc = { text: String(text ?? cur.text).slice(0, 300), sticky: sticky ?? cur.sticky, after: A.lastAiIndex() };
    A.saveMeta();
    A.updatePrompt?.();
}
const OOC_QUICK = ['медленнее', 'нежнее', 'жёстче', 'больше шуток', 'больше диалога', 'короче', 'подробнее', 'больше инициативы от него'];

/** Строчка над полем ввода: пожелание к следующему ответу — вместо [OOC: …] в конце поста. */
export function paintOocBar() {
    let form = null;
    try { form = document.getElementById('form_sheld'); } catch { return; }
    let bar = document.getElementById('lf-ooc');
    if (!form || !tasteOn() || !T().bar || !A.hasChat?.()) { bar?.remove(); return; }
    const o = oocGet();
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'lf-ooc';
        bar.addEventListener('pointerdown', (ev) => { if (ev.target.closest('button')) ev.preventDefault(); });
        bar.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-oc]');
            if (!b) return;
            ev.preventDefault(); ev.stopPropagation();
            const cur = oocGet();
            if (b.dataset.oc === 'open') { bar.classList.toggle('open'); if (bar.classList.contains('open')) bar.querySelector('input')?.focus(); return; }
            if (b.dataset.oc === 'pin') oocSet(cur.text, !cur.sticky);
            else if (b.dataset.oc === 'x') oocSet('', false);
            else if (b.dataset.oc === 'q') oocSet([cur.text, b.dataset.v].filter(Boolean).join(', '));
            paintOocBar();
        });
        form.prepend(bar);
    } else if (bar.parentElement !== form) form.prepend(bar);
    const sig = `${o.text}|${o.sticky}`;
    if (bar.dataset.sig === sig) return;
    const focused = document.activeElement?.id === 'lf-ooc-in';
    bar.dataset.sig = sig;
    bar.classList.toggle('has', !!o.text);
    if (focused) { bar.querySelector('[data-oc="pin"]')?.classList.toggle('on', !!o.sticky); return; }   // печатает — поле не трогать
    bar.innerHTML = `<button class="lf-ooc-pill" data-oc="open" title="Пожелание к следующему ответу (OOC)">✎ ${o.text ? esc(A.cut(o.text, 40)) : 'пожелание к ответу'}${o.sticky ? ' 📌' : ''}</button>
        <div class="lf-ooc-body"><div class="lf-ooc-row"><input id="lf-ooc-in" type="text" placeholder="медленнее, нежнее, больше шуток…" value="${esc(o.text)}" autocomplete="off">
        <button data-oc="pin" class="${o.sticky ? 'on' : ''}" title="держать, пока не сниму">📌</button><button data-oc="x" title="стереть">✕</button></div>
        <div class="lf-ooc-quick">${OOC_QUICK.map(q => `<button data-oc="q" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>`;
}

/** Генерация кончилась: разовое (пожелание без 📌, причина реролла) — снять. */
export function tasteGenEnd() {
    if (!A?.hasChat?.()) return;
    const cm = CM();
    let ch = false;
    if (cm.ooc?.text && !cm.ooc.sticky && A.lastAiIndex() > (cm.ooc.after ?? -1)) { cm.ooc = { text: '', sticky: false }; ch = true; }
    if (cm.why?.used) { delete cm.why; ch = true; }
    if (ch) { A.saveMeta(); try { const b = document.getElementById('lf-ooc'); if (b) b.dataset.sig = ''; paintOocBar(); } catch { /* */ } }
}

// ───────────── что уходит модели ─────────────

/** Постоянное: правила, частые причины, штампы, образцы, чего хотят, нити, темп. */
export function tastePrompt(type) {
    if (!tasteOn() || !A.hasChat() || type === 'quiet' || type === 'impersonate') return '';
    const t = T();
    const S = A.canonName(A.ctx().name2 || '') || '';
    const out = [];
    const rules = t.rules.filter(r => !r.off).map(r => r.t);
    if (rules.length) out.push(`Редакторские правила игрока (так она правит твои посты — пиши сразу так):\n${rules.map(r => `- ${r}`).join('\n')}`);
    if (S) { const w = whyStanding(S); if (w) out.push(w); }
    const slop = slopList().filter(s => s.on).map(s => s.t);
    if (slop.length) out.push(`Без штампов: ${slop.join('; ')}.`);
    if (t.pulse) {
        const p = pulseAt();
        const want = p.want.filter(x => !S || A.ctx().groupId == null || A.sameName(x.who, S) || p.want.length <= 2);
        if (want.length) out.push(`Сейчас в сцене: ${want.map(x => `${A.shortName(x.who)} — хочет: ${x.goal}${x.mood ? ` (${x.mood})` : ''}${x.move ? `; может сам: ${x.move}` : ''}`).join(' · ')}. Это ориентир, а не сценарий: веди персонажа от его желания, с инициативой.`);
        if (p.threads.length) out.push(`Нити сцены (не теряй; одну-две вплети к месту, не все сразу): ${p.threads.join('; ')}.`);
    }
    if (S) {
        const gold = goldFor(S);
        if (gold.length) out.push(`Образцы — посты ${A.shortName(S)}, которые игроку понравились. Слова и ситуации не копируй — держи этот уровень, ритм и манеру:\n${gold.map(g => `«${g.text}»`).join('\n—\n')}`);
    }
    const tempo = tempoLine();
    if (tempo) out.push(tempo);
    return out.join('\n');
}

/** Разовое, в самый конец промпта: причина реролла и пожелание игрока. */
export function tasteOnce(type) {
    if (!tasteOn() || !A.hasChat() || type === 'quiet' || type === 'impersonate') return '';
    const out = [];
    const w = whyOnce(type);
    if (w) out.push(w);
    const o = oocGet();
    if (o.text) out.push(`[Пожелание игрока к этому ответу (OOC, вне истории — выполни, но в тексте не упоминай): ${o.text}]`);
    return out.join('\n');
}

// ───────────── 4 и 5. редактор и контролёр ─────────────

const pkey = (i) => `${i}:${A.chatArr()[i]?.swipe_id ?? 0}`;
const busy = new Set();

const EDIT_SYSTEM = (S, P) => `Ты — редактор ответа в ролевой игре. ${S} — персонаж модели, ${P} — персонаж игрока. Дан пост игрока и ответ модели. Найди в ответе только это и верни минимальные правки:
1) god — ответ пишет за ${P}: её/его действия, реплики, мысли, чувства, решения, которых нет в посте игрока. Перепиши фразу через то, что видит и делает ${S}, или убери ("fix":""). То, что ${P} уже сделал(а) в своём посте, можно упоминать.
2) slop — штампы из списка ниже (если список дан): замени простым конкретным словом или действием; рубленые предложения в одно слово слей в нормальную фразу.
3) rule — явные нарушения правил игрока (если даны).
Больше НИЧЕГО не трогай: смысл, события, реплики, стиль, разметку (*…*, теги). Не улучшай то, что не сломано; сомневаешься — не правь. До 6 правок; чисто — "fixes":[].
Отдельно оцени ответ целиком — grave: "gallop" — перескочил время, свернул или закрыл сцену, не оставив места реакции игрока; "deaf" — не ответил на главное из поста игрока; "god" — за игрока написано много (больше трети ответа); иначе "". Ставь grave только когда провал грубый и очевидный.
Ответь только JSON: {"fixes":[{"q":"точная цитата из ответа, слово в слово, как есть","fix":"чем заменить","kind":"god|slop|rule"}],"grave":"","why":"если grave — одной фразой, что именно не так"}`;

/**
 * Редактор: сразу после ответа. Вернёт { fixed, grave, why, rerolled }.
 * Правки — точечные, по цитате; исходные фразы лежат в чате (↩ под постом). Грубый провал — один прицельный реролл на её пост.
 */
export async function polish(i, type = 'normal') {
    const res = { fixed: 0, grave: '', why: '', rerolled: false };
    if (!tasteOn() || !A.hasChat() || type === 'impersonate' || type === 'quiet') return res;
    const t = T();
    if (!t.auto.fix && !t.auto.reroll) return res;
    const chat = A.chatArr();
    const m = chat[i];
    if (!m || m.is_user || m.is_system || i !== chat.length - 1) return res;
    const key = pkey(i);
    const cm = CM();
    if (busy.has(key) || cm.polish[key]) return res;
    const body = bodyOf(m.mes);
    if (body.length < 120) return res;
    busy.add(key);
    A.paintSoon?.();
    try {
        let u = -1;
        for (let k = i - 1; k >= 0 && k > i - 8; k--) if (chat[k]?.is_user) { u = k; break; }
        const S = speakerOf(i) || 'персонаж', P = user();
        const hits = slopHits(m.mes);
        const rules = t.rules.filter(r => !r.off).map(r => r.t);
        const j = await A.askJson([{ role: 'system', content: EDIT_SYSTEM(S, P) }, {
            role: 'user', content: [u >= 0 ? `Пост игрока (${P}):\n${A.cut(A.plainText(chat[u].mes), 1800)}` : 'Поста игрока перед ответом нет.',
                hits.length ? `Штампы, найденные в ответе:\n${hits.map(h => `- «${h.q}» (${h.t})`).join('\n')}` : '',
                rules.length ? `Правила игрока:\n${rules.map(r => `- ${r}`).join('\n')}` : '',
                `Ответ модели (${S}):\n${A.cut(body, 9000)}`].filter(Boolean).join('\n\n'),
        }], 1800, { what: 'Редактор', check: (x) => Array.isArray(x?.fixes) });
        if (A.chatArr()[i] !== m || pkey(i) !== key || A.chatArr().length - 1 !== i) return res;   // свайпнула или уже ответила
        const grave = ['gallop', 'deaf', 'god'].includes(str(j.grave)) ? str(j.grave) : '';
        const why = str(j.why).slice(0, 200);
        res.grave = grave; res.why = why;
        // контролёр: грубый провал — один прицельный реролл на её пост
        if (grave && t.auto.reroll && cm.autoRe !== u && !A.genActive?.()) {
            cm.autoRe = u;
            cm.polish[key] = { list: [], grave, why, rerolled: true };
            whySet(i, grave, why, false);
            A.saveMeta();
            if (reroll()) {
                res.rerolled = true;
                A.toast('info', `Перегенерирую сама: ${esc(reasonBy(grave)[1].replace('{U}', U()))}${why ? ` — ${esc(why)}` : ''}`, '✦ Контролёр', { timeOut: 5000 });
                return res;
            }
        }
        const list = [];
        if (t.auto.fix) {
            let text = m.mes;
            for (const f of arr(j.fixes).slice(0, 6)) {
                const q = str(f?.q), fix = typeof f?.fix === 'string' ? f.fix.trim() : null;
                if (q.length < 4 || fix == null || fix === q) continue;
                const hit = A.locate(text, q);
                if (!hit?.exact || !text.includes(hit.from)) continue;
                const to = fix || '';
                text = text.replace(hit.from, to);
                list.push({ from: hit.from, to, kind: ['god', 'slop', 'rule'].includes(str(f?.kind)) ? str(f.kind) : 'rule' });
            }
            if (list.length) {
                text = text.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?…])/g, '$1').replace(/\n{3,}/g, '\n\n');
                const ok = await A.setMesText(i, text);
                if (!ok) list.length = 0;
            }
        }
        CM().polish[pkey(i)] = { list, grave, why };
        res.fixed = list.length;
        A.saveMeta();
        return res;
    } catch (e) {
        console.warn('[Life] вкус: редактор', e);
        return res;
    } finally {
        busy.delete(key);
        A.paintSoon?.();
    }
}

/** Вернуть, как было до редактора (и больше этот пост сам не трогать). */
async function polishUndo(i) {
    const m = A.chatArr()[i];
    const rec = CM().polish[pkey(i)];
    if (!m || !rec?.list?.length) return false;
    let text = m.mes;
    for (const f of [...rec.list].reverse()) {
        if (f.to && text.includes(f.to)) text = text.replace(f.to, f.from);
        else if (!f.to) text = `${text}\n${f.from}`;   // убранное без следа — вернуть в конец, она поставит на место
    }
    await A.setMesText(i, text);
    CM().polish[pkey(i)] = { list: [], off: true, undone: rec.list.length };
    A.saveMeta();
    return true;
}

// ───────────── под постом ─────────────

const open = new Set();
const KIND = { god: 'за игрока', slop: 'штамп', rule: 'правило' };

export function paintTaste(el, id) {
    const old = el.querySelector(':scope .lf-taste');
    const chat = A.chatArr();
    const m = chat[id];
    if (!m || m.is_user || m.is_system || !tasteOn()) { old?.remove(); return; }
    if (snap.get(id) == null) snap.set(id, m.mes);
    const last = id === chat.length - 1;
    const rec = CM().polish[pkey(id)];
    const gold = goldHas(id);
    const isBusy = busy.has(pkey(id));
    if (!last && !gold && !rec?.list?.length && !(rec?.grave && !rec.rerolled)) { old?.remove(); return; }
    const isOpen = open.has(id);
    const rows = [];
    if (isBusy) rows.push('<span class="lf-taste-note">✨ редактор смотрит…</span>');
    if (rec?.list?.length) rows.push(`<span class="lf-taste-note">✨ причесано: ${rec.list.length} <button data-act="ts-what" data-mes="${id}">что</button><button data-act="ts-undo" data-mes="${id}">↩ вернуть</button></span>`);
    if (rec?.grave && !rec.rerolled) rows.push(`<span class="lf-taste-note warn">⚠ ${esc(reasonBy(rec.grave)?.[1].replace('{U}', U()) || rec.grave)}${rec.why ? `: ${esc(rec.why)}` : ''} <button class="main" data-act="ts-why" data-mes="${id}" data-id="${rec.grave}">↻ переписать с этим</button></span>`);
    if (isOpen && rec?.list?.length) rows.push(`<div class="lf-taste-diff">${rec.list.map(f => `<div><i>${KIND[f.kind] || ''}</i><s>${esc(A.cut(f.from, 220))}</s>${f.to ? `<ins>${esc(A.cut(f.to, 220))}</ins>` : '<ins>— убрано —</ins>'}</div>`).join('')}</div>`);
    if (last) rows.push(`<span class="lf-taste-why"><b>↻ не то:</b>${REASONS.map(([rid, l]) => `<button data-act="ts-why" data-mes="${id}" data-id="${rid}">${esc(l.replace('{U}', U()))}</button>`).join('')}<button data-act="ts-own" data-mes="${id}">своё…</button></span>`);
    if (last && open.has(`own${id}`)) rows.push(`<span class="lf-taste-own"><input type="text" class="lf-taste-in" placeholder="что не так — своими словами"><button class="main" data-act="ts-why" data-mes="${id}" data-id="own">↻ переписать</button></span>`);
    const html = `<div class="lf-taste lf-own">${rows.join('')}<button class="lf-taste-gold${gold ? ' on' : ''}" data-act="ts-gold" data-mes="${id}" title="${gold ? 'образец — убрать' : 'нравится — в образцы для модели'}">${gold ? '★' : '☆'}</button></div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    if (old?.querySelector('.lf-taste-in') && old.contains(document.activeElement)) return;   // печатает причину
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    host.append(node);
}

// ───────────── клики ─────────────

export async function tasteClick(act, el) {
    if (!act.startsWith('ts-')) return false;
    const i = Number(el.dataset.mes);
    const t = T();
    const done = () => { A.saveSettings(); A.updatePrompt(); A.render?.(); return true; };
    switch (act) {
        case 'ts-why': {
            let text = '';
            if (el.dataset.id === 'own') text = el.closest('.lf-taste')?.querySelector('.lf-taste-in')?.value || '';
            else if (CM().polish[pkey(i)]?.grave === el.dataset.id) text = CM().polish[pkey(i)].why || '';
            if (!whySet(i, el.dataset.id, text)) { A.toast('warning', 'Напиши, что не так', '✦ Вкус', { timeOut: 2000 }); return true; }
            open.delete(`own${i}`);
            if (!reroll()) A.toast('info', 'Причину запомнила — свайпни ответ, она уйдёт в новую попытку', '✦ Вкус', { timeOut: 3500 });
            return true;
        }
        case 'ts-own': { const k = `own${i}`; if (open.has(k)) open.delete(k); else open.add(k); A.paintSoon?.(); return true; }
        case 'ts-gold': { const on = goldToggle(i); A.toast('success', on ? 'В образцы — модель будет равняться' : 'Убрала из образцов', '✦ Вкус', { timeOut: 1800 }); A.paintSoon?.(); return true; }
        case 'ts-what': if (open.has(i)) open.delete(i); else open.add(i); A.paintSoon?.(); return true;
        case 'ts-undo': await polishUndo(i); open.delete(i); A.toast('info', 'Вернула как было — этот пост больше не трогаю', '✦ Вкус', { timeOut: 2500 }); A.paintSoon?.(); return true;
        // страница «Вкус»
        case 'ts-auto': t.auto[el.dataset.k] = !t.auto[el.dataset.k]; return done();
        case 'ts-set': t[el.dataset.k] = !t[el.dataset.k]; if (el.dataset.k === 'bar') paintOocBar(); return done();
        case 'ts-tempo': t.tempo = el.dataset.v; return done();
        case 'ts-slop': { const s = slopList().find(x => x.id === el.dataset.id); if (s) t.slop[s.id] = !s.on; return done(); }
        case 'ts-slop-del': t.slopOwn = t.slopOwn.filter(x => x.id !== el.dataset.id); delete t.slop[el.dataset.id]; return done();
        case 'ts-slop-add': {
            const v = str(el.closest('.lf-field')?.querySelector('[data-in="ts-slop"]')?.value);
            if (v.length < 4) return true;
            if (!t.slopOwn.some(x => A.norm(x.t) === A.norm(v))) t.slopOwn.push({ id: A.uid(), t: v.slice(0, 60) });
            return done();
        }
        case 'ts-sug-ok': { const s = t.slopSug.find(x => x.id === el.dataset.id); if (s) { t.slopOwn.push(s); t.slopSug = t.slopSug.filter(x => x !== s); } return done(); }
        case 'ts-sug-no': t.slopSug = t.slopSug.filter(x => x.id !== el.dataset.id); return done();
        case 'ts-rule-del': t.rules = t.rules.filter(x => x.id !== el.dataset.id); return done();
        case 'ts-rule-off': { const r = t.rules.find(x => x.id === el.dataset.id); if (r) r.off = !r.off; return done(); }
        case 'ts-rule-add': {
            const v = str(el.closest('.lf-field')?.querySelector('[data-in="ts-rule"]')?.value);
            if (v.length < 6) return true;
            t.rules.push({ id: A.uid(), t: v.slice(0, 180), src: 'me', at: Date.now() });
            return done();
        }
        case 'ts-distill': {
            let n = 0;
            await A.withBusy(el, async () => { try { n = await distill(); } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Вкус', { timeOut: 4000 }); } }, 'Смотрю правки…');
            if (!n) A.toast('info', 'Новых правил в правках не увидела', '✦ Вкус', { timeOut: 2500 });
            return done();
        }
        case 'ts-gold-del': t.gold = t.gold.filter(g => g.id !== el.dataset.id); return done();
        case 'ts-gold-tag': { const g = t.gold.find(x => x.id === el.dataset.id); if (g) g.tag = g.tag === el.dataset.v ? '' : el.dataset.v; return done(); }
        case 'ts-why-reset': delete t.why[el.dataset.name]; t.whyOwn = t.whyOwn.filter(x => x.who !== el.dataset.name); return done();
    }
    return true;
}

// ───────────── страница: Мир → Вкус ─────────────

export function tasteHtml() {
    const t = T();
    const sw = (act, k, on, label, hint = '') => `<button class="lf-row${on ? ' on' : ''}" data-act="${act}" data-k="${k}"><span><b>${on ? '◉' : '○'} ${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></button>`;
    const modes = arr(A.modeList?.());
    const whyRows = Object.entries(t.why).filter(([, r]) => Object.keys(r).length).map(([who, r]) => {
        const own = t.whyOwn.filter(x => x.who === who);
        return `<div class="lf-taste-card"><b>${esc(A.shortName(who))}</b><span>${Object.entries(r).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${esc(reasonBy(id)?.[1].replace('{U}', U()) || id)} ×${n}`).join(' · ')}${own.length ? ` · ${own.map(x => `«${esc(x.t)}»${x.n > 1 ? ` ×${x.n}` : ''}`).join(' · ')}` : ''}</span><button data-act="ts-why-reset" data-name="${esc(who)}">сбросить</button></div>`;
    }).join('');
    return `<div class="lf-taste-page">
        <div class="lf-hint">Чтобы первый ответ был годным: Life учится на твоих рероллах, правках и ⭐, сам чинит мелочи до того, как ты дочитаешь, и подсказывает модели темп и желания персонажей.</div>
        ${A.sec('Чинит сам', 'сразу после ответа')}
        ${sw('ts-auto', 'fix', t.auto.fix, 'Редактор', `убирает написанное за ${esc(U())}, включённые штампы и нарушения твоих правил — точечно, под постом «что» и ↩`)}
        ${sw('ts-auto', 'reroll', t.auto.reroll, 'Контролёр', 'грубый провал (галоп, не ответил, пол-поста за тебя) — один прицельный реролл сам; дальше только подскажет')}
        ${sw('ts-auto', 'slip', t.auto.slip, 'Ляпы — сам', 'готовые правки ляп-фикса применяются без тапа (отмена — в его чипе)')}
        ${sw('ts-auto', 'ooc', t.auto.ooc, '«Не он» — сам', 'реплики не в характере переписываются его голосом без тапа')}
        ${A.sec('Перед ответом')}
        ${sw('ts-set', 'pulse', t.pulse, 'Чего хотят и нити сцены', 'Летописец ведёт цель и инициативу каждого и висящие мелочи сцены')}
        ${sw('ts-set', 'bar', t.bar, 'Строчка «пожелание к ответу»', 'над полем ввода: медленнее, нежнее, больше шуток — вместо [OOC] в посте; 📌 — держать')}
        <div class="lf-field"><label>Темп и стоп-точка</label><div class="lf-chips wrap">${Object.entries(TEMPO).map(([k, l]) => `<button class="lf-chip${t.tempo === k ? ' on' : ''}" data-act="ts-tempo" data-v="${k}">${l}</button>`).join('')}</div></div>
        ${A.sec('Твои правила', t.pairs.length ? `правок ждёт разбора: ${t.pairs.length}` : 'из твоих правок постов')}
        ${t.rules.length ? t.rules.map(r => `<div class="lf-taste-card${r.off ? ' off' : ''}"><span>${esc(r.t)}${r.src === 'edit' ? ' <i>из правок</i>' : ''}</span><button data-act="ts-rule-off" data-id="${r.id}">${r.off ? 'вкл' : 'выкл'}</button><button data-act="ts-rule-del" data-id="${r.id}">✕</button></div>`).join('') : '<div class="lf-hint">Поправь пост модели руками три раза — выведу правила сама. Или впиши своё.</div>'}
        <div class="lf-field"><div class="lf-inline"><input type="text" data-in="ts-rule" placeholder="своё правило: «не описывать погоду»"><button class="lf-btn" data-act="ts-rule-add">${A.icon('plus')}</button></div></div>
        ${t.pairs.length ? `<button class="lf-btn ghost full" data-act="ts-distill">${A.icon('sparkles')} Разобрать правки сейчас (${t.pairs.length})</button>` : ''}
        ${A.sec('Почему рероллишь', 'три раза одно и то же — модель предупреждена')}
        ${whyRows || '<div class="lf-hint">Под последним ответом — «↻ не то: …»: тап по причине сам перегенерирует с ней.</div>'}
        ${A.sec('Золотые посты', `${t.gold.length} — образцы для модели`)}
        ${t.gold.length ? [...t.gold].reverse().map(g => `<div class="lf-taste-gold-card"><div><b>${esc(A.shortName(g.who))}</b>${g.era ? ` <i>${esc(g.era)}</i>` : ''}<button data-act="ts-gold-del" data-id="${g.id}">✕</button></div><q>${esc(A.cut(g.text, 220))}</q>
            ${modes.length ? `<div class="lf-chips wrap">${modes.map(([id, l]) => `<button class="lf-chip${g.tag === id ? ' on' : ''}" data-act="ts-gold-tag" data-id="${g.id}" data-v="${id}">${l}</button>`).join('')}</div>` : ''}</div>`).join('') : '<div class="lf-hint">☆ под ответом, который зашёл, — и модель получает его образцом (под режим сцены, по кругу).</div>'}
        ${A.sec('Штампы', 'тап — выключить, если это для тебя классика')}
        <div class="lf-chips wrap">${slopList().map(s => `<button class="lf-chip${s.on ? ' on' : ''}" data-act="ts-slop" data-id="${s.id}">${esc(s.t)}</button>${s.own ? `<button class="lf-chip x" data-act="ts-slop-del" data-id="${s.id}">✕</button>` : ''}`).join('')}</div>
        ${t.slopSug.length ? `<div class="lf-hint">Ты это вырезаешь — в штампы?</div>${t.slopSug.map(s => `<div class="lf-taste-card"><span>«${esc(s.t)}»</span><button data-act="ts-sug-ok" data-id="${s.id}">да</button><button data-act="ts-sug-no" data-id="${s.id}">нет</button></div>`).join('')}` : ''}
        <div class="lf-field"><div class="lf-inline"><input type="text" data-in="ts-slop" placeholder="своя бесячая фраза"><button class="lf-btn" data-act="ts-slop-add">${A.icon('plus')}</button></div></div>
    </div>`;
}
