// Перепалки. У давно женатых не может быть всё идеально. Заводится обычно она — из-за посуды, его гиперопеки,
// банок тушёнки «на всякий случай», — а он ссориться с ней не любит и уходит от конфликта: отшучивается, «да, мэм»,
// делает чай. Пока она не доведёт. У него — терпение: каждая её колкость его съедает (быстрее, если он не выспался
// или «не в духе»), а когда терпение кончилось — огрызается и спорит всерьёз, по-стариковски, без жестокости.
// Чтобы было из-за чего: «Поводы» — Летописец придумывает, что он делает такого, что её бесит (по карточкам,
// привычкам, дому, деньгам, беременности), и как она может завестись; а раз в день-два истории Life сама подкидывает
// модели мелочь — он мимоходом делает что-то из этого. Начнёт ли она — решаешь ты. Темы, из-за которых уже
// цапались, копятся в «вечные»: «опять двадцать пять». Словесная дуэль (duel.js) ведёт счёт уже начавшейся схватки.

import { clock, hoursBetween, herPostTail, atHome, storyDay, str, arr, clamp, similar, mains, present, clone } from './hudkit.js';

let A = null;
export function initBicker(api) { A = api; }
const esc = (v) => A.esc(v);

const SRC = 'Перепалки';
const COST = [0, 12, 22, 35];                       // сколько терпения съедает её нажим 0–3
const FREQ = { rare: ['реже', 72], some: ['иногда', 36], often: ['часто', 18], off: ['сам не подкидывать', 0] };
const STYLE = {
    avoid: ['уходит от ссоры до последнего', 1],
    snap: ['заводится с пол-оборота', 1.8],
    cold: ['не кричит — холодеет', 1],
};
const HIM = { dodge: 'ушёл от ссоры', grumble: 'ворчит', snap: 'огрызнулся', cold: 'замолчал, ушёл', makeup: 'мирятся' };
const BANDS = [
    [65, 'dodge', 'уходит от ссоры по-стариковски: отшучивается, «да, мэм» с таким лицом, что лучше бы спорил, соглашается ради мира, делает ей чай, обнимает со спины, переводит тему — но не святой: бурчит под нос (можно по-русски), закатывает глаза, демонстративно моет ту самую чашку'],
    [40, 'grumble', 'терпение тает: отвечает коротко, тяжело вздыхает, говорит её имя тем самым тоном, молча делает по-своему; всё ещё не спорит'],
    [20, 'edge', 'на пределе: держится из последних сил — сжимает челюсть, считает до десяти; ещё одна колкость — и огрызнётся'],
    [0, 'snap', 'терпение кончилось: в этот раз он не уступает — спорит в ответ, припоминает своё, держит позицию, сухо и колко, по-бруклински (может сорваться на русский); без жестокости и без настоящей обиды — это перепалка старых супругов, не разрыв'],
];
const COLD_END = 'терпение кончилось — но он не кричит: холодный тон, «как скажешь», уходит на крышу или в мастерскую, пока не остынет; это перепалка, не разрыв — вернётся сам';

// запасные поводы, пока Летописец не придумал своих
const BASE = [
    'опять переставил её вещи «по уму» — по линейке, как в казарме',
    'доел последнее, что она себе оставила, и честно этого не заметил',
    'купил ещё десяток банок консервов «на всякий случай» — шкаф уже не закрывается',
    'починил то, о чём она не просила, и теперь оно работает «не так»',
    'проверяет замки по третьему кругу, пока она пытается рассказать что-то важное',
    'не даёт ей поднять ничего тяжелее кружки — гиперопека',
    'оставил нож на кухонном столе — «так удобнее»',
    'завёл пластинку сороковых на всю квартиру в семь утра',
    'уснул на середине её рассказа и делает вид, что слушал',
    'полчаса разговаривает с котом, а ей отвечает «угу»',
    'носит её любимую толстовку и растянул её плечом',
    'решил за неё, как будет лучше, — из заботы, не спросив',
];

