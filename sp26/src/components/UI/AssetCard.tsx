import { motion } from 'framer-motion';
import { MapPin, Clock, Tag, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Asset } from '../../../shared/types';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatCurrency } from '@/utils/format';

interface AssetCardProps {
  asset: Asset;
  onClick?: () => void;
  showLink?: boolean;
  delay?: number;
}

export function AssetCard({ asset, onClick, showLink = true, delay = 0 }: AssetCardProps) {
  const cardContent = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative h-40 bg-gradient-to-br from-primary-50 to-primary-100 overflow-hidden">
        {asset.imageUrl ? (
          <img
            src={asset.imageUrl}
            alt={asset.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 bg-white/60 rounded-2xl flex items-center justify-center">
              <Tag size={32} className="text-primary-600" />
            </div>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <StatusBadge status={asset.status} size="sm" animated />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-display text-lg font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
            {asset.name}
          </h3>
          {showLink && (
            <ChevronRight size={20} className="text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
          )}
        </div>

        <p className="text-sm text-gray-500 mb-3">
          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 text-xs mr-2">
            {asset.category}
          </span>
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400 flex-shrink-0" />
            <span className="line-clamp-1">{asset.location}</span>
          </div>
          
          {asset.lastInventoryAt && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} className="text-gray-400 flex-shrink-0" />
              <span>上次盘点: {formatDate(asset.lastInventoryAt)}</span>
            </div>
          )}

          {asset.purchasePrice && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium text-primary-600">
                {formatCurrency(asset.purchasePrice)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (showLink && !onClick) {
    return (
      <Link to={`/assets/${asset.uid}`} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
