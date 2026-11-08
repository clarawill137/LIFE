// Твисты — кнопки поворотов сюжета на один ответ: разные виды (прошлое догоняет, угроза, работа, гость, тайна, драма,
// тело подводит, быт, странное, подарок судьбы, хаос), масштаб (мелочь / заметно / бомба).
// Тап по виду — вслепую: модель сама решает, что именно случится. «Варианты» — Летописец предлагает 3 конкретных
// под эту сцену, выбираешь тапом. «Свой» — пишешь сама. Текст уходит в самый конец промпта (как режимы), на один ответ;
// на свайпе/регене этого же ответа твист повторяется. Летописец потом записывает, что именно случилось, — в «Было».

let A = null;
export function initTwists(api) { A = api; }

const esc = (v) => A.esc(v);
const ctx = () => SillyTavern.getContext();
const userName = () => A.canonName?.(ctx().name1) || ctx().name1 || 'the player';

// [id, эмодзи, ярлык, что это для модели]
export const TWISTS = [
    ['any', '🎲', 'Любой', 'whatever kind of twist fits this scene best — your choice of kind.'],
    ['past', '🕸', 'Прошлое догоняет', 'the past catches up: someone or something from a character\'s established past resurfaces — an old enemy or ally, a debt, a person they wronged, a file, a place, a promise, the consequence of an old deed. Use only what the history and lorebooks already establish (or a natural extension of it); never invent a backstory that contradicts them.'],
    ['danger', '🎯', 'Угроза', 'a threat: surveillance, a tail, an ambush, a break-in, an attempt, danger to someone they love — concrete and competent, with a source that makes sense in this world.'],
    ['work', '🛰', 'Работа зовёт', 'duty calls: a crisis at work or in the organisation, an urgent call from above, a leak, a mission that cannot wait, a decision only they can make.'],
    ['guest', '🚪', 'Гость', 'someone arrives or reaches out unexpectedly — a known person or a new face with business of their own; they want something and change the dynamic of the scene.'],
    ['secret', '🗝', 'Тайна всплывает', 'a secret surfaces: a lie or a hidden truth comes out, someone learns what they should not, an object or a message gives something away.'],
    ['drama', '💔', 'Драма', 'drama between the characters: jealousy, an old hurt, a misunderstanding, a hard truth said out loud, a choice that splits them — painful but in character, nobody turns into a villain.'],
    ['body', '🩸', 'Тело подводит', 'the body fails: an injury, a sudden illness or attack, an old wound flaring up, exhaustion, a side effect of powers or a serum — real, physical, with consequences that last.'],
    ['home', '🏠', 'Быт', 'everyday chaos: something breaks, the pet, the neighbours, a flood, a burnt dinner, a delivery gone wrong — small, specific, funny or annoying.'],
    ['strange', '✨', 'Странное', 'the uncanny: something inexplicable within the world\'s rules — powers acting up, an anomaly, a vision, an impossible coincidence, a sign.'],
    ['luck', '🎁', 'Подарок судьбы', 'a good surprise: unexpected good news, luck, a gift, help from where they did not expect it, a door opening — not everything has to hurt.'],
    ['chaos', '🌪', 'Хаос', 'chaos: several things go wrong at once and escalate, plans collapse, everything happens at the worst possible moment.'],
];
export const SCALES = [
    ['small', '🌱', 'Мелочь', 'Scale: small — a ripple that colours the scene and leaves a trace, but does not derail it.'],
    ['mid', '🔥', 'Заметно', 'Scale: noticeable — it changes the direction of the scene.'],
    ['big', '💥', 'Бомба', 'Scale: big — a real turn, the stakes jump; still plausible and earned.'],
];
const kindById = (id) => TWISTS.find(k => k[0] === id) || null;
const scaleById = (id) => SCALES.find(s => s[0] === id) || SCALES[1];
const SRC = { blind: 'вслепую', pick: 'вариант', own: 'свой' };

function M() {
    const cm = A.chatMeta();
    if (!cm.twists || typeof cm.twists !== 'object') cm.twists = {};
    const t = cm.twists;
    if (!Array.isArray(t.log)) t.log = [];
    if (!SCALES.some(s => s[0] === t.scale)) t.scale = 'mid';
    return t;
}

export function twistArmed() { return A?.hasChat?.() ? M().armed || null : null; }