function cfg() {
    const s = A.settings();
    if (!s.bicker || typeof s.bicker !== 'object') s.bicker = {};
    const c = s.bicker;
    if (c.on === undefined) c.on = true;
    if (!FREQ[c.freq]) c.freq = 'some';
    if (!STYLE[c.style]) c.style = 'avoid';
    return c;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.bicker || typeof cm.bicker !== 'object') cm.bicker = {};
    const s = cm.bicker;
    if (!Number.isFinite(s.pat)) s.pat = 100;
    if (!Array.isArray(s.topics)) s.topics = [];   // вечные темы: { t, n, last, day }
    if (!Array.isArray(s.pool)) s.pool = [];       // поводы: { id, act, why, start, dodge, used }
    if (!Array.isArray(s.log)) s.log = [];         // прошлые перепалки
    if (!Number.isFinite(s.seq)) s.seq = 0;
    if (!s.since) s.since = clock(A);
    return s;
}

/** С кем пара: выбранный, иначе тот из главных, кто к ней ближе всех. */
export function partner() {
    const list = mains(A);
    const c = cfg();
    if (c.with) { const p = list.find(n => A.sameName(n, c.with)); if (p) return p; }
    const user = A.canonName(A.ctx().name1);
    let best = list[0] || '', score = -1;
    for (const n of list) { let sc = 0; try { const r = A.relOf(n, user); sc = r ? (r.closeness || 0) + (r.desire || 0) : 0; } catch { /* */ } if (sc > score) { score = sc; best = n; } }
    return best;
}
const together = (P) => { const here = present(A); return !here.length || here.some(h => A.sameName(h, P)); };
const home = () => { try { return A.homeLoc?.() || ''; } catch { return ''; } };
const grumpy = () => A.cueHas?.('bk:mood') || false;
const angel = () => A.cueHas?.('bk:angel') || false;

/** Терпение сейчас: пока ссоры нет — восстанавливается (+6 в час истории, ночь — ещё +30). */
function patNow() {
    const s = M();
    if (s.cur) return s.pat;
    const from = s.patAt || null;
    if (!from) return s.pat;
    const now = clock(A);
    let p = s.pat + hoursBetween(A, from, now) * 6;
    if (from.day && now.day && from.day !== now.day) p += 30;
    return clamp(Math.round(p), 0, 100);
}
function mult(P) {
    let m = STYLE[cfg().style][1];
    if (grumpy()) m *= 1.5;
    try { const d = A.sleepDebt?.(P); if (d && d.debt >= 6) m *= 1.3; } catch { /* */ }
    return angel() ? 0 : m;
}
function bandOf(pat) {
    const p = angel() ? Math.max(pat, 45) : pat;
    const b = BANDS.find(x => p >= x[0]) || BANDS[BANDS.length - 1];
    if (b[1] === 'snap' && cfg().style === 'cold') return { id: 'cold', text: COLD_END };
    return { id: b[1], text: b[2] };
}

const RULE = (U, P) => `
bicker — бытовая перепалка ${U} и ${P} (не ссора всерьёз: ворчание, придирки, подколы, «опять ты…» — старые супруги) в её посте перед этим ответом или в этом посте, иначе null: {"topic":"из-за чего, 2-8 слов","push":0,"him":"dodge|grumble|snap|cold|makeup","over":false}. push — насколько ${U} дожала его своим последним постом: 0 — не давила, 1 — придирка или колкость, 2 — упрёк, повышенный тон, «ты всегда/никогда», 3 — по больному. him — как ${P} ответил в этом посте: dodge — ушёл от ссоры (шутка, уступил, чай, обнял, сменил тему), grumble — ворчит, вздыхает, но не спорит, snap — огрызнулся, спорит в ответ, cold — замолчал или ушёл, makeup — мирятся. over — перепалка кончилась (помирились или забыли). Если тема совпадает с одной из «вечных тем» — пиши её так же.`;

export function bickerChron(i) {
    if (!A?.hasChat?.() || !on()) return null;
    const P = partner();
    if (!P) return null;
    const s = M();
    const U = A.shortName(A.canonName(A.ctx().name1));
    const st = s.cur ? `идёт — ${s.cur.topic}; терпение ${A.shortName(P)} ${s.pat}/100` : 'нет';
    const topics = s.topics.slice(-8).map(x => x.t).join('; ');
    return { key: '"bicker": null', rule: RULE(U, A.shortName(P)), tokens: 70, input: [`Перепалка: ${st}${topics ? `. Вечные темы: ${topics}` : ''}`, herPostTail(A, i)].filter(Boolean).join('\n') };
}

