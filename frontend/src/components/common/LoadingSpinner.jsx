import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading...', size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-3">
      <Loader2 className={`${sizeClass} animate-spin text-blue-600`} />
      {text && <p className="text-sm font-medium text-slate-600">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;
