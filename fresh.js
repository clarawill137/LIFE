// Свежесть. Раз в N постов дешёвая модель читает последние посты и выписывает затёртое: словесные тики,
// жесты и мимику, метафоры, ремарки, обращения, повторяющиеся детали — по персонажам и отдельно у рассказчика.
// Модель получает «не повторять» (а фирменное, но слишком частое — «реже»). Список сам обновляется:
// что снова нашлось — крепнет, что пропало — через пару проверок уходит. Руками: снять (больше не ловить) и добавить своё.

let A = null;
export function initFresh(api) { A = api; }

const esc = (v) => A.esc(v);
const PROSE = '__prose';

function cfg() {
    const s = A.settings();
    if (!s.fresh || typeof s.fresh !== 'object') s.fresh = {};
    const c = s.fresh;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.every)) c.every = 10;
    return c;
}
export const freshOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.fresh || typeof cm.fresh !== 'object') cm.fresh = {};
    const f = cm.fresh;
    if (!f.list || typeof f.list !== 'object') f.list = {};   // имя | __prose → [{ t, less, n, miss, own }]
    if (!Array.isArray(f.ban)) f.ban = [];                  // снятые руками — больше не ловить
    if (!Number.isFinite(f.last)) f.last = -1;              // индекс поста, по который проверено
    return f;
}

const same = (a, b) => A.norm(a).replace(/[«»"'.,!?…—-]/g, '').trim() === A.norm(b).replace(/[«»"'.,!?…—-]/g, '').trim();

// ───────────── проверка ─────────────

const SYSTEM = `Ты редактор длинной русской литературной ролевой. Найди ЗАТЁРТОЕ — то, что кочует из поста в пост и уже режет глаз:
словесные тики и обороты, жесты и мимика (хмыкнул, уголок губ дёрнулся, провёл рукой по волосам), метафоры и сравнения, ремарки к репликам, обращения, конструкции фраз, повторяющиеся детали обстановки, запахи и звуки.
Отдельно по каждому персонажу (его реплики и описания его действий) и отдельно — проза рассказчика.
Только то, что встречается в 3+ постах или явно навязчиво; 3–8 пунктов на персонажа, каждый 1–6 слов, как это звучит в тексте.
Фирменное словечко или манера персонажа, которые должны остаться, но звучат слишком часто, — пометь "less": true (их не убирать, а реже). Имена, служебные слова и нормальную лексику не выписывай.
Ответь только JSON: {"chars":{"Имя":[{"t":"…","less":false}]},"prose":[{"t":"…","less":false}]}`;

let running = false;

export async function runFresh({ force = false } = {}) {
    if (running || !A.hasChat() || !freshOn()) return 0;
    const chat = A.chatArr();
    const f = M();
    const ai = [];
    for (let i = chat.length - 1; i >= 0 && ai.length < 14; i--) if (chat[i] && !chat[i].is_user && !chat[i].is_system) ai.push(i);
    if (ai.length < 4) return 0;
    const newer = ai.filter(i => i > f.last).length;
    if (!force && newer < (Number(cfg().every) || 10)) return 0;
    running = true;
    const cm = A.chatMeta();
    try {
        await A.genIdle?.();
        const posts = ai.reverse().map(i => `### ${chat[i].name || ''} (#${i})\n${A.cut(A.plainText(chat[i].mes), 1800)}`).join('\n\n');
        const have = Object.entries(f.list).map(([k, v]) => `${k === PROSE ? 'проза' : k}: ${v.map(x => x.t).join('; ')}`).join('\n');
        const input = `${have ? `Уже в списке (проверь, держится ли):\n${have}\n\n` : ''}${f.ban.length ? `Не выписывать (снято игроком): ${f.ban.slice(-40).join('; ')}\n\n` : ''}Последние посты:\n\n${posts}`;
        const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: input }], 1500);
        const j = A.extractJson(out);
        if (!j || A.chatMeta() !== cm) return 0;
        const found = {};
        for (const [name, arr] of Object.entries(j.chars || {})) if (Array.isArray(arr)) found[A.canonName(name)] = arr;
        if (Array.isArray(j.prose)) found[PROSE] = j.prose;
        let n = 0;
        const keys = new Set([...Object.keys(f.list), ...Object.keys(found)]);
        for (const k of keys) {
            const cur = f.list[k] || [];
            const fresh = (found[k] || []).map(x => (typeof x === 'string' ? { t: x } : x)).map(x => ({ t: String(x?.t || '').trim().slice(0, 60), less: !!x?.less })).filter(x => x.t && !f.ban.some(b => same(b, x.t)));
            const next = [];
            for (const it of cur) {
                const hit = fresh.find(x => same(x.t, it.t));
                if (it.own) next.push(it);
                else if (hit) next.push({ ...it, n: (it.n || 1) + 1, miss: 0, less: hit.less || it.less });
                else if ((it.miss || 0) < 1) next.push({ ...it, miss: (it.miss || 0) + 1 });
            }
            for (const x of fresh) if (!next.some(it => same(it.t, x.t))) { next.push({ t: x.t, less: x.less, n: 1, miss: 0 }); n++; }
            if (next.length) f.list[k] = next.slice(-14); else delete f.list[k];
        }
        f.last = chat.length - 1;
        f.at = Date.now();
        A.saveMeta();
        A.updatePrompt();
        return n;
    } finally { running = false; }
}

