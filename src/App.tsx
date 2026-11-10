import { useState } from 'react'
import { Wishlist } from './components/Wishlist'
import { GiftTracker } from './components/GiftTracker'

type Tab = 'wishlist' | 'giving'

function daysUntilChristmas() {
  const now = new Date()
  let xmas = new Date(now.getFullYear(), 11, 25)
  if (now > new Date(now.getFullYear(), 11, 25, 23, 59, 59)) {
    xmas = new Date(now.getFullYear() + 1, 11, 25)
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((xmas.getTime() - today.getTime()) / 86_400_000)
}

export default function App() {
  const [tab, setTab] = useState<Tab>('wishlist')
  const days = daysUntilChristmas()

  return (
    <div className="app">
      <header className="top">
        <h1>🎄 Christmas List</h1>
        <p className="countdown">
          {days === 0 ? 'Merry Christmas!' : `${days} ${days === 1 ? 'day' : 'days'} until Christmas`}
        </p>
      </header>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'wishlist'} onClick={() => setTab('wishlist')}>
          My wishlist
        </button>
        <button role="tab" aria-selected={tab === 'giving'} onClick={() => setTab('giving')}>
          Gift giving
        </button>
      </nav>

      <main>{tab === 'wishlist' ? <Wishlist /> : <GiftTracker />}</main>
    </div>
  )
}
