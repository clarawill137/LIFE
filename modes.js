// Режимы — кнопки в пульте: 💗 нежнятинка, 🫦 огонь, 😂 ржака, ⚔️ боевка (держатся, пока не выключишь),
// 🎲 событие / 🌙 без событий (на один ответ).
// Текст режима уходит модели в самый конец промпта (глубина 0, свой ключ сортируется последним),
// чтобы его держала модель, а не забывала через пару постов. Пресет не трогаем.
// Нежнятинка перенесена из скрипта Tavern Helper «🎛 Режимы» (God Complex v1.4.1) — тот же текст.

let A = null;
export function initModes(api) { A = api; }

export const MODES_KEY = 'zzz_life_modes';

const ctx = () => SillyTavern.getContext();
const userName = () => ctx().name1 || 'the player';

// [id, эмодзи, ярлык, цвет полоски у поля ввода, текст для модели (U = имя игрока)]
export const MODES = [
    ['tender', '💗', 'Нежнятинка', '#f2a7c3', () => `<tender_mode>
TENDER MODE IS ON. This scene is pure, shameless, maximal tenderness — sugar, warmth, pink fluff, and nobody apologises for it. It overrides the instinct to add tension, angst, irony or restraint.
- Touch is constant and abundant: noses rubbing, forehead to forehead, kisses everywhere — eyelids, knuckles, the scar, the tip of the nose, the inside of the wrist, the back of the neck, the corner of the mouth, again and again just because. Hands in hair, fingers laced, legs tangled, someone's cold feet tucked under someone's thigh, being held like something precious, falling asleep on a chest and counting the heartbeat.
- Words are soft and silly: pet names (the tender diminutives from the card and the history, and new ones invented on the spot), murmured nonsense, «моя хорошая / мой хороший», whispered confessions, baby talk and dumb private jokes are allowed and welcome. Compliments are specific and over the top. «Я тебя люблю» can be said five times and mean five different things.
- Narration goes full-hearted: the feeling is enormous and written at full size — melting, aching, glowing, «как будто внутри разлили тёплое какао» is FINE here. Big gooey metaphors are allowed in this mode (the ban list still applies to the AI clichés: no «время остановилось», no «мир сузился»).
- Humour stays soft: giggling into a shoulder, tickling, a ridiculous sleepy argument about who loves whom more, the cat trying to wedge itself between them.
- The outside world stays cosy and far: snow, the radiator ticking, a neighbour's TV through the wall, the city humming somewhere below. No crises arrive, no phones ruin it unless the human brings them in.
- Trauma and guilt step back for this scene: they may flicker as «I can't believe I get to have this», never as a breakdown.
- Pace is slow and lingering: stay in the cuddle, the kiss, the breathing; nothing needs to happen.
</tender_mode>`],
    ['fire', '🫦', 'Огонь', '#e0524f', (U) => `<fire_mode>
FIRE MODE IS ON. The air between them is charged — desire runs under every beat, not only in bed. Plot, voices, format and length stay as usual; the heat goes up.
- The narration notices what desire notices: the line of a throat, a bitten lip, fabric pulled tight across a back, warmth through a shirt, breath changing pace, a hand that stays a second too long, the smell of skin after rain. Specific and sensory, never generic.
- The initiative comes from the characters you play, not only from ${U}: he looks first, touches first, starts the teasing, finds excuses to be closer, pulls her onto his lap, pins her against the counter, says the hungry or filthy thing out loud in his own voice. His desire has his personality — rough words, careful hands, dry jokes — not a template.
- Flirting has teeth: innuendo, dares, provocations, undressing with the eyes, jealousy turned into a game, «ещё раз так посмотришь — и мы никуда не поедем».
- Ordinary scenes run hot underneath: cooking, driving, a briefing, an argument — someone is very aware of someone.
- Tension is allowed to pay off. If the moment turns physical, follow it with full honesty — things named directly but literary, as the preset says — no fade-to-black, no time skip. If it can't pay off right now (people around, work, danger), let the frustration show and promise later.
- The established relationship and its rules stay intact: heat never turns into cruelty, humiliation or ownership talk.
</fire_mode>`],
    ['laugh', '😂', 'Ржака', '#f2c879', (U) => `<comedy_mode>
COMEDY MODE IS ON. This stretch of the story is genuinely funny — laugh-out-loud, not just witty. Feelings stay real (love, worry, tiredness), but the scene finds the joke in them.
- Situational comedy first: things go wrong in escalating, specific ways — Murphy's law, the cat, a misread text, a neighbour at the worst possible moment, a plan collapsing step by step, technology versus a man born in 1917, bureaucracy, a baby-book quoted at the wrong time. Set up → escalate → pay off. A callback to something from earlier in the story is gold.
- Everyone is funny in their own way: dry deadpan, grandpa grumbling, sarcasm half a second late, a director's tone applied to something absurd, sincere stupidity, petty competitiveness. No stand-up routines, and never everybody quipping in the same voice.
- Timing: short beats, a pause, the punchline at the end of the sentence. Let a reaction land the joke — a look, a silence, a slow blink — instead of explaining it. Never explain a joke.
- Bodily, everyday, ridiculous detail is welcome: a sock on the lamp, negotiations over burnt toast, someone stuck inside a sweater, a very serious face over a very stupid thing. Swearing is funny when it is in character.
- Characters may meet serious things with humour as coping; the narration never mocks their pain.
- No sitcom resets: the consequences of the chaos stay and can come back later. ${U}'s jokes get real reactions, not polite smiles.
</comedy_mode>`],
    ['fight', '⚔️', 'Боевка', '#7fa4d8', (U) => `<action_mode>
ACTION MODE IS ON. This is a fight, chase or operation — write it epic, fast, cinematic and physical.
- Rhythm carries it: short sentences, hard verbs, fragments in the clash; then one long breathless sentence for the moment time slows down (the blade an inch from a throat, the fall, the shot that misses). Vary it — never a wall of identical short lines.
- Geography is always clear: where everyone is, what is between them, exits, cover, height, distance, what can be grabbed and used. The reader could draw the map.
- Physics and cost: weight, momentum, recoil, glass, blood, broken fingers, ringing ears, a slipped grip, the adrenaline shakes afterwards. Powers and the metal arm have limits and a price. Injuries carry into the next replies. Nobody is invulnerable; every hit changes something.
- Competence shown, not announced: training is visible in choices — the angle he takes, the half-second he waits, the improvised weapon, reading an opponent's shoulder before the punch. Each fighter fights in character.
- Stakes and turns: every beat shifts the situation — an advantage lost, a new threat, someone hurt, a choice of whom to cover. Enemies are smart, dangerous and adapt.
- Combat dialogue is clipped: commands, curses, one-line taunts, a joke through gritted teeth. No speeches mid-fight.
- Don't resolve the whole fight in one reply. End on a beat that gives ${U} a real decision or reaction, and never decide ${U}'s moves.
</action_mode>`],
];

