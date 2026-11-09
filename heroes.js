// Супергеройская личность. На каждого героя:
//  1) тайна — кто знает, кто под маской, улики (что выдало и кто заметил), риск раскрытия;
//  2) как узнают по годам — hero.js (периоды, собранные из лора);
//  3) костюм — как выглядит (реф для кадров), состояние, где лежит, апгрейды;
//  4) слава — популярность, рейтинг среди Мстителей, фан-клубы, мерч, граффити, хейтеры (растёт и падает от событий);
//  5) слухи «кто под маской» — в СМИ и сарафаном;
//  6) подвиги глазами людей — из лора и из истории;
//  7) закон — по годам (договор, розыск, помилование);
//  8) статус для мира — по году истории, история может поменять;
//  и мемориалы по тем, кого мир считает погибшими: муралы, свечи, бдения — «пусть увидит» в следующем ответе.
// Что меняет история, отмечает Летописец по постам — записью в посте (свайпнула — запись ушла вместе с ним).
// Лор живёт в её лорбуках и настройках, в коде — ни имён, ни лора.

import { storyYear } from './era.js';
import { heroRoster, heroOf, fameNow, fameCollect, STATUS, STATUS_SAY, heroOn } from './hero.js';
import { canonText } from './canon.js';

let A = null;
export function initHeroes(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, Math.round(Number(v) || 0)));
const short = (n) => A.shortName(A.canonName(n));
const busy = new Set();

export const SUIT_ST = { intact: 'цел', damaged: 'повреждён', repair: 'в ремонте', lost: 'потерян' };
const FAN_IC = { клуб: 'users', мерч: 'shirt', граффити: 'palette', хейтеры: 'flame', фанфики: 'feather', косплей: 'star', петиция: 'pencil', хештег: 'message' };

function M() {
    const cm = A.chatMeta();
    if (!cm.heroes || typeof cm.heroes !== 'object') cm.heroes = {};
    const h = cm.heroes;
    for (const k of ['knowsAdd', 'knowsDel', 'suit', 'popHand', 'statusHand']) if (!h[k] || typeof h[k] !== 'object' || Array.isArray(h[k])) h[k] = {};
    for (const k of ['rumors', 'memorials']) if (!Array.isArray(h[k])) h[k] = [];
    return h;
}
const year = () => { try { return storyYear(); } catch { return null; } };
const kOf = (obj, name) => Object.keys(obj).find(k => A.sameName(k, name)) || '';
const getK = (obj, name) => { const k = kOf(obj, name); return k ? obj[k] : undefined; };

// ───────────── кто герой ─────────────

/** Герои истории: { name, h (лор), f (как знают сейчас) } — у кого есть геройское имя, тайна, костюм или статус. */
export function heroesNow() {
    if (!A || !heroOn()) return [];
    const out = [];
    for (const n of heroRoster()) {
        const h = heroOf(n);
        if (!h) continue;
        const f = fameNow(n);
        const heroic = str(h.alias) || h.secret || str(h.suitLook) || (h.eras || []).some(r => r.suit || ['active', 'retired', 'dead', 'wanted', 'hidden'].includes(r.status));
        if (heroic) out.push({ name: n, h, f });
    }
    return out;
}

// ───────────── что записала история (по постам) ─────────────

let ver = 0;
let memo = null;
const KEYS = ['knows', 'clue', 'suit', 'feat', 'pop', 'status'];

function scan() {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    const sig = `${chat.length}|${last?.mes?.length}|${last?.swipe_id}|${ver}`;
    if (memo && memo.chat === chat && memo.sig === sig && Date.now() - memo.at < 500) return memo;
    const out = Object.fromEntries(KEYS.map(k => [k, []]));
    for (let i = Math.max(0, chat.length - 900); i < chat.length; i++) {
        const m = chat[i];
        if (!m || m.is_user) continue;
        const h = A.chronOf(i)?.hero;
        if (!h) continue;
        for (const k of KEYS) for (const x of arr(h[k])) out[k].push({ ...x, mes: i });
    }
    memo = { chat, sig, at: Date.now(), ...out };
    return memo;
}

/** Кто знает тайну героя: по лору + узнали по ходу истории + руками (и минус «не знает»). */
export function knowsOf(name) {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !A.sameName(n, name) && !out.some(x => A.sameName(x, n))) out.push(n); };
    arr(heroOf(name)?.knows).forEach(add);
    scan().knows.filter(x => A.sameName(x.about, name)).forEach(x => add(x.who));
    arr(getK(M().knowsAdd, name)).forEach(add);
    const del = arr(getK(M().knowsDel, name));
    return out.filter(n => !del.some(d => A.sameName(d, n)));
}

export function cluesOf(name) { return scan().clue.filter(x => A.sameName(x.about, name)); }

/** Риск раскрытия 0–100: свежие улики и сколько людей знает. */
export function riskOf(name) {
    const L = A.chatArr().length;
    const recent = cluesOf(name).filter(x => L - x.mes < 160).length;
    const old = cluesOf(name).length - recent;
    const kn = knowsOf(name).length;
    return clamp(6 + recent * 14 + old * 4 + Math.max(0, kn - 2) * 5);
}
const riskWord = (v) => (v >= 60 ? 'высокий' : v >= 30 ? 'средний' : 'низкий');

