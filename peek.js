// Подслушанное. Взгляд поверх плеча автора: разговор, которого твоя героиня не слышала, — те, кого нет в сцене,
// обсуждают случившееся. В наше время это переписка в мессенджере, в 1940-е — разговор за стеной или письмо.
// Пишется по кнопке, читаешь только ты: модели ничего не уходит. Захочешь, чтобы это стало фактом истории, —
// «→ в „Кто что знает“»: запишется как знание этих двоих, и остальные его знать не будут.
// Идея — «Перехваты» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyDay, str, arr } from './hudkit.js';

let A = null;
export function initPeek(api) { A = api; }
const esc = (v) => A.esc(v);

function M() {
    const cm = A.chatMeta();
    if (!cm.peek || typeof cm.peek !== 'object') cm.peek = {};
    if (!Array.isArray(cm.peek.list)) cm.peek.list = [];
    if (!Number.isFinite(cm.peek.seq)) cm.peek.seq = 0;
    return cm.peek;
}
const old = () => { const d = A.parseDate(storyDay(A)); return !!d && !isNaN(d) && d.getFullYear() < 1995; };

async function run() {
    const s = M();
    const st = A.worldState();
    const user = A.canonName(A.ctx().name1);
    const here = (st?.scene?.characters_present || []).map(A.canonName);
    const cast = A.groupMembers().map(A.canonName).filter(n => n && !A.sameName(n, user));
    const away = cast.filter(n => !here.some(h => A.sameName(h, n)));
    let people = '';
    try { people = arr(A.peopleList?.()).slice(0, 30).map(p => `${p.name}${p.group ? ` (${p.group})` : ''}`).join(', '); } catch { /* */ }
    let state = '';
    try { state = arr(A.promptParts?.()).filter(p => /закулис|повестк|кто где|тайн|знает/i.test(p?.label || '')).map(p => A.cut(p.text, 900)).join('\n'); } catch { /* */ }
    let days = '';
    try { days = A.daysBrief?.() || ''; } catch { /* */ }
    const chat = A.chatArr();
    const posts = [];
    for (let i = chat.length - 1; i >= 0 && posts.length < 4; i--) if (A.isPost(chat[i])) posts.unshift(`${chat[i].name}: ${A.cut(A.plainText(chat[i].mes), 1200)}`);
    const kindList = old() ? 'talk|letter' : 'chat|talk|call';
    const kindHelp = old() ? 'talk — разговор за стеной, на кухне, в коридоре; letter — письмо, записка, телеграмма' : 'chat — переписка в мессенджере; talk — разговор вживую; call — звонок';
    const sys = `Ты пишешь для автора ролевой истории сцену «за кадром»: разговор двух людей, которых СЕЙЧАС НЕТ в сцене с ${A.shortName(user)}, о том, что недавно случилось в истории или что они затевают. ${A.shortName(user)} этого не слышит. Ответ — строго один JSON по-русски: {"kind":"${kindList}","who":["имя","имя"],"where":"где и когда, 2-8 слов","lines":[{"n":"имя","t":"реплика или сообщение"}],"fact":"что из этого разговора следует как факт истории, 5-14 слов"}. kind: ${kindHelp}. 5-9 реплик, живо и в характере каждого; они знают только то, что могли узнать сами, — не выдавай им чужих тайн и мыслей ${A.shortName(user)}. Ничего не решай за ${A.shortName(user)} и не меняй уже случившееся.`;
    const usr = `Дата истории: ${storyDay(A) || '—'}. Сейчас в сцене: ${here.join(', ') || '—'}.\nНе в сцене из главных: ${away.join(', ') || 'все на месте — возьми кого-то из людей вокруг'}.${people ? `\nЛюди вокруг: ${people}` : ''}${state ? `\nЧто известно о делах за кадром:\n${A.cut(state, 2500)}` : ''}${days ? `\nПоследние дни:\n${A.cut(days, 2500)}` : ''}\nПоследние посты:\n${posts.join('\n\n')}`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1300, { check: (x) => Array.isArray(x?.lines) && x.lines.length > 1, what: 'Подслушанное' });
    const it = { id: `p${++s.seq}`, kind: ['chat', 'talk', 'call', 'letter'].includes(str(j.kind)) ? str(j.kind) : 'talk', who: arr(j.who).map(n => A.canonName(str(n, 50))).filter(Boolean).slice(0, 3), where: str(j.where, 80), lines: arr(j.lines).slice(0, 10).map(l => ({ n: A.canonName(str(l?.n, 50)), t: str(l?.t, 500) })).filter(l => l.t), fact: str(j.fact, 140), day: storyDay(A), mes: chat.length - 1 };
    s.list.push(it);
    if (s.list.length > 20) s.list.splice(0, s.list.length - 20);
    A.saveMeta();
    return it;
}

const KIND = { chat: '💬 переписка', talk: '👂 разговор', call: '📞 звонок', letter: '✉️ письмо' };

function itemHtml(it) {
    const first = it.who[0] || it.lines[0]?.n;
    return `<div class="lf-ovh k-${it.kind}"><div class="lf-ovh-h"><b>${KIND[it.kind]}</b><small>${esc([it.who.map(A.shortName).join(' и '), it.where, it.day].filter(Boolean).join(' · '))}</small></div>
        <div class="lf-ovh-l">${it.lines.map(l => `<div class="${A.sameName(l.n, first) ? 'a' : 'b'}"><small>${esc(A.shortName(l.n))}</small><p>${esc(l.t)}</p></div>`).join('')}</div>
        ${it.fact ? `<div class="lf-ovh-f"><small>из этого следует</small>${esc(it.fact)}</div>` : ''}
        <div class="lf-actions tight">${it.fact ? `<button class="lf-btn${it.kept ? '' : ' primary'}" data-act="ovh-keep" data-id="${it.id}"${it.kept ? ' disabled' : ''}>${it.kept ? '✓ в «Кто что знает»' : '→ в «Кто что знает»'}</button>` : ''}<button class="lf-btn ghost" data-act="ovh-del" data-id="${it.id}">${A.icon('x')} убрать</button></div></div>`;
}

const sheet = () => A.openSheet('👂 Подслушанное', `<div class="lf-hint">Читаешь только ты. Модели ничего не уходит, пока сама не отправишь факт в «Кто что знает».</div>
    <button class="lf-btn primary full" data-act="ovh-run">${A.icon('sparkles')} Подслушать ещё</button>
    ${M().list.slice().reverse().map(itemHtml).join('') || '<div class="lf-empty small">Пока ничего не подслушано.</div>'}`);

export function peekSceneHtml() {
    if (!A?.hasChat?.() || A.settings().peek?.on === false) return '';
    const n = M().list.length;
    return `<button class="lf-btn ghost full" data-act="ovh-open">👂 Подслушанное${n ? ` · ${n}` : ''}</button>`;
}

export async function peekClick(act, el) {
    if (!act.startsWith('ovh-')) return false;
    const s = M();
    const it = s.list.find(x => x.id === el.dataset.id);
    if (act === 'ovh-open') { sheet(); return true; }
    if (act === 'ovh-run') { await A.withBusy(el, () => run(), 'Слушаю…'); sheet(); A.render(); return true; }
    if (act === 'ovh-del' && it) s.list = s.list.filter(x => x !== it);
    if (act === 'ovh-keep' && it?.fact) { A.knowAdd?.(it.fact, it.who); it.kept = true; A.toast('success', 'Записано: знают только они', '✦ Кто что знает', { timeOut: 1800 }); }
    A.saveMeta(); sheet(); A.render();
    return true;
}
