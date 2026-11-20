// Шкалы пары. У ядра семь шкал на всех (доверие, близость, влечение, ревность, напряжение, вина, любовь) — здесь
// пара получает СВОЙ набор: лишние убираются (у отца с дочерью нет «Влечения»), нужные добавляются из десяти
// новых — привязанность, семейная любовь, уважение, дружба, страх, обида, враждебность, зависимость, одобрение,
// тревога. У каждой шкалы и каждой стороны — замысел автора: что её растит, что роняет и куда она идёт
// (конечная точка — её Летописец не перепрыгивает, это считает код). Факторы можно вписать руками или дать
// подобрать умной модели — по характерам, тропам пары и скрытому характеру твоей персоны.
// Новые шкалы Летописец двигает своим ключом «ties»; записи лежат при посте, как и шкалы ядра: свайп, правка
// и «Что записал пост» работают сами. Замки пары (их ставишь ты или код-мозг) не трогаются.

import { str, arr, clamp } from './hudkit.js';

let A = null;
export function initTies(api) { A = api; }
const esc = (v) => A.esc(v);

/** Шкалы ядра (index.js → SCALES): id, название, значок. Незнакомая шкала ядра считается включённой. */
export const CORE = [['trust', 'Доверие', 'handshake'], ['closeness', 'Близость', 'heart'], ['desire', 'Влечение', 'flame'], ['jealousy', 'Ревность', 'eye'],
    ['tension', 'Напряжение', 'zap'], ['guilt', 'Вина', 'moon'], ['love', 'Любовь', 'gem']];

/** Новые шкалы: id, название, значок, с чего начинает, что это (Летописцу), как выглядит в поведении по пяти уровням. */
export const EXTRA = [
    ['attach', 'Привязанность', 'home', 30, 'привязанность: привык к другому, скучает без него',
        ['', '', 'привык, что другой рядом', 'привязан: скучает, ищет глазами, тянется', 'без другого не на месте: ждёт, проверяет, возвращается']],
    ['family', 'Семейная любовь', 'users', 0, 'семейная любовь: как к родному — без влечения',
        ['', '', 'по-родственному небезразличен', 'любит как родного: опекает, ворчит, прикрывает', 'семья без оговорок: за него — что угодно']],
    ['respect', 'Уважение', 'crown', 45, 'уважение: считается с мнением, признаёт силу и правоту другого',
        ['ни во что не ставит', 'смотрит свысока', '', 'уважает: слушает, считается с мнением', 'уважает без оговорок, сверяется с ним']],
    ['friend', 'Дружба', 'smile', 30, 'дружба: легко рядом, подначивают, выручают',
        ['', '', 'приятельски расположен', 'друг: подначивает, выручает, говорит прямо', 'друг, каких мало: понимает с полуслова']],
    ['fear', 'Страх', 'shield', 0, 'страх перед другим: боится его самого, а не за него',
        ['', '', 'настороже рядом', 'побаивается: следит за руками, подбирает слова', 'боится всерьёз: тело реагирует раньше головы']],
    ['resent', 'Обида', 'bruise', 0, 'обида: затаённое, не прощённое — копится и остывает медленно',
        ['', '', 'осадок остался', 'обижен: холоднее обычного, припоминает', 'обида жжёт: не отпускает, колет при случае']],
    ['hostile', 'Враждебность', 'target', 0, 'враждебность: желание задеть, навредить, не подать руки',
        ['', '', 'недолюбливает', 'враждебен: ищет повод, цепляется', 'открытая вражда: ударил бы, будь повод']],
    ['depend', 'Зависимость', 'lock', 10, 'зависимость: не может без другого, сверяет с ним решения',
        ['', '', 'привык опираться', 'зависит: без присутствия и слова другого теряется', 'зависим до боли: без него не решает и не дышит']],
    ['approve', 'Одобрение', 'check', 45, 'одобрение: как оценивает поступки и выбор другого',
        ['осуждает почти всё, что тот делает', 'не одобряет', '', 'одобряет: поддерживает решения', 'гордится им в открытую']],
    ['worry', 'Тревога', 'activity', 10, 'тревога за другого: боится не его, а за него',
        ['', '', 'поглядывает, всё ли в порядке', 'тревожится: проверяет, перезванивает, плохо спит', 'места себе не находит от тревоги за него']],
];
const EX = Object.fromEntries(EXTRA.map(x => [x[0], x]));
const isCore = (f) => CORE.some(x => x[0] === f);
export const tiesLabel = (f) => (CORE.find(x => x[0] === f) || EX[f] || [f, f])[1];
const iconOf = (f) => (CORE.find(x => x[0] === f) || EX[f] || [f, f, 'gem'])[2];
const lvl = (v) => (v < 15 ? 0 : v < 35 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4);
const goalWord = (g) => ['почти нулю', 'низкому', 'среднему', 'высокому', 'предельному'][lvl(g)];
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-20, Math.min(20, Math.round(n))) : 0; };

