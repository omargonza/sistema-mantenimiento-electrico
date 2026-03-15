// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { getAccessToken, getCurrentUser, login } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [legajo, setLegajo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const token = getAccessToken();
  const user = getCurrentUser();

  const isLogged = Boolean(token && user);

  useEffect(() => {
    setError("");
  }, [legajo, password]);

  if (isLogged) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cleanLegajo = String(legajo || "").trim();
    const cleanPassword = String(password || "");

    if (!cleanLegajo || !cleanPassword) {
      setError("Ingresá legajo y contraseña.");
      return;
    }

    setLoading(true);

    try {
      await login(cleanLegajo, cleanPassword);

      const nextPath = location.state?.from?.pathname || "/";
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-wrapper">
      <div
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#111827",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 16 }}>Ingresar</h1>

          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <label htmlFor="legajo">Legajo</label>
            <input
              id="legajo"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              value={legajo}
              onChange={(e) => setLegajo(e.target.value)}
              placeholder="Ej: 8174"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "#0b1220",
                color: "white",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,.12)",
                background: "#0b1220",
                color: "white",
              }}
            />
          </div>

          {error ? (
            <div
              style={{
                marginBottom: 14,
                padding: 10,
                borderRadius: 10,
                background: "rgba(220,38,38,.12)",
                border: "1px solid rgba(220,38,38,.25)",
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
