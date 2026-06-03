import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import type { Context } from "@netlify/functions";

// Single JSON document holding everything the host controls for the booking app:
// availability (which dates/times are open), suggested dates, promotional offers,
// and service/add-on prices. Read publicly by the booking app, written only by the host.
const STORE_NAME = "studio";
const SETTINGS_KEY = "settings";

// The single studio host. Only this account may publish availability and price
// changes, even if another Netlify Identity user somehow gets an account. The
// value can be overridden per environment via the HOST_EMAIL variable, but it
// defaults to the studio owner so access is locked down out of the box.
const HOST_EMAIL = (process.env.HOST_EMAIL || "lashesbyangel91@gmail.com")
  .trim()
  .toLowerCase();

function store() {
  // Strong consistency so the host sees their own save immediately and clients
  // never read a stale price or a slot that was just closed.
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

// Defensive normalisation — we accept only the shape the booking app understands,
// so a malformed request can never corrupt what clients see.
function clean(body: any) {
  const out: Record<string, unknown> = {};
  if (body && typeof body.avail === "object" && !Array.isArray(body.avail)) {
    const avail: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(body.avail)) {
      if (Array.isArray(val)) avail[key] = val.filter((t) => typeof t === "string");
    }
    out.avail = avail;
  }
  if (Array.isArray(body?.suggested)) {
    out.suggested = body.suggested.filter((k: unknown) => typeof k === "string");
  }
  if (Array.isArray(body?.promos)) {
    out.promos = body.promos
      .filter((p: any) => p && typeof p === "object")
      .map((p: any) => ({
        id: String(p.id ?? ""),
        title: String(p.title ?? ""),
        detail: String(p.detail ?? ""),
        code: String(p.code ?? ""),
        on: !!p.on,
      }));
  }
  if (body && typeof body.prices === "object" && !Array.isArray(body.prices)) {
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(body.prices)) {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 0) prices[id] = Math.round(n);
    }
    out.prices = prices;
  }
  return out;
}

export default async (req: Request, _context: Context) => {
  const blobs = store();

  if (req.method === "GET") {
    const settings = await blobs.get(SETTINGS_KEY, { type: "json" });
    // null is a valid response — the booking app falls back to its built-in defaults.
    return Response.json(settings ?? null, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (req.method === "POST" || req.method === "PUT") {
    // Only an authenticated host may change availability or prices.
    const user = await getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Being signed in is not enough — the account must be the studio host.
    if ((user.email || "").trim().toLowerCase() !== HOST_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const settings = clean(body);
    await blobs.setJSON(SETTINGS_KEY, settings);
    return Response.json({ ok: true, settings });
  }

  return new Response("Method Not Allowed", { status: 405 });
};

export const config = {
  path: "/api/studio-settings",
};
