// Соавтор. После ответа модели иногда присылает игроку письмо: как её героиня могла бы поступить в следующем
// посте — два-три хода, разных по направлению, с репликой её голосом. Это не правило и не сюжет: письмо не уходит
// модели, не пишется ни в чат, ни в лорбуки, ни в «Узнавание» — живёт, пока открыта вкладка (последние три).
// Взяла — «В поле ввода» кладёт реплику в сообщение; не взяла — ничего не было.
// Материал: её персона, скрытое о ней (только соавтору), психика и связи из лорбуков, что в ней видят другие
// («Узнавание»), последние посты. Поводы узнать себя — то, что видят другие; «впервые»; где черта ломается; её же
// слова из чужих уст (самопересмотр у Блума) — как приглашение, не как вывод о ней.

import { cardText, loreFor } from './lore.js';
import { personaHidden } from './personas.js';
import { johariOf } from './johari.js';
import { push } from './push.js';
import { crossSame } from './names.js';

let A = null;
export function initCowriter(api) { A = api; cfg(); }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;
// письмо — раз в столько его ответов
export const PACE = { off: [0, 'Выкл'], rare: [5, 'Редко'], mid: [3, 'Иногда'], each: [1, 'Каждый ответ'] };

function cfg() {
    const s = A.settings();
    if (!s.cowriter || typeof s.cowriter !== 'object') s.cowriter = {};
    const c = s.cowriter;
    if (c.on === undefined) c.on = true;
    if (!PACE[c.pace]) c.pace = 'mid';
    c.deep = !!c.deep;
    return c;
}
const enabled = () => !!A && A.settings().enabled !== false && cfg().on !== false;
export const cowriterOn = () => enabled() && (PACE[cfg().pace]?.[0] || 0) > 0;

// всё только здесь, в памяти вкладки: письма нигде не записываются
const st = { chat: '', seen: new Set(), n: 0, busy: false, letters: [], open: null };

