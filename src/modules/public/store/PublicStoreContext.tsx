import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
import { CustomerRegistrationPayload, CustomerProfileLite, PublicCartModifierSelection } from '../../../core/services/publicCustomerService';

// Un pedido puede juntar productos de hasta este número de locales; el envío
// sube por cada local extra (lo calcula el backend).
export const MAX_CART_BRANCHES = 5;

export interface PublicCartItem {
  id: string;
  merchant_id: string;
  merchant_name: string;
  branch_id: string;
  branch_name: string;
  product_id: string;
  product_name: string;
  product_description: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  notes: string;
  modifiers: PublicCartModifierSelection[];
}

export interface PublicStoreContextState {
  sessionUser: User | null;
  profile: CustomerProfileLite | null;
  isAuthLoading: boolean;
  pendingVerificationEmail: string | null;
  cartItems: PublicCartItem[];
  cartCount: number;
  cartSubtotal: number;
  signInCustomer: (email: string, password: string) => Promise<any>;
  signUpCustomer: (payload: CustomerRegistrationPayload) => Promise<any>;
  signOutCustomer: () => Promise<{ error: Error | null }>;
  resendVerification: (email: string) => Promise<any>;
  reloadPublicSession: () => Promise<void>;
  addItem: (item: Omit<PublicCartItem, 'id'>) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

export const PublicStoreContext = createContext<PublicStoreContextState>({
  sessionUser: null,
  profile: null,
  isAuthLoading: true,
  pendingVerificationEmail: null,
  cartItems: [],
  cartCount: 0,
  cartSubtotal: 0,
  signInCustomer: async () => ({ error: new Error('PublicStoreProvider no cargado') }),
  signUpCustomer: async () => ({ error: new Error('PublicStoreProvider no cargado') }),
  signOutCustomer: async () => ({ error: new Error('PublicStoreProvider no cargado') }),
  resendVerification: async () => ({ error: new Error('PublicStoreProvider no cargado') }),
  reloadPublicSession: async () => undefined,
  addItem: () => undefined,
  updateItemQuantity: () => undefined,
  updateItemNotes: () => undefined,
  removeItem: () => undefined,
  clearCart: () => undefined,
});

export function usePublicStore() {
  return useContext(PublicStoreContext);
}
