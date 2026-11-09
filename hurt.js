// Раны и дебаффы: у каждого (и у твоей персоны) — травмы с местом, тяжестью, тем, чем мешают, помощью и стадией.
// Заживают по времени истории (Horae; таймскип тоже лечит), у суперсолдата быстрее. Нагрузил рану (драка, бег, секс) —
// откат и кубик на осложнение; без помощи шанс выше. Осложнение — тост с кубиком (тап — отменить) и заметка модели.
// Пока не зажило — модель знает, чем рана мешает; иногда она «даёт о себе знать». Тяжёлые оставляют шрамы.
// В ⚔️ боевке урон настоящий. Летописец замечает новые травмы, помощь, нагрузку и заживление.

import { icon } from './icons.js';
import { rpNow, lifeKey } from './sim.js';
import { prof as innerProf } from './inner.js';
import { moodNow } from './mood.js';
import { modesOn } from './modes.js';

let A = null;
export function initHurt(api) { A = api; }

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const isUser = (n) => A.sameName(n, A.ctx().name1);
const short = (n) => A.shortName(A.canonName(n));
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

// ───────────── справочники ─────────────

// id: [ярлык, иконка, часы до заживления по тяжести 1–4 (обычное заживление, нормальная помощь) | null — не заживает]
export const KINDS = {
    cut: ['Рана', 'droplet', [0, 72, 240, 720, 1440]],
    gunshot: ['Огнестрел', 'target', [0, 120, 336, 960, 2160]],
    blunt: ['Ушиб', 'bruise', [0, 72, 168, 504, 1008]],
    fracture: ['Перелом', 'bone', [0, 336, 720, 1440, 2880]],
    burn: ['Ожог', 'flame', [0, 96, 336, 1008, 2160]],
    head: ['Голова', 'brain', [0, 48, 168, 504, 1440]],
    internal: ['Внутреннее', 'activity', [0, 168, 504, 1440, 2880]],
    sick: ['Болезнь', 'thermo', [0, 72, 168, 336, 720]],
    toxic: ['Отравление', 'flask', [0, 24, 72, 168, 504]],
    drain: ['Истощение', 'battery', [0, 24, 72, 168, 336]],
    shock: ['Шок', 'waves', [0, 6, 24, 72, 168]],
    chronic: ['Хроническое', 'clock', null],
    other: ['Травма', 'bandage', [0, 72, 240, 720, 1440]],
};
const KIND_IDS = Object.keys(KINDS);
const WHOLE = ['sick', 'toxic', 'drain', 'shock'];   // всё тело, не место
export const SEV = ['', 'лёгкая', 'средняя', 'тяжёлая', 'критическая'];
export const CARE = ['без помощи', 'первая помощь', 'врач', 'операция'];
const HEAL = [[1, 'Обычное'], [2, 'Быстрое'], [3, 'Регенерация'], [4, 'Суперсолдат']];
const BEATS = { off: [0, 'Выкл'], rare: [0.5, 'Редко'], mid: [1, 'Иногда'], often: [1.7, 'Часто'] };
// приступы старых травм: шанс на пост
const FLARE = { off: [0, 'Никогда'], rare: [0.03, 'Редко'], mid: [0.07, 'Иногда'], often: [0.14, 'Часто'] };
const W = [0, 1, 3, 6, 10];             // вес тяжести для «формы»
const BEAT_SEV = [0, 0.1, 0.22, 0.38, 0.55];
const COMP_SEV = [0, 0.01, 0.04, 0.08, 0.14];

const COMP = {
    cut: ['рана воспалилась — краснота, жар вокруг, дёргающая боль', 'швы разошлись — снова кровит', 'началось нагноение — нужна чистка', 'поднялась температура — инфекция'],
    gunshot: ['рана воспалилась — жар, дёргающая боль', 'открылось кровотечение', 'поднялась температура — инфекция', 'осколок, который не достали, — острая боль'],
    blunt: ['гематома разрослась — отёк, тяжело двигаться', 'трещина, которую не заметили, — боль стала сильнее'],
    fracture: ['смещение — снова острая боль, нужна фиксация', 'отёк и онемение — пережало'],
    burn: ['ожог воспалился — мокнет, жар', 'волдыри лопнули — открытая рана'],
    head: ['вернулись головокружение и тошнота', 'сильная головная боль, мутит от света и звука'],
    internal: ['кровотечение усилилось — слабость, бледность, холодный пот', 'жар и боль в животе — осложнение'],
    sick: ['стало хуже — температура выше, тяжело дышать', 'болезнь затянулась — осложнение'],
    toxic: ['вторая волна — снова мутит и трясёт'],
    drain: ['сорвался — силы кончились совсем'],
    shock: ['накрыло снова — тремор, звон в ушах, флешбек'],
    chronic: ['обострение — болит сильнее обычного'],
    other: ['стало хуже'],
};
const HINT = {
    cut: 'тянут швы, промок бинт, неловкое движение — и прошибает',
    gunshot: 'тянет и дёргает рана, промок бинт, неловкое движение — и прошибает',
    blunt: 'ноет, синяк налился, на этот бок не лечь',
    fracture: 'не опереться, ноет к ночи, неловкий поворот — и искры из глаз',
    burn: 'стянута кожа, трёт одежда, саднит',
    head: 'плывёт перед глазами, мутит, бесит яркий свет',
    internal: 'слабость, бледность, больно глубоко вдохнуть',
    sick: 'жар, ломота, кашель, тяжёлая голова',
    toxic: 'тошнота, тремор, пересохло во рту',
    drain: 'не хватает сил, кружится голова от резкого движения',
    shock: 'дрожат руки, звенит в ушах, накатывает',
    chronic: 'старое ноет и мешает, как всегда в худший момент',
    other: 'болит и мешает',
};

// ───────────── данные ─────────────

function cfg() {
    const s = A.settings();
    if (!s.hurt || typeof s.hurt !== 'object') s.hurt = {};
    const c = s.hurt;
    if (c.on === undefined) c.on = true;
    if (c.dice === undefined) c.dice = true;
    if (!BEATS[c.beats]) c.beats = 'mid';
    if (!c.heal || typeof c.heal !== 'object') c.heal = {};
    return c;
}
export const hurtOn = () => cfg().on !== false;

function H() {
    const m = A.chatMeta();
    if (!m.hurt || typeof m.hurt !== 'object' || Array.isArray(m.hurt)) m.hurt = {};
    const h = m.hurt;
    if (!h.chars || typeof h.chars !== 'object') h.chars = {};
    if (!Number.isFinite(h.seq)) h.seq = 0;
    if (!h.mig) migrate(m, h);
    return h;
}

/** Старые раны из «Внутри» (строчки) — в карточки. */
function migrate(m, h) {
    h.mig = 1;
    const inner = m.inner && typeof m.inner === 'object' ? m.inner : {};
    for (const [k, x] of Object.entries(inner)) {
        if (!Array.isArray(x?.wounds) || !x.wounds.length) continue;
        const c = h.chars[k] || (h.chars[k] = { list: [], scars: [] });
        for (const w of x.wounds) {
            if (!w?.t) continue;
            const at = w.at || { t: null, mes: w.mes ?? 0 };
            c.list.push(mkWound(h, { t: w.t, kind: guessKind(w.t), sev: 2, care: 1, mes: w.mes ?? 0, src: 'ai' }, at, 0.3));
        }
        x.wounds = [];
    }
}

function C(who) {
    const h = H();
    const k = A.canonName(who);
    const c = h.chars[k] || (h.chars[k] = { list: [], scars: [] });
    if (!Array.isArray(c.list)) c.list = [];
    if (!Array.isArray(c.scars)) c.scars = [];
    return c;
}

const active = (who) => C(who).list.filter(w => w.status === 'on');

