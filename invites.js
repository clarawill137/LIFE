// Приглашения. Позвал — значит ждёт ответа. Летописец замечает приглашение (кто, куда, когда) и ответ, если он
// прозвучал в посте; нет ответа — карточка «Принять / Отклонить» в полке трекеров. Принятое помнится до дня:
// модель знает, что сегодня. Обещала и не пришла — он задет, и это уходит модели, пока не объяснитесь.
// Идея — «Приглашения» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyNow, str, arr, similar } from './hudkit.js';

let A = null;
export function initInvites(api) { A = api; }
const esc = (v) => A.esc(v);

const on = () => A.settings().inv?.on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.inv || typeof cm.inv !== 'object') cm.inv = {};
    if (!Array.isArray(cm.inv.list)) cm.inv.list = [];   // { id, from, to, what, when, date, time, st: open|yes|no|came|missed|done, mes }
    if (!Number.isFinite(cm.inv.seq)) cm.inv.seq = 0;
    return cm.inv;
}
const act = () => M().list.filter(x => ['open', 'yes', 'missed'].includes(x.st));

/** Когда встреча (мс по истории) или null. */
function due(x) {
    const d = A.parseDate(x.date);
    if (!d || isNaN(d)) return null;
    const t = String(x.time || '').match(/(\d{1,2})[:.](\d{2})/);
    d.setHours(t ? +t[1] : 20, t ? +t[2] : 0, 0, 0);
    return d.getTime();
}
const today = (x) => { const d = due(x), now = storyNow(A); return d !== null && now !== null && new Date(d).toDateString() === new Date(now).toDateString(); };

/** Принятое и прошедшее без отметки «пришла» — сорвалось. */
function sweep() {
    const now = storyNow(A);
    if (now === null) return false;
    let changed = false;
    for (const x of M().list) { const d = due(x); if (x.st === 'yes' && d !== null && now > d + 3 * 3600000) { x.st = 'missed'; x.missedAt = A.chatArr().length - 1; changed = true; } }
    return changed;
}

const RULE = `
invites — приглашения, ПРОЗВУЧАВШИЕ в этом посте (позвал на ужин, свидание, встречу, в гости, на вечер, поехать вместе): [{"from":"кто зовёт","to":"кого","what":"куда или на что, 3-10 слов","when":"когда — словами из поста","date":"ДД.ММ.ГГГГ, если день ясен, иначе пусто","time":"ЧЧ:ММ или пусто"}]. Не пиши то, что уже есть в «Приглашениях». Нечего — [].
inviteAns — ответ на приглашение из «Приглашений», если он прямо прозвучал в этом посте, или встреча состоялась: [{"id":"i3","st":"yes|no|came"}]. Нечего — [].`;

export function invChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const rows = act().slice(-6).map(x => `[${x.id}] ${x.from} → ${x.to}: ${x.what}, ${x.when || x.date || 'когда-нибудь'} (${x.st === 'open' ? 'без ответа' : x.st === 'yes' ? 'принято' : 'сорвалось'})`);
    return { key: '"invites": [], "inviteAns": []', rule: RULE, tokens: 150, input: `Приглашения: ${rows.length ? rows.join(' | ') : 'нет'}` };
}

export function invAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    s.list = s.list.filter(x => !(x.mes === i && x.src === 'post'));
    for (const x of s.list) if (x.ansMes === i) { x.st = x.prev || 'open'; delete x.ansMes; }
    let changed = sweep();
    for (const r of arr(j?.invites).slice(0, 2)) {
        const from = A.canonName(str(r?.from, 50)), to = A.canonName(str(r?.to, 50)), what = str(r?.what, 110);
        if (!from || !to || !what || act().some(x => A.sameName(x.from, from) && similar(A, x.what, what, 0.6))) continue;
        s.list.push({ id: `i${++s.seq}`, from, to, what, when: str(r?.when, 60), date: str(r?.date, 12), time: str(r?.time, 6), st: 'open', mes: i, src: 'post' });
        changed = true;
    }
    for (const r of arr(j?.inviteAns).slice(0, 3)) {
        const x = s.list.find(y => y.id === str(r?.id));
        const st = ['yes', 'no', 'came'].includes(str(r?.st)) ? str(r.st) : '';
        if (!x || !st || x.st === st || (st !== 'came' && x.st !== 'open')) continue;
        x.prev = x.st; x.st = st; x.ansMes = i;
        changed = true;
    }
    if (s.list.length > 60) s.list.splice(0, s.list.length - 60);
    if (changed) A.saveMeta();
}

