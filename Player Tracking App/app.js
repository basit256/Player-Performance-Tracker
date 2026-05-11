const STORAGE_KEY = "asg-player-performance-tracker-v2";

const workbookPlayers = [
  ["Abdul Salam Moro", "AC HORSENS", "MIDFIELDER", "ELITE ATHLETES AGENCY", "33628813023"],
  ["Omar Idris", "MARBELLA FC B", "ATTACKER", "IBRA", "34722571291"],
  ["Shine Adamadu", "MARBELLA FC B", "MIDFIELDER", "IBRA", "34722571291"],
  ["Fredrick Delali", "KR REYKJAVIK", "MIDFIELDER", "ASM", "ASM"],
  ["Richmond Gyamfi", "AGF (ON LOAN @ ESBERG)", "ATTACKER", "ASM", "ASM"],
  ["Nathan Opoku", "LEICESTER (ON LOAN @ NEWPORT)", "ATTACKER", "STELLAR", "3103593085"],
  ["Philip Appiah", "UMEA", "ATTACKER", "AMA SPORTS AGENCY", "4915755991297"],
  ["Fuseini Issah", "KR REYKJAVIK (ON LOAN AT KV)", "ATTACKER", "ASM", "ASM"]
];

const state = loadState();
let activePlayerId = state.players[0]?.id || "";
let editingEntryId = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  return {
    players: workbookPlayers.map(([name, club, position, agentName, agentContact]) => ({
      id: crypto.randomUUID(),
      name,
      club,
      position,
      agentName,
      agentContact,
      picture: "",
      entries: []
    }))
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function getPlayer(id = activePlayerId) {
  return state.players.find((player) => player.id === id);
}

function sortedEntries(player) {
  return [...(player?.entries || [])].sort((a, b) => Number(a.weekNumber) - Number(b.weekNumber));
}

function statusFor(injury, minutes) {
  if (injury === "Yes") return "Unavailable";
  if (minutes >= 70) return "Good";
  if (minutes >= 45) return "Monitor";
  return "Bad";
}

function matchPerformanceFor(injury) {
  return injury === "Yes" ? "Unavailable" : "Available";
}

function latestThreeMinutes(entries) {
  return entries.slice(-3).reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
}

function interventionFor(entries) {
  return entries.length >= 3 && latestThreeMinutes(entries) >= 90 ? "Intervention needed" : "No";
}

function totals(player) {
  const entries = sortedEntries(player);
  const availableEntries = entries.filter((entry) => entry.injury !== "Yes");
  const goals = entries.reduce((sum, entry) => sum + Number(entry.goals || 0), 0);
  const assists = entries.reduce((sum, entry) => sum + Number(entry.assists || 0), 0);
  const fitness = average(entries.map((entry) => Number(entry.fitness || 7)));
  return {
    weeks: entries.length,
    games: availableEntries.length,
    minutes: entries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0),
    goals,
    assists,
    contribution: goals + assists,
    fitness,
    injuries: entries.filter((entry) => entry.injury === "Yes").length,
    intervention: interventionFor(entries),
    good: entries.filter((entry) => entry.status === "Good").length,
    monitor: entries.filter((entry) => entry.status === "Monitor").length
  };
}

