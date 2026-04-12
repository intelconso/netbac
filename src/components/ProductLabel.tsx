import React from 'react';
import { 
  Flame, 
  PackageOpen, 
  Snowflake, 
  Truck, 
  User, 
  Thermometer, 
  Calendar,
  Clock,
  Hash,
  MapPin
} from 'lucide-react';
import { Product, ActionType } from '../types';
import { formatDate, getDayColor, cn } from '../lib/utils';
import { useStore } from '../lib/store';

interface ProductLabelProps {
  product: Product;
  size?: 'sm' | 'lg';
  className?: string;
}

export default function ProductLabel({ product, size = 'sm', className }: ProductLabelProps) {
  const { zones, storageUnits, shelves, bacs } = useStore();
  const dayColor = getDayColor(product.addedAt);
  
  // Resolve location path
  const bac = bacs.find(b => b.id === product.bacId);
  const shelf = shelves.find(s => s.id === bac?.shelfId);
  const unit = storageUnits.find(u => u.id === shelf?.unitId);
  const zone = zones.find(z => z.id === unit?.zoneId);

  const locationPath = unit && shelf && bac 
    ? `${unit.name} • ${shelf.name} • ${bac.name}`
    : 'Emplacement inconnu';

  const actions: { id: ActionType; label: string; icon: any }[] = [
    { id: 'cooked', label: 'Fabriqué', icon: Flame },
    { id: 'opened', label: 'Ouvert', icon: PackageOpen },
    { id: 'defrosted', label: 'Décongelé', icon: Snowflake },
    { id: 'received', label: 'Reçu', icon: Truck },
  ];

  const isLg = size === 'lg';

  return (
    <div className={cn(
      "bg-white relative overflow-hidden border-2 border-gray-200 shadow-sm transition-all",
      isLg ? "rounded-[2rem] p-8" : "rounded-2xl p-4",
      className
    )}>
      {/* Professional Day Color Bar */}
      <div 
        className={cn(
          "absolute top-0 left-0 bottom-0 w-3",
          isLg ? "w-6" : "w-3"
        )} 
        style={{ backgroundColor: dayColor }} 
      />

      {/* Thermal Print Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,#000_1px,#000_2px)]" />
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:4px_4px]" />

      <div className={cn("relative z-10 flex flex-col gap-4", isLg ? "pl-8" : "pl-4")}>
        {/* Header: Action Types (Checkboxes style) */}
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex gap-3">
            {actions.map((action) => (
              <div 
                key={action.id} 
                className={cn(
                  "flex flex-col items-center gap-1",
                  product.actionType === action.id ? "text-gray-900" : "text-gray-200"
                )}
              >
                <div className={cn(
                  "border-2 rounded flex items-center justify-center",
                  isLg ? "w-8 h-8" : "w-5 h-5",
                  product.actionType === action.id ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200"
                )}>
                  {product.actionType === action.id && <action.icon size={isLg ? 16 : 10} />}
                </div>
                <span className={cn("font-black uppercase tracking-tighter", isLg ? "text-[10px]" : "text-[7px]")}>
                  {action.label}
                </span>
              </div>
            ))}
          </div>
          <div className="text-right">
            <div className="flex flex-col items-end">
              <span className={cn("font-black text-primary uppercase tracking-tighter leading-none", isLg ? "text-sm" : "text-[10px]")}>
                NETBAC
              </span>
              <span className={cn("font-bold text-gray-400 uppercase tracking-widest", isLg ? "text-[8px]" : "text-[6px]")}>
                Digital Trace
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1">
              <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-xs" : "text-[8px]")}>
                Produit / Product
              </span>
              <h3 className={cn("font-black text-gray-900 uppercase tracking-tighter leading-tight break-words", isLg ? "text-5xl" : "text-2xl")}>
                {product.name}
              </h3>
            </div>
            <div className="text-right ml-4">
              <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-xs" : "text-[8px]")}>
                Quantité
              </span>
              <span className={cn("font-black text-gray-900 uppercase whitespace-nowrap", isLg ? "text-3xl" : "text-lg")}>
                {product.quantity} {product.unit}
              </span>
            </div>
          </div>

          {/* Location Info */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm">
              <MapPin size={isLg ? 18 : 14} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-[10px]" : "text-[7px]")}>
                Emplacement / Location
              </span>
              <p className={cn("font-black text-gray-900 uppercase truncate", isLg ? "text-sm" : "text-[9px]")}>
                {zone?.name && <span className="text-primary">{zone.name} • </span>}
                {locationPath}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1 text-gray-400">
                <Calendar size={isLg ? 14 : 10} />
                <span className={cn("font-bold uppercase tracking-widest", isLg ? "text-[10px]" : "text-[7px]")}>
                  Date {product.actionType === 'cooked' ? 'Fab.' : product.actionType === 'opened' ? 'Ouv.' : 'Rec.'}
                </span>
              </div>
              <span className={cn("font-black text-gray-900 block", isLg ? "text-2xl" : "text-sm")}>
                {formatDate(product.addedAt)}
              </span>
            </div>
            <div className={cn(
              "space-y-1 p-3 rounded-xl border-2",
              isLg ? "border-primary bg-primary text-white shadow-lg shadow-primary/20" : "border-primary bg-white text-primary"
            )}>
              <div className={cn("flex items-center gap-1", isLg ? "text-white/70" : "text-primary/60")}>
                <Clock size={isLg ? 14 : 10} />
                <span className={cn("font-bold uppercase tracking-widest", isLg ? "text-[10px]" : "text-[7px]")}>
                  DLC / Expiry
                </span>
              </div>
              <span className={cn("font-black block", isLg ? "text-2xl" : "text-sm")}>
                {formatDate(product.dlc)}
              </span>
            </div>
          </div>

          {/* Footer details */}
          <div className="flex justify-between items-end pt-2 border-t border-gray-100 gap-4">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div className="space-y-0.5">
                <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-[10px]" : "text-[6px]")}>
                  Opérateur
                </span>
                <div className="flex items-center gap-1">
                  <User size={isLg ? 12 : 8} className="text-gray-400" />
                  <span className={cn("font-black text-gray-900 uppercase truncate", isLg ? "text-xs" : "text-[8px]")}>
                    {product.preparerName || 'Admin'}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-[10px]" : "text-[6px]")}>
                  N° Lot
                </span>
                <div className="flex items-center gap-1">
                  <Hash size={isLg ? 12 : 8} className="text-gray-400" />
                  <span className={cn("font-black text-gray-900 uppercase truncate", isLg ? "text-xs" : "text-[8px]")}>
                    {product.batchNumber || '---'}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <span className={cn("font-bold text-gray-400 uppercase tracking-widest block", isLg ? "text-[10px]" : "text-[6px]")}>
                  Temp.
                </span>
                <div className="flex items-center gap-1">
                  <Thermometer size={isLg ? 12 : 8} className="text-gray-400" />
                  <span className={cn("font-black text-gray-900 uppercase truncate", isLg ? "text-xs" : "text-[8px]")}>
                    {product.temperature ? `${product.temperature}°C` : '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Barcode for Pro look */}
            <div className="flex flex-col items-center gap-1 opacity-20">
              <div className="flex gap-[1px] h-6 items-end">
                {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2].map((w, i) => (
                  <div key={i} className="bg-black" style={{ width: `${w}px`, height: `${Math.random() * 10 + 10}px` }} />
                ))}
              </div>
              <span className="text-[5px] font-mono font-bold tracking-tighter">NB-{product.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
