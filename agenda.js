// Закулисье внутри Life: у персонажей своя жизнь помимо сцены.
// Раз в N постов дешёвая модель обновляет скрытые повестки (сейчас, хочет, скрывает, следующий шаг, кто что знает)
// главных героев и людей «за кадром», и иногда придумывает события за кадром, которые всплывут звонком, новостью, визитом.
// Перед ответом модели — повестка того, кто говорит, и где сейчас остальные. Всё живёт в каждом чате отдельно.
// Раньше это делало отдельное расширение «Закулисье»: его повестки переносятся сюда, а само оно выключается.

import { icon } from './icons.js';
import { simCfg, nowSlot } from './sim.js';
import { innerBrief } from './inner.js';
import { peopleList, findPerson, peopleAdd } from './people.js';
import { moodNow } from './mood.js';

let A = null;
let speaker = '';
let busy = false;

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';
const isUser = (n) => A.sameName(n, A.ctx().name1);
const short = (n) => A.shortName(A.canonName(n));
const str = (v) => (typeof v === 'string' ? v.trim() : '');

export const FIELDS = [['now', 'Сейчас'], ['want', 'Хочет'], ['hide', 'Скрывает'], ['next', 'Следующий шаг'], ['knows', 'В курсе'], ['mood', 'Настроение']];
const OLD_LABEL = { 'сейчас': 'now', 'хочет': 'want', 'скрывает': 'hide', 'следующий шаг': 'next', 'в курсе': 'knows', 'настроение': 'mood' };

export function agendaCfg() {
    const c = simCfg();
    if (!c.bs || typeof c.bs !== 'object') c.bs = {};
    const b = c.bs;
    if (b.on === undefined) b.on = true;
    if (!Number.isFinite(b.every)) b.every = 8;
    if (!Number.isFinite(b.ctx)) b.ctx = 24;
    if (!Number.isFinite(b.chance)) b.chance = 60;
    return b;
}

function M() {
    const m = A.chatMeta();
    if (!m.agenda || typeof m.agenda !== 'object' || Array.isArray(m.agenda)) m.agenda = {};
    const a = m.agenda;
    if (!a.chars || typeof a.chars !== 'object') a.chars = {};
    if (!Array.isArray(a.events)) a.events = [];
    if (!Array.isArray(a.extra)) a.extra = [];
    if (!Number.isFinite(a.at)) a.at = -1;
    return a;
}

// ───────────── состав ─────────────

function mainChars() {
    const out = [];
    for (const n of A.groupMembers().map(A.canonName)) if (n && !isUser(n) && !out.some(x => A.sameName(x, n))) out.push(n);
    return out;
}

/** Второстепенные: карточки «Людей» с галочкой «своя жизнь за кадром» и имена без карточки (из старого Закулисья). */
function sideChars() {
    const a = M();
    const out = peopleList().filter(x => x.bs).map(x => x.name);
    for (const n of a.extra) if (!findPerson(n) && !out.some(x => A.sameName(x, n)) && !mainChars().some(x => A.sameName(x, n))) out.push(n);
    return out;
}

function rosterNames() { return [...mainChars(), ...sideChars()]; }
function charKey(name) {
    const a = M();
    return Object.keys(a.chars).find(k => A.sameName(k, name) || (findPerson(k) && findPerson(k) === findPerson(name))) || A.canonName(name);
}
export function agendaOf(name) { const a = M(); return a.chars[charKey(name)] || null; }

// ───────────── перенос из «Закулисья» ─────────────

function parseOld(text) {
    const out = {};
    for (const line of String(text || '').split('\n')) {
        const m = line.match(/^\s*([^:]{3,20}):\s*(.+)$/);
        const k = m && OLD_LABEL[m[1].trim().toLowerCase()];
        if (k) out[k] = m[2].trim();
        else if (line.trim() && !out.now) out.now = line.trim();
    }
    return out;
}

