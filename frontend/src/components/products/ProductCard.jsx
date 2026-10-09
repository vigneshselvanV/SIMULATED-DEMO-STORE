import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Check, AlertCircle } from 'lucide-react';
import { formatPrice } from '../../utils/formatters';
import { RatingStars } from '../common/RatingStars';
import { useCart } from '../../context/CartContext';

export function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || adding) return;

    setAdding(true);
    const result = await addToCart(product.id, 1);
    setAdding(false);

    if (result.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    }
  };

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] hover:border-blue-300 transition-all duration-300 overflow-hidden">
      {/* Product Image Link */}
      <Link to={`/products/${product.id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />

        {/* Category Pill Tag */}
        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200/60 shadow-sm">
          {product.category}
        </span>

        {/* Stock Badge Overlay */}
        {isOutOfStock ? (
          <span className="absolute top-3 right-3 bg-rose-600/95 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="absolute top-3 right-3 bg-amber-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Only {product.stock_quantity} left
          </span>
        ) : null}
      </Link>

      {/* Product Details */}
      <div className="flex flex-col flex-1 p-4">
        {/* Rating */}
        <div className="mb-1.5">
          <RatingStars rating={product.rating} count={product.reviews_count} size="sm" />
        </div>

        {/* Title */}
        <Link to={`/products/${product.id}`} className="block flex-1 group-hover:text-blue-600 transition">
          <h3 className="font-semibold text-sm text-slate-800 line-clamp-2 leading-snug">
            {product.name}
          </h3>
        </Link>

        {/* Description Snippet */}
        <p className="text-xs text-slate-500 line-clamp-1 mt-1 mb-3">
          {product.description}
        </p>

        {/* Pricing & Add to Cart Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
          <div>
            <span className="text-xs text-slate-400 block font-medium -mb-0.5">Price</span>
            <span className="text-base font-extrabold text-slate-900">
              {formatPrice(product.price_paise)}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || adding}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm ${
              isOutOfStock
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-blue-500/20'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isOutOfStock ? 'Sold Out' : 'Add'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
