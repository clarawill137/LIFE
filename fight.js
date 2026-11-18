// Бой. Пока в сцене опасность, Летописец ведёт расстановку: этап, кто на чьей стороне и на какой дистанции,
// что в руках, кто цел, очерёдность, укрытия, адреналин и выдержка, шкала погони. Модель получает расстановку —
// без телепортов и воскресших. Бой кончился — «отходняк» по времени истории: трясёт, приходит боль.
// Раны ведёт модуль травм (hurt.js). Идея — блок «Бой» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyNow, span, clamp, str, arr, clone } from './hudkit.js';

let A = null;
export function initFight(api) { A = api; }
const esc = (v) => A.esc(v);

const STAGE = { threat: 'угроза', clash: 'схватка', pause: 'пауза', chase: 'погоня', over: 'кончено' };
const SIDE = { own: 'свой', foe: 'враг', neutral: 'нейтрал' };
const DIST = { close: 'вплотную', step: 'в шаге', room: 'через комнату', far: 'далеко' };
const STATE = { ok: 'цел', hurt: 'ранен', stunned: 'оглушён', down: 'вне строя' };
const NERVE = { acts: 'действует', shakes: 'дрожит', frozen: 'замер', panics: 'паникует', flees: 'бежит' };

function cfg() {
    const s = A.settings();
    if (!s.fight || typeof s.fight !== 'object') s.fight = {};
    if (s.fight.on === undefined) s.fight.on = true;
    return s.fight;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.fight || typeof cm.fight !== 'object') cm.fight = {};
    const s = cm.fight;
    if (!Array.isArray(s.who)) s.who = [];
    if (!Array.isArray(s.past)) s.past = [];
    return s;
}
const live = () => { const s = M(); return !!s.stage && s.stage !== 'over'; };

const RULE = `
fight — бой, драка, перестрелка, погоня или прямая угроза оружием. ТОЛЬКО если в посте есть опасность, иначе null: {"stage":"threat|clash|pause|chase|over","who":[{"name":"имя или кто это («двое в масках»)","side":"own|foe|neutral","dist":"close|step|room|far","hands":"что в руках, 1-5 слов, или пусто","state":"ok|hurt|stunned|down","adr":70,"nerve":"acts|shakes|frozen|panics|flees"}],"order":["кто действует первым","…"],"cover":["что: чем прикрывает или чем может послужить"],"chase":{"dist":50,"to":"куда бегут","block":"что мешает"}}. side — относительно героев истории; dist — до ближайшего противника; adr — адреналин 0-100; chase — только в погоне (dist: 0 — догнали, 100 — ушли), иначе null. Бой закончился в этом посте — stage "over". До 6 участников, только по тексту.`;

export function fightChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const s = M();
    const cur = live() ? `идёт (${STAGE[s.stage]}): ${s.who.map(w => `${w.name} — ${SIDE[w.side]}, ${STATE[w.state]}`).join('; ')}` : 'нет';
    return { key: '"fight": null', rule: RULE, tokens: 260, input: `Бой: ${cur}` };
}

export function fightAfterPost(i, j) {
    if (!on()) return;
    const cm = A.chatMeta();
    // этот пост уже разбирали (свайп) — вернуть, как было до него
    if (cm.fight?.mes === i && cm.fight.before !== undefined) cm.fight = clone(cm.fight.before) || {};
    const f = j?.fight;
    const s = M();
    if (!f || typeof f !== 'object' || !STAGE[str(f.stage)]) {
        // Летописец боя не видит два поста подряд — бой затих сам
        if (live() && Number.isFinite(s.mes) && i - s.mes >= 2) { const before = clone(s); delete before.before; end(i); M().before = before; M().mes = i; A.saveMeta(); }
        return;
    }
    const before = clone(s); if (before) delete before.before;
    const stage = str(f.stage);
    if (stage === 'over' && !live()) return;
    if (!live()) { s.startMes = i; s.startTs = storyNow(A); s.peak = {}; }
    s.stage = stage;
    s.who = arr(f.who).slice(0, 6).map(w => ({
        name: A.canonName(str(w?.name, 50)) || str(w?.name, 50),
        side: SIDE[str(w?.side)] ? str(w.side) : 'neutral',
        dist: DIST[str(w?.dist)] ? str(w.dist) : 'room',
        hands: str(w?.hands, 50),
        state: STATE[str(w?.state)] ? str(w.state) : 'ok',
        adr: clamp(Math.round(w?.adr), 0, 100),
        nerve: NERVE[str(w?.nerve)] ? str(w.nerve) : 'acts',
    })).filter(w => w.name);
    s.order = arr(f.order).map(x => str(x, 50)).filter(Boolean).slice(0, 6);
    s.cover = arr(f.cover).map(x => str(x, 90)).filter(Boolean).slice(0, 5);
    const ch = f.chase && typeof f.chase === 'object' ? f.chase : null;
    s.chase = ch ? { dist: clamp(Math.round(ch.dist), 0, 100), to: str(ch.to, 60), block: str(ch.block, 80) } : null;
    s.peak = s.peak || {};
    for (const w of s.who) s.peak[w.name] = Math.max(s.peak[w.name] || 0, w.adr);
    s.mes = i;
    s.before = before;
    if (stage === 'over') end(i);
    A.saveMeta();
}

