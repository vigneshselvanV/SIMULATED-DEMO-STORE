import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, MapPin, ArrowRight, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatDate } from '../utils/formatters';
import { OrderStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function OrderHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        setLoading(true);
        const res = await api.getOrders();
        if (res.success && res.data) {
          setOrders(res.data);
          if (res.data.length > 0) {
            setExpandedOrderId(res.data[0].id); // Expand newest order by default
          }
        }
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Please Sign In</h2>
        <p className="text-xs text-slate-500">Sign in to review your past purchase orders.</p>
        <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  const toggleExpand = (id) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order History</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track current shipments and view previous receipts
        </p>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading orders..." />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No Orders Placed Yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once you place an order, it will appear here with live tracking status and item receipts.
          </p>
          <div className="pt-2">
            <Link
              to="/products"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition inline-block"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200"
              >
                {/* Order Summary Header */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50/70 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-extrabold text-blue-900">
                        {order.order_number}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Placed on {formatDate(order.created_at)}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Amount</span>
                      <span className="text-base font-black text-slate-900">
                        {formatPrice(order.total_paise)}
                      </span>
                    </div>

                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 sm:p-6 bg-slate-50/50 space-y-6">
                    
                    {/* Destination & Payment row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white p-4 rounded-2xl border border-slate-200/60">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Shipping Address
                        </span>
                        <p className="font-semibold text-slate-800">{order.customer_name}</p>
                        <p className="text-slate-600">
                          {order.shipping_address}, {order.city}, {order.state} - {order.postal_code}
                        </p>
                        <p className="text-slate-500">{order.customer_phone}</p>
                      </div>

                      <div className="space-y-1 sm:border-l sm:border-slate-100 sm:pl-4">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Payment Status
                        </span>
                        <p className="font-semibold text-emerald-700">{order.payment_status}</p>
                        <p className="text-slate-500">{order.payment_method}</p>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Order Items ({order.items?.length || 0})
                      </h4>

                      <div className="space-y-2">
                        {order.items?.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-4 text-xs"
                          >
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-12 h-12 rounded-xl object-cover bg-slate-100"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <Link
                                  to={`/products/${item.product_id}`}
                                  className="font-bold text-slate-800 hover:text-blue-600 transition line-clamp-1"
                                >
                                  {item.product_name}
                                </Link>
                                <p className="text-slate-400 text-[11px]">
                                  Quantity: {item.quantity} × {formatPrice(item.price_paise)}
                                </p>
                              </div>
                            </div>

                            <span className="font-bold text-slate-900 text-sm">
                              {formatPrice(item.subtotal_paise)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price summary */}
                    <div className="flex justify-end pt-2">
                      <div className="w-full sm:w-64 bg-white p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal:</span>
                          <span className="font-bold text-slate-900">{formatPrice(order.subtotal_paise)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Shipping:</span>
                          <span className="font-bold text-slate-900">
                            {order.shipping_paise === 0 ? 'FREE' : formatPrice(order.shipping_paise)}
                          </span>
                        </div>
                        <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-slate-900">
                          <span>Grand Total:</span>
                          <span className="text-blue-600">{formatPrice(order.total_paise)}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

export default OrderHistoryPage;
