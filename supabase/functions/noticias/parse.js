// Parsing and classification of financial-news RSS feeds (plain JS: runs in Deno and Node).

export const FEEDS = [
  // Brasil
  { name: "InfoMoney", url: "https://www.infomoney.com.br/feed/", region: "Brasil" },
  { name: "Money Times", url: "https://www.moneytimes.com.br/feed/", region: "Brasil" },
  { name: "Seu Dinheiro", url: "https://www.seudinheiro.com/feed/", region: "Brasil" },
  { name: "Investing.com Brasil", url: "https://br.investing.com/rss/news.rss", region: "Brasil", tz: "Z" },
  { name: "Exame", url: "https://exame.com/feed/", region: "Brasil", filter: true, tz: "-03:00" },
  { name: "Agência Brasil", url: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml", region: "Brasil", full: "agenciabrasil", filter: true, skip: /mega-sena|lotof[aá]cil|quina|loteria|timemania/i },
  { name: "Google Notícias", url: "https://news.google.com/rss/search?q=Ibovespa+OR+Copom+OR+Selic+OR+d%C3%B3lar+OR+juros+futuros+when:1d&hl=pt-BR&gl=BR&ceid=BR:pt-419", region: "Brasil", gnews: true },
  // Mundo
  { name: "MarketWatch", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", region: "Mundo" },
  { name: "Investing.com", url: "https://www.investing.com/rss/news_25.rss", region: "Mundo", tz: "Z" },
  { name: "CNBC", url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", region: "Mundo" },
  { name: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", region: "Mundo", filter: "strict" },
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", region: "Mundo" },
  { name: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", region: "Mundo", full: "fed", skip: /enforcement|termination|application|approv|request for comment|agreement with/i },
  { name: "Google News", url: "https://news.google.com/rss/search?q=%22stock+market%22+OR+%22Federal+Reserve%22+OR+%22Treasury+yields%22+OR+%22oil+prices%22+when:1d&hl=en-US&gl=US&ceid=US:en", region: "Mundo", gnews: true },
];

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", ordm: "º", ordf: "ª", deg: "°" };

export function decode(s) {
  if (!s) return "";
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    const k = e.toLowerCase();
    return k in NAMED ? NAMED[k] : m;
  });
}
const stripCdata = s => (s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
const stripTags = s => (s || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
const clean = s => decode(stripTags(decode(stripTags(stripCdata(s))))).replace(/\s+/g, " ").trim();
function tag(item, name) {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripCdata(m[1]).trim() : "";
}

const DIRECT = new Set(["infomoney","money times","seu dinheiro","exame","investing.com","investing.com brasil","agencia brasil","marketwatch","cnbc","coindesk","bbc","bbc news"]);

export function parseFeed(xml) {
  const items = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[1];
    items.push({
      title: clean(tag(it, "title")),
      link: decode(tag(it, "link")).trim(),
      pubDate: clean(tag(it, "pubDate")),
      descriptionRaw: tag(it, "description"),
      source: clean(tag(it, "source")),
    });
  }
  return items;
}

export function parseDate(s, tz) {
  if (!s) return null;
  let t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(t)) t = t.replace(" ", "T") + (tz || "Z");
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

export const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function keyOf(title) {
  return norm(title).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || null;
}

const TOPICS = [
  ["Juros", /\b(selic|copom|juros|di futuro|curva de juros|tesouro direto|ntn-?b|treasur(y|ies)|yields?|fed|fomc|federal reserve|banco central|galipolo|warsh|powell|ipca|inflacao|cpi|pce|rate (cut|hike)s?|interest rates?|bce|ecb|boj|bank of japan|bank of england)\b/],
  ["Bolsa", /\b(ibovespa|ibov|bolsa|b3|s&p ?500|s&p|nasdaq|dow jones|dow|wall street|stocks?|equities|ipo|small caps|circuit breaker)\b/],
  ["Câmbio", /\b(dolar|cambio|ptax|real brasileiro|dollar|currency|currencies|forex|euro|iene|yen|yuan)\b/],
  ["Empresas", /\b(balanco|lucro|prejuizo|resultado trimestral|receita|ebitda|earnings|revenue|guidance|dividendos?|dividends?|fusao|aquisicao|merger|acquisition|recompra|buyback|petrobras|vale|itau|bradesco|nubank|magalu|embraer|boeing|apple|microsoft|nvidia|alphabet|google|amazon|tesla|meta)\b/],
  ["Fiscal", /\b(fiscal|arcabouco|meta fiscal|orcamento|deficit|divida publica|gastos|impostos?|tributari[ao]|reforma|congresso|camara|senado|durigan|haddad|fazenda|lula|eleic(ao|oes)|budget|tax(es)?|congress|white house|trump|shutdown|election)\b/],
  ["Commodities", /\b(petroleo|brent|wti|oil|crude|preco do ouro|ouro (sobe|cai|recua|dispara|renova|bate)|gold prices?|minerio|iron ore|soja|milho|cafe|commodit(y|ies)|opep|opec|gas natural|natural gas|diesel)\b/],
  ["Geopolítica", /\b(ira|iran|israel|ucrania|ukraine|russia|china|tarifas?|tariffs?|guerra|war|ormuz|hormuz|sancoes|sanctions|houthis?|otan|nato|gaza|taiwan)\b/],
  ["Cripto", /\b(bitcoin|cripto|criptomoedas?|crypto|ether|ethereum|btc|stablecoins?|blockchain|etf de bitcoin)\b/],
];
export function topicsOf(text) {
  const t = norm(text);
  return TOPICS.filter(([, re]) => re.test(t)).map(([n]) => n);
}

export function truncate(s, n) {
  if (!s || s.length <= n) return s || "";
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), n - 20)).replace(/[,;:.\s]+$/, "") + "…";
}

// Agência Brasil: the feed's description carries the whole article (reproduction allowed with credit,
// except partner-agency content marked as prohibited).
export function agenciaBrasilBody(raw) {
  const htmlText = decode(decode(stripCdata(raw)))
    .replace(/<h\d[^>]*>\s*Not[ií]cias relacionadas:?\s*<\/h\d>\s*<ul>[\s\S]*?<\/ul>/gi, "</p><p>");
  if (/proibida a reprodu/i.test(norm(htmlText)) || /proibida a reprodu/i.test(htmlText)) return null;
  const paras = htmlText.split(/<\/p>|<br\s*\/?>|<\/li>|<\/h\d>|<\/blockquote>/i)
    .map(p => decode(stripTags(p)).replace(/\s+/g, " ").trim())
    .filter(p => p.length > 1 && !/^(foto|imagem|edicao|edição):/i.test(p) && !/^[-–—\s]*$/.test(p));
  return paras.length ? paras : null;
}

// Federal Reserve press releases (US government works, public domain): paragraphs from the article block.
export function fedBody(html) {
  const start = html.search(/id="article"/i);
  if (start < 0) return null;
  let seg = html.slice(start);
  const end = seg.search(/<div[^>]+class="[^"]*(?:col-md-4|lastUpdate|panel)/i);
  if (end > 0) seg = seg.slice(0, end);
  const paras = [...seg.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => decode(stripTags(m[1])).replace(/\s+/g, " ").trim())
    .filter(p => p.length > 1);
  return paras.length ? paras : null;
}

