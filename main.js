let state = {
  host: "",
  port: 21,
  username: "",
  password: "",
  directory: "/",
  filename: "",
};

let currentListing = [];

let sortState = {
  column: null,
  ascending: true,
};

window.onload = function () {
  document.getElementById("loginForm").addEventListener("submit", handleLogin);

  document.querySelectorAll("thead th[data-column]").forEach((th) => {
    th.addEventListener("click", () => {
      const columnKey = th.getAttribute("data-column");
      sortBy(columnKey);
    });
  });
};

async function handleLogin(event) {
  event.preventDefault();

  state.host = document.getElementById("host").value.trim();
  state.port = parseInt(document.getElementById("port").value);
  state.username = document.getElementById("username").value.trim();
  state.password = document.getElementById("password").value.trim();

  try {
    await list("/");

    document.getElementById("login-form-container").style.display = "none";
    document.getElementById("main-content").style.display = "block";
  } catch (error) {
    show_error(error.error || "Ошибка подключения");
  }
}

async function list(directory) {
  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state,
        command: "list",
        directory: directory,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw data;

    state.directory = data.directory;
    document.getElementById("directory").textContent = state.directory;

    currentListing = Object.entries(data.files).map(([name, info]) => {
      return {
        name: name,
        type: info.type,
        permissions: info.permissions,
        owner: info.owner,
        group: info.group,
        size: info.size,
        date: info.date,
        symlink_target: info.symlink_target,
      };
    });

    renderListing();
  } catch (error) {
    show_error(error.error || String(error));
  }
}

function renderListing() {
  const listingBody = document.getElementById("listing");
  listingBody.innerHTML = "";

  if (state.directory !== "/")
    listingBody.insertAdjacentHTML(
      "beforeend",
      create_file_row(
        "..",
        {
          type: "directory",
          permissions: "",
          owner: "",
          group: "",
          size: "",
          date: "",
        },
        true,
        ".."
      )
    );

  currentListing.forEach((file) => {
    listingBody.insertAdjacentHTML(
      "beforeend",
      create_file_row(file.name, file)
    );
  });

  listingBody.insertAdjacentHTML("beforeend", create_upload_row());

  listingBody.insertAdjacentHTML("beforeend", create_mkdir_row());

  updateSortIndicator();
}

function create_file_row(name, info, isGoUp = false, dirName = "") {
  const isDir = info.type === "directory";
  const isFile = info.type === "file";
  const isSymlink = info.type === "symlink";
  const target =
    isSymlink && info.symlink_target ? ` -> ${info.symlink_target}` : "";

  const displayName = isGoUp ? ".." : `${name}${isDir ? "/" : ""}${target}`;

  const rowOnclick =
    isGoUp || isDir ? `onclick="navigate('${dirName || name}')"` : "";

  const icon = isGoUp ? "" : isDir ? "📁" : isSymlink ? "🔗" : "📄";
  const finalNameCell = icon + " " + displayName;

  let actionsHTML = "";

  if (!isGoUp) {
    actionsHTML += `
      <button class="rename-button"
              onclick="renameItem('${name}', ${isDir}); event.stopPropagation();"
              title="Переименовать">✏️</button>

      <button class="delete-button"
              onclick="deleteItem('${name}', ${isDir}); event.stopPropagation();"
              title="Удалить">🗑️</button>
    `;
  }

  if (isFile) {
    actionsHTML += `
      <button class="download-button"
              onclick="download('${name}'); event.stopPropagation();"
              title="Скачать">📥</button>

      <button class="view-button"
              onclick="view('${name}'); event.stopPropagation();"
              title="Просмотр">👁‍🗨</button>
    `;
  }

  return `
    <tr class="${isGoUp ? "go-up-row" : ""}" ${rowOnclick}>
      <td class="name-col">${finalNameCell}</td>
      <td class="type-col">${isGoUp ? "" : info.type}</td>
      <td class="perm-col">${info.permissions || ""}</td>
      <td class="owner-col">${info.owner || ""}</td>
      <td class="group-col">${info.group || ""}</td>
      <td class="size-col">${info.size || ""}</td>
      <td class="date-col">${info.date || ""}</td>
      <td class="actions-col">${actionsHTML}</td>
    </tr>
  `;
}

function create_upload_row() {
  return `
    <tr class="upload-item" onclick="trigger_upload()">
      <td colspan="8">➕ Загрузить файл</td>
    </tr>
  `;
}

function create_mkdir_row() {
  return `
    <tr class="mkdir-item" onclick="makeDir()">
      <td colspan="8">➕ Создать директорию</td>
    </tr>
  `;
}