/** Костюм: { look, img, st, where, up: [], note, src }. */
export function suitOf(name) {
    const h = heroOf(name) || {};
    let st = { st: 'intact', where: '', note: '', mes: -1, src: '' };
    const up = [];
    for (const x of scan().suit) {
        if (!A.sameName(x.who, name)) continue;
        if (SUIT_ST[x.st]) st = { st: x.st, where: str(x.where), note: str(x.note), mes: x.mes, src: 'ai' };
        else if (x.where) st = { ...st, where: str(x.where), mes: x.mes };
        if (str(x.up)) up.push({ t: str(x.up), mes: x.mes });
    }
    const hand = getK(M().suit, name);
    if (hand && (hand.mes ?? -1) >= st.mes) st = { st: hand.st || st.st, where: hand.where ?? st.where, note: hand.note ?? '', mes: hand.mes, src: 'hand' };
    for (const u of arr(hand?.up)) up.push({ t: u, hand: true });
    return { look: str(h.suitLook), img: str(h.suitImg), ...st, up };
}

/** Популярность сейчас: от лора на эти годы ± то, что случилось в истории. */
export function popOf(name) {
    const base = fameNow(name)?.pop ?? 50;
    const ds = scan().pop.filter(x => A.sameName(x.who, name));
    const hand = Number(getK(M().popHand, name)) || 0;
    const v = clamp(base + ds.reduce((a, x) => a + clamp(x.d, -15, 15), 0) + hand);
    const trend = ds.slice(-3).reduce((a, x) => a + (Number(x.d) || 0), 0);
    return { v, trend, log: ds.slice(-6).reverse() };
}

/** Статус для мира: история или руками — главнее периода. */
export function statusOf(name) {
    const f = fameNow(name);
    let s = { st: f?.status || '', why: '', mes: -1, src: 'era' };
    for (const x of scan().status) if (A.sameName(x.who, name) && STATUS[x.st]) s = { st: x.st, why: str(x.why), mes: x.mes, src: 'ai' };
    const hand = getK(M().statusHand, name);
    if (hand?.st && (hand.mes ?? -1) >= s.mes) s = { st: hand.st, why: str(hand.why), mes: hand.mes, src: 'hand' };
    return { ...s, law: f?.law || '' };
}

/** Подвиги: из лора (до этого года) и из истории. */
export function featsOf(name) {
    const y = year();
    const lore = arr(heroOf(name)?.feats).filter(f => !y || !Number(f.year) || Number(f.year) <= y).map(f => ({ ...f, src: 'lore' }));
    const story = scan().feat.filter(x => arr(x.who).some(w => A.sameName(w, name))).map(x => ({ year: y || '', t: str(x.t), public: str(x.public), mes: x.mes, src: 'story' }));
    return [...lore, ...story];
}

// ───────────── модели ─────────────

export function heroesPrompt(type) {
    if (!A?.hasChat?.() || !heroOn() || type === 'quiet' || type === 'impersonate') return '';
    const st = A.worldState();
    const here = (st.scene?.characters_present || []).map(A.canonName);
    const lines = [];
    for (const x of heroesNow()) {
        const inScene = here.some(h => A.sameName(h, x.name));
        if (!inScene) continue;
        const alias = str(x.h.alias);
        if (x.h.secret && alias) {
            const kn = knowsOf(x.name);
            const strangers = here.filter(n => !A.sameName(n, x.name) && !kn.some(k => A.sameName(k, n)));
            if (strangers.length) {
                const r = riskOf(x.name);
                lines.push(`${alias} — это ${short(x.name)}: тайна; знают только ${kn.map(short).join(', ') || 'никто'} — ${strangers.map(short).join(', ')} не знают, при них её не выдают${r >= 60 ? `; улик уже много (${cluesOf(x.name).slice(-3).map(c => c.t).join('; ')}) — кто-то может догадаться` : ''}`);
            }
        }
        const s = statusOf(x.name);
        if (['wanted', 'dead', 'retired', 'hidden'].includes(s.st)) lines.push(`${alias || short(x.name)} — ${STATUS_SAY[s.st]}${s.law ? ` (${s.law})` : s.why ? ` (${s.why})` : ''}`);
        const su = suitOf(x.name);
        if (su.st !== 'intact' || su.where) lines.push(`костюм ${short(x.name)}: ${SUIT_ST[su.st]}${su.where ? ` — ${su.where}` : ''}${su.note ? ` (${su.note})` : ''}`);
    }
    const out = [];
    if (lines.length) out.push(`[Герои сейчас: ${lines.join(' | ')}.]`);
    const m = M();
    const last = A.lastAiIndex?.() ?? A.chatArr().length - 1;
    if (m.rumorPush) {
        if (last - m.rumorPush.at > 12) { m.rumorPush = null; A.saveMeta(); }
        else out.push(`[Сейчас говорят (СМИ и сарафан): «${m.rumorPush.text}». Кто-то в сцене может это услышать, прочитать или упомянуть — не обязательно сразу.]`);
    }
    if (m.memPush) {
        if (last > m.memPush.at) { m.memPush = null; A.saveMeta(); }
        else out.push(`[В ЭТОМ ответе — рядом или по пути: ${m.memPush.text}. Персонажи это видят; что чувствует ${short(A.ctx().name1)} — пишет она сама, ей — только то, что видно со стороны.]`);
    }
    return out.join('\n');
}

/** Для СМИ: статусы, слава, свежие подвиги и слухи о героях. */
export function heroesDigest() {
    if (!heroOn()) return '';
    const L = [];
    for (const x of heroesNow()) {
        const alias = str(x.h.alias) || short(x.name);
        const s = statusOf(x.name);
        const p = popOf(x.name);
        const feats = featsOf(x.name).filter(f => f.src === 'story').slice(-2).map(f => f.public || f.t);
        L.push(`- ${alias}: ${STATUS[s.st] || 'на виду'}${s.law ? ` (${s.law})` : ''}; популярность ${p.v}/100${p.trend ? ` (${p.trend > 0 ? '+' : ''}${p.trend} за последнее)` : ''}${feats.length ? `; недавно на виду: ${feats.join('; ')}` : ''}${x.h.secret && riskOf(x.name) >= 60 ? '; кто под маской — гадают всё ближе к правде (без доказательств)' : ''}`);
    }
    const rum = M().rumors.slice(-3).map(r => `- ${r.text}`);
    return [L.length ? `Герои глазами публики:\n${L.join('\n')}` : '', rum.length ? `Ходят слухи:\n${rum.join('\n')}` : ''].filter(Boolean).join('\n\n');
}

