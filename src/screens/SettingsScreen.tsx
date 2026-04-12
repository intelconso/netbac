import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Plus, 
  Trash2, 
  ChevronRight, 
  LayoutGrid, 
  MapPin, 
  ArrowLeft,
  Edit2,
  Check,
  X,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ContainerType } from '../types';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { 
    zones, storageUnits, shelves, bacs, user,
    addZone, deleteZone, 
    addStorageUnit, updateStorageUnit, deleteStorageUnit,
    addShelf, updateShelf, deleteShelf, setUnitShelves,
    addBac, updateBac, deleteBac,
    updateSettings
  } = useStore();
  
  const [activeTab, setActiveTab] = useState<'structure' | 'quick' | 'prefs'>('structure');
  const [quickTab, setQuickTab] = useState<'zones' | 'units' | 'shelves' | 'bacs'>('zones');
  const [drillDown, setDrillDown] = useState<{ zoneId?: string, unitId?: string, shelfId?: string }>({});
  
  // Zone states
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  
  // Unit states
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitZoneId, setNewUnitZoneId] = useState(zones[0]?.id || '');
  const [newUnitType, setNewUnitType] = useState<'frigo' | 'congelateur' | 'reserve' | 'saladette' | 'autre'>('frigo');

  // Shelf states
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfUnitId, setNewShelfUnitId] = useState(storageUnits[0]?.id || '');

  // Bac states
  const [isAddingBac, setIsAddingBac] = useState(false);
  const [newBacName, setNewBacName] = useState('');
  const [newBacType, setNewBacType] = useState<ContainerType>('bac');
  const [newBacShelfId, setNewBacShelfId] = useState(shelves[0]?.id || '');

  const handleAddZone = () => {
    if (!newZoneName) return;
    addZone({ name: newZoneName, icon: '📍' });
    setNewZoneName('');
    setIsAddingZone(false);
  };

  const handleAddUnit = () => {
    const zoneId = drillDown.zoneId || newUnitZoneId;
    if (!newUnitName || !zoneId) return;
    addStorageUnit({ 
      name: newUnitName, 
      zoneId, 
      type: newUnitType,
      icon: newUnitType === 'frigo' ? '❄️' : newUnitType === 'congelateur' ? '🧊' : newUnitType === 'saladette' ? '🥗' : '🥫'
    });
    setNewUnitName('');
    setIsAddingUnit(false);
  };

  const handleAddShelf = () => {
    const unitId = drillDown.unitId || newShelfUnitId;
    if (!newShelfName || !unitId) return;
    const level = shelves.filter(s => s.unitId === unitId).length + 1;
    addShelf({ name: newShelfName, unitId, level });
    setNewShelfName('');
    setIsAddingShelf(false);
  };

  const handleAddBac = () => {
    const shelfId = drillDown.shelfId || newBacShelfId;
    if (!newBacName || !shelfId) return;
    addBac({ 
      name: newBacName, 
      shelfId, 
      type: newBacType,
      color: '#10B981', 
      icon: newBacType === 'bac' ? '🍗' : newBacType === 'boite' ? '📦' : '📥'
    });
    setNewBacName('');
    setIsAddingBac(false);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 bg-white border-b border-gray-50">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-transform">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Administration</h1>
          <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Configuration du restaurant</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 mx-6 mt-6 rounded-xl overflow-x-auto no-scrollbar">
        {[
          { id: 'structure', label: 'Structure' },
          { id: 'quick', label: 'Vue Rapide' },
          { id: 'prefs', label: 'Préférences' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all",
              activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {activeTab === 'structure' && (
          <div className="space-y-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
              <button 
                onClick={() => setDrillDown({})}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                  !drillDown.zoneId ? "text-primary" : "text-gray-400"
                )}
              >
                Restaurant
              </button>
              {drillDown.zoneId && (
                <>
                  <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                  <button 
                    onClick={() => setDrillDown({ zoneId: drillDown.zoneId })}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                      drillDown.zoneId && !drillDown.unitId ? "text-primary" : "text-gray-400"
                    )}
                  >
                    {zones.find(z => z.id === drillDown.zoneId)?.name}
                  </button>
                </>
              )}
              {drillDown.unitId && (
                <>
                  <ChevronRight size={12} className="text-gray-300 flex-shrink-0" />
                  <button 
                    onClick={() => setDrillDown({ zoneId: drillDown.zoneId, unitId: drillDown.unitId })}
                    className={cn(
                      "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
                      drillDown.unitId && !drillDown.shelfId ? "text-primary" : "text-gray-400"
                    )}
                  >
                    {storageUnits.find(u => u.id === drillDown.unitId)?.name}
                  </button>
                </>
              )}
            </div>

            {/* Zone Level */}
            {!drillDown.zoneId && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zones (Lieux)</h2>
                  <button onClick={() => setIsAddingZone(true)} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Nouvelle Zone
                  </button>
                </div>
                {isAddingZone && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-primary/20 shadow-lg space-y-3">
                    <input autoFocus type="text" placeholder="Nom (ex: Cuisine, Réserve...)" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold focus:outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddingZone(false)} className="flex-1 py-2 text-[10px] font-bold text-gray-400 uppercase">Annuler</button>
                      <button onClick={handleAddZone} className="flex-1 py-2 bg-primary text-white rounded-lg text-[10px] font-bold uppercase">Confirmer</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3">
                  {zones.map(zone => (
                    <motion.div
                      key={zone.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setDrillDown({ zoneId: zone.id })}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl group-hover:bg-primary/10 transition-colors">
                          {zone.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{zone.name}</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {storageUnits.filter(u => u.zoneId === zone.id).length} Unités de stockage
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteZone(zone.id); }}
                          className="p-2 text-gray-300 hover:text-danger transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Unit Level */}
            {drillDown.zoneId && !drillDown.unitId && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unités dans {zones.find(z => z.id === drillDown.zoneId)?.name}</h2>
                  <button onClick={() => { setIsAddingUnit(true); setNewUnitZoneId(drillDown.zoneId!); }} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Nouvelle Unité
                  </button>
                </div>
                {isAddingUnit && (
                  <div className="bg-white p-4 rounded-2xl border-2 border-primary/20 shadow-lg space-y-3">
                    <input autoFocus type="text" placeholder="Nom (ex: Frigo 1, Armoire...)" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold focus:outline-none" />
                    <select value={newUnitType} onChange={(e) => setNewUnitType(e.target.value as any)} className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold focus:outline-none">
                      <option value="frigo">Frigo</option>
                      <option value="congelateur">Congélateur</option>
                      <option value="saladette">Saladette</option>
                      <option value="reserve">Réserve / Étagère</option>
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddingUnit(false)} className="flex-1 py-2 text-[10px] font-bold text-gray-400 uppercase">Annuler</button>
                      <button onClick={handleAddUnit} className="flex-1 py-2 bg-primary text-white rounded-lg text-[10px] font-bold uppercase">Confirmer</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3">
                  {storageUnits.filter(u => u.zoneId === drillDown.zoneId).map(unit => (
                    <motion.div
                      key={unit.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setDrillDown({ zoneId: drillDown.zoneId, unitId: unit.id })}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm group cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl group-hover:bg-primary/10 transition-colors">
                          {unit.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{unit.name}</h3>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {shelves.filter(s => s.unitId === unit.id).length} Niveaux / Étagères
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Inline Shelf Adjustment */}
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-xl border border-gray-100">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const current = shelves.filter(s => s.unitId === unit.id).length;
                              if (current > 1) setUnitShelves(unit.id, current - 1);
                            }}
                            className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-primary active:scale-90 transition-all"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-primary w-4 text-center">
                            {shelves.filter(s => s.unitId === unit.id).length}
                          </span>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              const current = shelves.filter(s => s.unitId === unit.id).length;
                              if (current < 10) setUnitShelves(unit.id, current + 1);
                            }}
                            className="w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-primary active:scale-90 transition-all"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteStorageUnit(unit.id); }}
                            className="p-2 text-gray-300 hover:text-danger transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <ChevronRight size={16} className="text-gray-300" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Shelf Level */}
            {drillDown.unitId && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Détail des Niveaux</h2>
                  </div>
                  <div className="space-y-3">
                    {shelves.filter(s => s.unitId === drillDown.unitId).sort((a, b) => a.level - b.level).map(shelf => (
                      <div key={shelf.id} className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                              {shelf.level}
                            </div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">{shelf.name}</h3>
                          </div>
                          <button onClick={() => deleteShelf(shelf.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                        </div>

                        {/* Bacs in this shelf */}
                        <div className="pl-11 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {bacs.filter(b => b.shelfId === shelf.id).map(bac => (
                              <div key={bac.id} className="bg-gray-50 px-3 py-2 rounded-xl flex items-center gap-2 border border-gray-100 group">
                                <span className="text-sm">{bac.icon}</span>
                                <span className="text-[10px] font-bold text-gray-600 uppercase">{bac.name}</span>
                                <button onClick={() => deleteBac(bac.id)} className="text-gray-300 hover:text-danger ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={() => { setIsAddingBac(true); setNewBacShelfId(shelf.id); }}
                              className="px-3 py-2 rounded-xl border border-dashed border-gray-300 text-gray-400 flex items-center gap-1 hover:border-primary hover:text-primary transition-all"
                            >
                              <Plus size={12} />
                              <span className="text-[10px] font-bold uppercase">Ajouter Bac</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bac Modal (Simplified for the hierarchy view) */}
            {isAddingBac && (
              <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-6"
                >
                  <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Nouveau Support</h2>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration du contenant</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Nom du produit / Bac</label>
                      <input autoFocus type="text" placeholder="ex: POULET, SAUCE..." value={newBacName} onChange={(e) => setNewBacName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold focus:outline-none border-2 border-transparent focus:border-primary/20 transition-all" />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Type de contenant</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['bac', 'boite', 'tiroir'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => setNewBacType(type)}
                            className={cn(
                              "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                              newBacType === type ? "bg-primary/10 border-primary text-primary" : "bg-gray-50 border-transparent text-gray-400"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button onClick={() => setIsAddingBac(false)} className="flex-1 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Annuler</button>
                    <button onClick={handleAddBac} className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Créer</button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'quick' && (
          <div className="space-y-6">
            <div className="flex p-1 bg-gray-50 rounded-lg overflow-x-auto no-scrollbar">
              {[
                { id: 'zones', label: 'Zones' },
                { id: 'units', label: 'Unités' },
                { id: 'shelves', label: 'Niveaux' },
                { id: 'bacs', label: 'Supports' }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setQuickTab(tab.id as any)}
                  className={cn(
                    "flex-1 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider rounded-md transition-all",
                    quickTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {quickTab === 'zones' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Toutes les Zones</h2>
                  <button onClick={() => setIsAddingZone(true)} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {zones.map(zone => (
                    <div key={zone.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{zone.icon}</span>
                        <h3 className="text-sm font-bold text-gray-900">{zone.name}</h3>
                      </div>
                      <button onClick={() => deleteZone(zone.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quickTab === 'units' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Toutes les Unités</h2>
                  <button onClick={() => setIsAddingUnit(true)} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {storageUnits.map(unit => (
                    <div key={unit.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{unit.icon}</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{unit.name}</h3>
                          <p className="text-[9px] font-bold text-primary uppercase">{zones.find(z => z.id === unit.zoneId)?.name}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteStorageUnit(unit.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quickTab === 'shelves' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tous les Niveaux</h2>
                  <button onClick={() => setIsAddingShelf(true)} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {shelves.map(shelf => (
                    <div key={shelf.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <Layers size={16} className="text-primary" />
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{shelf.name}</h3>
                          <p className="text-[9px] font-bold text-primary uppercase">{storageUnits.find(u => u.id === shelf.unitId)?.name}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteShelf(shelf.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {quickTab === 'bacs' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tous les Supports</h2>
                  <button onClick={() => setIsAddingBac(true)} className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                    <Plus size={12} /> Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {bacs.map(bac => (
                    <div key={bac.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{bac.icon}</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">{bac.name}</h3>
                          <p className="text-[9px] font-bold text-primary uppercase">{shelves.find(s => s.id === bac.shelfId)?.name}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteBac(bac.id)} className="p-2 text-gray-300 hover:text-danger"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prefs' && (
          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Modules Actifs</h2>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-gray-900">Relevés de Température</p>
                    <p className="text-[10px] text-gray-400">Activer le module HACCP froid</p>
                  </div>
                  <button 
                    onClick={() => updateSettings({ enableTemperature: !user?.settings?.enableTemperature })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      user?.settings?.enableTemperature ? "bg-primary" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user?.settings?.enableTemperature ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-gray-900">Plan de Nettoyage</p>
                    <p className="text-[10px] text-gray-400">Suivi de l'hygiène des locaux</p>
                  </div>
                  <button 
                    onClick={() => updateSettings({ enableCleaning: !user?.settings?.enableCleaning })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      user?.settings?.enableCleaning ? "bg-primary" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      user?.settings?.enableCleaning ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expérience Utilisateur</h2>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-gray-900">Mode Simplifié</p>
                  <p className="text-[10px] text-gray-400">Masquer les champs avancés (Lot, Temp...)</p>
                </div>
                <button 
                  onClick={() => updateSettings({ simplifiedMode: !user?.settings?.simplifiedMode })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    user?.settings?.simplifiedMode ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    user?.settings?.simplifiedMode ? "right-1" : "left-1"
                  )} />
                </button>
              </div>
            </section>
          </div>
        )}

        {/* User Profile Section */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profil Responsable</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl text-primary">
                {user?.name?.[0] || 'C'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900 uppercase">{user?.name}</p>
                <p className="text-[10px] font-bold text-primary uppercase">{user?.restaurantName}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Signature Numérique</p>
              <div className="h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
                <p className="text-[9px] font-bold text-gray-300 uppercase italic">Signature enregistrée</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