function mkWound(h, r, now, prog = 0) {
    const kind = KINDS[r.kind] ? r.kind : 'other';
    const at = { t: now?.t ?? null, mes: now?.mes ?? r.mes ?? 0 };
    return {
        id: ++h.seq, t: String(r.t || KINDS[kind][0]).trim().slice(0, 70), part: String(r.part || '').trim().slice(0, 40), kind,
        sev: Math.max(1, Math.min(4, Math.round(Number(r.sev) || 2))), fx: (Array.isArray(r.fx) ? r.fx : []).map(x => String(x || '').trim().slice(0, 70)).filter(Boolean).slice(0, 4),
        care: Math.max(0, Math.min(3, Math.round(Number(r.care) || 0))), prog: clamp01(prog), at, upd: { ...at }, roll: { ...at },
        mes: r.mes ?? at.mes, src: r.src || 'ai', status: 'on', comp: [],
        flare: FLARE[r.flare] ? r.flare : kind === 'chronic' ? 'rare' : 'off', trig: String(r.trig || '').trim().slice(0, 80),
    };
}

const isOld = (w) => w.kind === 'chronic';

function guessKind(t) {
    t = String(t || '').toLowerCase();
    if (/огнестр|пул[яиюе]|выстрел|прострел/.test(t)) return 'gunshot';
    if (/перелом|трещин|вывих/.test(t)) return 'fracture';
    if (/ожог|обожж/.test(t)) return 'burn';
    if (/сотрясен|контуз/.test(t)) return 'head';
    if (/ушиб|синяк|гематом/.test(t)) return 'blunt';
    if (/ножев|порез|рана|рассеч|царап|укус|швы/.test(t)) return 'cut';
    if (/температур|простуд|грипп|лихорад|инфекц/.test(t)) return 'sick';
    if (/отравл|похмел|интоксик/.test(t)) return 'toxic';
    if (/истощ|кровопотер|обезвож/.test(t)) return 'drain';
    return 'other';
}

// ───────────── время и заживление ─────────────

function hoursBetween(a, b) {
    if (!a || !b) return 0;
    if (a.t != null && b.t != null) return Math.max(0, Math.min(2160, (b.t - a.t) / 3.6e6));
    return Math.max(0, ((b.mes ?? 0) - (a.mes ?? 0)) * 0.25);
}

export function healOf(who) {
    const h = cfg().heal[lifeKey(who)];
    if ([1, 2, 3, 4].includes(h)) return h;
    // Хеди: мутация гонит через тело огромную энергию — ткани обязаны регенерировать, иначе был бы некроз
    if (/^(хеди|hedy|ядвига)/i.test(A.norm(A.canonName(who)))) return 3;
    if (isUser(who)) return 1;
    try { const m = innerProf(who).metab; return m >= 2 ? 4 : m > 1 ? 2 : 1; } catch { return 1; }
}

function careF(w) {
    if (w.sev <= 1) return 1;
    return [w.sev >= 3 ? 0.45 : 0.65, w.sev >= 3 ? 0.75 : 0.95, 1, 1.15][w.care] ?? 1;
}
const baseH = (w) => KINDS[w.kind]?.[2]?.[w.sev] ?? 240;

/** Прогресс заживления сейчас (0–1), без записи. */
export function progAt(w, now, heal) {
    if (!KINDS[w.kind]?.[2]) return 0;
    return clamp01(w.prog + hoursBetween(w.upd, now) * heal * careF(w) / baseH(w));
}

function etaH(w, heal, prog) {
    if (!KINDS[w.kind]?.[2]) return null;
    return (1 - prog) * baseH(w) / (heal * careF(w));
}

function compChance(w, heal, strain = false) {
    if (!cfg().dice || !KINDS[w.kind]?.[2]) return 0;
    const careM = w.care === 0 ? (w.sev >= 2 ? 3 : 1) : w.care === 1 ? 1.6 : w.care === 2 ? 1 : 0.6;
    const kindM = WHOLE.includes(w.kind) ? 0.5 : 1;
    const healM = heal >= 4 ? 0.3 : heal >= 3 ? 0.4 : heal >= 2 ? 0.6 : 1;
    return Math.min(0.6, COMP_SEV[w.sev] * careM * kindM * healM * (strain ? 3 : 1));
}

function stageWord(w, prog) {
    if (!KINDS[w.kind]?.[2]) return 'хроническое';
    if (WHOLE.includes(w.kind)) return prog < 0.3 ? 'острая фаза' : prog < 0.8 ? 'идёт на поправку' : 'почти прошло';
    return prog < 0.15 ? 'свежая' : prog < 0.5 ? 'заживает' : prog < 0.85 ? 'затягивается' : 'почти зажило';
}

function dayWord(w, now) {
    const d = Math.floor(hoursBetween(w.at, now) / 24) + 1;
    return `${d}-й день`;
}

function etaWord(h) {
    if (h == null) return '';
    if (h < 20) return 'ещё несколько часов';
    const d = Math.round(h / 24);
    if (d <= 1) return '≈ ещё день';
    if (d < 14) return `≈ ещё ${d} ${A.plural(d, 'день', 'дня', 'дней')}`;
    const wk = Math.round(d / 7);
    return `≈ ещё ${wk} ${A.plural(wk, 'неделя', 'недели', 'недель')}`;
}

function scarChance(w) {
    if (w.kind === 'cut' || w.kind === 'gunshot') return w.sev >= 3 ? 1 : w.sev === 2 ? 0.4 : 0;
    if (w.kind === 'burn') return w.sev >= 3 ? 1 : w.sev === 2 ? 0.6 : 0;
    if (w.kind === 'fracture' || w.kind === 'internal') return w.care >= 3 ? 1 : 0;
    return 0;
}

function heal(who, w, i, rnd = Math.random()) {
    w.status = 'healed';
    w.prog = 1;
    w.healedMes = i;
    const scar = rnd < scarChance(w);
    if (scar) C(who).scars.push({ id: ++H().seq, t: w.part ? `шрам — ${w.part}` : `шрам (${w.t})`, from: w.t, mes: i, kind: w.kind });
    return scar;
}

function addComp(who, w, i, t, opts = {}) {
    const c = { t: String(t).slice(0, 160), mes: i, prevSev: w.sev, prevProg: w.prog, model: !!opts.model };
    if (!opts.model) {
        if (w.sev < 4 && Math.random() < 0.5) w.sev++;
        w.prog = Math.max(0, w.prog - 0.2);
    }
    w.comp.push(c);
    const h = H();
    if (!opts.model) h.note = { who: A.canonName(who), id: w.id, t: c.t, wt: w.t, mes: i, used: null };
    return c;
}

/** Время идёт: прогресс, суточные броски, заживление. roll — бросать кубик (только после поста). */
function tick(who, now, i, roll) {
    const hm = healOf(who);
    const out = { comps: [], healed: [] };
    for (const w of active(who)) {
        if (!KINDS[w.kind]?.[2]) { w.upd = { t: now.t, mes: now.mes }; continue; }
        const p = progAt(w, now, hm);
        if (roll) {
            const days = Math.min(2, Math.floor(hoursBetween(w.roll, now) / 24));
            for (let d = 0; d < days && w.status === 'on'; d++) {
                if (p < 0.7 && Math.random() < compChance(w, hm)) {
                    w.prog = p; w.upd = { t: now.t, mes: now.mes };
                    const pool = COMP[w.kind] || COMP.other;
                    out.comps.push([w, addComp(who, w, i, pool[Math.floor(Math.random() * pool.length)])]);
                    break;
                }
            }
            if (days > 0) w.roll = { t: now.t, mes: now.mes };
        }
        if (!out.comps.some(([x]) => x === w)) { w.prog = p; w.upd = { t: now.t, mes: now.mes }; }
        if (w.prog >= 1 && roll) out.healed.push([w, heal(who, w, i)]);
    }
    return out;
}

