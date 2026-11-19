// Дневник, сны и дневник тела. Когда в истории наступает новый день, каждому главному (кроме твоей персоны)
// Летописец отдельным запросом пишет страницу дневника за прошедший день — его голосом, субъективно: он может
// ошибаться и врать самому себе; отдельно — «о тебе», и что решил сделать дальше (это решение модель узнаёт:
// персонаж может сделать шаг сам). Там же — что ему снилось этой ночью и что за сном стоит. После сцены
// близости — запись дневника тела (18+). Читаешь только ты; сон закрыт дымкой и проясняется в три тапа.
// Идея — «Дневник», «Дневник тела» и «Сны» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyDay, str, mains, present } from './hudkit.js';

let A = null;
export function initDiary(api) { A = api; }
const esc = (v) => A.esc(v);

const MOODS = { sadness: 'грусть', stress: 'на нервах', anger: 'злость', panic: 'паника', calm: 'покой', relief: 'облегчение', guilt: 'вина', longing: 'тоска', joy: 'радость', desire: 'желание', shame: 'стыд', tenderness: 'нежность', emptiness: 'пустота', triumph: 'торжество', anxiety: 'тревога' };

function cfg() {
    const s = A.settings();
    if (!s.diary || typeof s.diary !== 'object') s.diary = {};
    const c = s.diary;
    if (c.on === undefined) c.on = true;
    if (c.auto === undefined) c.auto = true;       // сам пишет с новым днём истории
    if (c.dreams === undefined) c.dreams = true;
    if (c.body === undefined) c.body = true;       // дневник тела после близости
    if (c.feed === undefined) c.feed = true;       // «решил» и осадок сна — модели
    return c;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.diary || typeof cm.diary !== 'object') cm.diary = {};
    const s = cm.diary;
    if (!Array.isArray(s.pages)) s.pages = [];     // { id, who, kind: day|body, day, text, about, next, mood, dream, mean, mes, at }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const pagesOf = (who, kind) => M().pages.filter(p => A.sameName(p.who, who) && (!kind || p.kind === kind));

/** Посты дня (текст) — материал для записи. */
function dayText(day, max = 7000) {
    const chat = A.chatArr();
    const rows = [];
    let size = 0;
    for (let i = chat.length - 1; i >= 0 && size < max; i--) {
        const m = chat[i];
        if (!A.isPost(m)) continue;
        const d = String(m.horae_meta?.timestamp?.story_date || '').trim();
        if (day && d && d !== day) { if (rows.length) break; continue; }
        const t = A.cut(A.plainText(m.mes), 1400);
        if (!t) continue;
        rows.unshift(`${m.name}: ${t}`);
        size += t.length;
    }
    return rows.join('\n\n');
}

const busy = new Set();

