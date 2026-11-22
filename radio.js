// Радио в сцене. Живой эфир по жанру и эпохе из открытого каталога radio-browser.info (без ключа, отдаёт данные
// браузеру) играет у тебя обычным <audio>, а пометка «играет в сцене» говорит модели, что его слышат сами герои:
// приёмник в машине, джаз в баре, новости на кухне. Музыка Режиссёра и Саундтрек — для тебя; радио — для них
// (и для тебя, если включишь звук). Режиссёр → «Радио в сцене»; в Сцене — строка с тем, что играет.
// Идея «в сцене — отдельно от саундтрека» и живого эфира по жанру — TavernOS HUD (alewwi), см. NOTICE-HUD.md;
// код, список жанров и выбор станций написаны заново.

let A = null;
let ext = {};
export function initRadio(api) { A = api; ext = api; }
const esc = (v) => A.esc(v);

// [id, название, тег каталога]
export const GENRES = [
    ['swing', 'Свинг, биг-бэнд', 'swing'], ['jazz', 'Джаз', 'jazz'], ['oldies', 'Старые хиты', 'oldies'], ['rock', 'Рок', 'rock'], ['pop', 'Поп', 'pop'],
    ['soul', 'Соул и фанк', 'soul'], ['classic', 'Классика', 'classical'], ['lofi', 'Лоу-фай', 'lofi'], ['electro', 'Электроника', 'electronic'],
    ['country', 'Кантри', 'country'], ['hiphop', 'Хип-хоп', 'hip hop'], ['news', 'Новости', 'news'], ['ru', 'По-русски', 'russian'],
];
const MIRRORS = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://nl1.api.radio-browser.info'];

function cfg() {
    const s = A.settings();
    if (!s.radio || typeof s.radio !== 'object') s.radio = {};
    if (s.radio.on === undefined) s.radio.on = true;
    if (!Number.isFinite(s.radio.vol)) s.radio.vol = 0.5;
    return s.radio;
}
const on = () => cfg().on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.radio || typeof cm.radio !== 'object') cm.radio = {};
    return cm.radio;
}

/** Десятилетие сцены по дате истории: 40s … 2020s (для подбора станций и подсказки модели). */
export function decade(date = A.worldState()?.timestamp?.story_date) {
    let y = NaN;
    try { const d = A.parseDate(date); if (d && !isNaN(d)) y = d.getFullYear(); } catch { /* */ }
    if (!Number.isFinite(y)) y = 2024;
    if (y < 1950) return { tag: '40s', label: '1940-е', y };
    if (y < 2000) { const d = Math.floor((y % 100) / 10) * 10; return { tag: `${d}s`, label: `${1900 + d}-е`, y }; }
    if (y < 2010) return { tag: '2000s', label: '2000-е', y };
    return { tag: '', label: 'наши дни', y };
}
/** Жанр по эпохе, если она не выбрала сама: в 40-х — свинг, дальше — старые хиты своего десятилетия, сейчас — поп. */
const autoGenre = () => { const d = decade(); return d.y < 1950 ? 'swing' : d.y < 2000 ? 'oldies' : 'pop'; };

// ───────────── плеер (у тебя в браузере) ─────────────

let audio = null;
let playing = null;
let list = [];
let busy = '';
let err = '';
function player() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('error', () => { if (playing) { err = 'станция не отвечает — выбери другую'; playing = null; rerender(); } });
    return audio;
}
const rerender = () => { try { ext.rerender?.(); } catch { /* */ } };
export const radioNow = () => (playing && audio && !audio.paused ? playing : null);

