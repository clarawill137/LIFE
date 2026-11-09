// Сюжетка: у истории — текущая линия из 3–5 битов (ключевых поворотов) с прогресс-баром в Сцене.
// Модель знает следующий бит и ведёт к нему в своём темпе; Летописец отмечает, когда бит достигнут.
// Чеховское ружьё: деталь закладывается заранее мимоходом (на один ответ), а когда сюжетка дошла до нужного бита —
// выстреливает. Закрыла сюжетку — Летописец предлагает 3 идеи, что дальше (тихая, напряжённая, неожиданная).

let A = null;
export function initArcs(api) { A = api; }

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';

function M() {
    const cm = A.chatMeta();
    if (!cm.arc || typeof cm.arc !== 'object') cm.arc = {};
    const a = cm.arc;
    if (!Array.isArray(a.past)) a.past = [];
    if (!Array.isArray(a.next)) a.next = [];
    if (!Number.isFinite(a.seq)) a.seq = 0;
    return a;
}
export const arcNow = () => (A?.hasChat?.() ? M().cur || null : null);

const aiCount = (from) => { const chat = A.chatArr(); let n = 0; for (let i = Math.max(0, from + 1); i < chat.length; i++) if (chat[i] && !chat[i].is_user && !chat[i].is_system) n++; return n; };
const doneCount = (a) => a.beats.filter(b => b.done != null).length;
const nextBeat = (a) => a.beats.find(b => b.done == null) || null;

// ───────────── контекст для модели-сценариста ─────────────

function context() {
    const st = A.worldState();
    const here = (st.scene?.characters_present || []).map(A.canonName);
    const chat = A.chatArr();
    let last = '';
    for (let i = chat.length - 1; i >= 0 && !last; i--) if (chat[i] && !chat[i].is_system) last = A.cut(A.plainText(chat[i].mes), 2200);
    const chips = [];
    for (let i = chat.length - 1; i >= 0 && chips.length < 14; i--) { const c = A.chronOf(i)?.chips?.[0]; if (c) chips.unshift(c); }
    const days = A.daysBrief?.() || '';
    const people = (A.peopleList?.() || []).slice(0, 24).map(p => `${p.name}${p.role ? ` — ${p.role}` : ''}`).join('; ');
    const secrets = (A.secretsState?.() || []).slice(-6).map(s => s.text).filter(Boolean).join('; ');
    const past = M().past.slice(-6).map(p => p.title).join('; ');
    return [`Игрок пишет за: ${userName()}`, here.length ? `В сцене: ${here.join(', ')}` : '', st.scene?.location ? `Место: ${st.scene.location}` : '',
        [st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).length ? `Время: ${[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' ')}` : '',
        days ? `Последние дни:\n${days}` : '', chips.length ? `Недавно:\n${chips.join('\n')}` : '', people ? `Известные люди: ${people}` : '', secrets ? `Тайны: ${secrets}` : '',
        past ? `Прошлые сюжетки (не повторять): ${past}` : '', last ? `Последний пост:\n${last}` : ''].filter(Boolean).join('\n\n');
}

const PLAN_SYSTEM = `Ты сценарист длинной литературной ролевой истории на русском. Игрок задаёт сюжетку — линию на ближайшее время.
Разложи её на 3–5 битов: ключевые повороты по порядку, каждый 6–14 слов, конкретно (кто, что делает, что меняется). Биты — направление, не сценарий: между ними живая игра; без финального «и жили счастливо»; не решай за игрока его поступки и чувства.
Добавь 1–2 чеховских ружья: деталь, которую надо заложить заранее, мимоходом (setup, 5–12 слов), и как она выстрелит потом (payoff, 5–12 слов), и к какому биту (beat — номер бита, не первого).
Опирайся на то, что уже есть в истории. Ответь только JSON: {"title":"2–5 слов","beats":["…"],"guns":[{"setup":"…","payoff":"…","beat":2}]}`;

const NEXT_SYSTEM = `Ты сценарист длинной литературной ролевой истории на русском. Сюжетка закрыта — предложи 3 идеи следующей: разных по тону — одна тихая (быт, близость, отдых), одна напряжённая (опасность, работа, прошлое догоняет), одна неожиданная.
Каждая — название 2–5 слов и одно предложение, о чём. Опирайся на открытые нити: последние дни, обещания, тайны, люди; не повторяй прошлые сюжетки; не решай за игрока.
Ответь только JSON: {"next":[{"title":"…","why":"…"}]}`;

