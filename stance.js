// Позиции и споры. Летописец замечает открытые вопросы, где у персонажей своё мнение (работа, опасность, ребёнок,
// доверие людям), кто за что и насколько твёрдо; решилось — закрывает. Модель получает открытые споры:
// каждый держит позицию, пока его по-настоящему не переубедили — не сдаётся с первого слова.

let A = null;
export function initStance(api) { A = api; }

const esc = (v) => A.esc(v);
const FIRM = ['', 'колеблется', 'стоит на своём', 'намертво'];
const HOW = { agreed: 'договорились', gave_in: 'уступил(а)', compromise: 'компромисс', dropped: 'замяли' };

function cfg() {
    const s = A.settings();
    if (!s.stance || typeof s.stance !== 'object') s.stance = {};
    if (s.stance.on === undefined) s.stance.on = true;
    return s.stance;
}
export const stanceOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.stance || typeof cm.stance !== 'object') cm.stance = {};
    const s = cm.stance;
    if (!Array.isArray(s.list)) s.list = [];
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const open = () => M().list.filter(x => !x.closed);
const posOf = (x, who) => { const k = Object.keys(x.pos || {}).find(n => A.sameName(n, who)); return k ? [k, x.pos[k]] : [null, null]; };
const flat = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
const similar = (a, b) => { const x = new Set(flat(a)), y = flat(b); return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= 0.6; };

// ───────────── Летописец ─────────────

const RULE = `
stance — споры и открытые вопросы, где у персонажей СВОЁ мнение (жизнь, работа, опасность, ребёнок, доверие людям, как поступить): [{"id":"s3 — если спор уже есть в «Спорах», иначе пусто","q":"вопрос, 3–10 слов","who":"имя","pos":"его позиция, 4–14 слов","why":"почему он так считает, 3–10 слов","firm":1}]. firm: 1 — колеблется, 2 — стоит на своём, 3 — намертво. Только по тексту поста: новое мнение, сдвиг или твёрдость. Мелочи («что на ужин») — не споры. Нечего — [].
stanceEnd — споры, решившиеся в этом посте: [{"id":"s3","how":"agreed|gave_in|compromise|dropped","by":"чья позиция взяла верх или пусто"}]. Нечего — [].`;

