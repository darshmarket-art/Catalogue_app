import React from 'react';
import { Reveal } from './Reveal';

/* Small, quiet phone mock-ups of a live store ([store].antarixs.com). Pure CSS motion; photos are the demo set in /platform. */
const Phone: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="hw-phone" role="img" aria-label={label}>
    <span className="hw-notch" />
    <div className="hw-screen">{children}</div>
  </div>
);

const Bar: React.FC<{ title?: string }> = ({ title = 'Sharma Jewellers' }) => (
  <div className="hw-bar">
    <span className="hw-logo">S</span>
    <b>{title}</b>
  </div>
);

const VAddress = () => (
  <Phone label="A store opening at its own address">
    <div className="hw-url">
      <span className="hw-type">sharma-jewellers.antarixs.com</span>
    </div>
    <Bar />
    <img className="hw-pic" src="/platform/hero.jpg" alt="" loading="lazy" style={{ height: 150 }} />
    <div className="hw-qr" aria-hidden="true">
      {Array.from({ length: 49 }, (_, i) => (
        <i key={i} style={{ opacity: [0, 2, 4, 5, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 33, 35, 37, 40, 42, 44, 46, 48].includes(i) ? 1 : 0.12 }} />
      ))}
    </div>
    <p className="hw-cap">Scan to open</p>
  </Phone>
);

const VBanners = () => (
  <Phone label="Home banners and collections">
    <Bar />
    <div className="hw-slidebox">
      <div className="hw-slides">
        <img src="/platform/hero.jpg" alt="" loading="lazy" />
        <img src="/platform/chokers.jpg" alt="" loading="lazy" />
        <img src="/platform/polki.jpg" alt="" loading="lazy" />
      </div>
    </div>
    <div className="hw-dots">
      <i />
      <i />
      <i />
    </div>
    <div className="hw-grid">
      <img src="/platform/temple.jpg" alt="" loading="lazy" />
      <img src="/platform/signup.jpg" alt="" loading="lazy" />
      <img src="/platform/chokers.jpg" alt="" loading="lazy" />
      <img src="/platform/polki.jpg" alt="" loading="lazy" />
    </div>
  </Phone>
);

const VCatalogue = () => (
  <Phone label="Catalogue with filters">
    <div className="hw-search">Search name, SKU or weight</div>
    <div className="hw-chips">
      <span className="hw-chip a">22K 916</span>
      <span className="hw-chip b">Ready in Vault</span>
      <span className="hw-chip c">5 g – 60 g</span>
    </div>
    <div className="hw-grid tall">
      <div>
        <img src="/platform/chokers.jpg" alt="" loading="lazy" />
        <small>Rani Haar</small>
        <b>84.3 g net</b>
      </div>
      <div>
        <img src="/platform/temple.jpg" alt="" loading="lazy" />
        <small>Kasu Mala</small>
        <b>74.5 g net</b>
      </div>
      <div>
        <img src="/platform/polki.jpg" alt="" loading="lazy" />
        <small>Polki set</small>
        <b>74.6 g net</b>
      </div>
      <div>
        <img src="/platform/signup.jpg" alt="" loading="lazy" />
        <small>Nakshi set</small>
        <b>53.4 g net</b>
      </div>
    </div>
  </Phone>
);

const VDesign = () => (
  <Phone label="A design with its weights and hallmark">
    <div className="hw-zoom">
      <img src="/platform/hero.jpg" alt="" loading="lazy" />
    </div>
    <div className="hw-body">
      <h4>Royal Kundan Choker</h4>
      <span className="hw-pill">Ready in Vault</span>
      <dl>
        <div><dt>Gross weight</dt><dd>48.700 g</dd></div>
        <div><dt>Stone / tare</dt><dd>6.200 g</dd></div>
        <div className="net"><dt>Net weight</dt><dd>42.500 g</dd></div>
        <div><dt>HUID</dt><dd>HM/C-728190</dd></div>
      </dl>
    </div>
  </Phone>
);

const VOrder = () => (
  <Phone label="Shortlist and order">
    <div className="hw-title">Your order</div>
    <ul className="hw-lines">
      <li style={{ ['--i' as string]: 0 }}><img src="/platform/hero.jpg" alt="" loading="lazy" /><span>Royal Kundan Choker<small>2 pcs</small></span><b>85.0 g</b></li>
      <li style={{ ['--i' as string]: 1 }}><img src="/platform/temple.jpg" alt="" loading="lazy" /><span>Kasu Mala Temple<small>3 pcs</small></span><b>158.4 g</b></li>
      <li style={{ ['--i' as string]: 2 }}><img src="/platform/polki.jpg" alt="" loading="lazy" /><span>Polki Bridal Set<small>2 pcs</small></span><b>32.8 g</b></li>
    </ul>
    <div className="hw-total"><span>Net total · 7 pieces</span><b>276.2 g</b></div>
    <div className="hw-btn">Place order</div>
  </Phone>
);

