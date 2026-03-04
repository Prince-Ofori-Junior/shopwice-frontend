/*eslint complexity: ["error", 20]*/
// Imports
import { useState, useEffect, useMemo, useCallback } from 'react';

// Components
import Billing from './Billing.component';
import CheckoutOrderReview from './CheckoutOrderReview.component';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner.component';
import Button from '../UI/Button.component';

import { useCartStore } from '@/stores/cartStore';
import { useLocationStore } from '@/stores/locationStore';

// Utils
import {
  createCheckoutData,
  formatPriceWithDecimals,
  ICheckoutDataProps,
} from '@/utils/functions/functions';
import { api } from '@/utils/api';
import { ENDPOINTS } from '@/utils/endpoints';
import { transformCartResponse } from '@/utils/cartTransformers';
import {
  clearCartResponseCache,
  getCachedCartResponse,
  getCartFast,
  setCartResponseCache,
} from '@/utils/cartClient';

const StepIndicator = ({ step }: { step: number }) => (
  <div className="flex items-center justify-between mb-4 bg-white p-2 rounded border border-gray-100 shadow-sm">
    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>1</span>
      <span className="text-xs font-bold uppercase tracking-wider">Address</span>
    </div>
    <div className="h-px bg-gray-200 flex-grow mx-4"></div>
    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>2</span>
      <span className="text-xs font-bold uppercase tracking-wider">Shipping</span>
    </div>
    <div className="h-px bg-gray-200 flex-grow mx-4"></div>
    <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>3</span>
      <span className="text-xs font-bold uppercase tracking-wider">Payment</span>
    </div>
  </div>
);

const ShippingMethodStep = ({
  availableShippingMethods,
  selectedShippingRate,
  onSelectShippingRate,
  onBack,
  onNext,
  isUpdating,
}: {
  availableShippingMethods: Array<{ id: string; rateId: string; label: string; cost?: string; company?: string; packageId?: number }>;
  selectedShippingRate: string;
  onSelectShippingRate: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  isUpdating: boolean;
}) => (
  <div className="bg-white rounded border border-gray-200 p-2 animate-fade-in">
    <h3 className="text-sm font-bold text-[#2c3338] mb-2 uppercase tracking-wide">Shipping Method</h3>
    {availableShippingMethods.length === 0 ? (
      <div className="p-2 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 mb-2 text-xs">
        No shipping methods available. Check address.
      </div>
    ) : (
      <div className="grid gap-1 mb-3">
        {availableShippingMethods.map((rate) => (
          <label
            key={rate.id}
            className={`
                                                relative flex items-center p-2 border rounded cursor-pointer transition-all duration-200
                                                ${selectedShippingRate === rate.id
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
                                            `}
          >
            <input
              type="radio"
              name="shipping_method"
              value={rate.id}
              onChange={(e) => onSelectShippingRate(e.target.value)}
              className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="ml-2 flex-grow">
              <span className="block font-medium text-gray-900 text-xs">{rate.label}</span>
              {rate.company && <span className="block text-[10px] text-gray-500">{rate.company}</span>}
            </div>
            <div className="font-bold text-gray-900 text-xs">
              {rate.cost && rate.cost !== '0' ? formatPriceWithDecimals(rate.cost, 'GH₵') : 'Free'}
            </div>
          </label>
        ))}
      </div>
    )}
    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-gray-900 text-xs font-medium flex items-center gap-1 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <Button
        className="px-4 py-1 text-xs"
        handleButtonClick={onNext}
        buttonDisabled={!selectedShippingRate || isUpdating}
      >
        {isUpdating ? <LoadingSpinner color="white" size="sm" /> : 'Next'}
      </Button>
    </div>
  </div>
);

