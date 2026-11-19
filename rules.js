// Правила сцены. Свои правила «когда в сцене вот такое → играй вот так» (идея — «Автозаметки» для ST; код свой).
// Правила общие на все чаты: у каждого — кого касается и в каких эпохах живёт (ядро «Священный таймлайн»).
// Перед ответом дешёвая модель сверяет условия с твоим постом — тем же запросом, что «Не пропусти»
// (ни лишнего вызова, ни лишнего ожидания; выключено «Не пропусти» — спросит отдельно) — и называет повод.
// Модели уходит твой текст подсказки как есть и повод, в самом конце промпта. Свайп и реролл — без нового запроса.
// Под твоим постом — чипы сработавших правил (тап — не в этот раз). «Собрать из лорбука» — стартовый набор.
// Это не «Твои правила» из «Вкуса»: те про то, как писать всегда, эти — про ситуацию.

import { inEra, eraId } from './scope.js';
import { loreFor, cardText } from './lore.js';
import { userIndexFor } from './reply.js';

let A = null;
export function initRules(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const SKIP = ['quiet', 'impersonate', 'continue'];
const PRIO = [[3, 'важное'], [2, 'обычное'], [1, 'фон']];
const TITLE = '✦ Правила сцены';
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const U = () => A.shortName(userName());
const short = (n) => A.shortName(A.canonName(n) || n);
const prioOf = (r) => ([1, 2, 3].includes(Number(r?.prio)) ? Number(r.prio) : 2);

function cfg() {
    const s = A.settings();
    if (!s.rules || typeof s.rules !== 'object') s.rules = {};
    const c = s.rules;
    if (c.on === undefined) c.on = true;
    if (![1, 2, 3, 4].includes(c.max)) c.max = 2;
    if (!Array.isArray(c.list)) c.list = [];
    return c;
}
export const rulesOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.rules || typeof cm.rules !== 'object') cm.rules = {};
    if (!cm.rules.hits || typeof cm.rules.hits !== 'object') cm.rules.hits = {};
    return cm.rules;
}