// Turn one feed's items into rows.
export function toRows(feed, xml, now = new Date()) {
  const out = [];
  let items = parseFeed(xml);
  if (feed.gnews) items = items.slice(0, 40);
  for (const it of items) {
    if (!it.title || !/^https?:\/\//.test(it.link)) continue;
    if (feed.skip && feed.skip.test(it.title)) continue;
    let title = it.title, source = feed.name;
    if (feed.gnews) {
      // Google News titles end with " - Outlet"
      const m = title.match(/^(.*)\s+-\s+([^-]{2,60})$/);
      if (m) { title = m[1].trim(); source = (it.source || m[2]).trim(); }
      else if (it.source) source = it.source;
    }
    const published = parseDate(it.pubDate, feed.tz) || now;
    if (published > new Date(now.getTime() + 10 * 60 * 1000)) continue;      // ignore future-dated noise
    if (now - published > 4 * 86400 * 1000) continue;                       // keep the last 4 days
    let body = null;
    if (feed.full === "agenciabrasil") body = agenciaBrasilBody(it.descriptionRaw);
    const descText = feed.gnews ? "" : clean(it.descriptionRaw)
      .replace(/\s*(The post|O post)\b[\s\S]*?(appeared first on|apareceu primeiro em)[\s\S]*$/i, "").trim();
    const summarySrc = body ? body.join(" ") : descText;
    const summary = truncate(summarySrc && summarySrc !== title ? summarySrc : "", 260);
    const topics = topicsOf(title + " " + summary);
    if (feed.filter && !topics.length) continue;                              // general feeds: finance only
    if (feed.filter === "strict" && !topics.some(t => t !== "Fiscal")) continue;
    if (feed.gnews && DIRECT.has(norm(source))) continue;                       // already pulled from the source itself
    const id = keyOf(title);
    if (!id) continue;
    out.push({
      id, title, url: it.link, source, region: feed.region,
      topics, summary: summary || null,
      body, full_text: !!body,
      published_at: published.toISOString(),
      _fed: feed.full === "fed",
    });
  }
  return out;
}
