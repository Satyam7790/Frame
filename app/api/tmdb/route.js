import { NextResponse } from 'next/server';

const BASE = 'https://api.themoviedb.org/3';
async function tmdb(path) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB is not connected yet. Add TMDB_API_KEY to your environment.');
  const response = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${key}`, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error('The film archive could not be reached. Try again in a moment.');
  return response.json();
}

async function imageConfig() {
  const config = await tmdb('/configuration');
  return { imageBase: config.images.secure_base_url, posterSizes: config.images.poster_sizes };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('featured') === '1') {
      const [trending, image] = await Promise.all([tmdb('/trending/movie/week?language=en-US'), imageConfig()]);
      return NextResponse.json({ featured: (trending.results || []).filter(item => item.poster_path).slice(0, 5), ...image });
    }
    const id = searchParams.get('id');
    const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie';
    if (id) {
      const [details, images, image] = await Promise.all([
        tmdb(`/${type}/${encodeURIComponent(id)}?language=en-US`),
        tmdb(`/${type}/${encodeURIComponent(id)}/images?include_image_language=en,null`),
        imageConfig(),
      ]);
      return NextResponse.json({ details, posters: (images.posters || []).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 24), ...image });
    }
    const query = searchParams.get('q')?.trim();
    if (!query) return NextResponse.json({ results: [] });
    const [data, image] = await Promise.all([
      tmdb(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`), imageConfig(),
    ]);
    return NextResponse.json({ results: (data.results || []).filter(item => ['movie', 'tv'].includes(item.media_type)).slice(0, 12), ...image });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 });
  }
}