/** Повестки старого расширения этого чата → Life (один раз на чат). */
function importChat() {
    const md = A.ctx().chatMetadata;
    const old = md?.backstage;
    const a = M();
    if (!old || a.imported) return false;
    a.imported = true;
    const roster = String(old.roster || '').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
        .map(l => { const [name, tier] = l.split('|').map(s => s.trim()); return { name, main: /глав|main/i.test(tier || '') }; }).filter(r => r.name);
    for (const r of roster) {
        const main = mainChars().find(n => A.sameName(n, r.name));
        const card = findPerson(r.name);
        if (card) card.bs = true;
        else if (!main && !a.extra.some(x => A.sameName(x, r.name))) a.extra.push(r.name);
    }
    for (const [name, text] of Object.entries(old.agendas || {})) {
        const k = mainChars().find(n => A.sameName(n, name)) || findPerson(name)?.name || name;
        a.chars[k] = { ...parseOld(text), mes: A.lastAiIndex() };
    }
    for (const e of old.offscreen || []) if (str(e)) a.events.push({ id: A.uid(), who: '', what: str(e), how: '', when: 'скоро', mes: A.lastAiIndex(), status: 'new' });
    a.at = Number.isFinite(old.lastAt) ? Math.min(old.lastAt, A.chatArr().length) : A.lastAiIndex();
    A.saveMeta();
    A.saveSettings();
    return true;
}

/** Старое «Закулисье» выключается: повестки теперь ведёт Life. */
function takeover() {
    const c = A.ctx();
    const bs = c.extensionSettings?.backstage;
    const cfg = simCfg();
    if (!bs || cfg.bsTaken) return;
    if (bs.enabled !== false) {
        bs.enabled = false;
        if (Number.isFinite(bs.every)) agendaCfg().every = bs.every || 8;
        if (Number.isFinite(bs.offscreenChance)) agendaCfg().chance = bs.offscreenChance;
        if (Number.isFinite(bs.contextMessages)) agendaCfg().ctx = Math.min(40, bs.contextMessages);
        try { c.setExtensionPrompt('backstage_agenda', '', c.extension_prompt_types?.IN_CHAT ?? 1, 3, false, 0); } catch { /* */ }
        A.toast('info', 'Повестки и события за кадром теперь ведёт Life: Персонаж → Внутри, Люди, Сцена. Старое «Закулисье» выключено, его записи перенесены.', '✦ Закулисье', { timeOut: 8000 });
    }
    cfg.bsTaken = true;
    A.saveSettings();
}

export function initAgenda(api) {
    A = api;
    const { eventSource, eventTypes: E } = A.ctx();
    if (E.GROUP_MEMBER_DRAFTED) eventSource.on(E.GROUP_MEMBER_DRAFTED, (id) => { const ch = A.ctx().characters?.[id]; if (ch) speaker = ch.name; });
    if (E.GENERATION_STARTED) eventSource.on(E.GENERATION_STARTED, (type, _o, dry) => { if (!dry && type !== 'quiet' && !A.ctx().groupId) speaker = A.ctx().name2 || ''; });
    if (E.CHAT_CHANGED) eventSource.on(E.CHAT_CHANGED, () => { speaker = ''; setTimeout(() => { try { if (A.hasChat?.() !== false) importChat(); } catch (e) { console.warn('[Life] закулисье: перенос', e); } }, 1200); });
    setTimeout(() => { try { takeover(); importChat(); } catch (e) { console.warn('[Life] закулисье: старт', e); } }, 2500);
}

// ───────────── обновление ─────────────

