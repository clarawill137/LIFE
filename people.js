// Люди: постоянные NPC — микро-карточки с фото, характером, манерой, отношением к героям.
// Собираются из лорбука (дешёвая модель вытаскивает людей из записей), руками или из Horae.
// Летописец дописывает, что о них стало известно в истории, и замечает новые лица.
// Когда NPC в сцене или его упомянули — модель получает короткую справку, чтобы он звучал как он.

import { crossSame } from './names.js';
import { icon } from './icons.js';
import { agendaPeopleHtml, agendaNpcHtml } from './agenda.js';

let A = null;
export function initPeople(api) { A = api; }

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

export const STATUS = [
    ['active', 'В строю', 'sun'], ['away', 'Далеко', 'route'], ['hurt', 'Ранен(а)', 'activity'], ['missing', 'Пропал(а)', 'search'], ['dead', 'Погиб(ла)', 'moon'],
];
const statusOf = (id) => STATUS.find(s => s[0] === id) || STATUS[0];

// ───────────── данные ─────────────

function P() {
    const s = A.settings();
    if (!s.people || typeof s.people !== 'object') s.people = {};
    const p = s.people;
    if (!Array.isArray(p.list)) p.list = [];
    if (p.inject === undefined) p.inject = true;
    if (p.auto === undefined) p.auto = true;
    return p;
}

function CM() {
    const m = A.chatMeta();
    if (!m.people || typeof m.people !== 'object' || Array.isArray(m.people)) m.people = {};
    const x = m.people;
    for (const k of ['facts', 'status']) if (!x[k] || typeof x[k] !== 'object') x[k] = {};
    if (!Array.isArray(x.fresh)) x.fresh = [];
    return x;
}

export function peopleList() { return P().list; }
/** id карточки и тех, что в неё склеены (факты в других чатах лежат под старыми id). */
function idsOf(x) { const mg = P().merged || {}; return [x.id, ...Object.keys(mg).filter(k => mg[k] === x.id)]; }
const factsOf = (cm, x) => idsOf(x).flatMap(id => cm.facts[id] || []);
const statusFor = (cm, x) => idsOf(x).map(id => cm.status[id]).find(Boolean);
export function personById(id) { return P().list.find(x => x.id === id) || null; }

const keysOf = (x) => [x.name, ...(x.aliases || [])].map(A.norm).filter(k => k.length >= 3);
export function findPerson(name) {
    const n = A.norm(A.canonName(name) || name);
    if (!n) return null;
    const first = n.split(' ')[0];
    const list = P().list;
    return list.find(x => keysOf(x).includes(n))
        || list.find(x => keysOf(x).some(k => k.split(' ')[0] === first && first.length >= 3))
        // то же имя другим алфавитом: «Helmut» — это «Гельмут»
        || list.find(x => [x.name, ...(x.aliases || [])].some(k => crossSame(k, name)))
        || null;
}

/**
 * Склеить карточки одного человека на двух алфавитах («Гельмут» и «Helmut», «Пеппер» и «Pepper»):
 * остаётся старшая, у неё — второе имя в «ещё зовут», пустые поля, фото, факты и статус этого чата.
 */
export function peopleDedupe() {
    const p = P();
    const list = p.list;
    if (!p.merged || typeof p.merged !== 'object') p.merged = {};
    const cm = CM();
    let n = 0;
    for (let a = 0; a < list.length; a++) {
        const x = list[a];
        for (let b = list.length - 1; b > a; b--) {
            const y = list[b];
            const hit = [x.name, ...(x.aliases || [])].some(k => [y.name, ...(y.aliases || [])].some(q => crossSame(k, q)));
            if (!hit) continue;
            x.aliases = [...new Set([...(x.aliases || []), y.name, ...(y.aliases || [])])].filter(v => A.norm(v) !== A.norm(x.name));
            for (const [k, v] of Object.entries(y)) if (!['id', 'name', 'aliases', 'at'].includes(k) && v && (!x[k] || (Array.isArray(x[k]) && !x[k].length))) x[k] = v;
            if (cm.facts[y.id]) { cm.facts[x.id] = [...(cm.facts[x.id] || []), ...cm.facts[y.id]]; delete cm.facts[y.id]; }
            if (cm.status[y.id] && !cm.status[x.id]) cm.status[x.id] = cm.status[y.id];
            delete cm.status[y.id];
            p.merged[y.id] = x.id;
            list.splice(b, 1);
            n++;
        }
    }
    if (n) { A.saveSettings(); A.saveMeta(); }
    return n;
}

