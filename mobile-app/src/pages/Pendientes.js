import useOfflineQueue from "../hooks/useOfflineQueue";
import { useEffect, useState } from "react";
import { enviarOT } from "../api";

export default function Pendientes() {
  const { obtenerPendientes, borrarPendiente } = useOfflineQueue();
  const [lista, setLista] = useState([]);

  async function cargar() {
    setLista(await obtenerPendientes());
  }

  useEffect(() => {
    cargar();
  }, []);

  async function enviar(id, data) {
    try {
      await enviarOT(data);
      await borrarPendiente(id);
      cargar();
      alert("Orden enviada correctamente");
    } catch (e) {
      alert("Error al enviar");
    }
  }

  return (
    <div className="page">
      <h2>Pendientes</h2>

      {lista.map((p) => (
        <div key={p.id} className="pending-card">
          <pre>{JSON.stringify(p.data, null, 2)}</pre>
          <button onClick={() => enviar(p.id, p.data)}>Enviar Ahora</button>
        </div>
      ))}

      {lista.length === 0 && <p>No hay órdenes pendientes.</p>}
    </div>
  );
}
