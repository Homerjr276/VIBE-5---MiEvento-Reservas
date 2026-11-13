export const PRICES = Object.freeze({
  silla: 15,
  mesa: 120,
  decoracion: 800,
  entrega: 250,
});

export const INVENTORY_LIMITS = Object.freeze({
  sillas: 120,
  mesas: 12,
});

const ACTIVE_STATES = new Set(["Pendiente", "Confirmada"]);

export function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function assertQuantity(quantity, label) {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new TypeError(`${label} debe ser un entero no negativo.`);
  }
}

export function calculateQuote({ sillas, mesas, decoracion, entrega }) {
  assertQuantity(sillas, "La cantidad de sillas");
  assertQuantity(mesas, "La cantidad de mesas");

  const subtotal =
    sillas * PRICES.silla +
    mesas * PRICES.mesa +
    (decoracion ? PRICES.decoracion : 0);
  const descuento = subtotal >= 2000 ? roundCurrency(subtotal * 0.1) : 0;
  const costoEntrega = entrega ? PRICES.entrega : 0;
  const total = roundCurrency(subtotal - descuento + costoEntrega);

  return {
    subtotal,
    descuento,
    entrega: costoEntrega,
    total,
    anticipoMinimo: roundCurrency(total * 0.3),
  };
}

export function calculateAvailability(fecha, reservas) {
  if (!Array.isArray(reservas)) {
    throw new TypeError("Las reservas deben ser una lista.");
  }

  let sillasOcupadas = 0;
  let mesasOcupadas = 0;

  if (fecha) {
    for (const reserva of reservas) {
      if (!reserva || reserva.fecha !== fecha || !ACTIVE_STATES.has(reserva.estado)) continue;
      assertQuantity(reserva.sillas, "Las sillas de una reserva guardada");
      assertQuantity(reserva.mesas, "Las mesas de una reserva guardada");
      sillasOcupadas += reserva.sillas;
      mesasOcupadas += reserva.mesas;
    }
  }

  return {
    sillasOcupadas,
    mesasOcupadas,
    sillasDisponibles: Math.max(0, INVENTORY_LIMITS.sillas - sillasOcupadas),
    mesasDisponibles: Math.max(0, INVENTORY_LIMITS.mesas - mesasOcupadas),
  };
}

export function getAvailabilityIssues(availability, sillasSolicitadas, mesasSolicitadas) {
  assertQuantity(sillasSolicitadas, "La cantidad solicitada de sillas");
  assertQuantity(mesasSolicitadas, "La cantidad solicitada de mesas");

  const issues = [];
  if (sillasSolicitadas > availability.sillasDisponibles) {
    issues.push({
      articulo: "sillas",
      solicitadas: sillasSolicitadas,
      disponibles: availability.sillasDisponibles,
      faltan: sillasSolicitadas - availability.sillasDisponibles,
    });
  }
  if (mesasSolicitadas > availability.mesasDisponibles) {
    issues.push({
      articulo: "mesas",
      solicitadas: mesasSolicitadas,
      disponibles: availability.mesasDisponibles,
      faltan: mesasSolicitadas - availability.mesasDisponibles,
    });
  }
  return issues;
}
