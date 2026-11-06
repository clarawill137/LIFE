// ✦ Фойе — своя главная SillyTavern вместо стоковой «Recent Chats».
//
// Стоковая панель ST остаётся в #chat, только спрятана: открыть / закрепить / переименовать /
// удалить чат делаем её же кнопками, чтобы не дублировать логику ST (попапы, пины, обновление).
// Данные: список из стоковой панели + тот же ответ /api/chats/recent (подслушиваем fetch, второго
// запроса нет) + «снимки» чатов — пока чат открыт, Фойе запоминает последний кадр, место и время
// из шапки GC / Horae и концовку последнего поста, чтобы на главной было по-человечески.

const MOD = 'foyer';
const VERSION = '0.1.0';
const ctx = () => SillyTavern.getContext();

const DEF = {
    enabled: true,
    hideInput: true,
    heroImage: 'scene', // scene — последний кадр из чата, avatar — аватарка
    showChars: true,
    listShown: 6,
    snaps: {},
    titles: {},
};

function cfg() {
    const es = ctx().extensionSettings;
    if (!es[MOD] || typeof es[MOD] !== 'object') es[MOD] = {};
    const s = es[MOD];
    for (const [k, v] of Object.entries(DEF)) {
        if (s[k] === undefined || (v && typeof v === 'object' && (!s[k] || typeof s[k] !== 'object'))) s[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
    }
    return s;
}
const save = () => { try { ctx().saveSettingsDebounced(); } catch { /* */ } };

// ───────────── мелочи ─────────────

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const bg = (u) => u ? ` style="${esc(`background-image:url("${String(u).replace(/["\\\r\n]/g, '')}")`)}"` : '';
const clip = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON_S = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const I = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    pin: '<path d="M12 16.5V22M8.5 3h7l-1 5.5 3 3.5v2h-11v-2l3-3.5z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    gear: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    place: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    chat: '<path d="M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 21l1.4-4.6A8.5 8.5 0 1 1 20.5 12z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.3"/>',
    edit: '<path d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0-3-3L5.2 17v3z"/><path d="m14.5 7.5 3 3"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9.5 7V4.5h5V7"/>',
    spark: '<path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z"/><path d="M18.5 15.5c.3 1.9.9 2.5 2.8 2.8-1.9.3-2.5.9-2.8 2.8-.3-1.9-.9-2.5-2.8-2.8 1.9-.3 2.5-.9 2.8-2.8z"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.6c1.8.6 3 2.3 3.5 4.9"/>',
    list: '<path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4" cy="6.5" r=".9" fill="currentColor"/><circle cx="4" cy="12" r=".9" fill="currentColor"/><circle cx="4" cy="17.5" r=".9" fill="currentColor"/>',
    star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
};
const icon = (n, cls = '') => `<svg class="fy-i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

// ───────────── текст поста без мусора ─────────────
// GC: <think>, шапка data-gc="top", «В сцене», <art>, <hud>, <diary>, <matrix|preg|compass>, ЗАМЕТКИ в <details>,
// картинки SLAY, телефонные комментарии, JSON/CSS в код-блоках, старые плашки со стилями.

