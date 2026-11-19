// Способности с пределами и действующие эффекты. У героя — что он умеет с конкретным масштабом, где предел
// и чем платит (отдача): модель перестаёт то раздувать силу, то забывать о цене. Собирается по карточке одним
// тапом и правится руками. Эффекты (сыворотка, седативное, яд, алкоголь, обезболивающее) живут по времени
// истории: Летописец замечает, когда начались и на сколько. Модели — когда идёт бой, когда о силе речь, и пока
// эффект действует. Идея — «способности с пределами, отдача, чары с таймером» TavernOS HUD (alewwi).

import { storyNow, span, str, arr, clamp } from './hudkit.js';

let A = null;
export function initPowers(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.powers || typeof s.powers !== 'object') s.powers = {};
    if (s.powers.on === undefined) s.powers.on = true;
    return s.powers;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.powers || typeof cm.powers !== 'object') cm.powers = {};
    const s = cm.powers;
    if (!s.by || typeof s.by !== 'object') s.by = {};   // имя → [{ name, can, limit, cost }]
    if (!Array.isArray(s.fx)) s.fx = [];                // { id, who, what, hours, ts, at, mes }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const listOf = (who) => { const k = Object.keys(M().by).find(n => A.sameName(n, who)); return k ? M().by[k] : []; };
function fxLeft(x) { const now = storyNow(A); const gone = x.ts && now !== null ? now - x.ts : Date.now() - (x.at || Date.now()); return x.hours * 3600000 - gone; }
const fxLive = () => M().fx.filter(x => !x.off && fxLeft(x) > 0);
/** Мост: что сейчас действует на человека — [{ what, left }] (left — мс). */
export function powersFx(who) {
    try { return A?.hasChat?.() && on() ? fxLive().filter(x => A.sameName(x.who, who)).map(x => ({ what: x.what, left: fxLeft(x) })) : []; } catch { return []; }
}

const RULE = `
fx — действующие на человека вещества и эффекты, которые НАЧАЛИСЬ или КОНЧИЛИСЬ в этом посте (укол, сыворотка, седативное, яд, алкоголь, обезболивающее, наркотик, чары): [{"who":"на ком","what":"что и как действует, 2-8 слов","hours":4,"st":"on|off"}]. hours — на сколько примерно хватит. Нечего — [].`;

export function powersChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const cur = fxLive().map(x => `${A.shortName(x.who)}: ${x.what}`);
    return { key: '"fx": []', rule: RULE, tokens: 90, input: `Действующие эффекты: ${cur.length ? cur.join('; ') : 'нет'}` };
}

export function powersAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    s.fx = s.fx.filter(x => x.mes !== i);
    for (const x of s.fx) if (x.off === i) delete x.off;
    let changed = false;
    for (const r of arr(j?.fx).slice(0, 4)) {
        const who = A.canonName(str(r?.who, 50)), what = str(r?.what, 80);
        if (!who || !what) continue;
        if (str(r?.st) === 'off') { const x = fxLive().find(y => A.sameName(y.who, who)); if (x) { x.off = i; changed = true; } continue; }
        s.fx.push({ id: `e${++s.seq}`, who, what, hours: clamp(Number(r?.hours) || 2, 0.25, 240), ts: storyNow(A), at: Date.now(), mes: i });
        changed = true;
    }
    if (s.fx.length > 40) s.fx.splice(0, s.fx.length - 40);
    if (changed) A.saveMeta();
}

