// Перемены внешности. Раны ведут «Раны», одежду — Гардероб, следы близости — «Близость», живот — Зёрнышко.
// А то, что меняется надолго и само не заживает, никто не вёл: стрижка, борода, новый шрам, татуировка, очки,
// седина, загар. Летописец замечает такую перемену в посте (или её вписываешь ты), и модель с тех пор держит
// её в описаниях; ушла (отросло, сбрил) — снимается. С ядром «Священный таймлайн» облик эпохи задаёт Реестр —
// здесь только то, что изменилось по ходу этого чата.

import { str, arr, similar } from './hudkit.js';

let A = null;
export function initAlter(api) { A = api; }
const esc = (v) => A.esc(v);

const KINDS = { hair: 'волосы', beard: 'борода и усы', scar: 'шрам', tattoo: 'татуировка', body: 'тело', face: 'лицо', other: 'другое' };
const ICON = { hair: 'scissors', beard: 'scissors', scar: 'bandage', tattoo: 'feather', body: 'activity', face: 'smile', other: 'eye' };

function cfg() {
    const s = A.settings();
    if (!s.alter || typeof s.alter !== 'object') s.alter = {};
    if (s.alter.on === undefined) s.alter.on = true;
    return s.alter;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.alter || typeof cm.alter !== 'object') cm.alter = {};
    if (!Array.isArray(cm.alter.list)) cm.alter.list = [];   // { id, who, what, kind, day, mes, src, gone?: { mes, day } }
    if (!Number.isFinite(cm.alter.seq)) cm.alter.seq = 0;
    return cm.alter;
}
const day = () => String(A.worldState()?.timestamp?.story_date || '').trim();
const live = () => M().list.filter(x => !x.gone);
const everyone = () => { const u = A.canonName(A.ctx().name1); return [u, ...A.groupMembers().map(A.canonName)].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k); };

/** Перемены во внешности человека, которые действуют сейчас: [{ what, kind, day }] — и соседям (кадры, код-мозг). */
export function alterOf(who) {
    try { return A?.hasChat?.() && on() ? live().filter(x => A.sameName(x.who, who)).map(x => ({ what: x.what, kind: x.kind, day: x.day })) : []; } catch { return []; }
}

// ───────────── Летописец ─────────────

const RULE = `
looks — что в этом посте НАДОЛГО изменилось во внешности героя: [{"who":"имя","what":"что именно, 2-8 слов: «коротко подстригся», «сбрил бороду», «шрам через бровь»","kind":"hair|beard|scar|tattoo|body|face|other","gone":"id прежней перемены из строки «Облик», если она ушла (отросло, сбрил, свели), иначе пусто"}]. Только то, что останется на недели: стрижка и цвет волос, борода, зажившая рана ставшая шрамом, татуировка, очки, загар, заметно похудел или окреп. НЕ сюда: одежда и украшения, свежие раны и синяки, следы близости, беременность, усталость, мимика, грязь и кровь. Нечего — [].`;

export function alterChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const rows = live().slice(-12).map(x => `[${x.id}] ${A.shortName(x.who)} — ${x.what}`);
    return { key: '"looks": []', rule: RULE, tokens: 60, input: `Облик (перемены по ходу истории): ${rows.length ? rows.join('; ') : 'нет'}` };
}

export function alterAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    // свайп: убрать записанное этим постом и вернуть то, что он снял
    const n0 = s.list.length;
    s.list = s.list.filter(x => !(x.mes === i && x.src === 'post'));
    let changed = s.list.length !== n0;
    for (const x of s.list) if (x.gone?.mes === i && x.gone.src === 'post') { delete x.gone; changed = true; }
    for (const r of arr(j?.looks).slice(0, 3)) {
        const who = A.canonName(str(r?.who, 50)), what = str(r?.what, 90);
        const old = str(r?.gone, 12) ? s.list.find(x => x.id === str(r.gone, 12) && !x.gone) : null;
        if (old) { old.gone = { mes: i, day: day(), src: 'post' }; changed = true; }
        if (!who || !what || live().some(x => A.sameName(x.who, who) && similar(A, x.what, what, 0.7))) continue;
        const kind = KINDS[str(r?.kind, 10)] ? str(r.kind, 10) : 'other';
        // новая стрижка сменяет прежнюю, новая борода — прежнюю: одна действующая запись на волосы и одна на бороду
        if (kind === 'hair' || kind === 'beard') for (const x of live()) if (x.kind === kind && A.sameName(x.who, who)) x.gone = { mes: i, day: day(), src: 'post' };
        s.list.push({ id: `a${++s.seq}`, who, what, kind, day: day(), mes: i, src: 'post' });
        changed = true;
    }
    if (s.list.length > 80) s.list = [...s.list.filter(x => !x.gone), ...s.list.filter(x => x.gone).slice(-30)].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    if (changed) A.saveMeta();
}

// ───────────── заметка модели ─────────────

