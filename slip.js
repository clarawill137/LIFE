// Ляп-фикс. Летописец после поста сверяет его с тем, что Life знает точно: неизменное о персонажах
// (у Баки металлическая рука — левая), одежда из Гардероба, раны, срок из Зёрнышка, кто в сцене, время и место.
// Ляп — чип ⚠ под постом; тап — список: что не так и как правильно; «Исправить» меняет в посте только кривую фразу.

import { setMesText } from './mend.js';
import { hurtFacts } from './hurt.js';
import { armFact } from './arm.js';
import { pregnancies } from './zr.js';
import { canonText, eraLine, canonCfgHtml, canonInput, canonClick } from './canon.js';

let A = null;
export function initSlip(api) { A = api; }

const esc = (v) => A.esc(v);
const open = new Set();   // ключи постов с раскрытым списком

function cfg() {
    const s = A.settings();
    if (!s.slip || typeof s.slip !== 'object') s.slip = {};
    const c = s.slip;
    if (c.on === undefined) c.on = true;
    if (!c.facts || typeof c.facts !== 'object') c.facts = {};
    if (!c.seeded) seed(c);
    return c;
}
export const slipOn = () => cfg().on !== false;

/** Один раз: то, в чём модели путаются чаще всего. */
function seed(c) {
    let names = [];
    try { names = A.groupMembers().map(A.canonName); } catch { /* */ }
    if (!names.length) return;
    c.seeded = 1;
    const bucky = names.find(n => /баки|bucky|барнс|barnes/i.test(n));
    if (bucky && !c.facts[bucky]) c.facts[bucky] = 'Металлическая (вибраниумная) рука — ЛЕВАЯ; правая рука — живая.';
    A.saveSettings();
}

export function factsOf(who) { const c = cfg(); const k = Object.keys(c.facts).find(n => A.sameName(n, who)); return k ? String(c.facts[k] || '').trim() : ''; }

// ───────────── сверка для Летописца ─────────────

/** Как было ДО поста i: место, время, кто рядом (Horae из предыдущих сообщений). */
function before(i) {
    const chat = A.chatArr();
    const out = { loc: '', here: null, time: '', date: '', atm: '' };
    for (let j = i - 1; j >= 0; j--) {
        const h = chat[j]?.horae_meta;
        if (!h) continue;
        if (!out.loc && h.scene?.location) out.loc = h.scene.location;
        if (!out.here && Array.isArray(h.scene?.characters_present) && h.scene.characters_present.length) out.here = h.scene.characters_present.map(A.canonName);
        if (!out.time && h.timestamp?.story_time) out.time = h.timestamp.story_time;
        if (!out.date && h.timestamp?.story_date) out.date = h.timestamp.story_date;
        if (!out.atm && h.scene?.atmosphere) out.atm = h.scene.atmosphere;
        if (out.loc && out.here && out.time && out.atm) break;
    }
    return out;
}

function worn(who) {
    const w = A.ctx().chatMetadata?.wardrobe;
    if (!w?.chars) return '';
    for (const [n, st] of Object.entries(w.chars)) if (A.sameName(n, who)) return (st?.worn || []).map(x => x?.name).filter(Boolean).join(', ');
    return '';
}

function factsText(i) {
    const b = before(i);
    const user = A.canonName(A.ctx().name1);
    const cast = [];
    const add = (n) => { n = A.canonName(n); if (n && !cast.some(x => A.sameName(x, n))) cast.push(n); };
    add(user);
    for (const n of A.groupMembers()) add(n);
    const here = b.here || [];
    const L = [];
    for (const n of cast) {
        const bits = [];
        const f = factsOf(n);
        if (f) bits.push(`неизменное: ${f}`);
        if (!here.length || here.some(h => A.sameName(h, n))) {
            const w = worn(n);
            if (w) bits.push(`одет(а): ${A.cut(w, 180)}`);
            const h = hurtFacts(n);
            if (h) bits.push(`тело: ${A.cut(h, 220)}`);
            const ar = armFact(n, i);
            if (ar) bits.push(ar);
        }
        if (bits.length) L.push(`- ${n}: ${bits.join(' | ')}`);
    }
    try { for (const p of pregnancies()) L.push(`- ${p.mother}: беременна, ${p.label} — ${p.belly.ru}`); } catch { /* без Зёрнышка */ }
    if (here.length) L.push(`- В сцене до этого поста: ${here.join(', ')}${cast.filter(n => !here.some(h => A.sameName(h, n))).length ? `; не было: ${cast.filter(n => !here.some(h => A.sameName(h, n))).join(', ')}` : ''}`);
    const when = [b.date, b.time].filter(Boolean).join(', ');
    if (when || b.loc || b.atm) L.push(`- Было: ${[when, b.loc, b.atm].filter(Boolean).join(' · ')}`);
    // канон и эпоха
    try { const er = eraLine(); if (er) L.push(`- Эпоха: ${er}`); } catch { /* */ }
    try { const cn = canonText(); if (cn) L.push(`- Канон этой истории (жёсткие факты):\n${cn}`); } catch { /* */ }
    return L.join('\n');
}

