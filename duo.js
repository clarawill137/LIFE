// Пост на двоих (сплит-пост). Когда в сцене много своих и много всего происходит, ход пишут двое —
// каждый свою часть, своим голосом и характером. В тексте часть начинается строкой [[Имя]] (модель видит
// такие посты в истории как есть); в чате вместо строки — шапка с лицом и именем, аватарка поста
// разделена надвое, у имени — «& Наташа».
// Авто: Life решает сама по сцене — сколько своих рядом, кого ты зовёшь в посте, бой или ссора, длинный пост —
// и не чаще раза в несколько ответов. Вручную: пульт или Сцена — «следующий ответ вдвоём с …».
// В группе второй потом может ответить и сам — тогда он продолжает со своей части, а не повторяет её.

import { modesOn } from './modes.js';
import { moodNow } from './mood.js';
import { knockActive } from './knock.js';

let A = null;
export function initDuo(api) { A = api; }

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
// строка-метка: [[Имя]] (бывает в звёздочках или с двоеточием)
const LINE = /^[ \t]*(?:\*\*|__|\*|_)?\[\[([^[\]\n]{1,40})\]\](?:\*\*|__|\*|_)?[ \t]*:?[ \t]*$/gm;
const HEAD = /^\s*\[\[([^[\]\n]{1,40})\]\]\s*:?\s*/;

function cfg() {
    const s = A.settings();
    if (!s.duo || typeof s.duo !== 'object') s.duo = {};
    const c = s.duo;
    if (!['auto', 'hand', 'off'].includes(c.mode)) c.mode = 'auto';
    const n = Number(c.every);
    if (!Number.isFinite(n) || n < 1) c.every = 4;
    return c;
}
export const duoOn = () => !!A && A.settings().enabled !== false && cfg().mode !== 'off';

function M() {
    const cm = A.chatMeta();
    if (!cm.duo || typeof cm.duo !== 'object') cm.duo = {};
    return cm.duo;
}

/** Кто пишет пост: имена из строк [[Имя]] по порядку. Двое и больше — пост на двоих, иначе []. */
export function duoNames(text) {
    const out = [];
    const re = new RegExp(LINE.source, 'gm');
    let m;
    while ((m = re.exec(String(text || '')))) {
        const n = A.canonName(m[1].trim());
        if (n && !out.some(x => A.sameName(x, n))) out.push(n);
    }
    return out.length >= 2 ? out : [];
}

/** Для Летописца: кто писал пост (двое — с пометкой про метки), иначе ''. */
export function duoSpeaker(m) {
    const n = m && !m.is_user ? duoNames(m.mes) : [];
    return n.length ? `${n.join(' и ')} — пост на двоих: часть каждого начинается строкой [[Имя]]` : '';
}

// ───────────── кто второй ─────────────

const speakerName = () => { const S = String(A.ctx().name2 || '').trim(); return S && !NARR.test(S) ? A.canonName(S) : ''; };
function present() { try { return (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); } catch { return []; } }

/** Какой пост сейчас пишется (t) и чей пост перед ним (u — индекс твоего поста, если он прямо перед ответом). */
function turnOf(type) {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const redo = (type === 'swipe' || type === 'continue') && last && !last.is_user && !last.is_system;
    const t = redo ? chat.length - 1 : chat.length;
    let u = -1;
    for (let j = t - 1; j >= 0; j--) {
        const m = chat[j];
        if (!m || m.is_system) continue;
        if (m.is_user) u = j;
        break;
    }
    return { t, u };
}

/** С кем S может писать на двоих: свои, кто рядом (в группе — участники группы), кроме S и тебя. */
export function duoCands(S = speakerName(), { strict = false } = {}) {
    if (!A?.hasChat?.()) return [];
    const c = A.ctx();
    const U = c.name1;
    const pr = present();
    const isHere = (n) => pr.some(p => A.sameName(p, n));
    const pool = c.groupId ? A.groupMembers() : pr.filter(n => A.isOwn(n));
    return pool.map(A.canonName).filter((n, k, arr) => n && !NARR.test(n) && !A.sameName(n, S) && !A.sameName(n, U)
        && arr.findIndex(x => A.sameName(x, n)) === k
        && (pr.length ? isHere(n) : !strict && !!c.groupId));
}