function mkArc(j, title, by) {
    const a = M();
    const beats = (Array.isArray(j?.beats) ? j.beats : []).map(t => String(t || '').trim().slice(0, 160)).filter(Boolean).slice(0, 6).map(t => ({ t, done: null }));
    if (!beats.length) throw new Error('Летописец не прислал битов — попробуй ещё раз');
    const guns = (Array.isArray(j?.guns) ? j.guns : []).slice(0, 3).map(g => ({
        id: ++a.seq, t: String(g?.setup || g?.t || '').trim().slice(0, 140), pay: String(g?.payoff || g?.pay || '').trim().slice(0, 140),
        beat: Math.max(1, Math.min(beats.length, Math.round(Number(g?.beat) || beats.length))), planted: null, fired: null, arm: '',
    })).filter(g => g.t && g.pay);
    return { id: ++a.seq, title: String(title || j?.title || 'Сюжетка').trim().slice(0, 80), beats, guns, at: A.lastAiIndex(), by };
}

export async function planArc(title) {
    const out = await A.askModel([{ role: 'system', content: PLAN_SYSTEM }, { role: 'user', content: `Сюжетка: ${title}\n\n${context()}` }], 1400);
    const j = A.extractJson(out);
    const a = M();
    if (a.cur) closeArc(false);
    a.cur = mkArc(j, title || j?.title, 'ai');
    a.next = [];
    A.saveMeta();
    A.updatePrompt();
    return a.cur;
}

function closeArc(withNext = true) {
    const a = M();
    if (!a.cur) return;
    a.past.push({ title: a.cur.title, beats: a.cur.beats.length, done: doneCount(a.cur), at: A.lastAiIndex() });
    if (a.past.length > 12) a.past = a.past.slice(-12);
    a.cur = null;
    A.saveMeta();
    A.updatePrompt();
    if (withNext) suggestNext().catch(e => console.warn('[Life] что дальше', e));
}

export async function suggestNext() {
    const out = await A.askModel([{ role: 'system', content: NEXT_SYSTEM }, { role: 'user', content: context() }], 900);
    const j = A.extractJson(out);
    const list = (Array.isArray(j?.next) ? j.next : []).map(x => ({ title: String(x?.title || '').trim().slice(0, 60), why: String(x?.why || '').trim().slice(0, 200) })).filter(x => x.title).slice(0, 3);
    M().next = list;
    A.saveMeta();
    A.render?.();
    return list;
}

// ───────────── заметки модели ─────────────

export function arcPrompt(type) {
    const a = arcNow();
    if (!a || type === 'quiet' || type === 'impersonate') return '';
    const nb = nextBeat(a);
    if (!nb) return '';
    const live = a.guns.filter(g => g.planted != null && g.fired == null);
    return `[Сюжетка «${a.title}»: пройдено ${doneCount(a)} из ${a.beats.length}. Следующий бит: «${nb.t}» — веди к нему естественно и в своём темпе (не обязательно в этом ответе), не объявляй его, не перескакивай и не закрывай сюжетку раньше времени; если ${A.shortName(userName())} свернёт в сторону — подстраивайся.${live.length ? ` Заложено и ещё не выстрелило: ${live.map(g => `«${g.t}»`).join('; ')} — держи в уме.` : ''}]`;
}