// ───────────── сводка ─────────────

function burden(who, now = rpNow()) {
    const hm = healOf(who);
    return active(who).reduce((a, w) => a + W[w.sev] * (1 - 0.6 * progAt(w, now, hm)), 0);
}
const FORM = [[1, 'В строю'], [3, 'Мелкие потери'], [7, 'Ограничения'], [12, 'На пределе'], [Infinity, 'Не боец']];
function formOf(b) { return FORM.find(([lim]) => b < lim)[1]; }

/** Потолок «самочувствия» для «Внутри». 100 — ран нет. */
export function hurtCap(who, now) {
    try { return hurtOn() && active(who).length ? Math.max(5, Math.round(100 - burden(who, now || rpNow()) * 7)) : 100; } catch { return 100; }
}
export function hurtCount(who) { try { return hurtOn() ? active(who).length : 0; } catch { return 0; } }
/** Прогноз тела на момент t (перемотка): что к тому времени заживёт, что останется и в какой стадии. */
export function hurtAt(who, t) {
    try {
        if (!hurtOn() || t == null) return [];
        const hm = healOf(who);
        const at = { t, mes: A.lastAiIndex?.() ?? 0 };
        return active(who).filter(w => !isOld(w)).map(w => {
            const p = progAt(w, at, hm);
            return { t: w.t, healed: p >= 1, prog: p, line: p >= 1 ? `${w.t} — заживёт` : line(w, at, hm) };
        });
    } catch { return []; }
}
/** Коротко для сверки (ляп-фикс): что сейчас с телом — раны с местом, стадией и чем мешают. */
export function hurtFacts(who) {
    try {
        if (!hurtOn()) return '';
        const now = rpNow();
        const hm = healOf(who);
        return active(who).map(w => (isOld(w) ? `${w.t}${w.part ? ` (${w.part})` : ''} — старое${w.fx.length ? `: ${w.fx.join(', ')}` : ''}` : line(w, now, hm))).join('; ');
    } catch { return ''; }
}

function cast() {
    const out = [A.canonName(A.ctx().name1)].filter(Boolean);
    for (const n of A.groupMembers().map(A.canonName)) if (n && !out.some(x => A.sameName(x, n))) out.push(n);
    return out;
}
function presentCast(st = A.worldState()) {
    const here = (st.scene?.characters_present || []).map(A.canonName);
    const all = cast();
    if (!here.length) return all;
    return all.filter(n => here.some(h => A.sameName(h, n)));
}

function line(w, now, hm) {
    const p = progAt(w, now, hm);
    const bits = [stageWord(w, p), w.sev >= 2 ? CARE[w.care] : ''].filter(Boolean).join(', ');
    const place = w.part && !A.norm(w.t).includes(A.norm(w.part)) ? ` (${w.part})` : '';
    return `${w.t}${place} — ${SEV[w.sev]}, ${bits}${w.fx.length ? `; мешает: ${w.fx.join(', ')}` : ''}${w.comp.length ? `; осложнение: ${w.comp[w.comp.length - 1].t}` : ''}`;
}

// детерминированный «случай» на ответ: свайп того же ответа даёт то же
function rnd(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
}

const COLD_RE = /холод|мороз|снег|дожд|сыр|ветр|метел|вьюг|слякот|ливень|гроз/i;
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ───────────── заметка модели ─────────────

export function hurtPrompt(type) {
    if (!A?.hasChat?.() || !hurtOn() || type === 'impersonate' || type === 'quiet') return '';
    const h = H();
    const now = rpNow();
    const L = A.chatArr().length;
    const R = type === 'swipe' ? L - 1 : L;
    const redo = (mes) => mes != null && ((type === 'swipe' && L - 1 === mes) || (type === 'regenerate' && L === mes));
    const mn = (() => { try { return moodNow(); } catch { return {}; } })();
    const fight = (() => { try { return modesOn().includes('fight'); } catch { return false; } })();
    const st = A.worldState();   // Horae считает состояние по всему чату — один раз на заметку
    const atm = String(st.scene?.atmosphere || '');
    const cold = COLD_RE.test(atm);
    const out = [];
    const bm = BEATS[cfg().beats][0];
    let anyWound = false;
    for (const who of presentCast(st)) {
        const list = active(who);
        const c = C(who);
        const me = isUser(who);
        const N = short(who);
        const hm = healOf(who);
        const fresh = list.filter(w => !isOld(w)).sort((a, b) => b.sev - a.sev || b.mes - a.mes);
        const old = list.filter(isOld);
        if (list.length) {
            if (fresh.length) anyWound = true;
            const ls = fresh.slice(0, 4).map(w => line(w, now, hm)).join('; ');
            const os = old.slice(0, 3).map(w => `${w.t}${w.part && !A.norm(w.t).includes(A.norm(w.part)) ? ` (${w.part})` : ''}${w.fx.length ? ` — ${w.fx.join(', ')}` : ''}`).join('; ');
            const body = [ls ? `травмы: ${ls}` : '', os ? `старое, что не даёт покоя: ${os}` : ''].filter(Boolean).join('. ');
            const form = fresh.length ? ` Состояние: ${formOf(burden(who, now)).toLowerCase()}.` : '';
            if (!fresh.length) out.push(me
                ? `[${N} (игрок) — ${body}. Кто близко знает — помнит и учитывает, без суеты; за ${N} не пиши ни действий, ни ощущений.]`
                : `[Тело ${N} — ${body}. Это часть ${N}: учитывай в движениях и силе, без нытья и без фокуса на этом.]`);
            else if (me) out.push(`[${N} (игрок) — ${body}.${form} Мир и персонажи это знают и учитывают: видят, берегут, тревожатся, не дают поднять тяжёлое; враги могут этим пользоваться. За ${N} не пиши ни действий, ни ощущений — но если ${N} в своём посте двигается, помни, что больно и что не всё получится.]`);
            else out.push(`[Тело ${N} — ${body}.${form} Это мешает по-настоящему: в движениях, силе, выносливости, сне, сексе${fresh.length && hm >= 3 ? ' (заживает на нём быстрее, чем на обычном человеке, но не мгновенно)' : ''}. ${N} может скрывать боль и храбриться, но тело не врёт. Без цифр и медицинских лекций.]`);
            // «даёт о себе знать»
            const top = fresh[0] || old[0];
            if (bm > 0 && !me && top) {
                const trig = top.trig ? new RegExp(top.trig.split(/[,;\s]+/).filter(x => x.length > 3).map(x => reEsc(x.slice(0, 5))).join('|') || '$^', 'i') : null;
                const hot = (cold && (top.kind === 'fracture' || isOld(top) || /холод|погод/i.test(top.trig))) || (trig && (trig.test(atm) || (fight && /нагруз|бой|драк|напряж/i.test(top.trig))));
                const boost = (fight ? 2 : 1) * (mn.intimOn ? 1.5 : 1) * (hot ? 1.8 : 1) * (isOld(top) ? 0.6 : 1);
                if (rnd(`${R}:${top.id}`) < Math.min(0.9, BEAT_SEV[isOld(top) ? 2 : top.sev] * bm * boost)) {
                    out.push(`[В этом ответе ${top.t}${top.part && !A.norm(top.t).includes(A.norm(top.part)) ? ` (${top.part})` : ''} у ${N} даёт о себе знать — покажи телом, к месту: ${top.fx.length && isOld(top) ? top.fx.join(', ') : HINT[top.kind] || HINT.other}. Коротко, без нытья.]`);
                }
            } else if (bm > 0 && me && fresh[0]?.sev >= 2) {
                if (rnd(`${R}:${fresh[0].id}:u`) < Math.min(0.6, BEAT_SEV[fresh[0].sev] * bm * 0.8)) out.push(`[Персонажи рядом помнят о травме ${N} (${fresh[0].t}): подставят плечо, проверят повязку, не дадут лишний раз напрячься — по-своему, в характере.]`);
            }
        }
        if (c.scars.length && (mn.intimOn || (cold && !me && rnd(`${R}:scar:${who}`) < 0.12 * bm))) {
            out.push(mn.intimOn
                ? `[Шрамы ${N}: ${c.scars.slice(-5).map(s => s.t).join('; ')} — они есть на теле, их можно увидеть и коснуться.]`
                : `[Старые раны ${N} ноют на погоду (${c.scars.slice(-3).map(s => s.t).join('; ')}) — мелочь, одной деталью.]`);
        }
    }
    // приступ старой травмы — в ближайший ответ
    const f = h.flare;
    if (f && (f.used == null || redo(f.used))) {
        const N = short(f.who);
        if (isUser(f.who)) out.push(`[У ${N} сейчас приступ: ${f.t}${f.fx ? ` — ${f.fx}` : ''}. Персонажи рядом замечают и реагируют по-своему (кто знает, что это, — знает, что делать); ощущений и действий ${N} не пиши за неё.]`);
        else out.push(`[Приступ у ${N}: ${f.t}${f.fx ? ` — ${f.fx}` : ''}. В этом ответе это накрывает — покажи телом, всерьёз; ${N} может пытаться скрыть, но не выходит.]`);
    }
    // осложнение — в ближайший ответ
    const n = h.note;
    if (n && (n.used == null || redo(n.used))) {
        if (isUser(n.who)) out.push(`[Осложнение у ${short(n.who)}: ${n.t} (${n.wt}). Покажи, как это видят и на это реагируют персонажи — это серьёзно, нужна помощь; ощущений и действий ${short(n.who)} не пиши за неё.]`);
        else out.push(`[Осложнение у ${short(n.who)}: ${n.t} (${n.wt}). Покажи это в этом ответе — телом и реакцией окружающих; это серьёзно, нужна помощь.]`);
    }
    if (fight) out.push(`[Бой: здесь тренированные бойцы — блокируют, уходят, держат удар, и большинство ударов не оставляет ничего, кроме боли и усталости. Но то, что по-настоящему достало, — последствия: мощно по лицу — разбитая губа, заплывший глаз, синяк; нож в бедро — это нож в бедро, и дальше человек с ним живёт. ${anyWound ? 'Уже полученные раны ограничивают в этой драке.' : ''} Не обнуляй последствия ради красоты и не раздувай их ради драмы.]`);
    return out.join('\n');
}

