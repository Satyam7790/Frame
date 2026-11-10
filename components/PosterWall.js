'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Plus } from 'lucide-react';

export default function PosterWall({ entries, imageBase, posterSizes, posterUrl, fallback, onOpen, onAdd }) {
  const wallRef = useRef(null);
  const drag = useRef(null);
  const dragged = useRef(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = wallRef.current;
    if (!node) return;
    const update = () => { const max = node.scrollWidth - node.clientWidth; setProgress(max > 0 ? node.scrollLeft / max : 0); };
    node.addEventListener('scroll', update, { passive: true }); update();
    return () => node.removeEventListener('scroll', update);
  }, [entries.length]);

  function startDrag(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { x: event.clientX, left: wallRef.current.scrollLeft };
    dragged.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag.current) return;
    const delta = event.clientX - drag.current.x;
    if (Math.abs(delta) > 6) dragged.current = true;
    wallRef.current.scrollLeft = drag.current.left - delta;
  }
  function wheelWall(event) {
    const node = wallRef.current;
    if (!node || node.scrollWidth <= node.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault(); node.scrollBy({ left: event.deltaY, behavior: 'auto' });
  }

  return <>
    <div className="wall-meta"><span><span className="live-dot"/> {entries.length} STORIES COLLECTED</span><span>DRAG TO EXPLORE <ArrowRight size={13}/></span></div>
    <div className="wall-shell"><div ref={wallRef} className="poster-wall" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onWheel={wheelWall}>
      {entries.map((entry, index) => <motion.button key={entry.id} className="poster-card" onClick={() => { if (dragged.current) { dragged.current = false; return; } onOpen(entry); }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .035, .35), duration: .45 }} whileHover={{ y: -12, rotate: index % 2 ? 1.1 : -1.1, scale: 1.035 }}>
        <img src={posterUrl(entry.poster_path, imageBase, posterSizes, 'medium')} alt={`${entry.title} poster`} loading="lazy" draggable="false" onError={event => { event.currentTarget.src = fallback; }}/><span className="poster-shade"/><span className="poster-index">{String(index + 1).padStart(2, '0')}</span><span className="poster-caption"><span>{entry.title}</span><small>{String(entry.release_date || '').slice(0, 4) || '—'} <i>·</i> {entry.rating ? `★ ${entry.rating}` : entry.media_type === 'tv' ? 'SERIES' : 'FILM'}</small></span>
      </motion.button>)}
      <button className="wall-add-card" onClick={onAdd}><span className="wall-add-icon"><Plus/></span><span>Another story<br/>for the year?</span><small>ADD A FILM</small></button>
    </div></div>
    <div className="wall-progress"><span>01</span><div className="progress-track"><span style={{ width: `${Math.max(4, progress * 100)}%` }}/></div><span>{String(entries.length).padStart(2, '0')}</span></div>
  </>;
}
