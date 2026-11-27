/** Branded split layout for sign-in, setup and invitation pages. */
export default function AuthShell({ company, tagline, children }: { company: string; tagline: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-navy-800 px-6 py-10 text-center text-white lg:py-0">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gold-500 lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-1.5" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark-light.png" alt="" className="mb-5 h-20 w-auto lg:h-36" />
        <h1 className="text-2xl font-extrabold tracking-wide uppercase lg:text-4xl">{company}</h1>
        {tagline && <p className="mt-2 text-sm font-semibold tracking-[.14em] text-gold-400 uppercase lg:text-base">{tagline}</p>}
      </section>
      <section className="flex items-center justify-center bg-slate-100 p-6">
        <div className="card w-full max-w-sm border-t-4 border-t-gold-500 p-6 sm:p-8">{children}</div>
      </section>
    </main>
  );
}
