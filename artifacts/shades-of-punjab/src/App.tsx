import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import {
  useCreateProduct, useCreateStore, useDeleteProduct, useDeleteStore, useGetAdminAccess,
  useGetProduct, useGetSiteSettings, useListCategories, useListProducts,
  useListStores, useListAdminProducts, useUpdateProduct, useUpdateSiteSettings, useUpdateStore,
  getGetAdminAccessQueryKey, getGetProductQueryKey, getGetSiteSettingsQueryKey, getListCategoriesQueryKey,
  getListAdminProductsQueryKey, getListProductsQueryKey, getListStoresQueryKey,
} from '@workspace/api-client-react';
import type { Product, ProductInput, ProductUpdate, SiteSettingsInput, Store, StoreInput, StoreUpdate } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleAlert,
  Instagram, Menu, Minus, Plus, Search, ShoppingBag, Trash2, X, MapPin, Pencil,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const heroFallback = `${basePath}/punjab-editorial-hero.jpg`;
const defaultBrand = 'Shades of Punjab';

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#70283f', colorForeground: '#1f2a3b', colorMutedForeground: '#72716e',
    colorDanger: '#a83232', colorBackground: '#f7f4ed', colorInput: '#fbf9f4',
    colorInputForeground: '#1f2a3b', colorNeutral: '#d9d3c7',
    fontFamily: '"DM Sans", sans-serif', borderRadius: '0.35rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#f7f4ed] rounded-xl w-[440px] max-w-full overflow-hidden border border-[#ded8cc]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'font-serif text-[#1f2a3b]', headerSubtitle: 'text-[#72716e]',
    socialButtonsBlockButtonText: 'text-[#1f2a3b]', formFieldLabel: 'text-[#1f2a3b]',
    footerActionLink: 'text-[#70283f]', footerActionText: 'text-[#72716e]',
    dividerText: 'text-[#72716e]', identityPreviewEditButton: 'text-[#70283f]',
    formFieldSuccessText: 'text-[#315d48]', alertText: 'text-[#1f2a3b]',
    logoBox: 'mx-auto', logoImage: 'max-h-12', socialButtonsBlockButton: 'border-[#d9d3c7] bg-[#fbf9f4]',
    formButtonPrimary: 'bg-[#70283f] hover:bg-[#542033]', formFieldInput: 'bg-[#fbf9f4] text-[#1f2a3b] border-[#d9d3c7]',
    footerAction: 'border-t border-[#ded8cc]', dividerLine: 'bg-[#ded8cc]',
    alert: 'bg-[#f3e9e5] border-[#d9c6bd]', otpCodeFieldInput: 'bg-[#fbf9f4]',
    formFieldRow: 'text-[#1f2a3b]', main: 'text-[#1f2a3b]',
  },
};

type CartItem = { product: Product; quantity: number; size?: string };
const readCart = (): CartItem[] => {
  try { return JSON.parse(localStorage.getItem('sop-cart') || '[]') as CartItem[]; }
  catch { return []; }
};
const money = (value: number | null | undefined) => value == null ? 'Price to be confirmed' : `₹${value.toLocaleString('en-IN')}`;
const imageFor = (product?: Product | null) => product?.imageUrls?.[0] || '';
const parseLines = (value = '') => value.split('\n').map((s) => s.trim()).filter(Boolean);

