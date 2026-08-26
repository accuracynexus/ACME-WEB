import { Navigate, Route, Routes } from 'react-router-dom';
import ScrollToTop from '../components/ScrollToTop';
import { PublicLayout, PortalLayout } from '../layouts';
import { LoginPage } from '../../modules/auth/login/LoginPage';
import { FirstAccessPasswordPage } from '../../modules/auth/first-access/FirstAccessPasswordPage';
import { PasswordRecoveryPage } from '../../modules/auth/recovery/PasswordRecoveryPage';
import { HomePage } from '../../modules/public/home/HomePage';
import { AboutPage } from '../../modules/public/about/AboutPage';
import { MarketplacePage } from '../../modules/public/marketplace/MarketplacePage';
import { CartPage } from '../../modules/public/cart/CartPage';
import { AccountPage } from '../../modules/public/account/AccountPage';
import { BusinessPage } from '../../modules/public/business/BusinessPage';
import { BetasPage } from '../../modules/public/betas/BetasPage';
import { ContactPage } from '../../modules/public/contact/ContactPage';
import { HazteDriverPage } from '../../modules/public/downloads/HazteDriverPage';
import { MyOrdersPage } from '../../modules/public/orders/MyOrdersPage';
import { OrderConfirmationPage } from '../../modules/public/orders/OrderConfirmationPage';
import { TermsPage, PrivacyPage, RefundsPage, ComplaintsBookPage } from '../../modules/public/legal/LegalPages';
import { PrivateRoute } from '../../modules/auth/guards/PrivateRoute';
import { DashboardPage } from '../../modules/portal/dashboard/DashboardPage';
import { OrdersPage, OrderDetailPage } from '../../modules/portal/orders';
import { MenuPage } from '../../modules/portal/menu/MenuPage';
import { CategoriesPage } from '../../modules/portal/categories/CategoriesPage';
import { ProductsPage } from '../../modules/portal/products/ProductsPage';
import { BranchStatusPage } from '../../modules/portal/branch-status/BranchStatusPage';
import { HoursPage } from '../../modules/portal/hours/HoursPage';
import { StaffPage } from '../../modules/portal/staff/StaffPage';
import { AdminDashboardPage } from '../../modules/portal/admin/dashboard/AdminDashboardPage';
import { CommercePage } from '../../modules/portal/admin/commerce/CommercePage';
import { BranchesPage } from '../../modules/portal/admin/branches/BranchesPage';
import { BranchEditorPage } from '../../modules/portal/admin/branches/BranchEditorPage';
import { CategoriesAdminPage } from '../../modules/portal/admin/catalog/CategoriesAdminPage';
import { ModifiersAdminPage } from '../../modules/portal/admin/catalog/ModifiersAdminPage';
import { ProductsAdminPage } from '../../modules/portal/admin/catalog/ProductsAdminPage';
import { ProductEditorPage } from '../../modules/portal/admin/catalog/ProductEditorPage';
import { StaffAdminPage } from '../../modules/portal/admin/staff/StaffAdminPage';
import { OrdersAdminPage } from '../../modules/portal/admin/orders/OrdersAdminPage';
import { OrderDetailAdminPage } from '../../modules/portal/admin/orders/OrderDetailAdminPage';
import { CustomersAdminPage } from '../../modules/portal/admin/customers/CustomersAdminPage';
import { CustomerDetailAdminPage } from '../../modules/portal/admin/customers/CustomerDetailAdminPage';
import { DriversAdminPage } from '../../modules/portal/admin/drivers/DriversAdminPage';
import { DriverDetailAdminPage } from '../../modules/portal/admin/drivers/DriverDetailAdminPage';
import { PromotionsAdminPage } from '../../modules/portal/admin/promotions/PromotionsAdminPage';
import { PromotionDetailAdminPage } from '../../modules/portal/admin/promotions/PromotionDetailAdminPage';
import { MessagesAdminPage } from '../../modules/portal/admin/messages/MessagesAdminPage';
import { ConversationDetailAdminPage } from '../../modules/portal/admin/messages/ConversationDetailAdminPage';
import { SettlementsAdminPage } from '../../modules/portal/admin/settlements/SettlementsAdminPage';
import { MerchantSettlementDetailPage } from '../../modules/portal/admin/settlements/MerchantSettlementDetailPage';
import { DriverSettlementDetailPage } from '../../modules/portal/admin/settlements/DriverSettlementDetailPage';
import { SystemAdminPage } from '../../modules/portal/admin/system/SystemAdminPage';
import { PlatformBusinessesPage } from '../../modules/portal/admin/platform/businesses/PlatformBusinessesPage';
import { PlatformBusinessDetailPage } from '../../modules/portal/admin/platform/businesses/PlatformBusinessDetailPage';
import { SecurityAdminPage } from '../../modules/portal/admin/platform/security/SecurityAdminPage';
import { PlatformUsersPage } from '../../modules/portal/admin/platform/users/PlatformUsersPage';
import { PaymentsAdminPage } from '../../modules/portal/admin/payments/PaymentsAdminPage';
import { BranchTurnPage } from '../../modules/portal/admin/branch/BranchTurnPage';
import { BranchLocalStatusPage } from '../../modules/portal/admin/branch/BranchLocalStatusPage';
import { BranchOperationalMenuPage } from '../../modules/portal/admin/branch/BranchOperationalMenuPage';

