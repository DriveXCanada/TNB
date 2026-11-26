"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import EmailShare from "./EmailShare";
import type { Recipient } from "@/lib/recipients";

const SERVICE_TYPES = [
  { value: "PERSONAL", label: "Personal Service" },
  { value: "UNSUCCESSFUL", label: "Unsuccessful" },
  { value: "BAD_ADDRESS", label: "Bad Address" },
];

const DESCRIPTIONS: Record<string, string[]> = {
  PERSONAL: [
    "Served the recipient personally",
    "Recipient confirmed identity and accepted the documents",
    "Recipient refused to take the documents; left them in their presence",
  ],
  UNSUCCESSFUL: [
    "No answer at the door",
    "No answer – lights on inside",
    "No answer – vehicle in driveway",
    "Occupant states recipient is not home",
    "Occupant would not say when recipient will be home",
    "Gated / no access to the residence",
    "Left a card in the door",
  ],
  BAD_ADDRESS: [
    "Recipient unknown at this address",
    "Current occupant states recipient moved",
    "Residence is vacant",
    "Address does not exist",
    "Business closed / no longer at this location",
  ],
};

export type AttemptDefaults = {
  outcome: string;
  attemptedAt: string; // ISO
  address: string;
  serverId: string;
  personServed: string;
  personDescription: string;
  identifiedBy: string;
  notes: string;
  shareWithClient: boolean;
};

type Gps = { lat: number; lng: number; acc: number } | null;

