import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Building2,
  CalendarClock,
  Check,
  DollarSign,
  Eye,
  Lock,
  MessageSquareText,
  Send,
  ShoppingCart,
  Star,
  Wallet,
  X,
} from 'lucide-react';
import { formatINR } from '../lib/api';
import { createInvestmentOrder } from '../lib/supabaseApi';
import type { BannerItem, MainTab, MeResponse, ProductItem, SiteSettings } from '../types';
import { HeroPromotionalBanner } from '../components/BrandVisuals';
import { PlanIcon } from '../components/PlanIcons';
import { TELEGRAM_SUPPORT_URL } from '../components/TelegramSupport';

interface HomePageProps {
  settings: SiteSettings;
  banners: BannerItem[];
  products: ProductItem[];
  me: MeResponse;
  onNavigate: (tab: MainTab) => void;
  onRefreshMe: () => Promise<void>;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `INV-${crypto.randomUUID()}`;
  }
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const HomePage: React.FC<HomePageProps> = ({
  settings,
  banners,
  products,
  me,
  onNavigate,
  onRefreshMe,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [detailProduct, setDetailProduct] = useState<ProductItem | null>(null);
  const [orderIdempotencyKey, setOrderIdempotencyKey] = useState<string>(generateIdempotencyKey);
  const [acceptedDisclosure, setAcceptedDisclosure] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [showChannelModal, setShowChannelModal] = useState(false);

  const primaryBanner = banners[0] ?? {
    id: 'default',
    title: 'Invest • Grow • Prosper',
    subtitle: 'Safe & Secure · Structured Portfolio Plans',
    badge_text: 'MAHENDRA Official Platform',
    image_key: 'studio_banner',
    target_action: 'home',
    sort_order: 1,
  };

  const openPurchaseModal = (product: ProductItem) => {
    setSelectedProduct(product);
    setOrderIdempotencyKey(generateIdempotencyKey());
    setPurchaseError(null);
    setAcceptedDisclosure(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const res = await createInvestmentOrder({
        planId: selectedProduct.id,
        idempotencyKey: orderIdempotencyKey,
        acceptedDisclosure,
      });
      await onRefreshMe();
      setPurchaseSuccess(
        `Plan ${selectedProduct.name} activated (Order ${res.orderNumber}). View progress in Orders.`
      );
      setSelectedProduct(null);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Unable to complete purchase.');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="pb-24 lg:pb-10">
      {/* Top Promotional Banner */}
      <div className="lg:max-w-6xl lg:mx-auto lg:px-6 lg:pt-5">
        <div className="lg:rounded-3xl overflow-hidden lg:border lg:border-[#D5EFE0] lg:shadow-sm">
          <HeroPromotionalBanner
            siteName={settings.siteName}
            headline={primaryBanner.title}
            subtitle={primaryBanner.subtitle}
            badgeText={primaryBanner.badge_text}
          />
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6">
        {/* Quick Action Buttons (4-column grid) */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4 mt-3.5 sm:mt-5">
          <button
            type="button"
            onClick={() => onNavigate('recharge')}
            className="bg-white rounded-2xl card-mint-border py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] transition cursor-pointer min-h-[76px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#17231C] whitespace-nowrap">
              Recharge
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('withdraw')}
            className="bg-white rounded-2xl card-mint-border py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] transition cursor-pointer min-h-[76px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#17231C] whitespace-nowrap">
              Withdraw
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowChannelModal(true)}
            className="bg-white rounded-2xl card-mint-border py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] transition cursor-pointer min-h-[76px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#17231C] whitespace-nowrap">
              Channel
            </span>
          </button>

          <a
            href={TELEGRAM_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white rounded-2xl card-mint-border py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.98] transition cursor-pointer min-h-[76px]"
          >
            <div className="w-9 h-9 rounded-xl bg-[#E7F7EE] text-[#008C45] flex items-center justify-center">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#17231C] whitespace-nowrap">
              Service
            </span>
          </a>
        </div>

        {/* Success banner after purchase */}
        {purchaseSuccess && (
          <div className="mt-4 p-3.5 rounded-2xl bg-[#E7F7EE] border border-[#9CD9B8] flex items-center justify-between gap-3 text-xs sm:text-sm text-[#005B32] font-semibold">
            <span>{purchaseSuccess}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="px-3 py-1.5 rounded-lg bg-[#008C45] text-white text-xs font-bold cursor-pointer"
              >
                View Orders
              </button>
              <button
                type="button"
                onClick={() => setPurchaseSuccess(null)}
                className="p-1 text-[#005B32] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Plans Section with Dark White Background */}
        <section className="mt-5 rounded-[26px] bg-[#E2E6E3] border border-[#D4AF37]/55 p-3.5 sm:p-5 shadow-xl">
          {/* Section Header + Wallet strip */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-extrabold text-base sm:text-lg text-[#03361C]">
                MAHENDRA Investment Plans
              </h2>
              <p className="text-xs font-medium text-[#3C5347]">
                10 Premium Portfolio Tiers · 90-Day &amp; 120-Day Cycles
              </p>
            </div>
            <div className="text-xs font-bold text-[#FFE89C] bg-[#043D21] px-3.5 py-1.5 rounded-xl border border-[#D4AF37]/70 tabular-nums shadow-sm">
              Wallet: {formatINR(me.profile.availableBalance)}
            </div>
          </div>

          {/* Luxury Dark Green + Metallic Gold Investment Cards */}
          <div className="mt-3.5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {products.map((product) => {
            const purchasedCount = me.productPurchaseCounts[product.id] ?? 0;
            const isPresale = product.status !== 'active';
            const limitReached = purchasedCount >= product.purchase_limit;

            return (
              <div
                key={product.id}
                className="relative luxury-plan-card rounded-[22px] p-4 sm:p-5 overflow-hidden flex flex-col justify-between gap-3.5"
              >
                {/* Top metallic gold highlight strip */}
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FFE27A] to-transparent opacity-80"
                  aria-hidden="true"
                />
                {/* Soft emerald glow accent */}
                <div
                  className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#10B981]/15 blur-2xl"
                  aria-hidden="true"
                />

                {/* Popular Corner Ribbon */}
                {Boolean(product.is_popular) && (
                  <div className="absolute top-3.5 -right-8 w-28 rotate-45 luxury-gold-btn text-[10px] font-extrabold py-0.5 text-center shadow-md flex items-center justify-center gap-0.5 z-10 pointer-events-none">
                    <Star className="w-2.5 h-2.5 fill-[#03311A]" />
                    <span>POPULAR</span>
                  </div>
                )}

                {/* 1. Small Plan Logo + Plan Name */}
                <div className="relative flex items-center gap-3 pr-10">
                  <div className="w-11 h-11 rounded-xl bg-[#054A27] border border-[#D4AF37]/60 flex items-center justify-center shrink-0 shadow-inner">
                    <PlanIcon iconKey={product.image_key} className="w-8 h-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-base sm:text-lg tracking-wide uppercase luxury-gold-text truncate">
                      {product.name}
                    </h3>
                    <p className="text-[11px] font-medium text-[#A7E6C4] truncate">
                      {product.subtitle}
                    </p>
                  </div>
                </div>

                {/* 2. Investment Limit */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#06522C] border border-[#D4AF37]/50 text-[#FFE89C] text-xs font-bold tabular-nums">
                    Limit {purchasedCount}/{product.purchase_limit}
                  </span>
                  <span className="text-[11px] font-semibold text-[#8FD4B0] uppercase tracking-wider">
                    {product.code}
                  </span>
                </div>

                {/* 3. Investment Amount / Duration */}
                <div className="rounded-2xl bg-[#022413]/90 border border-[#0E6A3B] px-3.5 py-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-[#BCEBD1]">Investment</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display font-extrabold text-xl sm:text-2xl text-[#FFD970] tabular-nums">
                      {formatINR(product.price)}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-white/90">
                      / {product.duration_days} Days
                    </span>
                  </div>
                </div>

                {/* 4 & 5. Estimated Daily & Projected Total */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#04371D]/85 border border-[#0D5F35]">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#D1F7E2]">
                      <span className="w-5 h-5 rounded-full bg-[#0A6B38] text-[#FFE27A] flex items-center justify-center shrink-0">
                        <CalendarClock className="w-3 h-3" />
                      </span>
                      <span>Estimated Daily</span>
                    </div>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {formatINR(product.daily_return)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#04371D]/85 border border-[#D4AF37]/45">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#D1F7E2]">
                      <span className="w-5 h-5 rounded-full bg-[#0A6B38] text-[#FFE27A] flex items-center justify-center shrink-0">
                        <DollarSign className="w-3 h-3" />
                      </span>
                      <span>Projected Total</span>
                    </div>
                    <span className="text-sm sm:text-base font-extrabold text-[#FFD970] tabular-nums">
                      {formatINR(product.total_return)}
                    </span>
                  </div>
                </div>

                {/* 6. View Details + BUY NOW Button */}
                <div className="pt-0.5 grid grid-cols-5 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="col-span-2 h-10 rounded-full border border-[#D4AF37]/65 bg-[#054424] hover:bg-[#07582F] text-[#FFE89C] font-display font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>

                  {isPresale ? (
                    <button
                      type="button"
                      disabled
                      className="col-span-3 h-10 rounded-full bg-[#1C3B2B] border border-white/15 text-white/60 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>PRESALE</span>
                    </button>
                  ) : limitReached ? (
                    <button
                      type="button"
                      disabled
                      className="col-span-3 h-10 rounded-full bg-[#1C3B2B] border border-[#D4AF37]/30 text-[#D4AF37]/70 font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                    >
                      <span>LIMIT REACHED</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPurchaseModal(product)}
                      className="col-span-3 h-10 rounded-full luxury-gold-btn font-display font-extrabold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 active:scale-[0.98] transition cursor-pointer"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>BUY NOW</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </section>
      </div>

      {/* View Details Modal */}
      {detailProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="luxury-plan-card w-full sm:max-w-md rounded-t-[28px] sm:rounded-[26px] p-5 sm:p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#054A27] border border-[#D4AF37]/65 flex items-center justify-center shrink-0">
                  <PlanIcon iconKey={detailProduct.image_key} className="w-8 h-8" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-extrabold text-lg uppercase luxury-gold-text truncate">
                    {detailProduct.name}
                  </h3>
                  <p className="text-xs text-[#A7E6C4] truncate">{detailProduct.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#D6F5E4] leading-relaxed mb-3.5">
              {detailProduct.description}
            </p>

            <div className="rounded-2xl bg-[#022413] border border-[#0E6A3B] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CD9B8]">Plan Limit</span>
                <span className="font-bold text-[#FFE89C] tabular-nums">
                  {me.productPurchaseCounts[detailProduct.id] ?? 0}/{detailProduct.purchase_limit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CD9B8]">Investment Amount</span>
                <span className="font-display font-extrabold text-base text-[#FFD970] tabular-nums">
                  {formatINR(detailProduct.price)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CD9B8]">Duration</span>
                <span className="font-bold text-white tabular-nums">
                  {detailProduct.duration_days} Days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CD9B8]">Estimated Daily</span>
                <span className="font-bold text-white tabular-nums">
                  {formatINR(detailProduct.daily_return)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#0E6A3B] flex items-center justify-between">
                <span className="text-[#9CD9B8]">Projected Total</span>
                <span className="font-display font-extrabold text-base text-[#FFD970] tabular-nums">
                  {formatINR(detailProduct.total_return)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="flex-1 h-11 rounded-full border border-[#D4AF37]/60 text-[#FFE89C] font-display font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={
                  detailProduct.status !== 'active' ||
                  (me.productPurchaseCounts[detailProduct.id] ?? 0) >= detailProduct.purchase_limit
                }
                onClick={() => {
                  const p = detailProduct;
                  setDetailProduct(null);
                  openPurchaseModal(p);
                }}
                className="flex-[2] h-11 rounded-full luxury-gold-btn font-display font-extrabold text-sm disabled:opacity-50 cursor-pointer"
              >
                {(me.productPurchaseCounts[detailProduct.id] ?? 0) >= detailProduct.purchase_limit
                  ? 'LIMIT REACHED'
                  : 'BUY NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-[28px] sm:rounded-[26px] p-5 sm:p-6 shadow-2xl border border-[#D5EFE0]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#043D20] border border-[#D4AF37]/70 flex items-center justify-center shrink-0">
                  <PlanIcon iconKey={selectedProduct.image_key} className="w-7 h-7" />
                </div>
                <h3 className="font-display font-extrabold text-lg text-[#17231C]">
                  Confirm Plan Activation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-full hover:bg-[#F4FAF7] text-[#5B7265] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl bg-[#F4FAF7] border border-[#D5EFE0] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#546B5E] font-medium">Selected Plan</span>
                <span className="font-display font-bold text-sm text-[#17231C] text-right">
                  {selectedProduct.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#546B5E] font-medium">Investment Amount</span>
                <span className="font-display font-extrabold text-base text-[#008C45] tabular-nums">
                  {formatINR(selectedProduct.price)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#546B5E] font-medium">Duration</span>
                <span className="text-xs font-bold text-[#17231C] tabular-nums">
                  {selectedProduct.duration_days} Days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#546B5E] font-medium">
                  Estimated Daily / Projected Total
                </span>
                <span className="text-xs font-bold text-[#005B32] tabular-nums">
                  {formatINR(selectedProduct.daily_return)} / {formatINR(selectedProduct.total_return)}
                </span>
              </div>
              <div className="pt-2 border-t border-[#D8EEE1] flex items-center justify-between">
                <span className="text-xs text-[#546B5E] font-medium">Available Balance</span>
                <span
                  className={`text-sm font-extrabold tabular-nums ${
                    me.profile.availableBalance >= selectedProduct.price
                      ? 'text-[#008C45]'
                      : 'text-red-600'
                  }`}
                >
                  {formatINR(me.profile.availableBalance)}
                </span>
              </div>
            </div>

            <label className="mt-3.5 flex items-start gap-2.5 text-xs text-[#344A3E] cursor-pointer select-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={acceptedDisclosure}
                onClick={() => setAcceptedDisclosure((v) => !v)}
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 cursor-pointer ${
                  acceptedDisclosure
                    ? 'bg-[#008C45] border-[#008C45] text-white'
                    : 'bg-white border-[#B9D9C6] text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
              <span>I confirm my plan selection and agree to the platform terms.</span>
            </label>

            {purchaseError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                {purchaseError}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2.5">
              {me.profile.availableBalance < selectedProduct.price ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    onNavigate('recharge');
                  }}
                  className="w-full h-12 rounded-full brand-gradient text-white font-display font-bold text-sm cursor-pointer shadow-md"
                >
                  Insufficient Balance — Go to Recharge
                </button>
              ) : (
                <button
                  type="button"
                  disabled={purchasing || !acceptedDisclosure}
                  onClick={handleConfirmPurchase}
                  className="w-full h-12 rounded-full luxury-gold-btn font-display font-extrabold text-sm disabled:opacity-60 cursor-pointer"
                >
                  {purchasing ? 'Processing...' : `Confirm & Pay ${formatINR(selectedProduct.price)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#D5EFE0]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-base text-[#17231C]">Official Channel</h3>
              <button
                type="button"
                onClick={() => setShowChannelModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F4FAF7] text-[#5B7265] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#4C6356] leading-relaxed">
              Join the official {settings.siteName} community channel for product release updates,
              verified payout schedules, and gift code drops.
            </p>
            <a
              href={
                settings.telegramLink && /^https?:\/\//i.test(settings.telegramLink)
                  ? settings.telegramLink
                  : 'https://t.me/'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full h-11 rounded-full brand-gradient text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md"
            >
              <Send className="w-4 h-4" />
              Open Telegram Channel
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
