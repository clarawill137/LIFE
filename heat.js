// Ход близости и следы на теле (18+, выключается целиком). Пока идёт секс, Летописец ведёт ход сцены:
// фаза (прелюдия → акт → пик → после → послесвечение), заход, поза и кто ведёт, защита, темп — и что нужно после.
// Часы сцены считают, сколько она идёт по времени истории и что за это время прошло мимо по календарю.
// Следы (засосы, укусы, царапины, синяки от пальцев — и после драки тоже) живут, пока не сойдут по времени истории:
// модель помнит, что их видно, и их прячут или замечают. Идея — «Ход сцены», «Часы сцены» и «Следы»
// TavernOS HUD (alewwi), см. NOTICE-HUD.md; схемы-«рентгены» оттуда не переносились.

import { storyNow, span, clamp, str, arr, clone } from './hudkit.js';

let A = null;
export function initHeat(api) { A = api; }
const esc = (v) => A.esc(v);

const PHASES = [['fore', 'прелюдия'], ['act', 'акт'], ['peak', 'пик'], ['after', 'после'], ['glow', 'послесвечение']];
const PH = Object.fromEntries(PHASES);
const HOT = /(секс|трах|раздева|расст[её]г|стон|целу|поцелу|в постел|оргазм|кончи|возбужд|ласка|член|грудь|бёдр|бедр|нагот|голы[йе]|голая|обнаж)/i;

function cfg() {
    const s = A.settings();
    if (!s.heat || typeof s.heat !== 'object') s.heat = {};
    if (s.heat.on === undefined) s.heat.on = true;
    if (s.heat.marks === undefined) s.heat.marks = true;
    return s.heat;
}
const on = () => cfg().on !== false;
const marksOn = () => cfg().marks !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.heat || typeof cm.heat !== 'object') cm.heat = {};
    const s = cm.heat;
    if (!Array.isArray(s.marks)) s.marks = [];
    if (!Array.isArray(s.past)) s.past = [];
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const live = () => !!M().cur;

/** Спрашивать ли Летописца про ход сцены: режим секса, уже идёт, или пост сам об этом. */
function wanted(i) {
    if (live()) return true;
    try { const n = A.moodNow?.(); if (n?.intimOn || n?.intimLevel) return true; } catch { /* */ }
    return HOT.test(A.plainText(A.chatArr()[i]?.mes || '').slice(0, 6000));
}

const RULE_HEAT = `
heat — ход сексуальной сцены (взрослые, по согласию). ТОЛЬКО если в посте идёт или только что закончился секс, иначе null: {"phase":"fore|act|peak|after|glow","round":1,"pos":"поза и кто ведёт, 2-8 слов","prot":"защита: есть / нет / не нужна / не ясно","pace":6,"need":"что нужно после: вода, плед, обнять, душ, тишина — 2-8 слов; только для after и glow","again":"готовность ко второму заходу, 2-6 слов; только для after и glow"}. fore — прелюдия, act — сам акт, peak — пик, after — сразу после (забота), glow — послесвечение, сцена отпускает. round — какой по счёту заход; pace — темп 0-10.`;
const RULE_MARKS = `
marks — следы на теле, ПОЯВИВШИЕСЯ в этом посте (засос, укус, царапины от ногтей, синяк от пальцев, натёртость, разбитая губа — после секса или драки): [{"who":"на ком","what":"что","where":"где на теле","by":"кто оставил, или пусто","days":3,"seen":true}]. days — за сколько дней сойдёт; seen — видно ли в обычной одежде. Раны и травмы сюда не идут. Нечего — [].`;

export function heatChron(i) {
    if (!A?.hasChat?.() || !on()) return null;
    const s = M();
    const ask = wanted(i);
    const key = [ask ? '"heat": null' : '', marksOn() ? '"marks": []' : ''].filter(Boolean).join(', ');
    if (!key) return null;
    const c = s.cur;
    return { key, rule: `${ask ? RULE_HEAT : ''}${marksOn() ? RULE_MARKS : ''}`, tokens: (ask ? 140 : 0) + (marksOn() ? 110 : 0), input: ask ? `Ход близости: ${c ? `${PH[c.phase]}, заход ${c.round}${c.pos ? `, ${c.pos}` : ''}` : 'не идёт'}` : '' };
}

function finish(i) {
    const s = M();
    const c = s.cur;
    if (!c) return;
    const now = storyNow(A);
    const done = { from: c.from, to: i, ts: c.ts || null, end: now, rounds: c.round, pace: c.pace.slice(-40), need: c.need || '', again: c.again || '', prot: c.prot || '' };
    done.missed = missed(c.ts, now);
    s.past.push(done);
    if (s.past.length > 30) s.past.splice(0, s.past.length - 30);
    s.cur = null;
    s.ended = { mes: i, missed: done.missed, dur: c.ts && now ? now - c.ts : 0, need: done.need };
}

