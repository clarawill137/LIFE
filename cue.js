// Ручное управление. Всё идёт как идёт — но любой твой тап по чипу-команде уходит модели в промпт, как
// «нежнятинка». Два вида: «сейчас» — выполнить в следующем ответе и забыть; «держать» — висит, пока не снимешь
// (или пока сцена не кончится). Что сейчас взведено, видно полоской «Твои команды» — ✕ снимает.
// Любой модуль рисует чип так: data-act="cue-set" data-src="Бой" data-key="..." data-text="..." [data-once="1"].

let A = null;
export function initCue(api) { A = api; }
const esc = (v) => A.esc(v);

function M() {
    const cm = A.chatMeta();
    if (!cm.cues || typeof cm.cues !== 'object') cm.cues = {};
    if (!Array.isArray(cm.cues.list)) cm.cues.list = [];   // { key, src, text, once, armedKey }
    return cm.cues;
}
const postKey = (i) => `${i}:${A.chatArr()[i]?.swipe_id ?? 0}`;
const lastKey = () => postKey(A.chatArr().length - 1);

/** Взвести команду. Тот же ключ и текст у «держать» — снять (тумблер). Ключ с «группа:» — одна на группу. */
export function cueSet({ key, text, once = false, src = 'Сцена' }) {
    const s = M();
    text = String(text || '').trim().slice(0, 300);
    if (!text) return false;
    key = String(key || text);
    const old = s.list.find(x => x.key === key);
    s.list = s.list.filter(x => x.key !== key);
    if (old && old.text === text && !!old.once === !!once) { A.saveMeta(); A.updatePrompt(); return false; }
    s.list.push({ key, src, text, once: !!once, armedKey: lastKey() });
    if (s.list.length > 40) s.list.splice(0, s.list.length - 40);
    A.saveMeta(); A.updatePrompt();
    return true;
}
export const cueHas = (key, text) => M().list.some(x => x.key === key && (text === undefined || x.text === text));
export function cueClear(src) { const s = M(); const n = s.list.length; s.list = s.list.filter(x => x.src !== src); if (s.list.length !== n) { A.saveMeta(); A.updatePrompt(); } }

/** После ответа: разовые команды ушли модели вместе с ним. */
export function cueAfterPost(i) {
    const s = M();
    const n = s.list.length;
    s.list = s.list.filter(x => !(x.once && postKey(i) !== x.armedKey));
    if (s.list.length !== n) { A.saveMeta(); A.updatePrompt(); }
}

export function cuePrompt(type) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    if (!s.list.length) return '';
    const group = (list) => { const by = {}; for (const x of list) (by[x.src] = by[x.src] || []).push(x.text); return Object.entries(by).map(([src, t]) => `${src} — ${t.join('; ')}`).join('. '); };
    const once = s.list.filter(x => x.once), hold = s.list.filter(x => !x.once);
    const user = A.shortName(A.canonName(A.ctx().name1));
    return [
        hold.length ? `[От автора — держать, пока не сниму: ${group(hold)}. Это рамка сцены: следуй ей в каждом ответе, не объявляя.]` : '',
        once.length ? `[От автора — выполнить В ЭТОМ ответе: ${group(once)}. Впиши естественно, из хода сцены, без объявлений; за ${user} не решай и не говори.]` : '',
    ].filter(Boolean).join('\n');
}

/** Чип-команда: горит, если взведена. */
export function cueChip(src, key, text, { once = false, label = '' } = {}) {
    const onNow = cueHas(key, text);
    return `<button class="lf-chip lf-cue${onNow ? ' on' : ''}${once ? ' once' : ''}" data-act="cue-set" data-src="${esc(src)}" data-key="${esc(key)}" data-text="${esc(text)}"${once ? ' data-once="1"' : ''}>${esc(label || text)}</button>`;
}

/** Полоска «что сейчас взведено». */
export function cueStripHtml(src = '') {
    if (!A?.hasChat?.()) return '';
    const list = M().list.filter(x => !src || x.src === src);
    if (!list.length) return '';
    return `<div class="lf-cue-strip"><small>Твои команды в промпте</small>${list.map(x => `<span class="${x.once ? 'once' : ''}"><i>${x.once ? 'сейчас' : 'держать'}</i>${esc(src ? x.text : `${x.src}: ${x.text}`)}<button data-act="cue-off" data-key="${esc(x.key)}">✕</button></span>`).join('')}</div>`;
}

/** Поле «своё» под пультом. */
export const cueOwnHtml = (src) => `<div class="lf-cue-own"><input type="text" data-in="cue-own" placeholder="своё — что должно случиться"><button class="lf-btn" data-act="cue-own" data-src="${esc(src)}" data-once="1">сейчас</button><button class="lf-btn ghost" data-act="cue-own" data-src="${esc(src)}">держать</button></div>`;

export function cueClick(act, el) {
    if (!act.startsWith('cue-')) return false;
    if (act === 'cue-set') {
        const armed = cueSet({ key: el.dataset.key, text: el.dataset.text, once: el.dataset.once === '1', src: el.dataset.src || 'Сцена' });
        if (armed && el.dataset.once === '1') A.toast('info', 'Уйдёт модели один раз — со следующим ответом', '✦ Команда', { timeOut: 1500 });
    }
    if (act === 'cue-off') { const s = M(); s.list = s.list.filter(x => x.key !== el.dataset.key); A.saveMeta(); A.updatePrompt(); }
    if (act === 'cue-own') {
        const box = el.closest('.lf-cue-own');
        const inp = box?.querySelector('[data-in="cue-own"]');
        const text = inp?.value?.trim();
        if (!text) return true;
        cueSet({ key: `own:${text.slice(0, 40)}`, text, once: el.dataset.once === '1', src: el.dataset.src || 'Сцена' });
        inp.value = '';
    }
    A.render();
    return true;
}

// ── готовые пульты для боя и словесной дуэли ──
const FIGHT_NOW = ['угроза нарастает — вот-вот начнётся', 'начинается драка', 'враг давит, свои отступают', 'свои перехватывают инициативу', 'кто-то из своих ранен — не смертельно', 'к врагу подходит подкрепление', 'к своим подходит помощь', 'начинается погоня', 'патроны и силы на исходе', 'бой кончается — развязка'];
const FIGHT_HOLD = ['бой грязный, без красоты', 'быстро и жёстко, по-агентски', 'дерутся молча'];
const DUEL_NOW = ['градус выше', 'он бьёт ниже пояса — и сам это понимает', 'он не уступает ни на шаг', 'он уступает — но с условием', 'всплывает старая обида', 'кто-то говорит правду, которую держал в себе', 'холодная пауза — никто не уходит', 'первый шаг к примирению делает он'];
const DUEL_HOLD = ['спорят шёпотом — рядом люди', 'без крика — тихо и страшно'];
const pult = (src, now, hold) => `<div class="lf-cue-g"><small>сейчас — в следующий ответ</small><div class="lf-chips wrap">${now.map(t => cueChip(src, `now:${t}`, t, { once: true })).join('')}</div></div>
    <div class="lf-cue-g"><small>держать</small><div class="lf-chips wrap">${hold.map(t => cueChip(src, `hold:${t}`, t)).join('')}</div></div>${cueOwnHtml(src)}${cueStripHtml(src)}`;
export const fightPultHtml = () => pult('Бой', FIGHT_NOW, FIGHT_HOLD);
export const duelPultHtml = () => pult('Спор', DUEL_NOW, DUEL_HOLD);