/** Главные герои — участники группы и персона игрока (не все, кто мелькнул в сцене). */
function castHas(name) { return [A.ctx().name1, ...A.groupMembers()].some(n => A.sameName(n, name)); }

/** Фото NPC для аватарок в хабе. */
export function npcImg(name) {
    if (!A || !P().list.length) return '';
    const x = findPerson(name);
    return x?.img || '';
}

// ───────────── кто сейчас рядом или упомянут ─────────────

// падежные окончания имени: «Пак» → Пака, Паку, Паком — но не «паковалась» и «пакет»; «Карла» → Карлы, Карле — но не «Карлтон»
const ENDS = '(?:а|я|у|ю|е|и|ы|о|ой|ей|ою|ею|ом|ем|ам|ям|ах|ях|ами|ями|ов|ев|ую|юю|ь|й)?';
function stemRe(word) {
    const w = A.norm(word);
    if (w.length < 3) return null;
    const stem = w.length >= 4 && /[аяеиоуыьй]$/.test(w) ? w.slice(0, -1) : w;
    return new RegExp(`(^|[^a-zа-яё])${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${ENDS}(?![a-zа-яё])`, 'i');
}
function mentions(x, text) {
    if (!text) return false;
    const t = A.norm(text);
    return [x.name, ...(x.aliases || [])].some(k => {
        const words = String(k).split(/\s+/).filter(w => w.length >= 3);
        // фамилия или имя — как отдельное слово; «Джек Томпсон III» ловится и по «Томпсон»
        return words.some(w => { const re = stemRe(w); return re && !/^(доктор|док|профессор|барон|баронесса|мистер|миссис|мисс|агент|капитан|медсестра|медбрат|сестра|офицер|сержант|лейтенант|майор|полковник|генерал|детектив|судья|сэр|леди|лорд|фрау|герр|мадам|месье|синьор|отец|мать|дядя|тётя|тетя)$/i.test(w) && re.test(t); });
    });
}

function nearby() {
    const st = A.worldState();
    const here = st.scene?.characters_present || [];
    const chat = A.chatArr();
    const tail = chat.slice(-2).map(m => String(m?.mes || '')).join('\n');
    const out = [];
    for (const x of P().list) {
        if (castHas(x.name)) continue;
        const inScene = here.some(h => keysOf(x).includes(A.norm(h)) || keysOf(x).some(k => k.split(' ')[0] === A.norm(h).split(' ')[0]));
        if (inScene) out.push({ x, how: 'scene' });
        else if (mentions(x, tail)) out.push({ x, how: 'mention' });
    }
    return out.sort((a, b) => (a.how === 'scene' ? 0 : 1) - (b.how === 'scene' ? 0 : 1));
}

export function nearbyIds() { try { return new Set(nearby().map(n => n.x.id)); } catch { return new Set(); } }

// ───────────── модели ─────────────

export function peoplePrompt(type) {
    if (type === 'quiet' || type === 'impersonate' || !P().inject || !P().list.length) return '';
    const cm = CM();
    const lines = nearby().filter(n => n.x.inject !== false).slice(0, 3).map(({ x }) => {
        const st = statusFor(cm, x)?.v || x.status;
        const tag = [x.group, x.role].filter(Boolean).join(', ');
        const facts = factsOf(cm, x).slice(-2).map(f => f.t).join('; ');
        const dead = st === 'dead' ? ' — погиб(ла); если всплывёт, то только в памяти и разговорах' : st === 'missing' ? ' — пропал(а)' : st === 'away' ? ' — сейчас далеко' : '';
        return `${x.name}${tag ? ` (${tag})` : ''}${dead}: ${A.cut(x.brief || x.bio || x.traits?.join(', ') || '', 240)}${x.voice ? ` Манера: ${A.cut(x.voice, 120).replace(/[.!?…]?$/, '.')}` : ''}${facts ? ` Недавно в истории: ${facts}.` : ''}`;
    });
    return lines.length ? `[Кто есть кто — держи этих людей узнаваемыми, в их характере и манере, не пересказывай справку: ${lines.join(' | ')}]` : '';
}

