// ✦ LIFE — визуальный хаб для SillyTavern поверх Horae.
// Время, место, одежду, вещи и события ведёт Horae (поле horae_meta в каждом сообщении).
// Летописец (дешёвая модель после каждого поста) чинит за Horae инвентарь, ведёт отношения, тайны и названия глав.
// Life режет общий чат на главы-комнаты только на экране, рисует карты районов и даёт кнопки.

import { icon, CANDLE, guessPlaceIcon, PLACE_ICON_NAMES, iconName } from './icons.js';
import { initControl, applyTheme, openCC } from './control.js';
import { chronSystem, CLEAN_SYSTEM, chronInput, cleanInput, extractJson, normalizeResult, applyItemOps, restoreItems } from './chronicler.js';

const MODULE = 'life';
const VERSION = '0.3.1';
const PROMPT_KEY = 'life_move';
const WARDROBE_DRAW = '/scripts/extensions/third-party/wardrobe/draw.js';

const DEFAULTS = {
    enabled: true,
    showFab: true,
    fabPos: null,
    chatMarks: 'off',
    chapterBy: 'top',
    aliases: '',
    artStyle: 'semi-realistic colored-pencil sketch on toned paper, moody cinematic light, graphite and deep wine palette',
    regions: [],
    places: {},
    itemInfo: {},
    looks: {},
    pairs: {},
    autoMaps: 'ask',
    chron: { on: true, profile: '', effort: 'low', tokens: 2000, timeoutSec: 75, titles: true, relations: true, secrets: true },
};

const ctx = () => SillyTavern.getContext();
function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

function settings() {
    const ext = ctx().extensionSettings;
    if (!ext[MODULE] || typeof ext[MODULE] !== 'object') ext[MODULE] = {};
    const s = ext[MODULE];
    for (const [k, v] of Object.entries(DEFAULTS)) if (s[k] === undefined) s[k] = clone(v);
    for (const [k, v] of Object.entries(DEFAULTS.chron)) if (s.chron[k] === undefined) s.chron[k] = v;
    if (!s.migr02) migrate01(s);
    if (!s.migr03) { s.chatMarks = 'off'; delete s.dividers; delete s.focusDefault; s.migr03 = true; }
    if (!Array.isArray(s.regions)) s.regions = [];
    if (!s.regions.length) s.regions.push({ id: uid(), name: 'Манхэттен', map: '', note: '' });
    return s;
}

/** Из 0.1: миры → районы, картинки вещей → itemInfo, значки FA → линейные. */
function migrate01(s) {
    if (Array.isArray(s.worlds) && s.worlds.length && !s.regions.length) {
        s.regions = s.worlds.map(w => ({ id: w.id, name: w.name, map: w.map || '', cover: w.cover || '', note: w.note || '' }));
    }
    for (const p of Object.values(s.places || {})) {
        if (p.world && !p.region) p.region = p.world;
        delete p.world;
        p.icon = iconName(p.icon);
    }
    for (const [k, img] of Object.entries(s.itemImgs || {})) {
        s.itemInfo[k] = { ...(s.itemInfo[k] || {}), img };
    }
    delete s.itemImgs;
    delete s.worlds;
    s.migr02 = true;
}

const saveSettings = () => ctx().saveSettingsDebounced();

// ───────────── мелочи ─────────────

