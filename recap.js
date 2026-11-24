// «Ранее в …» — когда возвращаешься в чат после перерыва (по умолчанию — 4 часа). Два вида (Мир → Дни):
//  · письмо соавтора (0.77, по умолчанию; её слова 24.11: «как всплывающее письмо от соавтора — в чате, в котором я
//    долго не была, напоминало, что за сцена, основной сюжет текущий и о чём был последний пост»): где мы и что за
//    сцена, какая линия сейчас идёт, о чём последний пост и чей ход. Сразу видно то, что Life знает точно (дата,
//    место, кто рядом — Horae; сюжетка; кто написал последний пост), текст дописывает Летописец (или умная модель)
//    по своду истории, «Дням», нитям сцены и последним постам. Письмо ничего не пишет ни в чат, ни в его метаданные:
//    готовое лежит в памяти браузера до нового поста — открыть снова ничего не стоит.
//    Окно — <dialog> в верхнем слое, как письма Соавтора (0.68.2): обычным слоем на её iPhone оно уходило под чат.
//  · заставка, как в сериале: фон из последнего кадра, 3–4 строчки из «Дней», сюжетка, «сейчас».
// Вручную: Мир → Дни → «Ранее в…», Пульт → «Ранее в…», /life recap.

let A = null;
export function initRecap(api) { A = api; cfg(); hook(); }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const shown = new Set();     // чаты, где «Ранее в…» уже было за эту сессию

function cfg() {
    const s = A.settings();
    if (!s.recap || typeof s.recap !== 'object') s.recap = {};
    const c = s.recap;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.hours)) c.hours = 4;
    if (typeof c.title !== 'string') c.title = '';
    if (!['letter', 'splash'].includes(c.mode)) c.mode = 'letter';
    if (typeof c.call !== 'string') c.call = '';
    c.deep = !!c.deep;
    return c;
}
export const recapOn = () => cfg().on !== false;

function chatKey() { try { const c = A.ctx(); return String(c.getCurrentChatId?.() || c.chatId || c.groupId || ''); } catch { return ''; } }
const LS = (k) => `lf-seen:${k}`;
function lastSeen(k) { try { return Number(localStorage.getItem(LS(k))) || 0; } catch { return 0; } }
export function markSeen() { const k = chatKey(); if (!k) return; try { localStorage.setItem(LS(k), String(Date.now())); } catch { /* приватный режим */ } }

let hiddenAt = 0;
function hook() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { hiddenAt = Date.now(); markSeen(); return; }
        if (hiddenAt && Date.now() - hiddenAt > cfg().hours * 36e5) { shown.delete(chatKey()); setTimeout(() => maybeShow('back'), 600); }
    });
    try { window.addEventListener('pagehide', markSeen); } catch { /* */ }
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
    openRecap({ gap: Date.now() - last, why });
    markSeen();
    return true;
}

/** «Ранее в…» в выбранном виде: письмо соавтора или заставка. */
export function openRecap(o = {}) { return cfg().mode === 'splash' ? showRecap(o) : openLetter(o); }

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

// ───────────── письмо соавтора ─────────────

const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
const user = () => A.canonName(A.ctx().name1) || A.ctx().name1 || '';
const short = (n) => A.shortName(A.canonName(n));
const isUserMsg = (m) => !!m?.is_user;
const isPost = (m) => (A.isPost ? A.isPost(m) : !!m && !m.is_system) && !!String(m?.mes || '').trim();