function toLocalInput(d: Date) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:items-start sm:gap-4">
      <div className="pt-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function AttemptForm({
  action,
  addresses,
  recipients,
  mailOn,
  returnTo,
  servers,
  currentUserId,
  canChooseServer,
  sharingOn,
  canEmail = true,
  defaults,
}: {
  action: (fd: FormData) => Promise<void>;
  addresses: string[];
  recipients: Recipient[];
  mailOn: boolean;
  returnTo: string;
  servers: { id: string; name: string }[];
  currentUserId: string;
  canChooseServer: boolean;
  sharingOn: boolean;
  canEmail?: boolean;
  defaults?: AttemptDefaults;
}) {
  const editing = Boolean(defaults);
  const addrList = defaults && !addresses.includes(defaults.address) ? [defaults.address, ...addresses] : addresses;
  const typeKnown = SERVICE_TYPES.some((t) => t.value === defaults?.outcome);
  const [outcome, setOutcome] = useState(defaults?.outcome ?? "");
  const [addr, setAddr] = useState(defaults?.address ?? addrList[0]);
  const [notes, setNotes] = useState(defaults?.notes ?? "");
  const [desc, setDesc] = useState("");
  const [gps, setGps] = useState<Gps>(null);
  const [useGps, setUseGps] = useState(!editing);
  const [gpsMsg, setGpsMsg] = useState(editing ? "" : "Getting location…");
  const [photos, setPhotos] = useState<File[]>([]);
  const previews = useMemo(() => photos.map((p) => URL.createObjectURL(p)), [photos]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const d = (k: keyof AttemptDefaults) => (defaults ? String(defaults[k] ?? "") : "");

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
  useEffect(() => {
    if (!editing) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addDescription = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setNotes((n) => (n.trim() ? `${n.trim()}\n${t}` : t));
    setDesc("");
  };

  const addPhotos = async (list: FileList | null) => {
    if (!list) return;
    const resized = await Promise.all(Array.from(list).map((f) => resizeImage(f)));
    setPhotos((p) => [...p, ...resized]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!outcome) return setError("Choose a service type.");
    const fd = new FormData(e.currentTarget);
    if (fd.get("address") === "__new" && !String(fd.get("newAddress") ?? "").trim()) return setError("Enter the new address.");
    if (desc.trim()) fd.set("notes", notes.trim() ? `${notes.trim()}\n${desc.trim()}` : desc.trim());
    fd.delete("photos");
    photos.forEach((p) => fd.append("photos", p));
    const local = fd.get("attemptedAtLocal") as string;
    fd.set("attemptedAt", local ? new Date(local).toISOString() : new Date().toISOString());
    if (gps && useGps) {
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
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="outcome" value={outcome} />

      <section className="card space-y-4">
        <h2 className="h2">Details</h2>
        <Row label="Process Server">
          {canChooseServer ? (
            <select className="input" name="serverId" defaultValue={d("serverId") || currentUserId}>
              {servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <div className="input bg-slate-50">{servers.find((s) => s.id === (d("serverId") || currentUserId))?.name}</div>
          )}
        </Row>
        <Row label="Date & Time">
          <input
            className="input"
            type="datetime-local"
            name="attemptedAtLocal"
            defaultValue={toLocalInput(defaults ? new Date(defaults.attemptedAt) : new Date())}
            onChange={() => !editing && setUseGps(false)}
          />
          {!editing && <p className="text-xs text-slate-500">Filled in with the current time. Change it if you&apos;re logging this later.</p>}
        </Row>
        <Row label="Service Type">
          <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">— Select —</option>
            {!typeKnown && defaults && <option value={defaults.outcome}>{defaults.outcome.replace(/_/g, " ").toLowerCase()} (older type)</option>}
            {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Row>
        <Row label="Desc. of Service">
          <div className="flex gap-2">
            <input
              className="input"
              list="service-desc"
              value={desc}
              placeholder="— Select or type —"
              onChange={(e) => {
                const v = e.target.value;
                if ((DESCRIPTIONS[outcome] ?? []).includes(v)) addDescription(v);
                else setDesc(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDescription(desc);
                }
              }}
            />
            {desc.trim() && <button type="button" className="btn-secondary" onClick={() => addDescription(desc)}>Add</button>}
          </div>
          <datalist id="service-desc">{(DESCRIPTIONS[outcome] ?? Object.values(DESCRIPTIONS).flat()).map((x) => <option key={x} value={x} />)}</datalist>
          <textarea className="input" name="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details of the attempt…" />
        </Row>
        {outcome === "PERSONAL" && (
          <>
            <Row label="Person served">
              <input className="input" name="personServed" defaultValue={d("personServed")} placeholder="Name of the person you handed the documents to" />
            </Row>
            <Row label="Physical description">
              <input className="input" name="personDescription" defaultValue={d("personDescription")} placeholder="Male, approx. 45, 5'10&quot;, brown hair, glasses" />
            </Row>
            <Row label="How identified">
              <input className="input" name="identifiedBy" defaultValue={d("identifiedBy")} list="id-methods" placeholder="How did you know it was the right person?" />
              <datalist id="id-methods">
                <option value="The person confirmed their name when I asked" />
                <option value="The person matched a photograph provided by the client" />
                <option value="The person produced photo identification" />
                <option value="The person is known to me" />
              </datalist>
            </Row>
          </>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Service Address</h2>
        {addrList.map((a) => (
          <label key={a} className="flex items-start gap-2 py-1 text-sm">
            <input type="radio" name="address" value={a} checked={addr === a} onChange={() => setAddr(a)} className="mt-0.5 h-5 w-5" />
            {a}
          </label>
        ))}
        <label className="flex items-center gap-2 py-1 text-sm">
          <input type="radio" name="address" value="__new" checked={addr === "__new"} onChange={() => setAddr("__new")} className="h-5 w-5" />
          Add new address
        </label>
        {addr === "__new" && <input className="input" name="newAddress" placeholder="Street, community, NS postal code" autoFocus />}
        {!editing && (
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} className="h-5 w-5" />
              <span className="flex-1">
                Record my current location{" "}
                {gps ? <span className="muted">({gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} ±{Math.round(gps.acc)} m)</span> : <span className="muted">({gpsMsg})</span>}
              </span>
              <button type="button" className="text-indigo-700" onClick={locate}>Refresh</button>
            </label>
            <p className="mt-1 text-xs text-slate-500">Untick this if you&apos;re logging the attempt later, away from the address.</p>
          </div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="h2">Attempt Uploads</h2>
        <input ref={fileInput} className="hidden" type="file" accept="image/*,application/pdf" multiple onChange={(e) => addPhotos(e.target.files)} />
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative">
              {photos[i].type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-20 w-20 rounded-md border object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-md border p-1 text-center text-xs break-all">{photos[i].name}</div>
              )}
              <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-600 text-xs text-white">×</button>
            </div>
          ))}
          <button type="button" className="flex h-20 min-w-20 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 px-3 text-sm text-slate-500" onClick={() => fileInput.current?.click()}>
            <span className="text-2xl">📷</span>Select files
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="h2">{canEmail ? "Email & Share" : "Share"}</h2>
        {canEmail && (
          <>
            <p className="muted">Tick anyone who should get an emailed copy when you save. Nothing is emailed if nothing is ticked.</p>
            <EmailShare recipients={recipients} mailOn={mailOn} />
          </>
        )}
        <label className="flex items-center gap-2 border-t border-slate-100 pt-3 text-sm">
          <input type="checkbox" name="shareWithClient" defaultChecked={defaults ? defaults.shareWithClient : true} className="h-5 w-5" />
          Show on the client&apos;s live tracking page {sharingOn ? "" : "(tracking is off for this job)"}
        </label>
      </section>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button className="btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <Link href={returnTo} className="btn-secondary py-3">Cancel</Link>
      </div>
    </form>
  );
}