/** Условие правила: «когда срабатывает», а если пусто — сама подсказка. */
const condOf = (r) => str(r?.when) || str(r?.hint);
const nameOf = (r) => str(r?.name) || A.cut(condOf(r), 42);
/** Что сейчас сверяется: включённые правила с подсказкой, видимые в эпохе этого чата. */
function active() { return cfg().list.filter(r => r && !r.off && str(r.hint) && inEra(r)).slice(0, 60); }
const sigOf = (act) => A.hash(act.map(r => `${r.id}:${condOf(r)}`).join('|'));
const keyOf = (i) => { const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}` : ''; };
const tail = (t, n) => { t = String(t ?? ''); return t.length > n ? `…${t.slice(t.length - n + 1).trimStart()}` : t; };

function lastUserIndex() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) { const m = chat[i]; if (m && m.is_user && !m.is_system) return i; }
    return -1;
}

function eraLabel() {
    try { const e = globalThis.SacredTimeline?.context?.()?.era; return str(e?.name) || str(e?.title) || str(e?.label) || String(e?.id || ''); } catch { return ''; }
}

// ───────────── сверка с постом ─────────────

const HOW = 'Отметь правила, для которых в ЭТОМ посте игрока (с учётом конца предыдущего поста) есть конкретный повод прямо сейчас — по смыслу, а не по совпадению слов. Похожая тема без самого повода не считается; сомневаешься — не бери. Пометки в /…/, ((…)), [OOC] поводом не считаются.';
const ITEM = '{"n":номер правила,"why":"что именно в посте стало поводом, 4–12 слов"}';
const SYS_JOIN = `\nЕщё rules. В конце дан список «Правила сцены»: у каждого номер и условие — когда оно к месту. ${HOW} Каждое — ${ITEM}; ничего не подошло — []. Поле rules добавь в тот же JSON: {"items":[…],"choice":null,"rules":[]}`;
const SYS_ALONE = `Ты помощник рассказчика в литературной ролевой на русском. Тебе дают пост игрока, для контекста конец предыдущего поста, и список «Правила сцены»: у каждого номер и условие — когда оно к месту.
${HOW}
Ответь только JSON: {"rules":[${ITEM}]}. Ничего не подошло — {"rules":[]}.`;

const listText = (act) => `Правила сцены:\n${act.map((r, k) => `${k + 1}) ${A.cut(condOf(r), 260)}`).join('\n')}`;
const tokensFor = (act) => 60 + 90 * Math.min(act.length, 4);

function postInput(u) {
    const chat = A.chatArr();
    const text = A.plainText(chat[u]?.mes || '').trim();
    let prev = '';
    for (let j = u - 1; j >= 0 && !prev; j--) if (chat[j] && !chat[j].is_system && !chat[j].is_user) prev = tail(A.plainText(chat[j].mes).trim(), 700);
    return [`Игрок пишет за: ${userName()}`, prev ? `Конец предыдущего поста:\n${prev}` : '', `Пост игрока:\n${A.cut(text, 4000)}`].filter(Boolean).join('\n\n');
}

const waiting = new Map(); // ключ поста → { p, at, joined }: сверка идёт (joined — общим запросом с «Не пропусти»)
let lastErr = '';

function claim(key, joined = false) {
    let done = () => {};
    const p = new Promise(r => { done = r; });
    waiting.set(key, { p, at: Date.now(), joined });
    return () => { if (waiting.get(key)?.p === p) waiting.delete(key); done(); };
}

/** Записать, что подошло к посту. raw — [{ n, why }] из ответа модели (n — номер в списке act). */
function store(key, sig, act, raw) {
    const m = M();
    const old = m.hits[key];
    const list = [];
    for (const x of Array.isArray(raw) ? raw : []) {
        const n = Number(x && typeof x === 'object' ? (x.n ?? x.id) : x);
        const r = Number.isInteger(n) ? act[n - 1] : null;
        if (!r || list.some(h => h.id === r.id)) continue;
        list.push({ id: r.id, why: str(x?.why).slice(0, 140) });
    }
    // счёт срабатываний — раз на пост: пересверка того же поста его не накручивает
    const counted = new Set(Array.isArray(old?.cnt) ? old.cnt : []);
    let touched = false;
    for (const h of list) {
        if (counted.has(h.id)) continue;
        counted.add(h.id);
        const r = cfg().list.find(x => x.id === h.id);
        if (r) { r.n = (Number(r.n) || 0) + 1; r.last = Date.now(); touched = true; }
    }
    m.hits[key] = { sig, list, off: old?.off && typeof old.off === 'object' ? old.off : {}, cnt: [...counted], at: Date.now() };
    // держать только последние 40 сверок
    const keys = Object.keys(m.hits).sort((a, b) => parseInt(a) - parseInt(b));
    for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete m.hits[k];
    lastErr = '';
    A.saveMeta();
    if (touched) A.saveSettings();
    A.paintSoon?.();
}

/**
 * «Не пропусти» собирает свой запрос по посту u — дописать в него правила. Возвращает { system, input, tokens, take(j) }
 * или null (правил нет, пост уже сверён, сверка уже идёт). take зовётся всегда: с разобранным JSON или с null.
 */
export function rulesJoin(u) {
    try {
        if (!rulesOn() || !A.hasChat()) return null;
        const act = active();
        const key = keyOf(u);
        if (!act.length || !key) return null;
        const sig = sigOf(act);
        if (M().hits[key]?.sig === sig || waiting.has(key)) return null;
        const release = claim(key, true);
        const cm = A.chatMeta();
        let taken = false;
        return {
            system: SYS_JOIN,
            input: listText(act),
            tokens: tokensFor(act),
            take: (j) => {
                if (taken) return;
                taken = true;
                // модель пропустила поле — не записываем: rulesReady спросит отдельно
                try { if (Array.isArray(j?.rules) && A.chatMeta() === cm) store(key, sig, act, j.rules); } catch (e) { console.warn('[Life] правила сцены', e); }
                release();
            },
        };
    } catch (e) { console.warn('[Life] правила сцены', e); return null; }
}

/** Отдельный запрос (когда «Не пропусти» выключено, пост у него уже разобран или он вернулся без правил). */
function ask(u, key, sig, act) {
    const release = claim(key);
    const p = waiting.get(key).p;
    const cm = A.chatMeta();
    (async () => {
        try {
            const out = await A.askModel([{ role: 'system', content: SYS_ALONE }, { role: 'user', content: `${postInput(u)}\n\n${listText(act)}` }], 400 + tokensFor(act));
            const j = A.extractJson(out);
            if (A.chatMeta() === cm) store(key, sig, act, Array.isArray(j?.rules) ? j.rules : []);
        } catch (e) { console.warn('[Life] правила сцены', e); lastErr = String(e?.message || e); }
        release();
    })();
    return p;
}

/** Начать сверку поста u, если ещё не сверен. Промис сверки или null (нечего сверять / уже сверен). */
export function rulesWarm(u, force = false) {
    if (!rulesOn() || !A.hasChat() || !(u >= 0)) return null;
    const m = A.chatArr()[u];
    if (!m?.is_user || m.is_system) return null;
    const act = active();
    const key = keyOf(u);
    if (!act.length || !key) return null;
    const sig = sigOf(act);
    if (waiting.has(key)) return waiting.get(key).p;
    if (!force && M().hits[key]?.sig === sig) return null;
    if (!A.plainText(m.mes || '').trim()) return null;
    return ask(u, key, sig, act);
}

/** Перед генерацией: дождаться сверки (не дольше, чем ждёт «Не пропусти»). */
export async function rulesReady(type) {
    if (!rulesOn() || !A.hasChat() || SKIP.includes(type)) return;
    const u = userIndexFor(type);
    if (u < 0) return;
    const key = keyOf(u);
    const had = waiting.get(key);
    const p = rulesWarm(u);
    if (!p) return;
    const wait = Math.max(0, Math.min(20, Number(A.settings().reply?.wait) || 8)) * 1000;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    // общий с «Не пропусти» запрос уже ждали в replyReady — добираем только остаток
    await Promise.race([p, sleep(had ? Math.max(1000, wait - (Date.now() - had.at)) : wait)]);
    // общий запрос вернулся без правил — один раз спросить отдельно
    if (had?.joined && !waiting.has(key)) { const p2 = rulesWarm(u); if (p2) await Promise.race([p2, sleep(wait)]); }
}

// ───────────── что уходит модели ─────────────

function speaker() {
    const S = str(A.ctx().name2);
    return S && !NARR.test(S) ? (A.canonName(S) || S) : '';
}

/** Сработавшие правила для того, кто сейчас пишет: по приоритету, не больше max. */
function pick(rec) {
    const c = cfg();
    const S = speaker();
    return (rec?.list || []).map(h => ({ r: c.list.find(x => x.id === h.id), why: h.why }))
        .filter(({ r }) => r && !r.off && str(r.hint) && inEra(r) && !rec.off?.[r.id] && (!str(r.who) || !S || A.sameName(r.who, S)))
        .sort((a, b) => prioOf(b.r) - prioOf(a.r) || c.list.indexOf(a.r) - c.list.indexOf(b.r))
        .slice(0, c.max);
}

/** Заметка в самый конец промпта: правила, для которых в посте игрока нашёлся повод. */
export function rulesPrompt(type) {
    if (!rulesOn() || !A.hasChat() || SKIP.includes(type)) return '';
    const u = userIndexFor(type);
    if (u < 0) return '';
    const rec = M().hits[keyOf(u)];
    if (!rec?.list?.length) return '';
    const got = pick(rec);
    if (!got.length) return '';
    const S = speaker();
    const macro = (t) => { try { return String(A.ctx().substituteParams?.(t) ?? t); } catch { return t; } };
    const rows = got.map(({ r, why }) => `• ${str(r.who) && !S ? `${short(r.who)}: ` : ''}${macro(str(r.hint))}${why ? ` (повод: ${why})` : ''}`);
    return `[Правила сцены — сейчас к месту (в скобках — повод из поста ${U()}). Сыграй это в ответе по-своему и в характере, не списком; сами правила не цитируй и не упоминай:\n${rows.join('\n')}]`;
}

// ───────────── чипы под постом игрока ─────────────

export function paintRules(el, id) {
    const old = el.querySelector(':scope .lf-rules');
    const m = A.chatArr()[id];
    const key = keyOf(id);
    const rec = rulesOn() && m?.is_user ? M().hits[key] : null;
    const c = cfg();
    const rows = (rec?.list || []).map(h => ({ h, r: c.list.find(x => x.id === h.id) })).filter(x => x.r);
    if (!rows.length) { old?.remove(); return; }
    const html = `<div class="lf-rules lf-own">${A.icon('target')}${rows.map(({ h, r }) => `<button class="lf-rules-i${rec.off?.[r.id] || r.off ? ' off' : ''}" data-act="rl-tog" data-key="${esc(key)}" data-id="${esc(r.id)}" title="${rec.off?.[r.id] ? 'вернуть' : 'не в этот раз'}">${esc(nameOf(r))}${h.why ? ` <i>· ${esc(A.cut(h.why, 70))}</i>` : ''}</button>`).join('')}</div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .lf-reply') || host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