// ───────────── Летописец ─────────────

export function peopleChronOpts() {
    const p = P();
    if (!p.list.length && !p.auto) return null;
    const names = p.list.filter(x => !castHas(x.name)).map(x => x.name).slice(0, 50);
    return { line: names.join(', '), auto: p.auto, tokens: 140 };
}

export function peopleAfterPost(i, res) {
    const list = res.people || [];
    if (!list.length) return;
    const cm = CM();
    const p = P();
    for (const r of list) {
        const x = findPerson(r.name);
        if (x) {
            if (r.fact) {
                const arr2 = cm.facts[x.id] || (cm.facts[x.id] = []);
                if (!arr2.some(f => A.norm(f.t) === A.norm(r.fact))) arr2.push({ t: r.fact, mes: i });
                if (arr2.length > 30) arr2.splice(0, arr2.length - 30);
            }
            if (r.status && STATUS.some(s => s[0] === r.status)) cm.status[x.id] = { v: r.status, mes: i };
            continue;
        }
        if (!r.new || !p.auto || castHas(r.name) || A.sameName(r.name, userName())) continue;
        if (cm.fresh.some(f => A.sameName(f.name, r.name))) continue;
        cm.fresh.push({ name: r.name, who: r.who || '', mes: i });
        if (cm.fresh.length > 8) cm.fresh.shift();
    }
}

// ───────────── лорбук ─────────────

const LORE_SYSTEM = `Ты собираешь картотеку людей ролевой истории на русском из записей лорбука.
Вытащи ЛЮДЕЙ и персонажей с характером (в том числе ИИ и роботов), не организации, не места и не события. Главных героев (они перечислены) пропусти.
Ответь только JSON: {"people":[{"name":"основное имя","aliases":["другие имена, фамилия, прозвища"],"group":"команда или круг: А.И.М., Мстители, Красная комната, семья…","role":"роль, 2–6 слов","age":"возраст, если есть","look":"внешность, 1 предложение","traits":["3–6 черт, по 1–3 слова"],"voice":"манера речи и повадки, 1 предложение","bio":"кто это и откуда, 2–3 предложения","toUser":"как относится к игроку, 1 предложение или пусто","secret":"главный секрет, если есть, 1 предложение","brief":"справка для модели до 220 знаков: кто он, характер, как себя ведёт"}]}
Коротко и своими словами. Не выдумывай того, чего нет в записях.`;

async function worldNames() {
    try {
        const m = await import('/scripts/world-info.js');
        if (Array.isArray(m.world_names) && m.world_names.length) return [...m.world_names];
    } catch { /* */ }
    return [];
}

async function loadBook(name) {
    const c = A.ctx();
    if (typeof c.loadWorldInfo === 'function') return await c.loadWorldInfo(name);
    const m = await import('/scripts/world-info.js');
    return await m.loadWorldInfo(name);
}

function activeBooks() {
    const c = A.ctx();
    const out = new Set();
    const cw = c.chatMetadata?.world_info;
    if (cw) out.add(cw);
    for (const n of A.castNames()) { const w = A.cardOf(n)?.data?.extensions?.world; if (w) out.add(w); }   // по карточке на человека — из этого чата
    return out;
}

async function importBook(book) {
    const data = await loadBook(book);
    const entries = Object.values(data?.entries || {}).filter(e => !e.disable && str(e.content));
    if (!entries.length) throw new Error('в лорбуке нет записей');
    const chunks = [];
    let cur = '';
    for (const e of entries) {
        const piece = `### ${str(e.comment) || str(e.name) || (e.key || []).join(', ')}\n${str(e.content)}\n\n`;
        if (cur.length + piece.length > 14000 && cur) { chunks.push(cur); cur = ''; }
        cur += piece.slice(0, 14000);
    }
    if (cur) chunks.push(cur);
    let added = 0, updated = 0;
    for (const [k, text] of chunks.entries()) {
        if (chunks.length > 1) A.toast('info', `Читаю часть ${k + 1} из ${chunks.length}…`, '✦ Люди', { timeOut: 2000 });
        const out = await A.askModel([{ role: 'system', content: LORE_SYSTEM }, {
            role: 'user', content: `Главные герои (пропусти): ${[A.ctx().name1, ...A.groupMembers()].join(', ')}. Игрок пишет за: ${userName()}.\nЛорбук «${book}»:\n\n${text}`,
        }], 3500);
        const j = A.extractJson(out);
        for (const r of arr(j?.people)) {
            const res = mergePerson(r, `lore:${book}`);
            if (res === 'add') added++; else if (res === 'upd') updated++;
        }
    }
    A.saveSettings();
    return { added, updated };
}

