import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function productSettingForBranch(product: PublicMarketplaceProduct, branchId: string | null) {
  if (!branchId) return null;
  return product.settings.find((setting) => setting.branch_id === branchId) ?? null;
}

// No hay filtro de disponibilidad aqui a proposito: el local activa o desactiva
// cada producto (products.is_active) y la base le oculta al publico los
// desactivados, asi que todo lo que llega ya esta disponible. Filtrar por
// product_branch_settings no servia: la base tambien oculta esas filas y su
// ausencia se leia como "disponible".

function priceForBranch(product: PublicMarketplaceProduct, branchId: string | null) {
  const setting = productSettingForBranch(product, branchId);
  return setting?.price ?? product.base_price;
}

function isBranchOpen(branch: PublicMarketplaceBranch | null | undefined) {
  return Boolean(branch?.is_open && branch?.accepting_orders);
}

function merchantCover(merchant: PublicMarketplaceMerchant) {
  return merchant.products.find((product) => product.image_url)?.image_url || merchant.logo_url || '';
}

function prepLabel(branch: PublicMarketplaceBranch | null) {
  if (!branch || branch.prep_time_avg_min <= 0) return null;
  return `${branch.prep_time_avg_min}-${branch.prep_time_avg_min + 10} min`;
}

function placeLabel(branch: PublicMarketplaceBranch | null) {
  if (!branch) return 'Huancavelica';
  return [branch.address_label, branch.district || branch.city].filter(Boolean).join(', ') || 'Huancavelica';
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

type MenuSection = {
  id: string;
  name: string;
  sortOrder: number;
  products: PublicMarketplaceProduct[];
};

function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function IconCart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function GridSkeleton() {
  return (
    <div className="mp-grid" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="mp-store mp-store--skeleton">
          <div className="mp-store__cover" />
          <div className="mp-store__body">
            <div className="mp-skel-line" />
            <div className="mp-skel-line mp-skel-line--short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="mp-dishes" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="mp-dish mp-dish--skeleton">
          <div className="mp-dish__body">
            <div className="mp-skel-line" />
            <div className="mp-skel-line mp-skel-line--short" />
          </div>
          <div className="mp-dish__img" />
        </div>
      ))}
    </div>
  );
}

