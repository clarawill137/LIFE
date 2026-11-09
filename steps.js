// Прожитые моменты — лестницы по темам. Что однажды случилось впервые (Баки заплакал при ней, снял руку при ней,
// рассказал про Тео, первая ночь вместе…), закрывается ступенькой: дальше это норма, без отката к стеснению,
// и следующая ступень — только по ходу истории. Летописец замечает новые ступени после постов;
// «Найти прожитое во всём чате» — внимательный проход по всей истории (события Horae и моменты отношений).

let A = null;
export function initSteps(api) { A = api; }

const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.steps || typeof s.steps !== 'object') s.steps = {};
    if (s.steps.on === undefined) s.steps.on = true;
    return s.steps;
}
export const stepsOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.steps || typeof cm.steps !== 'object') cm.steps = {};
    const s = cm.steps;
    if (!Array.isArray(s.list)) s.list = [];
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const words = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
const similar = (a, b, k = 0.6) => { const x = new Set(words(a)), y = words(b); return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= k; };
const sameWho = (a, b) => a.length === b.length && a.every(n => b.some(m => A.sameName(n, m)));

function dateAt(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) { const d = chat[j]?.horae_meta?.timestamp?.story_date; if (d) return d; }
    return '';
}

/** Добавить ступень: в лестницу с этим id или с той же темой и теми же людьми; иначе — новая лестница. */
function addStep(r, i, src) {
    const s = M();
    const t = str(r?.t).slice(0, 120);
    const theme = str(r?.theme).slice(0, 40);
    const who = (Array.isArray(r?.who) ? r.who : []).map(str).filter(Boolean).map(A.canonName).slice(0, 3);
    if (!t || !who.length) return null;
    let L = s.list.find(x => x.id === str(r.id)) || s.list.find(x => sameWho(x.who, who) && theme && (similar(x.theme, theme, 0.5) || A.norm(x.theme) === A.norm(theme)));
    if (L && L.steps.some(st => similar(st.t, t, 0.55))) return null;
    if (!L) {
        if (!theme) return null;
        L = { id: `l${++s.seq}`, theme, who, steps: [], at: Date.now() };
        s.list.push(L);
    }
    const st = { t, mes: Number.isFinite(i) ? i : null, date: Number.isFinite(i) ? dateAt(i) : '', src };
    L.steps.push(st);
    L.steps.sort((a, b) => (a.mes ?? 1e9) - (b.mes ?? 1e9));
    return { L, st };
}

// ───────────── Летописец ─────────────

const RULE = `
steps — ВПЕРВЫЕ прожитое в ЭТОМ посте, что меняет норму между персонажами (дальше это уже можно, без отката к стеснению): [{"id":"l2 — лестница из «Прожитого», если тема та же; иначе пусто","theme":"тема, 2–5 слов: слёзы при ней / без руки / про ГИДРУ / ночёвки / секс","who":["имена"],"t":"что впервые случилось, 4–14 слов"}]. Только настоящие первые разы и новые ступени (заплакал при ней, снял руку при ней, рассказал про Тео, впервые остался на ночь, первое «люблю»), не повторы уже пройденного. Нечего — [] (так почти всегда).`;

function ladderLine(L) { const last = L.steps[L.steps.length - 1]; return `[${L.id}] ${L.who.map(n => A.shortName(n)).join('/')} — ${L.theme}: ${L.steps.length} ступ., последняя — ${last?.t || '—'}`; }

export function stepsChron() {
    if (!A?.hasChat?.() || !stepsOn()) return null;
    const rows = M().list.slice(-16).map(ladderLine);
    return { key: '"steps": []', rule: RULE, tokens: 110, input: `Прожитое (лестницы): ${rows.length ? rows.join('; ') : 'пока пусто'}` };
}

export function stepsAfterPost(i, j) {
    if (!stepsOn()) return;
    const s = M();
    for (const L of s.list) L.steps = L.steps.filter(st => !(st.src === 'post' && st.mes === i));
    s.list = s.list.filter(L => L.steps.length);
    const added = [];
    for (const r of (Array.isArray(j?.steps) ? j.steps : []).slice(0, 3)) { const x = addStep(r, i, 'post'); if (x) added.push(x); }
    A.saveMeta();
    if (added.length) A.toast('info', added.map(x => `${esc(x.L.who.map(n => A.shortName(n)).join(' и '))}: ${esc(x.st.t)}`).join('<br>'), '✦ Прожито — ступенька', { timeOut: 4000, escapeHtml: false });
}

