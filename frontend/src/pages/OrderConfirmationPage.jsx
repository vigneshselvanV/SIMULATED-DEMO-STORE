import React from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Package, ArrowRight, Printer, ShieldCheck } from 'lucide-react';
import { formatPrice, formatDate } from '../utils/formatters';
import { OrderStatusBadge } from '../components/common/Badge';

export function OrderConfirmationPage() {
  const location = useLocation();
  const order = location.state?.order;

  if (!order) {
    return <Navigate to="/orders" replace />;
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      
      {/* Success Hero Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10 animate-bounce" />
        </div>

        <div className="space-y-1">
          <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            Order Placed Successfully
          </span>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight pt-2">
            Thank You for Your Order!
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            We have received your simulated order. A confirmation email has been logged and the item inventory has been reserved.
          </p>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Order Number</span>
            <strong className="text-slate-900 font-mono text-sm">{order.order_number}</strong>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment</span>
            <span className="font-semibold text-emerald-700">{order.payment_status}</span>
          </div>
        </div>
      </div>

      {/* Order Details Receipt Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Shipping info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-100 pb-6 text-xs">
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[11px] mb-1">
              Shipping Recipient
            </h3>
            <p className="font-bold text-slate-900 text-sm">{order.customer_name}</p>
            <p className="text-slate-600">{order.customer_phone}</p>
            <p className="text-slate-600">{order.customer_email}</p>
          </div>

          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[11px] mb-1">
              Delivery Address
            </h3>
            <p className="text-slate-800 leading-relaxed font-medium">
              {order.shipping_address}<br />
              {order.city}, {order.state} - {order.postal_code}
            </p>
          </div>
        </div>

        {/* Itemized List */}
        <div className="space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
            Purchased Items
          </h3>

          <div className="divide-y divide-slate-100">
            {order.items?.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-slate-800">{item.product_name}</p>
                    <p className="text-slate-400 text-[11px]">Qty: {item.quantity} × {formatPrice(item.price_paise)}</p>
                  </div>
                </div>

                <div className="font-bold text-slate-900 text-sm">
                  {formatPrice(item.subtotal_paise)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 text-xs border border-slate-100">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-bold text-slate-900">{formatPrice(order.subtotal_paise)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Shipping</span>
            <span>
              {order.shipping_paise === 0 ? (
                <strong className="text-emerald-600 uppercase text-[11px]">FREE</strong>
              ) : (
                <strong className="text-slate-900">{formatPrice(order.shipping_paise)}</strong>
              )}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
            <span>Total Paid</span>
            <span className="text-blue-600 font-extrabold">{formatPrice(order.total_paise)}</span>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <Link
          to="/orders"
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2"
        >
          <Package className="w-4 h-4" />
          <span>View All Orders</span>
        </Link>
        <Link
          to="/products"
          className="w-full sm:w-auto px-6 py-3 bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

    </div>
  );
}

export default OrderConfirmationPage;
