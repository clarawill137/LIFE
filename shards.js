// Осколки памяти. Что Баки уже вспомнил — из 40-х, с Тео, из ГИДРЫ, после — коллекцией по эпохам.
// Летописец замечает новые воспоминания в постах; «Собрать по истории» — проход по всему чату.
// Модель знает, что он уже помнит, и что остальное — провалы: новое всплывает кусками, по ходу истории.

let A = null;
export function initShards(api) { A = api; }

const esc = (v) => A.esc(v);
const ERAS_DEF = ['40-е', 'Тео', 'ГИДРА', 'после'];

function cfg() {
    const s = A.settings();
    if (!s.shards || typeof s.shards !== 'object') s.shards = {};
    const c = s.shards;
    if (c.on === undefined) c.on = true;
    if (!c.who || typeof c.who !== 'object') c.who = {};      // имя → { eras: [...] }
    if (!c.seeded) {
        let names = [];
        try { names = A.groupMembers().map(A.canonName); } catch { /* */ }
        if (names.length) {
            c.seeded = 1;
            const bucky = names.find(n => /баки|bucky|барнс|barnes/i.test(n));
            if (bucky && !c.who[bucky]) c.who[bucky] = { eras: [...ERAS_DEF] };
            A.saveSettings();
        }
    }
    return c;
}
export const shardsOn = () => cfg().on !== false;
const keyOf = (who) => Object.keys(cfg().who).find(n => A.sameName(n, who)) || '';
export const hasShards = (who) => !!keyOf(who);
const erasOf = (who) => cfg().who[keyOf(who)]?.eras || ERAS_DEF;

