import useOfflineQueue from "../hooks/useOfflineQueue";
import "./banner.css";

export default function OfflineBanner() {
  const { online } = useOfflineQueue();

  if (online) return null;

  return <div className="offline-banner">Sin conexión</div>;
}