function useCart() {
  const [items, setItems] = useState<CartItem[]>(readCart);
  useEffect(() => {
    const sync = (event: Event) => {
      const next = event instanceof CustomEvent ? event.detail as CartItem[] : readCart();
      setItems(next);
    };
    window.addEventListener('sop-cart-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sop-cart-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const commit = (update: (old: CartItem[]) => CartItem[]) => {
    const next = update(items);
    setItems(next);
    localStorage.setItem('sop-cart', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('sop-cart-change', { detail: next }));
  };
  const add = (product: Product, size?: string) => commit((old) => {
    const existing = old.find((item) => item.product.id === product.id && item.size === size);
    return existing
      ? old.map((item) => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
      : [...old, { product, quantity: 1, size }];
  });
  const change = (id: number, size: string | undefined, delta: number) => commit((old) =>
    old.map((item) => item.product.id === id && item.size === size ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  const remove = (id: number, size?: string) => commit((old) => old.filter((item) => !(item.product.id === id && item.size === size)));
  return { items, add, change, remove, count: items.reduce((n, x) => n + x.quantity, 0) };
}

function Header({ settings, count }: { settings?: { brandName: string; instagramUrl?: string }; count: number }) {
  const [open, setOpen] = useState(false);
  const brand = settings?.brandName || defaultBrand;
  return <header className="site-header" data-testid="site-header">
    <div className="header-inner">
      <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setOpen(!open)} data-testid="button-menu">
        {open ? <X size={21}/> : <Menu size={21}/>}
      </button>
      <Link href="/" className="wordmark" data-testid="link-brand">
        <span className="brand-mark">SP</span><span>{brand}<small>JAMSHEDPUR · INDIA</small></span>
      </Link>
      <nav className={`main-nav ${open ? 'nav-open' : ''}`} aria-label="Main navigation">
        <Link href="/shop" data-testid="link-shop">Shop</Link>
        <Link href="/collections/featured" data-testid="link-collections">Collections</Link>
        <Link href="/about" data-testid="link-about">Our story</Link>
        <Link href="/stores" data-testid="link-stores">Visit us</Link>
        <Link href="/offers" data-testid="link-offers">Offers</Link>
      </nav>
      <div className="header-actions">
        {settings?.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="icon-button social-link" aria-label="Instagram" data-testid="link-instagram"><Instagram size={18}/></a>}
        <Link href="/sign-in" className="account-link" data-testid="link-sign-in">Account</Link>
        <Link href="/cart" className="bag-link" aria-label={`Shopping bag, ${count} items`} data-testid="link-cart">
          Bag <span className="bag-count">{count}</span><ShoppingBag size={17}/>
        </Link>
      </div>
    </div>
  </header>;
}

function Footer({ settings }: { settings?: { brandName: string; instagramUrl?: string } }) {
  return <footer className="site-footer">
    <div className="footer-main">
      <div><Link href="/" className="wordmark footer-wordmark" data-testid="link-footer-brand"><span className="brand-mark">SP</span><span>{settings?.brandName || defaultBrand}<small>JAMSHEDPUR · INDIA</small></span></Link><p>Clothing, considered.</p></div>
      <div className="footer-links"><span className="eyebrow">Explore</span><Link href="/shop" data-testid="footer-shop">Shop all</Link><Link href="/collections/featured" data-testid="footer-collections">Collections</Link><Link href="/about" data-testid="footer-about">Our story</Link></div>
      <div className="footer-links"><span className="eyebrow">Find us</span><Link href="/stores" data-testid="footer-stores">Stores in Jamshedpur</Link><Link href="/offers" data-testid="footer-offers">Offers</Link>{settings?.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer" data-testid="footer-instagram">Instagram <ArrowUpRight size={13}/></a>}</div>
      <div className="footer-note"><span className="eyebrow">A note</span><p>Product, store and brand details are maintained by the Shades of Punjab team. Please check back as information is confirmed.</p></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} {settings?.brandName || defaultBrand}</span><Link href="/admin" data-testid="footer-admin">Owner access</Link><span>Jamshedpur, Jharkhand</span></div>
  </footer>;
}

function Shell({ children }: { children: ReactNode }) {
  const { data: settings } = useGetSiteSettings();
  const cart = useCart();
  return <><Header settings={settings} count={cart.count}/>{children}<Footer settings={settings}/></>;
}

function Loading({ label = 'Loading the latest details' }: { label?: string }) {
  return <div className="loading-block" role="status" data-testid="status-loading"><span className="skeleton-line"/><span className="skeleton-line short"/><span className="sr-only">{label}</span></div>;
}
function ErrorState({ retry, label = 'We couldn’t load this just now.' }: { retry: () => void; label?: string }) {
  return <div className="state-panel" role="alert" data-testid="status-error"><CircleAlert size={24}/><h2>{label}</h2><p>Please try again in a moment.</p><button className="button button-outline" onClick={retry} data-testid="button-retry">Try again</button></div>;
}
function PageIntro({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{text && <p>{text}</p>}</div>;
}

function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.slug}`} className="product-card" data-testid={`card-product-${product.id}`}>
    <div className="product-image">
      {imageFor(product) ? <img src={imageFor(product)} alt={product.name} loading="lazy" data-testid={`img-product-${product.id}`}/> : <div className="image-placeholder"><span>Image awaiting owner upload</span></div>}
      {product.isNewArrival && <span className="product-tag">New arrival</span>}
      {!product.stock && product.stock === 0 && <span className="product-tag sold-tag">Unavailable</span>}
    </div>
    <div className="product-card-meta"><div><h3>{product.name}</h3><p>{product.category || 'Category to be confirmed'}</p></div><span>{money(product.priceInr)}</span></div>
  </Link>;
}
function EmptyProducts({ query }: { query?: string }) {
  return <div className="empty-catalog" data-testid="empty-products"><div className="empty-stamp">S<span>·</span>P</div><span className="eyebrow">The edit is being prepared</span><h2>{query ? 'Nothing matches that search yet.' : 'A little room for what’s next.'}</h2><p>{query ? 'Try another search or clear your filters.' : 'The collection will appear here once the owner adds and publishes products.'}</p></div>;
}

function HomePage() {
  const { data: settings, isLoading: settingsLoading, isError: settingsError, refetch: refetchSettings } = useGetSiteSettings();
  const { data: products, isLoading, isError, refetch } = useListProducts({ sort: 'featured' });
  const { data: stores } = useListStores();
  const categories = settings?.categories || [];
  return <Shell><main>
    {settingsError ? <div className="content-width"><ErrorState retry={() => { void refetchSettings(); }}/></div> : <section className="hero" data-testid="home-hero">
      <img className="hero-photo" src={settings?.heroImageUrl || heroFallback} alt="Editorial atmosphere for Shades of Punjab" data-testid="img-home-hero"/>
      <div className="hero-overlay"/>
      <div className="hero-copy"><span className="eyebrow light-eyebrow">A wardrobe with a point of view</span>
        <h1>{settings?.heroHeadline || 'Style, with a sense of place.'}</h1>
        <p>{settings?.heroSubheading || 'Discover the Shades of Punjab edit.'}</p>
        <Link href="/shop" className="button button-ivory" data-testid="button-hero-shop">Explore the edit <ArrowRight size={16}/></Link>
      </div>
      <div className="hero-caption"><span>01 / 03</span><span>Jamshedpur, India</span></div>
      <div className="hero-vertical">SHADES OF PUNJAB</div>
    </section>}
    <section className="intro-strip content-width"><span className="eyebrow">The point of view</span><p>Clothing that brings together a sense of heritage and the ease of now.</p><span className="gold-rule"/></section>
    {categories.length > 0 && <section className="category-section content-width">
      <div className="section-heading"><div><span className="eyebrow">Find your way in</span><h2>Shop by category</h2></div><Link href="/shop" className="text-link" data-testid="link-all-categories">All clothing <ArrowRight size={15}/></Link></div>
      <div className="category-list">{categories.map((name, i) => <Link className="category-tile" href={`/shop?category=${encodeURIComponent(name)}`} key={name} data-testid={`category-${i}`}>
        <span className="category-index">0{i + 1}</span><span>{name}</span><ArrowUpRight size={18}/>
      </Link>)}</div>
    </section>}
    <section className="featured-section">
      <div className="content-width">
        <div className="section-heading"><div><span className="eyebrow">Selected for you</span><h2>{settings?.featuredCollectionTitle || 'The latest edit'}</h2>{settings?.featuredCollectionDescription && <p>{settings.featuredCollectionDescription}</p>}</div><Link href="/collections/featured" className="text-link" data-testid="link-featured-collection">View collection <ArrowRight size={15}/></Link></div>
        {isLoading ? <div className="product-grid"><Loading/><Loading/><Loading/></div> : isError ? <ErrorState retry={() => { void refetch(); }}/> :
          products?.some((p) => p.isFeatured) ? <div className="product-grid">{products.filter((p) => p.isFeatured).slice(0, 4).map((p) => <ProductCard key={p.id} product={p}/>)}</div> : <EmptyProducts/>}
      </div>
    </section>
    <section className="story-band">
      <div className="story-image"><img src={heroFallback} alt="A quiet detail in the Shades of Punjab visual world" loading="lazy"/></div>
      <div className="story-copy"><span className="eyebrow">A story still unfolding</span><h2>Rooted in place.<br/><em>Open to possibility.</em></h2><p>{settings?.aboutStory || 'The brand story is being shaped by its owners. We look forward to sharing more soon.'}</p><Link className="text-link" href="/about" data-testid="link-story">Read our story <ArrowRight size={15}/></Link></div>
    </section>
    <section className="store-invite content-width"><div><span className="eyebrow">In good company</span><h2>Find us in<br/><em>Jamshedpur.</em></h2><p>{stores?.length ? 'Visit our locations in person. Store details are listed with owner verification status.' : 'Store information is being confirmed by the owner.'}</p><Link href="/stores" className="button button-dark" data-testid="button-store-locator">Explore our stores <ArrowRight size={16}/></Link></div><div className="store-ornament"><span>J</span><small>22°48′N<br/>86°12′E</small></div></section>
    <section className="newsletter-note"><span className="eyebrow">Stay in the loop</span><h2>Good things, when they’re ready.</h2><p>Follow our Instagram for updates from the store.</p>{settings?.instagramUrl ? <a className="button button-outline" href={settings.instagramUrl} target="_blank" rel="noreferrer" data-testid="button-follow-instagram"><Instagram size={16}/> Follow along <ArrowUpRight size={14}/></a> : <p className="verification-note">Instagram link awaiting owner confirmation.</p>}</section>
    {settingsLoading && <span className="sr-only">Loading brand settings</span>}
  </main></Shell>;
}

function ShopPage() {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get('query') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [sort, setSort] = useState('featured');
  const listParams = useMemo(() => ({ ...(query.trim() ? { query: query.trim() } : {}), ...(category ? { category } : {}), sort: sort as 'featured' | 'newest' | 'price-asc' | 'price-desc' }), [query, category, sort]);
  const { data: products, isLoading, isError, refetch } = useListProducts(listParams);
  const { data: categories } = useListCategories();
  return <Shell><main className="content-width page-shell">
    <PageIntro eyebrow="The collection" title="Shop the edit" text="Search the published collection, or browse by category."/>
    <div className="catalog-controls">
      <label className="search-box"><Search size={18}/><span className="sr-only">Search clothing</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clothing" data-testid="input-product-search"/></label>
      <label className="select-wrap"><span className="sr-only">Filter by category</span><select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-category"><option value="">All categories</option>{(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}</select><ChevronDown size={15}/></label>
      <label className="select-wrap"><span className="sr-only">Sort products</span><select value={sort} onChange={(e) => setSort(e.target.value)} data-testid="select-sort"><option value="featured">Featured</option><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select><ChevronDown size={15}/></label>
      <span className="result-count" data-testid="text-result-count">{products?.length || 0} pieces</span>
    </div>
    {isLoading ? <div className="product-grid"><Loading/><Loading/><Loading/><Loading/></div> : isError ? <ErrorState retry={() => { void refetch(); }}/> : products?.length ?
      <div className="product-grid catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product}/>)}</div> : <EmptyProducts query={query}/>}
  </main></Shell>;
}

function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useGetProduct(slug);
  const cart = useCart();
  const [size, setSize] = useState('');
  const [added, setAdded] = useState(false);
  if (isLoading) return <Shell><main className="content-width page-shell"><Loading/></main></Shell>;
  if (isError || !product) return <Shell><main className="content-width page-shell"><ErrorState retry={() => { void refetch(); }} label="This product isn’t available right now."/></main></Shell>;
  return <Shell><main className="content-width product-detail">
    <Link href="/shop" className="back-link" data-testid="link-back-shop"><ArrowLeft size={15}/> Back to the edit</Link>
    <div className="product-detail-grid">
      <div className="product-gallery">{product.imageUrls.length ? product.imageUrls.map((src, i) => <img key={`${src}-${i}`} src={src} alt={`${product.name} ${i + 1}`} data-testid={`img-product-detail-${i}`}/>) : <div className="detail-image-empty">Product photography<br/>awaiting owner upload</div>}</div>
      <div className="product-info"><span className="eyebrow">{product.category || 'Category awaiting confirmation'}</span><h1>{product.name}</h1><p className="detail-price">{money(product.priceInr)}</p><div className="gold-rule"/>
        <p className="detail-description">{product.description || 'Description awaiting owner confirmation.'}</p>
        {product.colors.length > 0 && <div className="detail-option"><span className="option-label">Colour</span><div className="option-text">{product.colors.join(' · ')}</div></div>}
        {product.sizes.length > 0 && <fieldset className="detail-option"><legend className="option-label">Select a size</legend><div className="size-list">{product.sizes.map((s) => <button key={s} type="button" className={`size-button ${size === s ? 'selected' : ''}`} onClick={() => setSize(s)} aria-pressed={size === s} data-testid={`button-size-${s}`}>{s}</button>)}</div></fieldset>}
        {product.stock === 0 ? <p className="stock-note">Currently unavailable. Please check back later.</p> : <><button className="button button-dark full-button" disabled={product.stock == null || (product.sizes.length > 0 && !size)} onClick={() => { cart.add(product, size || undefined); setAdded(true); window.setTimeout(() => setAdded(false), 2200); }} data-testid="button-add-to-bag">{added ? <><Check size={17}/> Added to bag</> : <>Add to bag <ShoppingBag size={16}/></>}</button>{product.stock == null && <p className="verification-note">Availability awaiting owner confirmation.</p>}</>}
        <p className="verification-note">Availability and product details are provided by the store.</p>
      </div>
    </div>
  </main></Shell>;
}

function StoresPage() {
  const { data: stores, isLoading, isError, refetch } = useListStores();
  const displayStores = stores?.length ? stores : [
    { id: -1, name: 'Jamshedpur location 01', address: null, phone: null, whatsapp: null, openingHours: null, mapsUrl: null, imageUrl: null, description: null },
    { id: -2, name: 'Jamshedpur location 02', address: null, phone: null, whatsapp: null, openingHours: null, mapsUrl: null, imageUrl: null, description: null },
  ] as Store[];
  return <Shell><main className="content-width page-shell">
    <PageIntro eyebrow="Come by" title="Our stores" text="Two distinct Jamshedpur location records. Details are shown only when confirmed by the owner."/>
    {isLoading ? <div className="store-grid"><Loading/><Loading/></div> : isError ? <ErrorState retry={() => { void refetch(); }}/> :
      <div className="store-grid">{displayStores.map((store, i) => <article className="store-card" key={store.id} data-testid={`card-store-${store.id}`}>
        <div className="store-card-image">{store.imageUrl ? <img src={store.imageUrl} alt={store.name}/> : <div className="store-image-placeholder"><MapPin size={24}/><span>Store photography awaiting owner upload</span></div>}<span className="store-number">0{i + 1}</span></div>
        <div className="store-card-body"><span className="eyebrow">Jamshedpur · Location {String(i + 1).padStart(2, '0')}</span><h2>{store.name}</h2>{store.description && <p>{store.description}</p>}
          <dl className="store-details">{[['Address', store.address], ['Phone', store.phone], ['WhatsApp', store.whatsapp], ['Opening hours', store.openingHours]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <span className="awaiting">Awaiting owner verification</span>}</dd></div>)}</dl>
          {store.mapsUrl ? <a className="text-link" href={store.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-map-${store.id}`}>Open map <ArrowUpRight size={15}/></a> : <span className="verification-note">Map link awaiting owner verification.</span>}
        </div>
      </article>)}</div>}
    {!isLoading && !isError && <p className="verification-note stores-footnote">Location records remain separate; missing details have not been inferred.</p>}
  </main></Shell>;
}

