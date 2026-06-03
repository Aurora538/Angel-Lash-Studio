/* Angel's Lash Studio — Booking app */

const { useState, useEffect } = React;
const { Eyebrow, PrimaryBtn, GhostBtn, StepDots, ServiceRow, DateChip, TimeChip, Field } = window;

const SERVICES = [
  { id: "cluster", cat: "Full Sets", name: "Cluster", price: "$3,000", val: 3000, blurb: "Pre-made cluster lashes. Quick, full look — great for events." },
  { id: "classic", cat: "Full Sets", name: "Classic", price: "$8,000", val: 8000, blurb: "One extension per lash. Clean, defined." },
  { id: "hybrid", cat: "Full Sets", name: "Hybrid", price: "$9,500", val: 9500, blurb: "Classic + volume. Texture and that wispy edge." },
  { id: "volume", cat: "Full Sets", name: "Volume", price: "$10,500", val: 10500, tag: "Most Loved", blurb: "Lightweight fans, maximum drama." },
  { id: "mega", cat: "Full Sets", name: "Mega Volume", price: "$12,000", val: 12000, blurb: "The boldest set we do. Pure statement." },
  { id: "wet", cat: "Full Sets", name: "Wet Set", price: "$10,000", val: 10000, blurb: "That glossy, spiked, just-done look." },
  { id: "rf-hybrid", cat: "Refills", name: "Hybrid Refill", price: "$8,000", val: 8000, blurb: "Keep your hybrid set full. Within 2–3 weeks." },
  { id: "rf-volume", cat: "Refills", name: "Volume Refill", price: "$9,000", val: 9000, blurb: "Top up your volume fans. Within 3 weeks." },
  { id: "rf-mega", cat: "Refills", name: "Mega Refill", price: "$10,000", val: 10000, blurb: "Maintain maximum density. Within 3 weeks." },
];

const ADDONS = [
  { id: "bottom", name: "Bottom Lashes", price: "$2,000", val: 2000, blurb: "Add definition and depth below." },
  { id: "removal", name: "Lash Removal", price: "$2,000", val: 2000, blurb: "Safe, gentle removal of existing lashes." },
];

const DATES = [
  { key: "11JUN", dow: "WED", num: "11", mo: "JUN" },
  { key: "12JUN", dow: "THU", num: "12", mo: "JUN" },
  { key: "13JUN", dow: "FRI", num: "13", mo: "JUN" },
  { key: "14JUN", dow: "SAT", num: "14", mo: "JUN" },
  { key: "15JUN", dow: "SUN", num: "15", mo: "JUN" },
  { key: "17JUN", dow: "TUE", num: "17", mo: "JUN" },
  { key: "18JUN", dow: "WED", num: "18", mo: "JUN" },
];

const ALL_TIMES = ["10:00", "11:30", "1:00", "2:30", "4:00", "5:30"];

// ---------------------------------------------------------------------------
// Studio settings — availability, suggested dates, offers, and prices.
// The host edits these; the server (Netlify Blobs, behind /api/studio-settings)
// is the source of truth so every visitor sees the host's latest changes.
// localStorage is only a fast on-device cache to avoid a flash on load.
// ---------------------------------------------------------------------------
function defaultAvail() {
  const a = {};
  DATES.forEach((d) => { a[d.key] = d.key === "13JUN" ? [] : ALL_TIMES.slice(); });
  a["11JUN"] = ["10:00", "1:00", "2:30", "5:30"];
  return a;
}
function defaultSuggested() { return ["14JUN"]; }
function defaultPromos() {
  return [
    { id: "p1", title: "20% off your first set", detail: "New clients save on any full set this month.", code: "NEWLASH20", on: true },
    { id: "p2", title: "Free aftercare kit", detail: "Complimentary cleanser + spoolie with any Mega Volume set.", code: "", on: false },
  ];
}
function defaultPrices() {
  const p = {};
  SERVICES.forEach((s) => { p[s.id] = s.val; });
  ADDONS.forEach((a) => { p[a.id] = a.val; });
  return p;
}
function defaultSettings() {
  return { avail: defaultAvail(), suggested: defaultSuggested(), promos: defaultPromos(), prices: defaultPrices() };
}

// Merge whatever the server (or cache) returns onto the built-in defaults, so a
// missing field — or a service added after the host last saved — still works.
function mergeSettings(incoming) {
  const d = defaultSettings();
  if (!incoming || typeof incoming !== "object") return d;
  return {
    avail: { ...d.avail, ...(incoming.avail && typeof incoming.avail === "object" ? incoming.avail : {}) },
    suggested: Array.isArray(incoming.suggested) ? incoming.suggested : d.suggested,
    promos: Array.isArray(incoming.promos) ? incoming.promos : d.promos,
    prices: { ...d.prices, ...(incoming.prices && typeof incoming.prices === "object" ? incoming.prices : {}) },
  };
}

