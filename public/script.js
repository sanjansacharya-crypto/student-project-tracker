
const projectForm = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusSelect = document.getElementById("status");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const projectList = document.getElementById("project-list");

const STORAGE_KEY = "workshop-projects-v1";
const VALID_STATUSES = ["Planned", "In Progress", "Completed"];

let projects = [];
let nextProjectId = 1;
let editingId = null;

// Prevent writes if storage could not be read or contains invalid data.
let storageReady = false;

// Check that stored data has the expected project structure.
function isValidProjectArray(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every((project) => {
    if (
      project === null ||
      typeof project !== "object" ||
      !Number.isSafeInteger(project.id) ||
      project.id < 1 ||
      ids.has(project.id) ||
      typeof project.name !== "string" ||
      project.name.trim().length === 0 ||
      project.name.length > 80 ||
      !VALID_STATUSES.includes(project.status)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

// Load saved projects when the page starts.
function loadProjects() {
  let storedData;

  try {
    storedData = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    message.textContent =
      "Could not read saved projects. Changes cannot be saved.";
    return;
  }

  // A missing key means this is a new tracker.
  if (storedData === null) {
    storageReady = true;
    return;
  }

  let parsedData;

  try {
    // Convert stored text back into a JavaScript value.
    parsedData = JSON.parse(storedData);
  } catch (error) {
    message.textContent =
      "Saved project data is invalid JSON. Existing stored data was not changed.";
    return;
  }

  if (!isValidProjectArray(parsedData)) {
    message.textContent =
      "Saved project data has an invalid structure. Existing stored data was not changed.";
    return;
  }

  projects = parsedData;
  storageReady = true;

  // Generate IDs greater than all restored IDs.
  if (projects.length > 0) {
    nextProjectId = Math.max(
      ...projects.map((project) => project.id)
    ) + 1;
  }
}

// Save the current collection.
function saveProjects() {
  if (!storageReady) {
    message.textContent =
      "Changes could not be saved. Storage is unavailable or contains invalid data.";
    return false;
  }

  try {
    // Convert the project collection into text for storage.
    const serializedProjects = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, serializedProjects);
    return true;
  } catch (error) {
    message.textContent =
      "Changes could not be saved. Browser storage may be unavailable or full.";
    return false;
  }
}

// Reset the form to its normal Add mode.
function resetForm() {
  projectForm.reset();
  editingId = null;
  saveButton.textContent = "Save Project";
  cancelButton.hidden = true;
}

// Display all projects.
function renderProjects() {
  projectList.replaceChildren();

  emptyState.hidden = projects.length > 0;

  projects.forEach((project) => {
    const listItem = document.createElement("li");

    const projectName = document.createElement("strong");
    projectName.textContent = project.name;

    const projectStatus = document.createElement("span");
    projectStatus.textContent = ` — ${project.status}`;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.dataset.projectId = String(project.id);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.dataset.projectId = String(project.id);
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
}

// Handle both adding and updating through one submit listener.
projectForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusSelect.value;

  if (name.length === 0) {
    message.textContent = "Please enter a project name.";
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    message.textContent =
      "Project names must be 80 characters or fewer.";
    nameInput.focus();
    return;
  }

  if (!VALID_STATUSES.includes(status)) {
    message.textContent = "Please select a valid project status.";
    statusSelect.focus();
    return;
  }

  if (editingId === null) {
    // Create a new project.
    projects.push({
      id: nextProjectId++,
      name: name,
      status: status
    });

    resetForm();
    renderProjects();

    if (saveProjects()) {
      message.textContent = "Project added and saved successfully.";
    }

    return;
  }

  // Update the selected project without changing its ID.
  const project = projects.find(
    (item) => item.id === editingId
  );

  if (!project) {
    message.textContent = "Project not found. Please try again.";
    resetForm();
    return;
  }

  project.name = name;
  project.status = status;

  resetForm();
  renderProjects();

  if (saveProjects()) {
    message.textContent = "Project updated and saved successfully.";
  }
});

// Handle Edit and Delete button clicks.
projectList.addEventListener("click", (event) => {
  const actionButton = event.target.closest(
    "button[data-project-id]"
  );

  if (!actionButton || !projectList.contains(actionButton)) {
    return;
  }

  const projectId = Number(actionButton.dataset.projectId);

  const project = projects.find(
    (item) => item.id === projectId
  );

  if (!project) {
    message.textContent = "Project not found.";
    return;
  }

  // Delete the selected project by its stable ID.
  if (actionButton.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"?`
    );

    if (!confirmed) {
      message.textContent = "Deletion cancelled.";
      return;
    }

    const projectIndex = projects.findIndex(
      (item) => item.id === projectId
    );

    if (projectIndex === -1) {
      message.textContent = "Project not found.";
      return;
    }

    projects.splice(projectIndex, 1);

    // Exit edit mode if the deleted project was being edited.
    if (editingId === projectId) {
      resetForm();
    }

    renderProjects();

    if (saveProjects()) {
      message.textContent = `Project "${project.name}" deleted and changes saved.`;
    }

    return;
  }

  // Select a project for editing.
  editingId = project.id;

  nameInput.value = project.name;
  statusSelect.value = project.status;

  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;

  message.textContent = `Editing "${project.name}".`;
  nameInput.focus();
});

// Discard unsaved form changes without writing to storage.
cancelButton.addEventListener("click", () => {
  resetForm();
  message.textContent = "Editing cancelled. No changes were saved.";
});

// Restore projects before rendering the initial list.
loadProjects();
renderProjects();
