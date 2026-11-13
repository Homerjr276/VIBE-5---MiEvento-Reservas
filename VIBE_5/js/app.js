import { createReservation, getReservations, saveReservations, STORAGE_KEY } from "./storage.js";
import {
  calculateAvailability,
  calculateQuote,
  getAvailabilityIssues,
  roundCurrency,
} from "./calculations.js";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const form = document.querySelector("#reservation-form");
const customerInput = document.querySelector("#customer-name");
const eventDateInput = document.querySelector("#event-date");
const chairsInput = document.querySelector("#chairs");
const tablesInput = document.querySelector("#tables");
const decorationInput = document.querySelector("#decoration");
const deliveryInput = document.querySelector("#delivery");
const saveButton = document.querySelector("#save-reservation");
const formStatus = document.querySelector("#form-status");
const availabilityDate = document.querySelector("#availability-date");
const availableChairs = document.querySelector("#available-chairs");
const availableTables = document.querySelector("#available-tables");
const reservationsList = document.querySelector("#reservations-list");
const filterDateInput = document.querySelector("#filter-date");
const showAllButton = document.querySelector("#show-all");

let reservations = [];
let storageReady = false;
let isSaving = false;
let isUpdating = false;
let awaitingNewInput = false;
let activeAction = null;

function formatCurrency(amount) {
  return currency.format(amount);
}

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.valueOf()) && localDateString(date) === value;
}

function formatDate(value) {
  if (!isCalendarDate(value)) return value;
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function showMessage(message) {
  formStatus.textContent = message;
}

function readQuantity(input, label) {
  const value = input.value.trim();
  const quantity = value === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
    return { error: `${label}: ingresa un número entero igual o mayor que cero.` };
  }
  return { value: quantity };
}

function getQuantities() {
  const sillas = readQuantity(chairsInput, "Sillas");
  const mesas = readQuantity(tablesInput, "Mesas");
  if (sillas.error || mesas.error) return null;
  return { sillas: sillas.value, mesas: mesas.value };
}

function getQuoteInput() {
  const quantities = getQuantities();
  if (!quantities) return null;
  return {
    ...quantities,
    decoracion: decorationInput.checked,
    entrega: deliveryInput.checked,
  };
}

function updateQuote() {
  const input = getQuoteInput();
  const quote = input
    ? calculateQuote(input)
    : { subtotal: 0, descuento: 0, entrega: 0, total: 0, anticipoMinimo: 0 };

  document.querySelector("#subtotal").textContent = formatCurrency(quote.subtotal);
  document.querySelector("#discount").textContent = formatCurrency(quote.descuento);
  document.querySelector("#delivery-amount").textContent = formatCurrency(quote.entrega);
  document.querySelector("#total").textContent = formatCurrency(quote.total);
  document.querySelector("#minimum-deposit").textContent = formatCurrency(quote.anticipoMinimo);
}

function availabilityMessage(issues) {
  return issues
    .map(
      ({ articulo, solicitadas, disponibles, faltan }) =>
        `No hay suficientes ${articulo}: solicitas ${solicitadas}, quedan ${disponibles} disponibles (faltan ${faltan}).`,
    )
    .join(" ");
}

function updateAvailability() {
  const date = eventDateInput.value;
  const availability = calculateAvailability(date, reservations);
  availableChairs.textContent = String(availability.sillasDisponibles);
  availableTables.textContent = String(availability.mesasDisponibles);

  if (!date) {
    availabilityDate.textContent = "Selecciona la fecha del evento";
  } else {
    availabilityDate.textContent = `Disponibilidad para ${formatDate(date)}`;
    const quantities = getQuantities();
    if (quantities && (quantities.sillas > 0 || quantities.mesas > 0)) {
      const issues = getAvailabilityIssues(
        availability,
        quantities.sillas,
        quantities.mesas,
      );
      if (issues.length) {
        availabilityDate.textContent += ` · ${availabilityMessage(issues)}`;
      }
    }
  }
}

