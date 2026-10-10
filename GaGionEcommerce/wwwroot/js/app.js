import { initTableOrdering, renderTableQrManager, generateTableQrs, printTableQrs } from './customer/tableOrdering.js';
import { initOrderTracking, openCurrentOrder, copyOrderCode, renderActiveOrders, startOrderCancellation, submitOrderCancellation, reorderOrder, prepareOrderLookup, clearDeviceOrderShortcuts } from './customer/orderTracking.js';
import { initHeroCarousel } from './components/heroCarousel.js';
import { initAssistant, stopAssistant, retryAssistant, refreshAssistantConnection, assistantChooseMeal, confirmAssistantMeal, toggleChat, askAssistant, clearAssistantChat, assistantChooseProduct, assistantAction, copyAssistantReply } from './components/assistant.js';
import { initPublicExperience, openSiteMenu, drawerNavigate, openInfoPage, openInfoTab, welcomeAction, copyWelcomeCode, scrollToSection } from './components/publicExperience.js';
import { initAuth, openAuth, switchAuthMode, submitAuth, logout } from './customer/auth.js';
import { initPartyBooking, openPartyBooking, submitPartyBooking, resetPartyBookingForm } from './customer/partyBooking.js';
import { renderRestaurants } from './pages-restaurants.js';
import { state, STORAGE_KEY, CART_KEY } from './state.js';
import { loadJSON } from './services/storage.js';
import { bindGlobalUiHandlers, closeModal, openModal, scrollToDeals, switchView, toast, renderVouchers, initBranchUi, updateBranchHeader, renderMemberCard } from './components/ui.js';
import { initCatalog, setDiscoveryFilter, setComboGroup, applyCatalogFilters, setCategory, toggleFavorite, showFavorites, clearCatalogFilters, renderFeaturedCombos, scrollCollection, scrollToCollection } from './customer/catalog.js';
import { chooseBranch, setDeliveryMode } from './customer/branch.js';
import { openCustomize, changeCustomQty, renderCustomTotal, confirmCustomization, openCart, renderCart, updateCartBadges, changeCartQty, removeCartItem, applyVoucher, takeVoucher, removeVoucher, initCart, editCartItem, refreshCartPricing } from './customer/cart.js';
import { openVoucherPicker, selectVoucherChoice, selectBestVouchers, confirmVoucherChoice, backToCart } from './customer/voucherPicker.js';
import { openUpsellProduct } from './components/checkoutAdvisor.js';
import { initMotion } from './components/motion.js';
import { captureCheckoutDraft, toggleSchedule, setCheckoutBranch, checkout, renderTracker, openOrderHistory, searchOrderHistory, renderHistory, renderOrderProgress, openMember, saveMember, renderMemberProfile, copyBankTransferMemo, confirmPaymentQr, reopenPaymentQr, deferOrderPayment } from './customer/checkout.js';
import { resolveOrderCancellation, confirmReceivedPayment, renderAdmin, setAdminFilter, setAdminSearch, setAdminTab, viewOrder, setOrderStatus, clearAllOrders, exportOrdersCSV, renderMenuManager, toggleProductAvailability, renderCategoryReport } from './admin/kds.js';
import { renderPartyReservations, updatePartyReservationStatus, exportPartyReservationsCSV } from './admin/partyReservations.js';

