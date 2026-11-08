// Обрезанный блок в конце поста. Модель упёрлась в лимит на середине <details …> (заметки автора, досье,
// портрет) — незакрытый блок глотал всё, что расширения дописывают под постом (Континуити, За кадром из
// ExtBlocks), и в чате оставалось «Подробнее» с сырым кодом внутри. Life срезает с конца поста только
// этот огрызок — последний <details> без </details>, целые блоки не трогает — и перерисовывает пост.
// Чинит после каждого ответа и на открытии чата (последние посты).
//
// 0.18.6: чат сам НЕ сохраняет. Чат у неё ~40 МБ, и сохранение — это весь файл целиком; лишнее сохранение
// сразу после открытия чата (страница ещё переваривает загрузку) на айфоне — лишний пик памяти. Правка живёт
// в памяти и уезжает на сервер со следующим обычным сохранением (новый пост, Летописец, правка).

let A = null;
export function initTidy(api) { A = api; }

const on = () => A.settings().tidy !== false;
/** Посты, которые сейчас дописывает mend.js, — их огрызок не трогать, он сам разберётся. */
export const tidyHold = new Set();

/** Текст без огрызка в конце, или null — если всё цело. Без заглядываний вперёд — один проход. */
export function cutTail(text) {
    const s = String(text || '');
    const re = /<details\b/gi;
    let i = -1, opens = 0, m;
    while ((m = re.exec(s))) { i = m.index; opens++; }
    if (i < 0) return null;
    if (/<\/details>/i.test(s.slice(i))) return null;
    const closes = (s.match(/<\/details>/gi) || []).length;
    if (opens <= closes) return null;
    return { fixed: s.slice(0, i).replace(/\s+$/, ''), tail: s.slice(i) };
}

const rendered = (i) => !!document.querySelector(`#chat .mes[mesid="${i}"]`);

/** Починить пост i в памяти: текст, свайп, текст показа ExtBlocks; перерисовать, если он на экране. */
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
    if (rendered(i)) { try { c.updateMessageBlock?.(i, m); } catch (e) { console.warn('[Life] перерисовать пост', e); } }
    console.info(`[Life] пост #${i}: срезала обрезанный блок в конце (${r.tail.slice(0, 60)}…)`);
    return true;
}

/** Последние посты чата: починить в памяти (без сохранения — см. выше). */
export async function tidyRecent(n = 40) {
    if (!A || !on()) return 0;
    const chat = A.ctx().chat || [];
    let k = 0;
    for (let i = Math.max(0, chat.length - n); i < chat.length; i++) if (tidyMessage(i)) k++;
    return k;
}