const SETTINGS_KEY = "als_settings_v2";
function loadCachedSettings() {
  try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return mergeSettings(JSON.parse(s)); } catch (e) {}
  return defaultSettings();
}
function cacheSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {} }

const SETTINGS_URL = "/api/studio-settings";

// The studio host. Only this account may open the panel and publish changes;
// the /api/studio-settings function enforces the same check server-side.
const HOST_EMAIL = "lashesbyangel91@gmail.com";
const isHost = (u) => !!u && (u.email || "").trim().toLowerCase() === HOST_EMAIL;

async function fetchSettings() {
  try {
    const r = await fetch(SETTINGS_URL, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}
async function saveSettingsToServer(settings) {
  const r = await fetch(SETTINGS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(settings),
  });
  if (r.status === 401) { const e = new Error("Unauthorized"); e.code = 401; throw e; }
  if (!r.ok) throw new Error("Save failed (" + r.status + ")");
  return r.json();
}

// Resolve the Identity bridge (window.StudioAuth) from booking/index.html. It loads
// as a module and may not be ready the instant the app mounts, so we wait for it.
function getAuth() {
  if (window.StudioAuth) return Promise.resolve(window.StudioAuth);
  return new Promise((resolve) => {
    window.addEventListener("studioauth:ready", () => resolve(window.StudioAuth || null), { once: true });
    setTimeout(() => resolve(window.StudioAuth || null), 4000);
  });
}

// Apply host-set prices onto a service/add-on list for display in the booking flow.
function fmtPrice(val) { return "$" + Number(val || 0).toLocaleString(); }
function applyPrices(list, prices) {
  return list.map((item) => {
    const val = prices && Number.isFinite(prices[item.id]) ? prices[item.id] : item.val;
    return { ...item, val, price: fmtPrice(val) };
  });
}

const TITLES = ["Choose your set", "Pick a date & time", "Your details", "You're booked"];
const BOOKED = { name: "Volume", tag: "Most Loved", date: "FRI 13 JUN", time: "2:30 PM", price: "$10,500", ref: "ALS-4827" };
const STUDIO_EMAIL = "lashesbyangel91@gmail.com";

function emailStudio(subject, lines) {
  const body = lines.join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: `mailto:${STUDIO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    target: "_blank",
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function CancelSheet({ label, when, onConfirm, onClose }) {
  return (
    <div className="bk-sheet-scrim" onClick={onClose}>
      <div className="bk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bk-sheet__grip" />
        <div className="bk-sheet__icon"><i className="ph-light ph-calendar-x"></i></div>
        <h3 className="bk-sheet__title">Cancel this appointment?</h3>
        <p className="bk-sheet__body">{label}{when ? ` on ${when}` : ""}. This frees your slot for someone else.</p>
        <div className="bk-sheet__policy">
          <i className="ph-light ph-info"></i>
          <span>Cancelling more than 48 hrs ahead refunds your deposit in full. Inside 48 hrs the deposit is forfeited.</span>
        </div>
        <div className="bk-sheet__actions">
          <button className="bk-btn bk-btn--danger" onClick={onConfirm}>Yes, cancel appointment</button>
          <button className="bk-btn bk-btn--text" onClick={onClose}>Keep my appointment</button>
        </div>
      </div>
    </div>
  );
}

function BookingApp({ onManage, onHost, prefill, services, addons, avail, suggested, promos }) {
  const isReschedule = !!prefill;
  const [step, setStep] = useState(prefill ? 1 : 0);
  const [serviceId, setServiceId] = useState(prefill ? prefill.serviceId : null);
  const [addonIds, setAddonIds] = useState([]);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const svc = services.find((s) => s.id === serviceId);
  const toggleAddon = (id) => setAddonIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const addonTotal = addonIds.reduce((sum, id) => { const a = addons.find((a) => a.id === id); return sum + (a ? a.val : 0); }, 0);
  const totalVal = (svc ? svc.val : 0) + addonTotal;
  const totalStr = totalVal > 0 ? "$" + totalVal.toLocaleString() : "";
  const dateKey = date != null ? DATES[date].key : null;
  const timesForDate = dateKey && avail ? (avail[dateKey] || []) : [];
  const canNext = [serviceId, date != null && time != null, name.trim().length > 1, true][step];

  const pickDate = (i) => {
    setDate(i);
    const slots = (avail && avail[DATES[i].key]) || [];
    setTime((t) => (t != null && slots.includes(t) ? t : null));
  };

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const reset = () => { setStep(0); setServiceId(null); setAddonIds([]); setDate(null); setTime(null); setName(""); setPhone(""); setShowCancel(false); setCancelled(false); };
  const whenStr = () => (date != null ? `${DATES[date].dow} ${DATES[date].num} ${DATES[date].mo}` : "") + (time != null ? ` at ${time}` : "");

  const confirmBooking = () => {
    emailStudio(
      `${isReschedule ? "Reschedule" : "Booking"} request · ${svc ? svc.name : ""} — ${name}`,
      [
        `${isReschedule ? "RESCHEDULE" : "NEW BOOKING"} request via angelslashstudio`,
        "",
        `Service:  ${svc ? `${svc.name} (${svc.price})` : ""}`,
        ...addonIds.map((id) => { const a = addons.find((a) => a.id === id); return a ? `Add-on:   ${a.name} (${a.price})` : null; }).filter(Boolean),
        `Total:    ${totalStr}`,
        `Date:     ${date != null ? `${DATES[date].dow} ${DATES[date].num} ${DATES[date].mo}` : ""}`,
        `Time:     ${time || ""}`,
        `Name:     ${name}`,
        `Phone:    ${phone || "—"}`,
        "",
        isReschedule ? "Note: rescheduling — deposit carries over." : "A deposit secures this appointment.",
      ]
    );
    next();
  };

  const confirmCancel = () => {
    emailStudio(`Cancellation · ${svc ? svc.name : "appointment"} — ${name}`, [
      "CANCELLATION request",
      "",
      `Service:  ${svc ? svc.name : ""}`,
      `Date:     ${whenStr()}`,
      `Name:     ${name}`,
      `Phone:    ${phone || "—"}`,
    ]);
    setShowCancel(false);
    setCancelled(true);
  };

  const cats = [...new Set(services.map((s) => s.cat))];

  return (
    <div className="phone">
      <div className="bk-status" aria-hidden="true">
        <span>9:41</span>
        <span className="bk-status__r"><i className="ph-light ph-wifi-high"></i><i className="ph-light ph-battery-high"></i></span>
      </div>

      <div className="bk-appbar">
        {step > 0 && step < 3
          ? <button className="bk-back" onClick={back} aria-label="Go back"><i className="ph-light ph-arrow-left"></i></button>
          : <img className="bk-logo" src="../assets/logo-mark-violet.svg" alt="Angel's Lash Studio" />}
        <div className="bk-appbar__title">{step < 3 ? "Book" : ""}</div>
        {step === 0 && onHost
          ? <button className="bk-host-btn" onClick={onHost} aria-label="Studio access"><i className="ph-light ph-lock-simple"></i></button>
          : <div className="bk-appbar__spacer" />}
      </div>

      {step < 3 && (
        <div className="bk-head">
          {isReschedule && (
            <span className="bk-status-pill bk-status-pill--resched"><i className="ph-light ph-arrows-clockwise"></i> Rescheduling{svc ? ` · ${svc.name}` : ""}</span>
          )}
          <StepDots step={step} total={3} />
          <h2 className="bk-h2">{TITLES[step]}</h2>
        </div>
      )}

      <div className="bk-screen">
        {step === 0 && (
          <div className="bk-list">
            {(promos || []).filter((p) => p.on).map((p) => (
              <div className="bk-promo" key={p.id}>
                <div className="bk-promo__tag"><i className="ph-light ph-seal-percent"></i> Offer</div>
                <div className="bk-promo__main">
                  <div className="bk-promo__title">{p.title}</div>
                  {p.detail && <div className="bk-promo__detail">{p.detail}</div>}
                </div>
              </div>
            ))}
            <button className="bk-manage-entry" onClick={onManage}>
              <i className="ph-light ph-calendar-check lead"></i>
              <div className="m"><b>Already have an appointment?</b><span>Look it up to reschedule or cancel</span></div>
              <i className="ph-light ph-arrow-right go"></i>
            </button>
            {cats.map((cat) => (
              <div key={cat}>
                <Eyebrow>{cat}</Eyebrow>
                {services.filter((s) => s.cat === cat).map((s) => (
                  <ServiceRow key={s.id} svc={s} selected={serviceId === s.id} onSelect={() => setServiceId(s.id)} />
                ))}
              </div>
            ))}
            <Eyebrow>Add-ons <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></Eyebrow>
            {addons.map((a) => (
              <ServiceRow key={a.id} svc={a} selected={addonIds.includes(a.id)} onSelect={() => toggleAddon(a.id)} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="bk-dt">
            <Eyebrow>June 2026</Eyebrow>
            <div className="bk-dates">
              {DATES.map((d, i) => {
                const closed = !avail || (avail[d.key] || []).length === 0;
                const isSuggested = !closed && (suggested || []).includes(d.key);
                return <DateChip key={d.key} d={{ ...d, soldOut: closed, suggested: isSuggested }} selected={date === i} onSelect={() => pickDate(i)} />;
              })}
            </div>
            {(suggested || []).some((k) => avail && (avail[k] || []).length) && (
              <div className="bk-legend"><i className="ph-light ph-star-fill"></i> Angel's picks — best availability</div>
            )}
            <div style={{ height: 22 }} />
            <Eyebrow>Available times</Eyebrow>
            {date == null ? (
              <p className="bk-dt__hint">Choose a date above to see open times.</p>
            ) : timesForDate.length === 0 ? (
              <p className="bk-dt__hint">No times left on this date — try another.</p>
            ) : (
              <div className="bk-times">
                {ALL_TIMES.map((label) => (
                  <TimeChip key={label} t={{ label, taken: !timesForDate.includes(label) }} selected={time === label} onSelect={() => setTime(label)} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="bk-form">
            <Field icon="user" label="Full name" value={name} placeholder="Your name" onChange={setName} />
            <Field icon="phone" label="Phone" value={phone} placeholder="Add your number" onChange={setPhone} type="tel" />
            <div className="bk-policy">
              <i className="ph-light ph-info"></i>
              <span>{isReschedule
                ? "Your deposit carries over — no new charge to move your date. Free to reschedule up to 48 hrs before."
                : "A deposit holds your slot and goes toward your total. Free to reschedule up to 48 hrs before."}</span>
            </div>
          </div>
        )}

        {step === 3 && !cancelled && (
          <div className="bk-confirm">
            <div className="bk-confirm__badge"><i className={"ph-light " + (isReschedule ? "ph-arrows-clockwise" : "ph-check")}></i></div>
            <h2 className="bk-h2" style={{ textAlign: "center" }}>{isReschedule ? "You're rescheduled." : "You're booked."}</h2>
            <p className="bk-confirm__sub">We've opened an email to the studio with your details — just hit send and we'll confirm your slot shortly.</p>
            <div className="bk-receipt">
              <div className="bk-receipt__row"><span>Service</span><b>{svc ? svc.name : ""}</b></div>
              {addonIds.map((id) => { const a = addons.find((a) => a.id === id); return a ? <div key={id} className="bk-receipt__row"><span>Add-on</span><b>{a.name}</b></div> : null; })}
              <div className="bk-receipt__row"><span>When</span><b>{date != null ? `${DATES[date].dow} ${DATES[date].num} ${DATES[date].mo}` : ""} · {time || ""}</b></div>
              <div className="bk-receipt__row"><span>Name</span><b>{name || "—"}</b></div>
              <div className="bk-receipt__row bk-receipt__total"><span>Total</span><b>{totalStr || (svc ? svc.price : "")}</b></div>
            </div>
            <button className="bk-cancel-link" onClick={() => setShowCancel(true)}>
              <i className="ph-light ph-calendar-x"></i> Cancel appointment
            </button>
          </div>
        )}

        {step === 3 && cancelled && (
          <div className="bk-confirm">
            <div className="bk-confirm__badge bk-confirm__badge--cancel"><i className="ph-light ph-x"></i></div>
            <h2 className="bk-h2" style={{ textAlign: "center" }}>Appointment cancelled.</h2>
            <p className="bk-confirm__sub">Your slot has been released. We hope to see you again soon.</p>
            <div className="bk-receipt">
              <div className="bk-receipt__row"><span>Was</span><b>{svc ? svc.name : ""} · {date != null ? `${DATES[date].dow} ${DATES[date].num} ${DATES[date].mo}` : ""}</b></div>
              <div className="bk-receipt__row"><span>Deposit</span><b>Refunded to original method</b></div>
            </div>
          </div>
        )}
      </div>

      {showCancel && (
        <CancelSheet
          label={svc ? svc.name : "Your set"}
          when={whenStr()}
          onConfirm={confirmCancel}
          onClose={() => setShowCancel(false)}
        />
      )}

      <div className="bk-bottom">
        {step < 3 ? (
          <>
            <div className="bk-summary">
              {svc
                ? <><span className="bk-summary__svc">{svc.name}{addonIds.length ? ` + ${addonIds.length} add-on${addonIds.length > 1 ? "s" : ""}` : ""}</span><span className="bk-summary__price">{totalStr}</span></>
                : <span className="bk-summary__hint">Select a service to start</span>}
            </div>
            <PrimaryBtn onClick={step === 2 ? confirmBooking : next} disabled={!canNext}>
              {step === 2 ? (isReschedule ? "Confirm reschedule" : "Confirm booking") : "Continue"} <i className="ph-light ph-arrow-right"></i>
            </PrimaryBtn>
          </>
        ) : (
          <GhostBtn onClick={reset}>{isReschedule ? "Done" : "Book another set"}</GhostBtn>
        )}
      </div>
    </div>
  );
}

function ManageBooking({ onBook, onReschedule }) {
  const [view, setView] = useState("lookup");
  const [phone, setPhone] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const canFind = phone.trim().replace(/\D/g, "").length >= 4;

  return (
    <div className="phone">
      <div className="bk-status" aria-hidden="true">
        <span>9:41</span>
        <span className="bk-status__r"><i className="ph-light ph-wifi-high"></i><i className="ph-light ph-battery-high"></i></span>
      </div>
      <div className="bk-appbar">
        {view === "detail"
          ? <button className="bk-back" onClick={() => setView("lookup")} aria-label="Back"><i className="ph-light ph-arrow-left"></i></button>
          : <button className="bk-back" onClick={onBook} aria-label="Back to booking"><i className="ph-light ph-arrow-left"></i></button>}
        <div className="bk-appbar__title">Manage</div>
        <div className="bk-appbar__spacer" />
      </div>
      {view !== "cancelled" && (
        <div className="bk-head">
          <h2 className="bk-h2">{view === "lookup" ? "Find your appointment" : "Your appointment"}</h2>
        </div>
      )}
      <div className="bk-screen">
        {view === "lookup" && (
          <div className="bk-form">
            <p className="bk-confirm__sub" style={{ textAlign: "left", margin: "4px 0 22px", maxWidth: "none" }}>
              Enter the phone number on your booking and we'll pull it up.
            </p>
            <Field icon="phone" label="Phone number" value={phone} placeholder="Your number" onChange={setPhone} type="tel" />
            <div className="bk-policy">
              <i className="ph-light ph-info"></i>
              <span>Need help? Email <b>lashesbyangel91@gmail.com</b> or DM <b>@angels.lash.studio</b></span>
            </div>
          </div>
        )}
        {view === "detail" && (
          <div>
            <span className="bk-status-pill"><i className="ph-light ph-check-circle"></i> Confirmed</span>
            <div className="bk-appt">
              <div className="bk-appt__top">
                <div className="bk-appt__name">{BOOKED.name}{BOOKED.tag && <span className="bk-svc__tag">{BOOKED.tag}</span>}</div>
                <div className="bk-appt__price">{BOOKED.price}</div>
              </div>
              <div className="bk-appt__rows">
                <div className="bk-appt__row"><i className="ph-light ph-calendar-dot"></i> Date <span>{BOOKED.date}</span></div>
                <div className="bk-appt__row"><i className="ph-light ph-clock"></i> Time <span>{BOOKED.time}</span></div>
                <div className="bk-appt__row"><i className="ph-light ph-map-pin"></i> Studio <span>Angel's · Suite 4</span></div>
                <div className="bk-appt__row"><i className="ph-light ph-hash"></i> Ref <span>{BOOKED.ref}</span></div>
              </div>
            </div>
            <div className="bk-policy" style={{ marginTop: 14 }}>
              <i className="ph-light ph-info"></i>
              <span>Free to reschedule or cancel up to 48 hrs before. Your deposit carries over to a new date.</span>
            </div>
            <div className="bk-detail-actions">
              <GhostBtn onClick={onReschedule}>Reschedule</GhostBtn>
              <button className="bk-btn bk-btn--outline-danger" onClick={() => setShowCancel(true)}>Cancel appointment</button>
            </div>
          </div>
        )}
        {view === "cancelled" && (
          <div className="bk-confirm">
            <div className="bk-confirm__badge bk-confirm__badge--cancel"><i className="ph-light ph-x"></i></div>
            <h2 className="bk-h2" style={{ textAlign: "center" }}>Appointment cancelled.</h2>
            <p className="bk-confirm__sub">Your {BOOKED.date} slot has been released. We hope to see you again soon.</p>
            <div className="bk-receipt">
              <div className="bk-receipt__row"><span>Was</span><b>{BOOKED.name} · {BOOKED.date}</b></div>
              <div className="bk-receipt__row"><span>Ref</span><b>{BOOKED.ref}</b></div>
              <div className="bk-receipt__row"><span>Deposit</span><b>Refunded to original method</b></div>
            </div>
          </div>
        )}
      </div>
      {showCancel && (
        <CancelSheet
          label={BOOKED.name}
          when={`${BOOKED.date} at ${BOOKED.time}`}
          onConfirm={() => {
            emailStudio(`Cancellation · ${BOOKED.name} (${BOOKED.ref})`, [
              "CANCELLATION request",
              "",
              `Service:  ${BOOKED.name}`,
              `Date:     ${BOOKED.date} at ${BOOKED.time}`,
              `Ref:      ${BOOKED.ref}`,
              `Phone:    ${phone || "—"}`,
            ]);
            setShowCancel(false);
            setView("cancelled");
          }}
          onClose={() => setShowCancel(false)}
        />
      )}
      <div className="bk-bottom">
        {view === "lookup" && (
          <PrimaryBtn onClick={() => setView("detail")} disabled={!canFind} style={{ flex: 1 }}>
            Find my appointment <i className="ph-light ph-arrow-right"></i>
          </PrimaryBtn>
        )}
        {view === "detail" && <GhostBtn onClick={onBook}>Back to booking</GhostBtn>}
        {view === "cancelled" && <GhostBtn onClick={onBook}>Book a new set</GhostBtn>}
      </div>
    </div>
  );
}

function HostAvailability({ settings, onChange, user, onLogout, onDone }) {
  const { avail, suggested, promos, prices } = settings;
  const [tab, setTab] = useState("dates");
  const [openKey, setOpenKey] = useState(DATES[0].key);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const setAvail = (a) => onChange({ avail: a });
  const setSuggested = (s) => onChange({ suggested: s });
  const setPromos = (p) => onChange({ promos: p });
  const setPrices = (p) => onChange({ prices: p });

  const toggleTime = (key, label) => {
    const cur = avail[key] || [];
    const list = cur.includes(label)
      ? cur.filter((t) => t !== label)
      : [...cur, label].sort((a, b) => ALL_TIMES.indexOf(a) - ALL_TIMES.indexOf(b));
    setAvail({ ...avail, [key]: list });
  };
  const setAll = (key, on) => setAvail({ ...avail, [key]: on ? ALL_TIMES.slice() : [] });
  const toggleSuggest = (key) => setSuggested(suggested.includes(key) ? suggested.filter((k) => k !== key) : [...suggested, key]);
  const daysOpen = DATES.reduce((n, d) => n + ((avail[d.key] || []).length > 0 ? 1 : 0), 0);
  const setPromo = (id, patch) => setPromos(promos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const addPromo = () => setPromos([...promos, { id: "p" + Date.now(), title: "", detail: "", code: "", on: true }]);
  const delPromo = (id) => setPromos(promos.filter((p) => p.id !== id));
  const livePromos = promos.filter((p) => p.on).length;

  const priceOf = (id, fallback) => (Number.isFinite(prices[id]) ? prices[id] : fallback);
  const setPrice = (id, raw) => {
    const digits = String(raw).replace(/[^\d]/g, "");
    setPrices({ ...prices, [id]: digits === "" ? 0 : parseInt(digits, 10) });
  };
  const priceCats = [...new Set(SERVICES.map((s) => s.cat))];

  const save = async () => {
    setSaveErr("");
    setSaving(true);
    try {
      await saveSettingsToServer(settings);
      onDone();
    } catch (e) {
      setSaveErr(e && e.code === 401
        ? "Your session expired — sign out and back in, then save again."
        : "Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div className="phone">
      <div className="bk-status" aria-hidden="true">
        <span>9:41</span>
        <span className="bk-status__r"><i className="ph-light ph-wifi-high"></i><i className="ph-light ph-battery-high"></i></span>
      </div>
      <div className="bk-appbar">
        <button className="bk-back" onClick={onDone} aria-label="Done"><i className="ph-light ph-arrow-left"></i></button>
        <div className="bk-appbar__title">Studio</div>
        <button className="bk-host-btn" onClick={onLogout} aria-label="Sign out"><i className="ph-light ph-sign-out"></i></button>
      </div>
      <div className="bk-head">
        <span className="bk-status-pill bk-status-pill--resched"><i className="ph-light ph-lock-simple-open"></i> Host{user && user.email ? ` · ${user.email}` : ""}</span>
        <h2 className="bk-h2">{tab === "dates" ? "Set your availability" : tab === "prices" ? "Service prices" : "Promotional offers"}</h2>
        <div className="hv-tabs">
          <button className={"hv-tab" + (tab === "dates" ? " on" : "")} onClick={() => setTab("dates")}>Dates</button>
          <button className={"hv-tab" + (tab === "prices" ? " on" : "")} onClick={() => setTab("prices")}>Prices</button>
          <button className={"hv-tab" + (tab === "offers" ? " on" : "")} onClick={() => setTab("offers")}>Offers</button>
        </div>
      </div>
      <div className="bk-screen">
        {tab === "dates" && (
          <>
            <p className="bk-dt__hint" style={{ marginTop: 2 }}>
              Tap a date to open it, then choose the times you're taking clients. Star a date to make it a suggested pick.
            </p>
            <div className="hv-summary"><i className="ph-light ph-calendar-check"></i> {daysOpen} of {DATES.length} days open</div>
            {DATES.map((d) => {
              const list = avail[d.key] || [];
              const isOpen = openKey === d.key;
              const sug = suggested.includes(d.key);
              return (
                <div className={"hv-day" + (list.length ? "" : " closed")} key={d.key}>
                  <button className="hv-day__head" onClick={() => setOpenKey(isOpen ? null : d.key)}>
                    <span className="hv-day__date">{sug && <i className="ph-fill ph-star hv-day__star"></i>}<b>{d.dow}</b> {d.num} {d.mo}</span>
                    <span className="hv-day__meta">
                      <span className={"hv-pill" + (list.length ? " on" : "")}>{list.length ? `${list.length} slot${list.length > 1 ? "s" : ""}` : "Closed"}</span>
                      <i className={"ph-light ph-caret-" + (isOpen ? "up" : "down")}></i>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="hv-day__body">
                      <div className="hv-times">
                        {ALL_TIMES.map((label) => (
                          <button key={label} className={"hv-time" + (list.includes(label) ? " on" : "")} onClick={() => toggleTime(d.key, label)}>
                            {list.includes(label) && <i className="ph-light ph-check"></i>}{label}
                          </button>
                        ))}
                      </div>
                      <div className="hv-quick">
                        <button onClick={() => setAll(d.key, true)}>Open all</button>
                        <button onClick={() => setAll(d.key, false)}>Close day</button>
                        <button className={sug ? "on" : ""} disabled={!list.length} onClick={() => toggleSuggest(d.key)}>
                          <i className={(sug ? "ph-fill" : "ph-light") + " ph-star"}></i> {sug ? "Suggested" : "Suggest"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
        {tab === "prices" && (
          <>
            <p className="bk-dt__hint" style={{ marginTop: 2 }}>
              Set what you charge for each service. New prices show on the booking screen as soon as you save.
            </p>
            {priceCats.map((cat) => (
              <div key={cat}>
                <Eyebrow>{cat}</Eyebrow>
                {SERVICES.filter((s) => s.cat === cat).map((s) => (
                  <div className="hv-price" key={s.id}>
                    <span className="hv-price__name">{s.name}</span>
                    <span className="hv-price__field">
                      <span className="hv-price__cur">$</span>
                      <input className="hv-price__input" inputMode="numeric" aria-label={`Price for ${s.name}`}
                        value={priceOf(s.id, s.val).toLocaleString()}
                        onChange={(e) => setPrice(s.id, e.target.value)} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <Eyebrow>Add-ons</Eyebrow>
            {ADDONS.map((a) => (
              <div className="hv-price" key={a.id}>
                <span className="hv-price__name">{a.name}</span>
                <span className="hv-price__field">
                  <span className="hv-price__cur">$</span>
                  <input className="hv-price__input" inputMode="numeric" aria-label={`Price for ${a.name}`}
                    value={priceOf(a.id, a.val).toLocaleString()}
                    onChange={(e) => setPrice(a.id, e.target.value)} />
                </span>
              </div>
            ))}
          </>
        )}
        {tab === "offers" && (
          <>
            <p className="bk-dt__hint" style={{ marginTop: 2 }}>
              Toggle an offer on to show it at the top of the booking screen. {livePromos} live now.
            </p>
            {promos.map((p) => (
              <div className={"hv-promo" + (p.on ? " on" : "")} key={p.id}>
                <div className="hv-promo__top">
                  <button className={"hv-switch" + (p.on ? " on" : "")} onClick={() => setPromo(p.id, { on: !p.on })} aria-label="Toggle offer">
                    <span className="hv-switch__dot" />
                  </button>
                  <span className="hv-promo__state">{p.on ? "Live" : "Off"}</span>
                  <button className="hv-promo__del" onClick={() => delPromo(p.id)} aria-label="Delete offer"><i className="ph-light ph-trash"></i></button>
                </div>
                <input className="hv-input hv-input--title" value={p.title} placeholder="Offer title"
                  onChange={(e) => setPromo(p.id, { title: e.target.value })} />
                <input className="hv-input" value={p.detail} placeholder="Short detail (optional)"
                  onChange={(e) => setPromo(p.id, { detail: e.target.value })} />
              </div>
            ))}
            <button className="hv-add" onClick={addPromo}><i className="ph-light ph-plus"></i> Add an offer</button>
          </>
        )}
      </div>
      <div className="bk-bottom" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        {saveErr && <div className="hv-error" style={{ marginTop: 0 }}><i className="ph-light ph-warning-circle"></i> {saveErr}</div>}
        <PrimaryBtn onClick={save} disabled={saving} style={{ width: "100%" }}>
          {saving ? "Saving…" : <>Save &amp; publish <i className="ph-light ph-arrow-right"></i></>}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// Phone-frame wrapper used by the host sign-in / loading screens.
function HostShell({ title, onBack, children }) {
  return (
    <div className="phone">
      <div className="bk-status" aria-hidden="true">
        <span>9:41</span>
        <span className="bk-status__r"><i className="ph-light ph-wifi-high"></i><i className="ph-light ph-battery-high"></i></span>
      </div>
      <div className="bk-appbar">
        {onBack
          ? <button className="bk-back" onClick={onBack} aria-label="Back"><i className="ph-light ph-arrow-left"></i></button>
          : <div className="bk-appbar__spacer" />}
        <div className="bk-appbar__title">{title}</div>
        <div className="bk-appbar__spacer" />
      </div>
      {children}
    </div>
  );
}

// Gates the studio panel behind Netlify Identity. Only a signed-in host gets in;
// the matching server function rejects any save that isn't from a signed-in host.
function HostGate({ settings, onChange, onExit }) {
  const [phase, setPhase] = useState("checking"); // checking | login | panel
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    getAuth().then((auth) => {
      if (!live) return;
      if (!auth) { setErr("Sign-in is unavailable right now. Please try again shortly."); setPhase("login"); return; }
      auth.getUser().then((u) => {
        if (!live) return;
        if (isHost(u)) { setUser(u); setPhase("panel"); }
        else if (u) {
          // Signed in, but not the host account — sign out and explain.
          auth.logout().catch(() => {});
          setErr("That account isn't the studio host.");
          setPhase("login");
        } else setPhase("login");
      }).catch(() => { if (live) setPhase("login"); });
    });
    return () => { live = false; };
  }, []);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const auth = await getAuth();
      if (!auth) throw new Error("unavailable");
      const u = await auth.login(email.trim(), password);
      if (!isHost(u)) {
        await auth.logout().catch(() => {});
        setErr("That account isn't the studio host.");
        return;
      }
      setUser(u);
      setPassword("");
      setPhase("panel");
    } catch (e) {
      const status = e && e.status;
      setErr(status === 401 ? "Wrong email or password."
        : status === 403 ? "This studio is invite-only. Ask Angel for access."
        : "Couldn't sign you in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try { const auth = await getAuth(); if (auth) await auth.logout(); } catch (e) {}
    setUser(null);
    setPassword("");
    setPhase("login");
  };

  if (phase === "checking") {
    return <HostShell title="Studio" onBack={onExit}><div className="hv-checking"><i className="ph-light ph-circle-notch"></i> Checking access…</div></HostShell>;
  }

  if (phase === "login") {
    return (
      <HostShell title="Studio" onBack={onExit}>
        <div className="bk-head">
          <span className="bk-status-pill"><i className="ph-light ph-lock-simple"></i> Host access</span>
          <h2 className="bk-h2">Studio sign-in</h2>
        </div>
        <div className="bk-screen">
          <div className="bk-form">
            <p className="bk-dt__hint" style={{ marginTop: 2, marginBottom: 18 }}>
              Only the studio host can change availability and prices. Sign in to continue.
            </p>
            <Field icon="envelope-simple" label="Email" value={email} placeholder="you@studio.com" onChange={setEmail} type="email" />
            <Field icon="lock-simple" label="Password" value={password} placeholder="Your password" onChange={setPassword} type="password" />
            {err && <div className="hv-error"><i className="ph-light ph-warning-circle"></i> {err}</div>}
          </div>
        </div>
        <div className="bk-bottom">
          <PrimaryBtn onClick={submit} disabled={busy || email.trim().length < 3 || password.length < 1} style={{ flex: 1 }}>
            {busy ? "Signing in…" : <>Sign in <i className="ph-light ph-arrow-right"></i></>}
          </PrimaryBtn>
        </div>
      </HostShell>
    );
  }

  return <HostAvailability settings={settings} onChange={onChange} user={user} onLogout={logout} onDone={onExit} />;
}

function Root() {
  const hash = typeof location !== "undefined" ? location.hash.toLowerCase() : "";
  const [mode, setMode] = useState(hash === "#manage" ? "manage" : hash === "#host" ? "host" : "book");
  const [prefill, setPrefill] = useState(null);
  const [settings, setSettings] = useState(loadCachedSettings);

  // The server (Netlify Blobs) is authoritative — refresh from it on load so every
  // visitor sees the host's latest availability and prices, not just cached defaults.
  useEffect(() => {
    let live = true;
    fetchSettings().then((s) => {
      if (!live || s == null) return;
      const merged = mergeSettings(s);
      setSettings(merged);
      cacheSettings(merged);
    });
    return () => { live = false; };
  }, []);

  // Host edits update local state immediately (and the on-device cache); they are
  // pushed to the server only when the host hits Save & publish.
  const patchSettings = (patch) => setSettings((cur) => {
    const next = { ...cur, ...patch };
    cacheSettings(next);
    return next;
  });

  const services = applyPrices(SERVICES, settings.prices);
  const addons = applyPrices(ADDONS, settings.prices);

  if (mode === "host") return (
    <HostGate settings={settings} onChange={patchSettings} onExit={() => setMode("book")} />
  );
  return mode === "book"
    ? <BookingApp
        key={prefill ? "resched" : "fresh"}
        prefill={prefill} services={services} addons={addons}
        avail={settings.avail} suggested={settings.suggested} promos={settings.promos}
        onManage={() => { setPrefill(null); setMode("manage"); }}
        onHost={() => setMode("host")} />
    : <ManageBooking
        onBook={() => { setPrefill(null); setMode("book"); }}
        onReschedule={() => { setPrefill({ serviceId: "volume" }); setMode("book"); }}
      />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
