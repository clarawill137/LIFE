// Секреты с легендой. «Кто что знает» ведёт, кому что известно; здесь секрет — запись того же списка с тремя
// добавками: участники (кого он касается), кто знает — и ЛЕГЕНДА: что видят и думают те, кто не знает. Модель
// получает легенду рядом с «чего он не знает», а знающий — что это тайна и от кого он её держит.
// Секрет можно вписать руками, собрать из выделенного в посте куска (Летописец находит связанные места чата —
// лишнее отсеиваешь сама — и сам пишет, кто знает) или подтянуть из лорбука: запись, чьё название начинается
// с [СЕКРЕТ]. Тайны, которые Летописец заметил сам (Связи → Секреты), забираются сюда одним тапом.

import { str, arr, similar } from './hudkit.js';
import { knowStore, knowsFact } from './know.js';
import { activeBooks } from './lore.js';

let A = null;
export function initVault(api) { A = api; }
const esc = (v) => A.esc(v);

const TAG = /^\s*\[\s*(секрет|secret)\s*\]\s*[:—–-]?\s*/i;

const on = () => A.settings().know?.on !== false;
const everyone = () => { const u = A.canonName(A.ctx().name1); return [u, ...A.groupMembers().map(A.canonName)].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k); };
const npcs = () => { try { return arr(A.peopleList?.()).map(p => p?.name).filter(Boolean).slice(0, 14); } catch { return []; } };
const secrets = () => knowStore().facts.filter(f => f.sec);
const knowers = (f) => Object.keys(f.who || {});

/** Что модель получит про секрет для каждого из главных — строками, для предпросмотра. */
export function vaultPreview(f) {
    return everyone().map(n => {
        if (f.pub || knowsFact(f, n)) return { n, knows: true, t: 'знает — и знает, что это не для всех' };
        return { n, knows: false, t: f.legend ? `не знает; для него это выглядит так: ${f.legend}` : 'не знает: ссылаться и намекать не может' };
    });
}

// ───────────── заметка модели ─────────────

/** Знающему: какие тайны он держит и от кого. Незнающему легенду отдаёт «Кто что знает». */
export function vaultPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const list = secrets().filter(f => !f.pub && !f.off);
    if (!list.length) return '';
    const user = A.canonName(A.ctx().name1);
    const S = A.canonName(String(A.ctx().name2 || '').trim());
    const all = everyone();
    const here = (A.worldState()?.scene?.characters_present || []).map(A.canonName);
    const mains = all.filter(n => !A.sameName(n, user));
    const who = S && mains.some(n => A.sameName(n, S)) ? [S] : mains.filter(n => !here.length || here.some(h => A.sameName(h, n)));
    const out = [];
    for (const n of who) {
        const mine = list.filter(f => knowsFact(f, n)).slice(-4).map(f => {
            const blind = [...all, ...arr(f.parts)].filter((x, k, a) => a.findIndex(y => A.sameName(y, x)) === k).filter(x => !knowsFact(f, x)).map(A.shortName);
            return `${f.t}${blind.length ? ` (не знают: ${blind.join(', ')})` : ''}`;
        });
        if (mine.length) out.push(`${A.shortName(n)} — ${mine.join('; ')}`);
    }
    return out.length ? `[Тайны, которые они держат: ${out.join(' | ')}. Тайну берегут: не проговариваются, уводят разговор, держат лицо — раскрывают только сами и только если в сцене для этого есть причина.]` : '';
}

// ───────────── вид ─────────────

const row = (f) => `<div class="lf-vt${f.off ? ' off' : ''}">
    <button class="lf-vt-m" data-act="vt-edit" data-id="${f.id}">${A.icon('lock')}<span><b>${esc(f.t)}</b>
        ${f.legend ? `<small>для остальных: ${esc(f.legend)}</small>` : '<small class="warn">легенды нет — незнающим нечего видеть</small>'}
        <i>${knowers(f).length ? `знают: ${esc(knowers(f).map(A.shortName).join(', '))}` : 'пока не знает никто из героев'}${arr(f.parts).length ? ` · касается: ${esc(f.parts.map(A.shortName).join(', '))}` : ''}${f.lb ? ' · из лорбука' : ''}</i></span></button>
</div>`;