function cfg() {
    const s = A.settings();
    if (!s.ties || typeof s.ties !== 'object') s.ties = {};
    if (s.ties.on === undefined) s.ties.on = true;
    return s.ties;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.ties || typeof cm.ties !== 'object') cm.ties = {};
    const s = cm.ties;
    if (!s.pairs || typeof s.pairs !== 'object') s.pairs = {};   // «a|b» → { off: [шкалы ядра, убранные у пары], on: [новые шкалы пары] }
    if (!s.base || typeof s.base !== 'object') s.base = {};      // «от>к» → { новая шкала: точка отсчёта }
    if (!s.rules || typeof s.rules !== 'object') s.rules = {};   // «от>к» → { шкала: { up, down, goal } }
    return s;
}
// те же ключи, что у ядра (pairKey / dirKey в index.js)
const pk = (a, b) => [A.canonName(a), A.canonName(b)].map(A.norm).sort().join('|');
const dk = (from, to) => `${A.norm(A.canonName(from))}>${A.norm(A.canonName(to))}`;
const pairCfg = (a, b) => { const c = M().pairs[pk(a, b)]; return { off: arr(c?.off), on: arr(c?.on).filter(f => EX[f]) }; };
function pairEdit(a, b) { const s = M(); const k = pk(a, b); if (!s.pairs[k] || typeof s.pairs[k] !== 'object') s.pairs[k] = { off: [], on: [] }; const c = s.pairs[k]; c.off = arr(c.off); c.on = arr(c.on); return c; }
const ruleOf = (from, to, f) => { const r = M().rules[dk(from, to)]?.[f]; return r && typeof r === 'object' ? r : null; };
const hasRule = (r) => !!r && !!(str(r.up, 300) || str(r.down, 300) || Number.isFinite(r.goal));
const everyone = () => { const u = A.canonName(A.ctx().name1); return [u, ...A.groupMembers().map(A.canonName)].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k); };
const pinOf = (from, to) => { try { return A.relOf(from, to)?.pin || {}; } catch { return {}; } };

/** Есть ли у пары эта шкала: шкала ядра — пока не убрана, новая — если добавлена. */
export function tiesHas(a, b, f) {
    try {
        if (!on() || !a || !b) return isCore(f) || !EX[f];
        const c = pairCfg(a, b);
        return EX[f] ? c.on.includes(f) : !c.off.includes(f);
    } catch { return true; }
}

/** Новые шкалы всех пар чата: { «от>к»: { шкала: значение } }; skip — без записей этого поста. */
function extras(skip = -1) {
    const chat = A.chatArr();
    const s = M();
    const out = {};
    const side = (from, to) => {
        const k = dk(from, to);
        if (!out[k]) { out[k] = {}; const b = s.base[k] || {}; for (const [f, , , v] of EXTRA) out[k][f] = Number.isFinite(b[f]) ? clamp(b[f], 0, 100) : v; }
        return out[k];
    };
    for (let i = 0; i < chat.length; i++) {
        if (i === skip) continue;
        const e = A.chronOf(i);
        if (!e || e.undone || !Array.isArray(e.tx)) continue;
        for (const r of e.tx) {
            if (!r?.a || !r?.b || A.sameName(r.a, r.b)) continue;
            const sd = side(r.a, r.b);
            for (const [f] of EXTRA) if (r[f]) sd[f] = clamp(sd[f] + r[f], 0, 100);
        }
    }
    return side;
}

/** Новые шкалы «от → к» у этой пары: { respect: 60, … } — только включённые. */
export function tiesOf(from, to) {
    try {
        if (!A?.hasChat?.() || !on()) return {};
        const sd = extras()(from, to);
        return Object.fromEntries(pairCfg(from, to).on.map(f => [f, sd[f]]));
    } catch { return {}; }
}

/** Для соседей (код-мозг): новые шкалы пары, её набор и конечные точки. */
export function tiesView(from, to) {
    const c = pairCfg(from, to);
    const goals = {};
    for (const [f, r] of Object.entries(M().rules[dk(from, to)] || {})) if (Number.isFinite(r?.goal)) goals[f] = r.goal;
    return { ...tiesOf(from, to), set: [...CORE.map(x => x[0]).filter(f => !c.off.includes(f)), ...c.on], goals };
}

// ───────────── Летописец ─────────────

/** Пары чата, у которых есть свой набор или замысел: [[a, b]]. */
function tunedPairs() {
    const all = everyone();
    const s = M();
    const out = [];
    for (let x = 0; x < all.length; x++) for (let y = x + 1; y < all.length; y++) {
        const a = all[x], b = all[y];
        const c = pairCfg(a, b);
        const rules = [s.rules[dk(a, b)], s.rules[dk(b, a)]].some(r => r && Object.values(r).some(hasRule));
        if (c.off.length || c.on.length || rules) out.push([a, b]);
    }
    return out;
}

