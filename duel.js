// Словесная дуэль. Пока идёт спор, ссора, допрос или торг, Летописец ведёт счёт: кто ведёт и насколько,
// кто в чём уступил, градус и старое, что всплыло в споре. Модель знает расклад: уступка стоит позиции,
// никто не сдаётся разом. «Споры» (stance.js) — про позиции надолго; дуэль — про саму схватку здесь и сейчас.
// Идея — блок «Словесная дуэль» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { clamp, str, clone } from './hudkit.js';

let A = null;
export function initDuel(api) { A = api; }
const esc = (v) => A.esc(v);

const HEAT = { spar: 'спор', jab: 'уколы', quarrel: 'ссора', shout: 'крик', cold: 'холод', truce: 'примирение' };

function cfg() {
    const s = A.settings();
    if (!s.duel || typeof s.duel !== 'object') s.duel = {};
    if (s.duel.on === undefined) s.duel.on = true;
    return s.duel;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.duel || typeof cm.duel !== 'object') cm.duel = {};
    if (!Array.isArray(cm.duel.past)) cm.duel.past = [];
    return cm.duel;
}

const RULE = `
duel — словесная схватка ПРЯМО В ЭТОМ ПОСТЕ (спор, ссора, допрос, торг, пикировка), иначе null: {"a":"имя","b":"имя","lead":"кто сейчас ведёт","score":65,"gave":{"who":"кто уступил в этом посте, или пусто","what":"в чём уступил, 2-8 слов"},"heat":"spar|jab|quarrel|shout|cold|truce","mem":"старое, что всплыло в споре (упрёк, прошлый случай), 3-12 слов, или пусто"}. score — насколько уверенно ведёт lead: 50 — поровну, 100 — разгром. Уступивший в этом посте не набирает; крупная уступка отдаёт преимущество другому. Обычный разговор и флирт — не дуэль.`;

export function duelChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const c = M().cur;
    return { key: '"duel": null', rule: RULE, tokens: 130, input: `Словесная дуэль: ${c ? `${c.a} × ${c.b}, ведёт ${c.lead} (${c.score}), ${HEAT[c.heat]}` : 'нет'}` };
}

function close(c) {
    const s = M();
    s.past.push({ a: c.a, b: c.b, lead: c.lead, score: c.score, heat: c.heat, from: c.from, to: c.mes, gave: c.rounds.filter(r => r.gave?.who).map(r => `${r.gave.who}: ${r.gave.what}`), mem: c.rounds.map(r => r.mem).filter(Boolean) });
    if (s.past.length > 30) s.past.splice(0, s.past.length - 30);
    s.cur = null;
}

export function duelAfterPost(i, j) {
    if (!on()) return;
    const cm = A.chatMeta();
    if (cm.duel?.mes === i && cm.duel.before !== undefined) cm.duel = clone(cm.duel.before) || {};
    const s = M();
    const before = clone(s); if (before) delete before.before;
    const d = j?.duel;
    const ok = d && typeof d === 'object' && str(d.a) && str(d.b);
    if (!ok) {
        // два поста без схватки — дуэль затихла
        if (s.cur && i - s.cur.mes >= 2) { close(s.cur); s.mes = i; s.before = before; A.saveMeta(); }
        return;
    }
    const a = A.canonName(str(d.a, 50)), b = A.canonName(str(d.b, 50));
    const same = s.cur && [s.cur.a, s.cur.b].every(n => A.sameName(n, a) || A.sameName(n, b));
    if (s.cur && !same) close(s.cur);
    if (!s.cur) s.cur = { a, b, from: i, rounds: [] };
    const c = s.cur;
    const lead = A.canonName(str(d.lead, 50));
    const heat = HEAT[str(d.heat)] ? str(d.heat) : 'spar';
    const gave = d.gave && str(d.gave.who) ? { who: A.canonName(str(d.gave.who, 50)), what: str(d.gave.what, 80) } : null;
    c.lead = A.sameName(lead, c.b) ? c.b : c.a;
    c.score = clamp(Math.round(d.score), 50, 100);
    c.heat = heat;
    c.mes = i;
    c.rounds.push({ mes: i, lead: c.lead, score: c.score, heat, gave, mem: str(d.mem, 120) });
    if (c.rounds.length > 40) c.rounds.splice(0, c.rounds.length - 40);
    if (heat === 'truce') close(c);
    s.mes = i;
    s.before = before;
    A.saveMeta();
}

