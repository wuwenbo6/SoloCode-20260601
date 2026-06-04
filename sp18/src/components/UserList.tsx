import { useWhiteboardStore } from "@/store/whiteboardStore";

export default function UserList() {
  const { users } = useWhiteboardStore();

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2">
        {users.slice(0, 4).map((user) => (
          <div
            key={user.id}
            className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] text-white font-medium"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0)}
          </div>
        ))}
        {users.length > 4 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-[10px] text-white font-medium">
            +{users.length - 4}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500 ml-2">{users.length} 人在线</span>
    </div>
  );
}
