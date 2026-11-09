// Живот по сроку. Срок — из Зёрнышка (по дате истории). Всё, что Life рисует с героиней в кадре
// (кадры, кат-сцены, детали, альбом, кадр пары и главы, фото СМИ), получает её тело на этой неделе;
// в «Персонаже → Гардероб» — живот сейчас и «↻ по сроку»: перерисовать образ с животом этой недели.

import { pregOf, bellyOf } from './zr.js';

let A = null;
export function initBelly(api) { A = api; }

const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.belly || typeof s.belly !== 'object') s.belly = {};
    const c = s.belly;
    if (c.on === undefined) c.on = true;
    if (!c.sets || typeof c.sets !== 'object') c.sets = {};   // id комплекта → неделя, на которой нарисован
    return c;
}
export const bellyOn = () => cfg().on !== false;

/** Строка для промпта картинки: у кого в кадре какой живот (с 12 недель). */
export function bellyNote(names = []) {
    if (!bellyOn() || !names?.length) return '';
    const out = [];
    for (const n of names) {
        let p = null;
        try { p = pregOf(n); } catch { /* без Зёрнышка */ }
        if (!p || p.ow < 12) continue;
        out.push(`${A.shortName(A.canonName(n))} is ${p.ow} weeks pregnant: ${p.belly.en}`);
    }
    return out.length ? `Body continuity: ${out.join('; ')} — show it wherever her body is in frame (silhouette, posture, how clothes sit on the belly); never hide or flatten it.` : '';
}

/** Плашка в Гардеробе персонажа: срок и живот; у нарисованного образа — устарел ли. */
export function bellyWardrobeHtml(who, set) {
    if (!bellyOn()) return '';
    let p = null;
    try { p = pregOf(who); } catch { /* */ }
    if (!p) return '';
    const drawn = set ? cfg().sets[set.id] : null;
    const stale = set?.img && p.ow >= 12 && (drawn == null || bellyOf(drawn).k !== p.belly.k);
    return `<div class="lf-belly">
        <span class="lf-belly-i">${A.icon('baby')}</span>
        <span class="lf-belly-t"><b>${esc(p.label)}</b><small>${esc(p.belly.ru)}</small>${set?.img ? `<em>${drawn != null ? `образ нарисован на ${drawn} нед` : 'образ нарисован без живота'}${stale ? ' — живот уже другой' : ''}</em>` : ''}</span>
        ${set && p.ow >= 12 ? `<button class="lf-btn${stale ? ' primary' : ''}" data-act="bl-set" data-v="${esc(set.id)}" data-name="${esc(who)}">${A.icon('refresh')} по сроку</button>` : ''}
    </div>`;
}

const busy = new Set();

/** Перерисовать комплект Гардероба с животом этой недели (картинка встаёт в сам комплект). */
async function drawSet(setId, who) {
    const all = (typeof window.Wardrobe?.setsFor === 'function' ? window.Wardrobe.setsFor() : null) || A.ctx().extensionSettings?.wardrobe?.sets || [];
    const set = all.find(x => x.id === setId) || (A.ctx().extensionSettings?.wardrobe?.sets || []).find(x => x.id === setId);
    if (!set) throw new Error('комплект не найден');
    const p = pregOf(who);
    if (!p) throw new Error('срока нет — Зёрнышко не знает о беременности');
    const items = (set.itemIds || []).map(id => (A.ctx().extensionSettings?.wardrobe?.items || []).find(x => x.id === id)).filter(Boolean);
    if (!items.length) throw new Error('в комплекте нет вещей');
    const refs = [];
    try { const f = await A.faceRef(who, 768); if (f) refs.push(f); } catch { /* без лица */ }
    if (set.img) { try { refs.push(await A.refData(set.img, 768)); } catch { /* */ } }
    const list = items.map((it, k) => `${k + 1}) ${it.name}${it.desc ? ` — ${it.desc}` : ''}`).join('\n');
    const prompt = `Full-body fashion photo of the same woman as in the first reference image — keep her face, hair, skin and features exactly.${set.img ? ' The second reference is this outfit as drawn before: keep the same pieces, colours and fabrics, the same mood and framing.' : ''}
She is ${p.ow} weeks pregnant: ${p.belly.en}. The outfit fits her pregnant body naturally (stretched over the belly, open, or maternity cut where needed).
The outfit "${set.name}" is made of exactly these pieces:
${list}
Natural light, plain softly lit background, standing pose, 4:3. No text, no watermark.`;
    const img = await A.drawPicture(prompt, { aspect: '4:3', max: 1400, refs, prefix: 'life_set', who: [] });
    set.img = img;
    cfg().sets[set.id] = p.ow;
    A.ctx().saveSettingsDebounced?.();
    return img;
}

export async function bellyClick(act, el) {
    if (!act.startsWith('bl-')) return false;
    if (act === 'bl-set') {
        const id = el.dataset.v;
        if (busy.has(id)) return true;
        busy.add(id);
        try { await A.withBusy(el, async () => { await drawSet(id, el.dataset.name); }, 'Рисую…'); A.toast('success', 'Образ перерисован по сроку', '✦ Гардероб', { timeOut: 2200 }); }
        finally { busy.delete(id); }
        A.render();
        return true;
    }
    return false;
}