function ruleLine(from, to, f, short = false) {
    const r = ruleOf(from, to, f);
    if (!hasRule(r)) return '';
    const bits = [str(r.up, 300) ? `растёт, когда ${str(r.up, 300)}` : '', str(r.down, 300) ? `падает, когда ${str(r.down, 300)}` : '',
        Number.isFinite(r.goal) ? (short ? `идёт к ${goalWord(r.goal)}` : `идёт к ${r.goal}`) : ''].filter(Boolean);
    return `${tiesLabel(f).toLowerCase()} — ${bits.join('; ')}`;
}

export function tiesChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const pairs = tunedPairs();
    if (!pairs.length) return null;
    const used = new Set();
    const sets = [], why = [];
    const side = extras();
    for (const [a, b] of pairs) {
        const c = pairCfg(a, b);
        const core = CORE.map(x => x[0]).filter(f => f !== 'love' && !c.off.includes(f));
        c.on.forEach(f => used.add(f));
        const cur = (from, to) => c.on.map(f => `${f} ${side(from, to)[f]}`).join(', ');
        sets.push(`${A.shortName(a)} и ${A.shortName(b)}: ${[...core, ...c.on].join(', ') || 'ни одной'}${c.on.length ? ` (сейчас ${A.shortName(a)}→${A.shortName(b)}: ${cur(a, b)}; ${A.shortName(b)}→${A.shortName(a)}: ${cur(b, a)})` : ''}`);
        for (const [from, to] of [[a, b], [b, a]]) {
            const lines = [...CORE.map(x => x[0]), ...c.on].filter(f => tiesHas(a, b, f)).map(f => ruleLine(from, to, f)).filter(Boolean);
            if (lines.length) why.push(`${A.shortName(from)}→${A.shortName(to)}: ${lines.join('. ')}`);
        }
    }
    const rule = `

ties — новые шкалы пар из строки «Шкалы пар»: [{"from":"кто чувствует","to":"к кому"${[...used].map(f => `,"${f}":0`).join('')}}]. Числа — изменение от −20 до +20, только если в этом посте правда сдвинулось; только те поля, что названы у этой пары. ${[...used].map(f => `${f} — ${EX[f][4]}`).join('; ')}${used.size ? '. ' : ''}Нечего — [].
Для пар из строки «Шкалы пар» и в relations двигай только названные у пары шкалы. Строка «Что двигает шкалы» — замысел автора: случилось в посте названное там — сдвиг заметнее обычного (5–12) и в ту сторону; не случилось — как обычно. «Идёт к N» — конечная точка: к ней шагами, дальше неё не уходи.`;
    return { key: '"ties": []', rule, tokens: 60 + used.size * 14 + why.length * 12, input: [`Шкалы пар: ${sets.join(' | ')}`, why.length ? `Что двигает шкалы: ${why.join(' | ')}` : ''].filter(Boolean).join('\n') };
}

/** Не дать шагу перепрыгнуть конечную точку: было prev, шаг d, цель g → шаг, который остановится на цели. */
export function capStep(prev, d, g) {
    if (!d || !Number.isFinite(g)) return d;
    const next = prev + d;
    if (d > 0 && prev <= g && next > g) return g - prev;
    if (d < 0 && prev >= g && next < g) return g - prev;
    return d;
}

export function tiesAfterPost(i, j) {
    const e = A.chronOf(i);
    if (!e) return;
    let changed = false;
    if (!on()) { if (e.tx) { delete e.tx; A.saveMeta(); } return; }
    // 1) новые шкалы — при посте, с конечной точкой
    const before = extras(i);
    const acc = {};
    const tx = [];
    for (const r of arr(j?.ties).slice(0, 8)) {
        const a = A.canonName(str(r?.from || r?.a, 50)), b = A.canonName(str(r?.to || r?.b, 50));
        if (!a || !b || A.sameName(a, b)) continue;
        const k = dk(a, b);
        const rec = { a, b };
        let any = false;
        for (const f of pairCfg(a, b).on) {
            const prev = before(a, b)[f] + (acc[k]?.[f] || 0);
            const d = capStep(prev, num(r?.[f]), ruleOf(a, b, f)?.goal);
            if (!d) continue;
            rec[f] = d; any = true;
            acc[k] = { ...(acc[k] || {}), [f]: (acc[k]?.[f] || 0) + d };
        }
        if (any) tx.push(rec);
    }
    if (tx.length) { e.tx = tx; changed = true; } else if (e.tx) { delete e.tx; changed = true; }
    // 2) шкалы ядра: убранные у пары — не двигаются; конечную точку шаг не перепрыгивает (запертые не трогаем)
    let state = null;
    for (const r of arr(e.rel)) {
        if (!r?.a || !r?.b || A.sameName(r.a, r.b)) continue;
        const c = pairCfg(r.a, r.b);
        for (const [f] of CORE) {
            if (!r[f]) continue;
            if (c.off.includes(f)) { r[f] = 0; changed = true; continue; }
            if (!r.dir) continue;   // старый формат: одна запись на обе стороны
            const g = ruleOf(r.a, r.b, f)?.goal;
            if (!Number.isFinite(g) || Number.isFinite(pinOf(r.a, r.b)[f])) continue;
            try {
                state = state || A.relationsState(true);
                const p = state[pk(r.a, r.b)];
                if (!p) continue;
                const sd = A.sameName(r.a, p.a) ? p.ab : p.ba;
                const d = capStep(sd[f] - r[f], r[f], g);     // sd — уже с этим шагом
                if (d !== r[f]) { sd[f] += d - r[f]; r[f] = d; changed = true; }
            } catch (err) { console.warn('[Life] шкалы пары: цель', err); }
        }
    }
    if (changed) A.saveMeta();
}

