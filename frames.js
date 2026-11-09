// Сны и флешбеки. Летописец метит пост: сон, флешбек, воспоминание или видение — целиком или кусок
// (сон в начале и пробуждение, воспоминание в конце). В чате такой кусок выглядит иначе: сон — дымка и мягкие
// края, флешбек — сепия, зерно плёнки и перфорация, воспоминание — выцветшее, видение — холодный двоящийся свет.
// Метка над постом — тап меняет вид по кругу; в карточке Летописца поста — выбрать или убрать.

let A = null;
export function initFrames(api) { A = api; }

const esc = (v) => A.esc(v);
export const FRAMES = [['dream', 'сон', 'moon'], ['flashback', 'флешбек', 'film'], ['memory', 'воспоминание', 'clock'], ['vision', 'видение', 'eye']];
const frameById = (k) => FRAMES.find(f => f[0] === k) || null;

function cfg() {
    const s = A.settings();
    if (!s.frames || typeof s.frames !== 'object') s.frames = {};
    if (s.frames.on === undefined) s.frames.on = true;
    return s.frames;
}
export const framesOn = () => cfg().on !== false;

// ───────────── Летописец ─────────────

export function framesChron() {
    if (!framesOn() || !A.hasChat()) return null;
    return {
        key: '"frame": {"kind":"","when":"","part":"all","from":"","until":""}',
        rule: `

frame — вид этого поста, если в нём есть сон, флешбек (сцена из прошлого, разыгранная как сейчас), воспоминание (персонаж вспоминает, текст уходит в прошлое) или видение (галлюцинация, наведённое, пророческое): kind — dream | flashback | memory | vision, иначе "". when — когда это было, 1–4 слова (1943, детство, Красная комната) или "". part — "all", если так весь пост или почти весь; "start" — так начало поста, а потом настоящее (проснулся, очнулся) — тогда until: первые 3–6 слов абзаца, с которого снова настоящее; "end" — так конец поста — тогда from: первые 3–6 слов абзаца, с которого начинается. Слова — ровно как в тексте поста.`,
        tokens: 80,
    };
}

export function framesAfterPost(i, j) {
    if (!framesOn()) return;
    const e = A.chronOf(i);
    if (!e || e.frameManual) return;
    const f = j?.frame;
    const kind = typeof f === 'string' ? f : f?.kind;
    if (!frameById(kind)) { delete e.frame; return; }
    e.frame = {
        kind,
        when: String(f?.when || '').trim().slice(0, 40),
        part: ['all', 'start', 'end'].includes(f?.part) ? f.part : 'all',
        from: String(f?.from || '').trim().slice(0, 80),
        until: String(f?.until || '').trim().slice(0, 80),
    };
    A.saveMeta();
}

// ───────────── вид в чате ─────────────

const flat = (t) => A.norm(String(t || '').replace(/<[^>]+>/g, ' ')).replace(/[«»"“”'*_—–-]/g, ' ').replace(/\s+/g, ' ').trim();

/** Абзацы поста, к которым относится кадр (null — весь пост). */
function partParas(textEl, fr) {
    if (fr.part === 'all') return null;
    const ps = [...textEl.querySelectorAll(':scope > p, :scope > blockquote, :scope > div:not([class])')];
    if (ps.length < 2) return null;
    const q = flat(fr.part === 'start' ? fr.until : fr.from).split(' ').slice(0, 5).join(' ');
    if (!q) return null;
    const at = ps.findIndex(p => flat(p.textContent).startsWith(q) || flat(p.textContent).slice(0, 160).includes(q));
    if (at < 0) return null;
    return fr.part === 'start' ? ps.slice(0, at) : ps.slice(at);
}

export function paintFrame(el, id) {
    const e = framesOn() ? A.chronOf(id) : null;
    const fr = e?.frame && frameById(e.frame.kind) ? e.frame : null;
    const textEl = el.querySelector('.mes_text');
    const block = el.querySelector('.mes_block') || el;
    const sig = fr ? `${fr.kind}|${fr.part}|${fr.from}|${fr.until}|${fr.when}|${String(textEl?.textContent || '').length}` : '';
    if (el.dataset.lfFrame === sig) return;
    el.dataset.lfFrame = sig;
    for (const [k] of FRAMES) el.classList.remove(`lf-fr-${k}`);
    el.classList.remove('lf-fr', 'lf-fr-part');
    textEl?.querySelectorAll('.lf-fr-p').forEach(p => p.classList.remove('lf-fr-p', 'first', 'last'));
    block.querySelector(':scope > .lf-frame')?.remove();
    if (!fr || !textEl) return;
    const f = frameById(fr.kind);
    const paras = partParas(textEl, fr);
    el.classList.add('lf-fr', `lf-fr-${fr.kind}`);
    if (paras?.length) {
        el.classList.add('lf-fr-part');
        paras.forEach((p, n) => { p.classList.add('lf-fr-p'); if (n === 0) p.classList.add('first'); if (n === paras.length - 1) p.classList.add('last'); });
    }
    const label = document.createElement('div');
    label.className = `lf-frame lf-frame-${fr.kind}`;
    label.innerHTML = `<button data-act="fm-cycle" data-mes="${id}" title="Тап — сменить вид">${A.icon(f[2])}<span>${esc(f[1])}${fr.when ? ` · ${esc(fr.when)}` : ''}</span></button>`;
    textEl.before(label);
}

// ───────────── правка ─────────────

function setFrame(i, kind) {
    const e = A.chronOf(i);
    if (!e) return false;
    if (!frameById(kind)) { delete e.frame; e.frameManual = true; }
    else e.frame = { ...(e.frame || { when: '', part: 'all', from: '', until: '' }), kind, part: e.frame?.part || 'all' };
    if (frameById(kind)) e.frameManual = true;
    A.saveMeta();
    A.paintSoon?.();
    return true;
}

/** Строка «Вид поста» в карточке Летописца поста. */
export function frameRowHtml(i) {
    if (!framesOn()) return '';
    const cur = A.chronOf(i)?.frame?.kind || '';
    return `${A.sec('Вид поста', cur ? 'в чате выглядит иначе' : 'обычный')}
    <div class="lf-chips wrap">${[['', 'обычный', 'message'], ...FRAMES].map(([k, l, ic]) => `<button class="lf-chip${cur === k ? ' on' : ''}" data-act="fm-set" data-mes="${i}" data-v="${k}">${A.icon(ic)} ${esc(l)}</button>`).join('')}</div>`;
}

export function frameClick(act, el) {
    if (act === 'fm-cycle') {
        const i = Number(el.dataset.mes);
        const cur = A.chronOf(i)?.frame?.kind || '';
        const order = [...FRAMES.map(f => f[0]), ''];
        setFrame(i, order[(order.indexOf(cur) + 1) % order.length]);
        return true;
    }
    if (act === 'fm-set') { setFrame(Number(el.dataset.mes), el.dataset.v); A.render?.(); return true; }
    return false;
}
