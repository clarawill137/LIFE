// Должки: кто кому должен по-крупному — услуга, сделка, жизнь, тайна (бытовые долги ведёт «Быт» в home.js, они
// здесь же, строкой ниже). Летописец замечает новые должки и отданные; «Найти в истории» — умная модель со сводом
// собирает сделки и услуги из всей истории (Шури и Росс за Земо, Фьюри, Мадрипур, Вальден…). Крупный должок
// всплывает сам в неудобный момент — кубиком раз в день истории, как повестка Закулисья, — или по кнопке:
// модель получает «кредитор напоминает сейчас», а потом должок помечается «напомнили».

import { str, arr, similar, storyDay } from './hudkit.js';

let A = null;
export function initDebts(api) { A = api; }
const esc = (v) => A.esc(v);

export const KINDS = { favor: ['услуга', '🤝'], deal: ['сделка', '📜'], life: ['жизнь', '🩸'], secret: ['тайна', '🤫'], money: ['деньги', '💵'] };
const W_WORD = ['', 'мелочь', 'серьёзно', 'смертельно'];

function cfg() {
    const s = A.settings();
    if (!s.debts || typeof s.debts !== 'object') s.debts = {};
    if (s.debts.on === undefined) s.debts.on = true;
    if (s.debts.auto === undefined) s.debts.auto = true;
    return s.debts;
}
const on = () => cfg().on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.dk || typeof cm.dk !== 'object') cm.dk = {};
    const s = cm.dk;
    if (!Array.isArray(s.list)) s.list = [];   // { id, who (должник), to (кому), what, kind, w 1–3, mes, day, st: open|paid|forgiven|called, called }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const open = () => M().list.filter(x => x.st === 'open' || x.st === 'called');
const homeDebts = () => { try { return arr(A.chatMeta().home?.debts).filter(x => !x.paid); } catch { return []; } };
const sn = (n) => A.shortName(n);

/** Добавить (или найти такой же). */
export function dkAdd({ who, to, what, kind = 'favor', w = 2, mes = null, src = 'me' }) {
    who = A.canonName(str(who, 60)); to = A.canonName(str(to, 60)); what = str(what, 160);
    if (!who || !to || !what || A.sameName(who, to)) return null;
    const s = M();
    const old = s.list.find(x => A.sameName(x.who, who) && A.sameName(x.to, to) && (similar(A, x.what, what, 0.5) || A.norm(x.what) === A.norm(what)));
    if (old) return old;
    const x = { id: `d${++s.seq}`, who, to, what, kind: KINDS[kind] ? kind : 'favor', w: Math.max(1, Math.min(3, Math.round(Number(w) || 2))), mes, day: storyDay(A), st: 'open', src };
    s.list.push(x);
    A.saveMeta();
    return x;
}
export function dkSet(id, st) { const x = M().list.find(y => y.id === id); if (x) { x.st = st; x.closed = A.chatArr().length - 1; A.saveMeta(); } return x; }

// ───────────── всплывает ─────────────

const CALL_SYS = `Ты — Закулисье ролевой истории God Complex (AU по Marvel). Должок всплывает: кредитор напоминает о нём СЕЙЧАС — в неудобный момент, но по делу и в своём характере (звонок, визит, записка, человек от него, новость).
Одна-две фразы: кто, как выходит на связь и чего хочет прямо сейчас. Без мелодрамы, без новых персонажей, которых нет в истории. Только JSON: {"line":""}`;
/** Пусть всплывёт: модель пишет, как кредитор напоминает. Без модели — простая строка. */
export async function dkCall(id) {
    const s = M();
    const x = s.list.find(y => y.id === id);
    if (!x) return null;
    let line = '';
    try {
        const msgs = [{ role: 'system', content: CALL_SYS }, { role: 'user', content: `Должок: ${x.who} должен ${x.to} — ${x.what} (${KINDS[x.kind][0]}, ${W_WORD[x.w]}). Где сейчас сцена: ${A.worldState()?.scene?.location || '—'}.` }];
        const j = A.askFillJson ? await A.askFillJson(msgs, 600, { what: 'должок всплывает' }, { who: [x.who, x.to] }) : A.extractJson(await A.askModel(msgs, 400));
        line = str(j?.line, 300);
    } catch (e) { console.warn('[Life] должок', e); }
    if (!line) line = `${sn(x.to)} напоминает ${sn(x.who)} о должке: ${x.what} — и ждёт ответа сейчас.`;
    s.pend = { id: x.id, line, at: A.chatArr().length };
    A.saveMeta(); A.updatePrompt?.();
    return s.pend;
}
/** Раз в день истории: крупный должок может всплыть сам (кубик; смертельный — чаще). */
function dailyRoll() {
    const s = M();
    const day = storyDay(A);
    if (!cfg().auto || !day || s.rolled === day || s.pend) return;
    s.rolled = day;
    const big = open().filter(x => x.st === 'open' && x.w >= 2);
    for (const x of big) {
        const d = 1 + Math.floor(Math.random() * 20);
        if (d >= (x.w >= 3 ? 18 : 20)) { s.auto = x.id; A.saveMeta(); dkCall(x.id).catch(() => { }); return; }
    }
    A.saveMeta();
}

