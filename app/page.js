'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard, Film, Heart, LogIn, LogOut, Plus, Search, Star, X } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import PosterWall from '../components/PosterWall';

const FALLBACK = '/poster-fallback.svg';
const posterUrl = (path, base, sizes, quality = 'original') => {
  if (!path || !base) return FALLBACK;
  const size = quality === 'thumb' ? (sizes?.includes('w185') ? 'w185' : sizes?.[0]) : quality === 'medium' ? (sizes?.includes('w500') ? 'w500' : sizes?.at(-1)) : (sizes?.includes('original') ? 'original' : sizes?.at(-1));
  return size ? `${base}${size}${path}` : FALLBACK;
};
const yearOf = date => date ? String(date).slice(0, 4) : '—';
const today = () => new Date().toISOString().slice(0, 10);
const localKey = 'frame-watch-entries';

function IconButton({ label, children, onClick, className = '' }) {
  return <button aria-label={label} title={label} className={`icon-button ${className}`} onClick={onClick}>{children}</button>;
}

export default function Home() {
  const [entries, setEntries] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [modal, setModal] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState(null);
  const [art, setArt] = useState([]);
  const [poster, setPoster] = useState('');
  const [loadingArt, setLoadingArt] = useState(false);
  const [watchedDate, setWatchedDate] = useState(today());
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [imageConfig, setImageConfig] = useState(null);
  const [featured, setFeatured] = useState([]);

  const supabase = useMemo(() => getSupabase(), []);
  const currentEntries = useMemo(() => entries.filter(item => Number(String(item.watched_date || '').slice(0, 4)) === year).sort((a, b) => (a.watched_date || '').localeCompare(b.watched_date || '')), [entries, year]);
  const movies = currentEntries.filter(item => item.media_type === 'movie').length;
  const shows = currentEntries.filter(item => item.media_type === 'tv').length;
  const rated = currentEntries.filter(item => item.rating != null && item.rating !== '');
  const average = rated.length ? (rated.reduce((sum, item) => sum + Number(item.rating), 0) / rated.length).toFixed(1) : '—';
  const years = useMemo(() => [...new Set([new Date().getFullYear(), ...entries.map(item => Number(String(item.watched_date || '').slice(0, 4))).filter(Number.isFinite)])].sort((a, b) => b - a), [entries]);

  const loadEntries = useCallback(async () => {
    if (supabase) {
      const { data } = await supabase.from('watch_entries').select('*').order('watched_date', { ascending: true });
      if (data) { setEntries(data); return; }
    }
    try { setEntries(JSON.parse(localStorage.getItem(localKey) || '[]')); } catch { setEntries([]); }
  }, [supabase]);

  useEffect(() => {
    loadEntries();
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
      const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); loadEntries(); });
      return () => data.subscription.unsubscribe();
    }
  }, [loadEntries, supabase]);

  useEffect(() => {
    fetch('/api/tmdb?featured=1').then(response => response.json()).then(data => {
      if (data.imageBase && data.posterSizes) setImageConfig({ imageBase: data.imageBase, posterSizes: data.posterSizes });
      setFeatured(data.featured || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearchError(''); return; }
    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError('');
      try {
        const response = await fetch(`/api/tmdb?q=${encodeURIComponent(query.trim())}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (data.imageBase && data.posterSizes) setImageConfig({ imageBase: data.imageBase, posterSizes: data.posterSizes });
        if (active) setResults(data.results || []);
      } catch (error) { if (active) { setSearchError(error.message); setResults([]); } }
      finally { if (active) setSearching(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  function openSearch() { setQuery(''); setResults([]); setSelected(null); setSearchError(''); setModal('search'); }
  async function chooseTitle(item) {
    const type = item.media_type || item.type || 'movie';
    setSelected({ ...item, media_type: type }); setLoadingArt(true); setArt([]); setPoster(item.poster_path || ''); setWatchedDate(today()); setRating(''); setNotes(''); setEditingId(null); setModal('art');
    try {
      const response = await fetch(`/api/tmdb?id=${item.id || item.tmdb_id}&type=${type}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.imageBase && data.posterSizes) setImageConfig({ imageBase: data.imageBase, posterSizes: data.posterSizes });
      setSelected(current => ({ ...current, ...data.details, media_type: type }));
      setArt(data.posters || []);
      if (!item.poster_path && data.posters?.[0]?.file_path) setPoster(data.posters[0].file_path);
    } catch (error) { setSearchError(error.message); }
    finally { setLoadingArt(false); }
  }

  async function persist(next) {
    setEntries(next);
    if (supabase && user) {
      // The database policy scopes every row to the signed-in user.
      const existing = next.find(item => item.id === editingId);
      if (existing) await supabase.from('watch_entries').update(existing).eq('id', existing.id);
      else {
        const entry = next[next.length - 1];
        await supabase.from('watch_entries').insert({ ...entry, user_id: user.id });
      }
      await loadEntries();
    } else localStorage.setItem(localKey, JSON.stringify(next));
  }

  async function saveEntry(event) {
    event.preventDefault();
    if (!selected || !watchedDate) return;
    const duplicate = entries.some(item => item.id !== editingId && String(item.tmdb_id) === String(selected.id || selected.tmdb_id) && item.media_type === selected.media_type && item.watched_date === watchedDate);
    if (duplicate) { setNotice('This title is already in your archive for that date.'); return; }
    const record = {
      id: editingId || (globalThis.crypto?.randomUUID?.() || String(Date.now())), user_id: user?.id || null,
      tmdb_id: Number(selected.id || selected.tmdb_id), media_type: selected.media_type,
      title: selected.title || selected.name, poster_path: poster || null,
      release_date: selected.release_date || selected.first_air_date || null,
      watched_date: watchedDate, rating: rating === '' ? null : Number(rating), notes: notes.trim() || null,
      overview: selected.overview || '', genres: (selected.genres || []).map(genre => genre.name),
    };
    const next = editingId ? entries.map(item => item.id === editingId ? record : item) : [...entries, record];
    await persist(next); setModal(''); setNotice('Added to your archive'); setTimeout(() => setNotice(''), 2800);
  }

  function editEntry(entry) {
    setEditingId(entry.id); setSelected({ ...entry, id: entry.tmdb_id, title: entry.title, media_type: entry.media_type, release_date: entry.release_date });
    setPoster(entry.poster_path || ''); setWatchedDate(entry.watched_date); setRating(entry.rating ?? ''); setNotes(entry.notes || ''); setArt([]); setModal('art'); setDetail(null);
  }

  async function removeEntry(entry) {
    const next = entries.filter(item => item.id !== entry.id); setEntries(next);
    if (supabase && user) { await supabase.from('watch_entries').delete().eq('id', entry.id); await loadEntries(); }
    else localStorage.setItem(localKey, JSON.stringify(next));
    setDetail(null); setNotice('Removed from your archive'); setTimeout(() => setNotice(''), 2200);
  }

  async function authSubmit(event) {
    event.preventDefault(); if (!supabase) { setNotice('Add your Supabase details to connect an account.'); return; }
    const action = authMode === 'signup' ? supabase.auth.signUp({ email: authEmail, password: authPassword }) : supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    const { error } = await action;
    if (error) setNotice(error.message); else { setModal(''); setNotice(authMode === 'signup' ? 'Check your email to confirm your account.' : 'Welcome back'); }
    setTimeout(() => setNotice(''), 3500);
  }

  return <main>
    <header className="nav">
      <a href="#top" className="wordmark"><span className="wordmark-mark">F</span> FRAME<span className="wordmark-dot">.</span></a>
      <nav className="nav-links"><a href="#top">Home</a><a href="#archive">My archive</a><a href="#about">About</a></nav>
      <div className="nav-actions"><span className="edition-label">THE PERSONAL FILM JOURNAL</span>{user ? <button className="profile-button" onClick={async () => { await supabase.auth.signOut(); setUser(null); }}><LogOut size={15} /> Sign out</button> : <button className="profile-button" onClick={() => { setAuthMode('login'); setModal('auth'); }}><LogIn size={15} /> Sign in</button>}<button className="add-top" onClick={openSearch}><Plus size={17} /><span>Add a film</span></button></div>
    </header>

    <section className="hero" id="top">
      <div className="hero-backdrop" aria-hidden="true">{featured.map((item, index) => <div className={`hero-art art-slot-${index + 1}`} key={item.id} style={{ backgroundImage: `url("${posterUrl(item.poster_path, imageConfig?.imageBase, imageConfig?.posterSizes, 'thumb')}")` }}/>)}</div>
      <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-rule"/> A PERSONAL CINEMATIC YEARBOOK</p><h1>A year<br />in <em>frames.</em></h1><p className="hero-sub">Every story you watched.<br />Every world you visited. All in one place.</p><a className="hero-cta" href="#archive">Explore your collection <ArrowDown size={16} /></a></div>
      <div className="hero-side-note">ISSUE NO. {String(year).slice(2)} <span>—</span> EST. IN YOUR IMAGINATION</div>
      <div className="hero-bottom"><span>SCROLL TO REVISIT</span><span className="hero-line"/><span>YOUR STORIES, IN ORDER</span></div>
    </section>

    <section className="archive-section" id="archive">
      <div className="section-kicker"><span>01 / THE ARCHIVE</span><span>COLLECTED MOMENTS, MOVING PICTURES</span></div>
      <div className="archive-heading"><div><p className="eyebrow">YOUR PERSONAL CINEMA</p><h2>{year} <span>—</span> A YEAR IN FRAMES</h2></div><div className="year-picker-wrap"><label htmlFor="year-picker">VIEWING YEAR</label><div className="year-picker"><select id="year-picker" value={year} onChange={event => setYear(Number(event.target.value))}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={14}/></div></div></div>
      <div className="stats-row"><div className="stat"><span className="stat-number">{String(currentEntries.length).padStart(2, '0')}</span><span className="stat-label">TOTAL ENTRIES</span></div><div className="stat"><span className="stat-number">{String(movies).padStart(2, '0')}</span><span className="stat-label">FEATURES</span></div><div className="stat"><span className="stat-number">{String(shows).padStart(2, '0')}</span><span className="stat-label">SERIES</span></div><div className="stat"><span className="stat-number rating-stat">{average}<span className="stat-star">★</span></span><span className="stat-label">YOUR AVERAGE</span></div><button className="archive-add" onClick={openSearch}><Plus size={17}/><span>ADD TO THE YEAR</span></button></div>

      {currentEntries.length ? <PosterWall entries={currentEntries} imageBase={imageConfig?.imageBase} posterSizes={imageConfig?.posterSizes} posterUrl={posterUrl} fallback={FALLBACK} onOpen={setDetail} onAdd={openSearch}/> : <div className="empty-state"><div className="empty-copy"><span className="empty-number">{String(year).slice(2)} / 01</span><p className="eyebrow">THE FIRST PAGE IS YOURS</p><h3>Every great story<br/>begins <em>somewhere.</em></h3><p className="empty-sub">Start building your cinematic year. The films that stay with you deserve a place to live.</p><button className="hero-cta" onClick={openSearch}>Add your first film <ArrowRight size={16}/></button></div><div className="empty-mark"><Clapperboard size={82} strokeWidth={.65}/><span>THE SCREEN IS YOURS</span></div></div>}
    </section>

    <section className="interlude" id="about"><div className="interlude-mark">“</div><p>Not a watchlist.<br/><em>A life, in moving pictures.</em></p><a className="tmdb-credit" href="https://www.themoviedb.org" target="_blank" rel="noreferrer"><img src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB"/><span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span></a><div className="interlude-foot"><span>FRAME / YOUR CINEMATIC YEARBOOK</span><span>MADE FOR THE STORIES THAT STAY</span></div></section>
    <footer><a href="#top" className="wordmark"><span className="wordmark-mark">F</span> FRAME<span className="wordmark-dot">.</span></a><span>EVERY FRAME HOLDS A MEMORY.</span><span>© {new Date().getFullYear()} — YOUR PRIVATE ARCHIVE</span></footer>

    <AnimatePresence>{modal && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) setModal(''); }}>
      <motion.div className={`modal-panel ${modal === 'search' ? 'search-panel' : ''}`} initial={{ opacity: 0, y: 24, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .99 }} transition={{ duration: .24 }}>
        {modal === 'search' && <><div className="modal-top"><span className="eyebrow"><span className="eyebrow-rule"/> ADD TO YOUR ARCHIVE</span><IconButton label="Close" onClick={() => setModal('')}><X size={19}/></IconButton></div><h3>Find a <em>story.</em></h3><div className="search-field"><Search size={20}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search films and series…"/><span>TMDB</span></div>{searchError && <p className="inline-error">{searchError}</p>}<div className="search-results">{searching && <div className="search-loading"><i/><i/><i/><span>LOOKING THROUGH THE ARCHIVE</span></div>}{!searching && query && results.map(item => <button className="result-row" key={`${item.media_type}-${item.id}`} onClick={() => chooseTitle(item)}><img src={posterUrl(item.poster_path, imageConfig?.imageBase, imageConfig?.posterSizes, 'thumb')} alt="" onError={event => { event.currentTarget.src = FALLBACK; }}/><span className="result-info"><strong>{item.title || item.name}</strong><small>{yearOf(item.release_date || item.first_air_date)} <i>·</i> {item.media_type === 'tv' ? 'SERIES' : 'FILM'}</small><span>{item.overview || 'No synopsis available.'}</span></span><ArrowRight size={17}/></button>)}{!searching && !query && <div className="search-prompt"><Film size={24}/><span>Type a title to find your next frame.</span></div>}{!searching && query && results.length === 0 && !searchError && <div className="search-prompt">No stories found. Try another title.</div>}</div><p className="tmdb-attribution">This product uses the TMDB API but is not endorsed or certified by <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>.</p></>}

        {modal === 'art' && selected && <form onSubmit={saveEntry}><div className="modal-top"><button type="button" className="back-button" onClick={() => { setModal('search'); setSearchError(''); }}><ArrowLeft size={15}/> BACK TO SEARCH</button><IconButton label="Close" onClick={() => setModal('')}><X size={19}/></IconButton></div><div className="art-layout"><div className="selected-poster"><img src={posterUrl(poster, imageConfig?.imageBase, imageConfig?.posterSizes)} alt={`${selected.title || selected.name} selected poster`} onError={event => { event.currentTarget.src = FALLBACK; }}/><span>SELECTED ARTWORK</span></div><div className="art-content"><p className="eyebrow">{editingId ? 'REVISIT A STORY' : 'CHOOSE YOUR FRAME'}</p><h3>{selected.title || selected.name}</h3><p className="art-meta">{yearOf(selected.release_date || selected.first_air_date)} <i>·</i> {selected.media_type === 'tv' ? 'TELEVISION' : 'FEATURE FILM'}</p><p className="art-overview">{selected.overview || 'A story worth remembering.'}</p><div className="art-picker-head"><span>AVAILABLE ARTWORK</span><small>{loadingArt ? 'LOADING…' : `${art.length || (poster ? 1 : 0)} OPTIONS`}</small></div><div className="art-options">{art.map((option, index) => <button type="button" key={`${option.file_path}-${index}`} className={`art-option ${poster === option.file_path ? 'chosen' : ''}`} onClick={() => setPoster(option.file_path)}><img src={posterUrl(option.file_path, imageConfig?.imageBase, imageConfig?.posterSizes, 'thumb')} alt={`Poster option ${index + 1}`} loading="lazy"/>{poster === option.file_path && <span><Check size={15}/></span>}</button>)}{!loadingArt && !art.length && <p className="art-no-options">No alternate artwork available.</p>}</div><div className="entry-fields"><label>DATE WATCHED<input type="date" value={watchedDate} onChange={event => setWatchedDate(event.target.value)} required/></label><label>YOUR RATING <span className="optional">OPTIONAL</span><select value={rating} onChange={event => setRating(event.target.value)}><option value="">No rating</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / 10</option>)}</select></label><label className="notes-field">A NOTE TO YOURSELF <span className="optional">OPTIONAL</span><textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="What stayed with you?" rows="2"/></label><button className="save-entry" type="submit">{editingId ? 'SAVE CHANGES' : 'ADD TO YOUR YEAR'} <ArrowRight size={16}/></button></div></div></div></form>}

        {modal === 'auth' && <form className="auth-form" onSubmit={authSubmit}><div className="modal-top"><span className="eyebrow"><span className="eyebrow-rule"/> YOUR PRIVATE ARCHIVE</span><IconButton label="Close" onClick={() => setModal('')}><X size={19}/></IconButton></div><h3>{authMode === 'login' ? <>Welcome <em>back.</em></> : <>Make it <em>yours.</em></>}</h3><p className="auth-note">{supabase ? 'Sign in to keep your collection close, wherever you go.' : 'Connect Supabase to sync your journal securely across sessions.'}</p><label>EMAIL<input type="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} placeholder="you@example.com" required/></label><label>PASSWORD<input type="password" value={authPassword} onChange={event => setAuthPassword(event.target.value)} minLength="6" placeholder="At least 6 characters" required/></label><button className="save-entry" type="submit">{authMode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'} <ArrowRight size={16}/></button><button className="auth-switch" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'New to Frame? Create an account' : 'Already have an account? Sign in'}</button></form>}
      </motion.div>
    </motion.div>}</AnimatePresence>

    <AnimatePresence>{detail && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) setDetail(null); }}><motion.div className="detail-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}><IconButton label="Close" className="detail-close" onClick={() => setDetail(null)}><X size={19}/></IconButton><img className="detail-poster" src={posterUrl(detail.poster_path, imageConfig?.imageBase, imageConfig?.posterSizes)} alt={`${detail.title} poster`} onError={event => { event.currentTarget.src = FALLBACK; }}/><div className="detail-content"><p className="eyebrow">{detail.media_type === 'tv' ? 'A SERIES IN YOUR YEAR' : 'A FILM IN YOUR YEAR'}</p><h3>{detail.title}</h3><p className="detail-meta">{yearOf(detail.release_date)} <i>·</i> WATCHED {detail.watched_date} {detail.rating && <><i>·</i> <Star size={13} fill="currentColor"/> {detail.rating}/10</>}</p><p className="detail-overview">{detail.overview || 'A story kept in your personal archive.'}</p>{detail.genres?.length > 0 && <div className="genre-list">{detail.genres.map(genre => <span key={genre}>{genre}</span>)}</div>}{detail.notes && <blockquote>“{detail.notes}”</blockquote>}<div className="detail-actions"><button onClick={() => editEntry(detail)}>EDIT ENTRY</button><button className="remove-entry" onClick={() => removeEntry(detail)}>REMOVE FROM ARCHIVE</button></div></div></motion.div></motion.div>}</AnimatePresence>
    <AnimatePresence>{notice && <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Heart size={14} fill="currentColor"/>{notice}</motion.div>}</AnimatePresence>
  </main>;
}
