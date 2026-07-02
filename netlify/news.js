const { XMLParser } = require('fast-xml-parser');

// Källor att hämta. Lägg till/ta bort här om du vill utöka med fler tidningar senare.
const SOURCES = [
  { name: 'DN', url: 'https://www.dn.se/rss/' },
  { name: 'SvD', url: 'https://www.svd.se/feed/articles.rss' },
  { name: 'GP', url: 'https://www.gp.se/rss' },
];

// Kategori-mappning per källa -> gemensam kategori som frontend filtrerar på.
// DN har ingen <category>-tagg, så vi läser ut sektionen ur URL:en istället (t.ex. /kultur/).
const CATEGORY_MAP = {
  DN: {
    sverige: 'Sverige',
    varlden: 'Världen',
    kultur: 'Kultur',
    sport: 'Sport',
    ekonomi: 'Ekonomi',
    ledare: 'Ledare & debatt',
    debatt: 'Ledare & debatt',
    podd: 'Övrigt',
  },
  GP: {
    Krim: 'Sverige',
    Göteborg: 'Sverige',
    Sverige: 'Sverige',
    Politik: 'Sverige',
    Världen: 'Världen',
    Kultur: 'Kultur',
    Handboll: 'Sport',
    Fotboll: 'Sport',
    'IFK Göteborg': 'Sport',
    Ekonomi: 'Ekonomi',
    Debatt: 'Ledare & debatt',
    Ledare: 'Ledare & debatt',
    'Fria ord': 'Ledare & debatt',
  },
  SvD: {
    Sverige: 'Sverige',
    'Mat & dryck': 'Mat & livsstil',
    Film: 'Kultur',
    Kultur: 'Kultur',
    Världen: 'Världen',
    Sport: 'Sport',
    Ledare: 'Ledare & debatt',
    Näringsliv: 'Ekonomi',
    Livet: 'Mat & livsstil',
    Samtid: 'Kultur',
  },
};

const parser = new XMLParser({ ignoreAttributes: false });

function textOf(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === '#text' in val) return val['#text'] || '';
  return String(val['#text'] ?? '');
}

function stripHtml(html) {
  return textOf(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDnCategory(link) {
  const match = (link || '').match(/dn\.se\/([a-z0-9\-]+)\//i);
  return match ? match[1].toLowerCase() : '';
}

function parseItem(rawItem, sourceName) {
  let rawCategory = '';

  if (sourceName === 'DN') {
    rawCategory = extractDnCategory(rawItem.link);
  } else {
    let cats = rawItem.category;
    if (cats === undefined) cats = [];
    if (!Array.isArray(cats)) cats = [cats];
    cats = cats.map(textOf).filter((c) => c && !c.startsWith('Tagg:'));
    rawCategory = cats[0] || '';
  }

  const category = (CATEGORY_MAP[sourceName] && CATEGORY_MAP[sourceName][rawCategory]) || 'Övrigt';

  return {
    source: sourceName,
    title: textOf(rawItem.title).trim(),
    link: textOf(rawItem.link) || rawItem.link,
    description: stripHtml(rawItem.description),
    pubDate: textOf(rawItem.pubDate),
    category,
    rawCategory,
  };
}

async function fetchSource(source) {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PersonligtNyhetsfilter/1.0)',
    },
  });

  if (!res.ok) {
    throw new Error(`${source.name} svarade med status ${res.status}`);
  }

  const xml = await res.text();
  const data = parser.parse(xml);
  const channel = data && data.rss && data.rss.channel;
  if (!channel) throw new Error(`${source.name}: kunde inte tolka RSS-strukturen`);

  let items = channel.item || [];
  if (!Array.isArray(items)) items = [items];

  return items.map((item) => parseItem(item, source.name));
}

exports.handler = async function handler() {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));

  const items = settled
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  const errors = settled
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason && r.reason.message);

  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300', // cacha 5 min, RSS uppdateras inte snabbare ändå
    },
    body: JSON.stringify({ items, errors }),
  };
};
