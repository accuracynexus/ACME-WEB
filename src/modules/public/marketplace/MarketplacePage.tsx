import { startTransition, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  publicMarketplaceService,
  PublicMarketplaceBranch,
  PublicMarketplaceMerchant,
  PublicMarketplaceProduct,
} from '../../../core/services/publicMarketplaceService';
import { usePublicStore } from '../store/PublicStoreContext';
import './MarketplacePage.css';

function formatMoney(value: number, currency = 'PEN') {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function merchantSignal(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function productSettingForBranch(product: PublicMarketplaceProduct, branchId: string | null) {
  if (!branchId) return null;
  return product.settings.find((setting) => setting.branch_id === branchId) ?? null;
}

function isProductAvailable(product: PublicMarketplaceProduct, branchId: string | null) {
  const setting = productSettingForBranch(product, branchId);
  if (!setting) return true;
  return setting.is_available && !setting.is_paused;
}

function priceForBranch(product: PublicMarketplaceProduct, branchId: string | null) {
  const setting = productSettingForBranch(product, branchId);
  return setting?.price ?? product.base_price;
}

type MarketplaceTheme = {
  accent: string;
  accentStrong: string;
  surface: string;
  surfaceAlt: string;
  ink: string;
  muted: string;
  soft: string;
  glow: string;
  hero: string;
  highlight: string;
};

const DEFAULT_THEME: MarketplaceTheme = {
  accent: '#ff6a13',
  accentStrong: '#d9480f',
  surface: 'rgba(255,255,255,.84)',
  surfaceAlt: 'rgba(255,247,241,.9)',
  ink: '#1d1630',
  muted: '#6b7280',
  soft: 'rgba(255,116,43,.18)',
  glow: 'rgba(255,106,19,.26)',
  hero: 'linear-gradient(135deg, rgba(255,140,51,.95), rgba(120,40,180,.88))',
  highlight: 'linear-gradient(135deg, rgba(255,191,141,.55), rgba(255,108,47,.18))',
};

function themeForMerchant(merchant: PublicMarketplaceMerchant | null): MarketplaceTheme {
  const signal = merchantSignal(merchant?.trade_name);

  if (signal.includes('cevich') || signal.includes('mar') || signal.includes('delfin')) {
    return {
      accent: '#0f9bb3',
      accentStrong: '#0b7285',
      surface: 'rgba(245,252,255,.84)',
      surfaceAlt: 'rgba(236,250,253,.92)',
      ink: '#0f2430',
      muted: '#4b6472',
      soft: 'rgba(15,155,179,.16)',
      glow: 'rgba(15,155,179,.24)',
      hero: 'linear-gradient(135deg, rgba(15,155,179,.92), rgba(16,67,114,.88))',
      highlight: 'linear-gradient(135deg, rgba(146,230,245,.62), rgba(54,162,186,.2))',
    };
  }

  if (
    signal.includes('poller') ||
    signal.includes('broster') ||
    signal.includes('broast') ||
    signal.includes('bisteck') ||
    signal.includes('fogones') ||
    signal.includes('salchi')
  ) {
    return {
      accent: '#ef6c00',
      accentStrong: '#c75100',
      surface: 'rgba(255,250,244,.85)',
      surfaceAlt: 'rgba(255,244,229,.92)',
      ink: '#2e170b',
      muted: '#73564b',
      soft: 'rgba(239,108,0,.18)',
      glow: 'rgba(239,108,0,.28)',
      hero: 'linear-gradient(135deg, rgba(239,108,0,.96), rgba(109,32,5,.9))',
      highlight: 'linear-gradient(135deg, rgba(255,199,140,.58), rgba(255,137,54,.18))',
    };
  }

  if (signal.includes('pizza') || signal.includes('roma')) {
    return {
      accent: '#d94841',
      accentStrong: '#b02b26',
      surface: 'rgba(255,249,248,.84)',
      surfaceAlt: 'rgba(255,242,239,.92)',
      ink: '#301514',
      muted: '#775857',
      soft: 'rgba(217,72,65,.16)',
      glow: 'rgba(217,72,65,.24)',
      hero: 'linear-gradient(135deg, rgba(217,72,65,.95), rgba(139,36,30,.88))',
      highlight: 'linear-gradient(135deg, rgba(255,196,179,.56), rgba(217,72,65,.16))',
    };
  }

  if (signal.includes('juguer') || signal.includes('cafe') || signal.includes('ponch') || signal.includes('maca')) {
    return {
      accent: '#2f9e44',
      accentStrong: '#23773a',
      surface: 'rgba(248,253,248,.84)',
      surfaceAlt: 'rgba(239,250,239,.92)',
      ink: '#17261a',
      muted: '#5d6e61',
      soft: 'rgba(47,158,68,.16)',
      glow: 'rgba(47,158,68,.22)',
      hero: 'linear-gradient(135deg, rgba(47,158,68,.95), rgba(204,120,18,.86))',
      highlight: 'linear-gradient(135deg, rgba(200,241,184,.58), rgba(47,158,68,.16))',
    };
  }

  if (signal.includes('chifa')) {
    return {
      accent: '#8f3e00',
      accentStrong: '#6c2c00',
      surface: 'rgba(255,251,245,.84)',
      surfaceAlt: 'rgba(255,243,226,.92)',
      ink: '#2a180c',
      muted: '#735a48',
      soft: 'rgba(143,62,0,.16)',
      glow: 'rgba(143,62,0,.24)',
      hero: 'linear-gradient(135deg, rgba(143,62,0,.94), rgba(62,20,3,.9))',
      highlight: 'linear-gradient(135deg, rgba(255,219,169,.56), rgba(143,62,0,.15))',
    };
  }

  if (signal.includes('restobar') || signal.includes('bohemia') || signal.includes('oasis') || signal.includes('curayacu')) {
    return {
      accent: '#9c36b5',
      accentStrong: '#7b2b93',
      surface: 'rgba(252,247,255,.84)',
      surfaceAlt: 'rgba(246,236,253,.92)',
      ink: '#231128',
      muted: '#6d5b76',
      soft: 'rgba(156,54,181,.15)',
      glow: 'rgba(156,54,181,.22)',
      hero: 'linear-gradient(135deg, rgba(156,54,181,.93), rgba(255,124,64,.86))',
      highlight: 'linear-gradient(135deg, rgba(233,190,244,.58), rgba(156,54,181,.15))',
    };
  }

  return DEFAULT_THEME;
}

function themeVars(theme: MarketplaceTheme): CSSProperties {
  return {
    ['--mp-accent' as string]: theme.accent,
    ['--mp-accent-strong' as string]: theme.accentStrong,
    ['--mp-surface' as string]: theme.surface,
    ['--mp-surface-alt' as string]: theme.surfaceAlt,
    ['--mp-ink' as string]: theme.ink,
    ['--mp-muted' as string]: theme.muted,
    ['--mp-soft' as string]: theme.soft,
    ['--mp-glow' as string]: theme.glow,
    ['--mp-hero' as string]: theme.hero,
    ['--mp-highlight' as string]: theme.highlight,
  };
}

function thumbStyle(imageUrl: string | null | undefined): CSSProperties | undefined {
  return imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined;
}

function merchantHeroImage(merchant: PublicMarketplaceMerchant | null) {
  if (!merchant) return '';
  return merchant.products.find((product) => product.image_url)?.image_url || merchant.logo_url || '';
}

function merchantLeadLine(merchant: PublicMarketplaceMerchant | null) {
  if (!merchant) return '';
  const signal = merchantSignal(merchant.trade_name);

  if (signal.includes('juguer') || signal.includes('cafe') || signal.includes('ponch')) {
    return 'Bebidas y antojos ligeros presentados para despertar frescura, animo y compra impulsiva desde el primer vistazo.';
  }
  if (signal.includes('cevich')) {
    return 'Una carta pensada para vender frescura: platos brillantes, lectura rapida y foco total en lo marino.';
  }
  if (signal.includes('pizza')) {
    return 'Horno, queso y combinaciones visibles al instante para que la decision de compra se sienta obvia.';
  }
  if (signal.includes('chifa')) {
    return 'El menu entra como una cartilla de casa: sazones potentes, secciones claras y antojo inmediato.';
  }
  if (signal.includes('poller') || signal.includes('broster') || signal.includes('bisteck') || signal.includes('salchi')) {
    return 'Todo lo que empuja hambre real: dorado, calor visual y platos que se sienten contundentes antes de pedirlos.';
  }
  if (signal.includes('restobar')) {
    return 'Una experiencia con atmosfera de salida: la carta se recorre como si ya estuvieras sentado en el local.';
  }

  return `${merchant.trade_name} entra en modo vitrina para vender mejor cada plato, no solo para listarlo.`;
}

function statusLabel(branch: PublicMarketplaceBranch | null) {
  if (!branch) return 'Carta disponible';
  if (branch.is_open && branch.accepting_orders) return 'Abierto y tomando pedidos';
  if (branch.is_open) return 'Abierto, confirma disponibilidad';
  if (branch.accepts_orders) return 'Agenda abierta para pedidos';
  return 'Consulta horario del local';
}

function branchPrepLabel(branch: PublicMarketplaceBranch | null) {
  if (!branch) return 'Tiempo sujeto al local';
  if (branch.prep_time_avg_min > 0) {
    const upperBound = branch.prep_time_avg_min + 8;
    return `${branch.prep_time_avg_min}-${upperBound} min estimados`;
  }
  return branch.accepting_orders ? 'Preparacion activa ahora' : 'Tiempo segun horario';
}

function appetiteKicker(product: PublicMarketplaceProduct) {
  const signal = merchantSignal(`${product.name} ${product.description}`);

  if (signal.includes('combo') || signal.includes('familiar') || signal.includes('parrilla')) return 'Para compartir';
  if (signal.includes('jugo') || signal.includes('smoothie') || signal.includes('ponche') || signal.includes('cafe')) return 'Fresco al momento';
  if (signal.includes('pizza')) return 'Recien horneada';
  if (signal.includes('ceviche') || signal.includes('pescado') || signal.includes('marisco')) return 'Golpe marino';
  if (signal.includes('chaufa') || signal.includes('tallarin') || signal.includes('aeropuerto')) return 'Wok humeante';
  if (signal.includes('broaster') || signal.includes('broster') || signal.includes('brasa') || signal.includes('salchi')) return 'Dorado que convence';
  if (signal.includes('especial') || signal.includes('suprema') || signal.includes('premium')) return 'Favorito del local';
  return 'Listo para pedir';
}

function appetiteDescription(product: PublicMarketplaceProduct) {
  const cleanDescription = product.description.trim();
  if (cleanDescription.length >= 46) return cleanDescription;

  const signal = merchantSignal(`${product.name} ${cleanDescription}`);
  if (signal.includes('jugo') || signal.includes('smoothie') || signal.includes('ponche') || signal.includes('cafe')) {
    return `${product.name} preparado para refrescar, levantar el animo y acompanar cualquier hora del dia.`;
  }
  if (signal.includes('broaster') || signal.includes('broster') || signal.includes('brasa') || signal.includes('salchi') || signal.includes('bisteck')) {
    return `${product.name} con textura, calor visual y ese perfil contundente que abre el apetito antes del primer bocado.`;
  }
  if (signal.includes('pizza')) {
    return `${product.name} sale con protagonismo de queso, horno y porcion lista para tentar una segunda vuelta.`;
  }
  if (signal.includes('ceviche') || signal.includes('marisco') || signal.includes('pescado')) {
    return `${product.name} entra fresco, vibrante y con ese punto citrico que hace que el pedido se sienta especial.`;
  }
  if (signal.includes('chaufa') || signal.includes('tallarin') || signal.includes('aeropuerto') || signal.includes('chifa')) {
    return `${product.name} va directo al antojo con wok marcado, sazon alta y una presencia que invita a pedirlo ya.`;
  }
  return `${product.name} presentado para resolver el antojo rapido, con lectura clara y ganas de agregarlo al carrito.`;
}

function appetiteFooter(product: PublicMarketplaceProduct) {
  const signal = merchantSignal(`${product.name} ${product.description}`);

  if (signal.includes('jugo') || signal.includes('smoothie') || signal.includes('ponche') || signal.includes('cafe')) {
    return 'Perfecto para refrescar el pedido y subir el ticket sin esfuerzo.';
  }
  if (signal.includes('combo') || signal.includes('familiar') || signal.includes('parrilla')) {
    return 'Pensado para compartir y hacer que la compra se sienta mas completa.';
  }
  if (signal.includes('broaster') || signal.includes('broster') || signal.includes('brasa') || signal.includes('salchi')) {
    return 'De esos platos que llegan a mesa y desaparecen primero.';
  }
  if (signal.includes('pizza')) {
    return 'Una opcion hecha para que la siguiente porcion parezca inevitable.';
  }
  if (signal.includes('ceviche') || signal.includes('marisco')) {
    return 'Brilla por frescura y levanta el valor percibido de la carta.';
  }
  return 'Una pieza fuerte para mover compra por impulso.';
}

function categoryNarrative(categoryName: string, merchantName: string) {
  const signal = merchantSignal(categoryName);

  if (signal.includes('bebida') || signal.includes('jugo') || signal.includes('cafe')) {
    return `La parte fresca de ${merchantName}: entradas rapidas, color apetecible y opciones faciles de sumar al pedido.`;
  }
  if (signal.includes('promo') || signal.includes('combo')) {
    return `Aqui viven las decisiones rapidas: packs visibles, lectura simple y valor claro para cerrar compra.`;
  }
  if (signal.includes('especial') || signal.includes('casa')) {
    return `La seleccion que mejor representa a ${merchantName}, presentada para que el cliente empiece por lo mas tentador.`;
  }
  return `${categoryName} entra como una mini cartilla propia, con foco en hambre, claridad y deseo de agregar otro plato.`;
}

function shortAddress(branch: PublicMarketplaceBranch | null) {
  if (!branch) return 'Huancayo';
  return branch.address_label || [branch.district, branch.city].filter(Boolean).join(' / ') || 'Huancayo';
}

function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

type MenuSection = {
  category: {
    id: string;
    name: string;
    sort_order: number;
  };
  products: PublicMarketplaceProduct[];
};

// ── Icons instead of Emojis ──────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SidebarSkeleton() {
  return (
    <div className="mp-shell">
      <aside className="mp-sidebar">
        <div className="mp-sidebar-card mp-skeleton-panel">
          <div className="mp-skeleton-block mp-skeleton-block--hero" />
          <div className="mp-skeleton-line" />
          <div className="mp-skeleton-line mp-skeleton-line--short" />
          <div className="mp-skeleton-line mp-skeleton-line--tiny" />
        </div>
        <div className="mp-sidebar-card mp-skeleton-panel">
          <div className="mp-skeleton-line" />
          <div className="mp-skeleton-item" />
          <div className="mp-skeleton-item" />
          <div className="mp-skeleton-item" />
        </div>
      </aside>
      <div className="mp-stage">
        <section className="mp-stage-hero mp-skeleton-panel">
          <div className="mp-skeleton-line mp-skeleton-line--tiny" />
          <div className="mp-skeleton-line mp-skeleton-line--title" />
          <div className="mp-skeleton-line" />
          <div className="mp-skeleton-line mp-skeleton-line--short" />
          <div className="mp-skeleton-block mp-skeleton-block--showcase" />
        </section>
        <section className="mp-menu-section mp-skeleton-panel">
          <div className="mp-skeleton-line mp-skeleton-line--title" />
          <div className="mp-skeleton-grid">
            <div className="mp-skeleton-item mp-skeleton-item--card" />
            <div className="mp-skeleton-item mp-skeleton-item--card" />
            <div className="mp-skeleton-item mp-skeleton-item--card" />
          </div>
        </section>
      </div>
    </div>
  );
}

// Skeleton solo para el área del menú (la barra lateral y la cabecera ya están pintadas en fase 1).
function MenuSkeleton() {
  return (
    <div className="mp-menu-sections" aria-hidden="true">
      {[0, 1].map((s) => (
        <section key={s} className="mp-menu-section mp-skeleton-panel">
          <div className="mp-skeleton-line mp-skeleton-line--title" />
          <div className="mp-skeleton-grid">
            <div className="mp-skeleton-item mp-skeleton-item--card" />
            <div className="mp-skeleton-item mp-skeleton-item--card" />
            <div className="mp-skeleton-item mp-skeleton-item--card" />
          </div>
        </section>
      ))}
    </div>
  );
}

export function MarketplacePage() {
  const publicStore = usePublicStore();
  const [snapshot, setSnapshot] = useState<{ merchants: PublicMarketplaceMerchant[]; full: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeMerchantId, setActiveMerchantId] = useState<string | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<PublicMarketplaceProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [productNotes, setProductNotes] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const pickInitial = (list: PublicMarketplaceMerchant[]) => {
      if (list.length === 0) return;
      setActiveMerchantId((current) => current ?? list[0].id);
      setActiveBranchId((current) => current ?? list[0].branches[0]?.id ?? null);
    };

    // Fase 1 — lista ligera de locales: pinta la barra lateral y la cabecera de inmediato.
    publicMarketplaceService.fetchMerchantsLite().then((result) => {
      if (cancelled || result.error || !result.data) return;
      const lite = result.data.merchants;
      // No pisar el snapshot completo si la fase 2 llegó primero.
      setSnapshot((prev) => (prev?.full ? prev : { merchants: lite, full: false }));
      setLoading(false);
      pickInitial(lite);
    });

    // Fase 2 — catálogo completo (productos/modificadores) en segundo plano.
    publicMarketplaceService.fetchSnapshot().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.error) {
        setError((prev) => prev ?? result.error.message);
        return;
      }
      const full = result.data?.merchants ?? [];
      setSnapshot({ merchants: full, full: true });
      pickInitial(full);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const merchants = snapshot?.merchants ?? [];
  const menuLoading = Boolean(snapshot) && !snapshot?.full;

  // Normalizado (sin acentos, minúsculas) para que la búsqueda sea consistente.
  const normalizedQuery = useMemo(() => merchantSignal(deferredQuery), [deferredQuery]);

  const filteredMerchants = useMemo(() => {
    if (!normalizedQuery) return merchants;

    return merchants.filter((merchant) => {
      const haystack = merchantSignal(
        [
          merchant.trade_name,
          ...merchant.featured_product_names,
          ...merchant.branches.map((branch) => `${branch.name} ${branch.district} ${branch.city} ${branch.address_label}`),
          ...merchant.categories.map((category) => category.name),
          ...merchant.products.map((product) => `${product.name} ${product.description}`),
        ].join(' ')
      );

      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, merchants]);

  const activeMerchant = filteredMerchants.find((merchant) => merchant.id === activeMerchantId) ?? filteredMerchants[0] ?? null;

  useEffect(() => {
    if (filteredMerchants.length === 0) {
      setActiveMerchantId(null);
      setActiveBranchId(null);
      return;
    }

    if (!activeMerchantId || !filteredMerchants.some((merchant) => merchant.id === activeMerchantId)) {
      setActiveMerchantId(filteredMerchants[0].id);
      setActiveBranchId(filteredMerchants[0].branches[0]?.id ?? null);
      setActiveCategoryId('all');
    }
  }, [activeMerchantId, filteredMerchants]);

  useEffect(() => {
    if (!activeMerchant) return;
    if (!activeBranchId || !activeMerchant.branches.some((branch) => branch.id === activeBranchId)) {
      setActiveBranchId(activeMerchant.branches[0]?.id ?? null);
    }
  }, [activeBranchId, activeMerchant]);

  useEffect(() => {
    setSelectedProduct(null);
    setSelectedOptions({});
    setProductNotes('');
    setJustAdded(false);
  }, [activeMerchantId, activeBranchId]);

  const activeBranch =
    activeMerchant?.branches.find((branch) => branch.id === activeBranchId) ??
    activeMerchant?.branches[0] ??
    null;

  const theme = themeForMerchant(activeMerchant);
  const heroImage = merchantHeroImage(activeMerchant);
  const merchantImage = activeMerchant?.logo_url || heroImage;

  const availableProducts = useMemo(() => {
    if (!activeMerchant) return [];
    const base = activeMerchant.products.filter((product) => isProductAvailable(product, activeBranchId));
    if (!normalizedQuery) return base;

    // Si el negocio coincide por su nombre, mostramos toda su carta (buscaron el local, no un plato).
    if (merchantSignal(activeMerchant.trade_name).includes(normalizedQuery)) return base;

    const categoryName = (id: string) => activeMerchant.categories.find((c) => c.id === id)?.name ?? '';
    const matched = base.filter((product) =>
      merchantSignal(`${product.name} ${product.description} ${categoryName(product.category_id)}`).includes(normalizedQuery)
    );

    // Si nada coincide a nivel de plato (p. ej. coincidió por distrito), no dejamos la carta vacía.
    return matched.length > 0 ? matched : base;
  }, [activeBranchId, activeMerchant, normalizedQuery]);

  const menuSections = useMemo(() => {
    if (!activeMerchant) return [] as MenuSection[];

    const sections = activeMerchant.categories
      .map((category) => ({
        category,
        products: availableProducts.filter((product) => product.category_id === category.id),
      }))
      .filter((section) => section.products.length > 0);

    const uncategorizedProducts = availableProducts.filter(
      (product) => !product.category_id || !activeMerchant.categories.some((category) => category.id === product.category_id)
    );

    if (uncategorizedProducts.length > 0) {
      sections.push({
        category: {
          id: 'recomendados',
          name: 'Recomendados',
          sort_order: Number.MAX_SAFE_INTEGER,
        },
        products: uncategorizedProducts,
      });
    }

    return sections.sort(
      (left, right) =>
        left.category.sort_order - right.category.sort_order || left.category.name.localeCompare(right.category.name)
    );
  }, [activeMerchant, availableProducts]);

  const showcaseProducts = useMemo(() => availableProducts.slice(0, 4), [availableProducts]);
  const activeMerchantIndex = filteredMerchants.findIndex((m) => m.id === activeMerchantId);
  const hasQuery = normalizedQuery.length > 0;
  const merchantCountLabel = `${filteredMerchants.length} negocio${filteredMerchants.length === 1 ? '' : 's'}`;
  const resultCountLabel = hasQuery ? `${merchantCountLabel} para "${query.trim()}"` : `${merchantCountLabel} disponibles`;

  // Sugerencias rápidas derivadas de las categorías reales más frecuentes.
  const suggestionChips = useMemo(() => {
    const counts = new Map<string, number>();
    merchants.forEach((merchant) =>
      merchant.categories.forEach((category) => {
        const name = category.name.trim();
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      })
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([name]) => name);
  }, [merchants]);

  const goToMerchant = (index: number) => {
    const merchant = filteredMerchants[index];
    if (!merchant) return;
    startTransition(() => {
      setActiveMerchantId(merchant.id);
      setActiveBranchId(merchant.branches[0]?.id ?? null);
      setActiveCategoryId('all');
      scrollToId('mp-stage-top');
    });
  };

  const openProduct = (product: PublicMarketplaceProduct) => {
    setSelectedProduct(product);
    setSelectedOptions({});
    setProductNotes('');
    setJustAdded(false);
  };

  const addSelectedProduct = () => {
    if (!selectedProduct || !activeMerchant || !activeBranchId) return;

    const modifiers = selectedProduct.modifier_groups.flatMap((group) =>
      (selectedOptions[group.id] ?? [])
        .map((optionId) => group.options.find((option) => option.id === optionId))
        .filter(Boolean)
        .map((option) => ({
          id: option!.id,
          option_id: option!.id,
          group_id: group.id,
          name: option!.name,
          price_delta: option!.price_delta,
          quantity: 1,
        }))
    );

    publicStore.addItem({
      merchant_id: activeMerchant.id,
      merchant_name: activeMerchant.trade_name,
      branch_id: activeBranchId,
      branch_name: activeMerchant.branches.find((branch) => branch.id === activeBranchId)?.name || 'Sucursal',
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_description: selectedProduct.description,
      image_url: selectedProduct.image_url,
      unit_price: priceForBranch(selectedProduct, activeBranchId),
      quantity: 1,
      notes: productNotes.trim(),
      modifiers,
    });

    setJustAdded(true);
    window.setTimeout(() => {
      setJustAdded(false);
      setSelectedProduct(null);
      setSelectedOptions({});
      setProductNotes('');
    }, 900);
  };

  const toggleOption = (groupId: string, optionId: string, maxSelect: number) => {
    setSelectedOptions((current) => {
      const selected = current[groupId] ?? [];
      if (selected.includes(optionId)) {
        return { ...current, [groupId]: selected.filter((item) => item !== optionId) };
      }
      if (selected.length >= Math.max(1, maxSelect)) {
        return current;
      }
      return { ...current, [groupId]: [...selected, optionId] };
    });
  };

  return (
    <section className="mp-page" style={themeVars(theme)}>
      <div className="mp-wrapper">
        <header className="mp-topbar">
          <div className="mp-topbar__copy">
            <span className="mp-topbar__eyebrow">Marketplace gastronomico</span>
            <h1 className="mp-topbar__title">Haz que el antojo mande.</h1>
            <p className="mp-topbar__subtitle">
              Un restaurante a la vez, con foco en platos que se sienten deseables, claros y faciles de pedir.
            </p>
          </div>

          <div className="mp-search-panel">
            <div className="mp-search-headline">
              <label className="mp-search-label" htmlFor="mp-search-input">¿Qué se te antoja hoy?</label>
              <span className="mp-result-pill">{resultCountLabel}</span>
            </div>

            <div className={`mp-search-box${hasQuery ? ' mp-search-box--active' : ''}`}>
              <span className="mp-search-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </span>
              <input
                id="mp-search-input"
                className="mp-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca un local o un plato — ej. pollería, pizza, ceviche…"
                autoComplete="off"
              />
              {query ? (
                <button type="button" className="mp-search-clear" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              ) : null}
            </div>

            {suggestionChips.length > 0 ? (
              <div className="mp-search-chips">
                <span className="mp-search-chips__label">Populares:</span>
                {suggestionChips.map((chip) => {
                  const active = merchantSignal(query) === merchantSignal(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      className={`mp-search-chip${active ? ' mp-search-chip--active' : ''}`}
                      onClick={() => setQuery(active ? '' : chip)}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </header>

        {loading ? <SidebarSkeleton /> : null}

        {!loading && error ? (
          <div className="mp-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        ) : null}

        {!loading && !error && filteredMerchants.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-icon">?</div>
            <div>
              <strong>No encontramos resultados para "{query}".</strong>
              <p>Prueba con otro negocio, distrito o nombre de plato.</p>
            </div>
          </div>
        ) : null}

        {!loading && !error && activeMerchant ? (
          <div className="mp-shell">
            <aside className="mp-sidebar">
              <div className="mp-sidebar-card">

                {/* ── Desktop header ── */}
                <div className="mp-sidebar-list-head">
                  <div>
                    <span className="mp-sidebar-caption">Locales disponibles</span>
                    <strong className="mp-sidebar-title">Elige dónde pedir hoy</strong>
                  </div>
                  <span className="mp-sidebar-pill">{filteredMerchants.length}</span>
                </div>


                {/* ── Mobile carousel navigator ── */}
                <div className="mp-carousel-nav">
                  <button
                    type="button"
                    className="mp-carousel-btn"
                    aria-label="Anterior local"
                    disabled={filteredMerchants.length <= 1}
                    onClick={() => goToMerchant((activeMerchantIndex - 1 + filteredMerchants.length) % filteredMerchants.length)}
                  >
                    ‹
                  </button>

                  <div className="mp-carousel-info">
                    <div className="mp-carousel-thumb" style={thumbStyle(merchantImage)} />
                    <div className="mp-carousel-text">
                      <strong className="mp-carousel-name">{activeMerchant.trade_name}</strong>
                      <span className="mp-carousel-hint">Desliza o usa las flechas para cambiar</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mp-carousel-btn"
                    aria-label="Siguiente local"
                    disabled={filteredMerchants.length <= 1}
                    onClick={() => goToMerchant((activeMerchantIndex + 1) % filteredMerchants.length)}
                  >
                    ›
                  </button>
                </div>

                {/* Dots indicator (mobile only) */}
                {filteredMerchants.length > 1 && (
                  <div className="mp-carousel-dots">
                    {filteredMerchants.slice(0, 10).map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`mp-carousel-dot${m.id === activeMerchantId ? ' mp-carousel-dot--active' : ''}`}
                        aria-label={m.trade_name}
                        onClick={() => goToMerchant(i)}
                      />
                    ))}
                    {filteredMerchants.length > 10 && (
                      <span className="mp-carousel-more">+{filteredMerchants.length - 10}</span>
                    )}
                  </div>
                )}

                {/* ── Desktop full merchant list ── */}
                <div className="mp-sidebar-list">
                  {filteredMerchants.map((merchant) => {
                    const merchantImageUrl = merchant.logo_url || merchantHeroImage(merchant);
                    const isActive = merchant.id === activeMerchantId;
                    const isOpen = merchant.branches[0]?.is_open && merchant.branches[0]?.accepting_orders;
                    return (
                      <button
                        key={merchant.id}
                        type="button"
                        className={`mp-sidebar-item${isActive ? ' mp-sidebar-item--active' : ''}`}
                        onClick={() => goToMerchant(filteredMerchants.indexOf(merchant))}
                      >
                        <div className="mp-sidebar-item__thumb" style={thumbStyle(merchantImageUrl)} />
                        <div className="mp-sidebar-item__body">
                          <div className="mp-sidebar-item__topline">
                            <strong>{merchant.trade_name}</strong>
                            <span className={`mp-sidebar-status${isOpen ? ' mp-sidebar-status--open' : ''}`}>
                              {isOpen ? '●' : '○'}
                            </span>
                          </div>
                          <p>{merchant.featured_product_names.slice(0, 2).join(' · ') || 'Carta disponible'}</p>
                          <div className="mp-sidebar-item__meta">
                            <span>{merchant.branches[0]?.district || 'Huancavelica'}</span>
                            <span>{menuLoading ? 'Ver carta' : `${merchant.products.length} platos`}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            </aside>

            <main className="mp-stage" id="mp-stage-top">
              <section className="mp-stage-hero">
                <div className="mp-stage-copy">
                  <span className="mp-stage-overline">Cartilla del restaurante</span>
                  <h2 className="mp-stage-title">{activeMerchant.trade_name}</h2>
                  <p className="mp-stage-lead">{merchantLeadLine(activeMerchant)}</p>

                  <div className="mp-stage-meta">
                    <span className="mp-stage-chip mp-stage-chip--accent">{statusLabel(activeBranch)}</span>
                    <span className="mp-stage-chip">{branchPrepLabel(activeBranch)}</span>
                    <span className="mp-stage-chip">{shortAddress(activeBranch)}</span>
                  </div>

                  {activeMerchant.branches.length > 1 ? (
                    <div className="mp-branch-tabs">
                      {activeMerchant.branches.map((branch) => (
                        <button
                          key={branch.id}
                          type="button"
                          className={`mp-branch-btn${branch.id === activeBranchId ? ' mp-branch-btn--active' : ''}`}
                          onClick={() =>
                            startTransition(() => {
                              setActiveBranchId(branch.id);
                              setActiveCategoryId('all');
                            })
                          }
                        >
                          {branch.name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mp-stage-stats">
                    <div className="mp-stage-stat">
                      <strong>{menuLoading ? '·' : availableProducts.length}</strong>
                      <span>platos visibles</span>
                    </div>
                    <div className="mp-stage-stat">
                      <strong>{menuLoading ? '·' : menuSections.length}</strong>
                      <span>secciones navegables</span>
                    </div>
                    <div className="mp-stage-stat">
                      <strong>{activeMerchant.branches.length}</strong>
                      <span>sucursales del local</span>
                    </div>
                  </div>
                </div>

                <div className="mp-showcase">
                  <div className="mp-showcase-screen">
                    <div className="mp-showcase-image" style={thumbStyle(heroImage)} />
                    <div className="mp-showcase-stack">
                      {showcaseProducts.map((product, index) => (
                        <div
                          key={product.id}
                          className="mp-showcase-item"
                          style={{ ['--order' as string]: index } as CSSProperties}
                        >
                          <div className="mp-showcase-item__thumb" style={thumbStyle(product.image_url)} />
                          <div className="mp-showcase-item__body">
                            <span>{appetiteKicker(product)}</span>
                            <strong>{product.name}</strong>
                            <small>{formatMoney(priceForBranch(product, activeBranchId))}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <nav className="mp-stage-rail">
                <button
                  type="button"
                  className={activeCategoryId === 'all' ? 'mp-rail-btn mp-rail-btn--active' : 'mp-rail-btn'}
                  onClick={() => {
                    setActiveCategoryId('all');
                    scrollToId('mp-stage-top');
                  }}
                >
                  Portada
                </button>
                {menuSections.map((section) => (
                  <button
                    key={section.category.id}
                    type="button"
                    className={activeCategoryId === section.category.id ? 'mp-rail-btn mp-rail-btn--active' : 'mp-rail-btn'}
                    onClick={() => {
                      setActiveCategoryId(section.category.id);
                      scrollToId(`mp-section-${section.category.id}`);
                    }}
                  >
                    {section.category.name}
                  </button>
                ))}
              </nav>

              {menuLoading && menuSections.length === 0 ? (
                <MenuSkeleton />
              ) : menuSections.length === 0 ? (
                <div className="mp-empty">
                  <div className="mp-empty-icon">!</div>
                  <div>
                    <strong>Esta sucursal no tiene platos disponibles en este momento.</strong>
                    <p>Cambia de sucursal o vuelve mas tarde para revisar la carta activa.</p>
                  </div>
                </div>
              ) : (
                <div className="mp-menu-sections" id="mp-stage-sections">
                  {menuSections.map((section) => (
                    <section key={section.category.id} id={`mp-section-${section.category.id}`} className="mp-menu-section">
                      <div className="mp-menu-section__head">
                        <div>
                          <span className="mp-menu-section__eyebrow">Seccion de la carta</span>
                          <h3>{section.category.name}</h3>
                          <p>{categoryNarrative(section.category.name, activeMerchant.trade_name)}</p>
                        </div>
                        <span className="mp-menu-section__count">{section.products.length} opciones</span>
                      </div>

                      <div className="mp-dishes-grid">
                        {section.products.map((product, index) => {
                          const branchSetting = productSettingForBranch(product, activeBranchId);
                          return (
                            <article key={product.id} className={`mp-dish-card${index === 0 ? ' mp-dish-card--feature' : ''}`}>
                              <div className="mp-dish-media" style={thumbStyle(product.image_url)}>
                                <div className="mp-dish-overlay" />
                                <div className="mp-dish-topline">
                                  <span className="mp-dish-kicker">
                                    <IconStar /> {appetiteKicker(product)}
                                  </span>
                                  <strong className="mp-dish-price">{formatMoney(priceForBranch(product, activeBranchId))}</strong>
                                </div>
                              </div>

                              <div className="mp-dish-body">
                                <div className="mp-dish-head">
                                  <strong className="mp-dish-name">{product.name}</strong>
                                  {branchSetting?.stock_qty != null ? (
                                    <span className="mp-dish-stock">
                                      <IconTag /> {branchSetting.stock_qty} disponibles
                                    </span>
                                  ) : null}
                                </div>

                                <p className="mp-dish-desc">{appetiteDescription(product)}</p>

                                <div className="mp-dish-footer">
                                  <span className="mp-dish-footer-note">{appetiteFooter(product)}</span>
                                  <button type="button" className="mp-add-btn" onClick={() => openProduct(product)}>
                                    <IconPlus /> Agregar
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </main>
          </div>
        ) : null}
      </div>

      {selectedProduct && activeMerchant && activeBranchId ? (
        <div
          className="mp-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Configurar ${selectedProduct.name}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProduct(null);
            }
          }}
        >
          <div className="mp-modal">
            <div className="mp-modal-hero" style={thumbStyle(selectedProduct.image_url || heroImage)} />

            <div className="mp-modal-body">
              <div className="mp-modal-header">
                <div className="mp-modal-info">
                  <h3 className="mp-modal-name">{selectedProduct.name}</h3>
                  <p className="mp-modal-desc">{appetiteDescription(selectedProduct)}</p>
                  <span className="mp-modal-price">{formatMoney(priceForBranch(selectedProduct, activeBranchId))}</span>
                </div>

                <button
                  type="button"
                  className="mp-modal-close"
                  onClick={() => setSelectedProduct(null)}
                  aria-label="Cerrar vista"
                >
                  x
                </button>
              </div>

              {selectedProduct.modifier_groups.map((group) => (
                <div key={group.id} className="mp-modifier">
                  <div className="mp-modifier-header">
                    <div>
                      <span className="mp-modifier-name">{group.name}</span>
                      <p className="mp-modifier-meta">
                        Elige hasta {Math.max(1, group.max_select)} opcion{Math.max(1, group.max_select) === 1 ? '' : 'es'}.
                      </p>
                    </div>
                    <span className={group.is_required ? 'mp-modifier-required' : 'mp-modifier-optional'}>
                      {group.is_required ? 'Requerido' : 'Opcional'}
                    </span>
                  </div>

                  <div className="mp-options">
                    {group.options.map((option) => {
                      const selected = (selectedOptions[group.id] ?? []).includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={selected ? 'mp-option-btn mp-option-btn--selected' : 'mp-option-btn'}
                          onClick={() => toggleOption(group.id, option.id, group.max_select)}
                        >
                          <span>{option.name}</span>
                          <div className="mp-option-side">
                            <strong>{option.price_delta > 0 ? `+${formatMoney(option.price_delta)}` : 'Incluido'}</strong>
                            <span className="mp-option-check">
                              {selected ? (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2,6 5,9 10,3" />
                                </svg>
                              ) : null}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <textarea
                className="mp-notes"
                value={productNotes}
                onChange={(event) => setProductNotes(event.target.value)}
                placeholder="Notas para cocina o detalle del pedido."
              />

              <div className="mp-modal-footer">
                <button type="button" className="mp-cancel-btn" onClick={() => setSelectedProduct(null)}>
                  Cancelar
                </button>
                <button type="button" className="mp-confirm-btn" onClick={addSelectedProduct} disabled={justAdded}>
                  {justAdded ? 'Agregado al carrito' : 'Agregar al carrito'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