const TEXT_TAGS = /^(p|br|b|i|em|strong|u|s|span|div|blockquote|q|small|sup|sub|a|ul|ol|li|h[1-6]|mark|del|ins|font|center|section|article|header|footer|figure|figcaption|cite|abbr)$/i;
/** Текст поста без плашек GC, заметок, кубиков и картинок — проза, как её читают. Нет DOMParser — как у Летописца. */
function prose(mes) {
    const raw = String(mes || '');
    try {
        if (typeof DOMParser === 'function') {
            const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
            const root = doc.body?.firstElementChild || doc.body;
            root.querySelectorAll('[data-gc], details, summary, style, script, think, thinking, code, pre, img, table, hr, svg').forEach(n => n.remove());
            root.querySelectorAll('[style]').forEach(n => { if (/background|border/i.test(n.getAttribute('style') || '')) n.remove(); });
            // свои теги расширок и пресета (<preg>, <compass>, <horae…>, <art>…) — вон вместе с содержимым
            root.querySelectorAll('*').forEach(n => { if (n.isConnected && !TEXT_TAGS.test(n.tagName)) n.remove(); });
            const t = String(root.textContent || '').replace(/\s+/g, ' ').trim();
            if (t) return t;
        }
    } catch { /* */ }
    return String(A.plainText ? A.plainText(raw) : raw.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
/** Хвост прозы — последние фразы до n знаков, с начала фразы. */
function tailOf(mes, n = 320) {
    const t = prose(mes);
    if (t.length <= n) return t;
    const cut = t.slice(-n);
    const k = cut.search(/[.!?…»]\s+[«"А-ЯЁA-Z—-]/);
    return k >= 0 && k < n * 0.6 ? cut.slice(k + 1).trim() : cut.replace(/^\S*\s/, '');
}

/** Номер последнего поста (её или их) — без служебных строк. */
function lastPost() { const c = A.chatArr(); for (let k = c.length - 1; k >= 0; k--) if (isPost(c[k])) return k; return -1; }
/** Подпись письма: последний пост и его текст. Поменялся пост — письмо пишется заново. */
function sigOf() { const i = lastPost(); const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}` : ''; }

const LL = (k) => `lf-rl:${k}`;
function cached(k) { try { const v = JSON.parse(localStorage.getItem(LL(k)) || 'null'); return v && v.L ? v : null; } catch { return null; } }
function keep(k, v) { try { localStorage.setItem(LL(k), JSON.stringify(v)); } catch { /* полно или приватный режим — просто без памяти */ } }

/** Что Life знает точно — без модели: когда, где, кто рядом, сюжетка, чей последний пост. */
function facts() {
    const st = A.worldState() || {};
    const date = st.timestamp?.story_date || '';
    const time = st.timestamp?.story_time || '';
    const wd = A.weekday?.(date) || '';
    const when = [wd && date ? `${wd}, ${date}` : date, time].filter(Boolean).join(' · ');
    const where = st.scene?.location ? A.placeName(st.scene.location) : '';
    const U = user();
    const who = (st.scene?.characters_present || []).map(n => A.canonName(n)).filter(Boolean);
    const arc = A.chatMeta()?.arc?.cur;
    const beats = Array.isArray(arc?.beats) ? arc.beats : [];
    const i = lastPost();
    const m = A.chatArr()[i];
    const by = m ? (isUserMsg(m) ? U : A.canonName(String(m.name || '').trim())) : '';
    return {
        when, where, weather: str(st.scene?.atmosphere),
        who: who.map(short),
        arc: arc?.title ? { title: str(arc.title), done: beats.filter(b => b?.done).length, all: beats.length, next: str(beats.find(b => !b?.done)?.t) } : null,
        i, by: by && !NARR.test(by) ? short(by) : by ? 'рассказчик' : '', mine: !!m && isUserMsg(m),
        tail: m ? tailOf(m.mes) : '',
        U: short(U) || 'твоя героиня',
    };
}

/** Свод истории — только целиком, последние периоды и незакрытое (люди и пары письму не нужны). */
function storyBrief() {
    let t = '';
    try { t = A.story?.ready?.() ? A.story.text({ who: ['—'], pairs: false, acts: true, world: true, max: 60000 }) : ''; } catch { t = ''; }
    if (!t) return '';
    const blocks = t.split(/\n\n/);
    const whole = blocks.find(b => b.startsWith('История целиком:')) || '';
    const acts = (blocks.find(b => b.startsWith('Периоды:')) || '').split('\n').slice(1).slice(-3);
    const open = blocks.find(b => b.startsWith('Незакрытое:')) || '';
    return [A.cut(whole, 2400), acts.length ? `Последние периоды:\n${acts.join('\n')}` : '', A.cut(open, 900)].filter(Boolean).join('\n');
}

const SYSTEM = (U, call) => `Ты — соавтор игрока в ролевой истории. Игрок пишет за ${U}, остальных ведёт модель. Игрок давно не заходил в эту историю — напиши ему короткое письмо «Ранее в…», чтобы он с порога вспомнил, где остановились.
Что в письме:
— scene: где мы сейчас и что за сцена — когда, где, кто рядом, что между ними происходит и какое настроение;
— plot: какая большая линия сейчас идёт — к чему всё движется и что висит нерешённым; одна-две главные нити, а не перечень всего;
— last: о чём был последний пост — кто его написал, что сделал или сказал и на чём оборвал;
— turn: чей сейчас ход и чего он ждёт. Если последний пост не игрока — что в нём обращено к ${U} (вопрос, жест, просьба) и за что можно зацепиться. Если последний пост игрока — что ждёт ответа;
— ps: одна живая мелочь, которую легко забыть (нить сцены, вещь, обещание), или пусто.
Как писать:
— только по материалам: ничего не выдумывай, историю не продолжай, ходов не предлагай и не решай за персонажей, что они почувствуют;
— коротко: scene — 2–3 предложения, plot — 2–4, last — 2–3, turn — 1–2;
— имена — как в истории; ${U} — по имени; к игроку — на «ты»${call ? `, обращайся «${call}»` : ''};
— даты и время — как в материалах, не пересчитывай;
— тон живой и тёплый, как записка от друга-соавтора; без терапевтических слов и штампов, без markdown.
Ответь только JSON: {"hi":"одна фраза-заход, 4–14 слов","scene":"…","plot":"…","last":"…","turn":"…","ps":"… или пусто"}`;

function material(f, gap) {
    const chat = A.chatArr();
    const posts = [];
    for (let k = chat.length - 1, n = 0; k >= 0 && n < 6; k--) {
        const p = chat[k];
        if (!isPost(p)) continue;
        const t = prose(p.mes);
        if (!t) continue;
        const name = isUserMsg(p) ? `${f.U} (игрок)` : (NARR.test(String(p.name || '')) ? 'рассказчик' : short(p.name || ''));
        posts.unshift(`[#${k} ${name}] ${A.cut(t, n < 2 ? 3000 : 1200)}`);
        n++;
    }
    let days = '';
    try { days = (A.daysBrief?.() || '').split('\n').map(x => x.trim()).filter(Boolean).slice(-3).join('\n'); } catch { /* */ }
    const pulse = (() => { try { return A.chronOf?.(A.lastAiIndex?.() ?? -1) || null; } catch { return null; } })();
    const threads = Array.isArray(pulse?.threads) ? pulse.threads.filter(Boolean).slice(0, 5) : [];
    const want = Array.isArray(pulse?.want) ? pulse.want.filter(w => w?.who && w?.goal).slice(0, 4).map(w => `${short(w.who)} — ${w.goal}`) : [];
    const arc = f.arc ? `Сюжетка: «${f.arc.title}» — пройдено ${f.arc.done} из ${f.arc.all}${f.arc.next ? `; дальше: ${f.arc.next}` : ''}` : '';
    return [
        `Персонаж игрока: ${f.U}. История: «${titleOf()}».${gap ? ` Игрока не было ${gapWord(gap)}.` : ''}`,
        `Сейчас: ${[f.when, f.where, f.who.length ? `рядом: ${f.who.join(', ')}` : '', f.weather].filter(Boolean).join(' · ') || 'не записано'}`,
        storyBrief() ? `Свод всей истории:\n${storyBrief()}` : '',
        arc,
        days ? `Последние дни:\n${days}` : '',
        threads.length ? `Нити сцены: ${threads.join('; ')}` : '',
        want.length ? `Чего хотят сейчас: ${want.join('; ')}` : '',
        `Последние посты (старые → новые):\n${posts.join('\n\n')}`,
        f.i >= 0 ? `Последний пост — #${f.i}, ${f.mine ? `игрока (${f.U})` : `от ${f.by || 'модели'}`}.` : '',
    ].filter(Boolean).join('\n\n');
}

const W = { wrap: null, busy: false, k: '', sig: '', gap: 0, L: null, err: '', f: null };

/** Написать письмо. Ничего не пишет ни в чат, ни в метаданные — только в память браузера (последнее на чат). */
async function write({ force = false } = {}) {
    const k = chatKey();
    const sig = sigOf();
    if (!force) { const c = cached(k); if (c && c.sig === sig) return c.L; }
    const f = facts();
    const ask = cfg().deep && A.askDeepJson ? A.askDeepJson : A.askJson;
    const j = await ask([{ role: 'system', content: SYSTEM(f.U, str(cfg().call)) }, { role: 'user', content: material(f, W.gap) }], 1400,
        { what: 'Ранее в…', check: (x) => !!(str(x?.scene) || str(x?.last)) });
    const L = { hi: str(j?.hi).slice(0, 160), scene: str(j?.scene).slice(0, 700), plot: str(j?.plot).slice(0, 900), last: str(j?.last).slice(0, 700), turn: str(j?.turn).slice(0, 420), ps: str(j?.ps).slice(0, 260), at: Date.now() };
    keep(k, { sig, L });                                // чат сменился, пока писали, — письмо всё равно о том чате
    return chatKey() === k ? L : null;
}

const wait = (half = false) => `<i class="lf-rl-wait${half ? ' short' : ''}"></i>`;

function letterHtml() {
    const f = W.f || facts();
    const L = W.L;
    const busy = W.busy && !L;
    const img = bgImage();
    const para = (t, fb = '') => (t ? `<p>${esc(t)}</p>` : busy ? `${wait()}${wait(true)}` : fb);
    const meta = [f.when, f.where].filter(Boolean).join(' · ');
    const fbLast = f.tail ? `<p class="lf-rl-quote">«…${esc(f.tail)}»</p>` : '';
    const fbPlot = !L && !busy ? (() => {
        const rows = recapBeats().filter(b => b.when !== 'Сюжетка');
        return rows.length ? rows.map(b => `<p>${b.when ? `<b>${esc(b.when)}</b> — ` : ''}${esc(A.cut(b.text, 240))}</p>`).join('') : '';
    })() : '';
    return `<div class="lf-letter lf-rl" role="dialog" aria-label="Ранее в… — письмо соавтора">
        <button class="lf-letter-x" data-rl="close" aria-label="Закрыть">${A.icon('x')}</button>
        ${img ? `<div class="lf-rl-photo" style="background-image:url('${esc(img)}')"></div>` : ''}
        <div class="lf-rl-in">
            <div class="lf-letter-head">${A.icon('feather')}<span><b>Соавтор</b><small>${busy ? '<span class="lf-rl-pen">пишет</span> письмо…' : 'письмо тебе'}</small></span></div>
            <div class="lf-rl-kicker">Ранее в</div>
            <div class="lf-rl-title">${esc(titleOf())}…</div>
            ${W.gap ? `<div class="lf-rl-gap">тебя не было ${esc(gapWord(W.gap))}</div>` : ''}
            ${L?.hi ? `<p class="lf-rl-hi">${esc(L.hi)}</p>` : ''}
            <div class="lf-rl-sec"><small>Где мы</small>${meta || f.who.length ? `<span class="lf-rl-meta">${esc(meta)}${f.who.length ? `${meta ? '<br>' : ''}рядом: ${esc(f.who.join(', '))}` : ''}</span>` : ''}${para(L?.scene)}</div>
            <div class="lf-rl-sec"><small>Что сейчас в сюжете</small>${para(L?.plot, fbPlot)}${f.arc ? `<span class="lf-rl-arc">Сюжетка: ${esc(f.arc.title)}${f.arc.all ? ` · ${f.arc.done}/${f.arc.all}` : ''}${f.arc.next ? ` · дальше: ${esc(A.cut(f.arc.next, 80))}` : ''}</span>` : ''}</div>
            <div class="lf-rl-sec"><small>Последний пост${f.i >= 0 ? ` · ${f.mine ? 'твой' : esc(f.by || '')}` : ''}</small>${para(L?.last, fbLast)}</div>
            ${L?.turn ? `<div class="lf-rl-turn"><small>${f.mine ? 'Ждёт ответа' : 'Твой ход'}</small><p>${esc(L.turn)}</p></div>` : ''}
            ${L?.ps ? `<p class="lf-letter-ps">P.S. ${esc(L.ps)}</p>` : ''}
            ${W.err ? `<div class="lf-rl-err">Соавтор не дописал: ${esc(A.cut(W.err, 220))}</div>` : ''}
        </div>
        <div class="lf-letter-foot"><button data-rl="close">В чат ▸</button><button data-rl="again">${W.busy ? 'Пишу…' : `${A.icon('refresh')} Переписать`}</button></div>
        <div class="lf-letter-sign">— твой соавтор</div>
    </div>`;
}

function paint() { if (W.wrap?.isConnected) W.wrap.innerHTML = letterHtml(); }

export function closeLetter() {
    const w = W.wrap;
    W.wrap = null;
    if (!w) return;
    w.classList.remove('in');
    setTimeout(() => {
        try { if (w.open && typeof w.close === 'function') w.close(); } catch { /* */ }
        w.remove();
    }, 260);
}

async function fill(force) {
    if (W.busy) return;
    const k = chatKey();
    W.busy = true; W.err = '';
    if (force) W.L = null;
    paint();
    try {
        const L = await write({ force });
        if (chatKey() !== k) return;                    // ушла в другой чат — это письмо не про него
        if (L) W.L = L;
    } catch (e) {
        W.err = String(e?.message || e);
        console.warn('[Life] ранее в: письмо', e);
    } finally {
        W.busy = false;
        if (chatKey() === k) paint();
    }
}

/** Письмо соавтора «Ранее в…». gap — сколько её не было (для строки «тебя не было…»). */
export function openLetter({ gap = 0 } = {}) {
    if (!A?.hasChat?.() || typeof document === 'undefined' || !document.body?.append) return false;
    closeLetter();
    const k = chatKey();
    const c = cached(k);
    W.k = k; W.gap = gap; W.err = ''; W.f = facts();
    W.L = c && c.sig === sigOf() ? c.L : null;
    const wrap = document.createElement('dialog');
    wrap.className = 'lf-letter-wrap lf-rl-wrap';
    W.wrap = wrap;
    wrap.innerHTML = letterHtml();
    wrap.addEventListener('cancel', (ev) => { ev.preventDefault(); closeLetter(); });   // Esc и «назад»
    wrap.addEventListener('click', (e) => {
        const b = e.target.closest?.('[data-rl]');
        if (!b) { if (e.target === wrap) closeLetter(); return; }
        if (b.dataset.rl === 'close') { closeLetter(); return; }
        if (b.dataset.rl === 'again') fill(true);
    });
    document.body.append(wrap);
    let onTop = false;
    try { if (typeof wrap.showModal === 'function') { wrap.showModal(); onTop = wrap.matches(':modal'); } } catch (e) { console.warn('[Life] ранее в: верхний слой', e); }
    if (!onTop) wrap.setAttribute?.('open', '');
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
    setTimeout(() => { if (W.wrap === wrap) wrap.classList.add('in'); }, 120);   // вкладка не на экране — кадр мог не прийти
    if (!W.L) fill(false);
    return true;
}

/** Для проверок: что сейчас в письме. */
export const recapLetterState = () => ({ open: !!W.wrap, busy: W.busy, L: W.L, err: W.err, k: W.k });

// ───────────── настройки: Мир → Дни ─────────────

export function recapCfgHtml() {
    const c = cfg();
    return `<div class="lf-actions tight"><button class="lf-btn" data-act="rc-show">${A.icon(c.mode === 'splash' ? 'play' : 'feather')} Ранее в…</button></div>
    <label class="lf-switch"><input type="checkbox" data-act="rc-on" ${recapOn() ? 'checked' : ''}><span></span>«Ранее в…» после перерыва</label>
    <div class="lf-field"><label>Как напоминать</label><div class="lf-seg">${[['letter', 'Письмо соавтора'], ['splash', 'Заставка']].map(([k, l]) => `<button class="${c.mode === k ? 'on' : ''}" data-act="rc-mode" data-v="${k}">${l}</button>`).join('')}</div></div>
    <div class="lf-field two"><div><label>После перерыва, часов</label><input type="number" min="1" max="72" data-in="rc-hours" value="${c.hours}"></div><div><label>Название</label><input type="text" data-in="rc-title" value="${esc(c.title)}" placeholder="${esc(titleOf())}"></div></div>
    ${c.mode === 'letter' ? `<div class="lf-field"><label>Как соавтору к тебе обращаться</label><input type="text" data-in="rc-call" value="${esc(c.call)}" placeholder="имя или пусто"></div>
    <label class="lf-switch"><input type="checkbox" data-act="rc-deep" ${c.deep ? 'checked' : ''}><span></span>Писать умной моделью (дольше и дороже)</label>
    <div class="lf-hint">Письмо пишет Летописец по своду истории, «Дням», нитям сцены и последним постам. Ни в чат, ни модели не уходит; готовое помнится до нового поста.</div>` : ''}`;
}

export function recapClick(act, el) {
    if (!act.startsWith('rc-')) return false;
    if (act === 'rc-show') { A.closeHub?.(); setTimeout(() => openRecap({}), 250); return true; }
    if (act === 'rc-on') { cfg().on = !!el.checked; A.saveSettings(); return true; }
    if (act === 'rc-mode') { cfg().mode = el.dataset.v === 'splash' ? 'splash' : 'letter'; A.saveSettings(); A.render?.(); return true; }
    if (act === 'rc-deep') { cfg().deep = !!el.checked; A.saveSettings(); return true; }
    return false;
}

export function recapInput(el) {
    if (el.dataset.in === 'rc-hours') { cfg().hours = Math.max(1, Math.min(72, Number(el.value) || 4)); A.saveSettings(); return true; }
    if (el.dataset.in === 'rc-title') { cfg().title = String(el.value || '').trim().slice(0, 60); A.saveSettings(); return true; }
    if (el.dataset.in === 'rc-call') { cfg().call = String(el.value || '').trim().slice(0, 40); A.saveSettings(); return true; }
    return false;
}