function AboutPage() {
  const { data: settings, isLoading, isError, refetch } = useGetSiteSettings();
  return <Shell><main className="about-page">
    <section className="about-hero"><img src={settings?.heroImageUrl || heroFallback} alt="Editorial atmosphere for the Shades of Punjab story"/><div><span className="eyebrow light-eyebrow">The story</span><h1>A little more<br/><em>than what we wear.</em></h1><p>Shades of Punjab · Jamshedpur</p></div></section>
    <section className="about-story content-width">{isLoading ? <Loading/> : isError ? <ErrorState retry={() => { void refetch(); }}/> : <><div className="about-side"><span className="eyebrow">Our point of view</span><span className="large-quote">“</span></div><div><h2>{settings?.brandName || defaultBrand}</h2><p>{settings?.aboutStory || 'The brand story is awaiting owner input. The team will share its history, inspirations and point of view here.'}</p><p className="verification-note">This story is maintained by the owner and will be updated as details are confirmed.</p></div></>}</section>
    <section className="about-note"><span className="eyebrow">Based in Jamshedpur</span><h2>Made for a wardrobe<br/>that feels like your own.</h2><Link href="/stores" className="text-link" data-testid="link-about-stores">Find our stores <ArrowRight size={15}/></Link></section>
  </main></Shell>;
}

