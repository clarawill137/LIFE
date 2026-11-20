// Знакомства. Кто кого знает в лицо, кто о ком только слышал, а кто видит впервые. По умолчанию свои считаются
// знакомыми — отмечается обратное: «не знакомы» и «только слышал». Пока такие двое в одной сцене, модель держит
// их незнакомцами (не знают имён и прошлого друг друга); встретились — Летописец отмечает знакомство сам.
// Расставить можно тапом, или дать умной модели пройти по своду истории, карточкам и «Людям».

import { str, arr } from './hudkit.js';

let A = null;
export function initMeet(api) { A = api; }
const esc = (v) => A.esc(v);

const ST = { met: 'знакомы', heard: 'только слышал(а)', none: 'не знакомы' };
const NEXT = { met: 'heard', heard: 'none', none: 'met' };

function cfg() {
    const s = A.settings();
    if (!s.meet || typeof s.meet !== 'object') s.meet = {};
    if (s.meet.on === undefined) s.meet.on = true;
    return s.meet;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.meet || typeof cm.meet !== 'object') cm.meet = {};
    if (!cm.meet.rel || typeof cm.meet.rel !== 'object') cm.meet.rel = {};   // «a|b» → { a, b, st, mes, src }
    return cm.meet;
}
const pk = (a, b) => [A.canonName(a) || a, A.canonName(b) || b].map(A.norm).sort().join('|');
const everyone = () => { const u = A.canonName(A.ctx().name1); return [u, ...A.groupMembers().map(A.canonName)].filter((n, k, a) => n && a.findIndex(x => A.sameName(x, n)) === k); };
const npcs = () => { try { return arr(A.peopleList?.()).map(p => p?.name).filter(Boolean).slice(0, 16); } catch { return []; } };
const same = (x, y) => A.sameName(x, y) || A.norm(x) === A.norm(y);

/** Как двое знакомы: met | heard | none. Без записи — знакомы. */
export function meetOf(a, b) {
    try { const r = M().rel[pk(a, b)]; return r && ST[r.st] ? r.st : 'met'; } catch { return 'met'; }
}
function setRel(a, b, st, extra = {}) {
    const s = M();
    const k = pk(a, b);
    if (st === 'met' && !extra.keep) delete s.rel[k];
    else s.rel[k] = { a: A.canonName(a) || a, b: A.canonName(b) || b, st, mes: -1, src: 'me', ...extra };
}
const strangers = () => Object.values(M().rel).filter(r => r && (r.st === 'none' || r.st === 'heard'));

// ───────────── Летописец ─────────────

const RULE = `
meets — кто из строки «Не знакомы» в этом посте ВПЕРВЫЕ встретился лично или впервые узнал о другом: [{"a":"кто","b":"с кем","st":"met|heard"}]. met — встретились и теперь знают друг друга в лицо (представились, поговорили, были в одной сцене и поняли, кто перед ними); heard — лично не виделись, но один узнал о существовании другого. Только пары из строки «Не знакомы». Нечего — [].`;

export function meetChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const list = strangers();
    if (!list.length) return null;
    return { key: '"meets": []', rule: RULE, tokens: 50, input: `Не знакомы: ${list.slice(-14).map(r => `${r.a} и ${r.b}${r.st === 'heard' ? ' (только слышали друг о друге)' : ''}`).join('; ')}` };
}

export function meetAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    let changed = false;
    // свайп: вернуть то, что поменял этот пост
    for (const [k, r] of Object.entries(s.rel)) if (r?.mes === i && r.src === 'post') { if (r.was) s.rel[k] = r.was; else delete s.rel[k]; changed = true; }
    for (const m of arr(j?.meets).slice(0, 4)) {
        const a = str(m?.a, 60), b = str(m?.b, 60), st = str(m?.st, 10);
        if (!a || !b || same(a, b) || !['met', 'heard'].includes(st)) continue;
        const k = pk(a, b);
        const old = s.rel[k];
        if (!old || old.st === 'met' || (old.st === 'heard' && st === 'heard')) continue;   // не из списка или нечего менять
        s.rel[k] = { a: old.a, b: old.b, st, mes: i, src: 'post', was: { ...old, was: undefined } };
        changed = true;
    }
    if (changed) A.saveMeta();
}

// ───────────── заметка модели ─────────────

export function meetPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const list = strangers();
    if (!list.length) return '';
    const user = A.canonName(A.ctx().name1);
    const here = [user, ...(A.worldState()?.scene?.characters_present || [])].filter(Boolean);
    const inScene = (n) => here.some(h => same(h, n));
    let lastUser = '';
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0 && i >= chat.length - 3; i--) if (chat[i]?.is_user) { lastUser = A.norm(A.plainText(chat[i].mes || '')); break; }
    const named = (n) => { const w = A.norm(A.shortName(n)); return w.length >= 3 && lastUser.includes(w.length > 4 ? w.slice(0, -1) : w); };
    const both = [], name = [];
    for (const r of list) {
        const ia = inScene(r.a), ib = inScene(r.b);
        if (ia && ib) both.push(r.st === 'none' ? `${A.shortName(r.a)} и ${A.shortName(r.b)} видят друг друга впервые` : `${A.shortName(r.a)} и ${A.shortName(r.b)} лично не встречались — только слышали друг о друге`);
        else if (r.st === 'none' && ia !== ib) { const inn = ia ? r.a : r.b, out = ia ? r.b : r.a; if (named(out) && !same(inn, user)) name.push(`для ${A.shortName(inn)} «${A.shortName(out)}» — незнакомое имя`); }
    }
    const out = [];
    if (both.length) out.push(`[Не знакомы: ${both.slice(0, 4).join('; ')}. Незнакомые не знают имён, прошлого и привычек друг друга: присматриваются, знакомятся или держатся в стороне; знание появляется только из того, что сказано и видно в сцене.]`);
    if (name.length) out.push(`[${name.slice(0, 3).join('; ')}: не узнаёт, может переспросить, кто это.]`);
    return out.join('\n');
}

