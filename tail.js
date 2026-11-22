// Наружка: есть ли хвост, проверочный маршрут, отрыв. Правду знает Life: хвост может быть, а они его не видят —
// модель тогда держит его фоном (мелькнувшее лицо, та же машина), не раскрывая. Заметить — кубик с поправками
// (подготовка, кто рядом, толпа, сам хвост), проверочный маршрут — надёжнее, но стоит времени; отрыв — по способу.
// «Жар» — насколько ими сейчас интересуются: растёт от шпионских дел, спадает по дням.

import { storyDay } from './hudkit.js';

let A = null;
export function initTail(api) { A = api; }
const esc = (v) => A.esc(v);
const sn = (n) => A.shortName(n);
const d20 = () => 1 + Math.floor(Math.random() * 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Кто может сидеть на хвосте — по эпохе истории. */
function whoPool(y) {
    if (y < 1950) return ['абвер', 'ГИДРА', 'контрразведка СНР', 'газетчик'];
    if (y < 2015) return ['ГИДРА', 'ЩИТ', 'частный детектив', 'папарацци'];
    return ['папарацци', 'люди Росса', 'частный детектив', 'наёмники', 'фанаты', 'ГИДРА (остатки)'];
}
export const ROUTES = [['metro', '🚇 Метро с пересадкой', 4, 25], ['store', '🛍 Универмаг, два выхода', 3, 20], ['park', '🌳 Парк и мост', 3, 30], ['door', '🚪 «Ошибиться дверью»', 2, 10]];
export const ESCAPES = [['crowd', '👥 В толпу', 2], ['train', '🚇 В вагон в последний момент', 4], ['look', '🧥 Сменить облик', 3], ['car', '🚗 Машиной', 3], ['roof', '🏙 Крышами и лестницами', 5]];

const on = () => A.settings().tail?.on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.tl || typeof cm.tl !== 'object') cm.tl = {};
    const s = cm.tl;
    if (!Number.isFinite(s.heat)) s.heat = 10;
    if (!Array.isArray(s.log)) s.log = [];
    if (!s.cur || typeof s.cur !== 'object') s.cur = null;     // { who, n, car, skill, know: no|suspect|yes, since, where }
    return s;
}
function year() { try { const d = A.parseDate(A.worldState()?.timestamp?.story_date); return d && !isNaN(d) ? d.getFullYear() : 2024; } catch { return 2024; } }
const where = () => String(A.worldState()?.scene?.location || '').trim();
/** Спад жара по дням истории. */
function cool() {
    const s = M();
    const day = storyDay(A);
    if (day && s.cooled !== day) { if (s.cooled) s.heat = clamp(s.heat - 6, 0, 100); s.cooled = day; }
}
/** Поправка наблюдателя: подготовка и кто рядом. */
function eyeMod() {
    let m = 0;
    const here = (A.worldState()?.scene?.characters_present || []).map(A.canonName);
    const me = A.canonName(A.ctx().name1);
    if (/хеди|hedy/i.test(me)) m += 3;
    if (here.some(n => /баки|bucky|барнс|barnes/i.test(n))) m += 4;
    if (here.some(n => /наташ|романов|natasha/i.test(n))) m += 4;
    if (/улиц|толп|метро|вокзал|рынок|площад|times|таймс/i.test(where())) m -= 2;
    return clamp(m, -6, 8);
}
function log(t, roll = null) { const s = M(); s.log = [{ t, roll, day: storyDay(A), mes: A.chatArr().length - 1 }, ...s.log].slice(0, 12); }
/** Есть ли хвост на самом деле: решает жар (тайно); если уже есть — остаётся. */
function truth() {
    const s = M();
    cool();
    if (s.cur) return s.cur;
    if (Math.random() * 100 < s.heat) {
        const pool = whoPool(year());
        s.cur = { who: pool[Math.floor(Math.random() * pool.length)], n: 1 + Math.floor(Math.random() * 3), car: Math.random() < 0.5 ? ['серый седан', 'чёрный внедорожник', 'фургон доставки', 'такси'][Math.floor(Math.random() * 4)] : '', skill: 8 + Math.floor(Math.random() * 8), know: 'no', since: storyDay(A), where: where() };
    }
    return s.cur;
}
/** Проверить, есть ли хвост: кубик + поправки против мастерства хвоста. */
export function look(bonus = 0, route = '') {
    const s = M();
    const t = truth();
    const r = d20(), mod = eyeMod() + bonus;
    const tot = r + mod;
    let res;
    if (!t) { res = tot >= 12 ? 'Чисто: никого. Можно выдохнуть.' : 'Ничего не заметили. Кажется, чисто.'; if (route) s.heat = clamp(s.heat - 10, 0, 100); }
    else if (tot >= t.skill + 6 || r === 20) { t.know = 'yes'; res = `Хвост: ${t.n === 1 ? 'один' : t.n === 2 ? 'двое' : 'трое'}${t.car ? `, ${t.car}` : ''} — похоже, ${t.who}.`; }
    else if (tot >= t.skill) { t.know = t.know === 'yes' ? 'yes' : 'suspect'; res = 'Одно и то же лицо мелькнуло дважды. Может, совпадение. А может, нет.'; }
    else res = 'Ничего не заметили. Кажется, чисто.';
    log(`${route ? `${route}: ` : ''}${res}`, { r, mod, tot });
    A.saveMeta();
    return { res, r, mod, tot, know: t?.know || 'no' };
}
/** Проверочный маршрут: надёжнее, но стоит времени. */
export function routeCheck(id) {
    const r = ROUTES.find(x => x[0] === id) || ROUTES[0];
    const out = look(r[2] + 3, r[1].replace(/^\S+\s/, ''));
    out.mins = r[3];
    return out;
}
/** Отрыв: только если хвост замечен. */
export function escape(id) {
    const s = M();
    const t = s.cur;
    const e = ESCAPES.find(x => x[0] === id) || ESCAPES[0];
    if (!t || t.know === 'no') return { res: 'Отрываться не от кого — по крайней мере, вы так думаете.' };
    const r = d20(), mod = eyeMod() + e[2];
    const tot = r + mod;
    let res;
    if (tot >= t.skill + 8 || r === 20) { res = `${e[1].replace(/^\S+\s/, '')}: ушли чисто — хвост потерял вас и не понял как.`; s.cur = null; s.heat = clamp(s.heat - 20, 0, 100); }
    else if (tot >= t.skill + 2) { res = `${e[1].replace(/^\S+\s/, '')}: оторвались, но они видели, что вы уходите, — теперь знают, что вы знаете.`; s.cur = null; s.heat = clamp(s.heat + 5, 0, 100); }
    else if (r === 1) { res = `${e[1].replace(/^\S+\s/, '')}: сорвалось — хвост подошёл вплотную. Сейчас что-то будет.`; t.close = true; s.heat = clamp(s.heat + 15, 0, 100); }
    else { res = `${e[1].replace(/^\S+\s/, '')}: не вышло — они всё ещё здесь, держатся дальше.`; t.skill += 1; }
    log(res, { r, mod, tot });
    A.saveMeta();
    return { res, r, mod, tot };
}
export function setHeat(d) { const s = M(); s.heat = clamp(s.heat + d, 0, 100); A.saveMeta(); }
export function clearTail() { const s = M(); s.cur = null; A.saveMeta(); }

