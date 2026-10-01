import { useState, useEffect } from "react";
import {
  Plus, Minus, Pencil, Check, Trash2, Calculator, X, Sun, Moon, Target,
  CalendarDays, Archive, ChevronLeft, ChevronRight, Repeat, Wallet,
} from "lucide-react";

const KEY = "finance-installment-tracker-v1";
const CUR = "EGP";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => parseFloat(v) || 0;
const fmt = (n, d = 0) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: d });
const monthlyOf = (price, down, months) => (months > 0 ? Math.max(price - down, 0) / months : 0);
const today = new Date();
const curIdx = today.getFullYear() * 12 + today.getMonth(); // month index = year*12 + month
const toInput = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const fromInput = (v) => { const [y, m] = v.split("-").map(Number); return y * 12 + m - 1; };
const isActive = (i, idx) => idx >= i.start && idx < i.start + i.months;

const load = () => {
  const base = {
    cash: 0, goals: [], inst: [],
    dark: typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : true,
  };
  try { return { ...base, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return base; }
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;800&display=swap');
.app{--bg:#0b1517;--tx:#e8f1ef;--mu:#8fa7a3;--card:rgba(255,255,255,.07);--bd:rgba(255,255,255,.12);--in:rgba(255,255,255,.08);--ok:#34d3b0;--bad:#fb7185;--am:#f5b83d;--b1:#0f766e;--b2:#b45309;
 background:var(--bg);color:var(--tx);font-family:'Bricolage Grotesque',system-ui,sans-serif;font-variant-numeric:tabular-nums;transition:background .3s,color .3s}
.app.light{--bg:#eaf1ef;--tx:#10201f;--mu:#566f6b;--card:rgba(255,255,255,.65);--bd:rgba(16,32,31,.1);--in:rgba(16,32,31,.06);--ok:#0f9e80;--bad:#e11d48;--am:#b97a06;--b1:#5eead4;--b2:#fcd34d}
.glass{background:var(--card);border:1px solid var(--bd);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:1.25rem;transition:background .3s,border-color .3s}
.field{width:100%;background:var(--in);border:1px solid var(--bd);border-radius:.8rem;padding:.65rem .8rem;color:inherit;outline:none;font:inherit;transition:border-color .2s}
.field:focus{border-color:var(--ok)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border-radius:.8rem;padding:.6rem .9rem;font-weight:600;background:var(--in);border:1px solid var(--bd);color:inherit;transition:transform .15s,background .2s}
.btn:active{transform:scale(.96)}
.btn:focus-visible,.field:focus-visible{outline:2px solid var(--ok);outline-offset:2px}
.btn-p{background:var(--ok);color:#06201a;border-color:transparent}
.mu{color:var(--mu)}.ok{color:var(--ok)}.bad{color:var(--bad)}.am{color:var(--am)}
.pop{animation:pop .22s ease-out}
@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const Field = ({ label, children }) => (
  <label className="block text-sm">
    <span className="mu mb-1 block">{label}</span>
    {children}
  </label>
);

const Num = ({ value, onChange, ...p }) => (
  <input className="field" type="number" inputMode="decimal" min="0" value={value} onChange={(e) => onChange(e.target.value)} {...p} />
);

const Section = ({ icon: Icon, title, right, children }) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Icon size={18} className="ok" />{title}</h2>
      {right}
    </div>
    {children}
  </section>
);

export default function App() {
  const [s, setS] = useState(load);
  const [amt, setAmt] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [year, setYear] = useState(today.getFullYear());
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState({ title: "", price: "", down: "", months: "" });
  const [gf, setGf] = useState({ title: "", price: "", type: "cash", months: "", down: "" });
  const [inf, setInf] = useState({ title: "", monthly: "", months: "", start: toInput(curIdx) });

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }, [s]);
  const patch = (p) => setS((x) => ({ ...x, ...p }));

  // ---- derived numbers ----
  const monthTotal = (idx) => s.inst.filter((i) => isActive(i, idx)).reduce((a, i) => a + i.monthly, 0);
  const thisMonth = monthTotal(curIdx);
  const net = s.cash - thisMonth;
  const pending = s.goals.filter((g) => !g.done);
  const done = s.goals.filter((g) => g.done);
  const target = pending.reduce((a, g) => a + g.price, 0);

  // ---- balance ----
  const adjust = (sign) => { const a = num(amt); if (a > 0) { patch({ cash: s.cash + sign * a }); setAmt(""); } };
  const setExact = () => { if (amt !== "") { patch({ cash: num(amt) }); setAmt(""); } };

  // ---- goals ----
  const addGoal = (g) => {
    const price = num(g.price), months = Math.round(num(g.months)), down = num(g.down);
    const inst = g.type === "installment";
    if (!g.title.trim() || price <= 0 || (inst && months < 1)) return false;
    const goal = { id: uid(), title: g.title.trim(), price, type: g.type, done: false,
      ...(inst ? { months, down, monthly: monthlyOf(price, down, months) } : {}) };
    patch({ goals: [goal, ...s.goals] });
    return true;
  };
  const submitGoal = (e) => {
    e.preventDefault();
    if (addGoal(gf)) setGf({ title: "", price: "", type: "cash", months: "", down: "" });
  };
  const purchase = (g) => {
    const goals = s.goals.map((x) => (x.id === g.id ? { ...x, done: true } : x));
    if (g.type === "cash") return patch({ goals, cash: s.cash - g.price });
    patch({
      goals, cash: s.cash - (g.down || 0),
      inst: [...s.inst, { id: uid(), title: g.title, monthly: g.monthly, months: g.months, start: curIdx }],
    });
  };
  const delGoal = (id) => patch({ goals: s.goals.filter((g) => g.id !== id) });
  const needNow = (g) => (g.type === "cash" ? g.price : (g.down || 0) + g.monthly);

  // ---- installments ----
  const submitInst = (e) => {
    e.preventDefault();
    const monthly = num(inf.monthly), months = Math.round(num(inf.months));
    if (!inf.title.trim() || monthly <= 0 || months < 1) return;
    patch({ inst: [...s.inst, { id: uid(), title: inf.title.trim(), monthly, months, start: fromInput(inf.start) }] });
    setInf({ title: "", monthly: "", months: "", start: toInput(curIdx) });
  };
  const delInst = (id) => patch({ inst: s.inst.filter((i) => i.id !== id) });

  // ---- calculator ----
  const cMonthly = monthlyOf(num(calc.price), num(calc.down), Math.round(num(calc.months)));
  const addFromCalc = () => {
    const ok = addGoal({ title: calc.title || "Installment purchase", price: calc.price, type: "installment", months: calc.months, down: calc.down });
    if (ok) { setCalc({ title: "", price: "", down: "", months: "" }); setCalcOpen(false); }
  };

  // ---- yearly matrix ----
  const row = MONTHS.map((_, m) => monthTotal(year * 12 + m));
  const max = Math.max(...row, 1);

  const Stat = ({ label, value, cls = "" }) => (
    <div className="glass p-4">
      <p className="mu text-xs">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${cls}`}>{fmt(value, 2).replace(/\.00$/, "")}<span className="mu ml-1 text-xs font-normal">{CUR}</span></p>
    </div>
  );

  return (
    <div className={`app min-h-screen ${s.dark ? "" : "light"}`}>
      <style>{CSS}</style>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "var(--b1)" }} />
        <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "var(--b2)" }} />
      </div>

      <main className="relative mx-auto max-w-md space-y-7 px-4 pb-24 pt-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold leading-tight">My Money</h1>
            <p className="mu text-sm">{MONTHS[today.getMonth()]} {today.getFullYear()}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setCalcOpen(true)} aria-label="Open installment calculator"><Calculator size={18} /></button>
            <button className="btn" onClick={() => patch({ dark: !s.dark })} aria-label="Toggle theme">{s.dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>

        {/* Balance */}
        <section className="glass space-y-4 p-5">
          <div className="flex items-center gap-2 mu text-sm"><Wallet size={16} />Total cash</div>
          <p className="text-5xl font-extrabold tracking-tight">{fmt(s.cash, 2).replace(/\.00$/, "")}<span className="mu ml-2 text-base font-normal">{CUR}</span></p>
          <Num value={amt} onChange={setAmt} placeholder="Amount" aria-label="Amount" />
          <div className="grid grid-cols-3 gap-2">
            <button className="btn btn-p" onClick={() => adjust(1)}><Plus size={16} />Add</button>
            <button className="btn" onClick={() => adjust(-1)}><Minus size={16} />Spend</button>
            <button className="btn" onClick={setExact}><Pencil size={16} />Set</button>
          </div>
        </section>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Total cash" value={s.cash} />
          <Stat label="Installments this month" value={thisMonth} cls="am" />
          <Stat label="Net after this month" value={net} cls={net >= 0 ? "ok" : "bad"} />
          <Stat label="Pending goals total" value={target} />
        </div>

        {/* Goals */}
        <Section icon={Target} title="Buy list"
          right={done.length > 0 && (
            <button className="btn !px-3 !py-1.5 text-sm" onClick={() => setShowDone(!showDone)}><Archive size={14} />{showDone ? "Hide" : "Show"} purchased ({done.length})</button>
          )}>
          <form onSubmit={submitGoal} className="glass space-y-3 p-4">
            <Field label="What do you want to buy?"><input className="field" value={gf.title} onChange={(e) => setGf({ ...gf, title: e.target.value })} placeholder="e.g. Laptop" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Price (${CUR})`}><Num value={gf.price} onChange={(v) => setGf({ ...gf, price: v })} /></Field>
              <Field label="Payment type">
                <select className="field" value={gf.type} onChange={(e) => setGf({ ...gf, type: e.target.value })}>
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                </select>
              </Field>
            </div>
            {gf.type === "installment" && (
              <div className="pop grid grid-cols-2 gap-3">
                <Field label="Months"><Num value={gf.months} onChange={(v) => setGf({ ...gf, months: v })} /></Field>
                <Field label="Down payment"><Num value={gf.down} onChange={(v) => setGf({ ...gf, down: v })} /></Field>
                <p className="col-span-2 text-sm">Monthly payment: <b className="am">{fmt(monthlyOf(num(gf.price), num(gf.down), Math.round(num(gf.months))), 2)} {CUR}</b></p>
              </div>
            )}
            <button className="btn btn-p w-full" type="submit"><Plus size={16} />Add goal</button>
          </form>

          {pending.length === 0 && <p className="mu py-2 text-center text-sm">No goals yet. Add something you're saving for.</p>}
          {[...pending, ...(showDone ? done : [])].map((g) => {
            const need = needNow(g);
            const ready = net >= need;
            return (
              <article key={g.id} className={`glass pop space-y-3 p-4 ${g.done ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${g.done ? "line-through" : ""}`}>{g.title}</p>
                    <p className="mu text-sm">
                      {g.type === "cash" ? `${fmt(g.price)} ${CUR}, cash` : `${fmt(g.price)} ${CUR} total`}
                    </p>
                    {g.type === "installment" && (
                      <p className="am text-sm">{fmt(g.monthly, 2)} {CUR}/mo for {g.months} months{g.down ? `, ${fmt(g.down)} down` : ""}</p>
                    )}
                  </div>
                  {g.done ? <span className="mu text-sm">Purchased</span> : (
                    <span className={`shrink-0 text-right text-sm font-semibold ${ready ? "ok" : "bad"}`}>
                      {ready ? "🟢 Ready to buy" : "🔴 Saving needed"}
                      {!ready && <span className="mu block text-xs font-normal">{fmt(need - net, 2)} {CUR} short</span>}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!g.done && <button className="btn btn-p flex-1" onClick={() => purchase(g)}><Check size={16} />Purchased</button>}
                  <button className="btn flex-1" onClick={() => delGoal(g.id)}><Trash2 size={16} />Delete</button>
                </div>
              </article>
            );
          })}
        </Section>

        {/* Installments */}
        <Section icon={Repeat} title="Monthly installments">
          {s.inst.map((i) => {
            const paid = Math.min(Math.max(curIdx - i.start + 1, 0), i.months);
            const status = curIdx < i.start ? "Not started" : curIdx >= i.start + i.months ? "Finished" : `Month ${paid} of ${i.months}`;
            return (
              <article key={i.id} className="glass space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{i.title}</p>
                    <p className="mu text-sm">{status}, from {MONTHS[i.start % 12]} {Math.floor(i.start / 12)}</p>
                  </div>
                  <p className="am shrink-0 font-bold">{fmt(i.monthly, 2)} <span className="text-xs font-normal">{CUR}/mo</span></p>
                  <button className="btn !p-2" onClick={() => delInst(i.id)} aria-label={`Delete ${i.title}`}><Trash2 size={16} /></button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--in)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${(paid / i.months) * 100}%`, background: "var(--am)" }} />
                </div>
              </article>
            );
          })}
          <form onSubmit={submitInst} className="glass space-y-3 p-4">
            <Field label="Installment name"><input className="field" value={inf.title} onChange={(e) => setInf({ ...inf, title: e.target.value })} placeholder="e.g. Phone" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Per month (${CUR})`}><Num value={inf.monthly} onChange={(v) => setInf({ ...inf, monthly: v })} /></Field>
              <Field label="Months"><Num value={inf.months} onChange={(v) => setInf({ ...inf, months: v })} /></Field>
            </div>
            <Field label="First payment month"><input className="field" type="month" value={inf.start} onChange={(e) => setInf({ ...inf, start: e.target.value || toInput(curIdx) })} /></Field>
            <button className="btn btn-p w-full" type="submit"><Plus size={16} />Add installment</button>
          </form>
        </Section>

        {/* Yearly matrix */}
        <Section icon={CalendarDays} title="Yearly overview"
          right={
            <div className="flex items-center gap-1">
              <button className="btn !p-1.5" onClick={() => setYear(year - 1)} aria-label="Previous year"><ChevronLeft size={16} /></button>
              <span className="w-12 text-center font-bold">{year}</span>
              <button className="btn !p-1.5" onClick={() => setYear(year + 1)} aria-label="Next year"><ChevronRight size={16} /></button>
            </div>
          }>
          <div className="glass p-3">
            <div className="grid grid-cols-3 gap-2">
              {row.map((v, m) => {
                const isNow = year * 12 + m === curIdx;
                return (
                  <div key={m} className="rounded-xl p-2.5"
                    style={{ background: `color-mix(in srgb, var(--am) ${Math.round((v / max) * 45)}%, var(--in))`, border: isNow ? "1.5px solid var(--ok)" : "1px solid var(--bd)" }}>
                    <p className={`text-xs ${isNow ? "ok font-bold" : "mu"}`}>{MONTHS[m]}</p>
                    <p className="font-bold">{fmt(v, 0)}</p>
                  </div>
                );
              })}
            </div>
            <p className="mu mt-3 text-right text-sm">Year total: <b className="am">{fmt(row.reduce((a, b) => a + b, 0), 2)} {CUR}</b></p>
          </div>
        </Section>
      </main>

      {/* Calculator modal */}
      {calcOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setCalcOpen(false)}>
          <div className="glass pop w-full max-w-md space-y-3 p-5" style={{ background: "var(--bg)" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Installment calculator">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-extrabold"><Calculator size={18} className="ok" />Installment calculator</h3>
              <button className="btn !p-1.5" onClick={() => setCalcOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <Field label="Item name (optional)"><input className="field" value={calc.title} onChange={(e) => setCalc({ ...calc, title: e.target.value })} placeholder="e.g. iPhone" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Price"><Num value={calc.price} onChange={(v) => setCalc({ ...calc, price: v })} /></Field>
              <Field label="Down"><Num value={calc.down} onChange={(v) => setCalc({ ...calc, down: v })} /></Field>
              <Field label="Months"><Num value={calc.months} onChange={(v) => setCalc({ ...calc, months: v })} /></Field>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "var(--in)" }}>
              <p className="mu text-sm">Monthly payment</p>
              <p className="am text-3xl font-extrabold">{fmt(cMonthly, 2)} <span className="text-sm font-normal">{CUR}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => setCalcOpen(false)}>Cancel</button>
              <button className="btn btn-p" onClick={addFromCalc}><Plus size={16} />Add as new goal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
