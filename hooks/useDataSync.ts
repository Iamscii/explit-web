export default function useDataSync() {
  if (typeof window !== "undefined") {
    // 封装数据同步逻辑
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }
}

// 网络恢复，同步数据
function handleOnline() {
  console.log("网络恢复");
}

// 网络断开，切换到本地数据库操作
function handleOffline() {
  console.log("网络断开");
}