const PaymentStep = ({
  availableGateways,
  selectedPaymentMethod,
  onSelectPaymentMethod,
  onBack,
  onSubmit,
  isLoading,
  canSubmit,
}: {
  availableGateways: any[];
  selectedPaymentMethod: string;
  onSelectPaymentMethod: (id: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
  canSubmit: boolean;
}) => (
  <div className="bg-white rounded border border-gray-200 p-2 animate-fade-in">
    <h3 className="text-sm font-bold text-[#2c3338] mb-2 uppercase tracking-wide">Payment</h3>
    <div className="space-y-2 mb-3">
      {availableGateways.length === 0 ? (
        <div className="p-2 border border-yellow-300 bg-yellow-50 rounded text-xs text-yellow-800">
          No payment methods returned by middleware for this order.
        </div>
      ) : (
        availableGateways.map((gateway: any) => (
          <label
            key={gateway.id}
            className={`
                                    relative flex items-start p-2 border rounded cursor-pointer transition-all duration-200 gap-2
                                    ${selectedPaymentMethod === gateway.id
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}
                                `}
          >
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="radio"
                name="payment_method"
                value={gateway.id}
                checked={selectedPaymentMethod === gateway.id}
                onChange={() => onSelectPaymentMethod(gateway.id)}
                className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </div>
            <div className="flex-grow">
              <span className="block font-bold text-gray-900 text-xs">{gateway.title}</span>
              <p className="mt-0.5 text-[10px] text-gray-600">{gateway.description}</p>
            </div>
            {gateway.icon && (
              <img src={gateway.icon} alt={gateway.title} className="h-4 object-contain" />
            )}
          </label>
        ))
      )}
    </div>
    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-gray-900 text-xs font-medium flex items-center gap-1 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back
      </button>
      <Button
        className="bg-[#fa710f] hover:bg-[#fa710f] border-[#fa710f] w-full sm:w-auto px-6 py-2 text-sm font-bold"
        handleButtonClick={onSubmit}
        buttonDisabled={isLoading || !canSubmit}
      >
        {isLoading ? <LoadingSpinner color="white" size="sm" /> : 'Place Order'}
      </Button>
    </div>
  </div>
);

const getPackageId = (pkg: any, pkgIndex: number) => {
  if (Number.isFinite(Number(pkg?.package_id))) return Number(pkg.package_id);
  if (Number.isFinite(Number(pkg?.packageId))) return Number(pkg.packageId);
  return pkgIndex;
};

// eslint-disable-next-line complexity
const mapRateToMethod = (rate: any, packageId: number) => {
  const rateId = String(rate?.rate_id ?? rate?.id ?? '').trim();
  if (!rateId) return null;

  const selectionId = `${packageId}::${rateId}`;

  return {
    id: selectionId,
    rateId,
    label: String(rate?.name ?? rate?.label ?? rate?.method_title ?? 'Shipping'),
    cost: String(rate?.price ?? rate?.cost ?? rate?.price_amount ?? ''),
    company: String(rate?.method_id ?? rate?.method_title ?? ''),
    packageId,
  };
};

const extractShippingMethods = (rawShipping: any) => {
  if (!rawShipping) return [];

  const shippingPackages = Array.isArray(rawShipping)
    ? rawShipping
    : (typeof rawShipping === 'object' ? Object.values(rawShipping) : []);

  return shippingPackages.flatMap((pkg: any, pkgIndex: number) => {
    const rates = Array.isArray(pkg?.shipping_rates)
      ? pkg.shipping_rates
      : (Array.isArray(pkg?.rates) ? pkg.rates : []);

    const packageId = getPackageId(pkg, pkgIndex);

    return rates
      .map((rate: any) => mapRateToMethod(rate, packageId))
      .filter(Boolean);
  }) as Array<{ id: string; rateId: string; label: string; cost?: string; company?: string; packageId?: number }>;
};

const normalizeGateway = (gateway: any) => {
  if (typeof gateway === 'string') {
    const id = gateway.trim();
    if (!id) return null;

    const customMap: Record<string, any> = {
      cod: {
        title: "Cash on Delivery",
        description: "Pay when your item is delivered.",
        icon: "/icons/cod.png",
      },
      bacs: {
        title: "Pay Using Bank Account",
        description: "Make direct transfer to our bank account.",
        icon: "/icons/bank.png",
      },
      cheque: {
        title: "Pay With Clear Cheque",
        description: "Order is processed after cheque clearance.",
        icon: "/icons/cheque.png",
      },
      paystack: {
        title: "Pay With Paystack",
        description: "Pay with MoMo or Payment Card.",
        icon: "/icons/paystack.png",
      },
    };

    return {
      id,
      title: customMap[id]?.title || id,
      description: customMap[id]?.description || '',
      icon: customMap[id]?.icon || '',
    };
  }

  if (!gateway || typeof gateway !== 'object') return null;

  const id = String(gateway.id ?? gateway.method_id ?? '').trim();
  if (!id) return null;

  const customMap: Record<string, any> = {
    cod: {
      title: "Cash on Delivery",
      description: "Pay when your item is delivered.",
      icon: "/icons/cod.png",
    },
    bacs: {
      title: "Pay Using Bank Account",
      description: "Make direct transfer to our bank account.",
      icon: "/icons/bank.png",
    },
    cheque: {
      title: "Pay With Clear Cheque",
      description: "Order is processed after cheque clearance.",
      icon: "/icons/cheque.png",
    },
    paystack: {
      title: "Pay With Paystack",
      description: "Pay with MoMo or Payment Card.",
      icon: "/icons/paystack.png",
    },
  };

  return {
    ...gateway,
    id,
    title: customMap[id]?.title || String(gateway.title ?? gateway.method_title ?? gateway.name ?? id),
    description: customMap[id]?.description || String(gateway.description ?? ''),
    icon: customMap[id]?.icon || gateway.icon || gateway.image || '',
  };
};
const normalizeGateways = (payload: any) => {
  const list = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.payment_methods)
      ? payload.payment_methods
      : (Array.isArray(payload?.gateways) ? payload.gateways : []));

  return list
    .map(normalizeGateway)
    .filter(Boolean) as Array<{ id: string; title: string; description: string; icon?: string }>;
};