/** Взвести твист на следующий ответ. text — конкретный (вариант или свой), без него — вслепую. */
export function armTwist(kind, text = '', src = 'blind') {
    if (!kindById(kind)) return null;
    const t = M();
    t.armed = { kind, scale: t.scale, text: String(text || '').trim().slice(0, 600), src: text ? src : 'blind', at: A.chatArr().length };
    A.onArm?.();
    A.saveMeta();
    A.updatePrompt();
    return t.armed;
}

export function clearTwist() {
    if (!A?.hasChat?.()) return;
    const t = M();
    if (!t.armed) return;
    t.armed = null;
    A.saveMeta();
    A.updatePrompt();
}

export function setScale(v) {
    const t = M();
    t.scale = scaleById(v)[0];
    if (t.armed && !t.armed.text) t.armed.scale = t.scale;
    A.saveMeta();
    A.updatePrompt();
}

function promptOf(x) {
    const k = kindById(x.kind);
    if (!k) return '';
    const U = userName();
    return `[THIS reply only — TWIST requested by ${U}. Kind: ${k[2]} — ${k[3]} ${scaleById(x.scale)[3]}${x.text ? ` Make exactly this happen: ${x.text}` : ' Choose the concrete event yourself and surprise the player.'} It must have a cause that fits what is already established (history, lorebooks, known people) and leave a consequence that is NOT resolved in this reply. Weave it into the scene naturally, in the preset's language, style and format; do not announce it as a twist and do not break the voices. Never decide ${U}'s actions, words or feelings — show the twist arriving and leave ${U} room to react.]`;
}

/** Текст для модели. consume — генерация пошла: твист отработал на этом ответе. */
export function twistPrompt(type, consume = false) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate' || type === 'continue') return '';
    const t = M();
    const L = A.chatArr().length;
    if (t.armed) {
        const x = t.armed;
        if (consume) {
            t.fired = { ...x, mes: type === 'swipe' ? L - 1 : L, ts: Date.now(), real: '' };
            t.armed = null;
            t.log.push({ kind: x.kind, scale: x.scale, text: x.text, src: x.src, mes: t.fired.mes, real: '' });
            if (t.log.length > 30) t.log = t.log.slice(-30);
            A.saveMeta();
        }
        return promptOf(x);
    }
    // свайп / реген того самого ответа — тот же твист
    const f = t.fired;
    if (f && ((type === 'swipe' && L - 1 === f.mes) || (type === 'regenerate' && L === f.mes))) return promptOf(f);
    return '';
}

// ───────────── Летописец: что именно случилось ─────────────

export function twistChron() {
    if (!A?.hasChat?.()) return null;
    const f = M().fired;
    if (!f || A.lastAiIndex() !== f.mes) return null;
    const k = kindById(f.kind);
    return {
        key: '"twist": ""',
        rule: `\n\ntwist — в этом посте игрок заказал твист «${k ? k[2] : f.kind}»${f.text ? ` (${f.text})` : ''}. Что именно случилось, 6–14 слов, по факту поста; "" — если твиста в посте не видно.`,
        tokens: 60,
    };
}

export function twistAfterPost(i, j) {
    if (!A?.hasChat?.()) return;
    const t = M();
    const f = t.fired;
    if (!f || f.mes !== i) return;
    const real = String(j?.twist || '').trim().slice(0, 200);
    if (!real) return;
    f.real = real;
    const e = [...t.log].reverse().find(x => x.mes === i);
    if (e) e.real = real;
    A.saveMeta();
}

// ───────────── варианты ─────────────

const OPTS_SYSTEM = `Ты сценарист длинной литературной ролевой истории на русском. Игрок просит поворот сюжета на следующий ответ.
Предложи ровно 3 РАЗНЫХ конкретных твиста нужного вида и масштаба для ЭТОЙ сцены. Ответь только JSON:
{"twists":[{"t":"что случится, 1–2 предложения, конкретно: кто, что, как это входит в сцену","hook":"чем аукнется дальше, 5–10 слов"}]}
Правила: опирайся на то, что уже есть в истории, карточках и среди известных людей; у события должна быть причина, понятная в этом мире; не решай за игрока, что он делает и чувствует; не повторяй недавние твисты; без воды и без пафоса; один вариант может быть неожиданным, но не абсурдным.`;

function recentLines(n = 12) {
    const store = A.chronStore();
    return Object.entries(store).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, n)
        .map(([, e]) => (e.chips || []).join('; ')).filter(Boolean).reverse().join('\n');
}

function cardBrief(who) {
    const card = A.cardOf?.(who);
    const t = [card?.description, card?.personality].filter(Boolean).join('\n')
        .replace(/\{\{user\}\}/gi, userName()).replace(/\{\{char\}\}/gi, who);
    return t ? `${who}: ${A.cut(t.replace(/\s+/g, ' '), 900)}` : '';
}

