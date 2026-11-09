// Триггеры. У Баки — русские кодовые слова, холод и крио, фиксация рук; у Хеди — Красная комната (и своё — руками).
// Сработало в посте (слово в тексте или Летописец увидел) — реакция по-настоящему, по силе ступени:
// 3 — эпизод (диссоциация, бой или бегство), 2 — сильная реакция, но держится, 1 — вздрагивает и переводит дух.
// Эпизоды пишутся; со временем и с поддержкой триггер слабеет — ступенька вниз (как «Прожитое»).

let A = null;
export function initTriggers(api) { A = api; }

const esc = (v) => A.esc(v);
const DAY = 864e5;
export const LVL = ['отпустило', 'вздрагивает, переводит дух', 'сильная реакция, но держится', 'эпизод: диссоциация, бой или бегство'];

const SEED = {
    bucky: [
        { t: 'Русские кодовые слова', re: 'желание|ржав|семнадцат|рассвет|(?<![а-яёa-z0-9])печь(?![а-яёa-z0-9])|девять|добросердечн|возвращение на родину|грузов\\w* вагон|longing|rusted|furnace|daybreak|benign|homecoming|freight car', lvl: 3, how: 'голос из головы, тело вспоминает раньше разума: застывает, взгляд пустеет — или бросается' },
        { t: 'Холод и крио', re: 'крио|криокамер|капсул\\w* заморозк|морозильн|ледян\\w* вод|обледен|cryo', lvl: 2, how: 'дыхание сбивается, мерещится стекло капсулы, тянет уйти в тепло' },
        { t: 'Фиксация рук', re: 'наручник|связа\\w* рук|фиксатор|ремн\\w* на запясть|пристегн\\w* к кресл|кресл\\w* для обнулен|обнулен', lvl: 3, how: 'рвёт фиксацию любой ценой, металлическая рука ломает всё' },
    ],
    hedy: [
        { t: 'Красная комната', re: 'красн\\w* комнат|red room|дрейков|мадам б|выпускн\\w* церемон|балетн\\w* класс', lvl: 2, how: 'холодеет, лицо становится маской, тело встаёт в стойку' },
    ],
};

function cfg() {
    const s = A.settings();
    if (!s.trig || typeof s.trig !== 'object') s.trig = {};
    const c = s.trig;
    if (c.on === undefined) c.on = true;
    if (!c.list || typeof c.list !== 'object') c.list = {};      // имя → [{ id, t, re, lvl, how }]
    if (!c.seeded) seed(c);
    return c;
}
export const trigOn = () => cfg().on !== false;

function seed(c) {
    let names = [];
    try { names = [A.ctx().name1, ...A.groupMembers()].map(A.canonName).filter(Boolean); } catch { /* */ }
    if (!names.length) return;
    c.seeded = 1;
    const bucky = names.find(n => /баки|bucky|барнс|barnes/i.test(n));
    const hedy = names.find(n => /^(хеди|hedy|ядвига)/i.test(n));
    let k = 0;
    if (bucky && !c.list[bucky]) c.list[bucky] = SEED.bucky.map(x => ({ id: `t${++k}`, ...x }));
    if (hedy && !c.list[hedy]) c.list[hedy] = SEED.hedy.map(x => ({ id: `t${++k}`, ...x }));
    A.saveSettings();
}

/** Состояние триггеров в этом чате: id → { lvl, work, eps: [{ mes, at, t, coped }] } */
function M() {
    const cm = A.chatMeta();
    if (!cm.trig || typeof cm.trig !== 'object') cm.trig = {};
    const m = cm.trig;
    if (!m.st || typeof m.st !== 'object') m.st = {};
    return m;
}
function stOf(who, tr) {
    const k = `${A.canonName(who)}|${tr.id}`;
    const m = M();
    if (!m.st[k]) m.st[k] = { lvl: tr.lvl, work: 0, eps: [], steps: [] };
    return m.st[k];
}

export function listOf(who) { const c = cfg(); const k = Object.keys(c.list).find(n => A.sameName(n, who)); return k ? c.list[k] : []; }
function allPairs() { const out = []; for (const [who, list] of Object.entries(cfg().list)) for (const tr of list || []) out.push([who, tr]); return out; }

const re = (tr) => { try { return new RegExp(tr.re, 'i'); } catch { return null; } };

function storyT(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) {
        const ts = chat[j]?.horae_meta?.timestamp;
        if (ts?.story_date) { const d = A.parseDate(ts.story_date); if (d && !isNaN(d)) return d.getTime(); }
    }
    return null;
}

/** Время лечит: каждые 45 дней истории без эпизодов — немного «работы». */
function timeHeal(st, now) {
    if (now == null || !st.eps.length) return;
    const last = st.eps[st.eps.length - 1].at;
    if (last == null) return;
    const quiet = Math.floor((now - last) / (45 * DAY));
    if (quiet > (st.quiet || 0)) { st.work += quiet - (st.quiet || 0); st.quiet = quiet; stepDown(st); }
}
function stepDown(st) {
    while (st.lvl > 0 && st.work >= 3) {
        st.work -= 3;
        st.lvl -= 1;
        st.steps.push({ lvl: st.lvl, at: Date.now() });
    }
}