const getDefaultPaymentMethodId = (gateways: Array<{ id: string }>) => {
  const ids = gateways.map((gateway) => String(gateway.id));
  return ids[0] || '';
};

const EmptyCartState = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
      <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    </div>
    <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
    <p className="text-gray-500 mb-8">Looks like you haven&apos;t added any products to your cart yet.</p>
    <Button href="/" className="bg-blue-600">Start Shopping</Button>
  </div>
);

const OrderCompleteState = ({ orderNumber }: { orderNumber?: string | number }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Received!</h1>
    {orderNumber && (
      <p className="text-sm font-medium text-blue-600 mb-1">Order #{orderNumber}</p>
    )}
    <p className="text-lg text-gray-600 mb-8">Thank you for your purchase. We&apos;ve emailed you the receipt.</p>
    <div className="flex gap-4">
      <Button href="/my-account" variant="secondary">View Orders</Button>
      <Button href="/" variant="primary">Continue Shopping</Button>
    </div>
  </div>
);

const CheckoutForm = () => {
  const { cart: storeCart, clearWooCommerceSession, syncWithWooCommerce } = useCartStore();
  const debugCheckout = process.env.NEXT_PUBLIC_DEBUG_CHECKOUT === 'true';
  const initialCachedCart = useMemo(
    () => getCachedCartResponse(5 * 60 * 1000, { view: 'full', includeShippingRates: true }),
    [],
  );
  const [orderData, setOrderData] = useState<ICheckoutDataProps | null>(null);
  const [requestError, setRequestError] = useState<any>(null);
  const [orderCompleted, setOrderCompleted] = useState<boolean>(false);
  const [orderNumber, setOrderNumber] = useState<string | number | undefined>(undefined);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isUpdatingCustomer, setIsUpdatingCustomer] = useState<boolean>(false);
  const [isUpdatingShipping, setIsUpdatingShipping] = useState<boolean>(false);
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);

  const [availableGateways, setAvailableGateways] = useState<any[]>([]);
  const [cartData, setCartData] = useState<any>(initialCachedCart);
  const [loading, setLoading] = useState<boolean>(!initialCachedCart);

  // Checkout Steps: 1: Address, 2: Shipping, 3: Payment
  const [step, setStep] = useState<number>(1);
  const [selectedShippingRate, setSelectedShippingRate] = useState<string>('');
  const hasCartItems = useMemo(() => {
    if (Array.isArray(cartData?.items) && cartData.items.length > 0) return true;
    return Number(storeCart?.totalProductsCount || 0) > 0;
  }, [cartData?.items, storeCart?.totalProductsCount]);

  const applyCartState = useCallback((payload: any) => {
    setCartResponseCache(payload);
    const nextCart = payload && typeof payload === 'object' && payload.cart ? payload.cart : payload;
    if (!nextCart || typeof nextCart !== 'object') return null;
    setCartData(nextCart);
    syncWithWooCommerce(transformCartResponse(nextCart));
    return nextCart;
  }, [syncWithWooCommerce]);

  // Pulls payment_methods out of a cart payload we already have — avoids the
  // separate /api/payment-methods fetch (which itself falls back to /cart on 404).
  const applyGatewaysFromCart = useCallback((payload: any) => {
    const cartObj = payload?.cart ?? payload;
    const gateways = normalizeGateways(cartObj);
    if (gateways.length === 0) return false;
    setAvailableGateways(gateways);
    setSelectedPaymentMethod((prev) => {
      const ids = gateways.map((g: any) => g.id);
      return prev && ids.includes(prev) ? prev : getDefaultPaymentMethodId(gateways);
    });
    return true;
  }, []);

  useEffect(() => {
    if (!initialCachedCart) return;
    syncWithWooCommerce(transformCartResponse(initialCachedCart));
  }, [initialCachedCart, syncWithWooCommerce]);

  const loadPaymentMethods = useCallback(
    async ({ preserveSelection = true }: { preserveSelection?: boolean } = {}) => {
      const payload: any = await api.get(ENDPOINTS.PAYMENT_METHODS);
      const gateways = normalizeGateways(payload);
      setAvailableGateways(gateways);
      setSelectedPaymentMethod((prev) => {
        const availableIds = gateways.map((gateway) => gateway.id);
        if (preserveSelection && prev && availableIds.includes(prev)) {
          return prev;
        }
        return getDefaultPaymentMethodId(gateways);
      });
      if (debugCheckout) {
        console.info('[Checkout] Gateways loaded:', gateways.length);
      }
      return gateways;
    },
    [debugCheckout],
  );

  // Load cart and payment gateways
  useEffect(() => {
    const loadCartAndGateways = async () => {
      if (!initialCachedCart) {
        setLoading(true);
      }
      try {
        const cartPromise = getCartFast({
          maxAgeMs: 15000,
          view: 'full',
          includeShippingRates: true,
        });

        const cart: any = await cartPromise;
        const normalizedCart = applyCartState(cart);

        if (debugCheckout) {
          console.info('[Checkout] Cart loaded:', normalizedCart?.items_count ?? 0, 'items');
        }

        setLoading(false);
        // Prefer payment methods already in the cart (saves a round-trip).
        // Fall back to dedicated fetch if cart didn't include them.
        const hadGateways = applyGatewaysFromCart(cart);
        if (!hadGateways) {
          await loadPaymentMethods({ preserveSelection: true });
        }
      } catch (error: any) {
        console.error('[Checkout] Error loading data:', error);
        setRequestError(error);
        setLoading(false);
      }
    };

    loadCartAndGateways();
  }, [applyCartState, applyGatewaysFromCart, debugCheckout, initialCachedCart, loadPaymentMethods]);

  const refetchCart = async () => {
    try {
      const cart: any = await getCartFast({
        force: true,
        maxAgeMs: 0,
        view: 'full',
        includeShippingRates: true,
      });
      applyCartState(cart);
    } catch (error: any) {
      console.error('[Checkout] Error refetching cart:', error);
    }
  };

  // Step 1 Handler: Address Submission
  const handleAddressSubmit = async (submitData: ICheckoutDataProps) => {
    setIsUpdatingCustomer(true);
    setRequestError(null);

    try {
      const { normalizeGhanaRegion } = await import('@/utils/constants/REGIONS');
      const normalizedState = normalizeGhanaRegion(submitData.state);

      const response: any = await api.post(ENDPOINTS.CART_CUSTOMER, {
        billing_address: {
          first_name: submitData.firstName,
          last_name: submitData.lastName,
          address_1: submitData.address1,
          address_2: submitData.address2,
          city: submitData.city,
          country: submitData.country || 'GH',
          state: normalizedState,
          postcode: submitData.postcode || '00000',
          email: submitData.email,
          phone: submitData.phone,
          company: submitData.company
        },
        shipping_address: {
          first_name: submitData.firstName,
          last_name: submitData.lastName,
          address_1: submitData.address1,
          address_2: submitData.address2,
          city: submitData.city,
          country: submitData.country || 'GH',
          state: normalizedState,
          postcode: submitData.postcode || '00000',
          phone: submitData.phone,
          company: submitData.company
        }
      });

      const nextCart = applyCartState(response);

      // Apply gateways from the cart response already in hand — no extra fetch.
      const hadGateways = applyGatewaysFromCart(response);

      // Fire background refreshes in parallel — don't block the step change.
      if (!nextCart) {
        refetchCart().catch(console.error);
      }
      if (!hadGateways) {
        loadPaymentMethods({ preserveSelection: false }).catch(console.error);
      }

      setOrderData({ ...submitData, state: normalizedState });
      setStep(2);
    } catch (error: any) {
      console.error('[Checkout] Address update failed:', error);
      // api.ts throws ApiError where error.message is the formatted message from our proxy
      setRequestError(error.message || 'Failed to update address. Please check your details.');
    } finally {
      setIsUpdatingCustomer(false);
    }
  };

  // Step 2 Handler: Shipping Selection
  const handleShippingSubmit = async () => {
    if (!selectedShippingRate) return;

    setIsUpdatingShipping(true);
    try {
      const selectedMethod = availableShippingMethods.find((m) => m.id === selectedShippingRate);
      const packageId = Number.isFinite(Number(selectedMethod?.packageId)) ? Number(selectedMethod?.packageId) : 0;
      const rateIdToUse = String(selectedMethod?.rateId || '').trim() || String(selectedShippingRate || '').trim();

      const response: any = await api.post(ENDPOINTS.CART_SHIPPING, {
        package_id: packageId,
        rate_id: rateIdToUse,
      });

      const nextCart = applyCartState(response);

      // Apply gateways from the cart response already in hand — no extra fetch.
      const hadGateways = applyGatewaysFromCart(response);

      // Fire background refreshes in parallel — don't block the step change.
      if (!nextCart) {
        refetchCart().catch(console.error);
      }
      if (!hadGateways) {
        loadPaymentMethods({ preserveSelection: false }).catch(console.error);
      }

      setStep(3);
    } catch (error: any) {
      console.error('[Checkout] Shipping update failed:', error);
      setRequestError(error.message || 'Failed to update shipping method.');
    } finally {
      setIsUpdatingShipping(false);
    }
  };

  // Step 3 Handler: Final Order Placement
  const handlePaymentSubmit = async () => {
    if (!orderData) return;

    const paymentMethodToUse = selectedPaymentMethod;
    if (!paymentMethodToUse) {
      setRequestError({ message: 'No payment method available for this order.' });
      return;
    }

    setCheckoutLoading(true);
    try {
      const checkoutInput = createCheckoutData({
        ...orderData,
        paymentMethod: paymentMethodToUse
      });

      if (debugCheckout) {
        console.info('[Checkout] Submitting order', {
          paymentMethod: paymentMethodToUse,
          cartItems: cartData?.items_count,
        });
      }

      const response: any = await api.post(ENDPOINTS.CHECKOUT, checkoutInput);

      if (debugCheckout) {
        console.info('[Checkout] Response', response);
      }

      // Extract order ID from the response (WooCommerce Store API field)
      const orderId = response?.order_id ?? response?.id;

      if (response?.payment_result?.redirect_url) {
        const redirectUrl: string = response.payment_result.redirect_url;

        // If the redirect points to our own WooCommerce backend (the /order-received/ page),
        // intercept it and show a frontend confirmation instead of sending the user to
        // the raw WooCommerce site.
        const wooSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
        const isWooBackendRedirect = wooSiteUrl && redirectUrl.startsWith(wooSiteUrl);

        if (isWooBackendRedirect) {
          // Parse order number from URL in case order_id was not in the response body
          const urlOrderMatch = redirectUrl.match(/order-received\/(\d+)/);
          const resolvedOrderId = orderId ?? (urlOrderMatch ? urlOrderMatch[1] : undefined);
          clearWooCommerceSession();
          clearCartResponseCache();
          if (resolvedOrderId) setOrderNumber(resolvedOrderId);
          setOrderCompleted(true);
          return;
        }

        // External payment gateway (e.g. mobile money) — follow the redirect so the
        // customer can complete payment on the provider's site.
        window.location.href = redirectUrl;
        return;
      }

      // No redirect — order is complete (typical for COD / direct bank transfer)
      clearWooCommerceSession();
      clearCartResponseCache();
      if (orderId) setOrderNumber(orderId);
      setOrderCompleted(true);
    } catch (error: any) {
      setRequestError(error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const availableShippingMethods = useMemo(
    () => extractShippingMethods(cartData?.shipping_rates),
    [cartData?.shipping_rates],
  );

  useEffect(() => {
    if (availableShippingMethods.length === 0) {
      if (selectedShippingRate) setSelectedShippingRate('');
      return;
    }

    const hasCurrentSelection = availableShippingMethods.some((method) => method.id === selectedShippingRate);
    if (!hasCurrentSelection) {
      setSelectedShippingRate(availableShippingMethods[0].id);
    }
  }, [availableShippingMethods, selectedShippingRate]);

  // Get Location from Store
  const { selectedLocation } = useLocationStore();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
        <p className="text-gray-500 mt-4">Loading checkout...</p>
      </div>
    );
  }

  return (
    <>
      {hasCartItems && !orderCompleted ? (
        <div className="w-full px-0 lg:px-2 py-1">
          {requestError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 text-xs animate-shake">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{requestError.message || "An unexpected error occurred. Please try again."}</span>
            </div>
          )}

          <div className="flex flex-col-reverse lg:flex-row gap-2">
            <div className="flex-grow lg:w-2/3">
              <StepIndicator step={step} />
              {step === 1 && (
                <div className="bg-white rounded border border-gray-200 p-2 animate-fade-in text-[#2c3338]">
                  <h3 className="text-sm font-bold text-[#2c3338] mb-2 uppercase tracking-wide">Billing & Shipping</h3>
                  <Billing
                    handleFormSubmit={handleAddressSubmit}
                    isLoading={isUpdatingCustomer}
                    buttonLabel="Next: Shipping"
                    initialCity={selectedLocation?.name}
                  />
                </div>
              )}
              {step === 2 && (
                <ShippingMethodStep
                  availableShippingMethods={availableShippingMethods}
                  selectedShippingRate={selectedShippingRate}
                  onSelectShippingRate={setSelectedShippingRate}
                  onBack={() => setStep(1)}
                  onNext={handleShippingSubmit}
                  isUpdating={isUpdatingShipping}
                />
              )}
              {step === 3 && (
                <PaymentStep
                  availableGateways={availableGateways}
                  selectedPaymentMethod={selectedPaymentMethod}
                  onSelectPaymentMethod={setSelectedPaymentMethod}
                  onBack={() => setStep(2)}
                  onSubmit={handlePaymentSubmit}
                  isLoading={checkoutLoading}
                  canSubmit={availableGateways.length > 0 && !!selectedPaymentMethod}
                />
              )}
            </div>
            <div className="lg:w-1/3">
              <div className="sticky top-16">
                <CheckoutOrderReview cart={cartData} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 p-1.5 rounded text-center border border-gray-100">
                    <div className="text-sm mb-0">🛡️</div>
                    <div className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">Secure</div>
                  </div>
                  <div className="bg-gray-50 p-1.5 rounded text-center border border-gray-100">
                    <div className="text-sm mb-0">🚚</div>
                    <div className="text-[9px] font-bold text-gray-700 uppercase tracking-wide">Fast</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!hasCartItems && !orderCompleted && <EmptyCartState />}
          {orderCompleted && <OrderCompleteState orderNumber={orderNumber} />}
        </>
      )}
    </>
  );
};

export default CheckoutForm;
