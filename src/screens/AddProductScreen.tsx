import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Calendar, Camera, Package, Flame, PackageOpen, Snowflake, Truck, Eye, MapPin, ChevronRight, Layers, LayoutGrid, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { ActionType, Product } from '../types';
import { addDays, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import ProductLabel from '../components/ProductLabel';

const SUGGESTIONS = ['Poulet blanc', 'Escalope', 'Poulet rôti', 'Aiguillettes', 'Cuisse de poulet'];
const UNITS = ['kg', 'g', 'pce', 'L', 'broche', 'bacs'];

export default function AddProductScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { zones, storageUnits, shelves, bacs, addProduct, updateProduct, products, user } = useStore();

  const editMode = location.state?.editMode || false;
  const productId = location.state?.productId;
  const existingProduct = productId ? products.find(p => p.id === productId) : null;

  const [bacId, setBacId] = useState(location.state?.bacId || existingProduct?.bacId || bacs[0]?.id || '');
  const [isSelectingBac, setIsSelectingBac] = useState(false);
  const [selectionPath, setSelectionPath] = useState<{ zoneId?: string, unitId?: string, shelfId?: string }>({});
  
  const [name, setName] = useState(existingProduct?.name || '');
  const [quantity, setQuantity] = useState(existingProduct?.quantity.toString() || '');
  const [unit, setUnit] = useState(existingProduct?.unit || 'kg');
  const [dlc, setDlc] = useState<number>(existingProduct?.dlc || addDays(startOfDay(new Date()), 3).getTime());
  const [actionType, setActionType] = useState<ActionType>(existingProduct?.actionType || 'received');
  
  // Professional details
  const [batchNumber, setBatchNumber] = useState(existingProduct?.batchNumber || '');
  const [temperature, setTemperature] = useState(existingProduct?.temperature?.toString() || '');
  const [origin, setOrigin] = useState(existingProduct?.origin || '');
  const [showPreview, setShowPreview] = useState(false);

  const handleActionTypeChange = (type: ActionType) => {
    setActionType(type);
    // Smart DLC logic
    let days = 3;
    if (type === 'cooked') days = 3;
    if (type === 'opened') days = 2;
    if (type === 'received') days = 5;
    if (type === 'defrosted') days = 1;
    setDlc(addDays(startOfDay(new Date()), days).getTime());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantity || !bacId) return;

    const productData = {
      bacId,
      name,
      quantity: parseFloat(quantity),
      unit,
      dlc,
      actionType,
      batchNumber: batchNumber || undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      origin: origin || undefined,
      preparerName: user?.name,
    };

    if (editMode && productId) {
      updateProduct(productId, productData);
    } else {
      addProduct(productData);
    }

    navigate(-1);
  };

  const selectedBac = bacs.find(b => b.id === bacId);
  const selectedShelf = shelves.find(s => s.id === selectedBac?.shelfId);
  const selectedUnit = storageUnits.find(u => u.id === selectedShelf?.unitId);
  const selectedZone = zones.find(z => z.id === selectedUnit?.zoneId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Bac Selection Modal */}
      <AnimatePresence>
        {isSelectingBac && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-lg rounded-t-[2.5rem] p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Emplacement</h2>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Où placer le produit ?</p>
                </div>
                <button onClick={() => setIsSelectingBac(false)} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                  <X size={20} />
                </button>
              </div>

              {/* Breadcrumbs for selection */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                <button 
                  onClick={() => setSelectionPath({})}
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                    !selectionPath.zoneId ? "text-primary" : "text-gray-400"
                  )}
                >
                  Restaurant
                </button>
                {selectionPath.zoneId && (
                  <>
                    <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                    <button 
                      onClick={() => setSelectionPath({ zoneId: selectionPath.zoneId })}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                        selectionPath.zoneId && !selectionPath.unitId ? "text-primary" : "text-gray-400"
                      )}
                    >
                      {zones.find(z => z.id === selectionPath.zoneId)?.name}
                    </button>
                  </>
                )}
                {selectionPath.unitId && (
                  <>
                    <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                    <button 
                      onClick={() => setSelectionPath({ zoneId: selectionPath.zoneId, unitId: selectionPath.unitId })}
                      className={cn(
                        "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                        selectionPath.unitId && !selectionPath.shelfId ? "text-primary" : "text-gray-400"
                      )}
                    >
                      {storageUnits.find(u => u.id === selectionPath.unitId)?.name}
                    </button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Zone Selection */}
                {!selectionPath.zoneId && zones.map(zone => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectionPath({ zoneId: zone.id })}
                    className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{zone.icon}</span>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{zone.name}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}

                {/* Unit Selection */}
                {selectionPath.zoneId && !selectionPath.unitId && storageUnits.filter(u => u.zoneId === selectionPath.zoneId).map(unit => (
                  <button
                    key={unit.id}
                    onClick={() => setSelectionPath({ zoneId: selectionPath.zoneId, unitId: unit.id })}
                    className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{unit.icon}</span>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{unit.name}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}

                {/* Shelf Selection */}
                {selectionPath.unitId && !selectionPath.shelfId && shelves.filter(s => s.unitId === selectionPath.unitId).map(shelf => (
                  <button
                    key={shelf.id}
                    onClick={() => setSelectionPath({ ...selectionPath, shelfId: shelf.id })}
                    className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                        {shelf.level}
                      </div>
                      <span className="text-sm font-black text-gray-900 uppercase tracking-tight">{shelf.name}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                ))}

                {/* Bac Selection */}
                {selectionPath.shelfId && bacs.filter(b => b.shelfId === selectionPath.shelfId).map(bac => (
                  <button
                    key={bac.id}
                    onClick={() => { setBacId(bac.id); setIsSelectingBac(false); }}
                    className={cn(
                      "p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all border-2",
                      bacId === bac.id ? "bg-primary/5 border-primary" : "bg-gray-50 border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{bac.icon}</span>
                      <span className={cn("text-sm font-black uppercase tracking-tight", bacId === bac.id ? "text-primary" : "text-gray-900")}>
                        {bac.name}
                      </span>
                    </div>
                    {bacId === bac.id && <Check size={16} className="text-primary" />}
                  </button>
                ))}

                {selectionPath.shelfId && bacs.filter(b => b.shelfId === selectionPath.shelfId).length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs font-bold uppercase">
                    Aucun bac dans ce niveau
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">
              {editMode ? 'Modifier produit' : 'Nouveau produit'}
            </h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
              {editMode ? 'Mise à jour traçabilité' : 'Étiquetage rapide'}
            </p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
            showPreview ? "bg-primary text-white" : "bg-gray-50 text-gray-400"
          )}
        >
          <Eye size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence>
          {showPreview && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-gray-50 border-b border-gray-100"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aperçu de l'étiquette</span>
                  <span className="text-[9px] font-bold text-primary uppercase">Format Standard</span>
                </div>
                <ProductLabel 
                  product={{
                    id: 'preview',
                    bacId,
                    name: name || 'Nom du produit',
                    quantity: parseFloat(quantity) || 0,
                    unit,
                    addedAt: Date.now(),
                    dlc,
                    status: 'active',
                    actionType,
                    batchNumber,
                    temperature: temperature ? parseFloat(temperature) : undefined,
                    origin,
                    preparerName: user?.name || 'Chef',
                    modifiedAt: Date.now(),
                    syncStatus: 'synced'
                  }} 
                  size="sm"
                  className="mx-auto max-w-[280px] shadow-xl"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 space-y-8">
          {/* Bac Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Emplacement du produit</label>
              <button 
                type="button"
                onClick={() => setIsSelectingBac(true)}
                className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1"
              >
                <MapPin size={10} /> Changer
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setIsSelectingBac(true)}
              className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl flex items-center gap-4 active:scale-[0.98] transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
                {selectedBac?.icon || '📦'}
              </div>
              <div className="text-left flex-1">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                  {selectedBac?.name || 'Sélectionner un bac'}
                </h3>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {selectedZone?.name} • {selectedUnit?.name} • {selectedShelf?.name}
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>

            {/* Quick Suggestions (Last used bacs) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {bacs.slice(0, 5).map(bac => (
                <button
                  key={bac.id}
                  type="button"
                  onClick={() => setBacId(bac.id)}
                  className={cn(
                    "flex-shrink-0 px-3 py-2 rounded-xl border-2 text-[8px] font-black uppercase tracking-widest transition-all",
                    bacId === bac.id ? "bg-primary/5 border-primary text-primary" : "bg-white border-gray-100 text-gray-400"
                  )}
                >
                  {bac.name}
                </button>
              ))}
            </div>
          </div>

        {/* Name Input */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type d'action</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'received', label: 'Reçu', icon: Truck },
              { id: 'cooked', label: 'Cuit', icon: Flame },
              { id: 'opened', label: 'Ouvert', icon: PackageOpen },
              { id: 'defrosted', label: 'Décongelé', icon: Snowflake },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleActionTypeChange(type.id as ActionType)}
                className={cn(
                  "py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1",
                  actionType === type.id ? "border-primary bg-primary/5 text-primary" : "border-gray-100 bg-white text-gray-400"
                )}
              >
                <type.icon size={16} />
                <span className="text-[8px] font-bold uppercase">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Name Input */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom du produit</label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Poulet blanc"
              className="w-full bg-white border border-gray-100 p-4 pl-12 rounded-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              required
            />
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                  name === s ? "bg-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantité</label>
            <input
              type="number"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.0"
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unité</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* DLC Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DLC (Date Limite de Consommation)</label>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 5].map((days) => {
              const date = addDays(startOfDay(new Date()), days);
              const isActive = startOfDay(new Date(dlc)).getTime() === date.getTime();
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDlc(date.getTime())}
                  className={cn(
                    "py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center",
                    isActive ? "border-primary bg-primary/5 text-primary" : "border-gray-100 bg-white text-gray-400"
                  )}
                >
                  <span className="text-[10px] font-black uppercase">{days === 0 ? "Auj." : `+${days}j`}</span>
                  <span className="text-[8px] font-bold">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date)}</span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <input
              type="date"
              value={new Date(dlc).toISOString().split('T')[0]}
              onChange={(e) => setDlc(new Date(e.target.value).getTime())}
              className="w-full bg-white border border-gray-100 p-4 rounded-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
          </div>
        </div>

        {/* Professional Details (New Section) */}
        {!user?.settings?.simplifiedMode && (
          <div className="space-y-4 pt-4 border-t border-gray-50">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">Détails Professionnels (HACCP)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 uppercase">N° de lot</label>
                <input 
                  type="text" 
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Ex: L240408"
                  className="w-full bg-gray-50 border-none p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Temp. (°C)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="Ex: 3.5"
                  className="w-full bg-gray-50 border-none p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-gray-400 uppercase">Origine / Fournisseur</label>
              <input 
                type="text" 
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Ex: Metro, Boucher local..."
                className="w-full bg-gray-50 border-none p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        </div>
      </form>

      {/* Footer Actions */}
      <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
        <button 
          type="button"
          onClick={() => navigate(-1)}
          className="flex-1 bg-gray-50 text-gray-400 py-4 rounded-2xl font-bold uppercase text-xs"
        >
          Annuler
        </button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          className="flex-[2] bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <Check size={20} />
          {editMode ? 'ENREGISTRER' : 'AJOUTER'}
        </motion.button>
      </div>
    </div>
  );
}
