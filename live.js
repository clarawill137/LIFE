// «Оживить» (0.73): картинка поста → короткий ролик (3–5 с) через Atlas Cloud — Wan 2.2 Turbo или Grok Imagine.
// Её просьба 22.11: «а видео? короткие, пару секунд — типа падающего листка».
//
// Ролик не заменяет картинку. В теге остаётся <img> (её рисовал SLAY, у неё ✎, ↻, «во весь экран», карточка GC — всё как
// было), а рядом два атрибута: data-lf-live — путь к mp4 на сервере таверны, data-lf-live-of — с какой картинки он снят.
// Life кладёт поверх картинки <video> без звука по кругу; тапы проходят сквозь него к картинке. Картинку перерисовали —
// ролик от старой не показывается (data-lf-live-of не совпал), вернули ту картинку из «Версий» — показывается снова.
// SLAY у Naistera умеет видео сам («Video test mode») и пишет в пост <video> вместо <img>; здесь — иначе, нарочно: на
// <img> держится вся остальная механика картинок.
//
// Ключ — тот же ключ Atlas, что в SLAY (запоминается, когда SLAY стоит на Atlas). Путь: картинка (до 1280 px, JPEG) →
// POST /api/v1/model/generateVideo → опрос /api/v1/model/prediction/{id} → mp4 с их хранилища → /api/files/upload
// таверны (как SLAY кладёт видео Naistera) → путь в тег. Задача пишется в метаданные чата до опроса: если Safari выгрузит
// вкладку, после открытия чата Life дождётся её и впишет ролик сама.

import { isPicture, tagState } from './pmtags.js';
import { sceneOf } from './dp.js';

let A = null;   // общий доступ Life к таверне
let H = null;   // помощники окна промтов (prompts.js)
export function initLive(api, helpers) { A = api; H = helpers; }

/** Модели «картинка → видео» на Atlas. Цена — по их странице модели, в долларах за ролик. */
export const LIVE_MODELS = [
    { key: 'wan', id: 'atlascloud/wan-2.2-turbo/image-to-video', name: 'Wan 2.2 Turbo', img: 'image', durs: [5], res: ['480p', '720p', '1080p'],
        price: (d, r) => 0.02 * 5 * ({ '480p': 1, '720p': 2, '1080p': 3 }[r] || 2), hint: 'дёшево, ровное движение, без звука' },
    { key: 'grok', id: 'xai/grok-imagine-video/image-to-video', name: 'Grok Imagine', img: 'image_url', durs: [2, 3, 4, 5, 6, 8], res: ['480p', '720p'],
        price: (d) => 0.05 * d, aspect: true, hint: 'живее, длину выбираешь сама, со звуком' },
];
const GROK_AR = [['1:1', 1], ['16:9', 16 / 9], ['9:16', 9 / 16], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 3 / 2], ['2:3', 2 / 3]];
const NEG = 'talking, lip movement, morphing face, distorted hands, extra people, new objects, text, watermark, camera shake, cuts, scene change, flicker';
const MOTION_DEF = 'Subtle living motion: soft breathing, a slow blink, hair and fabric stirring slightly, the light gently flickering. Static camera, no cuts, faces and composition unchanged.';
const JOB_MS = 20 * 60000;    // задачу старше — не ждём
const POLL_MS = 8 * 60000;    // столько ждём ответа Atlas в одном заходе