const RULE = `
slip — ЛЯПЫ этого поста против «Сверки»: [{"q":"дословная цитата из поста с ляпом, 3–20 слов, без изменений","why":"что не так, 3–10 слов","fix":"та же цитата, исправленная минимально"}]. Ляп — только прямое противоречие сверке, которое сам пост не объясняет: перепутана рука (живая / металлическая) или сторона тела, протез по сверке снят — а в посте им что-то делают (и в посте его не надели), одежда не та и в посте не переодевались, рана забыта (бегает с ножевым в бедре без боли) или зажила слишком рано, живот и срок не те, говорит или действует тот, кого не было в сцене и кто в посте не пришёл, день вместо ночи. Переоделся, пришёл, рассвело, перевязали — в самом посте — не ляп. Ещё ляп — анахронизм по «Эпохе» (вещь, техника, слово или событие не своего времени; то, что ещё не случилось, — как прошлое) и расхождение с «Каноном» (текст прямо противоречит жёсткому факту: кто был мёртв или пылью, кто где был, кто кого знал и когда, даты, возраст); для них why начинай с «эпоха:» или «канон:». Персонаж может врать, ошибаться или не знать — это не ляп; ляп — только когда неверное утверждает сам текст. Стиль, сюжет, выдумки и мелочи, которых нет в сверке, — не ляп. Нет ляпов — [] (так почти всегда).`;

export function slipChron(i) {
    if (!A?.hasChat?.() || !slipOn() || !Number.isFinite(i)) return null;
    const facts = factsText(i);
    if (!facts) return null;
    return { key: '"slip": []', rule: RULE, input: `Сверка (что точно известно ДО этого поста; для поля slip):\n${facts}`, tokens: 200 };
}

// ───────────── после поста ─────────────

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Найти цитату в сыром тексте поста: дословно, без учёта пробелов, или через разметку между словами. */
export function locate(raw, q) {
    raw = String(raw || '');
    q = str(q).replace(/^[«"“„]+|[»"”]+$/g, '');
    if (q.length < 3) return null;
    let k = raw.indexOf(q);
    if (k >= 0) return { from: q, exact: true };
    const words = q.split(/\s+/).map(w => w.replace(/^[«"“„(*_]+|[»"”)*_.,!?…:;]+$/g, '')).filter(Boolean);
    if (!words.length) return null;
    const re = new RegExp(words.map(reEsc).join('[\\s*_«»"“”„,.!?…:;—–-]{1,6}'), 'i');
    const m = raw.match(re);
    return m ? { from: m[0], exact: !/[*_<>]/.test(m[0]) } : null;
}