// ───────────── вид: Персонаж → Жизнь → Психика ─────────────

export function meetHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const pool = [...everyone(), ...npcs()].filter((n, k, a) => a.findIndex(x => same(x, n)) === k && !same(n, name));
    if (!pool.length) return '';
    const odd = pool.filter(n => meetOf(name, n) !== 'met').length;
    return `${A.sec('Знакомства', odd ? `не знаком(а) с ${odd}` : 'знает всех')}
    <div class="lf-meet">${pool.map(n => { const st = meetOf(name, n); return `<button class="lf-meet-p ${st}" data-act="mt-tog" data-a="${esc(name)}" data-b="${esc(n)}" title="тап — сменить">${A.ava(n, 'xs')}<span><b>${esc(A.shortName(n))}</b><small>${ST[st]}</small></span></button>`; }).join('')}</div>
    <div class="lf-chips wrap"><button class="lf-chip" data-act="mt-fill">${A.icon('book')} Расставить по истории</button></div>
    <div class="lf-hint">Тап по человеку — «знакомы → только слышал(а) → не знакомы». Встретятся в сцене — Летописец отметит сам.</div>`;
}

const FILL = `Ты помогаешь автору литературной ролевой истории на русском. По своду истории, карточкам и списку людей назови пары, которые к текущему моменту истории НЕ знакомы лично: st "none" — ничего друг о друге не знают; "heard" — слышали друг о друге, но не встречались. Только пары из данного списка имён; тех, кто знаком, не пиши. Сомневаешься — не пиши.
Ответь только JSON: {"pairs":[{"a":"имя","b":"имя","st":"none|heard"}]}`;

export async function meetClick(act, el) {
    if (!act.startsWith('mt-')) return false;
    switch (act) {
        case 'mt-tog': {
            const a = el.dataset.a, b = el.dataset.b;
            if (!a || !b) return true;
            setRel(a, b, NEXT[meetOf(a, b)]);
            break;
        }
        case 'mt-fill': {
            const cm = A.chatMeta();
            await A.withBusy(el, async () => {
                const names = [...everyone(), ...npcs()].filter((n, k, a) => a.findIndex(x => same(x, n)) === k);
                const j = await (A.askFillJson || A.askJson)([{ role: 'system', content: FILL }, { role: 'user', content: `Имена: ${names.join('; ')}` }], 1200, { check: (x) => Array.isArray(x?.pairs), what: 'Знакомства' }, { world: true });
                if (A.chatMeta() !== cm) return;
                let n = 0;
                for (const p of arr(j.pairs).slice(0, 60)) {
                    const a = names.find(x => same(x, str(p?.a, 60))), b = names.find(x => same(x, str(p?.b, 60))), st = str(p?.st, 10);
                    if (!a || !b || same(a, b) || !['none', 'heard'].includes(st)) continue;
                    const old = M().rel[pk(a, b)];
                    if (old && old.src !== 'fill') continue;   // тронутое руками или постом не переписываем
                    setRel(a, b, st, { src: 'fill' });
                    n++;
                }
                A.toast(n ? 'success' : 'info', n ? `Отмечено пар: ${n}` : 'По истории все знакомы', '✦ Знакомства', { timeOut: 3000 });
            }, 'Читаю историю…');
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function meetRecs(i) {
    const s = M();
    const out = [];
    for (const [k, r] of Object.entries(s.rel)) {
        if (r?.mes === i && r.src === 'post') out.push({ id: `mt:${k}`, g: 'Знакомства', icon: 'handshake', t: `${A.shortName(r.a)} и ${A.shortName(r.b)}: ${r.st === 'met' ? 'познакомились' : 'узнали друг о друге'}`, del: () => { if (r.was) s.rel[k] = r.was; else delete s.rel[k]; } });
    }
    return out;
}

/** Трекер в Сцене: кто из присутствующих не знаком. */
export function meetSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const list = strangers();
    if (!list.length) return '';
    return `<div class="lf-meet">${list.slice(-12).reverse().map(r => `<button class="lf-meet-p ${r.st}" data-act="mt-tog" data-a="${esc(r.a)}" data-b="${esc(r.b)}">${A.ava(r.a, 'xs')}${A.ava(r.b, 'xs')}<span><b>${esc(A.shortName(r.a))} и ${esc(A.shortName(r.b))}</b><small>${ST[r.st]}</small></span></button>`).join('')}</div>`;
}
export const meetCount = () => { try { return strangers().length; } catch { return 0; } };
