// Эмбиент: тихий звук под место и погоду — без файлов, синтезом в браузере (WebAudio).
// Дождь, ливень с грозой, ветер и метель, город за окном, тишина комнаты, огонь в камине, море, лес и птицы,
// гул бара или кафе, сверчки летней ночью. В помещении погода — приглушённо, «за окном».
// Пульт → Вид → плитка «Звук»: выкл → тихо → обычно. Музыка сцены играет — эмбиент уходит под неё.
// Дополнительно — «запах места» одной строкой в Сцене и модели (не в каждом посте, а когда место новое).

import { wxKind } from './weather.js';

let A = null;
export function initAmbient(api) {
    A = api;
    // айфон: звук можно включить только по касанию — первый тап по странице будит его, если он включён
    const wake = () => { if (level() !== 'off') { ensure(); ctxA?.resume?.(); update(); } };
    document.addEventListener('touchend', wake, { passive: true });
    document.addEventListener('click', wake);
    document.addEventListener('visibilitychange', () => { if (!ctxA) return; if (document.hidden) ctxA.suspend?.(); else if (level() !== 'off') ctxA.resume?.(); });
    // сцена, погода и музыка меняются — звук догоняет (дёшево: слои пересоздаются, только если сменилось место/погода)
    setInterval(() => { try { if (ctxA && level() !== 'off' && !document.hidden) update(); } catch { /* */ } }, 8000);
}

function cfg() {
    const s = A.settings();
    if (!s.amb || typeof s.amb !== 'object') s.amb = {};
    const c = s.amb;
    if (!['off', 'low', 'mid'].includes(c.level)) c.level = 'off';
    if (c.smell === undefined) c.smell = true;
    return c;
}
const level = () => cfg().level;
export function ambLabel() { return { off: 'Звук выкл', low: 'Звук тихо', mid: 'Звук' }[level()]; }
export function ambLevel() { return level(); }
export function cycleAmb() {
    const c = cfg();
    c.level = c.level === 'off' ? 'low' : c.level === 'low' ? 'mid' : 'off';
    A.saveSettings();
    if (c.level !== 'off') { ensure(); ctxA?.resume?.(); }
    update();
    A.toast('info', { off: 'Эмбиент выключен', low: 'Эмбиент — тихо', mid: 'Эмбиент — обычно' }[c.level], '✦ Звук', { timeOut: 1400 });
    return c.level;
}

// ───────────── что звучит ─────────────

const OUT = { city: /улиц|город|проспект|авеню|площад|мост|парков|переул|бульвар|перекр|крыш|балкон|манхэттен|бруклин|квинс|нью-йорк|таймс/i, sea: /мор|пляж|берег|океан|залив|пирс|причал|порт|набережн/i, forest: /лес|парк|сад|поле|луг|горы|гор[аеы](?![а-яёa-z0-9])|озер|река|тропа|кемпинг|ферм/i };
const BUSY = /бар(?![а-яёa-z0-9])|паб|кафе|ресторан|клуб|вечеринк|столов|кофейн|зал(?![а-яёa-z0-9])|банкет|казино|вокзал|аэропорт|магазин|рынок/i;
const FIRE = /камин|костер|костёр|печь|печк/i;
// улица, лес, крыша, мост — снаружи, даже если в названии есть «база» или «дом»
const OUTSIDE = /лес|парк|сад(?![а-яёa-z0-9])|поле|луг|пляж|берег|улиц|двор|крыш|балкон|мост|набережн|площад|трасс|дорог|озер|река|кладбищ|стоянк|парковк|причал|пирс/i;
const INDOOR = /квартир|дом(?![а-яёa-z0-9])|дома(?![а-яёa-z0-9])|комнат|кухн|спальн|гостин|ванн|душев|офис|кабинет|лаборат|(?<![а-яёa-z0-9])баз[аеуы](?![а-яёa-z0-9])|штаб|бар(?![а-яёa-z0-9])|кафе|ресторан|отел|номер|машин|салон|самол[её]т|джет|госпитал|больниц|палат|подвал|бункер|склад|ангар|лифт|коридор|магазин|церк|зал(?![а-яёa-z0-9])|клуб|квинджет|кабин/i;

