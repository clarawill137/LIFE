// ✦ Деньги: мост к банку Телефона (Phone-ST). Отдельного банка в Life нет — баланс, операции, счета и кредиты
// живут в телефоне Хеди, Life их показывает и сам списывает обязательные платежи в день оплаты по дате истории.

const BASE = '/scripts/extensions/third-party/Phone-ST';
let mods = null;
let loading = null;

export async function bank() {
    if (mods) return mods;
    if (!loading) {
        loading = (async () => {
            try {
                const [b, s] = await Promise.all([import(`${BASE}/bank.js`), import(`${BASE}/state.js`)]);
                if (typeof b.getBank !== 'function') return null;
                mods = { b, s };
                return mods;
            } catch (e) {
                console.info('[Life] банк Телефона не найден', e?.message || e);
                return null;
            } finally { done = true; }
        })();
    }
    return loading;
}

export function bankNow() { return mods; }
/** 'wait' — ещё ищу, 'ok' — нашла, 'none' — Телефона нет. */
export function bankState() { return mods ? 'ok' : loading ? (done ? 'none' : 'wait') : 'wait'; }
let done = false;

function rpDate() {
    try { return mods?.s?.getRpDateTime?.() || null; } catch { return null; }
}

/** Сводка для экрана: всё уже посчитано и отформатировано. */
export function moneyView() {
    if (!mods) return null;
    const { b } = mods;
    try {
        const bk = b.getBank();
        const rp = rpDate();
        const ym = rp ? `${rp.year}-${String(rp.month).padStart(2, '0')}` : '';
        const day = rp?.day || 0;
        const due = new Map((b.getBankReminders?.() || []).map(r => [`${r.kind}:${r.id}`, r]));
        const bills = (bk.recurring || []).map(r => {
            const rem = due.get(`bill:${r.id}`);
            const paid = !!ym && r.lastPaidMonth === ym;
            return {
                id: r.id, name: r.name, amount: r.amount, sum: b.fmtMoney(-r.amount), day: r.day, category: r.category,
                state: paid ? 'paid' : rem?.overdue ? 'overdue' : rem ? 'due' : 'later',
                left: !paid && !rem && day ? r.day - day : null,
            };
        }).sort((x, y) => ({ overdue: 0, due: 1, later: 2, paid: 3 }[x.state] - { overdue: 0, due: 1, later: 2, paid: 3 }[y.state]) || x.day - y.day);
        const loans = (bk.loans || []).filter(l => !l.paidOff).map(l => {
            const rem = due.get(`loan:${l.id}`);
            return { id: l.id, name: l.name, remaining: b.fmtMoney(l.remaining), monthly: b.fmtMoney(l.monthly), day: l.day, state: l.lastPaidMonth === ym ? 'paid' : rem?.overdue ? 'overdue' : rem ? 'due' : 'later' };
        });
        const tot = b.incomeExpenseTotals?.() || { income: 0, expense: 0 };
        return {
            balance: bk.balance, balanceText: b.fmtMoney(bk.balance), currency: bk.currency,
            income: b.fmtMoney(tot.income), expense: b.fmtMoney(-tot.expense),
            monthly: b.fmtMoney(-(b.monthlyObligations?.() || 0) - (b.monthlyLoanPayment?.() || 0)),
            debt: b.totalDebt?.() ? b.fmtMoney(b.totalDebt()) : '',
            bills, loans,
            tx: (bk.transactions || []).slice(0, 14).map(t => ({ id: t.id, label: t.label, sum: b.fmtMoney(t.amount), plus: t.amount > 0, category: t.category, time: t.time })),
            hasDate: !!rp, date: rp ? `${String(rp.day).padStart(2, '0')}.${String(rp.month).padStart(2, '0')}.${rp.year}` : '',
            empty: !(bk.balance || bk.transactions?.length || bk.recurring?.length || bk.loans?.length),
        };
    } catch (e) {
        console.warn('[Life] деньги', e);
        return null;
    }
}

/**
 * Автоплатёж: всё, что по дате истории уже надо было оплатить в этом месяце, списывается.
 * Без даты истории ничего не трогаем — иначе платили бы по реальному календарю.
 * Возвращает список списанного: [{name, sum}].
 */
export function autopay() {
    if (!mods) return [];
    const { b } = mods;
    if (!rpDate()) return [];
    const paid = [];
    try {
        for (const r of b.getBankReminders?.() || []) {
            if (r.kind === 'bill') { b.payRecurring(r.id); paid.push({ name: r.name, sum: b.fmtMoney(-r.amount) }); }
            else if (r.kind === 'loan') { b.payLoanInstallment(r.id); paid.push({ name: r.name, sum: b.fmtMoney(-r.amount) }); }
        }
    } catch (e) { console.warn('[Life] автоплатёж', e); }
    return paid;
}

export function payBill(id) { try { mods?.b.payRecurring(id); return true; } catch { return false; } }
export function payLoan(id) { try { mods?.b.payLoanInstallment(id); return true; } catch { return false; } }
export function addBill({ name, amount, day, category }) { try { return mods?.b.addRecurring({ name, amount, day, category: category || 'счета' }); } catch { return null; } }
export function delBill(id) { try { mods?.b.delRecurring(id); return true; } catch { return false; } }
export function addTx({ amount, label, category }) { try { return mods?.b.addTransaction({ amount, label, category: category || 'другое' }); } catch { return null; } }
export function balanceText() { try { return mods ? mods.b.fmtMoney(mods.b.getBank().balance) : ''; } catch { return ''; } }
