const refreshButton = document.querySelector("#refresh-dashboard");
const stats = document.querySelector("#stats");
const guestRows = document.querySelector("#guest-rows");
const guestSearch = document.querySelector("#guest-search");
const guestTypeFilter = document.querySelector("#guest-type-filter");
const guestSort = document.querySelector("#guest-sort");
const guestActionsHeading = document.querySelector("#guest-actions-heading");
const duplicateList = document.querySelector("#duplicate-list");
const editDialog = document.querySelector("#edit-guest-dialog");
const editForm = document.querySelector("#edit-guest-form");
const editMessage = document.querySelector("#edit-message");
const closeEditDialogButton = document.querySelector("#close-edit-dialog");
const loginForm = document.querySelector("#admin-login");
const loginMessage = document.querySelector("#login-message");
const adminArea = document.querySelector("#admin-area");
const adminControls = document.querySelectorAll(".admin-only");
const logoutButton = document.querySelector("#logout-admin");
const settingsForm = document.querySelector("#event-settings-form");
const settingsMessage = document.querySelector("#settings-message");
const ownerControls = document.querySelectorAll(".owner-only");
const currentUserLabel = document.querySelector("#current-user-label");
const usersList = document.querySelector("#users-list");
const broadcastForm = document.querySelector("#broadcast-form");
const broadcastMessage = document.querySelector("#broadcast-message");
const prepareWhatsAppButton = document.querySelector("#prepare-broadcast-whatsapp");
const whatsappRecipientList = document.querySelector("#whatsapp-recipient-list");

let dashboard = null;
let eventConfig = null;
let currentUser = null;

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  if (response.status === 401) {
    setAdminState(false);
    return;
  }

  dashboard = await response.json();
  eventConfig = dashboard.event;
  currentUser = dashboard.currentUser;
  fillSettingsForm();
  applyRoleVisibility();
  if (dashboard.permissions?.canViewUsers) await loadUsers();
  renderDashboard();
}

function renderDashboard() {
  renderStats();
  renderGuests();
  renderDuplicates();
  whatsappRecipientList.hidden = true;
  whatsappRecipientList.innerHTML = "";
}

function getWhatsAppRecipients() {
  const recipients = new Map();
  for (const guest of dashboard?.guests || []) {
    if (guest.eventId !== eventConfig?.id || guest.status !== "confirmed") continue;
    const phone = normalizePhone(guest.responsiblePhone);
    if (!phone) continue;
    const key = phone;
    if (!recipients.has(key)) {
      recipients.set(key, {
        phone,
        name: guest.responsibleName || guest.fullName,
      });
    }
  }
  return [...recipients.values()];
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 12 && digits.length <= 15 ? digits : "";
}

function getCampaignText(message, imageUrl = "") {
  const address = eventConfig?.address || "A confirmar";
  const mapQuery = eventConfig?.mapQuery || address;
  const mapUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : "A confirmar";
  return [
    message.trim(),
    "",
    `Data: ${eventConfig?.dateText || "A confirmar"}`,
    `Horário: ${eventConfig?.timeText || "A confirmar"}`,
    "Programação:",
    "13h — início festa",
    "13:30 às 15h — almoço",
    "15:00 — mesa de Hotdog",
    "16:30 — parabéns",
    "18h — encerramento",
    "Vá com roupa de banho!",
    `Endereço: ${address}`,
    `Mapa: ${mapUrl}`,
    ...(imageUrl ? [`Imagem do convite: ${imageUrl}`] : []),
  ].join("\n");
}