/** Для кадров: кто в кадре в костюме — как костюм выглядит, и его картинка рефом. */
export function heroNote(names = [], prompt = '') {
    const out = { text: '', refs: [] };
    if (!A || !heroOn() || !names?.length) return out;
    const bits = [];
    for (const n of names) {
        const h = heroOf(n);
        if (!h || (!h.suitLook && !h.suitImg)) continue;
        const alias = str(h.alias);
        const inSuit = (alias && new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(prompt)) || /\b(suit|costume|armou?r|uniform|mask)\b|костюм|маск|броне/i.test(prompt);
        if (!inSuit) continue;
        if (h.suitLook) bits.push(`${short(n)}${alias ? ` as ${alias}` : ''} wears the hero suit: ${h.suitLook}`);
        if (h.suitImg) out.refs.push(h.suitImg);
    }
    if (bits.length) out.text = `Costume continuity: ${bits.join('; ')}${out.refs.length ? ' (the suit reference image shows the exact suit)' : ''}.`;
    return out;
}

// ───────────── Летописец ─────────────

const RULE = `
hero — супергеройское в ЭТОМ посте, только то, что было (пустые поля не пиши; ничего такого — null): {"knows":[{"who":"кто узнал тайну личности","about":"чью — имя героя"}],"clue":[{"about":"чья тайна чуть не выдала себя","t":"что выдало, 3–10 слов","seen":"кто заметил"}],"suit":[{"who":"","st":"intact|damaged|repair|lost","where":"где костюм, 1–5 слов","note":"что с ним, 2–8 слов","up":"новый апгрейд, если появился"}],"feat":[{"who":["имена"],"t":"что сделали на виду у людей, 4–12 слов","public":"как это выглядело для людей, 6–14 слов"}],"pop":[{"who":"","d":-10,"why":"почему публика полюбила или разлюбила, 3–8 слов"}],"status":[{"who":"","st":"active|retired|dead|wanted|hidden","why":"3–8 слов"}]}. pop — только после событий на виду у людей.`;

export function heroesChron(i) {
    if (!A?.hasChat?.() || !heroOn() || !Number.isFinite(i)) return null;
    const hs = heroesNow();
    if (!hs.length) return null;
    const line = hs.map(x => {
        const alias = str(x.h.alias);
        const s = statusOf(x.name);
        return `${x.name}${alias ? ` — ${alias}` : ''}${x.h.secret ? ` (тайна; знают: ${knowsOf(x.name).map(short).join(', ') || 'никто'})` : ''}${s.st ? `, для мира — ${STATUS[s.st]}` : ''}`;
    }).join('; ');
    return { key: '"hero": null', rule: RULE, input: `Герои: ${line}`, tokens: 140 };
}

export function heroesAfterPost(i, j) {
    if (!heroOn()) return;
    const e = A.chronOf(i);
    if (!e) return;
    const raw = j?.hero;
    const names = heroRoster();
    const who = (v) => names.find(n => A.sameName(n, A.canonName(str(v)))) || '';
    const any = (v) => A.canonName(str(v));
    const out = {};
    if (raw && typeof raw === 'object') {
        const kn = arr(raw.knows).map(x => ({ who: any(x?.who), about: who(x?.about) })).filter(x => x.who && x.about && !A.sameName(x.who, x.about));
        const cl = arr(raw.clue).map(x => ({ about: who(x?.about), t: str(x?.t).slice(0, 90), seen: any(x?.seen) })).filter(x => x.about && x.t);
        const su = arr(raw.suit).map(x => ({ who: who(x?.who), st: SUIT_ST[str(x?.st)] ? str(x.st) : '', where: str(x?.where).slice(0, 60), note: str(x?.note).slice(0, 80), up: str(x?.up).slice(0, 80) })).filter(x => x.who && (x.st || x.where || x.up));
        const fe = arr(raw.feat).map(x => ({ who: arr(x?.who).map(who).filter(Boolean), t: str(x?.t).slice(0, 120), public: str(x?.public).slice(0, 160) })).filter(x => x.who.length && x.t);
        const po = arr(raw.pop).map(x => ({ who: who(x?.who), d: clamp(x?.d, -15, 15), why: str(x?.why).slice(0, 80) })).filter(x => x.who && x.d);
        const sts = arr(raw.status).map(x => ({ who: who(x?.who), st: STATUS[str(x?.st)] ? str(x.st) : '', why: str(x?.why).slice(0, 80) })).filter(x => x.who && x.st);
        if (kn.length) out.knows = kn;
        if (cl.length) out.clue = cl;
        if (su.length) out.suit = su;
        if (fe.length) out.feat = fe;
        if (po.length) out.pop = po;
        if (sts.length) out.status = sts;
    }
    const had = !!e.hero;
    if (Object.keys(out).length) e.hero = out; else delete e.hero;
    if (had || e.hero) { ver++; A.saveMeta(); }
}