async function collect(who) {
    const card = A.cardOf(who);
    const persona = A.sameName(who, A.canonName(A.ctx().name1));
    let desc = [card?.description, card?.personality].filter(Boolean).join('\n').slice(0, 5000);
    if (!desc && persona) { try { const c = A.ctx(); desc = String(c.powerUserSettings?.persona_descriptions?.[c.chatMetadata?.persona || '']?.description || c.powerUserSettings?.persona_description || '').slice(0, 5000); } catch { /* */ } }
    let core = '';
    try { core = A.coreOf?.(who) || ''; } catch { /* */ }
    if (!desc && !core) throw new Error(`не нашла описание ${who} — впиши способности руками`);
    const sys = `Ты помощник автора ролевой истории. По описанию персонажа выпиши его особые способности и усиления (суперсила, сыворотка, магия, протез, выучка сверх нормы, гениальность). Ответ — строго один JSON по-русски: {"powers":[{"name":"название, 1-4 слова","can":"что умеет с КОНКРЕТНЫМ масштабом (поднимает ~400 кг, щит на одну комнату, не пьянеет)","limit":"где предел и что не может, 4-14 слов","cost":"чем платит: отдача, боль, истощение, риск срыва, 3-12 слов, или пусто"}]}. От 2 до 6, только то, что следует из описания; не усиливай и не выдумывай. Обычный человек без особых сил — {"powers":[]}.`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Персонаж: ${who}.\n${desc}${core ? `\nЯдро: ${A.cut(core, 800)}` : ''}` }], 1100, { check: (x) => Array.isArray(x?.powers), what: `Способности — ${A.shortName(who)}` });
    const list = arr(j.powers).slice(0, 6).map(p => ({ name: str(p?.name, 40), can: str(p?.can, 160), limit: str(p?.limit, 140), cost: str(p?.cost, 120) })).filter(p => p.name);
    const s = M();
    const k = Object.keys(s.by).find(n => A.sameName(n, who)) || who;
    s.by[k] = list;
    A.saveMeta();
    return list.length;
}

export function powersPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const out = [];
    const fx = fxLive();
    if (fx.length) out.push(`[Действует сейчас: ${fx.map(x => `${A.shortName(x.who)} — ${x.what} (ещё ~${span(fxLeft(x))})`).join('; ')}. Эффект не выключается сам раньше срока: он в речи, движениях, зрачках, реакции.]`);
    const fight = A.chatMeta().fight;
    const hot = !!(fight?.stage && fight.stage !== 'over');
    const text = A.norm(A.chatArr().slice(-2).map(m => A.plainText(m?.mes || '')).join(' '));
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const rows = [];
    for (const [n, list] of Object.entries(s.by)) {
        if (!list?.length || (here.length && !here.some(h => A.sameName(h, n)))) continue;
        const used = list.filter(p => hot || A.norm(p.name).split(' ').some(w => w.length > 4 && text.includes(w.slice(0, 5))));
        if (used.length) rows.push(`${A.shortName(n)}: ${used.slice(0, 4).map(p => `${p.name} — ${p.can}; предел: ${p.limit}${p.cost ? `; цена: ${p.cost}` : ''}`).join(' | ')}`);
    }
    if (rows.length) out.push(`[Способности и их пределы: ${rows.join(' || ')}. Сила работает в этих рамках: за предел — только с ценой, и цена видна сразу.]`);
    return out.join('\n');
}

/** Персонаж → Жизнь → Психика. */
export function powersHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const list = listOf(name);
    const fx = fxLive().filter(x => A.sameName(x.who, name));
    return `${A.sec('Способности и пределы', list.length ? String(list.length) : '')}
    ${list.length ? `<div class="lf-pw">${list.map((p, k) => `<div class="lf-pw-c"><div class="lf-pw-h"><b>${esc(p.name)}</b><button data-act="pw-del" data-who="${esc(name)}" data-n="${k}">${A.icon('x')}</button></div><p>${esc(p.can)}</p><small><i>предел</i> ${esc(p.limit || '—')}</small>${p.cost ? `<small class="cost"><i>цена</i> ${esc(p.cost)}</small>` : ''}</div>`).join('')}</div>` : '<div class="lf-hint">Что умеет, где предел и чем платит — чтобы сила не гуляла от сцены к сцене.</div>'}
    ${fx.length ? `<div class="lf-pw-fx">${fx.map(x => `<span>💉 ${esc(x.what)} · ещё ~${span(fxLeft(x))}<button data-act="pw-fxoff" data-id="${x.id}">${A.icon('x')}</button></span>`).join('')}</div>` : ''}
    <div class="lf-actions tight"><button class="lf-btn" data-act="pw-collect" data-who="${esc(name)}">${A.icon('sparkles')} ${list.length ? 'Пересобрать по карточке' : 'Собрать по карточке'}</button><button class="lf-btn ghost" data-act="pw-add" data-who="${esc(name)}">${A.icon('plus')} Своя</button></div>`;
}

export function powersSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const fx = fxLive();
    if (!fx.length) return '';
    return `${A.sec('Действует сейчас', String(fx.length))}<div class="lf-pw-fx">${fx.map(x => `<span>${A.ava(x.who, 'xs')}${esc(x.what)} · ещё ~${span(fxLeft(x))}<button data-act="pw-fxoff" data-id="${x.id}">${A.icon('x')}</button></span>`).join('')}</div>`;
}

export async function powersClick(act, el) {
    if (!act.startsWith('pw-')) return false;
    const s = M();
    const who = A.canonName(el.dataset.who || '');
    const k = Object.keys(s.by).find(n => A.sameName(n, who)) || who;
    switch (act) {
        case 'pw-collect': { const n = await A.withBusy(el, () => collect(who), 'Собираю…'); if (n === 0) A.toast('info', 'Особых способностей в описании не нашлось.', '✦ Способности'); break; }
        case 'pw-del': if (s.by[k]) s.by[k].splice(Number(el.dataset.n), 1); break;
        case 'pw-fxoff': { const x = s.fx.find(y => y.id === el.dataset.id); if (x) x.off = A.chatArr().length - 1; break; }
        case 'pw-add':
            A.openSheet(`${A.icon('zap')} Способность — ${esc(A.shortName(who))}`, `<div class="lf-field"><label>Название</label><input type="text" data-in="pw-name" placeholder="Железная рука"></div>
                <div class="lf-field"><label>Что умеет — с масштабом</label><input type="text" data-in="pw-can" placeholder="гнёт сталь, держит ~1 т"></div>
                <div class="lf-field"><label>Предел</label><input type="text" data-in="pw-limit" placeholder="перегрев, глушится ЭМИ"></div>
                <div class="lf-field"><label>Цена</label><input type="text" data-in="pw-cost" placeholder="боль в плече, фантомная"></div>
                <button class="lf-btn primary full" data-act="pw-save" data-who="${esc(who)}">${A.icon('check')} Записать</button>`);
            return true;
        case 'pw-save': {
            const box = el.closest('.lf-sheet') || document;
            const v = (q) => str(box.querySelector(`[data-in="${q}"]`)?.value, 160);
            if (!v('pw-name')) return true;
            s.by[k] = [...(s.by[k] || []), { name: v('pw-name').slice(0, 40), can: v('pw-can'), limit: v('pw-limit'), cost: v('pw-cost') }];
            A.closeSheet();
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function powersRecs(i) {
    const s = M();
    return s.fx.filter(x => x.mes === i).map(x => ({ id: `pw:${x.id}`, g: 'Эффекты', icon: 'zap', t: `${A.shortName(x.who)}: ${x.what} (~${x.hours} ч)`, del: () => { s.fx = s.fx.filter(y => y !== x); } }));
}
