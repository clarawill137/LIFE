// Ивенты: гала, свадьба, вечеринка, день рождения, похороны — поверх «Приглашений» и Календаря. Гости с ответом
// (придёт / может / нет) и главным: знает ли, что Хеди жива; рассадка по столам с драмой (кто кому не доверяет —
// за одним столом, кто не знает правды — рядом с ней); наряд — из Гардероба; клятвы — её почерком (Life «Почерк»);
// «Оператор» вместо фотографа — кадр с ивента с лицами гостей. В день ивента модель знает гостей, рассадку и тайну.

import { str, arr, storyDay } from './hudkit.js';
import { handOf } from './hand.js';

let A = null;
export function initEvents(api) { A = api; }
const esc = (v) => A.esc(v);
const sn = (n) => A.shortName(n);

export const EV_KINDS = { gala: ['Гала', '🥂', 'party'], wedding: ['Свадьба', '💍', 'wedding'], party: ['Вечеринка', '🎉', 'party'], birthday: ['День рождения', '🎂', 'holiday'], dinner: ['Ужин', '🍷', 'dinner'], funeral: ['Прощание', '🕯', 'meeting'] };
const RSVP = { '?': 'не ответил', yes: 'придёт', maybe: 'может быть', no: 'не придёт' };
const NEXT = { '?': 'yes', yes: 'maybe', maybe: 'no', no: '?' };

const on = () => A.settings().events?.on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.ev || typeof cm.ev !== 'object') cm.ev = {};
    const s = cm.ev;
    if (!Array.isArray(s.list)) s.list = [];   // { id, kind, name, date, time, place, guests: [{ n, r, knows, t }], tables, seats: [[names]], drama: [], vows: { name: text }, photos: [{ img, at }], cal }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const evById = (id) => M().list.find(x => x.id === id) || null;
const curEv = () => evById(M().cur) || M().list[M().list.length - 1] || null;
const isToday = (x) => { const d = storyDay(A); return !!d && !!x?.date && A.norm(x.date) === A.norm(d); };

export function evAdd({ kind = 'gala', name = '', date = '', time = '', place = '' } = {}) {
    const s = M();
    const k = EV_KINDS[kind] ? kind : 'gala';
    const x = { id: `e${++s.seq}`, kind: k, name: str(name, 80) || EV_KINDS[k][0], date: str(date, 20), time: str(time, 10), place: str(place, 80), guests: [], tables: 3, seats: [], drama: [], vows: {}, photos: [] };
    for (const n of [A.ctx().name1, ...(A.groupMembers?.() || [])].map(A.canonName).filter(Boolean)) if (!x.guests.some(g => A.sameName(g.n, n))) x.guests.push({ n, r: 'yes', knows: true });
    s.list.push(x);
    s.cur = x.id;
    A.saveMeta();
    return x;
}
export function guestAdd(x, name, knows = false) {
    const n = A.canonName(str(name, 60));
    if (!n || x.guests.some(g => A.sameName(g.n, n))) return false;
    x.guests.push({ n, r: '?', knows: !!knows });
    A.saveMeta();
    return true;
}