const publicApi={
  renderTableQrManager,generateTableQrs,printTableQrs,
  openVoucherPicker,selectVoucherChoice,selectBestVouchers,confirmVoucherChoice,backToCart,openUpsellProduct,editCartItem,refreshCartPricing,
  closeModal,openModal,scrollToDeals,switchView,openCurrentOrder,copyOrderCode,renderActiveOrders,startOrderCancellation,submitOrderCancellation,reorderOrder,prepareOrderLookup,clearDeviceOrderShortcuts,deferOrderPayment,
  setDiscoveryFilter,setComboGroup,applyCatalogFilters,setCategory,toggleFavorite,showFavorites,clearCatalogFilters,scrollCollection,scrollToCollection,
  openSiteMenu,drawerNavigate,openInfoPage,openInfoTab,welcomeAction,copyWelcomeCode,scrollToSection,clearAssistantChat,assistantChooseProduct,assistantAction,copyAssistantReply,
  chooseBranch,setDeliveryMode,
  openCustomize,changeCustomQty,renderCustomTotal,confirmCustomization,
  openCart,renderCart,updateCartBadges,changeCartQty,removeCartItem,applyVoucher,takeVoucher,removeVoucher,
  captureCheckoutDraft,toggleSchedule,setCheckoutBranch,checkout,renderTracker,openOrderHistory,searchOrderHistory,renderHistory,renderOrderProgress,openMember,saveMember,renderMemberProfile,copyBankTransferMemo,confirmPaymentQr,reopenPaymentQr,
  initAuth,openAuth,switchAuthMode,submitAuth,logout,initPartyBooking,openPartyBooking,submitPartyBooking,resetPartyBookingForm,renderRestaurants,renderFeaturedCombos,
  resolveOrderCancellation,confirmReceivedPayment,renderAdmin,setAdminFilter,setAdminSearch,setAdminTab,viewOrder,setOrderStatus,clearAllOrders,exportOrdersCSV,renderMenuManager,toggleProductAvailability,renderCategoryReport,renderPartyReservations,updatePartyReservationStatus,exportPartyReservationsCSV,
  assistantChooseMeal,confirmAssistantMeal,toggleChat,askAssistant,stopAssistant,retryAssistant,refreshAssistantConnection,toast
};
window.__ChickyJoy=publicApi;
window.__GaGion=publicApi;
Object.entries(publicApi).forEach(([name,fn])=>{window[name]=fn;});

function refreshVisibleOrder(){const order=state.orders.find(o=>o.id===state.currentOrderId);if(!order)return;if(document.getElementById('orderDetailModal')?.classList.contains('open'))renderOrderProgress(order.id);if(document.getElementById('successModal')?.classList.contains('open'))renderTracker(order);}
function initCrossTabSync(){
 window.addEventListener('storage',event=>{
   if(event.key===STORAGE_KEY){state.orders=loadJSON(STORAGE_KEY,[]);renderAdmin();refreshVisibleOrder();if(document.getElementById('historyModal')?.classList.contains('open'))renderHistory();toast('Danh sách đơn được cập nhật từ tab khác.','success');}
   if(event.key===CART_KEY){state.cart=loadJSON(CART_KEY,[]);updateCartBadges();if(document.getElementById('cartModal')?.classList.contains('open'))renderCart();}
   if(event.key==='gagion_soldout_v3'){state.soldOut=loadJSON('gagion_soldout_v3',[]);applyCatalogFilters();renderAdmin();}
  if(event.key==='gagion_session_v1'||event.key==='gagion_accounts_v1'){window.dispatchEvent(new Event('gagion-auth-account-updated'));}
  if(event.key==='gagion_party_reservations_v1'){renderPartyReservations();}
 });
 window.addEventListener('gagion-orders-changed',()=>{renderAdmin();refreshVisibleOrder();});
 window.addEventListener('gagion-admin-refresh',()=>renderAdmin());
 window.addEventListener('gagion-catalog-availability-changed',()=>{applyCatalogFilters();renderAdmin();});
 window.addEventListener('gagion-party-reservations-changed',()=>renderPartyReservations());
 window.addEventListener('gagion-party-admin-refresh',()=>renderPartyReservations());
}
function init(){
 bindGlobalUiHandlers();initCrossTabSync();initHeroCarousel();initMotion();
 initBranchUi(chooseBranch);initCatalog();renderFeaturedCombos();renderRestaurants();initPartyBooking();initAuth();initCart();renderVouchers(takeVoucher);renderAdmin();renderMemberCard();updateBranchHeader();
 window.addEventListener('gagion-branch-changed',renderRestaurants);
 const mobile=document.querySelector('.mobile-cart-bar');if(mobile)mobile.style.display=window.matchMedia('(max-width: 600px)').matches&&state.cart.length?'block':'none';
 initOrderTracking();initAssistant();initPublicExperience();
 switchView(location.pathname.replace(/\/$/,'')==='/staff'?'admin':'storefront');initTableOrdering();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
