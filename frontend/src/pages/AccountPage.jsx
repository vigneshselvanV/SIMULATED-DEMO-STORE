import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Shield,
  Package,
  Calendar,
  LogOut,
  ShoppingBag,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import api from '../services/api';

export function AccountPage() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const [orderCount, setOrderCount] = useState(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.getOrders();
        if (res.success && res.data) {
          setOrderCount(res.data.length);
        }
      } catch (err) {
        // ignore
      }
    }
    if (user) {
      loadStats();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Authentication Required</h2>
        <p className="text-xs text-slate-500">Please sign in to view your account details.</p>
        <Link to="/login" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-block">
          Sign In
        </Link>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      
      {/* Profile Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white font-extrabold flex items-center justify-center text-2xl shadow-md shadow-blue-500/20">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{user.name}</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}>
                {user.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{user.email}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-2 self-stretch sm:self-auto justify-center"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Account Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        {/* Total Orders Card */}
        <Link
          to="/orders"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl font-black text-slate-900">{orderCount}</p>
          <span className="text-[11px] text-blue-600 font-semibold group-hover:underline block pt-1">
            View Order History →
          </span>
        </Link>

        {/* Shopping Cart Card */}
        <Link
          to="/cart"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition space-y-2 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Cart</p>
          <p className="text-2xl font-black text-slate-900">Manage Bag</p>
          <span className="text-[11px] text-amber-600 font-semibold group-hover:underline block pt-1">
            Review Cart Items →
          </span>
        </Link>

        {/* Security & Admin Card */}
        {isAdmin ? (
          <Link
            to="/admin"
            className="bg-white p-6 rounded-2xl border border-blue-200 bg-blue-50/20 hover:border-blue-500 hover:shadow-md transition space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Administrator</p>
            <p className="text-2xl font-black text-slate-900">Portal</p>
            <span className="text-[11px] text-purple-600 font-semibold group-hover:underline block pt-1">
              Go to Admin Dashboard →
            </span>
          </Link>
        ) : (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session Security</p>
            <p className="text-sm font-bold text-slate-800">Protected Session</p>
            <span className="text-[11px] text-emerald-600 font-semibold block pt-1">
              HttpOnly Cookie Active
            </span>
          </div>
        )}

      </div>

      {/* Security Architecture Details */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4 text-xs">
        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
          Account Security & Architecture
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-600">
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">Password Encryption</p>
            <p className="text-[11px] text-slate-500">
              Passwords are salted and securely hashed via bcrypt. Plaintext passwords are never stored.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">Session Cookie</p>
            <p className="text-[11px] text-slate-500">
              State is maintained with server-side sessions protected by HttpOnly and SameSite Lax cookie flags.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default AccountPage;
