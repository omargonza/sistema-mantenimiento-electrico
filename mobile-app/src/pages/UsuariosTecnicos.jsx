import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  Wrench,
  X,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
} from "../api";
import "../styles/usuarios-tecnicos.css";

const EMPTY_FORM = {
  id: null,
  legajo: "",
  email: "",
  password: "",
  nombre_completo: "",
  role: "technician",
  is_active: true,
  is_staff: false,
};

function normalizeError(err) {
  if (!err) return "Ocurrió un error inesperado.";

  if (typeof err?.body === "object" && err?.body !== null) {
    const firstKey = Object.keys(err.body)[0];
    const firstVal = err.body[firstKey];

    if (Array.isArray(firstVal) && firstVal.length > 0) {
      return String(firstVal[0]);
    }
    if (typeof firstVal === "string") {
      return firstVal;
    }
    if (typeof err.body.detail === "string") {
      return err.body.detail;
    }
  }

  return err.message || "Ocurrió un error inesperado.";
}

export default function UsuariosTecnicos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const data = await adminListUsers({
        search,
        role: roleFilter,
        includeDeleted,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    let admins = 0;
    let technicians = 0;
    let inactive = 0;

    for (const u of items) {
      if (u?.profile?.role === "admin") admins += 1;
      else technicians += 1;

      if (!u?.is_active || u?.profile?.is_soft_deleted) inactive += 1;
    }

    return {
      total: items.length,
      admins,
      technicians,
      inactive,
    };
  }, [items]);

  const openCreate = () => {
    setEditing(false);
    setShowPassword(false);
    setForm({
      ...EMPTY_FORM,
      role: "technician",
      is_staff: false,
      is_active: true,
    });
    setErrorMsg("");
    setSuccessMsg("");
    setDrawerOpen(true);
  };

  const openEdit = (user) => {
    const role =
      user?.profile?.role || (user?.is_staff ? "admin" : "technician");

    setEditing(true);
    setShowPassword(false);
    setForm({
      id: user.id,
      legajo: user.legajo || "",
      email: user.email || "",
      password: "",
      nombre_completo: user?.profile?.nombre_completo || "",
      role,
      is_active: !!user.is_active,
      is_staff: role === "admin",
    });
    setErrorMsg("");
    setSuccessMsg("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setShowPassword(false);
    setForm(EMPTY_FORM);
  };

  const updateField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "role") {
        next.is_staff = value === "admin";
      }

      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (editing) {
        const payload = {
          legajo: form.legajo.trim(),
          email: form.email.trim(),
          nombre_completo: form.nombre_completo.trim(),
          role: form.role,
          is_active: !!form.is_active,
          is_staff: form.role === "admin",
        };

        if (form.password.trim()) {
          payload.password = form.password.trim();
        }

        await adminUpdateUser(form.id, payload);
        setSuccessMsg("Usuario actualizado correctamente.");
      } else {
        const payload = {
          legajo: form.legajo.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          nombre_completo: form.nombre_completo.trim(),
          role: form.role,
          is_active: !!form.is_active,
          is_staff: form.role === "admin",
        };

        await adminCreateUser(payload);
        setSuccessMsg("Usuario creado correctamente.");
      }

      await loadUsers();
      setDrawerOpen(false);
      setShowPassword(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setErrorMsg(normalizeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    const nombre =
      user?.profile?.nombre_completo || user?.legajo || "este usuario";
    const ok = window.confirm(
      `¿Seguro que querés desactivar a ${nombre}? Esta acción lo deja sin acceso.`,
    );
    if (!ok) return;

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await adminDeleteUser(user.id);
      setSuccessMsg("Usuario desactivado correctamente.");
      await loadUsers();
    } catch (err) {
      setErrorMsg(normalizeError(err));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    await loadUsers();
  };

  return (
    <div className="page usuarios-page">
      <div className="card usuarios-hero">
        <div className="usuarios-hero__badge">
          <span className="usuarios-hero__badge-dot" />
          Administración de accesos
        </div>

        <div className="usuarios-hero__head">
          <div>
            <h2 className="titulo usuarios-hero__title">Usuarios técnicos</h2>
            <p className="usuarios-hero__text">
              Alta, edición, desactivación y control de cuentas del sistema.
            </p>
          </div>

          <div className="usuarios-hero__actions">
            <button type="button" className="btn-outline" onClick={loadUsers}>
              <RefreshCw size={16} strokeWidth={2.2} />
              <span>Actualizar</span>
            </button>

            <button type="button" className="btn-primary" onClick={openCreate}>
              <UserPlus size={16} strokeWidth={2.2} />
              <span>Nuevo usuario</span>
            </button>
          </div>
        </div>
      </div>

      <div className="usuarios-kpis">
        <div className="card usuarios-kpi">
          <div className="usuarios-kpi__label">Total</div>
          <div className="usuarios-kpi__value">{totals.total}</div>
        </div>

        <div className="card usuarios-kpi">
          <div className="usuarios-kpi__label">Admins</div>
          <div className="usuarios-kpi__value">{totals.admins}</div>
        </div>

        <div className="card usuarios-kpi">
          <div className="usuarios-kpi__label">Técnicos</div>
          <div className="usuarios-kpi__value">{totals.technicians}</div>
        </div>

        <div className="card usuarios-kpi">
          <div className="usuarios-kpi__label">Inactivos</div>
          <div className="usuarios-kpi__value">{totals.inactive}</div>
        </div>
      </div>

      <div className="card usuarios-filters">
        <form className="usuarios-filters__grid" onSubmit={handleSearch}>
          <div className="usuarios-field">
            <label className="usuarios-label" htmlFor="usuarios-search">
              <Search size={14} strokeWidth={2.2} />
              <span>Buscar</span>
            </label>
            <input
              id="usuarios-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Legajo, email o nombre"
            />
          </div>

          <div className="usuarios-field">
            <label className="usuarios-label" htmlFor="usuarios-role">
              <Shield size={14} strokeWidth={2.2} />
              <span>Rol</span>
            </label>
            <select
              id="usuarios-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="admin">Administradores</option>
              <option value="technician">Técnicos</option>
            </select>
          </div>

          <label className="usuarios-check">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            <span>Incluir desactivados</span>
          </label>

          <div className="usuarios-filters__actions">
            <button type="submit" className="btn-outline">
              <Search size={16} strokeWidth={2.2} />
              <span>Buscar</span>
            </button>
          </div>
        </form>
      </div>

      {errorMsg ? (
        <div className="usuarios-alert usuarios-alert--error">{errorMsg}</div>
      ) : null}
      {successMsg ? (
        <div className="usuarios-alert usuarios-alert--ok">{successMsg}</div>
      ) : null}

      <div className="usuarios-list">
        {loading ? (
          <div className="card usuarios-empty">Cargando usuarios...</div>
        ) : items.length === 0 ? (
          <div className="card usuarios-empty">
            No hay usuarios para mostrar.
          </div>
        ) : (
          items.map((user) => {
            const role =
              user?.profile?.role || (user?.is_staff ? "admin" : "technician");
            const inactive = !user?.is_active || user?.profile?.is_soft_deleted;

            return (
              <div className="card usuario-card" key={user.id}>
                <div className="usuario-card__head">
                  <div className="usuario-card__identity">
                    <div className="usuario-card__name">
                      {user?.profile?.nombre_completo || "Sin nombre"}
                    </div>
                    <div className="usuario-card__meta">
                      <span>
                        Legajo: <strong>{user.legajo}</strong>
                      </span>
                      <span>
                        Email: <strong>{user.email || "—"}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="usuario-card__badges">
                    <span
                      className={`usuario-badge ${role === "admin" ? "admin" : "technician"}`}
                    >
                      {role === "admin" ? (
                        <>
                          <Shield size={14} strokeWidth={2.2} />
                          <span>Admin</span>
                        </>
                      ) : (
                        <>
                          <Wrench size={14} strokeWidth={2.2} />
                          <span>Técnico</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`usuario-badge ${inactive ? "inactive" : "active"}`}
                    >
                      {inactive ? "Inactivo" : "Activo"}
                    </span>
                  </div>
                </div>

                <div className="usuario-card__footer">
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => openEdit(user)}
                  >
                    <Pencil size={16} strokeWidth={2.2} />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    className="btn-outline btn-danger-soft"
                    onClick={() => handleDelete(user)}
                  >
                    <Trash2 size={16} strokeWidth={2.2} />
                    <span>Desactivar</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {drawerOpen ? (
        <div className="usuarios-drawer-backdrop" onClick={closeDrawer}>
          <div
            className="usuarios-drawer card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="usuarios-drawer__head">
              <div>
                <div className="subtitulo" style={{ marginTop: 0 }}>
                  {editing ? "Editar usuario" : "Nuevo usuario"}
                </div>
                <p className="usuarios-drawer__copy">
                  {editing
                    ? "Actualizá datos, rol, estado o contraseña."
                    : "Creá una nueva cuenta para operar en el sistema."}
                </p>
              </div>

              <button
                type="button"
                className="usuarios-icon-btn"
                onClick={closeDrawer}
                disabled={saving}
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <form className="usuarios-form" onSubmit={handleSubmit}>
              <div className="usuarios-form__grid">
                <div className="usuarios-field">
                  <label className="usuarios-label" htmlFor="form-legajo">
                    Legajo
                  </label>
                  <input
                    id="form-legajo"
                    type="text"
                    value={form.legajo}
                    onChange={(e) => updateField("legajo", e.target.value)}
                    required
                  />
                </div>

                <div className="usuarios-field">
                  <label className="usuarios-label" htmlFor="form-email">
                    Email
                  </label>
                  <input
                    id="form-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>

                <div className="usuarios-field usuarios-field--full">
                  <label className="usuarios-label" htmlFor="form-nombre">
                    Nombre completo
                  </label>
                  <input
                    id="form-nombre"
                    type="text"
                    value={form.nombre_completo}
                    onChange={(e) =>
                      updateField("nombre_completo", e.target.value)
                    }
                    required
                  />
                </div>

                <div className="usuarios-field">
                  <label className="usuarios-label" htmlFor="form-role">
                    Rol
                  </label>
                  <select
                    id="form-role"
                    value={form.role}
                    onChange={(e) => updateField("role", e.target.value)}
                  >
                    <option value="technician">Técnico</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="usuarios-field">
                  <label className="usuarios-label" htmlFor="form-password">
                    {editing ? "Nueva contraseña" : "Contraseña"}
                  </label>

                  <div className="usuarios-password-wrap">
                    <input
                      id="form-password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder={editing ? "Dejar vacío para no cambiar" : ""}
                      required={!editing}
                    />

                    <button
                      type="button"
                      className="usuarios-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={
                        showPassword ? "Ocultar contraseña" : "Ver contraseña"
                      }
                      aria-label={
                        showPassword ? "Ocultar contraseña" : "Ver contraseña"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={18} strokeWidth={2.2} />
                      ) : (
                        <Eye size={18} strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                </div>

                <label className="usuarios-check usuarios-check--full">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => updateField("is_active", e.target.checked)}
                  />
                  <span>Usuario activo</span>
                </label>
              </div>

              <div className="usuarios-form__actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={closeDrawer}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save size={16} strokeWidth={2.2} />
                  <span>
                    {saving
                      ? "Guardando..."
                      : editing
                        ? "Guardar cambios"
                        : "Crear usuario ahora"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
