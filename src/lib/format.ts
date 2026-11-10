import type { GiftStatus, Priority } from '../types'

export const formatMoney = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

export const parseMoney = (s: string): number | null => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Really want',
  medium: 'Would like',
  low: 'Nice to have',
}
export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export const STATUS_LABEL: Record<GiftStatus, string> = {
  planned: 'Planned',
  bought: 'Bought',
  wrapped: 'Wrapped',
}
export const NEXT_STATUS: Record<GiftStatus, GiftStatus> = {
  planned: 'bought',
  bought: 'wrapped',
  wrapped: 'planned',
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

/** "https://www.target.com/p/…" → "Target" */
export function storeFromUrl(url: string): string {
  try {
    const parts = new URL(url).hostname.toLowerCase().replace(/^www\./, '').split('.')
    const i =
      parts.length >= 3 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length === 2
        ? parts.length - 3
        : parts.length - 2
    const label = parts[Math.max(0, i)]
    return KNOWN_STORES[label] ?? label.charAt(0).toUpperCase() + label.slice(1)
  } catch {
    return ''
  }
}

export const isHttpUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim())
