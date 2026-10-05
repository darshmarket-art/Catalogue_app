import React from 'react';
import { usePlan } from '../plan';
import { Title } from '../layouts/emergent/ui';
import { AdminBuyersScreen } from './AdminBuyersScreen';
import { AdminEnquiriesScreen } from './AdminEnquiriesScreen';
import { AdminVisitorsScreen } from './AdminVisitorsScreen';
import type { AnalyticsData } from '../types';

export type BuyersSegment = 'buyers' | 'enquiries' | 'activity';

/** The owner's Buyers tab: the people who buy from you, their WhatsApp enquiries and what they browse. */
export const AdminBuyersHub: React.FC<{ segment: BuyersSegment; onSegment: (s: BuyersSegment) => void; analytics: AnalyticsData; waiting: number; onChanged: () => void }> = ({ segment, onSegment, analytics, waiting, onChanged }) => {
  const { flags } = usePlan();
  const tabs: Array<{ key: BuyersSegment; label: string; pro?: boolean; n?: number }> = [
    { key: 'buyers', label: 'Buyers' },
    { key: 'enquiries', label: 'Enquiries', pro: !flags.enquiries, n: waiting },
    { key: 'activity', label: 'Activity', pro: !flags.liveVisitors }
  ];
  return (
    <div className="em-page" data-testid="admin-buyers-hub">
      <div className="em-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Title eyebrow="Everyone who buys from you" title="Buyers" />
        <div className="em-seg" role="group" aria-label="Buyer views">
          {tabs.map((t) => (
            <button key={t.key} type="button" className="em-chip" data-testid={`buyers-seg-${t.key}`} aria-pressed={segment === t.key} onClick={() => onSegment(t.key)}>
              {t.label}
              {t.n ? <i>{t.n}</i> : null}
              {t.pro && <span className="pro">Pro</span>}
            </button>
          ))}
        </div>
        <div className="em-embed">
          {segment === 'buyers' && <AdminBuyersScreen />}
          {segment === 'enquiries' && <AdminEnquiriesScreen onChanged={onChanged} />}
          {segment === 'activity' && <AdminVisitorsScreen analytics={analytics} />}
        </div>
      </div>
    </div>
  );
};
