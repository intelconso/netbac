import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Check, MapPin, Layers, LayoutGrid, X, Edit2, Plus, Clock, Search, FileText } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { addDays, startOfDay } from 'date-fns';

export default function ExpressAddScreen() {
  const navigate = useNavigate();
  const { zones, storageUnits, shelves, bacs, addProduct, user } = useStore();

  const [step, setStep] = useState<'zone' | 'unit' | 'shelf' | 'bac'>('zone');
  const [selection, setSelection] = useState<{ zoneId?: string, unitId?: string, shelfId?: string }>({});
  const [successProduct, setSuccessProduct] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Get recent bacs from logs
  const recentBacs = useStore.getState().logs
    .filter(log => log.action === 'add_product' && log.entityId)
    .map(log => {
      const product = useStore.getState().products.find(p => p.id === log.entityId);
      return product ? bacs.find(b => b.id === product.bacId) : null;
    })
    .filter((bac, index, self) => bac && self.findIndex(b => b?.id === bac.id) === index)
    .slice(0, 4);

  const handleZoneSelect = (zoneId: string) => {
    const zoneUnits = storageUnits.filter(u => u.zoneId === zoneId);
    
    if (zoneUnits.length === 1) {
      // Auto-skip to shelf if only one unit
      const unitId = zoneUnits[0].id;
      const unitShelves = shelves.filter(s => s.unitId === unitId);
      
      if (unitShelves.length === 1) {
        // Auto-skip to bac if only one shelf
        setSelection({ zoneId, unitId, shelfId: unitShelves[0].id });
        setStep('bac');
      } else {
        setSelection({ zoneId, unitId });
        setStep('shelf');
      }
    } else {
      setSelection({ zoneId });
      setStep('unit');
    }
  };

  const handleUnitSelect = (unitId: string) => {
    const unitShelves = shelves.filter(s => s.unitId === unitId);
    
    if (unitShelves.length === 1) {
      // Auto-skip to bac if only one shelf
      setSelection(prev => ({ ...prev, unitId, shelfId: unitShelves[0].id }));
      setStep('bac');
    } else {
      setSelection(prev => ({ ...prev, unitId }));
      setStep('shelf');
    }
  };

  const handleShelfSelect = (shelfId: string) => {
    setSelection(prev => ({ ...prev, shelfId }));
    setStep('bac');
  };

  const handleBacSelect = (bacId: string) => {
    const bac = bacs.find(b => b.id === bacId);
    if (!bac) return;

    // Instant add with defaults
    const newId = addProduct({
      bacId,
      name: bac.name,
      quantity: 1,
      unit: 'pce',
      dlc: addDays(startOfDay(new Date()), 3).getTime(),
      actionType: 'received',
      preparerName: user?.name,
      batchNumber: batchNumber || undefined,
    });

    setSuccessProduct(newId);
    
    if (!isBatchMode) {
      // Auto-close after 3 seconds if user doesn't interact
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      // In batch mode, clear success after 1.5s but stay on screen
      setTimeout(() => {
        setSuccessProduct(null);
      }, 1500);
    }
  };

  const filteredShelves = shelves
    .filter(s => {
      const unit = storageUnits.find(u => u.id === s.unitId);
      return unit?.zoneId === selection.zoneId;
    })
    .sort((a, b) => a.level - b.level);

  const filteredBacs = bacs.filter(b => b.shelfId === selection.shelfId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Étiquetage Express</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">3 taps • Instantané</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", step === 'zone' ? "bg-primary" : "bg-gray-200")} />
          <div className={cn("w-1.5 h-1.5 rounded-full", step === 'unit' ? "bg-primary" : "bg-gray-200")} />
          <div className={cn("w-1.5 h-1.5 rounded-full", step === 'shelf' ? "bg-primary" : "bg-gray-200")} />
          <div className={cn("w-1.5 h-1.5 rounded-full", step === 'bac' ? "bg-primary" : "bg-gray-200")} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {/* Pro Options Bar */}
        <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-primary">
              <FileText size={16} />
            </div>
            <input 
              type="text" 
              placeholder="N° de Lot (Optionnel)" 
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="bg-transparent text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none w-full placeholder:text-white/20"
            />
          </div>
          <button 
            onClick={() => setIsBatchMode(!isBatchMode)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
              isBatchMode ? "bg-primary text-white" : "bg-white/5 text-white/40"
            )}
          >
            Mode Rafale: {isBatchMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {step === 'zone' && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher un produit ou bac..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold focus:outline-none focus:border-primary/20 transition-all"
              />
            </div>

            {/* Search Results (Direct Bac Match) */}
            {searchQuery && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Search size={14} className="text-primary" />
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Résultats de recherche</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {bacs.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6).map(bac => (
                    <motion.button
                      key={bac.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleBacSelect(bac.id)}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm"
                    >
                      <span className="text-2xl">{bac.icon}</span>
                      <div className="text-left min-w-0">
                        <p className="text-[10px] font-black text-gray-900 uppercase truncate">{bac.name}</p>
                        <p className="text-[7px] font-bold text-gray-400 uppercase truncate">
                          {(() => {
                            const shelf = shelves.find(s => s.id === bac.shelfId);
                            const unit = storageUnits.find(u => u.id === shelf?.unitId);
                            const zone = zones.find(z => z.id === unit?.zoneId);
                            return `${zone?.name} > ${unit?.name}`;
                          })()}
                        </p>
                        <p className="text-[8px] font-bold text-primary uppercase tracking-tighter mt-0.5">Tap pour étiqueter</p>
                      </div>
                    </motion.button>
                  ))}
                  {bacs.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="col-span-2 py-4 text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Aucun bac trouvé pour "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!searchQuery && (
              <>
                {/* Recent Bacs */}
                {recentBacs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <Clock size={14} className="text-primary" />
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisés récemment</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {recentBacs.map(bac => bac && (
                        <motion.button
                          key={bac.id}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleBacSelect(bac.id)}
                          className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm"
                        >
                          <span className="text-2xl">{bac.icon}</span>
                          <div className="text-left min-w-0">
                            <p className="text-[10px] font-black text-gray-900 uppercase truncate">{bac.name}</p>
                            <p className="text-[8px] font-bold text-primary uppercase tracking-tighter">Instant-Tap</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">1. Choisir la Zone</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Où travaillez-vous ?</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {zones.length > 0 ? (
                    zones.map(zone => (
                      <motion.button
                        key={zone.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleZoneSelect(zone.id)}
                        className="bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl group-hover:bg-primary/10 transition-colors">
                            {zone.icon}
                          </div>
                          <div className="text-left">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{zone.name}</h3>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                              {storageUnits.filter(u => u.zoneId === zone.id).length} Unités de stockage
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-gray-300" />
                      </motion.button>
                    ))
                  ) : (
                    <div className="py-12 text-center space-y-6">
                      <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                        <MapPin size={40} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-black text-gray-900 uppercase">Aucune zone configurée</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                          Commencez par créer vos zones de travail (Cuisine, Bar, etc.)
                        </p>
                      </div>
                      <button 
                        onClick={() => navigate('/settings')}
                        className="mx-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                      >
                        Configurer les zones
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 'unit' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <button onClick={() => setStep('zone')} className="px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
                {zones.find(z => z.id === selection.zoneId)?.name}
              </button>
              <ChevronRight size={10} className="text-gray-300" />
              <button className="px-2 py-1 text-[9px] font-black text-primary uppercase tracking-widest bg-white rounded-lg shadow-sm">
                Choisir Unité
              </button>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">2. Choisir l'Unité</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frigo, Saladette, Réserve...</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {storageUnits.filter(u => u.zoneId === selection.zoneId).length > 0 ? (
                storageUnits.filter(u => u.zoneId === selection.zoneId).map(unit => (
                  <motion.button
                    key={unit.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleUnitSelect(unit.id)}
                    className="bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-3xl group-hover:bg-primary/10 transition-colors">
                        {unit.icon}
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{unit.name}</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {shelves.filter(s => s.unitId === unit.id).length} Niveaux
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300" />
                  </motion.button>
                ))
              ) : (
                <div className="py-12 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                    <LayoutGrid size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-900 uppercase">Aucune unité configurée</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                      Ajoutez des frigos ou étagères dans cette zone pour continuer.
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="mx-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    Configurer les unités
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'shelf' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <button onClick={() => setStep('zone')} className="px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
                {zones.find(z => z.id === selection.zoneId)?.name}
              </button>
              <ChevronRight size={10} className="text-gray-300" />
              <button onClick={() => setStep('unit')} className="px-2 py-1 text-[9px] font-black text-primary uppercase tracking-widest bg-white rounded-lg shadow-sm">
                {storageUnits.find(u => u.id === selection.unitId)?.name}
              </button>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">3. Choisir l'Étagère</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quel niveau ?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {shelves.filter(s => s.unitId === selection.unitId).length > 0 ? (
                shelves.filter(s => s.unitId === selection.unitId).sort((a, b) => a.level - b.level).map(shelf => (
                  <motion.button
                    key={shelf.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleShelfSelect(shelf.id)}
                    className="bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                        <Layers size={24} />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{shelf.name}</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          Niveau {shelf.level}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-gray-300" />
                  </motion.button>
                ))
              ) : (
                <div className="py-12 text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                    <Layers size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-900 uppercase">Aucun niveau configuré</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                      Configurez les étagères de cette unité pour continuer.
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="mx-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    Configurer les niveaux
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'bac' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2 bg-gray-50 p-2 rounded-xl border border-gray-100 overflow-x-auto no-scrollbar">
              <button onClick={() => setStep('zone')} className="flex-shrink-0 px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
                {zones.find(z => z.id === selection.zoneId)?.name}
              </button>
              <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />
              <button onClick={() => setStep('unit')} className="flex-shrink-0 px-2 py-1 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-colors">
                {storageUnits.find(u => u.id === selection.unitId)?.name}
              </button>
              <ChevronRight size={10} className="text-gray-300 flex-shrink-0" />
              <button onClick={() => setStep('shelf')} className="flex-shrink-0 px-2 py-1 text-[9px] font-black text-primary uppercase tracking-widest bg-white rounded-lg shadow-sm">
                {shelves.find(s => s.id === selection.shelfId)?.name}
              </button>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">4. Tap pour Étiqueter</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sélectionnez le support</p>
            </div>
            
            {filteredBacs.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredBacs.map(bac => (
                  <motion.button
                    key={bac.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleBacSelect(bac.id)}
                    className="bg-white p-6 rounded-[2.5rem] border border-gray-100 flex flex-col items-center gap-3 shadow-sm active:border-primary active:bg-primary/5 transition-all"
                  >
                    <span className="text-4xl">{bac.icon}</span>
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight text-center">{bac.name}</span>
                  </motion.button>
                ))}
                
                {/* Manual Add Option */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/add-product', { state: { shelfId: selection.shelfId } })}
                  className="bg-gray-50 p-6 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-all"
                >
                  <Plus size={24} className="text-gray-400" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-tight text-center">Autre produit</span>
                </motion.button>
              </div>
            ) : (
              <div className="py-12 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                  <LayoutGrid size={40} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-black text-gray-900 uppercase">Aucun support configuré</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                    Ajoutez des bacs à ce niveau pour un étiquetage en 1 tap.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => navigate('/settings')}
                    className="mx-auto px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                  >
                    Configurer les supports
                  </button>
                  <button 
                    onClick={() => navigate('/add-product', { state: { shelfId: selection.shelfId } })}
                    className="mx-auto px-8 py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Saisie manuelle
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Success Overlay */}
      <AnimatePresence>
        {successProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-primary flex flex-col items-center justify-center p-8 text-white"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6"
            >
              <Check size={48} />
            </motion.div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-center mb-2">Étiquette Créée !</h2>
            <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-12">Enregistré avec succès</p>
            
            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={() => navigate('/')}
                className="w-full bg-white text-primary py-5 rounded-2xl font-black uppercase text-xs shadow-xl"
              >
                Terminer
              </button>
              <button 
                onClick={() => {
                  // Navigate to edit the product
                  const product = useStore.getState().products.find(p => p.id === successProduct);
                  if (product) navigate('/add-product', { state: { bacId: product.bacId, editMode: true, productId: product.id } });
                }}
                className="w-full bg-white/10 text-white py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2"
              >
                <Edit2 size={16} /> Modifier les détails
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
