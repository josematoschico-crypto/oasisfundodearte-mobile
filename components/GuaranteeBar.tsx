
import React from 'react';

interface Props {
  expiryDate: string;
}

const GuaranteeBar: React.FC<Props> = ({ expiryDate }) => {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
  
  // Assuming a standard 1-year policy for percentage calculation (365 days)
  const percentage = Math.max(0, Math.min(100, (diffDays / 365) * 100));
  
  const getColor = () => {
    if (diffDays > 90) return 'bg-emerald-500';
    if (diffDays > 30) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span className="font-medium uppercase tracking-wider">Vigência da Garantia</span>
        <span className="text-slate-200 font-bold">{diffDays} dias restantes</span>
      </div>
      <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-1000`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default GuaranteeBar;