function updateQuoteAndAvailability() {
  updateQuote();
  updateAvailability();
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function makeActionButton(label, action, reservationId, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button table-action ${className}`.trim();
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.reservationId = reservationId;
  return button;
}

function renderReservations() {
  const filterDate = filterDateInput.value;
  const matchingReservations = filterDate
    ? reservations.filter((reservation) => reservation.fecha === filterDate)
    : reservations;
  reservationsList.replaceChildren();

  if (matchingReservations.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = filterDate
      ? "No hay reservas para la fecha seleccionada."
      : "Aún no hay reservas registradas.";
    row.append(cell);
    reservationsList.append(row);
    return;
  }

  for (const reservation of matchingReservations) {
    const row = document.createElement("tr");
    addCell(row, reservation.id);
    addCell(row, reservation.cliente);
    addCell(row, formatDate(reservation.fecha));
    addCell(row, formatCurrency(reservation.total));
    addCell(row, formatCurrency(reservation.anticipo));
    addCell(row, formatCurrency(reservation.saldo));

    const statusCell = addCell(row, "");
    const statusBadge = document.createElement("span");
    const statusClasses = {
      Pendiente: "status-pending",
      Confirmada: "status-confirmed",
      Cancelada: "status-cancelled",
    };
    statusBadge.className = `status ${statusClasses[reservation.estado] || ""}`.trim();
    statusBadge.textContent = reservation.estado;
    statusCell.append(statusBadge);

    const actionsCell = document.createElement("td");
    actionsCell.className = "actions-cell";
    if (
      reservation.estado === "Pendiente" &&
      activeAction?.id === reservation.id &&
      activeAction.type === "deposit"
    ) {
      const minimum = roundCurrency(reservation.total * 0.3);
      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.min = String(minimum);
      amountInput.max = String(reservation.total);
      amountInput.step = "0.01";
      amountInput.value = activeAction.value || "";
      amountInput.placeholder = `De ${formatCurrency(minimum)} a ${formatCurrency(reservation.total)}`;
      amountInput.className = "deposit-input";
      amountInput.dataset.depositAmount = "";
      amountInput.setAttribute("aria-label", `Anticipo para la reserva ${reservation.id}`);
      actionsCell.append(
        amountInput,
        makeActionButton("Guardar anticipo", "save-deposit", reservation.id),
        makeActionButton("Volver", "dismiss", reservation.id),
      );
    } else if (
      ["Pendiente", "Confirmada"].includes(reservation.estado) &&
      activeAction?.id === reservation.id &&
      activeAction.type === "cancel"
    ) {
      const confirmationText = document.createElement("span");
      confirmationText.className = "cancel-confirmation";
      confirmationText.textContent = "¿Cancelar esta reserva?";
      actionsCell.append(
        confirmationText,
        makeActionButton("Sí, cancelar", "confirm-cancel", reservation.id, "button-danger"),
        makeActionButton("No", "dismiss", reservation.id),
      );
    } else if (reservation.estado === "Pendiente") {
      actionsCell.append(
        makeActionButton("Registrar anticipo", "deposit", reservation.id),
        makeActionButton("Cancelar", "cancel", reservation.id, "button-danger"),
      );
    } else if (reservation.estado === "Confirmada") {
      actionsCell.append(makeActionButton("Cancelar", "cancel", reservation.id, "button-danger"));
    } else {
      actionsCell.textContent = "—";
    }
    row.append(actionsCell);
    reservationsList.append(row);
  }
}

function persistReservations(nextReservations) {
  saveReservations(nextReservations);
  reservations = nextReservations;
  renderReservations();
  updateAvailability();
}

function getReservationInput() {
  const cliente = customerInput.value.trim();
  if (!cliente) return { error: "Escribe el nombre del cliente; no puede quedar vacío." };

  const fecha = eventDateInput.value;
  if (!fecha || !isCalendarDate(fecha)) {
    return { error: "Selecciona una fecha válida para el evento." };
  }
  if (fecha < localDateString()) {
    return { error: "La fecha del evento no puede ser anterior a hoy." };
  }

  const sillas = readQuantity(chairsInput, "Sillas");
  if (sillas.error) return { error: sillas.error };
  const mesas = readQuantity(tablesInput, "Mesas");
  if (mesas.error) return { error: mesas.error };
  if (sillas.value + mesas.value < 1) {
    return { error: "La reserva debe incluir al menos una silla o una mesa." };
  }

  const cotizacion = calculateQuote({
    sillas: sillas.value,
    mesas: mesas.value,
    decoracion: decorationInput.checked,
    entrega: deliveryInput.checked,
  });

  return {
    value: {
      cliente,
      fecha,
      sillas: sillas.value,
      mesas: mesas.value,
      decoracion: decorationInput.checked,
      entrega: deliveryInput.checked,
      ...cotizacion,
    },
  };
}

function createReservationId(existingReservations) {
  const usedIds = new Set(existingReservations.map((reservation) => reservation.id));
  const highestId = existingReservations.reduce((highest, reservation) => {
    const match = /^RES-(\d+)$/.exec(reservation.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 1000);

  let candidateNumber = highestId + 1;
  while (usedIds.has(`RES-${candidateNumber}`)) candidateNumber += 1;
  return `RES-${candidateNumber}`;
}

function submitReservation(event) {
  event.preventDefault();
  if (isSaving || awaitingNewInput) return;

  const result = getReservationInput();
  if (result.error) {
    showMessage(result.error);
    const invalidInput =
      !customerInput.value.trim()
        ? customerInput
        : !eventDateInput.value || !isCalendarDate(eventDateInput.value) ||
            eventDateInput.value < localDateString()
          ? eventDateInput
          : chairsInput.validity.valid
            ? tablesInput
            : chairsInput;
    invalidInput.focus();
    return;
  }

  if (!storageReady) {
    showMessage("No se pueden guardar reservas porque el almacenamiento no está disponible.");
    return;
  }

  isSaving = true;
  saveButton.disabled = true;
  try {
    const currentAvailability = calculateAvailability(result.value.fecha, reservations);
    const currentIssues = getAvailabilityIssues(
      currentAvailability,
      result.value.sillas,
      result.value.mesas,
    );
    if (currentIssues.length) {
      showMessage(availabilityMessage(currentIssues));
      updateAvailability();
      return;
    }

    const latestReservations = getReservations();
    const latestAvailability = calculateAvailability(result.value.fecha, latestReservations);
    const latestIssues = getAvailabilityIssues(
      latestAvailability,
      result.value.sillas,
      result.value.mesas,
    );
    reservations = latestReservations;
    renderReservations();
    if (latestIssues.length) {
      showMessage(availabilityMessage(latestIssues));
      updateAvailability();
      return;
    }

    const reservation = createReservation({
      id: createReservationId(latestReservations),
      ...result.value,
    });
    persistReservations([...latestReservations, reservation]);
    form.reset();
    updateQuoteAndAvailability();
    awaitingNewInput = true;
    showMessage(`Reserva ${reservation.id} creada correctamente en estado Pendiente.`);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "No se pudo guardar la reserva.");
  } finally {
    isSaving = false;
    saveButton.disabled = !storageReady || awaitingNewInput;
  }
}

function openDepositEditor(reservationId, value = "") {
  activeAction = { id: reservationId, type: "deposit", value };
  renderReservations();
  const reservation = reservations.find((item) => item.id === reservationId);
  if (reservation) {
    showMessage(
      `Ingresa un anticipo entre ${formatCurrency(
        roundCurrency(reservation.total * 0.3),
      )} y ${formatCurrency(reservation.total)}.`,
    );
    reservationsList.querySelector("[data-deposit-amount]")?.focus();
  }
}

function beginDeposit(reservationId) {
  if (isUpdating) return;
  const reservation = reservations.find((item) => item.id === reservationId);
  if (!reservation || reservation.estado !== "Pendiente" || reservation.anticipo !== 0) {
    showMessage("Esta reserva ya no admite un anticipo.");
    return;
  }
  openDepositEditor(reservationId);
}

function registerDeposit(reservationId, input) {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (!reservation || reservation.estado !== "Pendiente" || reservation.anticipo !== 0) {
      showMessage("Esta reserva ya no admite un anticipo.");
      return;
    }

    const normalizedInput = input.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedInput)) {
      openDepositEditor(reservationId, input);
      showMessage("El anticipo debe ser un importe numérico con hasta dos decimales.");
      return;
    }

    const amount = Number(normalizedInput);
    const minimum = roundCurrency(reservation.total * 0.3);
    if (amount < minimum) {
      openDepositEditor(reservationId, input);
      showMessage(`El anticipo mínimo permitido es ${formatCurrency(minimum)}.`);
      return;
    }
    if (amount > reservation.total) {
      openDepositEditor(reservationId, input);
      showMessage(`El anticipo no puede ser mayor al total de ${formatCurrency(reservation.total)}.`);
      return;
    }

    const anticipo = roundCurrency(amount);
    const nextReservations = reservations.map((item) =>
      item.id === reservationId
        ? {
            ...item,
            anticipo,
            saldo: Math.max(0, roundCurrency(item.total - anticipo)),
            estado: "Confirmada",
          }
        : item,
    );
    persistReservations(nextReservations);
    activeAction = null;
    showMessage(`Anticipo registrado. La reserva ${reservationId} está Confirmada.`);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "No se pudo registrar el anticipo.");
  } finally {
    isUpdating = false;
    renderReservations();
  }
}

function beginCancellation(reservationId) {
  if (isUpdating) return;
  const reservation = reservations.find((item) => item.id === reservationId);
  if (!reservation || !["Pendiente", "Confirmada"].includes(reservation.estado)) {
    showMessage("Esta reserva ya no se puede cancelar.");
    return;
  }
  activeAction = { id: reservationId, type: "cancel" };
  renderReservations();
  showMessage("Confirma la cancelación en la fila de la reserva.");
}

function cancelReservation(reservationId) {
  if (isUpdating) return;
  isUpdating = true;
  try {
    const reservation = reservations.find((item) => item.id === reservationId);
    if (
      !reservation ||
      !["Pendiente", "Confirmada"].includes(reservation.estado)
    ) {
      showMessage("Esta reserva ya no se puede cancelar.");
      return;
    }

    const nextReservations = reservations.map((item) =>
      item.id === reservationId ? { ...item, estado: "Cancelada" } : item,
    );
    persistReservations(nextReservations);
    activeAction = null;
    showMessage(`La reserva ${reservationId} fue cancelada y liberó el inventario.`);
  } catch (error) {
    showMessage(error instanceof Error ? error.message : "No se pudo cancelar la reserva.");
  } finally {
    isUpdating = false;
    renderReservations();
  }
}

function handleReservationAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || !reservationsList.contains(button)) return;

  const reservationId = button.dataset.reservationId;
  if (button.dataset.action === "deposit") {
    beginDeposit(reservationId);
  } else if (button.dataset.action === "save-deposit") {
    const amountInput = button.closest("tr").querySelector("[data-deposit-amount]");
    registerDeposit(reservationId, amountInput.value);
  } else if (button.dataset.action === "cancel") {
    beginCancellation(reservationId);
  } else if (button.dataset.action === "confirm-cancel") {
    cancelReservation(reservationId);
  } else if (button.dataset.action === "dismiss") {
    activeAction = null;
    renderReservations();
    showMessage("");
  }
}

function initialize() {
  eventDateInput.min = localDateString();
  const handleFormChange = () => {
    if (awaitingNewInput) {
      awaitingNewInput = false;
      saveButton.disabled = !storageReady;
    }
    showMessage("");
    updateQuoteAndAvailability();
  };
  form.addEventListener("input", handleFormChange);
  form.addEventListener("change", handleFormChange);
  form.addEventListener("submit", submitReservation);
  reservationsList.addEventListener("click", handleReservationAction);
  filterDateInput.addEventListener("change", renderReservations);
  showAllButton.addEventListener("click", () => {
    filterDateInput.value = "";
    renderReservations();
  });

  try {
    reservations = getReservations();
    storageReady = true;
  } catch (error) {
    storageReady = false;
    showMessage(error instanceof Error ? error.message : "No se pudieron cargar las reservas.");
  }

  saveButton.disabled = !storageReady;
  renderReservations();
  updateQuoteAndAvailability();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    try {
      reservations = getReservations();
      storageReady = true;
      saveButton.disabled = false;
      renderReservations();
      updateAvailability();
    } catch (error) {
      storageReady = false;
      saveButton.disabled = true;
      showMessage(error instanceof Error ? error.message : "No se pudieron actualizar las reservas.");
    }
  });
}

document.addEventListener("DOMContentLoaded", initialize, { once: true });