// ───────────── заметка ─────────────

export function stepsPrompt(type) {
    if (!A?.hasChat?.() || !stepsOn() || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const user = A.canonName(A.ctx().name1);
    const list = M().list.filter(L => L.steps.length && L.who.every(n => !here.length || here.some(h => A.sameName(h, n)) || A.sameName(n, user)) && (!here.length || L.who.some(n => here.some(h => A.sameName(h, n)))));
    if (!list.length) return '';
    const rows = list.slice(-10).map(L => {
        const tail = L.steps.slice(-2).map(st => st.t).join(' → ');
        return `${L.who.map(n => A.shortName(n)).join(' и ')} — ${L.theme}: ${tail}`;
    });
    return `[Прожитое — это уже было и теперь норма между ними (без отката к стеснению, без «впервые» заново; хотят — повторяют): ${rows.join('; ')}. Следующая ступень в каждой теме — только по ходу истории, не торопить.]`;
}

// ───────────── вид: Связи → Прожитое ─────────────

const ui = { busy: false, prog: '' };

export function stepsHtml(who, other = '') {
    if (!A?.hasChat?.()) return '';
    const mine = M().list.filter(L => L.who.some(n => A.sameName(n, who)) && (!other || L.who.length === 1 || L.who.some(n => A.sameName(n, other))));
    return `${mine.length ? `<div class="lf-steps">${mine.map(L => `<section class="lf-ladder">
        <div class="lf-ladder-h"><b>${esc(L.theme)}</b><small>${esc(L.who.map(n => A.shortName(n)).join(' и '))} · ${L.steps.length} ${A.plural(L.steps.length, 'ступенька', 'ступеньки', 'ступенек')}</small><button data-act="stp-del" data-id="${L.id}" title="убрать лестницу">${A.icon('x')}</button></div>
        <ol>${L.steps.map((st, k) => `<li class="${k === L.steps.length - 1 ? 'last' : ''}"><i></i><span>${esc(st.t)}<small>${[st.date, Number.isFinite(st.mes) ? `#${st.mes}` : '', st.src === 'scan' ? 'нашла в истории' : st.src === 'me' ? 'своё' : ''].filter(Boolean).map(esc).join(' · ')}</small></span>${Number.isFinite(st.mes) ? `<button data-act="jump" data-mes="${st.mes}">${A.icon('chevR')}</button>` : ''}</li>`).join('')}</ol>
    </section>`).join('')}</div>` : '<div class="lf-empty small">Пока ни одной ступеньки. Летописец отметит, что случится впервые, — или найди прожитое по всей истории.</div>'}
    <div class="lf-actions">
        <button class="lf-btn" data-act="stp-scan">${A.icon('search')} ${ui.busy ? esc(ui.prog || 'Читаю историю…') : 'Найти прожитое во всём чате'}</button>
        <button class="lf-btn ghost" data-act="stp-add" data-name="${esc(who)}" data-other="${esc(other)}">${A.icon('plus')} Своё</button>
    </div>
    <div class="lf-hint">Ступенька закрывается навсегда: дальше это норма, модель не откатывает к «впервые». Следующую — только по ходу истории.</div>`;
}

// ───────────── проход по всей истории ─────────────

const SCAN_SYSTEM = `Ты внимательный читатель длинной ролевой истории (русский). Тебе дают хронику событий по номерам постов.
Найди ВПЕРВЫЕ прожитые моменты, которые меняют норму между персонажами (после них это уже «можно»): заплакал при ней, снял руку при ней, рассказал о прошлом (ГИДРА, Тео, Красная комната), впервые остался на ночь, первое «люблю», первая ссора всерьёз, первый раз в постели и новые ступени в нём, показал шрамы, позволил увидеть кошмар и т. п.
Группируй по темам-лестницам. Не выдумывай — только то, что есть в хронике.
Ответь только JSON: {"steps":[{"theme":"тема, 2–5 слов","who":["имена"],"t":"что впервые случилось, 4–14 слов","mes":номер_поста}]}`;

function chronicle() {
    const rows = [];
    const ev = A.horaeEvents?.() || [];
    for (const e of ev) if (e?.event?.summary) rows.push({ i: e.messageIndex, t: `${e.timestamp?.story_date ? `${e.timestamp.story_date}: ` : ''}${e.event.summary}` });
    try { for (const p of Object.values(A.relationsState?.() || {})) for (const m of p.moments || []) rows.push({ i: m.mes, t: `${p.a} и ${p.b}: ${m.text}` }); } catch { /* */ }
    if (rows.length < 20) {
        const chat = A.chatArr();
        for (let i = 0; i < chat.length; i++) { const m = chat[i]; if (m && !m.is_system && String(m.mes || '').length > 40) rows.push({ i, t: `${m.name}: ${A.cut(A.plainText(m.mes), 380)}` }); }
    }
    return rows.sort((a, b) => a.i - b.i);
}

async function scan(el) {
    const rows = chronicle();
    if (!rows.length) throw new Error('в истории пока нечего читать');
    const parts = [];
    let cur = [], size = 0;
    for (const r of rows) {
        const line = `#${r.i} ${r.t}`;
        if (size + line.length > 9000 && cur.length) { parts.push(cur); cur = []; size = 0; }
        cur.push(line); size += line.length + 1;
    }
    if (cur.length) parts.push(cur);
    if (parts.length > 3 && !confirm(`Прочитать всю историю: ${parts.length} запросов к модели Летописца. Продолжить?`)) return 0;
    let n = 0;
    const cm = A.chatMeta();
    for (let k = 0; k < parts.length; k++) {
        ui.prog = `Читаю ${k + 1} из ${parts.length}…`;
        if (el) el.textContent = ui.prog;
        const have = M().list.map(ladderLine).slice(-20).join('; ');
        const out = await A.askModel([{ role: 'system', content: SCAN_SYSTEM }, { role: 'user', content: `${have ? `Уже найдено (не повторяй, продолжай лестницы): ${have}\n\n` : ''}Хроника:\n${parts[k].join('\n')}` }], 1400);
        if (A.chatMeta() !== cm) return n;
        const j = A.extractJson(out);
        for (const r of Array.isArray(j?.steps) ? j.steps : []) { if (addStep(r, Number(r.mes), 'scan')) n++; }
        A.saveMeta();
    }
    return n;
}

export async function stepsClick(act, el) {
    if (!act.startsWith('stp-')) return false;
    const s = M();
    switch (act) {
        case 'stp-del': { const k = s.list.findIndex(L => L.id === el.dataset.id); if (k >= 0 && confirm('Убрать всю лестницу?')) s.list.splice(k, 1); A.saveMeta(); A.updatePrompt(); A.render(); return true; }
        case 'stp-scan': {
            if (ui.busy) return true;
            ui.busy = true;
            try {
                const n = await scan(el);
                A.toast('success', n ? `Нашла ступенек: ${n}` : 'Нового не нашлось', '✦ Прожитое', { timeOut: 3000 });
            } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Прожитое'); } finally { ui.busy = false; ui.prog = ''; }
            A.updatePrompt();
            A.render();
            return true;
        }
        case 'stp-add': {
            A.openSheet(`${A.icon('flag')} Прожитое`, `
                <div class="lf-field"><label>Тема</label><input type="text" data-in="stp-th" placeholder="слёзы при ней; без руки; про ГИДРУ"></div>
                <div class="lf-field"><label>Что впервые случилось</label><input type="text" data-in="stp-t" placeholder="заплакал у неё на плече"></div>
                <button class="lf-btn primary full" data-act="stp-save" data-name="${esc(el.dataset.name || '')}" data-other="${esc(el.dataset.other || '')}">${A.icon('check')} Ступенька</button>`);
            return true;
        }
        case 'stp-save': {
            const box = el.closest('.lf-sheet') || document;
            const theme = box.querySelector('[data-in="stp-th"]')?.value?.trim();
            const t = box.querySelector('[data-in="stp-t"]')?.value?.trim();
            if (!theme || !t) return true;
            addStep({ theme, t, who: [el.dataset.name, el.dataset.other].filter(Boolean) }, A.chatArr().length - 1, 'me');
            A.saveMeta(); A.updatePrompt(); A.closeSheet(); A.render();
            return true;
        }
    }
    return false;
}