/** Напряжение пары: низкое доверие и далёкость — повод для драмы. */
function tension(a, b) {
    try {
        const r1 = A.relOf?.(a, b), r2 = A.relOf?.(b, a);
        const t = Math.min(Number(r1?.trust ?? 60), Number(r2?.trust ?? 60));
        const c = Math.min(Number(r1?.closeness ?? 50), Number(r2?.closeness ?? 50));
        return Math.max(0, 55 - t) + Math.max(0, 30 - c) * 0.5;
    } catch { return 0; }
}
/** Рассадка с драмой: по столам случайно, потом драма — кто кому не доверяет, и кто не знает правды рядом с Хеди. */
export function seat(x) {
    const going = x.guests.filter(g => g.r !== 'no').map(g => g.n);
    const T = Math.max(1, Math.min(8, Number(x.tables) || 3));
    const pool = [...going].sort(() => Math.random() - 0.5);
    const seats = Array.from({ length: T }, () => []);
    pool.forEach((n, i) => seats[i % T].push(n));
    const me = A.canonName(A.ctx().name1);
    const drama = [];
    for (const t of seats) {
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const v = tension(t[i], t[j]); if (v >= 25) drama.push({ a: t[i], b: t[j], v, t: `${sn(t[i])} и ${sn(t[j])} за одним столом — между ними холодно` }); }
        if (t.some(n => A.sameName(n, me))) for (const n of t) { const g = x.guests.find(y => A.sameName(y.n, n)); if (g && !g.knows) drama.push({ a: me, b: n, v: 30, t: `${sn(n)} не знает, что Хеди жива, — и сидит рядом с ней` }); }
    }
    drama.sort((a, b) => b.v - a.v);
    x.seats = seats;
    x.drama = drama.slice(0, 5).map(d => d.t);
    A.saveMeta();
    return x;
}

// ───────────── умная модель: гости и клятвы ─────────────

