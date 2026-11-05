// ✦ LIFE — визуальный хаб для SillyTavern поверх Horae.
// Ничего не решает за модель: время, место, одежду, вещи и события ведёт Horae (горае пишет их в каждое сообщение,
// поле horae_meta), а Life их красиво показывает, режет общий чат на главы-комнаты только на экране
// и даёт кнопки (Отправиться, Новая глава). Кнопки оставляют в чате скрытую отметку главы с местом для Horae —
// модель видит переход через Horae и одну короткую заметку на следующий ответ.

const MODULE = 'life';
const VERSION = '0.1.0';
const PROMPT_KEY = 'life_move';
const WARDROBE_DRAW = '/scripts/extensions/third-party/wardrobe/draw.js';

const DEFAULTS = {
    enabled: true,
    showFab: true,
    fabPos: null,
    dividers: true,
    focusDefault: true,
    chapterBy: 'top',
    aliases: '',
    artStyle: 'semi-realistic colored-pencil sketch on toned paper, moody cinematic light, graphite and deep wine palette, no people, no text, no letters',
    worlds: [],
    activeWorld: '',
    places: {},
    itemImgs: {},
    debug: false,
};

const ctx = () => SillyTavern.getContext();

function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function settings() {
    const ext = ctx().extensionSettings;
    if (!ext[MODULE] || typeof ext[MODULE] !== 'object') ext[MODULE] = {};
    const s = ext[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = clone(v);
    if (!Array.isArray(s.worlds)) s.worlds = [];
    if (!s.worlds.length) s.worlds.push({ id: uid(), name: 'Нью-Йорк', cover: '', map: '', note: '' });
    if (!s.places || typeof s.places !== 'object') s.places = {};
    if (!s.itemImgs || typeof s.itemImgs !== 'object') s.itemImgs = {};
    return s;
}
const saveSettings = () => ctx().saveSettingsDebounced();

// ───────────── мелочи ─────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function norm(v) {
    return String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'`]/g, '').replace(/\s+/g, ' ').trim();
}

function cut(t, n) {
    t = String(t ?? '');
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function toast(kind, msg, title = '✦ Life', opts = {}) {
    try { window.toastr?.[kind]?.(msg, title, { timeOut: 3000, ...opts }); } catch { /* нет тостов */ }
}

/** Части места Horae: «Квартира Хеди·Кухня» → ['Квартира Хеди', 'Кухня']. */
function locParts(loc) {
    return String(loc || '').split(/\s*[·・›>]\s*/).map(x => x.trim()).filter(Boolean);
}
function locTop(loc) { return locParts(loc)[0] || ''; }
function locLeaf(loc) { const p = locParts(loc); return p[p.length - 1] || ''; }
function placeKey(loc) { return locParts(loc).map(norm).join('·'); }

/** Чистый текст сообщения для превью: без тегов Horae, спойлеров, html и разметки. */
function plainText(mes) {
    return String(mes || '')
        .replace(/<(horae\w*|details|think|thinking|summary|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_~`#>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const ICONS = [
    ['fa-house', /квартир|дом|апартамент|особняк|пентхаус|home|house|flat/],
    ['fa-martini-glass', /бар|паб|клуб|bar|pub/],
    ['fa-mug-hot', /кафе|кофейн|ресторан|столов|cafe|coffee|diner/],
    ['fa-hospital', /больниц|клиник|госпитал|медпункт|hospital/],
    ['fa-star', /штаб|база|маяк|a\.?i\.?m|аим|щит|shield|hq/],
    ['fa-warehouse', /гараж|ангар|склад|garage/],
    ['fa-flask', /лаборатор|лаба|lab/],
    ['fa-utensils', /кухн|kitchen/],
    ['fa-bed', /спальн|bedroom|номер|отел|гостиниц|hotel/],
    ['fa-couch', /гостин|зал|living/],
    ['fa-bath', /ванн|душ|bath/],
    ['fa-briefcase', /кабинет|офис|office/],
    ['fa-car', /машин|авто|дорог|шоссе|car|road/],
    ['fa-tree', /парк|лес|сад|park|forest/],
    ['fa-water', /озер|река|берег|пляж|море|lake|river|beach/],
    ['fa-plane', /аэропорт|самол|квинджет|jet|airport/],
    ['fa-building-columns', /музей|церк|собор|музей|museum|church/],
    ['fa-dumbbell', /спортзал|тренаж|gym/],
];
function guessIcon(name) {
    const n = norm(name);
    for (const [icon, re] of ICONS) if (re.test(n)) return icon;
    return 'fa-location-dot';
}

const CANDLE_SVG = `<svg viewBox="0 0 32 32" class="lf-candle" aria-hidden="true"><path class="lf-flame" d="M16 2.5c2.2 3 3.2 5 3.2 6.6a3.2 3.2 0 0 1-6.4 0c0-1.6 1-3.6 3.2-6.6z"/><rect x="12.2" y="12.5" width="7.6" height="13" rx="1.4"/><path d="M6 26.5h20M8.5 29.5h15" stroke-linecap="round"/></svg>`;

// ───────────── состояние чата: Horae ─────────────

function chatArr() { return ctx().chat || []; }

function hasChat() {
    const c = ctx();
    return !!(c.chatId || c.groupId || c.characterId !== undefined) && Array.isArray(c.chat);
}

function chatMeta() {
    const md = ctx().chatMetadata;
    if (!md) return {};
    if (!md.life || typeof md.life !== 'object') md.life = {};
    return md.life;
}

function horaeOn() {
    try { return !!window.Horae?.isEnabled?.(); } catch { return false; }
}

function emptyMeta() {
    return {
        timestamp: { story_date: '', story_time: '', absolute: '' },
        scene: { location: '', characters_present: [], atmosphere: '' },
        costumes: {}, items: {}, deletedItems: [], deletedAgenda: [], events: [],
        affection: {}, npcs: {}, agenda: [], mood: {}, relationships: [],
    };
}

/** Последнее состояние мира. Если Horae нет — простая свёртка по horae_meta. */
function worldState() {
    if (horaeOn()) {
        try { return window.Horae.getLatestState() || emptyMeta(); } catch (e) { console.warn('[Life] Horae.getLatestState', e); }
    }
    const st = emptyMeta();
    for (const m of chatArr()) {
        const meta = m?.horae_meta;
        if (!meta || meta._skipHorae) continue;
        if (meta.timestamp?.story_date) st.timestamp.story_date = meta.timestamp.story_date;
        if (meta.timestamp?.story_time) st.timestamp.story_time = meta.timestamp.story_time;
        if (meta.scene?.location) st.scene.location = meta.scene.location;
        if (meta.scene?.atmosphere) st.scene.atmosphere = meta.scene.atmosphere;
        if (meta.scene?.characters_present?.length) st.scene.characters_present = [...meta.scene.characters_present];
        if (meta.costumes) Object.assign(st.costumes, meta.costumes);
        if (meta.mood) Object.assign(st.mood, meta.mood);
        if (meta.items) Object.assign(st.items, meta.items);
    }
    return st;
}

function horaeEvents() {
    try {
        if (horaeOn()) return window.Horae.getEvents(0) || [];
    } catch (e) { console.warn('[Life] Horae.getEvents', e); }
    const out = [];
    chatArr().forEach((m, i) => (m?.horae_meta?.events || []).forEach((event, j) => { if (event?.summary) out.push({ messageIndex: i, eventIndex: j, timestamp: m.horae_meta.timestamp, event }); }));
    return out;
}

function horaeAgenda() {
    const chat = chatArr();
    const seen = new Set();
    const deleted = new Set(chat[0]?.horae_meta?._deletedAgendaTexts || []);
    const out = [];
    const add = (item, i) => {
        if (!item?.text || item._deleted || deleted.has(item.text) || seen.has(item.text)) return;
        seen.add(item.text);
        out.push({ ...item, messageIndex: i });
    };
    for (const it of chat[0]?.horae_meta?.agenda || []) add(it, 0);
    for (let i = 1; i < chat.length; i++) for (const it of chat[i]?.horae_meta?.agenda || []) add(it, i);
    return out.filter(a => !a.done);
}

function locationMemory() {
    return chatArr()[0]?.horae_meta?.locationMemory || {};
}

function relationships() {
    return chatArr()[0]?.horae_meta?.relationships || [];
}

// ───────────── главы ─────────────

let chCache = { sig: '', list: [] };

function chatSig() {
    const chat = chatArr();
    const last = chat[chat.length - 1];
    const lastLoc = last?.horae_meta?.scene?.location || '';
    return `${ctx().chatId || ctx().groupId}|${chat.length}|${last?.swipe_id ?? ''}|${lastLoc}|${settings().chapterBy}|${chatMeta().ver || 0}`;
}

/**
 * Главы = отрезки чата, где место (по Horae) одно и то же. Новая глава начинается, когда меняется место
 * (по верхнему уровню: «Квартира·Кухня» → «Квартира·Спальня» — та же глава), или на отметке Life.
 */
function chapters() {
    const sig = chatSig();
    if (chCache.sig === sig) return chCache.list;
    const chat = chatArr();
    const by = settings().chapterBy;
    const titles = chatMeta().titles || {};
    const list = [];
    let loc = '', date = '', time = '';
    let cur = null;
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const meta = m?.horae_meta;
        const mark = m?.extra?.life;
        if (meta && !meta._skipHorae) {
            if (meta.scene?.location) loc = meta.scene.location;
            if (meta.timestamp?.story_date) date = meta.timestamp.story_date;
            if (meta.timestamp?.story_time) time = meta.timestamp.story_time;
        }
        if (mark?.location) loc = mark.location;
        const key = by === 'full' ? placeKey(loc) : norm(locTop(loc));
        const forced = !!mark?.chapter;
        // глава, начатая кнопкой, ещё без постов: если место сменилось в первом же ответе — это всё та же глава
        if (cur && !forced && key && key !== cur.key && cur.marker >= 0 && cur.count === 0) {
            cur.key = key;
            cur.loc = loc;
        }
        if (!cur || forced || (key && key !== cur.key)) {
            cur = { idx: list.length, start: i, end: i, key, loc, date, time, endDate: date, endTime: time, count: 0, marker: forced ? i : -1, title: mark?.title || '', preview: '', previewId: -1, locs: new Set() };
            list.push(cur);
        }
        cur.end = i;
        if (cur.marker >= 0 && cur.marker !== i && cur.count === 0 && meta?.timestamp?.story_date) { cur.date = date; cur.time = time; }
        if (!cur.key && key) { cur.key = key; cur.loc = loc; }
        if (loc) cur.locs.add(loc);
        cur.endDate = date || cur.endDate;
        cur.endTime = time || cur.endTime;
        if (!cur.date && date) { cur.date = date; cur.time = time; }
        if (m && !m.is_system) {
            cur.count++;
            if (cur.previewId < 0) cur.previewId = i;
        }
    }
    // превью и названия
    for (const ch of list) {
        if (ch.previewId >= 0) ch.preview = cut(plainText(chat[ch.previewId]?.mes), 170);
        ch.title = titles[ch.start] || ch.title || (ch.loc ? locTop(ch.loc) : (ch.idx === 0 ? 'Пролог' : 'Без места'));
        ch.locs = [...ch.locs];
        ch.num = ch.idx + 1;
    }
    chCache = { sig, list };
    return list;
}

function invalidate() {
    chCache.sig = '';
}

function chapterOf(mesId, list = chapters()) {
    let lo = 0, hi = list.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (mesId < list[mid].start) hi = mid - 1;
        else if (mesId > list[mid].end) lo = mid + 1;
        else return list[mid];
    }
    return null;
}

function fmtWhen(date, time) {
    return [date, time].filter(Boolean).join(' · ');
}

// ───────────── места и миры ─────────────

function currentWorld() {
    const s = settings();
    const id = chatMeta().world || s.activeWorld || s.worlds[0]?.id;
    return s.worlds.find(w => w.id === id) || s.worlds[0];
}

function getPlace(loc, create = false) {
    const key = placeKey(loc);
    if (!key) return null;
    const s = settings();
    if (!s.places[key] && create) {
        s.places[key] = { name: locParts(loc).join(' · '), raw: loc, icon: guessIcon(locLeaf(loc)), img: '', plan: '', world: '', x: null, y: null };
    }
    return s.places[key] || null;
}

function placeName(loc) {
    return getPlace(loc)?.name || locParts(loc).join(' · ') || 'Без места';
}

/** Обложка места: своя картинка → картинка родителя → обложка мира. */
function placeCover(loc) {
    const parts = locParts(loc);
    for (let n = parts.length; n > 0; n--) {
        const p = getPlace(parts.slice(0, n).join('·'));
        if (p?.img) return p.img;
    }
    return '';
}

function placeIcon(loc) {
    return getPlace(loc)?.icon || guessIcon(locLeaf(loc));
}

/** Все места, которые знает чат (главы + память мест Horae) и реестр Life. */
function knownLocations() {
    const map = new Map();
    const add = (raw) => {
        const k = placeKey(raw);
        if (k && !map.has(k)) map.set(k, raw);
        const top = locTop(raw);
        const tk = placeKey(top);
        if (tk && !map.has(tk)) map.set(tk, top);
    };
    for (const ch of chapters()) for (const l of ch.locs) add(l);
    for (const name of Object.keys(locationMemory())) add(name);
    for (const [k, p] of Object.entries(settings().places)) if (!map.has(k)) map.set(k, p.raw || p.name);
    return map;
}

function placeDesc(loc) {
    const mem = locationMemory();
    const key = placeKey(loc);
    for (const [name, v] of Object.entries(mem)) if (placeKey(name) === key && !v?._deleted) return v.desc || '';
    return getPlace(loc)?.desc || '';
}

// ───────────── персонажи ─────────────

function parseAliases(text) {
    const out = {};
    for (const line of String(text || '').split('\n')) {
        const m = line.split('=');
        if (m.length < 2) continue;
        const card = m[0].trim();
        if (!card) continue;
        out[card] = [card, ...m.slice(1).join('=').split(',').map(x => x.trim()).filter(Boolean)];
    }
    return out;
}

function aliasTable() {
    const c = ctx();
    return { ...parseAliases(c.extensionSettings?.wardrobe?.aliases), ...parseAliases(settings().aliases) };
}

/** Имя из Horae/текста → имя карточки (по прозвищам из Гардероба и Life), иначе как есть. */
function canonName(name) {
    const n = norm(name);
    if (!n) return '';
    const c = ctx();
    const cards = (c.characters || []).map(x => x.name).filter(Boolean);
    const exact = cards.find(x => norm(x) === n) || (norm(c.name1) === n ? c.name1 : '');
    if (exact) return exact;
    for (const [card, list] of Object.entries(aliasTable())) {
        if (list.some(a => norm(a) === n || norm(a).split(' ')[0] === n || n.split(' ')[0] === norm(a))) return card;
    }
    const first = cards.find(x => norm(x).split(' ')[0] === n.split(' ')[0]);
    return first || String(name).trim();
}

function sameName(a, b) { return !!a && !!b && norm(canonName(a)) === norm(canonName(b)); }

function groupMembers() {
    const c = ctx();
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.members || []).map(av => (c.characters || []).find(x => x.avatar === av)?.name).filter(Boolean);
    }
    if (c.characterId !== undefined && c.characters?.[c.characterId]) return [c.characters[c.characterId].name];
    return [];
}

function castNames(st = worldState()) {
    const c = ctx();
    const names = [];
    const add = (n) => { const k = canonName(n); if (k && !names.some(x => norm(x) === norm(k))) names.push(k); };
    add(c.name1);
    groupMembers().forEach(add);
    (st.scene?.characters_present || []).forEach(add);
    Object.keys(st.costumes || {}).forEach(add);
    Object.keys(st.mood || {}).forEach(add);
    return names;
}

function userAvatar() {
    const img = document.querySelector('#chat .mes[is_user="true"] .avatar img');
    return img?.getAttribute('src') || '';
}

function avatarUrl(name, full = false) {
    const c = ctx();
    const n = canonName(name);
    if (norm(n) === norm(c.name1)) {
        const t = userAvatar();
        if (full && t.includes('thumbnail')) {
            try { const f = new URL(t, location.href).searchParams.get('file'); if (f) return `/User Avatars/${encodeURIComponent(f)}`; } catch { /* миниатюра */ }
        }
        return t;
    }
    const face = c.extensionSettings?.wardrobe?.faces?.[n];
    if (face && !full) return face;
    const ch = (c.characters || []).find(x => x.name === n);
    if (!ch?.avatar) return face || '';
    return full ? `/characters/${encodeURIComponent(ch.avatar)}` : `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
}

function shortName(n) {
    const f = String(n || '').split(/\s+/)[0];
    return f.length > 11 ? f.slice(0, 10) + '…' : f;
}

function ava(name, cls = '') {
    const url = avatarUrl(name);
    const letter = esc(String(name || '?').trim().charAt(0).toUpperCase());
    return `<span class="lf-ava ${cls}" title="${esc(name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i>${letter}</i></span>`;
}

// ───────────── картинки ─────────────

async function fileToJpeg(file, max = 1600, q = 0.86) {
    const src = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('файл не прочитался'));
        r.readAsDataURL(file);
    });
    return toJpeg(src, max, q);
}