/** { base, weather, inside, night } для текущей сцены. */
export function soundscape(st = A.worldState()) {
    const loc = String(st.scene?.location || '');
    const atm = String(st.scene?.atmosphere || '');
    const leaf = String(loc).split(/\s*[·・›>]\s*/).filter(Boolean).slice(-1)[0] || loc;
    const inside = OUTSIDE.test(leaf) ? false : INDOOR.test(loc);
    const h = +(String(st.timestamp?.story_time || '').match(/(\d{1,2})[:.]\d{2}/)?.[1] ?? 12);
    const night = h >= 22 || h < 5;
    let base = 'room';
    if (BUSY.test(loc)) base = 'crowd';
    else if (!inside && OUT.sea.test(loc)) base = 'sea';
    else if (!inside && OUT.forest.test(loc)) base = 'forest';
    else if (!inside && OUT.city.test(loc)) base = 'city';
    else if (!inside) base = 'city';
    const fire = FIRE.test(`${loc} ${atm}`);
    let weather = '';
    try { weather = wxKind(atm) || ''; } catch { /* */ }
    if (!weather && /ветр|ветер|ветрен/i.test(atm)) weather = 'wind';
    const summer = (() => { const d = A.parseDate?.(st.timestamp?.story_date); const m = d && !isNaN(d) ? d.getMonth() : -1; return m >= 5 && m <= 7; })();
    const crickets = !inside && night && summer && !weather && base !== 'city';
    return { base, weather, inside, night, fire, crickets, loc };
}

// ───────────── звук ─────────────

let ctxA = null, master = null, layers = {}, cur = '';

function ensure() {
    if (ctxA) return ctxA;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctxA = new AC();
    master = ctxA.createGain();
    master.gain.value = 0;
    master.connect(ctxA.destination);
    return ctxA;
}

function noiseBuf(kind = 'pink', sec = 4) {
    const n = Math.floor(ctxA.sampleRate * sec);
    const buf = ctxA.createBuffer(1, n, ctxA.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else {
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        }
    }
    return buf;
}

function loopNoise(kind, filters = [], gain = 0.3) {
    const src = ctxA.createBufferSource();
    src.buffer = noiseBuf(kind);
    src.loop = true;
    let node = src;
    for (const [type, f, q] of filters) { const bq = ctxA.createBiquadFilter(); bq.type = type; bq.frequency.value = f; if (q) bq.Q.value = q; node.connect(bq); node = bq; }
    const g = ctxA.createGain();
    g.gain.value = gain;
    node.connect(g);
    src.start();
    return { src, g, out: g, stop: () => { try { src.stop(); } catch { /* */ } } };
}

/** Медленное «дыхание» громкости (ветер, волны). */
function swell(g, base, depth, sec) {
    const lfo = ctxA.createOscillator();
    const lg = ctxA.createGain();
    lfo.frequency.value = 1 / sec;
    lg.gain.value = base * depth;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
    return () => { try { lfo.stop(); } catch { /* */ } };
}

/** Редкие короткие звуки: капли, треск огня, птицы, сверчки. */
function sprinkle(fn, everyMs) {
    let alive = true;
    const tick = () => { if (!alive) return; try { fn(); } catch { /* */ } setTimeout(tick, everyMs * (0.4 + Math.random() * 1.2)); };
    setTimeout(tick, everyMs * Math.random());
    return () => { alive = false; };
}

function blip(freq, dur, vol, type = 'sine', sweep = 0) {
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctxA.currentTime);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), ctxA.currentTime + dur);
    g.gain.setValueAtTime(0, ctxA.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctxA.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctxA.currentTime + dur + 0.05);
}

function crack(vol) {
    const src = ctxA.createBufferSource();
    src.buffer = noiseBuf('white', 0.05);
    const bq = ctxA.createBiquadFilter(); bq.type = 'bandpass'; bq.frequency.value = 1800 + Math.random() * 2500; bq.Q.value = 2;
    const g = ctxA.createGain(); g.gain.value = vol;
    src.connect(bq); bq.connect(g); g.connect(master);
    src.start();
}

