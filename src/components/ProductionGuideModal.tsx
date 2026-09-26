import React, { useState } from 'react';

interface ProductionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductionGuideModal: React.FC<ProductionGuideModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'gram' | 'admin-process' | 'db' | 'security' | 'deploy'>('gram');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#8c6d23]/40">
        {/* Modal Header */}
        <div className="bg-[#1c1c1a] text-white px-5 py-4 flex items-center justify-between border-b border-[#8c6d23]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8c6d23] flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[20px]">architecture</span>
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#ffdf9e]">
                Bhakti Jewels Wholesale — Pure Gram-Basis Architecture & Admin Process
              </h3>
              <p className="text-[11px] font-sans text-white/70">
                Enterprise technical documentation for pure fine gold settlement & user database management
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="bg-[#f0edea] px-4 py-2 border-b border-[#d1c5b3]/40 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'gram', label: '1. Pure Gram-Basis Model' },
            { id: 'admin-process', label: '2. Admin Creation Process' },
            { id: 'db', label: '3. Backend Database Architecture' },
            { id: 'security', label: '4. Authentication & Password Deny' },
            { id: 'deploy', label: '5. Production Deployment Specs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-sans font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#715509] shadow-xs border border-[#8c6d23]/40 font-bold'
                  : 'text-[#4d4638] hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 text-[#1c1c1a] font-sans text-xs space-y-4">
          {activeTab === 'gram' && (
            <div className="space-y-3.5">
              <div className="bg-[#f6f3ef] p-4 rounded-xl border border-[#d1c5b3]/40 space-y-2">
                <h4 className="font-serif text-sm font-bold text-[#715509] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">scale</span>
                  Why Wholesale Gold Operates on Pure Gram Basis (No Rate Locks)
                </h4>
                <p className="leading-relaxed text-[#4d4638]">
                  In genuine high-volume B2B bullion and jewellery wholesale across Jaipur, Zaveri Bazaar, and Manek Chowk, trades settle in <strong>Fine Gold Weight (Grams)</strong> rather than volatile fiat currency locks. The wholesaler delivers manufactured jewellery and receives equivalent fine 999.9 gold bullion bars (or bank Gold Metal Loan credit) plus making charges per gram.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40">
                    <span className="font-mono text-[10px] font-bold text-[#715509] block uppercase">
                      1. Zero Price Risk
                    </span>
                    <p className="text-[11px] mt-1 text-[#1c1c1a]">
                      Neither the manufacturer nor the retail jeweller is exposed to commodity market fluctuations or countdown expirations.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40">
                    <span className="font-mono text-[10px] font-bold text-[#715509] block uppercase">
                      2. Net Gram Precision
                    </span>
                    <p className="text-[11px] mt-1 text-[#1c1c1a]">
                      Every piece explicitly itemizes Gross Weight, Stone / Tare deduction, and pure Net Gold weight to 0.001g precision.
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40">
                    <span className="font-mono text-[10px] font-bold text-[#715509] block uppercase">
                      3. Standard Karats
                    </span>
                    <p className="text-[11px] mt-1 text-[#1c1c1a]">
                      Multi-standard support across 24K (999.9 bullion), 22K (916 BIS jewellery), and 18K (750 diamond/jadau setting).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin-process' && (
            <div className="space-y-3.5">
              <div className="bg-[#f6f3ef] p-4 rounded-xl border border-[#d1c5b3]/40 space-y-2">
                <h4 className="font-serif text-sm font-bold text-[#715509] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  Process of Creating an Admin Account
                </h4>
                <p className="leading-relaxed text-[#4d4638]">
                  Because administrative accounts hold authority to release physical bullion inventory, edit hallmarking ledgers, and manage merchant accounts, <strong>admin accounts can never be registered by the public</strong>. The platform enforces the following 4-step governance process:
                </p>

                <div className="space-y-2 pt-2">
                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40 flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#715509] bg-[#ffdf9e] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      1
                    </span>
                    <div>
                      <span className="font-bold text-xs text-[#1c1c1a]">Master Keymaster Provisioning Token</span>
                      <p className="text-[11px] text-[#4d4638] mt-0.5">
                        The Managing Director generates a confidential one-time Master Provisioning Key (Default seed: <code className="bg-[#f0edea] px-1 font-mono font-bold text-[#1c1c1a]">GUILD-MASTER-1984</code>). Any request without this exact token is rejected with <code className="text-[#ba1a1a] font-mono">403 Forbidden</code> and logged.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40 flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#715509] bg-[#ffdf9e] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      2
                    </span>
                    <div>
                      <span className="font-bold text-xs text-[#1c1c1a]">Authorized Guild Domain Identity</span>
                      <p className="text-[11px] text-[#4d4638] mt-0.5">
                        Admins must register using an authorized corporate email (e.g. <code className="font-mono text-[#1c1c1a]">name@bhaktijewels.in</code>).
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40 flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#715509] bg-[#ffdf9e] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      3
                    </span>
                    <div>
                      <span className="font-bold text-xs text-[#1c1c1a]">Role & Vault Clearance Assignment</span>
                      <p className="text-[11px] text-[#4d4638] mt-0.5">
                        Assign explicit clearance: <strong>Managing Director</strong> (L4 Full Vault Release), <strong>Inventory Controller</strong> (L3 Dispatch), or <strong>Bullion Desk Director</strong> (L3 Gram Settlement).
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-[#d1c5b3]/40 flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-[#715509] bg-[#ffdf9e] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
                      4
                    </span>
                    <div>
                      <span className="font-bold text-xs text-[#1c1c1a]">Permanent Audit Ledger Registration</span>
                      <p className="text-[11px] text-[#4d4638] mt-0.5">
                        The creation event is timestamped and signed in <code className="font-mono text-[#1c1c1a]">data/database.json</code> with the creator&apos;s IP address.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'db' && (
            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold text-[#715509]">
                Backend Database Architecture (`data/database.json`)
              </h4>
              <p className="text-[#4d4638]">
                All users (retailers and administrators) as well as catalog contents, order batches, and audit logs are persistently stored and validated in the backend database.
              </p>
              <pre className="bg-[#1c1c1a] text-[#caeada] p-3 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed max-h-80">
{`{
  "merchants": [
    {
      "id": "merch-1",
      "firmName": "Shree Ambica Jewellers",
      "gstin": "24AAAAA0000A1Z5",
      "phone": "9820012345",
      "password": "Password@123", // verified on login; denied on mismatch
      "marketHub": "Zaveri Bazaar, Mumbai",
      "verified": true
    }
  ],
  "admins": [
    {
      "id": "adm-1",
      "name": "Kishorbhai Choksi",
      "email": "md.office@bhaktijewels.in",
      "password": "MasterVault@1984", // verified on login; denied on mismatch
      "role": "Managing Director",
      "accessLevel": "L4_FULL_ESCROW_RELEASE"
    }
  ],
  "masterProvisioningKey": "GUILD-MASTER-1984",
  "auditLogs": [
    {
      "id": "log-1",
      "event": "RETAILER_LOGIN_FAILED_WRONG_PASSWORD",
      "details": "Failed login attempt: Incorrect passkey. Access Denied.",
      "timestamp": "2026-09-26T14:15:00.000Z"
    }
  ]
}`}
              </pre>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold text-[#715509] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
                Access Denial & Security Policy
              </h4>
              <p className="text-[#4d4638]">
                When an incorrect password or unregistered identifier is entered, the backend responds with HTTP 401 Unauthorized and an explicit access denial notice:
              </p>
              <div className="bg-[#ffdad6] text-[#ba1a1a] p-3 rounded-lg border border-[#ba1a1a]/40 space-y-1 font-mono text-[11px]">
                <div className="font-bold">HTTP 401 Unauthorized</div>
                <div>{`{ "status": "error", "message": "Access Denied: Incorrect vault security password. Access has been denied." }`}</div>
              </div>
              <p className="text-[#4d4638] text-[11px]">
                Repeated failed attempts log security incident entries to the Gujarat Bullion Guild audit ledger and trigger biometric/hardware token challenges.
              </p>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold text-[#715509]">
                Production Cloud Deployment Specifications
              </h4>
              <ul className="space-y-2 text-[#4d4638]">
                <li className="flex items-start gap-2 bg-[#f6f3ef] p-2.5 rounded-lg border border-[#d1c5b3]/30">
                  <span className="material-symbols-outlined text-[#486458] text-[18px]">database</span>
                  <div>
                    <span className="font-bold text-xs text-[#1c1c1a]">Relational PostgreSQL / Cloud SQL Migration</span>
                    <p className="text-[11px]">Seamless migration path from file-based JSON database to managed PostgreSQL instance with Drizzle ORM.</p>
                  </div>
                </li>
                <li className="flex items-start gap-2 bg-[#f6f3ef] p-2.5 rounded-lg border border-[#d1c5b3]/30">
                  <span className="material-symbols-outlined text-[#486458] text-[18px]">security</span>
                  <div>
                    <span className="font-bold text-xs text-[#1c1c1a]">bcrypt Password Hashing & JWT</span>
                    <p className="text-[11px]">In full production, passkeys are hashed with bcrypt (salt rounds = 12) with signed RS256 JWT tokens.</p>
                  </div>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#f0edea] px-5 py-3 border-t border-[#d1c5b3]/40 flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#7f7666]">
            Architected by Bhakti Jewels Enterprise Engineering Desk
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#715509] hover:bg-[#8c6d23] text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
