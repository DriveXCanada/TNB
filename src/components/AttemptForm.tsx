"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const OUTCOMES: { value: string; label: string; served?: boolean }[] = [
  { value: "PERSONAL", label: "Personal service", served: true },
  { value: "SUBSTITUTED", label: "Substituted (adult at home)", served: true },
  { value: "CORPORATE", label: "Corporate (officer/manager)", served: true },
  { value: "POSTED", label: "Posted / left at door", served: true },
  { value: "NOT_HOME", label: "No answer / not home" },
  { value: "REFUSED", label: "Refused" },
  { value: "BAD_ADDRESS", label: "Bad address" },
  { value: "MOVED", label: "Moved" },
  { value: "EVADING", label: "Evading" },
  { value: "OTHER", label: "Other" },
];

type Gps = { lat: number; lng: number; acc: number } | null;

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

async function resizeImage(file: File, max = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function AttemptForm({
  action,
  addresses,
  recipientType,
  sharingOn,
  province,
}: {
  action: (fd: FormData) => Promise<void>;
  addresses: string[];
  recipientType: string;
  sharingOn: boolean;
  province: string;
}) {
  const ns = province === "Nova Scotia";
  const outcomes = OUTCOMES.map((o) =>
    ns && o.value === "SUBSTITUTED" ? { ...o, label: "Substituted (per court order)" }
    : ns && o.value === "POSTED" ? { ...o, label: "Posted (per court order)" }
    : o
  );
  const [outcome, setOutcome] = useState("");
  const [gps, setGps] = useState<Gps>(null);
  const [gpsMsg, setGpsMsg] = useState("Getting location…");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const served = outcomes.find((o) => o.value === outcome)?.served;

  const locate = () => {
    if (!("geolocation" in navigator)) return setGpsMsg("GPS not available on this device");
    setGpsMsg("Getting location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
        setGpsMsg("");
      },
      (e) => setGpsMsg(e.code === 1 ? "Location permission denied" : "Could not get location"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };
  useEffect(locate, []);

  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const resized = await Promise.all(Array.from(list).map((f) => resizeImage(f)));
    setPhotos((p) => [...p, ...resized]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!outcome) return setError("Choose an outcome.");
    const fd = new FormData(e.currentTarget);
    fd.delete("photos");
    photos.forEach((p) => fd.append("photos", p));
    const local = fd.get("attemptedAtLocal") as string;
    fd.set("attemptedAt", local ? new Date(local).toISOString() : new Date().toISOString());
    if (gps) {
      fd.set("latitude", String(gps.lat));
      fd.set("longitude", String(gps.lng));
      fd.set("gpsAccuracy", String(gps.acc));
    }
    start(async () => {
      try {
        await action(fd);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
        setError(err instanceof Error ? err.message : "Could not save attempt. Check your connection and try again.");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="card space-y-3">
        <div className="label">Outcome *</div>
        <div className="grid grid-cols-2 gap-2">
          {outcomes.map((o) => (
            <button
              type="button"
              key={o.value}
              onClick={() => setOutcome(o.value)}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-medium transition ${
                outcome === o.value
                  ? o.served ? "border-emerald-600 bg-emerald-600 text-white" : "border-amber-500 bg-amber-500 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="outcome" value={outcome} />
      </section>

      <section className="card space-y-3">
        <div>
          <label className="label">Date &amp; time</label>
          <input className="input" type="datetime-local" name="attemptedAtLocal" defaultValue={nowLocal()} />
        </div>
        <div>
          <label className="label">Address attended</label>
          <select className="input" name="address" defaultValue={addresses[0]}>
            {addresses.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
          {gps ? (
            <span>📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} <span className="muted">±{Math.round(gps.acc)} m</span></span>
          ) : (
            <span className="text-slate-600">{gpsMsg}</span>
          )}
          <button type="button" className="text-indigo-700" onClick={locate}>Refresh</button>
        </div>
      </section>

      {served && (
        <section className="card space-y-3">
          <div>
            <label className="label">Name of person served</label>
            <input className="input" name="personServed" placeholder={outcome === "PERSONAL" ? "Recipient's name" : "Name given"} />
          </div>
          {outcome !== "PERSONAL" && (
            <div>
              <label className="label">{outcome === "CORPORATE" || recipientType !== "INDIVIDUAL" ? "Title / position" : "Relationship to recipient"}</label>
              <input className="input" name="relationship" placeholder={outcome === "CORPORATE" ? "Office manager" : "Spouse, adult son…"} />
            </div>
          )}
          <div>
            <label className="label">Physical description</label>
            <input className="input" name="personDescription" placeholder="Male, approx. 45, 5'10&quot;, brown hair, glasses" />
          </div>
          <div>
            <label className="label">How did you know it was the right person?</label>
            <input className="input" name="identifiedBy" list="id-methods" placeholder="Confirmed name when asked" />
            <datalist id="id-methods">
              <option value="The person confirmed their name when I asked" />
              <option value="The person matched a photograph provided by the client" />
              <option value="The person produced photo identification" />
              <option value="The person is known to me" />
              <option value="The person identified themself as an officer of the corporation" />
            </datalist>
          </div>
          {ns && (outcome === "SUBSTITUTED" || outcome === "POSTED") && (
            <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800">
              In Nova Scotia, an originating document must be delivered to an individual personally unless a judge has ordered substituted notice (Rule 31.10). Use this only if there is an order.
            </p>
          )}
        </section>
      )}

      <section className="card space-y-3">
        <div>
          <label className="label">Notes</label>
          <textarea className="input" name="notes" rows={3} placeholder="Car in driveway, lights on, no answer…" />
        </div>
        <div>
          <label className="label">Photos</label>
          <input ref={fileInput} className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(e) => addPhotos(e.target.files)} />
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(p)} alt="" className="h-20 w-20 rounded-md border object-cover" />
                <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-600 text-xs text-white">×</button>
              </div>
            ))}
            <button type="button" className="flex h-20 w-20 items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-2xl text-slate-400" onClick={() => fileInput.current?.click()}>📷</button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="shareWithClient" defaultChecked className="h-5 w-5" />
          Share with client {sharingOn ? "(live tracking)" : "(tracking is off for this job)"}
        </label>
      </section>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button className="btn-primary w-full py-4 text-lg" disabled={pending}>{pending ? "Saving…" : "Save attempt"}</button>
    </form>
  );
}
