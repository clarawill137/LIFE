// Привычки по кругу. Микро-привычки персонажа (из психо-лорбука: «садится спиной к стене», «щёлкает пальцами
// металлической руки, когда нервничает», «мурлычет Гленна Миллера») — модели по одной, через ход, к месту,
// по кругу: недавно показанные не повторяются. «Собрать из лорбука» — дешёвая модель вытаскивает список.

let A = null;
export function initHabits(api) { A = api; }

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

function cfg() {
    const s = A.settings();
    if (!s.habits || typeof s.habits !== 'object') s.habits = {};
    const c = s.habits;
    if (c.on === undefined) c.on = true;
    if (!c.list || typeof c.list !== 'object') c.list = {};
    return c;
}
export const habitsOn = () => cfg().on !== false;
const keyOf = (who) => Object.keys(cfg().list).find(n => A.sameName(n, who)) || '';
export function habitsOf(who) { return cfg().list[keyOf(who)] || []; }

function M() {
    const cm = A.chatMeta();
    if (!cm.habits || typeof cm.habits !== 'object') cm.habits = {};
    if (!cm.habits.used || typeof cm.habits.used !== 'object') cm.habits.used = {};
    return cm.habits;
}

// ───────────── заметка ─────────────

function speakers() {
    const c = A.ctx();
    const S = String(c.name2 || '').trim();
    return S && !NARR.test(S) ? [S] : [];
}

export function habitsPrompt(type) {
    if (!A?.hasChat?.() || !habitsOn() || type === 'quiet' || type === 'impersonate') return '';
    const L = A.chatArr().length;
    const turn = Math.floor((type === 'swipe' ? L - 1 : L) / 2);
    if (turn % 2) return '';                 // через ход — не в каждом посте
    const out = [];
    for (const who of speakers()) {
        const list = habitsOf(who).filter(h => h.on !== false);
        if (!list.length) continue;
        const used = M().used;
        // этот ход уже был (свайп, реролл) — та же привычка; иначе — та, что дольше всех не звучала
        let h = list.find(x => used[x.id] === turn);
        if (!h) {
            const order = list.map((x, k) => [x, used[x.id] ?? -1e9, (k + turn) % list.length]).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
            h = order[0]?.[0];
        }
        if (!h) continue;
        if (type && type !== 'swipe') { used[h.id] = turn; A.saveMeta(); }
        out.push(`[Привычка ${A.shortName(A.canonName(who))} — если к месту в этой сцене, покажи мельком, одной деталью (иначе пропусти): ${h.t}.]`);
    }
    return out.join('\n');
}

// ───────────── из лорбука ─────────────

const HABIT_RE = /привычк|микропривыч|быт|тело|со стороны|жест|манер|мелоч|habit|mannerism|routine|quirk/i;

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

async function loreAbout(who) {
    const W = await wiMod();
    if (!W?.loadWorldInfo) return '';
    const c = A.ctx();
    const books = new Set();
    if (c.chatMetadata?.world_info) books.add(c.chatMetadata.world_info);
    for (const ch of A.chatCards?.() || []) {
        if (ch?.data?.extensions?.world) books.add(ch.data.extensions.world);
        (W.world_info?.charLore || []).find(e => e.name === ch.avatar)?.extraBooks?.forEach(b => books.add(b));
    }
    (W.selected_world_info || []).forEach(b => books.add(b));
    const first = A.norm(A.shortName(A.canonName(who)));
    const out = [];
    let total = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        for (const e of Object.values(data?.entries || {})) {
            const t = String(e?.content || '');
            const head = `${e.comment || ''} ${(e.key || []).join(' ')}`;
            if (e?.disable || !t || !HABIT_RE.test(`${head} ${t.slice(0, 400)}`)) continue;
            const names = (e.characterFilter?.names || []).join(' ');
            if (!A.norm(`${head} ${names} ${t.slice(0, 1200)}`).includes(first.slice(0, Math.max(3, first.length - 1)))) continue;
            const piece = `### ${e.comment || (e.key || []).join(', ')}\n${t.slice(0, 3000)}`;
            if (total + piece.length > 14000) break;
            out.push(piece); total += piece.length;
        }
    }
    return out.join('\n\n');
}