// ───────────── Летописец ─────────────

const RULE = `
dk — крупные должки, появившиеся или закрытые в этом посте: услуга, сделка, долг жизни, тайна, которую держат за кем-то (бытовые деньги и «должен ужин» сюда НЕ идут — это быт): [{"who":"кто должен","to":"кому","what":"что, 3–12 слов","kind":"favor|deal|life|secret","weight":1-3,"st":"new|paid|called"}]. Нечего — [].`;
export function dkChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const o = open().slice(-8).map(x => `${x.who} → ${x.to}: ${x.what}`);
    return { key: '"dk": []', rule: RULE, tokens: 160, input: `Открытые должки: ${o.length ? o.join('; ') : 'нет'}` };
}
export function dkAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    if (s.pend && i >= s.pend.at) { const x = s.list.find(y => y.id === s.pend.id); if (x) { x.st = 'called'; x.called = { mes: i, line: s.pend.line }; } s.pend = null; A.saveMeta(); }
    try { dailyRoll(); } catch { /* */ }
    for (const r of arr(j?.dk).slice(0, 4)) {
        const st = str(r?.st);
        if (st === 'paid' || st === 'called') {
            const who = A.canonName(str(r?.who, 60)), to = A.canonName(str(r?.to, 60)), what = str(r?.what, 160);
            const x = open().find(y => A.sameName(y.who, who) && A.sameName(y.to, to) && (!what || similar(A, y.what, what, 0.4)));
            if (x) { x.st = st; x.closed = i; }
            continue;
        }
        dkAdd({ who: r?.who, to: r?.to, what: r?.what, kind: str(r?.kind), w: r?.weight, mes: i, src: 'chron' });
    }
    A.saveMeta();
}
export function dkRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.list) if (x.mes === i) out.push({ id: `dk:${x.id}`, g: 'Должки', icon: 'handshake', t: `должок: ${sn(x.who)} → ${sn(x.to)}, ${x.what}`, del: () => { s.list = s.list.filter(y => y !== x); } });
    return out;
}

// ───────────── найти в истории ─────────────

const FIND_SYS = `Ты разбираешь ролевую историю God Complex (AU по Marvel). Найди крупные должки между персонажами: кто кому обязан услугой, сделкой, жизнью, молчанием (тайной). Только то, что есть в истории; бытовые мелочи не нужны.
Только JSON: {"items":[{"who":"кто должен","to":"кому","what":"что, 3–12 слов","kind":"favor|deal|life|secret","weight":1-3,"open":true}]}`;
export async function dkFind() {
    const have = M().list.map(x => `${x.who} → ${x.to}: ${x.what}`).join('; ');
    const msgs = [{ role: 'system', content: FIND_SYS }, { role: 'user', content: `Уже записано: ${have || 'ничего'}. Найди остальные (до 10).` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 2200, { what: 'должки из истории' }, {}) : A.extractJson(await A.askModel(msgs, 1500));
    let n = 0;
    for (const r of arr(j?.items).slice(0, 12)) { if (r?.open === false) continue; const before = M().list.length; dkAdd({ who: r.who, to: r.to, what: r.what, kind: str(r.kind), w: r.weight, src: 'story' }); if (M().list.length > before) n++; }
    return n;
}

// ───────────── модели ─────────────

export function dkPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const out = [];
    if (s.pend) out.push(`[Должок всплывает (Должки): ${s.pend.line} Вплети в сцену сейчас — неудобно, но по делу; персонажи отвечают в своём характере.]`);
    const big = open().filter(x => x.w >= 2).slice(-5);
    if (big.length && (A.chatArr().length % 3 === 0 || s.pend)) out.push(`[Должки (фон, помнят все причастные): ${big.map(x => `${sn(x.who)} должен ${sn(x.to)} — ${x.what}${x.st === 'called' ? ' (уже напомнили)' : ''}`).join('; ')}. Всплывает в разговоре к месту, не темой.]`);
    return out.join('\n');
}

// ───────────── экран ─────────────

