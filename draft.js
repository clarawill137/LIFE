// Черновик. Над полем ввода, когда там есть текст: «✍ Развернуть» — твои короткие биты (что делает, говорит, думает)
// → полный пост за твою персону в твоём же стиле (по твоим прошлым постам): те же действия и реплики, раскрытые,
// без решений за других; правишь и шлёшь сама. «Причесать» — только опечатки, орфография и запятые.
// «↩» — как было до этого. Пишет дешёвая модель Летописца.

import { personaNow } from './lore.js';

let A = null;
let undo = null;   // { text, out } — что было в поле до правки и что в нём стало
let busy = '';

export function initDraft(api) {
    A = api;
    document.addEventListener('input', (ev) => { if (ev.target?.id === 'send_textarea') paintDraft(); }, true);
    document.addEventListener('focusin', (ev) => { if (ev.target?.id === 'send_textarea') paintDraft(); }, true);
}

function cfg() {
    const s = A.settings();
    if (!s.draft || typeof s.draft !== 'object') s.draft = {};
    if (s.draft.on === undefined) s.draft.on = true;
    return s.draft;
}
const draftOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
const ta = () => document.getElementById('send_textarea');
const user = () => A.canonName(A.ctx().name1) || 'игрок';

function setText(t) {
    const el = ta();
    if (!el) return;
    el.value = t;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try { el.focus(); el.setSelectionRange(t.length, t.length); } catch { /* */ }
}

/** Плашка над полем ввода — только когда в поле есть текст (или есть что вернуть). */
export function paintDraft() {
    const form = document.getElementById('form_sheld');
    let bar = document.getElementById('lf-draft');
    const text = String(ta()?.value || '').trim();
    const canUndo = !!undo && String(ta()?.value || '') === undo.out;
    if (!form || !draftOn() || !A.hasChat?.() || (!text && !canUndo)) { bar?.remove(); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'lf-draft';
        bar.addEventListener('pointerdown', (ev) => { if (ev.target.closest('button')) ev.preventDefault(); }); // клавиатура не прячется
        bar.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-dr]');
            if (!b) return;
            ev.preventDefault();
            ev.stopPropagation();
            draftClick(b.dataset.dr);
        });
        form.prepend(bar);
    } else if (bar.parentElement !== form) form.prepend(bar);
    const html = busy
        ? `<span class="lf-dr-busy">${busy === 'grow' ? '✍ разворачиваю…' : 'причёсываю…'}</span>`
        : `<button data-dr="grow" title="Твои короткие биты → полный пост в твоём стиле">✍ Развернуть</button><button data-dr="polish" title="Только опечатки и запятые">Причесать</button>${canUndo ? '<button data-dr="undo" title="Как было">↩</button>' : ''}`;
    if (bar.dataset.sig !== html) { bar.innerHTML = html; bar.dataset.sig = html; }
}

/** Образцы стиля: её последние посты. */
function samples(n = 3) {
    const chat = A.chatArr();
    const out = [];
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const m = chat[i];
        if (!m?.is_user || m.is_system) continue;
        const t = String(m.mes || '').trim();
        if (t.length > 60) out.push(A.cut(t, 900));
    }
    return out.reverse();
}

function lastAi() {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) { const m = chat[i]; if (m && !m.is_user && !m.is_system) return { name: m.name, text: A.cut(A.plainText ? A.plainText(m.mes) : m.mes, 2200) }; }
    return null;
}

async function grow(text) {
    const U = user();
    const c = A.ctx();
    const persona = personaNow(c.powerUserSettings?.persona_description || '').trim();   // с правками эпохи (ядро таймлайна)
    const st = A.worldState?.() || {};
    const here = (st.scene?.characters_present || []).join(', ');
    const prev = lastAi();
    const ex = samples();
    const sys = `Ты помогаешь игроку писать пост в литературной ролевой на русском — за её персонажа ${U}. Её черновик — короткие биты: что ${U} делает, говорит, думает и чувствует.
Разверни черновик в полноценный пост:
- те же действия, реплики и мысли, в том же порядке — раскрой их жестами, ощущениями, деталями, интонацией; реплики можно чуть дописать, смысл не менять;
- ничего не добавляй по сюжету: не решай за других персонажей, не пиши их слова и действия, не двигай сцену дальше черновика;
- лицо, время, стиль и разметка (*курсив*, «кавычки», тире) — как в её прошлых постах; длина — как обычно у неё;
- пометки в /…/, ((…)), [OOC] — режиссура: оставь их как есть в конце.
Ответь только постом.`;
    const input = [
        persona ? `Персонаж игрока (${U}):\n${A.cut(persona, 1500)}` : '',
        [st.timestamp?.story_date, st.timestamp?.story_time, st.scene?.location].filter(Boolean).length ? `Сейчас: ${[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' ')}${st.scene?.location ? `, ${st.scene.location}` : ''}${here ? `; рядом: ${here}` : ''}` : '',
        prev ? `Последний ответ (${prev.name}), на который она отвечает:\n${prev.text}` : '',
        ex.length ? `Её прошлые посты — образцы стиля:\n${ex.map((t, k) => `### ${k + 1}\n${t}`).join('\n\n')}` : '',
        `Черновик:\n${text}`,
    ].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: sys }, { role: 'user', content: input }], 2400);
    return String(out || '').replace(/^```\w*\n?|```$/g, '').trim();
}

async function polish(text) {
    const sys = `Ты корректор. Исправь в тексте ТОЛЬКО опечатки, орфографию и пунктуацию (запятые, тире, кавычки по правилам русского языка). Ничего не переписывай: не меняй слова, порядок, стиль, сленг и мат, не добавляй и не убирай. Разметку (*курсив*, «кавычки», тире в диалогах, переносы строк) сохрани. Ответь только исправленным текстом.`;
    const out = await A.askModel([{ role: 'system', content: sys }, { role: 'user', content: text }], Math.min(4000, 400 + Math.ceil(text.length / 2)));
    return String(out || '').replace(/^```\w*\n?|```$/g, '').trim();
}

export async function draftClick(act) {
    const el = ta();
    if (!el || busy) return;
    if (act === 'undo') {
        if (undo && el.value === undo.out) { setText(undo.text); undo = null; }
        paintDraft();
        return;
    }
    const text = String(el.value || '').trim();
    if (!text) return;
    busy = act;
    paintDraft();
    try {
        const out = act === 'grow' ? await grow(text) : await polish(text);
        if (!out || out.length < Math.min(10, text.length / 2)) throw new Error('модель вернула пустоту');
        if (String(ta()?.value || '').trim() !== text) throw new Error('пока думала, текст в поле поменялся — не трогаю');
        undo = { text: el.value, out };
        setText(out);
        if (act === 'polish' && out === text) A.toast('info', 'Ошибок не нашла', '✍ Причесать', { timeOut: 1600 });
    } catch (e) {
        A.toast('warning', A.esc(String(e?.message || e)), act === 'grow' ? '✍ Развернуть' : '✍ Причесать', { timeOut: 4000 });
    } finally {
        busy = '';
        paintDraft();
    }
}