export function invPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    if (sweep()) A.saveMeta();
    const n = A.chatArr().length;
    const out = [];
    const open = act().filter(x => x.st === 'open');
    if (open.length && (open.some(x => n - 1 - x.mes <= 2) || n % 3 === 0)) out.push(`[Приглашения без ответа: ${open.slice(-3).map(x => `${A.shortName(x.from)} позвал(а) ${A.shortName(x.to)} — ${x.what}${x.when ? `, ${x.when}` : ''}`).join('; ')}. Тот, кто звал, ждёт ответа: может напомнить, переспросить, сделать вид, что неважно, — но помнит. За ${A.shortName(A.canonName(A.ctx().name1))} не отвечай.]`);
    const td = act().filter(x => x.st === 'yes' && today(x));
    if (td.length) out.push(`[Сегодня по уговору: ${td.map(x => `${x.what} — ${A.shortName(x.from)} и ${A.shortName(x.to)}${x.time ? `, в ${x.time}` : ''}`).join('; ')}. Оба помнят: готовятся, смотрят на часы, напоминают.]`);
    const miss = act().filter(x => x.st === 'missed');
    if (miss.length) out.push(`[Сорвалось: ${miss.slice(-2).map(x => `${A.shortName(x.to)} согласилась — ${x.what} (${x.when || x.date}) — и не пришла, не предупредив ${A.shortName(x.from)}`).join('; ')}. Он задет и не делает вид, что нет: холоднее, суше, может спросить прямо. Проходит не само, а разговором.]`);
    return out.join('\n');
}

export function invSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    if (sweep()) A.saveMeta();
    const list = act();
    if (!list.length) return '';
    const btn = (a, id, label, cls = '') => `<button class="lf-btn ${cls}" data-act="${a}" data-id="${id}">${label}</button>`;
    return `${A.sec('Приглашения', String(list.length))}<div class="lf-inv">${list.slice(-5).reverse().map(x => `<div class="lf-inv-c st-${x.st}"><div class="lf-inv-h">${A.ava(x.from, 'xs')}<span><b>${esc(x.what)}</b><small>${esc([`${A.shortName(x.from)} → ${A.shortName(x.to)}`, x.when || x.date, x.time].filter(Boolean).join(' · '))}</small></span></div>
        <div class="lf-actions tight">${x.st === 'open' ? `${btn('inv-yes', x.id, 'Принять', 'primary')}${btn('inv-no', x.id, 'Отклонить')}` : x.st === 'yes' ? `<small>принято${today(x) ? ' · сегодня' : ''}</small>${btn('inv-came', x.id, 'Состоялось')}${btn('inv-no', x.id, 'Отменить', 'ghost')}` : `<small>не пришла — он задет</small>${btn('inv-done', x.id, 'Объяснились')}`}${btn('inv-del', x.id, A.icon('x'), 'ghost')}</div></div>`).join('')}</div>`;
}

export function invClick(a, el) {
    if (!a.startsWith('inv-')) return false;
    const s = M();
    const x = s.list.find(y => y.id === el.dataset.id);
    if (!x) return true;
    const me = A.sameName(x.to, A.canonName(A.ctx().name1));
    if (a === 'inv-yes') { x.st = 'yes'; A.cueSet?.({ key: `inv:${x.id}`, src: 'Приглашение', once: true, text: `${A.shortName(x.to)} ${me ? 'принимает' : 'принял(а)'} приглашение ${A.shortName(x.from)}: ${x.what}${x.when ? `, ${x.when}` : ''}` }); }
    if (a === 'inv-no') { x.st = 'no'; A.cueSet?.({ key: `inv:${x.id}`, src: 'Приглашение', once: true, text: `${A.shortName(x.to)} отказывается от приглашения ${A.shortName(x.from)}: ${x.what}` }); }
    if (a === 'inv-came') x.st = 'came';
    if (a === 'inv-done') x.st = 'done';
    if (a === 'inv-del') s.list = s.list.filter(y => y !== x);
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function invRecs(i) {
    const s = M();
    const out = [];
    for (const x of s.list) {
        if (x.mes === i && x.src === 'post') out.push({ id: `inv:${x.id}`, g: 'Приглашения', icon: 'flag', t: `${A.shortName(x.from)} зовёт ${A.shortName(x.to)}: ${x.what}`, del: () => { s.list = s.list.filter(y => y !== x); } });
        else if (x.ansMes === i) out.push({ id: `inv:${x.id}:a`, g: 'Приглашения', icon: 'flag', t: `ответ на приглашение: ${x.what} — ${x.st}`, del: () => { x.st = x.prev || 'open'; delete x.ansMes; } });
    }
    return out;
}