function close(i, made) {
    const s = M();
    const c = s.cur;
    if (!c) return;
    const t = s.topics.find(x => similar(A, x.t, c.topic, 0.5) || A.norm(x.t) === A.norm(c.topic));
    if (t) { t.n++; t.last = i; t.day = storyDay(A); } else s.topics.push({ t: c.topic, n: 1, last: i, day: storyDay(A) });
    if (s.topics.length > 30) s.topics.splice(0, s.topics.length - 30);
    s.log.push({ topic: c.topic, from: c.from, to: i, snapped: !!c.snapped, made, pushes: c.pushes.length, day: storyDay(A) });
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
    if (made) s.pat = Math.max(s.pat, 75);
    s.patAt = clock(A);
    s.lastEnd = clock(A);
    s.cur = null;
}

// ───────────── повод: Life подкидывает мелочь ─────────────

/** Можно ли сейчас подкидывать: не мешаем нежности, близости, твисту, искре драмы и опасной сцене. */
function guarded() {
    try { const on = A.modesOn?.() || []; if (on.includes('tender')) return true; } catch { /* */ }
    try { if (['calm', 'event'].includes(A.onceArmed?.())) return true; } catch { /* */ }
    try { if (A.twistArmed?.()) return true; } catch { /* */ }
    try { const md = A.moodNow?.(); if (md?.intimOn || md?.after || ['danger', 'fight', 'tension'].includes(md?.manual || md?.auto)) return true; } catch { /* */ }
    try { if (A.dramaState?.()?.mode === 'spark') return true; } catch { /* */ }
    try { const f = A.chatMeta().fight; if (f?.stage && f.stage !== 'over') return true; } catch { /* */ }
    return false;
}

function plantDue(P) {
    const c = cfg();
    const s = M();
    const need = FREQ[c.freq][1];
    if (!need || s.cur || !P || !together(P) || !atHome(A, home()) || guarded()) return false;
    const now = clock(A);
    const h = now.ts != null ? new Date(now.ts).getHours() : 12;
    if (h < 7 || h > 23) return false;
    const last = s.plantAt || s.lastEnd || s.since;
    return hoursBetween(A, last, now) >= need;
}

/** Что подкинуть: из дома и денег — иногда, из своих поводов — по кругу, иначе из запасных. */
function pickIrritant(P) {
    const s = M();
    const live = [];
    try { live.push(...(A.houseIrritants?.(P) || []), ...(A.billsIrritants?.() || [])); } catch { /* */ }
    if (live.length && Math.random() < 0.4) return live[Math.floor(Math.random() * live.length)];
    const fresh = s.pool.filter(x => x.used == null);
    if (fresh.length) return fresh[0];
    if (s.pool.length) return s.pool.slice().sort((a, b) => (a.used ?? -1) - (b.used ?? -1))[0];
    const recent = new Set(s.log.slice(-6).map(x => x.topic));
    const base = BASE.filter(t => !recent.has(t));
    return { act: base[Math.floor(Math.random() * base.length)] || BASE[0], src: 'base' };
}

function plantText(P, x) {
    const p = A.shortName(P), U = A.shortName(A.canonName(A.ctx().name1));
    return `Повод для перепалки: в этом ответе ${p} мимоходом, не нарочно и по-своему делает вот что: ${x.act.replace(/^\s*он\s+/i, '').replace(/[.\s]+$/, '')}. Не раздувай и не объясняй — это повод, а не ссора; заведётся ли ${U}, решает она`;
}

function plant(i, P, x = pickIrritant(P)) {
    const s = M();
    if (!x?.act) return null;
    A.cueArm?.({ key: 'bk:plant', src: SRC, once: true, text: plantText(P, x) });
    if (x.id) { const y = s.pool.find(z => z.id === x.id); if (y) y.used = i; }
    s.plantAt = clock(A);
    s.planted = { mes: i, act: x.act };
    return x;
}

// ───────────── после поста ─────────────