function uid() { return Math.random().toString(36).slice(2, 10); }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function norm(v) { return String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'`]/g, '').replace(/\s+/g, ' ').trim(); }
function cut(t, n) { t = String(t ?? ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
function pad2(n) { return String(n).padStart(2, '0'); }
function hash(t) { let h = 0; t = String(t || ''); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
}
function toast(kind, msg, title = '✦ Life', opts = {}) {
    try { window.toastr?.[kind]?.(msg, title, { timeOut: 3000, ...opts }); } catch { /* нет тостов */ }
}

function locParts(loc) { return String(loc || '').split(/\s*[·・›>]\s*/).map(x => x.trim()).filter(Boolean); }
function locTop(loc) { return locParts(loc)[0] || ''; }
function locLeaf(loc) { const p = locParts(loc); return p[p.length - 1] || ''; }
function placeKey(loc) { return locParts(loc).map(norm).join('·'); }

function plainText(mes) {
    return String(mes || '')
        .replace(/<(horae\w*|details|think|thinking|summary|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[*_~`#|]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// даты: «20.11.2024», «2024/11/20», «20 ноября 2024»
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTHS = [/^янв/, /^фев/, /^мар/, /^апр/, /^ма[йя]/, /^июн/, /^июл/, /^авг/, /^сен/, /^окт/, /^ноя/, /^дек/];
function parseDate(s) {
    s = String(s || '');
    let m = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
    if (m) { const mi = MONTHS.findIndex(re => re.test(m[2].toLowerCase())); if (mi >= 0) return new Date(+m[3], mi, +m[1]); }
    return null;
}
function weekday(date) { const d = parseDate(date); return d && !isNaN(d) ? WEEKDAYS[d.getDay()] : ''; }
function whenLabel(date, time) { return [weekday(date) || date, time].filter(Boolean).join(', '); }
function fmtWhen(date, time) { return [date, time].filter(Boolean).join(' · '); }
function weatherWord(atm) { return cap(cut(String(atm || '').split(/[,;.]/)[0].trim(), 22)); }

// ───────────── Horae ─────────────

function chatArr() { return ctx().chat || []; }
function hasChat() { const c = ctx(); return !!(c.chatId || c.groupId || c.characterId !== undefined) && Array.isArray(c.chat); }
function chatMeta() {
    const md = ctx().chatMetadata;
    if (!md) return {};
    if (!md.life || typeof md.life !== 'object') md.life = {};
    return md.life;
}
function saveMeta() { try { ctx().saveMetadataDebounced?.(); } catch { /* */ } }
function horaeOn() { try { return !!window.Horae?.isEnabled?.(); } catch { return false; } }

function emptyMeta() {
    return {
        timestamp: { story_date: '', story_time: '', absolute: '' },
        scene: { location: '', characters_present: [], atmosphere: '' },
        costumes: {}, items: {}, deletedItems: [], deletedAgenda: [], events: [],
        affection: {}, npcs: {}, agenda: [], mood: {}, relationships: [],
    };
}

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
        for (const d of meta.deletedItems || []) delete st.items[d];
    }
    return st;
}

function horaeEvents() {
    try { if (horaeOn()) return window.Horae.getEvents(0) || []; } catch (e) { console.warn('[Life] Horae.getEvents', e); }
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

function locationMemory() { return chatArr()[0]?.horae_meta?.locationMemory || {}; }
function horaeRelationships() { return chatArr()[0]?.horae_meta?.relationships || []; }

// ───────────── главы ─────────────

let chCache = { sig: '', list: [] };

function chatSig() {
    const chat = chatArr();
    const last = chat[chat.length - 1];
    return `${ctx().chatId || ctx().groupId}|${chat.length}|${last?.swipe_id ?? ''}|${last?.horae_meta?.scene?.location || ''}|${settings().chapterBy}|${chatMeta().ver || 0}`;
}

/** Главы = отрезки чата, где место (по Horae) одно; новая глава — когда место меняется или на отметке Life. */
function chapters() {
    const sig = chatSig();
    if (chCache.sig === sig) return chCache.list;
    const chat = chatArr();
    const by = settings().chapterBy;
    const cm = chatMeta();
    const titles = cm.titles || {};
    const auto = cm.autoTitles || {};
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
        if (cur && !forced && key && key !== cur.key && cur.marker >= 0 && cur.count === 0) { cur.key = key; cur.loc = loc; }
        if (!cur || forced || (key && key !== cur.key)) {
            cur = { idx: list.length, start: i, end: i, key, loc, date, time, endDate: date, endTime: time, count: 0, marker: forced ? i : -1, mtitle: mark?.title || '', preview: '', previewId: -1, lastId: -1, locs: new Set() };
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
            cur.lastId = i;
        }
    }
    for (const ch of list) {
        if (ch.previewId >= 0) ch.preview = cut(plainText(chat[ch.previewId]?.mes).replace(/\s+/g, ' '), 170);
        ch.autoTitle = auto[ch.start] || '';
        ch.title = titles[ch.start] || ch.mtitle || ch.autoTitle || (ch.loc ? placeName(locTop(ch.loc)) : (ch.idx === 0 ? 'Пролог' : 'Без места'));
        ch.userTitled = !!(titles[ch.start] || ch.mtitle);
        ch.locs = [...ch.locs];
        ch.num = ch.idx + 1;
    }
    chCache = { sig, list };
    return list;
}

function invalidate() { chCache.sig = ''; }

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

// ───────────── места и районы ─────────────

function regionById(id) { return settings().regions.find(r => r.id === id) || null; }

function findRegion(name, create = false) {
    const s = settings();
    const n = norm(name);
    if (!n) return null;
    let r = s.regions.find(x => norm(x.name) === n);
    if (!r && create) {
        r = { id: uid(), name: cap(String(name).trim()), map: '', note: '', fresh: true };
        s.regions.push(r);
        saveSettings();
    }
    return r;
}

function getPlace(loc, create = false) {
    const key = placeKey(loc);
    if (!key) return null;
    const s = settings();
    if (!s.places[key] && create) {
        s.places[key] = { name: locParts(loc).join(' · '), raw: loc, icon: guessPlaceIcon(norm(locLeaf(loc))), img: '', plan: '', region: '', x: null, y: null, kind: '' };
    }
    return s.places[key] || null;
}

function placeName(loc) { return getPlace(loc)?.name || locParts(loc).join(' · ') || 'Без места'; }
function placeIcon(loc) { return iconName(getPlace(loc)?.icon || guessPlaceIcon(norm(locLeaf(loc)))); }

function placeCover(loc) {
    const parts = locParts(loc);
    for (let n = parts.length; n > 0; n--) {
        const p = getPlace(parts.slice(0, n).join('·'));
        if (p?.img) return p.img;
    }
    return '';
}

function placeRegion(loc) {
    const top = getPlace(locTop(loc));
    return top?.region ? regionById(top.region) : null;
}

function currentRegion() {
    const s = settings();
    const st = worldState();
    return placeRegion(st.scene?.location) || regionById(chatMeta().region) || s.regions[0];
}

function placeDesc(loc) {
    const key = placeKey(loc);
    for (const [name, v] of Object.entries(locationMemory())) if (placeKey(name) === key && !v?._deleted) return v.desc || '';
    return getPlace(loc)?.desc || '';
}

/** Все места: из глав, из памяти мест Horae и из реестра Life. key → «сырое» имя. */
function knownLocations() {
    const map = new Map();
    const add = (raw) => {
        const k = placeKey(raw);
        if (k && !map.has(k)) map.set(k, raw);
        const tk = placeKey(locTop(raw));
        if (tk && !map.has(tk)) map.set(tk, locTop(raw));
    };
    for (const ch of chapters()) for (const l of ch.locs) add(l);
    for (const name of Object.keys(locationMemory())) add(name);
    for (const [k, p] of Object.entries(settings().places)) if (!map.has(k)) map.set(k, p.raw || p.name);
    return map;
}

function chaptersAt(loc) {
    const key = placeKey(loc);
    return chapters().filter(ch => ch.locs.some(l => { const k = placeKey(l); return k === key || k.startsWith(key + '·'); }));
}

const SLOTS = [
    [50, 52, 'center'], [22, 30, 'upper-left'], [78, 30, 'upper-right'], [24, 78, 'lower-left'], [76, 78, 'lower-right'],
    [50, 24, 'upper-center'], [50, 82, 'lower-center'], [18, 55, 'middle-left'], [82, 55, 'middle-right'],
];

// ───────────── персонажи ─────────────

function parseAliases(text) {
    const out = {};
    for (const line of String(text || '').split('\n')) {
        const m = line.split('=');
        if (m.length < 2) continue;
        const card = m[0].trim();
        if (card) out[card] = [card, ...m.slice(1).join('=').split(',').map(x => x.trim()).filter(Boolean)];
    }
    return out;
}
function aliasTable() { return { ...parseAliases(ctx().extensionSettings?.wardrobe?.aliases), ...parseAliases(settings().aliases) }; }

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
    return cards.find(x => norm(x).split(' ')[0] === n.split(' ')[0]) || String(name).trim();
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
    const names = [];
    const add = (n) => { const k = canonName(n); if (k && !names.some(x => norm(x) === norm(k))) names.push(k); };
    add(ctx().name1);
    groupMembers().forEach(add);
    (st.scene?.characters_present || []).forEach(add);
    Object.keys(st.costumes || {}).forEach(add);
    Object.keys(st.mood || {}).forEach(add);
    return names;
}

/** Имя так, как его пишет Horae (чтобы он сопоставил одежду и настроение). */
function horaeName(n, st = worldState()) {
    const pool = [...(st.scene?.characters_present || []), ...Object.keys(st.costumes || {}), ...Object.keys(st.mood || {})];
    return pool.find(h => sameName(h, n)) || n;
}

function userAvatar() { return document.querySelector('#chat .mes[is_user="true"] .avatar img')?.getAttribute('src') || ''; }

function avatarUrl(name, full = false) {
    const c = ctx();
    const n = canonName(name);
    if (norm(n) === norm(c.name1)) {
        const t = userAvatar();
        if (full && t.includes('thumbnail')) {
            try { const f = new URL(t, location.href).searchParams.get('file'); if (f) return `/User Avatars/${encodeURIComponent(f)}`; } catch { /* */ }
        }
        return t;
    }
    const face = c.extensionSettings?.wardrobe?.faces?.[n];
    if (face && !full) return face;
    const ch = (c.characters || []).find(x => x.name === n);
    if (!ch?.avatar) return face || '';
    return full ? `/characters/${encodeURIComponent(ch.avatar)}` : `/thumbnail?type=avatar&file=${encodeURIComponent(ch.avatar)}`;
}

function shortName(n) { const f = String(n || '').split(/\s+/)[0]; return f.length > 11 ? f.slice(0, 10) + '…' : f; }

function ava(name, cls = '') {
    const url = avatarUrl(name);
    const letter = esc(String(name || '?').trim().charAt(0).toUpperCase());
    return `<span class="lf-ava ${cls}" title="${esc(name)}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<i>${letter}</i></span>`;
}

function moodOf(name, st) { return Object.entries(st.mood || {}).find(([k]) => sameName(k, name))?.[1] || ''; }

// ───────────── вещи ─────────────

const VEHICLE_RE = /машин|купе|авто|мотоцикл|байк|джип|седан|внедорожник|мустанг|порше|харлей|квинджет|\bcar\b|bike|mustang/i;

function itemInfo(name) { return settings().itemInfo[norm(name)] || {}; }
function setItemInfo(name, patch) {
    const s = settings();
    const k = norm(name);
    s.itemInfo[k] = { ...(s.itemInfo[k] || {}), ...patch };
    saveSettings();
}
function isVehicle(name, it) {
    const k = itemInfo(name).kind;
    if (k) return k === 'транспорт';
    if (/ключ|брелок|документ|права/i.test(name)) return false;
    return VEHICLE_RE.test(name) || (/^🚗|^🏍|^🚙/.test(it?.icon || ''));
}
function itemImg(name) { return itemInfo(name).img || ''; }

function itemOrigin(name) {
    const chat = chatArr();
    for (let i = 0; i < chat.length; i++) if (chat[i]?.horae_meta?.items?.[name]) return { i, ts: chat[i].horae_meta.timestamp, loc: chat[i].horae_meta.scene?.location };
    return null;
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
    const p = String((await r.json()).path || '');
    return p.startsWith('/') ? p : `/${p}`;
}

async function refData(path, max = 1024) {
    if (!path) return '';
    try { return await toJpeg(await urlToDataUrl(path), max, 0.86); } catch { return ''; }
}

/** Рисую через движок Гардероба: тот же SLAY/Atlas/Naistera, что у тебя настроен. refs — data:URL. */
async function drawPicture(prompt, { aspect = '4:3', max = 1600, refs = [], prefix = 'life' } = {}) {
    let mod;
    try { mod = await import(WARDROBE_DRAW); } catch { throw new Error('Рисую через Гардероб, а он не найден. Можно загрузить свою картинку.'); }
    const c = ctx();
    const conn = mod.resolveConnection(c.extensionSettings?.wardrobe || {}, c.extensionSettings);
    if (conn?.error) throw new Error(conn.error);
    const out = await mod.generateImage(conn, prompt, refs.filter(Boolean), { aspect, onWait: (sec) => toast('info', `Сервис занят, повтор через ${sec} с`) });
    return uploadImage(await toJpeg(await urlToDataUrl(out), max, 0.88), prefix);
}

const style = () => settings().artStyle;

function placeLine(p) {
    const desc = placeDesc(p.raw || p.name);
    return `${p.name}${p.kind ? ` (${p.kind})` : ''}${desc ? ` — ${cut(desc, 110)}` : ''}`;
}

function placePrompt(loc) {
    const desc = placeDesc(loc);
    const r = placeRegion(loc);
    return `Atmospheric establishing shot of a place: ${locParts(loc).join(', ')}${r ? `, ${r.name}` : ''}.${desc ? ` Details: ${desc}` : ''}${r?.note ? ` Setting: ${r.note}.` : ''}\nStyle: ${style()}. Wide cinematic composition, no people, no text.`;
}

function mapPrompt(region, assigned) {
    const parts = assigned.map(([p, slot]) => `${slot[2]} — ${placeLine(p)}`).join('; ');
    return `Illustrated aerial bird's-eye map of ${region.name}${region.note ? ` (${region.note})` : ''}: streets, rooftops, a few distinct landmark buildings, night, warm windows.`
        + (parts ? `\nComposition — keep each landmark clearly visible in its part of the frame: ${parts}.` : '')
        + `\nStyle: ${style()}. No labels, no text, no legend, no people.`;
}

function addToMapPrompt(p, slot) {
    return `This is an illustrated map. Add one new landmark in the ${slot[2]} part of the image: ${placeLine(p)}. Keep everything else exactly as it is — same style, same layout, same colors. No labels, no text.`;
}

function planPrompt(loc) {
    const desc = placeDesc(loc);
    return `Isometric cutaway floor plan illustration of ${locParts(loc).join(', ')}, several rooms visible from above with furniture and warm lamps.${desc ? ` Details: ${desc}` : ''}\nStyle: ${style()}. No labels, no text, no people.`;
}

function itemPrompt(name, it) {
    return `Still life close-up of a single object: ${name}.${it?.description ? ` ${it.description}` : ''} On dark fabric, soft side light.\nStyle: ${style()}. Only this object, nothing else, no text.`;
}

// ───────────── отметки глав и переходы ─────────────

/**
 * Скрытая отметка: системное сообщение (в промпт не идёт), но с horae_meta, чтобы Horae
 * считал новое место текущим. chapter=false — просто переход между комнатами без новой главы.
 */
async function insertMarker({ location = '', title = '', who = [], how = '', note = '', chapter = true }) {
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
        extra: { type: 'comment', life: { chapter, location, title, who, how, note } },
        horae_meta: meta,
    };
    c.chat.push(msg);
    try { c.addOneMessage(msg, { scroll: true }); } catch (e) { console.warn('[Life] addOneMessage', e); }
    await c.saveChat();
    invalidate();
    updateMovePrompt();
    return c.chat.length - 1;
}

function pendingMarker() {
    const chat = chatArr();
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (m?.extra?.life?.chapter !== undefined && m.extra.life.location !== undefined) return { id: i, mark: m.extra.life };
        if (m && !m.is_system && !m.is_user) return null;
    }
    return null;
}

function moveNote(mark) {
    const who = (mark.who || []).filter(Boolean);
    const whoTxt = who.length ? who.join(', ') : 'Персонажи';
    if (mark.location) {
        return `[${mark.chapter === false ? 'Переход' : 'Смена сцены'}${mark.how ? ` (${mark.how})` : ''}: ${whoTxt} теперь — «${locParts(mark.location).join(', ')}»${mark.title ? `. Глава: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''} Пиши уже оттуда (или дорогу туда, если так логичнее), без телепортов; кто не пошёл — остался где был.]`;
    }
    return `[Новая глава${mark.title ? `: ${mark.title}` : ''}.${mark.note ? ` ${mark.note}` : ''}]`;
}

function updateMovePrompt() {
    const c = ctx();
    const p = settings().enabled ? pendingMarker() : null;
    const dir = settings().enabled ? chatMeta().director : null;
    const parts = [];
    if (p) parts.push(moveNote(p.mark));
    if (dir?.once && dir.text) parts.push(`[Режиссёр: ${dir.text}]`);
    const text = parts.join('\n');
    try { c.setExtensionPrompt(PROMPT_KEY, text, c.extension_prompt_types?.IN_CHAT ?? 1, 0, false, c.extension_prompt_roles?.SYSTEM ?? 0); } catch (e) { console.warn('[Life] заметка', e); }
    return text;
}

globalThis.life_intercept = async function (_chat, _size, _abort, type) {
    try { if (type !== 'quiet') updateMovePrompt(); } catch (e) { console.warn('[Life] перехват', e); }
};

async function removeMarker(id) {
    const c = ctx();
    if (!c.chat?.[id]?.extra?.life) return;
    if (typeof c.deleteMessage === 'function') await c.deleteMessage(id);
    else { c.chat.splice(id, 1); await c.saveChat(); await c.reloadCurrentChat?.(); }
    invalidate();
    updateMovePrompt();
}

// ───────────── Летописец ─────────────

const chronBusy = new Set();
const chronQueue = [];
let chronRunning = false;

function msgKey(m) { return `${m?.swipe_id ?? 0}:${hash(m?.mes || '')}`; }
function chronStore() { const cm = chatMeta(); if (!cm.chron || typeof cm.chron !== 'object') cm.chron = {}; return cm.chron; }
function chronOf(i) { const m = chatArr()[i]; return m ? chronStore()[`${i}:${msgKey(m)}`] || null : null; }

function trimChron() {
    const st = chronStore();
    const keys = Object.keys(st);
    if (keys.length <= 500) return;
    keys.sort((a, b) => parseInt(a) - parseInt(b)).slice(0, keys.length - 500).forEach(k => delete st[k]);
}

function profiles() { return ctx().extensionSettings?.connectionManager?.profiles || []; }
function chronProfile() { const s = settings(); return s.chron.profile || ctx().extensionSettings?.wardrobe?.watcherProfile || ''; }

async function askModel(messages, maxTokens) {
    const c = ctx();
    const s = settings();
    if (!c.ConnectionManagerRequestService?.sendRequest) throw new Error('в таверне нет Connection Manager');
    const name = chronProfile();
    const p = profiles().find(x => x.name === name) || profiles().find(x => x.id === name);
    if (!p) throw new Error('Выбери профиль Летописца: Мир → ⚙');
    const override = s.chron.effort ? { reasoning_effort: s.chron.effort } : {};
    const r = await Promise.race([
        c.ConnectionManagerRequestService.sendRequest(p.id, messages, Number(maxTokens) || 2000, {}, override),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Летописец не ответил вовремя')), (Number(s.chron.timeoutSec) || 75) * 1000)),
    ]);
    const text = typeof r === 'string' ? r : (r?.content ?? '');
    if (!String(text).trim()) throw new Error('пустой ответ Летописца');
    return text;
}

async function waitHorae(i) {
    if (!horaeOn()) return;
    for (let t = 0; t < 40; t++) {
        if (chatArr()[i]?.horae_meta) { await new Promise(r => setTimeout(r, 400)); return; }
        await new Promise(r => setTimeout(r, 500));
    }
}

function manualFor(i) { return (chatMeta().manual || []).filter(x => x.mes === i); }

function reapplyManual(i) {
    const m = chatArr()[i];
    if (!m) return;
    for (const rec of manualFor(i)) {
        m.horae_meta = m.horae_meta || emptyMeta();
        applyItemOps(m.horae_meta, worldState().items, rec.ops);
    }
}

/** Если Horae перечитал сообщение и стёр наши правки — накатить их снова (без нового запроса). */
function ensureFix(i) {
    const m = chatArr()[i];
    const e = chronOf(i);
    if (!m || !e || e.undone) return false;
    const k = msgKey(m);
    if (m.horae_meta?._lifeFix === k) return false;
    m.horae_meta = m.horae_meta || emptyMeta();
    applyItemOps(m.horae_meta, worldState().items, e.ops || []);
    reapplyManual(i);
    m.horae_meta._lifeFix = k;
    return true;
}

function shouldChron(i) {
    const s = settings();
    const m = chatArr()[i];
    return s.enabled && s.chron.on && m && !m.is_user && !m.is_system && m.extra?.type !== 'comment' && String(m.mes || '').trim().length > 20;
}

function queueChron(i, opts = {}) {
    if (!shouldChron(i) && !opts.force) return;
    if (chronBusy.has(i)) return;
    chronQueue.push([i, opts]);
    if (!chronRunning) drainChron();
}

async function drainChron() {
    chronRunning = true;
    try {
        while (chronQueue.length) {
            const [i, opts] = chronQueue.shift();
            try { await runChron(i, opts); } catch (e) { console.warn('[Life] Летописец', e); }
        }
    } finally { chronRunning = false; }
}

async function runChron(i, { force = false } = {}) {
    const s = settings();
    const chat = chatArr();
    const m = chat[i];
    if (!m) return;
    const store = chronStore();
    const key = `${i}:${msgKey(m)}`;
    if (store[key] && !force) { if (ensureFix(i)) await ctx().saveChat(); return; }
    chronBusy.add(i);
    paintChips();
    try {
        await waitHorae(i);
        if (chatArr()[i] !== m) return; // чат сменился
        const st = worldState();
        const list = chapters();
        const ch = chapterOf(i, list);
        const askTitle = s.chron.titles && ch && !ch.userTitled && !ch.autoTitle && ch.count >= 2;
        let prev = '';
        for (let j = i - 1; j >= 0 && !prev; j--) if (chat[j] && !chat[j].is_system) prev = cut(plainText(chat[j].mes), 700);
        const cast = castNames(st).map(n => {
            const al = aliasTable()[n];
            const hn = horaeName(n, st);
            return [hn, ...(al || []).filter(a => norm(a) !== norm(hn))].slice(0, 4).join(' / ');
        });
        const input = chronInput({
            cast, location: st.scene?.location, when: fmtWhen(st.timestamp?.story_date, st.timestamp?.story_time),
            regions: s.regions.map(r => r.name), items: st.items, post: cut(plainText(m.mes), 9000), speaker: m.name, prev,
            chapterTitle: ch?.title,
        });
        const out = await askModel([{ role: 'system', content: chronSystem(askTitle) }, { role: 'user', content: input }], s.chron.tokens);
        const j = extractJson(out);
        if (!j) throw new Error('Летописец ответил не JSON');
        const res = normalizeResult(j);
        if (chatArr()[i] !== m || msgKey(m) !== key.split(':').slice(1).join(':')) return; // пока думал — свайпнули
        m.horae_meta = m.horae_meta || emptyMeta();
        const { undo, kinds } = applyItemOps(m.horae_meta, worldState().items, res.items);
        reapplyManual(i);
        m.horae_meta._lifeFix = msgKey(m);
        for (const [name, kind] of Object.entries(kinds)) setItemInfo(name, { kind });
        if (res.place) notePlace(res.place);
        if (askTitle && res.title && ch) {
            const cm = chatMeta();
            cm.autoTitles = cm.autoTitles || {};
            cm.autoTitles[ch.start] = res.title;
            cm.ver = (cm.ver || 0) + 1;
        }
        store[key] = { chips: res.chips, ops: res.items, rel: s.chron.relations ? res.relations : [], sec: s.chron.secrets ? res.secrets : [], place: res.place, title: res.title, undo, at: Date.now() };
        trimChron();
        await ctx().saveChat();
        saveMeta();
        invalidate();
    } catch (e) {
        console.warn('[Life] Летописец:', e);
        toast('warning', esc(String(e?.message || e)), '✦ Летописец', { timeOut: 6000 });
    } finally {
        chronBusy.delete(i);
        paintChips();
        decorateSoon(100);
        if (ui.open) renderSoon();
    }
}

/** Летописец сказал, где сцена: отнести место к району (новый район — завести). */
function notePlace(pl) {
    const top = locTop(pl.location);
    if (!top) return;
    const p = getPlace(top, true);
    if (!p.kind && pl.kind) p.kind = pl.kind;
    if (p.icon === 'pin' && pl.kind) p.icon = guessPlaceIcon(norm(pl.kind));
    if (!p.region && pl.region) {
        const r = findRegion(pl.region, true);
        p.region = r.id;
        if (r.fresh) {
            delete r.fresh;
            const mode = settings().autoMaps;
            if (mode === 'auto') setTimeout(() => drawRegionMap(r).catch(e => toast('warning', esc(String(e.message || e)))), 500);
            else if (mode === 'ask') { r.needsMap = true; toast('info', `Новый район на карте: «${esc(r.name)}». Карту можно нарисовать в Life → Карта.`, '✦ Life', { timeOut: 6000 }); }
        }
    }
    saveSettings();
}

async function undoChron(i) {
    const m = chatArr()[i];
    const e = chronOf(i);
    if (!m || !e) return;
    restoreItems(m.horae_meta, e.undo);
    e.undone = true;
    if (m.horae_meta) delete m.horae_meta._lifeFix;
    await ctx().saveChat();
    saveMeta();
    invalidate();
}

/** Ручная правка вещей: в последнее сообщение, с записью, чтобы пережила перечитывание Horae. */
async function manualItems(ops) {
    const chat = chatArr();
    if (!chat.length) return;
    const i = chat.length - 1;
    const m = chat[i];
    m.horae_meta = m.horae_meta || emptyMeta();
    applyItemOps(m.horae_meta, worldState().items, ops);
    const cm = chatMeta();
    cm.manual = (cm.manual || []).filter(x => x.mes < chat.length);
    cm.manual.push({ mes: i, ops, at: Date.now() });
    if (cm.manual.length > 200) cm.manual.splice(0, cm.manual.length - 200);
    await ctx().saveChat();
    saveMeta();
}

async function cleanInventory() {
    const st = worldState();
    const items = st.items || {};
    if (!Object.keys(items).length) throw new Error('инвентарь пуст');
    const out = await askModel([{ role: 'system', content: CLEAN_SYSTEM }, { role: 'user', content: cleanInput({ cast: castNames(st).map(n => horaeName(n, st)), items }) }], 3000);
    const j = extractJson(out);
    const res = normalizeResult(j || {});
    if (!res.items.length) return 0;
    await manualItems(res.items);
    return res.items.length;
}

// отношения и тайны — свёртка записей Летописца по чату (ветки и свайпы учитываются сами)
function pairKey(a, b) { return [canonName(a), canonName(b)].map(norm).sort().join('|'); }

function relationsState() {
    const chat = chatArr();
    const base = chatMeta().pairBase || {};
    const pairs = {};
    const get = (a, b) => {
        const k = pairKey(a, b);
        if (!pairs[k]) {
            const b0 = base[k] || {};
            pairs[k] = { key: k, a: canonName(a), b: canonName(b), trust: b0.trust ?? 50, closeness: b0.closeness ?? 50, tension: b0.tension ?? 25, moments: [] };
        }
        return pairs[k];
    };
    const clamp = (v) => Math.max(0, Math.min(100, v));
    for (let i = 0; i < chat.length; i++) {
        const e = chronOf(i);
        if (!e || e.undone) continue;
        for (const r of e.rel || []) {
            if (sameName(r.a, r.b)) continue;
            const p = get(r.a, r.b);
            p.trust = clamp(p.trust + (r.trust || 0));
            p.closeness = clamp(p.closeness + (r.closeness || 0));
            p.tension = clamp(p.tension + (r.tension || 0));
            if (r.moment) p.moments.push({ text: r.moment, mes: i, ts: chat[i]?.horae_meta?.timestamp });
        }
    }
    for (const k of Object.keys(base)) if (!pairs[k]) { const [a, b] = k.split('|'); get(a, b); }
    return pairs;
}

function secretsState() {
    const out = [];
    chatArr().forEach((m, i) => {
        const e = chronOf(i);
        if (!e || e.undone) return;
        for (const sec of e.sec || []) out.push({ ...sec, mes: i, ts: m?.horae_meta?.timestamp });
    });
    const hidden = new Set(chatMeta().hiddenSecrets || []);
    return out.filter(x => !hidden.has(norm(x.text)));
}

function lastChron(from = chatArr().length - 1, to = 0) {
    for (let i = from; i >= to; i--) { const e = chronOf(i); if (e && !e.undone && e.chips?.length) return { i, e }; }
    return null;
}

// ───────────── чат: разделители, главы, плашки ─────────────

const ui = {
    open: false, tab: 'scene', focus: 'last', who: '', pTab: 'items', itemsTab: 'with', item: '', worldTab: 'events',
    mapStack: [], region: '', sel: '', atlas: false, editPins: false, chShow: 30, pair: '', relTab: 'common', car: '', wset: '',
};
let observer = null;
let decorating = false;

// глава, которую сейчас показывает хаб (в самом чате ничего не прячется)
function focusChapter(list = chapters()) {
    if (!list.length) return null;
    if (ui.focus === 'last' || ui.focus === null) return list[list.length - 1];
    return list.find(ch => ch.start === ui.focus) || list[list.length - 1];
}

function firstShownId(chatEl) {
    const first = chatEl.querySelector(':scope > .mes[mesid]');
    return first ? Number(first.getAttribute('mesid')) : Infinity;
}

function chapterCover(ch) { return (chatMeta().frames || {})[ch.start] || placeCover(ch.loc); }

function thinHtml(ch) {
    const where = ch.loc ? placeName(locTop(ch.loc)) : '';
    const label = [where && norm(where) !== norm(ch.title) ? `${ch.title} · ${where}` : ch.title, ch.time].filter(Boolean).join(' · ');
    return `<div class="lf-thin" data-start="${ch.start}" role="button">${esc(cut(label, 60))}</div>`;
}

function chipsHtml(i) {
    if (chronBusy.has(i)) return `<div class="lf-pchips busy" data-mes="${i}">${icon('spark')}<span>Летописец читает…</span></div>`;
    const e = chronOf(i);
    if (!e || e.undone || !e.chips?.length) return '';
    return `<div class="lf-pchips" data-mes="${i}" role="button">${icon('spark')}<span>${e.chips.map(esc).join(' <i>·</i> ')}</span></div>`;
}

function paintChips() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || !settings().enabled) return;
    chatEl.querySelectorAll(':scope > .mes[mesid]').forEach(el => {
        const id = Number(el.getAttribute('mesid'));
        const old = el.querySelector('.lf-pchips');
        const html = chipsHtml(id);
        if (!html) { old?.remove(); return; }
        if (old && old.outerHTML === html) return;
        const host = el.querySelector('.mes_block') || el;
        old?.remove();
        host.insertAdjacentHTML('beforeend', html);
    });
}

function decorate() {
    const chatEl = document.getElementById('chat');
    if (!chatEl || decorating) return;
    decorating = true;
    try {
        chatEl.querySelectorAll(':scope > .lf-div, :scope > #lf-bar, :scope > .lf-more, :scope > .lf-move, :scope > .lf-thin').forEach(x => x.remove());
        chatEl.classList.remove('lf-focus', 'lf-focus-full');
        const s = settings();
        const mesEls = chatEl.querySelectorAll(':scope > .mes[mesid]');
        if (!s.enabled || !hasChat()) {
            mesEls.forEach(el => { el.classList.remove('lf-out', 'lf-marker'); el.querySelector('.lf-pchips')?.remove(); });
            return;
        }
        // чат остаётся сплошным: только прячем служебные отметки Life и (по желанию) ставим тонкую черту, где сменилось место
        const chat = chatArr();
        const thin = s.chatMarks === 'thin';
        const list = thin ? chapters() : [];
        const starts = new Map(list.map(ch => [ch.start, ch]));
        for (const el of mesEls) {
            const id = Number(el.getAttribute('mesid'));
            el.classList.remove('lf-out');
            el.classList.toggle('lf-marker', !!chat[id]?.extra?.life);
            const st = starts.get(id);
            if (st && st.idx > 0) el.insertAdjacentHTML('beforebegin', thinHtml(st));
        }
        paintChips();
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
    const b = ev.target.closest('.lf-thin, .lf-pchips');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (b.classList.contains('lf-pchips')) { if (!b.classList.contains('busy')) { openHub('world'); chronSheet(Number(b.dataset.mes)); } return; }
    ui.focus = Number(b.dataset.start);
    openHub('scene');
}

function scrollChatBottom() { const el = document.getElementById('chat'); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }

async function jumpTo(mesId) {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return;
    if (mesId < firstShownId(chatEl)) {
        try { await ctx().executeSlashCommandsWithOptions?.(`/chat-jump ${mesId}`); } catch (e) { console.warn('[Life] chat-jump', e); }
        decorate();
    }
    const el = chatEl.querySelector(`.lf-thin[data-start="${mesId}"]`) || chatEl.querySelector(`.mes[mesid="${mesId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function gotoChapter(start, { close = true } = {}) {
    const list = chapters();
    const ch = list.find(x => x.start === start);
    if (!ch) return;
    if (close) closeHub();
    decorate();
    if (ch.idx === list.length - 1 && ch.end - ch.start > 3) scrollChatBottom(); else await jumpTo(ch.start);
}

// ───────────── хаб: каркас ─────────────

let openedAt = 0;
let renderTimer = null;
function renderSoon() { clearTimeout(renderTimer); renderTimer = setTimeout(render, 120); }

const TABS = [['scene', 'scene', 'Сцена'], ['map', 'pin', 'Карта'], ['person', 'users', 'Персонаж'], ['world', 'globe', 'Мир']];

function buildHub() {
    if (document.getElementById('lf-dialog')) return;
    const dlg = document.createElement('dialog');
    dlg.id = 'lf-dialog';
    dlg.innerHTML = `
    <div id="lf-app">
        <header class="lf-top">
            <div class="lf-brand">${CANDLE}<div><div class="lf-brand-t">Таверна <span>/</span> LIFE</div><div class="lf-brand-s">SillyTavern</div></div></div>
            <div class="lf-top-r"><span class="lf-me"></span><button class="lf-x" data-act="close" title="Закрыть">${icon('x')}</button></div>
        </header>
        <main class="lf-body"></main>
        <nav class="lf-tabs">${TABS.map(([k, ic, t]) => `<button class="lf-tab" data-act="tab" data-tab="${k}">${icon(ic)}<span>${t}</span></button>`).join('')}<i class="lf-tab-ink"></i></nav>
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
    const b = ev.target.closest('.lf-btn, .lf-tab, .lf-chip, .lf-card, .lf-pin, .lf-tile, .lf-seg button');
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
    ui.open = true;
    render();
    const dlg = document.getElementById('lf-dialog');
    if (dlg && !dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    requestAnimationFrame(() => requestAnimationFrame(() => dlg?.classList.add('on')));
}

function closeHub() {
    ui.open = false;
    ui.focus = 'last';
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
    if (me) me.innerHTML = ava(ui.tab === 'person' && ui.who ? ui.who : ctx().name1, 'ring');
    const body = app.querySelector('.lf-body');
    const same = body.dataset.tab === ui.tab;
    const keep = same ? body.scrollTop : 0;
    try {
        body.innerHTML = ui.tab === 'map' ? renderMap() : ui.tab === 'person' ? renderPerson() : ui.tab === 'world' ? renderWorld() : renderScene();
    } catch (e) {
        console.error('[Life] render', e);
        body.innerHTML = `<div class="lf-empty"><b>Ошибка Life</b><pre class="lf-pre">${esc(String(e?.stack || e).slice(0, 900))}</pre>Сделай скрин и кинь Claude.</div>`;
    }
    body.classList.toggle('lf-anim', !same);
    body.dataset.tab = ui.tab;
    body.scrollTop = keep;
}

const seg = (items, cur, act) => `<div class="lf-seg">${items.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${esc(k)}">${t}</button>`).join('')}</div>`;
const sec = (t, small = '') => `<div class="lf-sec"><span>${t}</span>${small ? `<i class="lf-sec-line"></i><small>${small}</small>` : ''}</div>`;

function pillHtml(st) {
    const parts = [weekday(st.timestamp?.story_date) || st.timestamp?.story_date, st.timestamp?.story_time, weatherWord(st.scene?.atmosphere)].filter(Boolean);
    return parts.length ? `<div class="lf-pill">${parts.map(esc).join(' <b>·</b> ')}</div>` : '';
}

// ───── Сцена ─────

function lastPost(ch) {
    const chat = chatArr();
    for (let i = ch.end; i >= ch.start; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        const t = plainText(m.mes);
        if (!t) continue;
        const lines = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
        const lineIdx = lines.findIndex(l => /^[—–-]\s|^«/.test(l));
        const line = lineIdx >= 0 ? lines[lineIdx].replace(/^[—–-]\s*/, '').split(/\s[—–]\s/)[0] : '';
        const narr = lines.filter((_, k) => k !== lineIdx).join(' ');
        return { i, name: m.name, line: cut(line, 120), narr: cut(narr, 330) };
    }
    return null;
}

function chapterCard(ch, curStart) {
    const cover = chapterCover(ch);
    return `<button class="lf-card lf-chcard${ch.start === curStart ? ' on' : ''}" data-act="chapter" data-start="${ch.start}">
        <span class="lf-chcard-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : icon(placeIcon(ch.loc))}</span>
        <span class="lf-chcard-txt">
            <span class="lf-chcard-head"><b>${esc(ch.title)}</b><small>${esc(whenLabel(ch.endDate || ch.date, ch.endTime || ch.time))}</small></span>
            <span class="lf-chcard-prev">${esc(ch.preview || '…')}</span>
        </span>
    </button>`;
}

function renderScene() {
    const st = worldState();
    const list = chapters();
    if (!list.length) return `<div class="lf-empty">${icon('book', 'xl')}<b>Чат пуст</b></div>`;
    const last = list[list.length - 1];
    const fch = focusChapter(list) || last;
    const isCur = fch === last;
    const loc = isCur ? (st.scene?.location || fch.loc) : fch.loc;
    const cover = chapterCover(fch) || placeCover(loc);
    const when = isCur ? whenLabel(st.timestamp?.story_date, st.timestamp?.story_time) : whenLabel(fch.date, fch.time);
    const weather = isCur ? weatherWord(st.scene?.atmosphere) : '';
    const post = lastPost(fch);
    const ch = lastChron(fch.end, fch.start);
    const present = isCur ? (st.scene?.characters_present || []).map(canonName).filter(Boolean) : [];
    const warn = horaeOn() ? '' : `<div class="lf-note">${icon('activity')} Horae выключен или не найден — места и время беру только из уже записанного.</div>`;
    const shown = [...list].reverse().slice(0, ui.chShow);
    return `${warn}
    <div class="lf-titlebar">
        <button class="lf-iconbtn" data-act="to-chapters" title="Все главы">${icon('left')}</button>
        <h1>${esc(fch.title)}</h1>
        <span class="lf-kicker">гл. ${pad2(fch.num)}</span>
    </div>
    <section class="lf-frame${cover ? '' : ' empty'}">
        <div class="lf-frame-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <button class="lf-glass" data-act="frame" data-start="${fch.start}" data-loc="${esc(loc)}">${icon('refresh')} ${cover ? 'Обновить кадр' : 'Добавить кадр'}</button>
        <div class="lf-frame-cap">${icon(placeIcon(loc))}<span>${esc(loc ? placeName(locTop(loc)) : 'место не отмечено')}${locParts(loc).length > 1 ? ` · ${esc(locLeaf(loc))}` : ''}${when ? ` <b>·</b> ${esc(when)}` : ''}${weather ? ` <b>·</b> ${esc(weather)}` : ''}</span></div>
    </section>
    ${post ? `<div class="lf-post">
        ${ava(canonName(post.name), 'post')}
        <div class="lf-post-body">
            <div class="lf-post-n">${esc(canonName(post.name))}</div>
            ${post.line ? `<div class="lf-post-line">— ${esc(post.line)}</div>` : ''}
            ${post.narr ? `<div class="lf-post-narr">${esc(post.narr)}</div>` : ''}
        </div>
    </div>` : ''}
    ${ch ? `<button class="lf-statechip" data-act="chron" data-mes="${ch.i}">${icon('spark')}<span>${ch.e.chips.map(esc).join(' <b>·</b> ')}</span></button>` : ''}
    ${present.length ? `<div class="lf-present">${present.map(n => {
        const mood = moodOf(n, st);
        return `<button class="lf-pers" data-act="person" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span>${mood ? `<span class="lf-pers-m">${esc(cut(mood, 20))}</span>` : ''}</button>`;
    }).join('')}</div>` : ''}
    <div class="lf-actions">
        <button class="lf-btn primary serif" data-act="read" data-start="${fch.start}">${isCur ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <button class="lf-btn" data-act="new-chapter">${icon('feather')} Новая глава</button>
    </div>
    <div class="lf-actions">
        <button class="lf-btn" data-act="director">${icon('scene')} Режиссёр</button>
        <button class="lf-btn" data-act="time-skip">${icon('sunrise')} Перейти к утру</button>
    </div>
    <div id="lf-chapters">${sec('Главы', `${list.length} · один чат, модель видит всё`)}</div>
    <div class="lf-chlist">${shown.map(c => chapterCard(c, fch.start)).join('')}</div>
    ${list.length > shown.length ? `<button class="lf-btn ghost full" data-act="more-ch">Ещё ${Math.min(30, list.length - shown.length)}</button>` : ''}`;
}

// ───── Карта ─────

function mapLevel() { const key = ui.mapStack[ui.mapStack.length - 1]; return key ? { key, place: settings().places[key] } : null; }

function pinsFor(level, region) {
    const out = [];
    for (const [key, p] of Object.entries(settings().places)) {
        if (p.x == null || p.y == null) continue;
        const parts = key.split('·');
        if (level) { if (parts.length < 2 || parts.slice(0, -1).join('·') !== level.key) continue; }
        else if (parts.length !== 1 || p.region !== region?.id) continue;
        out.push([key, p]);
    }
    return out;
}

function vehicleFor(names, st) {
    for (const [n, it] of Object.entries(st.items || {})) if (isVehicle(n, it) && names.some(x => sameName(x, it.holder))) return n;
    for (const [n, it] of Object.entries(st.items || {})) if (isVehicle(n, it)) return n;
    return '';
}

function placeCardHtml(loc, { inline = false } = {}) {
    const st = worldState();
    const cover = placeCover(loc);
    const curKey = placeKey(st.scene?.location);
    const key = placeKey(loc);
    const here = curKey === key || curKey.startsWith(key + '·');
    const present = here ? (st.scene?.characters_present || []).map(canonName) : [];
    const chs = chaptersAt(loc);
    const p = getPlace(loc);
    const desc = placeDesc(loc);
    const inside = !!p?.plan || [...knownLocations().keys()].some(k => k.startsWith(key + '·'));
    const car = vehicleFor(present.length ? present : (st.scene?.characters_present || []), st);
    const meta = [present.length ? `${present.map(shortName).join(', ')} ${present.length > 1 ? 'здесь' : 'здесь'}` : '', chs.length ? `${chs.length} ${plural(chs.length, 'глава', 'главы', 'глав')}` : 'ещё не бывали'].filter(Boolean).join(' · ');
    return `<div class="lf-placecard${inline ? ' inline' : ''}" data-key="${esc(key)}">
        <div class="lf-pc-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}>${cover ? '' : icon(placeIcon(loc), 'xl')}</div>
        <div class="lf-pc-body">
            <h3>${esc(placeName(loc))}</h3>
            <div class="lf-pc-meta">${esc(meta)}</div>
            ${desc && !inline ? `<div class="lf-pc-desc">${esc(cut(desc, 200))}</div>` : ''}
            ${here ? `<div class="lf-here">${icon('target')} Вы здесь</div>` : `<button class="lf-btn primary serif go" data-act="travel" data-loc="${esc(loc)}">Отправиться ${icon('right')}</button>`}
            <div class="lf-pc-foot">
                ${!here ? `<span>${icon(car ? 'car' : 'walk')} ${car ? `На машине · ${esc(cut(car, 22))}` : 'Пешком'}</span>` : ''}
                ${inside ? `<button class="lf-link" data-act="inside" data-key="${esc(key)}">${icon('door')} Внутри</button>` : ''}
                <button class="lf-link" data-act="place-menu" data-loc="${esc(loc)}">${icon('more')}</button>
            </div>
        </div>
    </div>`;
}

function renderAtlas() {
    const s = settings();
    const cur = currentRegion();
    return `<div class="lf-pagehead"><div><span class="lf-kicker">Атлас</span><h1>Карты</h1></div>
        <button class="lf-iconbtn" data-act="atlas-close">${icon('x')}</button></div>
    <div class="lf-atlas">${s.regions.map(r => {
        const n = Object.values(s.places).filter(p => p.region === r.id).length;
        return `<button class="lf-card lf-region${r.id === cur?.id ? ' on' : ''}" data-act="region" data-id="${esc(r.id)}">
            <span class="lf-region-img"${r.map ? ` style="background-image:url('${esc(r.map)}')"` : ''}>${r.map ? '' : icon('map', 'xl')}</span>
            <span class="lf-region-t"><b>${esc(r.name)}</b><small>${n} ${plural(n, 'место', 'места', 'мест')}${r.id === cur?.id ? ' · вы здесь' : ''}${r.needsMap ? ' · нужна карта' : ''}</small></span>
        </button>`;
    }).join('')}</div>
    <button class="lf-btn ghost full" data-act="region-new">${icon('plus')} Новый район / город / страна</button>`;
}

function renderMap() {
    if (ui.atlas) return renderAtlas();
    const s = settings();
    const st = worldState();
    const level = mapLevel();
    const region = (ui.region && regionById(ui.region)) || currentRegion();
    const img = level ? level.place?.plan : region?.map;
    const curLoc = st.scene?.location || '';
    const curKey = placeKey(curLoc);
    const pins = pinsFor(level, region);
    const present = (st.scene?.characters_present || []).map(canonName);
    const pinHtml = pins.map(([key, p]) => {
        const here = curKey === key || curKey.startsWith(key + '·');
        const sel = ui.sel === key;
        return `<button class="lf-pin${here ? ' here' : ''}${sel ? ' sel' : ''}${ui.editPins ? ' edit' : ''}" data-act="pin" data-key="${esc(key)}" style="left:${p.x}%;top:${p.y}%">
            <span class="lf-pin-label">${icon(iconName(p.icon))}${esc(locLeaf(p.name))}${here && present.length ? `<span class="lf-pin-who">${present.slice(0, 3).map(n => ava(n, 'xs')).join('')}</span>` : ''}</span>
            <span class="lf-pin-stem"></span><span class="lf-pin-dot"></span>
        </button>`;
    }).join('');

    const known = knownLocations();
    const placed = new Set(pins.map(([k]) => k));
    const unplaced = [];
    for (const [k, raw] of known) {
        if (placed.has(k)) continue;
        const parts = k.split('·');
        if (level) { if (parts.length >= 2 && parts.slice(0, -1).join('·') === level.key) unplaced.push([k, raw]); continue; }
        if (parts.length !== 1) continue;
        const p = s.places[k];
        if (!p?.region || p.region === region?.id) unplaced.push([k, raw]);
    }
    // выбранное место для карточки
    let selLoc = '';
    if (ui.sel && s.places[ui.sel]) selLoc = s.places[ui.sel].raw || s.places[ui.sel].name;
    else if (level) selLoc = curKey.startsWith(level.key + '·') ? curLoc : '';
    else selLoc = placeRegion(curLoc)?.id === region?.id ? locTop(curLoc) : '';

    const head = level
        ? `<div class="lf-pagehead"><button class="lf-iconbtn" data-act="map-up">${icon('left')}</button><div class="lf-grow"><span class="lf-kicker">${esc(region?.name || '')}</span><h1>${esc(level.place?.name || level.key)}</h1></div>${pillHtml(st)}</div>`
        : `<div class="lf-pagehead"><div class="lf-grow"><span class="lf-kicker">Карта</span><h1>${esc(region?.name || 'Мир')}</h1></div>${pillHtml(st)}</div>`;
    const regs = !level ? `<div class="lf-chips">
        <button class="lf-chip" data-act="atlas">${icon('layers')} Атлас</button>
        ${s.regions.map(r => `<button class="lf-chip${r.id === region?.id ? ' on' : ''}" data-act="region" data-id="${esc(r.id)}">${esc(r.name)}${r.needsMap ? ' •' : ''}</button>`).join('')}
    </div>` : '';

    const mapBox = img ? `<div class="lf-map${ui.editPins ? ' editing' : ''}">
            <div class="lf-map-in" data-act="map-tap"><img src="${esc(img)}" alt="" draggable="false">${pinHtml}</div>
            ${ui.editPins ? `<div class="lf-map-hint">${icon('pencil')} Тапни по карте — поставить метку, тяни метку — подвинуть</div>` : ''}
        </div>`
        : `<div class="lf-mapempty">
            ${icon(level ? 'home' : 'map', 'xl')}
            <b>${level ? 'Плана пока нет' : `Карты «${esc(region?.name)}» пока нет`}</b>
            <span>${level ? 'Загрузи свою картинку (квартира сверху, изометрия) или нарисуй — и расставь комнаты.' : `Нарисую ${unplaced.length ? `сразу с местами (${unplaced.slice(0, 9).map(([, r]) => locLeaf(r)).join(', ')}) — метки встанут сами` : 'город сверху'}. Или загрузи свою.`}</span>
            <div class="lf-actions center">
                <button class="lf-btn primary serif" data-act="${level ? 'draw-plan' : 'draw-map'}" data-key="${esc(level?.key || '')}">${icon('wand')} Нарисовать</button>
                <label class="lf-btn">${icon('upload')} Загрузить<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" data-key="${esc(level?.key || '')}" hidden></label>
            </div>
        </div>`;

    return `${head}${regs}${mapBox}
    ${selLoc ? placeCardHtml(selLoc, { inline: true }) : ''}
    ${img ? `<div class="lf-actions">
        <button class="lf-btn${ui.editPins ? ' primary' : ''}" data-act="edit-pins">${icon(ui.editPins ? 'check' : 'pencil')} ${ui.editPins ? 'Готово' : 'Метки'}</button>
        <button class="lf-btn icon" data-act="map-menu" data-key="${esc(level?.key || '')}" title="Карта">${icon('more')}</button>
    </div>` : ''}
    ${unplaced.length ? `${sec('Без метки', ui.editPins ? 'тапни место, потом точку' : img ? 'нарисую или поставь сама' : 'места из истории')}
        <div class="lf-chips wrap">${unplaced.map(([k, raw]) => `<button class="lf-chip${ui.placing === k ? ' on' : ''}" data-act="${ui.editPins && img ? 'placing' : 'place'}" data-key="${esc(k)}" data-loc="${esc(raw)}">${icon(iconName(s.places[k]?.icon || guessPlaceIcon(norm(locLeaf(raw)))))} ${esc(locLeaf(raw))}</button>`).join('')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="add-place">${icon('plus')} Новое место</button>`;
}

// ───── Персонаж ─────

function wardrobeWorn(name) {
    const w = ctx().chatMetadata?.wardrobe;
    if (!w?.chars) return null;
    for (const [n, st] of Object.entries(w.chars)) if (sameName(n, name)) return st?.worn || [];
    return null;
}

function wardrobeSets(name) {
    const sets = ctx().extensionSettings?.wardrobe?.sets || [];
    return sets.filter(x => !x.owner || sameName(x.owner, name));
}

function renderPerson() {
    const st = worldState();
    const names = castNames(st);
    if (!ui.who || !names.some(n => sameName(n, ui.who))) ui.who = (st.scene?.characters_present || []).map(canonName).find(n => !sameName(n, ctx().name1)) || names.find(n => !sameName(n, ctx().name1)) || names[0] || '';
    const who = ui.who;
    if (!who) return `<div class="lf-empty">${icon('users', 'xl')}В этом чате пока никого.</div>`;
    const people = `<div class="lf-people">${names.map(n => `<button class="lf-pers${sameName(n, who) ? ' on' : ''}" data-act="who" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div>`;
    const tabs = seg([['wardrobe', 'Гардероб'], ['items', 'Вещи'], ['garage', 'Гараж'], ['rel', 'Отношения']], ui.pTab, 'p-tab');
    const body = ui.pTab === 'wardrobe' ? renderWardrobe(who, st) : ui.pTab === 'garage' ? renderGarage(who, st) : ui.pTab === 'rel' ? renderRelations(who, st) : renderItems(who, st);
    return `${people}${tabs}${body}`;
}

function wardrobeItem(id) { return (ctx().extensionSettings?.wardrobe?.items || []).find(x => x.id === id) || null; }
function setImg(set) { return set?.img || (set?.itemIds || []).map(wardrobeItem).find(it => it?.img)?.img || ''; }

function renderWardrobe(who, st) {
    const worn = wardrobeWorn(who) || [];
    const wornIds = new Set(worn.map(e => e.itemId).filter(Boolean));
    const sets = wardrobeSets(who);
    const isOn = (set) => set.itemIds?.length && set.itemIds.every(id => wornIds.has(id));
    const current = sets.find(isOn);
    if (!sets.some(x => x.id === ui.wset)) ui.wset = (current || sets.find(x => setImg(x)) || sets[0])?.id || '';
    const set = sets.find(x => x.id === ui.wset) || null;
    const on = !!set && isOn(set);
    const img = set?.img || '';
    const look = img || avatarUrl(who, true);
    const pieces = set ? set.itemIds.map(wardrobeItem).filter(Boolean) : worn;
    const drawingNow = !!set && !!window.Wardrobe?.isDrawing?.(set.id);
    const hasApi = !!window.Wardrobe?.wearSets;
    const tabs = sets.length ? (sets.length <= 3
        ? `<div class="lf-seg sets">${sets.map(x => `<button class="${x.id === ui.wset ? 'on' : ''}" data-act="wset" data-v="${esc(x.id)}">${esc(cut(x.name, 18))}</button>`).join('')}</div>`
        : `<div class="lf-chips">${sets.map(x => `<button class="lf-chip${x.id === ui.wset ? ' on' : ''}" data-act="wset" data-v="${esc(x.id)}">${isOn(x) ? icon('check') : ''}${esc(cut(x.name, 22))}</button>`).join('')}</div>`) : '';
    return `<div class="lf-pagehead"><h1>Гардероб</h1><span class="lf-tagpill">${icon('sparkles')} ${esc(cut(canonName(who), 22))}</span></div>
    <section class="lf-wd">
        <div class="lf-wd-look${drawingNow ? ' drawing' : ''}"${look ? ` style="background-image:url('${esc(look)}')"` : ''}>${look ? '' : icon('user', 'xl')}${drawingNow ? '<span class="lf-spin big"></span>' : ''}</div>
        <div class="lf-wd-side">
            <h2>${esc(set ? set.name : 'Сейчас')}</h2>
            <p>${esc(cut((pieces.length ? pieces.map(e => e.name).join(', ') : 'Ничего не записано.'), 150))}</p>
            ${set ? (on ? `<button class="lf-btn primary serif full" disabled>${icon('check')} Надето</button>`
                : `<button class="lf-btn primary serif full" data-act="wset-wear" data-v="${esc(set.id)}" ${hasApi ? '' : 'disabled'}>Надеть</button>`)
                : `<button class="lf-btn primary serif full" data-act="wardrobe" data-tab="sets">Собрать комплект</button>`}
            ${set && !img ? `<button class="lf-btn full" data-act="wset-draw" data-v="${esc(set.id)}">${icon('sparkles')} Нарисовать образ</button>`
                : `<button class="lf-btn full" data-act="wardrobe" data-tab="${set ? 'sets' : 'worn'}">${icon('shirt')} Гардероб</button>`}
            <span class="lf-hint-i">${on ? 'Образ учитывается в сцене' : set ? 'Сейчас надето другое' : 'Образ учитывается в сцене'}</span>
            <div class="lf-wd-grid">${pieces.slice(0, 4).map(e => `<button class="lf-tile sm" data-act="wardrobe" data-tab="${set ? 'sets' : 'worn'}">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : `<span class="lf-tile-ico">${icon('shirt')}</span>`}<span class="lf-tile-n">${esc(cut(e.name, 22))}</span></button>`).join('')}</div>
        </div>
    </section>
    ${tabs}
    ${set && worn.length && !on ? `${sec('Сейчас надето')}<div class="lf-grid">${worn.slice(0, 12).map(e => `<button class="lf-tile" data-act="wardrobe" data-tab="worn">${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy">` : `<span class="lf-tile-ico">${icon('shirt')}</span>`}<span class="lf-tile-n">${esc(cut(e.name, 26))}</span></button>`).join('')}</div>` : ''}
    ${hasApi ? '' : '<div class="lf-hint">Обнови Гардероб (git pull) — тогда «Надеть» заработает прямо отсюда.</div>'}`;
}

function renderItems(who, st) {
    const items = Object.entries(st.items || {}).filter(([n, it]) => !isVehicle(n, it));
    const mine = items.filter(([, it]) => sameName(it?.holder, who));
    const lying = items.filter(([, it]) => !it?.holder);
    const list = ui.itemsTab === 'with' ? mine : ui.itemsTab === 'home' ? lying : items;
    if (!list.some(([n]) => n === ui.item)) ui.item = list[0]?.[0] || '';
    const tabs = seg([['with', `С собой (${mine.length})`], ['home', `Не при себе (${lying.length})`], ['all', `Всё (${items.length})`]], ui.itemsTab, 'items-tab');
    const sel = ui.item ? st.items[ui.item] : null;
    return `<div class="lf-pagehead"><h1>Инвентарь</h1><span class="lf-subtitle">Вещи, детали, следы истории</span></div>
    ${tabs}
    ${list.length ? `<div class="lf-grid">${list.slice(0, 60).map(([n, it]) => itemTile(n, it, n === ui.item)).join('')}</div>` : `<div class="lf-empty small">${ui.itemsTab === 'with' ? `У ${esc(shortName(who))} при себе ничего не записано.` : 'Пусто.'}</div>`}
    ${sel ? itemCard(ui.item, sel) : ''}
    <div class="lf-actions">
        <button class="lf-btn" data-act="item-add">${icon('plus')} Вещь</button>
        <button class="lf-btn" data-act="inv-clean">${icon('sparkles')} Почистить инвентарь</button>
    </div>`;
}

function itemTile(name, it, on) {
    const img = itemImg(name);
    const imp = it?.importance === '!!' || it?.importance === '!';
    return `<button class="lf-tile${on ? ' on' : ''}" data-act="item" data-name="${esc(name)}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="lf-tile-ico emoji">${esc(it?.icon || '✦')}</span>`}
        <span class="lf-tile-n">${esc(cut(name, 30))}</span>
        ${imp || on ? `<span class="lf-tile-star">${icon('sparkles')}</span>` : ''}
    </button>`;
}

function itemCard(name, it) {
    const img = itemImg(name);
    const org = itemOrigin(name);
    const when = org ? [org.loc ? placeName(locTop(org.loc)) : '', whenLabel(org.ts?.story_date, org.ts?.story_time)].filter(Boolean).join(' · ') : '';
    return `<section class="lf-itemcard">
        <div class="lf-ic-img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : `<span class="emoji">${esc(it.icon || '✦')}</span>`}
            <button class="lf-ic-draw" data-act="item-pic" data-name="${esc(name)}" title="Картинка">${icon('camera')}</button></div>
        <div class="lf-ic-body">
            <h3>${esc(name)}${it.importance ? ` <span class="lf-gold">${icon('sparkles')}</span>` : ''}</h3>
            ${it.holder ? `<div class="lf-ic-row">${icon('user')}<span>Владелец: ${esc(it.holder)}</span></div>` : ''}
            ${it.location ? `<div class="lf-ic-row">${icon('pin')}<span>${esc(it.location)}</span></div>` : ''}
            ${it.description ? `<div class="lf-ic-row">${icon('file')}<span>${esc(cut(it.description, 160))}</span></div>` : ''}
            ${when ? `<div class="lf-ic-row line" data-act="jump" data-mes="${org.i}">${icon('clock')}<span>${esc(when)}</span></div>` : ''}
        </div>
        <div class="lf-ic-actions">
            <button class="lf-btn primary serif" data-act="item-give" data-name="${esc(name)}">Передать</button>
            <button class="lf-btn" data-act="item-edit" data-name="${esc(name)}">Изменить</button>
            <button class="lf-btn" data-act="item-drop" data-name="${esc(name)}">Убрать</button>
        </div>
    </section>`;
}

function renderGarage(who, st) {
    const cars = Object.entries(st.items || {}).filter(([n, it]) => isVehicle(n, it));
    if (!cars.length) {
        return `<div class="lf-pagehead"><h1>${icon('car', 'h')} Гараж</h1></div>
        <div class="lf-empty small">Машин в истории пока нет. Как только в посте появится тачка, Летописец запишет её сюда — или добавь сама.</div>
        <button class="lf-btn ghost full" data-act="item-add" data-kind="транспорт">${icon('plus')} Добавить машину</button>`;
    }
    if (!cars.some(([n]) => n === ui.car)) ui.car = cars.find(([, it]) => sameName(it.holder, who))?.[0] || cars[0][0];
    const it = st.items[ui.car] || {};
    const img = itemImg(ui.car);
    const s = settings();
    const st2 = worldState();
    const present = (st2.scene?.characters_present || []).map(canonName);
    const others = castNames(st2).filter(n => !sameName(n, who));
    const dests = Object.entries(s.places).filter(([k]) => !k.includes('·')).slice(0, 40);
    return `<div class="lf-pagehead"><h1>${icon('car', 'h')} Гараж</h1></div>
    ${cars.length > 1 ? `<div class="lf-chips">${cars.map(([n]) => `<button class="lf-chip${n === ui.car ? ' on' : ''}" data-act="car" data-v="${esc(n)}">${esc(cut(n, 22))}</button>`).join('')}</div>` : ''}
    <section class="lf-car">
        <div class="lf-car-img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : icon('car', 'xl')}
            <button class="lf-glass" data-act="item-pic" data-name="${esc(ui.car)}">${icon('camera')} ${img ? 'Сменить' : 'Картинка'}</button></div>
        <h2>${esc(ui.car)}</h2>
        <div class="lf-car-row"><span>${icon('key')} Ключи ${it.holder ? `у ${esc(shortName(it.holder))}` : 'не у кого'}</span>${it.location ? `<span>${icon('pin')} ${esc(cut(it.location, 26))}</span>` : ''}</div>
    </section>
    <div class="lf-field row"><label>Взять с собой</label><select data-in="car-who" data-local="1"><option value="">— никого —</option>${others.map(n => `<option value="${esc(n)}" ${present.some(p => sameName(p, n)) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
    <div class="lf-field row"><label>Куда</label><select data-in="car-to" data-local="1">${dests.map(([k, p]) => `<option value="${esc(p.raw || p.name)}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="lf-actions">
        <button class="lf-btn primary serif big" data-act="drive" data-name="${esc(ui.car)}">${icon('car')} Поехать</button>
        <button class="lf-btn big" data-act="car-scene" data-name="${esc(ui.car)}">Сцена в машине</button>
    </div>
    <div class="lf-hint-i center">Разговор продолжится в дороге.</div>`;
}

function renderRelations(who, st) {
    const pairs = relationsState();
    const others = castNames(st).filter(n => !sameName(n, who));
    if (!ui.pair || !others.some(n => sameName(n, ui.pair))) {
        const best = Object.values(pairs).filter(p => sameName(p.a, who) || sameName(p.b, who)).sort((a, b) => b.moments.length - a.moments.length)[0];
        ui.pair = best ? (sameName(best.a, who) ? best.b : best.a) : others[0] || '';
    }
    const other = ui.pair;
    if (!other) return `<div class="lf-empty small">Не с кем строить отношения.</div>`;
    const p = pairs[pairKey(who, other)] || { trust: 50, closeness: 50, tension: 25, moments: [] };
    const pairImg = settings().pairs[pairKey(who, other)];
    const hrel = horaeRelationships().filter(r => (sameName(r.from, who) && sameName(r.to, other)) || (sameName(r.from, other) && sameName(r.to, who)));
    const secrets = secretsState().filter(x => x.knows.some(k => sameName(k, who) || sameName(k, other)));
    const events = horaeEvents().filter(e => { const t = norm(e.event?.summary); return [who, other].every(n => [canonName(n), ...(aliasTable()[canonName(n)] || [])].some(a => t.includes(norm(a).split(' ')[0]))); }).slice(-20).reverse();
    const bar = (ic, label, v, k) => `<div class="lf-bar-row" data-act="pair-edit">${icon(ic)}<span>${label}</span><i class="lf-meter"><b style="width:${v}%"></b></i><small>${v}</small></div>`;
    const tab = ui.relTab;
    let body = '';
    if (tab === 'secrets') {
        body = secrets.length ? secrets.map(x => `<button class="lf-secret" data-act="jump" data-mes="${x.mes}">${icon('lock')}<span><b>Знает ${esc(x.knows.map(n => shortName(canonName(n))).join(', ') || '—')}</b>${esc(x.text)}</span></button>`).join('')
            : `<div class="lf-empty small">Тайн между ними пока нет.</div>`;
    } else if (tab === 'history') {
        body = events.length ? `<div class="lf-timeline">${events.map(e => `<button class="lf-tl" data-act="jump" data-mes="${e.messageIndex}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><small>${esc(whenLabel(e.timestamp?.story_date, e.timestamp?.story_time))}</small>${esc(e.event?.summary)}</span></button>`).join('')}</div>`
            : `<div class="lf-empty small">Общих событий Horae пока не записал.</div>`;
    } else {
        const ms = [...p.moments].reverse().slice(0, 30);
        body = ms.length ? `<div class="lf-timeline">${ms.map(m => `<button class="lf-tl" data-act="jump" data-mes="${m.mes}"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(m.text)}</b><small>${esc(whenLabel(m.ts?.story_date, m.ts?.story_time))}</small></span></button>`).join('')}</div>`
            : `<div class="lf-empty small">Ключевые моменты появятся, когда Летописец их заметит.</div>`;
        if (hrel.length) body = `<div class="lf-hrel">${hrel.map(r => `<span>${esc(r.type || '')}${r.note ? ` — ${esc(cut(r.note, 90))}` : ''}</span>`).join('')}</div>${body}`;
        const own = secrets.filter(x => x.knows.length === 1)[0];
        if (own) body += `<button class="lf-secret big" data-act="jump" data-mes="${own.mes}">${icon('lock')}<span><b>Знает только ${esc(shortName(canonName(own.knows[0])))}</b>${esc(own.text)}</span></button>`;
    }
    return `<div class="lf-pagehead"><h1>${icon('rings', 'h')} Отношения</h1></div>
    <div class="lf-chips">${others.map(n => `<button class="lf-chip${sameName(n, other) ? ' on' : ''}" data-act="pair" data-v="${esc(n)}">${esc(shortName(n))}</button>`).join('')}</div>
    <section class="lf-pairhero"${pairImg ? ` style="background-image:url('${esc(pairImg)}')"` : ''}>
        ${pairImg ? '' : `<div class="lf-pair-avas">${ava(who, 'xl')}${ava(other, 'xl')}</div>`}
        <button class="lf-glass" data-act="pair-pic">${icon('image')} ${pairImg ? 'Сменить' : 'Кадр пары'}</button>
        <h2>${esc(shortName(canonName(who)))} <i>×</i> ${esc(shortName(canonName(other)))}</h2>
    </section>
    <div class="lf-bars">
        ${bar('handshake', 'Доверие', p.trust)}
        ${bar('heart', 'Близость', p.closeness)}
        ${bar('zap', 'Напряжение', p.tension)}
    </div>
    ${seg([['common', 'Общее'], ['secrets', 'Секреты'], ['history', 'История']], tab, 'rel-tab')}
    ${body}`;
}

// ───── Мир ─────

function renderWorld() {
    const st = worldState();
    const tab = ui.worldTab;
    let body = '';
    if (tab === 'events') {
        const ev = horaeEvents().slice(-60).reverse();
        const lc = lastChron();
        body = `${ev.length ? `<div class="lf-events">${ev.map(e => {
            const ch = chapterOf(e.messageIndex);
            const cover = ch ? chapterCover(ch) : '';
            return `<button class="lf-ev" data-act="jump" data-mes="${e.messageIndex}">
                <span class="lf-ev-dot"></span>
                <span class="lf-ev-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></span>
                <span class="lf-ev-t">${esc(e.timestamp?.story_time || e.timestamp?.story_date || `#${e.messageIndex}`)}</span>
                <span class="lf-ev-x">${esc(e.event?.summary)}</span>
            </button>`;
        }).join('')}</div>` : `<div class="lf-empty small">Horae ещё не записал событий.</div>`}
        ${lc ? `<section class="lf-fromscene">
            <div class="lf-fs-img"${chapterCover(chapterOf(lc.i) || {}) ? ` style="background-image:url('${esc(chapterCover(chapterOf(lc.i)))}')"` : ''}></div>
            <div class="lf-fs-body"><span class="lf-badge">Из сцены:</span><h3>${esc(lc.e.chips[0])}</h3>${lc.e.chips.length > 1 ? `<small>${esc(lc.e.chips.slice(1).join(' · '))}</small>` : ''}
            <div class="lf-actions tight"><button class="lf-btn primary" data-act="chron-ok" data-mes="${lc.i}">${icon('check')} Подтвердить</button><button class="lf-btn" data-act="chron" data-mes="${lc.i}">${icon('pencil')} Изменить</button></div></div>
        </section>` : ''}`;
    } else if (tab === 'state') {
        const chat = chatArr();
        const rows = [];
        for (let i = chat.length - 1; i >= 0 && rows.length < 25; i--) {
            const e = chronOf(i);
            if (e) rows.push(`<button class="lf-row${e.undone ? ' off' : ''}" data-act="chron" data-mes="${i}">${icon('spark')}<span><b>#${i}</b> ${esc((e.chips || []).join(' · ') || `${(e.ops || []).length} правок вещей`)}${e.undone ? ' — откатено' : ''}</span>${icon('chevR', 'dim')}</button>`);
        }
        const ag = horaeAgenda();
        body = `${sec('Летописец', chronProfile() ? esc(chronProfile()) : 'профиль не выбран')}
        <div class="lf-actions">
            <button class="lf-btn" data-act="chron-last">${icon('refresh')} Проверить последний пост</button>
            <button class="lf-btn" data-act="inv-clean">${icon('sparkles')} Почистить инвентарь</button>
        </div>
        <div class="lf-list">${rows.join('') || '<div class="lf-empty small">Летописец ещё ничего не записал.</div>'}</div>
        ${ag.length ? `${sec('Планы')}<div class="lf-list">${ag.map(a => `<button class="lf-row" data-act="jump" data-mes="${a.messageIndex}">${icon('calendar')}<span>${a.date ? `<b>${esc(a.date)}</b> · ` : ''}${esc(a.text)}</span>${icon('chevR', 'dim')}</button>`).join('')}</div>` : ''}`;
    } else if (tab === 'time') {
        body = `<section class="lf-clock">
            <span class="lf-clock-d">${esc([weekday(st.timestamp?.story_date), st.timestamp?.story_date].filter(Boolean).join(', ') || 'дата не записана')}</span>
            <b>${esc(st.timestamp?.story_time || '—:—')}</b>
            ${st.scene?.atmosphere ? `<span>${esc(st.scene.atmosphere)}</span>` : ''}
        </section>
        <button class="lf-btn primary serif full big" data-act="time-skip">${icon('sunrise')} Перейти к утру</button>
        <div class="lf-chips wrap">${['Прошло несколько часов.', 'Прошёл день.', 'Прошло несколько дней.', 'Прошла неделя.'].map(t => `<button class="lf-chip" data-act="skip" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <div class="lf-hint">Скачок времени — это новая глава со строчкой для модели. Время дальше ведёт Horae.</div>`;
    } else body = renderCfg();
    return `<div class="lf-pagehead"><h1>Память мира</h1><span class="lf-subtitle">${icon('sparkles')} Хроника событий, состояние и течение времени</span></div>
    ${seg([['events', 'События'], ['state', 'Состояние'], ['time', 'Время'], ['cfg', icon('settings')]], tab, 'world-tab').replace('lf-seg', 'lf-seg cfg')}
    ${body}`;
}

function renderCfg() {
    const s = settings();
    const sw = (k, label, obj = s, path = k) => `<label class="lf-switch"><input type="checkbox" data-set="${path}" ${obj[k] ? 'checked' : ''}><span></span>${label}</label>`;
    const profOpts = (cur) => `<option value="">— как у костюмера Гардероба —</option>${profiles().map(p => `<option value="${esc(p.name)}" ${p.name === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
    return `<div class="lf-form">
        ${sw('enabled', 'Life включён')}
        <div class="lf-field"><label>Главы в самом чате</label>
            <select data-set="chatMarks"><option value="off" ${s.chatMarks !== 'thin' ? 'selected' : ''}>никак — сплошной чат, главы только здесь</option><option value="thin" ${s.chatMarks === 'thin' ? 'selected' : ''}>тонкая строчка, где сменилось место</option></select></div>
        ${sw('showFab', 'Плавающая кнопка со свечой')}
        <div class="lf-field"><label>Новая глава, когда меняется</label>
            <select data-set="chapterBy"><option value="top" ${s.chapterBy !== 'full' ? 'selected' : ''}>место целиком (квартира → бар)</option><option value="full" ${s.chapterBy === 'full' ? 'selected' : ''}>даже комната (кухня → спальня)</option></select></div>
        ${sec('Летописец')}
        ${sw('on', 'Летописец после каждого поста', s.chron, 'chron.on')}
        <div class="lf-field"><label>Модель (профиль подключения)</label><select data-set="chron.profile">${profOpts(s.chron.profile)}</select></div>
        <div class="lf-field"><label>Reasoning effort</label><select data-set="chron.effort">${['', 'low', 'medium', 'high'].map(v => `<option value="${v}" ${v === s.chron.effort ? 'selected' : ''}>${v || 'из профиля'}</option>`).join('')}</select></div>
        ${sw('titles', 'Придумывать названия главам', s.chron, 'chron.titles')}
        ${sw('relations', 'Вести шкалы и моменты отношений', s.chron, 'chron.relations')}
        ${sw('secrets', 'Замечать тайны', s.chron, 'chron.secrets')}
        ${sec('Карты и картинки')}
        <div class="lf-field"><label>Новый район</label><select data-set="autoMaps">
            <option value="ask" ${s.autoMaps === 'ask' ? 'selected' : ''}>сказать мне, рисую по кнопке</option>
            <option value="auto" ${s.autoMaps === 'auto' ? 'selected' : ''}>сразу рисовать карту</option>
            <option value="off" ${s.autoMaps === 'off' ? 'selected' : ''}>молчать</option></select></div>
        <div class="lf-field"><label>Стиль картинок <small>(по-английски)</small></label><textarea rows="3" data-set="artStyle">${esc(s.artStyle)}</textarea></div>
        <div class="lf-field"><label>Как зовут персонажей в тексте <small>(Имя карточки = прозвища; из Гардероба уже учтены)</small></label><textarea rows="3" data-set="aliases" placeholder="Bucky Barnes = Баки, Джеймс">${esc(s.aliases)}</textarea></div>
        <div class="lf-field"><label>Что сейчас уходит модели от Life</label><pre class="lf-pre">${esc(updateMovePrompt() || '— ничего: Life молчит, пока ты не нажмёшь «Отправиться», «Новая глава» или «Режиссёр» —')}</pre></div>
        <div class="lf-foot">Life ${VERSION} · Horae ${esc(window.Horae?.version || 'не найден')} · <code>/life</code></div>
    </div>`;
}

// ───── листы ─────

function openSheet(title, html, onMount) {
    const host = document.querySelector('#lf-app .lf-sheet-host');
    if (!host) return null;
    host.innerHTML = `<div class="lf-sheet-back" data-act="sheet-close"></div>
        <div class="lf-sheet" role="dialog">
            <div class="lf-sheet-grab"></div>
            <div class="lf-sheet-head"><div class="lf-sheet-title">${title}</div><button class="lf-x" data-act="sheet-close">${icon('x')}</button></div>
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

function travelSheet(loc, { how = '' } = {}) {
    const st = worldState();
    const present = (st.scene?.characters_present || []).map(canonName);
    const cast = castNames(st);
    const who = present.length ? present : cast;
    const cover = placeCover(loc);
    const car = vehicleFor(who, st);
    const hows = [['пешком', 'walk'], car ? [`на машине (${car})`, 'car'] : ['на машине', 'car'], ['на мотоцикле', 'bike'], ['на такси', 'car'], ['на квинджете', 'plane']];
    openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-field"><label>Кто идёт</label>
            <div class="lf-people wrap">${cast.map(n => `<button class="lf-pers sel${who.some(x => sameName(x, n)) ? ' on' : ''}" data-act="toggle" data-name="${esc(n)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div></div>
        <div class="lf-field"><label>Как</label>
            <div class="lf-chips wrap" data-how>${hows.map(([h, ic]) => `<button class="lf-chip${h === how || (how && h.startsWith(how)) ? ' on' : ''}" data-act="how" data-how="${esc(h)}">${icon(ic)} ${esc(h)}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Заметка для модели <small>(необязательно)</small></label><input type="text" data-in="note" placeholder="например: едут молча после ссоры"></div>
        <button class="lf-btn primary serif full big" data-act="travel-go" data-loc="${esc(loc)}">${icon('route')} Отправиться</button>
        <div class="lf-hint">В чат встанет разделитель новой главы, Horae запомнит новое место, а модель один раз получит короткую заметку о переходе. Пост пишешь ты, как обычно.</div>`);
}

async function playTravel(loc, how) {
    const host = document.querySelector('#lf-app .lf-travel');
    if (!host) return;
    const cover = placeCover(loc);
    const ic = /машин|такси/.test(how) ? 'car' : /мотоцикл/.test(how) ? 'bike' : /квинджет/.test(how) ? 'plane' : 'walk';
    host.innerHTML = `<div class="lf-travel-img"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}></div>
        <div class="lf-travel-txt">${icon(ic, 'travel')}<small>${esc(how || 'в путь')}</small><b>${esc(placeName(loc))}</b><span class="lf-travel-bar"><i></i></span></div>`;
    host.classList.add('on');
    await new Promise(r => setTimeout(r, 1500));
    host.classList.add('out');
    await new Promise(r => setTimeout(r, 380));
    host.classList.remove('on', 'out');
    host.innerHTML = '';
}

function newChapterSheet({ note = '', title = '' } = {}) {
    const st = worldState();
    openSheet(`${icon('feather')} Новая глава`, `
        <div class="lf-field"><label>Название главы</label><input type="text" data-in="title" value="${esc(title)}" placeholder="например: Утро после"></div>
        <div class="lf-field"><label>Место <small>(пусто — то же: ${esc(placeName(st.scene?.location))})</small></label><input type="text" data-in="loc" placeholder="${esc(st.scene?.location || 'Квартира·Кухня')}"></div>
        <div class="lf-field"><label>Что изменилось <small>(уйдёт модели одной строкой)</small></label>
            <div class="lf-chips wrap">${['Прошла ночь, утро.', 'Прошло несколько часов.', 'Прошло несколько дней.', 'Тем временем, в другом месте.'].map(t => `<button class="lf-chip" data-act="fill-note" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
            <input type="text" data-in="note" value="${esc(note)}" placeholder="или своими словами"></div>
        <button class="lf-btn primary serif full big" data-act="chapter-go">${icon('feather')} Начать главу</button>`);
}

function directorSheet() {
    const d = chatMeta().director || {};
    const opt = (k, list) => `<div class="lf-chips wrap" data-dir="${k}">${list.map(v => `<button class="lf-chip${d[k] === v ? ' on' : ''}" data-act="dir-pick" data-k="${k}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
    openSheet(`${icon('scene')} Режиссёр сцены`, `
        <div class="lf-field"><label>${icon('moon')} Время</label>${opt('time', ['Утро', 'День', 'Вечер', 'Ночь', 'Рассвет'])}</div>
        <div class="lf-field"><label>${icon('rain')} Погода</label>${opt('weather', ['Ясно', 'Дождь', 'Снег', 'Туман', 'Гроза', 'Метель'])}</div>
        <div class="lf-field"><label>Тон</label>${opt('tone', ['Тихое напряжение', 'Нежность', 'Ссора', 'Юмор', 'Тревога', 'Страсть', 'Горе'])}</div>
        <div class="lf-field"><label>Своими словами <small>(необязательно)</small></label><input type="text" data-in="dir-text" value="${esc(d.free || '')}" placeholder="например: за окном впервые за зиму пошёл снег"></div>
        <button class="lf-btn primary serif full big" data-act="dir-go">${icon('sparkles')} Задать для следующего ответа</button>
        ${d.once ? `<button class="lf-btn ghost full" data-act="dir-clear">Снять: «${esc(cut(d.text, 60))}»</button>` : ''}
        <div class="lf-hint">Уходит модели одной строкой и только на следующий ответ, потом сбрасывается. Кадры и музыка — в следующем обновлении.</div>`);
}

function placeMenu(loc) {
    const p = getPlace(loc, true);
    const key = placeKey(loc);
    const s = settings();
    const top = !key.includes('·');
    openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `
        ${placeCardHtml(loc)}
        ${sec('Картинка')}
        <div class="lf-actions">
            <button class="lf-btn" data-act="draw-place" data-loc="${esc(loc)}">${icon('wand')} Нарисовать</button>
            <label class="lf-btn">${icon('upload')} Своя<input type="file" accept="image/*" data-file="place" data-loc="${esc(loc)}" hidden></label>
            ${p?.img ? `<button class="lf-btn icon" data-act="place-noimg" data-loc="${esc(loc)}">${icon('trash')}</button>` : ''}
        </div>
        ${sec('План внутри', `комнаты — «${esc(locTop(loc))}·Кухня»`)}
        <div class="lf-actions">
            <label class="lf-btn">${icon('upload')} ${p?.plan ? 'Сменить план' : 'Загрузить план'}<input type="file" accept="image/*" data-file="plan" data-key="${esc(key)}" hidden></label>
            <button class="lf-btn" data-act="draw-plan" data-key="${esc(key)}">${icon('wand')} Нарисовать план</button>
        </div>
        ${top ? `${sec('Район')}<div class="lf-chips wrap">${s.regions.map(r => `<button class="lf-chip${p.region === r.id ? ' on' : ''}" data-act="place-region" data-id="${esc(r.id)}" data-loc="${esc(loc)}">${esc(r.name)}</button>`).join('')}</div>` : ''}
        ${sec('Значок')}
        <div class="lf-chips wrap">${PLACE_ICON_NAMES.map(ic => `<button class="lf-chip icon${placeIcon(loc) === ic ? ' on' : ''}" data-act="place-icon" data-icon="${ic}" data-loc="${esc(loc)}">${icon(ic)}</button>`).join('')}</div>
        <div class="lf-field"><label>Название на карте</label><div class="lf-inline"><input type="text" data-in="pname" value="${esc(placeName(loc))}"><button class="lf-btn" data-act="place-rename" data-loc="${esc(loc)}">OK</button></div></div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="place-chapters" data-loc="${esc(loc)}">${icon('book')} Главы здесь</button>
            ${p?.x != null ? `<button class="lf-btn" data-act="unpin" data-loc="${esc(loc)}">${icon('pin')} Снять метку</button>` : ''}
        </div>`);
}

function chronSheet(i) {
    const e = chronOf(i);
    const m = chatArr()[i];
    if (!e || !m) { toast('info', 'Для этого поста записи нет'); return; }
    const opLine = (o) => o.op === 'drop' ? `убрала «${esc(o.name)}»`
        : o.op === 'merge' ? `склеила ${(o.names || []).map(n => `«${esc(n)}»`).join(', ')} → «${esc(o.into)}»`
            : o.op === 'rename' ? `«${esc(o.name)}» → «${esc(o.to)}»`
                : `«${esc(o.name)}»${o.holder ? ` у ${esc(o.holder)}` : ''}${o.where ? ` — ${esc(o.where)}` : ''}`;
    openSheet(`${icon('spark')} Летописец · #${i}`, `
        ${e.chips?.length ? `<div class="lf-statechip static">${icon('spark')}<span>${e.chips.map(esc).join(' <b>·</b> ')}</span></div>` : ''}
        ${e.ops?.length ? `${sec('Вещи')}<div class="lf-list">${e.ops.map(o => `<div class="lf-row">${icon(o.op === 'drop' ? 'trash' : o.op === 'merge' ? 'layers' : 'box')}<span>${opLine(o)}</span></div>`).join('')}</div>` : ''}
        ${e.rel?.length ? `${sec('Отношения')}<div class="lf-list">${e.rel.map(r => `<div class="lf-row">${icon('rings')}<span>${esc(r.a)} × ${esc(r.b)}: ${[r.trust && `доверие ${r.trust > 0 ? '+' : ''}${r.trust}`, r.closeness && `близость ${r.closeness > 0 ? '+' : ''}${r.closeness}`, r.tension && `напряжение ${r.tension > 0 ? '+' : ''}${r.tension}`].filter(Boolean).join(', ')}${r.moment ? ` — ${esc(r.moment)}` : ''}</span></div>`).join('')}</div>` : ''}
        ${e.sec?.length ? `${sec('Тайны')}<div class="lf-list">${e.sec.map(x => `<div class="lf-row">${icon('lock')}<span>${esc(x.text)} <small>знает: ${esc(x.knows.join(', '))}</small></span></div>`).join('')}</div>` : ''}
        ${e.place ? `<div class="lf-hint">Место: ${esc(e.place.location)}${e.place.region ? ` · район «${esc(e.place.region)}»` : ''}</div>` : ''}
        <div class="lf-actions">
            ${e.undone ? `<button class="lf-btn primary" data-act="chron-redo" data-mes="${i}">${icon('refresh')} Применить снова</button>` : `<button class="lf-btn" data-act="chron-undo" data-mes="${i}">${icon('undo')} Откатить</button>`}
            <button class="lf-btn" data-act="chron-rerun" data-mes="${i}">${icon('refresh')} Перечитать пост</button>
        </div>
        <div class="lf-hint">Вещи поправить руками: Персонаж → Вещи → карточка вещи.</div>`);
}

function itemEditSheet(name = '', kind = '') {
    const st = worldState();
    const it = name ? (st.items?.[name] || {}) : {};
    const cast = castNames(st);
    openSheet(name ? `${esc(it.icon || '✦')} ${esc(name)}` : `${icon('plus')} Новая вещь`, `
        <div class="lf-field"><label>Название</label><input type="text" data-in="iname" value="${esc(name)}"></div>
        <div class="lf-field"><label>У кого</label><select data-in="iholder"><option value="">— ни у кого, лежит —</option>${cast.map(n => `<option value="${esc(horaeName(n, st))}" ${sameName(n, it.holder) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        <div class="lf-field"><label>Где лежит <small>(если ни у кого)</small></label><input type="text" data-in="iwhere" value="${esc(it.location || '')}"></div>
        <div class="lf-field"><label>Описание</label><input type="text" data-in="inote" value="${esc(it.description || '')}"></div>
        <div class="lf-field"><label>Тип</label><div class="lf-chips wrap" data-kind>${['вещь', 'транспорт', 'ключи', 'документ', 'оружие', 'техника', 'подарок'].map(k => `<button class="lf-chip${(itemInfo(name).kind || kind || 'вещь') === k ? ' on' : ''}" data-act="kind" data-v="${k}">${k}</button>`).join('')}</div></div>
        <button class="lf-btn primary serif full big" data-act="item-save" data-name="${esc(name)}">${icon('check')} Сохранить</button>
        <div class="lf-hint">Правка уйдёт в Horae — модель увидит её в следующем ответе.</div>`);
}

function picSheet(kind, name, { draw = true } = {}) {
    openSheet(`${icon('image')} Картинка`, `
        <div class="lf-actions">
            ${draw ? `<button class="lf-btn primary" data-act="draw-${kind}" data-name="${esc(name)}">${icon('wand')} Нарисовать</button>` : ''}
            <label class="lf-btn">${icon('upload')} Загрузить<input type="file" accept="image/*" data-file="${kind}" data-name="${esc(name)}" hidden></label>
        </div>`);
}

function addPlaceSheet(x = null, y = null) {
    const level = mapLevel();
    openSheet(`${icon('plus')} Новое место`, `
        <div class="lf-field"><label>Название${level ? ` <small>(внутри «${esc(level.place?.name || level.key)}»)</small>` : ''}</label><input type="text" data-in="newplace" placeholder="${level ? 'Кухня' : 'Бар «Полночь»'}"></div>
        <button class="lf-btn primary full" data-act="add-place-ok" ${x != null ? `data-x="${x}" data-y="${y}"` : ''}>${icon('check')} Добавить</button>`);
}

function frameSheet(start, loc) {
    openSheet(`${icon('image')} Кадр главы`, `
        <div class="lf-actions">
            <button class="lf-btn primary" data-act="draw-frame" data-start="${start}">${icon('wand')} Нарисовать кадр сцены</button>
            <label class="lf-btn">${icon('upload')} Свой<input type="file" accept="image/*" data-file="frame" data-start="${start}" hidden></label>
        </div>
        ${loc ? `<button class="lf-btn full" data-act="place-menu" data-loc="${esc(locTop(loc))}">${icon('pin')} Обложка места «${esc(placeName(locTop(loc)))}»</button>` : ''}
        ${(chatMeta().frames || {})[start] ? `<button class="lf-btn ghost full" data-act="frame-del" data-start="${start}">${icon('trash')} Убрать кадр</button>` : ''}
        <div class="lf-hint">Кадр сцены рисуется по последнему посту главы, с лицами присутствующих из Гардероба.</div>`);
}

// ───── рисование ─────

async function withBusy(el, fn, label = 'Рисую…') {
    const html = el?.innerHTML;
    if (el) { el.disabled = true; el.classList.add('busy'); el.innerHTML = `<span class="lf-spin"></span> ${label}`; }
    try { return await fn(); } catch (e) {
        console.warn('[Life]', e);
        toast('warning', esc(String(e?.message || e)), '✦ Life', { timeOut: 9000, escapeHtml: false });
    } finally {
        if (el?.isConnected) { el.disabled = false; el.classList.remove('busy'); el.innerHTML = html; }
    }
}

async function faceRef(name) {
    const c = ctx();
    const n = canonName(name);
    return refData(c.extensionSettings?.wardrobe?.faces?.[n] || avatarUrl(n, true), 768);
}

async function drawRegionMap(region) {
    const s = settings();
    const places = Object.entries(s.places).filter(([k, p]) => !k.includes('·') && (p.region === region.id)).slice(0, SLOTS.length);
    const assigned = places.map(([, p], i) => [p, SLOTS[i]]);
    const path = await drawPicture(mapPrompt(region, assigned), { aspect: '4:3', max: 2200, prefix: 'life_map' });
    region.map = path;
    delete region.needsMap;
    assigned.forEach(([p, slot]) => { p.x = slot[0]; p.y = slot[1]; });
    saveSettings();
    return path;
}

async function addPlaceToMap(region, p) {
    if (!region.map) throw new Error('у района ещё нет карты');
    const used = Object.values(settings().places).filter(x => x.region === region.id && x.x != null);
    const slot = SLOTS.map(sl => [sl, Math.min(...used.map(u => Math.hypot(u.x - sl[0], u.y - sl[1])), 999)]).sort((a, b) => b[1] - a[1])[0][0];
    const ref = await refData(region.map, 1600);
    region.map = await drawPicture(addToMapPrompt(p, slot), { aspect: '4:3', max: 2200, refs: [ref], prefix: 'life_map' });
    p.x = slot[0];
    p.y = slot[1];
    p.region = region.id;
    saveSettings();
}

async function drawFrame(start) {
    const list = chapters();
    const ch = list.find(x => x.start === start);
    if (!ch) return;
    const post = lastPost(ch);
    const st = worldState();
    const isLast = ch === list[list.length - 1];
    const present = (isLast ? (st.scene?.characters_present || []) : []).map(canonName).filter(n => !sameName(n, ctx().name1) || true).slice(0, 2);
    const refs = [];
    for (const n of present) { const r = await faceRef(n); if (r) refs.push(r); }
    const prompt = `Cinematic film still of this moment from a story: ${cut(post?.narr || ch.preview, 500)}`
        + `\nPlace: ${locParts(ch.loc).join(', ') || 'unknown'}. ${placeDesc(ch.loc) ? cut(placeDesc(ch.loc), 200) : ''}`
        + (refs.length ? `\nThe attached images show the faces of: ${present.join(', ')} — keep their faces recognisable, same people.` : '')
        + `\nStyle: ${style()}. Wide 16:9 cinematic framing, no text.`;
    const path = await drawPicture(prompt, { aspect: '16:9', max: 1600, refs, prefix: 'life_frame' });
    const cm = chatMeta();
    cm.frames = cm.frames || {};
    cm.frames[start] = path;
    saveMeta();
}

// ───── обработчики ─────

let pinDrag = null;

function onPointerDown(ev) {
    if (!ui.editPins) return;
    const pin = ev.target.closest('.lf-pin');
    const box = pin?.closest('.lf-map-in');
    if (!pin || !box) return;
    pinDrag = { pin, box, key: pin.dataset.key, x0: ev.clientX, y0: ev.clientY, moved: false };
    pin.setPointerCapture?.(ev.pointerId);
    const move = (e) => {
        if (!pinDrag) return;
        if (!pinDrag.moved && Math.hypot(e.clientX - pinDrag.x0, e.clientY - pinDrag.y0) < 6) return;
        pinDrag.moved = true;
        const r = box.getBoundingClientRect();
        pinDrag.x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
        pinDrag.y = Math.min(98, Math.max(2, ((e.clientY - r.top) / r.height) * 100));
        pin.style.left = `${pinDrag.x}%`;
        pin.style.top = `${pinDrag.y}%`;
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
    if (!s.places[key]) s.places[key] = { name: locParts(raw).join(' · '), raw, icon: guessPlaceIcon(norm(locLeaf(raw))), img: '', plan: '', region: '', x: null, y: null, kind: '' };
    const p = s.places[key];
    p.x = Math.round(x * 10) / 10;
    p.y = Math.round(y * 10) / 10;
    if (!level) p.region = ((ui.region && regionById(ui.region)) || currentRegion())?.id || '';
    saveSettings();
}

async function goTravel(raw, { who = [], how = '', note = '', chapter = true } = {}) {
    await playTravel(raw, how);
    await insertMarker({ location: raw, who, how, note, chapter });
    ui.focus = 'last';
    ui.mapStack = [];
    ui.sel = '';
    closeHub();
    decorate();
    scrollChatBottom();
    toast('success', `Вы в «${esc(placeName(raw))}» — пиши пост`, '✦ Life', { timeOut: 2500 });
}

async function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || !document.getElementById('lf-app')?.contains(el)) return;
    if (el.tagName === 'LABEL') return;
    const act = el.dataset.act;
    const box = el.closest('.lf-sheet');
    const s = settings();
    const loc = el.dataset.loc;
    const val = (sel) => (box || document.getElementById('lf-app'))?.querySelector(sel)?.value?.trim() || '';

    switch (act) {
        case 'close': if (Date.now() - openedAt > 350) closeHub(); break;
        case 'sheet-close': closeSheet(); break;
        case 'tab': ui.tab = el.dataset.tab; ui.editPins = false; ui.atlas = false; closeSheet(); render(); break;
        case 'person': case 'who': ui.who = el.dataset.name; ui.tab = 'person'; ui.item = ''; ui.pair = ''; ui.wset = ''; render(); break;
        case 'p-tab': ui.pTab = el.dataset.v; render(); break;
        case 'items-tab': ui.itemsTab = el.dataset.v; ui.item = ''; render(); break;
        case 'world-tab': ui.worldTab = el.dataset.v; render(); break;
        case 'rel-tab': ui.relTab = el.dataset.v; render(); break;
        case 'pair': ui.pair = el.dataset.v; render(); break;
        case 'car': ui.car = el.dataset.v; render(); break;
        case 'more-ch': ui.chShow += 30; render(); break;
        case 'to-chapters': document.getElementById('lf-chapters')?.scrollIntoView({ behavior: 'smooth' }); break;
        case 'chapter': { const ch = chapters().find(x => x.start === Number(el.dataset.start)); if (ch) chapterSheet(ch); break; }
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
            const cm = chatMeta();
            cm.titles = cm.titles || {};
            const t = val('[data-in="chtitle"]');
            if (t) cm.titles[el.dataset.start] = t; else delete cm.titles[el.dataset.start];
            cm.ver = (cm.ver || 0) + 1;
            saveMeta(); invalidate(); closeSheet(); render(); decorate();
            break;
        }
        case 'ch-unmark': {
            if (!confirm('Убрать разделитель? Глава сольётся с предыдущей (если место то же).')) break;
            await removeMarker(Number(el.dataset.mes));
            closeSheet(); render(); decorate();
            break;
        }
        case 'frame': frameSheet(Number(el.dataset.start), el.dataset.loc || ''); break;
        case 'frame-del': { const cm = chatMeta(); delete (cm.frames || {})[el.dataset.start]; saveMeta(); closeSheet(); render(); decorate(); break; }
        case 'draw-frame': await withBusy(el, async () => { await drawFrame(Number(el.dataset.start)); closeSheet(); render(); decorate(); toast('success', 'Кадр готов'); }); break;
        case 'new-chapter': newChapterSheet(); break;
        case 'time-skip': newChapterSheet({ title: 'Утро', note: 'Прошла ночь, наступило утро.' }); break;
        case 'skip': newChapterSheet({ note: el.dataset.text }); break;
        case 'fill-note': { const inp = box?.querySelector('[data-in="note"]'); if (inp) inp.value = el.dataset.text; break; }
        case 'chapter-go': {
            const title = val('[data-in="title"]');
            const l = val('[data-in="loc"]');
            const note = val('[data-in="note"]');
            if (!title && !l && !note) { toast('info', 'Дай главе название, место или заметку'); break; }
            closeSheet();
            await insertMarker({ location: l, title, note });
            ui.focus = 'last';
            closeHub(); decorate(); scrollChatBottom();
            toast('success', `Глава «${esc(title || placeName(l) || 'новая')}» началась — пиши пост`);
            break;
        }
        case 'director': directorSheet(); break;
        case 'dir-pick': {
            const on = !el.classList.contains('on');
            el.parentElement.querySelectorAll('.lf-chip').forEach(x => x.classList.remove('on'));
            el.classList.toggle('on', on);
            break;
        }
        case 'dir-go': {
            const pick = (k) => box.querySelector(`[data-dir="${k}"] .lf-chip.on`)?.dataset.v || '';
            const d = { time: pick('time'), weather: pick('weather'), tone: pick('tone'), free: val('[data-in="dir-text"]') };
            const text = [d.time && `время — ${d.time.toLowerCase()}`, d.weather && `погода — ${d.weather.toLowerCase()}`, d.tone && `тон сцены — ${d.tone.toLowerCase()}`, d.free].filter(Boolean).join('; ');
            if (!text) { toast('info', 'Выбери хоть что-нибудь'); break; }
            chatMeta().director = { ...d, text, once: true, after: lastAiIndex() };
            saveMeta(); updateMovePrompt(); closeSheet();
            toast('success', 'Модель получит это в следующем ответе');
            break;
        }
        case 'dir-clear': { chatMeta().director = null; saveMeta(); updateMovePrompt(); closeSheet(); break; }

        // карта
        case 'atlas': ui.atlas = true; render(); break;
        case 'atlas-close': ui.atlas = false; render(); break;
        case 'region': ui.region = el.dataset.id; ui.atlas = false; ui.mapStack = []; ui.sel = ''; ui.editPins = false; render(); break;
        case 'region-new': {
            openSheet(`${icon('map')} Новый район`, `<div class="lf-field"><label>Название (район, город, страна, база)</label><input type="text" data-in="rname" placeholder="Бруклин"></div>
                <div class="lf-field"><label>Пара слов для картинки <small>(эпоха, погода, настроение)</small></label><input type="text" data-in="rnote" placeholder="зима 2024, снег"></div>
                <button class="lf-btn primary full" data-act="region-ok">${icon('check')} Добавить</button>`);
            break;
        }
        case 'region-ok': {
            const n = val('[data-in="rname"]');
            if (!n) break;
            const r = findRegion(n, true);
            delete r.fresh;
            r.note = val('[data-in="rnote"]');
            saveSettings(); ui.region = r.id; ui.atlas = false; closeSheet(); render();
            break;
        }
        case 'map-menu': {
            const level = mapLevel();
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            openSheet(`${icon('map')} ${esc(level ? (level.place?.name || '') : region.name)}`, `
                <div class="lf-actions">
                    <label class="lf-btn">${icon('upload')} Загрузить другую<input type="file" accept="image/*" data-file="${level ? 'plan' : 'map'}" data-key="${esc(level?.key || '')}" hidden></label>
                    <button class="lf-btn" data-act="${level ? 'draw-plan' : 'draw-map'}" data-key="${esc(level?.key || '')}">${icon('wand')} Перерисовать</button>
                </div>
                ${level ? '' : `<div class="lf-field"><label>Название района</label><div class="lf-inline"><input type="text" data-in="rname" value="${esc(region.name)}"><button class="lf-btn" data-act="region-rename">OK</button></div></div>
                <div class="lf-field"><label>Пара слов для картинок</label><div class="lf-inline"><input type="text" data-in="rnote" value="${esc(region.note || '')}"><button class="lf-btn" data-act="region-note">OK</button></div></div>
                ${s.regions.length > 1 ? `<button class="lf-btn ghost full" data-act="region-del">${icon('trash')} Удалить район (места останутся)</button>` : ''}`}`);
            break;
        }
        case 'region-rename': { const r = (ui.region && regionById(ui.region)) || currentRegion(); const n = val('[data-in="rname"]'); if (r && n) { r.name = n; saveSettings(); } closeSheet(); render(); break; }
        case 'region-note': { const r = (ui.region && regionById(ui.region)) || currentRegion(); if (r) { r.note = val('[data-in="rnote"]'); saveSettings(); } closeSheet(); break; }
        case 'region-del': {
            const r = (ui.region && regionById(ui.region)) || currentRegion();
            if (!r || s.regions.length < 2 || !confirm(`Удалить район «${r.name}»?`)) break;
            s.regions = s.regions.filter(x => x.id !== r.id);
            for (const p of Object.values(s.places)) if (p.region === r.id) { p.region = ''; p.x = null; p.y = null; }
            ui.region = ''; saveSettings(); closeSheet(); render();
            break;
        }
        case 'map-up': ui.mapStack.pop(); ui.editPins = false; ui.sel = ''; render(); break;
        case 'inside': ui.mapStack.push(el.dataset.key); ui.tab = 'map'; ui.editPins = false; ui.sel = ''; ui.atlas = false; closeSheet(); render(); break;
        case 'edit-pins': ui.editPins = !ui.editPins; ui.placing = null; render(); break;
        case 'placing': ui.placing = el.dataset.key; ui.placingRaw = el.dataset.loc; render(); toast('info', 'Теперь тапни точку на карте', '✦ Life', { timeOut: 1800 }); break;
        case 'map-tap': {
            if (!ui.editPins || ev.target.closest('.lf-pin')) break;
            const r = el.getBoundingClientRect();
            const x = ((ev.clientX - r.left) / r.width) * 100;
            const y = ((ev.clientY - r.top) / r.height) * 100;
            if (ui.placing) { placePin(ui.placing, ui.placingRaw || ui.placing, x, y); ui.placing = null; render(); }
            else addPlaceSheet(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
            break;
        }
        case 'pin': {
            if (pinDrag?.moved || (pinDrag?.justMoved && Date.now() - pinDrag.justMoved < 300)) break;
            const p = s.places[el.dataset.key];
            if (!p) break;
            if (ui.editPins) { placeMenu(p.raw || p.name); break; }
            ui.sel = el.dataset.key;
            render();
            document.querySelector('#lf-app .lf-placecard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            break;
        }
        case 'place': {
            const p = getPlace(loc);
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            if (!mapLevel() && region?.map && (!p || p.x == null)) {
                openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, `${placeCardHtml(loc)}
                    <div class="lf-actions"><button class="lf-btn primary" data-act="add-to-map" data-loc="${esc(loc)}">${icon('wand')} Дорисовать на карту</button>
                    <button class="lf-btn" data-act="edit-pins">${icon('pin')} Поставить метку самой</button></div>`);
            } else openSheet(`${icon(placeIcon(loc))} ${esc(placeName(loc))}`, placeCardHtml(loc));
            break;
        }
        case 'add-to-map': await withBusy(el, async () => {
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            const p = getPlace(loc, true);
            await addPlaceToMap(region, p);
            closeSheet(); render(); toast('success', 'Место на карте');
        }); break;
        case 'place-menu': placeMenu(loc); break;
        case 'place-region': { const p = getPlace(loc, true); p.region = el.dataset.id; saveSettings(); box?.querySelectorAll('[data-act="place-region"]').forEach(x => x.classList.toggle('on', x === el)); render(); break; }
        case 'travel': travelSheet(loc); break;
        case 'toggle': el.classList.toggle('on'); break;
        case 'how': case 'kind': {
            const on = !el.classList.contains('on');
            el.parentElement.querySelectorAll('.lf-chip').forEach(x => x.classList.remove('on'));
            el.classList.toggle('on', on || act === 'kind');
            break;
        }
        case 'travel-go': {
            const st = worldState();
            const who = [...box.querySelectorAll('.lf-pers.sel.on')].map(x => horaeName(x.dataset.name, st));
            const how = box.querySelector('[data-how] .lf-chip.on')?.dataset.how || '';
            const note = val('[data-in="note"]');
            const raw = getPlace(loc)?.raw || loc;
            closeSheet();
            try { await goTravel(raw, { who, how, note, chapter: !mapLevel() || !placeKey(raw).startsWith(mapLevel().key) }); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'add-place': addPlaceSheet(); break;
        case 'add-place-ok': {
            let name = val('[data-in="newplace"]');
            if (!name) break;
            const level = mapLevel();
            if (level) name = `${level.place?.raw || level.place?.name || level.key}·${name}`;
            const p = getPlace(name, true);
            p.raw = name;
            if (!level) p.region = ((ui.region && regionById(ui.region)) || currentRegion())?.id || '';
            if (el.dataset.x) { p.x = Number(el.dataset.x); p.y = Number(el.dataset.y); }
            saveSettings(); closeSheet(); render();
            break;
        }
        case 'place-icon': { getPlace(loc, true).icon = el.dataset.icon; saveSettings(); box?.querySelectorAll('.lf-chip.icon').forEach(x => x.classList.toggle('on', x === el)); render(); break; }
        case 'place-rename': { const n = val('[data-in="pname"]'); if (n) { getPlace(loc, true).name = n; saveSettings(); invalidate(); closeSheet(); render(); decorate(); } break; }
        case 'place-noimg': { const p = getPlace(loc); if (p) { p.img = ''; saveSettings(); } closeSheet(); render(); decorate(); break; }
        case 'unpin': { const p = getPlace(loc); if (p) { p.x = null; p.y = null; saveSettings(); } closeSheet(); render(); break; }
        case 'place-chapters': {
            const chs = chaptersAt(loc).reverse();
            openSheet(`Главы: ${esc(placeName(loc))}`, chs.length ? `<div class="lf-chlist">${chs.map(ch => chapterCard(ch, -1)).join('')}</div>` : '<div class="lf-empty small">Здесь ещё ничего не было.</div>');
            break;
        }
        case 'draw-place': await withBusy(el, async () => { getPlace(loc, true).img = await drawPicture(placePrompt(loc), { prefix: 'life_place' }); saveSettings(); closeSheet(); render(); decorate(); toast('success', 'Картинка готова'); }); break;
        case 'draw-map': await withBusy(el, async () => {
            const region = (ui.region && regionById(ui.region)) || currentRegion();
            // места района без метки — тоже на карту
            for (const [k, raw] of knownLocations()) if (!k.includes('·')) { const p = getPlace(raw, true); if (!p.region) p.region = region.id; }
            await drawRegionMap(region);
            closeSheet(); render();
        }); break;
        case 'draw-plan': await withBusy(el, async () => {
            const key = el.dataset.key || mapLevel()?.key;
            const p = s.places[key] || getPlace(key, true);
            p.plan = await drawPicture(planPrompt(p.raw || p.name), { aspect: '4:3', max: 2200, prefix: 'life_plan' });
            saveSettings(); closeSheet(); render();
        }); break;

        // вещи
        case 'item': ui.item = el.dataset.name; render(); document.querySelector('#lf-app .lf-itemcard')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); break;
        case 'item-pic': picSheet('item', el.dataset.name); break;
        case 'draw-item': await withBusy(el, async () => { const n = el.dataset.name; setItemInfo(n, { img: await drawPicture(itemPrompt(n, worldState().items?.[n]), { aspect: '1:1', max: 900, prefix: 'life_item' }) }); closeSheet(); render(); }); break;
        case 'item-give': {
            const st = worldState();
            const it = st.items?.[el.dataset.name] || {};
            openSheet(`Передать: ${esc(el.dataset.name)}`, `<div class="lf-people wrap">${castNames(st).filter(n => !sameName(n, it.holder)).map(n => `<button class="lf-pers" data-act="give-to" data-name="${esc(n)}" data-item="${esc(el.dataset.name)}">${ava(n, 'md')}<span class="lf-pers-n">${esc(shortName(n))}</span></button>`).join('')}</div>
                <div class="lf-hint">Horae запишет нового владельца — модель увидит это в следующем ответе. Сам момент передачи опиши в посте.</div>`);
            break;
        }
        case 'give-to': {
            await manualItems([{ op: 'set', name: el.dataset.item, holder: horaeName(el.dataset.name), where: '' }]);
            closeSheet(); render(); toast('success', `Теперь у ${esc(shortName(el.dataset.name))}`);
            break;
        }
        case 'item-edit': itemEditSheet(el.dataset.name); break;
        case 'item-add': itemEditSheet('', el.dataset.kind || ''); break;
        case 'item-save': {
            const old = el.dataset.name;
            const name = val('[data-in="iname"]');
            if (!name) break;
            const op = { op: 'set', name, holder: box.querySelector('[data-in="iholder"]').value, where: val('[data-in="iwhere"]'), note: val('[data-in="inote"]') };
            const ops = old && old !== name ? [{ op: 'rename', name: old, to: name }, op] : [op];
            await manualItems(ops);
            const kind = box.querySelector('[data-kind] .lf-chip.on')?.dataset.v;
            if (kind) setItemInfo(name, { kind });
            if (old && old !== name && itemImg(old)) setItemInfo(name, { img: itemImg(old) });
            ui.item = name;
            closeSheet(); render();
            break;
        }
        case 'item-drop': {
            if (!confirm(`Убрать «${el.dataset.name}» из инвентаря?`)) break;
            await manualItems([{ op: 'drop', name: el.dataset.name }]);
            ui.item = ''; render();
            break;
        }
        case 'inv-clean': await withBusy(el, async () => { const n = await cleanInventory(); toast('success', n ? `Правок: ${n}` : 'Инвентарь и так чистый'); render(); }, 'Чищу…'); break;
        case 'drive': {
            const to = val('[data-in="car-to"]');
            const withWho = val('[data-in="car-who"]');
            if (!to) { toast('info', 'Куда едем?'); break; }
            const st = worldState();
            const who = [horaeName(ui.who, st), withWho ? horaeName(withWho, st) : ''].filter(Boolean);
            try { await goTravel(to, { who, how: `на машине (${el.dataset.name})` }); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'car-scene': {
            const st = worldState();
            const withWho = val('[data-in="car-who"]');
            const to = val('[data-in="car-to"]');
            const who = [horaeName(ui.who, st), withWho ? horaeName(withWho, st) : ''].filter(Boolean);
            closeHub();
            await insertMarker({ location: `${el.dataset.name}`, title: 'В дороге', who, how: 'на машине', note: to ? `Едут в «${to}». Разговор в машине, по дороге.` : 'Разговор в машине, по дороге.' });
            ui.focus = 'last'; decorate(); scrollChatBottom();
            break;
        }
        case 'wset': ui.wset = el.dataset.v; render(); break;
        case 'wset-wear': {
            try { if (window.Wardrobe?.wearSets(ui.who, [el.dataset.v])) { toast('success', 'Надето', '👗 Гардероб', { timeOut: 1500 }); render(); } } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'wset-draw': {
            try { window.Wardrobe?.drawSet(el.dataset.v); toast('info', 'Гардероб рисует образ…'); render(); const id = el.dataset.v; const iv = setInterval(() => { if (!window.Wardrobe?.isDrawing?.(id)) { clearInterval(iv); render(); } }, 2500); } catch (e) { toast('warning', esc(String(e?.message || e))); }
            break;
        }
        case 'wardrobe': {
            closeHub();
            if (window.Wardrobe?.open) { setTimeout(() => window.Wardrobe.open(el.dataset.tab || 'worn', ui.who ? (castNames().find(n => sameName(n, ui.who)) || ui.who) : ''), 340); break; }
            try { await ctx().executeSlashCommandsWithOptions?.('/wardrobe'); } catch { toast('info', 'Гардероб не найден'); }
            break;
        }
        case 'pair-pic': picSheet('pair', pairKey(ui.who, ui.pair)); break;
        case 'draw-pair': await withBusy(el, async () => {
            const refs = [await faceRef(ui.who), await faceRef(ui.pair)].filter(Boolean);
            const prompt = `Intimate cinematic portrait of two people together: ${canonName(ui.who)} and ${canonName(ui.pair)}.` + (refs.length ? ' The attached images are their faces, in this order — keep them recognisable.' : '') + `\nStyle: ${style()}. Horizontal, no text.`;
            s.pairs[el.dataset.name] = await drawPicture(prompt, { aspect: '16:9', refs, prefix: 'life_pair' });
            saveSettings(); closeSheet(); render();
        }); break;
        case 'pair-edit': {
            const p = relationsState()[pairKey(ui.who, ui.pair)] || { trust: 50, closeness: 50, tension: 25 };
            const rng = (k, label, v) => `<div class="lf-field"><label>${label}: <b data-out="${k}">${v}</b></label><input type="range" min="0" max="100" value="${v}" data-rng="${k}"></div>`;
            openSheet(`${esc(shortName(ui.who))} × ${esc(shortName(ui.pair))}`, `${rng('trust', 'Доверие', p.trust)}${rng('closeness', 'Близость', p.closeness)}${rng('tension', 'Напряжение', p.tension)}
                <button class="lf-btn primary full" data-act="pair-save">${icon('check')} Сохранить</button>
                <div class="lf-hint">Это точка отсчёта — дальше Летописец двигает шкалы сам после каждого поста.</div>`);
            break;
        }
        case 'pair-save': {
            const cur = relationsState()[pairKey(ui.who, ui.pair)] || { trust: 50, closeness: 50, tension: 25 };
            const cm = chatMeta();
            cm.pairBase = cm.pairBase || {};
            const k = pairKey(ui.who, ui.pair);
            const b0 = cm.pairBase[k] || { trust: 50, closeness: 50, tension: 25 };
            const want = (f) => Number(box.querySelector(`[data-rng="${f}"]`).value);
            cm.pairBase[k] = { trust: b0.trust + want('trust') - cur.trust, closeness: b0.closeness + want('closeness') - cur.closeness, tension: b0.tension + want('tension') - cur.tension };
            saveMeta(); closeSheet(); render();
            break;
        }

        // Летописец
        case 'chron': chronSheet(Number(el.dataset.mes)); break;
        case 'chron-ok': { const e = chronOf(Number(el.dataset.mes)); if (e) { e.seen = true; saveMeta(); } el.closest('.lf-fromscene')?.classList.add('ok'); toast('success', 'Принято', '✦ Летописец', { timeOut: 1200 }); break; }
        case 'chron-undo': await undoChron(Number(el.dataset.mes)); closeSheet(); render(); decorate(); toast('info', 'Откатила правки Летописца'); break;
        case 'chron-redo': {
            const i = Number(el.dataset.mes);
            const e = chronOf(i);
            if (e) { e.undone = false; ensureFix(i); await ctx().saveChat(); saveMeta(); }
            closeSheet(); render(); decorate();
            break;
        }
        case 'chron-rerun': { const i = Number(el.dataset.mes); closeSheet(); queueChron(i, { force: true }); toast('info', 'Летописец перечитывает…'); break; }
        case 'chron-last': {
            const chat = chatArr();
            let i = chat.length - 1;
            while (i >= 0 && (chat[i].is_user || chat[i].is_system)) i--;
            if (i >= 0) { queueChron(i, { force: true }); toast('info', `Летописец читает #${i}…`); }
            break;
        }
    }
}

function chapterSheet(ch) {
    const list = chapters();
    const isLast = ch.idx === list.length - 1;
    const cover = chapterCover(ch);
    openSheet(`Глава ${pad2(ch.num)}`, `
        <div class="lf-sheet-cover"${cover ? ` style="background-image:url('${esc(cover)}')"` : ''}><div class="lf-sheet-cover-t"><b>${esc(ch.title)}</b><span>${esc([placeName(locTop(ch.loc)), whenLabel(ch.date, ch.time)].filter(Boolean).join(' — '))}</span></div></div>
        <div class="lf-chcard-prev big">${esc(ch.preview || '…')}</div>
        <div class="lf-hint">${ch.count} ${plural(ch.count, 'пост', 'поста', 'постов')} · сообщения #${ch.start}–${ch.end}${ch.locs.length > 1 ? ` · ${esc(ch.locs.map(l => locLeaf(l)).join(' → '))}` : ''}</div>
        <button class="lf-btn primary serif full big" data-act="read" data-start="${ch.start}">${isLast ? 'Вернуться в сцену' : 'Читать главу'}</button>
        <div class="lf-field"><label>Название главы${ch.autoTitle && !ch.userTitled ? ' <small>(придумал Летописец)</small>' : ''}</label><div class="lf-inline"><input type="text" data-in="chtitle" value="${esc(ch.title)}"><button class="lf-btn" data-act="ch-rename" data-start="${ch.start}">OK</button></div></div>
        <div class="lf-actions">
            <button class="lf-btn" data-act="frame" data-start="${ch.start}" data-loc="${esc(ch.loc)}">${icon('image')} Кадр</button>
            ${ch.marker >= 0 ? `<button class="lf-btn" data-act="ch-unmark" data-mes="${ch.marker}">${icon('scissors')} Убрать разделитель</button>` : ''}
        </div>`);
}

async function onChange(ev) {
    const el = ev.target;
    const s = settings();
    if (el.dataset.rng) { const out = el.closest('.lf-field')?.querySelector('[data-out]'); if (out) out.textContent = el.value; return; }
    if (el.dataset.set) {
        const path = el.dataset.set.split('.');
        const obj = path.length > 1 ? s[path[0]] : s;
        const k = path[path.length - 1];
        obj[k] = el.type === 'checkbox' ? el.checked : el.value;
        saveSettings();
        if (k === 'showFab' || k === 'enabled') syncFab();
        if (['enabled', 'chatMarks', 'chapterBy', 'aliases'].includes(k)) { invalidate(); decorate(); }
        if (k === 'enabled') updateMovePrompt();
        if (el.tagName !== 'TEXTAREA') render();
        return;
    }
    if (el.dataset.file && el.files?.[0]) {
        const file = el.files[0];
        const kind = el.dataset.file;
        await withBusy(el.closest('label'), async () => {
            const max = kind === 'map' || kind === 'plan' ? 2200 : kind === 'item' ? 900 : 1600;
            const path = await uploadImage(await fileToJpeg(file, max), `life_${kind}`);
            if (kind === 'map') { const r = (ui.region && regionById(ui.region)) || currentRegion(); r.map = path; delete r.needsMap; }
            else if (kind === 'plan') { const key = el.dataset.key || mapLevel()?.key; const p = s.places[key] || getPlace(key, true); p.plan = path; }
            else if (kind === 'place') getPlace(el.dataset.loc, true).img = path;
            else if (kind === 'item') setItemInfo(el.dataset.name, { img: path });
            else if (kind === 'pair') s.pairs[el.dataset.name] = path;
            else if (kind === 'frame') { const cm = chatMeta(); cm.frames = cm.frames || {}; cm.frames[el.dataset.start] = path; saveMeta(); }
            saveSettings();
            closeSheet(); render(); decorate();
            toast('success', 'Картинка сохранена', '✦ Life', { timeOut: 1500 });
        }, 'Загружаю…');
    }
}

function onInput(ev) {
    const el = ev.target;
    if (el.dataset.rng) { const out = el.closest('.lf-field')?.querySelector('[data-out]'); if (out) out.textContent = el.value; return; }
    if (el.dataset.set && el.tagName === 'TEXTAREA') {
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
    fab.innerHTML = CANDLE;
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
    const cc = btn.cloneNode(false);
    cc.id = 'lf-wand-cc';
    cc.innerHTML = '<div class="fa-solid fa-sliders extensionsMenuExtensionButton"></div><span>Пульт</span>';
    cc.addEventListener('click', () => openCC());
    menu.append(btn, cc);
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
          <div class="flex-container">
            <div id="lf_open_btn" class="menu_button"><i class="fa-solid fa-map-location-dot"></i> Открыть Life</div>
            <div id="lf_cc_btn" class="menu_button"><i class="fa-solid fa-sliders"></i> Пульт</div>
          </div>
          <label class="checkbox_label"><input id="lf_set_edge" type="checkbox" ${s.cc?.on !== false ? 'checked' : ''}> Язычок пульта на краю экрана</label>
          <label class="checkbox_label"><input id="lf_set_theme" type="checkbox" ${s.cc?.theme !== false ? 'checked' : ''}> Тема «Графит и вино» на всю Таверну</label>
          <small>Настройки — в хабе: Мир → ⚙ и в пульте. Команды <code>/life</code>, <code>/life cc</code>, аварийно <code>/life off</code>.</small>
        </div>
      </div>
    </div>`);
    document.getElementById('lf_set_enabled')?.addEventListener('change', function () { setEnabled(this.checked); });
    document.getElementById('lf_open_btn')?.addEventListener('click', () => openHub());
    document.getElementById('lf_cc_btn')?.addEventListener('click', () => openCC());
    document.getElementById('lf_set_edge')?.addEventListener('change', function () { settings().cc.on = this.checked; saveSettings(); applyTheme(); });
    document.getElementById('lf_set_theme')?.addEventListener('change', function () { settings().cc.theme = this.checked; saveSettings(); applyTheme(); });
}

function setEnabled(on) {
    const s = settings();
    s.enabled = !!on;
    saveSettings(); syncFab(); invalidate(); decorate(); updateMovePrompt(); applyTheme();
    const cb = document.getElementById('lf_set_enabled');
    if (cb) cb.checked = s.enabled;
}

function registerSlash() {
    try {
        const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'life',
            helpString: 'Life: без аргумента — открыть хаб; cc — пульт; map / person / world — вкладка; chron — Летописец по последнему посту; theme — тема вкл/выкл; on / off — включить или выключить.',
            unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'cc | map | person | world | chron | theme | on | off', typeList: [ARGUMENT_TYPE.STRING], isRequired: false })],
            callback: async (_a, value) => {
                const v = String(value || '').trim().toLowerCase();
                if (v === 'on' || v === 'off') { setEnabled(v === 'on'); toast('info', v === 'on' ? 'Life включён' : 'Life выключен — чат как обычно'); return ''; }
                if (v === 'cc' || v === 'пульт') { openCC(); return ''; }
                if (v === 'theme') { const c = settings().cc; c.theme = !c.theme; saveSettings(); applyTheme(); toast('info', c.theme ? 'Тема Life включена' : 'Тема Life выключена'); return ''; }
                if (v === 'chron') { const chat = chatArr(); let i = chat.length - 1; while (i >= 0 && (chat[i].is_user || chat[i].is_system)) i--; if (i >= 0) queueChron(i, { force: true }); return ''; }
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
    ui.focus = 'last';
    Object.assign(ui, { mapStack: [], who: '', chShow: 30, sel: '', region: '', atlas: false, item: '', pair: '', car: '', wset: '' });
    chronQueue.length = 0;
    invalidate();
    hookChat();
    decorateSoon(200);
    updateMovePrompt();
    if (ui.open) closeHub();
}

function lastAiIndex() {
    const chat = chatArr();
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i] && !chat[i].is_user && !chat[i].is_system) return i;
    return -1;
}

const controlApi = {
    settings, saveSettings, esc, toast, worldState, chapters, focusChapter, chapterCover,
    weekday, weatherWord, placeName, locTop, openHub, directorSheet, newChapterSheet, version: VERSION,
};

jQuery(async () => {
    settings();
    try { initControl(controlApi); } catch (e) { console.warn('[Life] пульт не поднялся', e); }
    renderSettingsDrawer();
    registerSlash();
    syncFab();
    if (!addWandButton()) { let t = 0; const iv = setInterval(() => { if (addWandButton() || ++t > 20) clearInterval(iv); }, 500); }
    if (!hookChat()) { let t = 0; const iv = setInterval(() => { if (hookChat() || ++t > 40) { clearInterval(iv); decorateSoon(); } }, 500); }
    ui.focus = 'last';
    const { eventSource, eventTypes: E } = ctx();
    eventSource.on(E.CHAT_CHANGED, onChatChanged);
    const later = () => { invalidate(); decorateSoon(450); setTimeout(() => { invalidate(); decorateSoon(); }, 1600); };
    for (const ev of [E.MESSAGE_SWIPED, E.MESSAGE_EDITED, E.MESSAGE_DELETED, E.MESSAGE_UPDATED, E.MORE_MESSAGES_LOADED, E.USER_MESSAGE_RENDERED]) if (ev) eventSource.on(ev, later);
    const onAi = (id, type) => {
        later();
        if (type === 'impersonate') return;
        const i = Number(id);
        if (Number.isFinite(i) && i === lastAiIndex()) setTimeout(() => queueChron(i), 700);
    };
    if (E.CHARACTER_MESSAGE_RENDERED) eventSource.on(E.CHARACTER_MESSAGE_RENDERED, onAi);
    else if (E.MESSAGE_RECEIVED) eventSource.on(E.MESSAGE_RECEIVED, onAi);
    if (E.MESSAGE_SENT) eventSource.on(E.MESSAGE_SENT, () => { ui.focus = 'last'; later(); });
    const endGen = () => {
        const cm = chatMeta();
        if (cm.director?.once && lastAiIndex() > (cm.director.after ?? -1)) { cm.director = null; saveMeta(); }
        updateMovePrompt();
    };
    for (const ev of [E.GENERATION_ENDED, E.GENERATION_STOPPED]) if (ev) eventSource.on(ev, endGen);
    if (E.APP_READY) eventSource.on(E.APP_READY, () => { addWandButton(); hookChat(); decorateSoon(); updateMovePrompt(); });
    decorateSoon(300);
    updateMovePrompt();
    console.log(`[Life] загружен ${VERSION}`);
});