// ───────────── Летописец ─────────────

const HURT_RULE = `

hurt — травмы и состояние тела ВСЕХ персонажей, включая игрока, по ЭТОМУ посту: [{"who":"имя","new":null,"id":0,"care":0,"strain":false,"worse":"","healed":false,"flare":false}].
Новая травма — объект в new: {"t":"что, 2–6 слов","part":"где, 1–3 слова или пусто","kind":"cut|gunshot|blunt|fracture|burn|head|internal|sick|toxic|drain|shock|chronic|other","sev":1,"fx":["чем мешает телу, 2–6 слов"],"care":0}. sev: 1 — синяк, ссадина, разбитая губа, заплывший глаз; 2 — порез, растяжение, рана со швами, сильный ушиб; 3 — ножевое, огнестрел, перелом, сотрясение, глубокий ожог; 4 — угроза жизни. fx — 1–3 конкретных ограничения (не поднять руку выше плеча, хромает, больно дышать). care — что сделали сразу: 0 ничего, 1 перевязали / первая помощь, 2 зашили / врач / шина, 3 операция / больница.
Персонажи — тренированные бойцы: заблокированный, скользящий, принятый на мышцы удар — НЕ травма; боль и усталость после драки — не травма. Травма — только то, что в посте правда достало и оставило след: мощно по лицу — синяк (sev 1), нож в бедро — ножевое в бедро (sev 3). Не раздувай и не дроби одну драку на десять травм.
Для уже записанных травм (строка «Травмы», по номеру id; new — null): care — если в этом посте её обработали (1–3); strain — если её нагрузили (драка, бег, тяжёлое, секс, резкие движения); worse — если в посте стало хуже, 3–8 слов; healed — зажила, сняли швы или гипс; flare — у старой (хронической) травмы в посте случился приступ или обострение.
Только то, что правда случилось в посте. Ничего — [].`;

export function hurtChron() {
    if (!A?.hasChat?.() || !hurtOn()) return null;
    const rows = [];
    for (const who of cast()) for (const w of active(who)) rows.push(`[${w.id}] ${short(who)} — ${w.t}${w.part ? ` (${w.part})` : ''}, ${isOld(w) ? 'старая, хроническая' : `${SEV[w.sev]}, ${CARE[w.care]}`}`);
    return { key: '"hurt": []', rule: HURT_RULE, input: `Травмы: ${rows.length ? rows.join('; ') : 'пока нет'}`, tokens: 260 + rows.length * 30 };
}

function similar(a, b) {
    const ws = (t) => A.norm(t).split(/[^a-zа-яё0-9]+/i).filter(x => x.length > 3).map(x => x.slice(0, 5));
    const x = new Set(ws(a)), y = ws(b);
    if (!x.size || !y.length) return false;
    return y.filter(z => x.has(z)).length / Math.min(x.size, y.length) >= 0.6;
}

function byId(id) {
    for (const [k, c] of Object.entries(H().chars)) { const w = (c.list || []).find(x => x.id === Number(id)); if (w) return [k, w]; }
    return [null, null];
}

function pick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

/** Приступ старой травмы. src: dice — кубик, me — кнопкой, post — уже случился в посте (модели не напоминать). */
function setFlare(who, w, i, src) {
    const h = H();
    w.lastFlare = i;
    if (src === 'post') return;
    h.flare = { who: A.canonName(who), id: w.id, t: w.t, fx: w.fx.join(', '), mes: i, used: null, src };
    const me = isUser(who);
    A.toast(me ? 'warning' : 'info', `${esc(short(who))}: ${esc(w.t)}${w.fx.length ? ` — ${esc(w.fx.join(', '))}` : ''}<br><small>${me ? 'сыграй это в своём посте; персонажи заметят' : 'накроет в следующем ответе'} · тапни, чтобы отменить</small>`, '🌩 Приступ', {
        timeOut: 12000, escapeHtml: false,
        onclick: () => { if (H().flare?.id === w.id) { H().flare = null; A.saveMeta(); A.updatePrompt(); A.render?.(); A.toast('info', 'Приступ отменён', '🌩', { timeOut: 1500 }); } },
    });
}

function flareBoost(w, atm) {
    const trig = w.trig || '';
    let b = 1;
    if (COLD_RE.test(atm) && (/холод|погод|сыр|дожд|мороз/i.test(trig) || w.kind === 'chronic' && !trig)) b *= 1.8;
    try { if (modesOn().includes('fight') && /нагруз|бой|драк|напряж|сил/i.test(trig)) b *= 2; } catch { /* */ }
    try { if (moodNow().intimOn && /секс|близост|нагруз/i.test(trig)) b *= 1.5; } catch { /* */ }
    if (/стресс|нерв|страх|тревог|ссор/i.test(trig)) { try { const md = moodNow(); if (['tension', 'danger', 'fight', 'drama'].includes(md.manual || md.auto)) b *= 1.8; } catch { /* */ } }
    if (/энерг|камн|способн|сил/i.test(trig) && cast().some(n => active(n).some(x => x.kind === 'drain'))) b *= 1.6;
    return b;
}