const tools = () => `<div class="lf-chips wrap"><button class="lf-chip" data-act="vt-new">${A.icon('plus')} Секрет</button><button class="lf-chip" data-act="vt-pull">${A.icon('book')} Из лорбуков</button></div>
    <div class="lf-hint">Из поста: выдели в чате кусок текста — во всплывшей плашке будет «🔒 в секрет». В лорбуке: назови запись «[СЕКРЕТ] …», в тексте можно строками «Знают: …», «Участники: …», «Легенда: …».</div>`;

/** Трекер в Сцене. */
export function vaultHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const list = secrets();
    return `${list.length ? `<div class="lf-vts">${list.slice().reverse().map(row).join('')}</div>` : '<div class="lf-empty small">Секретов с легендой пока нет.</div>'}${tools()}`;
}
export const vaultCount = () => { try { return secrets().filter(f => !f.pub && !f.off).length; } catch { return 0; } };

/** Связи → Секреты: секреты этой пары, а под ними — тайны, которые Летописец заметил сам (забрать тапом). */
export function vaultPairHtml(who, other) {
    if (!A?.hasChat?.() || !on()) return '';
    const touch = (f, n) => knowsFact(f, n) || arr(f.parts).some(p => A.sameName(p, n));
    const list = secrets().filter(f => touch(f, who) || touch(f, other));
    let found = [];
    try { found = arr(A.secretsState?.()).filter(x => arr(x.knows).some(k => A.sameName(k, who) || A.sameName(k, other)) && !secrets().some(f => similar(A, f.t, x.text, 0.7))); } catch { /* */ }
    return `${A.sec('Секреты с легендой', list.length ? String(list.length) : '')}
    ${list.length ? `<div class="lf-vts">${list.slice().reverse().map(row).join('')}</div>` : ''}
    ${tools()}
    ${found.length ? `${A.sec('Заметил Летописец', 'тап — забрать')}${found.slice(-8).reverse().map(x => `<button class="lf-secret" data-act="vt-take" data-mes="${x.mes}" data-t="${esc(x.text)}" data-w="${esc(arr(x.knows).join('|'))}">${A.icon('lock')}<span><b>Знает ${esc(arr(x.knows).map(n => A.shortName(A.canonName(n))).join(', ') || '—')}</b>${esc(x.text)}</span></button>`).join('')}` : ''}`;
}

let draft = null;   // секрет в листе правки, пока не сохранён

function editSheet(d) {
    draft = d;
    const all = everyone();
    const extra = [...npcs(), ...arr(d.parts), ...Object.keys(d.who || {})].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k && !all.some(x => A.sameName(x, n)));
    const pool = [...all, ...extra];
    const has = (list, n) => arr(list).some(x => A.sameName(x, n));
    const chips = (name, list) => pool.map(n => `<label class="lf-chip"><input type="checkbox" data-in="${name}" value="${esc(n)}"${has(list, n) ? ' checked' : ''}> ${esc(A.shortName(n))}</label>`).join('');
    const prev = d.id ? vaultPreview(d) : [];
    A.openSheet(`${A.icon('lock')} ${d.id ? 'Секрет' : 'Новый секрет'}`, `
        <div class="lf-field"><label>Что скрыто</label><textarea rows="3" data-in="vt-t" placeholder="Она встречалась с ним и никому не сказала">${esc(d.t || '')}</textarea></div>
        <div class="lf-field"><label>Кого касается <small>(участники)</small></label><div class="lf-chips wrap">${chips('vt-p', d.parts)}</div></div>
        <div class="lf-field"><label>Кто знает</label><div class="lf-chips wrap">${chips('vt-w', Object.keys(d.who || {}))}</div></div>
        <div class="lf-field"><label>Ещё имя <small>(через запятую — и в «касается», и отметить выше после сохранения)</small></label><input type="text" data-in="vt-more" placeholder="Виктор, доктор Рейн"></div>
        <div class="lf-field"><label>Легенда — что видят и думают те, кто не знает</label><textarea rows="3" data-in="vt-l" placeholder="Она задержалась в лаборатории — так она сказала, и так это выглядело">${esc(d.legend || '')}</textarea></div>
        <div class="lf-actions"><button class="lf-btn" data-act="vt-legend">${A.icon('sparkles')} Легенду — ИИ</button>${d.id ? `<button class="lf-btn ghost" data-act="vt-off" data-id="${d.id}">${A.icon('power')} ${d.off ? 'Вернуть в игру' : 'Придержать'}</button>` : ''}</div>
        ${d.src ? `<div class="lf-hint">${d.note ? esc(d.note) : ''}</div>` : ''}
        ${prev.length ? `${A.sec('Что уйдёт модели')}<div class="lf-vt-prev">${prev.map(p => `<div class="${p.knows ? 'k' : 'b'}">${A.ava(p.n, 'xs')}<span><b>${esc(A.shortName(p.n))}</b> ${esc(p.t)}</span></div>`).join('')}</div>` : ''}
        <button class="lf-btn primary full" data-act="vt-save">${A.icon('check')} ${d.id ? 'Сохранить' : 'Записать секрет'}</button>
        ${d.id ? `<div class="lf-actions"><button class="lf-btn ghost" data-act="vt-pub" data-id="${d.id}">${A.icon('eye')} Теперь знают все</button><button class="lf-btn ghost" data-act="vt-del" data-id="${d.id}">${A.icon('trash')} Убрать</button></div>` : ''}`);
}

