/**
 * Hindi for what the store types in English (design names, collections, tags, short lines), used when the owner has not written
 * a Hindi version. Known jewellery and trade words come from a glossary, written the way the trade says them; a few phrases are
 * rewritten as a whole ("Men's Chains" → "पुरुषों की चेन"); any other word is spelt out phonetically in Devanagari.
 * Codes stay as they are: SKUs, numbers with units (22K, 100g), and short capitals (BIS, HUID, CNC).
 * Shared by the app (what buyers see) and the server (so a buyer can search in Hindi).
 */

/** Whole phrases, matched before single words (lower case, spaces between words). */
const PHRASES: Array<[string, string]> = [
  ["men's chains", 'पुरुषों की चेन'],
  ['mens chains', 'पुरुषों की चेन'],
  ["men's", 'पुरुषों के'],
  ["women's", 'महिलाओं के'],
  ["kids'", 'बच्चों के'],
  ['black bead', 'काले मोतियों वाला'],
  ['black beads', 'काले मोतियों वाला'],
  ['daily wear', 'रोज़ पहनने वाले'],
  ['toe rings', 'बिछिया'],
  ['toe ring', 'बिछिया'],
  ['nose pin', 'नाक की कील'],
  ['nose ring', 'नथ'],
  ['maang tikka', 'मांग टीका'],
  ['ready in vault', 'तैयार स्टॉक'],
  ['made-to-order', 'ऑर्डर पर बनेगा'],
  ['made to order', 'ऑर्डर पर बनेगा'],
  ['gold coin', 'सोने का सिक्का'],
  ['gold coins', 'सोने के सिक्के'],
  ['gold chain', 'सोने की चेन'],
  ['silver coin', 'चाँदी का सिक्का'],
  ['temple jewellery', 'टेम्पल ज्वेलरी'],
  ['bridal set', 'दुल्हन सेट'],
  ['bridal sets', 'दुल्हन सेट']
];