async function prepareWhatsAppBroadcast() {
  if (!broadcastForm.reportValidity()) return;
  const recipients = getWhatsAppRecipients();
  whatsappRecipientList.hidden = false;

  if (!recipients.length) {
    whatsappRecipientList.innerHTML = "<p>Nenhum convidado confirmado tem um número de telefone válido cadastrado.</p>";
    broadcastMessage.textContent = "";
    return;
  }

  let imageUrl = "";
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    try {
      const imageUrlPath = "/assets/convite-email.png?v=20260927-endereco-destacado";
      const imageResponse = await fetch(imageUrlPath, { method: "HEAD" });
      if (imageResponse.ok) imageUrl = new URL(imageUrlPath, window.location.origin).href;
    } catch {}
  }
  const message = getCampaignText(broadcastForm.elements.message.value, imageUrl);
  whatsappRecipientList.innerHTML = `
    <p><strong>${recipients.length}</strong> contato(s) têm um número cadastrado. Abra cada conversa e envie a mensagem manualmente:</p>
    ${recipients.map((recipient) => {
      const href = `https://wa.me/${recipient.phone}?text=${encodeURIComponent(message)}`;
      return `<div class="whatsapp-recipient"><span>${escapeHtml(recipient.name)} · ${escapeHtml(recipient.phone)}</span><a class="secondary link-button" href="${href}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a></div>`;
    }).join("")}
  `;
  broadcastMessage.textContent = "";
}

async function sendBroadcastEmail(event) {
  event.preventDefault();
  const recipients = new Set((dashboard?.guests || [])
    .filter((guest) => guest.eventId === eventConfig?.id && guest.status === "confirmed")
    .map((guest) => String(guest.responsibleEmail || "").trim().toLowerCase())
    .filter(Boolean));

  if (!recipients.size) {
    broadcastMessage.style.color = "#c73313";
    broadcastMessage.textContent = "Não há e-mails cadastrados para envio.";
    return;
  }

  const confirmed = window.confirm(`Enviar este e-mail individualmente para ${recipients.size} endereço(s)?`);
  if (!confirmed) return;

  const submitButton = document.querySelector("#send-broadcast-email");
  submitButton.disabled = true;
  broadcastMessage.style.color = "";
  broadcastMessage.textContent = "Enviando e-mails…";
  try {
    const response = await fetch("/api/broadcast/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: broadcastForm.elements.subject.value,
        message: broadcastForm.elements.message.value,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Não foi possível enviar a mensagem.");

    broadcastMessage.style.color = result.failedCount ? "#a66a00" : "#237a50";
    broadcastMessage.textContent = `Envio concluído: ${result.sentCount} enviado(s) e ${result.failedCount} falha(s), de ${result.recipientCount} destinatário(s).${result.imageEmbedded ? " A imagem do convite foi exibida no corpo do e-mail." : ""}`;
  } catch (error) {
    broadcastMessage.style.color = "#c73313";
    broadcastMessage.textContent = error.message || "Não foi possível enviar a mensagem.";
  } finally {
    submitButton.disabled = false;
  }
}

function renderStats() {
  const items = [
    ["Confirmacoes", dashboard.totals.confirmations],
    ["Pessoas confirmadas", dashboard.totals.confirmedGuests],
    ["Adultos", dashboard.totals.confirmedAdults],
    ["Criancas", dashboard.totals.confirmedChildren],
    ["Nao comparecem", dashboard.totals.declinedGuests],
    ["Possiveis duplicados", dashboard.totals.possibleDuplicates],
  ];

  stats.innerHTML = items.map(([label, value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function renderGuests() {
  const query = normalizeText(guestSearch.value);
  const selectedType = guestTypeFilter.value;
  const guests = dashboard.guests.filter((guest) => {
    if (selectedType !== "all" && guest.type !== selectedType) return false;
    const haystack = normalizeText(`${guest.fullName} ${guest.responsibleName} ${guest.responsiblePhone} ${guest.responsibleEmail}`);
    return haystack.includes(query);
  });
  const compareNames = (first, second) => String(first || "").localeCompare(String(second || ""), "pt-BR", { sensitivity: "base" });
  guests.sort((first, second) => {
    const nameOrder = compareNames(first.fullName, second.fullName);
    const responsibleOrder = compareNames(first.responsibleName, second.responsibleName);

    switch (guestSort.value) {
      case "name-desc":
        return -nameOrder;
      case "responsible-asc":
        return responsibleOrder || nameOrder;
      case "adults-first":
        return (first.type === "child") - (second.type === "child") || nameOrder;
      case "children-first":
        return (second.type === "child") - (first.type === "child") || nameOrder;
      default:
        return nameOrder;
    }
  });
  const canManage = Boolean(dashboard.permissions?.canManage);
  if (guestActionsHeading) guestActionsHeading.hidden = !canManage;

  guestRows.innerHTML =
    guests
      .map(
        (guest) => `
          <tr>
            <td data-label="Nome">${escapeHtml(guest.fullName)}</td>
            <td data-label="Tipo">${guest.type === "child" ? "Criança" : "Adulto"}</td>
            <td data-label="Responsável">${escapeHtml(guest.responsibleName)}</td>
            <td data-label="Telefone">${escapeHtml(guest.responsiblePhone || "-")}</td>
            <td data-label="E-mail">${escapeHtml(guest.responsibleEmail || "-")}</td>
            <td data-label="Status"><span class="badge ${guest.status === "declined" ? "warn" : ""}">${guest.status === "declined" ? "Nao vai" : "Confirmado"}</span></td>
            ${canManage ? `<td class="table-actions" data-label="Ações">
                <div class="table-action-buttons">
                  <button class="secondary small-action" type="button" data-edit-guest="${guest.id}">Editar</button>
                  <button class="danger small-action" type="button" data-delete-guest="${guest.id}">Excluir</button>
                </div>
              </td>` : ""}
          </tr>
        `,
      )
      .join("") || `<tr><td colspan="${canManage ? 7 : 6}">Nenhum convidado encontrado.</td></tr>`;

  if (canManage) {
    guestRows.querySelectorAll("[data-edit-guest]").forEach((button) => {
      button.addEventListener("click", () => openGuestEditor(button.dataset.editGuest));
    });
    guestRows.querySelectorAll("[data-delete-guest]").forEach((button) => {
      button.addEventListener("click", () => deleteGuest(button.dataset.deleteGuest));
    });
  }
}

function renderDuplicates() {
  duplicateList.innerHTML =
    dashboard.duplicateCandidates
      .map(
        (duplicate) => `
          <div class="duplicate-card">
            <span class="badge warn">Similaridade ${Math.round(duplicate.score * 100)}%</span>
            <p><strong>Novo:</strong> ${escapeHtml(duplicate.incomingName)}</p>
            <p><strong>Existente:</strong> ${escapeHtml(duplicate.existingName)}</p>
            <div class="duplicate-actions">
              <button class="primary" type="button" data-merge="${duplicate.id}">Mesclar</button>
              <button class="secondary" type="button" data-ignore="${duplicate.id}">Manter separado</button>
            </div>
          </div>
        `,
      )
      .join("") || `<p>Nenhuma duplicidade pendente.</p>`;

  duplicateList.querySelectorAll("[data-merge]").forEach((button) => {
    button.addEventListener("click", () => resolveDuplicate(button.dataset.merge, "merge"));
  });
  duplicateList.querySelectorAll("[data-ignore]").forEach((button) => {
    button.addEventListener("click", () => resolveDuplicate(button.dataset.ignore, "ignore"));
  });
}

async function resolveDuplicate(id, action) {
  await fetch("/api/duplicates/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  await loadDashboard();
}

async function checkSession() {
  const response = await fetch("/api/session");
  const session = await response.json();
  currentUser = session.user || null;
  setAdminState(Boolean(session.authenticated));
  if (session.authenticated) await loadDashboard();
}

async function loginAdmin(event) {
  event.preventDefault();

  const data = new FormData(loginForm);
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: data.get("username"), password: data.get("password") }),
  });
  const result = await response.json();

  if (!result.ok) {
    loginMessage.style.color = "#c73313";
    loginMessage.textContent = result.error || "Nao foi possivel entrar.";
    return;
  }

  loginForm.reset();
  loginMessage.textContent = "";
  currentUser = result.user;
  setAdminState(true);
  await loadDashboard();
}

async function logoutAdmin() {
  await fetch("/api/logout", { method: "POST" });
  dashboard = null;
  currentUser = null;
  setAdminState(false);
}

function setAdminState(authenticated) {
  loginForm.hidden = authenticated;
  adminArea.hidden = !authenticated;
  adminControls.forEach((element) => {
    element.hidden = !authenticated;
  });
  applyRoleVisibility();

  if (!authenticated) {
    stats.innerHTML = "";
    guestRows.innerHTML = "";
    duplicateList.innerHTML = "";
    usersList.innerHTML = "";
    broadcastMessage.textContent = "";
    whatsappRecipientList.innerHTML = "";
    whatsappRecipientList.hidden = true;
  }
}

function applyRoleVisibility() {
  const canViewOwnerAreas = currentUser?.role === "owner" || dashboard?.permissions?.canViewSettings || dashboard?.permissions?.canViewUsers;
  ownerControls.forEach((element) => {
    element.hidden = !canViewOwnerAreas;
  });

  if (currentUserLabel) {
    currentUserLabel.textContent = currentUser ? `Logado como ${currentUser.label} (${currentUser.username})` : "";
  }
}

async function loadUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) return;
  const payload = await response.json();

  usersList.innerHTML = payload.users
    .map(
      (user) => `
        <div class="user-card">
          <strong>${escapeHtml(user.label)}</strong>
          <span>${escapeHtml(user.username)} - ${user.role === "owner" ? "Acesso total" : "Visualizacao"}</span>
        </div>
      `,
    )
    .join("");
}

function fillSettingsForm() {
  if (!eventConfig || !settingsForm) return;

  settingsForm.elements.title.value = eventConfig.title || "";
  settingsForm.elements.description.value = eventConfig.description || "";
  settingsForm.elements.date.value = eventConfig.date || "";
  settingsForm.elements.dateText.value = eventConfig.dateText || "";
  settingsForm.elements.timeText.value = eventConfig.timeText || "";
  settingsForm.elements.venueName.value = eventConfig.venueName || "";
  settingsForm.elements.address.value = eventConfig.address || "";
  settingsForm.elements.mapQuery.value = eventConfig.mapQuery || "";
  settingsForm.elements.whatsappNumber.value = eventConfig.whatsappNumber || "";
  settingsForm.elements.whatsappMessage.value = eventConfig.whatsappMessage || "";
  settingsForm.elements.maxCompanions.value = eventConfig.maxCompanions ?? 0;
  settingsForm.elements.allowChildren.checked = Boolean(eventConfig.allowChildren);
  settingsForm.elements.successMessage.value = eventConfig.successMessage || "";
}

async function saveEventSettings(event) {
  event.preventDefault();

  const data = new FormData(settingsForm);
  const payload = {
    title: data.get("title"),
    description: data.get("description"),
    date: data.get("date"),
    dateText: data.get("dateText"),
    timeText: data.get("timeText"),
    venueName: data.get("venueName"),
    address: data.get("address"),
    mapQuery: data.get("mapQuery"),
    whatsappNumber: data.get("whatsappNumber"),
    whatsappMessage: data.get("whatsappMessage"),
    maxCompanions: data.get("maxCompanions"),
    allowChildren: data.get("allowChildren") === "on",
    successMessage: data.get("successMessage"),
  };

  const response = await fetch("/api/event", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!result.ok) {
    settingsMessage.style.color = "#c73313";
    settingsMessage.textContent = result.error || "Nao foi possivel salvar.";
    return;
  }

  settingsMessage.style.color = "#237a50";
  settingsMessage.textContent = "Configuracoes salvas.";
  eventConfig = result.event;
}

async function deleteGuest(id) {
  const guest = dashboard.guests.find((item) => item.id === id);
  const name = guest?.fullName || "este convidado";
  const confirmed = window.confirm(`Excluir ${name} da lista?`);
  if (!confirmed) return;

  await fetch(`/api/guests/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadDashboard();
}

