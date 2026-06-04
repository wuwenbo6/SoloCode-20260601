import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, X, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NFCScanButtonProps {
  isScanning: boolean;
  isSupported: boolean;
  isAvailable: boolean;
  scanSuccess?: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'md' | 'lg' | 'xl';
  label?: string;
}

const sizeConfig = {
  md: {
    button: 'w-32 h-32',
    icon: 48,
    ripple: 'w-32 h-32',
  },
  lg: {
    button: 'w-40 h-40',
    icon: 56,
    ripple: 'w-40 h-40',
  },
  xl: {
    button: 'w-48 h-48',
    icon: 64,
    ripple: 'w-48 h-48',
  },
};

export function NFCScanButton({
  isScanning,
  isSupported,
  isAvailable,
  scanSuccess = false,
  onClick,
  disabled = false,
  size = 'xl',
  label,
}: NFCScanButtonProps) {
  const config = sizeConfig[size];

  const buttonClass = cn(
    'relative rounded-full flex items-center justify-center transition-all duration-300',
    config.button,
    isScanning
      ? 'bg-gradient-to-br from-success-500 to-success-600 shadow-lg shadow-success-500/40'
      : !isSupported || !isAvailable
        ? 'bg-gray-300 cursor-not-allowed'
        : scanSuccess
          ? 'bg-gradient-to-br from-success-500 to-success-600 shadow-lg shadow-success-500/40'
          : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105 active:scale-95 cursor-pointer'
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={onClick}
        disabled={disabled || !isSupported || !isAvailable}
        className={buttonClass}
      >
        <AnimatePresence mode="wait">
          {isScanning && (
            <>
              <motion.div
                key="ripple1"
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                className={cn(
                  'absolute rounded-full bg-white/30',
                  config.ripple
                )}
              />
              <motion.div
                key="ripple2"
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                className={cn(
                  'absolute rounded-full bg-white/20',
                  config.ripple
                )}
              />
            </>
          )}

          {scanSuccess ? (
            <motion.div
              key="success"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <CheckCircle size={config.icon} className="text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="icon"
              initial={{ scale: 1 }}
              animate={isScanning ? { rotate: 360 } : { rotate: 0 }}
              transition={isScanning ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
            >
              {isScanning ? (
                <ScanLine size={config.icon} className="text-white animate-pulse" />
              ) : (
                <ScanLine size={config.icon} className="text-white" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <div className="text-center space-y-1">
        <motion.p
          key={label || (isScanning ? 'scanning' : scanSuccess ? 'success' : 'ready')}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className={cn(
            'font-medium text-lg',
            !isSupported || !isAvailable ? 'text-gray-400' : 'text-gray-700'
          )}
        >
          {label || (
            !isSupported ? 'NFC不受支持' :
            !isAvailable ? 'NFC不可用' :
            isScanning ? '正在扫描...' :
            scanSuccess ? '扫描成功!' :
            '点击开始扫描'
          )}
        </motion.p>
        
        {!isScanning && isSupported && isAvailable && !scanSuccess && (
          <p className="text-sm text-gray-500">
            将手机背部靠近NFC标签
          </p>
        )}
      </div>
    </div>
  );
}