export function tailPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const t = M().cur;
    if (!t) return '';
    const who = `${t.n === 1 ? 'один человек' : t.n === 2 ? 'двое' : 'трое'}${t.car ? ` (${t.car})` : ''}, ${t.who}`;
    if (t.know === 'yes') return `[Наружка: за ними хвост — ${who}${t.close ? ', подошли вплотную' : ''}. Они ЗНАЮТ о хвосте: проверяют отражения, говорят осторожно, решают, отрываться ли. Цифр и кубиков не называй.]`;
    if (t.know === 'suspect') return `[Наружка: за ними хвост — ${who}. Они только ПОДОЗРЕВАЮТ (лицо мелькнуло дважды). Держи слежку фоном, к месту — повторяющаяся машина, взгляд в толпе; прямо не раскрывай.]`;
    return `[Наружка (тайно): за ними хвост — ${who}. Они НЕ знают. Не раскрывай; можно одну неброскую деталь, которую легко пропустить.]`;
}

const ui = { last: '' };
export function tailSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    cool();
    const t = s.cur;
    const shown = t && t.know !== 'no';
    const status = !shown ? '<div class="lf-tl-st clear">👁 Хвоста не видно<small>что есть на самом деле — знает только Life</small></div>'
        : `<div class="lf-tl-st ${t.know}">${t.know === 'yes' ? '🚨 Хвост' : '❓ Возможно, хвост'}<small>${esc(t.know === 'yes' ? `${t.n === 1 ? 'один' : t.n === 2 ? 'двое' : 'трое'}${t.car ? ` · ${t.car}` : ''} · ${t.who}${t.where ? ` · с «${t.where}»` : ''}` : 'лицо мелькнуло дважды')}</small></div>`;
    return `${A.sec('Наружка', `жар ${s.heat}`)}
        ${status}
        <div class="lf-tl-heat"><i style="width:${s.heat}%"></i></div>
        ${ui.last ? `<div class="lf-note">${esc(ui.last)}</div>` : ''}
        <div class="lf-actions"><button class="lf-btn primary" data-act="tl-look">🎲 Есть ли хвост?</button></div>
        ${A.sec('Проверочный маршрут', 'надёжнее, но дольше')}
        <div class="lf-chips wrap">${ROUTES.map(([id, l, , m]) => `<button class="lf-chip" data-act="tl-route" data-v="${id}">${l} <small>+${m} мин</small></button>`).join('')}</div>
        ${shown ? `${A.sec('Отрыв')}<div class="lf-chips wrap">${ESCAPES.map(([id, l]) => `<button class="lf-chip" data-act="tl-escape" data-v="${id}">${l}</button>`).join('')}</div>` : ''}
        ${A.sec('Жар', 'насколько ими интересуются')}
        <div class="lf-chips wrap"><button class="lf-chip" data-act="tl-heat" data-v="15">🔥 Засветились</button><button class="lf-chip" data-act="tl-heat" data-v="-15">🧊 Залегли на дно</button>${t ? '<button class="lf-chip" data-act="tl-clear">✕ Хвоста нет</button>' : ''}</div>
        ${s.log.length ? `${A.sec('Журнал')}<div class="lf-timeline">${s.log.slice(0, 6).map(x => `<div class="lf-tl"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(x.t)}</b><small>${esc([x.day, x.roll && `d20 ${x.roll.r}${x.roll.mod >= 0 ? '+' : ''}${x.roll.mod} = ${x.roll.tot}`].filter(Boolean).join(' · '))}</small></span></div>`).join('')}</div>` : ''}
        <div class="lf-hint">Хвост может быть, даже если вы его не видите: модель тогда держит его фоном. Баки и Наташа рядом — замечают лучше; толпа мешает.</div>`;
}
export const tailState = () => { try { const t = M().cur; return t && t.know === 'yes' ? 'хвост' : t && t.know === 'suspect' ? '?' : ''; } catch { return ''; } };

export function tailClick(act, el) {
    const v = el.dataset.v;
    if (act === 'tl-look') ui.last = look().res;
    else if (act === 'tl-route') { const r = routeCheck(v); ui.last = `${r.res} (маршрут: +${r.mins} мин)`; }
    else if (act === 'tl-escape') ui.last = escape(v).res;
    else if (act === 'tl-heat') { setHeat(Number(v) || 0); ui.last = Number(v) > 0 ? 'Засветились: ими интересуются сильнее.' : 'Залегли на дно: интерес спадает.'; }
    else if (act === 'tl-clear') { clearTail(); ui.last = 'Хвоста нет.'; }
    else return;
    A.updatePrompt?.(); A.render();
}
export const _tl = { M, truth, eyeMod };