export function freshAfterPost() {
    if (!freshOn()) return;
    setTimeout(() => { runFresh().catch(e => console.warn('[Life] свежесть', e)); }, 4000);
}

// ───────────── заметка ─────────────

function lineFor(arr) {
    const ban = arr.filter(x => !x.less).sort((a, b) => (b.n || 1) - (a.n || 1)).slice(0, 10).map(x => x.t);
    const less = arr.filter(x => x.less).slice(0, 4).map(x => x.t);
    return [ban.join('; '), less.length ? `реже: ${less.join('; ')}` : ''].filter(Boolean).join('; ');
}

export function freshPrompt(type) {
    if (!A?.hasChat?.() || !freshOn() || type === 'quiet' || type === 'impersonate') return '';
    const f = M();
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const parts = [];
    for (const [k, arr] of Object.entries(f.list)) {
        if (k === PROSE || !arr.length) continue;
        if (A.sameName(k, A.ctx().name1)) continue;
        if (here.length && !here.some(h => A.sameName(h, k))) continue;
        const l = lineFor(arr);
        if (l) parts.push(`${A.shortName(k)} — ${l}`);
    }
    const pr = f.list[PROSE]?.length ? lineFor(f.list[PROSE]) : '';
    if (pr) parts.push(`проза — ${pr}`);
    if (!parts.length) return '';
    return `[Свежесть — это в истории уже затёрто: не используй ни дословно, ни пересказом, найди новое (а «реже» — можно, но редко): ${parts.join('. ')}.]`;
}

// ───────────── вид ─────────────