function openGuestEditor(id) {
  const guest = dashboard.guests.find((item) => item.id === id);
  if (!guest || !editDialog) return;

  editMessage.textContent = "";
  editForm.elements.guestId.value = guest.id;
  editForm.elements.fullName.value = guest.fullName;
  editForm.elements.type.value = guest.type === "child" ? "child" : "adult";
  editForm.elements.status.value = guest.status === "declined" ? "declined" : "confirmed";
  editDialog.showModal();
}

async function saveGuestEdit(event) {
  event.preventDefault();

  const data = new FormData(editForm);
  const guestId = data.get("guestId");
  const payload = {
    fullName: data.get("fullName"),
    type: data.get("type"),
    status: data.get("status"),
  };

  const response = await fetch(`/api/guests/${encodeURIComponent(guestId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!result.ok) {
    editMessage.style.color = "#c73313";
    editMessage.textContent = result.error || "Nao foi possivel editar.";
    return;
  }

  editDialog.close();
  await loadDashboard();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

refreshButton.addEventListener("click", loadDashboard);
guestSearch.addEventListener("input", renderGuests);
guestTypeFilter.addEventListener("change", renderGuests);
guestSort.addEventListener("change", renderGuests);
editForm.addEventListener("submit", saveGuestEdit);
closeEditDialogButton.addEventListener("click", () => editDialog.close());
loginForm.addEventListener("submit", loginAdmin);
logoutButton.addEventListener("click", logoutAdmin);
settingsForm.addEventListener("submit", saveEventSettings);
broadcastForm.addEventListener("submit", sendBroadcastEmail);
prepareWhatsAppButton.addEventListener("click", prepareWhatsAppBroadcast);

checkSession();