// ───────────── заметка модели ─────────────

const bits = (sd, list) => list.map(f => EX[f][5][lvl(sd[f])]).filter(Boolean);

export function tiesPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const user = A.canonName(A.ctx().name1);
    const here = [user, ...(A.worldState()?.scene?.characters_present || []).map(A.canonName)].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k);
    if (here.length < 2) return '';
    const S = A.canonName(String(A.ctx().name2 || '').trim());
    const pairs = tunedPairs().filter(([a, b]) => here.some(n => A.sameName(n, a)) && here.some(n => A.sameName(n, b)))
        .sort((x, y) => (y.some(n => A.sameName(n, S)) ? 1 : 0) - (x.some(n => A.sameName(n, S)) ? 1 : 0)).slice(0, 3);
    if (!pairs.length) return '';
    const side = extras();
    const feel = [], plan = [];
    for (const [a, b] of pairs) {
        const c = pairCfg(a, b);
        const x = bits(side(a, b), c.on), y = bits(side(b, a), c.on);
        const sa = A.shortName(a), sb = A.shortName(b);
        if (x.length || y.length) feel.push(x.join() === y.join() ? `${sa} и ${sb}: ${x.join('; ')}` : [x.length ? `${sa} → ${sb}: ${x.join('; ')}` : '', y.length ? `${sb} → ${sa}: ${y.join('; ')}` : ''].filter(Boolean).join('. '));
        // замысел — только про тех, кого пишет модель: за персону игрока она не решает
        for (const [from, to] of [[a, b], [b, a]]) {
            if (A.sameName(from, user)) continue;
            const lines = [...CORE.map(q => q[0]), ...c.on].filter(f => tiesHas(a, b, f)).map(f => ruleLine(from, to, f, true)).filter(Boolean).slice(0, 4);
            if (lines.length) plan.push(`у ${A.shortName(from)} к ${A.shortName(to)}: ${lines.join('. ')}`);
        }
    }
    const out = [];
    if (feel.length) out.push(`[Ещё между ними (→ — кто к кому), играй в поведении, не называя: ${feel.join('. ')}.]`);
    if (plan.length) out.push(`[Что двигает чувства — замысел автора: ${plan.join(' | ')}. Это не сценарий: пусть чувство отзывается на такие поступки и слова — взглядом, тоном, шагом навстречу или в сторону; к цели — шагами, без прыжков и без объявлений.]`);
    return out.join('\n');
}

// ───────────── вид: Персонаж → Связи ─────────────

const meter = (v) => `<i class="lf-meter"><b style="width:${v}%"></b></i><small>${v}</small>`;

/** Под шкалами ядра: новые шкалы пары и вход в настройку. */
export function tiesPairHtml(who, other) {
    if (!A?.hasChat?.() || !on() || !who || !other) return '';
    const a = A.canonName(who), b = A.canonName(other);
    const c = pairCfg(a, b);
    const side = extras();
    const mine = side(a, b), theirs = side(b, a);
    const rows = c.on.map(f => `<div class="lf-b2-row${Math.abs(mine[f] - theirs[f]) >= 25 ? ' asym' : ''}">${A.icon(iconOf(f))}<span>${esc(tiesLabel(f))}</span><span class="lf-b2-m">${meter(mine[f])}</span><span class="lf-b2-m">${meter(theirs[f])}</span></div>`).join('');
    const nRules = [[a, b], [b, a]].reduce((n, [x, y]) => n + Object.values(M().rules[dk(x, y)] || {}).filter(hasRule).length, 0);
    return `${rows ? `<div class="lf-bars2 lf-ty" data-act="ty-set" data-a="${esc(a)}" data-b="${esc(b)}">${rows}</div>` : ''}
    <div class="lf-chips wrap lf-ty-acts"><button class="lf-chip" data-act="ty-set" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('sliders')} Шкалы пары${c.off.length || c.on.length ? ` · свои` : ''}${nRules ? ` · факторов ${nRules}` : ''}</button><button class="lf-chip" data-act="ty-log" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('notes')} Журнал</button></div>`;
}

