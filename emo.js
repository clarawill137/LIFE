// Эмоции на аватарках: у персонажа — набор лиц на 8 эмоций (рисуется один раз по его рефу через Гардероб/SLAY
// или загружается своё). Летописец метит эмоцию каждого, кто действует в посте, — и баннер над постом
// показывает лицо с этой эмоцией. Наборы свои у каждого облика (эпохи «Священного таймлайна»).

let A = null;
export function initEmo(api) { A = api; }

const esc = (v) => A.esc(v);
export const EMOS = [
    ['calm', 'спокоен', 'calm, neutral relaxed expression, soft steady gaze'],
    ['tender', 'нежно', 'tender loving look, faint warm smile, soft eyes'],
    ['laugh', 'смеётся', 'laughing openly, genuine joy, eyes crinkled'],
    ['flirt', 'дерзко', 'playful smirk, one eyebrow slightly raised, teasing look'],
    ['angry', 'зол', 'angry, jaw clenched, hard glare, furrowed brows'],
    ['sad', 'грусть', 'sad, wistful, glistening eyes, mouth turned down'],
    ['tense', 'на взводе', 'tense and alert, guarded, wary narrowed eyes'],
    ['tired', 'устал', 'exhausted, worn out, heavy eyelids, a trace of pain'],
];
const emoById = (k) => EMOS.find(e => e[0] === k) || null;

function cfg() {
    const s = A.settings();
    if (!s.emo || typeof s.emo !== 'object') s.emo = {};
    const c = s.emo;
    if (c.on === undefined) c.on = true;
    if (!c.sets || typeof c.sets !== 'object') c.sets = {};
    return c;
}
export const emoOn = () => cfg().on !== false;
const setOf = (who) => cfg().sets[A.lifeKey(A.canonName(who))] || null;
function setFor(who) { const k = A.lifeKey(A.canonName(who)); return cfg().sets[k] || (cfg().sets[k] = {}); }

export function emoSetImg(who, k, path) { if (!who || !emoById(k)) return; setFor(who)[k] = path; A.saveSettings(); A.refreshAvatars?.(); }

// ───────────── Летописец ─────────────

export function emoChron() {
    if (!emoOn() || !A.hasChat()) return null;
    const have = Object.keys(cfg().sets).length;
    if (!have) return null; // наборов нет — не спрашивать зря
    return {
        key: '"emo": {}',
        rule: `\n\nemo — главное выражение лица каждого, кто действует или говорит в этом посте: {"Имя": "одно из ${EMOS.map(e => e[0]).join(', ')}"}; кого в посте нет — не пиши.`,
        tokens: 40,
    };
}

export function emoAfterPost(i, j) {
    const e = A.chronOf(i);
    if (!e || !j?.emo || typeof j.emo !== 'object') return;
    const out = {};
    for (const [n, k] of Object.entries(j.emo)) if (emoById(String(k))) out[A.canonName(n)] = String(k);
    e.emo = out;
    A.saveMeta();
    A.refreshAvatars?.();
}

/** Картинка эмоции для аватарки поста (или ''). */
/** Лицо с эмоцией поста id. who — чьё (в посте на двоих, в звонке); по умолчанию — автор поста. */
export function emoSrc(id, whoArg = '') {
    if (!emoOn()) return '';
    const m = A.chatArr()[id];
    if (!m || m.is_system) return '';
    const who = A.canonName(whoArg || m.name || '');
    const set = setOf(who);
    if (!set) return '';
    const pick = (i) => { const em = A.chronOf(i)?.emo || {}; return em[who] || em[Object.keys(em).find(n => A.sameName(n, who)) || ''] || ''; };
    let k = m.is_user ? '' : pick(id);
    // твой пост Летописец не читает — лицо берём из ответа на него (как её увидели), иначе из поста перед ним
    if (m.is_user) {
        const chat = A.chatArr();
        for (let i = id + 1; i < chat.length && !k; i++) { if (chat[i]?.is_system) continue; if (chat[i]?.is_user) break; k = pick(i); break; }
        for (let i = id - 1; i >= 0 && !k; i--) { if (chat[i]?.is_system) continue; k = chat[i]?.is_user ? '' : pick(i); break; }
    }
    return (k && set[k]) || '';
}

// ───────────── рисование ─────────────