export function hurtAfterPost(i, j, msg) {
    if (!A?.hasChat?.() || !hurtOn()) return;
    const h = H();
    // свайп/повтор этого же поста — откатиться к состоянию до него, иначе раны задвоятся
    if (h.snap && h.snap.i === i) { try { const s = JSON.parse(h.snap.data); h.chars = s.chars; h.seq = s.seq; h.note = s.note; h.flare = s.flare; } catch { /* */ } }
    else h.snap = { i, data: JSON.stringify({ chars: h.chars, seq: h.seq, note: h.note || null, flare: h.flare || null }) };
    const now = { ...rpNow(), mes: i };
    const comps = [], healed = [], fresh = [];
    // заметки, которые ушли модели перед этим ответом, отработали
    if (h.note && h.note.used == null && i > h.note.mes) h.note.used = i;
    if (h.flare && h.flare.used == null && i > h.flare.mes) h.flare.used = i;
    // 1) время прошло
    for (const who of cast()) { const r = tick(who, now, i, true); comps.push(...r.comps.map(x => [who, ...x])); healed.push(...r.healed.map(x => [who, ...x])); }
    // 2) что случилось в посте
    const names = cast();
    for (const r of Array.isArray(j?.hurt) ? j.hurt : []) {
        if (r?.new && typeof r.new === 'object' && String(r.new.t || '').trim()) {
            const who = names.find(n => A.sameName(n, r.who));
            if (!who) continue;
            const nw = r.new;
            const dup = active(who).find(w => similar(w.t, nw.t) && (!nw.part || !w.part || similar(w.part, nw.part)));
            if (dup) {
                if (isOld(dup)) { setFlare(who, dup, i, 'post'); continue; }
                dup.sev = Math.max(dup.sev, Math.min(4, Math.round(Number(nw.sev) || dup.sev)));
                dup.care = Math.max(dup.care, Math.min(3, Math.round(Number(nw.care) || 0)));
                continue;
            }
            const w = mkWound(h, { ...nw, kind: KINDS[nw.kind] ? nw.kind : guessKind(nw.t), mes: i, src: 'ai' }, now);
            C(who).list.push(w);
            fresh.push([who, w]);
            continue;
        }
        const [k, w] = byId(r?.id);
        if (!w || w.status !== 'on') continue;
        const yes = (v) => v === true || v === 'true';
        if (isOld(w)) {
            if (yes(r.flare) || yes(r.strain)) setFlare(k, w, i, 'post');
            if (yes(r.healed)) { w.status = 'healed'; w.healedMes = i; }
            continue;
        }
        const care = Math.round(Number(r.care) || 0);
        if (care > w.care) w.care = Math.min(3, care);
        if (r.worse && String(r.worse).trim()) addComp(k, w, i, String(r.worse).trim(), { model: true });
        if (yes(r.healed)) { healed.push([k, w, heal(k, w, i)]); continue; }
        if (yes(r.strain)) {
            const hm = healOf(k);
            w.prog = Math.max(0, w.prog - 0.04 * w.sev);
            if (Math.random() < compChance(w, hm, true)) comps.push([k, w, addComp(k, w, i, pick(COMP[w.kind] || COMP.other))]);
        }
    }
    // 3) приступ старой травмы — кубиком, по одному за раз и не впритык к прошлому (даже другой травмы)
    if (cfg().dice && !(h.flare && (h.flare.used == null || i - h.flare.used < 6))) {
        const atm = String(A.worldState().scene?.atmosphere || '');
        const pool = [];
        for (const who of cast()) for (const w of active(who).filter(isOld)) if (FLARE[w.flare]?.[0] && (w.lastFlare == null || i - w.lastFlare > 6) && !A.skipFlare?.(who, w)) pool.push([who, w]);
        for (const [who, w] of pool.sort(() => Math.random() - 0.5)) {
            if (Math.random() < Math.min(0.5, FLARE[w.flare][0] * flareBoost(w, atm))) { setFlare(who, w, i, 'dice'); break; }
        }
    }
    // тосты
    for (const [who, w] of fresh) A.toast('info', `${esc(short(who))}: ${esc(w.t)} — ${SEV[w.sev]}`, '🩸 Новая травма', { timeOut: 3500 });
    for (const [who, w, c] of comps) {
        A.toast('warning', `${esc(short(who))}: ${esc(c.t)}<br><small>${esc(w.t)} · тапни, чтобы отменить</small>`, '🎲 Осложнение', {
            timeOut: 12000, escapeHtml: false,
            onclick: () => { undoComp(w.id); A.toast('info', 'Осложнение отменено', '🎲', { timeOut: 1500 }); },
        });
    }
    for (const [who, w, scar] of healed) A.toast('success', `${esc(short(who))}: ${esc(w.t)} — зажило${scar ? ', остался шрам' : ''}`, '🩹 Зажило', { timeOut: 4000 });
    A.saveMeta();
}

function undoComp(id) {
    const [, w] = byId(id);
    if (!w || !w.comp.length) return;
    const c = w.comp.pop();
    if (!c.model) { w.sev = c.prevSev; w.prog = c.prevProg; }
    const h = H();
    if (h.note?.id === w.id && h.note.t === c.t) h.note = null;
    A.saveMeta();
    A.updatePrompt();
    A.render?.();
}

// ───────────── старые травмы из лорбуков ─────────────

const OLD_RE = /травм|ранен|ранил|(?<![а-яёa-z0-9])ран[аыуе](?![а-яёa-z0-9])|шрам|перелом|сломал|плеч|хронич|боль|болит|приступ|ожог|трещин|камн|некроз|регенер|контуз|сустав|колен|позвон|спин|scar|injur|wound|fractur|pain|shoulder|chronic|burn/i;

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

async function loreAbout(who) {
    const W = await wiMod();
    if (!W?.loadWorldInfo) return '';
    const c = A.ctx();
    const books = new Set();
    if (c.chatMetadata?.world_info) books.add(c.chatMetadata.world_info);
    for (const ch of A.chatCards?.() || []) {
        if (ch?.data?.extensions?.world) books.add(ch.data.extensions.world);
        (W.world_info?.charLore || []).find(e => e.name === ch.avatar)?.extraBooks?.forEach(b => books.add(b));
    }
    (W.selected_world_info || []).forEach(b => books.add(b));
    try { const pl = c.powerUserSettings?.persona_description_lorebook; if (pl) books.add(pl); } catch { /* */ }
    const mentions = (t) => { try { return (globalThis.LifeFaces?.inText?.(t) || []).some(n => A.sameName(n, who)); } catch { return A.norm(t).includes(A.norm(short(who))); } };
    const out = [];
    let total = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        for (const e of Object.values(data?.entries || {})) {
            const t = String(e?.content || '');
            if (e?.disable || !t || !OLD_RE.test(t)) continue;
            if (!mentions(`${e.comment || ''} ${(e.key || []).join(' ')} ${t.slice(0, 1500)}`)) continue;
            const piece = `### ${e.comment || (e.key || []).join(', ')}\n${t.slice(0, 2500)}`;
            if (total + piece.length > 14000) break;
            out.push(piece); total += piece.length;
        }
    }
    return out.join('\n\n');
}

const OLD_SYSTEM = `По карточке и записям лорбуков о персонаже ролевой истории найди СТАРЫЕ травмы и хронические состояния, которые и сейчас, в настоящем истории, не дают покоя: ограничения движений, хроническая боль, приступы, последствия ранений, операций, способностей. И шрамы, которые видно на теле.
Ответь только JSON: {"old":[{"t":"что, 2–6 слов","part":"где, 1–3 слова или пусто","fx":["чем мешает, 2–6 слов"],"flare":"off|rare|mid|often","trig":"что провоцирует приступ, 2–6 слов или пусто"}],"scars":["шрам — где, 2–6 слов"]}.
flare — как часто бывают приступы или обострения: off — просто постоянное ограничение, rare — редко, mid — иногда, often — часто. Только то, что правда есть в записях; давно и полностью зажившее — не нужно. 0–5 старых травм, 0–6 шрамов. Не повторяй уже записанное.`;

