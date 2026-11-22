// ✦ Счета (0.71). У каждого свои деньги: карта, наличные, сбережения, акции, траст. Карта {{user}} — это банк Телефона
// (Phone-ST): баланс и журнал живут там, Life туда пишет. Остальные счета — в Life (chat_metadata.life.wallet), свои у
// каждого чата и эпохи.
// • Регулярное — по дате истории: зарплата, пенсия, дивиденды, переводы, платежи дома (налоги, страховки, гараж,
//   коммуналка по сезону). Скачок во времени — всё пропущенное разом, не больше чем за 4 года.
// • Траты из истории — Летописец (ключ "money"): кто платил, сколько, с какого счёта. Запись живёт, пока пост в чате:
//   свайп, правка, удаление — трата пропадает сама; свайп назад — возвращается. По карте Телефона — операцией в нём.
// • Свайп не списывает дважды: что Телефон снял по тегу tel:bank из варианта ответа, который потом отвергли, — Life
//   вернёт (и снова снимет, если вернёшься к тому варианту). Старые такие списания — кнопкой «Вернуть».
// • Платят отсюда же: счета из почты, чеки быта (bills.js), Ангар и Дом (globalThis.LifeMoney).
// • Умная модель оценивает счета людей по лору и карточкам («✦ Оценить»).

import { storyDay, str, arr, clamp } from './hudkit.js';
import { bank, bankNow } from './money.js';

let A = null;
export function initWallet(api) {
    A = api;
    try { installGlobal(); } catch (e) { console.warn('[Life] счета: LifeMoney', e); }
}
const esc = (v) => A.esc(v);

const DEF = { on: true, story: true, guard: true, prompt: true };
function cfg() {
    const s = A.settings();
    if (!s.wallet || typeof s.wallet !== 'object') s.wallet = {};
    for (const [k, v] of Object.entries(DEF)) if (s.wallet[k] === undefined) s.wallet[k] = v;
    return s.wallet;
}
const on = () => !!A && cfg().on !== false;

function W() {
    const cm = A.chatMeta();
    if (!cm.wallet || typeof cm.wallet !== 'object') cm.wallet = {};
    const w = cm.wallet;
    if (!Array.isArray(w.accs)) w.accs = [];      // { id, who, name, kind, phone, main, lock, base, note, src, at }
    if (!Array.isArray(w.flows)) w.flows = [];    // { id, kind: in|out|move, what, amount, acc, to, day, months, cat, last, vary, home, note, off, src }
    if (!Array.isArray(w.tx)) w.tx = [];          // { id, acc, amount, what, cat, day, src, ref, at, ph, ptx, pend }
    if (!w.story || typeof w.story !== 'object') w.story = {};   // ident → { i, day, list: [{ acc, who, amount, what, skip }], at }
    if (!w.papp || typeof w.papp !== 'object') w.papp = {};      // траты из истории по карте Телефона: ключ → id операции
    if (!w.pg || typeof w.pg !== 'object') w.pg = {};
    if (!w.pg.map || typeof w.pg.map !== 'object') w.pg.map = {}; // ключ тега Телефона → { tx, amount, label, cat, off, syn, gone }
    if (!w.home || typeof w.home !== 'object') w.home = {};      // { payer }
    if (!Number.isFinite(w.seq)) w.seq = 0;
    return w;
}
const nid = (p) => `${p}${Date.now().toString(36).slice(-3)}${(++W().seq).toString(36)}`;
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const num = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export const KIND = { card: ['Карта', '💳'], cash: ['Наличные', '💵'], save: ['Сбережения', '🏦'], invest: ['Акции и фонды', '📈'], trust: ['Траст', '🔒'], corp: ['Фонды и фирмы', '💼'] };
const kindOf = (k) => (KIND[k] ? k : 'card');

// ───────────── даты истории ─────────────

const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function today() { const d = A.parseDate(storyDay(A)); return d && !isNaN(d) ? ymdOf(d) : ''; }
const dim = (y, m) => new Date(y, m, 0).getDate();
const ymAdd = (ym, k) => { let [y, m] = String(ym).split('-').map(Number); m += k; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${pad(m)}`; };
const dueDay = (f, ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(clamp(f.day || 1, 1, 31), dim(y, m)))}`; };
const monthsOf = (f) => arr(f.months).map(Number).filter(x => x >= 1 && x <= 12);
const inSched = (f, ym) => { const ms = monthsOf(f); return !ms.length || ms.includes(Number(ym.slice(5, 7))); };
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const dm = (ymd) => { const [, m, d] = String(ymd).split('-').map(Number); return m && d ? `${d} ${MON[m - 1]}` : ''; };

/** Последний срок не позже t (ГГГГ-ММ) — с него начнём, ничего не платя задним числом. */
function lastDue(f, t) {
    let ym = t.slice(0, 7);
    for (let k = 0; k < 30; k++, ym = ymAdd(ym, -1)) if (inSched(f, ym) && dueDay(f, ym) <= t) return ym;
    return ymAdd(t.slice(0, 7), -1);
}
/** Следующий срок после f.last. */
function nextDue(f) {
    let ym = f.last || '';
    if (!ym) { const t = today(); if (!t) return ''; ym = lastDue(f, t); }
    for (let k = 0; k < 30; k++) { ym = ymAdd(ym, 1); if (inSched(f, ym)) return dueDay(f, ym); }
    return '';
}

// сезон: отопление зимой (heat), кондиционер летом (cool); среднее за год — сумма платежа
const SEASON = { heat: [1.6, 1.5, 1.25, .85, .5, .35, .3, .3, .4, .7, 1.1, 1.45], cool: [1, .95, .9, .85, .95, 1.15, 1.3, 1.3, 1.1, .9, .9, 1] };
function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0; return String(h); }
export function amountFor(f, ym) {
    let a = Number(f.amount) || 0;
    const tab = SEASON[f.vary];
    if (tab && ym) {
        const mean = tab.reduce((x, y) => x + y, 0) / 12;
        a = a * tab[Number(ym.slice(5, 7)) - 1] / mean;
        a *= 1 + ((Math.abs(Number(h32(`${f.id}:${ym}`))) % 13) - 6) / 100;   // ±6 %: месяц на месяц не похож
    }
    return round2(a);
}
const perMonth = (f) => { const n = monthsOf(f).length; return (Number(f.amount) || 0) * (n ? n / 12 : 1); };

// ───────────── деньги ─────────────

const curSym = () => W().cur || '$';
const trimNum = (x) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('ru-RU');
/** $39 229 · $684 млн · $6,2 млрд (short — большие суммы коротко) · sign — «+» у прихода. */
export function fmt(n, { sign = false, short = false } = {}) {
    const c = curSym();
    const v = Number(n) || 0;
    const a = Math.abs(v);
    let body;
    if (short && a >= 1e9) body = `${trimNum(a / 1e9)} млрд`;
    else if (short && a >= 1e6) body = `${trimNum(a / 1e6)} млн`;
    else { const r = Math.round(a * 100); body = r % 100 && a < 1e5 ? `${Math.floor(r / 100).toLocaleString('ru-RU')},${String(r % 100).padStart(2, '0')}` : Math.round(a).toLocaleString('ru-RU'); }
    const s = /^[$€£]$/.test(c) ? `${c}${body}` : `${body} ${c}`;
    return v < 0 ? `−${s}` : sign && v > 0 ? `+${s}` : s;
}

// ───────────── счета ─────────────

const accs = () => W().accs;
export function accOf(id) { return id ? accs().find(a => a.id === id) || null : null; }
export function accsOf(who) { return who ? accs().filter(a => A.sameName(a.who, who)) : []; }
export const walletHas = (who) => on() && !!A?.hasChat?.() && accsOf(who).length > 0;
export const walletReady = () => on() && !!A?.hasChat?.() && accs().length > 0;
export function mainOf(who) {
    const l = accsOf(who);
    return l.find(a => a.main && !a.lock) || l.find(a => a.kind === 'card' && !a.lock) || l.find(a => !a.lock && a.kind !== 'cash') || l.find(a => !a.lock) || null;
}
export const walletMainOf = (who) => mainOf(who)?.id || '';
const userName = () => A.ctx().name1;
/** Кто платит за дом по умолчанию: заданный, иначе основной счёт {{user}}. */
export function walletPayer() {
    const w = W();
    const p = accOf(w.home.payer);
    if (p && !p.lock) return p.id;
    return mainOf(userName())?.id || accs().find(a => !a.lock)?.id || '';
}
export function accLabel(a, short = false) {
    if (!a) return '—';
    return `${A.shortName(a.who)} · ${short ? a.name.replace(/\s*\(.*\)$/, '') : a.name}`;
}
export const walletAccName = (id) => accLabel(accOf(id), true);

function normAcc(a, src = 'me') {
    const kind = kindOf(a?.kind);
    return {
        id: str(a?.id, 16) || nid('a'), who: str(a?.who, 60), name: str(a?.name, 48) || KIND[kind][0], kind,
        phone: !!a?.phone, main: !!a?.main, lock: !!a?.lock, base: round2(num(a?.base ?? a?.bal)), note: str(a?.note, 300), src: a?.src || src, at: Date.now(),
    };
}
function normFlow(f, src = 'me') {
    const kind = ['in', 'out', 'move'].includes(f?.kind) ? f.kind : 'out';
    return {
        id: str(f?.id, 24) || nid('f'), kind, what: str(f?.what, 70) || (kind === 'in' ? 'Доход' : 'Платёж'), amount: round2(Math.abs(num(f?.amount))),
        acc: str(f?.acc, 16), to: kind === 'move' ? str(f?.to, 16) : '', day: clamp(Math.round(num(f?.day) || 1), 1, 31),
        months: [...new Set(arr(f?.months).map(Number).filter(x => x >= 1 && x <= 12))].sort((x, y) => x - y),
        cat: str(f?.cat, 24), last: /^\d{4}-\d{2}$/.test(String(f?.last || '')) ? f.last : '', vary: SEASON[f?.vary] ? f.vary : '',
        home: !!f?.home, note: str(f?.note, 240), off: !!f?.off, src: f?.src || src,
    };
}