async function drawOne(who, k) {
    const e = emoById(k);
    const ref = await A.faceRef(who, 768);
    if (!ref) throw new Error(`нет лица ${A.shortName(who)} — поставь его в Гардеробе (⋮ → «Лицо для картинок») или аватар`);
    const prompt = `Portrait of the same person as in the reference image — keep the face, age, hair, skin, scars and features exactly. Head and shoulders, looking slightly off camera, expression: ${e[2]}. Same overall look as the reference, natural cinematic light, softly blurred dark background. No text, no letters, no watermark.`;
    const img = await A.drawPicture(prompt, { aspect: '3:4', max: 1100, refs: [ref], prefix: 'life_emo' });
    emoSetImg(who, k, img);
}

let drawing = '';
export async function drawAll(who, onStep) {
    if (drawing) throw new Error('уже рисую набор — подожди');
    drawing = who;
    try {
        const set = setFor(who);
        let n = 0;
        for (const [k] of EMOS) {
            if (set[k]) continue;
            await A.genIdle?.();
            await drawOne(who, k);
            n++;
            onStep?.(n);
        }
        return n;
    } finally { drawing = ''; }
}

// ───────────── вид: Персонаж → Жизнь ─────────────

export function emoStripHtml(who) {
    if (!A?.hasChat?.()) return '';
    who = A.canonName(who);
    const set = setOf(who) || {};
    const n = EMOS.filter(([k]) => set[k]).length;
    const N = esc(who);
    if (!n) return `<button class="lf-emo-cta" data-act="emo-all" data-name="${N}">${A.icon('smile')}<span><b>Эмоции на аватарках</b><small>нарисовать ${A.shortName(who)} 8 лиц по рефу — баннер над постом будет меняться по тону</small></span></button>`;
    return `${A.sec('Лица', `${n} из ${EMOS.length}${emoOn() ? '' : ' · выключено'}`)}
    <div class="lf-emo-strip">${EMOS.map(([k, l]) => `<button class="lf-emo${set[k] ? '' : ' empty'}" data-act="emo-one" data-name="${N}" data-k="${k}">${set[k] ? `<i style="background-image:url('${esc(set[k])}')"></i>` : `<i>${A.icon('plus')}</i>`}<span>${esc(l)}</span></button>`).join('')}</div>
    <div class="lf-actions tight">${n < EMOS.length ? `<button class="lf-btn" data-act="emo-all" data-name="${N}">${A.icon('wand')} Дорисовать (${EMOS.length - n})</button>` : ''}<label class="lf-switch"><input type="checkbox" data-act="emo-on" ${emoOn() ? 'checked' : ''}><span></span>Менять баннер по эмоции</label></div>`;
}

export async function emoClick(act, el) {
    if (!act.startsWith('emo-')) return false;
    const who = A.canonName(el.dataset.name || '');
    switch (act) {
        case 'emo-on': cfg().on = !!el.checked; A.saveSettings(); A.refreshAvatars?.(); return true;
        case 'emo-all': {
            await A.withBusy(el, async () => {
                const n = await drawAll(who, (k) => A.toast('info', `${k} из ${EMOS.length}…`, `✦ Лица ${esc(A.shortName(who))}`, { timeOut: 1500 }));
                A.toast('success', n ? `Нарисовала лиц: ${n}` : 'Все лица уже есть', `✦ Лица ${esc(A.shortName(who))}`, { timeOut: 2500 });
            }, 'Рисую…');
            A.render();
            return true;
        }
        case 'emo-one': {
            const k = el.dataset.k;
            const e = emoById(k);
            const cur = setOf(who)?.[k] || '';
            A.openSheet(`${esc(A.shortName(who))} · ${esc(e[1])}`, `
                ${cur ? `<div class="lf-emo-big" style="background-image:url('${esc(cur)}')"></div>` : '<div class="lf-empty small">Этого лица ещё нет.</div>'}
                <div class="lf-actions">
                    <button class="lf-btn" data-act="emo-draw" data-name="${esc(who)}" data-k="${k}">${A.icon('wand')} ${cur ? 'Перерисовать' : 'Нарисовать'}</button>
                    <label class="lf-btn">${A.icon('upload')} Своё<input type="file" accept="image/*" data-file="emo" data-name="${esc(who)}" data-k="${k}" hidden></label>
                    ${cur ? `<button class="lf-btn icon" data-act="emo-del" data-name="${esc(who)}" data-k="${k}">${A.icon('trash')}</button>` : ''}
                </div>`);
            return true;
        }
        case 'emo-draw': await A.withBusy(el, async () => { await drawOne(who, el.dataset.k); }, 'Рисую…'); A.closeSheet(); A.render(); return true;
        case 'emo-del': { const s = setOf(who); if (s) delete s[el.dataset.k]; A.saveSettings(); A.refreshAvatars?.(); A.closeSheet(); A.render(); return true; }
    }
    return false;
}