async function toJpeg(dataUrl, max = 1600, q = 0.86) {
    const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('это не картинка'));
        i.src = dataUrl;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k);
    cv.height = Math.round(img.naturalHeight * k);
    const g = cv.getContext('2d');
    g.fillStyle = '#111';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q);
}

async function urlToDataUrl(u) {
    if (String(u).startsWith('data:')) return u;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`картинка не скачалась (${r.status})`);
    const blob = await r.blob();
    return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('картинка не прочиталась'));
        fr.readAsDataURL(blob);
    });
}

async function uploadImage(dataUrl, prefix = 'life') {
    const r = await fetch('/api/images/upload', {
        method: 'POST',
        headers: ctx().getRequestHeaders(),
        body: JSON.stringify({ image: dataUrl.split(',')[1], format: 'jpg', ch_name: 'life', filename: `${prefix}_${Date.now()}` }),
    });
    if (!r.ok) throw new Error(`таверна не сохранила картинку (${r.status})`);
    const j = await r.json();
    const p = String(j.path || '');
    return p.startsWith('/') ? p : `/${p}`;
}

/** Нарисовать картинку через движок Гардероба (тот же SLAY/Atlas/Naistera, что у тебя настроен). */
async function drawPicture(prompt, { aspect = '4:3', max = 1600 } = {}) {
    let mod;
    try { mod = await import(WARDROBE_DRAW); } catch { throw new Error('Рисую через Гардероб, а он не найден. Можно загрузить свою картинку.'); }
    const c = ctx();
    const conn = mod.resolveConnection(c.extensionSettings?.wardrobe || {}, c.extensionSettings);
    if (conn?.error) throw new Error(conn.error);
    const out = await mod.generateImage(conn, prompt, [], { aspect, onWait: (sec) => toast('info', `Сервис занят, повтор через ${sec} с`) });
    return uploadImage(await toJpeg(await urlToDataUrl(out), max, 0.88));
}

function placePrompt(loc) {
    const desc = placeDesc(loc);
    const world = currentWorld();
    return `Atmospheric establishing shot of a place: ${locParts(loc).join(', ')}.${desc ? ` Details: ${desc}` : ''}${world?.note ? ` Setting: ${world.note}` : ''}\nStyle: ${settings().artStyle}. Wide cinematic composition, empty of people.`;
}

function mapPrompt(world) {
    return `Illustrated aerial bird's-eye map of ${world.name}${world.note ? ` (${world.note})` : ''}: city districts, streets, river, rooftops, a few distinct landmark buildings spread across the frame, night with warm windows.\nStyle: ${settings().artStyle}. No labels, no text, no legend.`;
}

function planPrompt(loc) {
    const desc = placeDesc(loc);
    return `Isometric cutaway floor plan illustration of ${locParts(loc).join(', ')}, several rooms visible from above with furniture and warm lamps.${desc ? ` Details: ${desc}` : ''}\nStyle: ${settings().artStyle}. No labels, no text.`;
}

function itemPrompt(name, info) {
    return `Still life close-up of a single object: ${name}.${info?.description ? ` ${info.description}` : ''} On dark fabric, soft side light.\nStyle: ${settings().artStyle}. Only this object, nothing else.`;
}

// ───────────── переходы и главы: отметки в чате ─────────────

/**
 * Скрытая отметка главы: системное сообщение (в промпт не идёт), но с horae_meta, чтобы Horae
 * считал новое место текущим. На экране вместо него рисуется разделитель главы.
 */
async function insertMarker({ location = '', title = '', who = [], how = '', note = '' }) {
    const c = ctx();
    if (!hasChat()) throw new Error('сначала открой чат');
    const meta = emptyMeta();
    meta.scene.location = location || '';
    if (who.length) meta.scene.characters_present = [...who];
    const msg = {
        name: 'Life',
        is_user: false,
        is_system: true,
        send_date: new Date().toLocaleString(),
        mes: `✦ ${title || location || 'Новая глава'}`,
        extra: { type: 'comment', life: { chapter: true, location, title, who, how, note } },
        horae_meta: meta,
    };
    c.chat.push(msg);
    try { c.addOneMessage(msg, { scroll: true }); } catch (e) { console.warn('[Life] addOneMessage', e); }
    await c.saveChat();
    invalidate();
    updateMovePrompt();
    return c.chat.length - 1;
}

/** Отметка, после которой ещё не было ответа персонажа, — по ней даём модели одну заметку о переходе. */
function pendingMarker() {
    const chat = chatArr();
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m?.extra?.life?.chapter) return { id: i, mark: m.extra.life };
        if (m && !m.is_system && !m.is_user) return null;
    }
    return null;
}

