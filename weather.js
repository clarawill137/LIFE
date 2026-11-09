// Живая погода за чатом: снег, метель, дождь, гроза, туман — по погоде Horae; свет по времени суток
// (рассвет тёплый, вечер янтарный, ночь синяя). В помещении — «за окном»: реже и тише.
// Только CSS-частицы, без картинок и холстов (Safari на айфоне); вкладка в фоне — анимация на паузе.

let A = null;
export function initWeather(api) { A = api; document.addEventListener('visibilitychange', () => host()?.classList.toggle('paused', document.hidden)); }

function cfg() {
    const s = A.settings();
    if (!s.wx || typeof s.wx !== 'object') s.wx = {};
    if (!['live', 'calm', 'off'].includes(s.wx.level)) s.wx.level = 'live';
    return s.wx;
}
export const wxLevel = () => cfg().level;
export function setWxLevel(v) { cfg().level = ['live', 'calm', 'off'].includes(v) ? v : 'live'; A.saveSettings(); updateWeather(true); }
export function cycleWx() { setWxLevel({ live: 'calm', calm: 'off', off: 'live' }[cfg().level]); return cfg().level; }

const INDOOR = /квартир|дом\b|дома\b|комнат|кухн|спальн|гостин|ванн|душев|офис|кабинет|лаборат|\bбаз[аеуы]\b|штаб|бар\b|кафе|ресторан|отел|номер|машин|салон|самол[её]т|джет|госпитал|больниц|палат|подвал|бункер|склад|ангар|лифт|коридор|магазин|церк|зал\b|клуб|квинджет|кабин/i;

/** Погода из текста Horae: snow | blizzard | rain | storm | fog | '' */
export function wxKind(atm) {
    const t = String(atm || '').toLowerCase();
    if (/метел|вьюг|буран/.test(t)) return 'blizzard';
    if (/гроз|молни|гром/.test(t)) return 'storm';
    if (/снег|снеж|снегопад/.test(t) && !/без снега|снег не/.test(t)) return 'snow';
    if (/дожд|ливн|ливень|морос/.test(t) && !/без дождя/.test(t)) return 'rain';
    if (/туман|дымк|смог|мгла/.test(t)) return 'fog';
    return '';
}

function hourOf(time) { const m = String(time || '').match(/(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) : null; }
function tintOf(time) {
    const h = hourOf(time);
    if (h == null) return '';
    if (h >= 22 || h < 5) return 'night';
    if (h < 8) return 'dawn';
    if (h < 17) return '';
    if (h < 20) return 'evening';
    return 'dusk';
}

function host() { return document.getElementById('lf-wx'); }
function ensureHost() {
    let el = host();
    if (el) return el;
    el = document.createElement('div');
    el.id = 'lf-wx';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="lf-wx-tint"></i><div class="lf-wx-fx"></div>';
    const bg = document.getElementById('lf-bg') || document.getElementById('bg1');
    if (bg?.parentNode) bg.parentNode.insertBefore(el, bg.nextSibling); else document.body.prepend(el);
    if (document.hidden) el.classList.add('paused');
    return el;
}

const rnd = (a, b) => a + Math.random() * (b - a);

function particles(kind, inside, level) {
    const k = level === 'calm' ? 0.5 : 1;
    const n = Math.round(({ snow: 26, blizzard: 46, rain: 36, storm: 40 }[kind] || 0) * (inside ? 0.5 : 1) * k);
    const out = [];
    for (let i = 0; i < n; i++) {
        if (kind === 'snow' || kind === 'blizzard') {
            const big = kind === 'blizzard';
            out.push(`<i class="f" style="--x:${rnd(-5, 100).toFixed(1)}%;--s:${rnd(2, big ? 4.5 : 5.5).toFixed(1)}px;--o:${rnd(0.35, 0.9).toFixed(2)};--d:${rnd(big ? 3.5 : 8, big ? 7 : 16).toFixed(1)}s;--del:-${rnd(0, 16).toFixed(1)}s;--dx:${rnd(big ? 60 : -40, big ? 180 : 40).toFixed(0)}px"></i>`);
        } else {
            out.push(`<i class="r" style="--x:${rnd(-10, 105).toFixed(1)}%;--h:${rnd(14, 26).toFixed(0)}px;--o:${rnd(0.18, 0.45).toFixed(2)};--d:${rnd(0.55, 1.05).toFixed(2)}s;--del:-${rnd(0, 2).toFixed(2)}s"></i>`);
        }
    }
    if (kind === 'fog') out.push('<i class="fog a"></i><i class="fog b"></i>');
    if (kind === 'storm') out.push('<i class="flash"></i>');
    return out.join('');
}

let last = '';
export function updateWeather(force = false) {
    if (!A?.hasChat?.() || A.settings().enabled === false || cfg().level === 'off') { host()?.remove(); last = ''; return; }
    const st = A.worldState();
    const kind = wxKind(st.scene?.atmosphere);
    const tint = tintOf(st.timestamp?.story_time);
    const inside = INDOOR.test(String(st.scene?.location || ''));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const sig = `${kind}|${tint}|${inside}|${cfg().level}|${reduce}`;
    if (!force && sig === last && host()) return;
    last = sig;
    if (!kind && !tint) { host()?.remove(); return; }
    const el = ensureHost();
    el.className = ['wx', kind && `wx-${kind}`, tint && `t-${tint}`, inside && 'inside', document.hidden && 'paused'].filter(Boolean).join(' ');
    const fx = el.querySelector('.lf-wx-fx');
    fx.innerHTML = kind && !reduce ? particles(kind, inside, cfg().level) : '';
}

/** Подпись для пульта: что сейчас за окном. */
export function wxLabel() {
    const lv = cfg().level;
    if (lv === 'off') return 'Погода выкл';
    const k = A?.hasChat?.() ? wxKind(A.worldState().scene?.atmosphere) : '';
    const w = { snow: 'Снег', blizzard: 'Метель', rain: 'Дождь', storm: 'Гроза', fog: 'Туман' }[k] || 'Погода';
    return lv === 'calm' ? `${w} · тихо` : w;
}
