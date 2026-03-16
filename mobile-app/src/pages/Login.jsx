// src/pages/Login.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [legajo, setLegajo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [legajo, password]);

  const cleanLegajo = useMemo(() => String(legajo || "").trim(), [legajo]);
  const canSubmit = Boolean(cleanLegajo && password && !loading);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const currentLegajo = String(legajo || "").trim();
    const currentPassword = String(password || "");

    if (!currentLegajo || !currentPassword) {
      setError("Ingresá legajo y contraseña.");
      return;
    }

    setLoading(true);

    try {
      await login(currentLegajo, currentPassword);
      const nextPath = location.state?.from?.pathname || "/dashboard";
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err?.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-panel-page">
      <style>{`
        .login-panel-page {
          min-height: 100dvh;
          font-family: inherit;
          color: #f3f4f6;
          background:
            linear-gradient(180deg, #050505 0%, #0a0a0a 45%, #111111 100%);
        }

        .login-panel-shell {
          min-height: 100dvh;
          display: grid;
          align-items: center;
          padding: 14px;
        }

        .login-panel-grid {
          width: 100%;
          max-width: 1160px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .login-board,
        .login-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(180deg, #161616 0%, #0e0e0e 100%);
          box-shadow:
            0 18px 40px rgba(0,0,0,0.30),
            inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .login-board::before,
        .login-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto 0;
          height: 4px;
          background: linear-gradient(90deg, #f5f5f5 0%, #9ca3af 50%, #4b5563 100%);
        }

        .login-board {
          display: none;
          min-height: 640px;
          padding: 30px;
        }

        .login-board::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 34px 34px, 34px 34px;
          mask-image: linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.35));
          -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.35));
        }

        .login-board-content {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 26px;
        }

        .login-board-top {
          display: grid;
          gap: 22px;
        }

        .login-chip {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .login-chip-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34,197,94,0.35);
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .login-brand-logo {
          width: 82px;
          height: 82px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.10);
          background: linear-gradient(180deg, #212121 0%, #121212 100%);
          display: grid;
          place-items: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          flex-shrink: 0;
        }

        .login-brand-logo img {
          width: 46px;
          height: 46px;
          object-fit: contain;
        }

        .login-brand-text strong {
          display: block;
          font-size: 18px;
          line-height: 1.1;
          color: #fafafa;
          font-weight: 800;
        }

        .login-brand-text span {
          display: block;
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.45;
          color: #a1a1aa;
        }

        .login-title {
          margin: 0;
          max-width: 650px;
          font-size: clamp(32px, 4vw, 52px);
          line-height: 1.02;
          letter-spacing: -0.035em;
          color: #fafafa;
        }

        .login-desc {
          margin: 0;
          max-width: 600px;
          font-size: 16px;
          line-height: 1.72;
          color: #c4c4c8;
        }

        .login-board-bottom {
          display: grid;
          gap: 14px;
        }

        .login-circuit-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .login-circuit-box {
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          padding: 16px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }

        .login-circuit-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }

        .login-circuit-name {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
          color: #d1d5db;
        }

        .login-circuit-led {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34,197,94,0.35);
          flex-shrink: 0;
        }

        .login-circuit-box strong {
          display: block;
          margin-bottom: 6px;
          font-size: 21px;
          color: #f3f4f6;
        }

        .login-circuit-box span {
          display: block;
          font-size: 13px;
          line-height: 1.5;
          color: #aeb4bd;
        }

        .login-board-note {
          font-size: 13px;
          line-height: 1.6;
          color: #9ca3af;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 14px;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
        }

        .login-card-inner {
          padding: 20px 16px 18px;
        }

        .login-mobile-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .login-mobile-brand-box {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          background: linear-gradient(180deg, #222222 0%, #121212 100%);
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .login-mobile-brand-box img {
          width: 30px;
          height: 30px;
          object-fit: contain;
        }

        .login-mobile-brand-text strong {
          display: block;
          font-size: 14px;
          line-height: 1.2;
          color: #f5f5f5;
        }

        .login-mobile-brand-text span {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: #9ca3af;
        }

        .login-form-top {
          margin-bottom: 20px;
        }

        .login-form-logo {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.09);
          background: linear-gradient(180deg, #222222 0%, #121212 100%);
          display: grid;
          place-items: center;
          margin-bottom: 14px;
        }

        .login-form-logo img {
          width: 34px;
          height: 34px;
          object-fit: contain;
        }

        .login-form-title {
          margin: 0 0 8px;
          font-size: 29px;
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: #fafafa;
        }

        .login-form-subtitle {
          margin: 0;
          font-size: 14px;
          line-height: 1.65;
          color: #9ca3af;
        }

        .login-form {
          display: grid;
          gap: 15px;
        }

        .login-field {
          display: grid;
          gap: 8px;
        }

        .login-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .login-label {
          font-size: 14px;
          font-weight: 700;
          color: #e5e7eb;
        }

        .login-help {
          font-size: 12px;
          color: #9ca3af;
        }

        .login-input-wrap {
          position: relative;
        }

        .login-input {
          width: 100%;
          height: 52px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: linear-gradient(180deg, #0b0b0b 0%, #121212 100%);
          color: #fafafa;
          padding: 0 14px;
          outline: none;
          font-size: 15px;
          font-family: inherit;
          transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .login-input::placeholder {
          color: #6b7280;
        }

        .login-input:focus {
          border-color: rgba(255,255,255,0.18);
          box-shadow: 0 0 0 4px rgba(255,255,255,0.05);
          background: linear-gradient(180deg, #101010 0%, #161616 100%);
        }

        .login-password-input {
          padding-right: 52px;
        }

        .login-toggle {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: #d1d5db;
          cursor: pointer;
          font-size: 16px;
          transition: background .18s ease;
        }

        .login-toggle:hover {
          background: rgba(255,255,255,0.06);
        }

        .login-error {
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid rgba(248,113,113,0.20);
          background: rgba(127,29,29,0.18);
          color: #fecaca;
          font-size: 14px;
          line-height: 1.5;
        }

        .login-submit {
          width: 100%;
          height: 52px;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          font-family: inherit;
          font-size: 15px;
          font-weight: 800;
          color: #050505;
          background: linear-gradient(180deg, #f3f4f6 0%, #d1d5db 55%, #9ca3af 100%);
          box-shadow: 0 12px 24px rgba(0,0,0,0.22);
          transition: transform .18s ease, opacity .18s ease, filter .18s ease;
        }

        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        .login-submit:disabled {
          opacity: .58;
          cursor: not-allowed;
          transform: none;
        }

        .login-footer {
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .login-footer-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #d1d5db;
        }

        .login-footer-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34,197,94,0.35);
        }

        .login-footer-note {
          font-size: 12px;
          color: #8f949c;
        }

        @media (min-width: 940px) {
          .login-panel-shell {
            padding: 26px;
          }

          .login-panel-grid {
            grid-template-columns: minmax(0, 1.08fr) minmax(420px, 460px);
            gap: 20px;
          }

          .login-board {
            display: block;
          }

          .login-card {
            max-width: 100%;
          }

          .login-card-inner {
            padding: 30px 26px 24px;
          }

          .login-mobile-brand {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .login-panel-shell {
            padding: 10px;
          }

          .login-card-inner {
            padding: 18px 14px 16px;
          }

          .login-form-title {
            font-size: 26px;
          }

          .login-input,
          .login-submit {
            height: 50px;
          }
        }
      `}</style>

      <div className="login-panel-shell">
        <div className="login-panel-grid">
          <aside className="login-board" aria-hidden="true">
            <div className="login-board-content">
              <div className="login-board-top">
                <div className="login-chip">
                  <span className="login-chip-dot" />
                  tablero de acceso técnico
                </div>

                <div className="login-brand">
                  <div className="login-brand-logo">
                    <img src="/rayo.png" alt="Logo" />
                  </div>

                  <div className="login-brand-text">
                    <strong>Sistema de mantenimiento</strong>
                    <span>Operación, control y trazabilidad de campo</span>
                  </div>
                </div>

                <h1 className="login-title">
                  Acceso centralizado para equipos técnicos y supervisión
                  operativa
                </h1>

                <p className="login-desc">
                  Ingresá al sistema para gestionar órdenes de trabajo,
                  consultar historial de intervenciones, documentar tareas y
                  mantener un flujo operativo seguro y ordenado.
                </p>
              </div>

              <div className="login-board-bottom">
                <div className="login-circuit-grid">
                  <div className="login-circuit-box">
                    <div className="login-circuit-head">
                      <span className="login-circuit-name">Circuito OT</span>
                      <span className="login-circuit-led" />
                    </div>
                    <strong>Activo</strong>
                    <span>
                      Registro estructurado de tareas, materiales y
                      observaciones.
                    </span>
                  </div>

                  <div className="login-circuit-box">
                    <div className="login-circuit-head">
                      <span className="login-circuit-name">Circuito PDF</span>
                      <span className="login-circuit-led" />
                    </div>
                    <strong>Listo</strong>
                    <span>
                      Documentación disponible para control, archivo y
                      auditoría.
                    </span>
                  </div>

                  <div className="login-circuit-box">
                    <div className="login-circuit-head">
                      <span className="login-circuit-name">
                        Circuito acceso
                      </span>
                      <span className="login-circuit-led" />
                    </div>
                    <strong>Seguro</strong>
                    <span>
                      Uso exclusivo para personal autorizado y seguimiento
                      interno.
                    </span>
                  </div>
                </div>

                <div className="login-board-note">
                  Interfaz diseñada para uso diario en operación técnica, con
                  criterio mobile-first para técnicos en campo y visual sobria
                  para entorno industrial.
                </div>
              </div>
            </div>
          </aside>

          <section className="login-card">
            <div className="login-card-inner">
              <div className="login-mobile-brand">
                <div className="login-mobile-brand-box">
                  <img src="/rayo.png" alt="Logo" />
                </div>

                <div className="login-mobile-brand-text">
                  <strong>Sistema de mantenimiento</strong>
                  <span>Acceso corporativo</span>
                </div>
              </div>

              <div className="login-form-top">
                <div className="login-form-logo">
                  <img src="/rayo.png" alt="Logo" />
                </div>

                <h1 className="login-form-title">Iniciar sesión</h1>
                <p className="login-form-subtitle">
                  Ingresá tus credenciales para acceder a la plataforma
                  operativa.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field">
                  <div className="login-label-row">
                    <label htmlFor="legajo" className="login-label">
                      Legajo
                    </label>
                    <span className="login-help">Identificación interna</span>
                  </div>

                  <div className="login-input-wrap">
                    <input
                      id="legajo"
                      type="text"
                      inputMode="numeric"
                      autoComplete="username"
                      value={legajo}
                      onChange={(e) => setLegajo(e.target.value)}
                      placeholder="Ej: 1234"
                      className="login-input"
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div className="login-label-row">
                    <label htmlFor="password" className="login-label">
                      Contraseña
                    </label>
                    <span className="login-help">Acceso protegido</span>
                  </div>

                  <div className="login-input-wrap">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu contraseña"
                      className="login-input login-password-input"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="login-toggle"
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="login-error" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="login-submit"
                >
                  {loading ? "Ingresando..." : "Ingresar al sistema"}
                </button>

                <div className="login-footer">
                  <div className="login-footer-status">
                    <span className="login-footer-status-dot" />
                    Sistema operativo habilitado
                  </div>

                  <div className="login-footer-note">Personal autorizado</div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