export function alterPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const list = live();
    if (!list.length) return '';
    const user = A.canonName(A.ctx().name1);
    const here = [user, ...(A.worldState()?.scene?.characters_present || []).map(A.canonName)].filter(Boolean);
    const rows = [];
    for (const n of here.filter((x, k, a) => a.findIndex(y => A.sameName(y, x)) === k)) {
        const mine = list.filter(x => A.sameName(x.who, n)).slice(-4);
        if (mine.length) rows.push(`${A.shortName(n)} — ${mine.map(x => `${x.what}${x.day ? ` (с ${x.day})` : ''}`).join(', ')}`);
    }
    return rows.length ? `[Облик сейчас — изменилось по ходу истории, держи в описаниях и не возвращай прежнее: ${rows.join('; ')}.]` : '';
}

// ───────────── вид: Персонаж → Жизнь → Психика ─────────────

export function alterHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const mine = M().list.filter(x => A.sameName(x.who, name));
    const now = mine.filter(x => !x.gone), past = mine.filter(x => x.gone).slice(-4);
    return `${A.sec('Облик сейчас', now.length ? `перемен: ${now.length}` : 'как в карточке')}
    ${now.length ? `<div class="lf-alt">${now.map(x => `<div class="lf-alt-i">${A.icon(ICON[x.kind] || 'eye')}<span><b>${esc(x.what)}</b><small>${esc([KINDS[x.kind], x.day ? `с ${x.day}` : '', x.src === 'me' ? 'вписано' : ''].filter(Boolean).join(' · '))}</small></span><button data-act="alt-gone" data-id="${x.id}" title="ушло: отросло, сбрил, свели">${A.icon('undo')}</button><button data-act="alt-del" data-id="${x.id}" title="записи будто не было">${A.icon('x')}</button></div>`).join('')}</div>` : ''}
    ${past.length ? `<div class="lf-alt past">${past.map(x => `<div class="lf-alt-i">${A.icon(ICON[x.kind] || 'eye')}<span><b>${esc(x.what)}</b><small>было${x.day ? ` с ${esc(x.day)}` : ''}${x.gone.day ? ` до ${esc(x.gone.day)}` : ''}</small></span><button data-act="alt-back" data-id="${x.id}" title="вернуть">${A.icon('refresh')}</button></div>`).join('')}</div>` : ''}
    <button class="lf-btn ghost full" data-act="alt-add" data-who="${esc(name)}">${A.icon('plus')} Перемена во внешности</button>`;
}

export function alterClick(act, el) {
    if (!act.startsWith('alt-')) return false;
    const s = M();
    const x = s.list.find(y => y.id === el.dataset.id);
    const box = el.closest('.lf-sheet') || document;
    switch (act) {
        case 'alt-add': {
            const who = A.canonName(el.dataset.who);
            A.openSheet(`${A.icon('plus')} Перемена во внешности`, `
                <div class="lf-field"><label>У кого</label><select data-in="alt-who">${everyone().map(n => `<option value="${esc(n)}"${A.sameName(n, who) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
                <div class="lf-field"><label>Что изменилось</label><input type="text" data-in="alt-what" placeholder="коротко подстригся; шрам через бровь"></div>
                <div class="lf-field"><label>Что это</label><select data-in="alt-kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                <button class="lf-btn primary full" data-act="alt-save">${A.icon('check')} Записать</button>
                <div class="lf-hint">Только то, что надолго. Одежда — в Гардеробе, свежие раны — в «Ранах».</div>`);
            return true;
        }
        case 'alt-save': {
            const what = str(box.querySelector('[data-in="alt-what"]')?.value, 90);
            const who = box.querySelector('[data-in="alt-who"]')?.value;
            if (!what || !who) return true;
            const kind = KINDS[box.querySelector('[data-in="alt-kind"]')?.value] ? box.querySelector('[data-in="alt-kind"]').value : 'other';
            s.list.push({ id: `a${++s.seq}`, who, what, kind, day: day(), mes: -1, src: 'me' });
            A.closeSheet();
            break;
        }
        case 'alt-gone': if (x) x.gone = { mes: -1, day: day(), src: 'me' }; break;
        case 'alt-back': if (x) delete x.gone; break;
        case 'alt-del': if (x) s.list = s.list.filter(y => y !== x); break;
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function alterRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.list) {
        if (x.mes === i && x.src === 'post') out.push({ id: `alt:${x.id}`, g: 'Облик', icon: ICON[x.kind] || 'eye', t: `${A.shortName(x.who)}: ${x.what}`, del: () => { s.list = s.list.filter(y => y !== x); } });
        else if (x.gone?.mes === i && x.gone.src === 'post') out.push({ id: `alt:${x.id}:gone`, g: 'Облик', icon: 'undo', t: `${A.shortName(x.who)}: ушло — ${x.what}`, del: () => { delete x.gone; } });
    }
    return out;
}