/** Бой кончился: в архив и на «отходняк». */
function end(i) {
    const s = M();
    const now = storyNow(A);
    const hang = Object.entries(s.peak || {}).filter(([n, v]) => v >= 50 && s.who.some(w => w.name === n && w.side === 'own')).map(([name, adr]) => ({ name, adr }));
    s.past.push({ from: s.startMes ?? i, to: i, ts: s.startTs || null, who: s.who.map(w => `${w.name}: ${STATE[w.state]}`) });
    if (s.past.length > 20) s.past.splice(0, s.past.length - 20);
    s.hang = hang.length ? { list: hang, ts: now, mes: i } : null;
    s.stage = 'over';
}

/** Сколько ещё держится отходняк: по времени истории (час на каждые 30 адреналина), без дат — четыре поста. */
function hangLeft() {
    const s = M();
    if (!s.hang) return null;
    const now = storyNow(A);
    const top = Math.max(...s.hang.list.map(x => x.adr));
    if (now !== null && s.hang.ts) { const left = s.hang.ts + (top / 30) * 3600000 - now; return left > 0 ? { text: `ещё ~${span(left)}` } : null; }
    return A.chatArr().length - 1 - s.hang.mes <= 4 ? { text: '' } : null;
}

export function fightPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    const user = A.shortName(A.canonName(A.ctx().name1));
    if (live()) {
        const rows = s.who.map(w => `${A.shortName(w.name)} — ${SIDE[w.side]}, ${DIST[w.dist]}${w.hands ? `, в руках: ${w.hands}` : ''}, ${STATE[w.state]}, адреналин ${w.adr}, ${NERVE[w.nerve]}`);
        const chase = s.chase ? ` Погоня: ${s.chase.dist}/100 (0 — догнали, 100 — ушли)${s.chase.to ? `, бегут ${s.chase.to}` : ''}${s.chase.block ? `, мешает: ${s.chase.block}` : ''}.` : '';
        return `[Бой — ${STAGE[s.stage]}. Расстановка: ${rows.join(' | ')}.${s.order?.length ? ` Очерёдность: ${s.order.join(' → ')}.` : ''}${s.cover?.length ? ` Укрытия и что под рукой: ${s.cover.join('; ')}.` : ''}${chase} Держи дистанции, оружие в руках и состояние каждого: без телепортов, выбывший не встаёт без причины, раненый дерётся хуже, патроны и силы кончаются. На адреналине боль глуше — она придёт потом. Исход для ${user} не решай: оставь ей ход.]`;
    }
    const left = hangLeft();
    if (!left) return '';
    return `[Отходняк после боя${left.text ? ` (${left.text})` : ''}: ${s.hang.list.map(x => `${A.shortName(x.name)} — адреналин был ${x.adr}`).join(', ')}. Адреналин уходит: дрожат руки, приходит боль, которую в бою не чувствовал, пустота, тошнота или злой голод, тянет в сон или не отпускает. Покажи приметами, не называй.]`;
}

export function fightSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    if (!live()) {
        const left = hangLeft();
        if (!left) return '';
        return `${A.sec('После боя', left.text || 'отходняк')}<div class="lf-fgt-hang">${s.hang.list.map(x => `<span>${A.ava(x.name, 'xs')}<b>${esc(A.shortName(x.name))}</b> адреналин был ${x.adr}</span>`).join('')}<button class="lf-link" data-act="fgt-calm">отпустило</button></div>`;
    }
    const row = (w) => `<div class="lf-fgt-p ${w.side} ${w.state}">${A.ava(w.name, 'xs')}<span class="lf-fgt-n"><b>${esc(A.shortName(w.name))}</b><small>${SIDE[w.side]} · ${DIST[w.dist]}${w.hands ? ` · ${esc(w.hands)}` : ''}</small></span>
        <span class="lf-fgt-s"><i class="lf-fgt-adr" title="адреналин ${w.adr}"><b style="width:${w.adr}%"></b></i><small>${STATE[w.state]} · ${NERVE[w.nerve]}</small></span></div>`;
    const dur = s.startTs && storyNow(A) ? span(storyNow(A) - s.startTs) : '';
    return `${A.sec('Бой', [STAGE[s.stage], dur].filter(Boolean).join(' · '))}
    <div class="lf-fgt st-${s.stage}">
        ${s.who.map(row).join('')}
        ${s.order?.length ? `<div class="lf-fgt-o">${s.order.map((n, k) => `<span>${k + 1}. ${esc(A.shortName(n))}</span>`).join('')}</div>` : ''}
        ${s.chase ? `<div class="lf-fgt-ch"><small>догнали</small><i><b style="left:${s.chase.dist}%"></b></i><small>ушли</small></div>${s.chase.to || s.chase.block ? `<div class="lf-hint">${esc([s.chase.to && `бегут ${s.chase.to}`, s.chase.block && `мешает: ${s.chase.block}`].filter(Boolean).join(' · '))}</div>` : ''}` : ''}
        ${s.cover?.length ? `<div class="lf-hint">Под рукой: ${esc(s.cover.join('; '))}</div>` : ''}
        <button class="lf-btn ghost full" data-act="fgt-end">${A.icon('check')} Бой окончен</button>
    </div>`;
}

export function fightClick(act) {
    if (!act.startsWith('fgt-')) return false;
    const s = M();
    if (act === 'fgt-end' && live()) end(A.chatArr().length - 1);
    if (act === 'fgt-calm') s.hang = null;
    delete s.before;
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

/** Что записал пост i. */
export function fightRecs(i) {
    const s = M();
    if (s.mes !== i || s.before === undefined) return [];
    return [{ id: 'fgt', g: 'Бой', icon: 'zap', t: `бой: ${STAGE[s.stage] || '—'}, участников ${s.who.length}`, del: () => { A.chatMeta().fight = clone(s.before) || {}; } }];
}
