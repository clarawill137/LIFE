// Тропы, курс пары и хедканоны. Это задаёшь ТЫ, не Летописец: какими тропами живёт пара (слоубёрн,
// hurt/comfort, «враги → любовники»…), куда ты её ведёшь — и свои хедканоны про человека или пару («Баки
// всегда спит у двери», «Тони мирится едой»). Пока оба в сцене, модель получает тропы и курс; хедканоны
// подмешиваются по два-три — сперва те, что перекликаются с последними постами. Ничего не выдумывает само.

import { str, mains, present } from './hudkit.js';

let A = null;
export function initPair(api) { A = api; }
const esc = (v) => A.esc(v);

const TROPES = ['слоубёрн', 'hurt/comfort', 'враги → любовники', 'друзья → любовники', 'запретное', 'found family', 'домашний флафф', 'ангст с хорошим концом', 'ревность', 'взаимная тоска', 'защитник', 'только одна кровать', 'притворяются парой', 'второй шанс', 'он падает первым', 'она падает первой', 'соперники', 'тайные отношения', 'забота через поступки', 'общая травма'];

function cfg() {
    const s = A.settings();
    if (!s.pair || typeof s.pair !== 'object') s.pair = {};
    if (s.pair.on === undefined) s.pair.on = true;
    return s.pair;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.pair || typeof cm.pair !== 'object') cm.pair = {};
    if (!cm.pair.pairs || typeof cm.pair.pairs !== 'object') cm.pair.pairs = {};   // «a|b» → { tropes: [], course: '' }
    if (!Array.isArray(cm.pair.hc)) cm.pair.hc = [];                               // { id, who: [имена], t }
    if (!Number.isFinite(cm.pair.seq)) cm.pair.seq = 0;
    return cm.pair;
}
const keyOf = (a, b) => [A.canonName(a), A.canonName(b)].sort().join('|');
function pairOf(a, b) { const s = M(); const k = keyOf(a, b); if (!s.pairs[k]) s.pairs[k] = { tropes: [], course: '' }; return s.pairs[k]; }
const everyone = () => [A.canonName(A.ctx().name1), ...mains(A)].filter(Boolean);

/** Хедканоны для тех, кто в сцене: сначала перекликающиеся с последними постами, остальные по кругу. */
function pickHc(here) {
    const s = M();
    const list = s.hc.filter(h => !h.off && h.who.some(n => here.some(x => A.sameName(x, n))));
    if (list.length <= 3) return list;
    const text = A.norm(A.chatArr().slice(-3).map(m => A.plainText(m?.mes || '')).join(' '));
    const score = (h) => A.norm(h.t).split(/[^a-zа-я0-9]+/i).filter(w => w.length > 4).filter(w => text.includes(w.slice(0, 5))).length;
    const turn = A.chatArr().length;
    return list.map((h, k) => ({ h, sc: score(h) * 10 + ((k + turn) % list.length === 0 ? 5 : 0) + ((k + turn) % list.length) / 100 })).sort((x, y) => y.sc - x.sc).slice(0, 3).map(x => x.h);
}

export function pairPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const all = everyone();
    const p = present(A);
    const here = p.length ? all.filter(n => p.some(x => A.sameName(x, n))) : all;
    const out = [];
    for (const [k, v] of Object.entries(s.pairs)) {
        const [a, b] = k.split('|');
        if (!(v.tropes?.length || v.course) || ![a, b].every(n => here.some(x => A.sameName(x, n)))) continue;
        out.push(`[Пара ${A.shortName(a)} × ${A.shortName(b)} — замысел автора${v.tropes?.length ? `: тропы — ${v.tropes.join(', ')}` : ''}${v.course ? `; курс — ${v.course}` : ''}. Это рамка, а не сценарий: веди к этому шагами по ходу сцены, не перепрыгивая и не объявляя.]`);
    }
    const hc = pickHc(here);
    if (hc.length) out.push(`[Хедканоны автора (верны в этой истории): ${hc.map(h => `${h.who.map(A.shortName).join(' и ')} — ${h.t}`).join('; ')}. Пусть проявляются к месту, деталью, без пересказа.]`);
    return out.join('\n');
}