/** Слой по имени → { out, stop } (всё уходит в master). */
function makeLayer(name, inside) {
    const muf = inside ? [['lowpass', 900]] : [];          // за окном — глуше
    const parts = [];
    const add = (l) => { l.out.connect(master); parts.push(l.stop); return l; };
    switch (name) {
        case 'room': add(loopNoise('brown', [['lowpass', 220]], 0.05)); break;
        case 'city': { const l = add(loopNoise('brown', [['lowpass', inside ? 260 : 480]], inside ? 0.08 : 0.18)); parts.push(swell(l.g, inside ? 0.08 : 0.18, 0.35, 11)); break; }
        case 'crowd': { const l = add(loopNoise('pink', [['bandpass', 700, 0.8], ['lowpass', 1600]], 0.09)); parts.push(swell(l.g, 0.09, 0.4, 3.3)); parts.push(sprinkle(() => blip(2400 + Math.random() * 900, 0.05, 0.008, 'triangle'), 2600)); break; }
        case 'sea': { const l = add(loopNoise('pink', [['lowpass', 1200]], 0.16)); parts.push(swell(l.g, 0.16, 0.85, 8)); break; }
        case 'forest': { add(loopNoise('pink', [['highpass', 1500], ['lowpass', 5000]], 0.025)); parts.push(sprinkle(() => { const f = 2600 + Math.random() * 2400; blip(f, 0.12, 0.018, 'sine', 1.3); setTimeout(() => blip(f * 1.1, 0.1, 0.014, 'sine', 0.8), 140); }, 3800)); break; }
        case 'rain': add(loopNoise('pink', [['highpass', 900], ['lowpass', inside ? 2400 : 7000]], inside ? 0.07 : 0.14)); parts.push(sprinkle(() => crack(inside ? 0.01 : 0.025), 380)); break;
        case 'storm': {
            add(loopNoise('pink', [['highpass', 700], ['lowpass', inside ? 2200 : 6500]], inside ? 0.09 : 0.18));
            const r = add(loopNoise('brown', [['lowpass', 120]], 0.0));
            parts.push(sprinkle(() => { const t = ctxA.currentTime; r.g.gain.cancelScheduledValues(t); r.g.gain.setValueAtTime(0, t); r.g.gain.linearRampToValueAtTime(inside ? 0.35 : 0.55, t + 0.4); r.g.gain.exponentialRampToValueAtTime(0.001, t + 5); }, 16000));
            break;
        }
        case 'wind': case 'snow': case 'blizzard': {
            const hard = name === 'blizzard';
            const l = add(loopNoise('brown', [['bandpass', hard ? 500 : 380, 0.6], ...muf], (hard ? 0.22 : name === 'snow' ? 0.06 : 0.12) * (inside ? 0.5 : 1)));
            parts.push(swell(l.g, (hard ? 0.22 : 0.1) * (inside ? 0.5 : 1), 0.8, hard ? 4 : 7));
            break;
        }
        case 'fog': add(loopNoise('brown', [['lowpass', 300], ...muf], 0.04)); break;
        case 'fire': add(loopNoise('brown', [['lowpass', 500]], 0.04)); parts.push(sprinkle(() => crack(0.03 + Math.random() * 0.04), 420)); break;
        case 'crickets': parts.push(sprinkle(() => { for (let k = 0; k < 3; k++) setTimeout(() => blip(4300 + Math.random() * 300, 0.04, 0.006, 'sine'), k * 60); }, 900)); break;
        default: break;
    }
    return { stop: () => parts.forEach(f => { try { f(); } catch { /* */ } }) };
}

export function update() {
    if (!A) return;
    const lv = level();
    if (lv === 'off' || !A.hasChat?.() || !A.settings().enabled) { fadeTo(0); return; }
    if (!ensure()) return;
    const sc = soundscape();
    const want = [sc.base, sc.weather === 'snow' ? 'snow' : sc.weather, sc.fire ? 'fire' : '', sc.crickets ? 'crickets' : ''].filter(Boolean);
    const sig = `${want.join('+')}|${sc.inside ? 'in' : 'out'}`;
    if (sig !== cur) {
        cur = sig;
        const old = layers;
        layers = {};
        for (const w of want) layers[w] = makeLayer(w, sc.inside && w !== 'room' && w !== 'crowd' && w !== 'fire');
        setTimeout(() => Object.values(old).forEach(l => l.stop()), 1600);
    }
    const music = !!A.musicNow?.();
    fadeTo((lv === 'low' ? 0.45 : 0.9) * (music ? 0.35 : 1));
}

