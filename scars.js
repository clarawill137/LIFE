// Шрамы доверия. Шкалы отношений Life знали, НАСКОЛЬКО сдвинулось доверие, но не ЗА ЧТО. Теперь Летописец
// пишет причину заметного сдвига; глубокая рана или падение на 12 и больше оставляет шрам: персонаж помнит
// обиду, пока доверие не вернётся на прежний уровень. После большого сдвига он ещё пару ответов «под впечатлением».
// Доверие растёт ступенями (черты 20/40/60/80 — только с ключевым событием). Идея — «Шрамы отношений»
// и ступени доверия TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, arr } from './hudkit.js';

let A = null;
export function initScars(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.scars || typeof s.scars !== 'object') s.scars = {};
    if (s.scars.on === undefined) s.scars.on = true;
    return s.scars;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.scars || typeof cm.scars !== 'object') cm.scars = {};
    if (!Array.isArray(cm.scars.list)) cm.scars.list = [];   // шрамы
    if (!Array.isArray(cm.scars.log)) cm.scars.log = [];     // причины сдвигов
    if (!Number.isFinite(cm.scars.seq)) cm.scars.seq = 0;
    return cm.scars;
}
const trustNow = (from, to) => { try { const r = A.relOf(from, to); return r ? Math.round(r.trust) : null; } catch { return null; } };
/** Шрам ещё болит: доверие не вернулось туда, где было до раны. */
const open = (x) => { if (x.off) return false; const t = trustNow(x.from, x.to); return t === null || t < x.was; };

const RULE = `
trustWhy — ЗА ЧТО в этом посте сдвинулось доверие (к каждой записи relations, где trust изменился на 5 и больше): [{"from":"кто","to":"к кому","why":"за что, 3-10 слов","deep":false,"key":false}]. deep: true — глубокая рана (предательство, ложь в важном, унижение при других, бросил в беде). key: true — ключевое событие, после которого доверие вправе перешагнуть ступень: помощь без выгоды, опасность, пережитая вместе, доверенная тайна, поддержка в слабости, жертва. Доверие растёт ступенями — черты 20, 40, 60 и 80 вверх пересекаются только в посте с ключевым событием, одни разговоры останавливают его чуть ниже черты; падать оно может без события. Нечего — [].`;

export function scarsChron() {
    if (!A?.hasChat?.() || !on()) return null;
    return { key: '"trustWhy": []', rule: RULE, tokens: 110, input: '' };
}

export function scarsAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    s.list = s.list.filter(x => x.mes !== i);
    s.log = s.log.filter(x => x.mes !== i);
    const why = arr(j?.trustWhy);
    let changed = false;
    for (const r of arr(j?.relations)) {
        const from = A.canonName(str(r?.from || r?.a, 50)), to = A.canonName(str(r?.to || r?.b, 50));
        const d = Math.round(Number(r?.trust) || 0);
        if (!from || !to || Math.abs(d) < 5) continue;
        const w = why.find(x => A.sameName(str(x?.from), from) && A.sameName(str(x?.to), to)) || why.find(x => A.sameName(str(x?.from), from));
        const reason = str(w?.why, 110) || str(r?.moment, 110);
        const now = trustNow(from, to);
        s.log.push({ from, to, d, why: reason, mes: i, now });
        if (d <= -12 || (d < 0 && w?.deep === true)) {
            s.list.push({ id: `sc${++s.seq}`, from, to, why: reason || 'доверие упало', d, was: now === null ? 50 : Math.min(100, now - d), mes: i, at: Date.now() });
        }
        changed = true;
    }
    if (s.log.length > 120) s.log.splice(0, s.log.length - 120);
    if (s.list.length > 60) s.list.splice(0, s.list.length - 60);
    if (changed) A.saveMeta();
}

