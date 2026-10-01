import { useState, useEffect } from 'react';
import { ActiveScreen, Product, Category, Banner, Purity, OrderItem, AnalyticsData } from './types';
import { api, ApiError, hasStoredSession, setAuthToken, setUnauthorizedHandler } from './api';
import { merchant } from './merchant';
import { sector } from './sector';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CatalogueScreen } from './components/CatalogueScreen';
import { CategoriesScreen } from './components/CategoriesScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { RetailerAuthScreen } from './components/RetailerAuthScreen';
import { AdminLoginScreen } from './components/AdminLoginScreen';
import { AdminHubScreen } from './components/AdminHubScreen';
import { AdminOrdersScreen } from './components/AdminOrdersScreen';
import { NewProductScreen } from './components/NewProductScreen';
import { AddCategoryScreen } from './components/AddCategoryScreen';
import { AdminVisitorsScreen } from './components/AdminVisitorsScreen';
import { AdminBannersScreen } from './components/AdminBannersScreen';
import { AdminPuritiesScreen } from './components/AdminPuritiesScreen';
import { ShortlistScreen } from './components/ShortlistScreen';
import { AdminBuyersScreen } from './components/AdminBuyersScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import type { ProfileUser } from './components/ProfileMenu';

export default function App() {
  // The current screen lives in the browser history too, so Back/Forward (and a reload) stay inside the app.
  const [currentScreen, setCurrentScreen] = useState<ActiveScreen>(
    () => (window.history.state?.screen as ActiveScreen | undefined) ?? 'welcome'
  );
  // True while a session saved earlier in this tab is being re-checked, so we never flash the login screen.
  const [booting, setBooting] = useState(() => hasStoredSession());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  // The owner's purity list (defaults until it loads) and the buyer's hearted SKUs.
  const [purities, setPurities] = useState<Purity[]>(sector.purities);
  const [shortlist, setShortlist] = useState<string[]>([]);
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
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    // A shared link like /?category=Rings opens that category once the buyer is signed in.
    () => new URLSearchParams(window.location.search).get('category')
  );
  // Which Orders tab to open first (the profile menu links straight to past orders).
  const [ordersTab, setOrdersTab] = useState<'current' | 'past'>('current');
  // Set when the owner has reset this buyer's password: they must choose a new one before using the catalogue.
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [currentMerchant, setCurrentMerchant] = useState<ProfileUser | null>(null);
  const isSignedIn = Boolean(currentMerchant) || isAdminLoggedIn;
  
  const handleNavigate = (screen: ActiveScreen, replace = false) => {
    setCurrentScreen(screen);
    if (replace) window.history.replaceState({ screen }, '');
    else if (window.history.state?.screen !== screen) window.history.pushState({ screen }, '');
  };

  useEffect(() => {
    if (!window.history.state?.screen) window.history.replaceState({ screen: currentScreen }, '');
    const onPop = (e: PopStateEvent) => setCurrentScreen((e.state?.screen as ActiveScreen | undefined) ?? 'welcome');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Restore a session saved earlier in this tab (survives reloads; ends when the tab is closed).
  useEffect(() => {
    if (!booting) return;
    api
      .restoreSession()
      .then((session) => {
        if (session?.type === 'retailer') {
          setCurrentMerchant(session.user);
          setMustChangePassword(session.mustChangePassword);
          api.getOrders().then((result) => setOrders(result.items));
        } else if (session?.type === 'admin') {
          setIsAdminLoggedIn(true);
        }
      })
      .finally(() => setBooting(false));
  }, []);

  // Any request that finds the token expired or revoked signs the user out once, with a clear message.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      alert('Your session has expired. Please sign in again.');
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
    if (currentScreen !== 'admin-hub' || !isAdminLoggedIn) return;

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
  }, [currentScreen, isAdminLoggedIn]);

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
      if (catsData.length > 0) setCategories(catsData);
      if (prodsData.length > 0) setProducts(prodsData);
    };
    fetchData();
  }, [isSignedIn]);

  // The buyer's shortlist is kept on the server so it follows them to another phone.
  useEffect(() => {
    if (!currentMerchant) return;
    api.getShortlist().then(setShortlist);
  }, [currentMerchant?.phone]);

  const toggleShortlist = (product: Product) => {
    const next = shortlist.includes(product.sku) ? shortlist.filter((sku) => sku !== product.sku) : [...shortlist, product.sku];
    setShortlist(next);
    api.saveShortlist(next).catch(() => {
      // keep what the buyer sees; it is saved again on their next tap
    });
  };

  // Add Item to Order (needs an account)
  const handleAddToOrder = async (product: Product, quantity: number, purity?: string) => {
    try {
      const newItem = await api.addOrderItem({ sku: product.sku, batchQty: quantity, ...(purity ? { purity } : {}) });
      setOrders((prev) => [...prev, newItem]);
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert('Please sign in to your wholesale account to add items to your order.');
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

  // Confirm Order (Pure Gram Settlement Allocation)
  const handleConfirmOrder = async (): Promise<{ poId: string; totalNetGrams: number; whatsappMessage: string } | null> => {
    try {
      const result = await api.confirmOrder();
      // The server has turned the batch into an order; the next batch starts empty.
      setOrders([]);
      return result;
    } catch (err) {
      if (err instanceof ApiError && !err.handled) {
        if (err.status === 401) {
          alert('Please sign in to your wholesale account to confirm this order.');
          handleNavigate('retailer-auth');
        } else {
          alert(err.message);
        }
      }
      return null;
    }
  };

  // WhatsApp PO generation
  const handleGenerateWhatsAppPO = () => {
    const totalNet = orders.reduce((sum, item) => sum + (item.totalNetGold || 0), 0);
    const store = currentMerchant ? currentMerchant.storeName : 'Guest Jeweller';

    // Record inquiry telemetry
    api.recordInquiry({
      clientFirm: store,
      itemsCount: orders.length,
      totalNetWeight: parseFloat(totalNet.toFixed(3))
    });

    const msg = sector.orderManifest({ brandName: merchant.brand.name, store, orders });

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
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.handled)) alert(err instanceof Error ? err.message : 'Could not delete the category.');
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
    handleNavigate('catalogue');
  };

  const openProductForm = (product: Product | null) => {
    setEditingProduct(product);
    handleNavigate('new-product');
  };

  const openCategoryForm = (category: Category | null) => {
    setEditingCategory(category);
    handleNavigate('add-category');
  };

  const openOrders = (tab: 'current' | 'past') => {
    setOrdersTab(tab);
    handleNavigate('orders');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setOrders([]);
    setCurrentMerchant(null);
    setIsAdminLoggedIn(false);
    setMustChangePassword(false);
    setEditingProduct(null);
    setEditingCategory(null);
    setCategoryFilter(null);
    setShortlist([]);
    handleNavigate('welcome');
  };

  // Members-only portal: signed-out visitors are sent to login / sign-up, and admin tools need an admin session.
  const memberScreens: ActiveScreen[] = merchant.catalogueAccess === 'login' ? ['catalogue', 'categories', 'orders'] : ['orders'];
  const adminScreens: ActiveScreen[] = ['admin-hub', 'new-product', 'add-category', 'admin-orders', 'admin-visitors', 'admin-buyers', 'admin-banners', 'admin-purities'];
  const buyerOnlyScreens: ActiveScreen[] = ['change-password', 'shortlist'];
  let screen: ActiveScreen = currentScreen;
  // Home is the 'categories' screen; the Catalogue tab is the 'catalogue' screen.
  if (isSignedIn && (screen === 'welcome' || screen === 'retailer-auth')) screen = currentMerchant ? (categoryFilter ? 'catalogue' : 'categories') : 'admin-hub';
  if (isAdminLoggedIn && screen === 'admin-login') screen = 'admin-hub';
  const activeScreen: ActiveScreen =
    currentMerchant && mustChangePassword
      ? 'change-password'
      : adminScreens.includes(screen) && !isAdminLoggedIn
        ? 'admin-login'
        : (memberScreens.includes(screen) || buyerOnlyScreens.includes(screen)) && !isSignedIn
          ? 'retailer-auth'
          : buyerOnlyScreens.includes(screen) && !currentMerchant
            ? 'categories'
            : screen;

  const shouldShowBottomNav =
    ['catalogue', 'categories', 'orders', 'shortlist', 'admin-hub'].includes(activeScreen) && !(currentMerchant && mustChangePassword);

  if (booting) return <div className="min-h-screen bg-surface" />;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-sans selection:bg-primary-fixed selection:text-primary">
      {/* Persistent Header */}
      {activeScreen !== 'welcome' && (
        <Header
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          isAdminLoggedIn={isAdminLoggedIn}
          currentMerchant={currentMerchant}
          onLogout={handleLogout}
          onOpenOrders={openOrders}
          isEditing={(activeScreen === 'new-product' && editingProduct !== null) || (activeScreen === 'add-category' && editingCategory !== null)}
        />
      )}

      {/* Main View Container */}
      {/* Keying by screen replays the page-in animation on every navigation, in or out of the app's own history. */}
      <main key={activeScreen} className={`flex-1 w-full animate-page-in ${activeScreen === 'welcome' ? '' : 'pt-[72px]'}`}>
        {activeScreen === 'welcome' && (
          <WelcomeScreen onNavigate={handleNavigate} />
        )}

        {activeScreen === 'catalogue' && (
          <CatalogueScreen
            products={products}
            isAdmin={isAdminLoggedIn}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            onEditProduct={openProductForm}
            onAddToOrder={handleAddToOrder}
            purities={purities}
            shortlist={shortlist}
            onToggleShortlist={toggleShortlist}
          />
        )}

        {activeScreen === 'shortlist' && (
          <ShortlistScreen
            products={products}
            shortlist={shortlist}
            storeName={currentMerchant?.storeName ?? ''}
            onRemove={toggleShortlist}
            onAddAllToOrder={handleAddAllToOrder}
            onBrowse={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'categories' && (
          <CategoriesScreen
            categories={categories}
            products={products}
            banners={banners}
            isAdmin={isAdminLoggedIn}
            onEditCategory={openCategoryForm}
            onNavigate={handleNavigate}
            onFilterCategoryInCatalogue={handleFilterCategoryInCatalogue}
          />
        )}

        {/* Staff see every order placed by buyers; buyers see their own order and history */}
        {activeScreen === 'orders' && isAdminLoggedIn && <AdminOrdersScreen />}

        {activeScreen === 'orders' && !isAdminLoggedIn && (
          <OrdersScreen
            key={ordersTab}
            initialTab={ordersTab}
            orders={orders}
            onRemoveItem={handleRemoveOrderItem}
            onConfirmOrder={handleConfirmOrder}
            onGenerateWhatsAppPO={handleGenerateWhatsAppPO}
            onNavigateCatalogue={() => handleNavigate('catalogue')}
          />
        )}

        {activeScreen === 'retailer-auth' && (
          <RetailerAuthScreen
            onNavigate={(next) => handleNavigate(next, true)}
            onLoginSuccess={(user, mustChange) => {
              setCurrentMerchant(user);
              setMustChangePassword(mustChange);
              handleNavigate(categoryFilter ? 'catalogue' : 'categories', true);
              api.getOrders().then((result) => setOrders(result.items));
            }}
          />
        )}

        {activeScreen === 'admin-login' && (
          <AdminLoginScreen
            onNavigate={(next) => handleNavigate(next, true)}
            onAdminLoginSuccess={() => {
              setIsAdminLoggedIn(true);
              handleNavigate('admin-hub', true);
            }}
          />
        )}

        {activeScreen === 'admin-orders' && <AdminOrdersScreen />}

        {activeScreen === 'admin-visitors' && <AdminVisitorsScreen />}

        {activeScreen === 'admin-buyers' && <AdminBuyersScreen />}

        {activeScreen === 'admin-banners' && <AdminBannersScreen banners={banners} categories={categories} onLink={handleBannerLinked} onAdd={handleBannerAdded} onDelete={handleBannerDeleted} onReorder={handleBannersReordered} />}

        {activeScreen === 'admin-purities' && <AdminPuritiesScreen purities={purities} onSave={handlePuritiesSaved} />}

        {activeScreen === 'change-password' && (
          <ChangePasswordScreen
            required={mustChangePassword}
            onDone={() => {
              setMustChangePassword(false);
              alert('Your password has been changed.');
              handleNavigate('categories', true);
            }}
            onCancel={() => handleNavigate('categories')}
          />
        )}

        {activeScreen === 'admin-hub' && (
          <AdminHubScreen
            analytics={analytics}
            updatedAt={analyticsUpdatedAt}
            onNavigate={handleNavigate}
            onOpenVisitors={() => handleNavigate('admin-visitors')}
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
              handleNavigate(next);
            }}
            onSave={handleCategorySaved}
            onDelete={handleCategoryDeleted}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      {shouldShowBottomNav && (
        <BottomNav
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          orderCount={orders.length}
          shortlistCount={shortlist.length}
          isAdminLoggedIn={isAdminLoggedIn}
        />
      )}

    </div>
  );
}