/** Что записал твой пост i: какие правила сработали. */
export function rulesRecs(i) {
    if (!rulesOn()) return [];
    const rec = M().hits[keyOf(i)];
    const c = cfg();
    return (rec?.list || []).filter(h => !rec.off?.[h.id]).map(h => ({ h, r: c.list.find(x => x.id === h.id) })).filter(x => x.r).map(({ h, r }) => ({
        id: `rl:${r.id}`, g: 'Правила сцены', icon: 'target', t: `${nameOf(r)}${h.why ? ` — ${h.why}` : ''}`,
        del: () => { rec.off[r.id] = true; },
    }));
}

// ───────────── из лорбука ─────────────

const SYS_LORE = (u) => `По записям лорбука и карточке персонажа литературной ролевой составь ПРАВИЛА СЦЕНЫ для него — пары «когда → как он себя ведёт». Их будут подсказывать модели, которая пишет за него, только в тот момент, когда в сцене случился повод.
when — конкретный повод, который видно по посту игрока: что делает, говорит или переживает ${u} либо что происходит вокруг («${u} плачет и отворачивается», «его благодарят или хвалят», «${u} рискует собой у него на глазах», «речь заходит о его прошлом»). Одна ситуация на правило, 6–20 слов.
hint — как он ведёт себя в этот момент: что делает, чего НЕ делает, как говорит; 1–2 предложения, 12–40 слов, конкретно и в его духе, без «может быть».
name — ярлык в 2–4 слова.
Бери только то, что есть в записях: реакции, защиты, манеру заботы и близости, поведение в ссоре, в опасности, при чужих. Не бери: черты без повода, микро-привычки и жесты, кодовые слова и травматические триггеры (их ведут отдельно), факты биографии. Ничего не выдумывай.
6–10 правил, самые характерные и про разные ситуации. Ответь только JSON: {"rules":[{"name":"…","when":"…","hint":"…"}]}`;

