// Стук в сцену. В группе каждый пишет за себя (cast.js): кого нет рядом, тот не влезает в чужой ответ.
// Зато когда у него по своей жизни (Закулисье) есть повод выйти на связь с тобой — позвонить, написать,
// приехать, — он «стучится»: над полем ввода плашка «Тони хочет позвонить — …» с кнопками
// «Пустить» (ход сразу переходит к нему: /trigger), «Позже» и «Не сейчас».
// Позвать можно и самой: Life → Сцена → «Позвать в сцену» — любого из группы, кого нет рядом.
// В его ход модель знает, как именно он входит (звонок, сообщения, приезд); дальше — как обычно.

import { icon } from './icons.js';
import { agendaKnocks, agendaEventStatus, agendaOf } from './agenda.js';

let A = null;
export function initKnock(api) { A = api; }

const ctx = () => SillyTavern.getContext();
const esc = (v) => A.esc(v);
const short = (n) => A.shortName(A.canonName(n));
const NARRATOR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

export const HOW = {
    call: { icon: 'phone', want: 'хочет позвонить', btn: 'Позвонит', prompt: (S, U, why) => `${S} calls ${U} right now${why ? ` — ${why}` : ''}. Write the call from ${S}'s side, from where ${S} actually is: what ${S} says, hears and does on the line. ${U}'s answers are ${U}'s to write.` },
    text: { icon: 'message', want: 'хочет написать', btn: 'Напишет', prompt: (S, U, why) => `${S} texts ${U} right now${why ? ` — ${why}` : ''}. Write ${S} sending the messages from where ${S} actually is (as phone messages, short, in ${S}'s texting voice); keep the narration around it brief.` },
    come: { icon: 'door', want: 'хочет приехать', btn: 'Придёт', prompt: (S, U, why) => `${S} comes to where ${U} is right now${why ? ` — ${why}` : ''}. Write ${S}'s arrival and first moments from ${S}'s side: getting there, knocking or walking in, what ${S} says first. From this reply on ${S} is in the scene.` },
};
export function howOf(text) {
    const t = String(text || '').toLowerCase();
    if (/смс|сообщ|напиш|текст|text|mess|чат/.test(t)) return 'text';
    if (/визит|приед|приход|прид|заед|загля|зайд|постуч|прилет|arriv|visit|come/.test(t)) return 'come';
    if (/звон|позвон|call|видео/.test(t)) return 'call';
    return '';
}

function M() {
    const m = A.chatMeta();
    if (!m.knock || typeof m.knock !== 'object') m.knock = {};
    const k = m.knock;
    if (!k.snooze || typeof k.snooze !== 'object') k.snooze = {};
    return k;
}

export function knockOn() {
    try {
        const c = ctx();
        return !!(A?.hasChat?.() && c.groupId && A.settings().enabled !== false && A.settings().cast?.on !== false);
    } catch { return false; }
}

function members() { return (A.groupMembers() || []).filter(n => !A.sameName(n, ctx().name1) && !NARRATOR.test(n)); }
function present() { try { return (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); } catch { return []; } }
const isHere = (n, pr = present()) => pr.some(p => A.sameName(p, n));
function cardOf(who) { return members().find(n => A.sameName(n, who)) || ''; }

/** Кто сейчас стучится: события Закулисья, где главный герой сам выходит на связь с тобой. */
export function knocks() {
    if (!knockOn()) return [];
    const k = M();
    const i = A.lastAiIndex();
    const pr = present();
    const out = [];
    for (const e of agendaKnocks()) {
        const who = cardOf(e.who);
        if (!who || (pr.length && isHere(who, pr))) continue;
        const how = howOf(`${e.how} ${e.what}`);
        if (!how) continue;
        if ((k.snooze[e.id] || -1) > i) continue;
        if (!e.push && /позже/i.test(e.when || '') && i - (e.mes || 0) < 4) continue;
        out.push({ id: e.id, who, how, why: e.what });
    }
    return out;
}

/** Активный «впустить»: для подсказки модели в ход этого персонажа. */
export function knockActive() { return knockOn() ? (M().active || null) : null; }

/** В ход персонажа S — как он входит. consume: генерация пошла. */
export function knockPromptFor(S, U, consume = false) {
    const k = M();
    const a = k.active;
    if (!a) return '';
    if (!A.sameName(a.who, S)) {
        // пошёл чужой ход после его ответа — вход состоялся
        if (consume && a.used) { k.active = null; A.saveMeta(); }
        return '';
    }
    if (A.lastAiIndex() - (a.at || 0) > 8) { k.active = null; A.saveMeta(); return ''; }
    if (consume && !a.used) { a.used = true; if (a.id) agendaEventStatus(a.id, 'done'); A.saveMeta(); }
    return `- This turn ${S} enters the scene: ${(HOW[a.how] || HOW.call).prompt(S, U, a.why ? A.cut(a.why, 200) : '')}`;
}

async function trigger(who) {
    const card = cardOf(who) || who;
    try {
        await ctx().executeSlashCommandsWithOptions?.(`/trigger ${card}`);
    } catch (e) {
        A.toast('warning', `Не вышло передать ход: ${esc(String(e?.message || e))}`, '✦ Стук');
    }
}