/** Сколько ответов назад был последний пост на двоих (до поста t). */
function duoAgo(t) {
    const chat = A.chatArr();
    let ai = 0;
    for (let j = t - 1; j >= 0 && ai < 40; j--) {
        const m = chat[j];
        if (!m || m.is_system || m.is_user) continue;
        ai++;
        if (duoNames(m.mes).length) return ai;
    }
    return Infinity;
}

/** Сколько ответов назад n писал сам (своим постом или частью на двоих). */
function spokeAgo(n, t) {
    const chat = A.chatArr();
    let ai = 0;
    for (let j = t - 1; j >= 0 && ai < 8; j--) {
        const m = chat[j];
        if (!m || m.is_system || m.is_user) continue;
        ai++;
        if (A.sameName(m.name, n) || duoNames(m.mes).some(x => A.sameName(x, n))) return ai;
    }
    return 8;
}

function userText(u) { const m = A.chatArr()[u]; return m ? String(A.plainText ? A.plainText(m.mes) : m.mes || '') : ''; }
function named(text) {
    let out = [];
    try { out = A.namesInText?.(text) || []; } catch { /* */ }
    return out.filter(n => !A.sameName(n, A.ctx().name1));
}

function hot() {
    try { if ((modesOn() || []).includes('fight')) return true; } catch { /* */ }
    try {
        const md = moodNow();
        return ['tension', 'danger', 'fight', 'drama'].includes(md?.manual || md?.auto) || ['danger', 'fight', 'tension'].includes(md?.tone);
    } catch { return false; }
}

/** Второй: кого ты зовёшь в посте, иначе кто дольше молчал. */
function pickPartner(cands, utext, t) {
    const nm = named(utext);
    let best = '';
    let bs = -Infinity;
    cands.forEach((n, k) => {
        const s = (nm.some(x => A.sameName(x, n)) ? 4 : 0) + spokeAgo(n, t) / 2 - k * 0.01;
        if (s > bs) { bs = s; best = n; }
    });
    return best;
}

/** Авто: сцена людная и горячая. Без случайностей — свайп того же ответа решает так же. */
function autoPartner(S, t, u) {
    if (u < 0) return '';
    const pr = present();
    if (!pr.length || !pr.some(p => A.sameName(p, S))) return '';
    const cands = duoCands(S, { strict: true });
    if (!cands.length) return '';
    if (duoAgo(t) < Number(cfg().every)) return '';
    const ut = userText(u);
    const nm = named(ut);
    const involved = [S, ...cands].filter(n => nm.some(x => A.sameName(x, n))).length;
    const score = (cands.length >= 2 ? 2 : 1) + (involved >= 2 ? 2 : 0) + (ut.length >= 600 ? 1 : 0) + (hot() ? 2 : 0);
    if (score < 4) return '';
    return pickPartner(cands, ut, t);
}

