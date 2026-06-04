import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface DeviceSelectorProps {
  kind: 'videoinput' | 'audioinput' | 'audiooutput';
  label: string;
  onSelect: (deviceId: string) => void;
}

export default function DeviceSelector({ kind, label, onSelect }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const filtered = all.filter((d) => d.kind === kind);
        setDevices(filtered);
        if (filtered.length > 0 && !selected) {
          setSelected(filtered[0].deviceId);
          onSelect(filtered[0].deviceId);
        }
      } catch {
        // permissions not granted
      }
    };
    load();

    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', load);
    };
  }, [kind, onSelect, selected]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/80 hover:bg-white/10 transition-colors"
      >
        <span className="truncate">{selected ? devices.find((d) => d.deviceId === selected)?.label || label : label}</span>
        <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#111633] border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto scrollbar-thin">
          {devices.length === 0 && (
            <div className="px-3 py-2 text-sm text-white/40">No devices found</div>
          )}
          {devices.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => {
                setSelected(d.deviceId);
                onSelect(d.deviceId);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors truncate ${
                d.deviceId === selected ? 'text-[#00e5a0]' : 'text-white/70'
              }`}
            >
              {d.label || `${label} (${d.deviceId.slice(0, 8)})`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
