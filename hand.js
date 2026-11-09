// Почерк. У каждого свой: записки, письма и дневник в постах (карточки GC: записка, письмо, дневник) пишутся
// почерком того, кто их написал, — по подписи или «от кого». Из коробки: у одного — пропись 40-х, у твоей персоны —
// «курица лапой» (буквы пляшут, строчка гуляет). Свой — Персонаж → Жизнь → Психика → «Почерк».

import { artBlocks } from './art.js';
import { lifeKey } from './sim.js';

let A = null;
export function initHand(api) { A = api; }

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
// [id, ярлык, класс шрифта, неряшливость 0–3]
export const HANDS = [
    ['prop', 'пропись 40-х', 'marck', 0],
    ['neat', 'аккуратный', 'caveat', 0],
    ['quick', 'быстрый', 'bad', 1],
    ['print', 'печатными', 'amatic', 0],
    ['chicken', 'курица лапой', 'bad', 3],
];
const handById = (id) => HANDS.find(h => h[0] === id) || null;

function cfg() {
    const s = A.settings();
    if (!s.hand || typeof s.hand !== 'object') s.hand = {};
    const c = s.hand;
    if (c.on === undefined) c.on = true;
    if (!c.list || typeof c.list !== 'object') c.list = {};
    if (!c.seeded) seed(c);
    return c;
}
export const handOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
const keyOf = (who) => { try { return lifeKey(who); } catch { return A.canonName(who) || who; } };

function seed(c) {
    let names = [];
    try { names = A.groupMembers().map(A.canonName); } catch { /* */ }
    const U = A.canonName(A.ctx().name1);
    if (!names.length && !U) return;
    c.seeded = 1;
    const bucky = names.find(n => /баки|bucky|барнс|barnes/i.test(n));
    if (bucky && !c.list[keyOf(bucky)]) c.list[keyOf(bucky)] = 'prop';
    if (U && !c.list[keyOf(U)]) c.list[keyOf(U)] = 'chicken';
    A.saveSettings();
}

export function handOf(who) { return handById(cfg().list[keyOf(who)]) || null; }

/** Кто это написал: подпись или «от кого» → свой человек (по имени, алиасу или инициалу). */
function writer(raw, postAuthor) {
    const t = String(raw || '').replace(/^[—–\-\s]+/, '').replace(/[.,!]+$/, '').trim();
    if (!t) return '';
    const pool = [A.ctx().name1, ...A.groupMembers()].map(A.canonName).filter(Boolean);
    let hit = pool.find(n => A.sameName(n, t) || A.sameName(A.canonName(t), n));
    if (hit) return hit;
    try { hit = (A.namesInText?.(t) || [])[0]; } catch { /* */ }
    if (hit) return A.canonName(hit);
    // «Б.», «Дж. Б. Б.» — инициал: только если он однозначный (или совпадает с автором поста)
    const ini = t.match(/^([А-ЯЁA-Z])\.?$/);
    if (ini) {
        const c = ini[1].toUpperCase();
        const by = pool.filter(n => n[0].toUpperCase() === c);
        if (by.length === 1) return by[0];
        const pa = postAuthor && by.find(n => A.sameName(n, postAuthor));
        if (pa) return pa;
    }
    return '';
}