function cleanRec(r) {
    return {
        name: str(r.name).slice(0, 60), aliases: arr(r.aliases).map(str).filter(Boolean).slice(0, 8), group: str(r.group).slice(0, 40), role: str(r.role).slice(0, 80),
        age: str(String(r.age ?? '')).slice(0, 20), look: str(r.look).slice(0, 400), traits: arr(r.traits).map(str).filter(Boolean).slice(0, 8), voice: str(r.voice).slice(0, 300),
        bio: str(r.bio).slice(0, 700), toUser: str(r.toUser).slice(0, 300), secret: str(r.secret).slice(0, 400), brief: str(r.brief).slice(0, 320),
    };
}

/** Добавить или дополнить: правки руками не перетираются, пустые поля заполняются. */
function mergePerson(raw, src) {
    const r = cleanRec(raw);
    if (!r.name || castHas(r.name) || A.sameName(r.name, userName())) return '';
    const p = P();
    const x = findPerson(r.name) || r.aliases.map(findPerson).find(Boolean);
    if (x) {
        let ch = false;
        for (const [k, v] of Object.entries(r)) {
            if (k === 'name') continue;
            if (Array.isArray(v)) { const u = [...new Set([...(x[k] || []), ...v])]; if (u.length !== (x[k] || []).length) { x[k] = u.slice(0, 10); ch = true; } }
            else if (v && !x[k]) { x[k] = v; ch = true; }
        }
        return ch ? 'upd' : '';
    }
    p.list.push({ id: A.uid(), ...r, img: '', status: 'active', inject: true, src, at: Date.now() });
    return 'add';
}

// ───────────── вкладка «Люди» ─────────────

function cardHtml(x, near) {
    const st = statusOf(statusFor(CM(), x)?.v || x.status);
    const letter = esc(String(x.name || '?').trim().charAt(0).toUpperCase());
    return `<button class="lf-npc${near ? ' near' : ''}${st[0] === 'dead' ? ' dead' : ''}" data-act="pp-open" data-id="${esc(x.id)}">
        <span class="lf-npc-img${x.img ? ' lf-fit' : ''}"${x.img ? A.fitAttr(x.img) : ''}>${x.img ? '<i class="lf-fit-i"></i>' : `<i class="lf-npc-l">${letter}</i>`}</span>
        ${near ? `<span class="lf-npc-near">${icon('eye')} рядом</span>` : st[0] !== 'active' ? `<span class="lf-npc-st">${icon(st[2])} ${st[1]}</span>` : ''}
        <span class="lf-npc-t"><b>${esc(x.name)}</b><small>${esc(x.role || x.group || '')}</small></span>
    </button>`;
}

