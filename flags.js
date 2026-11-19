// Флаг-монитор. Как он ведёт себя с твоей героиней — по поступкам, не по словам: Летописец отмечает зелёные
// флаги (услышал, запомнил мелочь, остановился, когда попросили, взял на себя) и красные (давил, соврал,
// обесценил, решил за неё, сорвался). Счёт и последние случаи — на странице персонажа. Модели не уходит:
// это зеркало для тебя. Идея — «флаг-монитор» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, arr } from './hudkit.js';

let A = null;
export function initFlags(api) { A = api; }
const esc = (v) => A.esc(v);

const on = () => A.settings().flags?.on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.flags || typeof cm.flags !== 'object') cm.flags = {};
    if (!Array.isArray(cm.flags.list)) cm.flags.list = [];   // { who, flag, t, mes }
    return cm.flags;
}

export function flagsChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const user = A.shortName(A.canonName(A.ctx().name1));
    const rule = `
flags — поступки персонажа по отношению к ${user} в этом посте, которые ясно говорят «с ним хорошо» или «с ним тревожно»: [{"who":"кто","flag":"green|red","t":"что сделал, 3-10 слов"}]. green — услышал, запомнил мелочь, спросил согласия, остановился, взял на себя, защитил без контроля, признал вину. red — давил, решил за неё, соврал или умолчал важное, обесценил, наказал молчанием, сорвался на неё, ревновал с контролем. Только поступки из текста, не намерения; до 2. Нечего — [].`;
    return { key: '"flags": []', rule, tokens: 90, input: '' };
}

export function flagsAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    const before = s.list.length;
    s.list = s.list.filter(x => x.mes !== i);
    const user = A.canonName(A.ctx().name1);
    for (const r of arr(j?.flags).slice(0, 2)) {
        const who = A.canonName(str(r?.who, 50)), flag = str(r?.flag) === 'red' ? 'red' : str(r?.flag) === 'green' ? 'green' : '', t = str(r?.t, 110);
        if (who && flag && t && !A.sameName(who, user)) s.list.push({ who, flag, t, mes: i });
    }
    if (s.list.length > 200) s.list.splice(0, s.list.length - 200);
    if (s.list.length !== before || arr(j?.flags).length) A.saveMeta();
}

/** Персонаж → Жизнь → Психика. */
export function flagsHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    if (A.sameName(name, A.canonName(A.ctx().name1))) return '';
    const mine = M().list.filter(x => A.sameName(x.who, name));
    const g = mine.filter(x => x.flag === 'green').length, r = mine.length - g;
    if (!mine.length) return `${A.sec('Флаги')}<div class="lf-hint">Зелёные и красные флаги — как он ведёт себя с тобой по поступкам. Появятся из следующих ответов.</div>`;
    return `${A.sec('Флаги', `🟢 ${g} · 🔴 ${r}`)}
    <div class="lf-flg-bar"><i style="flex:${g || 0.001}"></i><u style="flex:${r || 0.001}"></u></div>
    <div class="lf-flg">${mine.slice(-6).reverse().map(x => `<div class="${x.flag}"><span>${x.flag === 'green' ? '🟢' : '🔴'}</span><p>${esc(x.t)} <button class="lf-link" data-act="jump" data-mes="${x.mes}">#${x.mes}</button></p></div>`).join('')}</div>`;
}

export function flagsRecs(i) {
    const s = M();
    return s.list.filter(x => x.mes === i).map((x, k) => ({ id: `flg:${k}`, g: 'Флаги', icon: 'flag', t: `${x.flag === 'green' ? '🟢' : '🔴'} ${A.shortName(x.who)}: ${x.t}`, del: () => { s.list = s.list.filter(y => y !== x); } }));
}