/** С кем S пишет этот ответ ('' — один). consume — генерация пошла: ручной выбор расходуется. */
export function duoPartner(S, type, consume = false) {
    if (!A?.hasChat?.() || !duoOn() || !S || NARR.test(S) || type === 'quiet' || type === 'impersonate') return '';
    const chat = A.chatArr();
    if (type === 'continue') { // дописываем пост: если он уже на двоих — тот же второй
        const last = chat[chat.length - 1];
        const n = last && !last.is_user ? duoNames(last.mes) : [];
        return n.find(x => !A.sameName(x, S)) || '';
    }
    try { const k = knockActive(); if (k && !k.used && A.sameName(k.who, S)) return ''; } catch { /* */ } // входит в сцену — один
    const pr = present();
    if (pr.length && !pr.some(p => A.sameName(p, S))) return ''; // сам не в сцене (звонит, едет) — пишет один
    const d = M();
    const { t, u } = turnOf(type);
    if (d.hand && d.hand.t === t && d.hand.u === u && !A.sameName(d.hand.p, S)) return d.hand.p; // свайп того же ответа
    if (d.armed) {
        let P = d.armed === '*' ? '' : A.canonName(d.armed);
        if (!P || A.sameName(P, S)) P = pickPartner(duoCands(S), userText(u), t);
        if (!P) return '';
        if (consume) { d.hand = { t, u, p: P }; d.armed = ''; A.saveMeta(); }
        return P;
    }
    if (cfg().mode !== 'auto') return '';
    return autoPartner(S, t, u);
}

/** Строки правил для модели: формат и кто за что. */
export function duoLines(S, P) {
    return [
        `[SPLIT POST — this reply is written by ${S} and ${P} together: two voices in one post, each in their own character, manner and rhythm — two authors, one moment.`,
        `- Format: a line [[${S}]] and then ${S}'s part; a line [[${P}]] and then ${P}'s part. Parts may alternate (${S}, ${P}, ${S}…) if the moment needs it; every part starts with its own [[Name]] line, alone on the line, written exactly like that. Blocks (author notes, plates) go after all the parts, as usual.`,
        `- Each part belongs to its owner: their actions, words, thoughts and what they notice. Inside one part the other is seen only from outside. Don't retell the same beats twice — the parts carry the moment forward together, like a relay.`,
    ];
}

/** Одиночный чат: правила поста на двоих (в группе они внутри «каждый за себя»). */
export function duoPrompt(type, consume = false) {
    if (!A?.hasChat?.() || A.ctx().groupId) return '';
    const S = speakerName();
    const P = S ? duoPartner(S, type, consume) : '';
    if (!P) return '';
    return [...duoLines(S, P), `- Never write ${A.ctx().name1 || 'the player'}'s words, actions or thoughts.]`].join('\n');
}

/** В группе: S уже писал часть в посте на двоих прямо перед этим ответом — продолжать с неё. */
export function duoFollow(S, type) {
    if (!A?.hasChat?.() || !duoOn() || !S) return '';
    const chat = A.chatArr();
    const { t } = turnOf(type);
    for (let j = t - 1; j >= 0; j--) {
        const m = chat[j];
        if (!m || m.is_system) continue;
        if (m.is_user) return '';
        const n = duoNames(m.mes);
        if (!n.length || A.sameName(m.name, S) || !n.some(x => A.sameName(x, S))) return '';
        return `- ${S} already had a part in the previous post (written together with ${A.canonName(m.name)}). Continue from where ${S}'s part ended — don't repeat what ${S} already said or did there.`;
    }
    return '';
}

// ───────────── в чате ─────────────

function stripHead(p) {
    const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let node = tw.nextNode();
    while (node && !node.nodeValue.trim()) node = tw.nextNode();
    if (!node) return '';
    const m = node.nodeValue.match(HEAD);
    if (!m) return '';
    node.nodeValue = node.nodeValue.slice(m[0].length);
    // пустые обёртки вокруг метки (**[[Имя]]**) — долой
    let par = node.parentElement;
    if (!node.nodeValue.trim()) node.remove();
    while (par && par !== p && !par.textContent.trim() && !par.querySelector('img')) { const up = par.parentElement; par.remove(); par = up; }
    // перенос строки сразу после метки
    let first = p.firstChild;
    while (first && first.nodeType === 3 && !first.nodeValue.trim()) { const nx = first.nextSibling; first.remove(); first = nx; }
    if (first?.nodeName === 'BR') first.remove();
    return m[1].trim();
}

