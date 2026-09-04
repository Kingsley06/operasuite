import { X, AlertTriangle } from 'lucide-react';

export function Modal({ title, children, onClose, size = 'md' }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = true }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
          <AlertTriangle size={24} className={danger ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <p className="text-center text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    yellow: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const config = {
    Available: { color: 'green', label: 'Available' },
    Booked: { color: 'blue', label: 'Booked' },
    Maintenance: { color: 'red', label: 'Maintenance' },
    Cleaning: { color: 'yellow', label: 'Cleaning' },
    Active: { color: 'green', label: 'Active' },
    'Checked Out': { color: 'gray', label: 'Checked Out' },
    Cancelled: { color: 'red', label: 'Cancelled' },
    Upcoming: { color: 'blue', label: 'Upcoming' },
    Paid: { color: 'green', label: 'Paid' },
    Partial: { color: 'yellow', label: 'Partial' },
    Unpaid: { color: 'red', label: 'Unpaid' },
    Refunded: { color: 'gray', label: 'Refunded' },
    Clean: { color: 'green', label: 'Clean' },
    Dirty: { color: 'red', label: 'Dirty' },
    'In Progress': { color: 'yellow', label: 'In Progress' },
    Open: { color: 'red', label: 'Open' },
    Resolved: { color: 'green', label: 'Resolved' },
    High: { color: 'red', label: 'High' },
    Medium: { color: 'yellow', label: 'Medium' },
    Low: { color: 'green', label: 'Low' },
  };
  const c = config[status] || { color: 'gray', label: status };
  return <Badge color={c.color}>{c.label}</Badge>;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-6">{description}</p>
      {action}
    </div>
  );
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input {...props}
        className={`px-3 py-2.5 border rounded-xl text-sm outline-none transition-colors
          ${error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-emerald-400'}
          focus:ring-2 ${error ? 'focus:ring-red-100' : 'focus:ring-emerald-50'} ${className}`} />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select {...props}
        className={`px-3 py-2.5 border rounded-xl text-sm outline-none transition-colors bg-white
          ${error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-emerald-400'}
          focus:ring-2 ${error ? 'focus:ring-red-100' : 'focus:ring-emerald-50'} ${className}`}>
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea {...props} rows={3}
        className={`px-3 py-2.5 border rounded-xl text-sm outline-none transition-colors resize-none
          ${error ? 'border-red-300' : 'border-gray-200 focus:border-emerald-400'}
          focus:ring-2 focus:ring-emerald-50 ${className}`} />
    </div>
  );
}

export function Btn({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200',
    danger: 'bg-red-500 hover:bg-red-600 text-white shadow-sm',
    ghost: 'hover:bg-gray-100 text-gray-600',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button {...props}
      className={`inline-flex items-center gap-2 font-medium rounded-xl transition-[background-color,box-shadow,transform] duration-150 ease-out-expo active:scale-[0.97] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>;
}

export function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5 tabular-nums">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}