function setSheet(a, b) {
    const c = pairCfg(a, b);
    const sa = A.shortName(a), sb = A.shortName(b);
    const pinned = (f) => Number.isFinite(pinOf(a, b)[f]) || Number.isFinite(pinOf(b, a)[f]);
    const chip = (f, isOn) => `<button class="lf-chip${isOn ? ' on' : ''}" data-act="ty-tog" data-a="${esc(a)}" data-b="${esc(b)}" data-f="${f}"${pinned(f) ? ' disabled title="шкала под замком"' : ''}>${A.icon(pinned(f) ? 'lock' : iconOf(f))} ${esc(tiesLabel(f))}</button>`;
    const side = extras();
    const core = (from, to, f) => { try { return A.relOf(from, to)?.[f]; } catch { return null; } };
    const val = (from, to, f) => (EX[f] ? side(from, to)[f] : core(from, to, f));
    const active = [...CORE.map(x => x[0]).filter(f => !c.off.includes(f)), ...c.on];
    const row = (f) => {
        const ra = ruleOf(a, b, f), rb = ruleOf(b, a, f);
        const v = (from, to, r) => { const n = val(from, to, f); return `${n ?? '—'}${Number.isFinite(r?.goal) ? ` → ${r.goal}` : ''}`; };
        return `<button class="lf-ty-row${hasRule(ra) || hasRule(rb) ? ' on' : ''}" data-act="ty-rule" data-a="${esc(a)}" data-b="${esc(b)}" data-f="${f}">${A.icon(iconOf(f))}<span><b>${esc(tiesLabel(f))}</b><small>${esc(sa)}→${esc(sb)}: ${v(a, b, ra)} · ${esc(sb)}→${esc(sa)}: ${v(b, a, rb)}</small></span><em>${hasRule(ra) || hasRule(rb) ? 'есть замысел' : 'задать'}</em></button>`;
    };
    A.openSheet(`${A.icon('sliders')} ${esc(sa)} × ${esc(sb)} — шкалы`, `
        ${A.sec('Шкалы этой пары', 'тап — вкл/выкл')}
        <div class="lf-chips wrap">${CORE.map(([f]) => chip(f, !c.off.includes(f))).join('')}</div>
        <div class="lf-chips wrap">${EXTRA.map(([f]) => chip(f, c.on.includes(f))).join('')}</div>
        <div class="lf-hint">Убранную шкалу Летописец у этой пары не двигает, и модель её не получает. Новые начинают с обычной для себя отметки — поправь в шкале или дай расставить по истории.</div>
        ${A.sec('Что их двигает', 'тап по шкале')}
        <div class="lf-ty-list">${active.map(row).join('') || '<div class="lf-empty small">У пары не осталось шкал.</div>'}</div>
        <div class="lf-actions">
            <button class="lf-btn primary" data-act="ty-ai" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('sparkles')} Подобрать факторы</button>
            ${c.on.length ? `<button class="lf-btn" data-act="ty-fill" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('book')} Новые шкалы — по истории</button>` : ''}
        </div>
        <div class="lf-chips wrap"><button class="lf-chip" data-act="pr-edit" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('heart')} Тропы и курс пары</button></div>
        <div class="lf-hint">«Подобрать факторы» — умная модель по характерам, тропам, своду истории и скрытому характеру твоей персоны предложит, что у каждого растит и роняет каждую шкалу. Всё можно переписать руками.</div>`);
}

function ruleSheet(a, b, f) {
    const side = extras();
    const dirBlock = (d, from, to) => {
        const r = ruleOf(from, to, f) || {};
        const hasGoal = Number.isFinite(r.goal);
        const v = EX[f] ? side(from, to)[f] : null;
        return `${A.sec(`${esc(A.shortName(from))} → ${esc(A.shortName(to))}`)}
        ${v === null ? '' : `<div class="lf-field"><label>Сейчас: <b data-out>${v}</b></label><input type="range" min="0" max="100" value="${v}" data-rng="ty.${d}.val"></div>`}
        <div class="lf-field"><label>Растёт, когда ${esc(A.shortName(to))}…</label><textarea rows="2" data-in="ty-up-${d}" placeholder="говорит прямо; не решает за него; остаётся, когда тяжело">${esc(r.up || '')}</textarea></div>
        <div class="lf-field"><label>Падает, когда ${esc(A.shortName(to))}…</label><textarea rows="2" data-in="ty-down-${d}" placeholder="скрывает важное; рискует собой молча">${esc(r.down || '')}</textarea></div>
        <div class="lf-field"><div class="lf-pinrow"><label>Конечная точка: <b data-out>${hasGoal ? r.goal : 50}</b></label><label class="lf-pinlab"><input type="checkbox" data-in="ty-goal-${d}"${hasGoal ? ' checked' : ''}> ${A.icon('flag')} есть</label></div><input type="range" min="0" max="100" value="${hasGoal ? r.goal : 50}" data-rng="ty.${d}.goal"></div>`;
    };
    A.openSheet(`${A.icon(iconOf(f))} ${esc(tiesLabel(f))}`, `
        ${dirBlock('ab', a, b)}
        ${dirBlock('ba', b, a)}
        <button class="lf-btn primary full" data-act="ty-rsave" data-a="${esc(a)}" data-b="${esc(b)}" data-f="${f}">${A.icon('check')} Сохранить</button>
        <button class="lf-btn ghost full" data-act="ty-set" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('left')} К шкалам пары</button>
        <div class="lf-hint">Факторы — поступки и слова, которые видно в сцене. Конечную точку шкала не перепрыгивает: к ней — шагами. ${isCore(f) ? 'Само значение этой шкалы правится тапом по шкалам пары.' : ''}</div>`);
}

