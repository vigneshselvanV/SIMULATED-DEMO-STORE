import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  TrendingUp,
  Award,
  Sparkles,
  Zap,
  ShoppingBag,
  Layers,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/products/ProductCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [prodRes, catRes] = await Promise.all([
          api.getProducts({ limit: 8, featured: 'true' }),
          api.getCategories()
        ]);

        if (prodRes.success && prodRes.data) {
          setFeaturedProducts(prodRes.data);
        }
        if (catRes.success && catRes.data) {
          setCategories(catRes.data);
        }
      } catch (err) {
        console.error('Error loading homepage data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-12 pb-16">
      
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 text-white shadow-xl mt-4">
        {/* Decorative background glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-16 sm:py-20 lg:px-12 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-xl text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Next-Generation Online Shopping</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Discover Quality Products with <span className="bg-gradient-to-r from-blue-200 to-sky-300 bg-clip-text text-transparent">ShopSphere</span>
            </h1>

            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Explore thousands of curated items across Electronics, Fashion, Books, Accessories, and Home essentials. Enjoy lightning-fast delivery and frictionless checkout.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <span>Shop All Products</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/products?category=Electronics"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 backdrop-blur-md transition-all hover:scale-105"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Featured Tech</span>
              </Link>
            </div>
          </div>

          {/* Hero Featured Badge Card */}
          <div className="relative w-full max-w-md lg:max-w-lg">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl text-white space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-bold text-blue-200">Today's Highlight</span>
                <span className="bg-amber-400/90 text-slate-900 font-bold text-xs px-2.5 py-0.5 rounded-full">
                  HOT DEAL
                </span>
              </div>
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-800">
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"
                  alt="AcousticPro Headphones"
                  className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h3 className="font-bold text-base text-white">AcousticPro ANC Headphones</h3>
                  <p className="text-xs text-blue-200">Hi-Res Audio • 40h Battery</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-300 line-through">₹12,999</span>
                  <p className="text-lg font-extrabold text-amber-300">₹8,499.00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Shop by Category</h2>
            <p className="text-xs text-slate-500">Find what you love across curated departments</p>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.category}
              to={`/products?category=${encodeURIComponent(cat.category)}`}
              className="group relative flex flex-col bg-white rounded-2xl border border-slate-200/80 p-4 hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-3">
                <img
                  src={cat.sample_image}
                  alt={cat.category}
                  className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <h3 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition truncate">
                {cat.category}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {cat.count} {cat.count === 1 ? 'Product' : 'Products'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products Showcase */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Featured Products</h2>
              <p className="text-xs text-slate-500">Top-rated items handpicked for you</p>
            </div>
          </div>
          <Link
            to="/products"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
          >
            <span>Browse Catalog</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading featured catalog..." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        )}
      </section>

      {/* Trust & Features Banner */}
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-8 sm:p-10 border border-slate-800 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-blue-600/30 text-blue-400 mb-2">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white">Genuine Brand Quality</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every item is guaranteed authentic and carefully inspected before dispatch.
            </p>
          </div>

          <div className="space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-blue-600/30 text-blue-400 mb-2">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white">Instant Order Processing</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Real-time database inventory locks prevent out-of-stock cancellations.
            </p>
          </div>

          <div className="space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-blue-600/30 text-blue-400 mb-2">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-white">Interactive Admin Controls</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Powerful dashboard allows live inventory editing and full order lifecycle management.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}

export default HomePage;