function OffersPage() {
  return <Shell><main className="content-width page-shell"><PageIntro eyebrow="Worth knowing" title="Offers" text="Only active offers confirmed by the store will appear here."/><div className="empty-offers" data-testid="empty-offers"><span className="eyebrow">Nothing to announce</span><div className="offer-mark">—</div><h2>No active offers right now.</h2><p>Check back another time, or visit us in Jamshedpur.</p><Link href="/stores" className="button button-dark" data-testid="button-offers-stores">Find a store <ArrowRight size={15}/></Link></div></main></Shell>;
}

function CollectionPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: settings } = useGetSiteSettings();
  const { data: products, isLoading, isError, refetch } = useListProducts({ collection: slug === 'featured' ? undefined : slug, sort: 'featured' });
  const title = slug === 'featured' ? settings?.featuredCollectionTitle || 'The collection' : slug.replace(/-/g, ' ');
  return <Shell><main className="content-width page-shell"><PageIntro eyebrow="The edit" title={title} text={settings?.featuredCollectionDescription || 'A collection curated by Shades of Punjab.'}/>
    {isLoading ? <div className="product-grid"><Loading/><Loading/><Loading/></div> : isError ? <ErrorState retry={() => { void refetch(); }}/> : products?.filter((p) => slug !== 'featured' || p.isFeatured).length ? <div className="product-grid">{products.filter((p) => slug !== 'featured' || p.isFeatured).map((p) => <ProductCard product={p} key={p.id}/>)}</div> : <EmptyProducts/>}
  </main></Shell>;
}