/** «Что записал пост»: геройское — с ✕. */
export function heroesRecs(i) {
    const e = A.chronOf(i);
    const h = e?.hero;
    if (!h) return [];
    const rows = [];
    const add = (k, x, t, icon) => rows.push({ id: `hero:${k}:${rows.length}`, g: 'Герои', icon, t, del: () => { h[k] = arr(h[k]).filter(y => y !== x); if (!h[k].length) delete h[k]; if (!Object.keys(h).length) delete e.hero; ver++; } });
    for (const x of arr(h.knows)) add('knows', x, `${short(x.who)} узнаёт, кто ${str(heroOf(x.about)?.alias) || short(x.about)}`, 'eye');
    for (const x of arr(h.clue)) add('clue', x, `улика: ${x.t}${x.seen ? ` (заметил ${short(x.seen)})` : ''}`, 'search');
    for (const x of arr(h.suit)) add('suit', x, `костюм ${short(x.who)}: ${[SUIT_ST[x.st], x.where, x.up && `апгрейд — ${x.up}`].filter(Boolean).join(', ')}`, 'shield');
    for (const x of arr(h.feat)) add('feat', x, `подвиг: ${x.t}`, 'star');
    for (const x of arr(h.pop)) add('pop', x, `${short(x.who)}: популярность ${x.d > 0 ? '+' : ''}${x.d} — ${x.why}`, 'activity');
    for (const x of arr(h.status)) add('status', x, `${short(x.who)} для мира — ${STATUS[x.st]}`, 'flag');
    return rows;
}

// ───────────── модель: рейтинг и фанаты, слухи, мемориалы ─────────────

function storyBits() {
    const ev = A.horaeEvents().slice(-12).map(e => `- ${[e.timestamp?.story_date, e.event?.summary].filter(Boolean).join(': ')}`).join('\n');
    const st = A.worldState();
    return [`Дата: ${st.timestamp?.story_date || '—'}; год ${year() || '—'}; город: ${A.locTop(st.scene?.location || '') || '—'}.`, ev ? `Свежие события:\n${ev}` : ''].filter(Boolean).join('\n');
}

function heroLines() {
    return heroesNow().map(x => {
        const s = statusOf(x.name);
        const p = popOf(x.name);
        return `- ${str(x.h.alias) || short(x.name)} (${x.name}${x.h.secret ? '; кто под маской — публике неизвестно' : ''}): ${STATUS[s.st] || 'на виду'}${s.law ? `, ${s.law}` : ''}; популярность ${p.v}/100; ${featsOf(x.name).slice(-3).map(f => f.public || f.t).join('; ')}`;
    }).join('\n');
}

async function makeFans() {
    const sys = `Ты — социолог и хроникёр фандома в мире ролевой (AU по MCU). Год истории — ${year() || 'не записан'}. Дай: рейтинг популярности героев у публики — наши герои и 4–6 других Мстителей и героев этого года по канону (кто тогда действует, а кто мёртв, в розыске или пропал — честно), очки 0–100, у наших — их текущая популярность; и 5–8 живых примет фандома вокруг наших героев: фан-клубы, мерч, граффити, косплей, фанфики, хештеги, хейтеры и петиции — с конкретикой этого города и года. Ответь только JSON: {"rating":[{"name":"геройское имя","score":80,"note":"почему, 3–8 слов","ours":true}],"fans":[{"kind":"клуб|мерч|граффити|косплей|фанфики|хештег|хейтеры|петиция","about":"геройское имя","t":"что именно, 8–20 слов"}]}`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Наши герои:\n${heroLines()}\n\n${storyBits()}${canonText() ? `\n\nКанон:\n${canonText()}` : ''}` }], 2600, { what: 'Рейтинг и фанаты', check: (x) => arr(x?.rating).length });
    M().fans = {
        year: year(), at: Date.now(),
        rating: arr(j.rating).map(r => ({ name: str(r?.name).slice(0, 40), score: clamp(r?.score), note: str(r?.note).slice(0, 80), ours: r?.ours === true || r?.ours === 'true' })).filter(r => r.name).slice(0, 10),
        fans: arr(j.fans).map(f => ({ kind: str(f?.kind).toLowerCase().slice(0, 20), about: str(f?.about).slice(0, 40), t: str(f?.t).slice(0, 200) })).filter(f => f.t).slice(0, 8),
    };
    A.saveMeta();
}

async function makeRumors() {
    const secret = heroesNow().filter(x => x.h.secret && str(x.h.alias));
    const sys = `Ты — сарафанное радио и жёлтая пресса мира ролевой (AU по MCU). Напиши свежие слухи о героях: что говорят в соцсетях, в барах, в таблоидах. ${secret.length ? `Обязательно — «кто под маской» у ${secret.map(x => str(x.h.alias)).join(', ')}: догадки публики, в основном неверные и смешные; если риск раскрытия высокий — одна догадка опасно близко к правде, но без доказательств.` : ''} Правды публика не знает. 4–6 слухов, каждый 1–2 предложения, с источником. Ответь только JSON: {"rumors":[{"about":"геройское имя","text":"слух","src":"где говорят: таблоид, форум, бариста…","truth":"правда|полуправда|враньё"}]}`;
    const risk = secret.map(x => `${str(x.h.alias)}: риск раскрытия ${riskWord(riskOf(x.name))}; что видели люди: ${cluesOf(x.name).slice(-3).map(c => c.t).join('; ') || '—'}`).join('\n');
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Герои:\n${heroLines()}\n${risk ? `\nТайны:\n${risk}\n` : ''}\n${storyBits()}\n\nУже ходили (не повторяй):\n${M().rumors.slice(-6).map(r => `- ${r.text}`).join('\n') || '—'}` }], 2200, { what: 'Слухи', check: (x) => arr(x?.rumors).length });
    const list = arr(j.rumors).map(r => ({ id: A.uid(), about: str(r?.about).slice(0, 40), text: str(r?.text).slice(0, 260), src: str(r?.src).slice(0, 60), truth: str(r?.truth).slice(0, 12), at: Date.now(), year: year() })).filter(r => r.text);
    M().rumors = [...M().rumors, ...list].slice(-24);
    A.saveMeta();
}