const ui = { form: false, kind: 'favor', w: 2 };
export function dkSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const list = open();
    const done = s.list.filter(x => x.st === 'paid' || x.st === 'forgiven').slice(-5).reverse();
    const hd = homeDebts();
    const dots = (w) => `<span class="lf-dk-w">${[1, 2, 3].map(k => `<i class="${k <= w ? 'on' : ''}"></i>`).join('')}</span>`;
    const row = (x) => `<div class="lf-dk${x.st === 'called' ? ' called' : ''}${s.pend?.id === x.id ? ' pend' : ''}">
        <div class="lf-dk-h"><b>${KINDS[x.kind][1]} ${esc(sn(x.who))} → ${esc(sn(x.to))}</b>${dots(x.w)}</div>
        <div class="lf-dk-t">${esc(x.what)}</div>
        <small>${esc([KINDS[x.kind][0], W_WORD[x.w], x.day && `с ${x.day}`, x.st === 'called' && 'напомнили'].filter(Boolean).join(' · '))}</small>
        ${s.pend?.id === x.id ? `<div class="lf-note">⚡ ${esc(s.pend.line)}</div>` : ''}
        <div class="lf-dk-a"><button class="lf-mini" data-act="dk-call" data-id="${x.id}">⚡ всплыть</button><button class="lf-mini" data-act="dk-paid" data-id="${x.id}">✓ отдали</button><button class="lf-mini" data-act="dk-forgive" data-id="${x.id}">простили</button></div>
    </div>`;
    return `${A.sec('Должки', list.length ? `открыто ${list.length}` : '')}
        ${list.length ? list.map(row).join('') : '<div class="lf-empty small">Крупных должков не записано.</div>'}
        <div class="lf-actions"><button class="lf-btn primary" data-act="dk-find">✦ Найти в истории</button><button class="lf-btn" data-act="dk-form">+ Свой</button></div>
        ${ui.form ? `<div class="lf-dk-form">
            <div class="lf-field"><label>Кто должен</label><input data-dkf="who" placeholder="Баки"></div>
            <div class="lf-field"><label>Кому</label><input data-dkf="to" placeholder="Шури"></div>
            <div class="lf-field"><label>Что</label><input data-dkf="what" placeholder="услуга за то, что вытащила Земо"></div>
            <div class="lf-chips wrap">${Object.entries(KINDS).filter(([k]) => k !== 'money').map(([k, [l, e]]) => `<button class="lf-chip${ui.kind === k ? ' on' : ''}" data-act="dk-kind" data-v="${k}">${e} ${l}</button>`).join('')}</div>
            <div class="lf-chips wrap">${[1, 2, 3].map(k => `<button class="lf-chip${ui.w === k ? ' on' : ''}" data-act="dk-w" data-v="${k}">${W_WORD[k]}</button>`).join('')}</div>
            <button class="lf-btn primary wide" data-act="dk-add">Записать</button></div>` : ''}
        ${hd.length ? `${A.sec('Бытовые', `${hd.length}`)}${hd.map(x => `<div class="lf-dk small"><div class="lf-dk-h"><b>💵 ${esc(sn(x.who))} → ${esc(sn(x.to))}</b></div><div class="lf-dk-t">${esc(x.what)}</div></div>`).join('')}` : ''}
        ${done.length ? `${A.sec('Закрыто')}${done.map(x => `<div class="lf-dk done"><div class="lf-dk-t">${esc(sn(x.who))} → ${esc(sn(x.to))}: ${esc(x.what)}</div><small>${x.st === 'paid' ? 'отдали' : 'простили'}</small></div>`).join('')}` : ''}
        <div class="lf-chips wrap"><button class="lf-chip${cfg().auto ? ' on' : ''}" data-act="dk-auto">⚡ Всплывают сами: ${cfg().auto ? 'да' : 'нет'}</button></div>
        <div class="lf-hint">Крупный должок может всплыть сам — раз в день истории, кубиком (смертельный — чаще). Кредитор напомнит в следующем ответе.</div>`;
}
export const dkState = () => { try { const n = open().length; return n ? String(n) : ''; } catch { return ''; } };

export async function dkClick(act, el) {
    const id = el.dataset.id;
    if (act === 'dk-call') { await A.withBusy(el, () => dkCall(id), 'Всплывает…'); A.toast('info', 'Всплывёт в следующем ответе'); }
    else if (act === 'dk-paid') dkSet(id, 'paid');
    else if (act === 'dk-forgive') dkSet(id, 'forgiven');
    else if (act === 'dk-find') { const n = await A.withBusy(el, () => dkFind(), 'Ищу в истории…'); A.toast(n ? 'success' : 'info', n ? `Нашлось должков: ${n}` : 'Новых не нашлось'); }
    else if (act === 'dk-form') ui.form = !ui.form;
    else if (act === 'dk-kind') ui.kind = el.dataset.v;
    else if (act === 'dk-w') ui.w = Number(el.dataset.v) || 2;
    else if (act === 'dk-auto') { cfg().auto = !cfg().auto; A.saveSettings(); }
    else if (act === 'dk-add') {
        const box = el.closest('.lf-dk-form');
        const v = (k) => box?.querySelector(`[data-dkf="${k}"]`)?.value || '';
        if (!dkAdd({ who: v('who'), to: v('to'), what: v('what'), kind: ui.kind, w: ui.w })) { A.toast('info', 'Кто, кому и что — обязательно'); return; }
        ui.form = false;
    }
    A.updatePrompt?.(); A.render();
}
export const _dk = { M, dailyRoll, cfg };