function logSheet(a, b) {
    const chat = A.chatArr();
    const scars = arr(A.chatMeta().scars?.log);
    const rows = [];
    const word = (r) => [...CORE, ...EXTRA].filter(([f]) => r[f]).map(([f, l]) => `${l.toLowerCase()} ${r[f] > 0 ? '+' : '−'}${Math.abs(r[f])}`).join(', ');
    for (let i = 0; i < chat.length; i++) {
        const e = A.chronOf(i);
        if (!e || e.undone) continue;
        for (const r of [...arr(e.rel), ...arr(e.tx)]) {
            const mine = (A.sameName(r.a, a) && A.sameName(r.b, b)) || (A.sameName(r.a, b) && A.sameName(r.b, a));
            if (!mine) continue;
            const w = word(r);
            if (!w && !r.moment) continue;
            const why = scars.find(x => x.mes === i && A.sameName(x.from, r.a) && A.sameName(x.to, r.b))?.why || '';
            rows.push({ i, t: `${A.shortName(r.a)} ${r.dir === false ? '↔' : '→'} ${A.shortName(r.b)}${w ? `: ${w}` : ''}`, note: [r.moment ? `«${r.moment}»` : '', why].filter(Boolean).join(' · '), d: chat[i]?.horae_meta?.timestamp?.story_date || '' });
        }
    }
    rows.reverse();
    A.openSheet(`${A.icon('notes')} ${esc(A.shortName(a))} × ${esc(A.shortName(b))} — журнал`, rows.length
        ? `<div class="lf-timeline">${rows.slice(0, 80).map(r => `<button class="lf-tl" data-act="jump" data-mes="${r.i}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(r.t)}</b><small>${esc([r.d, r.note].filter(Boolean).join(' · ') || `#${r.i}`)}</small></span></button>`).join('')}</div>${rows.length > 80 ? `<div class="lf-hint">Показаны последние 80 из ${rows.length}.</div>` : ''}`
        : '<div class="lf-empty small">Сдвигов между ними Летописец ещё не записал.</div>');
}

// ───────────── умная модель: факторы и расстановка по истории ─────────────

/**
 * Время этого чата: эпоха «Священного таймлайна» и дата истории. У одной пары в разных эпохах отношения разные
 * (где-то женаты, где-то только встретились) — помощник считает на дату чата и не тащит сюда то, что будет позже.
 */
export function whenLine() {
    let era = null, date = '';
    try { const cx = globalThis.SacredTimeline?.context?.(); era = cx?.era || null; date = String(cx?.date || ''); } catch { /* */ }
    try { date = String(A.worldState()?.timestamp?.story_date || '') || date; } catch { /* */ }
    if (!era && !date) return '';
    const span = era ? [era.from, era.to].filter(Boolean).map(x => String(x).slice(0, 4)).join('–') : '';
    return [
        `Время этого чата: ${[era ? `эпоха «${era.label || era.id}»${span ? ` (${span}${era.to ? '' : ' — идёт сейчас'})` : ''}` : '', date ? `дата в истории — ${date}` : ''].filter(Boolean).join(', ')}.`,
        'Считай на эту дату и по тому, что прожито в ЭТОМ чате. Что у этих двоих будет позже по хронологии или есть в другой эпохе (брак, близость, ссоры, знание друг о друге) — сюда не переноси: здесь этого ещё не было. Стороны могут стоять очень по-разному: один может уже любить, а второй — только знакомиться.',
    ].join(' ');
}