async function makeMemorials() {
    const dead = heroesNow().filter(x => statusOf(x.name).st === 'dead');
    if (!dead.length) throw new Error('сейчас для мира никто не погиб — мемориалов нет');
    const sys = `Ты пишешь, как город помнит погибших героев в мире ролевой (AU по MCU). Год — ${year() || '—'}. Для тех, кого мир считает погибшими, — 3–4 живых мемориала: мурал на стене, стихийный мемориал со свечами и цветами, бдение, памятная доска, граффити, фан-трибьют. Конкретно: где (улица, район, место подвига), что изображено или написано (на русском или английском, как было бы в этом городе), кто приходит, что оставляют. Можно рядом с другими погибшими героями этого времени по канону — их рисуют вместе. Драма, без пошлости и без пафоса ради пафоса. Ответь только JSON: {"memorials":[{"kind":"мурал|свечи|бдение|доска|граффити|трибьют","where":"где, 2–6 слов","t":"что там и как, 25–50 слов","who":["геройские имена тех, кого изображают"],"en":"English, 30-50 words: visual description of this memorial for an illustration — no real faces, the heroes shown in their suits or symbols"}]}`;
    const looks = dead.map(x => `${str(x.h.alias) || short(x.name)}: костюм — ${str(x.h.suitLook) || 'не описан'}; ${featsOf(x.name).slice(-3).map(f => f.public || f.t).join('; ')}`).join('\n');
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Погибшие для мира:\n${looks}\n\n${storyBits()}${canonText() ? `\n\nКанон:\n${canonText()}` : ''}` }], 2600, { what: 'Мемориалы', check: (x) => arr(x?.memorials).length });
    const list = arr(j.memorials).map(m => ({ id: A.uid(), kind: str(m?.kind).slice(0, 20), where: str(m?.where).slice(0, 80), t: str(m?.t).slice(0, 400), who: arr(m?.who).map(x => str(x).slice(0, 40)).filter(Boolean).slice(0, 4), en: str(m?.en).slice(0, 500), img: '', year: year(), at: Date.now() })).filter(m => m.t);
    M().memorials = [...M().memorials.filter(m => m.img), ...list].slice(-12);
    A.saveMeta();
}

async function drawMemorial(m) {
    const refs = [];
    for (const x of heroesNow()) {
        const alias = str(x.h.alias);
        if (x.h.suitImg && m.who.some(w => A.norm(w) === A.norm(alias))) { try { refs.push(await A.refData(x.h.suitImg)); } catch { /* */ } }
    }
    m.img = await A.drawPicture(`${m.en || m.t}\nA real street memorial photographed at ${/свеч|бден|vigil|candle/i.test(`${m.kind} ${m.t}`) ? 'dusk, candlelight' : 'daytime, overcast'}, documentary realism.${refs.length ? ' The reference images show the heroes\' suits — paint them exactly like that.' : ''} No readable faces of real people, no text except what the memorial itself says. No nudity.`, { aspect: '4:3', refs, prefix: 'life_memorial', max: 1600 });
    A.saveMeta();
}

async function drawSuit(name) {
    const h = heroOf(name);
    if (!h?.suitLook) throw new Error('сначала опиши костюм');
    let refs = [];
    try { const r = await A.faceRef(name); if (r) refs = [r]; } catch { /* */ }
    h.suitImg = await A.drawPicture(`Full-body character sheet of ${short(name)} in the superhero suit${h.alias ? ` of «${h.alias}»` : ''}: ${h.suitLook}. Standing pose, front view, plain dark studio background, even light, the whole suit visible from head to boots.${refs.length ? ` Reference image: ${short(name)}'s face — keep it recognisable if the suit leaves the face visible.` : ''} No text, no logos of real brands. No nudity.`, { aspect: '3:4', refs, prefix: 'life_suit', max: 1400, who: [name] });
    A.saveSettings();
}

// ───────────── страница: Мир → Герои ─────────────

const ring = (v) => `<span class="lf-hr-ring" style="--v:${v}"><b>${v}</b></span>`;

function heroCard(x) {
    const n = esc(x.name);
    const alias = str(x.h.alias);
    const s = statusOf(x.name);
    const p = popOf(x.name);
    const su = suitOf(x.name);
    const kn = knowsOf(x.name);
    const cl = cluesOf(x.name).slice(-4).reverse();
    const r = x.h.secret ? riskOf(x.name) : 0;
    const feats = featsOf(x.name).slice(-6).reverse();
    const open = M().open === x.name;
    return `<section class="lf-hr st-${s.st || 'none'}${open ? ' open' : ''}">
        <div class="lf-hr-top" data-act="hr-open" data-name="${n}">
            <span class="lf-hr-suit"${su.img ? ` style="background-image:url('${esc(su.img)}')"` : ''}>${su.img ? '' : A.icon('shield')}${A.ava(x.name, 'xs')}</span>
            <span class="lf-hr-t"><small>${esc(short(x.name))}${x.h.secret ? ` · ${A.icon('lock')} тайна` : ''}</small><b>${esc(alias || short(x.name))}</b>
                <span class="lf-hr-badges">${s.st ? `<i class="lf-hr-st st-${s.st}">${esc(STATUS[s.st])}${s.src !== 'era' ? ' ·' : ''}</i>` : ''}${s.law ? `<em>${esc(s.law)}</em>` : ''}</span></span>
            <span class="lf-hr-popc">${ring(p.v)}<small>${p.trend > 0 ? `▲${p.trend}` : p.trend < 0 ? `▼${-p.trend}` : 'слава'}</small></span>
        </div>
        ${open ? `<div class="lf-hr-body">
            ${x.h.secret ? `<div class="lf-hr-sec"><h4>${A.icon('lock')} Кто под маской</h4>
                <div class="lf-hr-risk"><i style="--v:${r}"></i><span>риск раскрытия — ${riskWord(r)}</span></div>
                <div class="lf-chips wrap">${kn.map(k => `<button class="lf-chip on" data-act="hr-know-del" data-name="${n}" data-who="${esc(k)}" title="не знает">${A.ava(k, 'xs')} ${esc(short(k))} ${A.icon('x')}</button>`).join('') || '<span class="lf-dim">Не знает никто.</span>'}</div>
                <div class="lf-inline"><input type="text" class="lf-hr-in" data-k="know" placeholder="кто ещё знает — имя"><button class="lf-btn" data-act="hr-know-add" data-name="${n}">${A.icon('plus')}</button></div>
                ${cl.length ? `<div class="lf-hr-clues">${cl.map(c => `<span>${A.icon('search')}${esc(c.t)}${c.seen ? `<small>заметил ${esc(short(c.seen))} · #${c.mes}</small>` : `<small>#${c.mes}</small>`}</span>`).join('')}</div>` : '<div class="lf-hint">Улики — что выдало (шрам, голос, походка, сила) и кто заметил — Летописец отмечает по постам.</div>'}
            </div>` : ''}
            <div class="lf-hr-sec"><h4>${A.icon('shield')} Костюм</h4>
                <textarea rows="2" data-in="hr-look" data-name="${n}" placeholder="как выглядит — для кадров">${esc(su.look)}</textarea>
                <div class="lf-chips wrap">${Object.entries(SUIT_ST).map(([k, t]) => `<button class="lf-chip${su.st === k ? ' on' : ''}" data-act="hr-suit" data-name="${n}" data-st="${k}">${t}</button>`).join('')}</div>
                <input type="text" data-in="hr-where" data-name="${n}" value="${esc(su.where)}" placeholder="где лежит">
                ${su.up.length ? `<div class="lf-hr-clues">${su.up.map(u => `<span>${A.icon('zap')}${esc(u.t)}${u.hand ? '' : `<small>#${u.mes}</small>`}</span>`).join('')}</div>` : ''}
                <div class="lf-inline"><input type="text" class="lf-hr-in" data-k="up" placeholder="апгрейд — что добавили"><button class="lf-btn" data-act="hr-up-add" data-name="${n}">${A.icon('plus')}</button></div>
                <div class="lf-actions tight"><button class="lf-btn" data-act="hr-suit-draw" data-name="${n}">${A.icon('wand')} ${su.img ? 'Перерисовать костюм' : 'Нарисовать костюм'}</button>${su.img ? `<button class="lf-btn ghost" data-act="lightbox" data-src="${esc(su.img)}">${A.icon('image')}</button>` : ''}</div>
                <div class="lf-hint">Картинка костюма идёт рефом во все кадры, где ${esc(short(x.name))} в костюме.</div>
            </div>
            <div class="lf-hr-sec"><h4>${A.icon('activity')} Слава</h4>
                <div class="lf-inline lf-hr-popctl"><button class="lf-btn" data-act="hr-pop" data-name="${n}" data-d="-5">−5</button><span>${p.v}/100</span><button class="lf-btn" data-act="hr-pop" data-name="${n}" data-d="5">+5</button></div>
                ${p.log.length ? `<div class="lf-hr-clues">${p.log.map(l => `<span class="${l.d > 0 ? 'up' : 'dn'}">${l.d > 0 ? '▲' : '▼'}${Math.abs(l.d)} ${esc(l.why)}<small>#${l.mes}</small></span>`).join('')}</div>` : '<div class="lf-hint">Растёт и падает от того, что герои делают на виду, — Летописец отмечает по постам.</div>'}
            </div>
            <div class="lf-hr-sec"><h4>${A.icon('flag')} Для мира</h4>
                <div class="lf-chips wrap"><button class="lf-chip${s.src !== 'hand' ? ' on' : ''}" data-act="hr-status" data-name="${n}" data-st="">по годам</button>${Object.entries(STATUS).map(([k, t]) => `<button class="lf-chip${s.src === 'hand' && s.st === k ? ' on' : ''}" data-act="hr-status" data-name="${n}" data-st="${k}">${t}</button>`).join('')}</div>
                ${s.why ? `<div class="lf-hint">${esc(s.why)}${s.src === 'ai' ? ` — по посту #${s.mes}` : ''}</div>` : ''}
            </div>
            ${feats.length ? `<div class="lf-hr-sec"><h4>${A.icon('star')} Подвиги глазами людей</h4><div class="lf-hr-feats">${feats.map(f => `<div class="lf-hr-feat"><b>${esc(f.year || '')}</b><span>${esc(f.t)}${f.public ? `<q>${esc(f.public)}</q>` : ''}</span></div>`).join('')}</div></div>` : ''}
        </div>` : ''}
    </section>`;
}

export function heroesHtml() {
    if (!A?.hasChat?.()) return '';
    const hs = heroesNow();
    const y = year();
    const m = M();
    const dead = hs.filter(x => statusOf(x.name).st === 'dead');
    const fans = m.fans && (!y || m.fans.year === y) ? m.fans : null;
    const rum = m.rumors.slice().reverse().slice(0, 8);
    const truthCls = (t) => (/^правд/i.test(t) ? 'yes' : /вран|лож/i.test(t) ? 'no' : 'half');
    if (!hs.length) {
        return `<div class="lf-empty small">${A.icon('shield', 'xl')}Героев пока нет: у кого геройское имя, костюм и тайна — собирается из лора (карточки, лорбуки, канон).</div>
        <div class="lf-actions"><button class="lf-btn primary" data-act="hr-collect">${A.icon('book')} Собрать из лора</button><button class="lf-btn" data-act="hero-fame">${A.icon('users')} Кого как узнают</button></div>`;
    }
    return `${A.sec('Герои', y ? `${y} год` : 'год не записан')}
    <div class="lf-hr-list">${hs.map(heroCard).join('')}</div>
    <div class="lf-actions tight"><button class="lf-btn" data-act="hero-fame">${A.icon('users')} Кого как узнают — по годам</button><button class="lf-btn ghost" data-act="hr-collect">${A.icon('book')} Собрать из лора</button></div>

    ${A.sec('Рейтинг и фанаты', fans ? `${fans.year || ''}` : '')}
    ${fans ? `<div class="lf-hr-rate">${fans.rating.map((r, k) => `<div class="lf-hr-rr${r.ours ? ' ours' : ''}"><b>${k + 1}</b><span>${esc(r.name)}<small>${esc(r.note)}</small></span><i style="--v:${r.score}"></i><em>${r.score}</em></div>`).join('')}</div>
        <div class="lf-hr-fans">${fans.fans.map(f => `<div class="lf-hr-fan">${A.icon(FAN_IC[f.kind] || 'heart')}<span><small>${esc(f.kind)}${f.about ? ` · ${esc(f.about)}` : ''}</small>${esc(f.t)}</span></div>`).join('')}</div>` : '<div class="lf-hint">Кто популярнее среди Мстителей этого года, фан-клубы, мерч, граффити, косплей, хейтеры — по канону и тому, что было в истории.</div>'}
    <div class="lf-actions tight"><button class="lf-btn" data-act="hr-fans">${A.icon('refresh')} ${fans ? 'Обновить' : 'Что творится в фандоме'}</button></div>

    ${A.sec('Слухи', 'кто под маской и не только')}
    ${rum.length ? rum.map(r => `<div class="lf-rumor"><q>${esc(r.text)}</q>
        <div class="lf-rumor-f"><small>${A.icon('ear')} ${esc(r.src || 'говорят')}${r.about ? ` · ${esc(r.about)}` : ''}</small>
        <button class="lf-truth ${truthCls(r.truth)}">${esc(r.truth || '?')}</button>
        <button class="lf-iconbtn sm${m.rumorPush?.id === r.id ? ' on' : ''}" data-act="hr-rumor-push" data-id="${esc(r.id)}" title="Пустить в историю">${A.icon('message')}</button>
        <button class="lf-iconbtn sm" data-act="hr-rumor-del" data-id="${esc(r.id)}" title="Выбросить">${A.icon('x')}</button></div></div>`).join('') : '<div class="lf-hint">Что говорят о героях в соцсетях, барах и таблоидах — и кто, по мнению публики, под маской.</div>'}
    <div class="lf-actions tight"><button class="lf-btn" data-act="hr-rumors">${A.icon('ear')} Свежие слухи</button></div>

    ${dead.length || m.memorials.length ? `${A.sec('Мемориалы', dead.length ? dead.map(x => esc(str(x.h.alias) || short(x.name))).join(', ') : '')}
    ${m.memorials.slice().reverse().map(mm => `<article class="lf-hr-mem">
        ${mm.img ? `<button class="lf-hr-mem-img" data-act="lightbox" data-src="${esc(mm.img)}" style="background-image:url('${esc(mm.img)}')"></button>` : `<button class="lf-hr-mem-img empty${busy.has(mm.id) ? ' wait' : ''}" data-act="hr-mem-draw" data-id="${esc(mm.id)}">${busy.has(mm.id) ? '<i class="lf-det-sh"></i>' : A.icon('camera')}<small>${busy.has(mm.id) ? 'рисую…' : 'нарисовать'}</small></button>`}
        <div class="lf-hr-mem-t"><small>${esc(mm.kind)} · ${esc(mm.where)}</small><p>${esc(mm.t)}</p>
            <div class="lf-actions tight"><button class="lf-btn${m.memPush?.id === mm.id ? ' primary' : ''}" data-act="hr-mem-push" data-id="${esc(mm.id)}">${A.icon('eye')} ${m.memPush?.id === mm.id ? 'В следующем ответе' : 'Пусть увидит'}</button><button class="lf-iconbtn" data-act="hr-mem-del" data-id="${esc(mm.id)}">${A.icon('trash')}</button></div></div>
    </article>`).join('')}
    ${dead.length ? `<div class="lf-actions tight"><button class="lf-btn" data-act="hr-mem">${A.icon('flame')} ${m.memorials.length ? 'Ещё мемориалы' : 'Как город помнит'}</button></div>
    <div class="lf-hint">«Пусть увидит» — в следующем ответе мемориал окажется рядом или по пути: люди, свечи, мурал. Что чувствует героиня — пишешь ты.</div>` : ''}` : ''}`;
}

export function heroesInput(el) {
    const k = el.dataset.in;
    if (k !== 'hr-look' && k !== 'hr-where') return false;
    const name = el.dataset.name;
    if (k === 'hr-look') {
        const h = heroOf(name);
        if (!h) return true;
        h.suitLook = str(el.value).slice(0, 400);
        h.suitHand = true;
        A.saveSettings();
        return true;
    }
    const m = M();
    const key = kOf(m.suit, name) || A.canonName(name);
    const cur = suitOf(name);
    m.suit[key] = { ...(m.suit[key] || {}), st: cur.st, where: str(el.value).slice(0, 60), note: cur.note, mes: A.chatArr().length - 1, up: arr(m.suit[key]?.up) };
    ver++;
    A.saveMeta();
    A.updatePrompt?.();
    return true;
}

export async function heroesClick(act, el) {
    if (!act.startsWith('hr-')) return false;
    const name = el.dataset.name ? A.canonName(el.dataset.name) : '';
    const m = M();
    const box = el.closest('.lf-hr') || el.closest('.lf-sheet') || document;
    const typed = (k) => str(box.querySelector?.(`.lf-hr-in[data-k="${k}"]`)?.value);
    const run = async (key, fn, done) => {
        if (busy.has(key)) return;
        busy.add(key);
        A.render();
        try { await fn(); if (done) A.toast('success', done, '✦ Герои', { timeOut: 2000 }); }
        catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Герои', { timeOut: 5000 }); }
        finally { busy.delete(key); A.render(); }
    };
    switch (act) {
        case 'hr-open': m.open = m.open === name ? '' : name; A.saveMeta(); A.render(); return true;
        case 'hr-collect': await A.withBusy(el, async () => { const n = await fameCollect({ force: false }); A.toast('success', n ? `Собрала из лора: ${n}` : 'Всё правлено руками — не трогала', '✦ Герои', { timeOut: 2200 }); A.render(); }, 'Читаю лор…'); return true;
        case 'hr-know-add': {
            const who = A.canonName(typed('know'));
            if (!who) return true;
            const k = kOf(m.knowsAdd, name) || name;
            m.knowsAdd[k] = [...arr(m.knowsAdd[k]).filter(x => !A.sameName(x, who)), who];
            const d = kOf(m.knowsDel, name);
            if (d) m.knowsDel[d] = arr(m.knowsDel[d]).filter(x => !A.sameName(x, who));
            ver++; A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
        case 'hr-know-del': {
            const who = A.canonName(el.dataset.who);
            const k = kOf(m.knowsDel, name) || name;
            m.knowsDel[k] = [...arr(m.knowsDel[k]).filter(x => !A.sameName(x, who)), who];
            const a = kOf(m.knowsAdd, name);
            if (a) m.knowsAdd[a] = arr(m.knowsAdd[a]).filter(x => !A.sameName(x, who));
            ver++; A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
        case 'hr-suit': {
            const key = kOf(m.suit, name) || name;
            const cur = suitOf(name);
            m.suit[key] = { ...(m.suit[key] || {}), st: el.dataset.st, where: cur.where, note: '', mes: A.chatArr().length - 1, up: arr(m.suit[key]?.up) };
            ver++; A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
        case 'hr-up-add': {
            const t = typed('up');
            if (!t) return true;
            const key = kOf(m.suit, name) || name;
            const cur = suitOf(name);
            m.suit[key] = { ...(m.suit[key] || { st: cur.st, where: cur.where, mes: -1 }), up: [...arr(m.suit[key]?.up), t.slice(0, 80)] };
            ver++; A.saveMeta(); A.render();
            return true;
        }
        case 'hr-suit-draw': await run(`suit:${name}`, () => drawSuit(name), 'Костюм нарисован — теперь он рефом в кадрах'); return true;
        case 'hr-pop': {
            const k = kOf(m.popHand, name) || name;
            m.popHand[k] = clamp((Number(m.popHand[k]) || 0) + (Number(el.dataset.d) || 0), -100, 100);
            A.saveMeta(); A.render();
            return true;
        }
        case 'hr-status': {
            const k = kOf(m.statusHand, name) || name;
            if (!el.dataset.st) delete m.statusHand[k];
            else m.statusHand[k] = { st: el.dataset.st, why: 'отмечено руками', mes: A.chatArr().length - 1 };
            ver++; A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
        case 'hr-fans': await run('fans', makeFans); return true;
        case 'hr-rumors': await run('rumors', makeRumors); return true;
        case 'hr-rumor-del': m.rumors = m.rumors.filter(r => r.id !== el.dataset.id); if (m.rumorPush?.id === el.dataset.id) m.rumorPush = null; A.saveMeta(); A.render(); return true;
        case 'hr-rumor-push': {
            const r = m.rumors.find(x => x.id === el.dataset.id);
            if (!r) return true;
            if (m.rumorPush?.id === r.id) { m.rumorPush = null; A.toast('info', 'Модель больше не слышит этот слух', '✦ Герои', { timeOut: 1600 }); }
            else { m.rumorPush = { id: r.id, at: A.lastAiIndex?.() ?? A.chatArr().length - 1, text: r.text }; A.toast('info', 'Модель узнает в следующем ответе, что это сейчас говорят', '✦ Герои', { timeOut: 2200 }); }
            A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
        case 'hr-mem': await run('mem', makeMemorials); return true;
        case 'hr-mem-del': m.memorials = m.memorials.filter(x => x.id !== el.dataset.id); if (m.memPush?.id === el.dataset.id) m.memPush = null; A.saveMeta(); A.render(); return true;
        case 'hr-mem-draw': {
            const mm = m.memorials.find(x => x.id === el.dataset.id);
            if (mm) await run(mm.id, () => drawMemorial(mm));
            return true;
        }
        case 'hr-mem-push': {
            const mm = m.memorials.find(x => x.id === el.dataset.id);
            if (!mm) return true;
            if (m.memPush?.id === mm.id) m.memPush = null;
            else {
                m.memPush = { id: mm.id, at: A.lastAiIndex?.() ?? A.chatArr().length - 1, text: `${mm.kind} — ${mm.where}: ${mm.t}` };
                A.toast('info', 'В следующем ответе мемориал окажется рядом или по пути', '✦ Герои', { timeOut: 2600 });
            }
            A.saveMeta(); A.updatePrompt?.(); A.render();
            return true;
        }
    }
    return false;
}