const SYSTEM = `По записям лорбука о персонаже ролевой истории выпиши его МИКРО-ПРИВЫЧКИ — то, что видно со стороны и можно показать одной деталью в сцене: жесты, привычки тела, бытовые ритуалы, как сидит, ест, спит, что делает руками, когда нервничает, что напевает, что всегда носит с собой.
Не характер и не чувства — только видимое поведение. 12–30 пунктов, каждый 5–16 слов, конкретно и в его духе.
Ответь только JSON: {"habits":["…"]}`;

async function collect(who) {
    const lore = await loreAbout(who);
    const card = [A.cardOf?.(who)?.description, A.cardOf?.(who)?.personality].filter(Boolean).join('\n');
    if (!lore && !card) throw new Error('в лорбуках ничего о его привычках не нашлось');
    const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: [`Персонаж: ${A.canonName(who)}`, lore ? `Лорбук:\n${lore}` : '', card ? `Карточка:\n${A.cut(card, 4000)}` : ''].filter(Boolean).join('\n\n') }], 1500);
    const j = A.extractJson(out);
    const list = (Array.isArray(j?.habits) ? j.habits : []).map(x => String(x || '').trim()).filter(x => x.length > 6).slice(0, 40);
    if (!list.length) throw new Error('модель не нашла привычек');
    const c = cfg();
    const k = keyOf(who) || A.canonName(who);
    const have = c.list[k] || [];
    const norm = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '');
    let n = 0;
    for (const t of list) if (!have.some(h => norm(h.t) === norm(t))) { have.push({ id: `h${Date.now().toString(36)}${n}`, t: t.slice(0, 160), on: true }); n++; }
    c.list[k] = have;
    A.saveSettings();
    return n;
}

// ───────────── вид ─────────────

export function habitsHtml(who) {
    if (!A?.hasChat?.() || A.sameName(who, A.ctx().name1)) return '';
    const list = habitsOf(who);
    const N = esc(who);
    return `${A.sec('Привычки', list.length ? `${list.filter(h => h.on !== false).length} · модели по одной через ход` : '')}
    ${list.length ? `<div class="lf-hab">${list.map(h => `<span class="lf-hab-c${h.on === false ? ' off' : ''}"><button data-act="hab-tog" data-name="${N}" data-id="${h.id}">${esc(h.t)}</button><button data-act="hab-del" data-name="${N}" data-id="${h.id}">${A.icon('x')}</button></span>`).join('')}</div>` : '<div class="lf-hint">Соберу микро-привычки из психо-лорбука — модель будет показывать их по одной, к месту, не подряд.</div>'}
    <div class="lf-actions"><button class="lf-btn" data-act="hab-lore" data-name="${N}">${A.icon('book')} Собрать из лорбука</button><button class="lf-btn ghost" data-act="hab-add" data-name="${N}">${A.icon('plus')} Своя</button></div>`;
}

export async function habitsClick(act, el) {
    if (!act.startsWith('hab-')) return false;
    const who = el.dataset.name;
    const list = habitsOf(who);
    const done = () => { A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'hab-tog': { const h = list.find(x => x.id === el.dataset.id); if (h) h.on = h.on === false; return done(); }
        case 'hab-del': { const k = list.findIndex(x => x.id === el.dataset.id); if (k >= 0) list.splice(k, 1); return done(); }
        case 'hab-lore': await A.withBusy(el, async () => { const n = await collect(who); A.toast('success', n ? `Привычек: ${n}` : 'Новых не нашлось', `✦ ${esc(A.shortName(who))}`, { timeOut: 2200 }); }, 'Читаю…'); A.render(); return true;
        case 'hab-add': {
            A.openSheet(`${A.icon('sparkles')} Привычка · ${esc(A.shortName(who))}`, `<div class="lf-field"><label>Что делает</label><input type="text" data-in="hab-t" placeholder="мурлычет под нос Гленна Миллера"></div><button class="lf-btn primary full" data-act="hab-save" data-name="${esc(who)}">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'hab-save': {
            const t = (el.closest('.lf-sheet') || document).querySelector('[data-in="hab-t"]')?.value?.trim();
            if (!t) return true;
            const c = cfg();
            const k = keyOf(who) || A.canonName(who);
            (c.list[k] || (c.list[k] = [])).push({ id: `h${Date.now().toString(36)}`, t: t.slice(0, 160), on: true });
            A.closeSheet();
            return done();
        }
    }
    return false;
}
