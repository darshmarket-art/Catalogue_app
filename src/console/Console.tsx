import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Activity, Award, FileText, HardDrive, LayoutDashboard, Package, RefreshCw, Store, UserRound, Users } from 'lucide-react';
import { call, num, useApi, type Action, type Row, type Summary } from './api';
import { ActivityPage, AuditPage, BuyersPage, Overview, OrdersPage, OwnersPage, PlansPage, StoragePage, StoreDetail, StoresPage, type PageProps } from './pages';

const NAV: Array<{ id: string; label: string; icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; page: ComponentType<PageProps> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, page: Overview },
  { id: 'stores', label: 'Stores', icon: Store, page: StoresPage },
  { id: 'owners', label: 'Owners', icon: UserRound, page: OwnersPage },
  { id: 'buyers', label: 'Buyers', icon: Users, page: BuyersPage },
  { id: 'orders', label: 'Orders', icon: Package, page: OrdersPage },
  { id: 'plans', label: 'Plans & trials', icon: Award, page: PlansPage },
  { id: 'activity', label: 'Activity', icon: Activity, page: ActivityPage },
  { id: 'storage', label: 'Storage', icon: HardDrive, page: StoragePage },
  { id: 'audit', label: 'Audit log', icon: FileText, page: AuditPage }
];

/** Hash routing (#/stores, #/stores/<id>): no router dependency, and the browser's back button just works. */
const useHash = () => {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [page = '', id] = hash.replace(/^#\/?/, '').split('/');
  return { page: NAV.some((n) => n.id === page) ? page : 'overview', id: id ? decodeURIComponent(id) : undefined };
};

interface Pending { store: Pick<Row, 'id' | 'name'>; action: Action }

/** Confirm before any change. A native <dialog> gives focus trapping, Escape and a dimmed page for free. */
function Confirm({ pending, busy, error, onYes, onNo }: { pending: Pending | null; busy: boolean; error: string; onYes: () => void; onNo: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pending && !d.open) {
      d.showModal();
      d.querySelector<HTMLButtonElement>('.ghost')?.focus(); // land on Cancel, the safe choice
    }
    if (!pending && d.open) d.close();
  }, [pending]);
  return (
    <dialog ref={ref} className="cn-dlg" role="alertdialog" aria-labelledby="cn-dlg-t" aria-describedby="cn-dlg-d" onClose={onNo} onCancel={(e) => busy && e.preventDefault()}>
      {pending && (
        <div className="cn-stack">
          <h2 id="cn-dlg-t" className="ser">{pending.action.label}?</h2>
          <p id="cn-dlg-d">For <b>{pending.store.name}</b>. {pending.action.warn}</p>
          {error && <p role="alert" className="cn-note">{error}</p>}
          <div className="cn-row">
            <button type="button" className="cn-btn" disabled={busy} onClick={onYes}>{busy ? 'Working…' : 'Confirm'}</button>
            <button type="button" className="cn-btn ghost" onClick={onNo}>Cancel</button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Antarixs console (console.antarixs.com): every store, owner and buyer on the cloud, from real data. */
export default function Console() {
  const { page, id } = useHash();
  const [v, setV] = useState(0);
  const stores = useApi<Row[]>('/stores', v);
  const summary = useApi<Summary>('/summary', v);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const nav = NAV.find((n) => n.id === page)!;
  const heading = id ? 'Store' : nav.label;
  useEffect(() => {
    document.title = `${heading} · Antarixs console`;
    if (first.current) first.current = false;
    else title.current?.focus(); // tell screen-reader users the page changed
  }, [heading, page, id]);

  const ask = useCallback((store: Pending['store'], action: Action) => { setError(''); setNotice(''); setPending({ store, action }); }, []);
  const run = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await call(`/stores/${pending.store.id}${pending.action.path}`, pending.action.body);
      setNotice(`${pending.action.label}: done for ${pending.store.name}.`);
      setPending(null);
      setV((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const Page = nav.page;
  const props: PageProps = { stores, summary, v, ask };
  return (
    <div className="cn-body">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="cn-side">
        <div className="cn-brand">
          <span className="cn-mk" aria-hidden="true">
            <svg viewBox="0 0 100 100" width="20" height="20"><path d="M50 8L92 90L75 90L50 40L25 90L8 90Z" fill="#7cc4ff" /><path d="M45 42C46.6 51 49.4 53.8 58 55.5C49.4 57.2 46.6 60 45 69C43.4 60 40.6 57.2 32 55.5C40.6 53.8 43.4 51 45 42Z" fill="#f3e35a" /></svg>
          </span>
          <div><b className="ser">Antarixs</b><small>Console</small></div>
        </div>
        <nav aria-label="Console sections">
          {NAV.map((n) => (
            <a key={n.id} href={`#/${n.id}`} aria-current={n.id === page ? 'page' : undefined}>
              <n.icon size={17} aria-hidden />{n.label}
              {n.id === 'stores' && summary.data && <em>{num(summary.data.stores.total)}</em>}
            </a>
          ))}
        </nav>
        <div className="cn-env"><small>Revision</small><b>{summary.data ? summary.data.env.revision ?? 'Not connected' : '—'}</b></div>
      </aside>
      <main id="main" className="cn-main">
        <header className="cn-top">
          <div><div className="ey">Platform</div><h1 ref={title} tabIndex={-1} className="ser cn-h">{heading}</h1><div className="rule" /></div>
          <div className="cn-tools">
            {summary.data && <small>Updated {new Date(summary.data.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>}
            <button type="button" className="cn-btn sm soft" onClick={() => setV((n) => n + 1)}><RefreshCw size={14} aria-hidden /> Refresh</button>
          </div>
        </header>
        {notice && <p role="status" className="cn-note ok">{notice}</p>}
        {id ? <StoreDetail {...props} id={id} /> : <Page {...props} />}
      </main>
      <Confirm pending={pending} busy={busy} error={error} onYes={() => void run()} onNo={() => { if (!busy) { setPending(null); setError(''); } }} />
    </div>
  );
}