// ───────────── что сработало в тексте ─────────────

function hitsIn(text, onlyWho = null) {
    const t = A.plainText ? A.plainText(text) : String(text || '');
    const out = [];
    for (const [who, tr] of allPairs()) {
        if (onlyWho && !A.sameName(who, onlyWho)) continue;
        const r = re(tr);
        if (r && r.test(t)) out.push({ who, tr, word: (t.match(r) || [''])[0] });
    }
    return out;
}

function userIndexFor(type) {
    const chat = A.chatArr();
    let end = chat.length - 1;
    if (type === 'swipe') end = chat.length - 2;
    for (let i = end; i >= 0; i--) { const m = chat[i]; if (!m || m.is_system) continue; return m.is_user ? i : -1; }
    return -1;
}

// ───────────── заметка модели ─────────────

export function trigPrompt(type) {
    if (!A?.hasChat?.() || !trigOn() || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const user = A.canonName(A.ctx().name1);
    const live = allPairs().filter(([who]) => !here.length || here.some(h => A.sameName(h, who)));
    if (!live.length) return '';
    const now = storyT(A.chatArr().length - 1);
    for (const [who, tr] of live) timeHeal(stOf(who, tr), now);
    // что сработало прямо сейчас — в посте игрока, на который отвечают
    const ui = userIndexFor(type || 'normal');
    const hot = ui >= 0 ? hitsIn(A.chatArr()[ui]?.mes || '').filter(h => !here.length || here.some(x => A.sameName(x, h.who))) : [];
    const parts = [];
    for (const h of hot) {
        const st = stOf(h.who, h.tr);
        if (!st.lvl) continue;
        const mine = A.sameName(h.who, user);
        parts.push(mine
            ? `в посте прозвучало «${h.word}» — триггер ${A.shortName(h.who)} (${h.tr.t}); её реакцию пишет она сама — персонажи замечают внешнее и реагируют`
            : `в посте прозвучало «${h.word}» — триггер ${A.shortName(h.who)} (${h.tr.t}), сила сейчас: ${LVL[st.lvl]}. ${h.tr.how ? `Как это у него: ${h.tr.how}.` : ''} Сыграй реакцию по-настоящему, без мелодрамы и без мгновенного «всё в порядке»`);
    }
    const quiet = live.filter(([who, tr]) => stOf(who, tr).lvl > 0 && !A.sameName(who, user)).map(([who, tr]) => `${A.shortName(who)} — ${tr.t.toLowerCase()} (${LVL[stOf(who, tr).lvl]})`);
    if (!parts.length && !quiet.length) return '';
    return `[Триггеры${parts.length ? ` — СРАБОТАЛО: ${parts.join('; ')}.` : '.'}${quiet.length ? ` ${parts.length ? 'Всё, ' : ''}что задевает в этой сцене: ${quiet.join('; ')} — не дёргай без нужды, но если задело — реакция настоящая, по силе.` : ''}]`;
}

// ───────────── Летописец: эпизоды ─────────────

const RULE = `
trig — эпизоды триггеров в ЭТОМ посте (по списку «Триггеры»): [{"id":"t2","who":"имя","t":"что случилось, 5–14 слов","coped":true}]. coped — справился (сам или с поддержкой, проговорили, успокоили), false — эпизод накрыл. Только если в посте триггер правда сработал. Нечего — [].`;

export function trigChron() {
    if (!A?.hasChat?.() || !trigOn()) return null;
    const rows = allPairs().map(([who, tr]) => `[${tr.id}] ${who} — ${tr.t}`);
    if (!rows.length) return null;
    return { key: '"trig": []', rule: RULE, tokens: 80, input: `Триггеры: ${rows.join('; ')}` };
}

export function trigAfterPost(i, j, m) {
    if (!trigOn()) return;
    const at = storyT(i);
    // свайп — откатить эпизоды этого поста
    for (const st of Object.values(M().st)) {
        const had = st.eps.filter(e => e.mes === i);
        if (!had.length) continue;
        st.eps = st.eps.filter(e => e.mes !== i);
        for (const e of had) {
            if (e.stepped) { st.lvl = Math.min(3, st.lvl + e.stepped); st.steps.splice(-e.stepped); st.work += 3 * e.stepped; }
            st.work = Math.max(0, st.work - (e.coped ? 1 : 0.5));
        }
    }
    const seen = new Set();
    const add = (who, tr, t, coped) => {
        const st = stOf(who, tr);
        const k = `${A.canonName(who)}|${tr.id}`;
        if (seen.has(k)) return;
        seen.add(k);
        const e = { mes: i, at, t: String(t || '').slice(0, 120), coped: !!coped };
        st.eps.push(e);
        if (st.eps.length > 40) st.eps.splice(0, st.eps.length - 40);
        st.work += coped ? 1 : 0.5;
        st.quiet = 0;
        const before = st.lvl;
        stepDown(st);
        if (st.lvl < before) e.stepped = before - st.lvl;
    };
    for (const r of Array.isArray(j?.trig) ? j.trig : []) {
        const pair = allPairs().find(([w, tr]) => tr.id === String(r?.id || '') && (!r.who || A.sameName(w, r.who)));
        if (pair) add(pair[0], pair[1], r.t, r.coped === true || r.coped === 'true');
    }
    A.saveMeta();
}

// ───────────── вид: Персонаж → Жизнь → Психика ─────────────

export function trigHtml(who) {
    if (!A?.hasChat?.()) return '';
    const list = listOf(who);
    const N = esc(who);
    const dots = (l) => `<i class="lf-tr-l">${[1, 2, 3].map(k => `<b class="${k <= l ? 'on' : ''}"></b>`).join('')}</i>`;
    return `${A.sec('Триггеры', list.length ? `${list.length}` : '')}
    ${list.length ? `<div class="lf-tr">${list.map(tr => {
        const st = stOf(who, tr);
        const last = st.eps[st.eps.length - 1];
        return `<div class="lf-tr-r">
            <div class="lf-tr-h"><b>${esc(tr.t)}</b>${dots(st.lvl)}<button data-act="trg-edit" data-name="${N}" data-id="${tr.id}">${A.icon('pencil')}</button></div>
            <small>${esc(LVL[st.lvl])}${st.eps.length ? ` · эпизодов: ${st.eps.length}` : ''}${st.steps.length ? ` · ступенек вниз: ${st.steps.length}` : ''}</small>
            ${last ? `<em>${esc(last.t || 'эпизод')}${last.coped ? ' — справился' : ''}</em>` : ''}
            <div class="lf-tr-b"><button data-act="trg-down" data-name="${N}" data-id="${tr.id}">ступенька вниз</button><button data-act="trg-up" data-name="${N}" data-id="${tr.id}">сильнее</button></div>
        </div>`;
    }).join('')}</div>` : '<div class="lf-hint">Триггеров нет.</div>'}
    <button class="lf-btn ghost full" data-act="trg-edit" data-name="${N}" data-id="">${A.icon('plus')} Триггер</button>`;
}

export function trigClick(act, el) {
    if (!act.startsWith('trg-')) return false;
    const c = cfg();
    const who = el.dataset.name;
    const list = (() => { const k = Object.keys(c.list).find(n => A.sameName(n, who)) || A.canonName(who); if (!c.list[k]) c.list[k] = []; return c.list[k]; })();
    const tr = list.find(x => x.id === el.dataset.id);
    const done = () => { A.saveSettings(); A.saveMeta(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'trg-down': if (tr) { const st = stOf(who, tr); if (st.lvl > 0) { st.lvl--; st.steps.push({ lvl: st.lvl, at: Date.now(), me: true }); } } return done();
        case 'trg-up': if (tr) { const st = stOf(who, tr); st.lvl = Math.min(3, st.lvl + 1); } return done();
        case 'trg-edit': {
            const x = tr || { t: '', re: '', lvl: 2, how: '' };
            A.openSheet(`${A.icon('zap')} Триггер · ${esc(A.shortName(who))}`, `
                <div class="lf-field"><label>Что</label><input type="text" data-in="trg-t" value="${esc(x.t)}" placeholder="Холод и крио"></div>
                <div class="lf-field"><label>Слова в тексте (через |)</label><input type="text" data-in="trg-re" value="${esc(String(x.re || '').replace(/\\w\*/g, '*').replace(/\\b/g, ''))}" placeholder="крио|капсул*|морозильн"></div>
                <div class="lf-field"><label>Как это у него</label><input type="text" data-in="trg-how" value="${esc(x.how || '')}" placeholder="дыхание сбивается, тянет уйти в тепло"></div>
                <div class="lf-actions tight"><button class="lf-btn primary" data-act="trg-save" data-name="${esc(who)}" data-id="${esc(x.id || '')}">${A.icon('check')} Сохранить</button>${x.id ? `<button class="lf-btn ghost" data-act="trg-del" data-name="${esc(who)}" data-id="${esc(x.id)}">${A.icon('trash')} Убрать</button>` : ''}</div>`);
            return true;
        }
        case 'trg-save': {
            const box = el.closest('.lf-sheet') || document;
            const v = (k) => box.querySelector(`[data-in="${k}"]`)?.value?.trim() || '';
            const t = v('trg-t');
            if (!t) return true;
            const words = v('trg-re').split('|').map(w => w.trim()).filter(Boolean).map(w => w.replace(/[.+?^${}()[\]\\]/g, '\\$&').replace(/\*/g, '\\w*'));
            const rec = tr || { id: `t${Date.now().toString(36)}`, lvl: 2 };
            Object.assign(rec, { t: t.slice(0, 60), re: words.join('|'), how: v('trg-how').slice(0, 160) });
            if (!tr) list.push(rec);
            A.closeSheet();
            return done();
        }
        case 'trg-del': { const k = list.findIndex(x => x.id === el.dataset.id); if (k >= 0) list.splice(k, 1); A.closeSheet(); return done(); }
    }
    return false;
}
