const projectForm = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusSelect = document.getElementById("status");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const projectList = document.getElementById("project-list");

const VALID_STATUSES = ["Planned", "In Progress", "Completed"];

let projects = [];
let editingId = null;
let isBusy = false;
let hasLoadedProjects = false;

// Enable or disable controls while an API request is running.
function updateControls() {
  nameInput.disabled = isBusy;
  statusSelect.disabled = isBusy;
  saveButton.disabled = isBusy;
  cancelButton.disabled = isBusy;

  projectList.querySelectorAll("button").forEach((button) => {
    button.disabled = isBusy;
  });
}

// Reset the form to its normal Add mode.
function resetForm() {
  projectForm.reset();
  editingId = null;
  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;
}

// Read a useful error message from an unsuccessful API response.
async function getApiError(response) {
  const responseText = await response.text();

  if (responseText) {
    try {
      const data = JSON.parse(responseText);

      if (typeof data.error === "string" && data.error.trim()) {
        return data.error;
      }

      if (typeof data.message === "string" && data.message.trim()) {
        return data.message;
      }
    } catch {
      // The response was not JSON. Use its text if available.
    }

    if (!responseText.trim().startsWith("<")) {
      return responseText;
    }
  }

  return `Request failed with HTTP ${response.status} (${response.statusText || "Unknown error"}).`;
}

// Display the projects returned by the API.
function renderProjects() {
  projectList.replaceChildren();

  const displayedIds = new Set();

  projects.forEach((project) => {
    const idKey = String(project.id);

    // Avoid rendering duplicate records with the same server ID.
    if (displayedIds.has(idKey)) {
      return;
    }

    displayedIds.add(idKey);

    const listItem = document.createElement("li");

    const projectName = document.createElement("strong");
    projectName.textContent = project.name;

    const projectStatus = document.createElement("span");
    projectStatus.textContent = ` — ${project.status}`;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.dataset.projectId = idKey;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.projectId = idKey;
    deleteButton.dataset.action = "delete";

    listItem.append(
      projectName,
      projectStatus,
      document.createTextNode(" "),
      editButton,
      document.createTextNode(" "),
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  // Do not show an empty-list success state before the API has loaded.
  emptyState.hidden = !hasLoadedProjects || displayedIds.size > 0;

  updateControls();
}

// Load the current collection from the API.
async function loadProjects() {
  try {
    const response = await fetch("/api/projects");

    if (!response.ok) {
      throw new Error(await getApiError(response));
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned invalid JSON for the project list.");
    }

    if (!Array.isArray(data)) {
      throw new Error("The server returned an invalid project list.");
    }

    // Keep only valid records with unique server-provided IDs.
    const seenIds = new Set();

    projects = data.filter((project) => {
      if (
        project === null ||
        typeof project !== "object" ||
        project.id === undefined ||
        project.id === null ||
        String(project.id).trim() === "" ||
        typeof project.name !== "string" ||
        !VALID_STATUSES.includes(project.status)
      ) {
        return false;
      }

      const idKey = String(project.id);

      if (seenIds.has(idKey)) {
        return false;
      }

      seenIds.add(idKey);
      return true;
    });

    hasLoadedProjects = true;

    // If the record being edited disappeared from the API, exit edit mode.
    if (
      editingId !== null &&
      !projects.some((project) => String(project.id) === String(editingId))
    ) {
      resetForm();
      message.textContent =
        "The project being edited no longer exists. Edit mode has been cancelled.";
    }

    renderProjects();
    return true;
  } catch (error) {
    const networkError =
      error instanceof TypeError
        ? "Could not connect to the server. Check that the Express server is running and try again."
        : error.message || "An unexpected error occurred while loading projects.";

    message.textContent = `Could not load projects: ${networkError}`;

    // Keep the empty state hidden if the initial load failed.
    if (!hasLoadedProjects) {
      emptyState.hidden = true;
    }

    return false;
  }
}

// Perform a mutation, then reload the API collection.
// The form is reset only after the mutation itself succeeds.
async function performMutation(url, method, projectData, successMessage) {
  if (isBusy) {
    return false;
  }

  isBusy = true;
  updateControls();
  message.textContent =
    method === "DELETE" ? "Deleting project..." : "Saving project...";

  try {
    const options = {
      method,
      headers: {}
    };

    if (projectData !== null) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(projectData);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(await getApiError(response));
    }

    // The server has confirmed that the mutation succeeded.
    if (method === "POST" || method === "PUT") {
      resetForm();
    }

    if (
      method === "DELETE" &&
      editingId !== null &&
      String(editingId) === String(url.split("/").pop())
    ) {
      resetForm();
    }

    // Do not add records optimistically. Reload the server's collection.
    const refreshed = await loadProjects();

    if (refreshed) {
      message.textContent = successMessage;
    } else {
      message.textContent =
        `${successMessage} However, the latest project list could not be loaded. Please refresh the page or try again.`;
    }

    return true;
  } catch (error) {
    const errorMessage =
      error instanceof TypeError
        ? "Could not connect to the server. Check that the Express server is running and try again."
        : error.message || "An unexpected error occurred.";

    message.textContent = `Could not ${method === "POST" ? "add" : method === "PUT" ? "update" : "delete"} project: ${errorMessage}`;

    return false;
  } finally {
    isBusy = false;
    updateControls();
  }
}

// Handle both adding and updating through one submit listener.
projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isBusy) {
    return;
  }

  const name = nameInput.value.trim();
  const status = statusSelect.value;

  if (name.length === 0) {
    message.textContent = "Please enter a project name.";
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    message.textContent = "Project names must be 80 characters or fewer.";
    nameInput.focus();
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    message.textContent = "Please select a valid project status.";
    statusSelect.focus();
    return;
  }

  const projectData = { name, status };

  if (editingId === null) {
    await performMutation(
      "/api/projects",
      "POST",
      projectData,
      "Project added successfully."
    );

    return;
  }

  const projectExists = projects.some(
    (project) => String(project.id) === String(editingId)
  );

  if (!projectExists) {
    message.textContent = "Project not found. Please try again.";
    resetForm();
    return;
  }

  await performMutation(
    `/api/projects/${encodeURIComponent(editingId)}`,
    "PUT",
    projectData,
    "Project updated successfully."
  );
});