// ───────────── Телефон ─────────────

const P = () => bankNow();
function phoneBank() { try { return P()?.b?.getBank?.() || null; } catch { return null; } }
function phoneSave() { try { P()?.s?.saveMeta?.(); } catch { /* */ } }
function phoneAdd(amount, label, category) {
    try {
        const tx = P()?.b?.addTransaction?.({ amount, label: String(label || '').slice(0, 60), category: String(category || 'другое').slice(0, 24) }) || null;
        // Телефон кладёт каждую операцию в свою очередь сверки ({ amount, at }); свои метки — чтобы не принять их за его покупки
        if (tx) { const w = W(); if (!Array.isArray(w.mine)) w.mine = []; w.mine.push({ amount: Math.round(Number(amount) || 0), at: (A.chatArr() || []).length }); if (w.mine.length > 60) w.mine.splice(0, w.mine.length - 60); }
        return tx;
    } catch (e) { console.warn('[Life] счета → Телефон', e); return null; }
}
function phoneDel(id) {
    try {
        const bk = phoneBank();
        if (!id || !bk?.transactions?.some(t => t.id === id)) return false;
        P().b.deleteTransaction(id);
        return true;
    } catch (e) { console.warn('[Life] счета: откат в Телефоне', e); return false; }
}
/** Вернуть операцию тихо, мимо очереди сверки Телефона (свайп назад к тому варианту). */
function phonePut(t) {
    const bk = phoneBank();
    if (!bk || !Array.isArray(bk.transactions)) return null;
    const tx = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), amount: Math.round(Number(t.amount) || 0), label: String(t.label || '').slice(0, 60), category: String(t.cat || 'ролевая').slice(0, 24), time: Date.now() };
    if (!tx.amount) return null;
    bk.transactions.unshift(tx);
    bk.balance = (Number(bk.balance) || 0) + tx.amount;
    if (bk.transactions.length > 200) bk.transactions = bk.transactions.slice(0, 200);
    phoneSave();
    return tx;
}

// ───────────── что сейчас в чате ─────────────

/** Пост и его вариант: дата этого варианта (свайпы различаются, правка текста — нет). */
export function identOf(m) {
    if (!m) return '';
    const sw = Number(m.swipe_id ?? 0) || 0;
    const sd = (Array.isArray(m.swipe_info) && m.swipe_info[sw]?.send_date) || m.send_date || '';
    return sd ? `${sd}#${sw}` : '';
}
let liveC = null, liveT = 0;
function liveSet() {
    if (liveC && Date.now() - liveT < 80) return liveC;
    const s = new Set();
    for (const m of A.chatArr() || []) { const k = identOf(m); if (k) s.add(k); }
    liveC = s; liveT = Date.now();
    return s;
}
const liveDrop = () => { liveC = null; };

export function accBal(a) {
    if (!a) return 0;
    const w = W();
    let pend = 0;
    for (const t of w.tx) if (t.acc === a.id && t.pend) pend += Number(t.amount) || 0;
    if (a.phone) { const bk = phoneBank(); if (bk) return Math.round((Number(bk.balance) || 0) + pend); }
    let s = Number(a.base) || 0;
    for (const t of w.tx) if (t.acc === a.id && !t.ph) s += Number(t.amount) || 0;
    const L = liveSet();
    for (const [id, e] of Object.entries(w.story)) if (L.has(id)) for (const x of arr(e.list)) if (x.acc === a.id && !x.skip) s += Number(x.amount) || 0;
    return round2(s);
}
export const walletBal = (id) => accBal(accOf(id));

/** Деньги на счёт и со счёта. Карта в Телефоне — операцией там (нет Телефона — запомню и проведу, когда появится). */
export function walletMove(accId, amount, what, cat = 'другое', src = 'me', ref = '') {
    const a = accOf(accId);
    const v = round2(amount);
    if (!a || !v) return null;
    const rec = { id: nid('t'), acc: a.id, amount: v, what: String(what || '').slice(0, 80), cat: String(cat || 'другое').slice(0, 24), day: today(), src, ref: String(ref || ''), at: Date.now() };
    if (a.phone) {
        const tx = bankNow() ? phoneAdd(v, rec.what, rec.cat) : null;
        if (tx) { rec.ph = true; rec.ptx = tx.id; } else rec.pend = true;
    }
    W().tx.push(rec);
    trimTx();
    return rec;
}
/** Списать с проверкой денег (Ангар, Дом, магазины): { ok, why, acc }. */
export function walletPay(accId, amount, what, cat = 'покупки', src = 'me', ref = '', { check = false } = {}) {
    const a = accOf(accId);
    if (!a) return { ok: false, why: 'счёт не найден' };
    const v = Math.abs(round2(amount));
    if (!v) return { ok: false, why: 'сумма' };
    if (check) { const b = accBal(a); if (b < v) return { ok: false, why: `на счету «${a.name}» ${fmt(b)} — не хватает` }; }
    const rec = walletMove(a.id, -v, what, cat, src, ref);
    A.saveMeta();
    return { ok: !!rec, acc: a.id, name: accLabel(a), rec };
}
function trimTx() {
    const w = W();
    if (w.tx.length <= 600) return;
    const keep = [];
    let cut = w.tx.length - 500;
    for (const t of w.tx) {
        if (cut > 0 && !t.pend) {
            cut--;
            if (!t.ph) { const a = accOf(t.acc); if (a) a.base = round2((Number(a.base) || 0) + (Number(t.amount) || 0)); }
            continue;
        }
        keep.push(t);
    }
    w.tx = keep;
}

// ───────────── регулярное: доходы, платежи, переводы ─────────────

/** Сверка по дате истории: всё, чему пришёл срок. Вернёт [{ f, amt, ym, d }]. */
export function walletSweep() {
    if (!walletReady()) return [];
    const w = W();
    const t = today();
    if (!t || !w.flows.length) return [];
    const out = [];
    let ch = false;
    for (const f of w.flows) {
        if (f.off || !(Number(f.amount) > 0) || !accOf(f.acc)) continue;
        if (!f.last) { f.last = lastDue(f, t); ch = true; continue; }
        if (f.last > t.slice(0, 7)) continue;           // история ушла назад (флешбек) — не трогаю
        let ym = f.last;
        for (let k = 0, paid = 0; k < 48 && paid < 24; k++) {
            ym = ymAdd(ym, 1);
            if (ym > t.slice(0, 7)) break;
            if (!inSched(f, ym)) continue;
            const d = dueDay(f, ym);
            if (d > t) break;
            const amt = amountFor(f, ym);
            applyFlow(f, amt, ym);
            out.push({ f, amt, ym, d });
            f.last = ym; paid++; ch = true;
        }
        // скачок больше, чем на 4 года — дальше без денег, просто срок
        if (f.last < ymAdd(t.slice(0, 7), -48)) { f.last = lastDue(f, t); ch = true; }
    }
    if (ch) A.saveMeta();
    if (out.length) A.updatePrompt?.();
    // пуш — только про её деньги и дом; чужие зарплаты идут молча (видно в их «Деньгах»)
    const mineOut = out.filter(x => x.f.home || A.sameName(accOf(x.f.acc)?.who, userName()) || A.sameName(accOf(x.f.to)?.who, userName()));
    if (mineOut.length) {
        const who = (x) => A.shortName(accOf(x.f.acc)?.who || '');
        const txt = mineOut.slice(0, 4).map(x => `${who(x)}: ${x.f.kind === 'in' ? '+' : '−'}${fmt(x.amt, { short: true }).replace(/^−/, '')} ${x.f.what}`).join(' · ');
        A.push?.({ app: 'Банк', icon: 'wallet', tint: '#9fc79a', title: mineOut.length > 1 ? `Счета · ${mineOut.length} ${A.plural(mineOut.length, 'операция', 'операции', 'операций')}` : 'Счета', text: `${txt}${mineOut.length > 4 ? ' …' : ''}`, onTap: () => A.openMoney?.(), ms: 7000 });
    }
    return out;
}
function applyFlow(f, amt, ym) {
    const ref = `${f.id}:${ym}`;
    if (f.kind === 'in') { walletMove(f.acc, amt, f.what, f.cat || 'доход', 'flow', ref); return; }
    if (f.kind === 'move') {
        const from = accOf(f.acc), to = accOf(f.to);
        walletMove(f.acc, -amt, `${f.what}${to ? ` → ${A.shortName(to.who)}` : ''}`, 'перевод', 'flow', ref);
        if (to) walletMove(to.id, amt, `${f.what}${from ? ` ← ${A.shortName(from.who)}` : ''}`, 'перевод', 'flow', ref);
        return;
    }
    walletMove(f.acc, -amt, f.what, f.cat || 'счета', 'flow', ref);
}

/** Для почты (bills.js): что уже платится само. */
export function walletHomeText() {
    if (!walletReady()) return '';
    return W().flows.filter(f => f.home && !f.off && f.kind === 'out').map(f => `${f.what} ~${fmt(f.amount)}${monthsOf(f).length ? ` (${monthsOf(f).map(m => MON[m - 1]).join(', ')})` : ''}`).join('; ');
}
/** Коммуналку ведут сами платежи дома — почте её не присылать. */
export const walletUtilOn = () => walletReady() && W().flows.some(f => f.home && !f.off && (f.vary || /коммун|электр|свет|газ|отоплен|вод[аы]/i.test(`${f.cat} ${f.what}`)));

// ───────────── траты из истории (Летописец) ─────────────