/** Single words (lower case). */
const WORDS: Record<string, string> = {
  and: 'और', '&': 'और', with: 'के साथ', for: 'के लिए', to: 'से', or: 'या', in: 'में', the: '', of: 'का', by: 'द्वारा', new: 'नया', all: 'सभी',
  // pieces
  ring: 'अंगूठी', rings: 'अंगूठियाँ', necklace: 'हार', necklaces: 'हार', haar: 'हार', har: 'हार', choker: 'चोकर', chokers: 'चोकर',
  pendant: 'पेंडेंट', pendants: 'पेंडेंट', locket: 'लॉकेट', lockets: 'लॉकेट', earring: 'बाली', earrings: 'बालियाँ', studs: 'टॉप्स', stud: 'टॉप्स', tops: 'टॉप्स',
  jhumka: 'झुमका', jhumkas: 'झुमके', jhumki: 'झुमकी', jhumkis: 'झुमकियाँ', chandbali: 'चाँदबाली', chandbalis: 'चाँदबालियाँ', bali: 'बाली', balis: 'बालियाँ',
  bangle: 'चूड़ी', bangles: 'चूड़ियाँ', kada: 'कड़ा', kadas: 'कड़े', kade: 'कड़े', bracelet: 'ब्रेसलेट', bracelets: 'ब्रेसलेट', chain: 'चेन', chains: 'चेन',
  mangalsutra: 'मंगलसूत्र', mangalsutras: 'मंगलसूत्र', nath: 'नथ', tikka: 'टीका', teeka: 'टीका', payal: 'पायल', anklet: 'पायल', anklets: 'पायल', bichhiya: 'बिछिया',
  kamarbandh: 'कमरबंद', bajuband: 'बाजूबंद', armlet: 'बाजूबंद', armlets: 'बाजूबंद', mala: 'माला', malas: 'मालाएँ', hasli: 'हंसली', rani: 'रानी', gulbandh: 'गुलबंद',
  coin: 'सिक्का', coins: 'सिक्के', bar: 'बार', bars: 'बार', biscuit: 'बिस्किट', set: 'सेट', sets: 'सेट', jewellery: 'ज्वेलरी', jewelry: 'ज्वेलरी', ornaments: 'गहने', ornament: 'गहना',
  bead: 'मोती', beads: 'मोती', pearl: 'मोती', pearls: 'मोती', stone: 'स्टोन', stones: 'स्टोन',
  // metals and stones
  gold: 'सोना', silver: 'चाँदी', platinum: 'प्लैटिनम', diamond: 'हीरा', diamonds: 'हीरे', emerald: 'पन्ना', emeralds: 'पन्ने', ruby: 'माणिक', rubies: 'माणिक',
  sapphire: 'नीलम', navratna: 'नवरत्न', kundan: 'कुंदन', polki: 'पोल्की', jadau: 'जड़ाऊ', meenakari: 'मीनाकारी', meena: 'मीना', nakshi: 'नक्शी', filigree: 'फ़िलिग्री',
  rudraksha: 'रुद्राक्ष', basra: 'बसरा', uncut: 'अनकट', oxidised: 'ऑक्सीडाइज़्ड', oxidized: 'ऑक्सीडाइज़्ड', solitaire: 'सॉलिटेयर', cz: 'CZ', american: 'अमेरिकन',
  // styles and words in names
  royal: 'रॉयल', bridal: 'ब्राइडल', antique: 'एंटीक', temple: 'टेम्पल', traditional: 'पारंपरिक', classic: 'क्लासिक', modern: 'मॉडर्न', designer: 'डिज़ाइनर', fancy: 'फ़ैंसी',
  plain: 'सादा', light: 'हल्का', lightweight: 'हल्के', heavy: 'भारी', grand: 'भव्य', heirloom: 'ख़ानदानी', imperial: 'इंपीरियल', rajwadi: 'राजवाड़ी', rajputana: 'राजपूताना',
  rajasthani: 'राजस्थानी', jaipuri: 'जयपुरी', jaipur: 'जयपुर', calcutta: 'कलकत्ता', kolkata: 'कोलकाता', south: 'दक्षिण', indian: 'भारतीय', festive: 'त्योहारी', wedding: 'शादी',
  engagement: 'सगाई', daily: 'रोज़ाना', wear: 'पहनावा', party: 'पार्टी', office: 'ऑफ़िस', kids: 'बच्चों के', baby: 'बेबी', men: 'पुरुष', mens: 'पुरुषों के', women: 'महिलाएँ',
  ladies: 'महिलाओं के', couple: 'कपल', lakshmi: 'लक्ष्मी', laxmi: 'लक्ष्मी', ganesh: 'गणेश', krishna: 'कृष्ण', om: 'ॐ', mayur: 'मयूर', peacock: 'मोर', lotus: 'कमल',
  flower: 'फूल', floral: 'फूलों वाला', leaf: 'पत्ती', star: 'सितारा', moon: 'चाँद', heart: 'दिल', butterfly: 'तितली', elephant: 'हाथी', mor: 'मोर', kamal: 'कमल',
  minted: 'मिंटेड', bullion: 'बुलियन', certified: 'प्रमाणित', hallmarked: 'हॉलमार्क वाले', hallmark: 'हॉलमार्क', motifs: 'मोटिफ़', motif: 'मोटिफ़', work: 'काम',
  collection: 'कलेक्शन', collections: 'कलेक्शन', curated: 'चुना हुआ', wholesale: 'होलसेल', machine: 'मशीन', cnc: 'CNC', link: 'लिंक', caps: 'कैप', cap: 'कैप', franco: 'फ़्रैंको',
  syndicate: 'सिंडिकेट', columbian: 'कोलंबियन', colombian: 'कोलंबियन', assay: 'जाँचे हुए', blister: 'ब्लिस्टर', packs: 'पैक', pack: 'पैक', denominations: 'वज़न तक',
  design: 'डिज़ाइन', designs: 'डिज़ाइन', other: 'अन्य', misc: 'अन्य', special: 'ख़ास', premium: 'प्रीमियम', exclusive: 'एक्सक्लूसिव', lots: 'लॉट', lot: 'लॉट',
  jeweller: 'ज्वेलर', jewellers: 'ज्वेलर्स', jeweler: 'ज्वेलर', jewelers: 'ज्वेलर्स', jewels: 'ज्वेल्स', jewel: 'ज्वेल', traders: 'ट्रेडर्स', sons: 'संस', house: 'हाउस',
  mart: 'मार्ट', shree: 'श्री', shri: 'श्री', sunflower: 'सूरजमुखी', haram: 'हारम', kemp: 'केम्प', long: 'लंबा', short: 'छोटा', big: 'बड़ा', small: 'छोटा', twisted: 'ट्विस्टेड',
  rose: 'रोज़', yellow: 'पीला', white: 'सफ़ेद', black: 'काला', red: 'लाल', green: 'हरा', blue: 'नीला', pink: 'गुलाबी', multicolour: 'रंग-बिरंगा', multicolor: 'रंग-बिरंगा'
};

