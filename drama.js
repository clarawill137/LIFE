// Драма-термостат. Летописец и так метит тон каждого поста — Life собирает из этого накал сцены (лента в Сцене).
// Термостат работает только вверх: драму не гасит никогда. Пока горячо — держит накал: никаких примирений,
// извинений и «всё хорошо» на ровном месте, обида и страх живут, пока их не прожили. Долго тихо — подбрасывает
// искру: трение, недосказанность, звонок не вовремя. Нежнятинку, ржаку, близость, «без событий» и взведённый твист
// не трогает. Сколько драмы хочется: тлеет / горит / пожар — от этого, как скоро после тишины придёт искра.

import { modesOn, onceArmed } from './modes.js';
import { moodNow } from './mood.js';
import { twistArmed } from './twists.js';

let A = null;
export function initDrama(api) { A = api; }

const esc = (v) => A.esc(v);
// [id, ярлык, через сколько тихих ответов искра]
const WANT = [['smolder', 'тлеет', 10], ['burn', 'горит', 7], ['blaze', 'пожар', 4]];
const HEAT = { danger: 5, fight: 5, tension: 4, drama: 3, rough: 3, passion: 2, comfort: 1, play: 1, tender: 0, fun: 0, calm: 0 };

function cfg() {
    const s = A.settings();
    if (!s.drama || typeof s.drama !== 'object') s.drama = {};
    const c = s.drama;
    if (c.on === undefined) c.on = true;
    if (!WANT.some(w => w[0] === c.want)) c.want = 'burn';
    return c;
}
export const dramaOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.drama || typeof cm.drama !== 'object') cm.drama = {};
    const d = cm.drama;
    if (!Number.isFinite(d.spark)) d.spark = -1;
    return d;
}

/** Накал ответа i по меткам Летописца: 0–6, или null — пост не разобран. */
export function heatOf(i) {
    const e = A.chronOf(i);
    const sc = e?.scene;
    if (!sc) return null;
    let h = HEAT[sc.mood] ?? 0;
    if (sc.bond === 2 && ['open', 'confess', 'mend'].includes(sc.btone)) h = Math.max(h, 2); // тяжёлый разговор — тоже жар
    return Math.min(6, h);
}

/** Какой ответ сейчас пишется. */
function targetOf(type) {
    const chat = A.chatArr();
    const last = chat[chat.length - 1];
    return (type === 'swipe' || type === 'continue') && last && !last.is_user && !last.is_system ? chat.length - 1 : chat.length;
}

/** Накал последних ответов до t: [{ i, h }] от старых к новым (только разобранные). */
export function heatSeries(t = A.chatArr().length, n = 24) {
    const chat = A.chatArr();
    const out = [];
    for (let i = Math.min(t, chat.length) - 1; i >= 0 && out.length < n; i--) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        const h = heatOf(i);
        if (h != null) out.push({ i, h });
    }
    return out.reverse();
}

/** Уровень сцены: среднее по последним ответам (свежие весомее), 0–6. */
export function dramaLevel(series = heatSeries()) {
    const tail = series.slice(-4);
    if (!tail.length) return 0;
    let s = 0; let w = 0;
    tail.forEach((x, k) => { const q = k + 1; s += x.h * q; w += q; });
    return s / w;
}

const levelWord = (v) => (v >= 4 ? 'пожар' : v >= 2.5 ? 'горит' : v >= 1.2 ? 'тлеет' : 'тихо');

/** Сколько последних ответов подряд было тихо (накал ≤ 1) и с какого поста тишина. */
function calm(series) {
    let n = 0;
    let from = -1;
    for (let k = series.length - 1; k >= 0; k--) { if (series[k].h > 1) break; n++; from = series[k].i; }
    return { n, from };
}

/** Нежность, близость, ржака, «без событий», твист — искру не подбрасываем. */
function guarded() {
    try { const on = modesOn() || []; if (on.includes('tender') || on.includes('laugh')) return 'режим'; } catch { /* */ }
    try { if (['calm', 'event'].includes(onceArmed())) return 'на один ответ'; } catch { /* */ }
    try { if (twistArmed()) return 'твист'; } catch { /* */ }
    try { const md = moodNow(); if (md?.intimOn || md?.after) return 'близость'; } catch { /* */ }
    try { const sc = A.chronOf(A.lastAiIndex())?.scene; if (sc?.bond === 2) return 'близость'; } catch { /* */ }
    return '';
}

function hot(series) {
    const last = series[series.length - 1];
    if (last && last.h >= 4) return true;
    try { const md = moodNow(); return ['fight', 'danger', 'tension'].includes(md?.manual || md?.auto); } catch { return false; }
}

