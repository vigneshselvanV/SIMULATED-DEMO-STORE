import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Search, PackageX } from 'lucide-react';
import api from '../services/api';
import { ProductCard } from '../components/products/ProductCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export function SearchResultsPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function performSearch() {
      try {
        setLoading(true);
        const params = { limit: 50 };
        if (query) params.search = query;
        if (category) params.category = category;

        const res = await api.getProducts(params);
        if (res.success && res.data) {
          setProducts(res.data);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [query, category]);

  return (
    <div className="space-y-6 pt-4 pb-16">
      
      {/* Search Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Search className="w-4 h-4 text-blue-600" />
            <span>Search Results</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {query ? (
              <>
                Matches for <span className="text-blue-600">"{query}"</span>
              </>
            ) : (
              'All Matching Products'
            )}
            {category && <span className="text-sm font-normal text-slate-500 ml-2">in {category}</span>}
          </h1>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
          {products.length} {products.length === 1 ? 'result found' : 'results found'}
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <LoadingSpinner text="Searching catalog..." />
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <PackageX className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No products match your search</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            We couldn't find any products matching "{query}". Try checking your spelling or using more general terms.
          </p>
          <div className="pt-2">
            <Link
              to="/products"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition inline-block"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

    </div>
  );
}

export default SearchResultsPage;
