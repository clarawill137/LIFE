// Фиксы вместо реролла. «✎ править» под ответом — всё про правку поста в одном месте, с подписями:
//  • абзац (тап по нему в тексте): жёстче / мягче / короче / голосом (из банка реплик) / пусть промолчит / своё —
//    меняется только он; «отсюда заново» — с фразы, куда тапнула, и до конца переписать; «кадр здесь»;
//  • весь пост: «<персона> — моя» (убрать написанное за героиню), «+ бит», «из свайпов» (новым свайпом),
//    «плашки» (починить разметку, текст не трогая), «что записал пост», «вернуть» — как было до последней правки;
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
    if (!m || m.is_user || m.is_system || !A.settings().enabled) { old?.remove(); return; }
    const open = on.has(id);
    const u = M().undo[id];
    const sel = pick?.mes === id ? pick : null;
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
                </div>` : '<div class="lf-fix-hint">Тапни абзац в тексте — появятся правки абзаца, «отсюда заново» и кадр в этом месте.</div>'}
            </div>
            <div class="lf-fix-sec">
                <div class="lf-fix-h">Весь пост</div>
                <input type="text" class="lf-fix-in beat" placeholder="подсказка для «+ бит» (необязательно)">
                <div class="lf-fix-grid">
                    ${row('fx-mine', id, `${U} — моя`, `убрать всё, что модель написала за ${U}`)}
                    ${row('fx-beat', id, '+ бит', 'дописать абзац в конец, по подсказке или сам')}
                    ${(m.swipes || []).length > 1 ? row('fx-merge', id, 'Из свайпов', 'собрать из абзацев разных вариантов') : ''}
                    ${row('fx-mark', id, 'Плашки', 'починить разметку GC, текст не трогать')}
                    ${A.recsSheet ? row('fx-recs', id, 'Что записал пост', 'что Life взяла из поста — убрать лишнее') : ''}
                    ${u ? row('fx-undo', id, '↩ Вернуть', `как было до «${esc(u.label)}»`) : ''}
                </div>
            </div>
        </div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) { markParas(el, open, id); return; }
    const typed = old?.querySelector('.lf-fix-in:not(.beat)')?.value;
    const typedBeat = old?.querySelector('.lf-fix-in.beat')?.value;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    if (typed && node.querySelector('.lf-fix-in:not(.beat)')) node.querySelector('.lf-fix-in:not(.beat)').value = typed;
    if (typedBeat && node.querySelector('.lf-fix-in.beat')) node.querySelector('.lf-fix-in.beat').value = typedBeat;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
    markParas(el, open, id);
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
        case 'fx-open': if (on.has(i)) { on.delete(i); if (pick?.mes === i) pick = null; } else on.add(i); A.paintSoon?.(); return true;
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
