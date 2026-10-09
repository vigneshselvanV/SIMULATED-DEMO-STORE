import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ShieldCheck, Truck, RotateCcw, Headphones, Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-20 pt-12 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Value Propositions Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-12 border-b border-slate-800 text-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Free Express Delivery</p>
              <p className="text-[11px] text-slate-400">On all orders above ₹500</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Hassle-Free Returns</p>
              <p className="text-[11px] text-slate-400">30-day replacement policy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Secure Architecture</p>
              <p className="text-[11px] text-slate-400">Encrypted server sessions</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">24/7 Dedicated Support</p>
              <p className="text-[11px] text-slate-400">Friendly assistance anytime</p>
            </div>
          </div>
        </div>

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-10">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">ShopSphere</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              ShopSphere is an advanced full-stack e-commerce marketplace platform engineered for fast browsing, atomic cart & checkout transactions, and robust administrator controls.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800 text-[11px] text-slate-300 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulated Payment Engine</span>
            </div>
          </div>

          {/* Quick Categories */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Categories</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/products?category=Electronics" className="hover:text-blue-400 transition">Electronics & Gadgets</Link></li>
              <li><Link to="/products?category=Fashion" className="hover:text-blue-400 transition">Fashion & Apparel</Link></li>
              <li><Link to="/products?category=Books" className="hover:text-blue-400 transition">Books & Literature</Link></li>
              <li><Link to="/products?category=Accessories" className="hover:text-blue-400 transition">Bags & Accessories</Link></li>
              <li><Link to="/products?category=Home%20Products" className="hover:text-blue-400 transition">Home & Living</Link></li>
            </ul>
          </div>

          {/* Customer Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Account & Orders</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/account" className="hover:text-blue-400 transition">My Account</Link></li>
              <li><Link to="/orders" className="hover:text-blue-400 transition">Order History</Link></li>
              <li><Link to="/cart" className="hover:text-blue-400 transition">Shopping Cart</Link></li>
              <li><Link to="/login" className="hover:text-blue-400 transition">Sign In / Register</Link></li>
              <li><Link to="/admin" className="hover:text-blue-400 transition">Admin Portal</Link></li>
            </ul>
          </div>

          {/* Demo Notice & Disclaimer */}
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">Simulated Demo Notice</h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              This application is built for educational & demonstration purposes. All transactions are simulated with demo payments. No actual financial charges are made.
            </p>
            <div className="mt-3 text-[11px] text-slate-400">
              Tech Stack: React • Vite • Tailwind • Node.js • Express • SQLite
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} ShopSphere Technologies. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 cursor-pointer">Security Safeguards</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