function headHtml(who) {
    return `${A.ava(who, 'sm')}<b>${esc(A.shortName(who))}</b><i class="lf-duo-line"></i>`;
}

function markText(box, names) {
    let who = '';
    let side = '';
    for (const ch of [...box.children]) {
        if (ch.classList.contains('lf-duo-h')) { who = ch.dataset.duo; side = ch.dataset.side; continue; }
        if (ch.matches('p') && /^\s*\[\[/.test(ch.textContent)) {
            const raw = stripHead(ch);
            if (raw) {
                who = A.canonName(raw);
                const k = names.findIndex(n => A.sameName(n, who));
                side = k > 0 && k % 2 ? 'b' : 'a';
                if (!ch.textContent.trim() && !ch.querySelector('img')) { // строка-метка отдельным абзацем — она и есть шапка
                    ch.className = `lf-duo-h lf-duo-${side}`;
                    ch.dataset.duo = who;
                    ch.dataset.side = side;
                    ch.innerHTML = headHtml(who);
                    continue;
                }
                const h = document.createElement('div');
                h.className = `lf-duo-h lf-duo-${side}`;
                h.dataset.duo = who;
                h.dataset.side = side;
                h.innerHTML = headHtml(who);
                ch.before(h);
            }
        }
        if (who && ch.matches('p, blockquote, ul, ol')) { ch.dataset.duo = who; ch.classList.add('lf-duo-p', `lf-duo-${side}`); }
    }
}

function clear(el) {
    if (!el.classList.contains('lf-duo') && !el.querySelector('.lf-duo-ava, .lf-duo-nm')) return;
    el.classList.remove('lf-duo');
    el.querySelectorAll('.lf-duo-ava, .lf-duo-nm').forEach(x => x.remove());
    delete el.dataset.lfDuo;
}

function avatarOf(el, i, who) {
    const wide = document.body.classList.contains('lf-ava-wide');
    let src = '';
    try { src = A.emoSrc?.(i, who) || ''; } catch { /* */ }
    return src || A.avatarUrl(who, wide) || A.avatarUrl(who) || '';
}

/** Пост на двоих: шапки частей, аватарка надвое, «& имя». Вызывается на каждый пост. */
export function paintDuo(el, id) {
    const m = A.chatArr()[id];
    const box = el.querySelector('.mes_text');
    if (!m || m.is_user || m.is_system || typeof m.mes !== 'string' || !m.mes.includes('[[') || !box || box.querySelector('textarea')) { clear(el); return; }
    const names = duoNames(m.mes);
    if (box.querySelector(':scope > p') && [...box.querySelectorAll(':scope > p')].some(p => /^\s*\[\[[^[\]\n]{1,40}\]\]/.test(p.textContent))) markText(box, names.length ? names : [A.canonName(m.name)]);
    if (!names.length) { clear(el); return; }
    const others = names.filter(n => !A.sameName(n, m.name));
    const sig = `${others.join('|')}|${document.body.classList.contains('lf-ava-wide') ? 'w' : 'n'}`;
    el.classList.add('lf-duo');
    // аватарка надвое
    const av = el.querySelector('.mesAvatarWrapper .avatar') || el.querySelector('.avatar');
    const main = av?.querySelector('img:not(.lf-duo-img)');
    if (av && main && others[0]) {
        let wrap = av.querySelector(':scope > .lf-duo-ava');
        const src = avatarOf(el, id, others[0]);
        if (!wrap) {
            wrap = document.createElement('span');
            wrap.className = 'lf-duo-ava';
            wrap.innerHTML = '<img class="lf-duo-img" alt="">';
            av.append(wrap);
        }
        const img = wrap.firstElementChild;
        if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
        try { img.style.borderRadius = getComputedStyle(main).borderRadius; } catch { /* */ }
        wrap.title = others[0];
    }
    // имя: «Баки & Наташа»
    const nameEl = el.querySelector('.ch_name .name_text') || el.querySelector('.name_text');
    if (nameEl) {
        const want = `& ${others.map(n => A.shortName(n)).join(', ')}`;
        let nm = nameEl.parentElement.querySelector(':scope > .lf-duo-nm');
        if (!nm) { nm = document.createElement('span'); nm.className = 'lf-duo-nm'; nameEl.after(nm); }
        if (nm.textContent !== want) nm.textContent = want;
    }
    el.dataset.lfDuo = sig;
}

// ───────────── управление: Сцена и пульт ─────────────

function modeChips(at) {
    const c = cfg();
    return [['auto', 'авто'], ['hand', 'вручную'], ['off', 'выкл']].map(([k, l]) => `<button class="${at === 'cc' ? 'cc-chip' : 'lf-chip'}${c.mode === k ? ' on' : ''}" ${at === 'cc' ? 'data-cc' : 'data-act'}="duo-mode" data-v="${k}">${l}</button>`).join('');
}

function partnerChips(at) {
    const S = speakerName();
    const list = duoCands(S && !A.ctx().groupId ? S : '');
    const armed = M().armed || '';
    const attr = at === 'cc' ? 'data-cc' : 'data-act';
    const cls = at === 'cc' ? 'cc-chip' : 'lf-chip';
    if (!list.length) return '';
    return `<button class="${cls}${armed === '*' ? ' on' : ''}" ${attr}="duo-arm" data-v="*">${A.icon('users')}сама решу</button>${list.map(n => `<button class="${cls}${armed && armed !== '*' && A.sameName(armed, n) ? ' on' : ''}" ${attr}="duo-arm" data-v="${esc(n)}">${A.ava(n, 'xs')}${esc(A.shortName(n))}</button>`).join('')}`;
}

/** Пульт: «Вдвоём — на следующий ответ». */
export function duoCCHtml() {
    if (!A?.hasChat?.() || !duoOn()) return '';
    const p = partnerChips('cc');
    return p ? `<div class="cc-chips wrap">${p}</div>` : '';
}

/** Сцена: пост на двоих. */
export function duoSceneHtml() {
    if (!A?.hasChat?.() || A.settings().enabled === false) return '';
    const p = duoOn() ? partnerChips('hub') : '';
    const armed = M().armed;
    return `${A.sec ? A.sec('Вдвоём', 'пост на двоих') : '<h4>Вдвоём</h4>'}
        <div class="lf-hint">${armed ? `Следующий ответ пишут двое${armed !== '*' ? ` — с ${esc(A.shortName(A.canonName(armed)))}` : ''}.` : cfg().mode === 'auto' ? 'Когда рядом много своих и сцена горячая, ответ пишут двое — каждый свою часть. Можно и самой: кого позвать в следующий ответ.' : 'Кого позвать в следующий ответ вторым.'}</div>
        ${p ? `<div class="lf-chips wrap">${p}</div>` : duoOn() ? '<div class="lf-empty small">Рядом никого из своих — не с кем на двоих.</div>' : ''}
        <div class="lf-chips">${modeChips('hub')}</div>`;
}

export function duoClick(act, el) {
    if (!act.startsWith('duo-')) return false;
    const c = cfg();
    if (act === 'duo-mode') { c.mode = el.dataset.v; A.saveSettings(); }
    else if (act === 'duo-arm') {
        const d = M();
        const v = el.dataset.v || '';
        d.armed = d.armed && (d.armed === v || (v !== '*' && d.armed !== '*' && A.sameName(d.armed, v))) ? '' : v;
        A.saveMeta();
        if (d.armed) A.toast('info', d.armed === '*' ? 'Следующий ответ пишут двое — второго выберу сама' : `Следующий ответ — вдвоём с ${esc(A.shortName(A.canonName(d.armed)))}`, '✦ Вдвоём', { timeOut: 1800 });
    }
    try { A.updatePrompt?.(); } catch { /* */ }
    A.render?.();
    return true;
}