export function bickerAfterPost(i, j) {
    if (!on()) return;
    const cm = A.chatMeta();
    // этот пост уже разбирали (свайп) — вернуть, как было до него; придуманные поводы не трогаем
    if (cm.bicker?.mes === i && cm.bicker.before !== undefined) { const pool = cm.bicker.pool; cm.bicker = clone(cm.bicker.before) || {}; if (Array.isArray(pool)) cm.bicker.pool = pool; }
    const s = M();
    const before = clone(s); if (before) { delete before.before; delete before.mes; }
    const P = partner();
    const b = j?.bicker;
    let changed = false;
    if (P && b && typeof b === 'object' && str(b.topic)) {
        if (!s.cur) { s.pat = patNow(); s.cur = { topic: str(b.topic, 80), from: i, pushes: [], him: '' }; }
        const p = clamp(Math.round(Number(b.push) || 0), 0, 3);
        const c = Math.round(COST[p] * mult(P));
        if (c) { s.pat = clamp(s.pat - c, 0, 100); s.cur.pushes.push({ mes: i, p, c }); }
        s.patAt = clock(A);
        s.cur.him = HIM[str(b.him)] ? str(b.him) : '';
        s.cur.last = i;
        if (s.cur.him === 'snap' || s.cur.him === 'cold') s.cur.snapped = true;
        if (b.over === true || s.cur.him === 'makeup') close(i, s.cur.him === 'makeup' || b.over === true);
        changed = true;
    } else if (s.cur && aiSince(s.cur.last ?? s.cur.from, i) >= 3) { close(i, false); changed = true; }
    if (plantDue(P)) { plant(i, P); changed = true; }
    if (changed) { s.mes = i; s.before = before; A.saveMeta(); }
}
function aiSince(from, to) { const chat = A.chatArr(); let n = 0; for (let k = from + 1; k <= to && k < chat.length; k++) if (chat[k] && !chat[k].is_user && !chat[k].is_system) n++; return n; }

// ───────────── заметка модели ─────────────

export function bickerPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const P = partner();
    if (!P || !together(P)) return '';
    const s = M();
    const U = A.shortName(A.canonName(A.ctx().name1)), p = A.shortName(P);
    const pat = patNow();
    if (!s.cur && pat >= 90 && !grumpy()) {
        return `[В бытовых мелочах ${p} с ${U} ссориться не любит и сам ссор не начинает: если она заводится — сначала уходит от конфликта (шутка, «да, мэм», чай, обнять), хоть и ворчит под нос. Спорить всерьёз начинает, только когда она его по-настоящему доведёт.${angel() ? ' Сегодня он ангел терпения — не огрызнётся, что бы ни было.' : ''}]`;
    }
    const band = bandOf(pat);
    const theme = s.cur ? s.topics.find(x => similar(A, x.t, s.cur.topic, 0.5) || A.norm(x.t) === A.norm(s.cur.topic)) : null;
    return `[Перепалка ${U} и ${p}${s.cur ? ` — ${s.cur.topic}` : ': осадок от прошлой ещё не прошёл'} (старые супруги, не ссора всерьёз). Терпение ${p}: ${pat}/100 — ${band.text}.${grumpy() ? ' Он сегодня не в духе — заводится быстрее обычного.' : ''}${angel() ? ' Сегодня он ангел терпения — не огрызнётся, что бы ни было.' : ''} ${band.id === 'snap' || band.id === 'cold' ? '' : ' Если в её последнем посте она снова дожимает — упрёк, «ты всегда/никогда», колкость, давит на больное, — опусти его на ступень ниже уже в этом ответе.'}${theme ? ` Это их вечная тема (${theme.n + 1}-й раз): «опять двадцать пять» — оба знают реплики друг друга наизусть.` : ''} Сам он ссору не раздувает; за ${U} не говори.]`;
}

// ───────────── поводы: Летописец придумывает ─────────────

