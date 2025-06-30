// Define renderTaskButtons globally
window.renderTaskButtons = () => {
  console.log('Rendering task buttons');
  const taskPanel = document.getElementById('tasks');
  if (taskPanel) {
    taskPanel.innerHTML = '<button id="add-task-btn" class="p-2 bg-blue-500 text-white rounded">Add Task</button>';
  } else {
    console.error('Task panel element not found');
  }
};

// Handle click events
document.addEventListener('click', (e) => {
  if (e.target.id === 'add-task-btn') {
    console.log('Add task button clicked');
    window.addTask();
  }
});

// Initial render on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.renderTaskButtons();
});