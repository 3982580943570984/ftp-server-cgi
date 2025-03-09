let state = {
  host: "127.0.0.1",
  port: 21,
  username: "username",
  password: "password",
  directory: "/",
  filename: "",
};

const list = async (directory) => {
  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, command: "list", directory: directory }),
    });

    const data = await response.json();

    if (!response.ok) throw await response.json();

    state.directory = data.directory;
    document.getElementById("directory").textContent = state.directory;

    const listing = document.getElementById("listing");
    listing.replaceChildren();

    listing.insertAdjacentHTML(
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

    Object.entries(data.files)
      .map(([name, info]) => create_file_row(name, info))
      .forEach((row) => listing.insertAdjacentHTML("beforeend", row));

    listing.insertAdjacentHTML("beforeend", create_upload_row());
  } catch (error) {
    show_error(error.error);
  }
};

const download = async (filename) => {
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
    show_error(error.error);
  }
};

const upload = async (file, filename) => {
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
    show_error(error.error);
  }
};

const view = async (filename) => {
  try {
    const response = await fetch("/htbin/main.perl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...state, command: "view", filename }),
    });

    if (!response.ok) throw await response.json();

    const data = await response.json();

    // Open a new tab and write the content
    const tab = window.open();

    if (!tab) return alert("Popup blocked! Allow popups to view the content.");

    tab.document.write("<pre>" + data.contents + "</pre>");
    tab.document.close();
  } catch (error) {
    show_error(error.error);
  }
};

window.onload = () => list(state.directory);

// Навигация по директориям
function navigate(directory) {
  let new_directory = state.directory;

  if (directory === "..") {
    const parts = new_directory.replace(/\/+$/, "").split("/").slice(0, -1);
    new_directory = parts.length > 0 ? parts.join("/") + "/" : "/";
  } else {
    new_directory = new_directory.endsWith("/")
      ? new_directory + directory
      : new_directory + "/" + directory;
  }

  list(new_directory);
}

// Helper to create a row for a file
const create_file_row = (name, info, isGoUp = false, dirName = "") => {
  const isDir = info.type === "directory";
  const isFile = info.type === "file";
  const isSymlink = info.type === "symlink";
  const target =
    isSymlink && info.symlink_target ? ` -> ${info.symlink_target}` : "";
  const displayName = `${name}${isDir ? "/" : ""}${target}`;

  const rowOnclick =
    isGoUp || isDir ? `onclick="navigate('${dirName || name}')"` : "";

  // Actions column: if it's a file, add a download button, or a “view” button, etc.
  let actionsHTML = "";
  if (isFile) {
    actionsHTML = `
            <button class="download-button"
                    onclick="download('${name}'); event.stopPropagation();"
                    title="Скачать">📥</button>
            <button class="view-button"
                    onclick="view('${name}'); event.stopPropagation();"
                    title="Просмотр">👁</button>
        `;
  }

  return `
    <div class="file-row row" ${rowOnclick}>
        <div class="file-col name-col">${displayName}</div>
        <div class="file-col type-col">${info.type || ""}</div>
        <div class="file-col perm-col">${info.permissions || ""}</div>
        <div class="file-col owner-col">${info.owner || ""}</div>
        <div class="file-col group-col">${info.group || ""}</div>
        <div class="file-col size-col">${info.size || ""}</div>
        <div class="file-col date-col">${info.date || ""}</div>
        <div class="file-col actions-col">${actionsHTML}</div>
    </div>
    `;
};

// Helper to create the special “upload” row
function create_upload_row() {
  return `
    <div class="file-row row upload-item" onclick="triggerUpload()">
        <div class="file-col name-col">➕ Загрузить файл</div>
        <div class="file-col type-col"></div>
        <div class="file-col perm-col"></div>
        <div class="file-col owner-col"></div>
        <div class="file-col group-col"></div>
        <div class="file-col size-col"></div>
        <div class="file-col date-col"></div>
        <div class="file-col actions-col"></div>
    </div>
    `;
}

// Открытие диалога для выбора файла
function trigger_upload() {
  document.getElementById("hidden-upload-input").click();
}

// Обработка выбора файла из скрытого input
document
  .getElementById("hidden-upload-input")
  .addEventListener("change", async () => {
    const file_input = this;

    if (file_input.files.length === 0) return;

    const file = file_input.files[0];

    const filename = prompt("Введите имя файла для загрузки:", file.name);

    if (!filename) {
      file_input.value = "";
      return;
    }

    await upload(file, filename);

    file_input.value = "";
  });

// Вспомогательные функции для уведомлений
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
