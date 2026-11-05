// Летописец: дешёвая модель после каждого поста чинит инвентарь Horae (дубли, мусор, кто держит),
// пишет короткие плашки «что изменилось», относит место к району карты, двигает шкалы отношений,
// замечает тайны и придумывает названия главам. Здесь — только чистые функции: промпт, разбор, применение.

export const CHRON_SYSTEM = `Ты — Летописец ролевой истории на русском. Ты не пишешь историю, а ведёшь её учёт.
Тебе дают последний пост, персонажей, место и список вещей, который ведёт трекер Horae. Этот трекер часто ошибается: плодит дубли с разными формулировками («ключи», «ключи от машины», «связка ключей»), записывает мусор (еду, жесты, мебель, одежду), путает, у кого вещь.

Верни ТОЛЬКО JSON, без пояснений и без markdown:
{
  "chips": [],
  "items": [],
  "place": null,
  "relations": [],
  "secrets": [],
  "title": ""
}

chips — 0–4 коротких факта о том, что изменилось в ЭТОМ посте, по 2–5 слов: «Приехали в бар», «Ключи у Хеди», «Баки отдал зажигалку». Только настоящие изменения. Ничего не изменилось — [].

items — правки списка вещей:
• Вещь — предмет, который важен для сюжета или ещё пригодится: ключи, телефон, оружие, документы, подарки, фото, машины и мотоциклы. НЕ вещи: одежда, обувь и украшения на теле (их ведёт Гардероб), части тела, съеденное и выпитое, мебель и интерьер, абстракции, чувства, звуки.
• Одна вещь — одна запись с коротким понятным названием («Ключи от купе», а не «ключи (связка, в сумке)»).
• holder — у кого вещь при себе (имя из списка персонажей). Если вещь лежит где-то — holder "" и where — где именно.
• Ничего не выдумывай: только то, что есть в посте и в списке.
Операции (названия из списка — ТОЧНО как в списке):
{"op":"merge","names":["…","…"],"into":"итоговое название","holder":"","where":"","note":"","icon":"эмодзи","kind":"вещь|транспорт|оружие|документ|техника|подарок|ключи"}
{"op":"drop","name":"…"} — мусор, не вещь, съедено, израсходовано, уничтожено
{"op":"set","name":"…","holder":"","where":"","note":"","icon":"","kind":""} — добавить пропущенную или исправить (кто держит, где лежит, описание)
{"op":"rename","name":"…","to":"…"}
Если список и так чистый и в посте с вещами ничего не случилось — [].

place — где сейчас сцена, для карты: {"location":"место так, как его пишет Horae","region":"крупная часть карты, где это находится: район, город или страна — «Манхэттен», «Бруклин», «Бухарест», «База в Неваде». Если подходит один из известных районов — бери его","kind":"бар|квартира|штаб|кафе|улица|машина|…","inside":"здание, если место — комната внутри него, иначе пусто"}. Если места не понять — null.

relations — как в этом посте сдвинулись отношения пар: [{"a":"имя","b":"имя","trust":0,"closeness":0,"tension":0,"moment":""}]. Числа — изменение от −20 до +20, только если правда что-то сдвинулось. moment — ключевой момент пары в 3–8 слов («Оставил ключ от квартиры»), только если он был. Ничего не сдвинулось — [].

secrets — новые тайны: [{"text":"что именно скрыто","knows":["кто знает"]}]. Только настоящие тайны, о которых знают не все.

title — {TITLE_RULE}`;

const TITLE_ASK = 'название главы, в которой идёт сцена: 1–3 слова, литературно, как глава романа, без кавычек и без названия места в лоб («После полуночи», «Холодный кофе», «Ключ под ковриком»).';
const TITLE_SKIP = 'пустая строка "".';

export const CLEAN_SYSTEM = `Ты — Летописец ролевой истории. Тебе дают весь список вещей трекера Horae. Он засорён: дубли с разными формулировками, мусор (одежда, еда, мебель, жесты), устаревшее.
Почисти его. Верни ТОЛЬКО JSON: {"items": [операции]} в том же формате:
{"op":"merge","names":["…"],"into":"…","holder":"","where":"","note":"","icon":"","kind":""}
{"op":"drop","name":"…"}
{"op":"rename","name":"…","to":"…"}
{"op":"set","name":"…","holder":"","where":"","note":"","icon":"","kind":""}
Названия из списка — ТОЧНО как в списке. Одежду, обувь и украшения на теле — drop (их ведёт Гардероб). Ничего не выдумывай.`;

