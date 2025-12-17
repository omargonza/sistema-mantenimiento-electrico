export function vibrar(ms = 25) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
/* =======================================================
   FORMULARIO INICIAL
======================================================= */
export const initialForm = {
  fecha: new Date().toISOString().slice(0, 10),
  ubicacion: "",
  tablero: "",
  circuito: "",
  vehiculo: "",
  kmIni: "",
  kmFin: "",
  tecnicos: [{ legajo: "", nombre: "" }],
  materiales: [{ material: "", cant: "", unidad: "" }],
  tareaPedida: "",
  tareaRealizada: "",
  tareaPendiente: "",
  luminaria: "",

  // Auditoría / Legal
  observaciones: "",
  firmaTecnico: "",
  firmaSupervisor: "",

  // Firma digital (PNG base64)
  firmaTecnicoImg: "",

  // Fotos (JPG base64 comprimidas)
  fotosB64: [], // array de dataURL (jpg/png) máx 4


  // Para impresión B/N si querés (opcional)
  printMode: false,
};
