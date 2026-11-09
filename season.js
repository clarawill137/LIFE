// Сезоны и праздники по дате истории + цветокор сцены по настроению.
// Модель получает сезонные мелочи и ближайший праздник (без лекций — штрихами); интерфейс одевается по сезону
// (иней зимой, листья осенью, гирлянда под Рождество, тыквы на Хэллоуин). Цветокор: фон сцены и слой поверх него
// окрашиваются по тону сцены — нежность теплее, тоска холоднее и тише, ссора краснее, опасность — контрастнее.

let A = null;
export function initSeason(api) { A = api; }

const esc = (v) => A.esc(v);
const DAY = 864e5;
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function cfg() {
    const s = A.settings();
    if (!s.season || typeof s.season !== 'object') s.season = {};
    const c = s.season;
    if (c.on === undefined) c.on = true;
    if (c.ui === undefined) c.ui = true;
    if (c.grade === undefined) c.grade = true;
    return c;
}

function storyDate() {
    try { const d = A.parseDate(A.worldState().timestamp?.story_date); if (d && !isNaN(d)) { d.setHours(0, 0, 0, 0); return d; } } catch { /* */ }
    return null;
}

const SEASON = (m) => (m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn');
const SEASON_RU = { winter: 'зима', spring: 'весна', summer: 'лето', autumn: 'осень' };
const DETAILS = [
    'холод и слякоть, соль на тротуарах, выброшенные ёлки у бордюров, короткие серые дни',
    'серый мороз, снег вперемешку с дождём, рано темнеет; к середине месяца — сердечки в витринах',
    'первая оттепель, тающий грязный снег, резкий ветер, лужи и первые тёплые дни',
    'цветут вишни и магнолии, переменчивые дожди, куртки нараспашку',
    'всё зелёное, тёплые вечера, столики кафе на тротуарах, запах сирени и асфальта после дождя',
    'начинается жара, длинные светлые вечера, открытые окна, гул кондиционеров',
    'липкая жара и духота, гул кондиционеров, грозы к вечеру, вечера на крышах',
    'влажная жара, город полупустой — все в отпусках, грозы, первые жёлтые листья',
    'мягкое тепло, ещё зелено, но вечера прохладнее; начало учёбы',
    'листья желтеют и падают, тыквы на крыльцах, прохладные вечера, пахнет прелой листвой',
    'голые деревья, холодный дождь, ранние сумерки, к концу месяца — гирлянды и запах корицы',
    'ёлки и гирлянды на улицах, витрины в огнях, каток, ранние сумерки, мороз и пар изо рта',
];

function nthWeekday(y, m, wd, n) { const d = new Date(y, m, 1); const k = (wd - d.getDay() + 7) % 7; return new Date(y, m, 1 + k + (n - 1) * 7); }
function lastWeekday(y, m, wd) { const d = new Date(y, m + 1, 0); const k = (d.getDay() - wd + 7) % 7; return new Date(y, m, d.getDate() - k); }
function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
}

/** Праздники года: [id, название, дата, что модели]. */
export function holidays(y) {
    return [
        ['newyear', 'Новый год', new Date(y, 0, 1), 'фейерверки, шампанское, обещания на год'],
        ['valentine', 'День святого Валентина', new Date(y, 1, 14), 'сердечки, цветы, столики в ресторанах забронированы'],
        ['march8', '8 Марта', new Date(y, 2, 8), 'в Америке его почти не празднуют — но для тех, кто из Союза, это свой день'],
        ['patrick', 'День святого Патрика', new Date(y, 2, 17), 'парад на Пятой авеню, всё зелёное, пьяные в барах'],
        ['easter', 'Пасха', easter(y), 'крашеные яйца, шоколадные зайцы, семейные обеды'],
        ['mother', 'День матери', nthWeekday(y, 4, 0, 2), 'цветы мамам, бранчи'],
        ['memorial', 'День памяти', lastWeekday(y, 4, 1), 'память погибших солдат, флаги, начало лета'],
        ['july4', 'День независимости', new Date(y, 6, 4), 'фейерверки, барбекю, флаги — и это день рождения Стива'],
        ['labor', 'День труда', nthWeekday(y, 8, 1, 1), 'конец лета, последние барбекю'],
        ['halloween', 'Хэллоуин', new Date(y, 9, 31), 'тыквы, костюмы, дети за конфетами'],
        ['veterans', 'День ветеранов', new Date(y, 10, 11), 'парады ветеранов, флаги — для солдата Второй мировой это не просто выходной'],
        ['thanks', 'День благодарения', nthWeekday(y, 10, 4, 4), 'индейка, семья за столом, парад Macy\'s'],
        ['xmas', 'Рождество', new Date(y, 11, 25), 'ёлка, подарки, семья, снег'],
    ];
}

