// Назревает. Life знает много накопленного: недосып и голод, незалеченные раны, минус на счету, просроченные
// обещания и ружья, споры «намертво», шрамы доверия, гудящие Камни. Раз в день истории (и по кнопке) Летописец
// смотрит на всё это разом — на то же, что уходит модели, — и говорит, к чему оно идёт: «Баки срывается от
// недосыпа», «Сэм припомнит должок». Плашка в Сцене: почему — и «Предложить модели» (один раз, в следующий
// ответ) или «Не надо» (насовсем). Сам Life ничего модели не шлёт. Идея — «Назревает» TavernOS HUD (alewwi).

import { storyDay, str, arr, similar } from './hudkit.js';

let A = null;
export function initBrew(api) { A = api; }
const esc = (v) => A.esc(v);

const KIND = { body: 'тело', money: 'деньги', people: 'люди', plot: 'сюжет', work: 'работа', home: 'дом' };
const WHEN = { soon: 'вот-вот', days: 'на днях', any: 'зреет' };

function cfg() {
    const s = A.settings();
    if (!s.brew || typeof s.brew !== 'object') s.brew = {};
    if (s.brew.on === undefined) s.brew.on = true;
    if (s.brew.auto === undefined) s.brew.auto = true;
    return s.brew;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.brew || typeof cm.brew !== 'object') cm.brew = {};
    if (!Array.isArray(cm.brew.list)) cm.brew.list = [];   // { id, what, why, who, when, kind, st: new|armed|sent|off, mes }
    if (!Number.isFinite(cm.brew.seq)) cm.brew.seq = 0;
    return cm.brew;
}
const shown = () => M().list.filter(x => x.st === 'new' || x.st === 'armed');

let running = false;

export async function brewRun() {
    if (running || !A.hasChat()) return 0;
    running = true;
    try {
        const s = M();
        const state = arr(A.promptParts?.()).filter(p => p?.text && !/назревает/i.test(p.label || '')).map(p => `— ${p.label}: ${A.cut(p.text, 900)}`).join('\n');
        if (state.length < 200) return 0;
        const banned = s.list.filter(x => x.st === 'off' || x.st === 'sent').slice(-12).map(x => x.what);
        const sys = `Ты помощник автора ролевой истории. По накопленному состоянию персонажей скажи, что НАЗРЕВАЕТ — последствия, которые логично вытекают из уже случившегося и копящегося, а не новые сюжеты из воздуха. Ответ — строго один JSON по-русски: {"brew":[{"what":"что назревает, 4-12 слов, с именем («Баки срывается от недосыпа», «приходит счёт за ремонт»)","why":"из чего это следует — конкретные факты из состояния, 6-22 слова","who":"кого касается","when":"soon|days|any","kind":"body|money|people|plot|work|home"}]}. От 2 до 4 пунктов, самые весомые. Смотри на: недосып, голод, усталость и стресс, незалеченные раны и старые травмы, деньги и счета, просроченные обещания и планы, незакрытые ружья, споры и шрамы доверия, ревность, тайны под риском, то, что давно откладывают. Ничего не назревает — {"brew":[]}.`;
        const usr = `Сейчас в истории: ${A.worldState()?.timestamp?.story_date || '—'} ${A.worldState()?.timestamp?.story_time || ''}.\nСостояние (то, что знает Life):\n${A.cut(state, 9000)}${banned.length ? `\nУже предлагалось или отклонено (не повторяй): ${banned.join('; ')}` : ''}`;
        const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 900, { check: (x) => Array.isArray(x?.brew), what: 'Назревает' });
        s.list = s.list.filter(x => x.st !== 'new');
        let n = 0;
        for (const r of arr(j.brew).slice(0, 4)) {
            const what = str(r?.what, 110);
            if (!what || s.list.some(x => similar(A, x.what, what))) continue;
            s.list.push({ id: `w${++s.seq}`, what, why: str(r?.why, 220), who: A.canonName(str(r?.who, 50)), when: WHEN[str(r?.when)] ? str(r.when) : 'any', kind: KIND[str(r?.kind)] ? str(r.kind) : 'plot', st: 'new', mes: A.chatArr().length - 1 });
            n++;
        }
        if (s.list.length > 60) s.list.splice(0, s.list.length - 60);
        s.day = storyDay(A);
        A.saveMeta();
        return n;
    } finally { running = false; }
}

