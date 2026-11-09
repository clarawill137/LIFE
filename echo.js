// Эхо решений. Твой крупный выбор со ставками — соврала, скрыла, пощадила, сдала, нарушила обещание, рискнула собой,
// выбрала одного вместо другого — не растворяется. «Не пропусти» замечает его в твоём посте и запоминает: что выбрала
// и чем может аукнуться. Через время Закулисье даёт ему отозваться живым следствием: кто-то узнал, обиделся или,
// наоборот, стал доверять; пришёл с последствиями или выручил. Под твоим постом — ⚖ «запомнила»;
// Мир → События — список: ждёт / аукнулось, ⚡ «пусть аукнется скорее», ✕ «забыть».

let A = null;
export function initEcho(api) { A = api; }

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

function cfg() {
    const s = A.settings();
    if (!s.echo || typeof s.echo !== 'object') s.echo = {};
    const c = s.echo;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(Number(c.min)) || Number(c.min) < 2) c.min = 20; // сообщений, раньше которых не аукается
    return c;
}
export const echoOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.echo || typeof cm.echo !== 'object') cm.echo = {};
    if (!Array.isArray(cm.echo.list)) cm.echo.list = [];
    return cm.echo;
}
export const echoList = () => M().list;

/** Запись ещё про тот пост? Индексы съезжают, если что-то удалили: ищу пост рядом по тексту. */
function alive(x) {
    const chat = A.chatArr();
    const at = (j) => chat[j]?.is_user && A.hash(chat[j].mes || '') === x.h;
    if (at(x.mes)) return true;
    for (let d = 1; d <= 6; d++) for (const j of [x.mes - d, x.mes + d]) if (at(j)) { x.mes = j; return true; }
    return !!chat[x.mes]?.is_user; // пост поправили — решение остаётся
}

/** Из разбора «Не пропусти»: в посте игрока u крупное решение. */
export function echoAdd(u, c) {
    if (!echoOn() || !c || typeof c !== 'object') return null;
    const m = A.chatArr()[u];
    const what = str(c.what).slice(0, 180);
    if (!m?.is_user || what.length < 6) return null;
    const list = M().list;
    const h = A.hash(m.mes || '');
    const same = list.find(x => x.mes === u);
    if (same && same.h === h) return same;
    if (same && same.st === 'wait') list.splice(list.indexOf(same), 1); // пост переписали — решение заново
    let date = '';
    try { date = String(A.worldState().timestamp?.story_date || ''); } catch { /* */ }
    const w = Math.round(Number(c.weight));
    const x = { id: `e${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`, mes: u, h, what, stake: str(c.stake).slice(0, 180), who: arr(c.who).map(n => A.canonName(str(n))).filter(Boolean).slice(0, 4), weight: w >= 1 && w <= 3 ? w : 2, date, st: 'wait' };
    list.push(x);
    // держать 40: сначала уходят отыгранные и забытые
    while (list.length > 40) { const k = list.findIndex(y => y.st !== 'wait'); list.splice(k >= 0 ? k : 0, 1); }
    A.saveMeta();
    A.paintSoon?.();
    return x;
}

const ageOf = (x) => Math.max(0, A.chatArr().length - 1 - x.mes);

/** Для Закулисья: решения, которым пора аукнуться. force — в этот раз одно должно отозваться. */
export function echoForAgenda() {
    if (!echoOn()) return null;
    const min = Number(cfg().min) || 20;
    const ripe = M().list.filter(x => x.st === 'wait' && alive(x) && (x.push || ageOf(x) >= min))
        .sort((a, b) => (b.push ? 1 : 0) - (a.push ? 1 : 0) || b.weight - a.weight || ageOf(b) - ageOf(a))
        .slice(0, 3);
    if (!ripe.length) return null;
    // перезрело: весомое — через ~20 ходов, среднее — ~30, мелкое — ~40
    const due = ripe.find(x => x.push || ageOf(x) >= min * 2 + (3 - x.weight) * min);
    const U = A.shortName(A.canonName(A.ctx().name1));
    const rows = ripe.map(x => `- ${x.id} · ${x.what}${x.stake ? ` · чем может аукнуться: ${x.stake}` : ''}${x.who.length ? ` · касается: ${x.who.join(', ')}` : ''} · ${ageOf(x)} сообщ. назад${x.date ? ` (${x.date})` : ''}`).join('\n');
    const text = `РЕШЕНИЯ ${U.toUpperCase()}, КОТОРЫЕ ЕЩЁ НЕ АУКНУЛИСЬ (id · что выбрала · ставки · давность):\n${rows}\n${due
        ? `В этот раз пусть одно из них аукнется (лучше ${due.id}): событие за кадром или стук — how "последствие", и в событии "echo":"${due.id}".`
        : 'Если по логике мира уже пора — пусть одно из них аукнется: событие с how "последствие" и "echo":"id". Если не пора — не трогай.'}
Аукается живым следствием, а не наказанием «по сценарию»: кто-то узнал, обиделся или стал доверять, что-то сломалось — или выручило. ${U} в событии не решает и не действует — только другие.`;
    return { text, force: !!due, ids: ripe.map(x => x.id) };
}

