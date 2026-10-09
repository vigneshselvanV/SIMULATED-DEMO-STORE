import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  User,
  ShieldCheck,
  Package,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

export function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() || selectedCat) {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedCat) params.append('category', selectedCat);
      navigate(`/search?${params.toString()}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUserDropdownOpen(false);
    navigate('/');
  };

  const categories = [
    'All Products',
    'Electronics',
    'Fashion',
    'Books',
    'Accessories',
    'Home Products'
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Welcome to <strong>ShopSphere</strong> — Premier Marketplace</span>
            <span className="hidden sm:inline text-blue-300">|</span>
            <span className="hidden sm:inline text-blue-200">Free delivery on orders over ₹500</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span className="bg-blue-950/60 text-blue-200 px-2 py-0.5 rounded text-[11px] font-mono border border-blue-700/50">
              SIMULATED DEMO STORE
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-900 via-blue-700 to-blue-600 bg-clip-text text-transparent">
                ShopSphere
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">
                Marketplace
              </span>
            </div>
          </Link>

          {/* Search Form (Desktop & Tablet) */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-2xl mx-2">
            <div className="relative flex w-full rounded-lg border border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-slate-50">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="bg-slate-100 border-r border-slate-300 text-xs font-medium text-slate-700 px-3 rounded-l-lg focus:outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Books">Books</option>
                <option value="Accessories">Accessories</option>
                <option value="Home Products">Home</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, brands, essentials..."
                className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none text-slate-900 placeholder-slate-400"
              />
              <button
                type="submit"
                aria-label="Search"
                className="px-4 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Right Navigation Actions */}
          <div className="flex items-center gap-3">
            
            {/* User Account / Login */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-700"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left text-xs">
                    <p className="font-semibold text-slate-900 leading-tight truncate max-w-[100px]">{user.name}</p>
                    <p className="text-slate-500 capitalize">{user.role}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500">Signed in as</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                    </div>

                    <Link
                      to="/account"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      My Account
                    </Link>

                    <Link
                      to="/orders"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Package className="w-4 h-4 text-slate-400" />
                      Order History
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50/50 hover:bg-blue-50 transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        Admin Dashboard
                      </Link>
                    )}

                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/60 rounded-lg transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Shopping Cart Button */}
            <Link
              to="/cart"
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-800 transition font-medium text-xs group"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4 text-slate-700 group-hover:text-blue-600 transition" />
                {cart.itemsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {cart.itemsCount > 99 ? '99+' : cart.itemsCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline font-semibold">Cart</span>
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Form */}
        <div className="md:hidden pb-3">
          <form onSubmit={handleSearchSubmit} className="flex">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-l-lg focus:outline-none focus:border-blue-600"
            />
            <button
              type="submit"
              aria-label="Search mobile"
              className="px-3 bg-blue-600 text-white rounded-r-lg"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Subnav Category Strip */}
      <nav aria-label="Category Navigation" className="border-t border-slate-100 bg-slate-50/80 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="flex items-center gap-6 overflow-x-auto py-2 text-xs font-semibold text-slate-600 scrollbar-none">
            {categories.map((cat) => {
              const to = cat === 'All Products' ? '/products' : `/products?category=${encodeURIComponent(cat)}`;
              const isActive =
                cat === 'All Products'
                  ? location.pathname === '/products' && !location.search
                  : location.search.includes(encodeURIComponent(cat));

              return (
                <li key={cat}>
                  <Link
                    to={to}
                    className={`whitespace-nowrap transition pb-0.5 hover:text-blue-600 ${
                      isActive ? 'text-blue-600 font-bold border-b-2 border-blue-600' : ''
                    }`}
                  >
                    {cat}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 pt-2">Categories</p>
          <div className="grid grid-cols-2 gap-1">
            {categories.map((cat) => (
              <Link
                key={cat}
                to={cat === 'All Products' ? '/products' : `/products?category=${encodeURIComponent(cat)}`}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-md"
              >
                {cat}
              </Link>
            ))}
          </div>
          {isAdmin && (
            <div className="pt-2 border-t border-slate-100">
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-md"
              >
                Admin Dashboard
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Navbar;