export const ONCE = [
    ['event', '🎲', 'Событие', '[THIS reply only: bring in ONE unexpected but plausible event from the outside world or from an NPC, scaled to the scene (a call, an arrival, news, a small accident, a secret surfacing). It must have a cause that fits what is already established and must leave a consequence. Then continue the scene from it.]'],
    ['calm', '🌙', 'Без событий', '[THIS reply only: no new events, no arrivals, no calls, no plot turns. Stay inside the current moment between the characters — feelings, bodies, talk, the room. Depth, not movement.]'],
];

const modeById = (id) => MODES.find(m => m[0] === id) || null;
const onceById = (id) => ONCE.find(m => m[0] === id) || null;

// «на один ответ» живёт до следующей генерации, только в этой вкладке (как было в скрипте)
let armed = { chat: '', id: '' };
const chatKey = () => { const c = ctx(); return String(c.chatId || c.getCurrentChatId?.() || ''); };

function M() {
    const cm = A.chatMeta();
    if (!cm.modes || typeof cm.modes !== 'object') cm.modes = { on: [] };
    if (!Array.isArray(cm.modes.on)) cm.modes.on = [];
    // перенос нежнятинки из скрипта Tavern Helper: он хранил её в браузере, мы — в самом чате
    if (!cm.modes.migrated) {
        cm.modes.migrated = 1;
        try {
            if (localStorage.getItem(`gc_tender_${chatKey()}`) === '1' && !cm.modes.on.includes('tender')) cm.modes.on.push('tender');
        } catch { /* */ }
        A.saveMeta();
    }
    return cm.modes;
}