export function scarsPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const n = A.chatArr().length;
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const inScene = (x) => !here.length || here.some(h => A.sameName(h, x.from));
    const out = [];
    // под впечатлением — два ответа после большого сдвига
    const hit = s.log.filter(x => Math.abs(x.d) >= 10 && n - 1 - x.mes <= 3 && inScene(x)).slice(-2);
    if (hit.length) out.push(`[Под впечатлением: ${hit.map(x => `${A.shortName(x.from)} ${x.d < 0 ? 'задет(а)' : 'тронут(а)'} — ${x.why || 'то, что случилось'} (к ${A.shortName(x.to)})`).join('; ')}. Это ещё не улеглось и окрашивает тон, взгляды и мелочи.]`);
    // шрамы — раз в три ответа или сразу, если свежий
    const list = s.list.filter(x => open(x) && inScene(x)).slice(-4);
    if (list.length && (list.some(x => n - 1 - x.mes <= 2) || n % 3 === 0)) {
        out.push(`[Шрамы доверия: ${list.map(x => `${A.shortName(x.from)} помнит — «${x.why}» (к ${A.shortName(x.to)}; доверие не вернулось)`).join('; ')}. Не прощено до конца: проверяет, переспрашивает, держит дистанцию в мелочах, может припомнить в споре. Заживает поступком, не словами — и не за один ответ.]`);
    }
    return out.join('\n');
}

/** Персонаж → Жизнь → Психика: шрамы и последние причины сдвигов. */
export function scarsHtml(who) {
    if (!on()) return '';
    const s = M();
    const name = A.canonName(who);
    const mine = s.list.filter(x => !x.off && (A.sameName(x.from, name) || A.sameName(x.to, name))).slice(-6).reverse();
    const log = s.log.filter(x => A.sameName(x.from, name)).slice(-5).reverse();
    if (!mine.length && !log.length) return `${A.sec('Доверие: причины и шрамы')}<div class="lf-hint">Здесь будет, за что сдвигалось доверие, и шрамы — обиды, которые помнят, пока доверие не вернётся.</div>`;
    return `${A.sec('Доверие: причины и шрамы', mine.filter(open).length ? `${mine.filter(open).length} болит` : '')}
    ${mine.length ? `<div class="lf-scr">${mine.map(x => { const t = trustNow(x.from, x.to); const healed = !open(x); return `<div class="lf-scr-c${healed ? ' healed' : ''}"><div class="lf-scr-h">${A.ava(x.from, 'xs')}<i>→</i>${A.ava(x.to, 'xs')}<b>${esc(x.why)}</b><button data-act="scr-del" data-id="${x.id}" title="убрать шрам">${A.icon('x')}</button></div><small>${healed ? 'зажило — доверие вернулось' : `доверие ${t ?? '?'} из прежних ${x.was}`} · <button class="lf-link" data-act="jump" data-mes="${x.mes}">пост #${x.mes}</button></small></div>`; }).join('')}</div>` : ''}
    ${log.length ? `<div class="lf-scr-log">${log.map(x => `<div class="${x.d < 0 ? 'neg' : 'pos'}"><b>${x.d > 0 ? '+' : ''}${x.d}</b><span>к ${esc(A.shortName(x.to))}${x.why ? ` — ${esc(x.why)}` : ''}</span></div>`).join('')}</div>` : ''}`;
}

export function scarsClick(act, el) {
    if (!act.startsWith('scr-')) return false;
    if (act === 'scr-del') {
        const x = M().list.find(y => y.id === el.dataset.id);
        if (x && confirm('Убрать шрам? Модель перестанет о нём напоминать; вернуть сможет только новое падение доверия.')) x.off = true;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function scarsRecs(i) {
    const s = M();
    return [
        ...s.list.filter(x => x.mes === i).map(x => ({ id: `scr:${x.id}`, g: 'Доверие', icon: 'handshake', t: `шрам: ${A.shortName(x.from)} → ${A.shortName(x.to)} — ${x.why}`, del: () => { s.list = s.list.filter(y => y !== x); } })),
        ...s.log.filter(x => x.mes === i && x.why).map((x, k) => ({ id: `scr:l${k}`, g: 'Доверие', icon: 'handshake', t: `${x.d > 0 ? '+' : ''}${x.d} ${A.shortName(x.from)} → ${A.shortName(x.to)}: ${x.why}`, del: () => { s.log = s.log.filter(y => y !== x); } })),
    ];
}
