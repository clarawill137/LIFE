// OOC-радар — «⚠ не он». У каждого главного — ядро характера и речи (дешёвая модель один раз выписывает его
// из карточки и психо-лорбука, можно поправить руками: Персонаж → Жизнь → Психика). Летописец сверяет с ядром
// реплики и поступки в каждом ответе; что звучит не как он — чип «⚠ не он» под постом, тап — что именно и почему,
// «Переписать голосом …» меняет только тот абзац (его голосом из банка реплик и по ядру), «это он» — снять.

import { loreFor, cardText } from './lore.js';
import { lifeKey } from './sim.js';

let A = null;
export function initOoc(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const open = new Set();
const busy = new Set();

function cfg() {
    const s = A.settings();
    if (!s.ooc || typeof s.ooc !== 'object') s.ooc = {};
    const c = s.ooc;
    if (c.on === undefined) c.on = true;
    if (!c.prof || typeof c.prof !== 'object') c.prof = {};
    return c;
}
export const oocOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
const keyOf = (who) => { try { return lifeKey(who); } catch { return A.canonName(who) || who; } };

/** Ядро характера и речи (или ''). */
export function coreOf(who) { return String(cfg().prof[keyOf(who)]?.text || '').trim(); }

const SYSTEM = `По карточке и записям лорбука о персонаже ролевой истории выпиши ЯДРО его характера и речи — по нему потом проверяют, «он ли это» в каждом ответе.
Что писать: как говорит (длина фраз, словарь, мат, юмор, обращения, на каком языке срывается), чего НИКОГДА не скажет и не сделает, как реагирует на страх, нежность, злость, давление, ключевые черты и раны, которые определяют поступки.
10–16 строк, каждая 5–20 слов, конкретно, без пересказа биографии. Ответь только JSON: {"core":["…"]}`;

/** Собрать ядро из карточки и лорбука. */
export async function oocCollect(who) {
    const name = A.canonName(who);
    const card = cardText(name, 5000);
    let lore = '';
    try { lore = await loreFor(name, { max: 12000 }); } catch { /* */ }
    if (!card && !lore) throw new Error('ни карточки, ни лорбука о нём не нашлось');
    const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: [`Персонаж: ${name}`, card ? `Карточка:\n${card}` : '', lore ? `Лорбук:\n${lore}` : ''].filter(Boolean).join('\n\n') }], 1300);
    const j = A.extractJson(out);
    const list = (Array.isArray(j?.core) ? j.core : []).map(x => String(x || '').replace(/^[•\-–—*\s]+/, '').trim()).filter(x => x.length > 5).slice(0, 18);
    if (!list.length) throw new Error('модель не выписала ядро');
    cfg().prof[keyOf(name)] = { text: list.map(x => `• ${x}`).join('\n'), at: Date.now(), hand: false };
    A.saveSettings();
    return list.length;
}

let ensured = '';
/** Фоном (открыли чат): у главных без ядра — собрать по одному. */
export async function oocEnsure() {
    if (!oocOn() || !A?.hasChat?.()) return;
    const sig = String(A.ctx().chatId || A.ctx().getCurrentChatId?.() || '');
    if (ensured === sig) return;
    ensured = sig;
    const U = A.ctx().name1;
    for (const n of A.groupMembers().map(A.canonName)) {
        if (!n || NARR.test(n) || A.sameName(n, U) || coreOf(n)) continue;
        try { await oocCollect(n); } catch (e) { console.warn(`[Life] ядро ${n}`, e); }
    }
}

// ───────────── Летописец ─────────────

const RULE = `
ooc — где персонаж в этом посте звучит или поступает НЕ как он, против своего «Ядра»: [{"who":"имя","q":"дословная цитата из поста с этим местом, 3–25 слов, без изменений","why":"почему это не он, 3–12 слов"}]. Только явное: чужой словарь и манера (сдержанный вдруг говорит длинными гладкими речами или чужими словечками), говорит или делает то, чего он никогда не скажет и не сделает, реакция против характера без причины в сцене. Рост и перемены, которые сцена объясняет, — не это. Нет — [] (так почти всегда).`;

