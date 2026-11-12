'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';

export default function PosterWall({ entries, imageBase, posterSizes, posterUrl, fallback, onOpen, onAdd }) {
  const wallRef = useRef(null);
  const drag = useRef(null);
  const justDragged = useRef(false);
  const inertia = useRef(null);
  const [progress, setProgress] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = entries[activeIndex] || entries[0];

  const centerCard = useCallback(index => {
    const wall = wallRef.current;
    const card = wall?.querySelector(`[data-index="${index}"]`);
    if (!wall || !card) return;
    wall.scrollTo({ left: card.offsetLeft - (wall.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    if (entries.length) requestAnimationFrame(() => centerCard(0));
  }, [centerCard, entries]);

  useEffect(() => () => cancelAnimationFrame(inertia.current), []);

  function updateActive() {
    const wall = wallRef.current;
    if (!wall) return;
    const center = wall.getBoundingClientRect().left + wall.clientWidth / 2;
    const cards = [...wall.querySelectorAll('[data-index]')];
    let nearest = 0;
    let distance = Infinity;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const nextDistance = Math.abs(rect.left + rect.width / 2 - center);
      if (nextDistance < distance) { distance = nextDistance; nearest = Number(card.dataset.index); }
    });
    setActiveIndex(current => current === nearest ? current : nearest);
    const max = wall.scrollWidth - wall.clientWidth;
    setProgress(max > 0 ? wall.scrollLeft / max : 0);
  }

  function startDrag(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelAnimationFrame(inertia.current);
    drag.current = { x: event.clientX, left: wallRef.current.scrollLeft, lastX: event.clientX, lastTime: performance.now(), velocity: 0, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag.current) return;
    const state = drag.current;
    const now = performance.now();
    const delta = event.clientX - state.x;
    if (Math.abs(delta) > 5) state.moved = true;
    wallRef.current.scrollLeft = state.left - delta;
    const elapsed = Math.max(1, now - state.lastTime);
    state.velocity = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastTime = now;
  }
  function endDrag() {
    if (!drag.current) return;
    const state = drag.current;
    drag.current = null;
    if (state.moved) {
      justDragged.current = true;
      window.setTimeout(() => { justDragged.current = false; }, 0);
      let velocity = -state.velocity * 17;
      const coast = () => {
        if (!wallRef.current || Math.abs(velocity) < .2) { updateActive(); return; }
        wallRef.current.scrollLeft += velocity;
        velocity *= .92;
        updateActive();
        inertia.current = requestAnimationFrame(coast);
      };
      inertia.current = requestAnimationFrame(coast);
    }
  }
  function wheelWall(event) {
    const wall = wallRef.current;
    if (!wall || wall.scrollWidth <= wall.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    wall.scrollBy({ left: event.deltaY, behavior: 'auto' });
  }
  function step(direction) {
    const next = Math.max(0, Math.min(entries.length - 1, activeIndex + direction));
    setActiveIndex(next);
    centerCard(next);
  }

  return <div className="archive-display">
    <div className="archive-display-top"><span><i className="live-dot"/> {String(entries.length).padStart(2, '0')} TITLES / PERSONAL COLLECTION</span><span className="shelf-instruction">DRAG · SCROLL · BROWSE</span></div>
    <div className="shelf-window">
      <div ref={wallRef} className="poster-wall" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={wheelWall} onScroll={updateActive}>
        <div className="shelf-spacer" aria-hidden="true"/>
        {entries.map((entry, index) => <motion.button key={entry.id} data-index={index} className={`poster-card ${activeIndex === index ? 'is-active' : ''}`} onClick={() => { if (justDragged.current) { justDragged.current = false; return; } onOpen(entry); }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: activeIndex === index ? 1 : .82, y: 0, scale: activeIndex === index ? 1 : .96 }} transition={{ duration: .32 }} whileHover={{ opacity: 1, y: -7 }}>
          <img src={posterUrl(entry.poster_path, imageBase, posterSizes, 'medium')} alt={`${entry.title} poster`} loading="lazy" draggable="false" onError={event => { event.currentTarget.src = fallback; }}/>
          <span className="poster-caption"><span>{entry.title}</span><small>{String(entry.release_date || '').slice(0, 4) || '—'} <i>·</i> {entry.media_type === 'tv' ? 'SERIES' : 'FILM'}</small></span>
        </motion.button>)}
        <button className="wall-add-card" onClick={onAdd}><span className="wall-add-icon"><Plus size={17}/></span><span>ADD A<br/>MEMORY</span></button>
        <div className="shelf-spacer" aria-hidden="true"/>
      </div>
      <div className="shelf-rail" aria-hidden="true"><span/><span/><span/></div>
      <div className="shelf-floor" aria-hidden="true"/>
    </div>
    {active && <div className="active-film-line">
      <button className="film-step" aria-label="Previous title" onClick={() => step(-1)} disabled={activeIndex === 0}><ArrowLeft size={15}/></button>
      <div className="active-film-copy"><span className="active-film-number">FRAME {String(activeIndex + 1).padStart(2, '0')} <i>/</i> {String(entries.length).padStart(2, '0')}</span><h3>{active.title}</h3><span className="active-film-meta">{String(active.release_date || '').slice(0, 4) || '—'} <i>·</i> WATCHED {active.watched_date} {active.rating && <><i>·</i> ★ {active.rating}/10</>}</span></div>
      <button className="active-film-open" onClick={() => onOpen(active)}>OPEN ENTRY <ArrowRight size={14}/></button>
      <button className="film-step" aria-label="Next title" onClick={() => step(1)} disabled={activeIndex === entries.length - 1}><ArrowRight size={15}/></button>
    </div>}
    <div className="wall-progress"><span>01</span><div className="progress-track"><span style={{ width: `${Math.max(4, progress * 100)}%` }}/></div><span>{String(entries.length).padStart(2, '0')}</span></div>
  </div>;
}