function moveNote(mark) {
    const who = (mark.who || []).filter(Boolean);
    const whoTxt = who.length ? who.join(', ') : 'Персонажи';
    if (mark.location) {
        return `[Смена сцены${mark.how ? ` (${mark.how})` : ''}: ${whoTxt} теперь — «${locParts(mark.location).join(', ')}»${mark.title ? `. Глава: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''} Пиши уже оттуда (или дорогу туда, если так логичнее), без телепортов; кто не пошёл — остался где был.]`;
    }
    return `[Новая глава${mark.title ? `: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''}]`;
}

function updateMovePrompt() {
    const c = ctx();
    const p = settings().enabled ? pendingMarker() : null;
    const text = p ? moveNote(p.mark) : '';
    try {
        c.setExtensionPrompt(PROMPT_KEY, text, c.extension_prompt_types?.IN_CHAT ?? 1, 0, false, c.extension_prompt_roles?.SYSTEM ?? 0);
    } catch (e) { console.warn('[Life] заметка о переходе', e); }
    return text;
}

globalThis.life_intercept = async function (_chat, _size, _abort, type) {
    try { if (type !== 'quiet') updateMovePrompt(); } catch (e) { console.warn('[Life] перехват', e); }
};

async function removeMarker(id) {
    const c = ctx();
    const m = c.chat?.[id];
    if (!m?.extra?.life?.chapter) return;
    if (typeof c.deleteMessage === 'function') {
        await c.deleteMessage(id);
    } else {
        c.chat.splice(id, 1);
        await c.saveChat();
        await c.reloadCurrentChat?.();
    }
    invalidate();
    updateMovePrompt();
}

// ───────────── чат: разделители и фокус на главе ─────────────

const ui = {
    open: false, tab: 'scene', focus: 'last', who: '', itemsTab: 'with', worldTab: 'events',
    mapStack: [], editPins: false, chShow: 30,
};
let observer = null;
let decorating = false;

function focusChapter(list = chapters()) {
    if (!settings().enabled || ui.focus === null || !list.length) return null;
    if (ui.focus === 'last') return list[list.length - 1];
    return list.find(ch => ch.start === ui.focus) || list[list.length - 1];
}

function firstShownId(chatEl) {
    const first = chatEl.querySelector(':scope > .mes[mesid]');
    return first ? Number(first.getAttribute('mesid')) : Infinity;
}

function dividerHtml(ch) {
    const cover = placeCover(ch.loc);
    return `<div class="lf-div${cover ? ' has-cover' : ''}" data-start="${ch.start}" role="button" tabindex="0">
        ${cover ? `<div class="lf-div-cover" style="background-image:url('${esc(cover)}')"></div>` : ''}
        <div class="lf-div-line"></div>
        <div class="lf-div-txt">
            <span class="lf-div-k">Глава ${pad2(ch.num)}</span>
            <b>${ch.loc ? `<i class="fa-solid ${esc(placeIcon(ch.loc))}"></i> ` : ''}${esc(ch.title)}</b>
            ${fmtWhen(ch.date, ch.time) ? `<span class="lf-div-t">${esc(fmtWhen(ch.date, ch.time))}</span>` : ''}
        </div>
        <div class="lf-div-line"></div>
    </div>`;
}

function barHtml(list, fch) {
    if (!fch) {
        return `<div id="lf-bar" class="lf-bar-all">
            <button class="lf-bar-mid" data-lfb="hub"><i class="fa-solid fa-book-open"></i> Весь чат · ${list.length} ${plural(list.length, 'глава', 'главы', 'глав')}</button>
            <button class="lf-bar-btn" data-lfb="focus" title="Только текущая глава"><i class="fa-solid fa-door-open"></i></button>
        </div>`;
    }
    const i = fch.idx;
    return `<div id="lf-bar">
        <button class="lf-bar-btn" data-lfb="prev" ${i === 0 ? 'disabled' : ''} title="Предыдущая глава"><i class="fa-solid fa-chevron-left"></i></button>
        <button class="lf-bar-mid" data-lfb="hub"><span class="lf-bar-k">Гл. ${fch.num}</span><i class="fa-solid ${esc(placeIcon(fch.loc))}"></i> ${esc(cut(fch.title, 34))}</button>
        <button class="lf-bar-btn" data-lfb="next" ${i >= list.length - 1 ? 'disabled' : ''} title="Следующая глава"><i class="fa-solid fa-chevron-right"></i></button>
        <button class="lf-bar-btn" data-lfb="all" title="Показать весь чат"><i class="fa-solid fa-layer-group"></i></button>
    </div>`;
}

function decorate() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || decorating) return;
    decorating = true;
    try {
        chatEl.querySelectorAll(':scope > .lf-div, :scope > #lf-bar, :scope > .lf-more').forEach(x => x.remove());
        const s = settings();
        const mesEls = chatEl.querySelectorAll(':scope > .mes[mesid]');
        if (!s.enabled || !hasChat()) {
            chatEl.classList.remove('lf-focus', 'lf-focus-full');
            mesEls.forEach(el => el.classList.remove('lf-out', 'lf-marker'));
            return;
        }
        const list = chapters();
        const fch = focusChapter(list);
        const chat = chatArr();
        const starts = new Map(list.map(ch => [ch.start, ch]));
        for (const el of mesEls) {
            const id = Number(el.getAttribute('mesid'));
            const ch = chapterOf(id, list);
            el.classList.toggle('lf-out', !!fch && ch !== fch);
            el.classList.toggle('lf-marker', !!chat[id]?.extra?.life?.chapter && s.dividers);
            const st = starts.get(id);
            if (st && s.dividers && (st.loc || st.marker >= 0 || st.idx > 0) && (!fch || st === fch)) {
                el.insertAdjacentHTML('beforebegin', dividerHtml(st));
            }
        }
        const firstId = firstShownId(chatEl);
        const full = !!fch && fch.start >= firstId;
        chatEl.classList.toggle('lf-focus', !!fch);
        chatEl.classList.toggle('lf-focus-full', full);
        if (fch && !full && Number.isFinite(firstId)) {
            const hidden = firstId - fch.start;
            const anchor = chatEl.querySelector(':scope > #show_more_messages');
            const html = `<button class="lf-more" data-lfb="more"><i class="fa-solid fa-angles-up"></i> Начало главы — ещё ${hidden} ${plural(hidden, 'сообщение', 'сообщения', 'сообщений')}</button>`;
            if (anchor) anchor.insertAdjacentHTML('afterend', html);
            else chatEl.insertAdjacentHTML('afterbegin', html);
        }
        if (list.length > 1 || fch?.loc) chatEl.insertAdjacentHTML('afterbegin', barHtml(list, fch));
    } catch (e) {
        console.error('[Life] decorate', e);
    } finally {
        observer?.takeRecords();
        decorating = false;
    }
}

let decoTimer = null;
function decorateSoon(ms = 60) {
    clearTimeout(decoTimer);
    decoTimer = setTimeout(() => { decorate(); if (ui.open) renderSoon(); }, ms);
}

function hookChat() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || chatEl.dataset.lfHooked) return !!chatEl;
    chatEl.dataset.lfHooked = '1';
    observer = new MutationObserver(() => { if (!decorating) decorateSoon(80); });
    observer.observe(chatEl, { childList: true });
    chatEl.addEventListener('click', onChatClick);
    return true;
}

async function onChatClick(ev) {
    const b = ev.target.closest('[data-lfb], .lf-div');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    const list = chapters();
    const fch = focusChapter(list);
    if (b.classList.contains('lf-div')) {
        const st = Number(b.dataset.start);
        if (fch && fch.start === st) openHub('scene');
        else gotoChapter(st);
        return;
    }
    switch (b.dataset.lfb) {
        case 'hub': openHub('scene'); break;
        case 'prev': if (fch && fch.idx > 0) gotoChapter(list[fch.idx - 1].start); break;
        case 'next': if (fch && fch.idx < list.length - 1) gotoChapter(list[fch.idx + 1].start); break;
        case 'all': ui.focus = null; decorate(); break;
        case 'focus': ui.focus = 'last'; decorate(); scrollChatBottom(); break;
        case 'more': if (fch) await jumpTo(fch.start); break;
    }
}

function scrollChatBottom() {
    const chatEl = document.getElementById('chat');
    if (chatEl) chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
}

