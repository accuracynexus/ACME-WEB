import { Toaster } from 'sileo';
import { AppRouter } from './app/router';
import { PortalProvider } from './app/providers/PortalProvider';
import { PublicStoreProvider } from './app/providers/PublicStoreProvider';
import { PortalErrorBoundary } from './components/shared/PortalErrorBoundary';

function App() {
  return (
    // Ultima red: si algo se cae fuera del contenido (menu, cabecera, avisos),
    // se ve el error en vez de una pantalla en blanco.
    <PortalErrorBoundary>
      <PortalProvider>
        <PublicStoreProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </PublicStoreProvider>
      </PortalProvider>
    </PortalErrorBoundary>
  );
}

export default App;