const KEEP = new Set(['p', 'br', 'span', 'em', 'i', 'b', 'strong', 'u', 's', 'del', 'ins', 'q', 'blockquote', 'div', 'font', 'small', 'big', 'sup', 'sub', 'a', 'mark', 'center', 'cite', 'abbr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'hr', 'section', 'article']);
const DROP = 'style,script,template,noscript,details,summary,pre,code,table,img,picture,svg,video,audio,iframe,object,embed,canvas,button,input,select,textarea,label,[data-gc],[hidden],[aria-hidden="true"]';
const BLOCKS = 'p,div,li,ul,ol,blockquote,h1,h2,h3,h4,h5,h6,hr,section,article,center';

function parse(html) { return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html'); }

function proseLines(mes, strict = true) {
    let s = String(mes || '');
    if (!s.trim()) return [];
    s = s.replace(/```[\s\S]*?(```|$)/g, '\n')
        .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
        .replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?(<\/\1>|$)/gi, ' ')
        .replace(/@import[^;\n]*;?/gi, ' ');
    const b = parse(s).body;
    b.querySelectorAll(DROP).forEach(e => e.remove());
    for (const e of [...b.querySelectorAll('*')]) {
        if (!e.isConnected) continue;
        if (!KEEP.has(e.tagName.toLowerCase())) { e.remove(); continue; }
        const st = e.getAttribute('style') || '';
        if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(st)) { e.remove(); continue; }
        // плашки и карточки — блоки с фоном или рамкой; сама проза в них не живёт
        if (strict && /^(div|section|article|center|span)$/i.test(e.tagName) && /background|border|box-shadow/i.test(st)) e.remove();
    }
    b.querySelectorAll('br').forEach(e => e.replaceWith('\n'));
    b.querySelectorAll(BLOCKS).forEach(e => { e.before('\n'); e.after('\n'); });
    const txt = (b.textContent || '')
        .replace(/\r/g, '')
        .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
        .replace(/^[ \t]*>[ \t]?/gm, '')
        .replace(/[*`~]+/g, '')
        .replace(/(^|[\s(«"'])_+/g, '$1')
        .replace(/_+(?=[\s).,!?;:…»"']|$)/g, '');
    const lines = txt.split(/\n+/).map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(okLine);
    if (strict && lines.join(' ').length < 40) {
        const loose = proseLines(mes, false);
        if (loose.join(' ').length > lines.join(' ').length) return loose;
    }
    return lines;
}

function okLine(l) {
    if (!l || l.length < 2) return false;
    const letters = (l.match(/\p{L}/gu) || []).length;
    if (letters < 2 || letters / l.length < 0.55) return false;
    if (/^[[{].*[\]}],?$/.test(l)) return false;
    if (/^"?[\w-]+"?\s*:\s*\S+[;,]?$/.test(l) && !/\s\p{L}+\s/u.test(l)) return false; // css: значение / "ключ": значение
    if (/[{};]\s*$/.test(l) && !/[.!?…»]/.test(l)) return false;
    if (/^(https?:)?\/\//i.test(l)) return false;
    if (/^\[?(IMG:GEN|OOC)/i.test(l)) return false;
    return true;
}

/** Концовка поста — «на чём остановились»: последние абзацы, обрезка с начала по границе фразы. */
function tailText(lines, max = 420, maxLines = 99) {
    const out = [];
    let n = 0;
    for (let i = lines.length - 1; i >= 0 && n < max && out.length < maxLines; i--) { out.unshift(lines[i]); n += lines[i].length + 1; }
    let s = out.join('\n');
    if (s.length > max) {
        s = s.slice(s.length - max);
        const head = s.slice(0, Math.floor(max * .55));
        const m = head.match(/^[\s\S]*?(?:[.!?…»]\s+|\n)(?=[—–\-«"]?\s*\p{Lu})/u);
        if (m && m[0].length < head.length) s = s.slice(m[0].length);
        else { const sp = s.search(/\s/); s = '…' + (sp >= 0 && sp < 40 ? s.slice(sp + 1) : s); }
    }
    return s.trim();
}
const tailOf = (text, max, maxLines) => tailText(String(text || '').split('\n').filter(Boolean), max, maxLines);

/** Шапка GC: <div data-gc="top"> время · место · «Пт, 20.11.2024 · ❄ −2°C, снег». */
function gcTop(mes) {
    const s = String(mes || '');
    if (!/data-gc\s*=\s*["']?top/i.test(s)) return null;
    const i = s.search(/<div[^>]*data-gc\s*=\s*["']?top/i);
    const el = parse(s.slice(i, i + 2500)).querySelector('[data-gc="top"]');
    if (!el) return null;
    const kids = [...el.children].filter(e => e.tagName === 'SPAN');
    const time = (kids[0]?.textContent || '').trim();
    const place = (el.querySelector('b')?.textContent || '').trim();
    const sub = (kids[1]?.querySelector('span')?.textContent || '').trim();
    if (!place && !sub) return null;
    return { time: /\d{1,2}[:.]\d{2}/.test(time) ? clip(time, 8) : '', place: clip(place, 70), sub: clip(sub, 90) };
}

// ───────────── картинки ─────────────

const IMG_TAG = /<img\b[^>]*>/gi;
const unent = (s) => String(s || '').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function attr(tag, name) {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return m ? unent(m[1] ?? m[2] ?? '') : '';
}
// data: не храним — может весить мегабайты
const okSrc = (src) => !!src && typeof src === 'string' && !/IMG:GEN|^about:|^javascript:|^data:|^blob:/i.test(src.trim());

function msgImg(m) {
    if (!m) return '';
    const ex = m.extra || {};
    const media = Array.isArray(ex.media) ? ex.media : [];
    for (let i = media.length - 1; i >= 0; i--) {
        const md = media[i];
        if (md && (md.type === 'image' || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(md.url || '')) && okSrc(md.url)) return md.url;
    }
    if (okSrc(ex.image)) return ex.image;
    const tags = String(m.mes || '').match(IMG_TAG) || [];
    for (let i = tags.length - 1; i >= 0; i--) { const src = attr(tags[i], 'src'); if (okSrc(src)) return src; }
    return '';
}

// ───────────── снимки чатов ─────────────

function curKey() {
    const c = ctx();
    if (c.groupId) return c.chatId ? `g:${c.groupId}|${c.chatId}` : null;
    const ch = c.characterId !== undefined && c.characterId !== null ? c.characters?.[c.characterId] : null;
    return ch?.avatar && c.chatId ? `c:${ch.avatar}|${c.chatId}` : null;
}

function horae() {
    try {
        if (!window.Horae?.isEnabled?.()) return null;
        const st = window.Horae.getLatestState?.();
        if (!st) return null;
        const o = { date: clip(st.timestamp?.story_date, 40), time: clip(st.timestamp?.story_time, 20), place: clip(st.scene?.location, 70), air: clip(String(st.scene?.atmosphere || '').split(/[,;.]/)[0], 40) };
        return o.date || o.time || o.place ? o : null;
    } catch { return null; }
}

function takeSnap() {
    if (!cfg().enabled) return;
    const key = curKey();
    if (!key) return;
    const chat = ctx().chat || [];
    if (!chat.length) return;
    let last = null, top = null, img = '';
    for (let i = chat.length - 1, n = 0; i >= 0 && n < 80; i--, n++) {
        const m = chat[i];
        if (!m) continue;
        if (!img) img = msgImg(m);
        if (m.is_system || m.extra?.type === 'comment') continue;
        if (!top) top = gcTop(m.mes);
        if (!last) {
            const t = tailText(proseLines(m.mes), 520);
            if (t.length >= 40) last = { name: clip(m.name, 40), user: !!m.is_user, text: t };
        }
        if (last && top && img) break;
    }
    const prev = cfg().snaps[key];
    const s = { n: chat.length, name: last?.name || '', user: !!last?.user, text: last?.text || '', img: img || prev?.img || '', top: top || null, h: horae() };
    if (prev && JSON.stringify({ ...prev, t: 0 }) === JSON.stringify({ ...s, t: 0 })) return;
    s.t = Date.now();
    const snaps = cfg().snaps;
    snaps[key] = s;
    const keys = Object.keys(snaps);
    if (keys.length > 40) keys.sort((a, b) => (snaps[b]?.t || 0) - (snaps[a]?.t || 0)).slice(40).forEach(k => delete snaps[k]);
    save();
}

let snapT = 0;
function snapSoon(ms = 2200) { clearTimeout(snapT); snapT = setTimeout(() => { try { takeSnap(); } catch (e) { console.warn('[Фойе] снимок', e); } }, ms); }

// ───────────── подслушанный /api/chats/recent ─────────────

let recent = null;
function tapFetch() {
    if (window.__foyerTap) return;
    window.__foyerTap = true;
    const orig = window.fetch;
    window.fetch = function (input) {
        const p = orig.apply(window, arguments);
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (url.includes('/api/chats/recent')) {
                p.then(r => (r && r.ok ? r.clone().json() : null)).then(d => { if (Array.isArray(d)) { recent = d; renderSoon(); } }).catch(() => { /* */ });
            }
        } catch { /* */ }
        return p;
    };
}

// ───────────── данные для экрана ─────────────

const isImg = (u) => typeof u === 'string' && u.length > 4 && u !== 'undefined' && u !== 'null';
const thumb = (avatar) => { try { return ctx().getThumbnailUrl('avatar', avatar); } catch { return `/thumbnail?type=avatar&file=${encodeURIComponent(avatar)}`; } };
const full = (avatar) => `/characters/${encodeURIComponent(avatar)}`;
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const cleanGroupName = (n) => String(n || '').replace(/^\s*(group|группа)\s*:\s*/i, '').trim();

function prettyFile(file, owner) {
    let s = String(file || '');
    if (owner && s.toLowerCase().startsWith(owner.toLowerCase() + ' - ')) s = s.slice(owner.length + 3);
    else s = s.replace(/^[^\n]{1,60}?\s+-\s+(?=\d{4}-\d{1,2}-\d{1,2}\s*@)/, '');
    s = s.replace(/(\d{4})-(\d{1,2})-(\d{1,2})\s*@\s*(\d{1,2})h\s*(\d{1,2})m(?:\s*\d{1,2}s)?(?:\s*\d+ms)?/g,
        (_, y, mo, d, h, mi) => `${+d} ${MON[+mo - 1] || mo} ${y}, ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
    return s.replace(/\s+-\s+(?=branch)/gi, ' · ').replace(/branch\s*#?\s*(\d+)/gi, 'ветка $1').replace(/_+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim();
}

function tsOf(v) {
    if (v === undefined || v === null || v === '') return 0;
    try { const m = ctx().timestampToMoment?.(v); if (m?.isValid?.()) return m.valueOf(); } catch { /* */ }
    const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? +v : v);
    return isNaN(d) ? 0 : d.getTime();
}

function hm(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function ago(ms, short = false) {
    if (!ms) return '';
    const d = new Date(ms), now = new Date();
    const sec = (now - d) / 1000;
    if (sec < 90) return 'только что';
    if (sec < 3600) return `${Math.round(sec / 60)} мин назад`;
    if (sameDay(d, now)) return short ? hm(d) : `сегодня, ${hm(d)}`;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (sameDay(d, y)) return short ? 'вчера' : `вчера, ${hm(d)}`;
    if (sec < 6 * 86400) { const wd = d.toLocaleDateString('ru-RU', { weekday: short ? 'short' : 'long' }); return short ? wd : `${wd}, ${hm(d)}`; }
    const yr = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
    return short ? `${d.getDate()} ${MON_S[d.getMonth()]}${yr}` : `${d.getDate()} ${MON[d.getMonth()]}${yr}`;
}
const sizeRu = (s) => String(s || '').replace(/(\d)\.(\d)/, '$1,$2').replace(/\s*([KMG])B\b/i, (_, u) => ` ${{ K: 'КБ', M: 'МБ', G: 'ГБ' }[u.toUpperCase()]}`);

function stockItems(panel) {
    return [...panel.querySelectorAll('.recentChat')].map(el => ({
        el,
        file: el.getAttribute('data-file') || '',
        avatar: el.getAttribute('data-avatar') || '',
        group: el.getAttribute('data-group') || '',
        name: (el.querySelector('.characterName')?.textContent || '').trim(),
        pinned: !!el.querySelector('.recentChatPinned'),
        dateText: (el.querySelector('.chatDate')?.textContent || '').trim(),
        count: parseInt(el.querySelector('.counterBlock small')?.textContent || '0', 10) || 0,
        size: (el.querySelector('.fileSize')?.textContent || '').trim(),
        mes: el.querySelector('.chatMessage')?.textContent || '',
    })).filter(x => x.file);
}

function enrich(it) {
    const c = ctx(), s = cfg();
    const d = (recent || []).find(x => String(x?.file_name || '').replace(/\.jsonl$/i, '') === it.file && (it.group ? x.group === it.group : x.avatar === it.avatar));
    if (d) {
        if (typeof d.mes === 'string') it.mes = d.mes;
        if (Number.isFinite(+d.chat_items)) it.count = +d.chat_items;
        if (d.file_size) it.size = d.file_size;
        it.ts = tsOf(d.last_mes);
    }
    it.key = it.group ? `g:${it.group}|${it.file}` : `c:${it.avatar}|${it.file}`;
    it.snap = s.snaps[it.key] || null;
    if (it.group) {
        it.g = (c.groups || []).find(x => x.id === it.group) || null;
        it.name = it.g?.name || it.name;
        it.members = (it.g?.members || []).filter(a => !(it.g.disabled_members || []).includes(a)).map(a => (c.characters || []).find(x => x.avatar === a)).filter(Boolean);
    } else {
        it.ch = (c.characters || []).find(x => x.avatar === it.avatar) || null;
        it.name = it.ch?.name || it.name;
        it.members = it.ch ? [it.ch] : [];
    }
    it.title = s.titles[it.key] || cleanGroupName(it.name) || it.file;
    it.sub = prettyFile(it.file, it.name);
    if (it.sub && it.sub === it.title) it.sub = '';

    // текст: свежий последний пост, а если там мусор/телефон/устаревший снимок — снимок
    const fresh = tailText(proseLines(it.mes), 520);
    const snap = it.snap;
    const snapFresh = snap && (snap.n === it.count || !it.count);
    if (snap?.text && (snapFresh || fresh.length < 60)) { it.text = snap.text; it.speaker = snap.name; }
    else { it.text = fresh; it.speaker = snapFresh ? snap?.name : ''; }

    const top = gcTop(it.mes) || snap?.top;
    if (top) {
        const [date, ...wx] = String(top.sub || '').split(/\s*·\s*/);
        it.story = { place: top.place, when: [date, top.time, wx.join(' · ')].filter(Boolean).join(' · ') };
    } else if (snap?.h) {
        it.story = { place: snap.h.place, when: [snap.h.date, snap.h.time, snap.h.air].filter(Boolean).join(' · ') };
    }
    it.scene = msgImg({ mes: it.mes }) || snap?.img || '';
    return it;
}

function avaThumbHtml(it) {
    if (it.group) {
        if (isImg(it.g?.avatar_url)) return `<span class="fy-ava"><img src="${esc(it.g.avatar_url)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
        const ms = it.members.slice(0, 4);
        if (!ms.length) return `<span class="fy-ava fy-ava-ph">${icon('users')}</span>`;
        return `<span class="fy-ava fy-col fy-col-${ms.length}">${ms.map(m => `<img src="${esc(thumb(m.avatar))}" alt="" loading="lazy">`).join('')}</span>`;
    }
    return it.avatar ? `<span class="fy-ava"><img src="${esc(thumb(it.avatar))}" alt="" loading="lazy" onerror="this.remove()"></span>` : `<span class="fy-ava fy-ava-ph">${icon('chat')}</span>`;
}

function heroImg(it) {
    if (cfg().heroImage === 'scene' && it.scene) return it.scene;
    if (it.group) {
        if (isImg(it.g?.avatar_url)) return it.g.avatar_url;
        return it.members[0] ? full(it.members[0].avatar) : '';
    }
    return it.avatar ? full(it.avatar) : '';
}

function charShelf() {
    const c = ctx();
    const fav = (ch) => (ch.fav === true || ch.fav === 'true' ? 1 : 0);
    return (c.characters || []).map((ch, i) => ({ ch, i }))
        .filter(x => x.ch?.avatar && x.ch.avatar !== 'none' && !/^default_Assistant\.png$/i.test(x.ch.avatar))
        .sort((a, b) => (fav(b.ch) - fav(a.ch)) || ((+b.ch.date_last_chat || 0) - (+a.ch.date_last_chat || 0)))
        .slice(0, 18);
}

// ───────────── экран ─────────────

const ui = { busy: '', q: '', search: false, more: false, sheet: null };
let items = [];
let mountedPanel = null;

function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : h < 23 ? 'Добрый вечер' : 'Доброй ночи';
}
function todayLine() {
    const d = new Date();
    return `${d.toLocaleDateString('ru-RU', { weekday: 'long' })}, ${d.getDate()} ${MON[d.getMonth()]} · ${hm(d)}`;
}

function heroHtml(it) {
    const cast = it.members.slice(0, 5);
    const names = it.group ? cast.map(m => firstName(m.name)).filter(Boolean).join(' · ') : '';
    const count = it.count ? `${it.count} ${plural(it.count, 'сообщение', 'сообщения', 'сообщений')}` : '';
    const foot = [ago(it.ts) || it.dateText, sizeRu(it.size)].filter(Boolean).join(' · ');
    const quote = it.text ? tailOf(it.text, 420, 4) : '';
    return `
    <section class="fy-hero${ui.busy === it.key ? ' fy-busy' : ''}" data-fy="open" data-k="${esc(it.key)}">
        <div class="fy-hero-bg"${bg(heroImg(it))}></div>
        <div class="fy-hero-shade"></div>
        <div class="fy-hero-top">
            <span class="fy-chip">${icon('play')}<span>${ui.busy === it.key ? 'Открываю…' : 'Продолжить'}</span>${it.pinned ? icon('pin', 'fy-chip-pin') : ''}</span>
            <button class="fy-ibtn" data-fy="more" data-k="${esc(it.key)}" aria-label="Ещё">${icon('more')}</button>
        </div>
        <div class="fy-hero-body">
            ${cast.length ? `<div class="fy-cast">${cast.map(m => `<img src="${esc(thumb(m.avatar))}" alt="" loading="lazy" onerror="this.remove()">`).join('')}${names ? `<span>${esc(names)}</span>` : ''}</div>` : ''}
            <h2 class="fy-hero-t">${esc(it.title)}</h2>
            <div class="fy-hero-sub">${[it.sub, count].filter(Boolean).map(esc).join(' · ')}</div>
            ${it.story ? `<div class="fy-story">${it.story.place ? `<span class="fy-story-p">${icon('place')}${esc(it.story.place)}</span>` : ''}${it.story.when ? `<span class="fy-story-w">${icon('clock')}${esc(it.story.when)}</span>` : ''}</div>` : ''}
            ${quote ? `<blockquote class="fy-quote">${it.speaker ? `<b>${esc(it.speaker)}</b>` : ''}<div class="fy-quote-t${quote.length > 190 ? ' fy-fade' : ''}"><p>${esc(quote)}</p></div></blockquote>` : ''}
            <div class="fy-hero-foot"><span>${esc(foot)}</span><span class="fy-go">${icon('arrow')}</span></div>
        </div>
    </section>`;
}

function itemHtml(it, n) {
    const flat = tailOf(it.text, 90).replace(/\s*\n\s*/g, ' ');
    const sub = [it.sub, it.count ? `${it.count} ${plural(it.count, 'сообщ.', 'сообщ.', 'сообщ.')}` : ''].filter(Boolean).join(' · ');
    return `
    <article class="fy-item${ui.busy === it.key ? ' fy-busy' : ''}" data-fy="open" data-k="${esc(it.key)}" style="--fy-n:${n}">
        ${avaThumbHtml(it)}
        <span class="fy-item-c">
            <span class="fy-item-h"><b>${esc(it.title)}</b>${it.pinned ? icon('pin', 'fy-pin') : ''}</span>
            ${sub ? `<span class="fy-item-s">${esc(sub)}</span>` : ''}
            ${flat ? `<span class="fy-item-x">${it.speaker ? `<i>${esc(firstName(it.speaker))}:</i> ` : ''}${esc(flat)}</span>` : ''}
        </span>
        <span class="fy-item-r">
            <small>${esc(ui.busy === it.key ? '…' : (ago(it.ts, true) || it.dateText))}</small>
            <button class="fy-ibtn sm" data-fy="more" data-k="${esc(it.key)}" aria-label="Ещё">${icon('more')}</button>
        </span>
    </article>`;
}

function listHtml() {
    const rest = items.slice(1);
    const q = ui.q.trim().toLowerCase();
    const found = q ? items.filter(it => [it.title, it.name, it.sub, it.text].join(' ').toLowerCase().includes(q)) : rest;
    const lim = Math.max(1, +cfg().listShown || 6);
    const shown = q || ui.more ? found : found.slice(0, lim);
    if (!found.length) return `<div class="fy-empty">${q ? 'Ничего не нашлось' : 'Других чатов пока нет'}</div>`;
    return shown.map((it, i) => itemHtml(it, i)).join('')
        + (!q && found.length > lim ? `<button class="fy-more${ui.more ? ' on' : ''}" data-fy="toggle-more">${ui.more ? 'Свернуть' : `Ещё ${found.length - lim}`}${icon('down')}</button>` : '');
}

function shelfHtml() {
    if (!cfg().showChars) return '';
    const list = charShelf();
    if (!list.length) return '';
    const fav = (ch) => ch.fav === true || ch.fav === 'true';
    return `
    <div class="fy-sec"><h3>Персонажи</h3><button class="fy-link" data-fy="all-chars">все ${icon('arrow')}</button></div>
    <div class="fy-shelf">
        ${list.map(({ ch, i }) => `<button class="fy-person" data-fy="char" data-i="${i}">
            <span class="fy-person-a"><img src="${esc(thumb(ch.avatar))}" alt="" loading="lazy" onerror="this.remove()"><i>${esc(firstName(ch.name).slice(0, 1))}</i>${fav(ch) ? `<em>${icon('star')}</em>` : ''}</span>
            <span class="fy-person-n">${esc(firstName(ch.name))}</span>
        </button>`).join('')}
    </div>`;
}

function render() {
    const root = document.getElementById('fy-root');
    const panel = mountedPanel;
    if (!root || !panel) return;
    items = stockItems(panel).map(enrich);
    const hero = items[0];
    const ver = (panel.querySelector('.welcomeHeaderVersionDisplay')?.textContent || '').trim();
    root.innerHTML = `
    <header class="fy-head">
        <div class="fy-head-l">
            <small>${esc(todayLine())}</small>
            <h1>${esc(greeting())}<span>.</span></h1>
        </div>
        <div class="fy-head-r">
            <button class="fy-ibtn${ui.search ? ' on' : ''}" data-fy="search" aria-label="Поиск">${icon('search')}</button>
            <button class="fy-ibtn" data-fy="settings" aria-label="Настройки">${icon('gear')}</button>
        </div>
    </header>
    ${hero ? heroHtml(hero) : `<section class="fy-hero fy-hero-empty"><div class="fy-hero-body"><h2 class="fy-hero-t">Здесь пока тихо</h2><div class="fy-hero-sub">Выбери персонажа ниже или начни временный чат</div></div></section>`}
    ${ui.search ? `<label class="fy-search">${icon('search')}<input type="search" placeholder="Искать по чатам" value="${esc(ui.q)}" data-fy-q autocomplete="off"><button class="fy-ibtn sm" data-fy="search-x" aria-label="Закрыть">${icon('x')}</button></label>` : ''}
    ${items.length > 1 || ui.q ? `<div class="fy-sec"><h3>${ui.q ? 'Найдено' : 'Недавние'}</h3><small>${items.length}</small></div>` : ''}
    <div class="fy-list">${items.length > 1 || ui.q ? listHtml() : ''}</div>
    ${shelfHtml()}
    <div class="fy-actions">
        <button class="fy-pill" data-fy="temp">${icon('spark')}Временный чат</button>
        <button class="fy-pill" data-fy="all-chars">${icon('users')}Персонажи</button>
        <button class="fy-pill" data-fy="stock-settings">${icon('list')}Сколько чатов</button>
    </div>
    <footer class="fy-foot">${esc(ver || 'SillyTavern')} · Фойе ${VERSION}</footer>`;
    if (ui.search) {
        const inp = root.querySelector('[data-fy-q]');
        if (inp && document.activeElement !== inp && ui.focusSearch) { inp.focus(); ui.focusSearch = false; }
    }
}

let rT = 0;
function renderSoon(ms = 40) { clearTimeout(rT); rT = setTimeout(() => { try { render(); } catch (e) { console.warn('[Фойе] отрисовка', e); } }, ms); }

// ───────────── нижние шторки ─────────────

function sheetEl() {
    let el = document.getElementById('fy-sheet');
    if (!el) {
        el = document.createElement('div');
        el.id = 'fy-sheet';
        el.addEventListener('click', onSheetClick);
        document.body.append(el);
    }
    return el;
}
function closeSheet() {
    const el = document.getElementById('fy-sheet');
    if (!el) return;
    el.classList.remove('on');
    ui.sheet = null;
    setTimeout(() => { if (!ui.sheet) el.innerHTML = ''; }, 260);
}
function openSheet(html) {
    const el = sheetEl();
    el.innerHTML = `<div class="fy-sheet-bd" data-fs="close"></div><div class="fy-sheet">${html}</div>`;
    requestAnimationFrame(() => el.classList.add('on'));
}

function moreSheet(it) {
    ui.sheet = { kind: 'more', key: it.key };
    openSheet(`
        <div class="fy-sheet-h">${avaThumbHtml(it)}<span><b>${esc(it.title)}</b><small>${esc(it.sub || it.name)}</small></span></div>
        <button class="fy-row" data-fs="open">${icon('play')}Открыть</button>
        <button class="fy-row" data-fs="pin">${icon('pin')}${it.pinned ? 'Открепить' : 'Закрепить сверху'}</button>
        <button class="fy-row" data-fs="title">${icon('tag')}Своё название в Фойе${cfg().titles[it.key] ? `<small>${esc(cfg().titles[it.key])}</small>` : ''}</button>
        <button class="fy-row" data-fs="rename">${icon('edit')}Переименовать файл чата</button>
        <button class="fy-row fy-danger" data-fs="delete">${icon('trash')}Удалить чат</button>
        <button class="fy-row fy-cancel" data-fs="close">Отмена</button>`);
}

function settingsSheet() {
    const s = cfg();
    ui.sheet = { kind: 'settings' };
    const tog = (k, label, hint = '') => `<button class="fy-row fy-tog${s[k] ? ' on' : ''}" data-fs="tog" data-key="${k}"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><i class="fy-switch"></i></button>`;
    openSheet(`
        <div class="fy-sheet-h"><span><b>Фойе</b><small>главная вместо стоковой</small></span></div>
        <div class="fy-seg"><span>Фон карточки</span>
            <button class="${s.heroImage === 'scene' ? 'on' : ''}" data-fs="hero" data-v="scene">кадр из чата</button>
            <button class="${s.heroImage !== 'scene' ? 'on' : ''}" data-fs="hero" data-v="avatar">аватарка</button>
        </div>
        <div class="fy-seg"><span>Недавних сразу</span>
            <button data-fs="lim" data-d="-1">−</button><b>${+s.listShown || 6}</b><button data-fs="lim" data-d="1">+</button>
        </div>
        ${tog('hideInput', 'Прятать поле ввода', 'на главной оно всё равно открывает чат с ассистентом')}
        ${tog('showChars', 'Полка персонажей')}
        <button class="fy-row" data-fs="stock-settings">${icon('list')}Сколько чатов грузить (настройка ST)</button>
        ${Object.keys(s.titles || {}).length ? `<button class="fy-row" data-fs="untitle">${icon('tag')}Забыть свои названия<small>${Object.keys(s.titles).length}</small></button>` : ''}
        <button class="fy-row fy-cancel" data-fs="close">Готово</button>`);
}

// ───────────── действия ─────────────

const byKey = (k) => items.find(x => x.key === k);
function stockBtn(it, sel) { return it?.el?.querySelector(sel) || null; }

function openChat(it) {
    if (!it?.el || ui.busy) return;
    ui.busy = it.key;
    render();
    setTimeout(() => { if (ui.busy === it.key) { ui.busy = ''; renderSoon(); } }, 15000);
    it.el.click();
}

async function setTitle(it) {
    const c = ctx();
    const cur = cfg().titles[it.key] || '';
    let v;
    try { v = await c.callGenericPopup('Название чата в Фойе (пусто — как было)', c.POPUP_TYPE.INPUT, cur || it.title); } catch { v = window.prompt('Название чата в Фойе', cur || it.title); }
    if (v === null || v === undefined || v === false) return;
    v = String(v).trim();
    if (!v || v === cleanGroupName(it.name)) delete cfg().titles[it.key];
    else cfg().titles[it.key] = clip(v, 80);
    save();
    renderSoon();
}

function onSheetClick(e) {
    const b = e.target.closest('[data-fs]');
    if (!b) return;
    const act = b.getAttribute('data-fs');
    const s = cfg();
    const it = ui.sheet?.key ? byKey(ui.sheet.key) : null;
    switch (act) {
        case 'close': closeSheet(); break;
        case 'open': closeSheet(); openChat(it); break;
        case 'pin': closeSheet(); stockBtn(it, '.pinChat')?.click(); break;
        case 'rename': closeSheet(); stockBtn(it, '.renameChat')?.click(); break;
        case 'delete': closeSheet(); stockBtn(it, '.deleteChat')?.click(); break;
        case 'title': closeSheet(); if (it) setTitle(it); break;
        case 'tog': s[b.getAttribute('data-key')] = !s[b.getAttribute('data-key')]; save(); sync(); settingsSheet(); renderSoon(); break;
        case 'hero': s.heroImage = b.getAttribute('data-v') === 'avatar' ? 'avatar' : 'scene'; save(); settingsSheet(); renderSoon(); break;
        case 'lim': s.listShown = Math.min(30, Math.max(2, (+s.listShown || 6) + (+b.getAttribute('data-d') || 0))); save(); settingsSheet(); renderSoon(); break;
        case 'untitle': s.titles = {}; save(); settingsSheet(); renderSoon(); break;
        case 'stock-settings': closeSheet(); mountedPanel?.querySelector('.recentChatsSettings')?.click(); break;
    }
}

function onClick(e) {
    const b = e.target.closest('[data-fy]');
    if (!b || !e.currentTarget.contains(b)) return;
    const act = b.getAttribute('data-fy');
    if (act !== 'open') e.stopPropagation();
    const it = byKey(b.getAttribute('data-k'));
    switch (act) {
        case 'open': openChat(it); break;
        case 'more': if (it) moreSheet(it); break;
        case 'search': ui.search = !ui.search; if (!ui.search) ui.q = ''; ui.focusSearch = ui.search; render(); break;
        case 'search-x': ui.search = false; ui.q = ''; render(); break;
        case 'toggle-more': ui.more = !ui.more; render(); break;
        case 'settings': settingsSheet(); break;
        case 'temp': mountedPanel?.querySelector('.openTemporaryChat')?.click(); break;
        case 'stock-settings': mountedPanel?.querySelector('.recentChatsSettings')?.click(); break;
        case 'all-chars': document.getElementById('rightNavDrawerIcon')?.click(); break;
        case 'char': {
            const i = b.getAttribute('data-i');
            b.classList.add('fy-busy');
            Promise.resolve(ctx().selectCharacterById(Number(i))).catch(err => { console.warn('[Фойе] персонаж', err); b.classList.remove('fy-busy'); });
            break;
        }
    }
}

function onInput(e) {
    if (!e.target.matches?.('[data-fy-q]')) return;
    ui.q = e.target.value || '';
    const list = document.querySelector('#fy-root .fy-list');
    if (list) list.innerHTML = listHtml();
    const h = document.querySelector('#fy-root .fy-sec h3');
    if (h) h.textContent = ui.q ? 'Найдено' : 'Недавние';
}

// ───────────── встраивание ─────────────

function unmount() {
    document.body.classList.remove('fy-on', 'fy-noinput');
    document.getElementById('fy-root')?.remove();
    closeSheet();
    mountedPanel = null;
    ui.busy = '';
}

function sync() {
    const chatEl = document.getElementById('chat');
    const panel = chatEl?.querySelector(':scope > .welcomePanel') || null;
    if (!panel || !cfg().enabled) { if (mountedPanel || document.body.classList.contains('fy-on')) unmount(); return; }
    document.body.classList.add('fy-on');
    document.body.classList.toggle('fy-noinput', !!cfg().hideInput);
    let root = chatEl.querySelector(':scope > #fy-root');
    if (root && mountedPanel === panel) return;
    root?.remove();
    root = document.createElement('div');
    root.id = 'fy-root';
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    chatEl.prepend(root);
    const fresh = mountedPanel === null;
    mountedPanel = panel;
    ui.busy = '';
    render();
    if (fresh) chatEl.scrollTop = 0;
}

function watch() {
    const chatEl = document.getElementById('chat');
    if (!chatEl) return false;
    new MutationObserver(() => sync()).observe(chatEl, { childList: true });
    sync();
    return true;
}

// ───────────── настройки в панели расширений ─────────────

function drawer() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('fy-drawer')) return;
    const s = cfg();
    const box = document.createElement('div');
    box.id = 'fy-drawer';
    box.className = 'inline-drawer';
    box.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header"><b>✦ Фойе</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div>
        <div class="inline-drawer-content">
            <label class="checkbox_label"><input type="checkbox" data-fyset="enabled"${s.enabled ? ' checked' : ''}><span>Своя главная вместо стоковой</span></label>
            <label class="checkbox_label"><input type="checkbox" data-fyset="hideInput"${s.hideInput ? ' checked' : ''}><span>Прятать поле ввода на главной</span></label>
            <label class="checkbox_label"><input type="checkbox" data-fyset="showChars"${s.showChars ? ' checked' : ''}><span>Полка персонажей</span></label>
            <label class="fy-dr-row"><span>Фон «Продолжить»</span><select class="text_pole" data-fyset="heroImage"><option value="scene"${s.heroImage === 'scene' ? ' selected' : ''}>кадр из чата</option><option value="avatar"${s.heroImage !== 'scene' ? ' selected' : ''}>аватарка</option></select></label>
            <small>Остальное — шестерёнка на самой главной. ${VERSION}</small>
        </div>`;
    box.addEventListener('change', (e) => {
        const k = e.target.getAttribute?.('data-fyset');
        if (!k) return;
        cfg()[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        save();
        sync();
        renderSoon();
    });
    host.append(box);
}

// ───────────── старт ─────────────

tapFetch();

jQuery(() => {
    cfg();
    drawer();
    if (!watch()) { let t = 0; const iv = setInterval(() => { if (watch() || ++t > 40) clearInterval(iv); }, 500); }
    const { eventSource, eventTypes: E } = ctx();
    const on = (ev, fn) => { if (ev) eventSource.on(ev, fn); };
    on(E.CHAT_CHANGED, () => { snapSoon(2600); setTimeout(sync, 0); });
    for (const ev of [E.CHARACTER_MESSAGE_RENDERED, E.USER_MESSAGE_RENDERED, E.MESSAGE_SWIPED, E.MESSAGE_EDITED, E.MESSAGE_DELETED, E.MESSAGE_UPDATED]) on(ev, () => snapSoon());
    // часы в шапке главной
    setInterval(() => { if (document.body.classList.contains('fy-on') && !ui.sheet) { const s = document.querySelector('#fy-root .fy-head small'); if (s) s.textContent = todayLine(); } }, 30000);
    globalThis.Foyer = { version: VERSION, snap: takeSnap, render: renderSoon };
    console.log(`[Фойе] ${VERSION}`);
});
