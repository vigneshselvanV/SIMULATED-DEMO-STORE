import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filter, SlidersHorizontal, RotateCcw, PackageX } from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/products/ProductCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function ProductListingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = new URLSearchParams(location.search);
  const initialCategory = searchParams.get('category') || '';
  const initialSearch = searchParams.get('q') || '';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState('newest');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPriceRupees, setMaxPriceRupees] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Synchronize category filter if URL param changes
  useEffect(() => {
    const urlCat = new URLSearchParams(location.search).get('category') || '';
    setCategory(urlCat);
  }, [location.search]);

  // Load categories list for filter
  useEffect(() => {
    async function fetchCats() {
      try {
        const res = await api.getCategories();
        if (res.success && res.data) {
          setCategories(res.data);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchCats();
  }, []);

  // Fetch products with active filters
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        const params = {
          sort,
          limit: 100
        };

        if (category && category !== 'All') {
          params.category = category;
        }

        if (initialSearch) {
          params.search = initialSearch;
        }

        if (inStockOnly) {
          params.inStock = 'true';
        }

        if (maxPriceRupees && !isNaN(parseFloat(maxPriceRupees))) {
          // Convert rupees to paise
          params.maxPrice = Math.round(parseFloat(maxPriceRupees) * 100);
        }

        const res = await api.getProducts(params);
        if (res.success && res.data) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [category, sort, inStockOnly, maxPriceRupees, initialSearch]);

  const handleResetFilters = () => {
    setCategory('');
    setSort('newest');
    setInStockOnly(false);
    setMaxPriceRupees('');
    navigate('/products');
  };

  return (
    <div className="space-y-6 pt-4 pb-16">
      
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {category ? `${category}` : initialSearch ? `Search: "${initialSearch}"` : 'All Products'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing <strong className="text-slate-800">{products.length}</strong> items
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="sm:hidden flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600 shadow-sm"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="reviews_desc">Most Reviewed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Layout with Sidebar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-5 gap-8 items-start">
        
        {/* Filter Sidebar */}
        <aside
          className={`${
            mobileFiltersOpen ? 'block' : 'hidden'
          } sm:block sm:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-24`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" /> Filter Catalog
            </span>
            <button
              onClick={handleResetFilters}
              title="Reset all filters"
              className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Categories
            </label>
            <div className="space-y-1">
              <button
                onClick={() => setCategory('')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  category === ''
                    ? 'bg-blue-50 text-blue-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.category}
                  onClick={() => setCategory(c.category)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                    category.toLowerCase() === c.category.toLowerCase()
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{c.category}</span>
                  <span className="text-[10px] text-slate-400">({c.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Availability Filter */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Stock Status
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span>In-Stock Only</span>
            </label>
          </div>

          {/* Max Price Filter */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Max Price (₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={maxPriceRupees}
              onChange={(e) => setMaxPriceRupees(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
            />
          </div>
        </aside>

        {/* Product Grid Area */}
        <div className="sm:col-span-3 lg:col-span-4">
          {loading ? (
            <LoadingSpinner text="Fetching products..." />
          ) : products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <PackageX className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No products found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No items matched your current filter criteria. Try clearing some filters or searching for something else.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default ProductListingPage;
