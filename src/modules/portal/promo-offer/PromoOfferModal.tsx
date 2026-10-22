import { useEffect, useMemo, useRef, useState } from 'react';
import mascotImage from '../../../images/acme-senalando.png';
import { buildWhatsAppLink, getUpcomingSeasons, PROMO_OPTIONS, PromoOptionId } from './promoOffer';
import './PromoOfferModal.css';

function OptionIcon({ id }: { id: PromoOptionId }) {
  const props = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (id === 'business') {
    // Tienda con estrella: el local destacado.
    return (
      <svg {...props}>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M4 9v11h16V9" />
        <path d="M12 12.5l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" />
      </svg>
    );
  }
  if (id === 'products') {
    // Etiqueta de oferta.
    return (
      <svg {...props}>
        <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
    );
  }
  // Calendario con destello: la temporada.
  return (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M12 13v4M10 15h4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.2-.2z" />
    </svg>
  );
}

/**
 * Modal que invita al local a promocionarse en la app de clientes.
 * Se cierra con la X, "Ahora no", Escape o tocando fuera; en todos los casos
 * queda guardado en el menu como "Solicitar promocion".
 */
export function PromoOfferModal({ merchantName, onClose }: { merchantName: string; onClose: () => void }) {
  const [selected, setSelected] = useState<PromoOptionId>('business');
  const [closing, setClosing] = useState(false);
  const seasons = useMemo(() => getUpcomingSeasons(), []);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);

  const option = PROMO_OPTIONS.find((item) => item.id === selected) ?? PROMO_OPTIONS[0];
  const whatsappHref = buildWhatsAppLink(merchantName, option, seasons[0]?.name);

  const close = () => {
    if (closing) return;
    setClosing(true);
    // Deja terminar la animacion de salida antes de desmontar.
    window.setTimeout(onClose, 220);
  };

  useEffect(() => {
    firstOptionRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`promo-offer ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="promo-offer-title" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="promo-offer__card">
        <button type="button" className="promo-offer__close" onClick={close} aria-label="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="promo-offer__hero">
          <span className="promo-offer__glow promo-offer__glow--one" aria-hidden="true" />
          <span className="promo-offer__glow promo-offer__glow--two" aria-hidden="true" />
          <div className="promo-offer__hero-copy">
            <span className="promo-offer__eyebrow">Nuevo para tu negocio</span>
            <h2 className="promo-offer__title" id="promo-offer-title">
              Haz que más clientes te encuentren
            </h2>
            <p className="promo-offer__subtitle">
              Aparece primero en la app de ACME Pedidos{merchantName ? ` y lleva a ${merchantName} a más hogares de Huancavelica` : ''}.
            </p>
            {seasons.length > 0 ? (
              <div className="promo-offer__seasons">
                <span className="promo-offer__seasons-label">Próximas temporadas</span>
                {seasons.map((season) => (
                  <span key={season.name} className="promo-offer__season">
                    <strong>{season.name}</strong> · {season.when}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <img className="promo-offer__mascot" src={mascotImage} alt="" />
        </div>

        <div className="promo-offer__body">
          <p className="promo-offer__question">¿Qué te gustaría promocionar?</p>
          <div className="promo-offer__options" role="radiogroup" aria-label="Tipo de promoción">
            {PROMO_OPTIONS.map((item, index) => (
              <button
                key={item.id}
                ref={index === 0 ? firstOptionRef : undefined}
                type="button"
                role="radio"
                aria-checked={selected === item.id}
                className={`promo-offer__option ${selected === item.id ? 'is-selected' : ''}`}
                onClick={() => setSelected(item.id)}
              >
                <span className="promo-offer__option-icon">
                  <OptionIcon id={item.id} />
                </span>
                <span className="promo-offer__option-text">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
                <span className="promo-offer__option-check" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="promo-offer__actions">
            <a className="promo-offer__cta" href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={close}>
              <WhatsAppIcon />
              Quiero promocionarme
            </a>
            <button type="button" className="promo-offer__later" onClick={close}>
              Ahora no
            </button>
          </div>
          <p className="promo-offer__footnote">Te atiende el equipo de ACME Pedidos por WhatsApp. Lo encuentras siempre en el menú, en “Solicitar promoción”.</p>
        </div>
      </div>
    </div>
  );
}
