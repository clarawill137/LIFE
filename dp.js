// «Оператор» (0.63) — кадры как у хорошего фотографа, а не «двое стоят и смотрят».
// 1) Заметка основной модели на каждый ответ: какая «плёнка» у сцены (вид картинки — в поле style тега), что за свет
//    сейчас в сцене (место, час, воздух — из Horae) и какие кадры уже были — чтобы следующий снимался иначе.
// 2) Агент-оператор: переснимает промт картинки по посту — мысль кадра, пойманное мгновение, взгляды, лицо, одно
//    касание с весом, план по смыслу, свет от настоящего источника. Зовётся из окна промта («Переснять», «Дубли»)
//    и сам, перед отрисовкой нового кадра, когда SLAY это позволяет (порт 5.1.1, крючок slayHooks) — см. prompts.js.
// Ремесло и плёнки — в dpcore.js (чистая часть).

import { scanTags, imageModelOf, DIALECTS, cleanPrompt } from './pmtags.js';
import { sceneAt } from './shots.js';
import { forties, coreNow } from './era.js';
import { moodNow } from './mood.js';
import { LOOKS, LOOK_AUTO, LOOK_KEEP, LOOK_OWN, LOOK_INTIM, lookById, lookText, lookOfText, lookMode, pickLook, shotOf, shotKnown, variety, dpSystem, dpUser, dpNote, postForDp, readTakes, skinScene, eraLooks } from './dpcore.js';

let A = null;
export function initDp(api) { A = api; }

export function dpCfg() {
    const s = A.settings();
    if (!s.pm || typeof s.pm !== 'object') s.pm = {};
    if (!s.pm.dp || typeof s.pm.dp !== 'object') s.pm.dp = {};
    const c = s.pm.dp;
    if (c.on === undefined) c.on = true;       // заметка оператора основной модели
    if (c.auto === undefined) c.auto = true;   // новый кадр оператор переснимает сам, до отрисовки (нужен крючок SLAY)
    if (typeof c.look !== 'string' || !(c.look === LOOK_AUTO || c.look === LOOK_KEEP || c.look === LOOK_OWN || lookById(c.look))) c.look = LOOK_AUTO;
    if (typeof c.own !== 'string') c.own = '';
    if (c.skin !== 'fashion' && c.skin !== 'brush') c.skin = 'fashion';   // 0.69: раздетые — «Фешн · 18+» (фото; спокойное прикрыто, откровенное без лиц) или кистью, как было
    return c;
}

const slay = () => A.ctx().extensionSettings?.slay_image_gen || null;
const MODE_TONE = {
    tender: 'tender, soft and unhurried', fire: 'charged — heat under every beat', laugh: 'comic and light, people mid-laugh', fight: 'action — fast, physical, dangerous',
};

/** Что известно о сцене на момент поста i (по умолчанию — сейчас). */
export function sceneOf(i = A.lastAiIndex()) {
    let sc = {};
    try { sc = sceneAt(Math.max(0, i)) || {}; } catch (e) { console.warn('[Life] оператор: сцена', e); }
    let tones = [];
    try { tones = (A.chatMeta().modes?.on || []).map(id => MODE_TONE[id]).filter(Boolean); } catch { /* режимов нет */ }
    let intim = false;
    try { intim = !!moodNow().intimOn; } catch { /* */ }
    let old = false;
    try { old = forties(); } catch { /* */ }
    const out = {
        loc: sc.loc || '', time: sc.time || '', date: sc.date || '', atm: sc.atm || '', desc: sc.desc || '', clothes: sc.clothes || '',
        modes: [...tones, intim ? 'an intimate scene — covered and atmospheric' : ''].filter(Boolean).join('; '),
        forties: old, tender: (A.chatMeta().modes?.on || []).includes('tender'), intim,
        fashion: dpCfg().skin !== 'brush',
    };
    out.skin = skinScene(out);
    return out;
}

