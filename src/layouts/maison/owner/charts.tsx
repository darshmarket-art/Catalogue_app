import React, { useId, useRef, useState } from 'react';
import './maison-owner.css';
import './charts.css';

/*
 * Maison owner charts: plain SVG/HTML, no library. Ink marks on white with one bronze accent, hairline axes, a draw-in on mount (CSS; none under
 * reduced motion), a tooltip on hover or tap, and a hidden table for screen readers. No data = an empty chart ("No data yet"), never made-up numbers.
 * One axis per chart: two measures of different scale are two Sparks side by side.
 */
const fmt = (n: number) => n.toLocaleString('en-IN');

/** A line-and-area chart of one series with a big number above it. */
export const Spark: React.FC<{ label: string; value: React.ReactNode; data: number[]; labels: string[]; accent?: boolean; unit?: string; testId?: string }> = ({ label, value, data, labels, accent, unit = '', testId }) => {
  const [hot, setHot] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const W = 320, H = 96, T = 8, B = 4;
  const n = data.length;
  const max = Math.max(0, ...data);
  const empty = n < 2 || max === 0;
  const px = (i: number) => (n < 2 ? 0 : (i / (n - 1)) * W);
  const py = (v: number) => H - B - (max ? (v / max) * (H - T - B) : 0);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const move = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || empty) return;
    setHot(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  return (
    <figure className={`mxo-spark${accent ? ' acc' : ''}`} data-testid={testId} style={{ margin: 0 }}>
      <figcaption><span className="mx-ey">{label}</span><b>{value}</b></figcaption>
      <div className="mxo-plot" ref={box} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHot(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${empty ? 'no data yet' : data.map((v, i) => `${labels[i]} ${v}`).join(', ')}`}>
          <line className="mxo-ax" x1="0" x2={W} y1={H - B} y2={H - B} />
          <line className="mxo-grid" x1="0" x2={W} y1={T} y2={T} />
          {empty ? (
            <line className="mxo-none" x1="0" x2={W} y1={H - B - 1} y2={H - B - 1} />
          ) : (
            <>
              <path className="mxo-area" d={`${line} L${W} ${H - B} L0 ${H - B} Z`} />
              <path className="mxo-line" d={line} pathLength={1} />
              {hot !== null && <><line className="mxo-cross" x1={px(hot)} x2={px(hot)} y1={T} y2={H - B} /><circle className="mxo-dot" cx={px(hot)} cy={py(data[hot])} r="3.5" /></>}
            </>
          )}
        </svg>
        {hot !== null && !empty && <span className="mxo-tip" style={{ left: `${(px(hot) / W) * 100}%` }}>{labels[hot]}<b>{fmt(data[hot])}{unit}</b></span>}
        {empty && <span className="mxo-nodata">No data yet</span>}
      </div>
      <div className="mxo-xl"><span>{labels[0] ?? ''}</span><span>{labels[n - 1] ?? ''}</span></div>
    </figure>
  );
};

/** Horizontal bars (a ranking). Each row may be pressed. */
export const HBars: React.FC<{ rows: Array<{ label: string; value: number; text?: string; onClick?: () => void; testId?: string }>; empty?: string }> = ({ rows, empty = 'No data yet' }) => {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (rows.length === 0 || max === 0) return <div className="mxo-hb"><div className="mxo-hb-r ghost"><span>{empty}</span><i /></div></div>;
  return (
    <div className="mxo-hb">
      {rows.map((r, i) => {
        const inner = (
          <>
            <span className="l" title={r.label}>{r.label}</span>
            <i><u style={{ transform: `scaleX(${r.value / max})`, animationDelay: `${i * 60}ms` }} /></i>
            <b>{r.text ?? fmt(r.value)}</b>
          </>
        );
        return r.onClick ? <button key={r.label + i} type="button" className="mxo-hb-r" data-testid={r.testId} title={`${r.label}: ${r.text ?? fmt(r.value)}`} onClick={r.onClick}>{inner}</button> : <div key={r.label + i} className="mxo-hb-r" title={`${r.label}: ${r.text ?? fmt(r.value)}`}>{inner}</div>;
      })}
    </div>
  );
};

/** Steps that narrow: each bar is its count against the largest. */
export const Funnel: React.FC<{ steps: Array<{ label: string; value: number }> }> = ({ steps }) => {
  const id = useId();
  const max = Math.max(0, ...steps.map((s) => s.value));
  return (
    <div className="mxo-fn" role="list">
      {steps.map((s, i) => (
        <div key={s.label} className="mxo-fn-r" role="listitem" title={`${s.label}: ${fmt(s.value)}`} aria-describedby={id}>
          <span className="mx-ey">{s.label}</span>
          <i><u style={{ transform: `scaleX(${max ? s.value / max : 0})`, animationDelay: `${i * 90}ms` }} /></i>
          <b>{fmt(s.value)}</b>
        </div>
      ))}
      {max === 0 && <span className="mxo-nodata inline" id={id}>No data yet</span>}
    </div>
  );
};

/** One segmented hairline bar: parts of a whole (order statuses). */
export const Split: React.FC<{ parts: Array<{ label: string; value: number; tone?: 'ink' | 'acc' | 'mut' | 'line' }> }> = ({ parts }) => {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="mxo-sp">
      <div className="mxo-sp-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total === 0 ? <i className="none" /> : parts.filter((p) => p.value > 0).map((p) => <i key={p.label} className={p.tone ?? 'ink'} style={{ flexGrow: p.value }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <div className="mxo-sp-k">{parts.map((p) => <span key={p.label}><s className={p.tone ?? 'ink'} />{p.label} <b>{p.value}</b></span>)}</div>
    </div>
  );
};
