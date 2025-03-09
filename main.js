/***********************************************************
 * Global State
 ***********************************************************/

// Holds basic connection and directory info
let state = {
  host: "127.0.0.1",
  port: 21,
  username: "username",
  password: "password",
  directory: "/",
  filename: "",
};

// Holds the array of file entries retrieved from the server.
let currentListing = [];

// Tracks the current sorting column and direction
let sortState = {
  column: null, // e.g. "name", "type", "size", ...
  ascending: true, // true = ascending, false = descending
};

/***********************************************************
 * On page load, load the default listing.
 ***********************************************************/
window.onload = function () {
  // Add a click listener to each <th> so we can sort by that column
  document.querySelectorAll("thead th[data-column]").forEach((th) => {
    th.addEventListener("click", () => {
      const columnKey = th.getAttribute("data-column");
      sortBy(columnKey);
    });
  });

  list(state.directory);
};

/***********************************************************
 * Fetch and store the file listing from the server
 ***********************************************************/
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
    if (!response.ok) throw data; // if server returned error

    state.directory = data.directory;
    document.getElementById("directory").textContent = state.directory;

    // Convert { filename: info } object into an array of items
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

    // After updating currentListing, render it
    renderListing();
  } catch (error) {
    show_error(error.error || String(error));
  }
}

/***********************************************************
 * Render the currentListing array into <tbody>
 ***********************************************************/
function renderListing() {
  const listingBody = document.getElementById("listing");
  listingBody.innerHTML = "";

  // 1) Insert the special “..” row at the top
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

  // 2) For each file in currentListing, create a row
  currentListing.forEach((file) => {
    listingBody.insertAdjacentHTML(
      "beforeend",
      create_file_row(file.name, file)
    );
  });

  // 3) Insert the special “upload file” row
  listingBody.insertAdjacentHTML("beforeend", create_upload_row());

  // 4) Insert a row for “Создать директорию”
  listingBody.insertAdjacentHTML("beforeend", create_mkdir_row());

  // Show a small arrow indicator on the sorted column
  updateSortIndicator();
}

/***********************************************************
 * Build one <tr> for a file/directory
 ***********************************************************/
function create_file_row(name, info, isGoUp = false, dirName = "") {
  const isDir = info.type === "directory";
  const isFile = info.type === "file";
  const isSymlink = info.type === "symlink";
  const target =
    isSymlink && info.symlink_target ? ` -> ${info.symlink_target}` : "";

  // Display name
  const displayName = isGoUp ? ".." : `${name}${isDir ? "/" : ""}${target}`;

  // If directory => row click navigates
  const rowOnclick =
    isGoUp || isDir ? `onclick="navigate('${dirName || name}')"` : "";

  // Simple icons
  const icon = isGoUp ? "" : isDir ? "📁" : "📄";
  const finalNameCell = icon + " " + displayName;

  // Base actions (empty by default)
  let actionsHTML = "";

  // For real items (not “..”), show rename & delete
  if (!isGoUp) {
    // Add Rename + Delete for files and directories
    actionsHTML += `
      <button class="rename-button"
              onclick="renameItem('${name}', ${isDir}); event.stopPropagation();"
              title="Переименовать">✏️</button>

      <button class="delete-button"
              onclick="deleteItem('${name}', ${isDir}); event.stopPropagation();"
              title="Удалить">🗑</button>
    `;
  }

  // If it’s a file, also show “download” & “view”
  if (isFile) {
    actionsHTML += `
      <button class="download-button"
              onclick="download('${name}'); event.stopPropagation();"
              title="Скачать">📥</button>

      <button class="view-button"
              onclick="view('${name}'); event.stopPropagation();"
              title="Просмотр">👁</button>
    `;
  }

  // Build the table row
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

/***********************************************************
 * Create the special “upload file” row
 ***********************************************************/
function create_upload_row() {
  return `
    <tr class="upload-item" onclick="trigger_upload()">
      <td colspan="8">➕ Загрузить файл</td>
    </tr>
  `;
}

/***********************************************************
 * Create a row for “make directory”
 ***********************************************************/
function create_mkdir_row() {
  return `
    <tr class="mkdir-item" onclick="makeDir()">
      <td colspan="8">➕ Создать директорию</td>
    </tr>
  `;
}

/***********************************************************
 * Ask user for a subdirectory or “..”
 ***********************************************************/
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

/***********************************************************
 * Download a file from the server
 ***********************************************************/
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

/***********************************************************
 * View file contents (text)
 ***********************************************************/
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

/***********************************************************
 * Trigger file selection for upload
 ***********************************************************/
function trigger_upload() {
  document.getElementById("hidden-upload-input").click();
}

/***********************************************************
 * Listen for <input type="file"> changes, then upload
 ***********************************************************/
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

/***********************************************************
 * Upload a file
 ***********************************************************/
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

/***********************************************************
 * Create a new directory
 ***********************************************************/
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
        directory: dirName, // the server should handle "newDirName"
      }),
    });

    if (!response.ok) throw await response.json();

    await list(state.directory);
    show_success(`Директория '${dirName}' создана`);
  } catch (error) {
    show_error(error.error || String(error));
  }
}

/***********************************************************
 * Rename a file or directory
 ***********************************************************/
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

/***********************************************************
 * Delete a file or directory
 ***********************************************************/
async function deleteItem(name, isDir) {
  const confirmed = confirm(`Удалить '${name}'?`);
  if (!confirmed) return;

  // If it's a directory, we call remove_directory; else we call delete
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

/***********************************************************
 * Show an error “toast” at bottom-right
 ***********************************************************/
function show_error(message) {
  const div = document.createElement("div");
  div.className = "error";
  div.textContent = `Ошибка: ${message}`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

/***********************************************************
 * Show a success “toast” at bottom-right
 ***********************************************************/
function show_success(message) {
  const div = document.createElement("div");
  div.className = "success";
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

/***********************************************************
 * Sort the currentListing array by a given columnKey
 ***********************************************************/
function sortBy(columnKey) {
  // Toggle asc/desc if the same column is clicked again
  if (sortState.column === columnKey) {
    sortState.ascending = !sortState.ascending;
  } else {
    sortState.column = columnKey;
    sortState.ascending = true;
  }

  currentListing.sort((a, b) => {
    let valA = a[columnKey] || "";
    let valB = b[columnKey] || "";

    // For numeric sort on “size”
    if (columnKey === "size") {
      valA = parseInt(valA, 10) || 0;
      valB = parseInt(valB, 10) || 0;
    }

    // Basic ascending string or numeric comparison
    if (valA < valB) return sortState.ascending ? -1 : 1;
    if (valA > valB) return sortState.ascending ? 1 : -1;
    return 0;
  });

  renderListing();
}

/***********************************************************
 * Show sorting arrows in the header
 ***********************************************************/
function updateSortIndicator() {
  // Remove old ascending/descending classes
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
