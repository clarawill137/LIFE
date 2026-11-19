// Под словами. К каждому ответу Летописец выписывает слой ПОД текстом — у главных, кто действует в посте:
// мысль, которую он не сказал, скрытый подтекст (что прячет от других и от себя), «ждал — получил» и чего боится.
// Под постом — чип «💭 под словами»; модель получает этот слой, чтобы он просачивался жестом и паузой.
// Идея — поля «мысль», «подтекст», «ожидание и реальность», «страхи» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, arr, mount } from './hudkit.js';

let A = null;
export function initUnder(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.under || typeof s.under !== 'object') s.under = {};
    if (s.under.on === undefined) s.under.on = true;
    if (s.under.feed === undefined) s.under.feed = true;     // отдавать слой модели
    if (s.under.chip === undefined) s.under.chip = true;     // чип под постом
    return s.under;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.under || typeof cm.under !== 'object') cm.under = {};
    if (!cm.under.by || typeof cm.under.by !== 'object') cm.under.by = {};
    return cm.under;
}
/** Запись поста i — только если пост с тех пор не меняли. */
function of(i) {
    const e = M().by[i];
    const m = A.chatArr()[i];
    return e && m && e.h === A.hash(m.mes || '') ? e : null;
}

export function underChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const user = A.shortName(A.canonName(A.ctx().name1));
    const rule = `
under — слой ПОД текстом у главных, кто действует в посте (НЕ ${user}; не больше двух человек): [{"who":"имя","th":"одна мысль его голосом, которую он НЕ сказал вслух и которой нет в тексте поста","sub":"скрытый подтекст: что он прячет от других, а часто и от себя, — мелкий жест, оговорка, мотив или страх под словами; сам бы он это отрицал; 1-2 предложения","xp":"чего ждал от этого момента, 3-10 слов","gt":"что получил, 3-10 слов (совпало — так и напиши)","fear":"чего боится прямо сейчас, 2-6 слов, или пусто"}]. Не пересказывай пост: только то, что под ним, в характере персонажа и по истории. Нечего — [].`;
    return { key: '"under": []', rule, tokens: 260, input: '' };
}

export function underAfterPost(i, j, m) {
    if (!on()) return;
    const s = M();
    const user = A.canonName(A.ctx().name1);
    const list = arr(j?.under).slice(0, 2).map(r => ({
        who: A.canonName(str(r?.who, 50)), th: str(r?.th, 220), sub: str(r?.sub, 320), xp: str(r?.xp, 90), gt: str(r?.gt, 90), fear: str(r?.fear, 60),
    })).filter(r => r.who && !A.sameName(r.who, user) && (r.th || r.sub));
    if (list.length) s.by[i] = { h: A.hash((m || A.chatArr()[i])?.mes || ''), list };
    else delete s.by[i];
    const keys = Object.keys(s.by).map(Number).sort((a, b) => a - b);
    for (const k of keys.slice(0, Math.max(0, keys.length - 80))) delete s.by[k];
    A.saveMeta();
    A.paintSoon?.();
}

/** Последний слой каждого главного — из последних ответов. */
function latest() {
    const out = new Map();
    const chat = A.chatArr();
    for (let i = chat.length - 1, seen = 0; i >= 0 && seen < 4; i--) {
        if (chat[i]?.is_user || chat[i]?.is_system) continue;
        seen++;
        for (const r of of(i)?.list || []) if (!out.has(r.who)) out.set(r.who, { ...r, mes: i });
    }
    return [...out.values()];
}

export function underPrompt(type) {
    if (!A?.hasChat?.() || !on() || !cfg().feed || type === 'quiet' || type === 'impersonate') return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const rows = latest().filter(r => !here.length || here.some(h => A.sameName(h, r.who))).slice(0, 2)
        .map(r => `${A.shortName(r.who)} — не сказал: «${r.th}»${r.sub ? `; прячет: ${r.sub}` : ''}${r.fear ? `; боится: ${r.fear}` : ''}`);
    if (!rows.length) return '';
    return `[Под словами (читателю не показано, продолжение прошлого ответа): ${rows.join(' | ')}. Это внутренний слой: пусть просачивается жестом, паузой, оговоркой, тем, о чём он молчит; вслух не проговаривай и дословно не повторяй.]`;
}