function M() {
    const cm = A.chatMeta();
    if (!cm.shards || typeof cm.shards !== 'object') cm.shards = {};
    const s = cm.shards;
    if (!Array.isArray(s.list)) s.list = [];
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const words = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
const similar = (a, b) => { const x = new Set(words(a)), y = words(b); return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= 0.55; };
function dateAt(i) { const chat = A.chatArr(); for (let j = Math.min(i, chat.length - 1); j >= 0; j--) { const d = chat[j]?.horae_meta?.timestamp?.story_date; if (d) return d; } return ''; }

function addShard(r, i, src) {
    const who = A.canonName(str(r?.who));
    const t = str(r?.t).slice(0, 160);
    if (!who || !t || !hasShards(who)) return null;
    const eras = erasOf(who);
    const era = eras.find(e => A.norm(e) === A.norm(str(r.era))) || eras.find(e => A.norm(str(r.era)).includes(A.norm(e).slice(0, 4))) || eras[eras.length - 1];
    const s = M();
    if (s.list.some(x => A.sameName(x.who, who) && similar(x.t, t))) return null;
    const x = { id: `m${++s.seq}`, who, t, era, mes: Number.isFinite(i) ? i : null, date: Number.isFinite(i) ? dateAt(i) : '', src, at: Date.now() };
    s.list.push(x);
    return x;
}

// ───────────── Летописец ─────────────

export function shardsChron() {
    if (!A?.hasChat?.() || !shardsOn()) return null;
    const who = Object.keys(cfg().who);
    if (!who.length) return null;
    const have = M().list.slice(-12).map(x => `${A.shortName(x.who)}: ${x.t}`).join('; ');
    const RULE = `
shard — НОВЫЕ осколки памяти в ЭТОМ посте (только у: ${who.join(', ')}): что персонаж впервые вспомнил из прошлого — образ, имя, место, событие: [{"who":"имя","t":"что вспомнил, 5–15 слов","era":"одна из: ${[...new Set(who.flatMap(erasOf))].join(' | ')}"}]. Уже вспомненное (список «Помнит») — не повторяй. Нечего — [].`;
    return { key: '"shard": []', rule: RULE, tokens: 90, input: `Помнит (уже вспомнил): ${have || 'пока ничего не отмечено'}` };
}

export function shardsAfterPost(i, j) {
    if (!shardsOn()) return;
    const s = M();
    s.list = s.list.filter(x => !(x.src === 'post' && x.mes === i));
    const added = [];
    for (const r of (Array.isArray(j?.shard) ? j.shard : []).slice(0, 3)) { const x = addShard(r, i, 'post'); if (x) added.push(x); }
    A.saveMeta();
    if (added.length) A.toast('info', added.map(x => `${esc(x.era)}: ${esc(x.t)}`).join('<br>'), `✦ ${esc(A.shortName(added[0].who))} вспомнил`, { timeOut: 4500, escapeHtml: false });
}

// ───────────── заметка ─────────────

export function shardsPrompt(type) {
    if (!A?.hasChat?.() || !shardsOn() || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const out = [];
    for (const who of Object.keys(cfg().who)) {
        if (here.length && !here.some(h => A.sameName(h, who))) continue;
        const list = M().list.filter(x => A.sameName(x.who, who));
        if (!list.length) continue;
        const byEra = erasOf(who).map(e => [e, list.filter(x => x.era === e).slice(-5)]).filter(([, l]) => l.length);
        out.push(`[Память ${A.shortName(who)} — он уже вспомнил (и только это; остальное — провалы и обрывки): ${byEra.map(([e, l]) => `${e} — ${l.map(x => x.t).join('; ')}`).join(' | ')}. Новое всплывает только по ходу истории, кусками — через запах, слово, место, — не всё сразу; уже вспомненное он может назвать.]`);
    }
    return out.join('\n');
}

// ───────────── вид ─────────────

const ui = { busy: false, prog: '' };

export function shardsHtml(who) {
    if (!A?.hasChat?.() || !hasShards(who)) return '';
    const list = M().list.filter(x => A.sameName(x.who, who));
    const N = esc(who);
    return `${A.sec('Осколки памяти', list.length ? String(list.length) : 'пока пусто')}
    <div class="lf-shards">${erasOf(who).map(e => {
        const l = list.filter(x => x.era === e);
        return `<div class="lf-sh-era"><b>${esc(e)}</b>${l.length ? l.map(x => `<span class="lf-sh" style="--r:${((x.id.charCodeAt(x.id.length - 1) % 7) - 3) * 0.7}deg">${esc(x.t)}${Number.isFinite(x.mes) ? `<button data-act="jump" data-mes="${x.mes}">${A.icon('chevR')}</button>` : ''}<button data-act="shd-del" data-id="${x.id}">${A.icon('x')}</button></span>`).join('') : '<i>провал</i>'}</div>`;
    }).join('')}</div>
    <div class="lf-actions"><button class="lf-btn" data-act="shd-scan" data-name="${N}">${A.icon('search')} ${ui.busy ? esc(ui.prog || 'Читаю…') : 'Собрать по истории'}</button><button class="lf-btn ghost" data-act="shd-add" data-name="${N}">${A.icon('plus')} Осколок</button></div>`;
}

const SCAN = `Ты внимательный читатель длинной ролевой истории (русский). Персонаж — {who} — по кусочкам вспоминает своё прошлое. По хронике найди, ЧТО он уже вспомнил (образы, люди, места, события), с номером поста, где это всплыло.
Эпохи: {eras}. Только то, что есть в хронике. Ответь только JSON: {"shard":[{"who":"{who}","t":"что вспомнил, 5–15 слов","era":"эпоха","mes":номер}]}`;

async function scan(who, el) {
    const chat = A.chatArr();
    const rows = [];
    for (const e of A.horaeEvents?.() || []) if (e?.event?.summary) rows.push(`#${e.messageIndex} ${e.event.summary}`);
    if (rows.length < 20) for (let i = 0; i < chat.length; i++) { const m = chat[i]; if ((A.isPost ? A.isPost(m) : m && !m.is_system) && !m.is_user && String(m.mes || '').length > 40) rows.push(`#${i} ${A.cut(A.plainText(m.mes), 420)}`); }
    const parts = [];
    let cur = [], size = 0;
    for (const r of rows) { if (size + r.length > 9000 && cur.length) { parts.push(cur); cur = []; size = 0; } cur.push(r); size += r.length + 1; }
    if (cur.length) parts.push(cur);
    if (!parts.length) throw new Error('нечего читать');
    if (parts.length > 3 && !confirm(`Прочитать историю: ${parts.length} запросов к модели Летописца. Продолжить?`)) return 0;
    let n = 0;
    for (let k = 0; k < parts.length; k++) {
        ui.prog = `Читаю ${k + 1} из ${parts.length}…`;
        if (el) el.textContent = ui.prog;
        const out = await A.askModel([{ role: 'system', content: SCAN.replaceAll('{who}', who).replace('{eras}', erasOf(who).join(', ')) }, { role: 'user', content: parts[k].join('\n') }], 1200);
        const j = A.extractJson(out);
        for (const r of Array.isArray(j?.shard) ? j.shard : []) if (addShard({ ...r, who }, Number(r.mes), 'scan')) n++;
        A.saveMeta();
    }
    return n;
}

export async function shardsClick(act, el) {
    if (!act.startsWith('shd-')) return false;
    const s = M();
    switch (act) {
        case 'shd-del': { const k = s.list.findIndex(x => x.id === el.dataset.id); if (k >= 0) s.list.splice(k, 1); A.saveMeta(); A.updatePrompt(); A.render(); return true; }
        case 'shd-scan': {
            if (ui.busy) return true;
            ui.busy = true;
            try { const n = await scan(A.canonName(el.dataset.name), el); A.toast('success', n ? `Осколков: ${n}` : 'Нового не нашлось', '✦ Память', { timeOut: 2500 }); }
            catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Память'); } finally { ui.busy = false; ui.prog = ''; }
            A.updatePrompt(); A.render();
            return true;
        }
        case 'shd-add': {
            const who = el.dataset.name;
            A.openSheet(`${A.icon('brain')} Осколок · ${esc(A.shortName(who))}`, `
                <div class="lf-field"><label>Что вспомнил</label><input type="text" data-in="shd-t" placeholder="запах маминого пирога в Бруклине"></div>
                <div class="lf-field"><label>Эпоха</label><select data-in="shd-e">${erasOf(who).map(e => `<option>${esc(e)}</option>`).join('')}</select></div>
                <button class="lf-btn primary full" data-act="shd-save" data-name="${esc(who)}">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'shd-save': {
            const box = el.closest('.lf-sheet') || document;
            const t = box.querySelector('[data-in="shd-t"]')?.value?.trim();
            if (!t) return true;
            addShard({ who: el.dataset.name, t, era: box.querySelector('[data-in="shd-e"]')?.value }, A.chatArr().length - 1, 'me');
            A.saveMeta(); A.updatePrompt(); A.closeSheet(); A.render();
            return true;
        }
    }
    return false;
}

/** Что записал пост i: вспомненное. */
export function shardsRecs(i) {
    const s = M();
    return s.list.filter(x => x.src === 'post' && x.mes === i).map(x => ({
        id: `shd:${x.era}:${x.t}`, g: 'Память', icon: 'moon', t: `${A.shortName(x.who)} вспомнил (${x.era}): ${x.t}`,
        del: () => { s.list = s.list.filter(y => y !== x); },
    }));
}