async function collect(who) {
    const lore = await loreFor(who, { max: 14000 });
    const card = cardText(who, 4000);
    if (!lore && !card) throw new Error('в лорбуках и карточке о нём ничего не нашлось');
    const input = [`Персонаж: ${A.canonName(who) || who}`, `Игрок пишет за: ${userName()}`, lore ? `Лорбук:\n${lore}` : '', card ? `Карточка:\n${card}` : ''].filter(Boolean).join('\n\n');
    const j = await A.askJson([{ role: 'system', content: SYS_LORE(U()) }, { role: 'user', content: input }], 1800, { check: (x) => Array.isArray(x?.rules), what: 'правила из лорбука' });
    const c = cfg();
    const norm = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '');
    const era = eraId();
    let n = 0;
    for (const x of j.rules.slice(0, 12)) {
        const when = str(x?.when).slice(0, 300);
        const hint = str(x?.hint).slice(0, 500);
        if (when.length < 8 || hint.length < 8 || c.list.some(r => norm(condOf(r)) === norm(when))) continue;
        c.list.push({ id: `r${A.uid()}`, name: str(x?.name).slice(0, 60), when, hint, prio: 2, who: A.canonName(who) || who, ...(era ? { eras: [era] } : {}), src: 'lore', at: Date.now() });
        n++;
    }
    A.saveSettings();
    return n;
}

