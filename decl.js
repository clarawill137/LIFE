// Склонение имён — чистая логика, без таверны. Имя, фамилия или кличка: склоняется ли и как.
// Правила — школьные и с запасом осторожности: «Мэри», «Баки», «Шоу», «Земо» не склоняются (кончаются на
// гласную не «а/я»); женские имена и фамилии на согласную — тоже («Пеппер», «Романофф»); мужские на согласную
// склоняются («Барнс — Барнса, Барнсу, Барнсом»). Иностранное имя с ударной «а» правило не отличит от «Наташи» —
// поэтому результат всегда можно поправить руками или отдать модели: правило только подсказывает.

export const CASES = ['кто', 'нет кого', 'дать кому', 'вижу кого', 'горжусь кем', 'о ком'];
const VOWELS = 'аеёиоуыэюя';
const HUSH = 'жчшщ';
const isCyr = (w) => /^[а-яё]+(?:[-’'][а-яё]+)*$/i.test(w);
const keepCase = (src, w) => (src === src.toUpperCase() && src.length > 1 ? w.toUpperCase() : w);

/**
 * Формы слова: { ok, forms: [им, род, дат, вин, тв, пр] }. ok: false — не склоняется (все формы одинаковые).
 * gender: 'm' | 'f' | '' (не знаем — считаем мужским, как и правило для согласной). kind: 'first' | 'last' | 'nick'.
 */
export function decline(word, gender = '', kind = 'first') {
    const w = String(word || '').trim();
    const same = { ok: false, forms: Array(6).fill(w) };
    if (!w || !isCyr(w) || w.length < 2) return same;
    // двойное через дефис: склоняется последняя часть («Мария-Антуанетта»), если может
    if (/[-’']/.test(w)) {
        const k = Math.max(w.lastIndexOf('-'), w.lastIndexOf('’'), w.lastIndexOf('\''));
        const tail = decline(w.slice(k + 1), gender, kind);
        return tail.ok ? { ok: true, forms: tail.forms.map(f => w.slice(0, k + 1) + f) } : same;
    }
    const low = w.toLowerCase();
    const last = low.slice(-1), prev = low.slice(-2, -1);
    const stem = w.slice(0, -1);
    const out = (gen, dat, acc, ins, prep) => ({ ok: true, forms: [w, gen, dat, acc, ins, prep].map(f => keepCase(w, f)) });
    const f = gender === 'f';

    if (kind === 'last') {
        // русские фамилии-прилагательные и на -ов/-ин
        if (f && /(ова|ева|ёва|ина|ына)$/.test(low)) return out(`${stem}ой`, `${stem}ой`, `${stem}у`, `${stem}ой`, `${stem}ой`);
        if (f && /ая$/.test(low)) { const s = w.slice(0, -2); return out(`${s}ой`, `${s}ой`, `${s}ую`, `${s}ой`, `${s}ой`); }
        if (!f && /(ский|цкий)$/.test(low)) { const s = w.slice(0, -2); return out(`${s}ого`, `${s}ому`, `${s}ого`, `${s}им`, `${s}ом`); }
        if (!f && /(ов|ев|ёв|ин|ын)$/.test(low)) return out(`${w}а`, `${w}у`, `${w}а`, `${w}ым`, `${w}е`);
    }
    if ('оеэиуюыё'.includes(last)) return same;
    if (last === 'а') {
        if (VOWELS.includes(prev)) return same;                 // «Моруа», «Боа»
        const gen = 'гкхжчшщ'.includes(prev) ? 'и' : 'ы';
        const ins = HUSH.includes(prev) || prev === 'ц' ? 'ей' : 'ой';
        return out(`${stem}${gen}`, `${stem}е`, `${stem}у`, `${stem}${ins}`, `${stem}е`);
    }
    if (last === 'я') {
        if (prev === 'и') return out(`${stem}и`, `${stem}и`, `${stem}ю`, `${stem}ей`, `${stem}и`);      // Юлия → Юлии
        return out(`${stem}и`, `${stem}е`, `${stem}ю`, `${stem}ей`, `${stem}е`);                        // Таня, Илья
    }
    // дальше — на согласную, «й» или «ь»: женские не склоняются
    if (f) return same;
    if (last === 'й') return out(`${stem}я`, `${stem}ю`, `${stem}я`, `${stem}ем`, prev === 'и' ? `${stem}и` : `${stem}е`);
    if (last === 'ь') return out(`${stem}я`, `${stem}ю`, `${stem}я`, `${stem}ем`, `${stem}е`);
    const ins = HUSH.includes(last) || last === 'ц' ? 'ем' : 'ом';
    return out(`${w}а`, `${w}у`, `${w}а`, `${w}${ins}`, `${w}е`);
}

/** Строка для модели по словарю: [{ w, ok, forms }] → «Мэри, Шоу — не склоняются; Барнс — Барнса, Барнсу, Барнсом, о Барнсе». */
export function declLine(words) {
    const fixed = [], bend = [];
    const seen = new Set();
    for (const x of words || []) {
        const w = String(x?.w || '').trim();
        if (!w || seen.has(w.toLowerCase())) continue;
        seen.add(w.toLowerCase());
        const f = Array.isArray(x.forms) ? x.forms.map(v => String(v || '').trim()) : [];
        if (!x.ok || f.length < 6 || f.slice(1).every(v => !v || v === w)) { fixed.push(w); continue; }
        bend.push(`${w} — ${f[1]}, ${f[2]}, ${f[4]}, ${/^[аиоуэ]/i.test(f[5]) ? 'об' : 'о'} ${f[5]}`);   // «об Анне», но «о Елене»
    }
    return [fixed.length ? `${fixed.join(', ')} — не склоня${fixed.length > 1 ? 'ю' : 'е'}тся` : '', ...bend].filter(Boolean).join('; ');
}

/** Все формы слова для поиска в тексте (без повторов, строчными): чтобы «Барнсу» находило Барнса. */
export function formsOf(x) {
    const w = String(x?.w || '').trim();
    const list = x?.ok && Array.isArray(x.forms) ? x.forms : [w];
    return [...new Set([w, ...list].map(v => String(v || '').trim().toLowerCase().replace(/ё/g, 'е')).filter(Boolean))];
}
