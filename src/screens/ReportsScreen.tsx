import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle2,
  Filter,
  Share2,
  Thermometer,
  Sparkles,
  Trash2,
  History,
  ChevronRight,
  Search
} from 'lucide-react';
import { useStore } from '../lib/store';
import { formatDate, getDaysRemaining, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function ReportsScreen() {
  const navigate = useNavigate();
  const { products, user, tempLogs, cleaningTasks, storageUnits, zones, shelves, bacs } = useStore();
  
  const [reportType, setReportType] = useState<'haccp' | 'stock' | 'waste' | 'history'>('stock');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const activeProducts = products.filter(p => p.status === 'active');
  
  // Filtering logic
  const filteredProducts = products.filter(p => {
    const productDate = new Date(p.addedAt).toISOString().split('T')[0];
    
    // Date filter: Stock and History show all by default unless specific date is needed
    // For Waste and HACCP, date is critical
    const matchesDate = (reportType === 'stock' || reportType === 'history') 
      ? true 
      : productDate === selectedDate;
    
    const bac = bacs.find(b => b.id === p.bacId);
    const shelf = shelves.find(s => s.id === bac?.shelfId);
    const unit = storageUnits.find(u => u.id === shelf?.unitId);
    
    const matchesZone = selectedZoneId === 'all' || unit?.zoneId === selectedZoneId;
    const matchesUnit = selectedUnitId === 'all' || unit?.id === selectedUnitId;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (reportType === 'stock') return p.status === 'active' && matchesZone && matchesUnit && matchesSearch;
    if (reportType === 'waste') return p.status === 'discarded' && matchesDate && matchesZone && matchesUnit && matchesSearch;
    if (reportType === 'history') return matchesZone && matchesUnit && matchesSearch;
    return matchesZone && matchesUnit && matchesSearch;
  });

  const expiredProducts = filteredProducts.filter(p => p.status === 'active' && getDaysRemaining(p.dlc) < 0);
  const usedProducts = products.filter(p => p.status === 'used');
  const discardedProducts = products.filter(p => p.status === 'discarded');

  const filteredTempLogs = tempLogs.filter(log => 
    new Date(log.timestamp).toISOString().split('T')[0] === selectedDate
  );

  const avgTemp = filteredTempLogs.length > 0 
    ? (filteredTempLogs.reduce((acc, log) => acc + log.temperature, 0) / filteredTempLogs.length).toFixed(1)
    : '4.2';

  const filteredCleaningTasks = cleaningTasks.filter(task => {
    if (!task.lastDone) return false;
    return new Date(task.lastDone).toISOString().split('T')[0] === selectedDate;
  });

  const cleaningRate = cleaningTasks.length > 0
    ? Math.round((filteredCleaningTasks.length / cleaningTasks.length) * 100)
    : 85;

  const haccpScore = Math.round(
    (filteredTempLogs.filter(l => l.status === 'ok').length / (filteredTempLogs.length || 1)) * 50 +
    (filteredCleaningTasks.length / (cleaningTasks.length || 1)) * 50
  );

  const generateReport = () => {
    const zoneName = selectedZoneId === 'all' ? 'Toutes les zones' : zones.find(z => z.id === selectedZoneId)?.name;
    const unitName = selectedUnitId === 'all' ? 'Toutes les unités' : storageUnits.find(u => u.id === selectedUnitId)?.name;
    
    alert(`Rapport ${reportType.toUpperCase()} généré pour le ${selectedDate}\nLieu: ${zoneName} > ${unitName}\n\nLe document est prêt pour le téléchargement.`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Rapports & HACCP</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Génération de documents</p>
          </div>
        </div>
        <button 
          onClick={generateReport}
          className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
        >
          <Download size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Report Type Selector */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl overflow-x-auto no-scrollbar">
          {(['haccp', 'stock', 'waste', 'history'] as const)
            .filter(type => type !== 'haccp' || user?.settings?.enableTemperature || user?.settings?.enableCleaning)
            .map((type) => (
            <button
              key={type}
              onClick={() => setReportType(type)}
              className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                reportType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
              }`}
            >
              {type === 'haccp' ? 'HACCP' : type === 'stock' ? 'Stock' : type === 'waste' ? 'Pertes' : 'Historique'}
            </button>
          ))}
        </div>

        {/* Summary Card */}
        <div className="bg-gray-900 rounded-3xl p-6 text-white space-y-6 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest">Rapport du {formatDate(new Date(selectedDate).getTime())}</span>
              <h2 className="text-xl font-black uppercase tracking-tight">Résumé de Conformité</h2>
            </div>
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
              <Calendar size={20} className="text-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Score Hygiène</p>
              <p className="text-2xl font-black text-primary">{haccpScore}%</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Alertes DLC</p>
              <p className="text-2xl font-black text-danger">{expiredProducts.length}</p>
            </div>
          </div>

          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <button 
          onClick={() => navigate('/journal')}
          className="w-full p-4 bg-white rounded-2xl border border-gray-100 flex items-center justify-between group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <History size={18} />
            </div>
            <div className="text-left">
              <p className="text-xs font-black text-gray-900 uppercase">Consulter le Journal</p>
              <p className="text-[9px] font-bold text-gray-400 uppercase">Historique complet & HACCP</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
        </button>

        {/* Detailed Stats */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuration du Rapport</h2>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1 text-[9px] font-black uppercase transition-colors",
                showFilters ? "text-primary" : "text-gray-400"
              )}
            >
              <Filter size={12} /> {showFilters ? 'Fermer' : 'Filtrer'}
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4 mb-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Date du Rapport</p>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="date" 
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-[10px] font-bold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Zone</p>
                        <select 
                          value={selectedZoneId}
                          onChange={(e) => {
                            setSelectedZoneId(e.target.value);
                            setSelectedUnitId('all');
                          }}
                          className="w-full p-2 bg-gray-50 rounded-xl text-[10px] font-bold focus:outline-none"
                        >
                          <option value="all">Toutes les zones</option>
                          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Unité</p>
                        <select 
                          value={selectedUnitId}
                          onChange={(e) => setSelectedUnitId(e.target.value)}
                          className="w-full p-2 bg-gray-50 rounded-xl text-[10px] font-bold focus:outline-none"
                        >
                          <option value="all">Toutes les unités</option>
                          {storageUnits
                            .filter(u => selectedZoneId === 'all' || u.zoneId === selectedZoneId)
                            .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Rechercher un produit</p>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Ex: Poulet, Poisson..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-[10px] font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {reportType === 'haccp' && (
              <>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 uppercase">Traçabilité Entrante</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Tous les lots enregistrés</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-success uppercase">OK</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-alert/10 flex items-center justify-center text-alert">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900 uppercase">Respect des DLC</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{expiredProducts.length} anomalies détectées</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-alert uppercase">ACTION</span>
                </div>
              </>
            )}

            {reportType === 'stock' && (
              <div className="space-y-4">
                {storageUnits
                  .filter(u => (selectedZoneId === 'all' || u.zoneId === selectedZoneId) && (selectedUnitId === 'all' || u.id === selectedUnitId))
                  .map(unit => {
                    const unitProducts = filteredProducts.filter(p => {
                      const bac = bacs.find(b => b.id === p.bacId);
                      const shelf = shelves.find(s => s.id === bac?.shelfId);
                      return shelf?.unitId === unit.id;
                    });

                    if (unitProducts.length === 0 && selectedUnitId === 'all') return null;

                    return (
                      <div key={unit.id} className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{unit.icon}</span>
                            <p className="text-xs font-black text-gray-900 uppercase">{unit.name}</p>
                          </div>
                          <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase">
                            {unitProducts.length} Étiquettes
                          </span>
                        </div>
                        <div className="space-y-2">
                          {unitProducts.map(product => {
                            const days = getDaysRemaining(product.dlc);
                            return (
                              <div key={product.id} className="flex justify-between items-center py-1">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold text-gray-800 uppercase truncate">{product.name}</p>
                                  <p className="text-[8px] text-gray-400 font-bold uppercase">DLC: {formatDate(product.dlc)}</p>
                                </div>
                                <span className={cn(
                                  "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                                  days < 0 ? "bg-danger/10 text-danger" : days <= 1 ? "bg-alert/10 text-alert" : "bg-success/10 text-success"
                                )}>
                                  {days < 0 ? 'Expiré' : `${days}j`}
                                </span>
                              </div>
                            );
                          })}
                          {unitProducts.length === 0 && (
                            <p className="text-[9px] text-gray-300 font-bold uppercase italic py-2">Aucun produit actif</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {reportType === 'waste' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                    <p className="text-xs font-black text-gray-900 uppercase">Pertes & Rebuts</p>
                    <span className="text-[9px] font-bold text-danger bg-danger/5 px-2 py-0.5 rounded-full uppercase">
                      {filteredProducts.length} Produits
                    </span>
                  </div>
                  <div className="space-y-3">
                    {filteredProducts.map(product => (
                      <div key={product.id} className="flex justify-between items-start py-1">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-gray-800 uppercase truncate">{product.name}</p>
                          <p className="text-[8px] text-gray-400 font-bold uppercase">
                            {storageUnits.find(u => {
                              const bac = bacs.find(b => b.id === product.bacId);
                              const shelf = shelves.find(s => s.id === bac?.shelfId);
                              return u.id === shelf?.unitId;
                            })?.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-danger uppercase tracking-tighter">Jeté</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase">{product.quantity} {product.unit}</p>
                        </div>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className="py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Aucune perte enregistrée ce jour</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {reportType === 'history' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                    <p className="text-xs font-black text-gray-900 uppercase">Audit Complet</p>
                    <span className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase">
                      {filteredProducts.length} Entrées
                    </span>
                  </div>
                  <div className="space-y-4">
                    {filteredProducts.slice(0, 50).map(product => (
                      <div key={product.id} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black text-gray-900 uppercase truncate">{product.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-[7px] font-black px-1.5 py-0.5 rounded uppercase",
                              product.status === 'active' ? "bg-success/10 text-success" : 
                              product.status === 'used' ? "bg-blue-500/10 text-blue-500" : "bg-danger/10 text-danger"
                            )}>
                              {product.status === 'active' ? 'En Stock' : product.status === 'used' ? 'Utilisé' : 'Jeté'}
                            </span>
                            <span className="text-[8px] text-gray-400 font-bold uppercase">Ajouté le {formatDate(product.addedAt)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-gray-900 uppercase">{product.quantity} {product.unit}</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase truncate w-24">Lot: {product.batchNumber || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Signature Area */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-primary" />
            <h2 className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Validation Responsable</h2>
          </div>
          <div className="h-32 bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex items-center justify-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase italic">Signer ici pour validation HACCP</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Chef: {user?.name}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase">{formatDate(Date.now())}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
