import React from 'react';
import { ActiveScreen } from '../types';

interface WelcomeScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-between px-4 py-8 max-w-md mx-auto text-center bg-[#fcf9f5]">
      {/* Guild & Establishment Header */}
      <div className="flex flex-col items-center space-y-1.5 mt-2">
        <div className="inline-flex items-center space-x-1.5 px-3.5 py-1 rounded-full bg-[#f0edea] border border-[#d1c5b3]/50 shadow-xs">
          <span className="material-symbols-outlined text-[15px] text-[#715509]">verified</span>
          <span className="font-mono text-[11px] font-bold tracking-wider text-[#715509] uppercase">
            EST. 1984 • JAIPUR & MUMBAI GUILD
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-[#7f7666] tracking-wider uppercase font-semibold">
          <span>MEMBERS TERMINAL</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#486458]"></span>
          <span className="text-[#486458] font-bold">PURE GRAM BASIS SETTLEMENT</span>
        </div>
      </div>

      {/* Main Luxury Emblem & Brand Title */}
      <div className="flex flex-col items-center my-6 space-y-3">
        {/* Dark Obsidian Luxury Emblem Box */}
        <div className="relative w-28 h-28 rounded-2xl bg-[#1c1c1a] border-2 border-[#8c6d23]/60 shadow-xl flex items-center justify-center p-3 group hover:border-[#e8c16f] transition-all">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#715509]/20 to-transparent rounded-2xl"></div>
          <img
            alt="Bhakti Jewels Luxury Emblem"
            className="w-16 h-16 object-contain z-10 drop-shadow-md group-hover:scale-105 transition-transform"
            src="https://lh3.googleusercontent.com/aida/AEtjO1VdGKDX2JJLvPQjLLA6lYX5K9TXr2ZztCAHkiZKCnWndAGu34Blgsa_33mjxJ8h2k1hUAJ9zIfaKO_nm0eyAhyQt8a-_HWBmr8RCBRlUp2RkTRqOFMFiEfz9qCZNvco4hciRATYoequNx184gY2_nXvcD1EbZRZ1HOoxRsu6lYEF-59C1beTq3p5SoWHDuhbE-CC-Qa21TeepZZrpI7RHAwwojW1Tb8-2bV-2oWodWSR7Ezmt98JOKYNQ"
          />
        </div>

        <div className="flex flex-col items-center">
          <h1 className="font-serif text-[32px] md:text-[36px] font-bold tracking-tight text-[#1c1c1a] leading-tight mt-1">
            BHAKTI JEWELS
          </h1>
          <div className="flex items-center space-x-3 w-full justify-center my-1.5">
            <div className="h-px bg-[#8c6d23]/40 w-12"></div>
            <span className="font-mono text-[12px] font-bold tracking-widest text-[#715509] uppercase">
              WHOLESALE B2B
            </span>
            <div className="h-px bg-[#8c6d23]/40 w-12"></div>
          </div>
          <p className="font-sans text-[13px] text-[#4d4638] max-w-xs leading-relaxed">
            Exclusively for Certified Bullion Dealers & Fine Jewellery Retailers
          </p>
        </div>
      </div>

      {/* Feature Cards Stack (Pure Gram Basis) */}
      <div className="w-full flex flex-col space-y-2.5 my-2">
        {/* Card 1 */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-[#d1c5b3]/40 flex items-center space-x-3 text-left">
          <div className="w-10 h-10 rounded-lg bg-[#f0edea] flex items-center justify-center text-[#715509] flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[13px] font-bold text-[#1c1c1a]">100% BIS Hallmarked</span>
              <span className="font-mono text-[10px] bg-[#f0edea] text-[#715509] font-bold px-2 py-0.5 rounded">
                916 & 999
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#7f7666] truncate mt-0.5">
              Assayed purity guaranteed with individual HUID laser inscriptions
            </p>
          </div>
        </div>

        {/* Card 2: Pure Gram Basis Settlement */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-[#d1c5b3]/40 flex items-center space-x-3 text-left">
          <div className="w-10 h-10 rounded-lg bg-[#c7e7d7]/40 flex items-center justify-center text-[#486458] flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">scale</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[13px] font-bold text-[#1c1c1a]">Pure Gram-Basis Trading</span>
              <span className="font-mono text-[10px] bg-[#caeada] text-[#032017] font-bold px-2 py-0.5 rounded">
                NET WEIGHT
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#7f7666] truncate mt-0.5">
              Zero fiat rate slippage. Settle in fine gold weight (physical bullion or GML)
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-[#d1c5b3]/40 flex items-center space-x-3 text-left">
          <div className="w-10 h-10 rounded-lg bg-[#f0edea] flex items-center justify-center text-[#715509] flex-shrink-0">
            <span className="material-symbols-outlined text-[20px]">local_shipping</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[13px] font-bold text-[#1c1c1a]">Doorstep Armoured Vault</span>
              <span className="font-mono text-[10px] bg-[#f0edea] text-[#4d4638] font-bold px-2 py-0.5 rounded">
                PAN-INDIA
              </span>
            </div>
            <p className="font-sans text-[11px] text-[#7f7666] truncate mt-0.5">
              Insured transit via Sequel & BVC Logistics partners with OTP handover
            </p>
          </div>
        </div>
      </div>

      {/* Pure Gram Settlement Standard Banner */}
      <div className="w-full bg-[#f0edea] rounded-lg py-2.5 px-3 border border-[#d1c5b3]/40 flex items-center justify-between my-3 text-left">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-[18px] text-[#715509]">precision_manufacturing</span>
          <span className="font-mono text-[11px] font-bold text-[#1c1c1a] tracking-wider uppercase">
            Settlement Standard
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[12px] font-bold text-[#715509]">
            Fine Gold Net Weight (0.001g)
          </span>
          <span className="font-mono text-[10px] font-bold text-[#486458] bg-[#caeada] px-1.5 py-0.5 rounded">
            916 / 999.9
          </span>
        </div>
      </div>

      {/* Primary CTA Buttons */}
      <div className="w-full flex flex-col space-y-2.5 mt-2">
        <button
          onClick={() => onNavigate('catalogue')}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#e8c16f] to-[#8c6d23] text-[#1c1c1a] font-sans font-bold text-[14px] flex items-center justify-center space-x-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <span className="material-symbols-outlined text-[19px]">lock</span>
          <span className="tracking-wide uppercase">ENTER WHOLESALE PORTAL</span>
          <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
        </button>

        <button
          onClick={() => onNavigate('retailer-auth')}
          className="w-full py-3 px-4 rounded-xl bg-[#f0edea] hover:bg-[#ebe8e4] text-[#1c1c1a] font-sans font-semibold text-[13px] flex items-center justify-center space-x-2 border border-[#d1c5b3]/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px] text-[#715509]">storefront</span>
          <span>Register New Jewellery Store</span>
        </button>
      </div>

      {/* Compliance / Encrypted Ledger Badge */}
      <div className="mt-6 flex flex-col items-center space-y-1 text-[#7f7666]">
        <div className="flex items-center space-x-1.5 text-[11px] font-mono">
          <span className="material-symbols-outlined text-[14px] text-emerald-700">shield</span>
          <span>256-Bit Encrypted B2B Terminal</span>
        </div>
        <p className="font-mono text-[10px] text-[#7f7666]">
          BIS Reg. No. HM/C-728190 • GST Verified Enterprise
        </p>
      </div>
    </div>
  );
};