// ---- phonetic fallback: Roman letters to Devanagari ----
const VOWELS: Array<[string, string, string]> = [
  // [roman, independent letter, sign after a consonant]
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ee', 'ई', 'ी'], ['ea', 'ई', 'ी'], ['ii', 'ई', 'ी'], ['oo', 'ऊ', 'ू'], ['ou', 'औ', 'ौ'], ['ei', 'ए', 'े'], ['ey', 'ए', 'े'],
  ['a', 'अ', ''], ['e', 'ए', 'े'], ['i', 'इ', 'ि'], ['o', 'ओ', 'ो'], ['u', 'उ', 'ु'], ['y', 'य', 'ी']
];
const CONS: Array<[string, string]> = [
  ['chh', 'छ'], ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'], ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['ck', 'क'], ['qu', 'क्व'],
  ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['t', 'ट'], ['d', 'ड'], ['n', 'न'], ['p', 'प'], ['f', 'फ़'], ['b', 'ब'], ['m', 'म'], ['r', 'र'], ['l', 'ल'], ['v', 'व'], ['w', 'व'],
  ['s', 'स'], ['h', 'ह'], ['z', 'ज़'], ['q', 'क'], ['x', 'क्स'], ['c', 'क']
];
const HALANT = '्';

function spell(word: string): string {
  const w = word.toLowerCase();
  let out = '';
  let i = 0;
  let prevCons = false;
  while (i < w.length) {
    // "c" before e, i or y sounds like s
    if (w[i] === 'c' && /[eiy]/.test(w[i + 1] ?? '') && w[i + 1] !== undefined && w.slice(i, i + 2) !== 'ch') {
      if (prevCons) out += HALANT;
      out += 'स';
      prevCons = true;
      i += 1;
      continue;
    }
    const cons = CONS.find(([r]) => w.startsWith(r, i));
    // "y" between vowels or at the start is a consonant
    const yCons = w[i] === 'y' && (i === 0 || /[aeiou]/.test(w[i + 1] ?? ''));
    if (cons || yCons) {
      if (prevCons) out += HALANT;
      out += cons ? cons[1] : 'य';
      prevCons = true;
      i += cons ? cons[0].length : 1;
      continue;
    }
    const vow = VOWELS.find(([r]) => w.startsWith(r, i));
    if (vow) {
      // a silent final "e" after a consonant ("stone", "lace")
      if (vow[0] === 'e' && i === w.length - 1 && prevCons && w.length > 3) {
        i += 1;
        continue;
      }
      // a word ending in "a" after a consonant says "aa" (Vasundhara, Radha)
      out += prevCons ? (vow[0] === 'a' && i === w.length - 1 && w.length > 3 ? 'ा' : vow[2]) : vow[1];
      prevCons = false;
      i += vow[0].length;
      continue;
    }
    out += w[i];
    prevCons = false;
    i += 1;
  }
  return out;
}

/** Left exactly as written: numbers and codes (22K, 916, 100g, SKU-12), short capitals (BIS, HUID), anything not in Roman letters. */
const isCode = (word: string) => /\d/.test(word) || (/^[A-Z]{2,5}$/.test(word) && !WORDS[word.toLowerCase()]) || !/^[A-Za-z'’-]+$/.test(word);

/** Hindi for a short English text (a name, a collection, a tag, a short line). Empty in, empty out. */
export function toHindi(text: string | undefined | null): string {
  if (!text) return '';
  let s = ` ${text.replace(/’/g, "'").replace(/\s+/g, ' ').trim()} `;
  for (const [en, hi] of PHRASES) s = s.replace(new RegExp(` ${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[\\s,.;:!?)•–-])`, 'gi'), ` \u0001${hi}\u0002`);
  const out = s
    .trim()
    .split(/(\u0001[^\u0002]*\u0002|[\s,.;:!?()•–]+)/)
    .map((tok) => {
      if (!tok) return '';
      if (tok.startsWith('\u0001')) return tok.slice(1, -1);
      if (/^[\s,.;:!?()•–]+$/.test(tok)) return tok;
      const known = WORDS[tok.toLowerCase()];
      if (known !== undefined) return known;
      if (isCode(tok)) return tok;
      return tok.split('-').map((part) => (WORDS[part.toLowerCase()] ?? (isCode(part) ? part : spell(part)))).join('-');
    })
    .join('');
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/** Purity as said in Hindi: "22K 916" → "22 कैरेट 916". */
export const purityHindi = (p: string) => p.replace(/(\d+(?:\.\d+)?)\s?K\b/g, '$1 कैरेट');