/** Что сейчас делает термостат: { mode: 'hold' | 'spark' | '', streak, need, guard }. */
export function dramaState(type = 'normal') {
    const t = targetOf(type);
    const series = heatSeries(t);
    const d = M();
    const need = (WANT.find(w => w[0] === cfg().want) || WANT[1])[2];
    const c = calm(series);
    const guard = guarded();
    if (hot(series)) return { mode: 'hold', streak: c.n, need, guard, t };
    if (d.spark === t) return { mode: 'spark', streak: c.n, need, guard, t, again: true }; // свайп того же ответа
    if (d.hand && !guard) return { mode: 'spark', streak: c.n, need, guard, t, hand: true };
    // одна искра на тишину; не разгорелось — ещё одна через столько же тихих ответов
    const since = series.filter(x => x.i > d.spark).length;
    if (!guard && c.n >= need && (d.spark < c.from || since >= need)) return { mode: 'spark', streak: c.n, need, guard, t };
    return { mode: '', streak: c.n, need, guard, t };
}

const HOLD = '[Драма — держать накал: не сглаживай и не закрывай конфликт за персонажей. Никаких внезапных извинений, «всё хорошо» и примирений на ровном месте; злость, страх, обида и вина живут в теле, словах и паузах, пока их не прожили. Усилить можно — погасить нельзя.]';
const spark = (n) => `[Драма: ${n > 1 ? `уже ${n} ответов` : 'давно'} тихо — пусть в этом ответе проступит искра: недосказанность, ревнивый взгляд, звонок не вовремя, старая рана, чужая новость, спор о мелочи, за которой не мелочь. Не катастрофа и не твист — трение, которое потом можно раздуть.]`;

/** Заметка в конец промпта. consume — генерация пошла: искра израсходована. */
export function dramaPrompt(type, consume = false) {
    if (!A?.hasChat?.() || !dramaOn() || type === 'quiet' || type === 'impersonate' || type === 'continue') return '';
    const s = dramaState(type);
    if (s.mode === 'hold') return HOLD;
    if (s.mode !== 'spark') return '';
    if (consume) { const d = M(); d.spark = s.t; d.hand = false; A.saveMeta(); }
    return spark(s.streak);
}

// ───────────── Сцена ─────────────

function bars(series) {
    const W = 8;
    const G = 3;
    const H = 38;
    const col = (h) => (h >= 5 ? '#e0304a' : h >= 4 ? '#d0574b' : h >= 3 ? '#c97a4a' : h >= 2 ? '#b39b6c' : '#6c8fb3');
    const w = Math.max(1, series.length) * (W + G);
    return `<svg class="lf-dr-bars" viewBox="0 0 ${w} ${H}" preserveAspectRatio="none" aria-hidden="true">${series.map((x, k) => {
        const h = Math.max(3, Math.round((x.h / 6) * (H - 2)));
        return `<rect x="${k * (W + G)}" y="${H - h}" width="${W}" height="${h}" rx="2" fill="${col(x.h)}"><title>#${x.i}</title></rect>`;
    }).join('')}</svg>`;
}

export function dramaSceneHtml() {
    if (!A?.hasChat?.() || A.settings().enabled === false) return '';
    const c = cfg();
    const series = heatSeries();
    const lv = dramaLevel(series);
    const s = dramaOn() ? dramaState() : null;
    const d = M();
    const status = !dramaOn() ? 'выключен'
        : s.mode === 'hold' ? 'держу накал — не гашу'
        : s.mode === 'spark' ? (s.hand ? 'искра — в следующий ответ' : `искра в следующий ответ: тихо уже ${s.streak}`)
        : s.guard ? `тишину не трогаю: ${s.guard}`
        : s.streak ? `тихо ${s.streak} из ${s.need} — потом искра` : 'горит само';
    return `${A.sec('Накал', series.length ? levelWord(lv) : 'пока не размечен')}
    <section class="lf-dr">
        ${series.length ? bars(series) : ''}
        <div class="lf-dr-st">${A.icon('flame')}<span>${esc(status)}</span></div>
        <div class="lf-chips">${WANT.map(([k, l]) => `<button class="lf-chip${dramaOn() && c.want === k ? ' on' : ''}" data-act="dr-want" data-v="${k}">${l}</button>`).join('')}<button class="lf-chip${dramaOn() ? '' : ' on'}" data-act="dr-want" data-v="off">выкл</button></div>
        ${dramaOn() ? `<button class="lf-btn ghost${d.hand ? ' on' : ''}" data-act="dr-spark">${A.icon('flame')} ${d.hand ? 'Искра взведена — отменить' : 'Искра в следующий ответ'}</button>` : ''}
        <div class="lf-hint">Драму не гашу никогда: пока горячо — держу накал, долго тихо — подкидываю искру. Нежнятинку, ржаку, близость и «без событий» не трогаю.</div>
    </section>`;
}

export function dramaClick(act, el) {
    if (!act.startsWith('dr-')) return false;
    const c = cfg();
    if (act === 'dr-want') {
        if (el.dataset.v === 'off') c.on = false;
        else { c.on = true; c.want = el.dataset.v; }
        A.saveSettings();
    }
    if (act === 'dr-spark') { const d = M(); d.hand = !d.hand; A.saveMeta(); }
    try { A.updatePrompt?.(); } catch { /* */ }
    A.render?.();
    return true;
}
