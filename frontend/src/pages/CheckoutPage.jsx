import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertTriangle,
  Lock,
  ArrowRight,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  Building,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/formatters';
import api from '../services/api';

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.items && cart.items.length === 0) {
      navigate('/cart');
    }
  }, [cart, navigate]);

  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: '+91 98765 43210',
    shippingAddress: 'Flat 402, Sunshine Residency, MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001'
  });

  const [demoPaymentType, setDemoPaymentType] = useState('simulated_upi');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto fill user details if logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || user.name,
        customerEmail: prev.customerEmail || user.email
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Please log in or register to place your order.');
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const res = await api.checkout({
        ...formData,
        idempotencyKey,
        demoPaymentMethod: demoPaymentType === 'simulated_upi' ? 'Demo Simulated UPI' : 'Demo Simulated Card'
      });

      if (res.success && res.data) {
        // Refresh global cart state so header cart badge resets to 0
        await fetchCart();
        navigate('/orders/confirmation', { state: { order: res.data } });
      }
    } catch (err) {
      setError(err.message || 'Failed to place order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pt-4 pb-16 max-w-6xl mx-auto">
      
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Express Checkout</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review your shipping information and complete your order
        </p>
      </div>

      {/* Auth Gate Banner if guest */}
      {!user && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-800 text-xs">
            <User className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Account Required for Checkout</p>
              <p className="text-[11px] text-amber-700">Please sign in or create an account to place and track your orders.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              state={{ from: '/checkout' }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              state={{ from: '/checkout' }}
              className="px-4 py-2 bg-white text-amber-800 border border-amber-300 rounded-xl text-xs font-bold hover:bg-amber-100 transition"
            >
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Shipping & Payment Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handlePlaceOrder} id="checkout-form" className="space-y-6">
            
            {/* Shipping Address Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-100 font-bold text-sm">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>1. Shipping & Contact Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      name="customerName"
                      required
                      value={formData.customerName}
                      onChange={handleInputChange}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Contact Phone</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      name="customerPhone"
                      required
                      value={formData.customerPhone}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      name="customerEmail"
                      required
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      placeholder="customer@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Street Address</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      name="shippingAddress"
                      required
                      value={formData.shippingAddress}
                      onChange={handleInputChange}
                      placeholder="House/Flat number, Building name, Street"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">City</label>
                  <input
                    type="text"
                    name="city"
                    required
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Bengaluru"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">State</label>
                  <input
                    type="text"
                    name="state"
                    required
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="Karnataka"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Postal / PIN Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    required
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="560001"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Simulated Payment Section */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-800 pb-2 border-b border-slate-100 font-bold text-sm">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>2. Simulated Demo Payment Method</span>
              </div>

              {/* DEMO NOTICE CALLOUT */}
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>DEMO PAYMENT MODE ONLY</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  This marketplace operates in sandbox simulation mode. <strong>No real money will be charged</strong>, and you will never be asked for sensitive card numbers, CVVs, or bank credentials.
                </p>
              </div>

              {/* Select simulated mode */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-blue-400 transition">
                  <input
                    type="radio"
                    name="demoPayment"
                    checked={demoPaymentType === 'simulated_upi'}
                    onChange={() => setDemoPaymentType('simulated_upi')}
                    className="text-blue-600"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">Simulated Instant UPI / Net Banking</p>
                    <p className="text-slate-500 text-[11px]">Instant automated mock approval</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-blue-400 transition">
                  <input
                    type="radio"
                    name="demoPayment"
                    checked={demoPaymentType === 'simulated_card'}
                    onChange={() => setDemoPaymentType('simulated_card')}
                    className="text-blue-600"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">Simulated Credit / Debit Card</p>
                    <p className="text-slate-500 text-[11px]">Test sandbox simulation</p>
                  </div>
                </label>
              </div>
            </div>

          </form>

        </div>

        {/* Right Column: Order Review & Confirmation CTA */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6 sticky top-24">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight border-b border-slate-100 pb-3">
            Review Order ({cart.itemsCount} items)
          </h2>

          {/* Compact items list */}
          <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
            {cart.items?.map((item) => (
              <div key={item.cartItemId} className="flex items-center gap-3 text-xs">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{item.name}</p>
                  <p className="text-slate-400">Qty: {item.quantity} × {formatPrice(item.pricePaise)}</p>
                </div>
                <span className="font-bold text-slate-900">{formatPrice(item.subtotalPaise)}</span>
              </div>
            ))}
          </div>

          {/* Breakdown */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-bold text-slate-900">{formatPrice(cart.subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Charges</span>
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
                <span className="text-sm font-black text-slate-900 block">Total Due</span>
                <span className="text-[10px] text-slate-400">Demo sandbox amount</span>
              </div>
              <span className="text-2xl font-black text-blue-600">
                {formatPrice(cart.totalPaise)}
              </span>
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            type="submit"
            form="checkout-form"
            disabled={isSubmitting || !user}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 ${
              isSubmitting || !user
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 active:scale-95'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>{isSubmitting ? 'Processing Transaction...' : 'Place Order (Demo)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-center text-slate-400">
            By placing your order, you agree to ShopSphere's simulated store terms.
          </p>
        </div>

      </div>

    </div>
  );
}

export default CheckoutPage;