/** Закулисье отыграло решение: событие — его эхо. */
export function echoMark(id, ev) {
    const x = M().list.find(y => y.id === str(id));
    if (!x || x.st !== 'wait') return false;
    x.st = 'echo';
    x.push = false;
    x.ev = { what: str(ev?.what).slice(0, 300), who: str(ev?.who), how: str(ev?.how), mes: ev?.mes ?? A.lastAiIndex?.() };
    A.saveMeta();
    A.paintSoon?.();
    return true;
}

// ───────────── вид ─────────────

/** Под твоим постом: ⚖ запомнила. */
export function paintEcho(el, id) {
    const m = A.chatArr()[id];
    const old = el.querySelector(':scope .lf-echo');
    const x = echoOn() && m?.is_user ? M().list.find(y => y.mes === id && y.st !== 'off' && y.h === A.hash(m.mes || '')) : null;
    if (!x) { old?.remove(); return; }
    const html = `<div class="lf-echo lf-own${x.st === 'echo' ? ' done' : ''}"><button data-act="echo-open" title="Мир → События">⚖ <span>${x.st === 'echo' ? 'аукнулось' : 'запомнила'}: ${esc(A.cut(x.what, 90))}</span></button></div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    host.append(node);
}

/** Мир → События, сверху: решения и их эхо. */
export function echoHtml() {
    if (!echoOn()) return '';
    const list = M().list.filter(x => x.st !== 'off' && alive(x)).slice().reverse();
    if (!list.length) return `${A.sec('Эхо решений')}<div class="lf-hint">Твои крупные решения со ставками (соврала, скрыла, пощадила, нарушила обещание, рискнула собой) появятся здесь — и через время аукнутся через Закулисье.</div>`;
    const min = Number(cfg().min) || 20;
    return `${A.sec('Эхо решений', `${list.filter(x => x.st === 'wait').length} ждут`)}
    <div class="lf-echo-list">${list.map(x => `<div class="lf-echo-i ${x.st}">
        <div class="lf-echo-t"><b>${esc(x.what)}</b>${x.stake ? `<small>на кону: ${esc(x.stake)}</small>` : ''}</div>
        <div class="lf-echo-m">${'●'.repeat(x.weight)}${'○'.repeat(3 - x.weight)} · ${x.st === 'echo' ? 'аукнулось' : x.push ? 'аукнется скоро' : ageOf(x) < min ? 'ещё рано' : 'может аукнуться'}${x.date ? ` · ${esc(x.date)}` : ''}</div>
        ${x.st === 'echo' && x.ev?.what ? `<div class="lf-echo-ev"><span class="lf-blur" data-act="sim-peek">${esc(x.ev.who ? `${A.shortName(A.canonName(x.ev.who))}: ` : '')}${esc(x.ev.what)}</span></div>` : ''}
        <div class="lf-echo-b"><button class="lf-iconbtn sm" data-act="jump" data-mes="${x.mes}" title="К посту">${A.icon('right')}</button>${x.st === 'wait' ? `<button class="lf-iconbtn sm${x.push ? ' on' : ''}" data-act="echo-push" data-id="${esc(x.id)}" title="Пусть аукнется скорее">${A.icon('zap')}</button>` : ''}<button class="lf-iconbtn sm" data-act="echo-off" data-id="${esc(x.id)}" title="Забыть">${A.icon('x')}</button></div>
    </div>`).join('')}</div>`;
}

export function echoClick(act, el) {
    if (!act.startsWith('echo-')) return false;
    if (act === 'echo-open') {
        A.ui.worldTab = 'events';
        A.openHub?.('world');
        return true;
    }
    const x = M().list.find(y => y.id === el.dataset.id);
    if (!x) return true;
    if (act === 'echo-push') {
        x.push = !x.push;
        if (x.push) {
            A.toast('info', 'Закулисье подумает, как это аукнется, — всплывёт в ближайших ответах.', '⚖ Эхо', { timeOut: 2600 });
            try { A.agendaRun?.(); } catch (e) { console.warn('[Life] эхо решений', e); }
        }
    }
    if (act === 'echo-off') x.st = 'off';
    A.saveMeta();
    A.render?.();
    A.paintSoon?.();
    return true;
}