const modelOf = (key) => LIVE_MODELS.find(m => m.key === key) || LIVE_MODELS[0];
const slayS = () => A?.ctx?.()?.extensionSettings?.slay_image_gen || null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const unattr = (s) => String(s ?? '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function fileName(src) { let x = String(src || '').split(/[?#]/)[0].split('/').pop(); try { x = decodeURIComponent(x); } catch { /* как есть */ } return x; }
const cents = (usd) => `${Math.round(usd * 100)}¢`;

export function liveCfg() {
    const s = A.settings();
    if (!s.pm || typeof s.pm !== 'object') s.pm = {};
    if (!s.pm.live || typeof s.pm.live !== 'object') s.pm.live = {};
    const c = s.pm.live;
    if (!LIVE_MODELS.some(m => m.key === c.model)) c.model = 'wan';
    if (!['480p', '720p', '1080p'].includes(c.res)) c.res = '720p';
    if (!modelOf('grok').durs.includes(Number(c.dur))) c.dur = 3;
    if (typeof c.key !== 'string') c.key = '';
    return c;
}
const resFor = (m, c) => (m.res.includes(c.res) ? c.res : '720p');
const durFor = (m, c) => (m.durs.length === 1 ? m.durs[0] : Number(c.dur) || 3);
export const priceNow = (m = modelOf(liveCfg().model), c = liveCfg()) => m.price(durFor(m, c), resFor(m, c));

/** Ключ Atlas: из SLAY, когда он стоит на Atlas (и запоминаем — вдруг SLAY переключат на Naistera), иначе запомненный. */
function atlasKey() {
    const c = liveCfg(), st = slayS();
    const k = st?.apiType === 'atlas' ? String(st.apiKey || '').trim() : '';
    if (k) { if (c.key !== k) { c.key = k; A.saveSettings(); } return k; }
    return String(c.key || '').trim();
}
function atlasBase() {
    const st = slayS();
    const e = st?.apiType === 'atlas' ? String(st.endpoint || '').trim().replace(/\/+$/, '') : '';
    return /^https?:\/\//i.test(e) ? e : 'https://api.atlascloud.ai';
}

// ───────────── тег ─────────────

const ATTR_LIVE = /\sdata-lf-live\s*=\s*"([^"]*)"/i;
const ATTR_OF = /\sdata-lf-live-of\s*=\s*"([^"]*)"/i;
/** Ролик картинки из текста тега: { path, of } или null. */
export function liveOfTag(t) {
    const s = String(t?.full || '');
    const a = ATTR_LIVE.exec(s);
    if (!a) return null;
    const o = ATTR_OF.exec(s);
    return { path: unattr(a[1]), of: unattr(o ? o[1] : '') };
}
/** Тот же тег с роликом (или без него — path пустой). */
export function withLive(t, path, of) {
    let s = String(t?.full || '').replace(/\sdata-lf-live(?:-of)?\s*=\s*"[^"]*"/gi, '');
    if (path) s = s.replace(/^<(img|video)\b/i, (m0, tag) => `<${tag} data-lf-live="${attr(path)}" data-lf-live-of="${attr(of)}"`);
    return s;
}
/** Ролик этой картинки — если он снят с той, что сейчас в теге. */
export function liveNow(t) {
    const lv = liveOfTag(t);
    return lv && lv.path && lv.of && tagState(t) === 'ok' && lv.of === fileName(t.src) ? lv : null;
}

// ───────────── показ ─────────────

let io = null, ro = null;
const badSeen = new Set();
function watch(v) {
    if (!io) {
        io = new IntersectionObserver((es) => {
            for (const e of es) {
                const v = e.target;
                if (e.isIntersecting && e.intersectionRatio >= 0.25) {
                    if (!v.getAttribute('src')) v.src = v.dataset.path;
                    v.play()?.catch?.(() => { /* Safari: не сейчас — сыграет на следующем показе */ });
                } else if (!v.paused) v.pause();
            }
        }, { threshold: [0, 0.25, 0.6] });
    }
    io.observe(v);
}
function place(v, img) {
    const w = img.offsetWidth, h = img.offsetHeight;
    if (!w || !h) { v.style.display = 'none'; if (!img.complete) img.addEventListener('load', () => place(v, img), { once: true }); return; }
    v.style.display = '';
    v.style.left = `${img.offsetLeft}px`;
    v.style.top = `${img.offsetTop}px`;
    v.style.width = `${w}px`;
    v.style.height = `${h}px`;
}
function makeVideo(path, cls = 'lf-live') {
    const v = document.createElement('video');
    v.className = cls;
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    for (const a of ['muted', 'playsinline', 'loop', 'disablepictureinpicture']) v.setAttribute(a, '');
    v.setAttribute('aria-hidden', 'true');
    v.dataset.path = path;
    v.addEventListener('playing', () => v.classList.add('on'));
    v.addEventListener('error', () => {
        v.classList.remove('on');
        v.classList.add('bad');
        if (!badSeen.has(path)) { badSeen.add(path); H?.keepLog?.(`ролик не играет: ${fileName(path)} — ошибка ${v.error?.code || '?'} (файла нет или формат не тот)`); }
    });
    return v;
}
const isOurs = (n) => n?.nodeType === 1 && (n.classList?.contains('lf-live') || n.classList?.contains('lf-live-lb'));
export { isOurs as isLiveNode };