export function slipAfterPost(i, j) {
    if (!slipOn()) return;
    const e = A.chronOf(i);
    const m = A.chatArr()[i];
    if (!e || !m) return;
    const list = (Array.isArray(j?.slip) ? j.slip : [])
        .map(x => ({ q: str(x?.q).slice(0, 300), why: str(x?.why).slice(0, 120), fix: str(x?.fix).slice(0, 360) }))
        .filter(x => x.q && x.why && x.fix && A.norm(x.q) !== A.norm(x.fix))
        .filter(x => locate(m.mes, x.q) || x.q.length > 12)
        .slice(0, 4);
    if (!list.length) { if (e.slip && !e.slip.list?.some(x => x.done)) { delete e.slip; A.saveMeta(); } return; }
    e.slip = { list, at: Date.now() };
    A.saveMeta();
    A.paintSoon?.();
    A.toast('warning', `${list.map(x => esc(x.why)).join('<br>')}<br><small>тапни — покажу, где</small>`, '⚠ Похоже на ляп', {
        timeOut: 9000, escapeHtml: false,
        onclick: () => { open.add(i); A.paintSoon?.(); document.querySelector(`#chat .mes[mesid="${i}"] .lf-slip`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
    });
}

// ───────────── правка ─────────────

const EDIT_SYSTEM = `Ты корректор. Тебе дают текст поста как есть (с разметкой) и ляп в нём. Исправь МИНИМАЛЬНО только это место: не трогай остальной текст, стиль и разметку (*курсив*, кавычки, теги оставь как были).
Ответь только JSON: {"from":"дословный кусок из текста — как есть, с разметкой, 3–40 слов","to":"он же, исправленный"}`;

async function fixOne(i, n) {
    const m = A.chatArr()[i];
    const e = A.chronOf(i);
    const it = e?.slip?.list?.[n];
    if (!m || !it || it.done) return false;
    const raw = String(m.mes || '');
    let hit = locate(raw, it.q);
    let from = hit?.exact ? hit.from : '';
    let to = from ? it.fix : '';
    if (from && from !== str(it.q).replace(/^[«"“„]+|[»"”]+$/g, '')) to = it.fix; // нашлась с другими пробелами — меняем её целиком
    if (!from) {
        const out = await A.askModel([{ role: 'system', content: EDIT_SYSTEM }, { role: 'user', content: `Ляп: ${it.why}. Было примерно: «${it.q}». Как надо: «${it.fix}».\n\nТекст поста:\n${A.cut(raw, 9000)}` }], 400);
        const j = A.extractJson(out);
        from = str(j?.from);
        to = str(j?.to);
        if (!from || !to || !raw.includes(from)) throw new Error('не нашла это место в посте — поправь руками');
    }
    const ok = await setMesText(i, raw.replace(from, to));
    if (!ok) throw new Error('пост не поменялся');
    const e2 = A.chronOf(i) || e;
    const it2 = e2.slip?.list?.[n] || it;
    it2.done = true;
    it2.orig = [from, to];
    A.saveMeta();
    return true;
}

async function undoOne(i, n) {
    const m = A.chatArr()[i];
    const it = A.chronOf(i)?.slip?.list?.[n];
    if (!m || !it?.orig) return false;
    const [from, to] = it.orig;
    if (!String(m.mes).includes(to)) throw new Error('это место уже переписано');
    await setMesText(i, String(m.mes).replace(to, from));
    const it2 = A.chronOf(i)?.slip?.list?.[n] || it;
    it2.done = false;
    delete it2.orig;
    A.saveMeta();
    return true;
}

// ───────────── в чате ─────────────

const keyOf = (i) => `${i}:${A.hash(A.chatArr()[i]?.mes || '')}`;

/** «Вкус»: применить готовые правки без тапа — только те, что находятся в тексте точно (без запроса к модели). */
export async function slipAuto(i) {
    if (!slipOn() || busy.has(i)) return 0;
    const e = A.chronOf(i);
    const m = A.chatArr()[i];
    const live = (e?.slip?.list || []).map((x, n) => ({ x, n })).filter(({ x }) => !x.off && !x.done && x.q && x.fix);
    if (!m || !live.length) return 0;
    busy.add(i);
    let n = 0;
    try {
        for (const { x, n: k } of live) {
            const hit = locate(String(A.chatArr()[i]?.mes || ''), x.q);
            if (!hit?.exact) continue;
            try { if (await fixOne(i, k)) n++; } catch { /* останется чипом */ }
        }
    } finally { busy.delete(i); }
    if (n) A.saveMeta();
    return n;
}

export function paintSlip(el, id) {
    const old = el.querySelector(':scope .lf-slip');
    const rec = slipOn() ? A.chronOf(id)?.slip : null;
    const list = (rec?.list || []).map((x, n) => ({ ...x, n })).filter(x => !x.off);
    const live = list.filter(x => !x.done);
    const isOpen = open.has(id);
    if (!list.length || (!live.length && !isOpen)) { old?.remove(); return; }
    const html = !isOpen
        ? `<div class="lf-slip lf-own"><button class="lf-slip-chip" data-act="sl-open" data-mes="${id}">⚠ <b>Ляп?</b> ${live.map(x => esc(x.why)).join(' · ')}</button></div>`
        : `<div class="lf-slip lf-own open">
            <div class="lf-slip-h"><b>⚠ Сверка</b><button data-act="sl-open" data-mes="${id}">свернуть</button></div>
            ${list.map(x => `<div class="lf-slip-i${x.done ? ' done' : ''}">
                <div class="lf-slip-why">${esc(x.why)}</div>
                <div class="lf-slip-diff"><s>${esc(x.q)}</s><ins>${esc(x.fix)}</ins></div>
                <div class="lf-slip-b">${x.done
                    ? `<span>✓ поправлено</span><button data-act="sl-undo" data-mes="${id}" data-n="${x.n}">вернуть</button>`
                    : `<button class="main" data-act="sl-fix" data-mes="${id}" data-n="${x.n}">Исправить</button><button data-act="sl-no" data-mes="${id}" data-n="${x.n}">не ляп</button>`}</div>
            </div>`).join('')}
            ${live.length > 1 ? `<button class="lf-slip-all" data-act="sl-all" data-mes="${id}">Исправить всё (${live.length})</button>` : ''}
        </div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

const busy = new Set();

export async function slipClick(act, el) {
    if (act.startsWith('cn-')) return canonClick(act, el);
    if (!act.startsWith('sl-')) return false;
    const i = Number(el.dataset.mes);
    const n = Number(el.dataset.n);
    const e = A.chronOf(i);
    const repaint = () => { A.paintSoon?.(); return true; };
    switch (act) {
        case 'sl-on': cfg().on = !!el.checked; A.saveSettings(); A.render?.(); return repaint();
        case 'sl-open': if (open.has(i)) open.delete(i); else open.add(i); return repaint();
        case 'sl-no': { const it = e?.slip?.list?.[n]; if (it) { it.off = true; A.saveMeta(); } return repaint(); }
        case 'sl-fix': case 'sl-all': case 'sl-undo': {
            if (busy.has(i)) return true;
            busy.add(i);
            el.disabled = true;
            el.textContent = act === 'sl-undo' ? 'возвращаю…' : 'правлю…';
            try {
                if (act === 'sl-undo') await undoOne(i, n);
                else if (act === 'sl-fix') await fixOne(i, n);
                else {
                    const list = e?.slip?.list || [];
                    for (let k = 0; k < list.length; k++) if (!list[k].done && !list[k].off) await fixOne(i, k);
                }
            } catch (err) {
                A.toast('warning', esc(String(err?.message || err)), '⚠ Ляп-фикс', { timeOut: 4000 });
            } finally { busy.delete(i); }
            return repaint();
        }
    }
    return false;
}

// ───────────── настройки: неизменное ─────────────

export function slipCfgHtml() {
    if (!A?.hasChat?.()) return '';
    const c = cfg();
    const names = [];
    const add = (n) => { n = A.canonName(n); if (n && !names.some(x => A.sameName(x, n))) names.push(n); };
    for (const n of A.groupMembers()) add(n);
    add(A.ctx().name1);
    for (const n of Object.keys(c.facts)) if (String(c.facts[n] || '').trim()) add(n);
    return `${A.sec('Ляп-фикс', slipOn() ? 'сверяет каждый пост' : 'выключен')}
    <label class="lf-switch"><input type="checkbox" data-act="sl-on" ${slipOn() ? 'checked' : ''}><span></span>Сверять посты (чип ⚠ под постом)</label>
    <div class="lf-sl-facts">${names.map(n => `<div class="lf-field"><label>${esc(n)} — неизменное</label><input type="text" data-in="sl-fact" data-name="${esc(n)}" value="${esc(factsOf(n))}" placeholder="что модели нельзя путать: рука, шрам, цвет глаз…"></div>`).join('')}</div>
    <div class="lf-hint">Ещё сверяется сама: одежда из Гардероба, раны, срок из Зёрнышка, кто был в сцене, время и место. Правит только кривую фразу — остальной пост не трогает.</div>
    ${canonCfgHtml()}`;
}

export function slipInput(el) {
    if (canonInput(el)) return true;
    if (el.dataset.in !== 'sl-fact') return false;
    const c = cfg();
    const name = el.dataset.name;
    const k = Object.keys(c.facts).find(n => A.sameName(n, name)) || name;
    const v = String(el.value || '').trim();
    if (v) c.facts[k] = v.slice(0, 300); else delete c.facts[k];
    A.saveSettings();
    return true;
}
