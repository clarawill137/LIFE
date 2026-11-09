// Дописать оборванный пост. Gemini (и раньше 3.1, и теперь Аргон) иногда рвёт ответ на самом хвосте —
// чаще всего посреди «Заметок автора», иногда на полуслове. Кнопка «Продолжить» в таверне тут не спасает:
// на неё ExtBlocks заново гоняет свои блоки, а напоминалка пресета перед обрывком требует шапку
// и полный пост. Поэтому Life дописывает сам, тихим запросом тем же подключением:
//   · оборвался свёрнутый блок (<details> без </details>) — огрызок срезается сразу, модель пишет блок заново;
//   · пост цел, но заметок нет, хотя в этом чате они всегда есть — модель пишет только заметки;
//   · оборвался на полуслове — модель продолжает с места обрыва (начиная с последних слов, чтобы шов сошёлся).
// Если не вышло — огрызок срезается (tidy), как раньше, а дописать можно ещё раз: /life fix.
// Чат сохраняется один раз, в конце починки (он ~40 МБ — каждое сохранение на айфоне ощутимо).

import { cutTail, tidyMessage, tidyHold } from './tidy.js';

let A = null;
let stoppedAt = 0;
const busy = new Set();
const tried = new Set();

const cfg = () => { const s = A.settings(); if (!s.mend || typeof s.mend !== 'object') s.mend = { on: true, tries: 2 }; return s.mend; };
const NOTES_RE = /<summary\b[^>]*>\s*Заметки автора/i;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const keyOf = (i, m) => `${i}:${String(m.mes).length}:${String(m.mes).slice(-120)}`;
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function initMend(api) {
    A = api;
    try {
        const { eventSource, eventTypes: E } = A.ctx();
        if (E.GENERATION_STOPPED) eventSource.on(E.GENERATION_STOPPED, () => { if (!busy.size) stoppedAt = Date.now(); });
    } catch (e) { console.warn('[Life] дописать: события', e); }
}

// ───────────── что с постом ─────────────

function summaryOf(tail) {
    const m = String(tail || '').match(/<summary\b[^>]*>([\s\S]*?)(?:<\/summary>|$)/i);
    return m ? m[1].replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}

