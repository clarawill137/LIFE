// «Ранее в …» — заставка, как в сериале, когда возвращаешься в чат после перерыва (по умолчанию — 4 часа):
// фон из последнего кадра с медленным наездом, 3–4 строчки «что было» из «Дней», текущая сюжетка
// и «сейчас: когда, где, кто рядом». Тап — дальше. Вручную: Мир → Дни → «Ранее в…» или /life recap.

let A = null;
export function initRecap(api) { A = api; hook(); }

const esc = (v) => A.esc(v);
const shown = new Set();     // чаты, где заставка уже была за эту сессию

function cfg() {
    const s = A.settings();
    if (!s.recap || typeof s.recap !== 'object') s.recap = {};
    const c = s.recap;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.hours)) c.hours = 4;
    if (typeof c.title !== 'string') c.title = '';
    return c;
}
export const recapOn = () => cfg().on !== false;

function chatKey() { try { const c = A.ctx(); return String(c.getCurrentChatId?.() || c.chatId || c.groupId || ''); } catch { return ''; } }
const LS = (k) => `lf-seen:${k}`;
function lastSeen(k) { try { return Number(localStorage.getItem(LS(k))) || 0; } catch { return 0; } }
export function markSeen() { const k = chatKey(); if (!k) return; try { localStorage.setItem(LS(k), String(Date.now())); } catch { /* приватный режим */ } }

let hiddenAt = 0;
function hook() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); markSeen(); return; }
        if (hiddenAt && Date.now() - hiddenAt > cfg().hours * 36e5) { shown.delete(chatKey()); setTimeout(() => maybeShow('back'), 600); }
    });
    window.addEventListener('pagehide', markSeen);
}

/** Открыли чат (или вернулись во вкладку): был ли перерыв дольше порога. */
export function maybeShow(why = 'open') {
    if (!A?.hasChat?.() || !recapOn() || !A.settings().enabled) return false;
    const k = chatKey();
    if (!k || shown.has(k)) { markSeen(); return false; }
    const last = lastSeen(k);
    const long = Date.now() - last > cfg().hours * 36e5;
    if (!last || !long) { markSeen(); return false; }
    if (A.chatArr().filter(m => m && !m.is_system).length < 6) { markSeen(); return false; }
    shown.add(k);
    showRecap({ gap: Date.now() - last, why });
    markSeen();
    return true;
}

function titleOf() {
    const c = cfg();
    if (c.title.trim()) return c.title.trim();
    try {
        const ctx = A.ctx();
        const g = ctx.groupId ? (ctx.groups || []).find(x => x.id === ctx.groupId) : null;
        return g?.name || ctx.name2 || 'этой истории';
    } catch { return 'этой истории'; }
}

function gapWord(ms) {
    const h = Math.round(ms / 36e5);
    if (h < 24) return `${h} ${A.plural(h, 'час', 'часа', 'часов')}`;
    const d = Math.round(h / 24);
    return `${d} ${A.plural(d, 'день', 'дня', 'дней')}`;
}

/** Что было: строчки «Дней» (последние 3), сюжетка и «сейчас». */
export function recapBeats() {
    const out = [];
    let brief = '';
    try { brief = A.daysBrief?.() || ''; } catch { /* */ }
    const days = brief.split('\n').map(x => x.replace(/^[•\-]\s*/, '').trim()).filter(Boolean);
    for (const d of days.slice(-3)) {
        const m = d.match(/^([^—]{3,40}?)\s+—\s+(.+)$/);
        out.push(m ? { when: m[1].trim(), text: m[2].replace(/\s*Открыто:.*$/, '').trim(), open: (m[2].match(/Открыто:\s*(.+)$/) || [])[1] || '' } : { when: '', text: d });
    }
    const arc = A.chatMeta().arc?.cur;
    if (arc?.title) {
        const nxt = (arc.beats || []).find(b => !b.done);
        out.push({ when: 'Сюжетка', text: `${arc.title}${nxt ? ` — дальше: ${nxt.t}` : ''}` });
    }
    return out.filter(x => x.text);
}