export async function makeOptions(kind) {
    const k = kindById(kind) || kindById('any');
    const t = M();
    const st = A.worldState();
    const present = (st.scene?.characters_present || []).map(A.canonName);
    const chat = A.chatArr();
    let last = '';
    for (let i = chat.length - 1; i >= 0 && !last; i--) if (chat[i] && !chat[i].is_system) last = A.cut(A.plainText ? A.plainText(chat[i].mes) : String(chat[i].mes || '').replace(/<[^>]+>/g, ' '), 2500);
    const people = (A.peopleList?.() || []).slice(0, 30).map(p => `${p.name}${p.role ? ` — ${p.role}` : p.who ? ` — ${p.who}` : ''}`).join('; ');
    const secrets = (A.secretsState?.() || []).slice(-6).map(s => s.text).filter(Boolean).join('; ');
    const done = t.log.slice(-6).map(x => x.real || x.text).filter(Boolean).join('; ');
    const input = [
        `Вид твиста: ${k[2]} — ${k[3]}`,
        `${scaleById(t.scale)[3]}`,
        `Игрок пишет за: ${userName()}`,
        present.length ? `В сцене: ${present.join(', ')}` : '',
        st.scene?.location ? `Место: ${st.scene.location}` : '',
        [st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).length ? `Время: ${[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' ')}` : '',
        present.filter(n => !A.sameName(n, ctx().name1)).map(cardBrief).filter(Boolean).join('\n'),
        people ? `Известные люди: ${people}` : '',
        secrets ? `Тайны в истории: ${secrets}` : '',
        recentLines() ? `Что было недавно:\n${recentLines()}` : '',
        done ? `Недавние твисты (не повторять): ${done}` : '',
        last ? `Последний пост:\n${last}` : '',
    ].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: OPTS_SYSTEM }, { role: 'user', content: input }], 1500);
    const j = A.extractJson(out);
    const list = (Array.isArray(j?.twists) ? j.twists : []).map(x => ({ t: String(x?.t || '').trim().slice(0, 500), hook: String(x?.hook || '').trim().slice(0, 120) })).filter(x => x.t).slice(0, 3);
    if (!list.length) throw new Error('Летописец не прислал вариантов — попробуй ещё раз или другой профиль');
    t.opts = { kind: k[0], scale: t.scale, list, at: Date.now() };
    A.saveMeta();
    return t.opts;
}

// ───────────── вид ─────────────

/**
 * Ряд твистов. o.at — атрибут кликов ('data-act' в хабе, 'data-cc' в пульте), o.chip — класс чипа.
 */