/** Ружьё на один ответ (в самый конец промпта). consume — генерация пошла. */
export function arcOnce(type, consume = false) {
    const a = arcNow();
    if (!a || type === 'quiet' || type === 'impersonate' || type === 'continue') return '';
    const L = A.chatArr().length;
    const R = type === 'swipe' ? L - 1 : L;
    const out = [];
    for (const g of a.guns) {
        const redo = g.sent != null && ((type === 'swipe' && L - 1 === g.sent) || (type === 'regenerate' && L === g.sent));
        if (!g.arm && !redo) continue;
        const kind = g.arm || g.sentKind;
        if (kind === 'plant') out.push(`[Чеховское ружьё — в этом ответе мимоходом заложи деталь: «${g.t}». Как фон, одной фразой, без акцента и без объяснений; позже она выстрелит.]`);
        if (kind === 'fire') out.push(`[Пора: выстреливает ружьё, заложенное раньше${g.planted != null ? ` (#${g.planted})` : ''}: «${g.t}» → «${g.pay}». Пусть это случится в этом ответе — естественно, из сцены.]`);
        if (consume && g.arm) {
            g.sent = R; g.sentKind = g.arm;
            if (g.arm === 'plant') g.planted = R;
            if (g.arm === 'fire') g.fired = R;
            g.arm = '';
        }
    }
    if (consume && out.length) A.saveMeta();
    return out.join('\n');
}

// ───────────── Летописец ─────────────

export function arcChron() {
    const a = arcNow();
    if (!a || !nextBeat(a)) return null;
    return {
        key: '"arc": {"beat": 0, "fired": []}',
        rule: `\n\narc — сюжетка «${a.title}» (строка «Сюжетка»): beat — номер бита, который ДОСТИГНУТ в этом посте (событие правда случилось), иначе 0; fired — номера ружей, которые в этом посте выстрелили сами (по смыслу), иначе [].`,
        input: `Сюжетка «${a.title}». Биты: ${a.beats.map((b, n) => `${n + 1}) ${b.t}${b.done != null ? ' (уже было)' : ''}`).join('; ')}.${a.guns.some(g => g.planted != null && g.fired == null) ? ` Ружья: ${a.guns.filter(g => g.planted != null && g.fired == null).map(g => `${g.id}) ${g.t} → ${g.pay}`).join('; ')}.` : ''}`,
        tokens: 50,
    };
}

export function arcAfterPost(i, j) {
    const a = arcNow();
    if (!a) return;
    // свайп этого же поста — откатить то, что он отметил
    for (const b of a.beats) if (b.done === i && b.auto) { b.done = null; delete b.auto; }
    for (const g of a.guns) if (g.fired === i && g.autoFire) { g.fired = null; delete g.autoFire; }
    const n = Math.round(Number(j?.arc?.beat) || 0);
    if (n >= 1 && n <= a.beats.length) {
        for (let k = 0; k < n; k++) if (a.beats[k].done == null) { a.beats[k].done = i; a.beats[k].auto = true; }
        A.toast('info', `${esc(a.beats[n - 1].t)}`, `✦ Сюжетка: бит ${n} из ${a.beats.length}`, { timeOut: 3500 });
    }
    for (const id of Array.isArray(j?.arc?.fired) ? j.arc.fired : []) {
        const g = a.guns.find(x => x.id === Number(id));
        if (g && g.planted != null && g.fired == null) { g.fired = i; g.autoFire = true; }
    }
    // взвести ружья: заложить — через пару ответов после начала / прошлого ружья; выстрелить — когда дошли до его бита
    if (!a.guns.some(g => g.arm)) {
        const since = Math.max(a.at ?? -1, ...a.guns.map(g => g.planted ?? -1));
        const toPlant = a.guns.find(g => g.planted == null);
        const done = doneCount(a);
        const toFire = a.guns.find(g => g.planted != null && g.fired == null && done >= g.beat - 1 && aiCount(g.planted) >= 4);
        if (toFire) toFire.arm = 'fire';
        else if (toPlant && aiCount(since) >= 2) toPlant.arm = 'plant';
    }
    if (!nextBeat(a)) {
        A.toast('success', `«${esc(a.title)}» — все биты пройдены. Летописец придумает, что дальше.`, '✦ Сюжетка закрыта', { timeOut: 6000 });
        closeArc(true);
        return;
    }
    A.saveMeta();
}

// ───────────── вид: Сцена ─────────────

export function arcSceneHtml() {
    if (!A?.hasChat?.()) return '';
    const a = M();
    const c = a.cur;
    if (!c) {
        return `${A.sec('Сюжетка', a.next.length ? 'что дальше' : '')}
        ${a.next.length ? `<div class="lf-arc-next">${a.next.map((x, n) => `<button class="lf-arc-idea" data-act="arc-pick" data-n="${n}"><b>${esc(x.title)}</b><small>${esc(x.why)}</small></button>`).join('')}</div>` : ''}
        <div class="lf-actions"><button class="lf-btn" data-act="arc-new">${A.icon('plus')} Своя сюжетка</button>${a.past.length && !a.next.length ? `<button class="lf-btn" data-act="arc-ideas">${A.icon('sparkles')} Что дальше?</button>` : ''}</div>`;
    }
    const d = doneCount(c);
    const nb = nextBeat(c);
    const gunSt = (g) => g.fired != null ? `💥 выстрелило · #${g.fired}` : g.arm === 'fire' ? '🔫 выстрелит в следующем ответе' : g.planted != null ? `🔫 заложено · #${g.planted}` : g.arm === 'plant' ? '🌱 заложится в следующем ответе' : `ждёт · к биту ${g.beat}`;
    return `${A.sec('Сюжетка', `${d} из ${c.beats.length}`)}
    <section class="lf-arc">
        <header><b>${esc(c.title)}</b><button class="lf-iconbtn sm" data-act="arc-edit" title="Поправить">${A.icon('pencil')}</button></header>
        <div class="lf-arc-bar">${c.beats.map((b, n) => `<button class="lf-arc-dot${b.done != null ? ' done' : b === nb ? ' next' : ''}" data-act="arc-beat" data-n="${n}" title="${esc(b.t)}"><i></i></button>`).join('<span class="lf-arc-line"></span>')}</div>
        <ol class="lf-arc-beats">${c.beats.map((b, n) => `<li class="${b.done != null ? 'done' : b === nb ? 'next' : ''}"><button data-act="arc-beat" data-n="${n}">${esc(b.t)}${b.done != null ? ` <i>#${b.done}</i>` : ''}</button></li>`).join('')}</ol>
        ${c.guns.length ? `<div class="lf-arc-guns">${c.guns.map(g => `<div class="lf-arc-gun${g.fired != null ? ' fired' : ''}">
            <div><b>${esc(g.t)}</b><small>→ ${esc(g.pay)}</small><small class="st">${gunSt(g)}</small></div>
            ${g.fired == null ? `<button class="lf-chip" data-act="arc-gun" data-id="${g.id}">${g.planted == null ? (g.arm === 'plant' ? 'не сейчас' : 'Заложить') : (g.arm === 'fire' ? 'не сейчас' : 'Выстрелить')}</button>` : ''}
        </div>`).join('')}</div>` : ''}
        <div class="lf-actions tight"><button class="lf-btn" data-act="arc-gun-add">${A.icon('plus')} Ружьё</button><button class="lf-btn ghost" data-act="arc-close">${A.icon('check')} Закрыть сюжетку</button></div>
    </section>`;
}

function editSheet() {
    const c = M().cur;
    A.openSheet(`${A.icon('flag')} ${c ? 'Сюжетка' : 'Новая сюжетка'}`, `
        <div class="lf-field"><label>О чём</label><input type="text" data-in="arc-title" value="${esc(c?.title || '')}" placeholder="Свадьба 24.12; Вальден выходит на связь…"></div>
        ${c ? `<div class="lf-field"><label>Биты — по одному на строку</label><textarea data-in="arc-beats" rows="6">${esc(c.beats.map(b => b.t).join('\n'))}</textarea></div>
        <button class="lf-btn primary full" data-act="arc-save">${A.icon('check')} Сохранить</button>`
        : `<button class="lf-btn primary full" data-act="arc-plan">${A.icon('sparkles')} Летописец разложит на биты и ружья</button>
        <div class="lf-field"><label>Или свои биты — по одному на строку</label><textarea data-in="arc-beats" rows="5" placeholder="Тони узнаёт о свадьбе от Пеппер&#10;…"></textarea></div>
        <button class="lf-btn full" data-act="arc-save">${A.icon('check')} Свои биты</button>`}`);
}

export async function arcClick(act, el) {
    if (!act.startsWith('arc-')) return false;
    const a = M();
    const c = a.cur;
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'arc-new': case 'arc-edit': editSheet(); return true;
        case 'arc-plan': {
            const box = el.closest('.lf-sheet') || document;
            const title = box.querySelector('[data-in="arc-title"]')?.value?.trim();
            if (!title) { A.toast('warning', 'Напиши, о чём сюжетка', '✦ Сюжетка'); return true; }
            await A.withBusy(el, async () => { await planArc(title); }, 'Раскладываю…');
            A.closeSheet();
            return done();
        }
        case 'arc-save': {
            const box = el.closest('.lf-sheet') || document;
            const title = box.querySelector('[data-in="arc-title"]')?.value?.trim() || c?.title || 'Сюжетка';
            const lines = (box.querySelector('[data-in="arc-beats"]')?.value || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 6);
            if (!lines.length) { A.toast('warning', 'Нужен хотя бы один бит', '✦ Сюжетка'); return true; }
            if (c) {
                c.title = title.slice(0, 80);
                c.beats = lines.map(t => c.beats.find(b => b.t === t) || { t: t.slice(0, 160), done: null });
                for (const g of c.guns) g.beat = Math.min(g.beat, c.beats.length);
            } else { a.cur = mkArc({ beats: lines, guns: [] }, title, 'me'); a.next = []; }
            A.closeSheet();
            return done();
        }
        case 'arc-pick': {
            const x = a.next[Number(el.dataset.n)];
            if (!x) return true;
            await A.withBusy(el, async () => { await planArc(`${x.title}: ${x.why}`); a.cur.title = x.title; }, 'Раскладываю…');
            return done();
        }
        case 'arc-ideas': await A.withBusy(el, async () => { await suggestNext(); }, 'Думаю…'); return done();
        case 'arc-beat': {
            if (!c) return true;
            const n = Number(el.dataset.n);
            const b = c.beats[n];
            if (!b) return true;
            if (b.done != null) { for (let k = n; k < c.beats.length; k++) { c.beats[k].done = null; delete c.beats[k].auto; } }
            else for (let k = 0; k <= n; k++) if (c.beats[k].done == null) c.beats[k].done = A.lastAiIndex();
            if (!nextBeat(c)) { A.toast('success', `«${esc(c.title)}» — все биты пройдены.`, '✦ Сюжетка закрыта', { timeOut: 4000 }); closeArc(true); }
            return done();
        }
        case 'arc-gun': {
            const g = c?.guns.find(x => x.id === Number(el.dataset.id));
            if (!g) return true;
            for (const x of c.guns) if (x !== g) x.arm = '';
            g.arm = g.planted == null ? (g.arm === 'plant' ? '' : 'plant') : (g.arm === 'fire' ? '' : 'fire');
            if (g.arm) A.toast('info', g.arm === 'plant' ? 'Заложится в следующем ответе' : 'Выстрелит в следующем ответе', '🔫 Ружьё', { timeOut: 1800 });
            return done();
        }
        case 'arc-gun-add': {
            A.openSheet('🔫 Чеховское ружьё', `
                <div class="lf-field"><label>Что заложить (мимоходом)</label><input type="text" data-in="gun-t" placeholder="у Баки на кухне чужая зажигалка"></div>
                <div class="lf-field"><label>Как выстрелит потом</label><input type="text" data-in="gun-p" placeholder="зажигалка — Земо, он был в квартире"></div>
                <div class="lf-field"><label>К какому биту</label><select data-in="gun-b">${(c?.beats || []).map((b, n) => `<option value="${n + 1}"${n === (c.beats.length - 1) ? ' selected' : ''}>${n + 1}. ${esc(A.cut(b.t, 50))}</option>`).join('')}</select></div>
                <button class="lf-btn primary full" data-act="arc-gun-save">${A.icon('check')} Добавить</button>`);
            return true;
        }
        case 'arc-gun-save': {
            if (!c) return true;
            const box = el.closest('.lf-sheet') || document;
            const t = box.querySelector('[data-in="gun-t"]')?.value?.trim();
            const pay = box.querySelector('[data-in="gun-p"]')?.value?.trim();
            if (!t || !pay) { A.toast('warning', 'Нужны оба поля', '🔫 Ружьё'); return true; }
            c.guns.push({ id: ++a.seq, t: t.slice(0, 140), pay: pay.slice(0, 140), beat: Number(box.querySelector('[data-in="gun-b"]')?.value) || c.beats.length, planted: null, fired: null, arm: '' });
            A.closeSheet();
            return done();
        }
        case 'arc-close': closeArc(true); A.toast('info', 'Летописец придумает, что дальше', '✦ Сюжетка', { timeOut: 2500 }); return done();
    }
    return false;
}
