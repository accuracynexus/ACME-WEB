import { Component, ReactNode } from 'react';

/**
 * Si una pagina del portal se cae al dibujarse, React desmonta todo y queda la
 * pantalla en blanco sin ninguna pista. Esto atrapa el error, muestra que paso
 * y deja reintentar sin perder la sesion. El menu lateral sigue funcionando
 * porque el limite envuelve solo el contenido.
 */
export class PortalErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Queda en consola con el componente donde fallo, para diagnosticarlo.
    console.error('[portal] Error al mostrar la pagina:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Al cambiar de pagina se vuelve a intentar.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="portal-emptyState" role="alert" style={{ display: 'grid', gap: '10px', justifyItems: 'start' }}>
        <strong>No pudimos mostrar esta pagina</strong>
        <span>Ocurrio un error inesperado. Puedes reintentar; si se repite, comparte este mensaje con soporte.</span>
        <code style={{ fontSize: '12px', padding: '8px 10px', borderRadius: '8px', background: 'var(--acme-surface-muted)', color: 'var(--acme-red)', whiteSpace: 'pre-wrap', maxWidth: '100%' }}>
          {error.message || String(error)}
        </code>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => this.setState({ error: null })}>
          Reintentar
        </button>
      </section>
    );
  }
}