export function renderPeople() {
    const ui = A.ui;
    if (ui.npc) {
        const x = personById(ui.npc);
        if (x) return renderNpc(x);
        ui.npc = '';
    }
    const p = P();
    const cm = CM();
    const near = nearbyIds();
    const groups = [...new Set(p.list.map(x => x.group).filter(Boolean))];
    if (ui.pGroup && !groups.includes(ui.pGroup) && ui.pGroup !== '—') ui.pGroup = '';
    const shown = p.list.filter(x => !ui.pGroup || (ui.pGroup === '—' ? !x.group : x.group === ui.pGroup))
        .sort((a, b) => (near.has(b.id) ? 1 : 0) - (near.has(a.id) ? 1 : 0) || (a.group || 'я').localeCompare(b.group || 'я') || a.name.localeCompare(b.name));
    const horae = Object.keys(A.worldState().npcs || {}).filter(n => !findPerson(n) && !castHas(n) && !cm.fresh.some(f => A.sameName(f.name, n))).slice(0, 12);
    return `<div class="lf-pagehead"><h1>Люди</h1><span class="lf-subtitle">${icon('users')} Постоянные NPC — кто они, как звучат, что о них известно</span></div>
    ${cm.fresh.length ? `${A.sec('Новые лица', 'заметил Летописец')}<div class="lf-list">${cm.fresh.map(f => `<div class="lf-row lf-fresh">${icon('sparkles')}<span><b>${esc(f.name)}</b>${f.who ? ` — ${esc(f.who)}` : ''}</span>
        <button class="lf-iconbtn sm" data-act="pp-fresh-ok" data-name="${esc(f.name)}" title="Завести карточку">${icon('check')}</button><button class="lf-iconbtn sm" data-act="pp-fresh-no" data-name="${esc(f.name)}" title="Не надо">${icon('x')}</button></div>`).join('')}</div>` : ''}
    <div class="lf-actions">
        <button class="lf-btn primary" data-act="pp-lore">${icon('book')} Из лорбука</button>
        <button class="lf-btn" data-act="pp-new">${icon('plus')} Новый</button>
    </div>
    ${groups.length ? `<div class="lf-chips">${[['', 'Все'], ...groups.map(g => [g, g]), ...(p.list.some(x => !x.group) ? [['—', 'Без круга']] : [])].map(([k, t]) => `<button class="lf-chip${(ui.pGroup || '') === k ? ' on' : ''}" data-act="pp-group" data-v="${esc(k)}">${esc(t)}${k ? ` <span class="lf-cnt">${p.list.filter(x => (k === '—' ? !x.group : x.group === k)).length}</span>` : ''}</button>`).join('')}</div>` : ''}
    ${shown.length ? `<div class="lf-npcs">${shown.map(x => cardHtml(x, near.has(x.id))).join('')}</div>`
        : `<div class="lf-empty">${icon('users', 'xl')}Пока никого. Нажми «Из лорбука» — я прочитаю записи и соберу карточки: фото потом нарисуем или загрузишь своё.</div>`}
    ${(() => { try { return agendaPeopleHtml(); } catch (e) { console.warn('[Life] закулисье: люди', e); return ''; } })()}
    ${horae.length ? `${A.sec('Ещё в истории', 'Horae знает, карточек нет')}<div class="lf-chips wrap">${horae.map(n => `<button class="lf-chip" data-act="pp-horae" data-name="${esc(n)}">${icon('plus')} ${esc(n)}</button>`).join('')}</div>` : ''}
    ${A.sec('Модели')}
    <label class="lf-switch"><input type="checkbox" data-set="people.inject" ${p.inject ? 'checked' : ''}><span></span>Справка о NPC, когда он в сцене или его упомянули</label>
    <label class="lf-switch"><input type="checkbox" data-set="people.auto" ${p.auto ? 'checked' : ''}><span></span>Замечать новые лица в истории</label>`;
}

function relLines(x) {
    const rs = A.relationsState();
    const out = [];
    const word = (sd) => {
        const bits = [];
        if (sd.trust >= 70) bits.push('доверяет'); else if (sd.trust < 30) bits.push('не доверяет');
        if (sd.closeness >= 70) bits.push('дорожит'); else if (sd.closeness < 25) bits.push('держит дистанцию');
        if (sd.desire >= 60) bits.push('тянет');
        if (sd.jealousy >= 50) bits.push('ревнует');
        if (sd.tension >= 55) bits.push('напряжение');
        if (sd.guilt >= 50) bits.push('вина');
        return bits.join(', ') || 'ровно';
    };
    for (const pr of Object.values(rs)) {
        const mine = keysOf(x).includes(A.norm(pr.a)) ? 'a' : keysOf(x).includes(A.norm(pr.b)) ? 'b' : '';
        if (!mine) continue;
        const other = mine === 'a' ? pr.b : pr.a;
        const from = mine === 'a' ? pr.ab : pr.ba, to = mine === 'a' ? pr.ba : pr.ab;
        out.push(`<div class="lf-row">${A.ava(other, 'xs')}<span><b>${esc(A.shortName(other))}</b><small class="lf-sub">${esc(A.shortName(x.name))} → ${esc(A.shortName(other))}: ${word(from)} · обратно: ${word(to)}</small></span></div>`);
    }
    return out.join('');
}