async function writeDay(who, day, mes) {
    const key = `${who}|${day}`;
    if (busy.has(key)) return null;
    busy.add(key);
    try {
        const c = cfg();
        const user = A.shortName(A.canonName(A.ctx().name1));
        const text = dayText(day);
        if (text.length < 200) return null;
        let core = '';
        try { core = A.coreOf?.(who) || ''; } catch { /* */ }
        const last = pagesOf(who, 'day').slice(-1)[0];
        const sys = `Ты пишешь личный дневник персонажа ролевой истории — его рукой, от первого лица, по-русски. Ответ — строго один JSON:
{"text":"запись за день: 6-10 предложений в 2-3 коротких абзацах (абзацы — через \\n). Что было сегодня своими словами, с конкретикой (место, чья-то фраза, жест, который он прокручивает в голове); что чувствовал и почему; в чём сомневается, о чём жалеет, на что надеется, чего стыдится. Его голос и привычки речи; может обращаться к дневнику, противоречить себе, зачеркнуть фразу ~~вот так~~, оборвать мысль. Это личное письмо о своей жизни: он субъективен, может ошибаться и врать самому себе. Не пересказ сцены и не голос рассказчика.","about":"отдельно — только о ${user}: 2-4 предложения, что он к ней чувствует, чего хочет и боится, что заметил и запомнил сегодня; то, чего вслух не скажет","next":"что он решил сделать дальше — один конкретный шаг, 4-14 слов (сам, по своей воле; не «поговорить», а что именно)","mood":"sadness|stress|anger|panic|calm|relief|guilt|longing|joy"${c.dreams ? ',"dream":"что ему снилось этой ночью: яркий сон или кошмар образами и намёками, 3-5 предложений; связан с прожитым, страхами, прошлым — не пересказ дня","mean":"что за сном стоит: какой страх, желание или память, 1-2 предложения"' : ''}}
Мысли и чувства ${user} не выдумывай — только как он её видит.`;
        const usr = `Персонаж: ${who}.${core ? `\nЯдро характера и речи: ${A.cut(core, 1200)}` : ''}${last ? `\nПрошлая запись (не повторяй её): ${A.cut(last.text, 400)}` : ''}\nДень: ${day || 'сегодня'}.\nЧто было за день:\n${text}`;
        const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1400, { check: (x) => !!str(x?.text, 9000), what: `Дневник — ${A.shortName(who)}` });
        const s = M();
        s.pages = s.pages.filter(p => !(p.kind === 'day' && A.sameName(p.who, who) && p.day === day));
        const page = { id: `d${++s.seq}`, who, kind: 'day', day, text: str(j.text, 3000), about: str(j.about, 900), next: str(j.next, 160), mood: MOODS[str(j.mood)] ? str(j.mood) : 'calm', dream: c.dreams ? str(j.dream, 900) : '', mean: c.dreams ? str(j.mean, 400) : '', mes, at: Date.now(), fog: 3 };
        s.pages.push(page);
        if (page.dream && c.feed) s.dreamHint = { who, id: page.id, mes };
        if (s.pages.length > 240) s.pages.splice(0, s.pages.length - 240);
        A.saveMeta(); A.updatePrompt();
        return page;
    } finally { busy.delete(key); }
}