function pairBrief(a, b) {
    const user = A.canonName(A.ctx().name1);
    const card = (n) => { try { return A.lore?.card ? A.lore.card(n, 2200) : ''; } catch { return ''; } };
    const core = (n) => { try { return A.lore?.core ? String(A.lore.core(n) || '') : ''; } catch { return ''; } };
    const pr = A.chatMeta().pair?.pairs?.[[a, b].sort().join('|')] || null;
    let hidden = '';
    try { hidden = String(globalThis.LifePersona?.hidden?.(user) || ''); } catch { /* */ }
    return [
        `Пара: ${a} и ${b}. Игрок пишет за: ${user}.`,
        whenLine(),
        pr && (pr.tropes?.length || pr.course) ? `Тропы и курс автора: ${[pr.tropes?.join(', '), pr.course].filter(Boolean).join(' · ')}` : '',
        ...[a, b].map(n => { const t = [core(n) ? `Ядро: ${A.cut(core(n), 900)}` : '', card(n)].filter(Boolean).join('\n'); return t ? `— ${n} —\n${t}` : ''; }),
        hidden && [a, b].some(n => A.sameName(n, user)) ? `Скрытый характер персоны игрока (${user}) — модели истории он не уходит, только тебе: ${A.cut(hidden, 1500)}` : '',
    ].filter(Boolean).join('\n\n');
}

const AI_RULES = `Ты помогаешь автору литературной ролевой истории на русском настроить шкалы отношений пары. Для каждой названной шкалы и каждого направления «кто → к кому» скажи, какие поступки и слова ВТОРОГО растят это чувство у первого и какие роняют — именно у этих двоих: по характерам, ранам, привычкам, прошлому и тропам пары. goal — куда шкала идёт по замыслу (0–100), только если курс автора или история это подсказывают; иначе null.
Это вымысел, а не терапия: не своди пару к «здоровым отношениям» и не пиши языком психологов; у своих привязанность может быть больше здравого смысла — так и оставь. Факторы — то, что видно в сцене (2–3 коротких через «;», со строчной, без имени в начале), а не абстракции вроде «проявляет уважение». Скрытый характер персоны игрока нужен, чтобы понять, какие её естественные поступки на что влияют; за неё не решай и её саму не пересказывай.
Ответь только JSON: {"rules":[{"from":"имя","to":"имя","scale":"id шкалы","up":"…","down":"…","goal":null}]}`;

const AI_FILL = `Ты помогаешь автору литературной ролевой истории на русском. По своду истории, карточкам и характерам оцени, где сейчас стоят названные шкалы у пары — отдельно в каждую сторону (чувства несимметричны). 0 — нет вовсе, 50 — заметно, 100 — предел. Опирайся на прожитое в истории, а не на последние посты; чего в истории нет — ставь осторожно, ближе к началу шкалы.
Ответь только JSON: {"values":[{"from":"имя","to":"имя","scale":"id шкалы","v":0}]}`;

async function aiRules(a, b) {
    const c = pairCfg(a, b);
    const scales = [...CORE.map(x => x[0]).filter(f => f !== 'love' && !c.off.includes(f)), ...c.on];
    if (!scales.length) throw new Error('у пары нет шкал');
    const usr = `${pairBrief(a, b)}\n\nШкалы пары: ${scales.map(f => `${f} — ${EX[f] ? EX[f][4] : tiesLabel(f).toLowerCase()}`).join('; ')}`;
    const j = await (A.askFillJson || A.askJson)([{ role: 'system', content: AI_RULES }, { role: 'user', content: usr }], 2600, { check: (x) => Array.isArray(x?.rules) && x.rules.length, what: 'Факторы шкал' }, { who: [a, b], acts: false });
    const s = M();
    let n = 0;
    for (const r of arr(j.rules).slice(0, 40)) {
        const from = A.canonName(str(r?.from, 50)), to = A.canonName(str(r?.to, 50)), f = str(r?.scale, 20);
        if (!scales.includes(f) || ![[a, b], [b, a]].some(([x, y]) => A.sameName(from, x) && A.sameName(to, y))) continue;
        const k = dk(from, to);
        const old = s.rules[k]?.[f] || {};
        const next = { up: str(r?.up, 300) || old.up || '', down: str(r?.down, 300) || old.down || '' };
        // цель, поставленную руками, модель не переписывает
        if (Number.isFinite(old.goal)) next.goal = old.goal; else if (Number.isFinite(Number(r?.goal)) && r.goal !== null && r.goal !== '') next.goal = clamp(Math.round(Number(r.goal)), 0, 100);
        if (!hasRule(next)) continue;
        s.rules[k] = { ...(s.rules[k] || {}), [f]: next };
        n++;
    }
    return n;
}

