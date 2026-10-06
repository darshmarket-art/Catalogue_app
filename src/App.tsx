import { backAction, EXIT_WINDOW_MS } from './nav';
import { usePlan } from './plan';
import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { ActiveScreen, Product, Category, Banner, Purity, About, OrderItem, AnalyticsData, AdminSummary } from './types';
import { api, ApiError, hasStoredSession, setAuthToken, setUnauthorizedHandler } from './api';
import { noteCollection } from './recent';
import { setTagList } from './tagList';
import { isTidying } from './backLayer';
import { BuyerTour, markTourSeen, tourSeen, type TourSample } from './components/BuyerTour';
import { getLang, hn, pur, t, tErr, ts, useLang } from './i18n';
import { merchant } from './merchant';
import { emergent as K } from './layouts/emergent';
import { DEFAULT_LAYOUT } from '../shared/layouts';
import { sector } from './sector';
import { RetailerAuthScreen } from './components/RetailerAuthScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminHubScreen, type OpenTarget } from './components/AdminHubScreen';
import { AdminOrdersScreen } from './components/AdminOrdersScreen';
import { NewProductScreen } from './components/NewProductScreen';
import { AddCategoryScreen } from './components/AddCategoryScreen';
import { AdminCatalogueScreen, type CatalogueSegment } from './components/AdminCatalogueScreen';
import { AdminBuyersHub, type BuyersSegment } from './components/AdminBuyersHub';
import { AdminStoreScreen } from './components/AdminStoreScreen';
import { StoreShareSheet } from './components/StoreShareSheet';
import { currentStoreUrl } from './storeLink';
import { AdminAboutScreen } from './components/AdminAboutScreen';
import type { ProfileUser } from './components/ProfileMenu';
import { AdminPlanScreen } from './components/AdminPlanScreen';
import { PdfCatalogueScreen } from './components/PdfCatalogueScreen';
import { AdminAlertsScreen } from './components/AdminAlertsScreen';
import { AdminMessagesScreen } from './components/AdminMessagesScreen';
import { AdminInsightsScreen } from './components/AdminInsightsScreen';
import { AdminChangePasswordScreen } from './components/AdminChangePasswordScreen';
import { TrialBanner } from './components/TrialBanner';
import { PlansScreen } from './components/PlansCompare';
import { ScreenTop } from './components/ScreenTop';


// The bottom-bar screens (buyer tabs and the admin ones): switching between them fades; going deeper slides forward, coming back slides back.
const TABS: ActiveScreen[] = ['categories', 'catalogue', 'shortlist', 'orders', 'admin-hub', 'admin-buyers', 'admin-store'];
/** Sub-pages opened from Store go back to Store. */
const STORE_CHILDREN: ActiveScreen[] = ['admin-about', 'admin-plan', 'admin-alerts', 'admin-messages', 'admin-insights', 'admin-password'];

// Home to Catalogue is a step deeper (slides forward) and back again slides back, instead of the tab fade.
const DRILL: ActiveScreen[] = ['categories', 'catalogue'];