async function genIdeas() {
    const P = partner();
    if (!P) throw new Error('не с кем ссориться — в группе нет главных');
    const user = A.canonName(A.ctx().name1);
    const U = A.shortName(user), p = A.shortName(P);
    const core = (n) => { try { return A.coreOf?.(n) || ''; } catch { return ''; } };
    let habits = '';
    try { habits = (A.habitsOf?.(P) || []).map(h => (typeof h === 'string' ? h : h?.t)).filter(Boolean).slice(0, 14).join('; '); } catch { /* */ }
    let house = '';
    try { house = (A.houseState?.() || []).filter(x => x.lvl >= 1).map(x => `${x.id}:${x.lvl}`).join(', '); } catch { /* */ }
    let preg = false;
    try { preg = !!A.moodNow?.()?.preg; } catch { /* */ }
    let days = '';
    try { days = A.daysBrief?.() || ''; } catch { /* */ }
    const s = M();
    const have = s.pool.map(x => x.act).join('; ');
    const topics = s.topics.map(x => `${x.t} (${x.n})`).join('; ');
    const sys = `Ты помогаешь автору ролевой истории. У пары ${U} и ${p} всё слишком идеально — нужны бытовые поводы для перепалок давно женатых: не драма и не разрыв, а «опять ты…», ворчание и подколы. Заводится обычно ${U}, а ${p} ссориться с ней не любит и уходит от конфликта. Придумай 8 поводов: что ${p} делает (или не делает) по привычке, что бесит ${U}, — конкретно для этих людей: их характеры, прошлое, привычки, дом, деньги, работа${preg ? ', её беременность (его гиперопека, её гормоны, тяги)' : ''}. Ответ — строго один JSON по-русски: {"ideas":[{"act":"что он делает — 5-14 слов, в настоящем времени, без имени в начале","why":"чем это её бесит, 4-12 слов","start":"как она может завестись — её первая реплика или действие, 5-16 слов","dodge":"как он будет уходить от ссоры, 4-12 слов"}]}. Разные: мелкие и посерьёзнее, смешные и колючие. Не повторяй уже придуманное.`;
    const usr = [`${U}: ${A.cut(core(user), 900) || '—'}`, `${p}: ${A.cut(core(P), 900) || '—'}`, habits ? `Привычки ${p}: ${habits}` : '', house ? `Дом сейчас (0 — порядок, 3 — запущено): ${house}` : '', topics ? `Вечные темы (уже цапались): ${topics}` : '', have ? `Уже придумано (не повторяй): ${A.cut(have, 1500)}` : '', days ? `Последние дни:\n${A.cut(days, 2500)}` : ''].filter(Boolean).join('\n');
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1400, { check: (x) => Array.isArray(x?.ideas), what: 'Поводы' });
    let n = 0;
    for (const r of arr(j.ideas).slice(0, 10)) {
        const act = str(r?.act, 140);
        if (!act || s.pool.some(x => similar(A, x.act, act, 0.7))) continue;
        s.pool.push({ id: `b${++s.seq}`, act, why: str(r?.why, 120), start: str(r?.start, 180), dodge: str(r?.dodge, 120), used: null });
        n++;
    }
    if (s.pool.length > 40) s.pool.splice(0, s.pool.length - 40);
    A.saveMeta();
    return n;
}

// ───────────── вид ─────────────

const chip = (key, text, label, once = true) => A.cueChip?.(SRC, key, text, { once, label }) || '';