export function duelPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const c = M().cur;
    if (!c) return '';
    const user = A.canonName(A.ctx().name1);
    const gave = c.rounds.filter(r => r.gave?.who).slice(-3).map(r => `${A.shortName(r.gave.who)} уступил(а): ${r.gave.what}`);
    const mem = c.rounds.map(r => r.mem).filter(Boolean).slice(-2);
    return `[Словесная дуэль ${A.shortName(c.a)} × ${A.shortName(c.b)}: ведёт ${A.shortName(c.lead)} (${c.score}/100), градус — ${HEAT[c.heat]}.${gave.length ? ` Уже уступлено и назад не берётся: ${gave.join('; ')}.` : ''}${mem.length ? ` Всплыло в споре: ${mem.join('; ')}.` : ''} Никто не сдаётся разом: уступка стоит позиции, сильный довод её возвращает, удар ниже пояса поднимает градус. Спорят в характере. За ${A.shortName(user)} не отвечай и её позицию не меняй.]`;
}

const bar = (c) => {
    const left = A.sameName(c.lead, c.a) ? c.score : 100 - c.score;
    return `<div class="lf-dl-bar h-${c.heat}">${A.ava(c.a, 'xs')}<i><b style="width:${left}%"></b><u style="left:${left}%"></u></i>${A.ava(c.b, 'xs')}</div>`;
};

export function duelSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const c = s.cur;
    if (!c) {
        const p = s.past[s.past.length - 1];
        if (!p || A.chatArr().length - 1 - p.to > 6) return '';
        return `${A.sec('Словесная дуэль', 'затихла')}<div class="lf-hint">${esc(A.shortName(p.a))} × ${esc(A.shortName(p.b))}: верх за ${esc(A.shortName(p.lead))} (${p.score}), кончилось — ${HEAT[p.heat]}.${p.gave.length ? ` Уступки: ${esc(p.gave.join('; '))}.` : ''}</div>`;
    }
    const gave = c.rounds.filter(r => r.gave?.who).slice(-4).reverse();
    const mem = c.rounds.filter(r => r.mem).slice(-3).reverse();
    return `${A.sec('Словесная дуэль', `${HEAT[c.heat]} · ${c.rounds.length} ${A.plural(c.rounds.length, 'обмен', 'обмена', 'обменов')}`)}
    <div class="lf-dl">
        ${bar(c)}
        <div class="lf-dl-lead">ведёт <b>${esc(A.shortName(c.lead))}</b> · ${c.score}/100</div>
        ${gave.length ? `<div class="lf-dl-list">${gave.map(r => `<div><b>${esc(A.shortName(r.gave.who))}</b> уступил(а): ${esc(r.gave.what)}</div>`).join('')}</div>` : ''}
        ${mem.length ? `<div class="lf-dl-list mem">${mem.map(r => `<div>всплыло: ${esc(r.mem)}</div>`).join('')}</div>` : ''}
        <button class="lf-btn ghost full" data-act="dl-end">${A.icon('check')} Спор исчерпан</button>
    </div>`;
}

export function duelClick(act) {
    if (!act.startsWith('dl-')) return false;
    const s = M();
    if (act === 'dl-end' && s.cur) { s.cur.mes = A.chatArr().length - 1; close(s.cur); }
    delete s.before;
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function duelRecs(i) {
    const s = M();
    if (s.mes !== i || s.before === undefined) return [];
    const r = s.cur?.rounds?.find(x => x.mes === i);
    return [{ id: 'dl', g: 'Дуэль', icon: 'flag', t: r ? `дуэль: ведёт ${A.shortName(r.lead)} (${r.score})${r.gave ? `, ${A.shortName(r.gave.who)} уступил(а)` : ''}` : 'дуэль закрыта', del: () => { A.chatMeta().duel = clone(s.before) || {}; } }];
}