const MOTIONS = ['rain', 'snow', 'steam', 'smoke', 'flicker', 'glow', 'pulse', 'heartbeat', 'scan', 'drift'];
const DETAIL_RULE = `

detail — ещё одна картинка к посту: эстетичная ДЕТАЛЬ крупным планом, как вставной кадр в кино. Верни объект:
{"prompt":"по-английски, 35–60 слов: один значимый для поста предмет или фрагмент крупно — руки, вещь, ткань, свет, стекло, экран, след, — макро или extreme close-up, малая глубина резкости, свет и погода сцены, без лиц (лицо — только размыто или частично), без текста","motion":"одно из: ${MOTIONS.join(', ')}","caption":"2–5 слов по-русски, как подпись к кадру"}
motion — какое движение оживит этот кадр: дождь на стекле — rain, пар от кофе — steam, сигаретный дым — smoke, свеча или неон — flicker, тёплый свет — glow, сердцебиение или пульс — heartbeat, экран УЗИ или монитора — scan, снег — snow, всё остальное — drift.
В интимных, откровенных или жестоких сценах — только символ и атмосфера: запотевшее стекло, капли, силуэты за матовым стеклом, смятые простыни в тени, сплетённые пальцы, дым свечи, огни города не в фокусе. Никакой наготы и ничего откровенного. Если деталь не нужна — null.`;

export function detailSystem() {
    return `Ты подбираешь к посту ролевой истории на русском один вставной кадр — деталь крупным планом. Ответь только JSON без пояснений: {"detail": {...}}.${DETAIL_RULE}`;
}

export function chronSystem(askTitle, askDetail = false) {
    let s = CHRON_SYSTEM.replace('{TITLE_RULE}', askTitle ? TITLE_ASK : TITLE_SKIP);
    if (askDetail) s = s.replace('  "secrets": [],', '  "secrets": [],\n  "detail": null,') + DETAIL_RULE;
    return s;
}

function itemLine(name, it) {
    const bits = [];
    if (it?.holder) bits.push(`у ${it.holder}`);
    if (it?.location) bits.push(`лежит: ${it.location}`);
    if (it?.description) bits.push(String(it.description).slice(0, 120));
    return `- ${name}${bits.length ? ` — ${bits.join('; ')}` : ''}`;
}

export function chronInput({ cast, location, when, regions, items, post, speaker, prev, chapterTitle }) {
    const list = Object.entries(items || {});
    return [
        `Персонажи (так их и называй): ${cast.join('; ') || '—'}`,
        `Место по Horae: ${location || 'не записано'}${when ? `. Время: ${when}` : ''}`,
        `Известные районы карты: ${regions.length ? regions.join(', ') : 'пока нет'}`,
        chapterTitle ? `Текущее название главы: ${chapterTitle}` : '',
        `Вещи сейчас (Horae, ${list.length}):`,
        list.length ? list.map(([n, it]) => itemLine(n, it)).join('\n') : '— пусто —',
        prev ? `\nПредыдущий пост (коротко):\n${prev}` : '',
        `\nПОСЛЕДНИЙ ПОСТ (${speaker || 'персонаж'}):\n${post}`,
    ].filter(Boolean).join('\n');
}

export function cleanInput({ cast, items }) {
    const list = Object.entries(items || {});
    return `Персонажи: ${cast.join('; ')}\nВещи (${list.length}):\n${list.map(([n, it]) => itemLine(n, it)).join('\n')}`;
}

export function extractJson(text) {
    const t = String(text || '').replace(/```(?:json)?/gi, '');
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch { /* попробуем подчистить */ }
    try { return JSON.parse(t.slice(a, b + 1).replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

export function normalizeResult(j) {
    const arr = (v) => Array.isArray(v) ? v : [];
    const str = (v) => typeof v === 'string' ? v.trim() : '';
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-20, Math.min(20, Math.round(n))) : 0; };
    return {
        chips: arr(j?.chips).map(str).filter(Boolean).slice(0, 4),
        items: arr(j?.items).filter(o => o && typeof o === 'object' && ['merge', 'drop', 'set', 'rename'].includes(o.op)),
        place: j?.place && typeof j.place === 'object' && str(j.place.location) ? {
            location: str(j.place.location), region: str(j.place.region), kind: str(j.place.kind), inside: str(j.place.inside),
        } : null,
        relations: arr(j?.relations).filter(r => str(r?.a) && str(r?.b)).map(r => ({
            a: str(r.a), b: str(r.b), trust: num(r.trust), closeness: num(r.closeness), tension: num(r.tension), moment: str(r.moment),
        })).filter(r => r.trust || r.closeness || r.tension || r.moment),
        secrets: arr(j?.secrets).filter(s => str(s?.text)).map(s => ({ text: str(s.text), knows: arr(s.knows).map(str).filter(Boolean) })),
        title: str(j?.title).replace(/^[«"']|[»"']$/g, ''),
        detail: j?.detail && typeof j.detail === 'object' && str(j.detail.prompt).length > 20 ? {
            prompt: str(j.detail.prompt).slice(0, 700),
            motion: MOTIONS.includes(str(j.detail.motion).toLowerCase()) ? str(j.detail.motion).toLowerCase() : 'drift',
            caption: str(j.detail.caption).slice(0, 60),
        } : null,
    };
}

const lc = (v) => String(v ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'`]/g, '').replace(/\s+/g, ' ').trim();

