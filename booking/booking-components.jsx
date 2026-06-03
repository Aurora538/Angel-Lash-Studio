/* Angel's Lash Studio — Booking app · shared atoms */

const { useState } = React;

function Eyebrow({ children }) {
  return <div className="bk-eb">{children}</div>;
}

function PrimaryBtn({ children, onClick, disabled, style }) {
  return (
    <button className="bk-btn bk-btn--primary" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }) {
  return <button className="bk-btn bk-btn--ghost" onClick={onClick}>{children}</button>;
}

function StepDots({ step, total }) {
  return (
    <div className="bk-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={"bk-dot" + (i <= step ? " on" : "")} />
      ))}
    </div>
  );
}

function ServiceRow({ svc, selected, onSelect }) {
  return (
    <button className={"bk-svc" + (selected ? " sel" : "")} onClick={onSelect}>
      <div className="bk-svc__main">
        <div className="bk-svc__name">{svc.name}{svc.tag && <span className="bk-svc__tag">{svc.tag}</span>}</div>
        <div className="bk-svc__blurb">{svc.blurb}</div>
      </div>
      <div className="bk-svc__right">
        <div className="bk-svc__price">{svc.price}</div>
        <span className={"bk-radio" + (selected ? " on" : "")}>
          {selected && <i className="ph-light ph-check"></i>}
        </span>
      </div>
    </button>
  );
}

function DateChip({ d, selected, onSelect }) {
  return (
    <button
      className={"bk-date" + (selected ? " sel" : "") + (d.soldOut ? " out" : "") + (d.suggested ? " sug" : "")}
      onClick={() => !d.soldOut && onSelect()}
      disabled={d.soldOut}
    >
      {d.suggested && <i className="ph-fill ph-star bk-date__star"></i>}
      <span className="bk-date__dow">{d.dow}</span>
      <span className="bk-date__num">{d.num}</span>
      <span className="bk-date__mo">{d.mo}</span>
    </button>
  );
}

function TimeChip({ t, selected, onSelect }) {
  return (
    <button
      className={"bk-time" + (selected ? " sel" : "") + (t.taken ? " out" : "")}
      onClick={() => !t.taken && onSelect()}
      disabled={t.taken}
    >
      {t.label}
    </button>
  );
}

function Field({ icon, label, value, placeholder, onChange, type }) {
  return (
    <label className="bk-field-wrap">
      <span className="bk-field-label">{label}</span>
      <span className="bk-field">
        {icon && <i className={"ph-light ph-" + icon}></i>}
        <input
          type={type || "text"}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={type === "tel" ? "tel" : type === "email" ? "email" : "off"}
        />
      </span>
    </label>
  );
}

Object.assign(window, { Eyebrow, PrimaryBtn, GhostBtn, StepDots, ServiceRow, DateChip, TimeChip, Field });