async function writeBody(who, mes) {
    const key = `${who}|body|${mes}`;
    if (busy.has(key)) return null;
    busy.add(key);
    try {
        const chat = A.chatArr();
        const rows = [];
        for (let i = mes; i >= 0 && rows.length < 6; i--) if (A.isPost(chat[i])) rows.unshift(`${chat[i].name}: ${A.cut(A.plainText(chat[i].mes), 1500)}`);
        const sys = `Ты пишешь «дневник тела» персонажа ролевой истории для взрослых — запись от первого лица о собственном теле сразу после близости (все участники — взрослые, всё по согласию). По-русски. Ответ — строго один JSON: {"text":"3-6 предложений: что тело получило и чего хотело, что ноет и что ещё помнит, какие следы он на себе находит, что его удивило, чего он стыдится или чем гордится. Откровенно, телесно, без эвфемизмов и без пересказа сцены; его голос.","mood":"desire|shame|tenderness|emptiness|triumph|anxiety","review":"его отзыв об этом разе, 2-4 предложения: что сработало, что нет, что повторить и чего больше никогда","best":"лучший момент, 3-10 слов","awkward":"самый неловкий момент, 3-10 слов, или пусто","stars":4}. stars — его оценка от 1 до 5.`;
        const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Персонаж: ${who}.\nСцена:\n${rows.join('\n\n')}` }], 1000, { check: (x) => !!str(x?.text, 4000), what: `Дневник тела — ${A.shortName(who)}` });
        const s = M();
        const page = { id: `d${++s.seq}`, who, kind: 'body', day: storyDay(A), text: str(j.text, 1600), mood: MOODS[str(j.mood)] ? str(j.mood) : 'tenderness', review: str(j.review, 700), best: str(j.best, 120), awkward: str(j.awkward, 120), stars: Math.max(0, Math.min(5, Math.round(Number(j.stars) || 0))), mes, at: Date.now() };
        s.pages.push(page);
        A.saveMeta();
        return page;
    } finally { busy.delete(key); }
}

/** После поста: наступил новый день истории — страницы за прошедший; кончилась близость — дневник тела. */
export function diaryAfterPost(i) {
    if (!on()) return;
    const s = M();
    const c = cfg();
    const day = storyDay(A);
    const run = async (jobs) => { for (const job of jobs) { try { await job(); } catch (e) { console.warn('[Life] дневник', e); } } if (jobs.length) A.render?.(); };
    const jobs = [];
    if (day && s.day && day !== s.day && c.auto) {
        const prev = s.day;
        const there = new Set();
        const chat = A.chatArr();
        for (let k = chat.length - 1; k >= 0 && k > chat.length - 80; k--) {
            const m = chat[k];
            if (String(m?.horae_meta?.timestamp?.story_date || '').trim() !== prev) continue;
            if (!m.is_user && m.name) there.add(A.canonName(m.name));
        }
        for (const who of mains(A)) if (there.has(who) || !there.size) jobs.push(() => writeDay(who, prev, i));
    }
    if (day && day !== s.day) { s.day = day; A.saveMeta(); }
    if (c.body) { try { if (A.heatEndedAt?.(i)) { const here = present(A); for (const who of mains(A)) if (!here.length || here.some(h => A.sameName(h, who))) jobs.push(() => writeBody(who, i)); } } catch { /* */ } }
    // осадок сна — три ответа
    if (s.dreamHint && i - s.dreamHint.mes > 3) { s.dreamHint = null; A.saveMeta(); }
    if (jobs.length) setTimeout(() => run(jobs), 1500);
}

export function diaryPrompt(type) {
    if (!A?.hasChat?.() || !on() || !cfg().feed || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const here = present(A);
    const inScene = (who) => !here.length || here.some(h => A.sameName(h, who));
    const out = [];
    for (const who of mains(A)) {
        const p = pagesOf(who, 'day').slice(-1)[0];
        if (!p?.next || p.done || !inScene(who) || A.chatArr().length - 1 - (p.mes || 0) > 30) continue;
        out.push(`[Из дневника ${A.shortName(who)} (никто не читал): решил — ${p.next}. Это его собственное намерение: может сделать шаг сам, когда будет к месту, не дожидаясь повода от других.]`);
    }
    const h = s.dreamHint;
    const dp = h ? s.pages.find(p => p.id === h.id) : null;
    if (dp?.dream && inScene(dp.who)) out.push(`[Этой ночью ${A.shortName(dp.who)} снилось: ${dp.dream} Осадок остался: может всплыть в настроении, взгляде, оброненном слове; пересказывать сон не обязательно.]`);
    return out.join('\n');
}

const md = (t) => esc(t).replace(/~~(.+?)~~/g, '<s>$1</s>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n+/g, '</p><p>');

/** Персонаж → Жизнь → Психика. */
export function diaryHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    if (A.sameName(name, A.canonName(A.ctx().name1))) return '';
    let hand = '';
    try { const h = A.handOf?.(name); if (h) hand = ` lf-hand lf-hand-${h[2]}`; } catch { /* */ }
    const days = pagesOf(name, 'day').slice(-3).reverse();
    const body = cfg().body ? pagesOf(name, 'body').slice(-2).reverse() : [];
    const page = (p) => `<article class="lf-dy-p m-${p.mood}${hand}">
        <header><b>${esc(p.day || '')}</b><span>${MOODS[p.mood] || ''}</span><button data-act="dy-del" data-id="${p.id}" title="вырвать страницу">${A.icon('x')}</button></header>
        <p>${md(p.text)}</p>
        ${p.about ? `<details class="lf-dy-about"><summary>о тебе</summary><p>${md(p.about)}</p></details>` : ''}
        ${p.next ? `<footer class="${p.done ? 'done' : ''}"><small>решил</small>${esc(p.next)}${p.done ? '' : `<button class="lf-link" data-act="cue-set" data-once="1" data-src="Инициатива" data-key="dy:${p.id}" data-text="${esc(`${A.shortName(p.who)} сам, по своей воле делает то, что решил: ${p.next}`)}">⚡ пусть сделает сейчас</button>`}<button class="lf-link" data-act="dy-done" data-id="${p.id}">${p.done ? 'вернуть' : 'уже неважно'}</button></footer>` : ''}
    </article>`;
    const dream = (p) => `<div class="lf-dy-dream f${Math.max(0, p.fog ?? 0)}" data-act="dy-fog" data-id="${p.id}"><small>сон · ночь на ${esc(p.day || '')}</small><p>${esc(p.dream)}</p>${(p.fog ?? 0) <= 0 && p.mean ? `<details><summary>что за этим стоит</summary><p>${esc(p.mean)}</p></details>` : `<i>${(p.fog ?? 0) > 0 ? 'тапни — вспомнить' : ''}</i>`}</div>`;
    const dreams = cfg().dreams ? days.filter(p => p.dream) : [];
    return `${A.sec('Дневник', days.length ? `${pagesOf(name, 'day').length} стр.` : '')}
    ${days.length ? `<div class="lf-dy">${days.map(page).join('')}</div>` : '<div class="lf-hint">Страница появится сама, когда в истории наступит новый день, — или напиши сейчас.</div>'}
    <div class="lf-actions tight"><button class="lf-btn" data-act="dy-write" data-who="${esc(name)}">${A.icon('pencil')} Написать за сегодня</button><button class="lf-chip${cfg().auto ? ' on' : ''}" data-act="dy-auto">сам, с новым днём</button><button class="lf-chip${cfg().feed ? ' on' : ''}" data-act="dy-feed">«решил» — модели</button></div>
    ${dreams.length ? `${A.sec('Сны')}<div class="lf-dy">${dreams.map(dream).join('')}</div>` : ''}
    ${body.length ? `${A.sec('Дневник тела', '18+')}<div class="lf-dy">${body.map(p => `<details class="lf-dy-body"><summary>${esc(p.day || '')} · ${MOODS[p.mood] || ''}${p.stars ? ` · ${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}` : ''}</summary><article class="lf-dy-p m-${p.mood}${hand}"><p>${md(p.text)}</p>${p.review ? `<p><b>Как оно было.</b> ${md(p.review)}</p>` : ''}${p.best ? `<footer><small>лучшее</small>${esc(p.best)}</footer>` : ''}${p.awkward ? `<footer><small>неловкое</small>${esc(p.awkward)}</footer>` : ''}<button class="lf-link" data-act="dy-del" data-id="${p.id}">убрать</button></article></details>`).join('')}</div>` : ''}`;
}

export async function diaryClick(act, el) {
    if (!act.startsWith('dy-')) return false;
    const s = M();
    const c = cfg();
    const p = s.pages.find(x => x.id === el.dataset.id);
    switch (act) {
        case 'dy-write': {
            const who = A.canonName(el.dataset.who);
            const page = await A.withBusy(el, () => writeDay(who, storyDay(A), A.chatArr().length - 1), 'Пишет…');
            if (page === null) A.toast('info', 'За этот день пока мало постов — не о чем писать.', '✦ Дневник');
            break;
        }
        case 'dy-del': if (p) s.pages = s.pages.filter(x => x !== p); break;
        case 'dy-done': if (p) p.done = !p.done; break;
        case 'dy-fog': if (p && (p.fog ?? 0) > 0) p.fog -= 1; else return true; break;
        case 'dy-auto': c.auto = !c.auto; A.saveSettings(); break;
        case 'dy-feed': c.feed = !c.feed; A.saveSettings(); break;
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}