export default function App() {
  useLang(); // the buyer screens re-render in the chosen language
  const plan = usePlan();
  const { flags } = plan;
  // The current screen lives in the browser history too, so Back/Forward (and a reload) stay inside the app.
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>(
    // A new owner arriving from signup with #new-collection lands straight on the first-collection form.
    () => (window.history.state?.screen as ActiveScreen | undefined) ?? (window.location.hash === '#new-collection' ? 'add-category' : 'welcome')
  );
  // True while a session saved earlier in this tab is being re-checked, so we never flash the login screen.
  const [mustUpdate, setMustUpdate] = useState(false);
  const [booting, setBooting] = useState(() => hasStoredSession());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  // The owner's purity list (defaults until it loads) and the buyer's hearted SKUs.
  const [purities, setPurities] = useState<Purity[]>(sector.purities);
  const [shortlist, setShortlistState] = useState<string[]>([]);
  const shortlistRef = useRef<string[]>([]);
  const setShortlist = (next: string[]) => {
    shortlistRef.current = next;
    setShortlistState(next);
  };
  const [about, setAbout] = useState<About>({});
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    periodLabel: 'Last 7 days',
    views: 0,
    viewsTrend: '0%',
    inquiries: 0,
    bookedOrders: 0,
    bookedWeightKg: 0,
    liveVisitors: 0,
    todayVisitors: 0,
    verifiedToday: 0,
    verifiedMerchants: 0,
    guestRetailers: 0,
    pendingDrafts: 0,
    newOrders: 0
  });
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<Date | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  // The owner's tabs: what is waiting (Today and the tab badges), which segment each tab shows, and where a form returns to.
  const [summary, setSummary] = useState<AdminSummary>({ newOrders: 0, enquiriesWaiting: 0, messagesFailed: 0 });
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'new'>('all');
  const [catalogueSeg, setCatalogueSeg] = useState<CatalogueSegment>('designs');
  const [buyersSeg, setBuyersSeg] = useState<BuyersSegment>('buyers');
  const [formReturn, setFormReturn] = useState<ActiveScreen>('admin-hub');
  const [sharing, setSharing] = useState(false);
  // The New collection form opened from the New design form goes back there, not to the admin hub.
  const [categoryFromProduct, setCategoryFromProduct] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    // A shared link like /?category=Rings opens that category once the buyer is signed in.
    () => new URLSearchParams(window.location.search).get('category')
  );
  // Which Orders tab to open first (the profile menu links straight to past orders).
  // The guided tour for buyers: after a new buyer's first sign-in, or from the profile menu.
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    const open = () => setTouring(true);
    window.addEventListener('app-tour', open);
    return () => window.removeEventListener('app-tour', open);
  }, []);
  // A search or a design Home hands to the Catalogue (used once).
  const [handoff, setHandoff] = useState<{ search: string; sku: string | null }>({ search: '', sku: null });
  const [ordersTab, setOrdersTab] = useState<'current' | 'past'>('current');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  // Signed in with a temporary password: the admin must set their own before any other admin screen opens.
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [currentMerchant, setCurrentMerchant] = useState<ProfileUser | null>(null);
  const isSignedIn = Boolean(currentMerchant) || isAdminLoggedIn;
  
  // Which way the last screen change went, so the page animation slides the right way.
  const [navDir, setNavDir] = useState<'forward' | 'back'>('forward');
  // Switching between the four tabs fades; going deeper or back slides.
  const lastScreen = useRef<ActiveScreen>(currentScreen);

  // Set once the guard entry exists (see the Back handling below); remembered in the history state so a reload keeps it.
  const guardArmed = useRef(Boolean(window.history.state?.g));
  // The Orders tab always opens on "To order". Only the profile menu's "Past orders" link opens it on the past list.
  const keepOrdersTab = useRef(false);
  const handleNavigate = (target: ActiveScreen, _replace = false) => {
    if (target === 'orders') {
      if (!keepOrdersTab.current) setOrdersTab('current');
      keepOrdersTab.current = false;
    }
    // Older owner screens now live inside a tab's segment.
    let screen = target;
    if (target === 'admin-orders') screen = 'orders';
    else if (target === 'admin-visitors') { screen = 'admin-buyers'; setBuyersSeg('activity'); }
    else if (target === 'admin-enquiries') { screen = 'admin-buyers'; setBuyersSeg('enquiries'); }
    else if (target === 'admin-banners') { screen = 'catalogue'; setCatalogueSeg('banners'); }
    else if (target === 'admin-purities') { screen = 'catalogue'; setCatalogueSeg('purities'); }
    setNavDir((TABS.includes(screen) && !TABS.includes(screenRef.current)) || (screen === 'categories' && screenRef.current === 'catalogue') ? 'back' : 'forward');
    setCurrentScreen(screen);
    // One history entry for the whole store (above a guard entry), so Back never walks a trail; see goBack below.
    // A tab swaps the entry; going deeper (a form, About, a sub-screen) adds one, so Back walks back out the way you came.
    const ld = window.history.state?.ld;
    if (guardArmed.current && !TABS.includes(screen) && screen !== screenRef.current) window.history.pushState({ screen, g: 1, ld }, '');
    else window.history.replaceState({ screen, g: guardArmed.current ? 1 : undefined, ld }, '');
  };

  // Back on the web: the page sits on one entry above a "guard" entry. Pressing Back lands on the guard; we put the page back
  // and run goBack (home first, then "press back again to exit", then really leave).
  const screenRef = useRef<ActiveScreen>(currentScreen);
  useEffect(() => {
    // Arrived from creating the store (#new): the signup pages must not be reachable by Back, so leaving closes the tab (or blanks it).
    try {
      if (window.location.hash === '#new' || window.location.hash === '#new-collection') sessionStorage.setItem('fresh-store', '1');
    } catch {
      // storage blocked: Back then leaves to the previous page
    }
    if (window.location.hash === '#new' || window.location.hash === '#new-collection') window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    // Browsers (Chrome, Android) skip history entries a page adds before the visitor has touched it, so the guard entry is added on
    // the first tap or key press, not on load. Until then Back simply leaves, as it would on any page.
    const arm = () => {
      if (guardArmed.current) return;
      guardArmed.current = true;
      window.history.replaceState({ screen: 'guard', g: 1 }, '');
      window.history.pushState({ screen: screenRef.current, g: 1 }, '');
    };
    // It must be armed by an event that counts as a real tap (the end of a touch, a click, a key): browsers skip history entries
    // added before the visitor has genuinely interacted, and a touch's start does not count, which let Back leave the app at once.
    // Capture phase, so it runs before the tap's own handler (which may open a layer of its own).
    const gestures = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    if (!guardArmed.current) gestures.forEach((ev) => window.addEventListener(ev, arm, { passive: true, capture: true }));
    const onPop = (e: PopStateEvent) => {
      // A closed sheet or picker tidying its history entry: stay on the screen the app is showing now.
      if (isTidying()) return void window.history.replaceState({ screen: screenRef.current, g: 1, ld: e.state?.ld }, '');
      const to = e.state?.screen as string | undefined;
      if (to && to !== 'guard') return void setCurrentScreen(to as ActiveScreen);
      window.history.pushState({ screen: screenRef.current, g: 1 }, '');
      backRef.current(() => {
        if (sessionStorage.getItem('fresh-store')) {
          window.close(); // only works for tabs the page opened
          setTimeout(() => window.location.replace('about:blank'), 150);
        } else window.history.go(-2); // past the guard and the page: back to wherever the visitor came from
      });
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      gestures.forEach((ev) => window.removeEventListener(ev, arm, { capture: true }));
    };
  }, []);

  // Android Back button: on Home leave the app; anywhere else go Home first (the handler is kept current below).
  const backRef = useRef<(leave: () => void) => void>(() => {});
  const lastAskAt = useRef(0);
  const [exitHint, setExitHint] = useState(false);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = NativeApp.addListener('backButton', () => backRef.current(() => void NativeApp.exitApp()));
    return () => void sub.then((s) => s.remove());
  }, []);

  // Restore a session saved earlier in this tab (survives reloads; ends when the tab is closed).
  useEffect(() => {
    if (!booting) return;
    api
      .restoreSession()
      .then((session) => {
        if (session?.type === 'retailer') {
          setCurrentMerchant(session.user);
          api.getOrders().then((result) => setOrders(result.items)).catch(() => {});
        } else if (session?.type === 'admin') {
          setIsAdminLoggedIn(true);
          setMustChangePassword(session.mustChangePassword);
          setAdminEmail(session.email);
        }
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    const on = () => setMustUpdate(true);
    window.addEventListener('app-update-required', on);
    return () => window.removeEventListener('app-update-required', on);
  }, []);

  // Any request that finds the token expired or revoked signs the user out once, with a clear message.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      alert(t('Your session has expired. Please sign in again.'));
      handleLogout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Presence heartbeat: tells the server this visitor is here (paused while the tab is hidden).
  // Re-runs on sign-in so a guest session is upgraded to verified straight away.
  useEffect(() => {
    api.sendHeartbeat();
    const interval = setInterval(() => {
      if (!document.hidden) api.sendHeartbeat();
    }, 15000);
    const onVisible = () => {
      if (!document.hidden) api.sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentMerchant, isAdminLoggedIn]);

  // Admin Hub numbers: fetched on open, then every 15 seconds while the tab is visible.
  useEffect(() => {
    if (currentScreen !== 'admin-hub' || !isAdminLoggedIn || !flags.insights) return;

    const refresh = () => {
      if (document.hidden) return;
      api
        .getAnalytics()
        .then((data) => {
          setAnalytics(data);
          setAnalyticsUpdatedAt(new Date());
        })
        .catch(() => {});
    };

    refresh();
    const interval = setInterval(refresh, 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [currentScreen, isAdminLoggedIn, flags.insights]);

  // Catalogue data. A members-only catalogue is loaded after sign-in and cleared on sign-out.
  useEffect(() => {
    if (merchant.catalogueAccess === 'login' && !isSignedIn) {
      setCategories([]);
      setProducts([]);
      setBanners([]);
      setShortlist([]);
      return;
    }
    const fetchData = async () => {
      const [catsData, prodsData, bannerData] = await Promise.all([api.getCategories(), api.getProducts(), api.getBanners()]);
      setBanners(bannerData);
      api.getPurities().then((list) => list && setPurities(list));
      api.getTags().then((list) => list && setTagList(list));
      api.getAbout().then(setAbout);
      if (catsData.length > 0) setCategories(catsData);
      if (prodsData.length > 0) setProducts(prodsData);
    };
    fetchData();
  }, [isSignedIn]);

  // What is waiting for the owner: fetched on sign-in, then every 15 seconds while the tab is visible, and after the owner acts.
  const refreshSummary = () => {
    if (!isAdminLoggedIn) return;
    api.getAdminSummary().then(setSummary).catch(() => {});
  };
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    refreshSummary();
    const interval = setInterval(() => !document.hidden && refreshSummary(), 15000);
    const onVisible = () => !document.hidden && refreshSummary();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAdminLoggedIn, flags.orders, flags.enquiries]);

  // The buyer's shortlist is kept on the server so it follows them to another phone.
  useEffect(() => {
    if (!currentMerchant) return;
    api.getShortlist().then(setShortlist);
  }, [currentMerchant?.phone]);

  const toggleShortlist = (product: Product) => {
    const cur = shortlistRef.current;
    const next = cur.includes(product.sku) ? cur.filter((sku) => sku !== product.sku) : [...cur, product.sku];
    setShortlist(next);
    api.saveShortlist(next).catch(() => {
      // keep what the buyer sees; it is saved again on their next tap
    });
  };

  // Add Item to Order (needs an account)
  const handleAddToOrder = async (product: Product, quantity: number, purity?: string) => {
    try {
      const newItem = await api.addOrderItem({ sku: product.sku, batchQty: quantity, ...(purity ? { purity } : {}) });
      // The server merges a repeat add into the existing line, so replace by id rather than append.
      setOrders((prev) => (prev.some((i) => i.id === newItem.id) ? prev.map((i) => (i.id === newItem.id ? newItem : i)) : [...prev, newItem]));
      // Once a design is in the order it leaves the shortlist.
      if (shortlistRef.current.includes(product.sku)) {
        const next = shortlistRef.current.filter((sku) => sku !== product.sku);
        setShortlist(next);
        api.saveShortlist(next).catch(() => {});
      }
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert(t('Please sign in to your wholesale account to add items to your order.'));
          handleNavigate('retailer-auth');
        } else {
          alert(err.message);
        }
      }
    }
  };

  // Remove Item from Order
  const handleRemoveOrderItem = async (id: string) => {
    try {
      await api.removeOrderItem(id);
    } catch {
      // quiet fallback
    }
    setOrders((prev) => prev.filter((item) => item.id !== id));
  };

  // The design the tour borrows to show the shortlist and the cart: the newest one that is not already in the buyer's order.
  // It is only ever a draft line, removed again before the tour ends; the tour never places an order.
  const latest = useRef({ products, orders });
  latest.current = { products, orders };
  const samplePick = useRef<Product | null>(null);
  const pickSample = () => {
    if (samplePick.current) return samplePick.current;
    const inCart = new Set(latest.current.orders.map((o) => o.sku));
    samplePick.current = latest.current.products.find((p) => !inCart.has(p.sku) && p.stockStatus !== 'Draft') ?? null;
    return samplePick.current;
  };
  const tourSample: TourSample = {
    title: () => pickSample()?.title ?? null,
    heart: () => {
      const p = pickSample();
      if (!p || shortlistRef.current.includes(p.sku)) return false;
      toggleShortlist(p);
      return true;
    },
    unheart: () => {
      const p = pickSample();
      if (p && shortlistRef.current.includes(p.sku)) toggleShortlist(p);
    },
    addToCart: async () => {
      const p = pickSample();
      if (!p) return null;
      try {
        const item = await api.addOrderItem({ sku: p.sku, batchQty: 1 });
        setOrders((prev) => [...prev.filter((i) => i.id !== item.id), item]);
        return item.id;
      } catch {
        return null;
      }
    },
    removeFromCart: (id) => handleRemoveOrderItem(id)
  };

  const handleChangeQty = async (id: string, batchQty: number) => {
    try {
      const next = await api.setOrderItemQty(id, batchQty);
      setOrders((prev) => prev.map((item) => (item.id === id ? { ...item, ...next } : item)));
    } catch (err) {
      if (err instanceof ApiError && !err.handled) alert(err.message);
    }
  };

  // Confirm Order (Pure Gram Settlement Allocation)
  const handleConfirmOrder = async (note?: string): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null> => {
    try {
      const placing = orders;
      const result = await api.confirmOrder(note);
      // In Hindi the WhatsApp message is written in Hindi too.
      if (getLang() === 'hi')
        result.whatsappMessage =
          sector.orderMessageHi({ brandName: ts(merchant.brand.name), store: currentMerchant?.storeName ?? '', poId: result.poId, orders: placing.map((o) => ({ name: hn(o.title, o.titleHi), sku: o.sku, purity: pur(o.purity), batchQty: o.batchQty, totalNetGold: o.totalNetGold })) }) +
          (note?.trim() ? `\n\n*नोट:* ${note.trim()}` : '');
      // The server has turned the batch into an order; the next batch starts empty.
      setOrders([]);
      return result;
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert(t('Please sign in to your wholesale account to confirm this order.'));
          handleNavigate('retailer-auth');
        } else {
          alert(tErr(err.message));
        }
      }
      return null;
    }
  };

  // WhatsApp PO generation
  const handleGenerateWhatsAppPO = (note?: string) => {
    const totalNet = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
    const store = currentMerchant ? currentMerchant.storeName : 'Guest Jeweller';

    // Record inquiry telemetry
    api.recordInquiry({
      clientFirm: store,
      itemsCount: orders.length,
      totalNetWeight: parseFloat(totalNet.toFixed(3))
    });

    if (currentMerchant) void api.recordEnquiry({ kind: 'order', count: orders.length });

    const msg =
      getLang() === 'hi'
        ? sector.orderMessageHi({ brandName: ts(merchant.brand.name), store, orders: orders.map((o) => ({ name: hn(o.title, o.titleHi), sku: o.sku, purity: pur(o.purity), batchQty: o.batchQty, totalNetGold: o.totalNetGold })) }) + (note?.trim() ? `\n\n*नोट:* ${note.trim()}` : '')
        : sector.orderManifest({ brandName: merchant.brand.name, store, orders }) + (note?.trim() ? `\n\n*Note:* ${note.trim()}` : '');

    window.open(`https://wa.me/${merchant.contact.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Product saved (new or edited): resolves true only when the server accepted it
  const handleProductSaved = async (prod: Partial<Product>, id?: string): Promise<boolean> => {
    try {
      if (id) {
        const updated = await api.updateProduct(id, prod);
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        // A product can move between categories, so take the counts from the server.
        api.getCategories().then((cats) => cats.length > 0 && setCategories(cats));
        return true;
      }
      const created = await api.createProduct(prod);
      setProducts((prev) => [created, ...prev]);
      // The server counts designs per category; keep the on-screen count in step without a reload.
      setCategories((prev) => prev.map((c) => (c.name === created.category ? { ...c, designCount: c.designCount + 1 } : c)));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not publish the product.');
      return false;
    }
  };

  const handleProductDeleted = async (product: Product): Promise<boolean> => {
    try {
      await api.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setCategories((prev) => prev.map((c) => (c.name === product.category ? { ...c, designCount: Math.max(0, c.designCount - 1) } : c)));
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the product.');
      return false;
    }
  };

  // Category saved (new or edited): resolves true only when the server accepted it
  const handleCategorySaved = async (cat: Partial<Category>, id?: string): Promise<boolean> => {
    try {
      if (id) {
        const updated = await api.updateCategory(id, cat);
        setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
        // A rename carries the category's products along.
        api.getProducts().then((prods) => prods.length > 0 && setProducts(prods));
        return true;
      }
      const created = await api.createCategory(cat);
      setCategories((prev) => [...prev, created]);
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not create the category.');
      return false;
    }
  };

  const handleCategoryDeleted = async (category: Category): Promise<boolean> => {
    try {
      await api.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      // The server deletes the collection's designs with it.
      setProducts((prev) => prev.filter((p) => p.category !== category.name));
      if (categoryFilter === category.name) setCategoryFilter(null);
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the category.');
      return false;
    }
  };

  const handleHeroSaved = async (ids: string[]): Promise<boolean> => {
    try {
      await api.setHeroCollections(ids);
      setCategories((prev) => prev.map((c) => ({ ...c, heroOrder: ids.includes(c.id) ? ids.indexOf(c.id) : null })));
      return true;
    } catch {
      return false;
    }
  };

  const handleBannerAdded = async (image: string, category?: string): Promise<boolean> => {
    try {
      const created = await api.addBanner(image, category);
      setBanners((prev) => [...prev, created]);
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not add the banner.');
      return false;
    }
  };

  const handleBannerLinked = async (banner: Banner, category: string | null) => {
    try {
      const updated = await api.setBannerLink(banner.id, category);
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, category: updated.category } : b)));
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not change the banner link.');
    }
  };

  const handleBannerDeleted = async (banner: Banner) => {
    try {
      await api.deleteBanner(banner.id);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the banner.');
    }
  };

  const handleAddAllToOrder = async (items: Product[]) => {
    for (const product of items) await handleAddToOrder(product, 1);
  };

  const handleAboutSaved = async (next: About): Promise<string | null> => {
    try {
      setAbout(await api.saveAbout(next));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not save.';
    }
  };

  const handlePuritiesSaved = async (list: Array<{ key: string; enabled: boolean }>): Promise<boolean> => {
    try {
      setPurities(await api.savePurities(list));
      return true;
    } catch {
      return false;
    }
  };

  const handleBannersReordered = async (ids: string[]) => {
    setBanners((prev) => ids.map((id) => prev.find((b) => b.id === id)!).filter(Boolean));
    try {
      await api.reorderBanners(ids);
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not save the banner order.');
    }
  };

  const handleFilterCategoryInCatalogue = (catName: string) => {
    // Promotion banners pass their own headline, which is not always a category: only filter on real categories.
    setCategoryFilter(categories.some((c) => c.name === catName) ? catName : null);
    noteCollection(catName);
    handleNavigate('catalogue');
  };
  const handleSearchDesigns = (search: string) => {
    setCategoryFilter(null);
    setHandoff({ search, sku: null });
    handleNavigate('catalogue');
  };
  const handleOpenDesign = (sku: string) => {
    setCategoryFilter(null);
    setHandoff({ search: '', sku });
    handleNavigate('catalogue');
  };

  const rememberReturn = () => setFormReturn(['admin-hub', 'catalogue'].includes(screenRef.current) ? screenRef.current : 'admin-hub');
  const openProductForm = (product: Product | null) => {
    rememberReturn();
    setEditingProduct(product);
    handleNavigate('new-product');
  };

  /** Opens an owner tab on a given segment (the Today list and quick actions use this). */
  const openTarget = (t: OpenTarget) => {
    if (t.screen === 'orders') setOrdersFilter(t.filter ?? 'all');
    if (t.screen === 'catalogue' && t.segment) setCatalogueSeg(t.segment);
    if (t.screen === 'admin-buyers' && t.segment) setBuyersSeg(t.segment);
    handleNavigate(t.screen);
  };

  const openCategoryForm = (category: Category | null) => {
    rememberReturn();
    setCategoryFromProduct(false);
    setEditingCategory(category);
    handleNavigate('add-category');
  };

  const openOrders = (tab: 'current' | 'past') => {
    keepOrdersTab.current = true;
    setOrdersTab(tab);
    handleNavigate('orders');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setOrders([]);
    setCurrentMerchant(null);
    setIsAdminLoggedIn(false);
    setMustChangePassword(false);
    setAdminEmail(null);
    setEditingProduct(null);
    setEditingCategory(null);
    setCategoryFilter(null);
    setShortlist([]);
    setSummary({ newOrders: 0, enquiriesWaiting: 0, messagesFailed: 0 });
    setOrdersFilter('all');
    handleNavigate('welcome');
  };

  // Members-only portal: signed-out visitors are sent to login / sign-up, and admin tools need an admin session.
  const memberScreens: ActiveScreen[] = merchant.catalogueAccess === 'login' ? ['catalogue', 'categories', 'orders', 'about'] : ['orders'];
  const adminScreens: ActiveScreen[] = ['admin-hub', 'new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-enquiries', 'admin-buyers', 'admin-banners', 'admin-purities', 'admin-store', 'admin-about', 'admin-plan', 'admin-pdf', 'admin-alerts', 'admin-messages', 'admin-insights', 'admin-password'];
  const buyerOnlyScreens: ActiveScreen[] = ['shortlist'];
  let screen: ActiveScreen = currentScreen;
  // Plan limits: Basic has no ordering or PDF catalogue, so those screens fall back to Home.
  if (!flags.orders && (screen === 'orders' || screen === 'admin-orders')) screen = isAdminLoggedIn ? 'admin-hub' : 'categories';
  if (!flags.pdfCatalogue && screen === 'admin-pdf') screen = 'admin-hub';
  if (!flags.alerts && screen === 'admin-alerts') screen = 'admin-hub';
  if (!flags.insights && screen === 'admin-insights') screen = 'admin-hub';
  // Home is the 'categories' screen; the Catalogue tab is the 'catalogue' screen.
  if (isSignedIn && (screen === 'welcome' || screen === 'retailer-auth')) screen = currentMerchant ? (categoryFilter ? 'catalogue' : 'categories') : 'admin-hub';
  if (isAdminLoggedIn && screen === 'admin-login') screen = 'admin-hub';
  if (isAdminLoggedIn && mustChangePassword) screen = 'admin-password';
  const activeScreen: ActiveScreen =
    adminScreens.includes(screen) && !isAdminLoggedIn
        ? 'admin-login'
        : (memberScreens.includes(screen) || buyerOnlyScreens.includes(screen)) && !isSignedIn
          ? 'retailer-auth'
          : buyerOnlyScreens.includes(screen) && !currentMerchant
            ? 'categories'
            : screen;
  useEffect(() => {
    lastScreen.current = activeScreen;
    window.scrollTo(0, 0); // a new screen always opens at its top, not where the last one was scrolled
    // After a restored sign-in the screen changes without a navigation: keep the history entry in step (never touch the guard).
    if (window.history.state?.screen !== 'guard') window.history.replaceState({ screen: activeScreen, g: guardArmed.current ? 1 : undefined, ld: window.history.state?.ld }, '');
  }, [activeScreen]);

  const shouldShowBottomNav =
    ['catalogue', 'categories', 'orders', 'shortlist', 'admin-hub', 'admin-buyers', 'admin-store'].includes(activeScreen);

  const ownTop: Partial<Record<ActiveScreen, { title: string; back: ActiveScreen }>> = {
    'admin-pdf': { title: 'PDF catalogue', back: 'admin-hub' },
    plans: { title: 'Basic and Pro', back: isAdminLoggedIn ? 'admin-plan' : 'welcome' }
  };
  const top = ownTop[activeScreen];

  const homeScreen: ActiveScreen = isAdminLoggedIn ? 'admin-hub' : currentMerchant ? 'categories' : 'welcome';
  // One step up the hierarchy where there is a parent other than home (New collection <- New design).
  const parentScreen: ActiveScreen | null =
    activeScreen === 'add-category' && !editingCategory && categoryFromProduct
      ? 'new-product'
      : isAdminLoggedIn && (activeScreen === 'new-product' || activeScreen === 'add-category')
        ? formReturn
        : isAdminLoggedIn && STORE_CHILDREN.includes(activeScreen)
          ? 'admin-store'
          : null;
  screenRef.current = activeScreen;
  backRef.current = (leave) => {
    if (booting) return;
    if (!window.dispatchEvent(new Event('app-back', { cancelable: true }))) return; // an open design handled it
    if (parentScreen) {
      setCategoryFromProduct(false);
      handleNavigate(parentScreen, true);
      setNavDir('back');
      return;
    }
    const act = backAction(activeScreen, homeScreen, lastAskAt.current, Date.now());
    if (act === 'home') {
      handleNavigate(homeScreen, true);
      setNavDir('back');
    } else if (act === 'leave') leave();
    else {
      lastAskAt.current = Date.now();
      setExitHint(true);
      setTimeout(() => setExitHint(false), EXIT_WINDOW_MS);
    }
  };

  if (mustUpdate)
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Please update the app</h1>
        <p>This version is no longer supported. Install the latest version to continue.</p>
      </div>
    );
  if (booting) return <div className="min-h-screen bg-surface" />;

  return (
    <div data-layout={DEFAULT_LAYOUT} data-role={isAdminLoggedIn ? 'owner' : 'buyer'} className="min-h-screen bg-surface text-on-surface flex flex-col overflow-x-hidden font-sans selection:bg-primary-fixed selection:text-primary">
      {touring && currentMerchant && !isAdminLoggedIn && (
        <BuyerTour
          buyerName={currentMerchant.ownerName || currentMerchant.storeName}
          sample={tourSample}
          onNavigate={(to) => screenRef.current !== to && handleNavigate(to)}
          onClose={() => {
            markTourSeen(currentMerchant.phone);
            samplePick.current = null;
            setTouring(false);
            handleNavigate('categories');
          }}
        />
      )}
      {exitHint && (
        <div role="status" className="em-toast">
          {t('Press back again to exit')}
        </div>
      )}
      {/* Persistent Header */}
      {top && <ScreenTop title={top.title} onBack={() => handleNavigate(top.back)} />}
      {activeScreen !== 'welcome' && !top && (
        <K.Header
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          parentScreen={parentScreen}
          isAdminLoggedIn={isAdminLoggedIn}
          currentMerchant={currentMerchant}
          onLogout={handleLogout}
          onOpenOrders={openOrders}
          isEditing={(activeScreen === 'new-product' && editingProduct !== null) || (activeScreen === 'add-category' && editingCategory !== null)}
          eyebrow={
            activeScreen === 'admin-hub'
              ? `${analytics.periodLabel}${analyticsUpdatedAt ? ` · updated ${analyticsUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}`
              : undefined
          }
          aside={
            activeScreen === 'shortlist' && shortlist.length > 0 ? (
              <span className="tag">
                {shortlist.length} {shortlist.length === 1 ? 'design' : 'designs'}
              </span>
            ) : activeScreen === 'orders' || activeScreen === 'admin-orders' || activeScreen === 'admin-visitors' ? (
              <span className="pro">Pro</span>
            ) : activeScreen === 'admin-hub' ? (
              plan.effectivePlan === 'pro' ? <span className="pro dark">Pro</span> : <span className="tag mut">Basic</span>
            ) : undefined
          }
        />
      )}

      {isAdminLoggedIn && activeScreen !== 'admin-hub' && activeScreen !== 'admin-plan' && activeScreen !== 'plans' && (
        <div style={{ paddingTop: 'calc(var(--header-h) + var(--sat))', marginBottom: 'calc(-1 * (var(--header-h) + var(--sat)))' }}>
          <TrialBanner onOpenPlan={() => handleNavigate('admin-plan')} />
        </div>
      )}

      {/* Main View Container */}
      {/* Keying by screen replays the page-in animation on every navigation, in or out of the app's own history. */}
      <main key={activeScreen} className={`flex-1 w-full ${TABS.includes(lastScreen.current) && TABS.includes(activeScreen) && !(DRILL.includes(lastScreen.current) && DRILL.includes(activeScreen)) ? 'animate-page-in' : navDir === 'back' ? 'animate-page-back' : 'animate-page-forward'} ${activeScreen === 'welcome' ? '' : 'pt-[calc(var(--header-h)+var(--sat))]'}`}>

        {activeScreen === 'welcome' && (
          <K.Welcome onNavigate={handleNavigate} />
        )}

        {activeScreen === 'catalogue' && isAdminLoggedIn && (
          <AdminCatalogueScreen
            segment={catalogueSeg}
            onSegment={setCatalogueSeg}
            categories={categories}
            banners={banners}
            purities={purities}
            onNavigate={handleNavigate}
            onNewProduct={() => openProductForm(null)}
            onEditProduct={openProductForm}
            onDeleteProduct={handleProductDeleted}
            onNewCategory={() => openCategoryForm(null)}
            onEditCategory={openCategoryForm}
            onDeleteCategory={handleCategoryDeleted}
            onBannerLink={handleBannerLinked}
            onBannerAdd={handleBannerAdded}
            onBannerDelete={handleBannerDeleted}
            onBannerReorder={handleBannersReordered}
            onPuritiesSave={handlePuritiesSaved}
            onHeroSave={handleHeroSaved}
            onTagsChanged={() => api.getCategories().then((list) => list.length > 0 && setCategories(list))}
          />
        )}

        {activeScreen === 'catalogue' && !isAdminLoggedIn && (
          <K.Catalogue
            products={products}
            isAdmin={isAdminLoggedIn}
            categoryFilter={categoryFilter}
            categories={categories}
            onCategoryChange={setCategoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onEditProduct={openProductForm}
            onAddToOrder={handleAddToOrder}
            purities={purities}
            shortlist={shortlist}
            onToggleShortlist={toggleShortlist}
            orderCount={orders.length}
            onNavigate={handleNavigate}
            initialSearch={handoff.search}
            initialSku={handoff.sku}
            onInitialUsed={() => setHandoff({ search: '', sku: null })}
          />
        )}

        {activeScreen === 'shortlist' && (
          <K.Shortlist
            products={products}
            shortlist={shortlist}
            storeName={currentMerchant?.storeName ?? ''}
            purities={purities}
            categories={categories}
            onAddToOrder={handleAddToOrder}
            onRemove={toggleShortlist}
            onAddAllToOrder={handleAddAllToOrder}
            onBrowse={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'categories' && (
          <K.Categories
            categories={categories}
            products={products}
            banners={banners}
            isAdmin={isAdminLoggedIn}
            onEditCategory={openCategoryForm}
            onNavigate={handleNavigate}
            onFilterCategoryInCatalogue={handleFilterCategoryInCatalogue}
            onSearchDesigns={handleSearchDesigns}
            onOpenDesign={handleOpenDesign}
          />
        )}

        {/* Staff see every order placed by buyers; buyers see their own order and history */}
        {activeScreen === 'orders' && isAdminLoggedIn && <AdminOrdersScreen key={ordersFilter} initialFilter={ordersFilter} onChanged={refreshSummary} />}

        {activeScreen === 'orders' && !isAdminLoggedIn && (
          <K.Orders
            key={ordersTab}
            initialTab={ordersTab}
            orders={orders}
            onRemoveItem={handleRemoveOrderItem}
            onChangeQty={handleChangeQty}
            onConfirmOrder={handleConfirmOrder}
            onGenerateWhatsAppPO={handleGenerateWhatsAppPO}
            onNavigateCatalogue={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'retailer-auth' && (
          <RetailerAuthScreen
            onNavigate={(next) => handleNavigate(next, true)}
            onLoginSuccess={(user, isNew) => {
              setCurrentMerchant(user);
              // New buyers get the guided tour once (it can be replayed from the profile menu).
              if (isNew && !tourSeen(user.phone)) setTimeout(() => setTouring(true), 450);
              handleNavigate(categoryFilter ? 'catalogue' : 'categories', true);
              if (flags.orders) api.getOrders().then((result) => setOrders(result.items)).catch(() => {});
            }}
          />
        )}

        {activeScreen === 'admin-login' && (
          <AdminLoginScreen
            onNavigate={(next) => handleNavigate(next, true)}
            onAdminLoginSuccess={(forced, email) => {
              setIsAdminLoggedIn(true);
              setAdminEmail(email);
              setMustChangePassword(forced);
              handleNavigate(forced ? 'admin-password' : 'admin-hub', true);
            }}
          />
        )}

        {activeScreen === 'admin-plan' && <AdminPlanScreen categories={categories.length} onNavigate={handleNavigate} />}


        {activeScreen === 'admin-alerts' && <AdminAlertsScreen onNavigate={handleNavigate} />}

        {activeScreen === 'admin-messages' && <AdminMessagesScreen />}

        {activeScreen === 'admin-insights' && <AdminInsightsScreen />}

        {activeScreen === 'admin-password' && (
          <AdminChangePasswordScreen
            forced={mustChangePassword}
            onDone={() => {
              setMustChangePassword(false);
              handleNavigate('admin-hub', true);
            }}
          />
        )}


        {activeScreen === 'admin-pdf' && <PdfCatalogueScreen products={products} categories={categories} />}

        {activeScreen === 'plans' && <PlansScreen />}

        {activeScreen === 'admin-buyers' && <AdminBuyersHub segment={buyersSeg} onSegment={setBuyersSeg} analytics={analytics} waiting={summary.enquiriesWaiting} onChanged={refreshSummary} />}

        {activeScreen === 'admin-store' && (
          <AdminStoreScreen
            summary={summary}
            onNavigate={handleNavigate}
            onShare={() => setSharing(true)}
            onViewAsBuyer={() => handleNavigate('categories')}
            onLogout={handleLogout}
          />
        )}

        {activeScreen === 'about' && <K.About about={about} />}

        {activeScreen === 'admin-about' && <AdminAboutScreen about={about} onSave={handleAboutSaved} />}

        {activeScreen === 'admin-hub' && (
          <AdminHubScreen
            analytics={analytics}
            summary={summary}
            collections={categories.length}
            designs={categories.reduce((n, c) => n + c.designCount, 0)}
            banners={banners.length}
            about={about}
            onNavigate={handleNavigate}
            onOpen={openTarget}
            onShare={() => setSharing(true)}
          />
        )}

        {activeScreen === 'new-product' && (
          <NewProductScreen
            key={editingProduct?.id ?? 'new'}
            categories={categories}
            purities={purities}
            editing={editingProduct}
            onNavigate={(next) => {
              if (next !== 'add-category') setEditingProduct(null);
              else {
                setEditingCategory(null);
                setCategoryFromProduct(true);
              }
              if (next === 'catalogue') setCatalogueSeg('designs');
              handleNavigate(next);
            }}
            onSave={handleProductSaved}
            onDelete={handleProductDeleted}
          />
        )}

        {activeScreen === 'add-category' && (
          <AddCategoryScreen
            key={editingCategory?.id ?? 'new'}
            purityOptions={purities}
            editing={editingCategory}
            onNavigate={(next) => {
              setEditingCategory(null);
              // A collection made from the New design form goes back to it (the new collection is then selectable);
              // otherwise the owner lands on Catalogue > Collections.
              if (!(categoryFromProduct && next === 'categories') && next === 'categories') setCatalogueSeg('collections');
              handleNavigate(categoryFromProduct && next === 'categories' ? 'new-product' : next === 'categories' ? 'catalogue' : next);
              setCategoryFromProduct(false);
            }}
            onSave={handleCategorySaved}
            onDelete={handleCategoryDeleted}
          />
        )}
      </main>

      {sharing && <StoreShareSheet name={merchant.brand.name} url={currentStoreUrl()} onClose={() => setSharing(false)} />}

      {/* Bottom Navigation */}
      {shouldShowBottomNav && (
        <K.BottomNav
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          orderCount={orders.length}
          shortlistCount={shortlist.length}
          isAdminLoggedIn={isAdminLoggedIn}
          adminBadges={{ orders: summary.newOrders, buyers: summary.enquiriesWaiting }}
        />
      )}

    </div>
  );
}