async function jumpTo(mesId) {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    if (mesId < firstShownId(chatEl)) {
        try { await ctx().executeSlashCommandsWithOptions?.(`/chat-jump ${mesId}`); } catch (e) { console.warn('[Life] chat-jump', e); }
        decorate();
    }
    const el = chatEl.querySelector(`.lf-div[data-start="${mesId}"]`) || chatEl.querySelector(`.mes[mesid="${mesId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Перейти в главу: показать только её и прокрутить к началу (последнюю — к концу). */
async function gotoChapter(start, { close = true } = {}) {
    const list = chapters();
    const ch = list.find(x => x.start === start);
    if (!ch) return;
    ui.focus = ch.idx === list.length - 1 ? 'last' : ch.start;
    if (close) closeHub();
    decorate();
    if (ui.focus === 'last' && ch.end - ch.start > 3) scrollChatBottom();
    else await jumpTo(ch.start);
}

// ───────────── хаб ─────────────

let openedAt = 0;
let renderTimer = null;
function renderSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 120); }

const TABS = [
    ['scene', 'fa-clapperboard', 'Сцена'],
    ['map', 'fa-location-dot', 'Карта'],
    ['person', 'fa-user', 'Персонаж'],
    ['world', 'fa-globe', 'Мир'],
];

function buildHub() {
    if (document.getElementById('lf-dialog')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'lf-dialog';
    dlg.innerHTML = `
    <div id="lf-app">
        <header class="lf-top">
            <div class="lf-brand">${CANDLE_SVG}<div><div class="lf-brand-t">Таверна <span>/</span> LIFE</div><div class="lf-brand-s">SillyTavern</div></div></div>
            <div class="lf-top-r">
                <span class="lf-me"></span>
                <button class="lf-x" data-act="close" title="Закрыть"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </header>
        <main class="lf-body"></main>
        <nav class="lf-tabs">${TABS.map(([k, ic, t]) => `<button class="lf-tab" data-act="tab" data-tab="${k}"><i class="fa-solid ${ic}"></i><span>${t}</span></button>`).join('')}<i class="lf-tab-ink"></i></nav>
        <div class="lf-sheet-host"></div>
        <div class="lf-travel"></div>
    </div>`;
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); if (!closeSheet()) closeHub(); });
    document.body.append(dlg);
    const app = dlg.querySelector('#lf-app');
    app.addEventListener('click', onClick);
    app.addEventListener('change', onChange);
    app.addEventListener('input', onInput);
    app.addEventListener('pointerdown', onPointerDown);
    app.addEventListener('pointerdown', ripple, true);
}

function ripple(ev) {
    const b = ev.target.closest('.lf-btn, .lf-tab, .lf-chip, .lf-card, .lf-pin, .lf-tile');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 1.6;
    const sp = document.createElement('span');
    sp.className = 'lf-ripple';
    sp.style.cssText = `width:${d}px;height:${d}px;left:${ev.clientX - r.left - d / 2}px;top:${ev.clientY - r.top - d / 2}px`;
    b.append(sp);
    setTimeout(() => sp.remove(), 650);
}

function openHub(tab) {
    if (!hasChat()) { toast('info', 'Сначала открой чат'); return; }
    openedAt = Date.now();
    buildHub();
    if (tab) ui.tab = tab;
    if (ui.tab === 'map' && !ui.mapStack.length) ui.mapStack = [];
    ui.open = true;
    render();
    const dlg = document.getElementById('lf-dialog');
    if (dlg && !dlg.open) {
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    }
    requestAnimationFrame(() => requestAnimationFrame(() => dlg?.classList.add('on')));
}

function closeHub() {
    ui.open = false;
    closeSheet();
    const dlg = document.getElementById('lf-dialog');
    if (!dlg) return;
    dlg.classList.remove('on');
    const t = openedAt;
    setTimeout(() => { if (dlg.open && !ui.open && openedAt === t) dlg.close(); }, 320);
}

function render() {
    const app = document.getElementById('lf-app');
    if (!app || !ui.open) return;
    app.querySelectorAll('.lf-tab').forEach((b, i) => {
        const on = b.dataset.tab === ui.tab;
        b.classList.toggle('on', on);
        if (on) app.querySelector('.lf-tab-ink').style.transform = `translateX(${i * 100}%)`;
    });
    const me = app.querySelector('.lf-me');
    if (me) me.innerHTML = ava(ctx().name1, 'lg');
    const body = app.querySelector('.lf-body');
    const keepScroll = body.dataset.tab === ui.tab ? body.scrollTop : 0;
    try {
        body.innerHTML = ui.tab === 'map' ? renderMap()
            : ui.tab === 'person' ? renderPerson()
                : ui.tab === 'world' ? renderWorld()
                    : renderScene();
    } catch (e) {
        console.error('[Life] render', e);
        body.innerHTML = `<div class="lf-empty"><div class="lf-empty-ico">🕯</div><b>Ошибка Life</b><pre class="lf-pre">${esc(String(e?.stack || e).slice(0, 900))}</pre>Сделай скрин и кинь Claude.</div>`;
    }
    body.dataset.tab = ui.tab;
    body.scrollTop = keepScroll;
}

// ───── вкладка «Сцена» ─────

function heroHtml(ch, st, { current = true } = {}) {
    const loc = current ? (st.scene?.location || ch?.loc || '') : (ch?.loc || '');
    const cover = placeCover(loc);
    const when = current ? fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time) : fmtWhen(ch?.date, ch?.time);
    const atm = current ? st.scene?.atmosphere : '';
    return `<section class="lf-hero${cover ? '' : ' no-img'}">
        <div class="lf-hero-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-hero-shade"></div>
        <button class="lf-glass" data-act="cover" data-loc="${esc(loc)}"><i class="fa-solid fa-image"></i> ${cover ? 'Обновить кадр' : 'Добавить кадр'}</button>
        <div class="lf-hero-txt">
            ${ch ? `<div class="lf-kicker">Глава ${pad2(ch.num)}</div>` : ''}
            <h1>${esc(ch?.title || placeName(loc))}</h1>
            <div class="lf-hero-meta"><i class="fa-solid ${esc(placeIcon(loc))}"></i> ${esc(loc ? locParts(loc).join(' · ') : 'место не отмечено')}${when ? ` <b>·</b> ${esc(when)}` : ''}${atm ? ` <b>·</b> ${esc(cut(atm, 40))}` : ''}</div>
        </div>
    </section>`;
}

function presentHtml(st) {
    const present = (st.scene?.characters_present || []).map(canonName).filter(Boolean);
    if (!present.length) return '';
    return `<div class="lf-present">${present.map(n => {
        const mood = Object.entries(st.mood || {}).find(([k]) => sameName(k, n))?.[1] || '';
        return `<button class="lf-pers" data-act="person" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span>${mood ? `<span class="lf-pers-m">${esc(cut(mood, 18))}</span>` : ''}</button>`;
    }).join('')}</div>`;
}

function chapterCard(ch, curStart) {
    const cover = placeCover(ch.loc);
    return `<button class="lf-card lf-chcard${ch.start === curStart ? ' on' : ''}" data-act="chapter" data-start="${ch.start}">
        <div class="lf-chcard-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : `<i class="fa-solid ${esc(placeIcon(ch.loc))}"></i>`}<span class="lf-chnum">${pad2(ch.num)}</span></div>
        <div class="lf-chcard-txt">
            <div class="lf-chcard-head"><b>${esc(ch.title)}</b><span>${esc(fmtWhen(ch.date, ch.time))}</span></div>
            <div class="lf-chcard-prev">${esc(ch.preview || '…')}</div>
            <div class="lf-chcard-meta">${ch.count} ${plural(ch.count, 'пост', 'поста', 'постов')}${ch.locs.length > 1 ? ` · ${esc(ch.locs.slice(0, 3).map(locLeaf).join(', '))}` : ''}</div>
        </div>
    </button>`;
}

function renderScene() {
    const st = worldState();
    const list = chapters();
    const fch = focusChapter(list) || list[list.length - 1];
    const last = list[list.length - 1];
    const isCur = !fch || fch === last;
    const warn = horaeOn() ? '' : `<div class="lf-note"><i class="fa-solid fa-triangle-exclamation"></i> Horae выключен или не найден — места и время беру только из уже записанного.</div>`;
    const shown = [...list].reverse().slice(0, ui.chShow);
    return `${warn}
    ${heroHtml(isCur ? last : fch, st, { current: isCur })}
    ${isCur ? presentHtml(st) : ''}
    <div class="lf-actions">
        <button class="lf-btn primary" data-act="read" data-start="${fch?.start ?? 0}"><i class="fa-solid fa-book-open"></i> ${isCur ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <button class="lf-btn" data-act="tab" data-tab="map"><i class="fa-solid fa-map-location-dot"></i> Карта</button>
        <button class="lf-btn" data-act="new-chapter"><i class="fa-solid fa-feather"></i> Новая глава</button>
    </div>
    <div class="lf-sec"><span>Главы</span><small>${list.length} ${plural(list.length, 'глава', 'главы', 'глав')} · один чат, модель видит всё</small></div>
    <div class="lf-chlist">${shown.map(ch => chapterCard(ch, fch?.start)).join('')}</div>
    ${list.length > shown.length ? `<button class="lf-btn ghost full" data-act="more-ch">Ещё ${Math.min(30, list.length - shown.length)}</button>` : ''}`;
}

// ───── вкладка «Карта» ─────

function mapLevel() {
    // [] — карта мира; [key] — план места
    const key = ui.mapStack[ui.mapStack.length - 1];
    return key ? { key, place: settings().places[key] } : null;
}

function pinsFor(level) {
    const s = settings();
    const world = currentWorld();
    const out = [];
    for (const [key, p] of Object.entries(s.places)) {
        if (p.x == null || p.y == null) continue;
        const parts = key.split('·');
        if (level) {
            if (parts.length < 2 || parts.slice(0, -1).join('·') !== level.key) continue;
        } else {
            if (parts.length !== 1 || (p.world && p.world !== world?.id)) continue;
        }
        out.push([key, p]);
    }
    return out;
}

function renderMap() {
    const s = settings();
    const st = worldState();
    const world = currentWorld();
    const level = mapLevel();
    const img = level ? level.place?.plan : world?.map;
    const curKey = placeKey(st.scene?.location);
    const curTop = norm(locTop(st.scene?.location));
    const present = (st.scene?.characters_present || []).map(canonName);
    const pins = pinsFor(level);
    const pinHtml = pins.map(([key, p]) => {
        const here = level ? key === curKey || curKey.startsWith(key + '·') : key === curTop;
        return `<button class="lf-pin${here ? ' here' : ''}${ui.editPins ? ' edit' : ''}" data-act="pin" data-key="${esc(key)}" style="left:${p.x}%;top:${p.y}%">
            <span class="lf-pin-label"><i class="fa-solid ${esc(p.icon || guessIcon(p.name))}"></i>${esc(locLeaf(p.name))}${here && present.length ? `<span class="lf-pin-who">${present.slice(0, 3).map(n => ava(n, 'xs')).join('')}</span>` : ''}</span>
            <span class="lf-pin-stem"></span><span class="lf-pin-dot"></span>
        </button>`;
    }).join('');

    // места без метки на этом уровне
    const known = knownLocations();
    const placed = new Set(pins.map(([k]) => k));
    const unplaced = [];
    for (const [k, raw] of known) {
        const parts = k.split('·');
        if (placed.has(k)) continue;
        if (level ? (parts.length >= 2 && parts.slice(0, -1).join('·') === level.key) : parts.length === 1) unplaced.push([k, raw]);
    }

    const title = level ? esc(level.place?.name || level.key) : esc(world?.name || 'Мир');
    const crumbs = level
        ? `<button class="lf-chip" data-act="map-up"><i class="fa-solid fa-arrow-left"></i> ${esc(ui.mapStack.length > 1 ? (s.places[ui.mapStack[ui.mapStack.length - 2]]?.name || 'назад') : (world?.name || 'Карта'))}</button>`
        : (s.worlds.length > 1 ? s.worlds.map(w => `<button class="lf-chip${w.id === world?.id ? ' on' : ''}" data-act="world-pick" data-id="${esc(w.id)}">${esc(w.name)}</button>`).join('') : '');
    const when = fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time);

    return `<div class="lf-headrow">
        <h2>${level ? '' : '<i class="fa-solid fa-map"></i> '}${title}</h2>
        ${when || st.scene?.atmosphere ? `<div class="lf-pill">${esc([when, cut(st.scene?.atmosphere || '', 22)].filter(Boolean).join(' · '))}</div>` : ''}
    </div>
    ${crumbs ? `<div class="lf-chips">${crumbs}</div>` : ''}
    ${img ? `<div class="lf-map${ui.editPins ? ' editing' : ''}">
            <div class="lf-map-in" data-act="map-tap"><img src="${esc(img)}" alt="" draggable="false">${pinHtml}</div>
            ${ui.editPins ? '<div class="lf-map-hint"><i class="fa-solid fa-hand-pointer"></i> Тапни по карте, чтобы поставить метку, тяни метку, чтобы подвинуть</div>' : ''}
        </div>`
        : `<div class="lf-mapempty">
            <div class="lf-empty-ico"><i class="fa-solid ${level ? 'fa-house-chimney' : 'fa-map'}"></i></div>
            <b>${level ? 'У этого места ещё нет плана' : 'Карты пока нет'}</b>
            <span>${level ? 'Загрузи план (квартира сверху, изометрия) или нарисуй — и расставь комнаты.' : 'Загрузи картинку города или нарисуй её — потом расставишь метки.'}</span>
            <div class="lf-actions center">
                <label class="lf-btn primary"><i class="fa-solid fa-upload"></i> Загрузить<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" hidden></label>
                <button class="lf-btn" data-act="${level ? 'draw-plan' : 'draw-map'}"><i class="fa-solid fa-wand-magic-sparkles"></i> Нарисовать</button>
            </div>
        </div>`}
    ${img ? `<div class="lf-actions">
        <button class="lf-btn${ui.editPins ? ' primary' : ''}" data-act="edit-pins"><i class="fa-solid fa-${ui.editPins ? 'check' : 'pen'}"></i> ${ui.editPins ? 'Готово' : 'Метки'}</button>
        <label class="lf-btn"><i class="fa-solid fa-image"></i> Сменить ${level ? 'план' : 'карту'}<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" hidden></label>
    </div>` : ''}
    ${current(st, level)}
    ${unplaced.length ? `<div class="lf-sec"><span>Без метки</span><small>${ui.editPins ? 'тапни место, потом точку на карте' : 'места из истории'}</small></div>
        <div class="lf-chips wrap">${unplaced.map(([k, raw]) => `<button class="lf-chip${ui.placing === k ? ' on' : ''}" data-act="${ui.editPins && img ? 'placing' : 'place'}" data-key="${esc(k)}" data-loc="${esc(raw)}"><i class="fa-solid ${esc(guessIcon(locLeaf(raw)))}"></i> ${esc(locLeaf(raw))}</button>`).join('')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="add-place"><i class="fa-solid fa-plus"></i> Новое место</button>`;
}

function current(st, level) {
    const loc = st.scene?.location;
    if (!loc) return '';
    if (level && !placeKey(loc).startsWith(level.key)) return '';
    return `<div class="lf-sec"><span>Вы здесь</span></div>${placeCard(loc, { compact: true })}`;
}

function chaptersAt(loc) {
    const key = placeKey(loc);
    const top = norm(locTop(loc));
    return chapters().filter(ch => ch.locs.some(l => { const k = placeKey(l); return k === key || k.startsWith(key + '·') || (key === top && norm(locTop(l)) === top); }));
}

function placeCard(loc, { compact = false } = {}) {
    const st = worldState();
    const cover = placeCover(loc);
    const desc = placeDesc(loc);
    const here = placeKey(st.scene?.location) === placeKey(loc) || placeKey(st.scene?.location).startsWith(placeKey(loc) + '·');
    const present = here ? (st.scene?.characters_present || []).map(canonName) : [];
    const chs = chaptersAt(loc);
    const key = placeKey(loc);
    const hasInside = !!getPlace(loc)?.plan || Object.keys(settings().places).some(k => k.startsWith(key + '·')) || [...knownLocations().keys()].some(k => k.startsWith(key + '·'));
    return `<div class="lf-place${compact ? ' compact' : ''}">
        <div class="lf-place-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : `<i class="fa-solid ${esc(placeIcon(loc))}"></i>`}</div>
        <div class="lf-place-txt">
            <h3>${esc(placeName(loc))}</h3>
            <div class="lf-place-meta">${present.length ? `${present.slice(0, 4).map(n => ava(n, 'xs')).join('')} ${esc(present.map(shortName).join(', '))} здесь` : chs.length ? `${chs.length} ${plural(chs.length, 'глава', 'главы', 'глав')} здесь` : 'ещё не бывали'}</div>
            ${desc && !compact ? `<div class="lf-place-desc">${esc(cut(desc, 220))}</div>` : ''}
            <div class="lf-actions tight">
                ${here ? '<span class="lf-here"><i class="fa-solid fa-location-crosshairs"></i> Вы здесь</span>' : `<button class="lf-btn primary" data-act="travel" data-loc="${esc(loc)}">Отправиться <i class="fa-solid fa-arrow-right"></i></button>`}
                ${hasInside ? `<button class="lf-btn" data-act="inside" data-key="${esc(key)}"><i class="fa-solid fa-door-open"></i> Внутри</button>` : ''}
                <button class="lf-btn icon" data-act="place-menu" data-loc="${esc(loc)}" title="Ещё"><i class="fa-solid fa-ellipsis"></i></button>
            </div>
        </div>
    </div>`;
}

// ───── вкладка «Персонаж» ─────

function wardrobeWorn(name) {
    const w = ctx().chatMetadata?.wardrobe;
    if (!w?.chars) return null;
    for (const [n, st] of Object.entries(w.chars)) if (sameName(n, name)) return st?.worn || [];
    return null;
}

function renderPerson() {
    const st = worldState();
    const names = castNames(st);
    if (!ui.who || !names.some(n => sameName(n, ui.who))) ui.who = (st.scene?.characters_present || []).map(canonName).find(n => !sameName(n, ctx().name1)) || names.find(n => !sameName(n, ctx().name1)) || names[0] || '';
    const who = ui.who;
    if (!who) return `<div class="lf-empty"><div class="lf-empty-ico">🕯</div>В этом чате пока никого.</div>`;
    const mood = Object.entries(st.mood || {}).find(([k]) => sameName(k, who))?.[1] || '';
    const presentHere = (st.scene?.characters_present || []).some(n => sameName(n, who));
    const costume = Object.entries(st.costumes || {}).find(([k]) => sameName(k, who))?.[1] || '';
    const worn = wardrobeWorn(who);
    const full = avatarUrl(who, true);
    const items = Object.entries(st.items || {});
    const mine = items.filter(([, it]) => sameName(it?.holder, who));
    const tabItems = ui.itemsTab === 'with' ? mine
        : ui.itemsTab === 'around' ? items.filter(([, it]) => !it?.holder || !castNames(st).some(n => sameName(n, it.holder)))
            : items;
    const rels = relationships().filter(r => sameName(r.from, who) || sameName(r.to, who));
    const aff = Object.entries(st.affection || {}).find(([k]) => sameName(k, who))?.[1];

    return `<div class="lf-people">${names.map(n => `<button class="lf-pers${sameName(n, who) ? ' on' : ''}" data-act="who" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div>
    <section class="lf-portrait">
        <div class="lf-portrait-img"${full ? ` style="background-image:url('${esc(full)}')"` : ''}></div>
        <div class="lf-portrait-txt">
            <h2>${esc(who)}</h2>
            <div class="lf-tags">
                <span class="lf-tag${presentHere ? ' on' : ''}"><i class="fa-solid ${presentHere ? 'fa-location-crosshairs' : 'fa-moon'}"></i> ${presentHere ? esc(cut(locLeaf(st.scene.location) || 'в сцене', 26)) : 'не в сцене'}</span>
                ${mood ? `<span class="lf-tag"><i class="fa-solid fa-heart-pulse"></i> ${esc(cut(mood, 40))}</span>` : ''}
                ${typeof aff === 'number' ? `<span class="lf-tag"><i class="fa-solid fa-heart"></i> ${aff}</span>` : ''}
            </div>
            ${costume && !worn?.length ? `<div class="lf-costume"><i class="fa-solid fa-shirt"></i> ${esc(cut(costume, 220))}</div>` : ''}
            <div class="lf-actions tight">
                <button class="lf-btn primary" data-act="wardrobe" data-name="${esc(who)}"><i class="fa-solid fa-shirt"></i> Гардероб</button>
            </div>
        </div>
    </section>
    ${worn?.length ? `<div class="lf-sec"><span>Сейчас на ${esc(shortName(who))}</span><small>из Гардероба</small></div>
        <div class="lf-grid">${worn.slice(0, 12).map(e => `<button class="lf-tile" data-act="wardrobe" data-name="${esc(who)}">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : '<span class="lf-tile-ico"><i class="fa-solid fa-shirt"></i></span>'}<span class="lf-tile-n">${esc(cut(e.name, 28))}</span></button>`).join('')}</div>` : ''}
    <div class="lf-sec"><span>Инвентарь</span><small>ведёт Horae</small></div>
    <div class="lf-seg">${[['with', `С собой (${mine.length})`], ['around', 'Рядом/дома'], ['all', `Всё (${items.length})`]].map(([k, t]) => `<button class="lf-chip${ui.itemsTab === k ? ' on' : ''}" data-act="items-tab" data-tab="${k}">${esc(t)}</button>`).join('')}</div>
    ${tabItems.length ? `<div class="lf-grid">${tabItems.slice(0, 60).map(([name, it]) => itemTile(name, it)).join('')}</div>`
        : `<div class="lf-empty small">${ui.itemsTab === 'with' ? 'При себе ничего не записано.' : 'Пусто.'}</div>`}
    ${rels.length ? `<div class="lf-sec"><span>Отношения</span></div>
        <div class="lf-rels">${rels.map(r => {
            const other = sameName(r.from, who) ? r.to : r.from;
            return `<div class="lf-rel">${ava(canonName(other), 'md')}<div><b>${esc(shortName(canonName(other)))}</b><span>${esc(r.type || '')}</span>${r.note ? `<small>${esc(cut(r.note, 140))}</small>` : ''}</div></div>`;
        }).join('')}</div>` : ''}`;
}

function itemTile(name, it) {
    const img = settings().itemImgs[norm(name)];
    const imp = it?.importance === '!!' ? ' crit' : it?.importance === '!' ? ' imp' : '';
    return `<button class="lf-tile${imp}" data-act="item" data-name="${esc(name)}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="lf-tile-ico">${esc(it?.icon || '✦')}</span>`}
        <span class="lf-tile-n">${esc(cut(name, 30))}</span>
        ${imp ? '<i class="lf-tile-star fa-solid fa-sparkles"></i>' : ''}
    </button>`;
}

// ───── вкладка «Мир» ─────

function renderWorld() {
    const st = worldState();
    const world = currentWorld();
    const tabs = [['events', 'События'], ['agenda', 'Планы'], ['places', 'Места'], ['cfg', 'Настройки']];
    let body = '';
    if (ui.worldTab === 'events') {
        const ev = horaeEvents().slice(-80).reverse();
        body = ev.length ? `<div class="lf-timeline">${ev.map(e => {
            const ch = chapterOf(e.messageIndex);
            const cover = ch ? placeCover(ch.loc) : '';
            return `<button class="lf-tl" data-act="jump" data-mes="${e.messageIndex}">
                <span class="lf-tl-dot"></span>
                <span class="lf-tl-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></span>
                <span class="lf-tl-txt"><small>${esc(fmtWhen(e.timestamp?.story_date, e.timestamp?.story_time) || `#${e.messageIndex}`)}${ch ? ` · гл. ${ch.num}` : ''}</small>${esc(e.event?.summary)}</span>
            </button>`;
        }).join('')}</div>` : `<div class="lf-empty small">Horae ещё не записал событий.</div>`;
    } else if (ui.worldTab === 'agenda') {
        const ag = horaeAgenda();
        body = ag.length ? `<div class="lf-list">${ag.map(a => `<button class="lf-row" data-act="jump" data-mes="${a.messageIndex}"><i class="fa-solid fa-calendar-day"></i><span>${a.date ? `<b>${esc(a.date)}</b> · ` : ''}${esc(a.text)}</span><i class="fa-solid fa-chevron-right lf-dim"></i></button>`).join('')}</div>`
            : `<div class="lf-empty small">Планов нет.</div>`;
    } else if (ui.worldTab === 'places') {
        const known = [...knownLocations().values()];
        body = known.length ? known.map(l => placeCard(l)).join('') : `<div class="lf-empty small">Мест пока нет.</div>`;
    } else {
        body = renderCfg(world);
    }
    const when = fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time);
    return `<section class="lf-worldhead"${world?.cover ? ` style="background-image:linear-gradient(180deg,rgba(15,11,13,.15),rgba(15,11,13,.92)),url('${esc(world.cover)}')"` : ''}>
        <div class="lf-kicker">Мир</div>
        <h1>${esc(world?.name || 'Мир')}</h1>
        <div class="lf-hero-meta">${when ? `<i class="fa-regular fa-clock"></i> ${esc(when)}` : 'время не записано'}${st.scene?.atmosphere ? ` <b>·</b> ${esc(cut(st.scene.atmosphere, 40))}` : ''}</div>
    </section>
    <div class="lf-seg">${tabs.map(([k, t]) => `<button class="lf-chip${ui.worldTab === k ? ' on' : ''}" data-act="world-tab" data-tab="${k}">${t}</button>`).join('')}</div>
    ${body}`;
}

function renderCfg(world) {
    const s = settings();
    const sw = (k, label) => `<label class="lf-switch"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span></span>${label}</label>`;
    return `<div class="lf-form">
        ${sw('enabled', 'Life включён (главы в чате, кнопки, заметка о переходе)')}
        ${sw('dividers', 'Разделители глав в чате')}
        ${sw('focusDefault', 'Показывать только текущую главу (как комнату)')}
        ${sw('showFab', 'Плавающая кнопка ✦')}
        <div class="lf-field"><label>Новая глава, когда меняется</label>
            <select data-set="chapterBy"><option value="top" ${s.chapterBy !== 'full' ? 'selected' : ''}>место целиком (квартира → бар)</option><option value="full" ${s.chapterBy === 'full' ? 'selected' : ''}>даже комната (кухня → спальня)</option></select></div>
        <div class="lf-sec"><span>Мир «${esc(world?.name)}»</span></div>
        <div class="lf-field"><label>Название</label><input type="text" data-world="name" value="${esc(world?.name)}"></div>
        <div class="lf-field"><label>Пара слов о мире для картинок <small>(город, эпоха, настроение)</small></label><input type="text" data-world="note" value="${esc(world?.note)}" placeholder="Нью-Йорк, зима 2024, снег"></div>
        <div class="lf-actions">
            <label class="lf-btn"><i class="fa-solid fa-image"></i> Обложка мира<input type="file" accept="image/*" data-file="wcover" hidden></label>
            <label class="lf-btn"><i class="fa-solid fa-map"></i> Карта мира<input type="file" accept="image/*" data-file="map" hidden></label>
        </div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="world-new"><i class="fa-solid fa-plus"></i> Ещё мир</button>
            ${s.worlds.length > 1 ? '<button class="lf-btn danger" data-act="world-del"><i class="fa-solid fa-trash"></i> Удалить мир</button>' : ''}
        </div>
        <div class="lf-field"><label>Стиль картинок <small>(по-английски)</small></label><textarea rows="3" data-set="artStyle">${esc(s.artStyle)}</textarea></div>
        <div class="lf-field"><label>Как зовут персонажей в тексте <small>(Имя карточки = прозвища; прозвища из Гардероба уже учтены)</small></label><textarea rows="3" data-set="aliases" placeholder="Bucky Barnes = Баки, Джеймс">${esc(s.aliases)}</textarea></div>
        <div class="lf-field"><label>Что сейчас уходит модели от Life</label><pre class="lf-pre">${esc(updateMovePrompt() || '— ничего: Life молчит, пока ты не нажмёшь «Отправиться» или «Новая глава» —')}</pre></div>
        <div class="lf-foot">Life ${VERSION} · Horae ${esc(window.Horae?.version || 'не найден')} · <code>/life</code></div>
    </div>`;
}

// ───── листы (bottom sheets) ─────

function openSheet(title, html, onMount) {
    const host = document.querySelector('#lf-app .lf-sheet-host');
    if (!host) return null;
    host.innerHTML = `<div class="lf-sheet-back" data-act="sheet-close"></div>
        <div class="lf-sheet" role="dialog">
            <div class="lf-sheet-grab"></div>
            <div class="lf-sheet-head"><div class="lf-sheet-title">${title}</div><button class="lf-x" data-act="sheet-close"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="lf-sheet-body">${html}</div>
        </div>`;
    host.classList.add('on');
    const box = host.querySelector('.lf-sheet');
    requestAnimationFrame(() => host.classList.add('in'));
    onMount?.(box);
    return box;
}

function closeSheet() {
    const host = document.querySelector('#lf-app .lf-sheet-host');
    if (!host?.classList.contains('on')) return false;
    host.classList.remove('in');
    setTimeout(() => { host.classList.remove('on'); host.innerHTML = ''; }, 220);
    ui.placing = null;
    return true;
}

function travelSheet(loc) {
    const st = worldState();
    const present = (st.scene?.characters_present || []).map(canonName);
    const cast = castNames(st);
    const who = present.length ? present : cast;
    const cover = placeCover(loc);
    openSheet(`<i class="fa-solid ${esc(placeIcon(loc))}"></i> ${esc(placeName(loc))}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-field"><label>Кто идёт</label>
            <div class="lf-people wrap">${cast.map(n => `<button class="lf-pers sel${who.some(x => sameName(x, n)) ? ' on' : ''}" data-act="toggle" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div></div>
        <div class="lf-field"><label>Как</label>
            <div class="lf-chips wrap" data-how>${['пешком', 'на машине', 'на мотоцикле', 'на такси', 'на квинджете'].map(h => `<button class="lf-chip" data-act="how" data-how="${h}">${h}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Заметка для модели <small>(необязательно)</small></label><input type="text" data-in="note" placeholder="например: едут молча после ссоры"></div>
        <button class="lf-btn primary full big" data-act="travel-go" data-loc="${esc(loc)}"><i class="fa-solid fa-route"></i> Отправиться</button>
        <div class="lf-hint">В чат встанет разделитель новой главы, Horae запомнит новое место, а модель один раз получит короткую заметку о переходе. Пост пишешь ты, как обычно.</div>`);
}

async function playTravel(loc, how) {
    const host = document.querySelector('#lf-app .lf-travel');
    if (!host) return;
    const cover = placeCover(loc);
    host.innerHTML = `<div class="lf-travel-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-travel-txt"><i class="fa-solid ${how === 'на машине' || how === 'на такси' ? 'fa-car-side' : how === 'на мотоцикле' ? 'fa-motorcycle' : how === 'на квинджете' ? 'fa-jet-fighter' : 'fa-person-walking'}"></i>
        <small>${esc(how || 'в путь')}</small><b>${esc(placeName(loc))}</b><span class="lf-travel-bar"><i></i></span></div>`;
    host.classList.add('on');
    await new Promise(r => setTimeout(r, 1500));
    host.classList.add('out');
    await new Promise(r => setTimeout(r, 380));
    host.classList.remove('on', 'out');
    host.innerHTML = '';
}

function newChapterSheet() {
    const st = worldState();
    openSheet('<i class="fa-solid fa-feather"></i> Новая глава', `
        <div class="lf-field"><label>Название главы</label><input type="text" data-in="title" placeholder="например: Утро после"></div>
        <div class="lf-field"><label>Место <small>(пусто — то же: ${esc(placeName(st.scene?.location))})</small></label><input type="text" data-in="loc" placeholder="${esc(st.scene?.location || 'Квартира·Кухня')}"></div>
        <div class="lf-field"><label>Что изменилось <small>(уйдёт модели одной строкой)</small></label>
            <div class="lf-chips wrap">${['Прошла ночь, утро.', 'Прошло несколько часов.', 'Прошло несколько дней.', 'Тем временем, в другом месте.'].map(t => `<button class="lf-chip" data-act="fill-note" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <input type="text" data-in="note" placeholder="или своими словами"></div>
        <button class="lf-btn primary full big" data-act="chapter-go"><i class="fa-solid fa-feather"></i> Начать главу</button>`);
}

function placeMenu(loc) {
    const p = getPlace(loc);
    const key = placeKey(loc);
    openSheet(`<i class="fa-solid ${esc(placeIcon(loc))}"></i> ${esc(placeName(loc))}`, `
        ${placeCard(loc)}
        <div class="lf-sec"><span>Картинка</span></div>
        <div class="lf-actions">
            <label class="lf-btn"><i class="fa-solid fa-upload"></i> Своя<input type="file" accept="image/*" data-file="place" data-loc="${esc(loc)}" hidden></label>
            <button class="lf-btn" data-act="draw-place" data-loc="${esc(loc)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Нарисовать</button>
            ${p?.img ? `<button class="lf-btn" data-act="place-noimg" data-loc="${esc(loc)}"><i class="fa-solid fa-image"></i> Убрать</button>` : ''}
        </div>
        <div class="lf-sec"><span>План внутри</span><small>комнаты = «${esc(locTop(loc))}·Кухня» и т.п.</small></div>
        <div class="lf-actions">
            <label class="lf-btn"><i class="fa-solid fa-upload"></i> ${p?.plan ? 'Сменить план' : 'Загрузить план'}<input type="file" accept="image/*" data-file="plan" data-key="${esc(key)}" hidden></label>
            <button class="lf-btn" data-act="draw-plan" data-key="${esc(key)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Нарисовать план</button>
        </div>
        <div class="lf-sec"><span>Значок</span></div>
        <div class="lf-chips wrap">${[...new Set(['fa-location-dot', ...ICONS.map(x => x[0])])].map(ic => `<button class="lf-chip icon${(p?.icon || guessIcon(locLeaf(loc))) === ic ? ' on' : ''}" data-act="place-icon" data-icon="${ic}" data-loc="${esc(loc)}"><i class="fa-solid ${ic}"></i></button>`).join('')}</div>
        <div class="lf-field"><label>Название на карте</label><div class="lf-inline"><input type="text" data-in="pname" value="${esc(placeName(loc))}"><button class="lf-btn" data-act="place-rename" data-loc="${esc(loc)}">OK</button></div></div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="place-chapters" data-loc="${esc(loc)}"><i class="fa-solid fa-book-open"></i> Главы здесь</button>
            ${p?.x != null ? `<button class="lf-btn danger" data-act="unpin" data-loc="${esc(loc)}"><i class="fa-solid fa-location-pin-lock"></i> Снять метку</button>` : ''}
        </div>`);
}

function itemSheet(name) {
    const st = worldState();
    const it = st.items?.[name] || {};
    const img = settings().itemImgs[norm(name)];
    const ch = (() => {
        // где вещь впервые появилась
        const chat = chatArr();
        for (let i = 0; i < chat.length; i++) if (chat[i]?.horae_meta?.items?.[name]) return { i, ts: chat[i].horae_meta.timestamp };
        return null;
    })();
    openSheet(`${esc(it.icon || '✦')} ${esc(name)}`, `
        <div class="lf-item-big">${img ? `<img src="${esc(img)}" alt="">` : `<span>${esc(it.icon || '✦')}</span>`}</div>
        <div class="lf-list">
            ${it.holder ? `<div class="lf-row"><i class="fa-solid fa-user"></i><span>Владелец: <b>${esc(it.holder)}</b></span></div>` : ''}
            ${it.location ? `<div class="lf-row"><i class="fa-solid fa-location-dot"></i><span>Где: ${esc(it.location)}</span></div>` : ''}
            ${it.description ? `<div class="lf-row"><i class="fa-regular fa-file-lines"></i><span>${esc(it.description)}</span></div>` : ''}
            ${ch ? `<button class="lf-row" data-act="jump" data-mes="${ch.i}"><i class="fa-regular fa-clock"></i><span>Появилась: ${esc(fmtWhen(ch.ts?.story_date, ch.ts?.story_time) || `#${ch.i}`)}</span><i class="fa-solid fa-chevron-right lf-dim"></i></button>` : ''}
        </div>
        <div class="lf-actions">
            <label class="lf-btn"><i class="fa-solid fa-camera"></i> Фото<input type="file" accept="image/*" data-file="item" data-name="${esc(name)}" hidden></label>
            <button class="lf-btn" data-act="draw-item" data-name="${esc(name)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Нарисовать</button>
        </div>
        <div class="lf-hint">Вещи ведёт Horae: передать или выбросить — просто напиши это в посте, он сам перепишет владельца.</div>`);
}

function addPlaceSheet(x = null, y = null) {
    const level = mapLevel();
    openSheet('<i class="fa-solid fa-plus"></i> Новое место', `
        <div class="lf-field"><label>Название${level ? ` <small>(внутри «${esc(level.place?.name || level.key)}»)</small>` : ''}</label><input type="text" data-in="newplace" placeholder="${level ? 'Кухня' : 'Бар «Полночь»'}"></div>
        <button class="lf-btn primary full" data-act="add-place-ok" ${x != null ? `data-x="${x}" data-y="${y}"` : ''}><i class="fa-solid fa-check"></i> Добавить</button>`);
}

// ───── обработчики ─────

async function withBusy(el, fn, label = 'Рисую…') {
    const html = el?.innerHTML;
    if (el) { el.disabled = true; el.classList.add('busy'); el.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${label}`; }
    try { return await fn(); } catch (e) {
        console.warn('[Life]', e);
        toast('warning', esc(String(e?.message || e)), '✦ Life', { timeOut: 9000, escapeHtml: false });
    } finally {
        if (el?.isConnected) { el.disabled = false; el.classList.remove('busy'); el.innerHTML = html; }
    }
}

function setPlaceImg(loc, path) {
    const p = getPlace(loc, true);
    p.img = path;
    saveSettings();
}

let pinDrag = null;

function onPointerDown(ev) {
    if (!ui.editPins) return;
    const pin = ev.target.closest('.lf-pin');
    if (!pin) return;
    const box = pin.closest('.lf-map-in');
    if (!box) return;
    pinDrag = { pin, box, key: pin.dataset.key, x0: ev.clientX, y0: ev.clientY, moved: false };
    pin.setPointerCapture?.(ev.pointerId);
    const move = (e) => {
        if (!pinDrag) return;
        if (!pinDrag.moved && Math.hypot(e.clientX - pinDrag.x0, e.clientY - pinDrag.y0) < 6) return;
        pinDrag.moved = true;
        const r = box.getBoundingClientRect();
        const x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
        const y = Math.min(98, Math.max(2, ((e.clientY - r.top) / r.height) * 100));
        pin.style.left = `${x}%`;
        pin.style.top = `${y}%`;
        pinDrag.x = x; pinDrag.y = y;
    };
    const up = () => {
        pin.removeEventListener('pointermove', move);
        pin.removeEventListener('pointerup', up);
        pin.removeEventListener('pointercancel', up);
        if (pinDrag?.moved) {
            const p = settings().places[pinDrag.key];
            if (p) { p.x = Math.round(pinDrag.x * 10) / 10; p.y = Math.round(pinDrag.y * 10) / 10; saveSettings(); }
            pinDrag.justMoved = Date.now();
        }
        setTimeout(() => { pinDrag = null; }, 50);
    };
    pin.addEventListener('pointermove', move);
    pin.addEventListener('pointerup', up);
    pin.addEventListener('pointercancel', up);
}

function placePin(key, raw, x, y) {
    const s = settings();
    const level = mapLevel();
    if (!s.places[key]) s.places[key] = { name: locParts(raw).join(' · '), raw, icon: guessIcon(locLeaf(raw)), img: '', plan: '', world: '', x: null, y: null };
    const p = s.places[key];
    p.x = Math.round(x * 10) / 10;
    p.y = Math.round(y * 10) / 10;
    if (!level) p.world = currentWorld()?.id || '';
    saveSettings();
}

async function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || !document.getElementById('lf-app')?.contains(el)) return;
    if (el.tagName === 'LABEL') return; // загрузка файла — сам input
    const act = el.dataset.act;
    const box = el.closest('.lf-sheet');
    const s = settings();
    const loc = el.dataset.loc;
    const val = (sel) => box?.querySelector(sel)?.value?.trim() || '';

    switch (act) {
        case 'close': if (Date.now() - openedAt > 350) closeHub(); break;
        case 'sheet-close': closeSheet(); break;
        case 'tab': ui.tab = el.dataset.tab; ui.editPins = false; closeSheet(); render(); document.querySelector('#lf-app .lf-body')?.scrollTo(0, 0); break;
        case 'person': case 'who': ui.who = el.dataset.name; ui.tab = 'person'; render(); break;
        case 'items-tab': ui.itemsTab = el.dataset.tab; render(); break;
        case 'world-tab': ui.worldTab = el.dataset.tab; render(); break;
        case 'more-ch': ui.chShow += 30; render(); break;
        case 'chapter': {
            const st = Number(el.dataset.start);
            const list = chapters();
            const ch = list.find(x => x.start === st);
            if (!ch) break;
            chapterSheet(ch);
            break;
        }
        case 'read': await gotoChapter(Number(el.dataset.start)); break;
        case 'jump': {
            const id = Number(el.dataset.mes);
            const ch = chapterOf(id);
            if (ch) ui.focus = ch.idx === chapters().length - 1 ? 'last' : ch.start;
            closeHub();
            decorate();
            await jumpTo(id);
            break;
        }
        case 'ch-rename': {
            const meta = chatMeta();
            meta.titles = meta.titles || {};
            const t = val('[data-in="chtitle"]');
            if (t) meta.titles[el.dataset.start] = t; else delete meta.titles[el.dataset.start];
            meta.ver = (meta.ver || 0) + 1;
            ctx().saveMetadataDebounced?.();
            invalidate(); closeSheet(); render(); decorate();
            break;
        }
        case 'ch-unmark': {
            if (!confirm('Убрать разделитель? Глава сольётся с предыдущей (если место то же).')) break;
            await removeMarker(Number(el.dataset.mes));
            closeSheet(); render(); decorate();
            break;
        }
        case 'cover': {
            const l = el.dataset.loc;
            if (!l) { toast('info', 'Место ещё не отмечено — сначала Horae должен его записать или отправься куда-нибудь с карты'); break; }
            placeMenu(l);
            break;
        }
        case 'new-chapter': newChapterSheet(); break;
        case 'fill-note': { const inp = box?.querySelector('[data-in="note"]'); if (inp) inp.value = el.dataset.text; break; }
        case 'chapter-go': {
            const title = val('[data-in="title"]');
            const l = val('[data-in="loc"]');
            const note = val('[data-in="note"]');
            if (!title && !l && !note) { toast('info', 'Дай главе название, место или заметку'); break; }
            closeSheet();
            const id = await insertMarker({ location: l, title, note });
            ui.focus = 'last';
            closeHub();
            decorate();
            scrollChatBottom();
            toast('success', `Глава «${esc(title || placeName(l) || 'новая')}» началась — пиши пост`);
            void id;
            break;
        }

        // карта
        case 'world-pick': { chatMeta().world = el.dataset.id; ctx().saveMetadataDebounced?.(); ui.mapStack = []; render(); break; }
        case 'map-up': ui.mapStack.pop(); ui.editPins = false; render(); break;
        case 'inside': ui.mapStack.push(el.dataset.key); ui.tab = 'map'; ui.editPins = false; closeSheet(); render(); break;
        case 'edit-pins': ui.editPins = !ui.editPins; ui.placing = null; render(); break;
        case 'placing': ui.placing = el.dataset.key; ui.placingRaw = el.dataset.loc; render(); toast('info', 'Теперь тапни точку на карте', '✦ Life', { timeOut: 1800 }); break;
        case 'map-tap': {
            if (!ui.editPins || ev.target.closest('.lf-pin')) break;
            const r = el.getBoundingClientRect();
            const x = ((ev.clientX - r.left) / r.width) * 100;
            const y = ((ev.clientY - r.top) / r.height) * 100;
            if (ui.placing) {
                placePin(ui.placing, ui.placingRaw || ui.placing, x, y);
                ui.placing = null;
                render();
            } else addPlaceSheet(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
            break;
        }
        case 'pin': {
            if (pinDrag?.moved || (pinDrag?.justMoved && Date.now() - pinDrag.justMoved < 300)) break;
            const p = s.places[el.dataset.key];
            if (!p) break;
            if (ui.editPins) { placeMenu(p.raw || p.name); break; }
            openSheet(`<i class="fa-solid ${esc(p.icon || 'fa-location-dot')}"></i> ${esc(p.name)}`, placeCard(p.raw || p.name));
            break;
        }
        case 'place': openSheet(`<i class="fa-solid ${esc(placeIcon(loc))}"></i> ${esc(placeName(loc))}`, placeCard(loc)); break;
        case 'place-menu': placeMenu(loc); break;
        case 'travel': travelSheet(loc); break;
        case 'toggle': el.classList.toggle('on'); break;
        case 'how': {
            const on = !el.classList.contains('on');
            box?.querySelectorAll('[data-how] .lf-chip').forEach(x => x.classList.remove('on'));
            el.classList.toggle('on', on);
            break;
        }
        case 'travel-go': {
            // имена — так, как их пишет Horae (иначе он не сопоставит одежду и настроение с присутствующими)
            const prev = worldState();
            const horaeNames = [...(prev.scene?.characters_present || []), ...Object.keys(prev.costumes || {}), ...Object.keys(prev.mood || {})];
            const who = [...box.querySelectorAll('.lf-pers.sel.on')].map(x => x.dataset.name).map(n => horaeNames.find(h => sameName(h, n)) || n);
            const how = box.querySelector('[data-how] .lf-chip.on')?.dataset.how || '';
            const note = val('[data-in="note"]');
            const raw = getPlace(loc)?.raw || loc;
            closeSheet();
            await playTravel(raw, how);
            try {
                await insertMarker({ location: raw, who, how, note });
                ui.focus = 'last';
                ui.mapStack = [];
                closeHub();
                decorate();
                scrollChatBottom();
                toast('success', `Вы в «${esc(placeName(raw))}» — пиши пост`, '✦ Life', { timeOut: 2500 });
            } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'add-place': addPlaceSheet(); break;
        case 'add-place-ok': {
            let name = val('[data-in="newplace"]');
            if (!name) break;
            const level = mapLevel();
            if (level) name = `${level.place?.raw || level.place?.name || level.key}·${name}`;
            const key = placeKey(name);
            const p = getPlace(name, true);
            p.raw = name;
            if (el.dataset.x) { p.x = Number(el.dataset.x); p.y = Number(el.dataset.y); if (!level) p.world = currentWorld()?.id || ''; }
            saveSettings();
            closeSheet();
            render();
            void key;
            break;
        }
        case 'place-icon': { getPlace(loc, true).icon = el.dataset.icon; saveSettings(); box?.querySelectorAll('.lf-chip.icon').forEach(x => x.classList.toggle('on', x === el)); render(); break; }
        case 'place-rename': { const n = val('[data-in="pname"]'); if (n) { getPlace(loc, true).name = n; saveSettings(); closeSheet(); render(); decorate(); } break; }
        case 'place-noimg': { const p = getPlace(loc); if (p) { p.img = ''; saveSettings(); } closeSheet(); render(); decorate(); break; }
        case 'unpin': { const p = getPlace(loc); if (p) { p.x = null; p.y = null; saveSettings(); } closeSheet(); render(); break; }
        case 'place-chapters': {
            const chs = chaptersAt(loc).reverse();
            openSheet(`Главы: ${esc(placeName(loc))}`, chs.length ? `<div class="lf-chlist">${chs.map(ch => chapterCard(ch, -1)).join('')}</div>` : '<div class="lf-empty small">Здесь ещё ничего не было.</div>');
            break;
        }
        case 'draw-place': await withBusy(el, async () => { setPlaceImg(loc, await drawPicture(placePrompt(loc))); closeSheet(); render(); decorate(); toast('success', 'Кадр готов'); }); break;
        case 'draw-map': await withBusy(el, async () => { const w = currentWorld(); w.map = await drawPicture(mapPrompt(w), { aspect: '4:3', max: 2000 }); saveSettings(); render(); }); break;
        case 'draw-plan': await withBusy(el, async () => {
            const key = el.dataset.key || mapLevel()?.key;
            const p = s.places[key] || getPlace(key, true);
            p.plan = await drawPicture(planPrompt(p.raw || p.name), { aspect: '4:3', max: 2000 });
            saveSettings(); closeSheet(); render();
        }); break;
        case 'draw-item': await withBusy(el, async () => {
            const name = el.dataset.name;
            s.itemImgs[norm(name)] = await drawPicture(itemPrompt(name, worldState().items?.[name]), { aspect: '1:1', max: 900 });
            saveSettings(); closeSheet(); render();
        }); break;
        case 'item': itemSheet(el.dataset.name); break;
        case 'wardrobe': {
            closeHub();
            try { await ctx().executeSlashCommandsWithOptions?.('/wardrobe'); } catch { toast('info', 'Гардероб не найден'); }
            break;
        }
        case 'world-new': {
            const w = { id: uid(), name: `Мир ${s.worlds.length + 1}`, cover: '', map: '', note: '' };
            s.worlds.push(w);
            chatMeta().world = w.id;
            ctx().saveMetadataDebounced?.();
            saveSettings(); render();
            break;
        }
        case 'world-del': {
            const w = currentWorld();
            if (!w || s.worlds.length < 2 || !confirm(`Удалить мир «${w.name}»? Метки этого мира пропадут с карты (места останутся).`)) break;
            s.worlds = s.worlds.filter(x => x.id !== w.id);
            for (const p of Object.values(s.places)) if (p.world === w.id) { p.world = ''; p.x = null; p.y = null; }
            chatMeta().world = s.worlds[0].id;
            ctx().saveMetadataDebounced?.();
            saveSettings(); render();
            break;
        }
    }
}

function chapterSheet(ch) {
    const list = chapters();
    const isLast = ch.idx === list.length - 1;
    const cover = placeCover(ch.loc);
    const marker = ch.marker >= 0 ? ch.marker : -1;
    openSheet(`Глава ${pad2(ch.num)}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}><div class="lf-sheet-cover-t"><b>${esc(ch.title)}</b><span>${esc([locParts(ch.loc).join(' · '), fmtWhen(ch.date, ch.time)].filter(Boolean).join(' — '))}</span></div></div>
        <div class="lf-chcard-prev big">${esc(ch.preview || '…')}</div>
        <div class="lf-hint">${ch.count} ${plural(ch.count, 'пост', 'поста', 'постов')} · сообщения #${ch.start}–${ch.end}${ch.locs.length > 1 ? ` · ${esc(ch.locs.map(l => locParts(l).join(' · ')).join(' → '))}` : ''}</div>
        <button class="lf-btn primary full big" data-act="read" data-start="${ch.start}"><i class="fa-solid fa-book-open"></i> ${isLast ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <div class="lf-field"><label>Название главы</label><div class="lf-inline"><input type="text" data-in="chtitle" value="${esc(chatMeta().titles?.[ch.start] || ch.title)}"><button class="lf-btn" data-act="ch-rename" data-start="${ch.start}">OK</button></div></div>
        <div class="lf-actions">
            ${ch.loc ? `<button class="lf-btn" data-act="place-menu" data-loc="${esc(ch.loc)}"><i class="fa-solid fa-image"></i> Кадр места</button>` : ''}
            ${marker >= 0 ? `<button class="lf-btn danger" data-act="ch-unmark" data-mes="${marker}"><i class="fa-solid fa-scissors"></i> Убрать разделитель</button>` : ''}
        </div>`);
}

async function onChange(ev) {
    const el = ev.target;
    const s = settings();
    if (el.dataset.set) {
        const k = el.dataset.set;
        s[k] = el.type === 'checkbox' ? el.checked : el.value;
        saveSettings();
        if (k === 'showFab') syncFab();
        if (k === 'focusDefault') ui.focus = s.focusDefault ? 'last' : null;
        if (['enabled', 'dividers', 'focusDefault', 'chapterBy', 'aliases'].includes(k)) { invalidate(); decorate(); }
        if (k === 'enabled') updateMovePrompt();
        if (el.type !== 'textarea' && el.tagName !== 'TEXTAREA') render();
        return;
    }
    if (el.dataset.world) {
        const w = currentWorld();
        if (w) { w[el.dataset.world] = el.value.trim(); saveSettings(); }
        return;
    }
    if (el.dataset.file && el.files?.[0]) {
        const file = el.files[0];
        const kind = el.dataset.file;
        const label = el.closest('label');
        await withBusy(label, async () => {
            const max = kind === 'map' || kind === 'plan' ? 2200 : kind === 'item' ? 900 : 1600;
            const path = await uploadImage(await fileToJpeg(file, max), `life_${kind}`);
            if (kind === 'map') { const w = currentWorld(); w.map = path; }
            else if (kind === 'wcover') { const w = currentWorld(); w.cover = path; }
            else if (kind === 'plan') {
                const key = el.dataset.key || mapLevel()?.key;
                const p = s.places[key] || getPlace(key, true);
                p.plan = path;
            } else if (kind === 'place') setPlaceImg(el.dataset.loc, path);
            else if (kind === 'item') s.itemImgs[norm(el.dataset.name)] = path;
            saveSettings();
            if (kind !== 'map' && kind !== 'wcover') closeSheet();
            render();
            decorate();
            toast('success', 'Картинка сохранена', '✦ Life', { timeOut: 1500 });
        }, 'Загружаю…');
    }
}

function onInput(ev) {
    const el = ev.target;
    if (el.dataset.set && (el.tagName === 'TEXTAREA')) {
        settings()[el.dataset.set] = el.value;
        saveSettings();
        if (el.dataset.set === 'aliases') invalidate();
    }
}

// ───────────── кнопка, меню, команда ─────────────

function syncFab() {
    const s = settings();
    let fab = document.getElementById('lf-fab');
    if (!s.showFab || !s.enabled) { fab?.remove(); return; }
    if (fab) return;
    fab = document.createElement('div');
    fab.id = 'lf-fab';
    fab.title = 'Life';
    fab.innerHTML = CANDLE_SVG;
    document.body.append(fab);
    if (s.fabPos) { fab.style.right = `${s.fabPos.r}px`; fab.style.bottom = `${s.fabPos.b}px`; }
    let start = null;
    fab.addEventListener('pointerdown', e => {
        const r = fab.getBoundingClientRect();
        start = { x: e.clientX, y: e.clientY, r: window.innerWidth - r.right, b: window.innerHeight - r.bottom, moved: false };
        fab.setPointerCapture?.(e.pointerId);
    });
    fab.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 8) return;
        start.moved = true;
        fab.style.right = `${Math.min(Math.max(4, start.r - dx), window.innerWidth - 56)}px`;
        fab.style.bottom = `${Math.min(Math.max(4, start.b - dy), window.innerHeight - 56)}px`;
    });
    fab.addEventListener('pointerup', () => {
        if (!start) return;
        if (start.moved) { settings().fabPos = { r: parseInt(fab.style.right) || 14, b: parseInt(fab.style.bottom) || 210 }; saveSettings(); }
        else if (ui.open) closeHub(); else openHub();
        start = null;
    });
}

function addWandButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lf-wand')) return !!menu;
    const btn = document.createElement('div');
    btn.id = 'lf-wand';
    btn.className = 'list-group-item flex-container flexGap5 interactable';
    btn.tabIndex = 0;
    btn.innerHTML = '<div class="fa-solid fa-map-location-dot extensionsMenuExtensionButton"></div><span>Life</span>';
    btn.addEventListener('click', () => openHub());
    menu.append(btn);
    return true;
}

function renderSettingsDrawer() {
    const s = settings();
    const host = document.getElementById('extensions_settings2');
    if (!host || document.getElementById('life_settings')) return;
    host.insertAdjacentHTML('beforeend', `
    <div id="life_settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header"><b>✦ Life</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input id="lf_set_enabled" type="checkbox" ${s.enabled ? 'checked' : ''}> Включено</label>
          <div id="lf_open_btn" class="menu_button"><i class="fa-solid fa-map-location-dot"></i> Открыть Life</div>
          <small>Все настройки — в самом хабе: Мир → Настройки. Команда <code>/life</code>, аварийно <code>/life off</code>.</small>
        </div>
      </div>
    </div>`);
    document.getElementById('lf_set_enabled')?.addEventListener('change', function () { setEnabled(this.checked); });
    document.getElementById('lf_open_btn')?.addEventListener('click', () => openHub());
}

function setEnabled(on) {
    const s = settings();
    s.enabled = !!on;
    saveSettings();
    syncFab();
    invalidate();
    decorate();
    updateMovePrompt();
    const cb = document.getElementById('lf_set_enabled');
    if (cb) cb.checked = s.enabled;
}

function registerSlash() {
    try {
        const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'life',
            helpString: 'Life: без аргумента — открыть хаб; map / person / world — открыть вкладку; all — показать весь чат; on / off — включить или выключить.',
            unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'map | person | world | all | on | off', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
            callback: async (_a, value) => {
                const v = String(value || '').trim().toLowerCase();
                if (v === 'on' || v === 'off') { setEnabled(v === 'on'); toast('info', v === 'on' ? 'Life включён' : 'Life выключен — чат как обычно'); return ''; }
                if (v === 'all') { ui.focus = null; decorate(); return ''; }
                openHub(['map', 'person', 'world'].includes(v) ? v : 'scene');
                return '';
            },
        }));
    } catch (e) { console.warn('[Life] команда не зарегистрирована', e); }
}