export function AppRouter() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="como-funciona" element={<AboutPage />} />
        <Route path="pedir" element={<MarketplacePage />} />
        <Route path="carrito" element={<CartPage />} />
        <Route path="mi-cuenta" element={<AccountPage />} />
        <Route path="mis-pedidos" element={<MyOrdersPage />} />
        <Route path="pedido/:orderId" element={<OrderConfirmationPage />} />
        <Route path="terminos-y-condiciones" element={<TermsPage />} />
        <Route path="politica-de-privacidad" element={<PrivacyPage />} />
        <Route path="devoluciones-y-cancelaciones" element={<RefundsPage />} />
        <Route path="libro-de-reclamaciones" element={<ComplaintsBookPage />} />
        <Route path="para-negocios" element={<BusinessPage />} />
        <Route path="hazte-driver" element={<HazteDriverPage />} />
        <Route path="contacto" element={<ContactPage />} />
        <Route path="portal/login" element={<LoginPage />} />
        <Route path="portal/recover-password" element={<PasswordRecoveryPage />} />
      </Route>

      {/* Oculta y fuera de PublicLayout: sin header ni footer, no se llega
          navegando, solo con el link directo. */}
      <Route path="betas" element={<BetasPage />} />

      <Route path="portal" element={<PortalLayout />}>
        <Route element={<PrivateRoute />}>
          <Route index element={<Navigate to="admin" replace />} />

          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/platform/businesses" element={<PlatformBusinessesPage />} />
          <Route path="admin/platform/businesses/:merchantId" element={<PlatformBusinessDetailPage />} />
          <Route path="admin/platform/security" element={<SecurityAdminPage />} />
          <Route path="admin/platform/users" element={<PlatformUsersPage />} />
          <Route path="admin/payments" element={<PaymentsAdminPage />} />
          <Route path="admin/turn" element={<BranchTurnPage />} />
          <Route path="admin/commerce" element={<CommercePage />} />
          <Route path="admin/branches" element={<BranchesPage />} />
          <Route path="admin/local-status" element={<BranchLocalStatusPage />} />
          <Route path="admin/operational-menu" element={<BranchOperationalMenuPage />} />
          <Route path="admin/branches/new" element={<BranchEditorPage />} />
          <Route path="admin/branches/:branchId" element={<BranchEditorPage />} />
          <Route path="admin/catalog/categories" element={<CategoriesAdminPage />} />
          <Route path="admin/catalog/modifiers" element={<ModifiersAdminPage />} />
          <Route path="admin/catalog/products" element={<ProductsAdminPage />} />
          <Route path="admin/catalog/products/new" element={<ProductEditorPage />} />
          <Route path="admin/catalog/products/:productId" element={<ProductEditorPage />} />
          <Route path="admin/staff" element={<StaffAdminPage />} />
          <Route path="admin/customers" element={<CustomersAdminPage />} />
          <Route path="admin/customers/:customerId" element={<CustomerDetailAdminPage />} />
          <Route path="admin/drivers" element={<DriversAdminPage />} />
          <Route path="admin/drivers/:driverId" element={<DriverDetailAdminPage />} />
          <Route path="admin/promotions" element={<PromotionsAdminPage />} />
          <Route path="admin/promotions/:promotionId" element={<PromotionDetailAdminPage />} />
          <Route path="admin/messages" element={<MessagesAdminPage />} />
          <Route path="admin/messages/:conversationId" element={<ConversationDetailAdminPage />} />
          <Route path="admin/settlements" element={<SettlementsAdminPage />} />
          <Route path="admin/settlements/merchant/:settlementId" element={<MerchantSettlementDetailPage />} />
          <Route path="admin/settlements/driver/:settlementId" element={<DriverSettlementDetailPage />} />
          <Route path="admin/system" element={<SystemAdminPage />} />
          <Route path="admin/orders" element={<OrdersAdminPage />} />
          <Route path="admin/orders/:orderId" element={<OrderDetailAdminPage />} />

          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="first-access" element={<FirstAccessPasswordPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="branch-status" element={<BranchStatusPage />} />
          <Route path="hours" element={<HoursPage />} />
          <Route path="staff" element={<StaffPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
