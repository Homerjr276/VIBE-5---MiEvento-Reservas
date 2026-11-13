export const STORAGE_KEY = "mievento_reservas_v2";

export function createReservation(data) {
  return {
    id: data.id,
    cliente: data.cliente,
    fecha: data.fecha,
    sillas: data.sillas,
    mesas: data.mesas,
    decoracion: data.decoracion,
    entrega: data.entrega,
    subtotal: data.subtotal,
    descuento: data.descuento,
    total: data.total,
    anticipo: 0,
    saldo: data.total,
    estado: "Pendiente",
    creadoEn: new Date().toISOString(),
  };
}

export function getReservations() {
  let serialized;
  try {
    serialized = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    throw new Error("No se pudieron leer las reservas del almacenamiento local.", { cause: error });
  }

  if (serialized === null) return [];

  try {
    const reservations = JSON.parse(serialized);
    if (!Array.isArray(reservations)) {
      throw new TypeError("El contenido guardado no es una lista de reservas.");
    }
    return reservations;
  } catch (error) {
    throw new Error("Las reservas guardadas tienen un formato inválido.", { cause: error });
  }
}

export function saveReservations(reservations) {
  if (!Array.isArray(reservations)) {
    throw new TypeError("Las reservas deben guardarse como una lista.");
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  } catch (error) {
    throw new Error("No se pudieron guardar las reservas en el almacenamiento local.", { cause: error });
  }
}