/** Базовое имя как у Horae: «Вода (2 л)» → «Вода»; «Кольцо (помолвочное)» не трогаем. */
export function baseName(name) {
    return String(name || '').replace(/\s*[(（]\s*\d[^)）]*[)）]\s*$/, '').trim();
}

function findKey(items, name) {
    if (!name) return null;
    if (items[name]) return name;
    const n = lc(name);
    for (const k of Object.keys(items)) if (lc(k) === n) return k;
    const b = lc(baseName(name));
    for (const k of Object.keys(items)) if (lc(baseName(k)) === b) return k;
    return null;
}

/**
 * Применить правки вещей к horae_meta сообщения. state — вещи Horae ПОСЛЕ этого сообщения.
 * Возвращает { undo, kinds, touched } — undo кладём рядом, чтобы откатить.
 */
export function applyItemOps(meta, state, ops) {
    meta.items = meta.items && typeof meta.items === 'object' ? meta.items : {};
    meta.deletedItems = Array.isArray(meta.deletedItems) ? meta.deletedItems : [];
    const undo = { items: JSON.parse(JSON.stringify(meta.items)), deletedItems: [...meta.deletedItems] };
    const all = { ...state, ...meta.items };
    const drops = new Set();
    const sets = new Map();
    const kinds = {};
    const touched = [];

    const drop = (name) => {
        const k = findKey(all, name);
        if (!k) return;
        if (meta.items[k]) delete meta.items[k];
        drops.add(k);
        touched.push(k);
    };
    const set = (name, o, fromKey) => {
        name = String(name || '').trim();
        if (!name) return;
        const base = all[fromKey] || all[findKey(all, name)] || {};
        const it = {
            icon: o.icon || base.icon || '',
            importance: base.importance || '',
            holder: o.holder !== undefined ? String(o.holder) : (base.holder || ''),
            location: o.where !== undefined ? String(o.where) : (base.location || ''),
            description: o.note || base.description || '',
        };
        if (it.holder) it.location = it.location && o.where ? it.location : '';
        meta.items[name] = it;
        sets.set(name, it);
        if (o.kind) kinds[name] = o.kind;
        touched.push(name);
    };

    for (const o of ops) {
        try {
            if (o.op === 'drop') drop(o.name);
            else if (o.op === 'rename') {
                const k = findKey(all, o.name);
                if (!k || !o.to) continue;
                const keep = { ...all[k] };
                drop(k);
                set(o.to, { icon: o.icon, holder: keep.holder, where: keep.location, note: keep.description, kind: o.kind }, null);
                all[o.to] = meta.items[o.to];
            } else if (o.op === 'merge') {
                const into = String(o.into || '').trim();
                const keys = (Array.isArray(o.names) ? o.names : []).map(n => findKey(all, n)).filter(Boolean);
                if (!into || !keys.length) continue;
                const first = { ...all[keys[0]] };
                for (const k of keys) if (lc(k) !== lc(into)) drop(k);
                all[into] = all[into] || first;
                set(into, o, into);
            } else if (o.op === 'set') {
                set(o.name, o, findKey(all, o.name));
            }
        } catch (e) { console.warn('[Life] правка вещи', o, e); }
    }
    // удаления, у которых базовое имя совпадает с новой записью, не нужны: Horae сам заменит старую запись новой
    const setBases = new Set([...sets.keys()].map(n => lc(baseName(n))));
    const keepDel = new Set(meta.deletedItems);
    for (const d of drops) if (!setBases.has(lc(baseName(d)))) keepDel.add(d);
    meta.deletedItems = [...keepDel].filter(d => !setBases.has(lc(baseName(d))));
    return { undo, kinds, touched };
}

export function restoreItems(meta, undo) {
    if (!meta || !undo) return;
    meta.items = JSON.parse(JSON.stringify(undo.items || {}));
    meta.deletedItems = [...(undo.deletedItems || [])];
}