/** Поверх картинок поста — их ролики (если сняты с этих же картинок). Зовётся из присмотра за постами. */
export function paintLive(el, i = Number(el?.getAttribute?.('mesid'))) {
    const mt = el?.querySelector?.('.mes_text');
    if (!mt) return;
    // картинка оживает, а карточку GC пересобрали — пульс «рисуется» вернуть на новую
    if (Number.isInteger(i)) for (const key of running) { const [ri, rk] = key.split(':').map(Number); if (ri === i) H.busyMark(ri, rk, true); }
    if (!ro && typeof ResizeObserver === 'function') ro = new ResizeObserver((es) => { for (const e of es) { const v = e.target.nextElementSibling; if (v?.matches?.('video.lf-live')) place(v, e.target); } });
    for (const img of mt.querySelectorAll('img[data-lf-live]')) {
        if (img.closest('.lf-pm-proxy')) continue;
        const path = img.dataset.lfLive || '', of = img.dataset.lfLiveOf || '';
        const ok = !!path && !!of && fileName(img.getAttribute('src')) === of;
        let v = img.nextElementSibling?.matches?.('video.lf-live') ? img.nextElementSibling : null;
        if (!ok) {
            if (v) { v.remove(); ro?.unobserve(img); }
            img.parentElement?.classList.remove('lf-live-box');
            continue;
        }
        if (!v || v.dataset.path !== path) {
            v?.remove();
            v = makeVideo(path);
            img.after(v);
            watch(v);
            ro?.observe(img);
        }
        img.parentElement?.classList.add('lf-live-box');
        place(v, img);
    }
    for (const v of mt.querySelectorAll('video.lf-live')) if (!v.previousElementSibling?.matches?.('img[data-lf-live]')) v.remove();
}

/** Окно SLAY «во весь экран» — и там ролик, со звуком по кнопке. tap: { i, k } картинки поста или null. */
export function liveLightbox(tap) {
    const lb = document.getElementById('slay_lightbox');
    const img = lb?.querySelector('.iig-lightbox-img');
    lb?.querySelectorAll('video.lf-live-lb').forEach(v => v.remove());
    const t = tap && A?.chatArr?.()[tap.i] ? H.tagsOf(tap.i)[tap.k] : null;
    const lv = t ? liveNow(t) : null;
    const bar = document.getElementById('lf-pm-lbx');
    const lab = bar?.querySelector('[data-lb="live"] span');
    if (lab) lab.textContent = lv ? 'Ещё раз' : 'Оживить';
    const snd = bar?.querySelector('[data-lb="sound"]');
    if (snd) { snd.hidden = !lv; snd.classList.remove('on'); }
    if (!lv || !img) return;
    const v = makeVideo(lv.path, 'lf-live-lb');
    v.src = lv.path;
    img.after(v);
    img.parentElement?.classList.add('lf-live-box');
    const put = () => place(v, img);
    if (img.complete) put(); else img.addEventListener('load', put, { once: true });
    setTimeout(put, 250);
    v.play()?.catch?.(() => { /* */ });
}
/** «Звук» у ролика во весь экран. */
export function liveSound(btn) {
    const v = document.querySelector('#slay_lightbox video.lf-live-lb');
    if (!v) return;
    v.muted = !v.muted;
    btn?.classList.toggle('on', !v.muted);
    if (!v.muted) v.play()?.catch?.(() => { /* */ });
}

// ───────────── движение ─────────────

const MOTION_SYS = `You turn a finished still frame from a roleplay into a short clip that plays on a loop inside the chat.
Write the motion prompt for an image-to-video model. Describe only what moves and how, in the present tense: small,
natural, physically believable motion that belongs to this exact scene — leaves drifting down, steam curling up, candle
flames flickering, rain running down glass, snow, smoke, dust in a beam of light, hair or fabric stirring, breathing, a
slow blink, a small shift of weight or of the gaze. People keep their poses, faces and clothes; nobody talks; no new
people or objects; no cuts; no text. Camera: static, or a barely noticeable slow push-in. Keep the look, colours and
lighting of the image. If she says what should move, build around that.
One short paragraph in English, under 60 words. Return only JSON: {"motion": "..."}`;