async function aiFill(a, b) {
    const c = pairCfg(a, b);
    if (!c.on.length) throw new Error('у пары нет новых шкал');
    const usr = `${pairBrief(a, b)}\n\nШкалы: ${c.on.map(f => `${f} — ${EX[f][4]}`).join('; ')}`;
    const j = await (A.askFillJson || A.askJson)([{ role: 'system', content: AI_FILL }, { role: 'user', content: usr }], 1200, { check: (x) => Array.isArray(x?.values) && x.values.length, what: 'Шкалы по истории' }, { who: [a, b], acts: false });
    let n = 0;
    for (const r of arr(j.values).slice(0, 40)) {
        const from = A.canonName(str(r?.from, 50)), to = A.canonName(str(r?.to, 50)), f = str(r?.scale, 20);
        if (!c.on.includes(f) || !Number.isFinite(Number(r?.v)) || ![[a, b], [b, a]].some(([x, y]) => A.sameName(from, x) && A.sameName(to, y))) continue;
        setValue(from, to, f, Number(r.v));
        n++;
    }
    return n;
}

/** Поставить новую шкалу в значение: двигаем точку отсчёта, записи Летописца остаются. */
function setValue(from, to, f, want) {
    if (!EX[f]) return;
    const s = M();
    const k = dk(from, to);
    const cur = extras()(from, to)[f];
    const b0 = Number.isFinite(s.base[k]?.[f]) ? s.base[k][f] : EX[f][3];
    s.base[k] = { ...(s.base[k] || {}), [f]: b0 + clamp(Math.round(want), 0, 100) - cur };
}

export async function tiesClick(act, el) {
    if (!act.startsWith('ty-')) return false;
    const a = A.canonName(el.dataset.a), b = A.canonName(el.dataset.b), f = el.dataset.f;
    if (!a || !b) return true;
    const box = el.closest('.lf-sheet') || document;
    switch (act) {
        case 'ty-set': setSheet(a, b); return true;
        case 'ty-log': logSheet(a, b); return true;
        case 'ty-rule': ruleSheet(a, b, f); return true;
        case 'ty-tog': {
            const c = pairEdit(a, b);
            if (EX[f]) c.on = c.on.includes(f) ? c.on.filter(x => x !== f) : [...c.on, f];
            else if (isCore(f)) c.off = c.off.includes(f) ? c.off.filter(x => x !== f) : [...c.off, f];
            if (!c.off.length && !c.on.length) delete M().pairs[pk(a, b)];
            A.saveMeta(); A.updatePrompt(); A.render();
            setSheet(a, b);
            return true;
        }
        case 'ty-rsave': {
            const s = M();
            for (const [d, from, to] of [['ab', a, b], ['ba', b, a]]) {
                const k = dk(from, to);
                const next = { up: str(box.querySelector(`[data-in="ty-up-${d}"]`)?.value, 300), down: str(box.querySelector(`[data-in="ty-down-${d}"]`)?.value, 300) };
                if (box.querySelector(`[data-in="ty-goal-${d}"]`)?.checked) next.goal = clamp(Math.round(Number(box.querySelector(`[data-rng="ty.${d}.goal"]`)?.value)), 0, 100);
                const rules = { ...(s.rules[k] || {}) };
                if (hasRule(next)) rules[f] = next; else delete rules[f];
                if (Object.keys(rules).length) s.rules[k] = rules; else delete s.rules[k];
                const vEl = box.querySelector(`[data-rng="ty.${d}.val"]`);
                if (vEl && EX[f]) setValue(from, to, f, Number(vEl.value));
            }
            A.saveMeta(); A.updatePrompt(); A.render();
            setSheet(a, b);
            return true;
        }
        case 'ty-ai': case 'ty-fill': {
            const cm = A.chatMeta();
            await A.withBusy(el, async () => {
                const n = act === 'ty-ai' ? await aiRules(a, b) : await aiFill(a, b);
                if (A.chatMeta() !== cm) return;   // чат сменился, пока модель думала
                A.saveMeta(); A.updatePrompt(); A.render();
                A.toast(n ? 'success' : 'info', act === 'ty-ai' ? (n ? `Факторов вписано: ${n}. Проверь и поправь под себя.` : 'Модель ничего не предложила') : (n ? `Шкал расставлено: ${n}` : 'Модель ничего не расставила'), '✦ Шкалы пары', { timeOut: 3500 });
                setSheet(a, b);
            }, 'Думаю…');
            return true;
        }
        default: return false;
    }
}

/** «Что записал пост»: сдвиги новых шкал. */
export function tiesRecs(i) {
    const e = A.chronOf(i);
    const out = [];
    for (const r of arr(e?.tx)) {
        const w = EXTRA.filter(([f]) => r[f]).map(([f, l]) => `${l.toLowerCase()} ${r[f] > 0 ? '+' : '−'}${Math.abs(r[f])}`).join(', ');
        if (w) out.push({ id: `ty:${r.a}:${r.b}`, g: 'Отношения', icon: 'rings', t: `${A.shortName(r.a)} → ${A.shortName(r.b)}: ${w}`, del: () => { e.tx = e.tx.filter(x => x !== r); if (!e.tx.length) delete e.tx; } });
    }
    return out;
}

/** Мир → ⚙. */
export const tiesCfg = () => cfg();
