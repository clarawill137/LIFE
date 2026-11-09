// Одно имя на двух алфавитах: «Гельмут» и «Helmut», «Пеппер» и «Pepper», «Баки» и «Bucky».
// Ключ — латиница по звуку (г и х ≈ h, ck → k, y → i, двойные буквы — одна), сравнение — с допуском на гласные.
// Только когда имена на РАЗНЫХ алфавитах: внутри одного алфавита — обычное сравнение.

const RU = { а: 'a', б: 'b', в: 'v', г: 'h', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'u', я: 'a' };

const cyr = (s) => /[а-яё]/i.test(s);
const lat = (s) => /[a-z]/i.test(s);

const memo = new Map();
/** Ключ по звуку: «Гельмут Земо» → «helmut zemo», «Helmut Zemo» → «helmut zemo». */
export function soundKey(name) {
    const raw = String(name || '').toLowerCase().trim();
    if (memo.has(raw)) return memo.get(raw);
    let s = raw.replace(/ё/g, 'е').replace(/[^a-zа-я\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cyr(s)) s = [...s].map(ch => (RU[ch] ?? ch)).join('');
    s = s.replace(/ck/g, 'k').replace(/ph/g, 'f').replace(/th/g, 't').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/q/g, 'k')
        .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/j/g, 'dzh').replace(/g/g, 'h').replace(/ee/g, 'i').replace(/oo/g, 'u')
        .replace(/y/g, 'i').replace(/([bcdfghklmnprstvz])e(?=\s|$)/g, '$1')   // немая e в конце: Steve → stev
        .replace(/(.)\1+/g, '$1');
    if (memo.size > 2000) memo.clear();
    memo.set(raw, s);
    return s;
}

function dist(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}

const skel = (w) => w.replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1');
/** Одно слово: тот же костяк согласных и разница только в паре гласных (Пеппер ≠ Peter: p-p-r против p-t-r). */
const close = (a, b) => { const L = Math.max(a.length, b.length); return L >= 3 && skel(a) === skel(b) && dist(a, b) <= Math.ceil(L * 0.25); };

/**
 * Одно ли это имя на разных алфавитах. Полное имя с полным; одно слово — с первым словом другого
 * («Пеппер» = «Pepper Potts»). На одном алфавите — false (это решает обычное сравнение).
 */
export function crossSame(a, b) {
    const x = String(a || '').trim();
    const y = String(b || '').trim();
    if (!x || !y) return false;
    if (!((cyr(x) && lat(y) && !cyr(y)) || (lat(x) && !cyr(x) && cyr(y)))) return false;
    const kx = soundKey(x).split(' ').filter(Boolean);
    const ky = soundKey(y).split(' ').filter(Boolean);
    if (!kx.length || !ky.length) return false;
    if (kx.length === ky.length) return kx.every((w, k) => close(w, ky[k]));
    const [short, long] = kx.length < ky.length ? [kx, ky] : [ky, kx];
    return short.every((w, k) => close(w, long[k]));
}