function postText(m) {
    return String(m?.mes || '').replace(/<img\b[^>]*>/gi, ' ').replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Движение для этой картинки: агент Летописца по сцене, посту и промту картинки; не ответил — спокойное по умолчанию. */
export async function motionFor(i, k, request = '', dur = 5) {
    const m = A.chatArr()[i];
    const t = H.tagsOf(i)[k];
    let scene = '';
    try { const s = sceneOf(i); scene = [s?.loc, s?.time, s?.atm, s?.desc].filter(Boolean).join(' · '); } catch { /* сцены нет */ }
    const user = [
        scene ? `Scene: ${scene}` : '',
        `The still (its image prompt): ${A.cut(String(t?.data?.prompt || ''), 900)}`,
        `The post (what happens): ${A.cut(postText(m), 1400)}`,
        request ? `She asks: ${request}` : '',
        `Clip length: ${dur} seconds.`,
    ].filter(Boolean).join('\n\n');
    try {
        const raw = await A.askModel([{ role: 'system', content: MOTION_SYS }, { role: 'user', content: user }], 500, 'Оживить');
        let j = null;
        try { j = A.extractJson ? A.extractJson(raw) : JSON.parse(String(raw).match(/\{[\s\S]*\}/)?.[0] || 'null'); } catch { j = null; }
        const mo = String(j?.motion || '').trim() || (/^[A-Z][^{}]{20,400}$/.test(String(raw || '').trim()) ? String(raw).trim() : '');
        if (mo) return A.cut(mo, 500);
    } catch (e) { H.pmLog?.('оживить: движение не придумалось —', String(e?.message || e)); }
    return request ? `${request}. Static camera, no cuts, faces and composition unchanged.` : MOTION_DEF;
}

// ───────────── Atlas ─────────────

const moderated = (t) => /moderat|flagged|sensitive|safety|policy|prohibit|nsfw|inappropriate|violat/i.test(String(t || ''));
function liveErr(kind, msg) { const e = new Error(String(msg || kind)); e.kind = kind; return e; }
function httpErr(status, text) {
    const t = String(text || '').slice(0, 400);
    if (status === 401 || status === 403) return liveErr('key', `Atlas не принял ключ (${status}): ${t}`);
    if (status === 402 || /insufficient|balance|credit|quota/i.test(t)) return liveErr('money', `Atlas: не хватает денег на счёте (${status}): ${t}`);
    if (moderated(t)) return liveErr('filter', t);
    return liveErr('http', `Atlas ответил ${status}: ${t}`);
}
const outputOf = (j) => { const d = j?.data || j || {}; const o = Array.isArray(d.outputs) ? d.outputs[0] : (d.output ?? d.video ?? null); return typeof o === 'string' ? o : (o?.url || o?.video_url || ''); };

async function stillData(src) {
    const r = await fetch(src, { cache: 'force-cache' });
    if (!r.ok) throw liveErr('still', `картинка не открылась (${r.status})`);
    const blob = await r.blob();
    let bmp = null;
    try { bmp = await createImageBitmap(blob); } catch { bmp = null; }
    if (!bmp) return { data: await blobData(blob), w: 0, h: 0 };
    const sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL('image/jpeg', 0.92), w: bmp.width, h: bmp.height };
}
const blobData = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

