import { motion } from 'framer-motion';
import { AssetStatus, AssetStatusLabels, AssetStatusColors } from '../../../shared/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: AssetStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export function StatusBadge({ status, size = 'md', animated = false }: StatusBadgeProps) {
  const label = AssetStatusLabels[status];
  const colorClass = AssetStatusColors[status];

  const badgeContent = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        colorClass,
        sizeClasses[size]
      )}
    >
      <span className={cn(
        'w-2 h-2 rounded-full',
        status === 'in_use' && 'bg-success-500',
        status === 'idle' && 'bg-gray-500',
        status === 'maintenance' && 'bg-warning-500',
        status === 'scrapped' && 'bg-danger-500',
      )} />
      {label}
    </span>
  );

  if (animated) {
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      >
        {badgeContent}
      </motion.span>
    );
  }

  return badgeContent;
}