/** Станции под жанр и эпоху: сначала жанр + десятилетие, мало — просто жанр. Только рабочие и (на https) с https-потоком. */
async function find(genre) {
    const g = GENRES.find(x => x[0] === genre) || GENRES[0];
    const dec = decade();
    const https = typeof location !== 'undefined' && location.protocol === 'https:';
    const ask = async (tags) => {
        for (const m of MIRRORS) {
            try {
                const u = `${m}/json/stations/search?tagList=${encodeURIComponent(tags.join(','))}&hidebroken=true&order=clickcount&reverse=true&limit=40`;
                const r = await fetch(u, { headers: { Accept: 'application/json' } });
                if (!r.ok) continue;
                return await r.json();
            } catch { /* следующее зеркало */ }
        }
        throw new Error('каталог радио не отвечает');
    };
    let raw = [];
    if (dec.tag && genre !== 'news' && genre !== 'ru') raw = await ask([g[2], dec.tag]);
    if (raw.length < 4) raw = [...raw, ...await ask([g[2]])];
    const seen = new Set();
    return raw.filter(x => {
        const url = String(x.url_resolved || x.url || '');
        if (!/^https?:\/\//.test(url) || (https && !url.startsWith('https:')) || seen.has(url) || !x.name) return false;
        seen.add(url);
        return true;
    }).slice(0, 10).map(x => ({ name: String(x.name).trim().slice(0, 60), url: String(x.url_resolved || x.url), tags: String(x.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 4), country: String(x.country || '').slice(0, 30), icon: String(x.favicon || '') }));
}

async function play(st) {
    const el = player();
    err = '';
    try { ext.musicStop?.(); } catch { /* */ }   // своя музыка Режиссёра уступает радио
    el.src = st.url;
    el.volume = cfg().vol;
    playing = st;
    try { await el.play(); } catch (e) { playing = null; err = /NotAllowed/i.test(String(e?.name || e)) ? 'браузер не дал включить звук — тапни ▶ ещё раз' : 'станция не играет — выбери другую'; }
}
function stop() { if (audio) { audio.pause(); audio.removeAttribute('src'); } playing = null; }

// ───────────── что знает модель ─────────────

/** В сцене играет радио — герои его слышат. */
export function radioPrompt(type) {
    if (!on() || type === 'quiet' || type === 'impersonate' || !A?.hasChat?.()) return '';
    const r = M();
    if (!r.scene || !r.st) return '';
    const g = GENRES.find(x => x[0] === r.genre)?.[1] || '';
    return `[Радио в сцене: играет «${r.st.name}»${g ? ` (${g.toLowerCase()}${r.st.country ? `, ${r.st.country}` : ''})` : ''}. Герои его слышат: оно звучит фоном, кто-то может сделать тише, подпеть, переключить или выключить. Не называй конкретных песен и исполнителей, если не уверен, что они звучали в эту эпоху.]`;
}

// ───────────── интерфейс ─────────────

/** Строка в Сцене: что играет в сцене. */
export function radioSceneHtml() {
    if (!on() || !A?.hasChat?.()) return '';
    const r = M();
    if (!r.scene || !r.st) return '';
    const live = radioNow();
    return `<div class="lf-rd-line">${A.icon('volume')}<span><b>Радио в сцене</b> · ${esc(r.st.name)}${live ? ' · <i>играет у тебя</i>' : ''}</span><button class="lf-iconbtn sm" data-act="rd-scene-off" title="выключить в сцене">${A.icon('x')}</button></div>`;
}

/** Секция в листе Режиссёра. */
export function radioHtml() {
    if (!on()) return '';
    const r = M();
    const genre = r.genre || autoGenre();
    const dec = decade();
    const live = radioNow();
    const cur = live || r.st;
    return `${A.sec(`${A.icon('volume')} Радио в сцене`, live ? esc(live.name) : r.st && r.scene ? 'в сцене' : '')}
    <div class="lf-chips wrap">${GENRES.map(([id, l]) => `<button class="lf-chip${genre === id ? ' on' : ''}" data-act="rd-genre" data-v="${id}">${l}</button>`).join('')}</div>
    <div class="lf-hint">${dec.tag ? `Эпоха сцены — ${dec.label}: ищу станции ${dec.label} в этом жанре, мало — просто жанр.` : 'Ищу живые станции в этом жанре.'} Каталог — radio-browser.info.</div>
    ${busy ? `<div class="lf-hint">${esc(busy)}…</div>` : `<button class="lf-btn full" data-act="rd-find">${A.icon('search')} ${list.length ? 'Другие станции' : 'Найти станции'}</button>`}
    ${err ? `<div class="lf-note warn">${esc(err)}</div>` : ''}
    ${list.length ? `<div class="lf-rd-list">${list.map((st, k) => `<button class="lf-rd-st${cur?.url === st.url ? ' on' : ''}" data-act="rd-play" data-i="${k}">${st.icon ? `<img src="${esc(st.icon)}" alt="" loading="lazy" onerror="this.remove()">` : `<i>${A.icon('volume')}</i>`}<span><b>${esc(st.name)}</b><small>${esc([st.country, st.tags.join(', ')].filter(Boolean).join(' · '))}</small></span>${cur?.url === st.url && live ? '<span class="lf-eq"><i></i><i></i><i></i></span>' : ''}</button>`).join('')}</div>` : ''}
    ${cur ? `<div class="lf-music${live ? ' on' : ''}"><span class="lf-rd-now"><b>${esc(cur.name)}</b><small>${live ? 'играет у тебя' : 'тихо у тебя'}</small></span><span class="lf-eq"><i></i><i></i><i></i><i></i><i></i></span>
        <button class="lf-iconbtn big" data-act="${live ? 'rd-pause' : 'rd-resume'}">${A.icon(live ? 'pause' : 'play')}</button></div>
        <div class="lf-field"><label>Громкость у тебя</label><input type="range" min="0" max="1" step="0.05" data-in="rd-vol" value="${cfg().vol}"></div>` : ''}
    <label class="lf-switch"><input type="checkbox" data-in="rd-scene" ${r.scene ? 'checked' : ''} ${cur ? '' : 'disabled'}><span></span>Играет в сцене — герои слышат <small>(модель узнает, что звучит радио)</small></label>`;
}

export async function radioClick(act, el) {
    if (!act.startsWith('rd-')) return false;
    const r = M();
    switch (act) {
        case 'rd-genre': r.genre = el.dataset.v; list = []; err = ''; A.saveMeta(); break;
        case 'rd-find':
            busy = 'Ищу станции'; err = ''; rerender();
            try { list = await find(r.genre || autoGenre()); if (!list.length) err = 'в каталоге ничего не нашлось — попробуй другой жанр'; } catch (e) { err = String(e?.message || e); } finally { busy = ''; }
            break;
        case 'rd-play': {
            const st = list[Number(el.dataset.i)];
            if (!st) return true;
            r.st = st;
            if (r.genre === undefined) r.genre = autoGenre();
            A.saveMeta();
            await play(st);
            break;
        }
        case 'rd-pause': if (audio) audio.pause(); break;
        case 'rd-resume': if (r.st) await play(r.st); break;
        case 'rd-scene-off': r.scene = false; stop(); A.saveMeta(); A.updatePrompt(); A.render(); return true;
        default: return false;
    }
    A.updatePrompt();
    rerender();
    return true;
}
/** Поля: громкость, «играет в сцене». */
export function radioInput(el) {
    const k = el?.dataset?.in;
    if (k === 'rd-vol') { cfg().vol = Math.max(0, Math.min(1, Number(el.value) || 0)); if (audio) audio.volume = cfg().vol; A.saveSettings(); return true; }
    if (k === 'rd-scene') { M().scene = !!el.checked; A.saveMeta(); A.updatePrompt(); rerender(); return true; }
    return false;
}
/** Смена чата: эфир не тянется в другой чат. */
export function radioChatChanged() { stop(); list = []; err = ''; }