const MONEY_RE = /[$€£₽]\s?\d|\d\s?(?:\$|долл|бакс|евро|руб|тыс|млн)|заплат|оплат|платил|платит|плачу|купил|купит|куплю|покуп|счёт|чаев|перев[её]л|переведу|перевод|налич|кредитк|карт(?:ой|у)\b|банк|стоил|цен[аыу]\b|заказ|выигр|проигр|штраф|залог|аренд|зарплат|пенси|гонорар|взятк|деньг|долг|одолж|сдач[аиу]\b|касс[аеуы]\b|\bpaid\b|\bpay\b|bought|\bcash\b|\btip\b/i;
const RULE = `\nmoney — деньги, которые в ЭТОМ посте на самом деле ушли или пришли: покупка, счёт в ресторане, чаевые, такси, перевод, зарплата, выигрыш, штраф, взятка. [{"who":"кто платил или получил","acc":"id счёта из списка или пусто","amount":-80,"what":"за что, 2–5 слов"}]: минус — потратил, плюс — получил. Только свершившееся — не цены в меню, не планы, не «может себе позволить», не воспоминания. Перевод между людьми — две строки. Платит тот, кто платит в тексте, а не тот, кому вещь. acc: картой — основной, наличными — наличные, крупное на дело — фонд; не ясно — пусто. Что уже провёл Телефон (теги tel:bank, покупки и заказы в телефоне — список дан) — не пиши. Если прямо перед этим постом — пост {{user}} и она там сама заплатила или получила деньги, запиши и это (один раз, даже если ответ это повторяет). Нечего — [].`;