/** Пост кончается на полуслове: последняя видимая буква — не точка, не восклицание, не закрытая кавычка. */
export function proseCut(text) {
    const s = String(text || '').replace(/\s+$/, '');
    if (!s || /[>`]$/.test(s)) return false;
    return /[\p{L}\p{N},;:(«„“‘\[–—-]$/u.test(s);
}

/**
 * Что не так с концом поста. null — всё цело.
 * kind: block — оборван свёрнутый блок (base — без огрызка, label — его заголовок);
 *       notes — цел, но нет заметок; prose — оборван на полуслове; trim — только мусорный обрывок тега.
 */
export function diagnose(text, { expectNotes = false } = {}) {
    let base = String(text || '').replace(/\s+$/, '');
    let partial = false;
    const pm = base.match(/<\/?[a-z][^<>]*$/i);
    if (pm) { base = base.slice(0, pm.index).replace(/\s+$/, ''); partial = true; }
    const ct = cutTail(base);
    if (ct) {
        const label = summaryOf(ct.tail);
        return { kind: 'block', base: ct.fixed, label, wasNotes: /Заметки автора/i.test(label) || (!label && expectNotes) };
    }
    if (proseCut(base)) return { kind: 'prose', base };
    const hasNotes = NOTES_RE.test(base);
    if (!hasNotes && (expectNotes || (partial && /^<details/i.test(pm[0])))) return { kind: 'notes', base };
    if (partial) return { kind: 'trim', base };
    return null;
}

/** В этом чате заметки автора — обычное дело (есть хотя бы в двух из последних постов). */
function expectsNotes(i) {
    const chat = A.ctx().chat || [];
    let seen = 0, n = 0;
    for (let j = i - 1; j >= 0 && n < 8; j--) {
        const m = chat[j];
        if (!m || m.is_user || m.is_system) continue;
        n++;
        if (NOTES_RE.test(String(m.mes || ''))) seen++;
    }
    return seen >= 2;
}

function check(i) {
    const m = A.ctx().chat?.[i];
    if (!m || m.is_user || m.is_system || typeof m.mes !== 'string' || m.extra?.type === 'comment') return null;
    if (String(m.mes).trim().length < 40) return null;
    const d = diagnose(m.mes, { expectNotes: expectsNotes(i) });
    // короткий ответ (OOC, реплика) без точки или без заметок — не обрыв
    if (d && (d.kind === 'prose' || d.kind === 'notes') && d.base.length < 400) return null;
    return d;
}

// ───────────── запрос ─────────────

function chidOf(m) {
    const c = A.ctx();
    const list = c.characters || [];
    let k = m.original_avatar ? list.findIndex(x => x.avatar === m.original_avatar) : -1;
    if (k < 0 && m.name) k = list.findIndex(x => x.name === m.name);
    if (k < 0 && !c.groupId && c.characterId != null) k = Number(c.characterId);
    return k >= 0 ? k : null;
}

const HEAD = '[TECHNICAL REPAIR — this is not a new reply. The reply-length, top-bar, «В сцене», image and art rules do not apply to it.';
const ONLY = 'Output nothing else: no prose, no top bar, no «В сцене», no image or art block, no comments before or after.]';

function promptFor(d, name, notes) {
    if (d.kind === 'block') {
        const what = d.label ? `the collapsed block «${d.label}»` : 'a collapsed block at its very end';
        const more = d.wasNotes ? '' : (notes ? ', then the «Заметки автора» block' : '');
        const blk = d.label ? `the «${d.label}» block written anew in full` : 'the closing collapsed block(s) that belong at the end of the reply (normally «Заметки автора»), each in full';
        return `${HEAD}\nThe provider cut off ${name}'s last reply above before it finished: it stopped in the middle of ${what}. Everything before that block is complete and stays as it is.\nWrite ONLY the missing end of that reply: ${blk}, from <details to </details>, in exactly the template from your instructions${more}. Base it on the reply above.\n${ONLY}`;
    }
    if (d.kind === 'notes') {
        return `${HEAD}\nThe provider cut off ${name}'s last reply above right before its closing «Заметки автора» block. The reply itself is complete and stays as it is.\nWrite ONLY that block, from <details to </details>, in exactly the template from your instructions, based on the reply above.\n${ONLY}`;
    }
    const base = d.base;
    const tail = base.slice(-320).replace(/^\S*\s/, '');
    const words = base.split(/\s+/).slice(-5).join(' ');
    return `${HEAD}\nThe provider cut off ${name}'s last reply above mid-sentence. It currently ends with:\n«…${tail}»\nContinue that reply from exactly where it stopped. Begin your output by repeating its last words verbatim («${words}»), then go straight on: finish the sentence and the scene in the same voice, tense and language — if it was cut early, write the rest of the scene; if it was nearly done, just close it${notes ? '; then end with the «Заметки автора» block as usual' : ''}.\nDo not restart, retell or repeat earlier parts; no top bar, no «В сцене», no image or art block; nothing before the continuation.]`;
}

async function ask(prompt, chid, tokens) {
    const c = A.ctx();
    if (typeof c.generateQuietPrompt !== 'function') throw new Error('в этой таверне нет тихих запросов');
    const out = await c.generateQuietPrompt({ quietPrompt: prompt, forceChId: chid, responseLength: tokens, removeReasoning: true });
    return String(out || '');
}

function clean(out, name) {
    let t = String(out || '');
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '');
    t = t.replace(/^\s*```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    const top = /<div\b[^>]*data-gc=["']top["'][\s\S]*?<\/div>/i.test(t);
    t = t.replace(/<div\b[^>]*data-gc=["']top["'][\s\S]*?<\/div>\s*/gi, '').replace(/<details\b[^>]*data-gc=["']scene["'][\s\S]*?<\/details>\s*/gi, '');
    if (name) t = t.replace(new RegExp(`^\\s*${escRe(name)}\\s*:\\s*`), '');
    return { text: t.replace(/^\s*\n/, '').replace(/\s+$/, ''), top };
}

function blocksOf(t) {
    const out = [];
    for (const m of String(t).matchAll(/<details\b[\s\S]*?<\/details>/gi)) if (!/^<details\b[^>]*data-gc=/i.test(m[0])) out.push(m[0]);
    return out;
}

/** Сшить обрывок с продолжением: модель повторила последние слова — шов по ним, иначе через пробел. */
export function stitch(base, cont) {
    const o = String(base).replace(/\s+$/, '');
    const c = String(cont).replace(/^\s+/, '');
    if (!c) return { text: o, seam: false };
    for (let k = Math.min(400, c.length, o.length); k >= 6; k--) if (o.endsWith(c.slice(0, k))) return { text: o + c.slice(k), seam: true };
    const words = o.split(/\s+/).filter(Boolean);
    const head = c.slice(0, 900);
    for (let n = Math.min(8, words.length); n >= 2; n--) {
        const anchor = words.slice(-n);
        if (anchor.join(' ').length < 10) continue;
        const re = new RegExp(anchor.map(escRe).join('\\s+'));
        const m = head.match(re);
        if (m) return { text: o + c.slice(m.index + m[0].length), seam: true };
    }
    const glue = /^[,.;:!?…»)\]]/.test(c) ? '' : /^\n/.test(cont.replace(/^[ \t]+/, '')) ? '\n\n' : ' ';
    return { text: o + glue + c, seam: false };
}

// ───────────── пост ─────────────

const rendered = (i) => !!document.querySelector(`#chat .mes[mesid="${i}"]`);

/** Для соседних модулей (ляп-фикс): заменить текст поста целиком и сохранить чат. */
export async function setMesText(i, text) {
    const m = A?.ctx?.().chat?.[i];
    if (!m || typeof text !== 'string' || !text.trim()) return false;
    const ok = await apply(i, m, text);
    if (ok) { try { await A.ctx().saveChat(); } catch (e) { console.warn('[Life] сохранить пост', e); } }
    return ok;
}

/** Поменять текст поста в памяти и на экране. Чат НЕ сохраняет — сохранение одно, в конце (чат ~40 МБ). */
async function apply(i, m, text) {
    const c = A.ctx();
    const old = m.mes;
    if (old === text) return false;
    m.mes = text;
    if (Array.isArray(m.swipes) && m.swipe_id != null && m.swipes[m.swipe_id] === old) m.swipes[m.swipe_id] = text;
    const dt = m.extra?.display_text;
    if (typeof dt === 'string') {
        if (dt.startsWith(old)) m.extra.display_text = text + dt.slice(old.length);
        else delete m.extra.display_text;
    }
    if (rendered(i)) { try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] дописать: перерисовать', e); } }
    try { A.rekeyMessage?.(i, old); } catch { /* */ }
    // ExtBlocks пересоберёт текст показа (пост + свои блоки)
    try { await c.eventSource.emit(c.eventTypes.MESSAGE_UPDATED, i); } catch { /* */ }
    return true;
}

function generating() {
    const stop = document.getElementById('mes_stop');
    return !!stop && getComputedStyle(stop).display !== 'none';
}

async function waitIdle(limitMs = 180000) {
    const t0 = Date.now();
    let calm = 0;
    while (Date.now() - t0 < limitMs) {
        if (generating()) calm = 0; else if (++calm >= 3) return true;
        await sleep(500);
    }
    return false;
}

/** Нужно ли дописывать свежий пост сразу после ответа (решается синхронно, чтобы tidy не срезал раньше). */
export function mendWanted(i, type) {
    if (!A || !cfg().on || type === 'impersonate' || type === 'quiet') return false;
    if (Date.now() - stoppedAt < 15000) return false;
    const m = A.ctx().chat?.[i];
    if (!m || busy.has(i) || tried.has(keyOf(i, m))) return false;
    const d = check(i);
    return !!d;
}

/** Дописать пост i. auto — сразу после ответа (только если он последний); иначе — по команде. */
export async function mendPost(i, { auto = false, after = null } = {}) {
    const c0 = A.ctx();
    const chat = c0.chat;
    const m = chat?.[i];
    if (!m || busy.has(i)) return false;
    busy.add(i);
    tidyHold.add(i);
    let ok = false;
    const orig = m.mes;
    try {
        if (auto && !(await waitIdle())) return false;
        if (!auto && generating()) { A.toast('info', 'Подожди, пока таверна допишет текущий ответ.'); ok = true; return false; }
        if (A.ctx().chat !== chat || chat[i] !== m) return false;
        if (auto && i !== chat.length - 1) return false;
        let d = check(i);
        if (!d) { if (!auto) A.toast('info', 'Пост цел — дописывать нечего.'); ok = true; return true; }
        tried.add(keyOf(i, m));
        const name = m.name || 'the character';
        const chid = chidOf(m);
        const notes = expectsNotes(i) || d.wasNotes || d.kind === 'notes';
        const prose = d.kind === 'prose';
        const done = prose ? 'Дописала пост.' : (d.wasNotes || d.kind === 'notes') ? 'Дописала заметки.' : 'Дописала конец поста.';
        // огрызок блока убрать сразу — чтобы не глотал блоки ExtBlocks, пока ждём ответ
        if (d.base !== m.mes.replace(/\s+$/, '')) await apply(i, m, d.base);
        if (d.kind === 'trim') { ok = true; return true; }
        const what = d.kind === 'prose' ? 'пост оборвался на полуслове — дописываю' : `оборвались ${d.label && !d.wasNotes ? `«${d.label}»` : 'заметки'} — дописываю`;
        A.toast('info', what + '…', '✦ Life', { timeOut: 5000 });
        let tries = Math.max(1, Math.min(4, Number(cfg().tries) || 2));
        let text = d.base;
        while (d && tries-- > 0) {
            const snap = m.mes;
            const out = await ask(promptFor(d, name, notes), chid, d.kind === 'prose' ? 12000 : 6000);
            if (A.ctx().chat !== chat || chat[i] !== m || m.mes !== snap) return false;
            const { text: t, top } = clean(out, name);
            if (d.kind === 'prose') {
                const st = stitch(text, t);
                if (!t || (top && !st.seam)) { console.warn('[Life] дописать: вместо продолжения пришёл новый пост — не беру'); break; }
                text = st.text;
            } else {
                const have = new Set(blocksOf(text).map(b => summaryOf(b)));
                const add = blocksOf(t).filter(b => !have.has(summaryOf(b)));
                if (!add.length) { console.warn('[Life] дописать: в ответе нет целого блока', t.slice(0, 200)); continue; }
                text = text.replace(/\s+$/, '') + '\n\n' + add.join('\n');
            }
            // вдруг и продолжение оборвалось — срезать огрызок и ещё круг (модель увидит уже сшитый пост)
            const nd = diagnose(text, { expectNotes: notes });
            if (nd && (nd.kind === 'trim' || nd.kind === 'block')) text = nd.base;
            if (text !== m.mes) await apply(i, m, text);
            d = nd && nd.kind !== 'trim' ? { ...nd, base: text } : null;
        }
        ok = !d;
        if (ok) A.toast('success', done, '✦ Life', { timeOut: 3500 });
        return ok;
    } catch (e) {
        console.warn('[Life] дописать', e);
        if (!/abort|stop/i.test(String(e?.message || e))) A.toast('warning', A.esc(String(e?.message || e)), '✦ Life: не дописалось', { timeOut: 6000 });
        return false;
    } finally {
        busy.delete(i);
        tidyHold.delete(i);
        const same = A.ctx().chat === chat && chat[i] === m;
        if (!ok && same) {
            tidyMessage(i);
            if (check(i)) A.toast('warning', 'Пост так и остался оборванным. Ещё раз — <b>/life fix</b> или нажми сюда.', '✦ Life', { timeOut: 12000, escapeHtml: false, onclick: () => mendPost(i) });
        }
        // одно сохранение на всю починку
        if (same && m.mes !== orig) {
            try { await A.ctx().saveChat(); } catch (e) { console.warn('[Life] дописать: сохранить', e); }
            // в дописанном куске теги Horae — пусть перечитает пост (сам и сохранит)
            if (/<horae/i.test(m.mes) && !/<horae/i.test(orig)) { try { const c = A.ctx(); await c.eventSource.emit(c.eventTypes.MESSAGE_EDITED, i); } catch { /* */ } }
        }
        try { after?.(i, ok); } catch { /* */ }
    }
}

/** Последний пост персонажа — для /life fix. */
export function mendLast() {
    const chat = A.ctx().chat || [];
    let i = chat.length - 1;
    while (i >= 0 && (chat[i].is_user || chat[i].is_system)) i--;
    if (i < 0) { A.toast('info', 'В чате нет постов персонажа.'); return false; }
    return mendPost(i);
}