/** Персонаж → Жизнь → Психика. */
export function pairHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const s = M();
    const others = everyone().filter(n => !A.sameName(n, name));
    const pairs = others.map(o => { const v = s.pairs[keyOf(name, o)]; return { o, v }; });
    const mine = s.hc.filter(h => h.who.some(n => A.sameName(n, name)));
    return `${A.sec('Тропы и курс', 'задаёшь ты')}
    <div class="lf-pr">${pairs.map(({ o, v }) => `<button class="lf-pr-p${v?.tropes?.length || v?.course ? ' on' : ''}" data-act="pr-edit" data-a="${esc(name)}" data-b="${esc(o)}">${A.ava(o, 'xs')}<span><b>с ${esc(A.shortName(o))}</b><small>${v?.tropes?.length || v?.course ? esc([v.tropes?.join(', '), v.course].filter(Boolean).join(' · ')) : 'не задано — тап'}</small></span></button>`).join('')}</div>
    ${A.sec('Хедканоны', mine.length ? String(mine.length) : '')}
    ${mine.length ? `<div class="lf-pr-hc">${mine.map(h => `<div class="${h.off ? 'off' : ''}"><span>${h.who.length > 1 ? `<i>${esc(h.who.map(A.shortName).join(' + '))}</i> ` : ''}${esc(h.t)}</span><button data-act="pr-hoff" data-id="${h.id}" title="${h.off ? 'включить' : 'придержать'}">${A.icon(h.off ? 'plus' : 'check')}</button><button data-act="pr-hdel" data-id="${h.id}" title="убрать">${A.icon('x')}</button></div>`).join('')}</div>` : '<div class="lf-hint">Твои «в моей голове это так»: привычки, мелочи, как он любит и злится. Модель будет держать их за правду.</div>'}
    <button class="lf-btn ghost full" data-act="pr-hadd" data-who="${esc(name)}">${A.icon('plus')} Хедканон</button>`;
}

function editSheet(a, b) {
    const v = pairOf(a, b);
    A.openSheet(`${A.icon('heart')} ${esc(A.shortName(a))} × ${esc(A.shortName(b))}`, `
        <div class="lf-field"><label>Тропы</label><div class="lf-chips wrap">${[...new Set([...TROPES, ...v.tropes])].map(t => `<button class="lf-chip${v.tropes.includes(t) ? ' on' : ''}" data-act="pr-trope" data-a="${esc(a)}" data-b="${esc(b)}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
        <div class="lf-field"><label>Свой троп</label><input type="text" data-in="pr-own" placeholder="например: «он учится быть мужем»"></div>
        <div class="lf-field"><label>Курс — куда ведёшь</label><textarea rows="3" data-in="pr-course" placeholder="к чему пара должна прийти и как: медленно, через что">${esc(v.course || '')}</textarea></div>
        <button class="lf-btn primary full" data-act="pr-save" data-a="${esc(a)}" data-b="${esc(b)}">${A.icon('check')} Сохранить</button>`);
}

export function pairClick(act, el) {
    if (!act.startsWith('pr-')) return false;
    const s = M();
    const box = el.closest('.lf-sheet') || document;
    const a = el.dataset.a, b = el.dataset.b;
    const h = s.hc.find(x => x.id === el.dataset.id);
    switch (act) {
        case 'pr-edit': editSheet(a, b); return true;
        case 'pr-trope': { const v = pairOf(a, b); const t = el.dataset.t; v.tropes = v.tropes.includes(t) ? v.tropes.filter(x => x !== t) : [...v.tropes, t].slice(0, 6); el.classList.toggle('on'); A.saveMeta(); A.updatePrompt(); return true; }
        case 'pr-save': { const v = pairOf(a, b); const own = str(box.querySelector('[data-in="pr-own"]')?.value, 60); if (own && !v.tropes.includes(own)) v.tropes = [...v.tropes, own].slice(0, 6); v.course = str(box.querySelector('[data-in="pr-course"]')?.value, 400); A.closeSheet(); break; }
        case 'pr-hadd': {
            const who = A.canonName(el.dataset.who);
            A.openSheet(`${A.icon('plus')} Хедканон`, `
                <div class="lf-field"><label>Что это</label><textarea rows="3" data-in="pr-ht" placeholder="Баки всегда садится лицом к двери"></textarea></div>
                <div class="lf-field"><label>Про кого</label><div class="lf-chips wrap">${everyone().map(n => `<label class="lf-chip"><input type="checkbox" data-in="pr-hw" value="${esc(n)}"${A.sameName(n, who) ? ' checked' : ''}> ${esc(A.shortName(n))}</label>`).join('')}</div></div>
                <button class="lf-btn primary full" data-act="pr-hsave">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'pr-hsave': { const t = str(box.querySelector('[data-in="pr-ht"]')?.value, 300); const who = [...box.querySelectorAll('[data-in="pr-hw"]:checked')].map(x => x.value); if (!t || !who.length) return true; s.hc.push({ id: `h${++s.seq}`, who, t }); A.closeSheet(); break; }
        case 'pr-hoff': if (h) h.off = !h.off; break;
        case 'pr-hdel': if (h) s.hc = s.hc.filter(x => x !== h); break;
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}
