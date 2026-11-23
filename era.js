// Эпоха в интерфейсе. Год истории (дата Horae, иначе эпоха «Священного таймлайна») одевает Life и фон:
// 40-е — бумага, печатная машинка, сепия; 2013–2016 — сталь ГИДРЫ (холодный металл, красные метки);
// 2024 — как сейчас. Только вид — модель это не трогает.

let A = null;
export function initEra(api) { A = api; }

function cfg() {
    const s = A.settings();
    if (!s.era || typeof s.era !== 'object') s.era = {};
    if (s.era.on === undefined) s.era.on = true;
    return s.era;
}

/** Год истории: дата Horae, иначе — эпоха ядра (год в её названии или начале). */
export function storyYear() {
    try {
        const d = A.parseDate(A.worldState().timestamp?.story_date);
        if (d && !isNaN(d)) return d.getFullYear();
    } catch { /* */ }
    try {
        const cx = globalThis.SacredTimeline?.context?.();
        const e = cx?.era;
        for (const v of [e?.year, e?.from, e?.start, e?.name, e?.title, e?.label, e?.id]) {
            const m = String(v ?? '').match(/(19|20)\d{2}/);
            if (m) return +m[0];
        }
    } catch { /* */ }
    return null;
}

/** Снимок ядра «Священный таймлайн» этого чата или null (ядра нет, вне мира, снимок ещё от прошлого чата). */
export function coreNow() {
    try {
        const cx = globalThis.SacredTimeline?.context?.();
        if (!cx) return null;
        const chat = A?.ctx?.()?.getCurrentChatId?.();
        if (cx.chatId && chat && String(cx.chatId) !== String(chat)) return null;
        return cx;
    } catch { return null; }
}

export function eraOf(y) {
    if (!y) return '';
    if (y < 1960) return '40s';
    if (y >= 2010 && y <= 2016) return 'hydra';
    return '';
}

/** Сороковые (год истории до 1960-го) — телефонов из будущего нет. Не зависит от тумблера «Интерфейс по эпохе». */
export function forties() {
    try { return eraOf(storyYear()) === '40s'; } catch { return false; }
}

/** Строчка модели (Летописцу, массовке, слухам): чем в сороковых заменяется телефон. В остальные годы — ''. */
export function eraCommsNote() {
    return forties()
        ? '1940-е: ни мобильных, ни смс, ни соцсетей, ни банковских карт — связь: полевой телефон через телефониста, рация, телеграмма, письмо, вестовой, записка; новости — газета, радио, кинохроника.'
        : '';
}

// скрипт Tavern Helper «📱 Телефон персонажа» — смартфон; в сороковых его кнопку не показываем
const PHONE_BTN = /Телефон персонажа/i;
export function isPhoneButton(el) { return PHONE_BTN.test(el?.textContent || el?.title || ''); }
function hidePhoneButtons(on) {
    document.querySelectorAll('.qr--button, .qr--button-label, [data-lf-noph]').forEach(el => {
        const btn = el.closest?.('.qr--button') || el;
        if (on && isPhoneButton(btn)) btn.setAttribute('data-lf-noph', '1');
        else if (!on) btn.removeAttribute('data-lf-noph');
    });
}

const ERAS = ['40s', 'hydra'];
export function applyEra() {
    const b = document.body;
    if (!b || !A) return;
    const on = cfg().on !== false && A.hasChat?.() && A.settings().enabled !== false;
    const e = on ? eraOf(storyYear()) : '';
    for (const k of ERAS) b.classList.toggle(`lf-era-${k}`, e === k);
    // телефон прячется по году, а не по виду: вид можно выключить, а смартфон в 1943-м — нет
    const f = A.hasChat?.() && A.settings().enabled !== false && forties();
    b.classList.toggle('lf-no-phone', !!f);
    try { hidePhoneButtons(!!f); } catch (err) { console.warn('[Life] кнопка телефона', err); }
}

export function eraHtml() {
    const y = storyYear();
    const e = eraOf(y);
    return `<label class="lf-switch"><input type="checkbox" data-act="era-on" ${cfg().on !== false ? 'checked' : ''}><span></span>Интерфейс по эпохе${y ? ` (сейчас ${y} — ${e === '40s' ? 'бумага и сепия' : e === 'hydra' ? 'сталь ГИДРЫ' : 'как есть'})` : ''}</label>`;
}

export function eraClick(act, el) {
    if (act !== 'era-on') return false;
    cfg().on = !!el.checked;
    A.saveSettings();
    applyEra();
    return true;
}
