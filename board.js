// Доска расследования: пробка, карточки-улики и красные нитки. Летописец сам кладёт улики из постов (ключ clue),
// она связывает карточки (тап по одной, потом по другой — нитка), умная модель предлагает версии. Модель знает, до
// чего персонажи уже докопались (связанное), и не подсказывает несвязанное. Под Вальдена, Ванду и Вундагор, Дума,
// «прошлое догоняет». Дел может быть несколько.

import { str, arr, similar } from './hudkit.js';

let A = null;
export function initBoard(api) { A = api; }
const esc = (v) => A.esc(v);
const on = () => A.settings().board?.on !== false;
export const KINDS = { clue: '🔎', person: '👤', place: '📍', photo: '📷', doc: '📄' };

function M() {
    const cm = A.chatMeta();
    if (!cm.bd || typeof cm.bd !== 'object') cm.bd = {};
    const s = cm.bd;
    if (!Array.isArray(s.cases)) s.cases = [];
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const caseById = (id) => M().cases.find(c => c.id === id) || null;
export const cur = () => caseById(M().cur) || M().cases[0] || null;
export function caseAdd(name) {
    const s = M();
    const c = { id: `c${++s.seq}`, name: str(name, 60) || `Дело №${s.cases.length + 1}`, cards: [], links: [], theories: [] };
    s.cases.push(c);
    s.cur = c.id;
    A.saveMeta();
    return c;
}
export function cardAdd(c, { t, kind = 'clue', mes = null, src = 'me', img = '' }) {
    t = str(t, 140);
    if (!c || !t || c.cards.some(x => similar(A, x.t, t, 0.6))) return null;
    const s = M();
    const x = { id: `k${++s.seq}`, t, kind: KINDS[kind] ? kind : 'clue', mes, src, img, r: Math.round((Math.random() - 0.5) * 8) };
    c.cards.push(x);
    A.saveMeta();
    return x;
}
export function link(c, a, b, why = '') {
    if (!c || !a || !b || a === b) return null;
    const old = c.links.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    if (old) { c.links = c.links.filter(l => l !== old); A.saveMeta(); return null; }
    const l = { a, b, why: str(why, 100), mes: A.chatArr().length - 1 };
    c.links.push(l);
    A.saveMeta();
    return l;
}

// ───────────── Летописец ─────────────

const RULE = `
clue — новые улики, зацепки, люди и места по расследованию, которые ПРОЗВУЧАЛИ в этом посте (не догадки): [{"t":"3–12 слов","kind":"clue|person|place|doc","case":"какое дело, если ясно"}]. Нечего — [].`;
export function bdChron() {
    if (!A?.hasChat?.() || !on() || !M().cases.length) return null;
    return { key: '"clue": []', rule: RULE, tokens: 140, input: `Дела на доске: ${M().cases.map(c => c.name).join('; ')}` };
}
export function bdAfterPost(i, j) {
    if (!on()) return;
    for (const r of arr(j?.clue).slice(0, 4)) {
        const name = str(r?.case, 60);
        const c = (name && M().cases.find(x => similar(A, x.name, name, 0.5))) || cur();
        if (c) cardAdd(c, { t: r?.t, kind: str(r?.kind), mes: i, src: 'chron' });
    }
}
export function bdRecs(i) {
    const out = [];
    for (const c of M().cases) for (const x of c.cards) if (x.mes === i) out.push({ id: `bd:${x.id}`, g: 'Доска', icon: 'pin', t: `улика: ${x.t}`, del: () => { c.cards = c.cards.filter(y => y !== x); c.links = c.links.filter(l => l.a !== x.id && l.b !== x.id); } });
    return out;
}

// ───────────── версии ─────────────

const TH_SYS = `Ты — следователь-соавтор ролевой истории God Complex (AU по Marvel). По карточкам на доске и ниткам между ними предложи 2–3 версии: что за этим стоит. Каждая — одна-две фразы, насколько правдоподобна (низко|средне|высоко) и что проверить дальше. Не выдумывай фактов, которых нет в истории; не раскрывай того, чего персонажи знать не могут.
Только JSON: {"theories":[{"t":"","odds":"низко|средне|высоко","check":""}]}`;
export async function theories(c) {
    const cards = c.cards.map(x => `${x.id}: ${x.t}`).join('\n');
    const links = c.links.map(l => `${l.a} — ${l.b}${l.why ? ` (${l.why})` : ''}`).join('\n');
    const msgs = [{ role: 'system', content: TH_SYS }, { role: 'user', content: `Дело: ${c.name}\nКарточки:\n${cards || '—'}\nНитки:\n${links || '—'}` }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 1600, { what: 'версии' }, {}) : A.extractJson(await A.askModel(msgs, 1200));
    c.theories = arr(j?.theories).slice(0, 3).map(t => ({ t: str(t?.t, 300), odds: str(t?.odds, 10), check: str(t?.check, 160) })).filter(t => t.t);
    A.saveMeta();
    return c.theories.length;
}

// ───────────── модели ─────────────

export function bdPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const c = cur();
    if (!c || !c.cards.length) return '';
    if (A.chatArr().length % 3 !== 0 && !c.fresh) return '';
    const card = (id) => c.cards.find(x => x.id === id)?.t || '';
    const known = c.links.map(l => `${card(l.a)} ↔ ${card(l.b)}${l.why ? ` (${l.why})` : ''}`).filter(Boolean);
    const loose = c.cards.filter(x => !c.links.some(l => l.a === x.id || l.b === x.id)).map(x => x.t);
    c.fresh = false;
    return `[Доска расследования «${c.name}»: ${known.length ? `персонажи уже связали — ${known.join('; ')}` : 'пока ничего не связали'}.${loose.length ? ` Есть, но не связано (сами не догадались — не подсказывай): ${loose.slice(0, 6).join('; ')}.` : ''}]`;
}