export function twistsHtml(o = {}) {
    if (!A?.hasChat?.()) return '';
    const at = o.at || 'data-act';
    const chip = o.chip || 'lf-chip';
    const t = M();
    const a = t.armed;
    const k = a ? kindById(a.kind) : null;
    const btn = (act, v, on, inner, extra = '') => `<button class="${chip} lf-tw-chip${on ? ' on' : ''}" ${at}="${act}" data-v="${esc(v)}"${extra}>${inner}</button>`;
    return `<div class="lf-tw">
        <div class="${o.wrap || 'lf-chips wrap'} lf-tw-kinds">${TWISTS.map(([id, emo, label]) => btn('tw-arm', id, a?.kind === id, `<span class="lf-tw-emo">${emo}</span>${esc(label)}`)).join('')}</div>
        <div class="lf-tw-row">
            <div class="lf-tw-scale">${SCALES.map(([id, emo, label]) => `<button class="${t.scale === id ? 'on' : ''}" ${at}="tw-scale" data-v="${id}">${emo} ${esc(label)}</button>`).join('')}</div>
            ${btn('tw-opts', a?.kind || 'any', false, `👁 Варианты`)}${btn('tw-own', a?.kind || 'any', false, `✍ Свой`)}
        </div>
        ${a ? `<div class="lf-tw-armed"><span>${k ? k[1] : '🎲'}</span><div><small>в следующем ответе · ${esc(scaleById(a.scale)[2].toLowerCase())} · ${SRC[a.src] || 'вслепую'}</small><b>${esc(a.text || (k ? k[2] : ''))}</b></div><button class="lf-tw-x" ${at}="tw-clear" title="Отменить">✕</button></div>` : ''}
        ${o.log && t.log.length ? `<div class="lf-tw-log">${t.log.slice(-4).reverse().map(x => { const kk = kindById(x.kind); return `<span>${kk ? kk[1] : '🎲'} ${esc(A.cut(x.real || x.text || (kk ? kk[2] : ''), 90))}${x.mes != null ? ` <i>#${x.mes}</i>` : ''}</span>`; }).join('')}</div>` : ''}
    </div>`;
}

function optsHtml(at) {
    const o = M().opts;
    if (!o?.list?.length) return '<div class="lf-empty small">Вариантов нет.</div>';
    const k = kindById(o.kind);
    return `<div class="lf-tw-opts">${o.list.map((x, n) => `<button class="lf-tw-opt" ${at}="tw-pick" data-v="${n}"><small>${k ? `${k[1]} ${esc(k[2])}` : ''} · ${esc(scaleById(o.scale)[2].toLowerCase())}</small><b>${esc(x.t)}</b>${x.hook ? `<i>→ ${esc(x.hook)}</i>` : ''}</button>`).join('')}</div>
    <button class="lf-btn ghost full" ${at}="tw-opts" data-v="${esc(o.kind)}">↻ Другие три</button>`;
}

function ownHtml(at, kind) {
    return `<div class="lf-field"><label>Вид</label><select data-in="tw-kind">${TWISTS.map(([id, emo, label]) => `<option value="${id}"${id === kind ? ' selected' : ''}>${emo} ${esc(label)}</option>`).join('')}</select></div>
    <div class="lf-field"><label>Что должно случиться</label><textarea data-in="tw-text" rows="4" placeholder="Звонит Фьюри: на Маяке пропал сотрудник…"></textarea></div>
    <button class="lf-btn primary full" ${at}="tw-own-ok">В следующий ответ</button>`;
}

/**
 * Клики. ui = { at, openSheet(title, html), closeSheet(), rerender(), busy(el, fn, label) }.
 * Возвращает true, если клик наш.
 */
export async function twistClick(act, el, ui) {
    if (!act.startsWith('tw-')) return false;
    const at = ui.at || 'data-act';
    const toast = (kind, msg) => A.toast(kind, msg, '✦ Твист', { timeOut: 1800 });
    switch (act) {
        case 'tw-arm': {
            const cur = M().armed;
            if (cur && cur.kind === el.dataset.v && !cur.text) { clearTwist(); toast('info', 'Твист отменён'); }
            else { const k = kindById(el.dataset.v); armTwist(el.dataset.v); toast('info', `${k[1]} ${esc(k[2])} — в следующем ответе, вслепую`); }
            ui.rerender();
            return true;
        }
        case 'tw-scale': setScale(el.dataset.v); ui.rerender(); return true;
        case 'tw-clear': clearTwist(); toast('info', 'Твист отменён'); ui.rerender(); return true;
        case 'tw-opts': {
            const kind = el.dataset.v || 'any';
            const run = async () => {
                await makeOptions(kind);
                const k = kindById(kind);
                ui.openSheet(`${k ? k[1] : '🎲'} Твист · ${esc(k ? k[2] : 'Любой')}`, optsHtml(at));
            };
            if (ui.busy) await ui.busy(el, run, 'Думаю…'); else await run();
            return true;
        }
        case 'tw-pick': {
            const o = M().opts;
            const x = o?.list?.[Number(el.dataset.v)];
            if (!x) return true;
            M().scale = o.scale;
            armTwist(o.kind, x.t, 'pick');
            ui.closeSheet();
            toast('success', 'Взвела — случится в следующем ответе');
            ui.rerender();
            return true;
        }
        case 'tw-own': ui.openSheet('✍ Свой твист', ownHtml(at, el.dataset.v || 'any')); return true;
        case 'tw-own-ok': {
            const box = el.closest('.lf-sheet, .cc-sheet') || document;
            const text = box.querySelector('[data-in="tw-text"]')?.value?.trim();
            const kind = box.querySelector('[data-in="tw-kind"]')?.value || 'any';
            if (!text) { toast('warning', 'Напиши, что должно случиться'); return true; }
            armTwist(kind, text, 'own');
            ui.closeSheet();
            toast('success', 'Взвела — случится в следующем ответе');
            ui.rerender();
            return true;
        }
    }
    return false;
}

/** Для /life twist <вид>. */
export function twistByWord(w) {
    w = String(w || '').trim().toLowerCase();
    if (!w) return 'any';
    const hit = TWISTS.find(([id, , label]) => id === w || label.toLowerCase().startsWith(w));
    return hit ? hit[0] : null;
}
