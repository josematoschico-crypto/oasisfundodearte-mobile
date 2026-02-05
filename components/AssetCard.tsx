
import React from 'react';
import { ArtAsset } from '../types';
import InsuranceBadge from './InsuranceBadge';

interface Props {
  asset: ArtAsset;
  onClick: () => void;
}

const AssetCard: React.FC<Props> = ({ asset, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className="group bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700/50 active:scale-[0.98] transition-all duration-300 ease-out cursor-pointer shadow-xl hover:scale-[1.02] hover:shadow-[0_20px_50px_rgba(245,158,11,0.1)] hover:border-amber-500/30"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img 
          src={asset.imageUrl} 
          alt={asset.title} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute top-3 right-3 z-10">
          <InsuranceBadge status={asset.insuranceStatus} showText />
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent p-4">
          <p className="text-amber-400 font-bold text-xs tracking-widest uppercase mb-1">{asset.artist}</p>
          <h3 className="text-white font-bold text-lg leading-tight group-hover:text-amber-200 transition-colors">{asset.title}</h3>
        </div>
      </div>
      <div className="p-4 flex justify-between items-center bg-slate-800/80 backdrop-blur-sm border-t border-slate-700/30">
        <div>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Fração</p>
          <p className="text-white font-black text-base">R$ {asset.fractionPrice.toLocaleString('pt-BR')}</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Disponível</p>
          <p className="text-emerald-400 font-black text-base">
            {((asset.availableFractions / asset.totalFractions) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