export function MarketplacePage() {
  const publicStore = usePublicStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [snapshot, setSnapshot] = useState<{ merchants: PublicMarketplaceMerchant[]; full: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<PublicMarketplaceProduct | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [productNotes, setProductNotes] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const deferredQuery = useDeferredValue(query);

  // El local abierto vive en la URL (?local=id): se puede compartir y el boton
  // "atras" del navegador vuelve a la lista de locales.
  const activeMerchantId = searchParams.get('local');

  useEffect(() => {
    let cancelled = false;

    // Fase 1: lista ligera de locales para pintar la grilla de inmediato.
    publicMarketplaceService.fetchMerchantsLite().then((result) => {
      if (cancelled || result.error || !result.data) return;
      const lite = result.data.merchants;
      setSnapshot((prev) => (prev?.full ? prev : { merchants: lite, full: false }));
    });

    // Fase 2: catalogo completo (platos y modificadores) en segundo plano.
    publicMarketplaceService.fetchSnapshot().then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError((prev) => prev ?? result.error.message);
        return;
      }
      setSnapshot({ merchants: result.data?.merchants ?? [], full: true });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const merchants = useMemo(() => snapshot?.merchants ?? [], [snapshot]);
  const catalogReady = Boolean(snapshot?.full);
  const normalizedQuery = useMemo(() => normalize(deferredQuery), [deferredQuery]);

  // Locales sin platos no se muestran una vez cargado el catalogo; los abiertos van primero.
  const visibleMerchants = useMemo(() => {
    const withMenu = catalogReady ? merchants.filter((merchant) => merchant.products.length > 0) : merchants;
    return [...withMenu].sort((left, right) => {
      const openDiff = Number(isBranchOpen(right.branches[0])) - Number(isBranchOpen(left.branches[0]));
      return openDiff || left.trade_name.localeCompare(right.trade_name);
    });
  }, [catalogReady, merchants]);

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return visibleMerchants.map((merchant) => ({ merchant, matches: [] as string[] }));
    return visibleMerchants
      .map((merchant) => {
        const nameMatch = normalize(merchant.trade_name).includes(normalizedQuery);
        const categoryMatch = merchant.categories.some((category) => normalize(category.name).includes(normalizedQuery));
        const matches = merchant.products
          .filter((product) => normalize(`${product.name} ${product.description}`).includes(normalizedQuery))
          .map((product) => product.name);
        return { merchant, matches, hit: nameMatch || categoryMatch || matches.length > 0 };
      })
      .filter((row) => row.hit)
      .map(({ merchant, matches }) => ({ merchant, matches }));
  }, [normalizedQuery, visibleMerchants]);

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
      .slice(0, 6)
      .map(([name]) => name);
  }, [merchants]);

  const activeMerchant = merchants.find((merchant) => merchant.id === activeMerchantId) ?? null;

  useEffect(() => {
    if (!activeMerchant) return;
    if (!activeBranchId || !activeMerchant.branches.some((branch) => branch.id === activeBranchId)) {
      setActiveBranchId(activeMerchant.branches[0]?.id ?? null);
    }
  }, [activeBranchId, activeMerchant]);

  const activeBranch =
    activeMerchant?.branches.find((branch) => branch.id === activeBranchId) ?? activeMerchant?.branches[0] ?? null;

  const menuSections = useMemo(() => {
    if (!activeMerchant) return [] as MenuSection[];
    const available = activeMerchant.products;

    const sections: MenuSection[] = activeMerchant.categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sort_order,
        products: available.filter((product) => product.category_id === category.id),
      }))
      .filter((section) => section.products.length > 0);

    const others = available.filter(
      (product) => !activeMerchant.categories.some((category) => category.id === product.category_id)
    );
    if (others.length > 0) {
      sections.push({ id: 'otros', name: 'Otros', sortOrder: Number.MAX_SAFE_INTEGER, products: others });
    }

    return sections.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  }, [activeMerchant, activeBranch]);

  const openMerchant = (merchantId: string) => {
    startTransition(() => {
      setActiveSectionId(null);
      setSearchParams({ local: merchantId });
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeMerchant = () => {
    setSearchParams({});
    window.scrollTo({ top: 0 });
  };

  const openProduct = (product: PublicMarketplaceProduct) => {
    setSelectedProduct(product);
    setSelectedOptions({});
    setProductNotes('');
    setQuantity(1);
    setJustAdded(false);
  };

  const closeProduct = () => setSelectedProduct(null);

  const toggleOption = (groupId: string, optionId: string, maxSelect: number) => {
    setSelectedOptions((current) => {
      const selected = current[groupId] ?? [];
      if (selected.includes(optionId)) {
        return { ...current, [groupId]: selected.filter((item) => item !== optionId) };
      }
      const max = Math.max(1, maxSelect);
      // Con una sola opcion permitida, elegir otra reemplaza la anterior.
      if (max === 1) return { ...current, [groupId]: [optionId] };
      if (selected.length >= max) return current;
      return { ...current, [groupId]: [...selected, optionId] };
    });
  };

  const missingRequired = selectedProduct
    ? selectedProduct.modifier_groups.filter((group) => {
        const min = Math.max(group.is_required ? 1 : 0, group.min_select);
        return (selectedOptions[group.id] ?? []).length < min;
      })
    : [];

  const selectedTotal = selectedProduct
    ? (priceForBranch(selectedProduct, activeBranch?.id ?? null) +
        selectedProduct.modifier_groups.reduce(
          (sum, group) =>
            sum +
            (selectedOptions[group.id] ?? []).reduce(
              (inner, optionId) => inner + (group.options.find((option) => option.id === optionId)?.price_delta ?? 0),
              0
            ),
          0
        )) *
      quantity
    : 0;

  const addSelectedProduct = () => {
    if (!selectedProduct || !activeMerchant || !activeBranch || missingRequired.length > 0) return;

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

    const added = publicStore.addItem({
      merchant_id: activeMerchant.id,
      merchant_name: activeMerchant.trade_name,
      branch_id: activeBranch.id,
      branch_name: activeBranch.name || 'Sucursal',
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_description: selectedProduct.description,
      image_url: selectedProduct.image_url,
      unit_price: priceForBranch(selectedProduct, activeBranch.id),
      quantity,
      notes: productNotes.trim(),
      modifiers,
    });
    if (!added) return;

    setJustAdded(true);
    window.setTimeout(() => {
      setJustAdded(false);
      setSelectedProduct(null);
    }, 700);
  };

  const cartBar =
    publicStore.cartCount > 0 ? (
      <Link to="/carrito" className="mp-cartbar">
        <span className="mp-cartbar__count">{publicStore.cartCount}</span>
        <span className="mp-cartbar__label">
          <IconCart /> Ver carrito y pagar
        </span>
        <strong>{formatMoney(publicStore.cartSubtotal)}</strong>
      </Link>
    ) : null;

  // ── Vista 2: carta de un local ─────────────────────────────────────────────
  if (activeMerchantId) {
    const cover = activeMerchant ? merchantCover(activeMerchant) : '';
    const open = isBranchOpen(activeBranch);
    const prep = prepLabel(activeBranch);

    return (
      <section className="mp-page">
        <div className="mp-wrap">
          <button type="button" className="mp-back" onClick={closeMerchant}>
            <IconBack /> Todos los locales
          </button>

          {!snapshot ? (
            <MenuSkeleton />
          ) : !activeMerchant ? (
            <div className="mp-empty">
              <strong>No encontramos este local.</strong>
              <p>Puede que ya no esté disponible. Elige otro de la lista.</p>
            </div>
          ) : (
            <>
              <header className="mp-store-head">
                <div className="mp-store-head__cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined} />
                <div className="mp-store-head__info">
                  <div
                    className="mp-store-head__logo"
                    style={activeMerchant.logo_url ? { backgroundImage: `url(${activeMerchant.logo_url})` } : undefined}
                  >
                    {activeMerchant.logo_url ? null : activeMerchant.trade_name.charAt(0)}
                  </div>
                  <div>
                    <h1>{activeMerchant.trade_name}</h1>
                    <div className="mp-store-head__meta">
                      <span className={open ? 'mp-badge mp-badge--open' : 'mp-badge'}>{open ? 'Abierto' : 'Cerrado ahora'}</span>
                      {prep ? <span>{prep}</span> : null}
                      <span>{placeLabel(activeBranch)}</span>
                    </div>
                  </div>
                </div>

                {activeMerchant.branches.length > 1 ? (
                  <div className="mp-branches">
                    <span>Sucursal:</span>
                    {activeMerchant.branches.map((branch) => (
                      <button
                        key={branch.id}
                        type="button"
                        className={branch.id === activeBranch?.id ? 'mp-chip mp-chip--active' : 'mp-chip'}
                        onClick={() => setActiveBranchId(branch.id)}
                      >
                        {branch.name}
                      </button>
                    ))}
                  </div>
                ) : null}

                {!open ? (
                  <p className="mp-notice">Este local no está recibiendo pedidos en este momento. Puedes ver su carta.</p>
                ) : null}
              </header>

              {menuSections.length > 1 ? (
                <nav className="mp-rail" aria-label="Secciones de la carta">
                  {menuSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={activeSectionId === section.id ? 'mp-chip mp-chip--active' : 'mp-chip'}
                      onClick={() => {
                        setActiveSectionId(section.id);
                        scrollToId(`mp-section-${section.id}`);
                      }}
                    >
                      {section.name}
                    </button>
                  ))}
                </nav>
              ) : null}

              {!catalogReady ? (
                <MenuSkeleton />
              ) : menuSections.length === 0 ? (
                <div className="mp-empty">
                  <strong>Este local no tiene platos disponibles ahora.</strong>
                  <p>Vuelve más tarde o elige otro local.</p>
                </div>
              ) : (
                menuSections.map((section) => (
                  <section key={section.id} id={`mp-section-${section.id}`} className="mp-section">
                    <h2>
                      {section.name} <small>{section.products.length}</small>
                    </h2>
                    <div className="mp-dishes">
                      {section.products.map((product) => (
                        <button key={product.id} type="button" className="mp-dish" onClick={() => openProduct(product)}>
                          <div className="mp-dish__body">
                            <strong className="mp-dish__name">{product.name}</strong>
                            {product.description ? <p className="mp-dish__desc">{product.description}</p> : null}
                            <span className="mp-dish__price">{formatMoney(priceForBranch(product, activeBranch?.id ?? null))}</span>
                          </div>
                          <div
                            className="mp-dish__img"
                            style={product.image_url ? { backgroundImage: `url(${product.image_url})` } : undefined}
                          >
                            <span className="mp-dish__add" aria-label={`Agregar ${product.name}`}>
                              <IconPlus />
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )}
        </div>

        {cartBar}

        {selectedProduct && activeMerchant && activeBranch ? (
          <div
            className="mp-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={selectedProduct.name}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeProduct();
            }}
          >
            <div className="mp-modal">
              <button type="button" className="mp-modal__close" onClick={closeProduct} aria-label="Cerrar">
                ×
              </button>
              {selectedProduct.image_url ? (
                <div className="mp-modal__img" style={{ backgroundImage: `url(${selectedProduct.image_url})` }} />
              ) : null}

              <div className="mp-modal__body">
                <h3>{selectedProduct.name}</h3>
                {selectedProduct.description ? <p className="mp-modal__desc">{selectedProduct.description}</p> : null}
                <span className="mp-modal__price">{formatMoney(priceForBranch(selectedProduct, activeBranch.id))}</span>

                {selectedProduct.modifier_groups.map((group) => {
                  const max = Math.max(1, group.max_select);
                  const required = group.is_required || group.min_select > 0;
                  return (
                    <div key={group.id} className="mp-mod">
                      <div className="mp-mod__head">
                        <div>
                          <strong>{group.name}</strong>
                          <small>{max === 1 ? 'Elige 1' : `Elige hasta ${max}`}</small>
                        </div>
                        <span className={required ? 'mp-mod__tag mp-mod__tag--req' : 'mp-mod__tag'}>
                          {required ? 'Obligatorio' : 'Opcional'}
                        </span>
                      </div>
                      {group.options.map((option) => {
                        const selected = (selectedOptions[group.id] ?? []).includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={selected ? 'mp-opt mp-opt--on' : 'mp-opt'}
                            onClick={() => toggleOption(group.id, option.id, group.max_select)}
                          >
                            <span className={max === 1 ? 'mp-opt__radio' : 'mp-opt__check'} />
                            <span className="mp-opt__name">{option.name}</span>
                            <span className="mp-opt__price">{option.price_delta > 0 ? `+${formatMoney(option.price_delta)}` : ''}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                <label className="mp-notes">
                  <span>¿Alguna indicación?</span>
                  <textarea
                    value={productNotes}
                    onChange={(event) => setProductNotes(event.target.value)}
                    placeholder="Ej. sin cebolla, salsa aparte"
                    rows={2}
                  />
                </label>
              </div>

              <div className="mp-modal__foot">
                <div className="mp-qty">
                  <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Quitar uno">
                    −
                  </button>
                  <span>{quantity}</span>
                  <button type="button" onClick={() => setQuantity((q) => Math.min(20, q + 1))} aria-label="Agregar uno">
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="mp-add"
                  onClick={addSelectedProduct}
                  disabled={justAdded || missingRequired.length > 0}
                >
                  {justAdded
                    ? 'Agregado ✓'
                    : missingRequired.length > 0
                      ? `Elige ${missingRequired[0].name.toLowerCase()}`
                      : `Agregar · ${formatMoney(selectedTotal)}`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // ── Vista 1: lista de locales ──────────────────────────────────────────────
  return (
    <section className="mp-page">
      <div className="mp-wrap">
        <header className="mp-hero">
          <h1>¿Qué vas a pedir hoy?</h1>
          <p>Elige un local de Huancavelica, arma tu pedido y págalo en línea. Te lo llevamos a tu puerta.</p>

          <div className="mp-search">
            <IconSearch />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Busca un local o un plato: pollo, pizza, ceviche…"
              aria-label="Buscar locales o platos"
              autoComplete="off"
            />
            {query ? (
              <button type="button" className="mp-search__clear" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}>
                ×
              </button>
            ) : null}
          </div>

          {suggestionChips.length > 0 ? (
            <div className="mp-chips">
              {suggestionChips.map((chip) => {
                const active = normalize(query) === normalize(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    className={active ? 'mp-chip mp-chip--active' : 'mp-chip'}
                    onClick={() => setQuery(active ? '' : chip)}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          ) : null}
        </header>

        <ol className="mp-steps" aria-label="Cómo pedir">
          <li><span>1</span> Elige un local</li>
          <li><span>2</span> Agrega tus platos</li>
          <li><span>3</span> Paga con Izipay en el carrito</li>
        </ol>

        {error && !snapshot ? <div className="mp-empty"><strong>{error}</strong></div> : null}

        {!snapshot ? (
          <GridSkeleton />
        ) : searchResults.length === 0 ? (
          <div className="mp-empty">
            <strong>No encontramos "{query}".</strong>
            <p>Prueba con otro plato o el nombre de un local.</p>
          </div>
        ) : (
          <>
            <h2 className="mp-count">
              {normalizedQuery
                ? `${searchResults.length} local${searchResults.length === 1 ? '' : 'es'} con "${query.trim()}"`
                : `${searchResults.length} locales`}
            </h2>
            <div className="mp-grid">
              {searchResults.map(({ merchant, matches }) => {
                const branch = merchant.branches[0] ?? null;
                const open = isBranchOpen(branch);
                const cover = merchantCover(merchant);
                const prep = prepLabel(branch);
                const preview = matches.length > 0 ? matches : merchant.featured_product_names;
                return (
                  <button
                    key={merchant.id}
                    type="button"
                    className={open ? 'mp-store' : 'mp-store mp-store--closed'}
                    onClick={() => openMerchant(merchant.id)}
                  >
                    <div className="mp-store__cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
                      {!open ? <span className="mp-store__closed">Cerrado ahora</span> : null}
                    </div>
                    <div className="mp-store__body">
                      <div
                        className="mp-store__logo"
                        style={merchant.logo_url ? { backgroundImage: `url(${merchant.logo_url})` } : undefined}
                      >
                        {merchant.logo_url ? null : merchant.trade_name.charAt(0)}
                      </div>
                      <div className="mp-store__text">
                        <strong>{merchant.trade_name}</strong>
                        <span className="mp-store__meta">
                          {[branch?.district || branch?.city || 'Huancavelica', prep, catalogReady ? `${merchant.products.length} platos` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {preview.length > 0 ? (
                          <span className="mp-store__preview">
                            {matches.length > 0 ? 'Tiene: ' : ''}
                            {preview.slice(0, 3).join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {cartBar}
    </section>
  );
}