// детерминированный «случай» — при перерисовке буквы не прыгают
function rnd(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

/** Снять неряшливость (почерк поменяли на ровный). */
function unmess(root) {
    root.querySelectorAll('.lf-mw').forEach(s => s.replaceWith(document.createTextNode(s.textContent)));
    root.normalize();
    delete root.dataset.lfMess;
}

/** Неряшливость: слова пляшут, строчка гуляет. */
function messify(root, level, seed) {
    if (root.dataset.lfMess && root.dataset.lfMess !== String(level)) unmess(root);
    if (!level || root.dataset.lfMess === String(level)) return;
    root.dataset.lfMess = String(level);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.nodeValue.trim() && !n.parentElement.closest('.lf-mw')) nodes.push(n);
    let k = 0;
    for (const n of nodes) {
        const frag = document.createDocumentFragment();
        for (const part of n.nodeValue.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(part); continue; }
            const s = document.createElement('span');
            s.className = 'lf-mw';
            const r = (x) => rnd(`${seed}:${k}:${x}`) - 0.5;
            const rot = r('r') * 2.6 * level;
            const y = r('y') * 1.6 * level;
            const sz = 1 + r('s') * 0.12 * level;
            const sk = r('k') * 4 * level;
            s.style.transform = `translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) skewX(${sk.toFixed(1)}deg)`;
            s.style.fontSize = `${sz.toFixed(2)}em`;
            s.textContent = part;
            frag.append(s);
            k++;
        }
        n.replaceWith(frag);
    }
}

/** Карточки-бумажки в посте: записка, письмо, дневник — почерком того, кто писал. */
export function paintHand(el, id) {
    if (!handOn()) return;
    const m = A.chatArr()[id];
    if (!m || typeof m.mes !== 'string' || !/<art\b/i.test(m.mes)) return;
    const cards = [...el.querySelectorAll('.mes_text .gca')];
    if (!cards.length) return;
    const blocks = artBlocks(m.mes);
    cards.forEach((card, n) => {
        const b = blocks[n];
        const type = String(b?.attrs?.type || '').toLowerCase();
        if (!['note', 'letter'].includes(type)) return;
        const kind = String(b.attrs.kind || '').toLowerCase();
        const diary = /дневник|блокнот|тетрад|diary|journal/.test(kind);
        const paper = card.querySelector('.gca-paper');
        const target = paper || (diary ? card.querySelector('.gca-card') : null);
        if (!target) return;
        const sig = type === 'letter' ? b.attrs.from : b.attrs.sign;
        const who = writer(sig || card.querySelector('.sig')?.textContent || '', m.name);
        const h = who ? handOf(who) : null;
        const want = h ? `${h[0]}|${who}` : '';
        if (target.dataset.lfHand === want) return;
        target.dataset.lfHand = want;
        target.classList.remove(...HANDS.map(x => `lf-hand-${x[2]}`), 'lf-hand');
        if (diary) card.classList.toggle('lf-diary', !!h);
        if (!h) { if (target.dataset.lfMess) unmess(target); return; }
        target.classList.add('lf-hand', `lf-hand-${h[2]}`);
        messify(target, h[3], `${id}:${n}:${who}`);
    });
}

// ───────────── Персонаж → Жизнь → Психика ─────────────

export function handHtml(who) {
    if (!A?.hasChat?.() || NARR.test(who)) return '';
    const cur = handOf(who);
    const N = esc(who);
    return `${A.sec('Почерк', cur ? cur[1] : 'обычный')}
    <div class="lf-chips wrap">${HANDS.map(([k, l]) => `<button class="lf-chip${cur?.[0] === k ? ' on' : ''}" data-act="hd-set" data-name="${N}" data-v="${k}">${l}</button>`).join('')}<button class="lf-chip${cur ? '' : ' on'}" data-act="hd-set" data-name="${N}" data-v="">обычный</button></div>
    ${cur ? `<div class="lf-hand-prev lf-hand lf-hand-${cur[2]}" data-mess="${cur[3]}">Приду поздно. Не жди — ешь без меня.</div>` : ''}
    <div class="lf-hint">Записки, письма и дневник в постах (карточки GC) — его почерком, если подписаны им.</div>`;
}

export function handClick(act, el) {
    if (act !== 'hd-set') return false;
    const k = keyOf(el.dataset.name);
    if (el.dataset.v) cfg().list[k] = el.dataset.v; else delete cfg().list[k];
    A.saveSettings();
    document.querySelectorAll('#chat .gca-paper[data-lf-hand], #chat .gca-card[data-lf-hand]').forEach(x => { delete x.dataset.lfHand; });
    A.render?.();
    A.paintSoon?.();
    return true;
}
