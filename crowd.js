// Массовка. В людных местах (бар, кафе, улица, метро, вокзал, магазин, приёмная) на фоне — живые люди, и они
// узнают тех, кого есть за что узнать. Кого как узнают — по годам истории (hero.js): маска, «гибель», возвращение
// под своим именем — у каждого свои периоды. Модели — одна-две детали фоном, через ход и не перетягивая сцену.

import { fameLines, famous, fameSheet } from './hero.js';

let A = null;
export function initCrowd(api) { A = api; }

const esc = (v) => A.esc(v);
const BUSY = /бар(?![а-яёa-z0-9])|паб|кафе|ресторан|клуб|вечеринк|столов|кофейн|закусочн|банкет|казино|вокзал|аэропорт|метро|подземк|станци|магазин|супермаркет|торгов|рынок|улиц|проспект|авеню|площад|тайм[сc]|парк(?![а-яёa-z0-9])|набережн|пирс|стадион|концерт|театр|кинотеатр|музей|галере|приёмн|приемн|холл|лобби|очеред|автобус|такси|толп|ярмарк|каток/i;
const QUIET = /квартир|спальн|кухн|ванн|дом(?![а-яёa-z0-9])|дома(?![а-яёa-z0-9])|машин|салон машины|кабинет|номер отеля|лаборатор|бункер|база(?![а-яёa-z0-9])|штаб/i;

function cfg() {
    const s = A.settings();
    if (!s.crowd || typeof s.crowd !== 'object') s.crowd = {};
    const c = s.crowd;
    if (c.on === undefined) c.on = true;
    return c;
}
export const crowdOn = () => cfg().on !== false;

export function isBusy(loc) { const l = String(loc || ''); return !!l && BUSY.test(l) && !(QUIET.test(l) && !/бар(?![а-яёa-z0-9])|кафе|ресторан/i.test(l)); }

export function crowdPrompt(type) {
    if (!A?.hasChat?.() || !crowdOn() || type === 'quiet' || type === 'impersonate') return '';
    const st = A.worldState();
    const loc = st.scene?.location || '';
    if (!isBusy(loc)) return '';
    const L = A.chatArr().length;
    const turn = Math.floor((type === 'swipe' ? L - 1 : L) / 2);
    if (turn % 2) return '';
    const here = (st.scene?.characters_present || []).map(A.canonName);
    let fame = [];
    try { fame = fameLines(here.length ? here : null); } catch (e) { console.warn('[Life] массовка: кого как узнают', e); }
    const h = +(String(st.timestamp?.story_time || '').match(/(\d{1,2})[:.]\d{2}/)?.[1] ?? 14);
    const when = h >= 22 || h < 5 ? 'ночь — людей меньше, кто есть, те смелее' : h < 9 ? 'утро — все спешат' : '';
    return `[Массовка: место людное (${A.locParts(loc).slice(-1)[0] || loc}). На фоне живые люди — одна-две детали за пост, фоном, не перетягивая сцену${when ? `; ${when}` : ''}.${fame.length ? ` Кого как узнают в это время: ${fame.join(' | ')}. Кого «в жизни» не узнают — того не узнают, пока он не в костюме.` : ''} Без толп фанатов на ровном месте: взгляд, телефон, шёпот, официант, который слишком долго смотрит.]`;
}

export function crowdSceneHtml() {
    if (!A?.hasChat?.() || !crowdOn()) return '';
    const loc = A.worldState().scene?.location || '';
    if (!isBusy(loc)) return '';
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    let who = [];
    try { who = here.filter(n => famous(n)); } catch { /* */ }
    return `${A.sec('Массовка', 'место людное')}
    <div class="lf-hint">На фоне — люди${who.length ? `, и они узнают: ${who.map(n => esc(A.shortName(n))).join(', ')}` : '; узнавать здесь сейчас некого'}. Модель вставляет одну-две детали через ход. <button class="lf-link" data-act="crw-edit">кого как узнают — по годам</button></div>`;
}

const toggleHtml = () => `<label class="lf-switch"><input type="checkbox" data-act="crw-on" ${crowdOn() ? 'checked' : ''}><span></span>Массовка в людных местах</label>`;

export function crowdClick(act, el) {
    if (!act.startsWith('crw-')) return false;
    const c = cfg();
    if (act === 'crw-edit') { fameSheet(toggleHtml()); return true; }
    if (act === 'crw-on') { c.on = !!el.checked; A.saveSettings(); A.updatePrompt(); return true; }
    return false;
}
