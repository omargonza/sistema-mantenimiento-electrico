export function vibrar(ms = 25) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