export async function letIn({ who, how = 'call', why = '', id = '' }) {
    const k = M();
    k.active = { id, who: cardOf(who) || who, how, why, at: A.lastAiIndex(), used: false };
    A.saveMeta();
    A.updatePrompt();
    paintKnock();
    await trigger(who);
}

export function knockClick(act, el) {
    const k = M();
    const id = el.dataset.id || '';
    const list = knocks();
    const x = list.find(y => y.id === id) || null;
    switch (act) {
        case 'kn-in': if (x) letIn(x); return true;
        case 'kn-later': if (x) { k.snooze[id] = A.lastAiIndex() + 4; A.saveMeta(); paintKnock(); } return true;
        case 'kn-no': if (x) { agendaEventStatus(id, 'gone'); A.saveMeta(); paintKnock(); } return true;
        case 'kn-next': k.first = (Number(k.first) || 0) + 1; paintKnock(); return true;
        case 'kn-call': {
            const who = el.dataset.name;
            const how = el.dataset.how || 'call';
            const why = el.closest('[data-kn-row]')?.querySelector('input')?.value?.trim() || '';
            A.closeSheet?.();
            letIn({ who, how, why });
            return true;
        }
        case 'kn-sheet': callSheet(); return true;
    }
    return false;
}

/** Плашка над полем ввода. */
export function paintKnock() {
    let bar = document.getElementById('lf-knock');
    const list = knocks();
    const a = knockActive();
    const form = document.getElementById('form_sheld');
    if (!form || (!list.length && !(a && !a.used))) { bar?.remove(); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'lf-knock';
        bar.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-act]');
            if (!b) return;
            ev.preventDefault(); ev.stopPropagation();
            knockClick(b.dataset.act, b);
        });
        form.prepend(bar);
    } else if (bar.parentElement !== form) form.prepend(bar);
    if (a && !a.used) {
        const h = HOW[a.how] || HOW.call;
        bar.innerHTML = `<div class="lf-kn on">${A.ava(a.who, 'sm')}<span class="lf-kn-t"><b>${esc(short(a.who))}</b> ${icon(h.icon)} входит в сцену…</span></div>`;
        return;
    }
    const k = M();
    const n = Number(k.first) || 0;
    const x = list[n % list.length];
    const h = HOW[x.how];
    bar.innerHTML = `<div class="lf-kn">
        <div class="lf-kn-top">${A.ava(x.who, 'sm')}
            <span class="lf-kn-t"><b>${esc(short(x.who))}</b> ${h.want}${x.why ? `<small>${esc(A.cut(x.why, 140))}</small>` : ''}</span>
            <button class="lf-kn-b ghost" data-act="kn-no" data-id="${esc(x.id)}" title="Не сейчас — убрать">${icon('x')}</button></div>
        <div class="lf-kn-acts2">
            ${list.length > 1 ? `<button class="lf-kn-b more" data-act="kn-next" title="Кто ещё стучится">ещё ${list.length - 1}</button>` : ''}
            <button class="lf-kn-b" data-act="kn-later" data-id="${esc(x.id)}" title="Через пару постов спросит снова">${icon('clock')}<span>Позже</span></button>
            <button class="lf-kn-b go" data-act="kn-in" data-id="${esc(x.id)}" title="Ход переходит к нему">${icon(h.icon)}<span>Пустить</span></button>
        </div>
    </div>`;
}

/** Life → Сцена: позвать в сцену любого из группы, кого нет рядом. */
export function knockSceneHtml() {
    if (!knockOn()) return '';
    const pr = present();
    const away = members().filter(n => !(pr.length && isHere(n, pr)));
    if (!away.length) return '';
    return `<section class="lf-offcard"><div class="lf-offcard-h">${icon('door')} Позвать в сцену</div>
        <div class="lf-hint">В группе каждый пишет за себя: кого нет рядом, тот сам не влезет. Позови — и ход перейдёт к нему.</div>
        <button class="lf-btn ghost full" data-act="kn-sheet">${icon('users')} ${away.map(n => esc(short(n))).join(', ')}</button>
    </section>`;
}

function callSheet() {
    const pr = present();
    const away = members().filter(n => !(pr.length && isHere(n, pr)));
    A.openSheet(`${icon('door')} Позвать в сцену`, `<div class="lf-hint">Ход сразу перейдёт к нему, и он войдёт так, как выберешь. Повод — по желанию (иначе сам решит, по своей жизни).</div>
        ${away.map(n => {
            const g = agendaOf(n);
            return `<div class="lf-kn-row" data-kn-row>
                <div class="lf-kn-who">${A.ava(n, 'sm')}<span><b>${esc(short(n))}</b>${g?.now ? `<small>${esc(A.cut(g.now, 110))}</small>` : ''}</span></div>
                <input type="text" placeholder="повод (необязательно)">
                <div class="lf-kn-acts">${Object.entries(HOW).map(([k, h]) => `<button class="lf-btn ghost" data-act="kn-call" data-name="${esc(n)}" data-how="${k}">${icon(h.icon)} ${h.btn}</button>`).join('')}</div>
            </div>`;
        }).join('') || '<div class="lf-empty small">Все уже в сцене.</div>'}`);
}
