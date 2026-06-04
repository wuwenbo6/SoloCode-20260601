import { useWhiteboardStore } from "@/store/whiteboardStore";

export default function UserCursors() {
  const { cursors, userId, users } = useWhiteboardStore();

  const cursorEntries = Array.from(cursors.entries()).filter(([id]) => id !== userId);

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {cursorEntries.map(([id, data]) => {
        const user = users.find((u) => u.id === id);
        const color = user?.color || "#999";
        const name = user?.name || "Unknown";
        return (
          <div
            key={id}
            className="absolute transition-all duration-75"
            style={{
              left: data.x,
              top: data.y,
              transform: "translate(2px, 2px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M1 1L6 14L8 8L14 6L1 1Z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            <span
              className="absolute left-4 top-4 px-1.5 py-0.5 text-[10px] font-medium text-white rounded whitespace-nowrap"
              style={{ backgroundColor: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