export function bickerHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const P = partner();
    if (!P) return '<div class="lf-hint">В группе нет главных — не с кем ссориться.</div>';
    const s = M();
    const c = cfg();
    const user = A.canonName(A.ctx().name1);
    const p = A.shortName(P);
    const pat = patNow();
    const band = bandOf(pat);
    const pool = s.pool.slice().reverse();
    const cur = s.cur;
    return `<div class="lf-bk-pair">${A.ava(user, 'md')}<i>×</i>${A.ava(P, 'md')}<select data-in="bk-with">${mains(A).map(n => `<option value="${esc(n)}"${A.sameName(n, P) ? ' selected' : ''}>${esc(A.shortName(n))}</option>`).join('')}</select></div>
    <div class="lf-bk-pat b-${band.id}"><div><b>Терпение ${esc(p)}</b><span>${pat}/100</span></div><i><u style="width:${pat}%"></u></i><small>${esc(band.text.split(':')[0])}</small>
        <span class="lf-bk-pm"><button data-act="bk-pat" data-d="-15" title="она дожала за кадром">−</button><button data-act="bk-pat" data-d="15" title="остыл">+</button></span></div>
    ${cur ? `<div class="lf-bk-cur"><small>сейчас цапаются</small><b>${esc(cur.topic)}</b><span>${cur.pushes.map(x => `<i class="p${x.p}"></i>`).join('')}${cur.him ? ` ${esc(HIM[cur.him])}` : ''}</span><button class="lf-btn ghost" data-act="bk-end">помирились</button></div>` : s.planted && A.chatArr().length - 1 - s.planted.mes <= 3 ? `<div class="lf-hint">Подкинуто: ${esc(p)} ${esc(s.planted.act)}. Заведётся ли она — решаешь ты.</div>` : ''}
    <div class="lf-cue-g"><small>сейчас — в следующий ответ</small><div class="lf-chips wrap">
        <button class="lf-chip lf-cue once" data-act="bk-plant">${esc(p)} что-нибудь натворит</button>
        ${chip('bk:now', `${p} огрызается — в этот раз не уступает`, 'пусть огрызнётся')}
        ${chip('bk:now', `${p} уступает — молча делает, как она хочет`, 'пусть уступит')}
        ${chip('bk:now', `${p} дуется: замолкает и уходит остыть — на крышу или в мастерскую`, 'пусть надуется')}
        ${chip('bk:now', `первый шаг к миру делает ${p} — по-своему, без слов «прости»`, 'мириться — первым он')}
        ${s.topics.length ? chip('bk:now', `${p} припоминает их вечную тему — «${s.topics.slice().sort((a, b) => b.n - a.n)[0].t}»`, 'припомнит вечную тему') : ''}
    </div></div>
    <div class="lf-cue-g"><small>держать</small><div class="lf-chips wrap">
        ${chip('bk:mood', `${p} сегодня не в духе`, 'он сегодня не в духе', false)}
        ${chip('bk:angel', `${p} сегодня ангел терпения`, 'ангел терпения', false)}
        ${chip('bk:hush', 'ссорятся шёпотом — рядом люди', 'шёпотом — рядом люди', false)}
    </div></div>
    ${A.cueStripHtml?.(SRC) || ''}
    ${A.sec('Поводы', pool.length ? String(pool.length) : '')}
    ${pool.length ? `<div class="lf-bk-ideas">${pool.slice(0, 10).map(x => `<div class="lf-bk-idea${x.used != null ? ' used' : ''}"><b>${esc(p)} ${esc(x.act)}</b>${x.why ? `<small><i>бесит:</i> ${esc(x.why)}</small>` : ''}${x.start ? `<small><i>начать:</i> ${esc(x.start)}</small>` : ''}${x.dodge ? `<small><i>он:</i> ${esc(x.dodge)}</small>` : ''}
        <div class="lf-actions tight"><button class="lf-btn small" data-act="bk-use" data-id="${x.id}">⚡ пусть сделает</button>${x.start ? `<button class="lf-btn small ghost" data-act="bk-type" data-id="${x.id}">в поле ввода</button>` : ''}<button class="lf-iconbtn" data-act="bk-del" data-id="${x.id}">${A.icon('x')}</button></div></div>`).join('')}</div>` : '<div class="lf-hint">Не можешь придумать, из-за чего поцапаться? Летописец посмотрит на них, дом, деньги и привычки — и предложит.</div>'}
    <button class="lf-btn full" data-act="bk-ideas">🎲 Из-за чего поцапаться?</button>
    ${s.topics.length ? `${A.sec('Вечные темы', String(s.topics.length))}<div class="lf-bk-topics">${s.topics.slice().sort((a, b) => b.n - a.n).map(x => `<span>${esc(x.t)}<b>×${x.n}</b><button data-act="bk-tdel" data-t="${esc(x.t)}">✕</button></span>`).join('')}</div>` : ''}
    ${s.log.length ? `<details class="lf-more"><summary>Прошлые перепалки — ${s.log.length}</summary><div class="lf-bk-log">${s.log.slice(-8).reverse().map(x => `<div><b>${esc(x.topic)}</b><small>${esc(x.day || '')}${x.snapped ? ' · огрызнулся' : ''}${x.made ? ' · помирились' : ''}</small><button class="lf-link" data-act="jump" data-mes="${x.from}">#${x.from}</button></div>`).join('')}</div></details>` : ''}
    ${A.sec('Сам подкидывает поводы')}
    <div class="lf-chips wrap">${Object.entries(FREQ).map(([k, [l]]) => `<button class="lf-chip${c.freq === k ? ' on' : ''}" data-act="bk-freq" data-k="${k}">${l}</button>`).join('')}</div>
    ${A.sec('Как он ссорится')}
    <div class="lf-chips wrap">${Object.entries(STYLE).map(([k, [l]]) => `<button class="lf-chip${c.style === k ? ' on' : ''}" data-act="bk-style" data-k="${k}">${l}</button>`).join('')}</div>`;
}

