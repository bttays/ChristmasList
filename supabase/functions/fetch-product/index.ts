// Supabase Edge Function: reads product details (name, image, price, store)
// from a shop's product page so people can add wishlist items by pasting a link.
// Uses the structured data most shops publish (JSON-LD / Open Graph tags).

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Only fetch public websites by name: no IP literals or internal hostnames.
function isBlockedHost(host: string) {
  const h = host.toLowerCase()
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^[\d.]+$/.test(h) ||
    h.includes(':') ||
    h.startsWith('[') ||
    !h.includes('.')
  )
}

const KNOWN_STORES: Record<string, string> = {
  amazon: 'Amazon', bestbuy: 'Best Buy', kohls: "Kohl's", homedepot: 'Home Depot', lowes: "Lowe's",
  macys: "Macy's", nordstrom: 'Nordstrom', walmart: 'Walmart', target: 'Target', etsy: 'Etsy',
  ebay: 'eBay', costco: 'Costco', samsclub: "Sam's Club", oldnavy: 'Old Navy', gap: 'Gap',
  llbean: 'L.L.Bean', rei: 'REI', jcpenney: 'JCPenney', bedbathandbeyond: 'Bed Bath & Beyond',
  barnesandnoble: 'Barnes & Noble', dickssportinggoods: "Dick's Sporting Goods", ulta: 'Ulta',
  sephora: 'Sephora', apple: 'Apple', lego: 'LEGO', wayfair: 'Wayfair', potterybarn: 'Pottery Barn',
  anthropologie: 'Anthropologie', urbanoutfitters: 'Urban Outfitters', abercrombie: 'Abercrombie',
  hollisterco: 'Hollister', americaneagle: 'American Eagle', ae: 'American Eagle', lululemon: 'lululemon',
  nike: 'Nike', adidas: 'adidas', bathandbodyworks: 'Bath & Body Works', kirklands: "Kirkland's",
  tjmaxx: 'TJ Maxx', marshalls: 'Marshalls', hobbylobby: 'Hobby Lobby', michaels: 'Michaels',
  gamestop: 'GameStop', crateandbarrel: 'Crate & Barrel', williams: 'Williams Sonoma',
  'williams-sonoma': 'Williams Sonoma', zappos: 'Zappos', chewy: 'Chewy', shein: 'SHEIN', temu: 'Temu',
}

function storeFromHost(host: string) {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.')
  const i =
    parts.length >= 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2
      ? parts.length - 3
      : parts.length - 2
  const label = parts[Math.max(0, i)]
  return KNOWN_STORES[label] ?? label.charAt(0).toUpperCase() + label.slice(1)
}

// "Amazon.com: Cozy Socks : Clothing" → "Cozy Socks"; "Cozy Socks - Walmart.com" → "Cozy Socks"
function cleanTitle(title: string) {
  return title
    .replace(/^amazon\.[a-z.]+\s*:\s*/i, '')
    .replace(/\s*:\s*[^:]+$/, (m) => (/amazon/i.test(title) ? '' : m))
    .replace(/\s+[|–—-]\s+[^|–—-]*\.(com|net|co\.uk|ca)\s*$/i, '')
    .replace(/\s+\|\s+[^|]+$/, '')
    .trim()
}

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

function metaTags(html: string) {
  const map = new Map<string, string>()
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {}
    for (const a of m[0].matchAll(/([a-zA-Z:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3]
    }
    const key = (attrs.property || attrs.name || attrs.itemprop)?.toLowerCase()
    if (key && attrs.content && !map.has(key)) map.set(key, decode(attrs.content))
  }
  return map
}

type Obj = Record<string, unknown>

function findProduct(node: unknown): Obj | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n)
      if (p) return p
    }
    return undefined
  }
  if (node && typeof node === 'object') {
    const o = node as Obj
    const t = o['@type']
    const types = Array.isArray(t) ? t : [t]
    if (types.includes('Product') || types.includes('ProductGroup')) return o
    if (o['@graph']) return findProduct(o['@graph'])
  }
  return undefined
}

function jsonLdProduct(html: string) {
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const p = findProduct(JSON.parse(m[1].trim()))
      if (p) return p
    } catch {
      // Malformed JSON-LD is common; try the next block.
    }
  }
  return undefined
}

function toPrice(v: unknown): number | undefined {
  if (typeof v === 'number') return v > 0 ? v : undefined
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  return undefined
}

function offerPrice(offers: unknown): number | undefined {
  if (Array.isArray(offers)) {
    for (const o of offers) {
      const p = offerPrice(o)
      if (p !== undefined) return p
    }
    return undefined
  }
  if (offers && typeof offers === 'object') {
    const o = offers as Obj
    return (
      toPrice(o.price) ??
      toPrice(o.lowPrice) ??
      toPrice((o.priceSpecification as Obj | undefined)?.price) ??
      offerPrice(o.offers)
    )
  }
  return undefined
}

function imageUrl(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return imageUrl(v[0])
  if (v && typeof v === 'object') return imageUrl((v as Obj).url ?? (v as Obj).contentUrl)
  return undefined
}

async function fetchPage(start: URL) {
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    if (!['http:', 'https:'].includes(url.protocol) || isBlockedHost(url.hostname)) {
      throw new Error('Unsupported URL')
    }
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    if (!res.ok) throw new Error(`The store returned ${res.status}`)
    return { url, html: (await res.text()).slice(0, 3_000_000) }
  }
  throw new Error('Too many redirects')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  let target: URL
  try {
    target = new URL((await req.json()).url)
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }
  const fallbackStore = storeFromHost(target.hostname)

  let page: { url: URL; html: string }
  try {
    page = await fetchPage(target)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Could not load page', store: fallbackStore })
  }

  const meta = metaTags(page.html)
  const product = jsonLdProduct(page.html)

  const titleTag = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const rawName =
    (typeof product?.name === 'string' ? decode(product.name) : undefined) ??
    meta.get('og:title') ??
    meta.get('twitter:title') ??
    (titleTag ? decode(titleTag) : undefined)
  const name = rawName ? cleanTitle(rawName) || rawName : undefined

  const price =
    offerPrice(product?.offers) ??
    toPrice(meta.get('product:price:amount')) ??
    toPrice(meta.get('og:price:amount')) ??
    toPrice(meta.get('price'))

  let image = imageUrl(product?.image) ?? meta.get('og:image') ?? meta.get('twitter:image')
  if (image) {
    try {
      image = new URL(image, page.url).toString()
    } catch {
      image = undefined
    }
  }

  // Prefer our own consistent store names so "sort by store" groups cleanly.
  const host = storeFromHost(page.url.hostname)
  const siteName = meta.get('og:site_name')
  const known = Object.values(KNOWN_STORES).includes(host)
  const store = !known && siteName && siteName.length <= 30 ? siteName : host

  return json({ name, price, image, store })
})
