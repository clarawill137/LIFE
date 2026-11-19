// Счета капают. Постоянные платежи Телефона (аренда, связь) Life и так списывает в день оплаты — а жизнь
// подкидывает свои. В начале месяца истории приходит коммуналка за прошлый: свет, газ или отопление, вода —
// сумма от сезона и от того, как жили. Раз в неделю истории — почта: 0–2 неожиданных счёта (ремонт сломанного
// из «Быта», ветеринар кота, штраф, забытая подписка, врач, подарок). Счёт приходит пушем, срок — в Календарь.
// В срок списывается сам (если включено и хватает денег); не хватило — просрочка: через 5 дней пеня, через три
// недели коммуналку отключают, пока не оплатят. Покупки быта (продукты, прачечная) копятся чеками за день и уходят
// в банк одной строкой, когда день истории кончился. Без Телефона (1940-е) — платят наличными: всё то же, без банка.

import { storyDay, str, arr, clamp } from './hudkit.js';
import { moneyView, addTx, bank, bankNow } from './money.js';

let A = null;
export function initBills(api) { A = api; }
const esc = (v) => A.esc(v);

const KIND = { util: ['Коммуналка', '💡'], repair: ['Ремонт', '🔧'], vet: ['Ветеринар', '🐾'], fine: ['Штраф', '🚓'], medical: ['Врач', '🩺'], sub: ['Подписка', '📺'], gift: ['Подарок', '🎁'], other: ['Счёт', '📨'] };
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const dmy = (s) => { const d = fromYmd(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`; };

function cfg() {
    const s = A.settings();
    if (!s.bills || typeof s.bills !== 'object') s.bills = {};
    const c = s.bills;
    for (const k of ['on', 'autopay', 'mail', 'util', 'spend']) if (c[k] === undefined) c[k] = true;
    return c;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.bills || typeof cm.bills !== 'object') cm.bills = {};
    const s = cm.bills;
    if (!Array.isArray(s.list)) s.list = [];     // { id, what, amount, kind, due, st: new|paid|overdue|cut, mes, at, src, note, fee, paidOn, came }
    if (!Array.isArray(s.spend)) s.spend = [];   // { id, what, amount, day, mes, src, done: false|'bank'|'cash' }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}

/** Сегодня по истории (YYYY-MM-DD) или ''. */
function today() { const d = A.parseDate(storyDay(A)); return d && !isNaN(d) ? ymdOf(d) : ''; }
const daysBetween = (a, b) => Math.round((fromYmd(b) - fromYmd(a)) / DAY);

/** Валюта: из банка Телефона, иначе доллар. */
function cur() {
    const c = String(moneyView()?.currency || '$');
    return { USD: '$', EUR: '€', RUB: '₽', GBP: '£', CZK: 'Kč', UAH: '₴' }[c] || c;
}
export function fmt(n) {
    const c = cur();
    const v = Math.round(Number(n) * 100) / 100;
    const s = Number.isInteger(v) ? String(v) : v.toFixed(2);
    return /^[$€£]$/.test(c) ? `${c}${s}` : `${s} ${c}`;
}
const unpaid = () => M().list.filter(x => x.st !== 'paid');

// ───────────── почта ─────────────

let busy = false;

async function fetchMail(util, weeks = 1) {
    if (busy) return 0;
    busy = true;
    try {
        const st = A.worldState();
        const t = today();
        const mv = moneyView();
        let broken = [];
        try { broken = (A.homeBroken?.() || []).map(x => x.what); } catch { /* */ }
        let pets = [];
        try { pets = (A.petsList?.() || []).map(p => p.name).filter(Boolean); } catch { /* */ }
        let days = '';
        try { days = A.daysBrief?.() || ''; } catch { /* */ }
        let place = '';
        try { place = A.homeLoc?.() || st?.scene?.location || ''; } catch { /* */ }
        const rec = (mv?.bills || []).map(b => `${b.name} ${b.sum}`).join('; ');
        const prev = new Date(fromYmd(t)); prev.setMonth(prev.getMonth() - 1);
        const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
        const sys = `Ты ведёшь бытовую бухгалтерию ролевой истории: какие счета пришли по почте (или в приложение) — правдоподобно для места и года. Ответ — строго один JSON по-русски: {"bills":[{"what":"за что, 2-6 слов","amount":0,"kind":"util|repair|vet|fine|medical|sub|gift|other","due_in":10,"note":"почему такая сумма, 3-10 слов, или пусто"}]}.
${util ? `Обязательно — коммуналка за ${MON[prev.getMonth()]}: свет, газ или отопление, вода, отдельными счетами (кроме того, что уже входит в постоянные платежи). Сумма — от сезона, размера жилья и того, как жили (кто-то ночами гоняет лабораторию, гости, стирки, кто-то месяц был в отъезде).\n` : ''}Плюс от 0 до ${weeks > 1 ? 3 : 2} неожиданных: ремонт сломанного (список дан), ветеринар питомца, штраф (парковка, превышение), подписка, о которой забыли, врач, страховка, подарок к празднику; бывает, что ничего. Не дублируй постоянные платежи. amount — числом, в валюте «${cur()}», по ценам места и года. due_in — через сколько дней срок оплаты (7–20).`;
        const usr = `Дата истории: ${storyDay(A) || '—'}. Жильё и город: ${place || '—'}.${st?.scene?.atmosphere ? ` Погода: ${st.scene.atmosphere}.` : ''}${weeks > 1 ? ` С прошлой почты прошло ~${weeks} нед.` : ''}
Постоянные платежи (уже платятся сами): ${rec || 'нет'}.
Сломано дома: ${broken.join('; ') || 'ничего'}. Питомцы: ${pets.join(', ') || 'нет'}.${days ? `\nПоследние дни:\n${A.cut(days, 2500)}` : ''}`;
        const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 900, { check: (x) => Array.isArray(x?.bills), what: 'Почта' });
        const s = M();
        const got = [];
        for (const r of arr(j.bills).slice(0, 6)) {
            const what = str(r?.what, 70), amount = Math.round(Number(r?.amount) * 100) / 100;
            if (!what || !(amount > 0)) continue;
            const due = new Date(fromYmd(t)); due.setDate(due.getDate() + clamp(Math.round(Number(r?.due_in) || 10), 3, 30));
            const x = { id: `m${++s.seq}`, what, amount, kind: KIND[str(r?.kind)] ? str(r.kind) : 'other', due: ymdOf(due), st: 'new', mes: A.chatArr().length - 1, at: Date.now(), came: t, src: 'mail', note: str(r?.note, 90) };
            s.list.push(x);
            got.push(x);
        }
        if (s.list.length > 120) s.list.splice(0, s.list.length - 120);
        A.saveMeta(); A.updatePrompt();
        if (got.length) A.push?.({ app: 'Почта', icon: 'mail', tint: '#e7c77a', title: got.length > 1 ? `Пришли счета · ${got.length}` : 'Пришёл счёт', text: got.map(x => `${x.what} ${fmt(x.amount)}`).join(' · '), onTap: () => A.openBills?.(), ms: 7000 });
        return got.length;
    } finally { busy = false; }
}

/** Пора ли за почтой: раз в неделю истории, коммуналка — со сменой месяца. */
function mailDue() {
    const s = M();
    const t = today();
    if (!t) return null;
    if (!s.lastMail) { s.lastMail = t; s.lastUtil = t.slice(0, 7); A.saveMeta(); return null; }
    const d = daysBetween(s.lastMail, t);
    const util = cfg().util && s.lastUtil && t.slice(0, 7) > s.lastUtil;
    if (d < 7 && !util) return null;
    if (d < 0) { s.lastMail = t; return null; }   // ушли в прошлое (флешбек) — не трогаем
    return { util: !!util, weeks: Math.max(1, Math.floor(d / 7)), mail: cfg().mail && d >= 7 };
}

// ───────────── оплата, просрочка, чеки ─────────────

function pay(x, how = 'tap') {
    const t = today();
    const bk = !!bankNow();
    // одна строка в банке на счёт: откат свайпом и повторная оплата не списывают второй раз
    if (bk && !x.tx) { try { addTx({ amount: -x.amount, label: x.what, category: x.kind === 'util' ? 'счета' : KIND[x.kind][0].toLowerCase() }); x.tx = true; } catch (e) { console.warn('[Life] счёт → банк', e); } }
    x.st = 'paid'; x.paidOn = t || ''; x.how = bk ? how : 'cash';
}

/** Сверка по дате истории: автоплатёж в срок, просрочка, пеня, отключение; чеки прошлых дней — в банк. Вернёт, что случилось. */
export async function billsSweep() {
    if (!on() || !A?.hasChat?.()) return [];
    const t = today();
    if (!t) return [];
    await bank();
    const s = M();
    const c = cfg();
    const out = [];
    const bal = () => { const v = moneyView(); return v ? Number(v.balance) || 0 : Infinity; };
    for (const x of s.list) {
        if (x.st === 'paid' || !x.due) continue;
        const late = daysBetween(x.due, t);
        if (late >= 0 && x.st === 'new' && c.autopay && bal() >= x.amount) { pay(x, 'auto'); out.push(`списано: ${x.what} ${fmt(x.amount)}`); continue; }
        if (late > 0 && x.st === 'new') { x.st = 'overdue'; out.push(`просрочен: ${x.what}`); }
        if (late >= 5 && !x.fee && x.st !== 'paid') { x.fee = Math.max(1, Math.round(x.amount * 0.1)); x.amount = Math.round((x.amount + x.fee) * 100) / 100; out.push(`пеня: ${x.what} +${fmt(x.fee)}`); }
        if (late >= 21 && x.kind === 'util' && x.st === 'overdue') { x.st = 'cut'; out.push(`отключили: ${x.what}`); }
    }
    // чеки быта: всё, что не сегодня, — одной строкой за день
    const days = [...new Set(s.spend.filter(x => !x.done && x.day && x.day < t).map(x => x.day))];
    for (const d of days) {
        const list = s.spend.filter(x => !x.done && x.day === d);
        const sum = Math.round(list.reduce((a, x) => a + x.amount, 0) * 100) / 100;
        const bk = !!bankNow() && c.spend;
        if (bk && sum > 0) { try { addTx({ amount: -sum, label: `Быт ${dmy(d)}: ${[...new Set(list.map(x => x.what))].join(', ')}`, category: 'быт' }); } catch (e) { console.warn('[Life] чеки → банк', e); } }
        for (const x of list) x.done = bk ? 'bank' : 'cash';
    }
    if (s.spend.length > 200) s.spend.splice(0, s.spend.length - 200);
    if (out.length || days.length) { A.saveMeta(); A.updatePrompt(); }
    if (out.length) A.push?.({ app: 'Банк', icon: 'wallet', tint: '#9fc79a', title: 'Счета', text: out.slice(0, 3).join(' · '), onTap: () => A.openBills?.(), ms: 6000 });
    return out;
}

/** Чеки быта от поста i (дом зовёт после каждого поста; повтор — заменяет). */
export function billsSpend(i, list) {
    const s = M();
    s.spend = s.spend.filter(x => !(x.mes === i && x.src === 'house' && !x.done));
    const t = today();
    for (const r of list || []) {
        if (!(r.amount > 0)) continue;
        s.spend.push({ id: `s${++s.seq}`, what: str(r.what, 40) || 'Покупки', amount: r.amount, who: r.who || '', day: t, mes: i, src: 'house', done: false });
    }
}

// ───────────── Летописец и после поста ─────────────

export function billsChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const list = unpaid().slice(-8);
    if (!list.length) return null;
    return {
        key: '"billsPaid": []',
        rule: `\nbillsPaid — счета из «К оплате», которые в этом посте ОПЛАТИЛИ (вслух или делом: перевела, заплатил наличными): ["m3"]. Нечего — [].`,
        tokens: 30,
        input: `К оплате: ${list.map(x => `[${x.id}] ${x.what} ${fmt(x.amount)}`).join('; ')}`,
    };
}

export function billsAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    for (const x of s.list) if (x.paidMes === i) { x.st = x.prevSt || 'new'; delete x.paidMes; delete x.prevSt; }
    for (const id of arr(j?.billsPaid)) {
        const x = s.list.find(y => y.id === String(id) && y.st !== 'paid');
        if (x) { x.prevSt = x.st; pay(x, 'post'); x.paidMes = i; }
    }
    A.saveMeta();
    billsSweep().catch(e => console.warn('[Life] счета', e));
    const due = mailDue();
    if (due && (due.mail || due.util)) {
        const s2 = M();
        const t = today();
        s2.lastMail = t;
        if (due.util) s2.lastUtil = t.slice(0, 7);
        A.saveMeta();
        setTimeout(() => { fetchMail(due.util, due.weeks).then(n => { if (n) A.render?.(); }).catch(e => console.warn('[Life] почта', e)); }, 6000);
    }
}

export function billsPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const n = A.chatArr().length;
    const t = today();
    const out = [];
    const cut = s.list.filter(x => x.st === 'cut');
    if (cut.length) out.push(`[Отключили за неуплату: ${cut.map(x => x.what).join('; ')}. Пока не оплатят — этого нет: темно, холодно, не работает. В каждой сцене дома это чувствуется.]`);
    const fresh = s.list.filter(x => x.st !== 'paid' && n - 1 - x.mes <= 2);
    if (fresh.length) out.push(`[Пришла почта: ${fresh.map(x => `${x.what} — ${fmt(x.amount)}, оплатить до ${dmy(x.due)}`).join('; ')}. Конверт на столе или пуш в телефоне — пусть заметят, к месту.]`);
    const late = s.list.filter(x => x.st === 'overdue');
    if (late.length && n % 3 === 0) out.push(`[Просрочено: ${late.map(x => `${x.what} ${fmt(x.amount)}${x.fee ? ' (уже с пеней)' : ''}`).join('; ')}. Приходят напоминания, звонят.]`);
    const v = moneyView();
    const owe = unpaid().reduce((a, x) => a + x.amount, 0);
    if (v && owe > 0 && Number(v.balance) < owe && n % 3 === 0) out.push(`[Денег впритык: на счету ${v.balanceText}, а к оплате ${fmt(owe)}.]`);
    return out.join('\n');
}

/** Для перепалок: что с деньгами можно поставить в вину. */
export function billsIrritants() {
    return M().list.filter(x => x.st === 'overdue' || x.st === 'cut').slice(-2).map(x => ({ act: `забыл оплатить «${x.what}» — пришло напоминание`, why: '', start: '', dodge: '', src: 'bills' }));
}

// ───────────── календарь ─────────────

export function billsCalEvents(from, to) {
    if (!on()) return [];
    return M().list.filter(x => x.due && x.due >= from && x.due <= to).map(x => ({ key: `mail:${x.id}`, d: x.due, title: `${x.what} ${fmt(x.amount)}`, kind: 'bill', st: x.st === 'paid' ? 'done' : 'open' }));
}

// ───────────── вид ─────────────

const stTxt = (x, t) => x.st === 'paid' ? `оплачено${x.paidOn ? ` ${dmy(x.paidOn)}` : ''}${x.how === 'auto' ? ' · сам' : x.how === 'cash' ? ' · наличными' : ''}`
    : x.st === 'cut' ? 'отключили — оплати, чтобы вернули' : x.st === 'overdue' ? `просрочен на ${daysBetween(x.due, t)} дн.${x.fee ? ` · пеня ${fmt(x.fee)}` : ''}` : t ? `до ${dmy(x.due)} · через ${Math.max(0, daysBetween(t, x.due))} дн.` : `до ${dmy(x.due)}`;

export function billsHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const t = today();
    const open = unpaid().sort((a, b) => ({ cut: 0, overdue: 1, new: 2 }[a.st] - { cut: 0, overdue: 1, new: 2 }[b.st]) || a.due.localeCompare(b.due));
    const paid = s.list.filter(x => x.st === 'paid').slice(-6).reverse();
    const spend = s.spend.filter(x => !x.done);
    const owe = open.reduce((a, x) => a + x.amount, 0);
    const c = cfg();
    const row = (x) => `<div class="lf-bl ${x.st}"><span class="lf-bl-ic">${KIND[x.kind][1]}</span><span class="lf-bl-t"><b>${esc(x.what)}</b><small>${esc(stTxt(x, t))}${x.note ? ` · ${esc(x.note)}` : ''}</small></span><span class="lf-bl-s">${esc(fmt(x.amount))}</span>${x.st === 'paid' ? '' : `<button class="lf-btn small primary" data-act="bl-pay" data-id="${x.id}">Оплатить</button>`}<button class="lf-iconbtn" data-act="bl-del" data-id="${x.id}" title="убрать">${A.icon('x')}</button></div>`;
    return `${A.sec('Счета', open.length ? `к оплате ${fmt(owe)}` : 'всё оплачено')}
    ${open.length ? `<div class="lf-bls">${open.map(row).join('')}</div>` : '<div class="lf-hint">Почта приходит раз в неделю истории, коммуналка — в начале месяца. Пока к оплате ничего.</div>'}
    ${spend.length ? `${A.sec('Чеки за сегодня', fmt(spend.reduce((a, x) => a + x.amount, 0)))}<div class="lf-bls">${spend.map(x => `<div class="lf-bl"><span class="lf-bl-ic">🧾</span><span class="lf-bl-t"><b>${esc(x.what)}</b><small>${x.who ? esc(A.shortName(x.who)) : ''}${bankNow() ? ' · спишется одной строкой, когда день кончится' : ' · наличными'}</small></span><span class="lf-bl-s">${esc(fmt(x.amount))}</span><button class="lf-iconbtn" data-act="bl-sdel" data-id="${x.id}">${A.icon('x')}</button></div>`).join('')}</div>` : ''}
    ${paid.length ? `<details class="lf-more"><summary>Оплачено недавно — ${paid.length}</summary><div class="lf-bls">${paid.map(row).join('')}</div></details>` : ''}
    <div class="lf-actions tight"><button class="lf-btn" data-act="bl-mail">${A.icon('mail')} Проверить почту</button><button class="lf-btn ghost" data-act="bl-add">${A.icon('plus')} Свой счёт</button></div>
    <div class="lf-chips wrap"><button class="lf-chip${c.autopay ? ' on' : ''}" data-act="bl-set" data-k="autopay">платить самим в срок</button><button class="lf-chip${c.mail ? ' on' : ''}" data-act="bl-set" data-k="mail">почта раз в неделю</button><button class="lf-chip${c.util ? ' on' : ''}" data-act="bl-set" data-k="util">коммуналка раз в месяц</button><button class="lf-chip${c.spend ? ' on' : ''}" data-act="bl-set" data-k="spend">чеки быта — в банк</button></div>`;
}

export async function billsClick(act, el) {
    if (!act.startsWith('bl-')) return false;
    const s = M();
    const x = s.list.find(y => y.id === el.dataset.id);
    switch (act) {
        case 'bl-pay': if (x) { await bank(); pay(x); } break;
        case 'bl-del': if (x) s.list = s.list.filter(y => y !== x); break;
        case 'bl-sdel': s.spend = s.spend.filter(y => y.id !== el.dataset.id); break;
        case 'bl-set': { const c = cfg(); c[el.dataset.k] = !c[el.dataset.k]; A.saveSettings(); break; }
        case 'bl-mail': {
            const t = today();
            if (!t) { A.toast('info', 'Нет даты истории — почта ходит по ней.', '✦ Счета'); return true; }
            const util = cfg().util && (!s.lastUtil || t.slice(0, 7) > s.lastUtil);
            const n = await A.withBusy(el, () => fetchMail(util, 1), 'Почта…');
            s.lastMail = t; if (util) s.lastUtil = t.slice(0, 7);
            if (!n) A.toast('info', 'Сегодня в ящике пусто.', '✦ Почта');
            break;
        }
        case 'bl-add':
            A.openSheet(`${A.icon('mail')} Свой счёт`, `<div class="lf-field"><label>За что</label><input type="text" data-in="bl-what" placeholder="Ремонт мотоцикла"></div>
                <div class="lf-field"><label>Сколько (${esc(cur())})</label><input type="number" inputmode="decimal" data-in="bl-sum" placeholder="120"></div>
                <div class="lf-field"><label>Через сколько дней срок</label><input type="number" inputmode="numeric" data-in="bl-days" value="10"></div>
                <button class="lf-btn primary full" data-act="bl-save">${A.icon('check')} Добавить</button>`);
            return true;
        case 'bl-save': {
            const box = el.closest('.lf-sheet') || document;
            const what = box.querySelector('[data-in="bl-what"]')?.value?.trim();
            const amount = Number(box.querySelector('[data-in="bl-sum"]')?.value);
            const t = today();
            if (!what || !(amount > 0) || !t) { if (!t) A.toast('info', 'Нет даты истории.', '✦ Счета'); return true; }
            const due = new Date(fromYmd(t)); due.setDate(due.getDate() + clamp(Number(box.querySelector('[data-in="bl-days"]')?.value) || 10, 0, 90));
            s.list.push({ id: `m${++s.seq}`, what: what.slice(0, 70), amount: Math.round(amount * 100) / 100, kind: 'other', due: ymdOf(due), st: 'new', mes: A.chatArr().length - 1, at: Date.now(), came: t, src: 'me' });
            A.closeSheet();
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function billsRecs(i) {
    const s = M();
    return [
        ...s.list.filter(x => x.paidMes === i).map(x => ({ id: `bl:${x.id}`, g: 'Счета', icon: 'wallet', t: `оплачен: ${x.what} ${fmt(x.amount)}`, del: () => { x.st = x.prevSt || 'new'; delete x.paidMes; } })),
        ...s.spend.filter(x => x.mes === i && !x.done).map(x => ({ id: `bl:${x.id}`, g: 'Счета', icon: 'wallet', t: `чек: ${x.what} ${fmt(x.amount)}`, del: () => { s.spend = s.spend.filter(y => y !== x); } })),
    ];
}

export const billsState = () => ({ open: unpaid().length, owe: unpaid().reduce((a, x) => a + x.amount, 0), cut: M().list.some(x => x.st === 'cut') });