function readSheet(box) {
    const t = str(box.querySelector('[data-in="vt-t"]')?.value, 300);
    const more = String(box.querySelector('[data-in="vt-more"]')?.value || '').split(/[,;]/).map(x => A.canonName(x.trim()) || x.trim()).filter(Boolean).slice(0, 6);
    const parts = [...[...box.querySelectorAll('[data-in="vt-p"]:checked')].map(x => x.value), ...more].filter((n, k, a) => a.findIndex(x => A.sameName(x, n)) === k);
    const who = [...box.querySelectorAll('[data-in="vt-w"]:checked')].map(x => x.value);
    return { t, parts, who, legend: str(box.querySelector('[data-in="vt-l"]')?.value, 400) };
}

function save(d, v) {
    const s = knowStore();
    let f = d.id ? s.facts.find(x => x.id === d.id) : null;
    if (!f) { f = { id: `k${++s.seq}`, who: {}, mes: Number.isFinite(d.mes) ? d.mes : -1, src: 'me' }; s.facts.push(f); }
    f.t = v.t; f.sec = true; f.parts = v.parts; f.legend = v.legend;
    if (d.lb) { f.lb = d.lb; f.lbSig = d.lbSig; f.edited = true; }
    // знающие: отмеченные остаются как были (с тем, как узнали), новые — «рассказали», снятые — уходят
    const next = {};
    for (const n of v.who) { const k = Object.keys(f.who || {}).find(x => A.sameName(x, n)); next[k || n] = k ? f.who[k] : { how: d.how?.[n] || 'told', mes: -1 }; }
    f.who = next;
    delete f.pub;
    return f;
}

// ───────────── из поста ─────────────

const STOP = new Set(['котор', 'когда', 'чтобы', 'этого', 'этому', 'только', 'после', 'перед', 'между', 'потом', 'тогда', 'также', 'может', 'будет', 'будут', 'очень', 'свой', 'своей', 'своего', 'своих', 'нибуд', 'сейча', 'тепер']);
const stems = (t) => [...new Set(A.norm(A.plainText(t)).replace(/[^a-zа-я0-9 ]/gi, ' ').split(' ').filter(w => w.length > 4).map(w => w.slice(0, 5)).filter(w => !STOP.has(w)))];

/** Места чата, которые перекликаются с куском: [{ i, name, score, text }] — по общим корням слов. */
export function vaultRelated(text, mes, max = 10) {
    const st = stems(text);
    if (st.length < 2) return [];
    const need = Math.max(2, Math.ceil(st.length * 0.25));
    const chat = A.chatArr();
    const out = [];
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (i === mes || !m || (A.isPost ? !A.isPost(m) : m.is_system)) continue;
        const plain = A.plainText(m.mes || '');
        const low = plain.toLowerCase().replace(/ё/g, 'е');   // той же длины, что plain: место совпадения — то же
        const hit = st.filter(w => low.includes(w));
        if (hit.length < need) continue;
        // с начала предложения, где первое совпадение
        const at = Math.max(0, low.indexOf(hit[0]));
        const from = Math.max(0, plain.lastIndexOf('.', Math.max(0, at - 2)) + 1);
        out.push({ i, name: m.name || '', score: hit.length, text: A.cut(plain.slice(from).trim(), 240) });
    }
    return out.sort((x, y) => y.score - x.score || y.i - x.i).slice(0, max).sort((x, y) => x.i - y.i);
}