async function findOld(who) {
    const c = A.ctx();
    const card = isUser(who) ? String(c.powerUserSettings?.persona_description || '') : [A.cardOf?.(who)?.description, A.cardOf?.(who)?.personality].filter(Boolean).join('\n');
    const lore = await loreAbout(who);
    const have = C(who);
    const input = [`Персонаж: ${A.canonName(who)}`, card ? `Карточка:\n${A.cut(card, 5000)}` : '', lore ? `Лорбуки:\n${lore}` : '',
        have.list.filter(w => w.status === 'on' && isOld(w)).length ? `Уже записано: ${have.list.filter(w => w.status === 'on' && isOld(w)).map(w => w.t).join('; ')}` : '',
        have.scars.length ? `Шрамы уже записаны: ${have.scars.map(s => s.t).join('; ')}` : ''].filter(Boolean).join('\n\n');
    if (!card && !lore) throw new Error('не нашла про это ни карточки, ни записей в лорбуках');
    const out = await A.askModel([{ role: 'system', content: OLD_SYSTEM }, { role: 'user', content: input }], 1500);
    const j = A.extractJson(out);
    if (!j) throw new Error('модель не прислала JSON — попробуй ещё раз');
    const now = rpNow();
    const h = H();
    let n = 0;
    for (const x of Array.isArray(j.old) ? j.old : []) {
        if (!String(x?.t || '').trim() || have.list.some(w => w.status === 'on' && similar(w.t, x.t))) continue;
        have.list.push(mkWound(h, { ...x, kind: 'chronic', sev: 2, care: 2, src: 'lore', mes: A.lastAiIndex() }, now));
        n++;
    }
    for (const s of Array.isArray(j.scars) ? j.scars : []) {
        const t = String(s || '').trim().slice(0, 80);
        if (!t || have.scars.some(x => similar(x.t, t))) continue;
        have.scars.push({ id: ++h.seq, t, from: 'из лорбука', mes: A.lastAiIndex(), kind: 'cut' });
        n++;
    }
    A.saveMeta();
    A.updatePrompt();
    return n;
}

// ───────────── вид ─────────────

const ZONES = {
    head: [30, 11], neck: [30, 23], shoulderL: [41, 29], shoulderR: [19, 29], chest: [30, 36], ribsL: [37, 42], ribsR: [23, 42],
    abdomen: [30, 52], sideL: [38, 52], sideR: [22, 52], back: [30, 44], armL: [46, 46], armR: [14, 46], handL: [50, 66], handR: [10, 66],
    hip: [30, 64], thighL: [36, 80], thighR: [24, 80], kneeL: [36, 94], kneeR: [24, 94], shinL: [36, 106], shinR: [24, 106], footL: [37, 121], footR: [23, 121],
};
function zoneOf(w) {
    const t = `${w.part || ''} ${w.t || ''}`.toLowerCase();
    // левое у персонажа — справа на картинке (смотрим ему в лицо)
    const side = /лев/.test(t) ? 'L' : /прав/.test(t) ? 'R' : 'L';
    if (/голов|висок|затыл|лоб|череп|лиц|глаз|скул|челюст|нос|губ|бров|(?<![а-яёa-z0-9])ух[оа]/.test(t)) return 'head';
    if (/ше[яюие](?![а-яёa-z0-9])|шею|горл/.test(t)) return 'neck';
    if (/плеч|ключиц/.test(t)) return `shoulder${side}`;
    if (/рёбр|ребр/.test(t)) return `ribs${side}`;
    if (/спин|лопат|поясниц|позвон/.test(t)) return 'back';
    if (/груд/.test(t)) return 'chest';
    if (/живот|брюш|печен|селез|желуд/.test(t)) return 'abdomen';
    if (/(?<![а-яёa-z0-9])бок|бочин/.test(t)) return `side${side}`;
    if (/кист|ладон|пал[еь]ц|запяст|кулак|костяш/.test(t)) return `hand${side}`;
    if (/рук|предплеч|локот|локт/.test(t)) return `arm${side}`;
    if (/таз|пах/.test(t)) return 'hip';
    if (/колен/.test(t)) return `knee${side}`;
    if (/голен|икр|лодыж|щиколот/.test(t)) return `shin${side}`;
    if (/стоп|пятк|ступн/.test(t)) return `foot${side}`;
    if (/бедр|ягодиц|ног/.test(t)) return `thigh${side}`;
    if (WHOLE.includes(w.kind) || w.kind === 'chronic') return '';
    return 'chest';
}

function bodySvg(list, scars, now, hm) {
    const dots = list.map(w => {
        const z = zoneOf(w);
        if (!z || !ZONES[z]) return '';
        const [x, y] = ZONES[z];
        const p = progAt(w, now, hm);
        return `<circle class="lf-hu-dot s${isOld(w) ? 'o' : w.sev}${z === 'back' ? ' back' : ''}${!isOld(w) && p > 0.7 ? ' late' : ''}" cx="${x}" cy="${y}" r="${isOld(w) ? 3 : 2.2 + w.sev * 0.7}"/>`;
    }).join('');
    const sc = scars.slice(-8).map(s => {
        const z = zoneOf({ part: s.t, t: s.from || '', kind: 'cut' });
        if (!z || !ZONES[z]) return '';
        const [x, y] = ZONES[z];
        return `<path class="lf-hu-scar" d="M${x - 3} ${y + 1.5} L${x + 3} ${y - 1.5}"/>`;
    }).join('');
    const aura = list.some(w => WHOLE.includes(w.kind)) ? ' aura' : '';
    return `<svg class="lf-hu-body${aura}" viewBox="0 0 60 130" aria-hidden="true">
        <g class="lf-hu-fig"><circle cx="30" cy="11" r="8"/><path d="M27 19h6v5h-6z"/><path d="M18 26c3-2 21-2 24 0l2 30c-2 3-26 3-28 0z"/>
        <path d="M18 27c-4 2-6 8-7 20l-2 19 4 1 4-18 2-12"/><path d="M42 27c4 2 6 8 7 20l2 19-4 1-4-18-2-12"/>
        <path d="M17 57c0 6 1 10 2 14l2 26 1 24h6l1-31 1-14 1 14 1 31h6l1-24 2-26c1-4 2-8 2-14z"/></g>
        ${sc}${dots}</svg>`;
}