function renderNpc(x) {
    const cm = CM();
    const st = statusOf(statusFor(cm, x)?.v || x.status);
    const facts = factsOf(cm, x).slice().reverse();
    const ev = A.horaeEvents().filter(e => mentions(x, e.event?.summary || '')).slice(-8).reverse();
    const field = (label, v) => (v ? `${A.sec(label)}<div class="lf-npc-p">${esc(v)}</div>` : '');
    const near = nearbyIds().has(x.id);
    return `<button class="lf-back" data-act="pp-back">${icon('left')} Люди</button>
    <section class="lf-npc-hero${x.img ? ' lf-fit' : ''}"${x.img ? A.fitAttr(x.img) : ''}>${x.img ? '<i class="lf-fit-i"></i>' : `<span class="lf-npc-hero-l">${esc(String(x.name).charAt(0).toUpperCase())}</span>`}
        <button class="lf-glass" data-act="pp-pic" data-id="${esc(x.id)}">${icon('camera')} ${x.img ? 'Фото' : 'Нарисовать'}</button>
        <div class="lf-npc-hero-t"><h2>${esc(x.name)}</h2><span>${esc([x.group, x.role, x.age].filter(Boolean).join(' · '))}</span></div>
    </section>
    ${x.aliases?.length ? `<div class="lf-hint-i">Ещё зовут: ${esc(x.aliases.join(', '))}</div>` : ''}
    <div class="lf-chips">${STATUS.map(([id, label, ic]) => `<button class="lf-chip${st[0] === id ? ' on' : ''}" data-act="pp-status" data-id="${esc(x.id)}" data-v="${id}">${icon(ic)} ${label}</button>`).join('')}</div>
    ${near ? `<div class="lf-note">${icon('eye')} Сейчас рядом — модель получает справку о нём.</div>` : ''}
    ${x.traits?.length ? `${A.sec('Характер')}<div class="lf-chips wrap">${x.traits.map(t => `<span class="lf-chip static">${esc(t)}</span>`).join('')}</div>` : ''}
    ${field('Манера', x.voice)}
    ${field('Внешность', x.look)}
    ${field('Кто это', x.bio)}
    ${field(`К ${A.shortName(userName())}`, x.toUser)}
    ${x.secret ? `${A.sec('Секрет', 'тапни, чтобы прочитать')}<div class="lf-npc-p lf-blur" data-act="sim-peek">${esc(x.secret)}</div>` : ''}
    ${(() => { const r = relLines(x); return r ? `${A.sec('Связи')}<div class="lf-list">${r}</div>` : ''; })()}
    ${facts.length || ev.length ? `${A.sec('В истории', 'что о нём узнали')}<div class="lf-timeline">${facts.map(f => `<button class="lf-tl" data-act="jump" data-mes="${f.mes}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(f.t)}</b><small>#${f.mes}</small></span></button>`).join('')}${ev.map(e => `<button class="lf-tl" data-act="jump" data-mes="${e.messageIndex}"><span class="lf-tl-dot"></span><span class="lf-tl-txt">${esc(e.event?.summary || '')}<small>Horae · #${e.messageIndex}</small></span></button>`).join('')}</div>` : ''}
    ${(() => { try { return agendaNpcHtml(x); } catch (e) { console.warn('[Life] закулисье: карточка', e); return ''; } })()}
    ${A.sec('Справка для модели', x.inject !== false ? 'уходит, когда он рядом' : 'выключена')}
    <div class="lf-npc-p dim">${esc(x.brief || 'Пусто — модель возьмёт «Кто это».')}</div>
    <label class="lf-switch"><input type="checkbox" data-act="pp-inject" data-id="${esc(x.id)}" ${x.inject !== false ? 'checked' : ''}><span></span>Подсказывать модели</label>
    <div class="lf-actions">
        <button class="lf-btn" data-act="pp-edit" data-id="${esc(x.id)}">${icon('pencil')} Изменить</button>
        <button class="lf-btn ghost" data-act="pp-del" data-id="${esc(x.id)}">${icon('trash')} Убрать</button>
    </div>
    ${x.src?.startsWith('lore:') ? `<div class="lf-hint">Из лорбука «${esc(x.src.slice(5))}». Лорбук не трогаю — это отдельная карточка.</div>` : ''}`;
}