const GUESTS_SYS = `Ты помогаешь с ивентом в ролевой истории God Complex (AU по Marvel): Хеди Барлоу (дочь Тони Старка; мир считал её погибшей) и Баки Барнс. Предложи гостей ИЗ ИСТОРИИ под этот ивент и эпоху; для каждого — знает ли он, что Хеди жива (по истории), и одна фраза, с чем он придёт.
Только JSON: {"guests":[{"name":"","knows":true,"note":""}]}`;
export async function guestsGen(x) {
    const msgs = [{ role: 'system', content: GUESTS_SYS }, { role: 'user', content: `Ивент: ${EV_KINDS[x.kind][0]} «${x.name}», ${x.date || 'дата не задана'}, ${x.place || 'место не задано'}. Уже в списке: ${x.guests.map(g => g.n).join(', ')}. Предложи ещё 5–8.` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 1800, { what: 'гости ивента' }, {}) : A.extractJson(await A.askModel(msgs, 1200));
    let n = 0;
    for (const g of arr(j?.guests).slice(0, 10)) { if (guestAdd(x, g?.name, g?.knows === true)) { const y = x.guests[x.guests.length - 1]; y.t = str(g?.note, 140); n++; } }
    A.saveMeta();
    return n;
}
const VOWS_SYS = `Напиши свадебную клятву от лица персонажа ролевой истории God Complex (AU по Marvel) — его голосом и характером, по-русски, 5–9 предложений, по-живому, без штампов и пафоса; опирайся на то, что они прожили в истории. Только JSON: {"text":""}`;
export async function vowsGen(x, who) {
    const other = x.guests.find(g => !A.sameName(g.n, who) && (A.sameName(g.n, A.ctx().name1) || /баки|bucky|барнс/i.test(g.n)))?.n || '';
    const msgs = [{ role: 'system', content: VOWS_SYS }, { role: 'user', content: `Клятва: ${who}${other ? ` → ${other}` : ''}. Ивент: ${x.name}, ${x.place || ''}.` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 1200, { what: 'клятва' }, { who: [who, other].filter(Boolean) }) : A.extractJson(await A.askModel(msgs, 900));
    const t = str(j?.text, 2000);
    if (!t) throw new Error('клятва не написалась');
    x.vows[A.canonName(who)] = t;
    A.saveMeta();
    return t;
}

// ───────────── оператор: кадр с ивента ─────────────

export async function evShot(x) {
    const going = x.guests.filter(g => g.r !== 'no').map(g => g.n);
    const who = going.slice(0, 3);
    const prompt = `A candid photo from ${EV_KINDS[x.kind][0] === 'Свадьба' ? 'a wedding' : EV_KINDS[x.kind][0] === 'Прощание' ? 'a memorial gathering' : `a ${x.kind}`}: "${x.name}"${x.place ? ` at ${x.place}` : ''}. Guests in festive clothes${who.length ? `; in the frame: ${who.map((n, i) => `${sn(n)} (reference image ${i + 1}, keep the face)`).join(', ')}` : ''}. A real moment caught by the event photographer, warm light, depth, no posing.\nStyle: ${A.style?.() || ''}. No text.`;
    const img = await A.drawPicture(prompt, { aspect: '3:2', prefix: 'life_ev', who });
    x.photos.push({ img, at: storyDay(A) });
    A.saveMeta();
    return img;
}

// ───────────── модели ─────────────

export function evPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const x = M().list.find(isToday);
    if (!x) return '';
    const yes = x.guests.filter(g => g.r === 'yes' || g.r === 'maybe');
    const know = yes.filter(g => g.knows).map(g => sn(g.n)), dont = yes.filter(g => !g.knows).map(g => sn(g.n));
    const seats = (x.seats || []).map((t, i) => `стол ${i + 1}: ${t.map(sn).join(', ')}`).join('; ');
    const vows = Object.keys(x.vows || {}).length ? `; клятвы готовы у: ${Object.keys(x.vows).map(sn).join(', ')}` : '';
    return `[Ивент сегодня: ${EV_KINDS[x.kind][0]} «${x.name}»${x.place ? `, ${x.place}` : ''}${x.time ? `, ${x.time}` : ''}. Гости: ${yes.map(g => sn(g.n)).join(', ') || '—'}.${know.length ? ` Знают, что Хеди жива: ${know.join(', ')}.` : ''}${dont.length ? ` НЕ знают: ${dont.join(', ')} — при них осторожно.` : ''}${seats ? ` Рассадка — ${seats}.` : ''}${x.drama?.length ? ` Где искрит: ${x.drama.join('; ')}.` : ''}${vows}]`;
}

// ───────────── экран ─────────────

const ui = { form: false, kind: 'gala', vow: '' };
function tablesSvg(x) {
    const seats = x.seats || [];
    if (!seats.length) return '';
    const W = 340, cols = Math.min(3, seats.length), rows = Math.ceil(seats.length / cols), R = 30, cell = W / cols;
    let h = `<svg class="lf-ev-tables" viewBox="0 0 ${W} ${rows * 112}">`;
    seats.forEach((t, i) => {
        const cx = cell * (i % cols) + cell / 2, cy = 56 + 112 * Math.floor(i / cols);
        h += `<circle cx="${cx}" cy="${cy}" r="${R}" class="tb"/><text x="${cx}" y="${cy + 4}" class="tn">${i + 1}</text>`;
        t.forEach((n, k) => { const a = (k / Math.max(1, t.length)) * Math.PI * 2 - Math.PI / 2; const px = cx + Math.cos(a) * (R + 14), py = cy + Math.sin(a) * (R + 14); h += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="11" class="gs"/><text x="${px.toFixed(1)}" y="${(py + 3.5).toFixed(1)}" class="gn">${esc(sn(n).slice(0, 2))}</text>`; });
    });
    return `${h}</svg>`;
}
function handCls(who) { try { const h = handOf(who); return h ? `lf-hand lf-hand-${h[2]}` : ''; } catch { return ''; } }
export function evSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const x = curEv();
    const list = s.list.map(e => `<button class="lf-chip${x?.id === e.id ? ' on' : ''}" data-act="ev-pick" data-id="${e.id}">${EV_KINDS[e.kind][1]} ${esc(e.name)}${e.date ? ` · ${esc(e.date)}` : ''}</button>`).join('');
    const form = ui.form || !x ? `<div class="lf-ev-form">
        <div class="lf-chips wrap">${Object.entries(EV_KINDS).map(([k, [l, e]]) => `<button class="lf-chip${ui.kind === k ? ' on' : ''}" data-act="ev-kind" data-v="${k}">${e} ${l}</button>`).join('')}</div>
        <div class="lf-field"><label>Название</label><input data-evf="name" placeholder="Гала фонда Старка"></div>
        <div class="lf-field"><label>Дата (как в истории)</label><input data-evf="date" placeholder="${esc(storyDay(A) || '24.12.2024')}"></div>
        <div class="lf-field"><label>Время и место</label><input data-evf="time" placeholder="19:00"><input data-evf="place" placeholder="Метрополитен-музей"></div>
        <button class="lf-btn primary wide" data-act="ev-add">Завести ивент</button></div>` : '';
    if (!x) return `${A.sec('Ивенты')}<div class="lf-empty small">Гала, свадьба, вечеринка — гости, кто знает правду, рассадка с драмой, клятвы, фото.</div>${form}`;
    const guests = x.guests.map(g => `<div class="lf-ev-g r-${g.r === '?' ? 'q' : g.r}"><button class="lf-ev-gn" data-act="ev-rsvp" data-id="${x.id}" data-v="${esc(g.n)}"><b>${esc(sn(g.n))}</b><small>${RSVP[g.r]}</small></button><button class="lf-mini${g.knows ? ' on' : ''}" data-act="ev-knows" data-id="${x.id}" data-v="${esc(g.n)}" title="знает, что Хеди жива">${g.knows ? '👁 знает' : '🙈 не знает'}</button>${g.t ? `<small class="lf-ev-gt">${esc(g.t)}</small>` : ''}</div>`).join('');
    const vowers = x.kind === 'wedding' ? x.guests.filter(g => A.sameName(g.n, A.ctx().name1) || /баки|bucky|барнс/i.test(g.n)).map(g => g.n) : [];
    return `${A.sec('Ивенты', `${s.list.length}`)}
        <div class="lf-chips wrap">${list}<button class="lf-chip" data-act="ev-new">+ ивент</button></div>
        ${form}
        <div class="lf-ev-card"><b>${EV_KINDS[x.kind][1]} ${esc(x.name)}</b><small>${esc([EV_KINDS[x.kind][0], x.date, x.time, x.place].filter(Boolean).join(' · '))}${isToday(x) ? ' · СЕГОДНЯ' : ''}</small>
            <div class="lf-actions"><button class="lf-btn" data-act="ev-cal" data-id="${x.id}">${x.cal ? '✓ в календаре' : '→ в календарь'}</button><button class="lf-btn" data-act="ev-dress">👗 Наряд</button><button class="lf-btn" data-act="ev-shot" data-id="${x.id}">📸 Оператор</button></div></div>
        ${A.sec('Гости', `${x.guests.filter(g => g.r === 'yes').length} придут · ${x.guests.filter(g => !g.knows).length} не знают правды`)}
        <div class="lf-ev-gs">${guests}</div>
        <div class="lf-field"><input data-evf="guest" placeholder="Добавить гостя"></div>
        <div class="lf-actions"><button class="lf-btn" data-act="ev-guest" data-id="${x.id}">+ Гость</button><button class="lf-btn primary" data-act="ev-guests" data-id="${x.id}">✦ Кого звать — по истории</button></div>
        ${A.sec('Рассадка', `столов: ${x.tables}`)}
        <div class="lf-chips wrap">${[2, 3, 4, 5, 6].map(n => `<button class="lf-chip${x.tables === n ? ' on' : ''}" data-act="ev-tables" data-id="${x.id}" data-v="${n}">${n}</button>`).join('')}<button class="lf-chip" data-act="ev-seat" data-id="${x.id}">🎲 Рассадить с драмой</button></div>
        ${tablesSvg(x)}
        ${(x.drama || []).length ? `<div class="lf-note">⚡ ${x.drama.map(esc).join('<br>⚡ ')}</div>` : ''}
        ${vowers.length ? `${A.sec('Клятвы')}${vowers.map(v => `<div class="lf-ev-vow"><b>${esc(sn(v))}</b>${x.vows?.[A.canonName(v)] ? `<div class="lf-ev-paper ${handCls(v)}">${esc(x.vows[A.canonName(v)]).replace(/\n/g, '<br>')}</div>` : ''}<div class="lf-actions"><button class="lf-mini" data-act="ev-vow" data-id="${x.id}" data-v="${esc(v)}">✦ ${x.vows?.[A.canonName(v)] ? 'переписать' : 'написать'} его голосом</button></div></div>`).join('')}` : ''}
        ${(x.photos || []).length ? `${A.sec('Кадры')}<div class="lf-ev-ph">${x.photos.map(p => `<button data-act="ev-zoom" data-v="${esc(p.img)}"><img src="${esc(p.img)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        <div class="lf-actions"><button class="lf-btn ghost" data-act="ev-del" data-id="${x.id}">Удалить ивент</button></div>`;
}
export const evState = () => { try { const t = M().list.find(isToday); return t ? 'сегодня' : M().list.length ? String(M().list.length) : ''; } catch { return ''; } };

export async function evClick(act, el) {
    const x = el.dataset.id ? evById(el.dataset.id) : curEv();
    const v = el.dataset.v;
    const val = (k) => el.closest('.lf-hub, #lf-app, body')?.querySelector(`[data-evf="${k}"]`)?.value || '';
    switch (act) {
        case 'ev-new': ui.form = !ui.form; break;
        case 'ev-kind': ui.kind = v; break;
        case 'ev-pick': M().cur = el.dataset.id; ui.form = false; A.saveMeta(); break;
        case 'ev-add': { const box = el.closest('.lf-ev-form'); const g = (k) => box?.querySelector(`[data-evf="${k}"]`)?.value || ''; evAdd({ kind: ui.kind, name: g('name'), date: g('date'), time: g('time'), place: g('place') }); ui.form = false; break; }
        case 'ev-rsvp': { const g = x?.guests.find(y => A.sameName(y.n, v)); if (g) { g.r = NEXT[g.r] || 'yes'; A.saveMeta(); } break; }
        case 'ev-knows': { const g = x?.guests.find(y => A.sameName(y.n, v)); if (g) { g.knows = !g.knows; A.saveMeta(); } break; }
        case 'ev-guest': if (x && !guestAdd(x, val('guest'))) A.toast('info', 'Впиши имя — или такой гость уже есть'); break;
        case 'ev-guests': if (x) { const n = await A.withBusy(el, () => guestsGen(x), 'Вспоминаю, кого звать…'); A.toast('success', `Гостей добавлено: ${n || 0}`); } break;
        case 'ev-tables': if (x) { x.tables = Number(v) || 3; A.saveMeta(); } break;
        case 'ev-seat': if (x) { seat(x); A.toast('info', x.drama.length ? `Искрит: ${x.drama.length}` : 'Рассадили мирно'); } break;
        case 'ev-cal': if (x && !x.cal) { const d = A.parseDate?.(x.date); if (!d || isNaN(d)) { A.toast('info', 'Сначала дата ивента'); return; } const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; x.cal = A.cal?.add?.({ t: `${EV_KINDS[x.kind][0]}: ${x.name}${x.place ? ` (${x.place})` : ''}`, d: iso, time: x.time || '', who: x.guests.filter(g => g.r !== 'no').map(g => g.n), kind: EV_KINDS[x.kind][2] }) || 'yes'; A.saveMeta(); A.toast('success', 'В календаре'); } break;
        case 'ev-dress': if (globalThis.Wardrobe?.open) globalThis.Wardrobe.open('worn', A.ctx().name1); else A.toast('info', 'Гардероб не найден'); return;
        case 'ev-shot': if (x) await A.withBusy(el, () => evShot(x), 'Оператор снимает…'); break;
        case 'ev-zoom': A.lightbox?.(v, ''); return;
        case 'ev-vow': if (x) await A.withBusy(el, () => vowsGen(x, v), 'Пишет клятву…'); break;
        case 'ev-del': if (x) { M().list = M().list.filter(y => y !== x); M().cur = ''; A.saveMeta(); } break;
        default: return;
    }
    A.updatePrompt?.(); A.render();
}
export const _ev = { M, tension, isToday };
