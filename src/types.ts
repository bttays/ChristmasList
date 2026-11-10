export type Priority = 'high' | 'medium' | 'low'
export type GiftStatus = 'planned' | 'bought' | 'wrapped'

export interface Profile {
  id: string
  display_name: string
}

export interface Family {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  members: Profile[]
}

/** A family member, with every family you share with them. */
export interface Person extends Profile {
  familyIds: string[]
}

export interface WishItem {
  id: string
  owner_id: string
  name: string
  url: string | null
  image_url: string | null
  store: string | null
  price: number | null
  priority: Priority
  notes: string | null
  created_at: string
}

export interface Gift {
  id: string
  giver_id: string
  recipient_id: string
  item_id: string | null
  name: string
  price: number | null
  status: GiftStatus
  created_at: string
}

export interface Budget {
  recipient_id: string | null
  amount: number
}
