import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Truck,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatters';

export function CartPage() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  const isCartEmpty = !cart.items || cart.items.length === 0;

  // Free shipping calculation
  const freeShippingThresholdPaise = cart.freeShippingThresholdPaise || 50000;
  const remainingForFreeShipping = Math.max(0, freeShippingThresholdPaise - cart.subtotalPaise);
  const freeShippingProgress = Math.min(100, (cart.subtotalPaise / freeShippingThresholdPaise) * 100);

  if (isCartEmpty) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Your Shopping Cart is Empty</h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Looks like you haven't added anything to your cart yet. Explore our premier catalog and grab your favorites!
          </p>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-105"
        >
          <span>Start Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4 pb-16">
      
      {/* Title & Clear Cart Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shopping Cart</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {cart.itemsCount} {cart.itemsCount === 1 ? 'item' : 'items'} in your bag
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Cart</span>
        </button>
      </div>

      {/* Free Shipping Progress Indicator */}
      <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-600" />
            {remainingForFreeShipping === 0 ? (
              <span>🎉 Congratulations! You qualify for <strong>FREE Delivery</strong>!</span>
            ) : (
              <span>
                Add <strong className="text-blue-700">{formatPrice(remainingForFreeShipping)}</strong> more to get <strong>FREE Delivery</strong>!
              </span>
            )}
          </div>
          <span>{Math.round(freeShippingProgress)}%</span>
        </div>
        <div className="w-full bg-blue-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${freeShippingProgress}%` }}
          />
        </div>
      </div>

      {/* Main Cart Items & Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 space-y-4">
          {cart.items.map((item) => (
            <div
              key={item.cartItemId}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition"
            >
              {/* Product Info */}
              <div className="flex items-center gap-4 flex-1">
                <Link
                  to={`/products/${item.productId}`}
                  className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover object-center"
                  />
                </Link>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {item.category}
                  </span>
                  <Link
                    to={`/products/${item.productId}`}
                    className="block font-bold text-sm text-slate-800 hover:text-blue-600 transition leading-snug line-clamp-1"
                  >
                    {item.name}
                  </Link>
                  <p className="text-xs font-semibold text-slate-900">
                    {formatPrice(item.pricePaise)} each
                  </p>
                  {!item.isAvailable && (
                    <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Only {item.availableStock} in stock! Please adjust quantity.
                    </p>
                  )}
                </div>
              </div>

              {/* Quantity Controls & Item Total */}
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {/* Quantity Buttons */}
                <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 transition"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center text-xs font-bold text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                    disabled={item.quantity >= item.stockQuantity}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 transition disabled:opacity-40"
                    title="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtotal */}
                <div className="text-right min-w-[80px]">
                  <span className="block text-sm font-extrabold text-slate-900">
                    {formatPrice(item.subtotalPaise)}
                  </span>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.cartItemId)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2">
            <Link
              to="/products"
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 inline-flex"
            >
              <span>← Continue Shopping</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 sticky top-24">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight border-b border-slate-100 pb-3">
            Order Summary
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Items Subtotal ({cart.itemsCount} units)</span>
              <span className="font-bold text-slate-900">{formatPrice(cart.subtotalPaise)}</span>
            </div>

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Estimated Shipping</span>
              <span>
                {cart.shippingPaise === 0 ? (
                  <strong className="text-emerald-600 uppercase text-[11px]">FREE</strong>
                ) : (
                  <strong className="text-slate-900">{formatPrice(cart.shippingPaise)}</strong>
                )}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
              <div>
                <span className="text-sm font-black text-slate-900 block">Total Amount</span>
                <span className="text-[10px] text-slate-400">Inclusive of all taxes</span>
              </div>
              <span className="text-xl font-black text-blue-600">
                {formatPrice(cart.totalPaise)}
              </span>
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            type="button"
            onClick={() => navigate('/checkout')}
            disabled={cart.hasOutOfStock}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-bold text-sm shadow-md transition-all ${
              cart.hasOutOfStock
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95'
            }`}
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Safety & Guarantee Notes */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Simulated demo payments • Zero card fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Dispatched within 24 hours</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default CartPage;