/** Кто был в сцене к посту i (Horae пишет состав не в каждом посте — тянется от прошлого). */
function presentAt(i) {
    const chat = A.chatArr();
    for (let k = Math.min(i, chat.length - 1); k >= 0 && k > i - 40; k--) { const p = chat[k]?.horae_meta?.scene?.characters_present; if (Array.isArray(p) && p.length) return p.map(A.canonName).filter(Boolean); }
    return [];
}

let fromPost = null;   // { text, mes, rel }

function fromSheet() {
    const d = fromPost;
    if (!d) return;
    A.openSheet(`${A.icon('lock')} Секрет из поста #${d.mes}`, `
        <div class="lf-field"><label>Кусок из поста</label><textarea rows="4" data-in="vt-frag">${esc(d.text)}</textarea></div>
        ${A.sec('Связанные места', d.rel.length ? 'лишнее — сними' : '')}
        ${d.rel.length ? `<div class="lf-vt-rel">${d.rel.map((r, k) => `<label><input type="checkbox" data-in="vt-rel" value="${r.i}"${k >= d.rel.length - 6 ? ' checked' : ''}><span><b>#${r.i} · ${esc(A.shortName(r.name))}</b>${esc(r.text)}</span></label>`).join('')}</div>` : '<div class="lf-hint">Похожих мест в чате не нашлось — секрет соберётся по одному куску.</div>'}
        <button class="lf-btn primary full" data-act="vt-build">${A.icon('sparkles')} Собрать секрет</button>
        <div class="lf-hint">Летописец прочтёт кусок и отмеченные места, запишет суть, кого касается и кто знает (кто был рядом или кому сказали) и предложит легенду. Перед сохранением всё можно поправить.</div>`);
}

/** Выделили кусок в посте → лист «секрет из поста». */
export function vaultFromPost(text, mes) {
    const t = str(String(text || ''), 600);
    if (!t || !A?.hasChat?.()) return false;
    fromPost = { text: t, mes: Number(mes), rel: vaultRelated(t, Number(mes)) };
    if (A.ui?.open) fromSheet(); else { A.openHub?.('scene'); setTimeout(fromSheet, 280); }
    return true;
}

const BUILD = `Ты — Летописец литературной ролевой истории на русском. Автор выделил в посте кусок, где есть ТАЙНА, и отметил связанные места чата. Запиши её как секрет.
text — что именно скрыто, одной фразой до 25 слов, по фактам, без оценок. parts — кого тайна касается (участники). knows — кто из героев её знает: был рядом и видел или слышал, либо ему сказали; автора-рассказчика не пиши; кого в кусках нет рядом и кому не говорили — не знает. legend — что видят и думают те, кто НЕ знает: правдоподобное прикрытие из самой истории, одной фразой; если в кусках прикрытие уже прозвучало — возьми его.
Имена — как в списке персонажей. Ответь только JSON: {"text":"…","parts":["имя"],"knows":["имя"],"legend":"…"}`;

async function build(box) {
    const d = fromPost;
    if (!d) return;
    const frag = str(box.querySelector('[data-in="vt-frag"]')?.value, 600) || d.text;
    const picked = [...box.querySelectorAll('[data-in="vt-rel"]:checked')].map(x => Number(x.value));
    const rel = d.rel.filter(r => picked.includes(r.i));
    const chat = A.chatArr();
    const piece = (i, t) => `#${i} (${chat[i]?.is_user ? 'пост игрока' : `пишет ${chat[i]?.name || '?'}`}; в сцене: ${presentAt(i).map(A.shortName).join(', ') || 'не записано'}): ${t}`;
    const usr = [`Персонажи: ${[...everyone(), ...npcs()].join('; ')}`, `Игрок пишет за: ${A.canonName(A.ctx().name1)}`, `ВЫДЕЛЕННЫЙ КУСОК — ${piece(d.mes, frag)}`,
        rel.length ? `СВЯЗАННЫЕ МЕСТА:\n${rel.map(r => piece(r.i, r.text)).join('\n')}` : ''].filter(Boolean).join('\n\n');
    const j = await A.askJson([{ role: 'system', content: BUILD }, { role: 'user', content: usr }], 900, { check: (x) => !!str(x?.text, 10), what: 'Секрет из поста' });
    const who = arr(j.knows).map(n => A.canonName(str(n, 50))).filter(Boolean).slice(0, 10);
    editSheet({ t: str(j.text, 300), parts: arr(j.parts).map(n => A.canonName(str(n, 50)) || str(n, 50)).filter(Boolean).slice(0, 10), who: Object.fromEntries(who.map(n => [n, { how: 'saw', mes: d.mes }])),
        how: Object.fromEntries(who.map(n => [n, 'saw'])), legend: str(j.legend, 400), mes: d.mes, src: 'post-pick', note: `Собрано из поста #${d.mes}${rel.length ? ` и ещё ${rel.length} ${A.plural(rel.length, 'места', 'мест', 'мест')}` : ''}. Проверь, кто знает.` });
}