const VWhatsApp = () => (
  <Phone label="The order arriving on WhatsApp">
    <div className="hw-wa-head">WhatsApp</div>
    <div className="hw-chat">
      <div className="hw-msg in">
        <b>New order PO-SHARMA-0142</b>
        <span>7 pieces · 276.2 g net</span>
        <span>Need by 24 Oct for Dhanteras.</span>
      </div>
      <div className="hw-msg out">Confirmed. Dispatching from the vault.</div>
    </div>
  </Phone>
);

const VLanguage = () => (
  <Phone label="English and Hindi">
    <Bar />
    <div className="hw-swap">
      <span className="en">Collections<small>342 designs · weights first</small></span>
      <span className="hi" lang="hi">कलेक्शन<small>342 डिज़ाइन · पहले वज़न</small></span>
    </div>
    <div className="hw-toggle"><span className="a">EN</span><span className="b" lang="hi">हि</span></div>
    <img className="hw-pic" src="/platform/temple.jpg" alt="" loading="lazy" style={{ height: 130 }} />
  </Phone>
);

const FEATURES: Array<{ title: string; text: string; visual: React.ReactNode }> = [
  { title: 'Your own address', text: 'Every store opens at its own [name].antarixs.com, with a QR code to print or share on WhatsApp. Buyers sign in once with their WhatsApp number.', visual: <VAddress /> },
  { title: 'Banners and collections', text: 'A calm home screen: festive banners you change yourself, then your collections, each with its design count and average weight.', visual: <VBanners /> },
  { title: 'A catalogue made for weights', text: 'Search by name, SKU or weight. Filter by purity, net weight and availability, and see every design in a clean grid.', visual: <VCatalogue /> },
  { title: 'Every design, in detail', text: 'Up to three photos a design, gross, stone and net weight, purity and HUID, and a ready-in-vault or made-to-order tag.', visual: <VDesign /> },
  { title: 'Shortlist, then order', text: 'Buyers heart what they like, choose pieces in each purity, add a note and place the order in a few taps.', visual: <VOrder /> },
  { title: 'Orders land on WhatsApp', text: 'Each order reaches you with its weights and note, and the buyer gets a confirmation. Status moves from new to dispatched.', visual: <VWhatsApp /> },
  { title: 'English and Hindi', text: 'Switch the whole store between English and Hindi at any time. The choice is remembered on the device.', visual: <VLanguage /> }
];

const COUNTER = ['Orders desk', 'Insights: kg booked and views', 'Live visitors', 'Buyer engagement', 'WhatsApp enquiries inbox', 'PDF catalogue', 'Banners and purity options', 'Audit log'];

/** "How it works": the features of a [store].antarixs.com store, a photo-led list with a moving picture beside each line. */
export const HowItWorks: React.FC = () => (
  <div className="hw">
    <Reveal>
      <span className="ax-ey">How it works</span>
      <h1 className="hw-h1">A store your dealers can open, in three steps.</h1>
      <p className="ax-mut hw-lead">Name your store, verify on WhatsApp, share the link. Here is what you get at your own address.</p>
    </Reveal>
    <ol className="hw-steps">
      {['Name your store', 'Verify on WhatsApp', 'Share the link or QR'].map((t, i) => (
        <Reveal key={t} as="li" delay={i * 120}>
          <span>0{i + 1}</span>
          {t}
        </Reveal>
      ))}
    </ol>
    {FEATURES.map((f, i) => (
      <section key={f.title} className={`hw-row${i % 2 ? ' flip' : ''}`}>
        <Reveal className="hw-text">
          <span className="ax-ey">0{i + 1}</span>
          <h2>{f.title}</h2>
          <p>{f.text}</p>
        </Reveal>
        <Reveal className="hw-vis" delay={160}>
          {f.visual}
        </Reveal>
      </section>
    ))}
    <section className="hw-counter">
      <Reveal>
        <span className="ax-ey">Behind the counter</span>
        <h2>For the owner, one quiet desk.</h2>
      </Reveal>
      <ul>
        {COUNTER.map((c, i) => (
          <Reveal key={c} as="li" delay={i * 70}>
            {c}
          </Reveal>
        ))}
      </ul>
    </section>
  </div>
);
