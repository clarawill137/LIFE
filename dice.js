// Кубик близости (18+). Когда не хочется решать самой: бросок собирает случайный расклад сцены — кто ведёт,
// темп, где, особенность и чем кончится. Перебросить можно сколько угодно; «в следующий ответ» отдаёт расклад
// модели один раз. Таблицы свои, правятся в настройках чата не нужно — просто перебрось.

let A = null;
export function initDice(api) { A = api; }
const esc = (v) => A.esc(v);

const T = {
    lead: ['ведёт он', 'ведёт она', 'по очереди — и никто не уступает', 'она дразнит, он терпит до последнего', 'он просит — она решает'],
    pace: ['медленно, до дрожи', 'жадно и быстро', 'лениво, сонно', 'с перерывами на смех', 'сначала нежно — потом срывается', 'долго, с оттяжкой'],
    place: ['там, где застало', 'до кровати не дошли', 'в душе', 'на кухне', 'у стены', 'в кресле', 'на полу у дивана', 'в постели, под одеялом'],
    twist: ['не раздеваясь до конца', 'шёпотом — нельзя шуметь', 'глаза в глаза, не отводя', 'с разговором — не замолкают', 'кто-то смеётся в самый неподходящий момент', 'одна рука — та самая — и вся осторожность', 'он не торопится нарочно', 'она командует вслух', 'почти без слов'],
    end: ['засыпают как были', 'второй заход без передышки', 'долго лежат и говорят', 'душ вдвоём', 'кто-то идёт за едой в чём есть', 'остаются следы — на память'],
};
const LABEL = { lead: 'кто ведёт', pace: 'темп', place: 'где', twist: 'особенность', end: 'чем кончится' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function M() {
    const cm = A.chatMeta();
    if (!cm.dice || typeof cm.dice !== 'object') cm.dice = {};
    return cm.dice;
}
const on = () => A.settings().heat?.on !== false;

function roll(only = '') {
    const d = M();
    d.cur = d.cur || {};
    for (const k of Object.keys(T)) if (!only || only === k) d.cur[k] = pick(T[k].filter(x => x !== d.cur[k]));
    d.armed = false;
}

export function dicePrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const d = M();
    if (!d.armed || !d.cur) return '';
    return `[Кубик близости — расклад на эту сцену: ${Object.keys(T).map(k => `${LABEL[k]} — ${d.cur[k]}`).join('; ')}. Веди сцену так, естественно, без объявлений; что не ложится в момент — оставь на потом.]`;
}

/** Расклад ушёл модели — снять взвод после ответа. */
export function diceAfterPost() { const d = M(); if (d.armed) { d.armed = false; d.sent = true; A.saveMeta(); A.updatePrompt(); } }

export function diceSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    let show = false;
    try { const n = A.moodNow?.(); show = !!(n?.intimOn || n?.intimLevel || n?.intimMode === 'on'); } catch { /* */ }
    const d = M();
    if (!show && !d.cur) return '';
    if (!d.cur) return `${A.sec('Кубик близости')}<button class="lf-btn full" data-act="dc-roll">🎲 Бросить</button>`;
    return `${A.sec('Кубик близости', d.armed ? 'уйдёт в следующий ответ' : d.sent ? 'ушло модели' : '')}
    <div class="lf-dc">${Object.keys(T).map(k => `<button class="lf-dc-r" data-act="dc-one" data-k="${k}"><small>${LABEL[k]}</small><b>${esc(d.cur[k])}</b><i>🎲</i></button>`).join('')}</div>
    <div class="lf-actions tight"><button class="lf-btn" data-act="dc-roll">🎲 Перебросить всё</button><button class="lf-btn${d.armed ? '' : ' primary'}" data-act="dc-arm">${d.armed ? 'Отменить' : `${A.icon('zap')} В следующий ответ`}</button><button class="lf-btn ghost" data-act="dc-x">${A.icon('x')}</button></div>`;
}

export function diceClick(act, el) {
    if (!act.startsWith('dc-')) return false;
    const d = M();
    if (act === 'dc-roll') { roll(); d.sent = false; }
    if (act === 'dc-one') { roll(el.dataset.k); d.sent = false; }
    if (act === 'dc-arm') { d.armed = !d.armed; d.sent = false; }
    if (act === 'dc-x') { d.cur = null; d.armed = false; d.sent = false; }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}