const LEGEND = `Ты — Летописец литературной ролевой истории на русском. Есть тайна и те, кто её не знает. Придумай легенду — что они видят и думают вместо правды: правдоподобно, из обстоятельств самой истории, без новых фактов, которые её ломают. Одна фраза до 25 слов. Ответь только JSON: {"legend":"…"}`;

// ───────────── из лорбуков ─────────────

/** Разобрать запись лорбука «[СЕКРЕТ] …»: суть и строки «Знают:», «Участники:», «Легенда:». */
export function parseSecretEntry(comment, content) {
    const title = String(comment || '').replace(TAG, '').trim();
    const take = { knows: null, parts: null, legend: '' };
    const rest = [];
    for (const line of String(content || '').split(/\r?\n/)) {
        const m = /^\s*(кто знает|знают|знает|участники|касается|кого касается|легенда|для остальных|прикрытие)\s*[:—–-]\s*(.*)$/i.exec(line);
        if (!m) { if (line.trim()) rest.push(line.trim()); continue; }
        const k = m[1].toLowerCase(), v = m[2].trim();
        const list = v.split(/[,;]/).map(x => x.trim().replace(/\.$/, '')).filter(Boolean);
        if (/зна/.test(k)) take.knows = /^(никто|—|-)?$/i.test(v) ? [] : list;
        else if (/участ|касает/.test(k)) take.parts = list;
        else take.legend = v;
    }
    const body = rest.join(' ');
    return { t: A.cut(body ? (title && !A.norm(body).includes(A.norm(title)) ? `${title}: ${body}` : body) : title, 300), knows: take.knows, parts: take.parts, legend: take.legend.slice(0, 400) };
}

/** Подтянуть секреты из подключённых лорбуков: новые — добавить, не правленные руками — обновить. */
export async function vaultPull() {
    const { W, books } = await activeBooks();
    if (!W) throw new Error('эта версия ST не отдаёт лорбуки расширениям');
    const s = knowStore();
    let era = '', byId = {};
    try { const cx = globalThis.SacredTimeline?.context?.(); era = String(cx?.era?.id || ''); for (const [name, p] of Object.entries(cx?.people || {})) if (p?.identity) byId[p.identity] = name; } catch { /* */ }
    let added = 0, updated = 0, seen = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        for (const e of Object.values(data?.entries || {})) {
            if (!e || e.disable || !TAG.test(String(e.comment || ''))) continue;
            // запись другой эпохи (метка ядра «Священный таймлайн») — не сюда
            if (era && Array.isArray(e.gc?.eras) && !e.gc.eras.map(String).includes(era)) continue;
            seen++;
            const p = parseSecretEntry(e.comment, e.content);
            if (!p.t) continue;
            // «Знают:» в тексте важнее; иначе — карта знания ядра (кто записан в gc.knows)
            const knows = p.knows || (e.gc?.knows && typeof e.gc.knows === 'object' ? Object.keys(e.gc.knows).map(id => byId[id]).filter(Boolean) : []);
            const lb = `${b}#${e.uid}`;
            const sig = A.hash(`${p.t}|${knows.join(',')}|${arr(p.parts).join(',')}|${p.legend}`);
            const old = s.facts.find(f => f.lb === lb);
            if (old) {
                if (old.edited || old.lbSig === sig) continue;
                old.t = p.t; old.legend = p.legend || old.legend || ''; old.parts = arr(p.parts).map(n => A.canonName(n) || n);
                old.who = Object.fromEntries(knows.map(n => A.canonName(n) || n).map(n => [n, old.who?.[n] || { how: 'told', mes: -1 }]));
                old.lbSig = sig;
                updated++;
                continue;
            }
            if (s.facts.some(f => f.sec && similar(A, f.t, p.t, 0.8))) continue;
            s.facts.push({ id: `k${++s.seq}`, t: p.t, sec: true, legend: p.legend, parts: arr(p.parts).map(n => A.canonName(n) || n), who: Object.fromEntries(knows.map(n => A.canonName(n) || n).map(n => [n, { how: 'told', mes: -1 }])), mes: -1, src: 'me', lb, lbSig: sig });
            added++;
        }
    }
    return { added, updated, seen, books: books.length };
}