function navigate(directory) {
  let newDirectory = state.directory;

  if (directory === "..") {
    const parts = newDirectory.replace(/\/+$/, "").split("/").slice(0, -1);
    newDirectory = parts.length > 0 ? parts.join("/") + "/" : "/";
  } else {
    newDirectory = newDirectory.endsWith("/")
      ? newDirectory + directory
      : newDirectory + "/" + directory;
  }

  list(newDirectory);
}

async function download(filename) {
  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state,
        command: "download",
        filename: filename,
      }),
    });

    if (!response.ok) throw await response.json();

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  } catch (error) {
    show_error(error.error || String(error));
  }
}

async function view(filename) {
  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state,
        command: "view",
        filename,
      }),
    });

    if (!response.ok) throw await response.json();

    const data = await response.json();

    const tab = window.open();
    if (!tab) {
      alert(
        "Popup blocked! Разрешите всплывающие окна для просмотра содержимого."
      );
      return;
    }
    tab.document.write("<pre>" + data.contents + "</pre>");
    tab.document.close();
  } catch (error) {
    show_error(error.error || String(error));
  }
}

function trigger_upload() {
  document.getElementById("hidden-upload-input").click();
}

document
  .getElementById("hidden-upload-input")
  .addEventListener("change", async function () {
    if (this.files.length === 0) return;

    const file = this.files[0];
    const filename = prompt("Введите имя файла для загрузки:", file.name);
    if (!filename) {
      this.value = "";
      return;
    }

    await upload(file, filename);
    this.value = "";
  });

async function upload(file, filename) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);
  formData.append("command", "upload");
  formData.append("host", state.host);
  formData.append("port", state.port);
  formData.append("username", state.username);
  formData.append("password", state.password);
  formData.append("directory", state.directory);

  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw await response.json();

    await list(state.directory);
    show_success("Файл успешно загружен");
  } catch (error) {
    show_error(error.error || String(error));
  }
}

async function makeDir() {
  const dirName = prompt("Введите имя новой директории:");
  if (!dirName) return;

  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state,
        command: "make_directory",
        directory: dirName,
      }),
    });

    if (!response.ok) throw await response.json();

    await list(state.directory);
    show_success(`Директория '${dirName}' создана`);
  } catch (error) {
    show_error(error.error || String(error));
  }
}

async function renameItem(oldName, isDir) {
  const newName = prompt(`Введите новое имя для '${oldName}':`, oldName);
  if (!newName || newName.trim() === "" || newName === oldName) return;

  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...state,
        command: "rename",
        filename: oldName,
        name: newName, // the server should handle "newName"
      }),
    });
    if (!response.ok) throw await response.json();

    await list(state.directory);
    show_success(`'${oldName}' переименован в '${newName}'`);
  } catch (error) {
    show_error(error.error || String(error));
  }
}

async function deleteItem(name, isDir) {
  const confirmed = confirm(`Удалить '${name}'?`);
  if (!confirmed) return;

  const cmd = isDir ? "remove_directory" : "delete";

  try {
    const body = {
      ...state,
      command: cmd,
    };

    isDir
      ? (body.directory = state.directory + "/" + name)
      : (body.filename = name);

    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw await response.json();

    await list(state.directory);
    show_success(`'${name}' удалён`);
  } catch (error) {
    show_error(error.error || String(error));
  }
}

function show_error(message) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = `Ошибка: ${message}`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function show_success(message) {
  const div = document.createElement("div");
  div.className = "success";
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function sortBy(columnKey) {
  if (sortState.column === columnKey) {
    sortState.ascending = !sortState.ascending;
  } else {
    sortState.column = columnKey;
    sortState.ascending = true;
  }

  currentListing.sort((a, b) => {
    let valA = a[columnKey] || "";
    let valB = b[columnKey] || "";

    if (columnKey === "size") {
      valA = parseInt(valA, 10) || 0;
      valB = parseInt(valB, 10) || 0;
    }

    if (valA < valB) return sortState.ascending ? -1 : 1;
    if (valA > valB) return sortState.ascending ? 1 : -1;
    return 0;
  });

  renderListing();
}

function updateSortIndicator() {
  document.querySelectorAll("thead th[data-column]").forEach((th) => {
    th.classList.remove("ascending", "descending");
  });

  if (sortState.column) {
    const selector = `thead th[data-column="${sortState.column}"]`;
    const th = document.querySelector(selector);
    if (th) {
      th.classList.add(sortState.ascending ? "ascending" : "descending");
    }
  }
}