function CartPage() {
  const cart = useCart();
  const subtotalUnknown = cart.items.some((item) => item.product.priceInr == null);
  const subtotal = cart.items.reduce((sum, item) => sum + (item.product.priceInr || 0) * item.quantity, 0);
  return <Shell><main className="content-width page-shell cart-page"><PageIntro eyebrow="Your selection" title="Shopping bag"/>
    {cart.items.length ? <div className="cart-layout"><div className="cart-items">{cart.items.map(({ product, quantity, size }) => <article className="cart-row" key={`${product.id}-${size || ''}`} data-testid={`cart-item-${product.id}`}>
      <Link href={`/product/${product.slug}`} className="cart-thumb" data-testid={`link-cart-product-${product.id}`}>{imageFor(product) ? <img src={imageFor(product)} alt={product.name}/> : <span>Image pending</span>}</Link>
      <button className="icon-button remove-button" onClick={() => cart.remove(product.id, size)} aria-label={`Remove ${product.name}`} data-testid={`button-remove-${product.id}`}><Trash2 size={17}/></button>
    </article>)}</div><aside className="cart-summary"><span className="eyebrow">Summary</span><div><span>Items</span><span>{cart.count}</span></div><div><span>Subtotal</span><span>{subtotalUnknown ? 'Price to be confirmed' : money(subtotal)}</span></div><p>Delivery and final totals can be confirmed by the store.</p><button className="button button-dark full-button" disabled data-testid="button-checkout">Checkout not yet configured</button><Link className="text-link" href="/shop" data-testid="link-continue-shopping">Continue shopping <ArrowRight size={15}/></Link></aside></div> :
      <div className="empty-cart" data-testid="empty-cart"><ShoppingBag size={28}/><span className="eyebrow">Nothing in the bag</span><h2>Your next favourite is still out there.</h2><p>Explore the current published collection.</p><Link className="button button-dark" href="/shop" data-testid="button-empty-shop">Explore clothing <ArrowRight size={15}/></Link></div>}
  </main></Shell>;
}

type ProductFormValues = { name: string; slug: string; description: string; priceInr: string; imageUrls: string; sizes: string; colors: string; category: string; collection: string; stock: string; isPublished: boolean; isFeatured: boolean; isNewArrival: boolean };
const emptyProduct: ProductFormValues = { name: '', slug: '', description: '', priceInr: '', imageUrls: '', sizes: '', colors: '', category: '', collection: '', stock: '', isPublished: false, isFeatured: false, isNewArrival: false };
type StoreFormValues = { name: string; address: string; phone: string; whatsapp: string; openingHours: string; mapsUrl: string; imageUrl: string; description: string };
const emptyStore: StoreFormValues = { name: '', address: '', phone: '', whatsapp: '', openingHours: '', mapsUrl: '', imageUrl: '', description: '' };