// Handle Edit and Delete button clicks.
projectList.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-project-id]");

  if (
    !actionButton ||
    !projectList.contains(actionButton) ||
    isBusy
  ) {
    return;
  }

  const projectId = actionButton.dataset.projectId;

  const project = projects.find(
    (item) => String(item.id) === projectId
  );

  if (!project) {
    message.textContent = "Project not found. Reloading the project list...";
    isBusy = true;
    updateControls();

    try {
      await loadProjects();
    } finally {
      isBusy = false;
      updateControls();
    }

    return;
  }

  if (actionButton.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`
    );

    if (!confirmed) {
      message.textContent = "Deletion cancelled. No changes were made.";
      return;
    }

    await performMutation(
      `/api/projects/${encodeURIComponent(project.id)}`,
      "DELETE",
      null,
      `Project "${project.name}" deleted successfully.`
    );

    return;
  }

  // Select a project for editing without changing its server ID.
  editingId = project.id;

  nameInput.value = project.name;
  statusSelect.value = project.status;

  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;

  message.textContent = `Editing "${project.name}".`;
  nameInput.focus();
});

// Discard unsaved form changes without making an API request.
cancelButton.addEventListener("click", () => {
  if (isBusy) {
    return;
  }

  resetForm();
  message.textContent = "Editing cancelled. No changes were saved.";
});

// Load the API collection when the page starts.
async function initializeProjects() {
  isBusy = true;
  updateControls();
  emptyState.hidden = true;
  message.textContent = "Loading projects...";

  try {
    const loaded = await loadProjects();

    if (loaded) {
      message.textContent = projects.length
        ? "Projects loaded successfully."
        : "No projects have been added yet.";
    }
  } finally {
    isBusy = false;
    updateControls();
  }
}

initializeProjects();