function average(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function playerScore(player) {
  const playerTotals = totals(player);
  return (
    playerTotals.minutes * 0.45 +
    playerTotals.games * 12 +
    playerTotals.contribution * 18 +
    playerTotals.fitness * 8 -
    playerTotals.injuries * 10
  );
}

function filteredPlayers() {
  const query = $("#searchInput").value.trim().toLowerCase();
  if (!query) return state.players;
  return state.players.filter((player) => (
    player.name + " " + player.club + " " + player.position + " " + player.agentName + " " + player.agentContact
  ).toLowerCase().includes(query));
}

function searchMatches() {
  const query = $("#searchInput").value.trim().toLowerCase();
  if (!query) return [];
  return filteredPlayers();
}

function renderSearchResults() {
  const query = $("#searchInput").value.trim();
  const results = searchMatches().slice(0, 8);
  const box = $("#searchResults");
  if (!query) {
    hideSearchResults();
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = results.length ? results.map((player) => {
    const playerTotals = totals(player);
    return `
      <button class="search-result" type="button" data-player-id="${escapeHTML(player.id)}">
        <span class="mini-avatar">${player.picture ? `<img src="${player.picture}" alt="">` : initials(player.name)}</span>
        <span>
          <strong>${escapeHTML(player.name)}</strong>
          <small>${escapeHTML(player.club)} | ${escapeHTML(player.position)} | ${playerTotals.weeks} weeks</small>
        </span>
      </button>`;
  }).join("") : `<div class="search-empty">No matching players found</div>`;
  $$(".search-result").forEach((button) => {
    button.addEventListener("click", () => openProfile(button.dataset.playerId));
  });
}

function hideSearchResults() {
  $("#searchResults").classList.add("hidden");
}

function setView(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  $("#viewTitle").textContent = view === "profile" ? "Player Profile" : titleCase(view);
  render();
}

function openProfile(playerId) {
  activePlayerId = playerId;
  hideSearchResults();
  setView("profile");
}

function render() {
  renderDashboard();
  renderPlayers();
  renderProfile();
}

function renderDashboard() {
  const allEntries = state.players.flatMap((player) => player.entries || []);
  $("#totalPlayers").textContent = state.players.length;
  $("#totalWeeks").textContent = allEntries.length;
  $("#totalMinutes").textContent = allEntries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
  $("#totalInterventions").textContent = state.players.filter((player) => totals(player).intervention === "Intervention needed").length;

  renderTopPlayers();
  populateComparisonSelectors();
  renderComparison();
  renderClubMinutes();
}

function renderTopPlayers() {
  const ranked = [...state.players]
    .sort((a, b) => playerScore(b) - playerScore(a))
    .slice(0, 3);
  $("#topPlayers").innerHTML = ranked.map((player, index) => {
    const playerTotals = totals(player);
    return `
      <button class="top-player-row" type="button" data-player-id="${escapeHTML(player.id)}">
        <span class="rank">${index + 1}</span>
        <div class="mini-avatar">${player.picture ? `<img src="${player.picture}" alt="">` : initials(player.name)}</div>
        <div>
          <strong>${escapeHTML(player.name)}</strong>
          <span>${escapeHTML(player.club)} | ${escapeHTML(player.position)}</span>
        </div>
        <div class="top-stats">
          <span>${playerTotals.games}<small>games</small></span>
          <span>${playerTotals.minutes}<small>mins</small></span>
          <span>${playerTotals.contribution}<small>G+A</small></span>
          <span>${playerTotals.injuries}<small>injuries</small></span>
        </div>
      </button>`;
  }).join("") || `<p class="muted-block">No players available.</p>`;
  $$(".top-player-row").forEach((row) => row.addEventListener("click", () => openProfile(row.dataset.playerId)));
}

function populateComparisonSelectors() {
  const options = state.players.map((player) => `<option value="${escapeHTML(player.id)}">${escapeHTML(player.name)}</option>`).join("");
  ["#comparePlayerA", "#comparePlayerB"].forEach((selector) => {
    const current = $(selector).value;
    $(selector).innerHTML = options;
    if (state.players.some((player) => player.id === current)) $(selector).value = current;
  });
  if ($("#comparePlayerB").options.length > 1 && $("#comparePlayerA").value === $("#comparePlayerB").value) {
    $("#comparePlayerB").selectedIndex = 1;
  }
}

function renderComparison() {
  const playerA = getPlayer($("#comparePlayerA").value) || state.players[0];
  const playerB = getPlayer($("#comparePlayerB").value) || state.players[1] || state.players[0];
  if (!playerA || !playerB) {
    $("#comparisonDetail").innerHTML = `<p class="muted-block">Add players to compare performance.</p>`;
    return;
  }
  const metrics = [
    ["Games", totals(playerA).games, totals(playerB).games],
    ["Minutes", totals(playerA).minutes, totals(playerB).minutes],
    ["Goals", totals(playerA).goals, totals(playerB).goals],
    ["Assists", totals(playerA).assists, totals(playerB).assists],
    ["Injuries", totals(playerA).injuries, totals(playerB).injuries]
  ];
  $("#comparisonDetail").innerHTML = `
    <div class="compare-names">
      <strong>${escapeHTML(playerA.name)}</strong>
      <span>vs</span>
      <strong>${escapeHTML(playerB.name)}</strong>
    </div>
    <div class="compare-metrics">
      ${metrics.map(([label, a, b]) => `
        <div class="compare-metric">
          <span>${label}</span>
          <strong>${escapeHTML(a)}</strong>
          <em>${escapeHTML(b)}</em>
        </div>`).join("")}
    </div>
    <p class="comparison-note">${escapeHTML(comparisonSummary(playerA, playerB))}</p>`;
}

function comparisonSummary(playerA, playerB) {
  const a = totals(playerA);
  const b = totals(playerB);
  const minuteLeader = a.minutes === b.minutes ? "Both players are level on minutes" : `${a.minutes > b.minutes ? playerA.name : playerB.name} leads on minutes`;
  const contributionLeader = a.contribution === b.contribution ? "goal contribution is even" : `${a.contribution > b.contribution ? playerA.name : playerB.name} leads on goals plus assists`;
  const injuryNote = a.injuries === b.injuries ? "injury count is even" : `${a.injuries < b.injuries ? playerA.name : playerB.name} has fewer injuries`;
  return `${minuteLeader}, ${contributionLeader}, and ${injuryNote}.`;
}

function renderPlayers() {
  const players = filteredPlayers();
  $("#playerGrid").innerHTML = players.map((player) => {
    const playerTotals = totals(player);
    return `
      <article class="player-card" data-player-id="${escapeHTML(player.id)}">
        <div class="player-card-head">
          <div class="avatar">${player.picture ? `<img src="${player.picture}" alt="">` : initials(player.name)}</div>
          <div>
            <h3>${escapeHTML(player.name)}</h3>
            <p>${escapeHTML(player.club)}</p>
          </div>
        </div>
        <div class="info-list">
          <span><b>Position</b>${escapeHTML(player.position)}</span>
          <span><b>Agent</b>${escapeHTML(player.agentName || "Not added")}</span>
          <span><b>Contact</b>${escapeHTML(player.agentContact || "Not added")}</span>
        </div>
        <div class="card-stats">
          <span>${playerTotals.weeks}<small>weeks</small></span>
          <span>${playerTotals.minutes}<small>minutes</small></span>
          <span>${playerTotals.injuries}<small>injuries</small></span>
        </div>
        <div class="card-actions">
          <button class="secondary-button open-profile" type="button">Open Profile</button>
          <button class="danger-button delete-player" type="button">Delete Player</button>
        </div>
      </article>`;
  }).join("") || `<div class="empty-state"><h3>No players found</h3><p>Try a different search.</p></div>`;

  $$(".player-card").forEach((card) => card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    openProfile(card.dataset.playerId);
  }));
  $$(".open-profile").forEach((button) => button.addEventListener("click", (event) => {
    openProfile(event.target.closest(".player-card").dataset.playerId);
  }));
  $$(".delete-player").forEach((button) => button.addEventListener("click", (event) => {
    deletePlayer(event.target.closest(".player-card").dataset.playerId);
  }));
}