const postKey = (i) => `${i}:${A.chatArr()[i]?.swipe_id ?? 0}`;

export function brewAfterPost(i) {
    if (!on()) return;
    const s = M();
    // предложенное ушло модели вместе с этим ответом (новый пост или новый свайп после «Предложить»)
    let changed = false;
    for (const x of s.list) if (x.st === 'armed' && postKey(i) !== x.armedKey) { x.st = 'sent'; changed = true; }
    if (changed) { A.saveMeta(); A.updatePrompt(); }
    const day = storyDay(A);
    if (cfg().auto && day && day !== s.day) {
        const first = !s.day;
        s.day = day; A.saveMeta();
        if (!first) setTimeout(() => { brewRun().then(n => { if (n) A.render?.(); }).catch(e => console.warn('[Life] назревает', e)); }, 4000);
    }
}

export function brewPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const armed = M().list.filter(x => x.st === 'armed');
    if (!armed.length) return '';
    return `[Назревает — пусть начнётся в этом ответе, естественно, из хода сцены: ${armed.map(x => `${x.what} (${x.why})`).join('; ')}. Не объявляй — покажи первым признаком; развязку не форсируй.]`;
}

export function brewSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const list = shown();
    const head = A.sec('Назревает', list.length ? String(list.length) : '');
    if (!list.length) return `${head}<div class="lf-hint">Пока тихо. <button class="lf-link" data-act="brw-run">Посмотреть, что копится</button></div>`;
    return `${head}<div class="lf-brw">${list.map(x => `<details class="lf-brw-c k-${x.kind}${x.st === 'armed' ? ' armed' : ''}"><summary><i>${KIND[x.kind]}</i><b>${esc(x.what)}</b><small>${x.st === 'armed' ? 'уйдёт в следующий ответ' : WHEN[x.when]}</small></summary>
        <p>${esc(x.why)}</p>
        <div class="lf-actions tight">${x.st === 'armed' ? `<button class="lf-btn" data-act="brw-disarm" data-id="${x.id}">Отменить</button>` : `<button class="lf-btn primary" data-act="brw-arm" data-id="${x.id}">${A.icon('zap')} Предложить модели</button>`}<button class="lf-btn ghost" data-act="brw-off" data-id="${x.id}">Не надо</button></div>
    </details>`).join('')}</div>
    <div class="lf-chips wrap"><button class="lf-chip" data-act="brw-run">${A.icon('refresh')} ещё раз</button><button class="lf-chip${cfg().auto ? ' on' : ''}" data-act="brw-auto">сам, с новым днём</button></div>`;
}

export async function brewClick(act, el) {
    if (!act.startsWith('brw-')) return false;
    const s = M();
    const x = s.list.find(y => y.id === el.dataset.id);
    switch (act) {
        case 'brw-run': {
            const n = await A.withBusy(el, () => brewRun(), 'Смотрю…');
            if (n === 0) A.toast('info', 'Нового не назревает.', '✦ Назревает');
            break;
        }
        case 'brw-arm': if (x) { x.st = 'armed'; x.armedKey = postKey(A.chatArr().length - 1); A.toast('info', 'Уйдёт модели один раз — со следующим ответом', '✦ Назревает', { timeOut: 1800 }); } break;
        case 'brw-disarm': if (x) x.st = 'new'; break;
        case 'brw-off': if (x) x.st = 'off'; break;
        case 'brw-auto': cfg().auto = !cfg().auto; A.saveSettings(); break;
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}
