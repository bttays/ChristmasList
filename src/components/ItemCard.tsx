import type { ReactNode } from 'react'
import { PRIORITY_LABEL, formatMoney } from '../lib/format'
import type { WishItem } from '../types'

export function ItemCard({ item, children, dim }: { item: WishItem; children?: ReactNode; dim?: boolean }) {
  return (
    <li className={`card item ${dim ? 'dim' : ''}`}>
      <div className="thumb">
        {item.image_url ? (
          <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden>🎁</span>
        )}
      </div>
      <div className="item-main">
        <div className="item-meta">
          <span className={`badge ${item.priority}`}>{PRIORITY_LABEL[item.priority]}</span>
          {item.store && <span className="store">{item.store}</span>}
        </div>
        <h3>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.name}
            </a>
          ) : (
            item.name
          )}
        </h3>
        {item.notes && <p className="notes">{item.notes}</p>}
        {children && <div className="item-actions">{children}</div>}
      </div>
      {item.price != null && <span className="price">{formatMoney(item.price)}</span>}
    </li>
  )
}