const BANK_TAG_RE = /<!--\s*tel:bank:(\{[\s\S]*?\})\s*-->/gi;
const SMS_TAG_RE = /<!--\s*tel:sms:(\{[\s\S]*?\})\s*-->/gi;
function sj(raw) { try { return JSON.parse(raw); } catch { try { return JSON.parse(String(raw).replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"')); } catch { return null; } } }
const hasPhoneTag = (t) => /<!--\s*tel:bank:/i.test(String(t || '')) || [...String(t || '').matchAll(SMS_TAG_RE)].some(m => !!smsTx(sj(m[1])));

/** Кто в посте: сцена, говорящий, названные — у кого есть счета. */
function peopleFor(i) {
    const m = A.chatArr()[i];
    const set = [];
    const add = (n) => { const c = A.canonName(n) || n; if (c && accsOf(c).length && !set.some(x => A.sameName(x, c))) set.push(c); };
    add(userName());
    for (const n of A.worldState()?.scene?.characters_present || []) add(n);
    if (m?.name) add(m.name);
    try { for (const n of A.namesInText?.(A.plainText(m?.mes || '')) || []) add(n); } catch { /* */ }
    return set.slice(0, 7);
}
/** Что Телефон недавно провёл сам (магазин, заказы, казино, теги): его очередь сверки без операций самой Life. */
function phoneRecent(i) {
    const bk = phoneBank();
    if (!bk) return [];
    const mine = arr(W().mine).map(x => ({ ...x }));
    const out = [];
    for (const x of arr(bk.syncQueue)) {
        const amount = Math.round(Number(x?.amount) || 0), at = Number(x?.at);
        if (!amount || !Number.isFinite(at)) continue;
        const k = mine.findIndex(y => !y.used && y.amount === amount && y.at === at);
        if (k >= 0) { mine[k].used = true; continue; }
        if (i - at > 8 || i - at < -1) continue;
        out.push({ amount, at, label: arr(bk.transactions).find(t => Math.round(t.amount) === amount)?.label || '' });
    }
    return out.sort((a, b) => b.at - a.at);
}

export function walletChron(i) {
    if (!walletReady() || !cfg().story) return null;
    const c = A.chatArr();
    const m = c[i];
    const her = c[i - 1]?.is_user ? c[i - 1] : null;   // её пост прямо перед ответом: её траты Летописец берёт отсюда же
    if (!m || !MONEY_RE.test(`${A.plainText(m.mes || '')} ${her ? A.plainText(her.mes || '') : ''}`)) return null;
    const ppl = peopleFor(i);
    if (!ppl.length) return null;
    const lines = ppl.map(n => `${n} — ${accsOf(n).map(a => `[${a.id}] ${a.name}${a.main ? ' (основной)' : ''}${a.lock ? ' (не трогает)' : ''}`).join(', ')}`);
    const tags = [...String(m.mes || '').matchAll(BANK_TAG_RE)].map(x => sj(x[1])).filter(j => Number(j?.amount)).map(j => `${fmt(Math.round(j.amount), { sign: true })} «${str(j.label || j.text, 40)}»`);
    const rec = phoneRecent(i).map(x => `${fmt(x.amount, { sign: true })}${x.label ? ` «${x.label}»` : ''}`);
    const done = [...tags, ...rec];
    return { key: '"money": []', rule: RULE, tokens: 90, input: `Счета (кто платит — с того и списано): ${lines.join('; ')}${done.length ? `\nУже провёл Телефон: ${done.slice(0, 6).join('; ')}` : ''}` };
}

export function walletAfterPost(i, j, m) {
    if (!walletReady()) return;
    m = m || A.chatArr()[i];
    const id = identOf(m);
    if (!id) return;
    const w = W();
    const list = [];
    const tagged = hasPhoneTag(m.mes);
    const rec = phoneRecent(i);
    for (const r of arr(j?.money).slice(0, 8)) {
        const amount = round2(num(r?.amount));
        if (!amount || Math.abs(amount) > 1e11) continue;
        const who = A.canonName(str(r?.who, 60)) || str(r?.who, 60);
        let a = accOf(str(r?.acc, 16));
        if (a && who && !A.sameName(a.who, who)) a = null;      // чужой счёт — не его
        if (!a) a = mainOf(who);
        if (!a) continue;                                        // у человека нет счетов — мимо
        const x = { acc: a.id, who: a.who, amount, what: str(r?.what, 60) || (amount < 0 ? 'трата' : 'поступление') };
        if (a.phone && (tagged || rec.some(q => Math.abs(Math.abs(q.amount) - Math.abs(amount)) <= Math.max(1, Math.abs(amount) * 0.01)))) x.skip = 'phone';
        list.push(x);
    }
    if (list.length) w.story[id] = { i, day: today(), list, at: Date.now() };
    else if (w.story[id]) delete w.story[id];
    else return;
    trimStory();
    liveDrop();
    storyPhone();
    A.saveMeta();
    A.updatePrompt?.();
}
function trimStory() {
    const w = W();
    const ids = Object.keys(w.story);
    if (ids.length <= 400) return;
    const L = liveSet();
    const dead = ids.filter(k => !L.has(k)).sort((a, b) => (w.story[a].at || 0) - (w.story[b].at || 0));
    for (const k of dead.slice(0, ids.length - 350)) delete w.story[k];
}
/** Траты из истории по карте Телефона: живые — операцией в Телефоне, отвергнутые — откатом. */
function storyPhone() {
    if (!phoneBank()) return false;
    const w = W();
    const L = liveSet();
    const want = new Map();
    for (const [id, e] of Object.entries(w.story)) {
        if (!L.has(id)) continue;
        arr(e.list).forEach((x, k) => { if (!x.skip && accOf(x.acc)?.phone) want.set(`${id}|${k}|${x.amount}|${h32(x.what)}`, x); });
    }
    let ch = false;
    for (const [k, txId] of Object.entries(w.papp)) if (!want.has(k)) { phoneDel(txId); delete w.papp[k]; ch = true; }
    for (const [k, x] of want) if (!w.papp[k]) { const tx = phoneAdd(Math.round(x.amount), x.what, 'история'); if (tx) { w.papp[k] = tx.id; ch = true; } }
    return ch;
}
function pushPending() {
    if (!phoneBank()) return false;
    let ch = false;
    for (const t of W().tx) {
        if (!t.pend || !accOf(t.acc)?.phone) continue;
        const tx = phoneAdd(Math.round(t.amount), t.what, t.cat);
        if (tx) { t.pend = false; t.ph = true; t.ptx = tx.id; ch = true; }
    }
    return ch;
}

// ───────────── свайп не списывает дважды (теги Телефона) ─────────────

const BANK_SENDER_RE = /банк|bank|сбер|тинькофф|tinkoff|альфа|втб|райффайзен|газпром|озон|уралсиб|росбанк|совкомбанк|мтс[\s-]?банк|900|chase|wells\s?fargo|citibank|barclays|hsbc|revolut|monzo|n26|paypal/i;
const SPEND_RE = /списан|списание|покупк|оплат|платил|платеж|платёж|перевод\s+(отправлен|выполнен)|снятие|снят[оы]|аренда|штраф|комисси|debit(?:ed)?|charged|purchase|payment\s+(?:of|to|sent)|withdraw(?:al|n)?|spent|sent\s+to|\bfee\b/i;
const INCOME_RE = /пополнен|пополнение|зачислен|поступлени|перевод\s+от(?![а-яё])|получен\s+перевод|возврат|зарплат|начислен|кэшбэк|cashback|credit(?:ed)?|deposit(?:ed)?|received|refund(?:ed)?|salary|payout|incoming\s+transfer|transfer\s+from|paid\s+(?:to\s+you|in)\b/i;
const AMOUNT_RE = /(\d[\d\s]{0,12}(?:[.,]\d{1,2})?)\s*(?:₽|руб|р\.|р\b|\$|€|£|usd|eur|dollars?|euros?|pounds?|rubles?)|(?:[$€£])\s?(\d[\d\s,]{0,12}(?:\.\d{1,2})?)/i;
/** То же, что банк Телефона делает из банковской смс (копия его правил — чтобы найти ту же операцию). */
function smsTx(j) {
    if (!j) return null;
    const from = String(j.from || ''), text = String(j.text || '');
    if (!BANK_SENDER_RE.test(from) && !BANK_SENDER_RE.test(text.slice(0, 40))) return null;
    const am = text.match(AMOUNT_RE);
    if (!am) return null;
    const raw = (am[1] || am[2] || '').replace(/\s/g, '');
    const amount = Math.round(parseFloat(raw.replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0);
    if (!amount) return null;
    const sign = INCOME_RE.test(text) ? 1 : SPEND_RE.test(text) ? -1 : 0;
    if (!sign) return null;
    return { amount: sign * amount, label: text.replace(AMOUNT_RE, '').replace(/\s+/g, ' ').trim().slice(0, 50) || (sign < 0 ? 'Списание (смс банка)' : 'Пополнение (смс банка)') };
}
/** Ключи тегов, как их считает Телефон: bk|bs<хэш>:<дата поста>#<номер>. */
function keysIn(text, src, strip) {
    const out = [];
    const t = strip(String(text || ''));
    const occ = {};
    let m, bkHit = false;
    BANK_TAG_RE.lastIndex = 0;
    while ((m = BANK_TAG_RE.exec(t)) !== null) {
        bkHit = true;
        const base = `bk${h32(m[1])}:${src}`;
        const n = occ[base] = (occ[base] || 0) + 1;
        const j = sj(m[1]);
        out.push({ key: `${base}#${n}`, amount: Math.round(Number(j?.amount) || 0), label: String(j?.label || j?.text || 'Из ролевой').slice(0, 60) });
    }
    if (!bkHit) {
        SMS_TAG_RE.lastIndex = 0;
        while ((m = SMS_TAG_RE.exec(t)) !== null) {
            const base = `bs${h32(m[1])}:${src}`;
            const n = occ[base] = (occ[base] || 0) + 1;
            const tx = smsTx(sj(m[1]));
            if (tx) out.push({ key: `${base}#${n}`, amount: tx.amount, label: tx.label, sms: true });
        }
    }
    return out;
}
const KEY_RE = /^b[ks]-?\d+:.+#\d+$/;
/** Все теги в чате: живые (текущий вариант поста) и отвергнутые (другие свайпы). */
function tagMaps() {
    const strip = typeof P()?.s?.stripThink === 'function' ? P().s.stripThink : (x) => x;
    const live = new Map(), dead = new Map();
    (A.chatArr() || []).forEach((msg, idx) => {
        if (!msg) return;
        if (msg.mes && /tel:(bank|sms)/i.test(msg.mes)) for (const k of keysIn(msg.mes, String(msg.send_date || msg.extra?.gen_id || idx), strip)) live.set(k.key, { ...k, idx });
        const sw = arr(msg.swipes);
        if (sw.length < 2) return;
        const si = arr(msg.swipe_info), cur = Number(msg.swipe_id ?? 0) || 0;
        sw.forEach((t, s) => {
            if (s === cur || !t || !/tel:(bank|sms)/i.test(t)) return;
            const sd = si[s]?.send_date;
            if (!sd) return;
            for (const k of keysIn(t, String(sd), strip)) dead.set(k.key, { ...k, idx, s });
        });
    });
    for (const k of live.keys()) dead.delete(k);
    return { live, dead };
}
function findTx(bk, info, taken) {
    return arr(bk.transactions).find(t => !taken.has(t.id) && !t.synced && Math.round(Number(t.amount) || 0) === info.amount && (!info.label || t.label === info.label || (info.sms && t.category === 'смс банка'))) || null;
}
/** Сверка тегов Телефона: отвергнутый вариант — операцию назад, вернулась к нему — снова. Вернёт, менялось ли что-то. */
export function guardScan() {
    if (!on() || !cfg().guard || !A?.hasChat?.()) return false;
    const bk = phoneBank();
    if (!bk) return false;
    const seen = arr(bk.seenTags);
    const g = W().pg;
    if (!g.init) { g.init = Date.now(); g.n = seen.length; g.last = seen[seen.length - 1] || ''; return true; }
    let from = Number(g.n) || 0;
    if (g.last && seen[from - 1] !== g.last) { const ix = seen.lastIndexOf(g.last); from = ix >= 0 ? ix + 1 : seen.length; }
    const fresh = seen.slice(from).filter(k => KEY_RE.test(k) && !g.map[k]);
    let ch = g.n !== seen.length || g.last !== (seen[seen.length - 1] || '');
    g.n = seen.length; g.last = seen[seen.length - 1] || '';
    const mapped = Object.keys(g.map).length;
    if (!fresh.length && !mapped) return ch;
    const { live, dead } = tagMaps();
    const taken = new Set(Object.values(g.map).map(e => e.tx).filter(Boolean));
    for (const k of fresh) {
        const info = live.get(k) || dead.get(k);
        if (!info?.amount) continue;
        const tx = findTx(bk, info, taken);
        if (!tx) continue;
        taken.add(tx.id);
        g.map[k] = { tx: tx.id, amount: Math.round(tx.amount), label: tx.label, cat: tx.category, at: Date.now() };
        ch = true;
    }
    let n = 0, sum = 0;
    for (const [k, e] of Object.entries(g.map)) {
        if (e.syn || e.gone) continue;
        const isLive = live.has(k);
        if (!isLive && !e.off) {
            if (phoneDel(e.tx)) { e.off = Date.now(); n++; sum += e.amount; } else { e.off = Date.now(); e.gone = true; }
            ch = true;
        } else if (isLive && e.off) {
            const tx = phonePut({ amount: e.amount, label: e.label, cat: e.cat });
            if (tx) { e.tx = tx.id; delete e.off; ch = true; }
        }
    }
    const keys = Object.keys(g.map);
    if (keys.length > 300) { for (const k of keys.filter(x => g.map[x].off || g.map[x].gone).slice(0, keys.length - 260)) delete g.map[k]; ch = true; }
    if (n) A.toast?.('info', `Свайп: вернула ${fmt(Math.abs(sum))} — ${n === 1 ? 'операция из варианта ответа, который ты отвергла' : `${n} ${A.plural(n, 'операция', 'операции', 'операций')} из отвергнутых вариантов`}.`, '✦ Счета', { timeOut: 5000 });
    return ch;
}
/** Старые списания из отвергнутых вариантов (до того, как Life начала следить): [{ key, amount, label, tx }]. */
export function guardHistory() {
    if (!on() || !cfg().guard) return [];
    const bk = phoneBank();
    if (!bk) return [];
    const g = W().pg;
    const seen = new Set(arr(bk.seenTags).filter(k => KEY_RE.test(k)));
    const { live, dead } = tagMaps();
    const taken = new Set(Object.values(g.map).map(e => e.tx).filter(Boolean));
    // сперва — то, что в чате сейчас: его операции не трогать
    for (const [k, info] of live) if (seen.has(k) && !g.map[k] && info.amount) { const tx = findTx(bk, info, taken); if (tx) taken.add(tx.id); }
    const out = [];
    for (const [k, info] of dead) {
        if (!seen.has(k) || g.map[k] || !info.amount) continue;
        const tx = findTx(bk, info, taken);
        if (!tx) continue;
        taken.add(tx.id);
        out.push({ key: k, amount: Math.round(tx.amount), label: tx.label, cat: tx.category, tx: tx.id, idx: info.idx });
    }
    return out;
}
let ghCache = { sig: '', list: [] };
function guardHistoryCached() {
    const bk = phoneBank();
    const c = A.chatArr() || [];
    const sig = `${A.ctx().chatId}:${c.length}:${identOf(c[c.length - 1])}:${arr(bk?.seenTags).length}:${arr(bk?.transactions).length}:${Object.keys(W().pg.map).length}`;
    if (ghCache.sig !== sig) ghCache = { sig, list: guardHistory() };
    return ghCache.list;
}
function guardApply(list) {
    const g = W().pg;
    let n = 0, sum = 0;
    for (const x of list) {
        if (g.map[x.key]) continue;
        if (phoneDel(x.tx)) { g.map[x.key] = { tx: x.tx, amount: x.amount, label: x.label, cat: x.cat, off: Date.now(), at: Date.now() }; n++; sum += x.amount; }
    }
    ghCache.sig = '';
    A.saveMeta();
    return { n, sum };
}

let soonT = null;
/** После поста, свайпа, правки, удаления: сверить Телефон с тем, что сейчас в чате. */
export function walletSoon(ms = 1200) {
    clearTimeout(soonT);
    soonT = setTimeout(() => { walletReconcile().catch(e => console.warn('[Life] счета: сверка', e)); }, ms);
}
export async function walletReconcile() {
    if (!on() || !A?.hasChat?.()) return;
    await bank();
    liveDrop();
    let ch = false;
    if (walletReady()) { ch = pushPending() || ch; ch = storyPhone() || ch; }
    try { if (guardScan()) ch = true; } catch (e) { console.warn('[Life] счета: свайпы', e); }
    if (ch) { A.saveMeta(); A.updatePrompt?.(); if (A.ui?.open) A.renderSoon?.(); }
}

// ───────────── заметка модели ─────────────

export function walletPrompt(type) {
    if (!walletReady() || !cfg().prompt || type === 'quiet' || type === 'impersonate') return '';
    const chat = A.chatArr();
    const hot = chat.slice(-2).some(m => MONEY_RE.test(A.plainText(m?.mes || '')));
    if (!hot && chat.length % 5 !== 0) return '';
    const ppl = [];
    const add = (n) => { const c = A.canonName(n) || n; if (c && accsOf(c).length && !ppl.some(x => A.sameName(x, c))) ppl.push(c); };
    add(userName());
    for (const n of A.worldState()?.scene?.characters_present || []) add(n);
    if (!ppl.length) return '';
    const neg = [];
    const lines = ppl.slice(0, 6).map(n => {
        const parts = accsOf(n).map(a => { const v = accBal(a); if (a.main && v < 0) neg.push(`${A.shortName(n)}: «${a.name}» в минусе (${fmt(v)})`); return `${a.name} ${fmt(v, { short: true })}${a.lock ? ' (не трогает)' : ''}`; });
        return `${A.shortName(n)} — ${parts.join(', ')}`;
    });
    return `[Деньги — у каждого свои счета: ${lines.join('; ')}. Кто платит в тексте — с того и спишется (Life ведёт сам). Траты по средствам: не жмутся, когда есть, и не платят тем, чего нет.${neg.length ? ` ${neg.join('; ')} — платить с него нечем.` : ''}]`;
}

// ───────────── «Что записал пост» и календарь ─────────────

export function walletRecs(i) {
    if (!walletReady()) return [];
    const m = A.chatArr()[i];
    const id = identOf(m);
    const e = W().story[id];
    if (!e) return [];
    return arr(e.list).map((x, k) => ({
        id: `wl:${id}:${k}`, g: 'Деньги', icon: 'wallet',
        t: `${A.shortName(x.who)} · ${accOf(x.acc)?.name || '?'}: ${x.what} ${fmt(x.amount, { sign: true })}${x.skip ? ' (провёл Телефон)' : ''}`,
        del: () => { const cur = W().story[id]; if (!cur) return; cur.list.splice(k, 1); if (!cur.list.length) delete W().story[id]; liveDrop(); storyPhone(); A.saveMeta(); },
    }));
}

export function walletCalEvents(from, to) {
    if (!walletReady()) return [];
    const out = [];
    for (const f of W().flows) {
        if (f.off || !(f.home || A.sameName(accOf(f.acc)?.who, userName()))) continue;
        let ym = String(from).slice(0, 7);
        for (let k = 0; k < 14 && ym <= String(to).slice(0, 7); k++, ym = ymAdd(ym, 1)) {
            if (!inSched(f, ym)) continue;
            const d = dueDay(f, ym);
            if (d < from || d > to) continue;
            out.push({ key: `wl:${f.id}:${ym}`, d, time: '', title: `${f.what} ${fmt(amountFor(f, ym), { short: true })}`, who: [], kind: f.kind === 'in' ? 'money' : 'bill', src: 'wallet', st: f.last && ym <= f.last ? 'done' : 'open' });
        }
    }
    return out;
}

// ───────────── посев «от Claude» и оценка умной моделью ─────────────

/** p = { cur, accs: [...], flows: [...], home: { payer } }; who — имя из посева в имя чата ({{user}}). */
export function walletSeed(p, who = (n) => n) {
    if (!A || !p || typeof p !== 'object') return 0;
    const w = W();
    let n = 0;
    if (p.cur && !w.cur) w.cur = String(p.cur).slice(0, 3);
    for (const a of arr(p.accs)) {
        const id = str(a?.id, 16), nm = who(str(a?.who, 60));
        if (!id || !nm || accOf(id)) continue;
        w.accs.push(normAcc({ ...a, id, who: nm }, 'seed'));
        n++;
    }
    for (const f of arr(p.flows)) {
        const id = str(f?.id, 24);
        if (!id || w.flows.some(x => x.id === id)) continue;
        const nf = normFlow({ ...f, id }, 'seed');
        if (!accOf(nf.acc) || (nf.kind === 'move' && !accOf(nf.to))) continue;
        w.flows.push(nf);
        n++;
    }
    if (p.home && typeof p.home === 'object' && !accOf(w.home.payer) && accOf(p.home.payer)) w.home.payer = p.home.payer;
    if (n) { A.saveMeta(); liveDrop(); }
    return n;
}

const LORE_RE = /деньг|зарплат|пенси|компенсац|наследств|завещ|счёт|счет[ауе]\b|миллион|миллиард|тысяч|\$|долг|аренд|квартир|жильё|живёт|работ|служб|контракт|бизнес|акци|фонд|богат|бедн|нищ|налич|гонорар|казино|выигр/i;
async function estimate(names) {
    const date = storyDay(A) || '—';
    const user = userName();
    const blocks = [];
    for (const n of names) {
        let card = '', lore = '';
        try { card = A.cut(A.cardText?.(n, 1500) || '', 1500); } catch { /* */ }
        try { lore = A.cut(await A.loreFor?.(n, { re: LORE_RE, max: 2400 }) || '', 2400); } catch { /* */ }
        blocks.push(`### ${n}${A.sameName(n, user) ? ' ({{user}})' : ''}\n${card || '(карточки нет)'}${lore ? `\nЛор о деньгах и жизни:\n${lore}` : ''}`);
    }
    const have = accs().map(a => `${A.shortName(a.who)}: ${a.name} ${fmt(accBal(a), { short: true })}`).join('; ');
    const homeHave = W().flows.filter(f => f.home).map(f => f.what).join('; ');
    const sys = `Ты — бухгалтер ролевой истории: по лору, карточкам и эпохе оцениваешь, какие у людей деньги, регулярные доходы и платежи. Правдоподобно для эпохи, страны, профессии и положения человека; суммы, названные в лоре, — как есть. Ответ — строго один JSON по-русски:
{"people":[{"who":"имя как дано","accounts":[{"name":"короткое имя счёта","kind":"card|cash|save|invest|trust|corp","bal":0,"main":true,"lock":false,"note":"откуда деньги и почему столько, 5–20 слов"}],"flows":[{"kind":"in|out","what":"что, 2–5 слов","amount":0,"day":1,"months":[],"acc":"name счёта из его accounts","note":""}]}],"home":[{"what":"","amount":0,"day":1,"months":[],"payer":"имя","vary":"heat|cool|","note":""}]}
Правила: у человека 1–4 счёта; ровно один main — с него повседневное; lock — деньги, которых он не касается (траст, наследство, замороженное, «на чёрный день»); cash — наличные. bal и amount — числом в валюте «${curSym()}», без знаков. flows — регулярные доходы (зарплата, пенсия, пособие, дивиденды) и личные платежи (своя аренда, кредит, алименты) с днём месяца; months — пусто, если каждый месяц, иначе номера месяцев (квартал — 4 номера). home — платежи жилья {{user}} (коммуналка — vary heat для отопления, cool для кондиционера; налоги, страховки, гараж, связь), только если у неё своё жильё или она с кем-то живёт; payer — кто из людей платит. Без лишнего: лучше 3 точных строки, чем 10 придуманных. Уже заведённое не повторяй.`;
    const usr = `Дата истории: ${date}. {{user}} — ${user}.\n${blocks.join('\n\n')}${have ? `\n\nУже заведено (не повторяй): ${have}` : ''}${homeHave ? `\nПлатежи дома уже есть: ${homeHave}` : ''}`;
    const msgs = [{ role: 'system', content: sys }, { role: 'user', content: usr }];
    const o = { what: 'Счета', check: (x) => Array.isArray(x?.people) };
    const j = A.askFillJson ? await A.askFillJson(msgs, 3500, o, {}) : await A.askDeepJson(msgs, 3500, o);
    const people = arr(j?.people).map(p => {
        const nm = names.find(n => A.sameName(n, str(p?.who, 60))) || '';
        return nm ? { who: nm, on: true, accounts: arr(p.accounts).slice(0, 5).map(a => normAcc({ ...a, who: nm, id: '' }, 'ai')).filter(a => a.name), flows: arr(p.flows).slice(0, 6).map(f => ({ ...normFlow({ ...f, acc: '' }, 'ai'), accName: str(f?.acc, 48) })).filter(f => f.amount > 0) } : null;
    }).filter(Boolean);
    const home = arr(j?.home).slice(0, 12).map(f => ({ ...normFlow({ ...f, kind: 'out', home: true, acc: '' }, 'ai'), payerName: str(f?.payer, 60), on: true })).filter(f => f.amount > 0);
    return { people, home };
}
function estApply(est) {
    const w = W();
    let n = 0;
    for (const p of est.people) {
        if (!p.on) continue;
        const mine = accsOf(p.who);
        const made = [];
        for (const a of p.accounts) {
            const dup = mine.find(x => A.norm(x.name) === A.norm(a.name));
            if (dup) { made.push(dup); continue; }
            const na = { ...a, id: nid('a') };
            if (na.main && mine.some(x => x.main)) na.main = false;
            w.accs.push(na); made.push(na); n++;
        }
        if (!made.some(a => a.main && !a.lock)) { const f = made.find(a => !a.lock && a.kind !== 'cash') || made.find(a => !a.lock); if (f && !mine.some(x => x.main)) f.main = true; }
        for (const f of p.flows) {
            const acc = made.find(a => A.norm(a.name) === A.norm(f.accName)) || mainOf(p.who);
            if (!acc || w.flows.some(x => A.norm(x.what) === A.norm(f.what) && accOf(x.acc) && A.sameName(accOf(x.acc).who, p.who))) continue;
            const { accName, ...rest } = f;
            w.flows.push({ ...rest, id: nid('f'), acc: acc.id });
            n++;
        }
    }
    for (const f of est.home) {
        if (!f.on || w.flows.some(x => x.home && A.norm(x.what) === A.norm(f.what))) continue;
        const payer = mainOf(f.payerName) || accOf(walletPayer());
        if (!payer) continue;
        const { payerName, on: _, ...rest } = f;
        w.flows.push({ ...rest, id: nid('f'), acc: payer.id, home: true });
        n++;
    }
    liveDrop();
    A.saveMeta();
    return n;
}

// ───────────── экран ─────────────

let openAcc = '';
let F = null;          // форма открытого листа
const icon = (n) => A.icon(n);
function journalOf(a) {
    const w = W();
    const L = liveSet();
    const rows = w.tx.filter(t => t.acc === a.id).map(t => ({ t: t.what, s: t.amount, d: t.day, at: t.at, k: t.src === 'flow' ? 'по графику' : t.src === 'bill' ? 'счёт' : t.src === 'angar' ? 'Ангар' : t.src === 'dom' ? 'Дом' : t.src === 'house' ? 'быт' : t.src === 'me' ? 'вручную' : t.src, pend: t.pend }));
    for (const [id, e] of Object.entries(w.story)) if (L.has(id)) for (const x of arr(e.list)) if (x.acc === a.id && !x.skip) rows.push({ t: x.what, s: x.amount, d: e.day, at: e.at, k: `история · пост ${Number(e.i) + 1}` });
    return rows.sort((x, y) => (y.at || 0) - (x.at || 0)).slice(0, 12);
}
function flowLine(f, accId) {
    const sched = monthsOf(f).length ? `${f.day}-го · ${monthsOf(f).map(m => MON[m - 1]).join(', ')}` : `${f.day}-го`;
    const sign = f.kind === 'in' || (f.kind === 'move' && f.to === accId) ? '+' : '−';
    return `${sign}${fmt(f.amount, { short: true })} ${f.what}${f.vary ? ' (по сезону)' : ''} · ${sched}`;
}
function accHtml(a) {
    const v = accBal(a);
    const k = KIND[kindOf(a.kind)];
    const fl = W().flows.filter(f => !f.off && !f.home && (f.acc === a.id || f.to === a.id));
    const hf = W().flows.filter(f => !f.off && f.home && f.acc === a.id);
    const open = openAcc === a.id;
    const jr = open ? journalOf(a) : [];
    return `<div class="lf-wl-acc k-${a.kind}${a.lock ? ' lock' : ''}${v < 0 ? ' neg' : ''}${open ? ' open' : ''}">
        <button class="lf-wl-h" data-act="wl-jr" data-id="${esc(a.id)}"><span class="lf-wl-ic">${k[1]}</span><span class="lf-wl-t"><b>${esc(a.name)}</b><small>${esc([k[0], a.phone ? 'в Телефоне' : '', a.main ? 'основной' : '', a.lock ? 'не трогает' : ''].filter(Boolean).join(' · '))}</small></span><span class="lf-wl-s">${esc(fmt(v, { short: true }))}</span></button>
        ${a.note ? `<div class="lf-wl-note">${esc(a.note)}</div>` : ''}
        ${fl.length ? `<div class="lf-wl-fl">${fl.map(f => `<button data-act="wl-flow-edit" data-id="${esc(f.id)}">${esc(flowLine(f, a.id))}</button>`).join('')}</div>` : ''}
        ${hf.length ? `<div class="lf-wl-hf">🏠 платежи дома с этого счёта: ${esc(hf.map(f => f.what.replace(/\s*\(.*?\)/g, '')).slice(0, 4).join(', '))}${hf.length > 4 ? '…' : ''} · ≈${esc(fmt(hf.reduce((x, f) => x + perMonth(f), 0), { short: true }))} в месяц</div>` : ''}
        ${open ? `<div class="lf-tx lf-wl-jr">${jr.length ? jr.map(r => `<div class="lf-tx-r"><span class="lf-tx-t"><b>${esc(r.t)}</b><small>${esc([r.d ? dm(r.d) : '', r.k, r.pend ? 'ждёт Телефон' : ''].filter(Boolean).join(' · '))}</small></span><span class="lf-tx-s${r.s > 0 ? ' plus' : ''}">${esc(fmt(r.s, { sign: true }))}</span></div>`).join('') : `<div class="lf-hint">${a.phone ? 'Журнал этой карты — в Телефоне; здесь то, что провела Life.' : 'Операций пока нет.'}</div>`}</div>
        <div class="lf-actions tight"><button class="lf-btn small" data-act="wl-op" data-id="${esc(a.id)}">± Операция</button><button class="lf-btn small ghost" data-act="wl-flow-new" data-acc="${esc(a.id)}">${icon('calendar')} Регулярное</button><button class="lf-btn small ghost" data-act="wl-acc-edit" data-id="${esc(a.id)}">${icon('pencil')}</button>${a.phone ? `<button class="lf-btn small ghost" data-act="money-phone">${icon('smartphone')}</button>` : ''}</div>` : ''}
    </div>`;
}

/** Вкладка «Деньги» человека: его счета. skipPhone — карту Телефона уже показали крупно. */
export function walletPersonHtml(who, { skipPhone = false } = {}) {
    if (!on() || !A?.hasChat?.()) return '';
    const list = accsOf(who);
    const shown = list.filter(a => !(skipPhone && a.phone));
    const free = list.filter(a => !a.lock).reduce((s, a) => s + accBal(a), 0);
    const all = list.reduce((s, a) => s + accBal(a), 0);
    return `${A.sec(`Счета · ${esc(A.shortName(who))}`, list.length ? `${fmt(free, { short: true })}${Math.abs(all - free) >= 1 ? ` · всего ${fmt(all, { short: true })}` : ''}` : '')}
    ${shown.length ? `<div class="lf-wl-accs">${shown.map(accHtml).join('')}</div>` : list.length ? '' : '<div class="lf-empty small">Счетов пока нет. Заведи сама — или пусть умная модель оценит по лору и карточке.</div>'}
    <div class="lf-actions tight"><button class="lf-btn ghost" data-act="wl-acc-new" data-who="${esc(who)}">${icon('plus')} Счёт</button><button class="lf-btn ghost" data-act="wl-est" data-who="${esc(who)}">${icon('sparkles')} Оценить</button></div>`;
}
/** Строка регулярного по карте Телефона (под большой карточкой банка). */
export function walletPhoneLine() {
    if (!walletReady()) return '';
    const a = accs().find(x => x.phone);
    if (!a) return '';
    const fl = W().flows.filter(f => !f.off && (f.acc === a.id || f.to === a.id) && !f.home);
    return fl.length ? `<div class="lf-wl-fl phone">${fl.map(f => `<button data-act="wl-flow-edit" data-id="${esc(f.id)}">${esc(flowLine(f, a.id))}</button>`).join('')}</div>` : '';
}

const FLOW_IC = (f) => /кондо|общие расходы/i.test(f.what) ? '🏠' : /гараж|машин|мотоц|авто|dodge|challenger/i.test(f.what) ? '🚗' : /налог|imu/i.test(f.what) ? '🏛' : /страх/i.test(f.what) ? '🛡' : /электр|свет/i.test(f.what) ? '💡' : /газ|отоплен/i.test(f.what) ? '🔥' : /вод/i.test(f.what) ? '💧' : /интернет|связ|телефон/i.test(f.what) ? '📶' : /вилл|дом|кондо|аренд|квартир/i.test(f.what) ? '🏠' : /альпин|кош|кот|питом|ветерин/i.test(f.what) ? '🐾' : '📄';
/** Платежи дома: что, когда, с чьего счёта. И кто платит по умолчанию (почта, чеки, Дом). */
export function walletHomeHtml() {
    if (!walletReady()) return '';
    const w = W();
    const t = today();
    const hf = w.flows.filter(f => f.home && !f.off).map(f => ({ f, d: nextDue(f) })).sort((x, y) => String(x.d).localeCompare(String(y.d)));
    const month = hf.reduce((s, x) => s + perMonth(x.f), 0);
    const payer = accOf(walletPayer());
    const gh = guardHistoryCached();
    const ghSum = gh.reduce((s, x) => s + x.amount, 0);
    return `${A.sec('Платежи дома', hf.length ? `≈ ${fmt(month)} в месяц` : '')}
    ${hf.length ? `<div class="lf-bls">${hf.map(({ f, d }) => { const ym = d ? d.slice(0, 7) : ''; const left = d && t ? Math.round((new Date(d) - new Date(t)) / 864e5) : null; return `<div class="lf-bl"><span class="lf-bl-ic">${FLOW_IC(f)}</span><span class="lf-bl-t"><b>${esc(f.what)}</b><small>${esc([d ? `${dm(d)}${left != null && left >= 0 ? ` · через ${left} ${A.plural(left, 'день', 'дня', 'дней')}` : ''}` : '', accLabel(accOf(f.acc), true), monthsOf(f).length ? `только ${monthsOf(f).map(m => MON[m - 1]).join(', ')}` : '', f.vary ? 'по сезону' : ''].filter(Boolean).join(' · '))}</small></span><span class="lf-bl-s">${esc(fmt(ym ? amountFor(f, ym) : f.amount))}</span><button class="lf-iconbtn" data-act="wl-flow-edit" data-id="${esc(f.id)}" title="править">${icon('pencil')}</button></div>`; }).join('')}</div>` : '<div class="lf-empty small">Постоянных платежей дома нет: налоги, страховка, гараж, коммуналка — добавь, и они пойдут сами в срок по дате истории, с нужного счёта.</div>'}
    <div class="lf-actions tight"><button class="lf-btn ghost" data-act="wl-flow-new" data-home="1">${icon('plus')} Платёж</button><button class="lf-btn ghost" data-act="wl-est" data-who="">${icon('sparkles')} Оценить всех</button></div>
    <div class="lf-wl-payer"><small>Почта, чеки быта и покупки Дома — по умолчанию с</small><button class="lf-chip on" data-act="wl-payer" data-for="home">${esc(accLabel(payer, true))}</button></div>
    ${gh.length ? `<div class="lf-wl-guard"><span>Свайпы списали лишнее: ${gh.length} ${A.plural(gh.length, 'операция', 'операции', 'операций')} на ${esc(fmt(Math.abs(ghSum)))} — из вариантов ответа, которые ты отвергла.</span><button class="lf-btn small primary" data-act="wl-guard">Разобрать</button></div>` : ''}
    <div class="lf-chips wrap">${[['story', 'траты из истории'], ['guard', 'свайп не списывает дважды'], ['prompt', 'деньги — в заметку модели']].map(([k, l]) => `<button class="lf-chip${cfg()[k] ? ' on' : ''}" data-act="wl-set" data-k="${k}">${l}</button>`).join('')}</div>`;
}

/** Для панели и пульта: сколько у людей счетов, есть ли минус. */
export function walletState() {
    if (!walletReady()) return { n: 0, neg: false };
    return { n: accs().length, neg: accs().some(a => a.main && accBal(a) < 0) };
}

// ───────────── листы ─────────────

function peopleAll() {
    const out = [];
    const add = (n) => { if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    add(userName());
    for (const n of A.groupMembers?.() || []) add(n);
    for (const a of accs()) add(a.who);
    return out;
}
function keep(el) {
    if (!F) return;
    const box = el?.closest?.('.lf-sheet') || document;
    for (const i of box.querySelectorAll('[data-in^="wl-"]')) F[i.dataset.in.slice(3)] = i.value;
}
const chipRow = (k, opts) => `<div class="lf-chips wrap">${opts.map(([v, l]) => `<button class="lf-chip${String(F[k]) === String(v) ? ' on' : ''}" data-act="wl-f" data-k="${k}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;

function accSheet() {
    const ppl = peopleAll();
    const phoneFree = !accs().some(a => a.phone && a.id !== F.id) && !!bankNow() && A.sameName(F.who, userName());
    A.openSheet(`${icon('wallet')} ${F.id ? 'Счёт' : 'Новый счёт'}`, `
        <div class="lf-field"><label>Чей</label>${chipRow('who', ppl.map(n => [n, A.shortName(n)]))}</div>
        <div class="lf-field"><label>Название</label><input type="text" data-in="wl-name" value="${esc(F.name || '')}" placeholder="Ветеранская карта"></div>
        <div class="lf-field"><label>Что это</label>${chipRow('kind', Object.entries(KIND).map(([k, v]) => [k, `${v[1]} ${v[0]}`]))}</div>
        ${F.phone ? '<div class="lf-hint">Это карта в Телефоне: баланс и журнал живут там.</div>' : `<div class="lf-field"><label>Сейчас на счету (${esc(curSym())})</label><input type="number" inputmode="decimal" data-in="wl-bal" value="${esc(F.bal ?? '')}" placeholder="0"></div>`}
        <div class="lf-chips wrap"><button class="lf-chip${F.main ? ' on' : ''}" data-act="wl-f" data-k="main" data-v="tog">основной — с него повседневное</button><button class="lf-chip${F.lock ? ' on' : ''}" data-act="wl-f" data-k="lock" data-v="tog">не трогает</button>${phoneFree || F.phone ? `<button class="lf-chip${F.phone ? ' on' : ''}" data-act="wl-f" data-k="phone" data-v="tog">это карта в Телефоне</button>` : ''}</div>
        <div class="lf-field"><label>Откуда деньги</label><textarea data-in="wl-note" rows="3" placeholder="правительственная компенсация 2023-го">${esc(F.note || '')}</textarea></div>
        <button class="lf-btn primary full" data-act="wl-acc-save">${icon('check')} Сохранить</button>
        ${F.id ? `<button class="lf-btn ghost full" data-act="wl-acc-del">${icon('trash')} ${F.delAsk ? 'Точно удалить? Тапни ещё раз' : 'Удалить счёт'}</button>` : ''}`);
}
function opSheet() {
    const a = accOf(F.acc);
    A.openSheet(`± ${esc(accLabel(a))}`, `
        ${chipRow('sign', [['-', '− трата'], ['+', '+ приход']])}
        <div class="lf-field"><label>Сколько (${esc(curSym())})</label><input type="number" inputmode="decimal" data-in="wl-sum" value="${esc(F.sum || '')}" placeholder="120"></div>
        <div class="lf-field"><label>За что</label><input type="text" data-in="wl-what" value="${esc(F.what || '')}" placeholder="ужин в «Ки́нс»"></div>
        <button class="lf-btn primary full" data-act="wl-op-save">${icon('check')} Провести</button>
        <div class="lf-hint">${a?.phone ? 'Уйдёт операцией в банк Телефона.' : 'Сегодняшним числом истории.'}</div>`);
}
const SCHED = [['m', 'каждый месяц'], ['q', 'раз в квартал'], ['h', 'раз в полгода'], ['y', 'раз в год']];
function schedMonths(s, m0) { const m = clamp(Number(m0) || 1, 1, 12); const step = { q: 3, h: 6, y: 12 }[s]; if (!step) return []; const out = []; for (let k = 0; k < 12 / step; k++) out.push(((m - 1 + k * step) % 12) + 1); return out.sort((x, y) => x - y); }
function flowSheet() {
    const near = [userName(), accOf(F.acc)?.who, accOf(F.to)?.who].filter(Boolean);
    const all = accs().filter(a => F.allAcc || near.some(n => A.sameName(n, a.who)));
    const accRow = (k, ok = () => true) => `${chipRow(k, all.filter(ok).map(a => [a.id, accLabel(a, true)]))}${F.allAcc ? '' : '<div class="lf-chips wrap"><button class="lf-chip ghost" data-act="wl-f" data-k="allAcc" data-v="tog">＋ счета других людей</button></div>'}`;
    const paysOut = (a) => !a.lock;
    A.openSheet(`${icon('calendar')} ${F.id ? 'Регулярное' : 'Новое регулярное'}`, `
        ${chipRow('kind', [['out', '− платёж'], ['in', '+ доход'], ['move', '⇄ перевод']])}
        <div class="lf-field"><label>Что</label><input type="text" data-in="wl-what" value="${esc(F.what || '')}" placeholder="${F.kind === 'in' ? 'Пенсия' : 'Аренда гаража'}"></div>
        <div class="lf-field"><label>Сколько (${esc(curSym())})${F.vary ? ' — в среднем за год' : ''}</label><input type="number" inputmode="decimal" data-in="wl-amount" value="${esc(F.amount ?? '')}" placeholder="1150"></div>
        <div class="lf-field"><label>${F.kind === 'in' ? 'На какой счёт' : 'С какого счёта'}</label>${accRow('acc', F.kind === 'in' ? () => true : paysOut)}</div>
        ${F.kind === 'move' ? `<div class="lf-field"><label>На какой счёт</label>${accRow('to', (a) => a.id !== F.acc)}</div>` : ''}
        <div class="lf-field"><label>Какого числа</label><input type="number" inputmode="numeric" min="1" max="31" data-in="wl-day" value="${esc(F.day ?? 1)}"></div>
        <div class="lf-field"><label>Как часто</label>${chipRow('sched', SCHED)}${F.sched !== 'm' ? `<small class="lf-hint">${F.sched === 'y' ? 'В каком месяце' : 'С какого месяца'}:</small>${chipRow('m0', MON.map((m, k) => [k + 1, m]))}` : ''}</div>
        ${F.kind === 'out' ? `<div class="lf-field"><label>Сумма по сезону</label>${chipRow('vary', [['', 'ровно'], ['heat', 'зимой больше (отопление)'], ['cool', 'летом больше (кондиционер)']])}</div>` : ''}
        <div class="lf-chips wrap"><button class="lf-chip${F.home ? ' on' : ''}" data-act="wl-f" data-k="home" data-v="tog">платёж дома</button></div>
        <button class="lf-btn primary full" data-act="wl-flow-save">${icon('check')} Сохранить</button>
        ${F.id ? `<button class="lf-btn ghost full" data-act="wl-flow-del">${icon('trash')} ${F.delAsk ? 'Точно убрать? Тапни ещё раз' : 'Убрать'}</button>` : ''}
        <div class="lf-hint">Пойдёт само в срок по дате истории. Пропустили месяцы (скачок во времени) — спишется за все.</div>`);
}
function pickSheet(title, cur, cb) {
    F = { _s: 'pick', pick: cb };
    const groups = peopleAll().map(n => ({ n, l: accsOf(n).filter(a => !a.lock) })).filter(g => g.l.length);
    A.openSheet(`${icon('wallet')} ${esc(title)}`, groups.map(g => `<div class="lf-field"><label>${esc(g.n)}</label><div class="lf-chips wrap">${g.l.map(a => `<button class="lf-chip${a.id === cur ? ' on' : ''}" data-act="wl-pick" data-id="${esc(a.id)}">${KIND[kindOf(a.kind)][1]} ${esc(a.name)} · ${esc(fmt(accBal(a), { short: true }))}</button>`).join('')}</div></div>`).join('') || '<div class="lf-empty small">Счетов нет.</div>');
}
/** Выбор счёта для чужих листов (счета почты): cb(id). */
export function walletPick(title, cur, cb) { if (walletReady()) pickSheet(title, cur, cb); }

function estSheet() {
    const e = F.est;
    const accLine = (a) => `${KIND[a.kind][1]} ${a.name} ${fmt(a.base, { short: true })}${a.main ? ' · осн.' : ''}${a.lock ? ' · не трогает' : ''}`;
    A.openSheet(`${icon('sparkles')} Оценка умной модели`, `
        ${e.people.map((p, k) => `<div class="lf-wl-est${p.on ? ' on' : ''}"><button class="lf-wl-est-h" data-act="wl-est-tog" data-k="p${k}"><b>${p.on ? '✓' : '○'} ${esc(p.who)}</b></button>
            ${p.accounts.map(a => `<div class="lf-wl-est-r">${esc(accLine(a))}${a.note ? `<small>${esc(a.note)}</small>` : ''}</div>`).join('')}
            ${p.flows.map(f => `<div class="lf-wl-est-r">${f.kind === 'in' ? '+' : '−'}${esc(fmt(f.amount, { short: true }))} ${esc(f.what)} · ${f.day}-го${f.accName ? ` · ${esc(f.accName)}` : ''}</div>`).join('')}</div>`).join('')}
        ${e.home.length ? `<div class="lf-field"><label>Платежи дома</label>${e.home.map((f, k) => `<button class="lf-wl-est-r btn${f.on ? ' on' : ''}" data-act="wl-est-tog" data-k="h${k}">${f.on ? '✓' : '○'} ${esc(f.what)} ${esc(fmt(f.amount))} · ${f.day}-го${f.payerName ? ` · платит ${esc(A.shortName(f.payerName))}` : ''}${f.vary ? ' · по сезону' : ''}</button>`).join('')}</div>` : ''}
        ${e.people.length || e.home.length ? `<button class="lf-btn primary full" data-act="wl-est-ok">${icon('check')} Завести отмеченное</button>` : '<div class="lf-empty small">Модель ничего не предложила.</div>'}
        <div class="lf-hint">Всё потом правится руками: суммы, кто платит, что «не трогает».</div>`);
}
function guardSheet() {
    const l = F.guard;
    A.openSheet(`${icon('undo')} Лишние списания`, `
        <div class="lf-hint">Телефон списал деньги по тегам из вариантов ответа, которые ты потом отвергла свайпом. В истории этих трат нет — вернуть их на карту.</div>
        <div class="lf-tx">${l.map(x => `<div class="lf-tx-r"><span class="lf-tx-t"><b>${esc(x.label)}</b><small>пост ${Number(x.idx) + 1} · другой вариант</small></span><span class="lf-tx-s">${esc(fmt(x.amount, { sign: true }))}</span></div>`).join('')}</div>
        <button class="lf-btn primary full" data-act="wl-guard-ok">${icon('undo')} Вернуть ${esc(fmt(Math.abs(l.reduce((s, x) => s + x.amount, 0))))}</button>`);
}
const resheet = () => ({ acc: accSheet, op: opSheet, flow: flowSheet, est: estSheet })[F?._s]?.();

export async function walletClick(act, el) {
    if (!act.startsWith('wl-')) return false;
    const w = W();
    const d = el?.dataset || {};
    switch (act) {
        case 'wl-jr': openAcc = openAcc === d.id ? '' : d.id; A.render(); return true;
        case 'wl-set': { const c = cfg(); c[d.k] = !c[d.k]; A.saveSettings(); if (d.k === 'guard' && c.guard) walletSoon(200); A.updatePrompt?.(); A.render(); return true; }
        case 'wl-f': {
            keep(el);
            if (d.v === 'tog') F[d.k] = !F[d.k]; else F[d.k] = d.v;
            if (d.k === 'kind' && F._s === 'acc' && d.v === 'cash') F.main = F.main && false;
            if (F._s === 'flow' && d.k === 'm0' && !F.sched) F.sched = 'y';
            F.delAsk = false;
            resheet();
            return true;
        }
        case 'wl-acc-new': { const who = d.who || userName(); F = { _s: 'acc', who, kind: 'card', main: !accsOf(who).some(a => a.main), name: '', bal: '' }; accSheet(); return true; }
        case 'wl-acc-edit': { const a = accOf(d.id); if (!a) return true; F = { _s: 'acc', id: a.id, who: a.who, name: a.name, kind: a.kind, main: a.main, lock: a.lock, phone: a.phone, note: a.note, bal: a.phone ? '' : String(accBal(a)) }; accSheet(); return true; }
        case 'wl-acc-save': {
            keep(el);
            if (!F?.who) return true;
            let a = accOf(F.id);
            if (!a) { a = normAcc({ who: F.who, kind: F.kind, name: F.name }); w.accs.push(a); }
            a.who = F.who; a.name = str(F.name, 48) || KIND[kindOf(F.kind)][0]; a.kind = kindOf(F.kind); a.lock = !!F.lock; a.note = str(F.note, 300);
            a.phone = !!F.phone && !accs().some(x => x.phone && x.id !== a.id);
            if (F.main) { for (const x of accsOf(a.who)) x.main = false; a.main = true; } else a.main = false;
            if (!a.phone && String(F.bal ?? '').trim() !== '') { const want = round2(num(F.bal)); a.base = round2((Number(a.base) || 0) + want - accBal(a)); }
            liveDrop();
            A.closeSheet(); F = null;
            break;
        }
        case 'wl-acc-del': {
            if (!F?.id) return true;
            if (!F.delAsk) { F.delAsk = true; accSheet(); return true; }
            w.accs = w.accs.filter(a => a.id !== F.id);
            w.flows = w.flows.filter(f => f.acc !== F.id && f.to !== F.id);
            if (w.home.payer === F.id) w.home.payer = '';
            A.closeSheet(); F = null;
            break;
        }
        case 'wl-op': { F = { _s: 'op', acc: d.id, sign: '-', sum: '', what: '' }; opSheet(); return true; }
        case 'wl-op-save': {
            keep(el);
            const v = Math.abs(num(F.sum));
            if (!v || !accOf(F.acc)) return true;
            walletMove(F.acc, F.sign === '+' ? v : -v, str(F.what, 70) || (F.sign === '+' ? 'Приход' : 'Трата'), 'вручную', 'me');
            A.closeSheet(); F = null;
            break;
        }
        case 'wl-flow-new': {
            const acc = d.acc || (d.home ? walletPayer() : walletMainOf(userName()));
            F = { _s: 'flow', kind: d.home ? 'out' : (accOf(acc)?.kind === 'card' ? 'in' : 'out'), what: '', amount: '', acc, to: '', day: 1, sched: 'm', m0: 1, vary: '', home: !!d.home };
            flowSheet(); return true;
        }
        case 'wl-flow-edit': {
            const f = w.flows.find(x => x.id === d.id);
            if (!f) return true;
            const ms = monthsOf(f);
            F = { _s: 'flow', id: f.id, kind: f.kind, what: f.what, amount: String(f.amount), acc: f.acc, to: f.to, day: f.day, sched: !ms.length ? 'm' : ms.length >= 4 ? 'q' : ms.length === 2 ? 'h' : 'y', m0: ms[0] || 1, vary: f.vary, home: f.home };
            flowSheet(); return true;
        }
        case 'wl-flow-save': {
            keep(el);
            const amount = Math.abs(num(F.amount));
            if (!amount || !accOf(F.acc) || (F.kind === 'move' && !accOf(F.to))) { A.toast?.('info', 'Нужны сумма и счёт.', '✦ Счета'); return true; }
            const months = schedMonths(F.sched, F.m0);
            let f = w.flows.find(x => x.id === F.id);
            const nf = normFlow({ ...(f || {}), id: f?.id || '', kind: F.kind, what: F.what, amount, acc: F.acc, to: F.to, day: F.day, months, vary: F.kind === 'out' ? F.vary : '', home: F.home, last: f?.last || '' });
            if (f) {
                const re = String(f.day) !== String(nf.day) || monthsOf(f).join() !== nf.months.join();
                Object.assign(f, nf);
                if (re) f.last = lastDue(f, today() || `${new Date().getFullYear()}-12-31`);
            } else { nf.last = today() ? lastDue(nf, today()) : ''; w.flows.push(nf); }
            A.closeSheet(); F = null;
            break;
        }
        case 'wl-flow-del': {
            if (!F?.id) return true;
            if (!F.delAsk) { F.delAsk = true; flowSheet(); return true; }
            w.flows = w.flows.filter(f => f.id !== F.id);
            A.closeSheet(); F = null;
            break;
        }
        case 'wl-payer': pickSheet('Кто платит за дом', walletPayer(), (id) => { W().home.payer = id; }); return true;
        case 'wl-pick': { const cb = F?.pick; A.closeSheet(); F = null; if (cb) { try { cb(d.id); } catch (e) { console.warn('[Life] счета: выбор', e); } } break; }
        case 'wl-est': {
            const names = d.who ? [d.who] : peopleAll().filter(n => !accsOf(n).length);
            if (!names.length) { A.toast?.('info', 'У всех уже есть счета. Оценить одного — на его странице, вкладка «Деньги».', '✦ Счета'); return true; }
            try {
                const est = await A.withBusy(el, () => estimate(names), 'Считаю…');
                if (!est) return true;
                F = { _s: 'est', est };
                estSheet();
            } catch (e) { A.toast?.('warning', A.esc(String(e?.message || e)), '✦ Счета'); }
            return true;
        }
        case 'wl-est-tog': {
            const k = String(d.k || '');
            const x = k[0] === 'p' ? F?.est?.people[Number(k.slice(1))] : F?.est?.home[Number(k.slice(1))];
            if (x) { x.on = !x.on; estSheet(); }
            return true;
        }
        case 'wl-est-ok': {
            const n = F?.est ? estApply(F.est) : 0;
            A.closeSheet(); F = null;
            A.toast?.('success', n ? `Завела: ${n}` : 'Нового нечего заводить.', '✦ Счета');
            setTimeout(() => walletSweep(), 50);
            break;
        }
        case 'wl-guard': { const l = guardHistory(); if (!l.length) { A.toast?.('info', 'Лишних списаний нет.', '✦ Счета'); return true; } F = { _s: 'guard', guard: l }; guardSheet(); return true; }
        case 'wl-guard-ok': {
            const r = guardApply(F?.guard || []);
            A.closeSheet(); F = null;
            A.toast?.('success', r.n ? `Вернула на карту ${fmt(Math.abs(r.sum))} (${r.n})` : 'Нечего возвращать.', '✦ Счета');
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt?.(); A.render();
    return true;
}

// ───────────── соседям: Ангар, Дом и кто угодно ─────────────

function installGlobal() {
    globalThis.LifeMoney = {
        version: 1,
        ready: () => walletReady(),
        fmt: (n) => fmt(n),
        /** Счета человека (или все): [{ id, who, name, kind, main, lock, phone, bal, text }]. */
        accounts: (who = '') => (who ? accsOf(who) : accs()).map(a => ({ id: a.id, who: a.who, name: a.name, kind: a.kind, main: a.main, lock: a.lock, phone: a.phone, bal: accBal(a), text: fmt(accBal(a)), label: accLabel(a, true) })),
        /** Чем можно платить: сперва счета who, потом {{user}}, потом остальных (без «не трогает»). */
        payers: (who = '') => {
            const order = [];
            const add = (n) => { for (const a of accsOf(n)) if (!a.lock && !order.includes(a)) order.push(a); };
            if (who) add(who);
            add(userName());
            for (const a of accs()) if (!a.lock && !order.includes(a)) order.push(a);
            return order.map(a => ({ id: a.id, who: a.who, name: a.name, kind: a.kind, bal: accBal(a), text: fmt(accBal(a), { short: true }), label: accLabel(a, true) }));
        },
        /** С какого счёта платить по умолчанию: src — 'angar' | 'dom' | 'bill'; who — для кого покупка. */
        defaultPayer: (src = '', who = '') => (src === 'dom' || src === 'bill' ? walletPayer() : (who && walletMainOf(who)) || walletMainOf(userName()) || walletPayer()),
        balance: (id) => { const a = accOf(id); return a ? { v: accBal(a), text: fmt(accBal(a)), name: accLabel(a, true) } : null; },
        /** Списать: { acc?, who?, amount, label, category, src }. Не хватает денег — { ok: false, why }. */
        pay: async ({ acc = '', who = '', amount = 0, label = '', category = 'покупки', src = 'ext' } = {}) => {
            if (!walletReady()) return { ok: false, why: 'счетов нет' };
            await bank();
            const id = accOf(acc) ? acc : (who && walletMainOf(who)) || walletPayer();
            const r = walletPay(id, amount, label, category, src, '', { check: true });
            if (r.ok) { A.updatePrompt?.(); if (A.ui?.open) A.render?.(); }
            return r;
        },
    };
}