/** Плёнка сейчас: { id, name, text }. text пустой — стиль не трогаем. */
export function lookNow(scene = null) {
    const c = dpCfg();
    if (c.look === LOOK_KEEP) return { id: LOOK_KEEP, name: 'не трогать', text: '' };
    if (c.look === LOOK_OWN) return { id: LOOK_OWN, name: 'своя', text: c.own.trim().replace(/["']/g, '') };
    const id = c.look === LOOK_AUTO ? pickLook(scene || sceneOf()) : c.look;
    const l = lookById(id);
    return { id, name: l?.[1] || id, text: l?.[3] || '', auto: c.look === LOOK_AUTO, mode: lookMode(id) };
}

/** С какой плёнкой кадр уйдёт рисовалке. Плёнка «Авто» и кто-то раздет — «Фешн · 18+» (так его и подменит оператор
 *  до отрисовки, см. prompts.js: onSlayDraw); иначе — плёнка из тега, а нет её — плёнка сцены. */
export function frameLook(scene, t = null) {
    const c = dpCfg();
    const inTag = lookOfText(t?.data?.style);
    if (c.look === LOOK_AUTO && scene?.skin && scene.fashion !== false) return inTag === 'fsketch' ? 'fsketch' : LOOK_INTIM;
    if (inTag && inTag !== LOOK_OWN) return inTag;
    return lookNow(scene).id;
}

/** Ряд плёнок для окна и настроек: [id, ярлык, подсказка]. */
export function lookChoices() {
    return [[LOOK_AUTO, 'Авто', 'по сцене: час, свет, эпоха'], ...LOOKS.map(([id, label, hint]) => [id, label, hint]), [LOOK_OWN, 'Своя', 'свой текст'], [LOOK_KEEP, 'Не трогать', 'стиль как в пресете и SLAY']];
}

/** Последние кадры чата до поста before (свежий — первым): как они сняты. same — пост, кадр которого переснимают:
 *  его прошлые свайпы — тот же момент, снятый раньше; свайпнула — значит, хочет другой кадр, а не тот же план опять. */
export function recentShots(before = Infinity, max = 5, same = null) {
    const chat = A.chatArr();
    const out = [];
    let pics = 0;
    if (same && Array.isArray(same.swipes)) {
        const cur = same.swipe_id ?? 0;
        for (let j = same.swipes.length - 1; j >= 0 && out.length < Math.min(3, max); j--) {
            if (j === cur || typeof same.swipes[j] !== 'string') continue;
            for (const t of scanTags(same.swipes[j]).filter(x => !x.video && x.data?.prompt).reverse()) {
                pics++;
                const s = shotOf(t.data.prompt);
                if (shotKnown(s) && out.length < Math.min(3, max)) out.push(s);
            }
        }
    }
    for (let i = Math.min(chat.length - 1, before - 1), posts = 0; i >= 0 && posts < 16 && out.length < max; i--) {
        const m = chat[i];
        if (!m || m.is_user || typeof m.mes !== 'string' || !m.mes.includes('data-iig-instruction')) continue;
        posts++;
        const tags = scanTags(m.mes).filter(t => !t.video && t.data?.prompt);
        for (const t of tags.reverse()) {
            pics++;
            const s = shotOf(t.data.prompt);
            if (shotKnown(s) && out.length < max) out.push(s);
        }
    }
    return { shots: out, seed: chat.length + pics };
}

/** Заметка оператора основной модели (в промпт ответа). */
export function dpPrompt(type) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate') return '';
    const c = dpCfg();
    const st = slay();
    if (!c.on || !st || st.enabled === false) return '';
    // теги NovelAI — другой язык: там ни плёнки в поле style, ни планов словами
    if (imageModelOf(st).kind === 'nai') return '';
    const scene = sceneOf();
    const { shots, seed } = recentShots();
    const lk = lookNow(scene);
    return dpNote({ look: lk.text, scene, v: variety(shots, seed), mode: lk.mode });
}

/** Абзацы поста без карточек; at — после какого абзаца стоит картинка t. */
function postParas(m, t) {
    const MARK = '@@LFPIC@@';
    let s = String(m?.mes || '');
    if (t) s = `${s.slice(0, t.start)}${MARK}${s.slice(t.end)}`;
    s = s.replace(/<art\b[^>]*>[\s\S]*?<\/art>/gi, (full) => (full.includes(MARK) ? `\n\n${MARK}\n\n` : '\n\n'));
    const out = [];
    let at = -1;
    for (const p of A.plainText(s).split(/\n+/).map(x => x.trim()).filter(Boolean)) {
        if (p.includes(MARK)) { at = out.length - 1; const rest = p.replace(MARK, '').trim(); if (rest.length > 20) out.push(rest); continue; }
        if (p.length > 1) out.push(p);
    }
    return { paras: out, at };
}

function userBefore(i) {
    const chat = A.chatArr();
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        const m = chat[j];
        if (m?.is_user && typeof m.mes === 'string') { const t = A.plainText(m.mes); return t.length > 900 ? `…${t.slice(-900)}` : t; }
    }
    return '';
}

/**
 * Переснять кадр. i — пост, t — тег картинки в нём (если кадр оттуда), prompt/aspect — что есть сейчас.
 * takes — три дубля. → [{ prompt, aspect, shot, idea, note }]
 */
export async function reshoot({ i = -1, t = null, prompt, aspect = '', request = '', takes = false, error = '', label = 'Оператор', mode = null } = {}) {
    const st = slay();
    const im = imageModelOf(st);
    const d = DIALECTS[im.kind] || DIALECTS.generic;
    const m = i >= 0 ? A.chatArr()[i] : null;
    const scene = sceneOf(m ? i : undefined);
    const { shots, seed } = recentShots(m ? i : Infinity, 5, m);
    const post = m ? postParas(m, t) : { paras: [], at: -1 };
    const pf = postForDp(post.paras, post.at);
    const look = lookNow(scene);
    // приметы для рисовалок без рефов — по эпохе чата: в сороковых Хеди не «альбинос» из основной ролки (0.73.1)
    const looksText = eraLooks(String(A.settings().pm?.looks || '').trim() || String(st?.atlasCharacterPrompt || '').trim(), prompt, globalThis.slayRefBook, coreNow());
    const sys = dpSystem({ imName: im.name, guide: d.guide, refs: d.refs, lookText: A.cut(looksText, 900), takes, mode: mode ?? lookMode(frameLook(scene, t)) });
    const user = dpUser({
        prompt, aspect, post: pf.text, para: pf.marked, userPost: m ? userBefore(i) : '', scene,
        look: look.text ? look.name : '', v: variety(shots, seed), request, error,
    });
    const raw = await A.askModel([{ role: 'system', content: sys }, { role: 'user', content: user }], takes ? 4200 : 2600, label);
    const list = readTakes(A.extractJson(raw), cleanPrompt);
    if (!list.length) throw new Error('Оператор не вернул кадр — попробуй ещё раз');
    return list;
}
