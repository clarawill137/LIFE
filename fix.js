// Фиксы вместо реролла. «✎» под ответом — режим правки поста:
//  • тап по абзацу — жёстче / мягче / короче / по-баковски (из банка реплик) / пусть промолчит / своё — меняется только он;
//  • «Из свайпов» — собрать пост из абзацев разных свайпов, стыки сглажены (новым свайпом, старые целы);
//  • «Хеди — моя» — убрать всё, что модель написала за героиню, переписав через его восприятие;
//  • «Ещё бит» — дописать один абзац в конец (по подсказке);
//  • «Плашки» — починить сломанную разметку (незакрытые блоки, картинка без тега, кривые кавычки в инструкции SLAY), текст не трогая;
//  • «Вернуть» — как было до последней правки.
// Правит дешёвая модель Летописца — дешевле реролла и не трогает удачное.

import { setMesText } from './mend.js';
import { linesOf } from './voice.js';

let A = null;
export function initFix(api) { A = api; }

const esc = (v) => A.esc(v);
const on = new Set();            // посты в режиме правки
const busy = new Set();
let pick = null;                 // { mes, line } — выбранный абзац
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

const RULES = (who) => `Ты редактор длинной литературной ролевой на русском. Сохраняй факты, имена, время, место, стиль и разметку поста (*курсив*, «кавычки», тире диалогов). Не пиши за ${who}: её слова, действия, мысли и ощущения — только её посты.`;

async function ask(system, input, tokens = 900) {
    const out = await A.askModel([{ role: 'system', content: system }, { role: 'user', content: input }], tokens);
    return String(out || '').replace(/^```\w*\n?|```$/g, '').trim();
}

const HOWS = {
    hard: ['жёстче', 'Сделай абзац жёстче и резче: меньше смягчений и нежности в словах, короче фразы, больше напора — но в характере говорящего.'],
    soft: ['мягче', 'Сделай абзац мягче и теплее: бережнее слова и жесты, больше заботы — без сахара и без смены смысла.'],
    short: ['короче', 'Сократи абзац примерно вдвое: оставь главное действие и лучшую реплику, убери воду и повторы.'],
    voice: ['по-баковски', ''],
    quiet: ['промолчит', ''],
    own: ['своё…', ''],
};

function speakerOf(i) { return A.chatArr()[i]?.name || ''; }

