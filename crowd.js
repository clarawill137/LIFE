// Массовка. В людных местах (бар, кафе, улица, метро, вокзал, магазин, приёмная) на фоне — живые люди, и они
// узнают тех, кого есть за что узнать: руку Зимнего солдата, дочь Старка. Модели — одна-две детали фоном,
// через ход и не перетягивая сцену. Кого как узнают — правится в Сцене.

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
    if (!c.fame || typeof c.fame !== 'object') c.fame = {};
    if (!c.seeded) {
        let names = [];
        try { names = [A.ctx().name1, ...A.groupMembers()].map(A.canonName).filter(Boolean); } catch { /* */ }
        if (names.length) {
            c.seeded = 1;
            const put = (re, t) => { const n = names.find(x => re.test(x)); if (n && !c.fame[n]) c.fame[n] = t; };
            put(/баки|bucky|барнс|barnes/i, 'Зимний солдат: узнают по металлической руке — косятся, отходят, шепчутся, кто-то тайком снимает');
            put(/^(хеди|hedy|ядвига)/i, 'дочь Тони Старка: фотографируют на телефон, шепчутся, иногда подходят за селфи; папарацци');
            put(/тони|tony|старк/i, 'Тони Старк: узнают все — телефоны, автографы, крики «Железный человек!»');
            put(/наташ|natasha|романов/i, 'Чёрная вдова: узнают редко — умеет быть незаметной; кто узнал, тот замирает');
            A.saveSettings();
        }
    }
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
    const fame = Object.entries(cfg().fame).filter(([n, t]) => t && (!here.length || here.some(h => A.sameName(h, n)))).map(([n, t]) => `${A.shortName(n)} — ${t}`);
    const h = +(String(st.timestamp?.story_time || '').match(/(\d{1,2})[:.]\d{2}/)?.[1] ?? 14);
    const when = h >= 22 || h < 5 ? 'ночь — людей меньше, кто есть, те смелее' : h < 9 ? 'утро — все спешат' : '';
    return `[Массовка: место людное (${A.locParts(loc).slice(-1)[0] || loc}). На фоне живые люди — одна-две детали за пост, фоном, не перетягивая сцену${when ? `; ${when}` : ''}.${fame.length ? ` Кого как узнают: ${fame.join('; ')}.` : ''} Без толп фанатов на ровном месте: взгляд, телефон, шёпот, официант, который слишком долго смотрит.]`;
}

export function crowdSceneHtml() {
    if (!A?.hasChat?.() || !crowdOn()) return '';
    const loc = A.worldState().scene?.location || '';
    if (!isBusy(loc)) return '';
    return `${A.sec('Массовка', 'место людное')}
    <div class="lf-hint">На фоне — люди, и они узнают: ${Object.entries(cfg().fame).filter(([, t]) => t).map(([n]) => esc(A.shortName(n))).join(', ') || 'никого'}. Модель вставляет одну-две детали через ход. <button class="lf-link" data-act="crw-edit">кого как узнают</button></div>`;
}

export function crowdClick(act, el) {
    if (!act.startsWith('crw-')) return false;
    const c = cfg();
    if (act === 'crw-edit') {
        const names = [];
        const add = (n) => { n = A.canonName(n); if (n && !names.some(x => A.sameName(x, n))) names.push(n); };
        add(A.ctx().name1);
        for (const n of A.groupMembers()) add(n);
        for (const n of Object.keys(c.fame)) add(n);
        A.openSheet(`${A.icon('users')} Массовка — кого как узнают`, `
            ${names.map(n => `<div class="lf-field"><label>${esc(n)}</label><input type="text" data-in="crw-f" data-name="${esc(n)}" value="${esc(c.fame[Object.keys(c.fame).find(k => A.sameName(k, n)) || n] || '')}" placeholder="пусто — не узнают"></div>`).join('')}
            <label class="lf-switch"><input type="checkbox" data-act="crw-on" ${crowdOn() ? 'checked' : ''}><span></span>Массовка в людных местах</label>
            <button class="lf-btn primary full" data-act="crw-save">${A.icon('check')} Сохранить</button>`);
        return true;
    }
    if (act === 'crw-on') { c.on = !!el.checked; A.saveSettings(); A.updatePrompt(); return true; }
    if (act === 'crw-save') {
        const box = el.closest('.lf-sheet') || document;
        for (const inp of box.querySelectorAll('[data-in="crw-f"]')) {
            const k = Object.keys(c.fame).find(x => A.sameName(x, inp.dataset.name)) || inp.dataset.name;
            const v = inp.value.trim();
            if (v) c.fame[k] = v.slice(0, 200); else delete c.fame[k];
        }
        A.saveSettings(); A.updatePrompt(); A.closeSheet(); A.render();
        return true;
    }
    return false;
}
