// Обрезанный блок в конце поста. Модель упёрлась в лимит на середине <details …> (заметки автора, досье,
// портрет) — незакрытый блок глотал всё, что расширения дописывают под постом (Континуити, За кадром из
// ExtBlocks), и в чате оставалось «Подробнее» с сырым кодом внутри. Life срезает с конца поста только
// этот огрызок — последний <details> без </details>, целые блоки не трогает — и перерисовывает пост.
// Чинит на открытии чата (последние посты) и после каждого ответа.

let A = null;
export function initTidy(api) { A = api; }

const on = () => A.settings().tidy !== false;
/** Посты, которые сейчас дописывает mend.js, — их огрызок не трогать, он сам разберётся. */
export const tidyHold = new Set();

/** Текст без огрызка в конце, или null — если всё цело. */
export function cutTail(text) {
    const s = String(text || '');
    const i = s.search(/<details\b(?![\s\S]*<details\b)/i);
    if (i < 0) return null;
    if (/<\/details>/i.test(s.slice(i))) return null;
    const opens = (s.match(/<details\b/gi) || []).length;
    const closes = (s.match(/<\/details>/gi) || []).length;
    if (opens <= closes) return null;
    return { fixed: s.slice(0, i).replace(/\s+$/, ''), tail: s.slice(i) };
}

/** Починить пост i: текст, свайп, текст показа ExtBlocks; перерисовать. */
export function tidyMessage(i) {
    if (!A || !on() || tidyHold.has(i)) return false;
    const c = A.ctx();
    const m = c.chat?.[i];
    if (!m || m.is_user || m.is_system || typeof m.mes !== 'string') return false;
    const r = cutTail(m.mes);
    if (!r) return false;
    const old = m.mes;
    m.mes = r.fixed;
    if (Array.isArray(m.swipes) && m.swipes[m.swipe_id] === old) m.swipes[m.swipe_id] = r.fixed;
    const dt = m.extra?.display_text;
    if (typeof dt === 'string') m.extra.display_text = dt.startsWith(old) ? r.fixed + dt.slice(old.length) : dt.replace(r.tail, '');
    try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] перерисовать пост', e); }
    console.info(`[Life] пост #${i}: срезала обрезанный блок в конце (${r.tail.slice(0, 60)}…)`);
    return true;
}

/** Последние посты чата: починить и сохранить, если было что. */
export async function tidyRecent(n = 40) {
    if (!A || !on()) return 0;
    const chat = A.ctx().chat || [];
    let k = 0;
    for (let i = Math.max(0, chat.length - n); i < chat.length; i++) if (tidyMessage(i)) k++;
    if (k) {
        try { await A.ctx().saveChat(); } catch (e) { console.warn('[Life] сохранить чат', e); }
        // старая ST без updateMessageBlock в контексте — перерисовать чат целиком
        if (typeof A.ctx().updateMessageBlock !== 'function') { try { await A.ctx().reloadCurrentChat?.(); } catch { /* */ } }
    }
    return k;
}
