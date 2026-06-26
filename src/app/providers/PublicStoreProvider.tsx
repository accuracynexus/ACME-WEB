import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { publicCustomerService, CustomerRegistrationPayload } from '../../core/services/publicCustomerService';
import { PublicCartItem, PublicStoreContext } from '../../modules/public/store/PublicStoreContext';

const STORAGE_CART_KEY = 'publicCartV1';
const STORAGE_PENDING_CUSTOMER_KEY = 'pendingCustomerRegistration';

function readStoredCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PublicCartItem[]) : [];
  } catch {
    return [];
  }
}

function writeStoredCart(items: PublicCartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(items));
}

function readPendingRegistration() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PENDING_CUSTOMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePendingRegistration(payload: Omit<CustomerRegistrationPayload, 'password'>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_PENDING_CUSTOMER_KEY, JSON.stringify(payload));
}

function clearPendingRegistration() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_PENDING_CUSTOMER_KEY);
}

function registrationFromUserMetadata(user: any): Omit<CustomerRegistrationPayload, 'password'> | null {
  const metadata = user?.user_metadata ?? {};
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : '';
  const phone = typeof metadata.phone === 'string' ? metadata.phone : '';
  const email = typeof user?.email === 'string' ? user.email : '';
  if (!fullName && !phone && !email) return null;

  return {
    full_name: fullName,
    email,
    phone,
    address: metadata.primary_address ?? undefined,
  };
}

function randomId() {
  return crypto.randomUUID();
}

function calculateCartSubtotal(items: PublicCartItem[]) {
  return items.reduce((sum, item) => {
    const modifiersTotal = item.modifiers.reduce((modifierSum, modifier) => modifierSum + modifier.price_delta * Math.max(1, modifier.quantity), 0);
    return sum + (item.unit_price + modifiersTotal) * item.quantity;
  }, 0);
}

export function PublicStoreProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(() => readPendingRegistration()?.email ?? null);
  const [cartItems, setCartItems] = useState<PublicCartItem[]>(() => readStoredCart());

  const hydrateProfile = useCallback(async (userId: string) => {
    const result = await publicCustomerService.fetchProfileLite(userId);
    if (result.error) {
      setProfile(null);
      return;
    }
    setProfile(result.data);
  }, []);

  const reloadPublicSession = useCallback(async () => {
    setIsAuthLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser = session?.user ?? null;
    setSessionUser(currentUser);

    if (!currentUser) {
      setProfile(null);
      setIsAuthLoading(false);
      return;
    }

    const pending = readPendingRegistration() ?? registrationFromUserMetadata(currentUser);
    if (pending && (!pending.email || pending.email === currentUser.email)) {
      const ensureResult = await publicCustomerService.ensureCustomerAccount(currentUser.id, pending);
      if (!ensureResult.error) {
        clearPendingRegistration();
        setPendingVerificationEmail(null);
      }
    }

    await hydrateProfile(currentUser.id);
    setIsAuthLoading(false);
  }, [hydrateProfile]);

  useEffect(() => {
    reloadPublicSession();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      reloadPublicSession();
    });

    return () => listener.subscription?.unsubscribe();
  }, [reloadPublicSession]);

  useEffect(() => {
    writeStoredCart(cartItems);
  }, [cartItems]);

  const signInCustomer = useCallback(
    async (email: string, password: string) => {
      const result = await publicCustomerService.signInCustomer(email, password);
      if (!result.error) {
        await reloadPublicSession();
      }
      return result;
    },
    [reloadPublicSession]
  );

  const signUpCustomer = useCallback(
    async (payload: CustomerRegistrationPayload) => {
      const result = await publicCustomerService.signUpCustomer(payload);
      if (result.error) {
        return result;
      }

      writePendingRegistration({
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
      });
      setPendingVerificationEmail(payload.email);

      if (result.data.user && result.data.session) {
        await publicCustomerService.ensureCustomerAccount(result.data.user.id, {
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
        });
        clearPendingRegistration();
        setPendingVerificationEmail(null);
      }

      await reloadPublicSession();
      return result;
    },
    [reloadPublicSession]
  );

  const signOutCustomer = useCallback(async () => {
    await publicCustomerService.signOutCustomer();
    await reloadPublicSession();
  }, [reloadPublicSession]);

  const resendVerification = useCallback(async (email: string) => {
    return publicCustomerService.resendSignupVerification(email);
  }, []);

  const addItem = useCallback((item: Omit<PublicCartItem, 'id'>) => {
    setCartItems((current) => {
      if (current.length > 0) {
        const cartMerchantId = current[0].merchant_id;
        const cartBranchId = current[0].branch_id;
        if ((cartMerchantId !== item.merchant_id || cartBranchId !== item.branch_id) && !window.confirm('Tu carrito actual pertenece a otro negocio o sucursal. ¿Deseas reemplazarlo?')) {
          return current;
        }
        if (cartMerchantId !== item.merchant_id || cartBranchId !== item.branch_id) {
          return [{ ...item, id: randomId() }];
        }
      }

      const itemKey = JSON.stringify({
        product_id: item.product_id,
        branch_id: item.branch_id,
        notes: item.notes,
        modifiers: item.modifiers.map((modifier) => `${modifier.option_id}:${modifier.quantity}`).sort(),
      });
      const existingIndex = current.findIndex((entry) => {
        const entryKey = JSON.stringify({
          product_id: entry.product_id,
          branch_id: entry.branch_id,
          notes: entry.notes,
          modifiers: entry.modifiers.map((modifier) => `${modifier.option_id}:${modifier.quantity}`).sort(),
        });
        return entryKey === itemKey;
      });

      if (existingIndex >= 0) {
        return current.map((entry, index) => (index === existingIndex ? { ...entry, quantity: entry.quantity + item.quantity } : entry));
      }

      return [...current, { ...item, id: randomId() }];
    });
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    setCartItems((current) =>
      current
        .map((item) => (item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item))
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const updateItemNotes = useCallback((itemId: string, notes: string) => {
    setCartItems((current) => current.map((item) => (item.id === itemId ? { ...item, notes } : item)));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const value = useMemo(
    () => ({
      sessionUser,
      profile,
      isAuthLoading,
      pendingVerificationEmail,
      cartItems,
      cartCount: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      cartSubtotal: calculateCartSubtotal(cartItems),
      signInCustomer,
      signUpCustomer,
      signOutCustomer,
      resendVerification,
      reloadPublicSession,
      addItem,
      updateItemQuantity,
      updateItemNotes,
      removeItem,
      clearCart,
    }),
    [
      addItem,
      cartItems,
      clearCart,
      isAuthLoading,
      pendingVerificationEmail,
      profile,
      reloadPublicSession,
      removeItem,
      resendVerification,
      sessionUser,
      signInCustomer,
      signOutCustomer,
      signUpCustomer,
      updateItemNotes,
      updateItemQuantity,
    ]
  );

  return <PublicStoreContext.Provider value={value}>{children}</PublicStoreContext.Provider>;
}