function AdminPage() {
  const qc = useQueryClient();
  const { data: products, isLoading: productLoading, isError: productError, refetch: refreshProducts } = useListAdminProducts();
  const { data: stores, isLoading: storesLoading, isError: storesError, refetch: refreshStores } = useListStores();
  const { data: settings, isLoading: settingsLoading } = useGetSiteSettings();
  const createProduct = useCreateProduct(); const updateProduct = useUpdateProduct(); const deleteProduct = useDeleteProduct();
  const createStore = useCreateStore(); const updateStore = useUpdateStore(); const deleteStore = useDeleteStore();
  const updateSettings = useUpdateSiteSettings();
  const [tab, setTab] = useState<'products' | 'stores' | 'homepage'>('products');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const productForm = useForm<ProductFormValues>({ defaultValues: emptyProduct });
  const storeForm = useForm<StoreFormValues>({ defaultValues: emptyStore });
  const settingsForm = useForm<SiteSettingsInput>({ defaultValues: { brandName: defaultBrand, heroHeadline: '', heroSubheading: '', heroImageUrl: '', instagramUrl: '', categories: [], featuredCollectionTitle: '', featuredCollectionDescription: '', aboutStory: '' } });
  useEffect(() => {
    if (settings) settingsForm.reset({ ...settings });
  }, [settings, settingsForm.reset]);
  const invalidateProducts = async (slug?: string) => {
    await qc.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
    await qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    await qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    if (slug) await qc.invalidateQueries({ queryKey: getGetProductQueryKey(slug) });
  };
  const submitProduct = (values: ProductFormValues) => {
    const payload = {
      name: values.name.trim(), slug: values.slug.trim() || undefined, description: values.description || null,
      priceInr: values.priceInr === '' ? null : Number(values.priceInr), imageUrls: parseLines(values.imageUrls),
      sizes: parseLines(values.sizes), colors: parseLines(values.colors), category: values.category || null,
      collection: values.collection || null, stock: values.stock === '' ? null : Number(values.stock),
      isPublished: values.isPublished, isFeatured: values.isFeatured, isNewArrival: values.isNewArrival,
    };
    const onSuccess = async (product: Product) => { await invalidateProducts(product.slug); setEditingProduct(null); setProductOpen(false); productForm.reset(emptyProduct); setNotice('Product saved.'); };
    if (editingProduct) updateProduct.mutate({ id: editingProduct.id, data: payload as ProductUpdate }, { onSuccess });
    else createProduct.mutate({ data: payload as ProductInput }, { onSuccess });
  };
  const startProductEdit = (p?: Product) => {
    setEditingProduct(p || null);
    setProductOpen(true);
    productForm.reset(p ? { name: p.name, slug: p.slug, description: p.description || '', priceInr: p.priceInr == null ? '' : String(p.priceInr), imageUrls: p.imageUrls.join('\n'), sizes: p.sizes.join('\n'), colors: p.colors.join('\n'), category: p.category || '', collection: p.collection || '', stock: p.stock == null ? '' : String(p.stock), isPublished: p.isPublished, isFeatured: p.isFeatured, isNewArrival: p.isNewArrival } : emptyProduct);
  };
  const submitStore = (values: StoreFormValues) => {
    const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value || null]));
    const onSuccess = async () => { await qc.invalidateQueries({ queryKey: getListStoresQueryKey() }); setEditingStore(null); setStoreOpen(false); storeForm.reset(emptyStore); setNotice('Store saved.'); };
    if (editingStore) updateStore.mutate({ id: editingStore.id, data: payload as StoreUpdate }, { onSuccess });
    else createStore.mutate({ data: { ...payload, name: values.name } as StoreInput }, { onSuccess });
  };
  const startStoreEdit = (store?: Store) => { setEditingStore(store || null); setStoreOpen(true); storeForm.reset(store ? { name: store.name, address: store.address || '', phone: store.phone || '', whatsapp: store.whatsapp || '', openingHours: store.openingHours || '', mapsUrl: store.mapsUrl || '', imageUrl: store.imageUrl || '', description: store.description || '' } : emptyStore); };
  const removeProduct = (p: Product) => {
    if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) deleteProduct.mutate({ id: p.id }, { onSuccess: async () => { await invalidateProducts(p.slug); setNotice('Product deleted.'); } });
  };
  const removeStore = (s: Store) => {
    if (window.confirm(`Delete “${s.name}”? This cannot be undone.`)) deleteStore.mutate({ id: s.id }, { onSuccess: async () => { await qc.invalidateQueries({ queryKey: getListStoresQueryKey() }); setNotice('Store deleted.'); } });
  };
  const saveSettings = (data: SiteSettingsInput) => updateSettings.mutate({ data: { ...data, categories: typeof data.categories === 'string' ? parseLines(data.categories as unknown as string) : data.categories } }, {
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: getGetSiteSettingsQueryKey() });
      await qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      setNotice('Homepage settings saved.');
    },
  });
  const mutationBusy = createProduct.isPending || updateProduct.isPending || createStore.isPending || updateStore.isPending || updateSettings.isPending;
  return <div className="admin-layout">
    <aside className="admin-sidebar"><Link href="/" className="admin-brand" data-testid="admin-brand"><span className="brand-mark">SP</span><span>Owner desk<small>SHADES OF PUNJAB</small></span></Link><span className="eyebrow">Manage</span>
      <button className={tab === 'products' ? 'admin-nav active' : 'admin-nav'} onClick={() => setTab('products')} data-testid="admin-tab-products">Products <span>{products?.length || 0}</span></button>
      <button className={tab === 'stores' ? 'admin-nav active' : 'admin-nav'} onClick={() => setTab('stores')} data-testid="admin-tab-stores">Stores <span>{stores?.length || 0}</span></button>
      <button className={tab === 'homepage' ? 'admin-nav active' : 'admin-nav'} onClick={() => setTab('homepage')} data-testid="admin-tab-homepage">Homepage</button>
      <Link href="/" className="admin-return" data-testid="admin-return"><ArrowLeft size={15}/> View storefront</Link>
    </aside>
    <main className="admin-main">
      <div className="admin-topbar"><span className="eyebrow">Owner dashboard</span><span className="admin-status"><span/> Content management</span></div>
      {notice && <div className="admin-notice" role="status" data-testid="status-admin-notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></div>}
      {tab === 'products' && <section><div className="admin-page-heading"><div><span className="eyebrow">Catalogue</span><h1>Products</h1><p>Manage published items and their details.</p></div><button className="button button-dark" onClick={() => startProductEdit()} data-testid="button-new-product"><Plus size={16}/> Add product</button></div>
        {productOpen && <form className="admin-form-panel" onSubmit={productForm.handleSubmit(submitProduct)} data-testid="form-product">
          <div className="form-panel-heading"><div><span className="eyebrow">{editingProduct ? 'Edit details' : 'New entry'}</span><h2>{editingProduct ? 'Update product' : 'Add a product'}</h2></div><button type="button" className="icon-button" onClick={() => { setProductOpen(false); setEditingProduct(null); productForm.reset(emptyProduct); }} aria-label="Close product editor" data-testid="button-close-product"><X size={18}/></button></div>
          <div className="form-grid">
            <Field label="Product name" required><input {...productForm.register('name', { required: true })} data-testid="input-product-name"/></Field>
            <Field label="URL slug"><input {...productForm.register('slug')} placeholder="Generated if left blank" data-testid="input-product-slug"/></Field>
            <Field label="Price in INR"><input type="number" min="0" step="1" {...productForm.register('priceInr')} data-testid="input-product-price"/></Field>
            <Field label="Stock quantity"><input type="number" min="0" step="1" {...productForm.register('stock')} data-testid="input-product-stock"/></Field>
            <Field label="Category"><input {...productForm.register('category')} data-testid="input-product-category"/></Field>
            <Field label="Collection"><input {...productForm.register('collection')} data-testid="input-product-collection"/></Field>
            <Field label="Description"><textarea {...productForm.register('description')} rows={3} data-testid="input-product-description"/></Field>
            <Field label="Image URLs — one per line"><textarea {...productForm.register('imageUrls')} rows={3} data-testid="input-product-images"/></Field>
            <Field label="Sizes — one per line"><textarea {...productForm.register('sizes')} rows={2} data-testid="input-product-sizes"/></Field>
            <Field label="Colours — one per line"><textarea {...productForm.register('colors')} rows={2} data-testid="input-product-colors"/></Field>
          </div>
          <div className="checkbox-row"><label><input type="checkbox" {...productForm.register('isPublished')} data-testid="input-product-published"/> Published</label><label><input type="checkbox" {...productForm.register('isFeatured')} data-testid="input-product-featured"/> Featured</label><label><input type="checkbox" {...productForm.register('isNewArrival')} data-testid="input-product-new"/> New arrival</label></div>
          <button className="button button-dark" type="submit" disabled={mutationBusy} data-testid="button-save-product">{mutationBusy ? 'Saving…' : 'Save product'}</button>
        </form>}
        {productLoading ? <Loading/> : productError ? <ErrorState retry={() => { void refreshProducts(); }}/> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{(products || []).map((p) => <tr key={p.id} data-testid={`row-product-${p.id}`}><td><div className="table-product">{imageFor(p) ? <img src={imageFor(p)} alt=""/> : <span className="table-thumb-empty"/>}<span>{p.name}<small>{p.slug}</small></span></div></td><td>{p.category || '—'}</td><td>{money(p.priceInr)}</td><td>{p.stock ?? '—'}</td><td><span className={`visibility ${p.isPublished ? 'published' : ''}`}>{p.isPublished ? 'Published' : 'Draft'}</span></td><td><div className="row-actions"><button className="icon-button" onClick={() => startProductEdit(p)} aria-label={`Edit ${p.name}`} data-testid={`button-edit-product-${p.id}`}><Pencil size={15}/></button><button className="icon-button danger-icon" onClick={() => removeProduct(p)} aria-label={`Delete ${p.name}`} data-testid={`button-delete-product-${p.id}`}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{!products?.length && <EmptyProducts/>}</div>}
      </section>}
      {tab === 'stores' && <section><div className="admin-page-heading"><div><span className="eyebrow">Locations</span><h1>Stores</h1><p>Keep each Jamshedpur location record distinct.</p></div><button className="button button-dark" onClick={() => startStoreEdit()} data-testid="button-new-store"><Plus size={16}/> Add store</button></div>
        {storeOpen && <form className="admin-form-panel" onSubmit={storeForm.handleSubmit(submitStore)} data-testid="form-store"><div className="form-panel-heading"><div><span className="eyebrow">{editingStore?.id ? 'Edit location' : 'New location'}</span><h2>{editingStore?.id ? editingStore.name : 'Add a store'}</h2></div><button type="button" className="icon-button" onClick={() => { setStoreOpen(false); setEditingStore(null); }} aria-label="Close store editor" data-testid="button-close-store"><X size={18}/></button></div>
          <div className="form-grid">{(['name', 'address', 'phone', 'whatsapp', 'openingHours', 'mapsUrl', 'imageUrl', 'description'] as const).map((key) => <Field key={key} label={key === 'openingHours' ? 'Opening hours' : key[0].toUpperCase() + key.slice(1)} required={key === 'name'}><input {...storeForm.register(key, { required: key === 'name' })} data-testid={`input-store-${key}`}/></Field>)}</div>
          <button className="button button-dark" type="submit" disabled={mutationBusy} data-testid="button-save-store">{mutationBusy ? 'Saving…' : 'Save store'}</button>
        </form>}
        {storesLoading ? <Loading/> : storesError ? <ErrorState retry={() => { void refreshStores(); }}/> : <div className="admin-store-list">{(stores || []).map((s, i) => <article className="admin-store-row" key={s.id} data-testid={`admin-store-${s.id}`}><span className="store-number">{String(i + 1).padStart(2, '0')}</span><div><h2>{s.name}</h2><p>{s.address || 'Address awaiting owner verification'}</p><span className="verification-note">{s.phone || 'Phone awaiting owner verification'}</span></div><div className="row-actions"><button className="icon-button" onClick={() => startStoreEdit(s)} aria-label={`Edit ${s.name}`} data-testid={`button-edit-store-${s.id}`}><Pencil size={15}/></button><button className="icon-button danger-icon" onClick={() => removeStore(s)} aria-label={`Delete ${s.name}`} data-testid={`button-delete-store-${s.id}`}><Trash2 size={15}/></button></div></article>)}</div>}
      </section>}
      {tab === 'homepage' && <section><div className="admin-page-heading"><div><span className="eyebrow">Storefront</span><h1>Homepage settings</h1><p>Keep the public brand story current and verified.</p></div></div>
        {settingsLoading ? <Loading/> : <form className="admin-form-panel" onSubmit={settingsForm.handleSubmit(saveSettings)} data-testid="form-settings">
          <div className="form-panel-heading"><div><span className="eyebrow">Brand content</span><h2>Homepage and story</h2></div></div>
          <div className="form-grid">
            <Field label="Brand name" required><input {...settingsForm.register('brandName', { required: true })} data-testid="input-setting-brand"/></Field>
            <Field label="Hero headline" required><input {...settingsForm.register('heroHeadline', { required: true })} data-testid="input-setting-headline"/></Field>
            <Field label="Hero subheading"><textarea {...settingsForm.register('heroSubheading')} rows={2} data-testid="input-setting-subheading"/></Field>
            <Field label="Hero image URL"><input {...settingsForm.register('heroImageUrl')} data-testid="input-setting-hero-image"/></Field>
            <Field label="Instagram profile URL"><input {...settingsForm.register('instagramUrl')} data-testid="input-setting-instagram"/></Field>
            <Field label="Categories — one per line"><textarea value={(settingsForm.watch('categories') || []).join('\n')} onChange={(e) => settingsForm.setValue('categories', parseLines(e.target.value))} rows={4} data-testid="input-setting-categories"/></Field>
            <Field label="Featured collection title"><input {...settingsForm.register('featuredCollectionTitle')} data-testid="input-setting-collection-title"/></Field>
            <Field label="Featured collection description"><textarea {...settingsForm.register('featuredCollectionDescription')} rows={3} data-testid="input-setting-collection-description"/></Field>
            <Field label="About story"><textarea {...settingsForm.register('aboutStory')} rows={6} data-testid="input-setting-story"/></Field>
          </div>
          <button className="button button-dark" type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">{updateSettings.isPending ? 'Saving…' : 'Save homepage settings'}</button>
        </form>}
      </section>}
      {(createProduct.isError || updateProduct.isError || deleteProduct.isError || createStore.isError || updateStore.isError || deleteStore.isError || updateSettings.isError) && <p className="admin-error" role="alert" data-testid="status-admin-error">The change could not be saved. Check the details and try again.</p>}
      {deleteProduct.isPending || deleteStore.isPending ? <p role="status" className="verification-note">Deleting record…</p> : null}
    </main>
  </div>;
}

function AdminGate() {
  const { isLoaded, isSignedIn, user } = useUser();
  const access = useGetAdminAccess({
    query: {
      queryKey: getGetAdminAccessQueryKey(),
      enabled: isLoaded && Boolean(isSignedIn),
    },
  });
  if (!isLoaded || (isSignedIn && access.isLoading)) return <main className="content-width page-shell"><Loading label="Checking owner access"/></main>;
  if (!isSignedIn) return <main className="content-width page-shell"><div className="state-panel" data-testid="admin-sign-in-required"><span className="eyebrow">Owner access</span><h1>Sign in to manage the store.</h1><p>The owner dashboard is available to signed-in users.</p><Link href="/sign-in" className="button button-dark" data-testid="button-admin-sign-in">Sign in <ArrowRight size={15}/></Link></div></main>;
  if (access.isError || !access.data?.isAdmin) return <main className="content-width page-shell">
    <div className="state-panel" data-testid="admin-owner-access-denied">
      <span className="eyebrow">Owner access</span>
      <h1>This account is not enabled for store management.</h1>
      <p>Add this Clerk user ID to the private <strong>ADMIN_USER_IDS</strong> workspace variable to grant owner access. Separate multiple approved IDs with commas.</p>
      <code className="admin-user-id">{user?.id || 'User ID unavailable'}</code>
      <p>Only give access to people authorized to manage the catalog, store locations and homepage content.</p>
      <Link href="/" className="button button-outline" data-testid="button-admin-return">Return to the storefront <ArrowRight size={15}/></Link>
    </div>
  </main>;
  return <AdminPage/>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}</label>;
}

function SignInPage() {
  return <main className="auth-page"><div className="auth-context"><Link href="/" className="wordmark" data-testid="auth-brand"><span className="brand-mark">SP</span><span>Shades of Punjab<small>JAMSHEDPUR · INDIA</small></span></Link><span className="eyebrow light-eyebrow">A wardrobe with a point of view</span><p>Good to see you<br/>again.</p></div><div className="auth-form"><Link href="/" className="auth-back" data-testid="auth-back"><ArrowLeft size={15}/> Back to the store</Link><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></main>;
}
function SignUpPage() {
  return <main className="auth-page"><div className="auth-context"><Link href="/" className="wordmark" data-testid="auth-brand"><span className="brand-mark">SP</span><span>Shades of Punjab<small>JAMSHEDPUR · INDIA</small></span></Link><span className="eyebrow light-eyebrow">A wardrobe with a point of view</span><p>Make room<br/>for something new.</p></div><div className="auth-form"><Link href="/" className="auth-back" data-testid="auth-back"><ArrowLeft size={15}/> Back to the store</Link><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></main>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomePage}/>
    <Route path="/shop" component={ShopPage}/>
    <Route path="/product/:slug" component={ProductPage}/>
    <Route path="/stores" component={StoresPage}/>
    <Route path="/about" component={AboutPage}/>
    <Route path="/offers" component={OffersPage}/>
    <Route path="/collections/:slug" component={CollectionPage}/>
    <Route path="/cart" component={CartPage}/>
    <Route path="/admin" component={AdminGate}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route component={NotFound}/>
  </Switch></RoutedErrorBoundary>;
}
function ClerkWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your Shades of Punjab account' } }, signUp: { start: { title: 'Create your account', subtitle: 'Join the Shades of Punjab community' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <Router/>
  </ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ClerkWithRoutes/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}

export default App;