/** Кого проверять в посте i: автор, второй в посте на двоих и главные, чьи имена есть в тексте. */
function whoIn(i) {
    const m = A.chatArr()[i];
    if (!m || m.is_user) return [];
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !NARR.test(n) && !A.sameName(n, A.ctx().name1) && coreOf(n) && !out.some(x => A.sameName(x, n))) out.push(n); };
    add(m.name);
    for (const mm of String(m.mes || '').matchAll(/^[ \t]*(?:\*\*|__|\*|_)?\[\[([^[\]\n]{1,40})\]\]/gm)) add(mm[1]);
    let named = [];
    try { named = A.namesInText?.(A.plainText ? A.plainText(m.mes) : m.mes) || []; } catch { /* */ }
    for (const n of named) if (A.groupMembers().some(g => A.sameName(g, n))) add(n);
    return out.slice(0, 3);
}

export function oocChron(i) {
    if (!A?.hasChat?.() || !oocOn() || !Number.isFinite(i)) return null;
    const who = whoIn(i);
    if (!who.length) return null;
    return { key: '"ooc": []', rule: RULE, tokens: 160, input: `Ядро (для поля ooc):\n${who.map(n => `## ${n}\n${A.cut(coreOf(n), 1100)}`).join('\n')}` };
}

export function oocAfterPost(i, j) {
    if (!oocOn()) return;
    const e = A.chronOf(i);
    const m = A.chatArr()[i];
    if (!e || !m) return;
    const who = whoIn(i);
    const raw = A.norm(String(m.mes || '').replace(/[*_~`]+/g, ''));
    const list = (Array.isArray(j?.ooc) ? j.ooc : [])
        .map(x => ({ who: A.canonName(str(x?.who)), q: str(x?.q).replace(/^[«"“„]+|[»"”]+$/g, '').slice(0, 300), why: str(x?.why).slice(0, 120) }))
        .filter(x => x.q.length >= 6 && x.why && who.some(n => A.sameName(n, x.who)) && raw.includes(A.norm(x.q).slice(0, 24)))
        .slice(0, 3);
    if (!list.length) { if (e.ooc && !e.ooc.list?.some(x => x.done)) { delete e.ooc; A.saveMeta(); } return; }
    e.ooc = { list, at: Date.now() };
    A.saveMeta();
    A.paintSoon?.();
}

// ───────────── в чате ─────────────

export function paintOoc(el, id) {
    const e = oocOn() ? A.chronOf(id) : null;
    const old = el.querySelector(':scope .lf-ooc');
    const list = (e?.ooc?.list || []).map((x, n) => ({ ...x, n })).filter(x => !x.off);
    if (!list.length || list.every(x => x.done)) { old?.remove(); return; }
    const live = list.filter(x => !x.done);
    const html = !open.has(id)
        ? `<div class="lf-ooc lf-own"><button class="lf-ooc-chip" data-act="oc-open" data-mes="${id}">⚠ <b>не ${esc(A.shortName(live[0].who))}?</b> ${live.map(x => esc(x.why)).join(' · ')}</button></div>`
        : `<div class="lf-ooc lf-own open">
            <div class="lf-ooc-h"><b>⚠ Не похоже на него</b><button data-act="oc-open" data-mes="${id}">свернуть</button></div>
            ${list.map(x => `<div class="lf-ooc-i${x.done ? ' done' : ''}">
                <div class="lf-ooc-why"><b>${esc(A.shortName(x.who))}</b> — ${esc(x.why)}</div>
                <q>${esc(x.q)}</q>
                <div class="lf-ooc-b">${x.done ? '<span>✓ переписано</span>' : busy.has(`${id}:${x.n}`) ? '<span>переписываю…</span>' : `<button class="main" data-act="oc-fix" data-mes="${id}" data-n="${x.n}">Переписать голосом ${esc(A.shortName(x.who))}</button><button data-act="oc-no" data-mes="${id}" data-n="${x.n}">это он</button>`}</div>
            </div>`).join('')}
        </div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

export async function oocClick(act, el) {
    if (!act.startsWith('oc-')) return false;
    const i = Number(el.dataset.mes);
    const n = Number(el.dataset.n);
    const e = A.chronOf(i);
    switch (act) {
        case 'oc-open': if (open.has(i)) open.delete(i); else open.add(i); A.paintSoon?.(); return true;
        case 'oc-no': { const it = e?.ooc?.list?.[n]; if (it) { it.off = true; A.saveMeta(); } A.paintSoon?.(); return true; }
        case 'oc-fix': {
            const it = e?.ooc?.list?.[n];
            const k = `${i}:${n}`;
            if (!it || busy.has(k)) return true;
            busy.add(k);
            A.paintSoon?.();
            try {
                await A.rewriteFor(i, it.q, it.who, it.why);
                const e2 = A.chronOf(i); // текст поменялся — запись Летописца переехала
                const it2 = e2?.ooc?.list?.find(x => x.q === it.q);
                if (it2) it2.done = true;
                A.saveMeta();
                A.toast('success', `Теперь это ${esc(A.shortName(it.who))}`, '⚠ Не он', { timeOut: 1800 });
            } catch (err) {
                A.toast('warning', esc(String(err?.message || err)), '⚠ Не он', { timeOut: 4000 });
            } finally { busy.delete(k); A.paintSoon?.(); }
            return true;
        }
        case 'oc-on': cfg().on = !!el.checked; A.saveSettings(); A.render?.(); return true;
        case 'oc-collect': {
            const who = el.dataset.name;
            await A.withBusy(el, async () => {
                const k = await oocCollect(who);
                A.toast('success', `Ядро ${esc(A.shortName(who))}: ${k} строк`, '⚠ Не он', { timeOut: 2000 });
                A.render?.();
            }, 'Читаю карточку и лорбук…');
            return true;
        }
    }
    return false;
}

// ───────────── Персонаж → Жизнь → Психика ─────────────

export function oocHtml(who) {
    if (!A?.hasChat?.() || A.sameName(who, A.ctx().name1) || NARR.test(who)) return '';
    const p = cfg().prof[keyOf(who)];
    const N = esc(who);
    return `${A.sec('Ядро — для «не он»', oocOn() ? (p?.text ? (p.hand ? 'правлено руками' : 'собрано') : 'ещё нет') : 'выключено')}
    ${oocOn() ? `<div class="lf-field"><textarea rows="6" data-in="oc-core" data-name="${N}" placeholder="как говорит, чего никогда не скажет и не сделает, как реагирует…">${esc(p?.text || '')}</textarea></div>
    <div class="lf-actions"><button class="lf-btn" data-act="oc-collect" data-name="${N}">${A.icon('book')} ${p?.text ? 'Собрать заново' : 'Собрать'} из карточки и лорбука</button></div>
    <div class="lf-hint">Летописец сверяет с этим реплики и поступки в каждом ответе: что звучит не как он — чип «⚠ не он» под постом.</div>` : ''}
    <label class="lf-switch"><input type="checkbox" data-act="oc-on" ${oocOn() ? 'checked' : ''}><span></span>Проверять «не он» в каждом ответе</label>`;
}

export function oocInput(el) {
    if (el.dataset.in !== 'oc-core') return false;
    const k = keyOf(el.dataset.name);
    const v = String(el.value || '').trim();
    if (v) cfg().prof[k] = { text: v.slice(0, 3000), at: Date.now(), hand: true };
    else delete cfg().prof[k];
    A.saveSettings();
    return true;
}