// ───────────── экран ─────────────

const ui = { pick: '', form: false };
function boardSvg(c) {
    const n = c.cards.length;
    const cols = 3;
    const pos = (i) => [3 + (i % cols) * 33 + ((i * 7) % 3), 10 + Math.floor(i / cols) * 23 + ((i * 3) % 4)];
    const P = Object.fromEntries(c.cards.map((x, i) => [x.id, pos(i)]));
    const H = Math.max(1, Math.ceil(n / cols)) * 23 + 8;
    const lines = c.links.map(l => { const a = P[l.a], b = P[l.b]; return a && b ? `<line x1="${a[0] + 14}" y1="${a[1] + 6}" x2="${b[0] + 14}" y2="${b[1] + 6}"/>` : ''; }).join('');
    const cards = c.cards.map((x, i) => { const [l, t] = pos(i); return `<button class="lf-bd-card k-${x.kind}${ui.pick === x.id ? ' on' : ''}" data-act="bd-card" data-id="${x.id}" style="left:${l}%;top:${(t / H * 100).toFixed(1)}%;transform:rotate(${x.r || 0}deg)"><i></i>${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}<span>${KINDS[x.kind]} ${esc(x.t)}</span></button>`; }).join('');
    return `<div class="lf-bd" style="aspect-ratio:100/${H}"><svg viewBox="0 0 100 ${H}" preserveAspectRatio="none">${lines}</svg>${cards}</div>`;
}
export function bdSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const c = cur();
    const chips = s.cases.map(x => `<button class="lf-chip${c?.id === x.id ? ' on' : ''}" data-act="bd-case" data-id="${x.id}">${esc(x.name)}</button>`).join('');
    if (!c) return `${A.sec('Доска')}<div class="lf-empty small">Заведи дело — улики из постов Летописец будет класть сам.</div><div class="lf-field"><input data-bdf="case" placeholder="Вальден · Вундагор"></div><button class="lf-btn primary" data-act="bd-new">📌 Новое дело</button>`;
    const card = (id) => c.cards.find(x => x.id === id)?.t || '?';
    return `${A.sec('Доска', `${c.cards.length} карточек · ${c.links.length} ниток`)}
        <div class="lf-chips wrap">${chips}<button class="lf-chip" data-act="bd-form">+ дело</button></div>
        ${ui.form ? `<div class="lf-field"><input data-bdf="case" placeholder="Название дела"></div><button class="lf-btn" data-act="bd-new">Завести</button>` : ''}
        ${c.cards.length ? boardSvg(c) : '<div class="lf-empty small">Карточек пока нет.</div>'}
        <div class="lf-hint">${ui.pick ? 'Теперь тап по второй карточке — протянется нитка (ещё раз — уберётся).' : 'Тап по карточке, потом по другой — красная нитка: персонажи это связали.'}</div>
        <div class="lf-field"><input data-bdf="card" placeholder="Улика, человек, место…"></div>
        <div class="lf-chips wrap">${Object.entries({ clue: 'улика', person: 'человек', place: 'место', doc: 'документ' }).map(([k, l]) => `<button class="lf-chip" data-act="bd-add" data-v="${k}">${KINDS[k]} ${l}</button>`).join('')}</div>
        ${c.links.length ? `${A.sec('Нитки')}${c.links.map((l, i) => `<div class="lf-bd-link"><span>${esc(card(l.a))} ↔ ${esc(card(l.b))}</span><button class="lf-mini" data-act="bd-unlink" data-v="${i}">✕</button></div>`).join('')}` : ''}
        <div class="lf-actions"><button class="lf-btn primary" data-act="bd-theory">✦ Версии</button>${ui.pick ? '<button class="lf-btn ghost" data-act="bd-del">Убрать карточку</button>' : ''}</div>
        ${(c.theories || []).map(t => `<div class="lf-note"><b>${esc(t.odds || '')}</b> ${esc(t.t)}${t.check ? `<br><small>проверить: ${esc(t.check)}</small>` : ''}</div>`).join('')}`;
}
export const bdState = () => { try { const c = cur(); return c ? `${c.cards.length}` : ''; } catch { return ''; } };
export async function bdClick(act, el) {
    const box = el.closest('#lf-app') || document;
    const val = (k) => box.querySelector(`[data-bdf="${k}"]`)?.value || '';
    const c = cur();
    if (act === 'bd-case') { M().cur = el.dataset.id; ui.pick = ''; A.saveMeta(); }
    else if (act === 'bd-form') ui.form = !ui.form;
    else if (act === 'bd-new') { caseAdd(val('case')); ui.form = false; }
    else if (act === 'bd-add') { if (!cardAdd(c, { t: val('card'), kind: el.dataset.v })) { A.toast('info', 'Впиши, что на карточке'); return; } }
    else if (act === 'bd-card') {
        const id = el.dataset.id;
        if (!ui.pick) ui.pick = id;
        else if (ui.pick === id) ui.pick = '';
        else { const l = link(c, ui.pick, id); if (l) c.fresh = true; ui.pick = ''; }
    }
    else if (act === 'bd-unlink') { c.links.splice(Number(el.dataset.v), 1); A.saveMeta(); }
    else if (act === 'bd-del') { if (c && ui.pick) { c.cards = c.cards.filter(x => x.id !== ui.pick); c.links = c.links.filter(l => l.a !== ui.pick && l.b !== ui.pick); ui.pick = ''; A.saveMeta(); } }
    else if (act === 'bd-theory') { if (!c?.cards.length) { A.toast('info', 'Сначала карточки'); return; } await A.withBusy(el, () => theories(c), 'Думаю…'); }
    else return;
    A.updatePrompt?.(); A.render();
}
export const _bd = { M, ui };