export function stanceChron() {
    if (!A?.hasChat?.() || !stanceOn()) return null;
    const rows = open().slice(-6).map(x => `[${x.id}] ${x.q}: ${Object.entries(x.pos || {}).map(([n, p]) => `${n} — ${p.t} (${p.firm})`).join('; ')}`);
    return { key: '"stance": [], "stanceEnd": []', rule: RULE, tokens: 160, input: `Споры (открытые): ${rows.length ? rows.join(' | ') : 'нет'}` };
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function stanceAfterPost(i, j) {
    if (!stanceOn()) return;
    const s = M();
    // этот пост уже разбирали (свайп) — откатить его правки
    s.list = s.list.filter(x => x.mes !== i || x.src !== 'post' || Object.values(x.pos || {}).some(p => p.mes !== i));
    for (const x of s.list) {
        for (const [n, p] of Object.entries(x.pos || {})) if (p.mes === i) { if (p.prev) x.pos[n] = p.prev; else delete x.pos[n]; }
        if (x.closed?.mes === i) delete x.closed;
    }
    let changed = false;
    for (const r of (Array.isArray(j?.stance) ? j.stance : []).slice(0, 4)) {
        const who = A.canonName(str(r?.who));
        const t = str(r?.pos).slice(0, 120);
        if (!who || !t) continue;
        let x = s.list.find(y => y.id === str(r.id) && !y.closed) || open().find(y => similar(y.q, str(r.q)));
        if (!x) {
            const q = str(r.q).slice(0, 90);
            if (!q) continue;
            x = { id: `s${++s.seq}`, q, pos: {}, mes: i, src: 'post', at: Date.now() };
            s.list.push(x);
        }
        const [k, old] = posOf(x, who);
        const firm = Math.max(1, Math.min(3, Math.round(Number(r.firm) || old?.firm || 2)));
        x.pos[k || who] = { t, why: str(r.why).slice(0, 90) || old?.why || '', firm, mes: i, prev: old ? { ...old, prev: undefined } : null };
        changed = true;
    }
    for (const r of Array.isArray(j?.stanceEnd) ? j.stanceEnd : []) {
        const x = s.list.find(y => y.id === str(r?.id) && !y.closed);
        if (!x) continue;
        x.closed = { how: HOW[str(r.how)] ? str(r.how) : 'agreed', by: A.canonName(str(r.by)) || '', mes: i };
        changed = true;
    }
    if (s.list.length > 80) s.list.splice(0, s.list.length - 80);
    if (changed) A.saveMeta();
}

// ───────────── заметка ─────────────

export function stancePrompt(type) {
    if (!A?.hasChat?.() || !stanceOn() || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const list = open().filter(x => Object.keys(x.pos || {}).some(n => !here.length || here.some(h => A.sameName(h, n)))).slice(-3);
    if (!list.length) return '';
    const user = A.canonName(A.ctx().name1);
    const rows = list.map(x => `«${x.q}»: ${Object.entries(x.pos).map(([n, p]) => `${A.shortName(n)} — ${p.t}${A.sameName(n, user) ? '' : `${p.why ? ` (${p.why})` : ''}, ${FIRM[p.firm]}`}`).join('; ')}`);
    return `[Споры — у каждого своё мнение: ${rows.join(' | ')}. Персонажи держат позицию, пока их по-настоящему не переубедили — довод, поступок, страх за другого, уступка за уступку; с первого слова не сдаются, могут смягчиться, спорят в характере. Позицию ${A.shortName(user)} за неё не меняй.]`;
}

// ───────────── вид: Сцена ─────────────

export function stanceSceneHtml() {
    if (!A?.hasChat?.() || !stanceOn()) return '';
    const list = open().slice(-5).reverse();
    const done = M().list.filter(x => x.closed).slice(-3).reverse();
    if (!list.length && !done.length) return `${A.sec('Споры')}<div class="lf-hint">Открытых споров нет — Летописец заметит, когда у кого-то будет своё мнение. <button class="lf-link" data-act="stn-add">+ свой</button></div>`;
    const dots = (f) => `<i class="lf-stn-f">${[1, 2, 3].map(k => `<b class="${k <= f ? 'on' : ''}"></b>`).join('')}</i>`;
    return `${A.sec('Споры', list.length ? `${list.length} открыто` : 'всё решено')}
    <div class="lf-stn">${list.map(x => `<div class="lf-stn-q">
        <div class="lf-stn-h"><b>${esc(x.q)}</b><span><button data-act="stn-end" data-id="${x.id}" title="решено">${A.icon('check')}</button><button data-act="stn-del" data-id="${x.id}" title="убрать">${A.icon('x')}</button></span></div>
        ${Object.entries(x.pos || {}).map(([n, p]) => `<div class="lf-stn-p">${A.ava(n, 'xs')}<span><b>${esc(A.shortName(n))}</b> ${esc(p.t)}${p.why ? `<small>${esc(p.why)}</small>` : ''}</span>${dots(p.firm)}</div>`).join('')}
    </div>`).join('')}</div>
    ${done.length ? `<div class="lf-hint">Решено: ${done.map(x => `${esc(x.q)} — ${HOW[x.closed.how] || 'решено'}${x.closed.by ? ` (${esc(A.shortName(x.closed.by))})` : ''}`).join('; ')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="stn-add">${A.icon('plus')} Свой спор</button>`;
}

export function stanceClick(act, el) {
    if (!act.startsWith('stn-')) return false;
    const s = M();
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'stn-end': { const x = s.list.find(y => y.id === el.dataset.id); if (x) x.closed = { how: 'agreed', by: '', mes: A.chatArr().length - 1 }; return done(); }
        case 'stn-del': { const k = s.list.findIndex(y => y.id === el.dataset.id); if (k >= 0) s.list.splice(k, 1); return done(); }
        case 'stn-add': {
            const names = A.groupMembers().map(A.canonName);
            A.openSheet(`${A.icon('zap')} Свой спор`, `
                <div class="lf-field"><label>О чём</label><input type="text" data-in="stn-q" placeholder="вернуться ли Хеди в Щ.И.Т."></div>
                ${names.map(n => `<div class="lf-field"><label>${esc(n)}</label><input type="text" data-in="stn-p" data-name="${esc(n)}" placeholder="его позиция (пусто — не участвует)"></div>`).join('')}
                <button class="lf-btn primary full" data-act="stn-save">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'stn-save': {
            const box = el.closest('.lf-sheet') || document;
            const q = box.querySelector('[data-in="stn-q"]')?.value?.trim();
            if (!q) return true;
            const pos = {};
            for (const inp of box.querySelectorAll('[data-in="stn-p"]')) { const t = inp.value.trim(); if (t) pos[inp.dataset.name] = { t: t.slice(0, 120), why: '', firm: 2, mes: -1, prev: null }; }
            if (!Object.keys(pos).length) return true;
            s.list.push({ id: `s${++s.seq}`, q: q.slice(0, 90), pos, mes: -1, src: 'me', at: Date.now() });
            A.closeSheet();
            return done();
        }
    }
    return false;
}