function renderProfile() {
  const player = getPlayer();
  $("#emptyProfile").classList.toggle("hidden", Boolean(player));
  $("#profileContent").classList.toggle("hidden", !player);
  if (!player) return;

  const entries = sortedEntries(player);
  const playerTotals = totals(player);
  $("#profilePhoto").innerHTML = player.picture ? `<img src="${player.picture}" alt="">` : initials(player.name);
  $("#profileName").textContent = player.name;
  $("#profileMeta").textContent = `${player.club} | ${player.position}`;
  $("#profileAgent").textContent = `Agent: ${player.agentName || "Not added"}`;
  $("#profileContact").textContent = `Contact: ${player.agentContact || "Not added"}`;
  $("#playerWeeks").textContent = playerTotals.weeks;
  $("#playerMinutes").textContent = playerTotals.minutes;
  $("#playerInjuries").textContent = playerTotals.injuries;
  $("#playerIntervention").textContent = playerTotals.intervention;
  $("#playerIntervention").className = playerTotals.intervention === "Intervention needed" ? "danger-text" : "";
  if (!editingEntryId) $("#weekNumber").value = nextWeekNumber(entries);
  updateComputedPreview();

  $("#profileTable").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Week No</th>
          <th>Date</th>
          <th>Injury</th>
          <th>Minutes</th>
          <th>Goals</th>
          <th>Assists</th>
          <th>Fitness</th>
          <th>Status</th>
          <th>Match Performance</th>
          <th>Intervention</th>
          <th>Last Check-In</th>
          <th>Notes/Comments</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((entry) => `
          <tr>
            <td>${escapeHTML(entry.weekNumber)}</td>
            <td>${formatDate(entry.date)}</td>
            <td>${escapeHTML(entry.injury)}</td>
            <td>${escapeHTML(entry.minutes)}</td>
            <td>${escapeHTML(entry.goals)}</td>
            <td>${escapeHTML(entry.assists)}</td>
            <td>${escapeHTML(entry.fitness || 7)}</td>
            <td><span class="badge ${statusBadge(entry.status)}">${escapeHTML(entry.status)}</span></td>
            <td>${escapeHTML(entry.matchPerformance)}</td>
            <td>${escapeHTML(entry.intervention)}</td>
            <td>${entry.lastCheckIn ? formatDate(entry.lastCheckIn) : ""}</td>
            <td>${escapeHTML(entry.notes)}</td>
            <td>
              <div class="row-actions">
                <button class="small-button edit-entry" type="button" data-entry-id="${escapeHTML(entry.id)}">Edit</button>
                <button class="small-danger-button delete-entry" type="button" data-entry-id="${escapeHTML(entry.id)}">Delete</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  $$(".edit-entry").forEach((button) => {
    button.addEventListener("click", () => startEditEntry(button.dataset.entryId));
  });
  $$(".delete-entry").forEach((button) => {
    button.addEventListener("click", () => deleteEntry(button.dataset.entryId));
  });
}

function nextWeekNumber(entries) {
  const maxWeek = entries.reduce((max, entry) => Math.max(max, Number(entry.weekNumber) || 0), 0);
  return maxWeek + 1;
}

function updateComputedPreview() {
  const player = getPlayer();
  const injury = $("#injurySelect").value;
  if (injury === "Yes") {
    $("#minutesPlayed").value = 0;
    $("#goalsScored").value = 0;
    $("#assistsMade").value = 0;
    $("#fitnessScore").value = 1;
    ["#minutesPlayed", "#goalsScored", "#assistsMade", "#fitnessScore"].forEach((selector) => $(selector).disabled = true);
  } else {
    ["#minutesPlayed", "#goalsScored", "#assistsMade", "#fitnessScore"].forEach((selector) => $(selector).disabled = false);
  }

  const minutes = injury === "Yes" ? 0 : Number($("#minutesPlayed").value || 0);
  const status = statusFor(injury, minutes);
  const matchPerformance = matchPerformanceFor(injury);
  const previewEntry = { id: editingEntryId, minutes };
  const previewEntries = player
    ? sortedEntries(player).map((entry) => entry.id === editingEntryId ? previewEntry : entry)
    : [previewEntry];
  if (player && !editingEntryId) previewEntries.push(previewEntry);
  $("#computedStatus").textContent = status;
  $("#computedMatch").textContent = matchPerformance;
  $("#computedIntervention").textContent = interventionFor(previewEntries);
}

function startEditEntry(entryId) {
  const player = getPlayer();
  const entry = player?.entries.find((item) => item.id === entryId);
  if (!entry) return;
  editingEntryId = entryId;
  $("#weekNumber").value = entry.weekNumber;
  $("#entryDate").value = entry.date;
  $("#injurySelect").value = entry.injury;
  $("#minutesPlayed").value = entry.minutes;
  $("#goalsScored").value = entry.goals;
  $("#assistsMade").value = entry.assists;
  $("#fitnessScore").value = entry.fitness || 7;
  $("#lastCheckIn").value = entry.lastCheckIn || "";
  $("#entryNotes").value = entry.notes || "";
  $("#saveEntryButton").textContent = "Update Weekly Entry";
  $("#cancelEditButton").classList.remove("hidden");
  updateComputedPreview();
  $("#entryForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEntryForm() {
  editingEntryId = "";
  $("#entryForm").reset();
  $("#injurySelect").value = "No";
  $("#minutesPlayed").value = 0;
  $("#goalsScored").value = 0;
  $("#assistsMade").value = 0;
  $("#fitnessScore").value = 7;
  $("#saveEntryButton").textContent = "Save Weekly Entry";
  $("#cancelEditButton").classList.add("hidden");
}

function recalculatePlayerEntries(player) {
  const ordered = sortedEntries(player);
  ordered.forEach((entry, index) => {
    entry.minutes = entry.injury === "Yes" ? 0 : Number(entry.minutes || 0);
    entry.goals = entry.injury === "Yes" ? 0 : Number(entry.goals || 0);
    entry.assists = entry.injury === "Yes" ? 0 : Number(entry.assists || 0);
    entry.fitness = entry.injury === "Yes" ? 1 : Number(entry.fitness || 7);
    entry.status = statusFor(entry.injury, entry.minutes);
    entry.matchPerformance = matchPerformanceFor(entry.injury);
    entry.intervention = interventionFor(ordered.slice(0, index + 1));
  });
}

function deleteEntry(entryId) {
  const player = getPlayer();
  const entry = player?.entries.find((item) => item.id === entryId);
  if (!player || !entry) return;
  const ok = window.confirm(`Delete week ${entry.weekNumber} for ${player.name}? This removes the saved tracking row.`);
  if (!ok) return;
  player.entries = player.entries.filter((item) => item.id !== entryId);
  if (editingEntryId === entryId) resetEntryForm();
  recalculatePlayerEntries(player);
  saveState();
  render();
  toast("Weekly entry deleted");
}

function deletePlayer(playerId) {
  const player = getPlayer(playerId);
  if (!player) return;
  const ok = window.confirm(`Delete ${player.name}'s profile and all saved weekly data? This cannot be undone from inside the app.`);
  if (!ok) return;
  const index = state.players.findIndex((item) => item.id === playerId);
  if (index < 0) return;
  state.players.splice(index, 1);
  let changedView = false;
  if (activePlayerId === playerId) {
    activePlayerId = state.players[0]?.id || "";
    resetEntryForm();
    setView(state.players.length ? "players" : "dashboard");
    changedView = true;
  }
  saveState();
  if (!changedView) render();
  toast("Player deleted");
}

function renderClubMinutes() {
  const clubMinutes = {};
  state.players.forEach((player) => {
    clubMinutes[player.club] = (clubMinutes[player.club] || 0) + totals(player).minutes;
  });
  const rows = Object.entries(clubMinutes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const max = Math.max(...rows.map(([, minutes]) => minutes), 1);
  if (!rows.some(([, minutes]) => minutes > 0)) {
    $("#clubMinutesList").innerHTML = `<p class="muted-block">Log player weeks to build the club workload view.</p>`;
    return;
  }
  $("#clubMinutesList").innerHTML = rows.map(([club, minutes], index) => `
    <div class="club-minute-row">
      <div class="club-minute-head">
        <span>${index + 1}. ${escapeHTML(club)}</span>
        <strong>${minutes} mins</strong>
      </div>
      <div class="club-minute-bar"><span style="width: ${Math.max(4, Math.round((minutes / max) * 100))}%"></span></div>
    </div>`).join("");
}

function readPicture(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wireEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#searchInput").addEventListener("input", () => {
    renderPlayers();
    renderSearchResults();
  });
  $("#searchInput").addEventListener("focus", renderSearchResults);
  $("#searchInput").addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSearchResults();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-box")) hideSearchResults();
  });
  $("#openPlayerModal").addEventListener("click", () => {
    $("#playerModal").showModal();
  });
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
  ["#injurySelect", "#minutesPlayed", "#goalsScored", "#assistsMade", "#fitnessScore"].forEach((selector) => {
    $(selector).addEventListener("input", updateComputedPreview);
  });
  ["#comparePlayerA", "#comparePlayerB"].forEach((selector) => {
    $(selector).addEventListener("change", renderComparison);
  });
  $("#cancelEditButton").addEventListener("click", () => {
    resetEntryForm();
    render();
  });

  $("#playerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const picture = await readPicture($("#playerPicture").files[0]);
    const player = {
      id: crypto.randomUUID(),
      name: $("#playerName").value.trim(),
      club: $("#playerClub").value.trim(),
      position: $("#playerPosition").value.trim(),
      agentName: $("#agentName").value.trim(),
      agentContact: $("#agentContact").value.trim(),
      picture,
      entries: []
    };
    state.players.push(player);
    activePlayerId = player.id;
    saveState();
    $("#playerForm").reset();
    $("#playerModal").close();
    render();
    setView("profile");
    toast("Player added");
  });

  $("#entryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const player = getPlayer();
    if (!player) return;
    const injury = $("#injurySelect").value;
    const minutes = injury === "Yes" ? 0 : Number($("#minutesPlayed").value || 0);
    const entry = {
      id: editingEntryId || crypto.randomUUID(),
      weekNumber: Number($("#weekNumber").value),
      date: $("#entryDate").value,
      injury,
      minutes,
      goals: injury === "Yes" ? 0 : Number($("#goalsScored").value || 0),
      assists: injury === "Yes" ? 0 : Number($("#assistsMade").value || 0),
      fitness: injury === "Yes" ? 1 : Number($("#fitnessScore").value || 7),
      status: statusFor(injury, minutes),
      matchPerformance: matchPerformanceFor(injury),
      lastCheckIn: $("#lastCheckIn").value,
      notes: $("#entryNotes").value.trim()
    };
    if (editingEntryId) {
      const index = player.entries.findIndex((item) => item.id === editingEntryId);
      if (index >= 0) player.entries[index] = entry;
    } else {
      player.entries.push(entry);
    }
    recalculatePlayerEntries(player);
    saveState();
    const message = editingEntryId ? "Weekly entry updated" : "Weekly entry saved";
    resetEntryForm();
    render();
    toast(message);
  });

  $("#exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "asg-player-performance-tracker.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#importData").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const next = JSON.parse(await file.text());
      if (!Array.isArray(next.players)) throw new Error("Invalid tracker file");
      state.players = next.players;
      activePlayerId = state.players[0]?.id || "";
      saveState();
      render();
      toast("Data imported");
    } catch {
      toast("Import failed");
    }
  });
}

function initials(name) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function titleCase(value) {
  return value.replace(/^\w/, (char) => char.toUpperCase());
}

function statusBadge(status) {
  if (status === "Good") return "good";
  if (status === "Monitor") return "monitor";
  if (status === "Unavailable") return "quiet";
  return "bad";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function shorten(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2200);
}

wireEvents();
render();
