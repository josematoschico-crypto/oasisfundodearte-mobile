import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ViewType, ArtAsset, UserHolding, Transaction, InsuranceStatus, GalleryItem } from './types';
import { MOCK_ASSETS } from './constants';
import InsuranceBadge from './components/InsuranceBadge';
import AssetCard from './components/AssetCard';
import GuaranteeBar from './components/GuaranteeBar';
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('HOME');
  const [selectedAsset, setSelectedAsset] = useState<ArtAsset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Gallery Modal State
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Global Asset State
  const [assets, setAssets] = useState<ArtAsset[]>([]);

  // Profile State
  const [userProfile, setUserProfile] = useState({
    name: '',
    handle: 'INVESTIDOR@OASIS.COM.BR',
    email: '',
    bio: '',
    walletId: '0x71C...9A23',
    avatarUrl: '',
    isAdmin: true // Simulation of admin role
  });

  // Cropper State
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const CROP_SIZE = 280; // Size of the cropping viewport

  // Fetch Assets from Supabase on Load and Load Profile from LocalStorage
  useEffect(() => {
    fetchAssets();
    
    // Load saved profile
    const savedProfile = localStorage.getItem('aurea_profile');
    if (savedProfile) {
        setUserProfile(JSON.parse(savedProfile));
    }
  }, []);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('assets').select('*');
      
      if (error) {
        console.error('Error fetching assets:', error);
        showNotification('Erro ao conectar ao banco de dados');
        // Fallback to Mocks if DB is empty or fails initially
        if (assets.length === 0) setAssets(MOCK_ASSETS);
        return;
      }

      if (data && data.length > 0) {
        // Map Supabase snake_case columns to TypeScript camelCase interface
        const formattedAssets: ArtAsset[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          artist: item.artist,
          year: item.year,
          totalValue: Number(item.total_value),
          fractionPrice: Number(item.fraction_price),
          totalFractions: Number(item.total_fractions),
          availableFractions: Number(item.available_fractions),
          imageUrl: item.image_url,
          gallery: item.gallery || [],
          insuranceStatus: item.insurance_status as InsuranceStatus,
          insuranceCompany: item.insurance_company,
          policyNumber: item.policy_number,
          insuranceExpiry: item.insurance_expiry,
          technicalReportUrl: item.technical_report_url,
          description: item.description,
          isCatalogOnly: item.is_catalog_only
        }));
        setAssets(formattedAssets);
      } else {
        // If DB is empty, use mocks so the app doesn't look broken
        setAssets(MOCK_ASSETS); 
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setAssets(MOCK_ASSETS);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mock User State
  const [userBalance, setUserBalance] = useState(25400.50);
  const [userHoldings, setUserHoldings] = useState<UserHolding[]>([
    { assetId: '1', fractionsOwned: 120, averagePrice: 118.00 },
    { assetId: '2', fractionsOwned: 45, averagePrice: 84.20 },
    { assetId: '3', fractionsOwned: 300, averagePrice: 41.50 },
    { assetId: '4', fractionsOwned: 5, averagePrice: 305.00 }
  ]);

  // Admin Authentication State
  const [inputPin, setInputPin] = useState('');

  // Admin Form State
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  
  // Temporary state for adding a new item to the gallery in Admin
  const [tempGalleryItem, setTempGalleryItem] = useState<Partial<GalleryItem>>({
    title: '',
    year: new Date().getFullYear().toString(),
    imageUrl: ''
  });

  const [newAsset, setNewAsset] = useState<Partial<ArtAsset>>({
    title: '',
    artist: '',
    year: new Date().getFullYear().toString(),
    totalValue: 0,
    fractionPrice: 0,
    imageUrl: '',
    gallery: [],
    description: '',
    insuranceStatus: InsuranceStatus.SECURED,
    isCatalogOnly: false,
    availableFractions: 10000,
    totalFractions: 10000,
    insuranceCompany: 'Aurea Safe Guard',
    policyNumber: `POL-${Math.floor(Math.random() * 10000)}`,
    insuranceExpiry: '2025-12-31',
    technicalReportUrl: '#'
  });

  const totalPortfolioValue = useMemo(() => {
    return userHoldings.reduce((acc, holding) => {
      const asset = assets.find(a => a.id === holding.assetId);
      return acc + (holding.fractionsOwned * (asset?.fractionPrice || 0));
    }, 0);
  }, [userHoldings, assets]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2000);
  };

  const navigateToAsset = (asset: ArtAsset) => {
    setSelectedAsset(asset);
    setCurrentView('ASSET_DETAIL');
    setIsGalleryOpen(false);
  };

  const handleProfileUpdate = (field: string, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Instead of saving directly, open the cropper
        setCropImage(reader.result as string);
        setCropZoom(1);
        setCropOffset({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- CROPPER LOGIC START ---
  const handleCropMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - cropOffset.x, y: clientY - cropOffset.y });
  };

  const handleCropMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setCropOffset({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y
    });
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  const handleCropSave = () => {
    if (!imageRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        // Fill background (optional)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate transformations to match what the user sees
        // Center the context
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // Apply Pan
        ctx.translate(cropOffset.x, cropOffset.y);
        // Apply Zoom
        ctx.scale(cropZoom, cropZoom);
        // Draw image centered
        ctx.drawImage(
            imageRef.current,
            -imageRef.current.naturalWidth / 2,
            -imageRef.current.naturalHeight / 2
        );

        const resultBase64 = canvas.toDataURL('image/jpeg', 0.9);
        handleProfileUpdate('avatarUrl', resultBase64);
        setCropImage(null); // Close modal
        showNotification('Foto atualizada!');
    }
  };
  // --- CROPPER LOGIC END ---

  const handleSaveProfile = () => {
    // Automatically update handle to the registered email
    const updatedProfile = {
        ...userProfile,
        handle: userProfile.email
    };

    setUserProfile(updatedProfile);
    localStorage.setItem('aurea_profile', JSON.stringify(updatedProfile));

    showNotification('Cadastro Atualizado');
    setTimeout(() => {
      setCurrentView('HOME');
    }, 1500);
  };

  // ADMIN AUTH LOGIC
  const handlePinInput = (digit: string) => {
    if (inputPin.length < 4) {
      const nextPin = inputPin + digit;
      setInputPin(nextPin);
      
      if (nextPin.length === 4) {
        // Validate PIN
        setTimeout(() => {
          if (nextPin === '5023') {
            showNotification('Acesso Autorizado');
            setCurrentView('ADMIN');
            setInputPin('');
          } else {
            showNotification('Senha Incorreta');
            setInputPin('');
          }
        }, 300);
      }
    }
  };

  const handlePinDelete = () => {
    setInputPin(prev => prev.slice(0, -1));
  };

  const resetForm = () => {
    setEditingAssetId(null);
    setNewAsset({
        title: '',
        artist: '',
        year: new Date().getFullYear().toString(),
        totalValue: 0,
        fractionPrice: 0,
        imageUrl: '',
        gallery: [],
        description: '',
        insuranceStatus: InsuranceStatus.SECURED,
        isCatalogOnly: false,
        availableFractions: 10000,
        totalFractions: 10000,
        insuranceCompany: 'Aurea Safe Guard',
        policyNumber: `POL-${Math.floor(Math.random() * 10000)}`,
        insuranceExpiry: '2025-12-31',
        technicalReportUrl: '#'
    });
    setTempGalleryItem({ title: '', year: new Date().getFullYear().toString(), imageUrl: '' });
  };

  const loadAssetForEdit = (asset: ArtAsset) => {
    setEditingAssetId(asset.id);
    setNewAsset({ ...asset });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAsset = async () => {
    if (!editingAssetId) return;
    if (window.confirm('Tem certeza que deseja excluir este ativo? Esta ação é irreversível.')) {
        setIsLoading(true);
        const { error } = await supabase.from('assets').delete().eq('id', editingAssetId);
        
        setIsLoading(false);
        if (error) {
            console.error('Error deleting:', error);
            showNotification('Erro ao excluir no banco de dados');
            return;
        }

        setAssets(prev => prev.filter(a => a.id !== editingAssetId));
        showNotification('Ativo removido do sistema.');
        resetForm();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAsset(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempGalleryItem(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddGalleryItem = () => {
    if (!tempGalleryItem.imageUrl || !tempGalleryItem.title) {
        showNotification('Imagem e Título são obrigatórios para a galeria');
        return;
    }
    const newItem: GalleryItem = {
        id: `g-${Date.now()}`,
        title: tempGalleryItem.title,
        year: tempGalleryItem.year || new Date().getFullYear().toString(),
        imageUrl: tempGalleryItem.imageUrl
    };
    
    setNewAsset(prev => ({
        ...prev,
        gallery: [...(prev.gallery || []), newItem]
    }));
    
    setTempGalleryItem({ title: '', year: new Date().getFullYear().toString(), imageUrl: '' });
    showNotification('Adicionado à galeria');
  };

  const handleRemoveGalleryItem = (idToRemove: string) => {
     setNewAsset(prev => ({
        ...prev,
        gallery: prev.gallery?.filter(item => item.id !== idToRemove)
     }));
  };

  const handleSaveAsset = async () => {
    if (!newAsset.title || !newAsset.artist || !newAsset.imageUrl) {
        showNotification('Preencha os campos obrigatórios (Capa, Título, Artista)');
        return;
    }

    setIsLoading(true);

    const assetId = editingAssetId || `asset-${Date.now()}`;
    
    // Construct DB payload (snake_case)
    const dbPayload = {
        id: assetId,
        title: newAsset.title,
        artist: newAsset.artist,
        year: newAsset.year,
        total_value: Number(newAsset.totalValue),
        fraction_price: Number(newAsset.fractionPrice),
        total_fractions: newAsset.totalFractions,
        available_fractions: newAsset.availableFractions,
        image_url: newAsset.imageUrl, // Storing base64 for now
        gallery: newAsset.gallery,    // Stored as JSONB
        insurance_status: newAsset.insuranceStatus,
        insurance_company: newAsset.insuranceCompany,
        policy_number: newAsset.policyNumber,
        insurance_expiry: newAsset.insuranceExpiry,
        technical_report_url: newAsset.technicalReportUrl,
        description: newAsset.description,
        is_catalog_only: newAsset.isCatalogOnly
    };

    const { error } = await supabase
        .from('assets')
        .upsert(dbPayload);

    setIsLoading(false);

    if (error) {
        console.error('Error saving:', error);
        showNotification('Erro ao salvar no Supabase');
        return;
    }

    // Update local state to reflect changes immediately
    const assetToSave: ArtAsset = {
        id: assetId,
        title: newAsset.title!,
        artist: newAsset.artist!,
        year: newAsset.year || '2024',
        totalValue: Number(newAsset.totalValue) || 0,
        fractionPrice: Number(newAsset.fractionPrice) || 0,
        totalFractions: newAsset.totalFractions || 10000,
        availableFractions: newAsset.availableFractions || 10000,
        imageUrl: newAsset.imageUrl!,
        gallery: newAsset.gallery || [],
        insuranceStatus: newAsset.insuranceStatus || InsuranceStatus.SECURED,
        insuranceCompany: newAsset.insuranceCompany || 'N/A',
        policyNumber: newAsset.policyNumber || 'N/A',
        insuranceExpiry: newAsset.insuranceExpiry || new Date().toISOString(),
        technicalReportUrl: '#',
        description: newAsset.description || 'Nova adição ao acervo.',
        isCatalogOnly: newAsset.isCatalogOnly
    };

    if (editingAssetId) {
        setAssets(prev => prev.map(asset => asset.id === editingAssetId ? assetToSave : asset));
        showNotification('Dados atualizados com sucesso!');
    } else {
        setAssets(prev => [assetToSave, ...prev]);
        showNotification('Ativo inserido com sucesso!');
    }
    
    resetForm();
  };

  const renderCropperModal = () => {
    if (!cropImage) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in duration-300">
            <div className="p-6 flex justify-between items-center bg-slate-900 border-b border-slate-800">
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Ajustar Foto</h3>
                <button 
                    onClick={() => setCropImage(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    <i className="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/50 overflow-hidden relative touch-none">
                <p className="absolute top-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest z-10 pointer-events-none">
                    Arraste e Amplie para ajustar
                </p>
                
                {/* Viewport/Mask */}
                <div 
                    className="relative overflow-hidden rounded-full border-4 border-amber-500 shadow-[0_0_100px_rgba(0,0,0,0.8)] cursor-move"
                    style={{ width: CROP_SIZE, height: CROP_SIZE }}
                    onMouseDown={handleCropMouseDown}
                    onMouseMove={handleCropMouseMove}
                    onMouseUp={handleCropMouseUp}
                    onMouseLeave={handleCropMouseUp}
                    onTouchStart={handleCropMouseDown}
                    onTouchMove={handleCropMouseMove}
                    onTouchEnd={handleCropMouseUp}
                >
                    {/* The Image */}
                    <img 
                        ref={imageRef}
                        src={cropImage} 
                        alt="Crop target"
                        draggable={false}
                        style={{
                            transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                            transformOrigin: 'center',
                            maxWidth: 'none', // Allow image to be huge
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            // Initial centering trick: translate -50% -50% plus our dynamic offset
                            marginLeft: imageRef.current ? -imageRef.current.naturalWidth / 2 : 0,
                            marginTop: imageRef.current ? -imageRef.current.naturalHeight / 2 : 0,
                        }}
                        // On load, force a re-render or initial centering if needed
                        onLoad={(e) => {
                            const img = e.currentTarget;
                            // Centering logic handled by CSS margin/position combo
                        }}
                    />
                </div>
            </div>

            <div className="p-8 bg-slate-900 border-t border-slate-800 space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <span>Zoom</span>
                        <span>{(cropZoom * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="3" 
                        step="0.05"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                        className="w-full accent-amber-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <button 
                    onClick={handleCropSave}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                    Confirmar Foto
                </button>
            </div>
        </div>
    );
  };

  const renderHome = () => (
    <div className="p-6 pb-32 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-7xl font-black bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent uppercase tracking-tighter leading-none mb-2">
            OASIS
          </h1>
          <p className="text-slate-400 text-lg font-bold tracking-[0.35em] uppercase pl-1">Fundo de Arte</p>
        </div>
        <div 
          onClick={() => setCurrentView('PROFILE')}
          className="flex flex-col items-center gap-2 group cursor-pointer active:scale-95 transition-transform"
        >
          <div className="h-24 w-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-800 shadow-2xl transition-all group-hover:border-amber-500 overflow-hidden relative">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="Profile" />
            ) : (
              <i className="fa-solid fa-user text-4xl text-amber-400 group-hover:text-amber-300"></i>
            )}
            {/* Edit overlay icon */}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <i className="fa-solid fa-pen text-white drop-shadow-md"></i>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 max-w-[120px] truncate text-center leading-tight bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800/50 group-hover:text-amber-500 group-hover:border-amber-500/50 transition-colors">
             {!userProfile.name || userProfile.name === 'INVESTIDOR OASIS' 
                ? 'PERFIL' 
                : (() => {
                    const names = userProfile.name.split(' ').filter(Boolean);
                    return names.length > 1 ? `${names[0]} ${names[names.length - 1]}` : userProfile.name;
                  })()
             }
          </span>
        </div>
      </header>

      {/* Dashboard de Custódia */}
      <section className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-2xl relative overflow-hidden group min-h-[170px]">
        {/* LOGO DO AVIÃO OASIS - MARCA D'ÁGUA ROBUSTA (SVG/ÍCONE) */}
        <div className="absolute -top-6 -right-8 opacity-10 group-hover:opacity-30 transition-all duration-1000 pointer-events-none select-none transform rotate-12 flex flex-col items-center z-0">
            <i className="fa-solid fa-plane-up text-[10rem] text-white drop-shadow-2xl"></i>
            <span className="text-4xl font-black text-white uppercase tracking-[0.5em] mt-[-20px] opacity-50">OASIS</span>
        </div>

        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 relative z-10">Resumo Patrimonial</p>
        <div className="flex items-baseline gap-2 relative z-10">
          <h2 className="text-4xl font-black text-white tracking-tighter">R$ {totalPortfolioValue.toLocaleString('pt-BR')}</h2>
          <span className="text-emerald-400 font-bold text-sm bg-emerald-400/10 px-2 py-0.5 rounded-full">+2.4%</span>
        </div>
        <div className="mt-8 flex gap-3 relative z-10">
          <button className="flex-1 bg-amber-500 text-slate-900 font-black py-3.5 rounded-xl active:scale-95 transition-all shadow-lg shadow-amber-500/20 text-xs uppercase tracking-widest">
            Depositar
          </button>
          <button className="flex-1 bg-slate-700 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-all border border-slate-600 text-xs uppercase tracking-widest">
            Sacar
          </button>
        </div>
      </section>

      {/* Seção Minha Coleção */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1 gap-2">
          <h3 className="text-xl font-black text-white uppercase tracking-[0.15em] whitespace-nowrap">COLEÇÕES DO SITE</h3>
          <a 
            href="https://fundodearte.com/artistas-acervo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-sm font-black uppercase tracking-widest px-5 py-2.5 rounded-full shadow-lg shadow-amber-500/20 hover:scale-105 transition-all active:scale-95 shrink-0"
          >
            <i className="fa-solid fa-gem text-xl"></i>
            ACERVO
          </a>
        </div>

        <div 
          onClick={() => setCurrentView('CATALOG')}
          className="group relative w-full h-60 bg-slate-900 border border-amber-500/40 rounded-[2.5rem] overflow-hidden cursor-pointer active:scale-[0.98] transition-all shadow-2xl ring-1 ring-white/5"
        >
          <div className="absolute inset-0">
            <img 
              src="https://picsum.photos/seed/institutional/1000/800" 
              className="w-full h-full object-cover opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-1000"
              alt="Galeria fundodearte.com"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
          </div>

          <div className="absolute inset-0 p-8 flex flex-col justify-end">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-14 w-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/40 group-hover:rotate-12 transition-transform">
                <i className="fa-solid fa-building-columns text-slate-950 text-2xl"></i>
              </div>
              <div className="space-y-1">
                <h4 className="text-white font-black uppercase text-2xl leading-none tracking-tighter">Galeria de Arquivos</h4>
                <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.35em]">fundodearte.com/artistas-acervo</p>
              </div>
            </div>
            <p className="text-slate-300 text-[11px] font-medium max-w-[260px] leading-tight opacity-90 group-hover:opacity-100 transition-opacity">
              Acesso exclusivo à curadoria de originação premium e ativos históricos sob gestão do Fundo de Arte.
            </p>
            <div className="absolute top-8 right-8 h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-2xl">
              <i className="fa-solid fa-arrow-right text-lg"></i>
            </div>
          </div>
        </div>

        {/* Artistas em Destaque */}
        <div className="space-y-3 pt-2">
           <div className="flex justify-between items-center px-1">
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Artistas em Destaque</span>
              <button onClick={() => setCurrentView('MARKETPLACE')} className="text-amber-500 text-[9px] font-bold uppercase tracking-widest">Ver Todos</button>
           </div>
           {isLoading ? (
             <div className="flex justify-center p-4">
                <i className="fa-solid fa-circle-notch fa-spin text-amber-500"></i>
             </div>
           ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                {assets.map(asset => (
                    <div 
                    key={asset.id} 
                    onClick={() => navigateToAsset(asset)}
                    className="min-w-[120px] bg-slate-900 border border-slate-800 rounded-2xl p-2 cursor-pointer active:scale-95 transition-all hover:border-amber-500/30 group"
                    >
                        <div className="h-20 w-full rounded-xl overflow-hidden mb-2 relative">
                            <img src={asset.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        </div>
                        <div className="px-1">
                            <p className="text-amber-500 text-[8px] font-bold uppercase truncate">{asset.artist}</p>
                            <h4 className="text-white text-[9px] font-black uppercase truncate leading-tight">{asset.title}</h4>
                        </div>
                    </div>
                ))}
            </div>
           )}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3 px-1 mb-2">
            <div className="h-[1px] flex-1 bg-slate-800"></div>
            <span className="text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">Ativos Sob Custódia</span>
            <div className="h-[1px] flex-1 bg-slate-800"></div>
          </div>
          {userHoldings.map(holding => {
            const asset = assets.find(a => a.id === holding.assetId);
            if (!asset) return null;
            return (
              <div 
                key={holding.assetId}
                onClick={() => navigateToAsset(asset)}
                className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 flex items-center gap-5 cursor-pointer hover:border-amber-500/30 transition-all group active:scale-[0.99] shadow-xl"
              >
                <div className="h-16 w-16 rounded-xl overflow-hidden shrink-0 border border-slate-700/50 shadow-inner">
                   <img src={asset.imageUrl} className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-700" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-black text-xs truncate uppercase tracking-tight">{asset.title}</h4>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-tighter mt-1">{holding.fractionsOwned} Frações Validadas</p>
                </div>
                <div className="text-right shrink-0">
                  <InsuranceBadge status={asset.insuranceStatus} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderMarketplace = () => {
    const marketplaceAssets = assets.filter(a => !a.isCatalogOnly);
    const filtered = marketplaceAssets.filter(a =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-8">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Explorar</h2>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Oportunidades Secundárias</p>
        </header>

        <div className="relative mb-8">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
          <input
            type="text"
            placeholder="Buscar por obra ou artista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm font-bold placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {isLoading ? (
             <div className="flex justify-center p-8">
                 <i className="fa-solid fa-circle-notch fa-spin text-2xl text-amber-500"></i>
             </div>
          ) : (
            filtered.map(asset => (
                <AssetCard key={asset.id} asset={asset} onClick={() => navigateToAsset(asset)} />
            ))
          )}
        </div>
      </div>
    );
  };

  const renderTrading = () => (
    <div className="p-6 pb-32 flex flex-col items-center justify-center min-h-[80vh] text-center animate-in zoom-in duration-300">
       <div className="h-24 w-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-amber-500/10">
          <i className="fa-solid fa-shuffle text-4xl text-amber-500"></i>
       </div>
       <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Swap Market</h2>
       <p className="text-slate-500 text-xs font-medium max-w-[250px] leading-relaxed">Troque frações entre colecionadores com liquidez imediata via <span className="text-amber-500 font-bold">AMM Pools</span>.</p>

       <div className="mt-12 w-full bg-slate-900 border border-slate-800 p-6 rounded-3xl relative">
          <div className="space-y-4">
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-left mb-1">Vender</p>
                   <div className="flex items-center gap-2">
                      <span className="text-white font-black text-lg">0.00</span>
                      <span className="text-slate-600 font-bold text-xs">BRL</span>
                   </div>
                </div>
                <button className="h-8 px-3 bg-slate-800 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">Selecionar</button>
             </div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 bg-slate-800 border-4 border-slate-900 rounded-full flex items-center justify-center text-amber-500 z-10 shadow-xl">
                <i className="fa-solid fa-arrow-down"></i>
             </div>
             <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-left mb-1">Comprar (Est.)</p>
                   <div className="flex items-center gap-2">
                      <span className="text-white font-black text-lg">0.00</span>
                      <span className="text-slate-600 font-bold text-xs">FRA</span>
                   </div>
                </div>
                <button className="h-8 px-3 bg-amber-500 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wider">Selecionar</button>
             </div>
          </div>
          <button disabled className="w-full mt-6 bg-slate-800 text-slate-600 font-black py-4 rounded-xl text-xs uppercase tracking-[0.2em] cursor-not-allowed">
             Saldo Insuficiente
          </button>
       </div>
    </div>
  );

  const renderWallet = () => (
    <div className="p-6 pb-32 animate-in slide-in-from-right duration-300">
      <header className="mb-8">
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Carteira</h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Gestão de Ativos</p>
      </header>

      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700 shadow-2xl mb-8 relative overflow-hidden">
         <div className="absolute -top-10 -right-10 h-32 w-32 bg-amber-500/20 blur-3xl rounded-full"></div>
         <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Saldo Disponível</p>
         <h3 className="text-4xl font-black text-white tracking-tighter mb-6">R$ {userBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
         <div className="flex gap-3">
            <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">Depositar</button>
            <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors backdrop-blur-md">Sacar</button>
         </div>
      </div>

      <h3 className="text-white text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
         <i className="fa-solid fa-layer-group text-amber-500"></i> Seus Ativos
      </h3>

      <div className="space-y-4">
         {userHoldings.map(holding => {
            const asset = assets.find(a => a.id === holding.assetId);
            if (!asset) return null;
            const currentVal = holding.fractionsOwned * asset.fractionPrice;
            const initialVal = holding.fractionsOwned * holding.averagePrice;
            const profit = ((currentVal - initialVal) / initialVal) * 100;

            return (
               <div key={holding.assetId} onClick={() => navigateToAsset(asset)} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:border-amber-500/30 transition-all">
                  <img src={asset.imageUrl} className="h-14 w-14 rounded-lg object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                     <h4 className="text-white font-bold text-sm truncate uppercase tracking-tight">{asset.title}</h4>
                     <p className="text-slate-500 text-[10px] font-bold uppercase mt-1">{holding.fractionsOwned} Frações</p>
                  </div>
                  <div className="text-right">
                     <p className="text-white font-black text-sm">R$ {currentVal.toLocaleString('pt-BR')}</p>
                     <p className={`text-[10px] font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}{profit.toFixed(2)}%
                     </p>
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );

  const renderCatalog = () => {
    const catalogAssets = assets.filter(a => a.isCatalogOnly);

    return (
      <div className="p-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <header className="mb-8 flex items-center gap-4">
          <button
             onClick={() => setCurrentView('HOME')}
             className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
             <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Acervo</h2>
            <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em]">Galeria Institucional</p>
          </div>
        </header>

        <div className="space-y-6">
           {isLoading ? (
                <div className="flex justify-center p-8">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-amber-500"></i>
                </div>
           ) : (
             catalogAssets.map(asset => (
                <div
                key={asset.id}
                onClick={() => navigateToAsset(asset)}
                className="relative h-64 w-full rounded-[2rem] overflow-hidden group cursor-pointer shadow-2xl border border-slate-800"
                >
                    <img src={asset.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale group-hover:grayscale-0" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                    <p className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-1">{asset.artist}</p>
                    <h3 className="text-white text-xl font-black uppercase tracking-tight">{asset.title}</h3>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded text-[9px] font-bold text-white uppercase tracking-wider">{asset.year}</span>
                    </div>
                    </div>
                </div>
             ))
           )}
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div className="p-6 pb-32 animate-in slide-in-from-bottom duration-500">
       <header className="flex items-center gap-4 mb-8">
          <button 
             onClick={() => setCurrentView('HOME')}
             className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
             <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Perfil</h2>
       </header>

       <div className="flex flex-col items-center mb-8">
          <div className="relative group cursor-pointer">
             <input 
                type="file" 
                id="profile-upload" 
                className="hidden" 
                accept="image/*"
                onChange={handleProfileImageUpload}
             />
             <label htmlFor="profile-upload" className="block relative cursor-pointer active:scale-95 transition-transform">
                 <div className="h-28 w-28 rounded-full border-4 border-slate-800 overflow-hidden shadow-2xl">
                    {userProfile.avatarUrl ? (
                       <img src={userProfile.avatarUrl} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                       <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <i className="fa-solid fa-user text-4xl text-slate-600"></i>
                       </div>
                    )}
                 </div>
                 <div className="absolute bottom-0 right-0 h-8 w-8 bg-amber-500 rounded-full flex items-center justify-center border-4 border-slate-950 text-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                    <i className="fa-solid fa-camera text-xs"></i>
                 </div>
             </label>
          </div>
          <h3 className="mt-4 text-xl font-black text-white tracking-tight">{userProfile.name || 'INVESTIDOR OASIS'}</h3>
          <p className="text-amber-500 text-xs font-bold uppercase tracking-widest">{userProfile.handle}</p>
       </div>

       <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nome Completo</label>
             <input 
                type="text" 
                value={userProfile.name}
                placeholder="INVESTIDOR OASIS"
                onChange={(e) => handleProfileUpdate('name', e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
             <input 
                type="email" 
                value={userProfile.email}
                placeholder="investidor@oasis.com.br"
                onChange={(e) => handleProfileUpdate('email', e.target.value.toLowerCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Bio</label>
             <textarea 
                rows={3}
                value={userProfile.bio}
                placeholder="Colecionador de arte digital e entusiasta do movimento neoconcreto brasileiro."
                onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors resize-none"
             />
          </div>
          <button 
             onClick={handleSaveProfile}
             className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
          >
             Salvar Alterações
          </button>
       </div>

       <div className="mt-8 space-y-4">
          <button 
             onClick={() => setCurrentView('ADMIN_LOGIN')}
             className="w-full bg-slate-900 border border-slate-800 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-bold py-4 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          >
             <i className="fa-solid fa-shield-cat"></i>
             Acesso Administrativo
          </button>
       </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="p-6 pb-32 space-y-6 animate-in slide-in-from-bottom duration-500 bg-slate-950 min-h-screen">
       <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentView('PROFILE')}
            className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform hover:bg-slate-700 border border-slate-700 group"
          >
            <i className="fa-solid fa-lock text-lg group-hover:text-red-400 transition-colors"></i>
          </button>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Gestão de Ativos</h2>
            <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em]">Admin Access</p>
          </div>
        </div>
      </header>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3 px-1">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Selecione para Editar</p>
            <p className="text-slate-600 text-[9px] font-bold">{assets.length} Ativos</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4 px-1 scrollbar-hide">
            <button 
                onClick={resetForm} 
                className={`min-w-[80px] h-20 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center gap-2 transition-all ${!editingAssetId ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-slate-900 text-slate-500 hover:text-white hover:border-slate-500'}`}
            >
                <i className="fa-solid fa-plus text-lg"></i>
                <span className="text-[9px] font-black uppercase">Novo</span>
            </button>
            {assets.map(a => (
            <div 
                key={a.id} 
                onClick={() => loadAssetForEdit(a)} 
                className={`relative min-w-[80px] w-20 h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 group ${editingAssetId === a.id ? 'border-amber-500 scale-105 shadow-xl shadow-amber-500/20' : 'border-slate-800 hover:border-slate-600'}`}
            >
                <img src={a.imageUrl} className="w-full h-full object-cover" alt="" />
                {editingAssetId === a.id && (
                    <div className="absolute inset-0 bg-amber-500/20 backdrop-blur-[1px] flex items-center justify-center">
                        <i className="fa-solid fa-pen text-white drop-shadow-md"></i>
                    </div>
                )}
            </div>
            ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl relative">
         {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-3xl">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500"></i>
            </div>
         )}
         {editingAssetId && (
            <div className="absolute top-4 right-4">
                <button onClick={handleDeleteAsset} className="h-8 w-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center">
                    <i className="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
         )}

         <div className="flex items-center gap-2 mb-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-slate-900 shadow-lg transition-colors ${editingAssetId ? 'bg-amber-500' : 'bg-slate-700 text-white'}`}>
                <i className={`fa-solid ${editingAssetId ? 'fa-pen-to-square' : 'fa-plus'} font-bold`}></i>
            </div>
            <h3 className="text-white font-black text-sm uppercase tracking-widest">
                {editingAssetId ? 'Editar Ativo' : 'Inserir Novo Ativo'}
            </h3>
         </div>

         <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button 
                    onClick={() => setNewAsset(prev => ({ ...prev, isCatalogOnly: false }))}
                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!newAsset.isCatalogOnly ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                >
                    Marketplace
                </button>
                <button 
                    onClick={() => setNewAsset(prev => ({ ...prev, isCatalogOnly: true }))}
                    className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${newAsset.isCatalogOnly ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                >
                    Galeria (Catalog)
                </button>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Título da Obra (Principal)</label>
                <input 
                    type="text" 
                    placeholder="Ex: Bicho, Metaesquema..."
                    value={newAsset.title}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                />
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Artista</label>
                <input 
                    type="text" 
                    placeholder="Nome do Artista"
                    value={newAsset.artist}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, artist: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Ano</label>
                    <input 
                        type="text" 
                        value={newAsset.year}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, year: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Valor Total (R$)</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={newAsset.totalValue}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, totalValue: parseFloat(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Imagem Principal (Capa)</label>
                <div className="w-full">
                    <input 
                        type="file" 
                        id="asset-image-upload"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                    
                    {!newAsset.imageUrl ? (
                        <label 
                            htmlFor="asset-image-upload"
                            className="w-full h-32 bg-slate-950 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-amber-500/50 hover:bg-slate-900 transition-all group"
                        >
                            <div className="h-10 w-10 bg-slate-900 rounded-full flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
                                <i className="fa-solid fa-cloud-arrow-up text-slate-500 group-hover:text-slate-900"></i>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-amber-500">
                                Carregar Capa
                            </span>
                        </label>
                    ) : (
                        <div className="relative h-48 w-full rounded-xl overflow-hidden border border-slate-800 group">
                            <img src={newAsset.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                <label 
                                    htmlFor="asset-image-upload"
                                    className="h-10 w-10 bg-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-xl"
                                    title="Trocar Imagem"
                                >
                                    <i className="fa-solid fa-pen text-slate-900"></i>
                                </label>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setNewAsset(prev => ({ ...prev, imageUrl: '' }));
                                    }}
                                    className="h-10 w-10 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-xl text-white"
                                    title="Remover"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-images text-amber-500"></i> Galeria de Obras Adicionais
                </h4>

                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Adicionar nova imagem</p>
                    <div className="flex gap-3">
                         <div className="flex-1 space-y-2">
                             <input 
                                type="text"
                                placeholder="Título da Obra"
                                value={tempGalleryItem.title}
                                onChange={(e) => setTempGalleryItem(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:border-amber-500 outline-none"
                             />
                             <input 
                                type="text"
                                placeholder="Ano"
                                value={tempGalleryItem.year}
                                onChange={(e) => setTempGalleryItem(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-white focus:border-amber-500 outline-none"
                             />
                         </div>
                         <div className="w-24 h-24 shrink-0 relative">
                             <input 
                                type="file"
                                id="gallery-upload"
                                accept="image/*"
                                onChange={handleGalleryImageUpload}
                                className="hidden"
                             />
                             {!tempGalleryItem.imageUrl ? (
                                 <label htmlFor="gallery-upload" className="w-full h-full bg-slate-900 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800">
                                     <i className="fa-solid fa-plus text-slate-500"></i>
                                 </label>
                             ) : (
                                 <div className="w-full h-full relative group rounded-lg overflow-hidden">
                                     <img src={tempGalleryItem.imageUrl} className="w-full h-full object-cover" alt="preview" />
                                     <button 
                                        onClick={() => setTempGalleryItem(prev => ({...prev, imageUrl: ''}))}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 h-5 w-5 flex items-center justify-center text-[8px]"
                                     >
                                         <i className="fa-solid fa-xmark"></i>
                                     </button>
                                 </div>
                             )}
                         </div>
                    </div>
                    <button 
                        onClick={handleAddGalleryItem}
                        className="w-full bg-slate-800 text-slate-300 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 border border-slate-700"
                    >
                        Adicionar à Galeria
                    </button>
                </div>

                {newAsset.gallery && newAsset.gallery.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {newAsset.gallery.map((item, idx) => (
                            <div key={item.id || idx} className="relative w-20 h-28 shrink-0 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden group">
                                <img src={item.imageUrl} className="w-full h-20 object-cover" alt={item.title} />
                                <div className="p-1">
                                    <p className="text-[8px] text-white truncate font-bold">{item.title}</p>
                                    <p className="text-slate-500 text-[7px]">{item.year}</p>
                                </div>
                                <button 
                                    onClick={() => handleRemoveGalleryItem(item.id)}
                                    className="absolute top-1 right-1 bg-red-500/80 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <i className="fa-solid fa-trash text-[8px]"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-images text-amber-500"></i> Galeria de Obras Adicionais
                </h4>
                
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status do Seguro</label>
                    <select 
                        value={newAsset.insuranceStatus}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, insuranceStatus: e.target.value as InsuranceStatus }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors appearance-none"
                    >
                        <option value={InsuranceStatus.SECURED}>SEGURADO (SECURED)</option>
                        <option value={InsuranceStatus.WARNING}>PENDENTE (WARNING)</option>
                        <option value={InsuranceStatus.EXPIRED}>EXPIRADO (EXPIRED)</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Seguradora</label>
                        <input 
                            type="text" 
                            value={newAsset.insuranceCompany}
                            onChange={(e) => setNewAsset(prev => ({ ...prev, insuranceCompany: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Nº Apólice</label>
                        <input 
                            type="text" 
                            value={newAsset.policyNumber}
                            onChange={(e) => setNewAsset(prev => ({ ...prev, policyNumber: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Validade (Data)</label>
                    <input 
                        type="date" 
                        value={newAsset.insuranceExpiry?.split('T')[0]}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, insuranceExpiry: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                    />
                </div>
            </div>

            {!newAsset.isCatalogOnly && (
                <div className="space-y-1 pt-2 border-t border-slate-800">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Preço da Fração (R$)</label>
                    <input 
                        type="number" 
                        placeholder="0.00"
                        value={newAsset.fractionPrice}
                        onChange={(e) => setNewAsset(prev => ({ ...prev, fractionPrice: parseFloat(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                    />
                </div>
            )}

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Descrição</label>
                <textarea 
                    rows={3}
                    placeholder="Detalhes históricos e técnicos..."
                    value={newAsset.description}
                    onChange={(e) => setNewAsset(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors resize-none"
                />
            </div>

            <div className="flex gap-3 mt-4">
                {editingAssetId && (
                    <button 
                        onClick={resetForm}
                        className="flex-1 bg-slate-800 text-slate-400 font-bold py-4 rounded-xl border border-slate-700 active:scale-95 transition-all text-xs uppercase tracking-widest hover:bg-slate-700 hover:text-white"
                    >
                        Cancelar
                    </button>
                )}
                <button 
                    onClick={handleSaveAsset}
                    disabled={isLoading}
                    className={`flex-[2] font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-[0.2em] ${editingAssetId ? 'bg-amber-500 text-slate-900 shadow-amber-500/20 hover:bg-amber-400' : 'bg-emerald-600 text-white shadow-emerald-900/20 hover:bg-emerald-500'} ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (editingAssetId ? 'Salvar Alterações' : 'Confirmar Inserção')}
                </button>
            </div>
         </div>
      </div>
      <div className="text-center opacity-40">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Registros imutáveis via Smart Contract
          </p>
      </div>
    </div>
  );

  const renderAssetDetail = () => {
    if (!selectedAsset) return null;
    return (
      <div className="pb-32 animate-in slide-in-from-right duration-300">
        <div className="relative h-96 group cursor-pointer" onClick={() => setIsGalleryOpen(true)}>
          <img src={selectedAsset.imageUrl} className="w-full h-full object-cover" alt="" />
          <button 
            onClick={(e) => {
                e.stopPropagation();
                setCurrentView('HOME');
            }}
            className="absolute top-12 left-6 h-10 w-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white z-20"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
              <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 text-white text-xs font-black uppercase tracking-widest flex items-center gap-3 transform translate-y-4 group-hover:translate-y-0 transition-all">
                  <i className="fa-solid fa-images"></i>
                  Ver Galeria Completa
              </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
        </div>

        {isGalleryOpen && (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in zoom-in duration-300">
                <div className="flex justify-between items-center p-6 bg-slate-900/50 backdrop-blur-md">
                    <h2 className="text-white text-sm font-black uppercase tracking-widest">Galeria do Artista</h2>
                    <button 
                        onClick={() => setIsGalleryOpen(false)}
                        className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-12">
                    <div className="space-y-4">
                        <img src={selectedAsset.imageUrl} className="w-full rounded-2xl shadow-2xl" alt="Capa" />
                        <div>
                            <h3 className="text-white font-black text-2xl uppercase tracking-tighter">{selectedAsset.title}</h3>
                            <p className="text-amber-500 font-bold uppercase tracking-widest text-xs">{selectedAsset.year}</p>
                        </div>
                    </div>
                    {selectedAsset.gallery && selectedAsset.gallery.map(item => (
                        <div key={item.id} className="space-y-4">
                            <img src={item.imageUrl} className="w-full rounded-2xl shadow-2xl border border-slate-800" alt={item.title} />
                            <div>
                                <h3 className="text-slate-200 font-bold text-xl uppercase tracking-tight">{item.title}</h3>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{item.year}</p>
                            </div>
                        </div>
                    ))}
                    {(!selectedAsset.gallery || selectedAsset.gallery.length === 0) && (
                        <div className="text-center py-10 opacity-50">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Fim da Galeria</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        <div className="px-6 -mt-8 relative z-10 space-y-6">
          <div>
            <div className="flex justify-between items-start mb-2">
              <span className="bg-amber-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-tighter italic shadow-lg">Blue Chip</span>
              <InsuranceBadge status={selectedAsset.insuranceStatus} showText />
            </div>
            <h1 className="text-3xl font-black text-white leading-tight uppercase tracking-tighter">{selectedAsset.title}</h1>
            <p className="text-amber-400 font-bold text-lg uppercase tracking-tight">{selectedAsset.artist}, {selectedAsset.year}</p>
            {selectedAsset.gallery && selectedAsset.gallery.length > 0 && (
                 <button onClick={() => setIsGalleryOpen(true)} className="mt-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                     <div className="flex -space-x-3">
                        {selectedAsset.gallery.slice(0,3).map(g => (
                            <div key={g.id} className="h-8 w-8 rounded-full border-2 border-slate-950 overflow-hidden">
                                <img src={g.imageUrl} className="w-full h-full object-cover" alt="" />
                            </div>
                        ))}
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest ml-2">+ {selectedAsset.gallery.length} Obras na Galeria</span>
                 </button>
            )}
          </div>

          <section className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl backdrop-blur-sm">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-file-contract text-amber-500"></i>
              Smart Recibo (Ficha Técnica)
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Seguradora</p>
                <p className="text-slate-200 font-bold text-xs uppercase tracking-tight">{selectedAsset.insuranceCompany}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Apólice Nº</p>
                <p className="text-slate-200 font-bold text-xs uppercase tracking-tight">{selectedAsset.policyNumber}</p>
              </div>
            </div>
            <GuaranteeBar expiryDate={selectedAsset.insuranceExpiry} />
            <div className="pt-2">
              <button className="w-full flex justify-between items-center bg-slate-800 hover:bg-slate-700 p-4 rounded-xl transition-all shadow-lg active:scale-95">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Laudo de Autenticidade Digital</span>
                <i className="fa-solid fa-download text-amber-400 text-sm"></i>
              </button>
            </div>
          </section>

          <section className="space-y-3">
             <h4 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
               <i className="fa-solid fa-quote-left text-amber-500/40"></i>
               Sobre o Artista
             </h4>
             <p className="text-slate-400 text-sm leading-relaxed font-medium">{selectedAsset.description}</p>
          </section>

          <div className="fixed bottom-24 left-6 right-6 flex gap-3 z-50">
            <div className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-2xl shadow-2xl backdrop-blur-md bg-opacity-90">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Cotação Fração</p>
              <p className="text-lg font-black text-white tracking-tighter">R$ {selectedAsset.fractionPrice}</p>
            </div>
            <button className="flex-[2] bg-emerald-500 text-slate-950 font-black text-sm uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-400">
              ADQUIRIR FRAÇÃO
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminLogin = () => (
    <div className="p-6 h-screen flex flex-col items-center justify-center bg-slate-950 relative animate-in zoom-in duration-300">
        <button 
          onClick={() => {
            setCurrentView('PROFILE');
            setInputPin('');
          }}
          className="absolute top-6 left-6 h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center text-white shadow-xl active:scale-90 transition-transform"
        >
            <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div className="mb-10 text-center">
            <div className="h-20 w-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
                <i className="fa-solid fa-lock text-3xl text-amber-500"></i>
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Acesso Restrito</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Digite a senha de administrador</p>
        </div>

        <div className="flex gap-4 mb-12">
            {[0, 1, 2, 3].map((i) => (
                <div 
                    key={i} 
                    className={`h-4 w-4 rounded-full transition-all duration-300 ${i < inputPin.length ? 'bg-amber-500 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}
                ></div>
            ))}
        </div>

        <div className="grid grid-cols-3 gap-6 w-full max-w-[280px]">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button 
                    key={num}
                    onClick={() => handlePinInput(num.toString())}
                    className="h-20 w-20 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-black active:bg-amber-500 active:text-slate-900 active:border-amber-500 active:scale-90 transition-all shadow-lg flex items-center justify-center"
                >
                    {num}
                </button>
            ))}
            <div className="h-20 w-20"></div>
            <button 
                onClick={() => handlePinInput('0')}
                className="h-20 w-20 rounded-full bg-slate-900 border border-slate-800 text-white text-2xl font-black active:bg-amber-500 active:text-slate-900 active:border-amber-500 active:scale-90 transition-all shadow-lg flex items-center justify-center"
            >
                0
            </button>
            <button 
                onClick={handlePinDelete}
                className="h-20 w-20 rounded-full bg-transparent text-slate-500 text-xl flex items-center justify-center active:scale-90 transition-transform hover:text-red-500"
            >
                <i className="fa-solid fa-delete-left"></i>
            </button>
        </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 relative shadow-2xl overflow-x-hidden ring-1 ring-slate-800 antialiased selection:bg-amber-500/30">
      <main className="min-h-screen">
        {renderCropperModal()}
        {currentView === 'HOME' && renderHome()}
        {currentView === 'MARKETPLACE' && renderMarketplace()}
        {currentView === 'ASSET_DETAIL' && renderAssetDetail()}
        {currentView === 'TRADING' && renderTrading()}
        {currentView === 'WALLET' && renderWallet()}
        {currentView === 'CATALOG' && renderCatalog()}
        {currentView === 'PROFILE' && renderProfile()}
        {currentView === 'ADMIN_LOGIN' && renderAdminLogin()}
        {currentView === 'ADMIN' && renderAdmin()}
        {currentView === 'TOKENIZE' && (
           <div className="p-8 text-center space-y-10 py-24 animate-in zoom-in duration-500">
             <div className="w-24 h-24 bg-amber-500/10 rounded-[2rem] flex items-center justify-center mx-auto border border-amber-500/20 shadow-2xl shadow-amber-500/5 transform rotate-3">
                <i className="fa-solid fa-file-shield text-4xl text-amber-500"></i>
             </div>
             <div>
               <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Tokenizar Obra</h2>
               <p className="text-slate-500 text-xs font-medium px-4">Regra de Ouro: <span className="text-amber-500 font-black italic">"Só entra se tiver SEGURO"</span>.</p>
             </div>
             <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-12 rounded-[2.5rem] space-y-5 hover:border-amber-500/40 transition-all group cursor-pointer active:scale-95 shadow-xl">
                <i className="fa-solid fa-cloud-arrow-up text-5xl text-slate-700 group-hover:text-amber-500 transition-colors group-hover:bounce"></i>
                <div className="space-y-1">
                  <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Apólice de Seguro</p>
                  <p className="text-slate-600 text-[10px] font-medium leading-tight">Envie o PDF para validação biométrica</p>
                </div>
                <input type="file" className="hidden" id="policy-upload" />
                <label htmlFor="policy-upload" className="inline-block bg-slate-800 text-white px-8 py-3 rounded-xl text-[10px] font-black cursor-pointer uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl">
                  Selecionar
                </label>
             </div>
             <div className="p-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/50 text-left shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <i className="fa-solid fa-lock text-4xl"></i>
                </div>
                <p className="text-[9px] font-black text-amber-500 uppercase mb-2 tracking-[0.25em] flex items-center gap-2">
                  <i className="fa-solid fa-fingerprint text-xs"></i>
                  Certificação Atômica
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium leading-tight">O protocolo AUREA só habilita a custódia após confirmação real-time com as seguradoras parceiras via Oráculo.</p>
             </div>
             <button disabled className="w-full py-5 bg-slate-800 text-slate-600 font-black rounded-2xl cursor-not-allowed uppercase tracking-[0.25em] text-xs shadow-2xl">
                TOKENIZAR ATIVO
             </button>
           </div>
        )}
      </main>
      {currentView === 'HOME' && (
        <button 
          onClick={() => setCurrentView('TOKENIZE')}
          className="fixed top-6 right-20 z-50 h-10 px-5 bg-amber-500 text-slate-950 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-amber-500/30 active:scale-90 transition-all border border-amber-400/40 flex items-center gap-2"
        >
          <i className="fa-solid fa-plus text-[10px]"></i> Tokenizar
        </button>
      )}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto h-22 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-900 flex justify-around items-center px-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        {[
          { icon: 'fa-house', label: 'Home', view: 'HOME' },
          { icon: 'fa-compass', label: 'Explorar', view: 'MARKETPLACE' },
          { icon: 'fa-shuffle', label: 'Swap', view: 'TRADING' },
          { icon: 'fa-wallet', label: 'Ativos', view: 'WALLET' }
        ].map((item) => (
          <button
            key={item.view}
            onClick={() => {
              setCurrentView(item.view as ViewType);
              setSelectedAsset(null);
            }}
            className={`flex flex-col items-center justify-center gap-1.5 w-16 transition-all active:scale-75 ${
              currentView === item.view ? 'text-amber-500' : 'text-slate-600 hover:text-slate-400'
            }`}
          >
            <div className={`h-1 w-5 rounded-full mb-1 transition-all ${currentView === item.view ? 'bg-amber-500' : 'bg-transparent'}`}></div>
            <i className={`fa-solid ${item.icon} text-xl transition-transform ${currentView === item.view ? 'scale-110' : ''}`}></i>
            <span className="text-[8px] font-black uppercase tracking-[0.2em]">{item.label}</span>
          </button>
        ))}
      </nav>
      {showToast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in z-50">
            <i className="fa-solid fa-circle-check"></i>
            <span className="text-xs font-black uppercase tracking-widest">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;