/** Что по календарю Life прошло мимо, пока сцена шла (сегодняшние дела со временем между началом и «сейчас»). */
function missed(from, to) {
    if (!from || !to || to <= from) return [];
    const out = [];
    try {
        for (const x of arr(A.chatMeta().cal?.list)) {
            if (x?.st && x.st !== 'open') continue;
            const d = A.parseDate(x?.d);
            const t = String(x?.time || '').match(/(\d{1,2})[:.](\d{2})/);
            if (!d || isNaN(d) || !t) continue;
            d.setHours(+t[1], +t[2], 0, 0);
            if (d.getTime() > from && d.getTime() <= to) out.push(`${x.t} (${t[0]})`);
        }
    } catch { /* календаря нет */ }
    return out.slice(0, 3);
}

export function heatAfterPost(i, j) {
    if (!on()) return;
    const cm = A.chatMeta();
    if (cm.heat?.mes === i && cm.heat.before !== undefined) cm.heat = clone(cm.heat.before) || {};
    const s = M();
    const before = clone(s); if (before) delete before.before;
    let changed = false;
    const h = j?.heat;
    if (h && typeof h === 'object' && PH[str(h.phase)]) {
        const phase = str(h.phase);
        if (!s.cur) { if (phase === 'glow') { /* хвост уже закрытой сцены */ } else s.cur = { from: i, ts: storyNow(A), round: 1, pace: [] }; }
        const c = s.cur;
        if (c) {
            c.phase = phase;
            c.round = clamp(Math.round(h.round) || c.round || 1, 1, 12);
            c.pos = str(h.pos, 80) || c.pos || '';
            c.prot = str(h.prot, 30) || c.prot || '';
            c.pace.push(clamp(Math.round(h.pace), 0, 10));
            if (str(h.need)) c.need = str(h.need, 90);
            if (str(h.again)) c.again = str(h.again, 60);
            c.mes = i;
            if (phase === 'glow') finish(i);
            changed = true;
        }
    } else if (s.cur && i - (s.cur.mes ?? i) >= 1) { finish(i); changed = true; }
    if (marksOn()) {
        const now = storyNow(A);
        for (const r of arr(j?.marks).slice(0, 5)) {
            const who = A.canonName(str(r?.who, 50)), what = str(r?.what, 50), where = str(r?.where, 60);
            if (!who || !what) continue;
            if (s.marks.some(x => A.sameName(x.who, who) && A.norm(x.what) === A.norm(what) && A.norm(x.where) === A.norm(where))) continue;
            s.marks.push({ id: `m${++s.seq}`, who, what, where, by: A.canonName(str(r?.by, 50)), days: clamp(Math.round(r?.days) || 3, 1, 30), seen: r?.seen !== false, ts: now, at: Date.now(), mes: i });
            changed = true;
        }
        if (s.marks.length > 40) s.marks.splice(0, s.marks.length - 40);
    }
    if (changed) { s.mes = i; s.before = before; A.saveMeta(); }
}

/** Сколько следу осталось: по времени истории, без дат — по настоящим дням. */
function left(x) {
    const now = storyNow(A);
    const total = x.days * 86400000;
    const gone = x.ts && now !== null ? now - x.ts : Date.now() - (x.at || Date.now());
    return { ms: total - gone, part: clamp(1 - gone / total, 0, 1) };
}
const fresh = () => M().marks.filter(x => left(x).ms > 0);

export function heatPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const out = [];
    const c = s.cur;
    if (c) {
        const now = storyNow(A);
        const dur = c.ts && now ? `, идёт ${span(now - c.ts)}` : '';
        out.push(`[Ход близости: ${PH[c.phase]}, заход ${c.round}${dur}${c.pos ? `; ${c.pos}` : ''}${c.prot ? `; защита: ${c.prot}` : ''}. Продолжай с этой точки: фазу не перескакивай и не обрывай, поза меняется только действием; после пика — забота и «после», а не резкая смена сцены.]`);
    } else if (s.ended && A.chatArr().length - 1 - s.ended.mes <= 2) {
        const e = s.ended;
        out.push(`[После близости${e.dur ? ` (сцена шла ${span(e.dur)})` : ''}${e.need ? `: сейчас нужно — ${e.need}` : ''}.${e.missed?.length ? ` Пока они были заняты, прошло мимо: ${e.missed.join('; ')} — это может всплыть (пропущенный звонок, остывший ужин, кто-то ждал).` : ''} Тела ещё помнят: усталость, чувствительность, тепло.]`);
    }
    if (marksOn()) {
        const list = fresh();
        // раз в три ответа — или сразу, если появился новый след
        const n = A.chatArr().length;
        const isNew = list.some(x => n - 1 - x.mes <= 2);
        if (list.length && (isNew || n % 3 === 0)) {
            const rows = list.slice(-6).map(x => `${A.shortName(x.who)} — ${x.what}${x.where ? `: ${x.where}` : ''}${x.by ? ` (от ${A.shortName(x.by)})` : ''}, ещё ~${span(left(x).ms)}, ${x.seen ? 'на виду' : 'под одеждой'}`);
            out.push(`[Следы на теле: ${rows.join('; ')}. Следы не исчезают за ночь: они меняют цвет и ноют, их прячут воротником или замечают другие — к месту, не в каждом ответе.]`);
        }
    }
    return out.join('\n');
}

