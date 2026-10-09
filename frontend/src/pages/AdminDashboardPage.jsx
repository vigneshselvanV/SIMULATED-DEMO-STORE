import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  X,
  RefreshCw,
  Eye,
  Sliders,
  Bot,
  Cpu
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatDate } from '../utils/formatters';
import { OrderStatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { AdminAgentsPanel } from '../components/admin/AdminAgentsPanel';
import { AgentGuardDashboard } from '../components/admin/AgentGuardDashboard';

export function AdminDashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products' | 'orders'
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Add / Edit Product
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    category: 'Electronics',
    priceRupees: '',
    stockQuantity: 10,
    imageUrl: '',
    featured: false
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');

  const loadAllAdminData = async () => {
    try {
      setLoading(true);
      const [metricsRes, prodRes, ordersRes] = await Promise.all([
        api.getAdminMetrics(),
        api.getAdminProducts(),
        api.getAdminOrders()
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (prodRes.success) setProducts(prodRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAllAdminData();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          You must be logged in as an administrator to access the ShopSphere management portal.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
        >
          Sign In as Admin
        </button>
      </div>
    );
  }

  // Handle open Add Modal
  const openAddModal = () => {
    setEditingProduct(null);
    setProductFormData({
      name: '',
      description: '',
      category: 'Electronics',
      priceRupees: '',
      stockQuantity: 10,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      featured: false
    });
    setFormError('');
    setProductModalOpen(true);
  };

  // Handle open Edit Modal
  const openEditModal = (p) => {
    setEditingProduct(p);
    setProductFormData({
      name: p.name,
      description: p.description,
      category: p.category,
      priceRupees: (p.price_paise / 100).toString(),
      stockQuantity: p.stock_quantity,
      imageUrl: p.image_url,
      featured: Boolean(p.featured)
    });
    setFormError('');
    setProductModalOpen(true);
  };

  // Submit Add or Edit Product
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          name: productFormData.name,
          description: productFormData.description,
          category: productFormData.category,
          priceRupees: productFormData.priceRupees,
          stockQuantity: productFormData.stockQuantity,
          imageUrl: productFormData.imageUrl,
          featured: productFormData.featured ? 1 : 0
        });
      } else {
        await api.createProduct({
          name: productFormData.name,
          description: productFormData.description,
          category: productFormData.category,
          priceRupees: productFormData.priceRupees,
          stockQuantity: productFormData.stockQuantity,
          imageUrl: productFormData.imageUrl,
          featured: productFormData.featured ? 1 : 0
        });
      }

      setProductModalOpen(false);
      loadAllAdminData();
    } catch (err) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Stock Update
  const handleQuickStockChange = async (productId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      await api.updateProductStock(productId, newStock);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock_quantity: newStock } : p))
      );
    } catch (err) {
      alert(err.message || 'Failed to update stock');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      loadAllAdminData();
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    }
  };

  // Update Order Status
  const handleOrderStatusChange = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      // Refresh metrics as well
      const mRes = await api.getAdminMetrics();
      if (mRes.success) setMetrics(mRes.data);
    } catch (err) {
      alert(err.message || 'Failed to update order status');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      productSearch === '' ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat =
      productCategoryFilter === '' ||
      p.category.toLowerCase() === productCategoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const filteredOrders = orders.filter((o) => {
    if (!orderStatusFilter) return true;
    return o.status === orderStatusFilter;
  });

  return (
    <div className="space-y-8 pt-4 pb-16 max-w-7xl mx-auto">
      
      {/* Admin Title & Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-purple-200">
              Admin Control Panel
            </span>
            <span className="text-xs text-slate-400 font-mono">Live SQLite Storage</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            ShopSphere Marketplace Administration
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllAdminData}
            title="Refresh dashboard data"
            className="p-2.5 bg-white border border-slate-300 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-400 transition shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Analytics Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'products'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products Inventory ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Customer Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('agents')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'agents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-600" />
          <span>AI Agents & Approvals</span>
        </button>

        <button
          onClick={() => setActiveTab('agentguard')}
          className={`px-4 py-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'agentguard'
              ? 'border-emerald-600 text-emerald-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-emerald-600" />
          <span>AgentGuard Security & Damage</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading administration dashboard..." />
      ) : (
        <>
          {/* TAB 1: OVERVIEW METRICS */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Revenue */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Sales</span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      ₹
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {formatPrice(metrics?.totalRevenuePaise || 0)}
                  </p>
                  <p className="text-[11px] text-slate-500">From all non-cancelled customer orders</p>
                </div>

                {/* Orders */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {metrics?.totalOrders || 0}
                  </p>
                  <p className="text-[11px] text-slate-500">Processed through checkout</p>
                </div>

                {/* Products */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catalog Items</span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Package className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900">
                    {metrics?.totalProducts || 0}
                  </p>
                  <p className="text-[11px] text-slate-500">Active SKUs across 5 categories</p>
                </div>

                {/* Low Stock Alert */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Low Stock SKUs</span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-amber-600">
                    {metrics?.lowStockCount || 0}
                  </p>
                  <p className="text-[11px] text-slate-500">Products with stock ≤ 5 units</p>
                </div>

              </div>

              {/* Recent Orders Overview */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900">Recent Customer Orders</h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    View All Orders →
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {metrics?.recentOrders?.map((ord) => (
                    <div key={ord.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-mono font-bold text-blue-900">{ord.order_number}</span>
                        <p className="text-slate-500 text-[11px]">Customer: {ord.customer_name} • {formatDate(ord.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <OrderStatusBadge status={ord.status} />
                        <span className="font-bold text-slate-900">{formatPrice(ord.total_paise)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT MANAGEMENT */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              
              {/* Product Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search by name or category..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="">All Categories</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Books">Books</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Home Products">Home Products</option>
                  </select>

                  <button
                    onClick={openAddModal}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add SKU</span>
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4">Product</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Price</th>
                        <th className="py-3.5 px-4">Stock Adjuster</th>
                        <th className="py-3.5 px-4">Rating</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                              />
                              <div>
                                <p className="font-bold text-slate-900 line-clamp-1 max-w-xs">{p.name}</p>
                                <p className="text-slate-400 text-[10px]">ID: #{p.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700">{p.category}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formatPrice(p.price_paise)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickStockChange(p.id, p.stock_quantity, -1)}
                                disabled={p.stock_quantity <= 0}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40"
                              >
                                -
                              </button>
                              <span
                                className={`w-8 text-center font-bold ${
                                  p.stock_quantity === 0
                                    ? 'text-rose-600'
                                    : p.stock_quantity <= 5
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                                }`}
                              >
                                {p.stock_quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuickStockChange(p.id, p.stock_quantity, 1)}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-800">★ {p.rating}</span>
                            <span className="text-slate-400 text-[11px] ml-1">({p.reviews_count})</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(p)}
                                title="Edit product"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
                                title="Delete product"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORDER MANAGEMENT */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              
              {/* Order Status Filter */}
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-700">Filter Orders by Status:</span>
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="">All Orders</option>
                  <option value="Pending">Pending</option>
                  <option value="Processing">Processing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3.5 px-4">Order Number</th>
                        <th className="py-3.5 px-4">Customer Details</th>
                        <th className="py-3.5 px-4">Date Placed</th>
                        <th className="py-3.5 px-4">Items / Total</th>
                        <th className="py-3.5 px-4">Current Status</th>
                        <th className="py-3.5 px-4 text-right">Update Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-extrabold text-blue-900">{ord.order_number}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{ord.customer_name}</p>
                            <p className="text-slate-400 text-[11px]">{ord.customer_email}</p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {formatDate(ord.created_at)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{formatPrice(ord.total_paise)}</span>
                            <span className="text-slate-400 text-[11px]">{ord.items?.length || 0} items</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <OrderStatusBadge status={ord.status} />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <select
                              value={ord.status}
                              onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer shadow-xs"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="Shipped">Shipped</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: AI AGENTS & APPROVALS */}
          {activeTab === 'agents' && (
            <AdminAgentsPanel />
          )}

          {/* TAB 5: AGENTGUARD SECURITY & DAMAGE */}
          {activeTab === 'agentguard' && (
            <AgentGuardDashboard />
          )}
        </>
      )}

      {/* Product Add / Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-lg text-slate-900">
                {editingProduct ? 'Edit Product SKU' : 'Add New Product SKU'}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Product Name</label>
                <input
                  type="text"
                  required
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                  placeholder="e.g. UltraHD Smart TV"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Category</label>
                  <select
                    value={productFormData.category}
                    onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Fashion">Fashion</option>
                    <option value="Books">Books</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Home Products">Home Products</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productFormData.priceRupees}
                    onChange={(e) => setProductFormData({ ...productFormData, priceRupees: e.target.value })}
                    placeholder="1499.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={productFormData.stockQuantity}
                    onChange={(e) => setProductFormData({ ...productFormData, stockQuantity: parseInt(e.target.value, 10) || 0 })}
                    placeholder="25"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Featured on Home</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={productFormData.featured}
                      onChange={(e) => setProductFormData({ ...productFormData, featured: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-700">Display in Featured</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Image URL</label>
                <input
                  type="url"
                  required
                  value={productFormData.imageUrl}
                  onChange={(e) => setProductFormData({ ...productFormData, imageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Description</label>
                <textarea
                  rows={3}
                  required
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  placeholder="Detailed product features and specifications..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md shadow-blue-500/20 active:scale-95"
                >
                  {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default AdminDashboardPage;
