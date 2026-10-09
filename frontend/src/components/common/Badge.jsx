import React from 'react';

export function Badge({ children, variant = 'default', size = 'md' }) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200'
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-medium',
    lg: 'text-sm px-3 py-1 font-semibold'
  };

  return (
    <span className={`inline-flex items-center rounded-full border ${variantStyles[variant] || variantStyles.default} ${sizeStyles[size]}`}>
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status }) {
  switch (status) {
    case 'Delivered':
      return <Badge variant="success">Delivered</Badge>;
    case 'Shipped':
      return <Badge variant="indigo">Shipped</Badge>;
    case 'Processing':
      return <Badge variant="primary">Processing</Badge>;
    case 'Pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'Cancelled':
      return <Badge variant="danger">Cancelled</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}
