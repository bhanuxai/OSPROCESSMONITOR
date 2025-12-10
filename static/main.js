// ================== Tabs ==================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ================== Toast Function ==================
function showToast(message, isError = false) {
  const container = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = "toast" + (isError ? " error" : "");
  div.textContent = message;
  container.appendChild(div);

  setTimeout(() => div.remove(), 4000);
}

// ================== Charts ==================
let cpuMemChart, perCoreChart;
let historyLabels = [];
let cpuHistory = [];
let memHistory = [];

let latestProcesses = [];

// sorting
let currentSort = "cpu";
let sortCpu = true, sortMem = true, sortPid = true, sortName = true;

// pagination
let currentPage = 1;
let rowsPerPage = 20;

function fmtPercent(v) {
  return v.toFixed(1) + "%";
}

function updateMeters(cpu, mem, disk) {
  document.getElementById("cpu-value").textContent = fmtPercent(cpu);
  document.getElementById("mem-value").textContent = fmtPercent(mem);
  document.getElementById("disk-value").textContent = fmtPercent(disk);

  document.getElementById("cpu-meter-fill").style.width = cpu + "%";
  document.getElementById("mem-meter-fill").style.width = mem + "%";
  document.getElementById("disk-meter-fill").style.width = disk + "%";
}

function initCharts() {
  cpuMemChart = new Chart(document.getElementById("cpuMemChart"), {
    type: "line",
    data: { labels: historyLabels, datasets: [
      { label: "CPU %", data: cpuHistory },
      { label: "Memory %", data: memHistory }
    ]},
    options: { responsive: true, scales: { y: { max: 100 } } }
  });

  perCoreChart = new Chart(document.getElementById("perCoreChart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "CPU per core %", data: [] }]},
    options: { responsive: true, scales: { y: { max: 100 } } }
  });
}

// ================== Column Sorting ==================
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const field = th.getAttribute("data-sort");

    if (field === "cpu") sortCpu = !sortCpu;
    if (field === "memory") sortMem = !sortMem;
    if (field === "pid") sortPid = !sortPid;
    if (field === "name") sortName = !sortName;

    currentSort = field;
    renderProcessTable();
  });
});

// ================== Summary Fetch ==================
async function fetchSummary() {
  const res = await fetch("/api/summary");
  const data = await res.json();

  historyLabels.push(data.time);
  cpuHistory.push(data.cpu_percent);
  memHistory.push(data.memory.percent);

  if (historyLabels.length > 60) {
    historyLabels.shift();
    cpuHistory.shift();
    memHistory.shift();
  }

  updateMeters(data.cpu_percent, data.memory.percent, data.disk.percent);

  document.getElementById("sys-os").textContent = data.system.os;
  document.getElementById("sys-cpu").textContent = data.system.cpu;
  document.getElementById("sys-ram").textContent = data.system.total_ram + " GB";
  document.getElementById("sys-uptime").textContent = data.system.uptime;

  cpuMemChart.update();
  perCoreChart.data.labels = data.per_cpu.map((_, i) => "Core " + i);
  perCoreChart.data.datasets[0].data = data.per_cpu;
  perCoreChart.update();

  document.getElementById("current-time").textContent = "Last update: " + data.time;
}

// ================== Process Fetch ==================
async function fetchProcesses() {
  const res = await fetch("/api/processes?limit=200");
  latestProcesses = await res.json();
  renderProcessTable();
}

// ================== Render Table ==================
function renderProcessTable() {
  const tbody = document.getElementById("process-tbody");
  const searchTerm = document.getElementById("process-search").value.toLowerCase();

  let result = latestProcesses.filter((p) =>
    p.pid.toString().includes(searchTerm) ||
    (p.name || "").toLowerCase().includes(searchTerm)
  );

  // sorting
  if (currentSort === "cpu") result.sort((a, b) => sortCpu ? b.cpu_percent - a.cpu_percent : a.cpu_percent - b.cpu_percent);
  if (currentSort === "memory") result.sort((a, b) => sortMem ? b.memory_percent - a.memory_percent : a.memory_percent - b.memory_percent);
  if (currentSort === "pid") result.sort((a, b) => sortPid ? a.pid - b.pid : b.pid - a.pid);
  if (currentSort === "name") result.sort((a, b) => sortName ?
    (a.name || "").localeCompare(b.name || "") :
    (b.name || "").localeCompare(a.name || ""));

  // pagination
  let start = (currentPage - 1) * rowsPerPage;
  let end = start + rowsPerPage;
  let pageItems = result.slice(start, end);

  tbody.innerHTML = "";
  pageItems.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.pid}</td>
      <td>${p.name || "-"}</td>
      <td>${p.cpu_percent.toFixed(1)}</td>
      <td>${p.memory_percent.toFixed(1)}</td>
      <td>${p.status}</td>
      <td><button class="kill-btn" onclick="killProcess(${p.pid})">Kill</button></td>
    `;
    tbody.appendChild(tr);
  });

  // update page info
  document.getElementById("pageInfo").textContent =
    `Page ${currentPage} of ${Math.ceil(result.length / rowsPerPage)}`;
}

// ================== Pagination ==================
document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderProcessTable();
  }
});
document.getElementById("nextBtn").addEventListener("click", () => {
  currentPage++;
  renderProcessTable();
});

// ================== Kill ==================
async function killProcess(pid) {
  if (!confirm("Kill process " + pid + "?")) return;

  const res = await fetch("/api/processes/" + pid + "/kill", { method: "POST" });
  const data = await res.json();

  if (data.success) {
    showToast("✔ Process " + pid + " killed");
  } else {
    showToast("❌ Failed to kill " + pid, true);
  }

  fetchProcesses();
}

// ================== System Actions ==================
async function shutdownPC() {
  if (confirm("Shutdown computer?")) {
    await fetch("/api/shutdown", { method: "POST" });
    showToast("⚠ Shutdown command sent");
  }
}

async function restartPC() {
  if (confirm("Restart computer?")) {
    await fetch("/api/restart", { method: "POST" });
    showToast("⚠ Restart command sent");
  }
}

async function logoffPC() {
  if (confirm("Logoff user?")) {
    await fetch("/api/logoff", { method: "POST" });
    showToast("⚠ Logoff command sent");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchSummary();
  fetchProcesses();

  setInterval(fetchSummary, 1000);
  setInterval(fetchProcesses, 2000);
});