function cleanText(t) {
    return String(t || '')
        .replace(/<(think|thinking)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function transcript(n, max = 16000) {
    const chat = A.chatArr();
    const out = [];
    let total = 0;
    for (let i = chat.length - 1; i >= 0 && out.length < n; i--) {
        const m = chat[i];
        if (!m || m.is_system || m.extra?.life) continue;
        let t = cleanText(m.mes);
        if (!t) continue;
        if (t.length > 2200) t = `${t.slice(0, 1000)} … ${t.slice(-1000)}`;
        const line = `[${m.name}]: ${t}`;
        if (total + line.length > max) break;
        out.unshift(line);
        total += line.length;
    }
    return out.join('\n\n');
}

function systemPrompt(withEvents) {
    const U = userName();
    return `Ты — невидимый режиссёр живого мира ролевой истории (русскоязычный литературный фанфик по MCU, альтернативная вселенная). Задача — чтобы у персонажей была своя жизнь помимо сцены с ${U}: свои дела, цели, тайны, планы, отношения друг с другом.
Правила:
- Работай ТОЛЬКО с персонажами из состава. Кого нет в составе — в этой ветке нет, не упоминай.
- ${U} — персонаж игрока. Никогда не решай за неё, не придумывай её поступки, слова и мысли.
- Не противоречь тому, что уже случилось в чате, и тому, что известно о персонажах (их тело, состояние, распорядок, желания — даны в составе). Не двигай главный сюжет к развязке: создавай поводы и трения, а не решения.
- Если персонаж сейчас в сцене — now описывает его в сцене. Если нет — где он и чем занят сам по себе (по распорядку, если он есть).
- Повестки развиваются, а не переписываются с нуля: сохраняй преемственность с прошлой версией, двигай её вперёд.
- knows — что он знает и чего НЕ знает о последних событиях: знает только то, при чём был или что ему рассказали.
- Тон живой и приземлённый: бытовуха, работа, отношения, мелкие и средние конфликты, иногда сюжетные крючки. По-русски, коротко: 1–2 предложения на поле.
Ответ — только JSON без пояснений:
{"chars":{"<Имя главного>":{"now":"","want":"","hide":"","next":"что сделает сам в ближайшее время, без ${U}","knows":"","mood":""},"<Имя второстепенного>":{"now":"","want":""}},"events":[{"who":"","what":"что произошло за кадром","how":"звонок | СМС | новость | визит | последствие","when":"скоро | позже","to_user":false}]}
${withEvents ? `В events дай 1–2 правдоподобных события за кадром с участием персонажей из состава.` : 'В этот раз events — [].'}
to_user: true — если это ГЛАВНЫЙ персонаж, которого сейчас нет рядом с ${U}, сам выходит на связь с ней: звонит ей, пишет ей, едет к ней (how — звонок | СМС | визит, what — зачем, одной фразой). ${U} увидит это как «стук» и решит сама, пустить ли его в сцену. Не чаще одного такого на обновление, и только если у него правда есть повод по его повестке.`;
}

function rosterText() {
    const lines = [];
    for (const n of mainChars()) {
        const sl = nowSlot(n);
        const br = innerBrief(n);
        lines.push(`- ${n} (ГЛАВНЫЙ)${sl ? `; по распорядку сейчас: ${sl.what}` : ''}${br ? `; ${A.cut(br, 400)}` : ''}`);
    }
    for (const n of sideChars()) {
        const x = findPerson(n);
        lines.push(`- ${n} (второстепенный)${x ? `: ${A.cut([x.role, x.brief || x.bio].filter(Boolean).join('. '), 260)}` : ''}`);
    }
    return lines.join('\n');
}

export async function agendaUpdate({ manual = false } = {}) {
    if (busy) return false;
    const names = rosterNames();
    if (!names.length) { if (manual) A.toast('warning', 'Состав пуст — отметь людей «за кадром» во вкладке Люди'); return false; }
    busy = true;
    const chatId = A.ctx().getCurrentChatId?.();
    try {
        const cfg = agendaCfg();
        const a = M();
        const withEvents = Math.random() * 100 < cfg.chance;
        const st = A.worldState();
        const prev = names.map(n => {
            const g = a.chars[charKey(n)];
            return `### ${n}\n${g ? FIELDS.filter(([k]) => g[k]).map(([k, l]) => `${l}: ${g[k]}`).join('\n') : '(повестки ещё нет — создай по контексту)'}`;
        }).join('\n\n');
        const prevEv = a.events.filter(e => e.status !== 'gone').slice(-4).map(e => `- ${e.who ? `${e.who} — ` : ''}${e.what}`).join('\n') || '(нет)';
        const user = `СОСТАВ ЭТОЙ ВЕТКИ:\n${rosterText()}\n\nСЕЙЧАС: ${[st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(' ') || 'время не записано'}; место сцены: ${st.scene?.location || '—'}; в сцене: ${(st.scene?.characters_present || []).join(', ') || '—'}.\n\nПРОШЛЫЕ ПОВЕСТКИ:\n${prev}\n\nПРОШЛЫЕ СОБЫТИЯ ЗА КАДРОМ (если уже всплыли в чате — не повторяй):\n${prevEv}\n\nПОСЛЕДНИЕ СООБЩЕНИЯ ЧАТА:\n${transcript(cfg.ctx)}\n\nОбнови повестки всех персонажей из состава. Ответ — только JSON.`;
        const out = await A.askModel([{ role: 'system', content: systemPrompt(withEvents) }, { role: 'user', content: user }], 2600);
        if (A.ctx().getCurrentChatId?.() !== chatId) return false;
        const j = A.extractJson(out);
        if (!j || typeof j !== 'object') throw new Error('модель не прислала JSON');
        const got = j.chars && typeof j.chars === 'object' ? j.chars : {};
        const i = A.lastAiIndex();
        for (const [name, g] of Object.entries(got)) {
            const n = names.find(x => A.sameName(x, name) || (findPerson(x) && findPerson(x) === findPerson(name)));
            if (!n || !g || typeof g !== 'object') continue;
            const rec = Object.fromEntries(FIELDS.map(([k]) => [k, str(g[k] ?? g[{ now: 'сейчас', want: 'хочет', hide: 'скрывает', next: 'следующий_шаг', knows: 'в_курсе', mood: 'настроение' }[k]]).slice(0, 400)]).filter(([, v]) => v));
            const k = charKey(n);
            // ручные правки не теряются: поле, которое модель не прислала, остаётся прежним
            a.chars[k] = { ...(a.chars[k] || {}), ...rec, mes: i };
        }
        const ev = Array.isArray(j.events) ? j.events : [];
        if (ev.length) {
            for (const e of a.events) if (e.status === 'new') e.status = 'old';
            for (const e of ev.slice(0, 3)) {
                const what = str(e?.what || e?.['что'] || (typeof e === 'string' ? e : ''));
                if (what) a.events.push({ id: A.uid(), who: str(e?.who || e?.['кто']), what: what.slice(0, 300), how: str(e?.how || e?.['как_всплывёт']).slice(0, 80), when: str(e?.when || e?.['когда']) || 'скоро', toUser: e?.to_user === true || e?.toUser === true, mes: i, status: 'new' });
            }
        } else if (!withEvents) {
            const live = a.events.filter(e => e.status === 'new');
            live.slice(0, -1).forEach(e => { e.status = 'old'; });
        }
        if (a.events.length > 30) a.events = a.events.slice(-30);
        a.at = i;
        a.upd = Date.now();
        A.saveMeta();
        A.updatePrompt();
        if (manual) A.toast('success', 'Повестки обновлены', '✦ Закулисье', { timeOut: 1800 });
        return true;
    } catch (e) {
        console.warn('[Life] закулисье: обновление', e);
        if (manual) A.toast('warning', esc(String(e?.message || e)), '✦ Закулисье');
        return false;
    } finally { busy = false; }
}

/** После поста: пора ли обновить повестки. Ждём, пока таверна замолчит. */
export function agendaTick(i) {
    const cfg = agendaCfg();
    if (!cfg.on || !cfg.every) return;
    const a = M();
    if (i - a.at < cfg.every) return;
    const go = (n = 0) => setTimeout(() => {
        if (n < 30 && (busy || document.querySelector('#mes_stop')?.offsetParent)) return go(n + 1);
        agendaUpdate().then(ok => { if (ok && A.ui.open) A.render(); });
    }, 4000);
    go();
}

// ───────────── стук в сцену ─────────────

/** Событие, где главный герой сам выходит на связь с игроком (звонок/СМС/визит к ней) — это «стук», а не вплетание. */
function isKnockEv(e) {
    if (!e || !e.who || !mainChars().some(n => A.sameName(n, e.who))) return false;
    if (e.toUser === true) return true;
    if (e.toUser === false) return false;
    const u = A.norm(userName()).split(' ')[0];
    return /звон|смс|сообщ|визит|приед|приход/i.test(e.how || '') && !!u && A.norm(e.what).includes(u.slice(0, Math.max(3, u.length - 1)));
}
function knocksOn() { try { return !!A.ctx().groupId && A.settings().cast?.on !== false; } catch { return false; } }
export function agendaKnocks() { return M().events.filter(e => e.status === 'new' && isKnockEv(e)); }
export function agendaEventStatus(id, status) { const e = M().events.find(x => x.id === id); if (e) { e.status = status; A.saveMeta(); } }

// ───────────── заметка модели ─────────────

export function agendaPrompt(type) {
    if (type === 'quiet' || type === 'impersonate' || !agendaCfg().on) return '';
    const a = M();
    if (!Object.keys(a.chars).length && !a.events.length) return '';
    const here = (A.worldState().scene?.characters_present || []);
    const inScene = (n) => here.some(h => A.sameName(h, n));
    const intim = moodNow().intimOn;
    const parts = [];
    const main = mainChars();
    let who = main.find(n => A.sameName(n, speaker));
    if (!who && !A.ctx().groupId) who = main[0];
    const line = (n, g, keys) => keys.filter(k => g[k]).map(k => `${FIELDS.find(f => f[0] === k)[1]}: ${g[k]}`).join('; ');
    if (who) {
        const g = agendaOf(who);
        if (g) parts.push(`Своя жизнь ${short(who)} — пусть проступает в поведении, решениях, мыслях, звонках и сообщениях; не пересказывай и не раскрывай тайны прямо: ${line(who, g, intim ? ['hide', 'knows'] : ['now', 'want', 'hide', 'next', 'knows'])}.`);
    } else {
        // говорящий неизвестен — коротко про всех главных в сцене
        const bits = main.filter(inScene).map(n => { const g = agendaOf(n); return g?.want || g?.hide ? `${short(n)} — ${line(n, g, ['want', 'hide', 'knows'])}` : ''; }).filter(Boolean);
        if (bits.length) parts.push(`Своя жизнь героев (проступает в поведении, не пересказывай): ${bits.join(' | ')}.`);
    }
    if (!intim) {
        const others = rosterNames().filter(n => !A.sameName(n, who || '') && !inScene(n)).map(n => { const g = agendaOf(n); return g?.now ? `${short(n)} — ${A.cut(g.now, 140)}` : ''; }).filter(Boolean).slice(0, 6);
        if (others.length) parts.push(`Где сейчас остальные (за кадром): ${others.join('; ')}.`);
        // в группе «стук» решает игрок (плашка над вводом) — такие события говорящий не вплетает
        const ev = a.events.filter(e => e.status === 'new' && (e.push || /скоро/i.test(e.when || 'скоро')) && !(knocksOn() && isKnockEv(e))).slice(-2);
        if (ev.length) parts.push(`События за кадром — вплети в ближайшие ответы через деталь (звонок, СМС, новость, визит, последствие), естественно и без объявлений: ${ev.map(e => `${e.who ? `${e.who}: ` : ''}${e.what}${e.how ? ` (всплывёт: ${e.how})` : ''}`).join('; ')}.`);
    }
    return parts.length ? `[Закулисье — для автора, не для текста. ${parts.join(' ')}]` : '';
}

// ───────────── вид ─────────────

/** Карточка повестки для «Внутри» у главного героя. */
export function agendaCardHtml(who) {
    if (!agendaCfg().on) return '';
    const g = agendaOf(who);
    const a = M();
    const ago = a.at >= 0 ? A.lastAiIndex() - a.at : null;
    const rows = FIELDS.filter(([k]) => k !== 'mood' && g?.[k]).map(([k, label]) => `<div class="lf-ag-r${k === 'hide' ? ' hide' : ''}"><small>${label}</small>${k === 'hide' ? `<span class="lf-blur" data-act="sim-peek">${esc(g[k])}</span>` : `<span>${esc(g[k])}</span>`}</div>`).join('');
    return `${A.sec('Своя жизнь', ago == null ? 'ещё не обновлялась' : ago <= 0 ? 'обновлена только что' : `обновлена ${ago} пост. назад`)}
    <section class="lf-ag">${rows || `<div class="lf-empty small">Повестки пока нет — появится при следующем обновлении.</div>`}
        ${g?.mood ? `<div class="lf-ag-mood">${icon('moon')} ${esc(g.mood)}</div>` : ''}
        <div class="lf-ag-acts"><button class="lf-btn ghost" data-act="ag-edit" data-name="${esc(who)}">${icon('pencil')} Править</button><button class="lf-btn ghost" data-act="ag-run">${icon('refresh')} Обновить</button></div>
    </section>`;
}

/** Строчки повестки для карточки NPC. */
export function agendaNpcHtml(x) {
    if (!agendaCfg().on) return '';
    const g = agendaOf(x.name);
    return `${A.sec('За кадром', x.bs ? 'своя жизнь' : 'выключено')}
    ${x.bs && g ? `<section class="lf-ag">${['now', 'want', 'hide'].filter(k => g[k]).map(k => `<div class="lf-ag-r${k === 'hide' ? ' hide' : ''}"><small>${FIELDS.find(f => f[0] === k)[1]}</small>${k === 'hide' ? `<span class="lf-blur" data-act="sim-peek">${esc(g[k])}</span>` : `<span>${esc(g[k])}</span>`}</div>`).join('')}
        <div class="lf-ag-acts"><button class="lf-btn ghost" data-act="ag-edit" data-name="${esc(x.name)}">${icon('pencil')} Править</button></div></section>` : ''}
    <label class="lf-switch"><input type="checkbox" data-act="ag-bs" data-id="${esc(x.id)}" ${x.bs ? 'checked' : ''}><span></span>Живёт своей жизнью за кадром</label>`;
}

/** Блок «Люди»: чем заняты все за кадром. */
export function agendaPeopleHtml() {
    if (!agendaCfg().on) return '';
    const names = rosterNames();
    const a = M();
    const rows = names.map(n => {
        const g = agendaOf(n);
        const card = findPerson(n);
        return `<button class="lf-row" data-act="${card ? 'pp-open' : 'ag-card'}" ${card ? `data-id="${esc(card.id)}"` : `data-name="${esc(n)}"`}>${A.ava(n, 'sm')}<span><b>${esc(short(n))}</b><small class="lf-sub">${esc(g?.now ? A.cut(g.now, 120) : 'пока без повестки')}</small></span>${icon('right')}</button>`;
    }).join('');
    return `${A.sec('Чем заняты за кадром', a.at >= 0 ? `обновлено ${Math.max(0, A.lastAiIndex() - a.at)} пост. назад` : '')}
    ${names.length ? `<div class="lf-list">${rows}</div>` : '<div class="lf-empty small">Отметь в карточке человека «Живёт своей жизнью за кадром».</div>'}
    <div class="lf-actions"><button class="lf-btn" data-act="ag-run">${icon('refresh')} Обновить сейчас</button><button class="lf-btn ghost" data-act="ag-roster">${icon('users')} Состав</button></div>`;
}

/** События за кадром для «Сцены». */
export function agendaSceneHtml() {
    if (!agendaCfg().on) return '';
    const ev = M().events.filter(e => e.status === 'new').slice(-3).reverse();
    if (!ev.length) return '';
    return `<section class="lf-offcard"><div class="lf-offcard-h">${icon('route')} За кадром</div>
        ${ev.map(e => `<div class="lf-off"><span class="lf-ag-ev-ic">${icon(/звон|смс|сообщ/i.test(e.how) ? 'phone' : /новост/i.test(e.how) ? 'news' : /визит/i.test(e.how) ? 'door' : 'sparkles')}</span><span>${e.who ? `<b>${esc(short(e.who))}</b> ` : ''}${esc(e.what)}<small>${esc([e.how, e.push ? 'в следующем ответе' : e.when].filter(Boolean).join(' · '))}</small></span>
            ${knocksOn() && isKnockEv(e) ? `<button class="lf-iconbtn sm" data-act="kn-in" data-id="${esc(e.id)}" title="Пустить — ход переходит к нему">${icon('door')}</button>` : e.push ? '' : `<button class="lf-iconbtn sm" data-act="ag-ev-push" data-id="${esc(e.id)}" title="Пусть всплывёт сейчас">${icon('zap')}</button>`}<button class="lf-iconbtn sm" data-act="ag-ev-del" data-id="${esc(e.id)}" title="Не надо">${icon('x')}</button></div>`).join('')}
    </section>`;
}

/** Настройки в Мир → ⚙. */
export function agendaCfgHtml() {
    const c = agendaCfg();
    const seg = (key, opts, cur) => `<div class="lf-seg">${opts.map(([v, t]) => `<button class="${cur === v ? 'on' : ''}" data-act="ag-cfg" data-k="${key}" data-v="${v}">${t}</button>`).join('')}</div>`;
    return `<label class="lf-switch"><input type="checkbox" data-act="ag-on" ${c.on ? 'checked' : ''}><span></span>Закулисье: своя жизнь и события за кадром</label>
    <div class="lf-field"><label>Обновлять повестки</label>${seg('every', [[5, 'каждые 5'], [8, '8'], [12, '12'], [20, '20'], [0, 'руками']], c.every)}</div>
    <div class="lf-field"><label>События за кадром</label>${seg('chance', [[0, 'нет'], [30, 'редко'], [60, 'часто'], [90, 'всегда']], c.chance)}</div>`;
}

function editSheet(name) {
    const g = agendaOf(name) || {};
    const main = mainChars().some(n => A.sameName(n, name));
    A.openSheet(`${icon('pencil')} Повестка · ${esc(short(name))}`, `${FIELDS.filter(([k]) => main || ['now', 'want', 'hide'].includes(k)).map(([k, label]) => `<div class="lf-field"><label>${label}</label><textarea rows="2" data-ag="${k}">${esc(g[k] || '')}</textarea></div>`).join('')}
        <button class="lf-btn primary full" data-act="ag-save" data-name="${esc(name)}">${icon('check')} Сохранить</button>
        <div class="lf-hint">Модель будет двигать повестку дальше от того, что здесь написано.</div>`);
}

function rosterSheet() {
    const a = M();
    const cards = peopleList();
    A.openSheet(`${icon('users')} Кто живёт за кадром`, `<div class="lf-hint">Главные герои группы живут всегда. Здесь — второстепенные.</div>
        ${cards.length ? `<div class="lf-chips wrap">${cards.map(x => `<button class="lf-chip${x.bs ? ' on' : ''}" data-act="ag-bs-chip" data-id="${esc(x.id)}">${esc(x.name)}</button>`).join('')}</div>` : ''}
        ${a.extra.length ? `${A.sec('Без карточки')}<div class="lf-prefs">${a.extra.map(n => `<span class="lf-pref">${esc(n)}<button data-act="ag-extra-del" data-name="${esc(n)}">${icon('x')}</button></span>`).join('')}</div>` : ''}
        <div class="lf-field"><label>Добавить имя без карточки</label><div class="lf-inline"><input type="text" data-in="ag-extra" placeholder="Сэм Уилсон"><button class="lf-btn" data-act="ag-extra-add">${icon('plus')}</button></div></div>`, (b) => { b.dataset.k = 'agroster'; });
}

export async function agendaClick(act, el) {
    const a = M();
    const box = el.closest('.lf-sheet');
    const done = () => { A.saveMeta(); A.saveSettings(); A.updatePrompt(); A.render(); return true; };
    switch (act) {
        case 'ag-run': await A.withBusy(el, async () => { await agendaUpdate({ manual: true }); A.render(); }, 'Думаю…'); return true;
        case 'ag-edit': editSheet(el.dataset.name); return true;
        case 'ag-save': {
            const k = charKey(el.dataset.name);
            const rec = { ...(a.chars[k] || {}) };
            box?.querySelectorAll('[data-ag]').forEach(t => { rec[t.dataset.ag] = t.value.trim(); });
            a.chars[k] = rec;
            A.closeSheet();
            return done();
        }
        case 'ag-bs': { const x = peopleList().find(y => y.id === el.dataset.id); if (x) x.bs = !!el.checked; return done(); }
        case 'ag-bs-chip': { const x = peopleList().find(y => y.id === el.dataset.id); if (x) x.bs = !x.bs; el.classList.toggle('on', !!x?.bs); A.saveSettings(); A.updatePrompt(); A.render(); return true; }
        case 'ag-roster': rosterSheet(); return true;
        case 'ag-extra-add': { const v = box?.querySelector('[data-in="ag-extra"]')?.value?.trim(); if (v && !a.extra.some(n => A.sameName(n, v))) a.extra.push(v); A.saveMeta(); rosterSheet(); A.render(); return true; }
        case 'ag-extra-del': a.extra = a.extra.filter(n => n !== el.dataset.name); A.saveMeta(); rosterSheet(); A.render(); return true;
        case 'ag-card': {
            const x = peopleAdd({ name: el.dataset.name, bs: true, src: 'agenda' });
            a.extra = a.extra.filter(n => !A.sameName(n, el.dataset.name));
            A.ui.tab = 'people'; A.ui.npc = x.id;
            return done();
        }
        case 'ag-on': agendaCfg().on = !!el.checked; A.saveSettings(); A.updatePrompt(); A.render(); return true;
        case 'ag-ev-push': { const e = a.events.find(x => x.id === el.dataset.id); if (e) { e.push = true; e.when = 'скоро'; } return done(); }
        case 'ag-ev-del': { const e = a.events.find(x => x.id === el.dataset.id); if (e) e.status = 'gone'; return done(); }
        case 'ag-cfg': { const c = agendaCfg(); c[el.dataset.k] = Number(el.dataset.v); A.saveSettings(); A.render(); return true; }
    }
    return false;
}