const FIELDS = [
    ['name', 'Имя', 'input'], ['aliases', 'Ещё зовут (через запятую)', 'input'], ['group', 'Круг', 'input'], ['role', 'Роль', 'input'], ['age', 'Возраст', 'input'],
    ['traits', 'Характер (через запятую)', 'input'], ['voice', 'Манера', 'area'], ['look', 'Внешность', 'area'], ['bio', 'Кто это', 'area'],
    ['toUser', 'Как относится к тебе', 'area'], ['secret', 'Секрет', 'area'], ['brief', 'Справка для модели (до 300 знаков)', 'area'],
];

function editSheet(x) {
    const groups = [...new Set(P().list.map(y => y.group).filter(Boolean))];
    A.openSheet(`${icon('idcard')} ${x?.name ? esc(x.name) : 'Новый человек'}`, `${FIELDS.map(([k, label, kind]) => {
        const v = Array.isArray(x?.[k]) ? x[k].join(', ') : (x?.[k] || '');
        return `<div class="lf-field"><label>${label}</label>${kind === 'area' ? `<textarea rows="2" data-pf="${k}">${esc(v)}</textarea>` : `<input type="text" data-pf="${k}" value="${esc(v)}"${k === 'group' && groups.length ? ` list="lf-pp-groups"` : ''}>`}</div>`;
    }).join('')}
        ${groups.length ? `<datalist id="lf-pp-groups">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>` : ''}
        <button class="lf-btn primary serif full big" data-act="pp-save" data-id="${esc(x?.id || '')}">${icon('check')} Сохранить</button>`);
}

async function loreSheet() {
    const names = await worldNames();
    const act = activeBooks();
    A.openSheet(`${icon('book')} Собрать из лорбука`, names.length
        ? `<div class="lf-hint">Выбери лорбук — дешёвая модель прочитает записи и сделает карточки людей. Уже существующие карточки только дополнятся, твои правки не перетрутся.</div>
        <div class="lf-list">${names.sort((a, b) => (act.has(b) ? 1 : 0) - (act.has(a) ? 1 : 0)).map(n => `<button class="lf-row" data-act="pp-lore-go" data-name="${esc(n)}">${icon('book')}<span><b>${esc(n)}</b>${act.has(n) ? '<small class="lf-sub">подключён к этому чату</small>' : ''}</span>${icon('right')}</button>`).join('')}</div>`
        : `<div class="lf-empty small">Не вижу лорбуков Таверны.</div>`);
}

async function drawNpc(x) {
    const prompt = `Cinematic portrait of ${x.name}${x.age ? `, ${x.age} years old` : ''}. ${x.look || x.bio || ''}\nMood: ${(x.traits || []).slice(0, 3).join(', ')}. Head and shoulders, natural light, atmospheric background. Style: ${A.style()}. Vertical, no text.`;
    x.img = await A.drawPicture(prompt, { aspect: '3:4', max: 1100, prefix: 'life_npc' });
    A.saveSettings();
}

/** Новая карточка (из Закулисья и т.п.). */
export function peopleAdd(rec) {
    const x = findPerson(rec.name);
    if (x) { Object.assign(x, Object.fromEntries(Object.entries(rec).filter(([k, v]) => v !== undefined && (k === 'bs' || !x[k])))); A.saveSettings(); return x; }
    const y = { id: A.uid(), name: rec.name, aliases: [], group: '', role: '', age: '', look: '', traits: [], voice: '', bio: '', toUser: '', secret: '', brief: '', img: '', status: 'active', inject: true, src: rec.src || 'me', at: Date.now(), ...rec };
    P().list.push(y);
    A.saveSettings();
    return y;
}

export function peopleSetImg(id, path) { const x = personById(id); if (x) { x.img = path; A.saveSettings(); } }