// ───────────── старт ─────────────

window.addEventListener('error', (e) => {
    if (/\/LIFE\/|\/life\//i.test(String(e?.filename || ''))) toast('error', esc(`${e.message} (${String(e.filename).split('/').pop()}:${e.lineno})`), '✦ Life: ошибка', { timeOut: 15000 });
});

function onChatChanged() {
    ui.focus = settings().focusDefault ? 'last' : null;
    ui.mapStack = [];
    ui.who = '';
    ui.chShow = 30;
    invalidate();
    hookChat();
    decorateSoon(200);
    updateMovePrompt();
    if (ui.open) closeHub();
}

jQuery(async () => {
    settings();
    renderSettingsDrawer();
    registerSlash();
    syncFab();
    if (!addWandButton()) {
        let tries = 0;
        const t = setInterval(() => { if (addWandButton() || ++tries > 20) clearInterval(t); }, 500);
    }
    if (!hookChat()) {
        let tries = 0;
        const t = setInterval(() => { if (hookChat() || ++tries > 40) { clearInterval(t); decorateSoon(); } }, 500);
    }
    ui.focus = settings().focusDefault ? 'last' : null;
    const { eventSource, eventTypes: E } = ctx();
    eventSource.on(E.CHAT_CHANGED, onChatChanged);
    const later = () => { invalidate(); decorateSoon(450); setTimeout(() => { invalidate(); decorateSoon(); }, 1600); };
    for (const ev of [E.MESSAGE_RECEIVED, E.CHARACTER_MESSAGE_RENDERED, E.MESSAGE_SWIPED, E.MESSAGE_EDITED, E.MESSAGE_DELETED, E.MESSAGE_UPDATED, E.MORE_MESSAGES_LOADED]) {
        if (ev) eventSource.on(ev, later);
    }
    if (E.MESSAGE_SENT) eventSource.on(E.MESSAGE_SENT, () => { if (settings().focusDefault && ui.focus !== null) ui.focus = 'last'; later(); });
    if (E.USER_MESSAGE_RENDERED) eventSource.on(E.USER_MESSAGE_RENDERED, later);
    for (const ev of [E.GENERATION_ENDED, E.GENERATION_STOPPED]) if (ev) eventSource.on(ev, () => updateMovePrompt());
    if (E.APP_READY) eventSource.on(E.APP_READY, () => { addWandButton(); hookChat(); decorateSoon(); updateMovePrompt(); });
    decorateSoon(300);
    updateMovePrompt();
    console.log(`[Life] загружен ${VERSION}`);
});