async function rewriteLine(i, line, how, custom = '') {
    const m = A.chatArr()[i];
    if (!m || !String(m.mes).includes(line)) throw new Error('абзац уже поменялся — тапни заново');
    const who = A.canonName(speakerOf(i));
    let task = HOWS[how]?.[1] || '';
    if (how === 'voice') {
        const vs = linesOf(who).slice(-6).map(x => `«${x.t}»`).join(' ');
        task = `Перепиши реплики и интонацию так, чтобы это звучало как ${who} в его лучшие моменты${vs ? ` — вот его голос (образцы ритма и словаря, не вставляй их дословно): ${vs}` : ''}. Действия и смысл — те же.`;
    }
    if (how === 'quiet') task = `Пусть ${A.shortName(who)} здесь промолчит: убери его реплику(и) из абзаца, вместо слов — молчание, взгляд, жест, действие; смысл можно передать без слов.`;
    if (how === 'own') task = `Что поправить: ${custom}`;
    const ctxText = A.cut(A.plainText ? A.plainText(m.mes) : plain(m.mes), 3500);
    const out = await ask(`${RULES(user())}\nПерепиши ТОЛЬКО один абзац по указанию. Длина — примерно та же, если не сказано иначе. Ответь только новым абзацем, без пояснений и кавычек вокруг.`,
        `Пост целиком (для контекста):\n${ctxText}\n\nАбзац, который надо переписать:\n${line}\n\nУказание: ${task}`, 700);
    const nl = out.split('\n').map(x => x.trim()).filter(Boolean).join(' ');
    if (!nl || nl.length < 2) throw new Error('модель вернула пустоту');
    const lead = line.match(/^\s*/)[0];
    await apply(i, String(m.mes).replace(line, () => lead + nl), `абзац: ${HOWS[how]?.[0] || 'своё'}`);
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

// ───────────── в чате ─────────────

export function paintFix(el, id) {
    const m = A.chatArr()[id];
    const old = el.querySelector(':scope .lf-fix');
    if (!m || m.is_user || m.is_system || !A.settings().enabled) { old?.remove(); return; }
    const open = on.has(id);
    const hasUndo = !!M().undo[id];
    const sel = pick?.mes === id ? pick : null;
    const html = !open
        ? `<div class="lf-fix lf-own"><button class="lf-fix-btn" data-act="fx-open" data-mes="${id}" title="поправить пост">✎</button></div>`
        : `<div class="lf-fix lf-own open${busy.has(id) ? ' busy' : ''}">
            <div class="lf-fix-row">
                <span class="lf-fix-h">${busy.has(id) ? 'правлю…' : sel ? 'абзац выбран' : 'тапни абзац в тексте'}</span>
                ${(m.swipes || []).length > 1 ? `<button data-act="fx-merge" data-mes="${id}">из свайпов</button>` : ''}
                <button data-act="fx-mine" data-mes="${id}">${esc(A.shortName(user()))} — моя</button>
                <button data-act="fx-beat" data-mes="${id}">+ бит</button>
                <button data-act="fx-mark" data-mes="${id}">плашки</button>
                ${hasUndo ? `<button data-act="fx-undo" data-mes="${id}">↩ вернуть</button>` : ''}
                <button data-act="fx-open" data-mes="${id}">✕</button>
            </div>
            ${sel ? `<div class="lf-fix-sel"><q>${esc(A.cut(plain(sel.line), 160))}</q>
                <div class="lf-fix-row">${Object.entries(HOWS).filter(([k]) => k !== 'own').map(([k, [l]]) => `<button data-act="fx-p" data-mes="${id}" data-how="${k}">${l}</button>`).join('')}</div>
                <div class="lf-fix-own"><input type="text" class="lf-fix-in" placeholder="своё: что поправить в абзаце"><button data-act="fx-p" data-mes="${id}" data-how="own">✓</button></div>
            </div>` : ''}
            ${sel === null && open ? `<div class="lf-fix-own"><input type="text" class="lf-fix-in beat" placeholder="+ бит: что должно случиться (необязательно)"></div>` : ''}
        </div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) { markParas(el, open); return; }
    const typed = old?.querySelector('.lf-fix-in')?.value;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    if (typed && node.querySelector('.lf-fix-in')) node.querySelector('.lf-fix-in').value = typed;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
    markParas(el, open);
}

function markParas(el, open) {
    el.querySelectorAll('.mes_text > p, .mes_text > blockquote').forEach(p => p.classList.toggle('lf-fix-p', open));
    el.classList.toggle('lf-fixing', open);
}

/** Тап по абзацу в режиме правки (из onChatClick, до остальных). true — тап наш. */
export function fixTap(ev) {
    const mesEl = ev.target.closest?.('#chat .mes.lf-fixing');
    if (!mesEl) return false;
    const p = ev.target.closest('.mes_text > p, .mes_text > blockquote');
    if (!p) return false;
    const i = Number(mesEl.getAttribute('mesid'));
    const m = A.chatArr()[i];
    const line = matchLine(m?.mes, tappedText(p, ev));
    if (!line) { A.toast('info', 'Не нашла этот кусок в тексте поста — тапни по обычному абзацу', '✎', { timeOut: 2200 }); return true; }
    ev.preventDefault();
    ev.stopPropagation();
    pick = { mes: i, line };
    A.paintSoon?.();
    return true;
}

export async function fixClick(act, el) {
    if (!act.startsWith('fx-')) return false;
    const i = Number(el.dataset.mes);
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
        case 'fx-p': {
            const sel = pick?.mes === i ? pick : null;
            if (!sel) return true;
            const custom = el.parentElement?.querySelector('.lf-fix-in')?.value?.trim() || '';
            if (el.dataset.how === 'own' && !custom) { A.toast('info', 'Напиши, что поправить'); return true; }
            await run(async () => { await rewriteLine(i, sel.line, el.dataset.how, custom); pick = null; });
            return true;
        }
        case 'fx-mine': await run(() => mine(i), `${A.shortName(user())} — снова твоя`); return true;
        case 'fx-beat': { const hint = el.closest('.lf-fix')?.querySelector('.lf-fix-in.beat')?.value?.trim() || ''; await run(() => beat(i, hint), 'Дописала бит'); return true; }
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
