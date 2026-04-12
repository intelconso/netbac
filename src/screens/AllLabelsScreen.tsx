import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Printer, Share2, Trash2, CheckCircle2, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn, getDaysRemaining } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ProductLabel from '../components/ProductLabel';

export default function AllLabelsScreen() {
  const navigate = useNavigate();
  const { products, updateProductStatus, zones, storageUnits, shelves, bacs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const activeProducts = products.filter(p => p.status === 'active');
  
  const filteredProducts = activeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedZoneId === 'all') return matchesSearch;
    
    // Find zone for this product
    const bac = bacs.find(b => b.id === p.bacId);
    const shelf = shelves.find(s => s.id === bac?.shelfId);
    const unit = storageUnits.find(u => u.id === shelf?.unitId);
    return matchesSearch && unit?.zoneId === selectedZoneId;
  });

  const handleRemove = (status: 'used' | 'discarded') => {
    if (selectedProduct) {
      updateProductStatus(selectedProduct.id, status);
      setSelectedProduct(null);
      setShowRemoveConfirm(false);
    }
  };

  const getStatusColor = (days: number) => {
    if (days < 0) return { border: 'border-danger', bg: 'bg-danger/5', text: 'text-danger', label: 'EXPIRÉ' };
    if (days <= 1) return { border: 'border-alert', bg: 'bg-alert/5', text: 'text-alert', label: 'URGENT' };
    return { border: 'border-success', bg: 'bg-success/5', text: 'text-success', label: 'CONFORME' };
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Enlarged Label Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-6"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -2 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.8, rotate: 2 }}
              className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence>
              </AnimatePresence>

              <ProductLabel product={selectedProduct} size="lg" />
              
              <div className="grid grid-cols-2 border-t border-gray-100">
                <button 
                  onClick={() => setShowRemoveConfirm(true)}
                  className="py-6 bg-danger text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Retirer
                </button>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="py-6 bg-gray-900 text-white font-black uppercase tracking-widest text-[10px]"
                >
                  Fermer
                </button>
              </div>

              {/* Remove Confirmation Overlay */}
              <AnimatePresence>
                {showRemoveConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-0 bg-white z-20 p-8 flex flex-col justify-center space-y-8"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">Retirer le produit</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pourquoi retirez-vous cet article ?</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <button 
                        onClick={() => handleRemove('used')}
                        className="w-full bg-success p-6 rounded-2xl text-white flex items-center gap-4 active:scale-95 transition-all"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <CheckCircle2 size={24} />
                        </div>
                        <div className="text-left">
                          <p className="font-black uppercase tracking-tight">Utilisé</p>
                          <p className="text-[9px] font-bold opacity-70 uppercase">Consommé en cuisine</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleRemove('discarded')}
                        className="w-full bg-danger p-6 rounded-2xl text-white flex items-center gap-4 active:scale-95 transition-all"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                          <Trash2 size={24} />
                        </div>
                        <div className="text-left">
                          <p className="font-black uppercase tracking-tight">Jeté</p>
                          <p className="text-[9px] font-bold opacity-70 uppercase">Périmé ou non conforme</p>
                        </div>
                      </button>
                    </div>

                    <button 
                      onClick={() => setShowRemoveConfirm(false)}
                      className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"
                    >
                      Annuler
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-50 space-y-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Toutes les Étiquettes</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Vue d'ensemble du stock</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Rechercher un produit..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold focus:outline-none border-2 border-transparent focus:border-primary/20 transition-all"
          />
        </div>

        {/* Zone Filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedZoneId('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
              selectedZoneId === 'all' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-gray-50 text-gray-400"
            )}
          >
            Tout
          </button>
          {zones.map(zone => (
            <button
              key={zone.id}
              onClick={() => setSelectedZoneId(zone.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2",
                selectedZoneId === zone.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-gray-50 text-gray-400"
              )}
            >
              <span>{zone.icon}</span>
              {zone.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        <div className="grid grid-cols-1 gap-6">
          {filteredProducts.map((product) => {
            const days = getDaysRemaining(product.dlc);
            const status = getStatusColor(days);
            return (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative cursor-pointer active:scale-[0.98] transition-all",
                  status.border
                )}
                onClick={() => setSelectedProduct(product)}
              >
                <ProductLabel product={product} />
              </motion.div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-20 text-center space-y-2">
              <p className="text-sm text-gray-400 font-medium">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
