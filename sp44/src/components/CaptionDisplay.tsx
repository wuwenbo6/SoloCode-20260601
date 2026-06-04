import { useMeetingStore } from '@/store/meetingStore';

export default function CaptionDisplay() {
  const { captions, currentCaption, isCaptioning } = useMeetingStore();
  const visibleCaptions = captions.slice(-3);

  if (!isCaptioning) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-2xl w-full px-4">
      {visibleCaptions.map((caption) => (
        <div
          key={caption.id}
          className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg animate-fade-in"
        >
          <span className="text-[#00e5a0] text-xs font-semibold mr-2">
            {caption.speakerName}:
          </span>
          <span className="text-white text-sm">{caption.text}</span>
        </div>
      ))}
      {currentCaption && (
        <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
          <span className="text-white/70 text-sm italic">{currentCaption}</span>
          <span className="inline-block w-1.5 h-4 bg-[#00e5a0] ml-1 animate-pulse align-middle" />
        </div>
      )}
    </div>
  );
}