function cardHtml(who, w, now, hm) {
    const k = KINDS[w.kind] || KINDS.other;
    const p = progAt(w, now, hm);
    const eta = etaWord(etaH(w, hm, p));
    const N = esc(who);
    const tools = `<span class="lf-hu-sp"></span>
                <button class="lf-iconbtn sm" data-act="hu-edit" data-id="${w.id}" data-name="${N}" title="Поправить">${icon('pencil')}</button>
                <button class="lf-iconbtn sm" data-act="hu-heal" data-id="${w.id}" data-name="${N}" title="${isOld(w) ? 'Прошло совсем' : 'Зажило'}">${icon('check')}</button>
                <button class="lf-iconbtn sm" data-act="hu-del" data-id="${w.id}" data-name="${N}" title="Убрать — ошибка">${icon('x')}</button>`;
    if (isOld(w)) {
        const fl = H().flare;
        const now2 = fl && fl.id === w.id && fl.used == null;
        return `<div class="lf-hu-card old${now2 ? ' flaring' : ''}">
        <span class="lf-hu-ic">${icon(w.part ? 'bone' : 'clock')}</span>
        <div class="lf-hu-main">
            <div class="lf-hu-t"><b>${esc(w.t)}</b><small>${[w.part, w.trig ? `провоцирует: ${w.trig}` : '', w.lastFlare != null ? `последний приступ · #${w.lastFlare}` : ''].filter(Boolean).map(esc).join(' · ')}</small></div>
            ${w.fx.length ? `<div class="lf-hu-fx">${w.fx.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
            <div class="lf-hu-flare">${Object.entries(FLARE).map(([fk, fv]) => `<button class="${w.flare === fk ? 'on' : ''}" data-act="hu-fl" data-id="${w.id}" data-name="${N}" data-v="${fk}">${fv[1]}</button>`).join('')}</div>
            <div class="lf-hu-acts">
                <button class="lf-hu-care${now2 ? ' on' : ''}" data-act="hu-flare" data-id="${w.id}" data-name="${N}">🌩 ${now2 ? 'Приступ — в следующем' : 'Приступ сейчас'}</button>
                ${tools}
            </div>
        </div>
    </div>`;
    }
    return `<div class="lf-hu-card s${w.sev}">
        <span class="lf-hu-ic">${icon(k[1])}</span>
        <div class="lf-hu-main">
            <div class="lf-hu-t"><b>${esc(w.t)}</b><small>${[w.part, SEV[w.sev], stageWord(w, p), dayWord(w, now)].filter(Boolean).map(esc).join(' · ')}</small></div>
            ${k[2] ? `<div class="lf-hu-prog"><i class="lf-meter"><b style="width:${Math.round(p * 100)}%"></b></i><small>${esc(eta)}</small></div>` : ''}
            ${w.fx.length ? `<div class="lf-hu-fx">${w.fx.map(f => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
            ${w.comp.length ? `<div class="lf-hu-comp">${w.comp.slice(-2).map(c => `<span>${icon('dice')} ${esc(c.t)}</span>`).join('')}</div>` : ''}
            <div class="lf-hu-acts">
                <button class="lf-hu-care c${w.care}" data-act="hu-care" data-id="${w.id}" data-name="${N}" title="Помощь — тап, чтобы сменить">${icon('bandage')} ${CARE[w.care]}</button>
                ${tools}
            </div>
        </div>
    </div>`;
}

/** Раздел «Раны и травмы» — у персонажа во «Внутри» и у твоей персоны в «Жизни». */
export function hurtSection(who) {
    if (!A?.hasChat?.()) return '';
    if (!hurtOn()) return `${A.sec('Раны и травмы', 'выключено')}<label class="lf-switch"><input type="checkbox" data-act="hu-on"><span></span>Вести раны и дебаффы</label>`;
    who = A.canonName(who);
    const now = rpNow();
    const hm = healOf(who);
    const all = active(who);
    const list = all.filter(w => !isOld(w)).sort((a, b) => b.sev - a.sev || b.mes - a.mes);
    const old = all.filter(isOld);
    const c = C(who);
    const b = burden(who, now);
    const form = formOf(b);
    const pct = Math.max(4, Math.round(100 - b * 7));
    const N = esc(who);
    const recent = c.list.filter(w => w.status === 'healed').slice(-3).reverse();
    return `${A.sec('Раны и травмы', list.length ? `${list.length} · ${form.toLowerCase()}` : 'свежих нет')}
    <section class="lf-hu">
        ${bodySvg(all, c.scars, now, hm)}
        <div class="lf-hu-side">
            <div class="lf-hu-form"><span>Форма</span><b>${esc(form)}</b><i class="lf-meter"><b style="width:${pct}%"></b></i></div>
            <div class="lf-hu-heal"><span>Заживление</span><b>${esc(HEAL.find(x => x[0] === hm)?.[1] || '')}</b></div>
            ${c.scars.length ? `<div class="lf-hu-scars">${c.scars.slice(-8).reverse().map(s => `<span title="${esc(s.from || '')}">${esc(s.t)}<button data-act="hu-scar-del" data-id="${s.id}" data-name="${N}">${icon('x')}</button></span>`).join('')}</div>` : '<div class="lf-dim small">Шрамов не записано.</div>'}
        </div>
    </section>
    ${list.length ? list.map(w => cardHtml(who, w, now, hm)).join('') : ''}
    <div class="lf-actions"><button class="lf-btn" data-act="hu-add" data-name="${N}">${icon('plus')} Травма</button><button class="lf-btn" data-act="hu-add-old" data-name="${N}">${icon('clock')} Старая травма</button></div>
    ${A.sec('Старое, что не даёт покоя', old.length ? String(old.length) : '')}
    ${old.length ? old.map(w => cardHtml(who, w, now, hm)).join('') : '<div class="lf-empty small">Хроники нет. Старое плечо, которое плохо поднимается, боль, что накатывает приступами, — добавь руками или найду в лорбуках.</div>'}
    <button class="lf-btn ghost full" data-act="hu-lore" data-name="${N}">${icon('book')} Найти старые травмы и шрамы в лорбуках</button>
    ${recent.length ? `<div class="lf-hu-past">${recent.map(w => `<span>${icon('check')} ${esc(w.t)}${w.healedMes != null ? ` · #${w.healedMes}` : ''}</span>`).join('')}</div>` : ''}
    <div class="lf-field"><label>Заживление ${isUser(who) ? '' : `у ${esc(short(who))}`}</label>
        <div class="lf-seg">${HEAL.map(([v, l]) => `<button class="${hm === v ? 'on' : ''}" data-act="hu-speed" data-name="${N}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <details class="lf-hu-set"><summary>${icon('settings')} Как это работает</summary>
        <label class="lf-switch"><input type="checkbox" data-act="hu-dice" ${cfg().dice ? 'checked' : ''}><span></span>Кубик: осложнения и приступы (тап по тосту — отменить)</label>
        <div class="lf-field"><label>Раны дают о себе знать</label>
        <div class="lf-seg">${Object.entries(BEATS).map(([k, v]) => `<button class="${cfg().beats === k ? 'on' : ''}" data-act="hu-beats" data-v="${k}">${v[1]}</button>`).join('')}</div></div>
        <label class="lf-switch"><input type="checkbox" data-act="hu-on" checked><span></span>Вести раны и дебаффы</label>
        <div class="lf-hint">Не каждый удар — рана: бойцы блокируют и держат удар. Травма — то, что правда достало: мощно по лицу — синяк, нож в бедро — нож в бедро. Заживает по времени истории (таймскип тоже лечит). Помощь ускоряет и снижает риск; нагрузка (драка, бег, секс) откатывает заживление и бросает кубик. Старые травмы не заживают — мешают всегда и иногда накрывают приступом. Тяжёлые раны оставляют шрамы.</div>
    </details>`;
}

/** Плашка в «Сцене»: кто ранен из тех, кто рядом. */
export function hurtSceneHtml() {
    if (!A?.hasChat?.() || !hurtOn()) return '';
    const now = rpNow();
    const rows = [];
    for (const who of presentCast()) {
        const list = active(who).filter(w => !isOld(w));
        if (!list.length) continue;
        const hm = healOf(who);
        const top = list.sort((a, b) => b.sev - a.sev)[0];
        rows.push(`<button class="lf-hu-row" data-act="person" data-name="${esc(who)}">${A.ava(who, 'sm')}<span><b>${esc(short(who))}</b> ${esc(top.t)}${list.length > 1 ? ` <i>+${list.length - 1}</i>` : ''}<small>${esc(stageWord(top, progAt(top, now, hm)))} · ${esc(formOf(burden(who, now)).toLowerCase())}</small></span><i class="lf-hu-sevdot s${top.sev}"></i></button>`);
    }
    const h = H();
    const pend = [h.note && h.note.used == null ? `<div class="lf-hu-pend">${icon('dice')} ${esc(short(h.note.who))}: ${esc(h.note.t)} <small>— в следующем ответе</small></div>` : '',
        h.flare && h.flare.used == null ? `<div class="lf-hu-pend">🌩 ${esc(short(h.flare.who))}: приступ — ${esc(h.flare.t)} <small>— в следующем ответе</small></div>` : ''].join('');
    return rows.length || pend ? `${A.sec('Раны', 'у тех, кто рядом')}<div class="lf-hu-rows">${rows.join('')}</div>${pend}` : '';
}

function editSheet(who, w, old = false) {
    const v = w || { t: '', part: '', kind: old ? 'chronic' : 'cut', sev: 2, fx: [], care: old ? 2 : 0, prog: 0, flare: 'rare', trig: '' };
    const chronic = v.kind === 'chronic';
    const p = w ? Math.round(progAt(w, rpNow(), healOf(who)) * 100) : 0;
    A.openSheet(`${icon(chronic ? 'clock' : 'bandage')} ${w ? 'Травма' : chronic ? 'Старая травма' : 'Новая травма'} · ${esc(short(who))}`, `
        <div class="lf-field"><label>Что</label><input type="text" data-in="hu-t" value="${esc(v.t)}" placeholder="${chronic ? 'плечо плохо поднимается, боль от Камней…' : 'ножевое, вывих плеча, простуда…'}"></div>
        <div class="lf-field"><label>Где</label><input type="text" data-in="hu-part" value="${esc(v.part)}" placeholder="левое плечо, правое колено…"></div>
        ${chronic ? '<input type="hidden" data-in="hu-kind" value="chronic">' : `<div class="lf-row2">
            <div class="lf-field"><label>Тип</label><select data-in="hu-kind">${KIND_IDS.filter(k => k !== 'chronic').map(k => `<option value="${k}"${v.kind === k ? ' selected' : ''}>${KINDS[k][0]}</option>`).join('')}</select></div>
            <div class="lf-field"><label>Тяжесть</label><select data-in="hu-sev">${[1, 2, 3, 4].map(s => `<option value="${s}"${v.sev === s ? ' selected' : ''}>${SEV[s]}</option>`).join('')}</select></div>
        </div>`}
        <div class="lf-field"><label>Чем мешает (через запятую)</label><input type="text" data-in="hu-fx" value="${esc(v.fx.join(', '))}" placeholder="${chronic ? 'рука не поднимается выше плеча, ноет к ночи' : 'хромает, не поднять руку выше плеча'}"></div>
        ${chronic ? `<div class="lf-field"><label>Приступы</label><select data-in="hu-flare">${Object.entries(FLARE).map(([k, f]) => `<option value="${k}"${v.flare === k ? ' selected' : ''}>${f[1]}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Что провоцирует</label><input type="text" data-in="hu-trig" value="${esc(v.trig || '')}" placeholder="холод, нагрузка, выброс энергии, стресс"></div>`
        : `<div class="lf-field"><label>Помощь</label><select data-in="hu-care">${CARE.map((c, n) => `<option value="${n}"${v.care === n ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
        ${w && KINDS[w.kind]?.[2] ? `<div class="lf-field"><label>Зажило на, %</label><input type="range" min="0" max="99" value="${p}" data-in="hu-prog"></div>` : ''}`}
        <button class="lf-btn primary full" data-act="hu-save" data-name="${esc(who)}" data-id="${w ? w.id : ''}">${icon('check')} Сохранить</button>`);
}

export async function hurtClick(act, el) {
    if (!act.startsWith('hu-')) return false;
    const done = (meta = true) => { meta ? A.saveMeta() : A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    const who = A.canonName(el.dataset.name || '');
    const i = A.lastAiIndex();
    switch (act) {
        case 'hu-on': cfg().on = !!el.checked; return done(false);
        case 'hu-dice': cfg().dice = !!el.checked; return done(false);
        case 'hu-beats': cfg().beats = BEATS[el.dataset.v] ? el.dataset.v : 'mid'; return done(false);
        case 'hu-speed': {
            tick(who, rpNow(), i, false);   // до смены скорости — досчитать по старой
            cfg().heal[lifeKey(who)] = Number(el.dataset.v) || 1;
            A.saveMeta();
            return done(false);
        }
        case 'hu-add': editSheet(who, null); return true;
        case 'hu-add-old': editSheet(who, null, true); return true;
        case 'hu-edit': { const [, w] = byId(el.dataset.id); if (w) editSheet(who, w); return true; }
        case 'hu-save': {
            const box = el.closest('.lf-sheet') || document;
            const val = (k) => box.querySelector(`[data-in="${k}"]`)?.value ?? '';
            const t = val('hu-t').trim();
            if (!t) { A.toast('warning', 'Напиши, что за травма', '🩸 Раны', { timeOut: 1800 }); return true; }
            const kind = KINDS[val('hu-kind')] ? val('hu-kind') : 'other';
            const rec = { t, part: val('hu-part').trim(), kind, sev: Number(val('hu-sev')) || 2, fx: val('hu-fx').split(/[,;]/).map(x => x.trim()).filter(Boolean), care: kind === 'chronic' ? 2 : Number(val('hu-care')) || 0, flare: val('hu-flare') || 'rare', trig: val('hu-trig').trim() };
            const now = rpNow();
            const [, w] = el.dataset.id ? byId(el.dataset.id) : [null, null];
            if (w) {
                tick(who, now, i, false);
                Object.assign(w, { t: rec.t.slice(0, 70), part: rec.part.slice(0, 40), kind, sev: Math.max(1, Math.min(4, rec.sev)), fx: rec.fx.slice(0, 4), care: Math.max(0, Math.min(3, rec.care)) });
                if (kind === 'chronic') { w.flare = FLARE[rec.flare] ? rec.flare : 'rare'; w.trig = rec.trig.slice(0, 80); }
                const pr = box.querySelector('[data-in="hu-prog"]');
                if (pr) { w.prog = clamp01(Number(pr.value) / 100); w.upd = { t: now.t, mes: now.mes }; }
            } else C(who).list.push(mkWound(H(), { ...rec, mes: i, src: 'me' }, { ...now, mes: i }));
            A.closeSheet();
            return done();
        }
        case 'hu-care': {
            const [k, w] = byId(el.dataset.id);
            if (!w) return true;
            tick(k, rpNow(), i, false);
            w.care = (w.care + 1) % 4;
            return done();
        }
        case 'hu-fl': { const [, w] = byId(el.dataset.id); if (w) w.flare = FLARE[el.dataset.v] ? el.dataset.v : 'rare'; return done(); }
        case 'hu-flare': {
            const [k, w] = byId(el.dataset.id);
            if (!w) return true;
            const h = H();
            if (h.flare?.id === w.id && h.flare.used == null) { h.flare = null; A.toast('info', 'Приступ отменён', '🌩', { timeOut: 1500 }); }
            else setFlare(k, w, i, 'me');
            return done();
        }
        case 'hu-lore': {
            await A.withBusy(el, async () => {
                const n = await findOld(who);
                A.toast('success', n ? `Добавила: ${n}` : 'Нового не нашлось', '📖 Старые травмы', { timeOut: 2500 });
                A.render();
            }, 'Читаю лорбуки…');
            return true;
        }
        case 'hu-heal': {
            const [k, w] = byId(el.dataset.id);
            if (!w) return true;
            const scar = isOld(w) ? false : heal(k, w, i);
            if (isOld(w)) { w.status = 'healed'; w.healedMes = i; }
            A.toast('success', `${esc(w.t)} — ${isOld(w) ? 'больше не мешает' : 'зажило'}${scar ? ', остался шрам' : ''}`, '🩹 Раны', { timeOut: 2200 });
            return done();
        }
        case 'hu-del': {
            const [k, w] = byId(el.dataset.id);
            if (!w) return true;
            w.status = 'gone';
            const h = H();
            if (h.note?.id === w.id) h.note = null;
            if (h.flare?.id === w.id) h.flare = null;
            C(k).list = C(k).list.filter(x => x.status !== 'gone');
            return done();
        }
        case 'hu-scar-del': { const c = C(who); c.scars = c.scars.filter(s => s.id !== Number(el.dataset.id)); return done(); }
    }
    return false;
}
