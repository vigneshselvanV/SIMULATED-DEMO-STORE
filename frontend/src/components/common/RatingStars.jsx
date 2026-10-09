import React from 'react';
import { Star } from 'lucide-react';

export function RatingStars({ rating = 4.5, count = 0, size = 'sm', showCount = true }) {
  const iconSize = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.3;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center text-amber-400">
        {[...Array(5)].map((_, i) => {
          const isFilled = i < fullStars;
          const isHalf = !isFilled && i === fullStars && hasHalfStar;

          return (
            <Star
              key={i}
              className={`${iconSize} ${
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : isHalf
                  ? 'fill-amber-200 text-amber-400'
                  : 'text-slate-300'
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs font-semibold text-slate-700">{rating?.toFixed(1)}</span>
      {showCount && count > 0 && (
        <span className="text-xs text-slate-400">({count})</span>
      )}
    </div>
  );
}

export default RatingStars;