function bgImage() {
    try {
        const list = A.imgs?.() || [];
        if (list.length) return list[list.length - 1].src;
        const chs = A.chapters?.() || [];
        const last = chs[chs.length - 1];
        return last ? A.chapterCover?.(last) || '' : '';
    } catch { return ''; }
}

export function showRecap({ gap = 0 } = {}) {
    document.getElementById('lf-recap')?.remove();
    const beats = recapBeats();
    const st = A.worldState();
    const when = [A.weekday?.(st.timestamp?.story_date) || st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(', ');
    const where = st.scene?.location ? A.placeName(st.scene.location) : '';
    const who = (st.scene?.characters_present || []).map(n => A.shortName(A.canonName(n)));
    const img = bgImage();
    const el = document.createElement('div');
    el.id = 'lf-recap';
    el.innerHTML = `<div class="lf-rc-bg"${img ? ` style="background-image:url('${esc(img)}')"` : ''}></div><div class="lf-rc-shade"></div>
        <div class="lf-rc-in">
            <div class="lf-rc-k">Ранее в</div>
            <h1 class="lf-rc-h">${esc(titleOf())}…</h1>
            <div class="lf-rc-beats">${beats.length ? beats.map((b, n) => `<div class="lf-rc-b" style="--d:${0.9 + n * 0.75}s">${b.when ? `<small>${esc(b.when)}</small>` : ''}<p>${esc(A.cut(b.text, 260))}</p>${b.open ? `<em>Открыто: ${esc(A.cut(b.open, 140))}</em>` : ''}</div>`).join('') : `<div class="lf-rc-b" style="--d:.9s"><p>Последние дни ещё не собраны — Мир → Дни.</p></div>`}</div>
            <div class="lf-rc-now" style="--d:${1.2 + beats.length * 0.75}s">${when ? `<b>${esc(when)}</b>` : ''}${where ? ` · ${esc(where)}` : ''}${who.length ? `<br><small>рядом: ${esc(who.join(', '))}</small>` : ''}${gap ? `<br><small>тебя не было ${esc(gapWord(gap))}</small>` : ''}</div>
            <button class="lf-rc-go" style="--d:${1.5 + beats.length * 0.75}s">Продолжить ▸</button>
        </div>`;
    document.body.append(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    const close = () => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 600); };
    el.addEventListener('click', close);
    return el;
}

export function recapCfgHtml() {
    const c = cfg();
    return `<div class="lf-actions tight"><button class="lf-btn" data-act="rc-show">${A.icon('play')} Ранее в…</button></div>
    <label class="lf-switch"><input type="checkbox" data-act="rc-on" ${recapOn() ? 'checked' : ''}><span></span>Заставка «Ранее в…» после перерыва</label>
    <div class="lf-field two"><div><label>После перерыва, часов</label><input type="number" min="1" max="72" data-in="rc-hours" value="${c.hours}"></div><div><label>Название</label><input type="text" data-in="rc-title" value="${esc(c.title)}" placeholder="${esc(titleOf())}"></div></div>`;
}

export function recapClick(act, el) {
    if (!act.startsWith('rc-')) return false;
    if (act === 'rc-show') { A.closeHub?.(); setTimeout(() => showRecap({}), 250); return true; }
    if (act === 'rc-on') { cfg().on = !!el.checked; A.saveSettings(); return true; }
    return false;
}

export function recapInput(el) {
    if (el.dataset.in === 'rc-hours') { cfg().hours = Math.max(1, Math.min(72, Number(el.value) || 4)); A.saveSettings(); return true; }
    if (el.dataset.in === 'rc-title') { cfg().title = String(el.value || '').trim().slice(0, 60); A.saveSettings(); return true; }
    return false;
}
