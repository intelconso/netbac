import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, History, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../lib/store';
import { cn, formatDate } from '../lib/utils';
import { motion } from 'framer-motion';

export default function HistoryScreen() {
  const navigate = useNavigate();
  const { products, bacs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const archivedProducts = products
    .filter(p => p.status !== 'active')
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  const filteredProducts = archivedProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-50 space-y-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none tracking-tight uppercase">Historique</h1>
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Produits utilisés ou jetés</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Rechercher dans l'historique..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold focus:outline-none border-2 border-transparent focus:border-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const bac = bacs.find(b => b.id === product.bacId);
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4"
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-xl",
                  product.status === 'used' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}>
                  {product.status === 'used' ? <CheckCircle2 size={24} /> : <Trash2 size={24} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-gray-900 truncate uppercase">{product.name}</h3>
                    <span className={cn(
                      "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter",
                      product.status === 'used' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                    )}>
                      {product.status === 'used' ? 'Utilisé' : 'Jeté'}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                    {bac?.name || 'Inconnu'} • {formatDate(product.modifiedAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-900">{product.quantity} {product.unit}</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Lot: {product.batchNumber || 'N/A'}</p>
                </div>
              </motion.div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                <History size={32} />
              </div>
              <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">Aucun historique disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