// ───────────── вид ─────────────

function castList() {
    const me = A.ctx().name1;
    return (A.castNames?.() || []).filter(n => n && !A.sameName(n, me) && !NARR.test(n));
}

function editSheet(r) {
    const isNew = !r;
    const x = r || { name: '', when: '', hint: '', prio: 2, who: '' };
    const names = castList();
    if (str(x.who) && !names.some(n => A.sameName(n, x.who))) names.push(x.who);
    const era = eraId();
    const eras = Array.isArray(x.eras) ? x.eras.filter(Boolean) : [];
    const onlyHere = eras.length === 1 && eras[0] === era;
    const other = eras.length && !onlyHere;
    A.openSheet(`${A.icon('target')} ${isNew ? 'Новое правило' : 'Правило'}`, `
        <div class="lf-field"><label>Название</label><input type="text" data-in="rl-name" value="${esc(str(x.name))}" placeholder="коротко — для чипа под постом"></div>
        <div class="lf-field"><label>Когда срабатывает</label><textarea data-in="rl-when" rows="3" placeholder="${esc(U())} отшучивается, когда речь заходит о её самочувствии">${esc(str(x.when))}</textarea></div>
        <div class="lf-field"><label>Что подсказать модели</label><textarea data-in="rl-hint" rows="4" placeholder="Он не подыгрывает шутке и не давит вопросами: делает что-то заботливое руками и оставляет ей место договорить самой">${esc(str(x.hint))}</textarea></div>
        <div class="lf-field two">
            <div><label>Кого касается</label><select data-in="rl-who"><option value="">любого, кто отвечает</option>${names.map(n => `<option value="${esc(n)}" ${A.sameName(n, x.who) ? 'selected' : ''}>${esc(short(n))}</option>`).join('')}</select></div>
            <div><label>Приоритет</label><select data-in="rl-prio">${PRIO.map(([v, l]) => `<option value="${v}" ${prioOf(x) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        ${era ? `<div class="lf-field"><label>Эпоха</label><select data-in="rl-era">
            <option value="all" ${!eras.length ? 'selected' : ''}>везде</option>
            <option value="here" ${onlyHere ? 'selected' : ''}>только эта — ${esc(eraLabel())}</option>
            ${other ? `<option value="keep" selected>как было: ${esc(eras.join(', '))}</option>` : ''}
        </select></div>` : ''}
        <button class="lf-btn primary full" data-act="rl-save" data-id="${esc(x.id || '')}">${A.icon('check')} Записать</button>
        <div class="lf-hint">«Когда» — ситуация своими словами, чем конкретнее, тем точнее отбор. Пусто — сверяться будет по самой подсказке. Подсказка уходит модели как есть.</div>`);
}

function loreSheet() {
    const names = castList();
    if (!names.length) { A.toast('info', 'В этом чате нет персонажей', TITLE, { timeOut: 2500 }); return; }
    A.openSheet(`${A.icon('book')} Правила из лорбука`, `
        <div class="lf-hint">Летописец прочитает лорбуки и карточку персонажа и предложит 6–10 правил про его реакции. Они сразу включены — лишнее убери ✕, остальное поправь тапом.${eraId() ? ` Привяжутся к этой эпохе — ${esc(eraLabel())}.` : ''}</div>
        <div class="lf-chips wrap">${names.map(n => `<button class="lf-chip" data-act="rl-lore-go" data-name="${esc(n)}">${esc(short(n))}</button>`).join('')}</div>`);
}

function ruleCard(r) {
    const away = !inEra(r);
    const meta = [
        str(r.who) ? short(r.who) : '',
        Array.isArray(r.eras) && r.eras.length ? `эпоха: ${r.eras.join(', ')}` : '',
        r.src === 'lore' ? 'из лорбука' : '',
        Number(r.n) ? `сработало ×${Number(r.n)}` : '',
        away ? 'не в этой эпохе' : '',
        !str(r.hint) ? 'нет подсказки — не работает' : '',
    ].filter(Boolean).join(' · ');
    return `<div class="lf-rule${r.off ? ' off' : ''}${away ? ' away' : ''}">
        <button class="lf-rule-main" data-act="rl-edit" data-id="${esc(r.id)}">
            <b>${esc(nameOf(r))}<i class="lf-rule-p">${'●'.repeat(prioOf(r))}</i></b>
            ${str(r.when) ? `<span><em>когда</em>${esc(A.cut(str(r.when), 180))}</span>` : ''}
            <span><em>→</em>${esc(A.cut(str(r.hint), 220))}</span>
            ${meta ? `<small>${esc(meta)}</small>` : ''}
        </button>
        <div class="lf-rule-side"><button data-act="rl-off" data-id="${esc(r.id)}">${r.off ? 'вкл' : 'выкл'}</button><button data-act="rl-del" data-id="${esc(r.id)}">✕</button></div>
    </div>`;
}

/** Страница: Мир → Правила. */
export function rulesHtml() {
    const c = cfg();
    const act = active();
    const chat = A.hasChat();
    const u = chat ? lastUserIndex() : -1;
    const rec = u >= 0 ? M().hits[keyOf(u)] : null;
    const fired = (rec?.list || []).map(h => ({ h, r: c.list.find(x => x.id === h.id) })).filter(x => x.r);
    const last = !chat || u < 0 ? ''
        : !rec ? '<div class="lf-hint">Твой последний пост ещё не сверялся.</div>'
            : fired.length ? `<div class="lf-list">${fired.map(({ h, r }) => `<div class="lf-row${rec.off?.[r.id] ? ' off' : ''}">${A.icon('target')}<span><b>${esc(nameOf(r))}</b>${h.why ? ` — ${esc(h.why)}` : ''}${rec.off?.[r.id] ? ' <i>(снято)</i>' : ''}</span></div>`).join('')}</div>`
                : '<div class="lf-hint">К твоему последнему посту ни одно правило не подошло.</div>';
    return `<div class="lf-rules-page">
        <div class="lf-hint">Свои правила «когда в сцене вот такое → играй вот так». Перед ответом Летописец сверяет их с твоим постом (тем же запросом, что «Не пропусти») и подошедшие отдаёт модели вместе с поводом — в самом конце промпта. Правила общие на все чаты. «Твои правила» во «Вкусе» — про то, как писать всегда; эти — про ситуацию.</div>
        <button class="lf-row${c.on !== false ? ' on' : ''}" data-act="rl-on"><span><b>${c.on !== false ? '◉' : '○'} Правила сцены</b><small>${c.list.length ? `сверяется сейчас: ${act.length} из ${c.list.length}` : 'пока ни одного'}</small></span></button>
        <div class="lf-field"><label>Сколько правил за один ответ</label><div class="lf-chips wrap">${[1, 2, 3, 4].map(n => `<button class="lf-chip${c.max === n ? ' on' : ''}" data-act="rl-max" data-v="${n}">${n}</button>`).join('')}</div></div>
        ${A.sec('Правила', c.list.length ? String(c.list.length) : '')}
        ${c.list.length ? c.list.map(ruleCard).join('') : '<div class="lf-hint">Собери стартовый набор из психо-лорбука или впиши своё: «когда она врёт, что всё в порядке → он не разоблачает вслух, а…».</div>'}
        <div class="lf-actions"><button class="lf-btn" data-act="rl-new">${A.icon('plus')} Правило</button><button class="lf-btn" data-act="rl-lore">${A.icon('book')} Собрать из лорбука</button></div>
        ${chat && u >= 0 ? `${A.sec('Последняя сверка', rec ? 'твой последний пост' : '')}${last}
        ${lastErr ? `<div class="lf-hint">Летописец не ответил: ${esc(lastErr)}</div>` : ''}
        <button class="lf-btn ghost full" data-act="rl-test">${A.icon('refresh')} Сверить последний пост сейчас</button>` : ''}
    </div>`;
}

export async function rulesClick(act, el) {
    if (!act.startsWith('rl-')) return false;
    const c = cfg();
    const r = c.list.find(x => x.id === el.dataset.id) || null;
    const done = () => { A.saveSettings(); A.updatePrompt(); A.render?.(); A.paintSoon?.(); return true; };
    switch (act) {
        // чип под постом: не в этот раз / вернуть
        case 'rl-tog': {
            const rec = M().hits[el.dataset.key];
            if (!rec || !el.dataset.id) return true;
            if (!rec.off || typeof rec.off !== 'object') rec.off = {};
            if (rec.off[el.dataset.id]) delete rec.off[el.dataset.id]; else rec.off[el.dataset.id] = true;
            A.saveMeta();
            A.updatePrompt();
            A.paintSoon?.();
            return true;
        }
        case 'rl-on': c.on = c.on === false; return done();
        case 'rl-max': c.max = [1, 2, 3, 4].includes(Number(el.dataset.v)) ? Number(el.dataset.v) : 2; return done();
        case 'rl-off': if (r) r.off = !r.off; return done();
        case 'rl-del': {
            if (!r || !confirm(`Удалить правило «${nameOf(r)}»?`)) return true;
            c.list.splice(c.list.indexOf(r), 1);
            return done();
        }
        case 'rl-new': editSheet(null); return true;
        case 'rl-edit': if (r) editSheet(r); return true;
        case 'rl-save': {
            const box = el.closest('.lf-sheet') || document;
            const val = (k) => str(box.querySelector(`[data-in="${k}"]`)?.value);
            const when = val('rl-when').slice(0, 300);
            const hint = val('rl-hint').slice(0, 500);
            if (hint.length < 4) { A.toast('warning', 'Впиши, что подсказать модели', TITLE, { timeOut: 2200 }); return true; }
            const x = r || { id: `r${A.uid()}`, src: 'me', at: Date.now() };
            x.name = val('rl-name').slice(0, 60);
            x.when = when;
            x.hint = hint;
            x.who = val('rl-who');
            x.prio = [1, 2, 3].includes(Number(val('rl-prio'))) ? Number(val('rl-prio')) : 2;
            const era = val('rl-era');
            if (era === 'all') delete x.eras;
            else if (era === 'here' && eraId()) x.eras = [eraId()];
            if (!r) c.list.push(x);
            A.closeSheet();
            return done();
        }
        case 'rl-lore': loreSheet(); return true;
        case 'rl-lore-go': {
            const who = el.dataset.name;
            let n = -1;
            await A.withBusy(el, async () => {
                try { n = await collect(who); } catch (e) { A.toast('warning', esc(String(e?.message || e)), TITLE, { timeOut: 5000 }); }
            }, 'Читаю…');
            if (n < 0) return true;
            A.closeSheet();
            A.toast(n ? 'success' : 'info', n ? `Новых правил: ${n} — ${esc(short(who))}` : 'Новых правил не нашлось', TITLE, { timeOut: 2600 });
            return done();
        }
        case 'rl-test': {
            const u = A.hasChat() ? lastUserIndex() : -1;
            if (u < 0) { A.toast('info', 'В чате нет твоего поста', TITLE, { timeOut: 2200 }); return true; }
            if (!rulesOn()) { A.toast('info', 'Правила сцены выключены', TITLE, { timeOut: 2200 }); return true; }
            if (!active().length) { A.toast('info', 'Нет включённых правил для этой эпохи', TITLE, { timeOut: 2500 }); return true; }
            await A.withBusy(el, async () => { await rulesWarm(u, true); }, 'Сверяю…');
            A.updatePrompt();
            A.render?.();
            A.paintSoon?.();
            return true;
        }
    }
    return true;
}
