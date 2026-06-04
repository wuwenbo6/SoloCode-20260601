import { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';

interface EncryptionBadgeProps {
  isEncrypted: boolean;
  fingerprint?: string;
}

export default function EncryptionBadge({ isEncrypted, fingerprint }: EncryptionBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer select-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {isEncrypted ? (
        <>
          <Lock className="w-3.5 h-3.5 text-[#00e5a0]" />
          <span className="text-[#00e5a0]">E2E Encrypted</span>
          <div className="absolute inset-0 rounded-full bg-[#00e5a0]/10" />
        </>
      ) : (
        <>
          <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400">Verifying...</span>
          <div className="absolute inset-0 rounded-full bg-yellow-400/10" />
        </>
      )}

      {showTooltip && fingerprint && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#111633] border border-white/10 rounded-lg px-3 py-2 text-[10px] font-mono text-white/70 whitespace-nowrap z-50 shadow-xl">
          Key: {fingerprint}
        </div>
      )}
    </div>
  );
}
