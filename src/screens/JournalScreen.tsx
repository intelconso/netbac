import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  History, 
  Calendar, 
  Thermometer, 
  Sparkles, 
  Clock, 
  User, 
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Package,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../lib/store';
import { formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function JournalScreen() {
  const navigate = useNavigate();
  const { logs, tempLogs, cleaningTasks, storageUnits, products, completeCleaningTask, addTempLog, user } = useStore();
  
  const [activeTab, setActiveTab] = useState<'history' | 'calendar' | 'haccp'>('haccp');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'actions' | 'products'>('all');
  const [isAddingTemp, setIsAddingTemp] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(storageUnits[0]?.id || '');
  const [tempValue, setTempValue] = useState('4');

  const handleAddTemp = () => {
    addTempLog({
      unitId: selectedUnitId,
      temperature: parseFloat(tempValue),
      operatorId: user?.id || 'admin',
      operatorName: user?.name || 'Admin',
      status: parseFloat(tempValue) <= 4 ? 'ok' : 'alert'
    });
    setIsAddingTemp(false);
  };
  
  const inactiveProducts = products.filter(p => p.status !== 'active').sort((a, b) => b.modifiedAt - a.modifiedAt);
  
  // Tabs filtering
  const tabs = [
    { id: 'haccp', label: 'HACCP', icon: ShieldCheck, enabled: user?.settings?.enableTemperature || user?.settings?.enableCleaning },
    { id: 'history', label: 'Journal', icon: History, enabled: true },
    { id: 'calendar', label: 'Planning', icon: Calendar, enabled: true },
  ].filter(t => t.enabled);

  const filteredLogs = logs.filter(log => {
    if (log.action === 'temp_check' && !user?.settings?.enableTemperature) return false;
    if (log.action === 'cleaning' && !user?.settings?.enableCleaning) return false;
    
    if (historyFilter === 'actions') return ['temp_check', 'cleaning'].includes(log.action);
    if (historyFilter === 'products') return ['add_product', 'use_product', 'discard_product'].includes(log.action);
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Journal de Bord</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Historique & HACCP</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 mx-6 mt-6 rounded-2xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all",
              activeTab === tab.id ? "bg-white text-primary shadow-sm" : "text-gray-400"
            )}
          >
            <tab.icon size={16} />
            <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {activeTab === 'history' && (
          <section className="space-y-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {(['all', 'actions', 'products'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    historyFilter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"
                  )}
                >
                  {f === 'all' ? 'Tout' : f === 'actions' ? 'HACCP' : 'Produits'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flux d'activité</h2>
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={log.id}
                  className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-4"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    log.action === 'add_product' ? "bg-success/10 text-success" :
                    log.action === 'temp_check' ? "bg-primary/10 text-primary" :
                    log.action === 'cleaning' ? "bg-blue-500/10 text-blue-500" : "bg-gray-100 text-gray-400"
                  )}>
                    {log.action === 'add_product' ? <CheckCircle2 size={18} /> :
                     log.action === 'temp_check' ? <Thermometer size={18} /> :
                     log.action === 'cleaning' ? <Sparkles size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-black text-gray-900 uppercase tracking-tight">{log.details}</p>
                      <span className="text-[8px] font-bold text-gray-400 uppercase">{formatDate(log.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={10} className="text-gray-400" />
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{log.userName}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-xs font-bold uppercase">Aucun log pour le moment</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

        {activeTab === 'calendar' && (
          <section className="space-y-6">
            <div className="bg-gray-900 rounded-3xl p-6 text-white space-y-6 relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-xl font-black uppercase tracking-tight">Vue Mensuelle</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Avril 2026</p>
              </div>
              
              {/* Simulated Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 relative z-10">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-center text-[8px] font-black text-white/20">{d}</div>
                ))}
                {Array.from({ length: 30 }).map((_, i) => (
                  <div key={i} className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-[10px] font-black border border-white/5",
                    i + 1 === 8 ? "bg-primary text-white" : "text-white/40"
                  )}>
                    {i + 1}
                    {i + 1 === 10 && <div className="absolute w-1 h-1 bg-danger rounded-full mt-4" />}
                    {i + 1 === 12 && <div className="absolute w-1 h-1 bg-alert rounded-full mt-4" />}
                  </div>
                ))}
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Évènements à venir</h3>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center text-danger">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900 uppercase">DLC Expirée: Poulet</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">Prévu le 10 Avril</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </div>
            </div>
          </section>
        )}

        {activeTab === 'haccp' && (
          <section className="space-y-8">
            {/* Temperature Section */}
            {user?.settings?.enableTemperature && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Relevés de Température</h2>
                  <button 
                    onClick={() => setIsAddingTemp(true)}
                    className="text-[10px] font-black text-primary uppercase flex items-center gap-1"
                  >
                    <Thermometer size={12} /> Nouveau
                  </button>
                </div>

                {isAddingTemp && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-4 rounded-2xl border-2 border-primary/20 shadow-lg space-y-4"
                  >
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Unité de stockage</p>
                      <select 
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold focus:outline-none"
                      >
                        {storageUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Température (°C)</p>
                      <input 
                        type="number" 
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl text-sm font-bold focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setIsAddingTemp(false)} className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase">Annuler</button>
                      <button onClick={handleAddTemp} className="flex-1 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase">Enregistrer</button>
                    </div>
                  </motion.div>
                )}

                <div className="space-y-3">
                  {tempLogs.slice(0, 3).map(log => (
                    <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          log.status === 'ok' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                        )}>
                          <Thermometer size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">{storageUnits.find(u => u.id === log.unitId)?.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{formatDate(log.timestamp)}</p>
                        </div>
                      </div>
                      <span className={cn("text-sm font-black", log.status === 'ok' ? "text-success" : "text-danger")}>
                        {log.temperature}°C
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cleaning Section */}
            {user?.settings?.enableCleaning && (
              <div className="space-y-4">
                <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan de Nettoyage</h2>
                <div className="space-y-3">
                  {cleaningTasks.map(task => (
                    <div key={task.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase">{task.name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">
                            {storageUnits.find(u => u.id === task.unitId)?.name} • {task.frequency}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => completeCleaningTask(task.id)}
                        className="px-4 py-2 bg-gray-50 rounded-xl text-[9px] font-black text-primary uppercase active:scale-95 transition-all"
                      >
                        Valider
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