export function freshHtml() {
    if (!A?.hasChat?.()) return '';
    const f = M();
    const c = cfg();
    const rows = Object.entries(f.list).sort(([a], [b]) => (a === PROSE) - (b === PROSE));
    const chip = (k, x, n) => `<span class="lf-fr-chip${x.less ? ' less' : ''}${x.own ? ' own' : ''}" title="${x.n > 1 ? `ловилось ${x.n} раза` : ''}">${x.less ? '↓ ' : ''}${esc(x.t)}${x.n > 2 ? ` <i>×${x.n}</i>` : ''}<button data-act="fr-del" data-k="${esc(k)}" data-n="${n}">${A.icon('x')}</button></span>`;
    return `${A.sec('Свежесть', f.at ? `проверено на #${f.last}` : 'ещё не проверяла')}
    <div class="lf-fresh">
        ${rows.length ? rows.map(([k, arr]) => `<div class="lf-fr-row"><b>${k === PROSE ? 'Рассказчик' : esc(A.shortName(k))}</b><div class="lf-fr-chips">${arr.map((x, n) => chip(k, x, n)).join('')}<button class="lf-fr-add" data-act="fr-add" data-k="${esc(k)}">${A.icon('plus')}</button></div></div>`).join('')
            : '<div class="lf-empty small">Затёртого пока не нашлось — проверка идёт сама раз в несколько постов.</div>'}
    </div>
    <div class="lf-actions">
        <button class="lf-btn" data-act="fr-run">${A.icon('refresh')} Проверить сейчас</button>
        <button class="lf-btn" data-act="fr-add" data-k="">${A.icon('plus')} Своё</button>
    </div>
    <div class="lf-field"><label>Проверять каждые</label><div class="lf-seg">${[[0, 'Выкл'], [6, '6'], [10, '10'], [16, '16']].map(([v, l]) => `<button class="${(c.on === false ? 0 : c.every) === v ? 'on' : ''}" data-act="fr-every" data-v="${v}">${l}</button>`).join('')}</div></div>
    <div class="lf-hint">Модель получает «не повторять» по тем, кто в сцене, и по прозе; «↓» — фирменное, но слишком частое: реже, а не никогда. ✕ — снять и больше не ловить.</div>`;
}

export async function freshClick(act, el) {
    if (!act.startsWith('fr-')) return false;
    const f = M();
    const done = () => { A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'fr-run': await A.withBusy(el, async () => { const n = await runFresh({ force: true }); A.toast('success', n ? `Нового затёртого: ${n}` : 'Нового не нашлось', '✦ Свежесть', { timeOut: 2200 }); }, 'Читаю…'); A.render(); return true;
        case 'fr-every': { const v = Number(el.dataset.v); cfg().on = v > 0; if (v > 0) cfg().every = v; A.saveSettings(); A.updatePrompt(); A.render(); return true; }
        case 'fr-del': {
            const arr = f.list[el.dataset.k];
            const x = arr?.[Number(el.dataset.n)];
            if (!x) return true;
            arr.splice(Number(el.dataset.n), 1);
            if (!x.own && !f.ban.some(b => same(b, x.t))) f.ban.push(x.t);
            if (!arr.length) delete f.list[el.dataset.k];
            return done();
        }
        case 'fr-add': {
            const names = [PROSE, ...A.groupMembers().map(A.canonName)];
            A.openSheet(`${A.icon('sparkles')} Своё затёртое`, `
                <div class="lf-field"><label>Чьё</label><select data-in="fr-k">${names.map(n => `<option value="${esc(n)}"${n === el.dataset.k ? ' selected' : ''}>${n === PROSE ? 'Рассказчик (проза)' : esc(n)}</option>`).join('')}</select></div>
                <div class="lf-field"><label>Что (через ;)</label><input type="text" data-in="fr-t" placeholder="уголок губ; запах оружейного масла"></div>
                <label class="lf-switch"><input type="checkbox" data-in="fr-less"><span></span>Не запрещать, а реже</label>
                <button class="lf-btn primary full" data-act="fr-save">${A.icon('check')} Добавить</button>`);
            return true;
        }
        case 'fr-save': {
            const box = el.closest('.lf-sheet') || document;
            const k = box.querySelector('[data-in="fr-k"]')?.value || PROSE;
            const less = !!box.querySelector('[data-in="fr-less"]')?.checked;
            const ts = (box.querySelector('[data-in="fr-t"]')?.value || '').split(';').map(x => x.trim()).filter(Boolean);
            if (!ts.length) return true;
            const arr = f.list[k] || (f.list[k] = []);
            for (const t of ts) if (!arr.some(x => same(x.t, t))) arr.push({ t: t.slice(0, 60), less, n: 1, own: true });
            f.ban = f.ban.filter(b => !ts.some(t => same(b, t)));
            A.closeSheet();
            return done();
        }
    }
    return false;
}