function fadeTo(v) {
    if (!ctxA || !master) return;
    const t = ctxA.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v, t + 1.5);
    if (v === 0) setTimeout(() => { if (level() === 'off') { Object.values(layers).forEach(l => l.stop()); layers = {}; cur = ''; } }, 1700);
}

// ───────────── запах места ─────────────

const SMELL_SYSTEM = `Ты пишешь для литературной ролевой на русском. Дай запах и звук этого места прямо сейчас — одной строкой, конкретно и неочевидно (не «пахнет кофе»), 6–14 слов, без имён персонажей. Ответь только JSON: {"smell":"…","sound":"…"}`;

function M() {
    const cm = A.chatMeta();
    if (!cm.smell || typeof cm.smell !== 'object') cm.smell = {};
    return cm.smell;
}

let smellBusy = false;
/** Новое место — один раз спросить дешёвую модель, чем там пахнет и что слышно. */
export async function smellFor(loc, atm = '', force = false) {
    if (!cfg().smell || !loc) return null;
    const k = A.placeKey(loc);
    const have = M()[k];
    if (have && !force) return have;
    if (smellBusy) return have || null;
    smellBusy = true;
    try {
        const out = await A.askModel([{ role: 'system', content: SMELL_SYSTEM }, { role: 'user', content: `Место: ${A.locParts(loc).join(', ')}. Погода и время: ${atm || '—'}.` }], 200);
        const j = A.extractJson(out);
        if (!j?.smell) return have || null;
        const rec = { smell: String(j.smell).trim().slice(0, 140), sound: String(j.sound || '').trim().slice(0, 140), at: Date.now(), used: false };
        M()[k] = rec;
        A.saveMeta();
        return rec;
    } catch (e) { console.warn('[Life] запах места', e); return have || null; } finally { smellBusy = false; }
}

/** Модели — только один раз на место (когда пришли), чтобы не повторялось в каждом посте. */
export function smellPrompt(type) {
    if (!A?.hasChat?.() || !cfg().smell || type === 'quiet' || type === 'impersonate') return '';
    const loc = A.worldState().scene?.location || '';
    const rec = loc ? M()[A.placeKey(loc)] : null;
    if (!rec || rec.used) return '';
    if (type && type !== 'quiet') { rec.used = true; A.saveMeta(); }
    return `[Это место сейчас — запах: ${rec.smell}${rec.sound ? `; звук: ${rec.sound}` : ''}. Можно вплести штрихом, один раз, если к месту.]`;
}

export function smellAfterPost() {
    const st = A.worldState();
    const loc = st.scene?.location || '';
    if (!loc || M()[A.placeKey(loc)]) return;
    setTimeout(() => { smellFor(loc, st.scene?.atmosphere || '').catch(() => { /* */ }); }, 5000);
}

export function smellSceneHtml() {
    if (!cfg().smell) return '';
    const loc = A.worldState().scene?.location || '';
    const rec = loc ? M()[A.placeKey(loc)] : null;
    if (!rec) return '';
    return `<div class="lf-smell">${A.icon('sparkles')}<span>${esc(rec.smell)}${rec.sound ? `<small>${esc(rec.sound)}</small>` : ''}</span><button class="lf-iconbtn sm" data-act="am-smell" title="другое">${A.icon('refresh')}</button></div>`;
}

const esc = (v) => A.esc(v);

export async function ambClick(act, el) {
    if (!act.startsWith('am-')) return false;
    if (act === 'am-smell') {
        const st = A.worldState();
        await A.withBusy(el, async () => { const r = await smellFor(st.scene?.location || '', st.scene?.atmosphere || '', true); if (r) r.used = false; }, '…');
        A.updatePrompt();
        A.render();
        return true;
    }
    return false;
}