async function atlasUpload(base, key, dataUrl) {
    const comma = dataUrl.indexOf(',');
    const bin = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    const fd = new FormData();
    fd.append('file', new Blob([bytes], { type: 'image/jpeg' }), 'still.jpg');
    const r = await fetch(`${base}/api/v1/model/uploadMedia`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (!r.ok) throw httpErr(r.status, await r.text());
    const j = await r.json();
    const url = j?.data?.download_url || j?.download_url || j?.data?.url || j?.url;
    if (!url) throw liveErr('http', `Atlas: картинка загрузилась, а ссылки нет: ${JSON.stringify(j).slice(0, 200)}`);
    return url;
}

/** Отправить задачу. → id задачи (или сразу ссылка на ролик). */
async function submit({ m, motion, still, dur, res, ar }) {
    const key = atlasKey();
    if (!key) throw liveErr('key', 'нет ключа Atlas');
    const base = atlasBase();
    const body = { model: m.id, prompt: motion, [m.img]: still, resolution: res };
    if (m.key === 'wan') { body.duration = 5; body.seed = -1; body.negative_prompt = NEG; }
    else { body.duration = dur; if (m.aspect && ar) body.aspect_ratio = ar; }
    const send = () => fetch(`${base}/api/v1/model/generateVideo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    let r = await send();
    if (!r.ok && r.status >= 400 && r.status < 500 && ![401, 402, 403].includes(r.status)) {
        // картинку строкой base64 берут не все — загрузить к ним и дать ссылкой
        const t = await r.text();
        if (moderated(t)) throw liveErr('filter', t);
        H.pmLog?.('оживить: Atlas не взял картинку строкой —', t.slice(0, 160), '— гружу ссылкой');
        body[m.img] = await atlasUpload(base, key, still);
        r = await send();
    }
    if (!r.ok) throw httpErr(r.status, await r.text());
    const j = await r.json();
    const now = outputOf(j);
    if (now) return { url: now };
    const id = j?.data?.id || j?.id || j?.data?.prediction_id || j?.prediction_id || j?.data?.request_id;
    if (!id) throw liveErr('http', `Atlas не дал номер задачи: ${JSON.stringify(j).slice(0, 200)}`);
    return { id: String(id) };
}
/** Дождаться задачи. → ссылка на ролик. */
async function poll(id, onStep) {
    const key = atlasKey();
    const base = atlasBase();
    const t0 = Date.now();
    for (let n = 0; ; n++) {
        await sleep(n < 5 ? 3000 : 5000);
        if (Date.now() - t0 > POLL_MS) throw liveErr('wait', 'Atlas не дорисовал за 8 минут');
        let r;
        try { r = await fetch(`${base}/api/v1/model/prediction/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } }); } catch { continue; }
        if (!r.ok) { if (r.status >= 500 || r.status === 429) continue; throw httpErr(r.status, await r.text()); }
        const j = await r.json();
        const st = String(j?.data?.status || j?.status || '').toLowerCase();
        if (/^(completed|succeeded|success|done)$/.test(st)) { const u = outputOf(j); if (!u) throw liveErr('http', `Atlas: готово, а ссылки нет: ${JSON.stringify(j).slice(0, 200)}`); return u; }
        if (/^(failed|error|canceled|cancelled)$/.test(st)) { const why = j?.data?.error || j?.error || JSON.stringify(j).slice(0, 300); throw liveErr(moderated(why) ? 'filter' : 'fail', typeof why === 'string' ? why : JSON.stringify(why)); }
        onStep?.(st, Date.now() - t0);
    }
}
/** Ролик — к себе на сервер (как SLAY кладёт видео Naistera). Не вышло — остаётся ссылка Atlas (может протухнуть). */
async function keep(url) {
    let blob;
    try { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); blob = await r.blob(); }
    catch (e) { return { path: url, remote: true, why: `не скачался (${String(e?.message || e)})` }; }
    const data = (await blobData(blob)).replace(/^data:[^,]*,/, '');
    const name = `lf_live_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
    try {
        const r = await fetch('/api/files/upload', { method: 'POST', headers: A.ctx().getRequestHeaders(), body: JSON.stringify({ name, data }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        return { path: j?.path || `/user/files/${name}` };
    } catch (e) { return { path: url, remote: true, why: `таверна не взяла файл (${String(e?.message || e)})` }; }
}

// ───────────── задачи ─────────────

const running = new Set();   // «пост:картинка»
function jobs() {
    const cm = A.chatMeta();
    if (!cm.pm || typeof cm.pm !== 'object') cm.pm = {};
    if (!Array.isArray(cm.pm.lvq)) cm.pm.lvq = [];
    return cm.pm.lvq;
}
function notes() {
    const cm = A.chatMeta();
    if (!cm.pm || typeof cm.pm !== 'object') cm.pm = {};
    if (!cm.pm.lv || typeof cm.pm.lv !== 'object') cm.pm.lv = {};
    return cm.pm.lv;
}
/** Что запомнено о ролике этой картинки (движение, модель) — по имени файла картинки. */
export const liveNote = (of) => (of ? notes()[of] || null : null);

/** Оживить картинку k поста i. opts: { motion, request, model, quiet } → true, если ролик встал. */
export async function animate(i, k, opts = {}) {
    const key = `${i}:${k}`;
    if (running.has(key)) { A.toast('info', 'Эта картинка уже оживает — ролик встанет на место сам.', '▶ Оживить'); return false; }
    const m0 = A.chatArr()[i];
    const t = H.tagsOf(i)[k];
    if (!m0 || !t?.data || tagState(t) !== 'ok' || !isPicture(t.src)) { A.toast('info', 'Оживить можно готовую картинку — эта ещё не нарисована.', '▶ Оживить'); return false; }
    if (!atlasKey()) { A.toast('warning', 'Нужен ключ Atlas: в SLAY выбери Atlas (ключ подхватится сам) или вставь его в ✎ → «Оживить» → ключ.', '▶ Оживить', { timeOut: 9000 }); return false; }
    const c = liveCfg();
    const m = modelOf(opts.model || c.model);
    const dur = durFor(m, c), res = resFor(m, c);
    const of = fileName(t.src);
    running.add(key);
    H.busyMark(i, k, true);
    A.toast('info', `Оживляю: ${m.name}, ${dur} с — это минута-две, ролик встанет на место сам (~${cents(m.price(dur, res))}).`, '▶ Оживить', { timeOut: 6000 });
    const t0 = Date.now();
    let motion = '';
    try {
        const st = await stillData(t.src);
        motion = String(opts.motion || '').trim() || await motionFor(i, k, String(opts.request || '').trim(), dur);
        let ar = '';
        if (m.aspect && st.w && st.h) { const r = st.w / st.h; ar = GROK_AR.reduce((b, x) => (Math.abs(Math.log(x[1] / r)) < Math.abs(Math.log(b[1] / r)) ? x : b))[0]; }
        H.keepLog(`оживить: пост ${i}, картинка ${k} — ${m.name}, ${dur} с, ${res}${ar ? `, ${ar}` : ''} · движение: ${A.cut(motion, 200)}`);
        const sub = await submit({ m, motion, still: st.data, dur, res, ar });
        let url = sub.url || '';
        if (!url) {
            const q = jobs();
            q.push({ id: sub.id, i, k, of, model: m.key, motion, at: Date.now() });
            try { await A.ctx().saveMetadata?.(); } catch { A.saveMeta(); }   // сразу: Safari может выгрузить вкладку посреди ожидания
            try { url = await poll(sub.id); } finally { const j = jobs().findIndex(x => x.id === sub.id); if (j >= 0) { jobs().splice(j, 1); A.saveMeta(); } }
        }
        return await land({ i, k, of, url, m, motion, dur, res, t0, quiet: opts.quiet });
    } catch (e) {
        failed(i, e, m);
        return false;
    } finally {
        running.delete(key);
        H.busyMark(i, k, false);
    }
}

function failed(i, e, m) {
    const kind = e?.kind || '';
    const msg = String(e?.message || e);
    H.keepLog(`не ожило: пост ${i} — ${A.cut(msg, 300)}`);
    const text = kind === 'filter' ? 'Фильтр видео не пропустил эту картинку. Попробуй другую модель или картинку поспокойнее.'
        : kind === 'key' ? 'Atlas не принял ключ — проверь его в SLAY (или в ✎ → «Оживить» → ключ).'
            : kind === 'money' ? 'На счёте Atlas не хватает денег.'
                : kind === 'wait' ? `${m?.name || 'Atlas'} не дорисовал за 8 минут — попробуй ещё раз позже.`
                    : `Не ожило: ${esc(A.cut(msg, 220))}`;
    A.toast(kind === 'filter' || kind === 'wait' ? 'warning' : 'error', text, '▶ Оживить', { timeOut: 9000 });
}

/** Ролик готов: к себе на сервер и в тег — если картинка в посте всё та же. */
async function land({ i, k, of, url, m, motion, dur, res, t0, quiet }) {
    const kept = await keep(url);
    const ts = H.tagsOf(i);
    const kk = ts[k] && fileName(ts[k].src) === of ? k : ts.findIndex(x => fileName(x.src) === of);
    const msg = A.chatArr()[i];
    if (!msg || kk < 0) {
        H.keepLog(`ожило, но картинку в посте ${i} уже сменили — ролик не вписан: ${fileName(kept.path)}`);
        if (!quiet) A.toast('info', 'Ролик готов, но картинку уже перерисовали — не вписываю.', '▶ Оживить');
        return false;
    }
    H.swapTag(i, msg, ts[kk], withLive(ts[kk], kept.path, of));
    await A.ctx().saveChat?.();
    const node = H.nodeFor(i, kk);
    if (node?.tagName === 'IMG') { node.dataset.lfLive = kept.path; node.dataset.lfLiveOf = of; }
    notes()[of] = { path: kept.path, motion, model: m.key, dur, res, at: Date.now() };
    const nk = Object.keys(notes());
    if (nk.length > 300) nk.sort((a, b) => (notes()[a].at || 0) - (notes()[b].at || 0)).slice(0, nk.length - 300).forEach(x => delete notes()[x]);
    A.saveMeta();
    paintLive(H.mesEl(i));
    const secs = Math.round((Date.now() - (t0 || Date.now())) / 1000);
    H.keepLog(`ожило: пост ${i}, картинка ${kk} → ${fileName(kept.path)}${secs ? ` (${secs} с)` : ''}${kept.remote ? ` — ссылка Atlas, ${kept.why}` : ''}`);
    if (!quiet) A.toast('success', kept.remote ? 'Ожило ▶ — но ролик остался по ссылке Atlas (к себе не скачался), со временем может пропасть.' : 'Ожило ▶', '▶ Оживить', { timeOut: kept.remote ? 9000 : 3500 });
    try { H.repaint?.(); } catch { /* окна нет */ }
    return true;
}

/** Убрать ролик с картинки (файл на сервере остаётся). */
export async function unlive(i, k) {
    const m = A.chatArr()[i];
    const t = H.tagsOf(i)[k];
    if (!m || !t || !liveOfTag(t)) return false;
    H.swapTag(i, m, t, withLive(t, '', ''));
    await A.ctx().saveChat?.();
    const node = H.nodeFor(i, k);
    if (node?.tagName === 'IMG') { delete node.dataset.lfLive; delete node.dataset.lfLiveOf; }
    paintLive(H.mesEl(i));
    H.keepLog(`ролик убран: пост ${i}, картинка ${k}`);
    return true;
}

/** Задачи, которые ждали, когда вкладку выгрузили: дождаться и вписать. Раз на открытие чата. */
let resumedFor = '';
export async function resumeLive(chatKey) {
    if (!chatKey || resumedFor === chatKey) return;
    resumedFor = chatKey;
    const q = jobs();
    if (!q.length) return;
    const now = Date.now();
    for (const j of [...q]) {
        const at = q.indexOf(j);
        if (now - (j.at || 0) > JOB_MS) { q.splice(at, 1); A.saveMeta(); H.keepLog(`оживить: задача ${j.id} (пост ${j.i}) старше 20 минут — не жду`); continue; }
        const key = `${j.i}:${j.k}`;
        if (running.has(key)) continue;
        running.add(key);
        H.keepLog(`оживить: дожидаюсь задачи после перезагрузки — пост ${j.i}, картинка ${j.k}`);
        (async () => {
            const m = modelOf(j.model);
            try { const url = await poll(j.id); await land({ i: j.i, k: j.k, of: j.of, url, m, motion: j.motion, dur: 0, res: '', t0: 0, quiet: false }); }
            catch (e) { failed(j.i, e, m); }
            finally { running.delete(key); const x = jobs().findIndex(y => y.id === j.id); if (x >= 0) { jobs().splice(x, 1); A.saveMeta(); } }
        })();
    }
}

// ───────────── окно ✎ ─────────────

/** Строка «Оживить» в окне промта. S — состояние окна; k — номер картинки в посте. */
export function liveHtml(S, k) {
    if (!S || S.ad?.kind !== 'post' || !S.src || k < 0) return '';
    const t = H.tagsOf(S.ad.mes)[k];
    if (!t || tagState(t) !== 'ok') return '';
    const c = liveCfg();
    const lv = liveNow(t);
    const note = liveNote(fileName(t.src));
    if (S.liveMotion === undefined) S.liveMotion = note?.motion || '';
    const busy = running.has(`${S.ad.mes}:${k}`);
    const chip = (m) => `<button class="lf-pm-chip${c.model === m.key ? ' on' : ''}" data-pm="live-model" data-v="${m.key}" title="${esc(m.hint)}"><b>${esc(m.name)}</b><small>${durFor(m, c)} с · ${cents(m.price(durFor(m, c), resFor(m, c)))}</small></button>`;
    const grok = modelOf('grok');
    return `<label class="lf-pm-l"><span>▶ Оживить</span><small>картинка → ролик на пару секунд</small></label>
        <textarea class="lf-pm-ta small" data-in="live-motion" rows="2" placeholder="Что движется — по-русски или по-английски: «падают листья», «пар над водой, свечи дрожат». Пусто — придумаю по сцене">${esc(S.liveMotion)}</textarea>
        <div class="lf-pm-chips lv">
            <button class="lf-pm-chip go" data-pm="live"${busy ? ' disabled' : ''}>${busy ? 'оживает…' : lv ? '▶ Ещё раз' : '▶ Оживить'}</button>
            ${LIVE_MODELS.map(chip).join('')}
            ${lv ? '<button class="lf-pm-chip" data-pm="live-off">убрать ролик</button>' : ''}
        </div>
        ${c.model === 'grok' ? `<div class="lf-pm-chips lvd"><span>длина</span>${grok.durs.map(d => `<button class="lf-pm-chip${Number(c.dur) === d ? ' on' : ''}" data-pm="live-dur" data-v="${d}">${d} с</button>`).join('')}</div>` : ''}
        <div class="lf-pm-chips lvr"><span>качество</span>${modelOf(c.model).res.map(r => `<button class="lf-pm-chip${resFor(modelOf(c.model), c) === r ? ' on' : ''}" data-pm="live-res" data-v="${r}">${r}</button>`).join('')}</div>
        ${atlasKey() ? '' : `<input class="lf-pm-ta small lf-pm-key" data-in="live-key" type="password" autocomplete="off" placeholder="Ключ Atlas Cloud (если SLAY не на Atlas)">`}
        <div class="lf-pm-dim">Ролик ложится поверх картинки и крутится без звука; картинка, ✎ и ↻ остаются как были. Перерисуешь картинку — ролик от старой не показывается. ${lv ? `Сейчас: ${esc(fileName(lv.path))}${note?.model ? ` · ${esc(modelOf(note.model).name)}` : ''}.` : ''}</div>`;
}

/** Кнопки строки «Оживить». → true, если нажатие наше. */
export function liveClick(act, b, S, k, repaint) {
    if (!act?.startsWith('live')) return false;
    const c = liveCfg();
    if (act === 'live-model') { c.model = b.dataset.v; liveCfg(); A.saveSettings(); repaint(); return true; }
    if (act === 'live-dur') { c.dur = Number(b.dataset.v) || 3; A.saveSettings(); repaint(); return true; }
    if (act === 'live-res') { c.res = b.dataset.v; A.saveSettings(); repaint(); return true; }
    if (act === 'live-off') { unlive(S.ad.mes, k).then(() => repaint()); return true; }
    if (act === 'live') {
        const raw = String(S.liveMotion || '').trim();
        // по-русски — это просьба («падают листья»): движение напишет агент вокруг неё; по-английски — как есть
        const ru = /[а-яё]/i.test(raw);
        animate(S.ad.mes, k, ru ? { request: raw } : { motion: raw }).then(() => repaint());
        setTimeout(repaint, 50);
        return true;
    }
    return false;
}
/** Поля строки «Оживить». */
export function liveInput(key, el, S) {
    if (key === 'live-motion') { S.liveMotion = el.value.slice(0, 600); return true; }
    if (key === 'live-key') { liveCfg().key = el.value.trim(); A.saveSettings(); return true; }
    return false;
}

/** /life live — оживить последнюю картинку чата. */
export function liveCommand(word, last) {
    const m = /^(live|animate|оживить|ожить)(?:\s+([\s\S]+))?$/i.exec(String(word || '').trim());
    if (!m) return false;
    if (!A?.hasChat?.()) { A.toast('info', 'Сначала открой чат.', '▶ Оживить'); return true; }
    const p = last?.();
    if (!p) { A.toast('info', 'В чате нет картинок.', '▶ Оживить'); return true; }
    const req = String(m[2] || '').trim();
    animate(p.i, p.k, /[а-яё]/i.test(req) ? { request: req } : { motion: req });
    return true;
}

/** Есть ли у картинки ролик (для панели «во весь экран» и журнала). */
export function hasLive(i, k) { const t = H?.tagsOf?.(i)?.[k]; return !!(t && liveNow(t)); }
export const liveRunning = (i, k) => running.has(`${i}:${k}`);
