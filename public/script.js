const projectForm = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusSelect = document.getElementById("status");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");
const emptyState = document.getElementById("empty-state");
const projectList = document.getElementById("project-list");

// Projects exist only while this page is running.
const projects = [];

let nextProjectId = 1;
let editingId = null;

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

    listItem.append(
      projectName,
      projectStatus,
      document.createTextNode(" "),
      editButton
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
    message.textContent = "Project names must be 80 characters or fewer.";
    nameInput.focus();
    return;
  }

  if (editingId === null) {
    // Add a new project.
    projects.push({
      id: nextProjectId++,
      name: name,
      status: status
    });

    message.textContent = "Project added successfully.";
  } else {
    // Update the existing project without changing its ID.
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

    message.textContent = "Project updated successfully.";
  }

  resetForm();
  renderProjects();
});

// Select a project for editing using its stable ID.
projectList.addEventListener("click", (event) => {
  const editButton = event.target.closest(
    "button[data-project-id]"
  );

  if (!editButton || !projectList.contains(editButton)) {
    return;
  }

  const projectId = Number(editButton.dataset.projectId);

  const project = projects.find(
    (item) => item.id === projectId
  );

  if (!project) {
    message.textContent = "Project not found.";
    return;
  }

  editingId = project.id;

  nameInput.value = project.name;
  statusSelect.value = project.status;

  saveButton.textContent = "Save changes";
  cancelButton.hidden = false;

  message.textContent = `Editing "${project.name}".`;
  nameInput.focus();
});

// Discard unsaved changes and return to Add mode.
cancelButton.addEventListener("click", () => {
  resetForm();
  message.textContent = "Editing cancelled. No changes were saved.";
});

// Show the initial empty state.
renderProjects();
