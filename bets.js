// Пари. Кто с кем поспорил, на что и что поставил («ставлю свой макларен, что…»). Летописец замечает пари
// и чем оно кончилось; модель помнит открытые пари и неотданные проигрыши. Идея — «Пари» TavernOS HUD (alewwi).

import { str, arr, similar } from './hudkit.js';

let A = null;
export function initBets(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.bets || typeof s.bets !== 'object') s.bets = {};
    if (s.bets.on === undefined) s.bets.on = true;
    return s.bets;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.bets || typeof cm.bets !== 'object') cm.bets = {};
    if (!Array.isArray(cm.bets.list)) cm.bets.list = [];
    if (!Number.isFinite(cm.bets.seq)) cm.bets.seq = 0;
    return cm.bets;
}
const open = () => M().list.filter(x => x.st === 'open');
const owed = () => M().list.filter(x => x.st !== 'open' && !x.paid && x.stake);
const loser = (x) => (x.st === 'won' ? x.b : x.a);
const winner = (x) => (x.st === 'won' ? x.a : x.b);

const RULE = `
bets — пари между людьми: [{"id":"b2 — если пари уже есть в «Пари», иначе пусто","a":"кто поставил","b":"с кем спорит","on":"на что спорят, 3-12 слов","stake":"что на кону, 1-8 слов","st":"open|won|lost"}]. st — со стороны a: won — a выиграл, lost — проиграл. Только пари, заключённые или решившиеся в этом посте. Нечего — [].`;

export function betsChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const rows = open().slice(-5).map(x => `[${x.id}] ${x.a} с ${x.b}: ${x.on} (ставка: ${x.stake || '—'})`);
    return { key: '"bets": []', rule: RULE, tokens: 110, input: `Пари (открытые): ${rows.length ? rows.join(' | ') : 'нет'}` };
}

export function betsAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    // свайп: убрать пари из этого поста и вернуть открытыми те, что он закрыл
    s.list = s.list.filter(x => !(x.mes === i && x.src === 'post'));
    for (const x of s.list) if (x.endMes === i) { x.st = 'open'; delete x.endMes; }
    let changed = false;
    for (const r of arr(j?.bets).slice(0, 3)) {
        const st = ['open', 'won', 'lost'].includes(str(r?.st)) ? str(r.st) : 'open';
        let x = s.list.find(y => y.id === str(r?.id) && y.st === 'open') || open().find(y => similar(A, y.on, str(r?.on)));
        if (!x) {
            const a = A.canonName(str(r?.a, 50)), b = A.canonName(str(r?.b, 50)), what = str(r?.on, 110);
            if (!a || !b || !what) continue;
            x = { id: `b${++s.seq}`, a, b, on: what, stake: str(r?.stake, 70), st: 'open', mes: i, src: 'post', at: Date.now() };
            s.list.push(x);
            changed = true;
        }
        if (st !== 'open' && x.st === 'open') { x.st = st; x.endMes = i; changed = true; }
    }
    if (s.list.length > 60) s.list.splice(0, s.list.length - 60);
    if (changed) A.saveMeta();
}

export function betsPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const o = open().slice(-3).map(x => `${A.shortName(x.a)} поспорил(а) с ${A.shortName(x.b)}, что ${x.on}${x.stake ? ` — на кону ${x.stake}` : ''}`);
    const d = owed().slice(-2).map(x => `${A.shortName(loser(x))} проспорил(а) ${A.shortName(winner(x))}: должен(на) ${x.stake}`);
    if (!o.length && !d.length) return '';
    return `[Пари: ${[...o, ...d].join('; ')}. О пари помнят: подначивают, следят за исходом, проигравший платит — или выкручивается, и ему это припоминают.]`;
}

export function betsSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const o = open().slice(-4).reverse(), d = owed().slice(-3).reverse();
    if (!o.length && !d.length) return '';
    const card = (x, done) => `<div class="lf-bet${done ? ' done' : ''}">
        <div class="lf-bet-h">${A.ava(x.a, 'xs')}<i>vs</i>${A.ava(x.b, 'xs')}<b>${esc(x.on)}</b></div>
        <div class="lf-bet-f">${x.stake ? `<span class="lf-bet-stake">${esc(x.stake)}</span>` : '<span></span>'}${done
        ? `<span>${esc(A.shortName(loser(x)))} должен(на)</span><button data-act="bet-paid" data-id="${x.id}">${A.icon('check')} отдал(а)</button>`
        : `<button data-act="bet-won" data-id="${x.id}">${esc(A.shortName(x.a))} выиграл(а)</button><button data-act="bet-lost" data-id="${x.id}">проиграл(а)</button><button data-act="bet-del" data-id="${x.id}">${A.icon('x')}</button>`}</div>
    </div>`;
    return `${A.sec('Пари', o.length ? `${o.length} открыто` : 'долги')}<div class="lf-bets">${o.map(x => card(x, false)).join('')}${d.map(x => card(x, true)).join('')}</div>`;
}

export function betsClick(act, el) {
    if (!act.startsWith('bet-')) return false;
    const s = M();
    const x = s.list.find(y => y.id === el.dataset.id);
    if (x) {
        if (act === 'bet-won' || act === 'bet-lost') { x.st = act.slice(4); x.endMes = A.chatArr().length - 1; }
        if (act === 'bet-paid') x.paid = true;
        if (act === 'bet-del') s.list.splice(s.list.indexOf(x), 1);
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function betsRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.list) {
        if (x.mes === i && x.src === 'post') out.push({ id: `bet:${x.id}`, g: 'Пари', icon: 'flag', t: `пари: ${A.shortName(x.a)} с ${A.shortName(x.b)} — ${x.on}`, del: () => { s.list = s.list.filter(y => y !== x); } });
        else if (x.endMes === i) out.push({ id: `bet:${x.id}:end`, g: 'Пари', icon: 'flag', t: `пари решилось: ${x.on}`, del: () => { x.st = 'open'; delete x.endMes; } });
    }
    return out;
}
