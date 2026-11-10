# 🎄 Christmas List

A shared Christmas wishlist app for families. Everyone keeps their own wishlist, sees everyone else's, quietly claims what they're buying, and tracks their spending against a budget.

## Features

- **Email sign-in links.** No passwords to remember.
- **Families.** Create a family (e.g. "Sills Family", "Taylor Family") and share an invite link. You can belong to several families.
- **My list.** Paste a product link from any store and the name, photo, price and store fill in automatically when the store allows it. Set a priority and add notes (size, color…).
- **Family lists.** See everyone's wishlists and filter or group by family, person or store. Sort by priority or price. Click **"I'll get this"** to claim an item so nobody doubles up. **People never see what's been claimed from their own list.**
- **Gifts & budget.** Everything you've claimed, plus your own gift ideas, grouped by person. Track each gift as Planned → Bought → Wrapped, record what you paid, and set a budget per person and overall.

## Setup

### 1. Create the Supabase project (free)

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick any name and a strong database password.
2. When it's ready, open **SQL Editor → New query**, paste in all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Open **Edge Functions → Deploy a new function → Via Editor**. Name it `fetch-product`, replace the sample code with [`supabase/functions/fetch-product/index.ts`](supabase/functions/fetch-product/index.ts), and deploy. This is what reads product links.
4. Open **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (change this to your real site address once it's hosted)
   - **Redirect URLs**: add `http://localhost:5173/**`
5. Open **Project Settings → API** (or **API Keys**) and copy the **Project URL** and the **anon / publishable key**.

### 2. Run the app

```bash
cp .env.example .env.local   # then paste in the URL and key from step 5
npm install
npm run dev
```

Open http://localhost:5173, sign in with your email, create your families, and send the invite links.

### Good to know

- Supabase's built-in email service only sends **a few sign-in emails per hour**. That's fine for testing, but before inviting the whole family, connect a free email sender such as [Resend](https://resend.com) under **Authentication → Emails → SMTP Settings**.
- Some big stores (Best Buy, Kohl's and others) block automatic product lookups. For those, the store name still fills in from the link and you type the rest.

## Development

```bash
npm run dev     # start the dev server
npm run build   # type-check and build for production
npm run lint
```

Built with React, TypeScript, Vite and Supabase (Postgres + Auth + Edge Functions). All privacy rules live in the database as row-level security policies in `supabase/schema.sql`.
