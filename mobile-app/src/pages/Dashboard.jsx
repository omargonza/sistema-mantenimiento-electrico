import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

export default function Dashboard() {
    const navigate = useNavigate();

    const [ordenes, setOrdenes] = useState(() => {
        const saved = localStorage.getItem("ot_historial");
        return saved ? JSON.parse(saved) : [];
    });

    const [filtroFecha, setFiltroFecha] = useState("");
    const [filtroTablero, setFiltroTablero] = useState("");

    const dataFiltrada = ordenes.filter((ot) => {
        const matchFecha = filtroFecha ? ot.fecha === filtroFecha : true;
        const matchTablero = filtroTablero
            ? ot.tablero.toLowerCase().includes(filtroTablero.toLowerCase())
            : true;

        return matchFecha && matchTablero;
    });

    return (
        <div className="page">
            <h2 className="titulo">Dashboard</h2>

            <div className="filtros-box">
                <div>
                    <label>Fecha</label>
                    <input
                        type="date"
                        value={filtroFecha}
                        onChange={(e) => setFiltroFecha(e.target.value)}
                    />
                </div>

                <div>
                    <label>Tablero</label>
                    <input
                        type="text"
                        placeholder="TI 1300..."
                        value={filtroTablero}
                        onChange={(e) => setFiltroTablero(e.target.value)}
                    />
                </div>
            </div>

            <div className="tabla-ot">
                {dataFiltrada.map((ot) => (
                    <div
                        key={ot.id}
                        className="fila-ot"
                        onClick={() => navigate(`/detalle/${ot.id}`)}
                    >
                        <div className="ot-linea">
                            <b>{ot.fecha}</b> – {ot.tablero}
                        </div>

                        <div className="ot-sub">{ot.ubicacion}</div>

                        <div className="ot-info">
                            <span className="ot-tec">{ot.tecnico}</span>
                            <span className="ot-veh">{ot.vehiculo}</span>
                        </div>
                    </div>
                ))}

                {dataFiltrada.length === 0 && (
                    <p className="sin-datos">No hay resultados.</p>
                )}
            </div>
        </div>
    );
}
