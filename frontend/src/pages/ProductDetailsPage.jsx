import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Zap,
  Check,
  AlertCircle,
  Truck,
  ShieldCheck,
  RotateCcw,
  Minus,
  Plus,
  ChevronRight,
  Share2
} from 'lucide-react';
import api from '../services/api';
import { formatPrice } from '../utils/formatters';
import { RatingStars } from '../components/common/RatingStars';
import { ProductCard } from '../components/products/ProductCard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useCart } from '../context/CartContext';

export function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        const res = await api.getProductById(id);
        if (res.success && res.data) {
          setProduct(res.data);
          setRelatedProducts(res.related || []);
          setQuantity(1);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) {
    return <LoadingSpinner text="Loading product details..." />;
  }

  if (!product) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Product Not Found</h2>
        <p className="text-xs text-slate-500">The requested product could not be located.</p>
        <Link to="/products" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold inline-block">
          Return to Shop
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;

  const handleIncrement = () => {
    if (quantity < product.stock_quantity) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  const handleAddToCart = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    const result = await addToCart(product.id, quantity);
    setAdding(false);
    if (result.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  const handleBuyNow = async () => {
    if (isOutOfStock || adding) return;
    setAdding(true);
    const result = await addToCart(product.id, quantity);
    setAdding(false);
    if (result.success) {
      navigate('/checkout');
    }
  };

  return (
    <div className="space-y-12 pt-4 pb-16">
      
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link to="/" className="hover:text-blue-600 transition">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to={`/products?category=${encodeURIComponent(product.category)}`} className="hover:text-blue-600 transition">
          {product.category}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-bold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 bg-white p-6 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
        
        {/* Left: Product Image */}
        <div className="lg:col-span-5 space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 relative group">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            {isOutOfStock && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                <span className="bg-rose-600 text-white font-bold text-sm px-4 py-1.5 rounded-full shadow-lg">
                  Out of Stock
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Details & Descriptions */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                {product.category}
              </span>
              <span className="text-xs text-slate-400 font-mono">Product ID: #{product.id}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              {product.name}
            </h1>

            {/* Rating Stars & Review Summary */}
            <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
              <RatingStars rating={product.rating} count={product.reviews_count} size="md" />
              <span className="text-slate-300">|</span>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Verified ShopSphere Item
              </span>
            </div>

            {/* Price Display */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-slate-900">
                  {formatPrice(product.price_paise)}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Inclusive of all taxes
                </span>
              </div>
              <p className="text-xs text-emerald-600 font-semibold">
                Free standard delivery on orders above ₹500
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Overview</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Stock Availability */}
            <div className="pt-2">
              {isOutOfStock ? (
                <div className="flex items-center gap-2 text-rose-600 font-bold text-xs bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                  <AlertCircle className="w-4 h-4" />
                  <span>Currently Out of Stock. Check back soon.</span>
                </div>
              ) : isLowStock ? (
                <div className="flex items-center gap-2 text-amber-700 font-bold text-xs bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Hurry! Only {product.stock_quantity} units left in stock.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>In Stock — Ready for dispatch ({product.stock_quantity} units available)</span>
                </div>
              )}
            </div>

          </div>

          {/* Action Row: Quantity + Add to Cart + Buy Now */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-4">
              
              {/* Quantity Picker */}
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="p-2.5 hover:bg-slate-200 transition text-slate-600 disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-12 text-center text-sm font-bold text-slate-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={quantity >= product.stock_quantity || isOutOfStock}
                  className="p-2.5 hover:bg-slate-200 transition text-slate-600 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock || adding}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${
                  isOutOfStock
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : justAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 active:scale-95'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
                  </>
                )}
              </button>

              {/* Buy Now Button */}
              {!isOutOfStock && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={adding}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-md shadow-amber-500/20 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-slate-900" />
                  <span>Buy Now</span>
                </button>
              )}

            </div>

            {/* Value Guarantees Strip */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50">
                <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Fast Delivery</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50">
                <RotateCcw className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>30-Day Returns</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50">
                <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Secure Payments</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Related Products in {product.category}
            </h2>
            <Link
              to={`/products?category=${encodeURIComponent(product.category)}`}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              View More
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

export default ProductDetailsPage;