/** { season, month, near: [праздник, через сколько дней], holidayNow } */
export function seasonNow() {
    const d = storyDate();
    if (!d) return null;
    const list = [...holidays(d.getFullYear()), ...holidays(d.getFullYear() + 1)];
    const near = list.map(([id, name, date, note]) => ({ id, name, note, days: Math.round((date - d) / DAY) })).filter(x => x.days >= 0 && x.days <= 10).sort((a, b) => a.days - b.days);
    const now = near.find(x => x.days === 0) || null;
    const xmasWeek = d.getMonth() === 11 && d.getDate() >= 15;
    const nyWeek = (d.getMonth() === 11 && d.getDate() >= 26) || (d.getMonth() === 0 && d.getDate() <= 2);
    return { d, season: SEASON(d.getMonth()), month: d.getMonth(), near, now, deco: now?.id || (nyWeek ? 'newyear' : xmasWeek ? 'xmas' : near[0]?.days <= 3 ? near[0].id : '') };
}

export function seasonPrompt(type) {
    if (!A?.hasChat?.() || cfg().on === false || type === 'quiet' || type === 'impersonate') return '';
    const s = seasonNow();
    if (!s) return '';
    const part = s.d.getDate() <= 10 ? 'начало' : s.d.getDate() <= 20 ? 'середина' : 'конец';
    const bits = [`Сезон: ${SEASON_RU[s.season]}, ${part} ${MON[s.month]} — ${DETAILS[s.month]}.`];
    if (s.now) bits.push(`Сегодня ${s.now.name}: ${s.now.note}.`);
    else if (s.near[0]) bits.push(`${s.near[0].days === 1 ? 'Завтра' : `Через ${s.near[0].days} ${A.plural(s.near[0].days, 'день', 'дня', 'дней')}`} — ${s.near[0].name} (${s.near[0].note}).`);
    return `[${bits.join(' ')} Пусть время года проступает в мелочах — свет, одежда, улица, разговоры, — без лекций и не в каждой строке.]`;
}

// ───────────── интерфейс по сезону и цветокор ─────────────

const SEASONS = ['winter', 'spring', 'summer', 'autumn'];
const DECOS = ['xmas', 'newyear', 'halloween', 'valentine', 'july4', 'thanks', 'patrick', 'easter'];
const GRADE = {
    tender: 'warm', comfort: 'amber', passion: 'rose', rough: 'crimson', play: 'bright', fun: 'bright',
    tension: 'teal', fight: 'crimson', drama: 'blue', danger: 'contrast',
};

export function applySeason() {
    const b = document.body;
    if (!b) return;
    const c = cfg();
    const on = A?.hasChat?.() && A.settings().enabled !== false;
    const s = on && c.ui ? seasonNow() : null;
    for (const k of SEASONS) b.classList.toggle(`lf-season-${k}`, !!s && s.season === k);
    for (const k of DECOS) b.classList.toggle(`lf-deco-${k}`, !!s && s.deco === k);
    // цветокор по тону сцены
    let g = '';
    if (on && c.grade) {
        try {
            const m = A.moodNow();
            const tone = m.manual || m.auto || '';
            g = m.intimOn ? 'rose' : GRADE[tone] || '';
        } catch { /* */ }
    }
    for (const k of new Set(Object.values(GRADE))) b.classList.toggle(`lf-grade-${k}`, g === k);
    let el = document.getElementById('lf-grade');
    if (!g) { el?.remove(); return; }
    if (!el) {
        el = document.createElement('div');
        el.id = 'lf-grade';
        el.setAttribute('aria-hidden', 'true');
        const bg = document.getElementById('lf-bg') || document.getElementById('bg1');
        if (bg?.parentNode) bg.parentNode.insertBefore(el, bg.nextSibling); else document.body.prepend(el);
    }
    el.className = `g-${g}`;
}

export function seasonHtml() {
    const s = seasonNow();
    const c = cfg();
    const ic = { winter: 'snow', spring: 'tree', summer: 'sun', autumn: 'moon' };
    return `${s ? `<div class="lf-season-card s-${s.season}">${A.icon(ic[s.season])}<span><b>${SEASON_RU[s.season][0].toUpperCase()}${SEASON_RU[s.season].slice(1)}</b><small>${esc(DETAILS[s.month])}</small>${s.now ? `<em>Сегодня — ${esc(s.now.name)}</em>` : s.near[0] ? `<em>${s.near[0].days === 1 ? 'Завтра' : `Через ${s.near[0].days} дн`} — ${esc(s.near[0].name)}</em>` : ''}</span></div>` : ''}
    <label class="lf-switch"><input type="checkbox" data-act="sea-on" ${c.on !== false ? 'checked' : ''}><span></span>Модель знает время года и праздники</label>
    <label class="lf-switch"><input type="checkbox" data-act="sea-ui" ${c.ui ? 'checked' : ''}><span></span>Интерфейс по сезону (иней, листья, гирлянда)</label>
    <label class="lf-switch"><input type="checkbox" data-act="sea-grade" ${c.grade ? 'checked' : ''}><span></span>Цветокор фона по настроению сцены</label>`;
}

export function seasonClick(act, el) {
    if (!act.startsWith('sea-')) return false;
    const c = cfg();
    if (act === 'sea-on') c.on = !!el.checked;
    if (act === 'sea-ui') c.ui = !!el.checked;
    if (act === 'sea-grade') c.grade = !!el.checked;
    A.saveSettings();
    A.updatePrompt();
    applySeason();
    return true;
}