/** Мост: терпение сейчас — { who, pat, cur } или null (перепалки выключены или пары нет). */
export function bickerPatience() {
    try {
        if (!A?.hasChat?.() || !on()) return null;
        const P = partner();
        return P ? { who: P, pat: patNow(), cur: !!M().cur } : null;
    } catch { return null; }
}

export const bickerState = () => { const s = M(); return s.cur ? 'идёт' : patNow() < 65 ? `${patNow()}` : ''; };

export async function bickerClick(act, el) {
    if (!act.startsWith('bk-')) return false;
    const s = M();
    const c = cfg();
    const P = partner();
    const x = s.pool.find(y => y.id === el.dataset.id);
    switch (act) {
        case 'bk-plant': { const got = plant(A.chatArr().length - 1, P); if (got) A.toast('info', `${A.shortName(P)} ${got.act}`, '✦ Повод — в следующий ответ', { timeOut: 3500 }); break; }
        case 'bk-use': if (x) { plant(A.chatArr().length - 1, P, x); A.toast('info', 'Уйдёт модели один раз — со следующим ответом', '✦ Повод', { timeOut: 1800 }); } break;
        case 'bk-type': {
            if (!x?.start) return true;
            const ta = document.querySelector('#send_textarea');
            if (ta) { ta.value = (ta.value ? `${ta.value}\n` : '') + x.start; ta.dispatchEvent(new Event('input', { bubbles: true })); A.closeSheet(); }
            return true;
        }
        case 'bk-del': if (x) s.pool = s.pool.filter(y => y !== x); break;
        case 'bk-ideas': { const n = await A.withBusy(el, () => genIdeas(), 'Думаю…'); if (!n) A.toast('info', 'Нового не придумалось — попробуй ещё раз.', '✦ Поводы'); break; }
        case 'bk-end': close(A.chatArr().length - 1, true); break;
        case 'bk-pat': s.pat = clamp(patNow() + (Number(el.dataset.d) || 0), 0, 100); s.patAt = clock(A); break;
        case 'bk-tdel': s.topics = s.topics.filter(t => t.t !== el.dataset.t); break;
        case 'bk-freq': if (FREQ[el.dataset.k]) { c.freq = el.dataset.k; A.saveSettings(); } break;
        case 'bk-style': if (STYLE[el.dataset.k]) { c.style = el.dataset.k; A.saveSettings(); } break;
        default: return false;
    }
    if (act === 'bk-end' || act === 'bk-pat') delete s.before;
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

/** Выбор пары (select в листе). */
export function bickerInput(el) {
    if (el?.dataset?.in !== 'bk-with') return false;
    cfg().with = el.value; A.saveSettings(); A.updatePrompt(); A.render();
    return true;
}

export function bickerRecs(i) {
    const s = M();
    if (s.mes !== i || s.before === undefined) return [];
    const r = s.cur?.pushes?.find(x => x.mes === i);
    const t = s.cur ? `перепалка: ${s.cur.topic}${r ? `, терпение −${r.c}` : ''}${s.cur.him ? ` · ${HIM[s.cur.him]}` : ''}` : s.planted?.mes === i ? `повод подкинут: ${s.planted.act}` : 'перепалка закрыта';
    return [{ id: 'bk', g: 'Перепалки', icon: 'flame', t, del: () => { const keep = { pool: s.pool, topics: s.topics }; A.chatMeta().bicker = clone(s.before) || {}; Object.assign(M(), keep); } }];
}