// ───────────── клики ─────────────

export async function vaultClick(act, el) {
    if (!act.startsWith('vt-')) return false;
    const s = knowStore();
    const box = el.closest('.lf-sheet') || document;
    const f = s.facts.find(x => x.id === el.dataset.id);
    const done = () => { A.saveMeta(); A.updatePrompt(); A.paintSoon?.(); A.render(); };
    switch (act) {
        case 'vt-new': editSheet({ t: '', parts: [], who: {}, legend: '' }); return true;
        case 'vt-edit': if (f) editSheet(f); return true;
        case 'vt-take': {
            const who = String(el.dataset.w || '').split('|').map(n => A.canonName(n)).filter(Boolean);
            const mes = Number(el.dataset.mes);
            editSheet({ t: str(el.dataset.t, 300), parts: who, who: Object.fromEntries(who.map(n => [n, { how: 'saw', mes: -1 }])), legend: '', mes: Number.isFinite(mes) ? mes : -1, src: 'chron', note: 'Тайну заметил Летописец. Допиши легенду — и незнающие получат, что им видно.' });
            return true;
        }
        case 'vt-save': {
            if (!draft) return true;
            const v = readSheet(box);
            if (!v.t) { A.toast('info', 'Напиши, что скрыто', '✦ Секреты'); return true; }
            save(draft, v);
            draft = null;
            A.closeSheet();
            done();
            return true;
        }
        case 'vt-legend': {
            const v = readSheet(box);
            if (!v.t) { A.toast('info', 'Сначала напиши, что скрыто', '✦ Секреты'); return true; }
            await A.withBusy(el, async () => {
                const blind = everyone().filter(n => !v.who.some(w => A.sameName(w, n)));
                const j = await A.askJson([{ role: 'system', content: LEGEND }, { role: 'user', content: `Тайна: ${v.t}\nКасается: ${v.parts.join(', ') || '—'}\nЗнают: ${v.who.join(', ') || 'никто'}\nНе знают: ${blind.join(', ') || '—'}${v.legend ? `\nЧерновик легенды автора (улучши, не ломая): ${v.legend}` : ''}` }], 400, { check: (x) => !!str(x?.legend, 5), what: 'Легенда' });
                const ta = box.querySelector('[data-in="vt-l"]');
                if (ta?.isConnected) ta.value = str(j.legend, 400);
            }, 'Думаю…');
            return true;
        }
        case 'vt-off': if (f) { f.off = !f.off; A.closeSheet(); done(); } return true;
        case 'vt-pub': if (f) { f.pub = true; A.closeSheet(); done(); } return true;
        case 'vt-del': if (f) { s.facts = s.facts.filter(x => x !== f); A.closeSheet(); done(); } return true;
        case 'vt-build': await A.withBusy(el, () => build(box), 'Читаю…'); return true;
        case 'vt-pull': {
            await A.withBusy(el, async () => {
                const r = await vaultPull();
                done();
                A.toast(r.added || r.updated ? 'success' : 'info', r.seen ? `Записей [СЕКРЕТ]: ${r.seen} · новых ${r.added}, обновлено ${r.updated}` : `В подключённых лорбуках (${r.books}) нет записей с названием «[СЕКРЕТ] …»`, '✦ Секреты', { timeOut: 4500 });
            }, 'Читаю лорбуки…');
            return true;
        }
        default: return false;
    }
}