export function modesOn() { return A.hasChat() ? M().on.filter(id => modeById(id)) : []; }
export function onceArmed() { return armed.chat === chatKey() ? armed.id : ''; }

export function toggleMode(id) {
    if (!modeById(id)) return false;
    const m = M();
    const i = m.on.indexOf(id);
    if (i >= 0) m.on.splice(i, 1); else m.on.push(id);
    A.saveMeta();
    syncBody();
    A.updatePrompt();
    return m.on.includes(id);
}

export function armOnce(id) {
    const cur = onceArmed();
    armed = cur === id || !onceById(id) ? { chat: '', id: '' } : { chat: chatKey(), id };
    A.updatePrompt();
    return onceArmed();
}

/** Текст для модели. consume — генерация пошла: «на один ответ» отработал. */
export function modesPrompt(type, consume = false) {
    if (!A?.hasChat?.() || type === 'quiet') return '';
    const U = userName();
    const parts = modesOn().map(id => modeById(id)[4](U));
    const once = type === 'impersonate' ? '' : onceArmed();
    if (once) {
        parts.push(onceById(once)[3]);
        if (consume) armed = { chat: '', id: '' };
    }
    if (!parts.length) return '';
    const head = modesOn().length
        ? `[STYLE MODE — switched on by ${U} and held until they switch it off. Keep the preset's language, length, format and blocks; this changes the tone and style of the writing. It outranks the general style rules where they disagree.]\n`
        : '';
    return head + parts.join('\n');
}

export function syncBody() {
    const on = modesOn();
    const b = document.body;
    if (!b) return;
    MODES.forEach(([id]) => b.classList.toggle(`lf-mode-${id}`, on.includes(id)));
    b.classList.toggle('lf-modes-on', on.length > 0);
    const color = on.length ? modeById(on[on.length - 1])[3] : '';
    if (color) b.style.setProperty('--lf-mode-color', color); else b.style.removeProperty('--lf-mode-color');
}

/** Ряд для пульта. ttScript — найден ли старый скрипт «Режимы» среди кнопок над вводом. */
export function modesHtml(esc, ttScript = false) {
    if (!A?.hasChat?.()) return '';
    const on = modesOn();
    const once = onceArmed();
    const chip = (act, id, isOn, emo, label) => `<button class="cc-chip lf-mode-chip${isOn ? ' on' : ''}" data-cc="${act}" data-v="${id}"><span class="lf-mode-emo">${emo}</span>${esc(label)}</button>`;
    return `<div class="cc-chips wrap lf-modes">
        ${MODES.map(([id, emo, label]) => chip('mode', id, on.includes(id), emo, label)).join('')}
    </div>
    <div class="cc-chips wrap lf-modes lf-once">
        ${ONCE.map(([id, emo, label]) => chip('once', id, once === id, emo, `${label}${once === id ? ' · в следующем' : ''}`)).join('')}
    </div>
    ${ttScript ? '<div class="lf-modes-warn">В Tavern Helper ещё включён скрипт «🎛 Режимы» — выключи его, режимы теперь здесь, иначе нежнятинка придёт модели дважды.</div>' : ''}`;
}