const cardHtml = (r) => `<div class="lf-und-c"><div class="lf-und-w">${A.ava(r.who, 'xs')}<b>${esc(A.shortName(r.who))}</b></div>
    ${r.th ? `<div class="lf-und-th">«${esc(r.th)}»</div>` : ''}
    ${r.sub ? `<div class="lf-und-r"><small>прячет</small>${esc(r.sub)}</div>` : ''}
    ${r.xp || r.gt ? `<div class="lf-und-x"><span><small>ждал</small>${esc(r.xp || '—')}</span><i>→</i><span><small>получил</small>${esc(r.gt || '—')}</span></div>` : ''}
    ${r.fear ? `<div class="lf-und-r fear"><small>боится</small>${esc(r.fear)}</div>` : ''}
    ${r.th ? `<button class="lf-und-say" data-act="cue-set" data-once="1" data-src="Под словами" data-key="und:${esc(r.who)}" data-text="${esc(`${A.shortName(r.who)} наконец произносит вслух то, о чём молчал: «${r.th}»`)}">⚡ пусть скажет это вслух</button>` : ''}</div>`;

const opened = new Set();

export function paintUnder(el, id) {
    const m = A.chatArr()[id];
    const e = on() && cfg().chip && m && !m.is_user && !m.is_system ? of(id) : null;
    if (!e) { mount(el, 'lf-und', '', A.hash); return; }
    const isOpen = opened.has(id);
    mount(el, 'lf-und', `<div class="lf-und lf-own${isOpen ? ' open' : ''}"><button class="lf-und-b" data-act="und-toggle" data-mes="${id}">💭 <span>под словами</span></button>${isOpen ? `<div class="lf-und-box">${e.list.map(cardHtml).join('')}</div>` : ''}</div>`, A.hash);
}

export function underClick(act, el) {
    if (!act.startsWith('und-')) return false;
    if (act === 'und-toggle') {
        const id = Number(el.dataset.mes);
        if (opened.has(id)) opened.delete(id); else opened.add(id);
        const box = el.closest('.mes');
        if (box) paintUnder(box, id);
        return true;
    }
    if (act === 'und-feed') { cfg().feed = !cfg().feed; A.saveSettings(); A.updatePrompt(); A.render(); return true; }
    if (act === 'und-chip') { cfg().chip = !cfg().chip; A.saveSettings(); A.paintSoon?.(); A.render(); return true; }
    return false;
}

/** Персонаж → Жизнь → Психика. */
export function underHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const rows = [];
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0 && rows.length < 4; i--) for (const r of of(i)?.list || []) if (A.sameName(r.who, name)) rows.push({ ...r, mes: i });
    const c = cfg();
    return `${A.sec('Под словами', rows.length ? 'последнее' : '')}
    ${rows.length ? `<div class="lf-und-box in">${rows.map(r => `<div class="lf-und-c"><div class="lf-und-th">«${esc(r.th)}»</div>${r.sub ? `<div class="lf-und-r"><small>прячет</small>${esc(r.sub)}</div>` : ''}${r.fear ? `<div class="lf-und-r fear"><small>боится</small>${esc(r.fear)}</div>` : ''}<button class="lf-link" data-act="jump" data-mes="${r.mes}">к посту #${r.mes}</button></div>`).join('')}</div>` : '<div class="lf-hint">Летописец выпишет, что у него под словами, после следующего ответа.</div>'}
    <div class="lf-chips wrap"><button class="lf-chip${c.feed ? ' on' : ''}" data-act="und-feed">модель это знает</button><button class="lf-chip${c.chip ? ' on' : ''}" data-act="und-chip">чип под постом</button></div>`;
}

export function underRecs(i) {
    const s = M();
    return (of(i)?.list || []).map((r, k) => ({ id: `und:${k}`, g: 'Под словами', icon: 'spark', t: `${A.shortName(r.who)}: «${A.cut(r.th || r.sub, 70)}»`, del: () => { const e = s.by[i]; if (e) { e.list = e.list.filter(x => x !== r); if (!e.list.length) delete s.by[i]; } } }));
}