const user = () => A.canonName(A.ctx().name1) || A.ctx().name1 || '';
const isUser = (n) => !!n && A.sameName(n, A.ctx().name1);
const short = (n) => A.shortName(A.canonName(n));
const chatId = () => String(A.ctx().chatId || A.ctx().groupId || '');
const keyOf = (i) => { const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}` : ''; };
function inScene(n) { const h = (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); return !h.length || h.some(x => A.sameName(x, n)); }
function lastAi() { const c = A.chatArr(); for (let k = c.length - 1; k >= 0; k--) { const m = c[k]; if (m && !m.is_user && !m.is_system) return k; } return -1; }

function fresh() {
    const id = chatId();
    if (st.chat === id) return;
    st.chat = id; st.seen = new Set(); st.n = 0; st.letters = [];
    closeLetter();
}

/** После Летописца: свежий ответ модели — посчитать; пора — письмо пушем. Свайпы и перечитки не считаются. */
export function cowriterAfterPost(i) {
    try {
        if (!A?.hasChat?.() || !cowriterOn()) return;
        fresh();
        const m = A.chatArr()[i];
        if (!m || m.is_user || m.is_system || i !== lastAi() || st.seen.has(i)) return;
        st.seen.add(i);
        const U = user();
        if (!U || !inScene(U)) return;
        st.n += 1;
        if (st.n < PACE[cfg().pace][0] || st.busy) return;
        st.n = 0;
        write(i, { toPush: true }).catch(e => console.warn('[Life] соавтор', e));
    } catch (e) { console.warn('[Life] соавтор', e); }
}

const SYSTEM = (U) => `Ты — соавтор игрока в ролевой истории. Игрок пишет за ${U}, за остальных пишет модель. Время от времени ты присылаешь игроку короткое письмо: как ${U} могла бы поступить в следующем посте. Это не правило и не сюжет — ты ничего не решаешь и ничего не записываешь; игрок берёт или не берёт.
Как писать:
— два-три хода, разных по направлению, а не вариации одного: например, один тише, один острее, один неожиданный — такой, где в ней может открыться что-то новое о себе;
— каждый ход вырастает из последнего поста: его слова, жест, деталь, ситуация; общих советов не давай;
— держись её характера из материалов: стержень, голос, как она реагирует, что ей важно. Поводы узнать себя: то, что в ней видят другие, а она нет; то, что с ней впервые; место, где её черта ломается или оборачивается обратной; её же слова, вернувшиеся к ней из чужих уст;
— ход — это поступок, жест или реплика, а не чувство: не решай за неё, что она почувствует и поймёт;
— за других персонажей не пиши и их ответов не предсказывай;
— line — реплика её голосом, коротко, как сказала бы она; можно оставить пустой;
— без терапевтических слов и штампов; фразы, которые в материалах названы запрещёнными или заезженными, — никогда; её присказки — не в каждом письме и не больше одной.
Тон — живой, как от друга-соавтора: на «ты», коротко, без вступлений о себе.
Ответь только JSON: {"hi":"одна фраза-заход, 4–14 слов","ideas":[{"t":"название хода, 2–6 слов","what":"что она могла бы сделать, 1–2 предложения","why":"что это может открыть в ней или как ляжет на сцену, одно предложение","line":"её реплика или пусто"}],"ps":"короткая приписка или пусто"}`;

// из лорбуков — то, что про характер, голос и связи, а не всё подряд: сперва её собственные записи (имя в названии),
// потом — про пару и связи, потом остальное, пока влезает
const PSY = /(ядро|голос|core|voice|psych|психик|характер|personality|триггер|защит|конфликт|ценност|близост|быт|материнств|как читать)/i;
const TIES = /(dynamic|динамик|relationship|связь|codependen|созавис)/i;
const nameIn = (s, U) => A.norm(s).includes(A.norm(short(U))) || (String(s).match(/[A-ZА-ЯЁ][a-zа-яё]{2,}/g) || []).some(w => crossSame(w, short(U)));
async function loreOf(U, max = 9000) {
    const get = async (re, n) => { try { return await loreFor(U, { re, max: n }); } catch { return ''; } };
    const parts = (s) => (s ? s.split(/\n\n(?=### )/) : []);
    const seen = new Set();
    const list = [...parts(await get(PSY, 24000)), ...parts(await get(TIES, 40000))].filter(p => { const h = p.split('\n')[0]; if (seen.has(h)) return false; seen.add(h); return true; });
    const head = (p) => p.split('\n')[0];
    const mine = list.filter(p => nameIn(head(p), U));
    // про пару: сперва созависимость, потом динамика, потом остальные связи
    const rank = (p) => (/codependen|созавис/i.test(head(p)) ? 0 : /dynamic|динамик/i.test(head(p)) ? 1 : 2);
    const ties = list.filter(p => !mine.includes(p) && TIES.test(head(p))).sort((x, y) => rank(x) - rank(y));
    const rest = list.filter(p => !mine.includes(p) && !ties.includes(p));
    const out = [];
    let n = 0;
    const fill = (arr, cap) => { let m = 0; for (const p of arr) { if (n + p.length > max || m + p.length > cap) continue; out.push(p); n += p.length; m += p.length; } };
    fill(mine, Math.round(max * 0.55));     // её ядро, голос, триггеры…
    fill(ties, Math.round(max * 0.4));      // их связь
    fill(rest, max);                        // остальное — если осталось место
    return out.join('\n\n');
}

async function material(i, again) {
    const U = user();
    const chat = A.chatArr();
    const S = A.canonName(String(chat[i]?.name || '').trim());
    const card = cardText(U, 3500);
    let hid = '';
    try { hid = personaHidden(U) || ''; } catch { /* */ }
    const lore = await loreOf(U);
    const jo = johariOf(U).filter(x => (x.step || 0) < 3 && ['blind', 'unknown'].includes(x.kind)).slice(-12)
        .map(x => (x.kind === 'unknown'
            ? `— может случиться впервые: ${x.when || '…'}${x.t ? ` (может оказаться: ${x.t})` : ''}`
            : `— ${x.by ? short(x.by) : 'другие'} видит в ней: ${x.t}${x.tell ? ` (видно: ${x.tell})` : ''}`));
    const posts = [];
    for (let k = i, n = 0; k >= 0 && n < 6; k--) {
        const p = chat[k];
        if (!p || p.is_system) continue;
        const t = A.plainText(p.mes || '');
        if (!t) continue;
        posts.unshift(`[${p.is_user ? `${short(U)} (игрок)` : short(p.name || '')}] ${A.cut(t, k === i ? 3500 : 1400)}`);
        n++;
    }
    const prev = again ? (st.letters.find(l => l.i === i)?.ideas || []).map(x => x.t || x.what) : [];
    return {
        U, S, text: [
            `Персонаж игрока: ${U}. Последний ответ — от ${S && !NARR.test(S) ? short(S) : 'рассказчика'}.`,
            card ? `Кто она (персона):\n${card}` : '',
            hid ? `Скрытое о ней — только тебе, в историю не идёт:\n${A.cut(hid, 1500)}` : '',
            lore ? `Психика и связи (лорбуки):\n${lore}` : '',
            jo.length ? `Что в ней видят другие и чего с ней ещё не было («Узнавание»):\n${jo.join('\n')}` : '',
            `Последние посты (старые → новые):\n${posts.join('\n\n')}`,
            prev.length ? `В прошлом письме уже было (не повторяй): ${prev.join('; ')}` : '',
        ].filter(Boolean).join('\n\n'),
    };
}

/** Написать письмо к ответу i. Ничего не сохраняет, кроме трёх последних писем в памяти вкладки. */
export async function write(i, { toPush = false, again = false } = {}) {
    if (st.busy) return null;
    st.busy = true;
    const id = chatId();
    try {
        const key = keyOf(i);
        const { U, S, text } = await material(i, again);
        const ask = cfg().deep && A.askDeepJson ? A.askDeepJson : A.askJson;
        const j = await ask([{ role: 'system', content: SYSTEM(short(U)) }, { role: 'user', content: text }], 1600,
            { what: 'Соавтор', check: (x) => Array.isArray(x?.ideas) && x.ideas.some(y => str(y?.what) || str(y?.line)) });
        if (chatId() !== id) return null;                       // чат сменился, пока писали
        const ideas = (Array.isArray(j?.ideas) ? j.ideas : []).slice(0, 3)
            .map(x => ({ t: str(x?.t).slice(0, 80), what: str(x?.what).slice(0, 420), why: str(x?.why).slice(0, 260), line: str(x?.line).slice(0, 320) }))
            .filter(x => x.what || x.line);
        if (!ideas.length) return null;
        const L = { i, key, by: S, U, at: Date.now(), hi: str(j?.hi).slice(0, 160), ideas, ps: str(j?.ps).slice(0, 220) };
        st.letters = [L, ...st.letters.filter(x => x.i !== i)].slice(0, 3);
        if (toPush) push({ app: 'Соавтор', icon: 'feather', tint: '#e2c39a', title: `Письмо: ход ${short(U)}`, text: L.hi || ideas[0].t || ideas[0].what, ms: 9000, onTap: () => openLetter(L) });
        return L;
    } finally {
        st.busy = false;
        try { if (A.ui?.open) A.render(); } catch { /* */ }
    }
}

// ───────────── письмо ─────────────

function letterHtml(L) {
    const stale = keyOf(L.i) !== L.key;
    return `<div class="lf-letter" role="dialog" aria-label="Письмо соавтора">
        <button class="lf-letter-x" data-cw="close" aria-label="Закрыть">${A.icon('x')}</button>
        <div class="lf-letter-head">${A.icon('feather')}<span><b>Соавтор</b><small>ход ${esc(short(L.U))} · после #${L.i}${L.by && !NARR.test(L.by) ? `, ${esc(short(L.by))}` : ''}</small></span></div>
        ${stale ? '<div class="lf-letter-note">Ответ с тех пор поменялся — «Ещё варианты» напишут под новый.</div>' : ''}
        ${L.hi ? `<p class="lf-letter-hi">${esc(L.hi)}</p>` : ''}
        <ol class="lf-letter-ideas">${L.ideas.map((x, k) => `<li>
            ${x.t ? `<b>${esc(x.t)}</b>` : ''}${x.what ? `<p>${esc(x.what)}</p>` : ''}${x.why ? `<i>${esc(x.why)}</i>` : ''}
            ${x.line ? `<blockquote>${esc(x.line)}</blockquote><button class="lf-letter-take" data-cw="take" data-k="${k}">${A.icon('pencil')} В поле ввода</button>` : ''}
        </li>`).join('')}</ol>
        ${L.ps ? `<p class="lf-letter-ps">P.S. ${esc(L.ps)}</p>` : ''}
        <div class="lf-letter-foot"><button data-cw="more">${st.busy ? 'Пишу…' : 'Ещё варианты'}</button><button data-cw="close">Не надо</button></div>
        <div class="lf-letter-sign">— соавтор. Не правило: берёшь или не берёшь, нигде не записано.</div>
    </div>`;
}

function toInput(line) {
    const ta = document.getElementById('send_textarea');
    if (!ta) return false;
    const cur = String(ta.value || '');
    ta.value = cur.trim() ? `${cur.replace(/\s+$/, '')}\n${line}` : line;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    try { ta.focus(); } catch { /* */ }
    return true;
}

// 0.68.2: письмо — <dialog> в верхнем слое браузера (showModal), как окно промта (0.67.2), хаб и Гардероб. Обычным
// слоем (div, z-index 1000001) на её iPhone оно открывалось под чатом: видна была только шапка «Соавтор» над второй
// панелью таверны. Верхний слой не перекрыть ничьим z-index. Тосты на время письма — в нём, иначе их не видно.
let toastHome = null, toastWatch = null;
function toastsIn(d) {
    const grab = () => {
        const tc = document.getElementById('toast-container');
        if (!tc || tc.parentElement === d) return;
        toastHome = toastHome || tc.parentElement;
        d.append(tc);
    };
    grab();
    try { toastWatch = new MutationObserver(grab); toastWatch.observe(document.body, { childList: true }); } catch { /* */ }
}
function toastsOut(d) {
    try { toastWatch?.disconnect(); } catch { /* */ }
    toastWatch = null;
    try {
        const tc = document.getElementById?.('toast-container');
        if (tc && d?.contains?.(tc)) (toastHome && toastHome.isConnected ? toastHome : document.body).append(tc);
    } catch { /* */ }
    toastHome = null;
}

export function closeLetter() {
    const w = st.open;
    st.open = null;
    if (!w) return;
    toastsOut(w);
    w.classList.remove('in');
    setTimeout(() => {
        try { if (w.open && typeof w.close === 'function') w.close(); } catch { /* */ }
        w.remove();
    }, 260);
}

/** Открыть письмо (по умолчанию — последнее). */
export function openLetter(L = st.letters[0]) {
    if (!L || typeof document === 'undefined' || !document.body?.append) return false;
    closeLetter();
    const wrap = document.createElement('dialog');
    wrap.className = 'lf-letter-wrap';
    wrap.innerHTML = letterHtml(L);
    wrap.addEventListener('cancel', (ev) => { ev.preventDefault(); closeLetter(); });   // Esc и «назад»
    wrap.addEventListener('click', async (e) => {
        const b = e.target.closest?.('[data-cw]');
        if (!b) { if (e.target === wrap) closeLetter(); return; }
        const act = b.dataset.cw;
        if (act === 'close') { closeLetter(); return; }
        if (act === 'take') {
            const x = L.ideas[Number(b.dataset.k)];
            if (x?.line && toInput(x.line)) { A.toast('success', 'В поле ввода — дальше твоё', '✦ Соавтор', { timeOut: 1600 }); closeLetter(); }
            return;
        }
        if (act === 'more') {
            if (st.busy) return;
            b.textContent = 'Пишу…';
            try {
                const N = await write(L.i, { again: true });
                if (N && st.open === wrap) openLetter(N);
                else if (!N) { b.textContent = 'Ещё варианты'; A.toast('info', 'Нового не придумалось — попробуй ещё раз', '✦ Соавтор', { timeOut: 2500 }); }
            } catch (err) { b.textContent = 'Ещё варианты'; A.toast('warning', esc(String(err?.message || err)), '✦ Соавтор', { timeOut: 5000 }); }
        }
    });
    document.body.append(wrap);
    st.open = wrap;
    let onTop = false;
    try { if (typeof wrap.showModal === 'function') { wrap.showModal(); onTop = wrap.matches(':modal'); } } catch (e) { console.warn('[Life] Соавтор: верхний слой', e); }
    if (!onTop) wrap.setAttribute?.('open', '');   // старый браузер — обычным слоем, как до 0.68.2
    else toastsIn(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
    setTimeout(() => { if (st.open === wrap) wrap.classList.add('in'); }, 120);   // вкладка не на экране — кадр мог не прийти
    return true;
}

// ───────────── у персоны: Персонаж → Жизнь ─────────────

export function cowriterHtml(who) {
    if (!A?.hasChat?.() || !isUser(A.canonName(who))) return '';
    fresh();
    const c = cfg();
    const L = st.letters[0];
    return `${A.sec('Соавтор', 'письма тебе: как она могла бы поступить')}
    <div class="lf-hint">Иногда после его ответа приходит письмо: два-три хода, как ${esc(short(user()))} могла бы поступить, с репликой её голосом. Не правило: модели не уходит и нигде не записывается — берёшь или не берёшь. «В поле ввода» кладёт реплику в сообщение.</div>
    <div class="lf-actions"><button class="lf-btn" data-act="cw-now">${A.icon('feather')} ${st.busy ? 'Пишу…' : 'Написать сейчас'}</button>${L ? `<button class="lf-btn ghost" data-act="cw-open">${A.icon('mail')} Последнее письмо</button>` : ''}</div>
    <div class="lf-field"><label>Как часто письма</label><div class="lf-seg">${Object.entries(PACE).map(([k, v]) => `<button class="${c.pace === k ? 'on' : ''}" data-act="cw-pace" data-v="${k}">${v[1]}</button>`).join('')}</div></div>
    <label class="lf-switch"><input type="checkbox" data-act="cw-deep" ${c.deep ? 'checked' : ''}><span></span>Писать умной моделью (дольше и дороже)</label>`;
}

export async function cowriterClick(act, el) {
    if (!act.startsWith('cw-')) return false;
    const c = cfg();
    switch (act) {
        case 'cw-pace': c.pace = PACE[el.dataset.v] ? el.dataset.v : 'mid'; A.saveSettings(); A.render(); return true;
        case 'cw-deep': c.deep = !!el.checked; A.saveSettings(); return true;
        case 'cw-open': if (!openLetter()) A.toast('info', 'Писем пока нет', '✦ Соавтор', { timeOut: 1800 }); return true;
        case 'cw-now': {
            if (st.busy || !enabled()) return true;
            const i = lastAi();
            if (i < 0) { A.toast('info', 'Пока не на что отвечать', '✦ Соавтор', { timeOut: 1800 }); return true; }
            const p = write(i);
            A.render();
            try {
                const L = await p;
                if (L) openLetter(L); else A.toast('info', 'Не придумалось — попробуй ещё раз', '✦ Соавтор', { timeOut: 2500 });
            } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Соавтор', { timeOut: 5000 }); }
            return true;
        }
    }
    return false;
}

/** Для проверок: письма в памяти вкладки (ничего больше нигде нет). */
export const cowriterLetters = () => st.letters.slice();
