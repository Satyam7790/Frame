# FRAME — A year in frames

A cinematic watch journal built with Next.js, React, Tailwind CSS, Framer Motion, TMDB, and optional Supabase sync.

## Start

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add a TMDB API key. The key stays on the server and is used by the `/api/tmdb` route.
3. Run `npm run dev` and open `http://localhost:3000`.

Without Supabase configured, entries are saved in this browser's local storage. For accounts and cross-device persistence, add your Supabase project URL and anon key to `.env.local`, then run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. The table uses row-level security to keep each user's journal private. Set your Supabase Auth email settings as desired.

## Features

- Debounced TMDB movie and TV search with server-side API key handling.
- TMDB poster gallery, date watched, optional personal rating and note.
- Horizontal, touch-friendly poster wall with mouse dragging and wheel navigation.
- Year switching, archive counts, rating average, detail view, edit and delete.
- Local-first persistence or Supabase Auth and RLS-protected PostgreSQL storage.
- Responsive editorial layout, loading states, missing-art fallback, reduced-motion support, and TMDB attribution.

TMDB API and poster artwork are subject to TMDB's terms and belong to their respective creators. This product uses the TMDB API but is not endorsed or certified by TMDB.