export async function peopleClick(act, el) {
    const ui = A.ui;
    const p = P();
    const cm = CM();
    const box = el.closest('.lf-sheet');
    const done = (meta = false) => { meta ? A.saveMeta() : A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'pp-open': ui.npc = el.dataset.id; A.render(); A.scrollTop?.(); return true;
        case 'pp-back': ui.npc = ''; A.render(); return true;
        case 'pp-group': ui.pGroup = el.dataset.v; A.render(); return true;
        case 'pp-lore': await loreSheet(); return true;
        case 'pp-lore-go':
            await A.withBusy(el, async () => {
                const r = await importBook(el.dataset.name);
                A.closeSheet();
                A.toast('success', `Новых: ${r.added}, дополнено: ${r.updated}`, '✦ Люди', { timeOut: 3000 });
                A.render();
            }, 'Читаю…');
            return true;
        case 'pp-new': editSheet(null); return true;
        case 'pp-edit': editSheet(personById(el.dataset.id)); return true;
        case 'pp-save': {
            const v = (k) => box?.querySelector(`[data-pf="${k}"]`)?.value?.trim() || '';
            const rec = Object.fromEntries(FIELDS.map(([k]) => [k, ['aliases', 'traits'].includes(k) ? v(k).split(',').map(s => s.trim()).filter(Boolean) : v(k)]));
            if (!rec.name) { A.toast('warning', 'Нужно имя'); return true; }
            const x = personById(el.dataset.id);
            if (x) Object.assign(x, rec);
            else { const id = A.uid(); p.list.push({ id, ...rec, img: '', status: 'active', inject: true, src: 'me', at: Date.now() }); ui.npc = id; }
            A.closeSheet();
            return done();
        }
        case 'pp-del': {
            const x = personById(el.dataset.id);
            if (!x || !confirm(`Убрать карточку «${x.name}»?`)) return true;
            p.list = p.list.filter(y => y.id !== x.id);
            ui.npc = '';
            return done();
        }
        case 'pp-status': { const x = personById(el.dataset.id); if (x) { x.status = el.dataset.v; delete cm.status[x.id]; A.saveMeta(); } return done(); }
        case 'pp-inject': { const x = personById(el.dataset.id); if (x) x.inject = !!el.checked; return done(); }
        case 'pp-pic': {
            const x = personById(el.dataset.id);
            if (!x) return true;
            A.openSheet(`${icon('image')} ${esc(x.name)}`, `<div class="lf-actions">
                <button class="lf-btn primary" data-act="pp-draw" data-id="${esc(x.id)}">${icon('wand')} Нарисовать по внешности</button>
                <label class="lf-btn">${icon('upload')} Загрузить<input type="file" accept="image/*" data-file="npc" data-id="${esc(x.id)}" hidden></label>
            </div>${x.img ? `<button class="lf-btn ghost full" data-act="pp-noimg" data-id="${esc(x.id)}">${icon('trash')} Убрать фото</button>` : ''}`);
            return true;
        }
        case 'pp-draw': {
            const x = personById(el.dataset.id);
            if (!x) return true;
            await A.withBusy(el, async () => { await drawNpc(x); A.closeSheet(); A.render(); }, 'Рисую…');
            return true;
        }
        case 'pp-noimg': { const x = personById(el.dataset.id); if (x) x.img = ''; A.closeSheet(); return done(); }
        case 'pp-fresh-ok': {
            const f = cm.fresh.find(y => A.sameName(y.name, el.dataset.name));
            cm.fresh = cm.fresh.filter(y => y !== f);
            const id = A.uid();
            p.list.push({ id, name: f?.name || el.dataset.name, aliases: [], group: '', role: f?.who || '', age: '', look: '', traits: [], voice: '', bio: f?.who || '', toUser: '', secret: '', brief: '', img: '', status: 'active', inject: true, src: 'chron', at: Date.now() });
            A.saveMeta();
            ui.npc = id;
            return done();
        }
        case 'pp-fresh-no': cm.fresh = cm.fresh.filter(y => !A.sameName(y.name, el.dataset.name)); return done(true);
        case 'pp-horae': {
            const n = el.dataset.name;
            const h = A.worldState().npcs?.[n];
            const texts = h && typeof h === 'object' ? Object.values(h).filter(v => typeof v === 'string' && v.trim()) : typeof h === 'string' ? [h] : [];
            const id = A.uid();
            p.list.push({ id, name: n, aliases: [], group: '', role: '', age: '', look: '', traits: [], voice: '', bio: texts.join('. ').slice(0, 700), toUser: '', secret: '', brief: '', img: '', status: 'active', inject: true, src: 'horae', at: Date.now() });
            ui.npc = id;
            return done();
        }
    }
    return false;
}