const spark = (p) => {
    if (p.length < 2) return '';
    const w = 220, h = 34, step = w / (p.length - 1);
    const pts = p.map((v, k) => `${(k * step).toFixed(1)},${(h - 3 - (v / 10) * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg class="lf-ht-pace" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
};

function marksHtml(list) {
    if (!list.length) return '';
    return `<div class="lf-ht-marks">${list.map(x => { const l = left(x); return `<div class="lf-ht-m${x.seen ? ' seen' : ''}">${A.ava(x.who, 'xs')}<span><b>${esc(x.what)}</b>${x.where ? ` · ${esc(x.where)}` : ''}<small>${x.by ? `от ${esc(A.shortName(x.by))} · ` : ''}ещё ~${span(l.ms)} · ${x.seen ? 'на виду' : 'под одеждой'}</small><i><u style="width:${Math.round(l.part * 100)}%"></u></i></span><button data-act="ht-mdel" data-id="${x.id}" title="сошёл">${A.icon('x')}</button></div>`; }).join('')}</div>`;
}

export function heatSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const c = s.cur;
    const marks = marksOn() ? fresh() : [];
    let top = '';
    if (c) {
        const now = storyNow(A);
        const idx = PHASES.findIndex(p => p[0] === c.phase);
        const miss = missed(c.ts, now);
        top = `${A.sec('Ход близости', [PH[c.phase], `заход ${c.round}`, c.ts && now ? span(now - c.ts) : ''].filter(Boolean).join(' · '))}
        <div class="lf-ht">
            <div class="lf-ht-track">${PHASES.map((p, k) => `<span class="${k < idx ? 'done' : k === idx ? 'on' : ''}"><i></i>${p[1]}</span>`).join('')}</div>
            ${spark(c.pace)}
            ${c.pos ? `<div class="lf-ht-r"><small>как</small>${esc(c.pos)}</div>` : ''}
            ${c.prot ? `<div class="lf-ht-r"><small>защита</small>${esc(c.prot)}</div>` : ''}
            ${c.need ? `<div class="lf-ht-r"><small>после</small>${esc(c.need)}</div>` : ''}
            ${miss.length ? `<div class="lf-ht-r miss"><small>мимо</small>${esc(miss.join('; '))}</div>` : ''}
            <button class="lf-btn ghost full" data-act="ht-end">${A.icon('check')} Сцена закончилась</button>
        </div>`;
    } else if (s.ended && A.chatArr().length - 1 - s.ended.mes <= 4) {
        const e = s.ended;
        top = `${A.sec('После близости', e.dur ? `шла ${span(e.dur)}` : '')}<div class="lf-ht">${e.need ? `<div class="lf-ht-r"><small>нужно</small>${esc(e.need)}</div>` : ''}${e.missed?.length ? `<div class="lf-ht-r miss"><small>прошло мимо</small>${esc(e.missed.join('; '))}</div>` : ''}${!e.need && !e.missed?.length ? '<div class="lf-hint">Сцена отпустила.</div>' : ''}</div>`;
    }
    if (!top && !marks.length) return '';
    return `${top}${marks.length ? `${A.sec('Следы на теле', String(marks.length))}${marksHtml(marks)}` : ''}`;
}

/** Персонаж → Жизнь → Психика: следы этого человека. */
export function heatHtml(who) {
    if (!on() || !marksOn()) return '';
    const list = fresh().filter(x => A.sameName(x.who, who));
    return list.length ? `${A.sec('Следы на теле', String(list.length))}${marksHtml(list)}` : '';
}

export function heatClick(act, el) {
    if (!act.startsWith('ht-')) return false;
    const s = M();
    if (act === 'ht-end' && s.cur) finish(A.chatArr().length - 1);
    if (act === 'ht-mdel') s.marks = s.marks.filter(x => x.id !== el.dataset.id);
    delete s.before;
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

/** Сцена закончилась на посте i? (для дневника тела) */
export const heatEndedAt = (i) => M().ended?.mes === i;

export function heatRecs(i) {
    const s = M();
    const out = [];
    if (s.mes === i && s.before !== undefined && (s.cur?.mes === i || s.ended?.mes === i)) out.push({ id: 'ht', g: 'Близость', icon: 'heart', t: `ход близости: ${s.cur ? PH[s.cur.phase] : 'закончилась'}`, del: () => { const keep = s.marks; A.chatMeta().heat = clone(s.before) || {}; M().marks = keep; } });
    for (const x of s.marks) if (x.mes === i) out.push({ id: `ht:${x.id}`, g: 'Близость', icon: 'heart', t: `след: ${A.shortName(x.who)} — ${x.what}${x.where ? `, ${x.where}` : ''}`, del: () => { M().marks = M().marks.filter(y => y.id !== x.id); } });
    return out;
}
