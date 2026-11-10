export type Priority = 'high' | 'medium' | 'low'

export interface WishItem {
  id: string
  name: string
  url?: string
  price?: number
  priority: Priority
  notes?: string
  createdAt: number
}

export type GiftStatus = 'idea' | 'bought' | 'wrapped'

export interface Gift {
  id: string
  name: string
  url?: string
  price?: number
  status: GiftStatus
}

export interface Recipient {
  id: string
  name: string
  budget?: number
  gifts: Gift[]
}
