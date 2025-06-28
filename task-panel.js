import { db } from './db.js';
import { collection, addDoc, getDocs, query, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js';

export async function renderTaskButtons() {
  console.log('Rendering tasks, courseId:', window.currentCourseId, 'user:', window.currentUser?.uid);
  const taskList = document.getElementById('task-list');
  if (!taskList) {
    console.error('Task list element not found');
    return;
  }
  taskList.innerHTML = '<li class="p-3 text-gray-500">Loading tasks...</li>';

  if (!window.currentCourseId) {
    console.warn('No course selected');
    taskList.innerHTML = '<li class="p-3 text-gray-500">Select a course to view tasks.</li>';
    return;
  }

  try {
    console.log('Fetching tasks from Dexie for courseId:', window.currentCourseId);
    let tasks = await db.tasks.where({ courseId: window.currentCourseId }).toArray();
    console.log('Dexie tasks:', tasks);

    if (window.currentUser && window.firestore) {
      console.log('Fetching tasks from Firestore');
      const tasksQuery = query(collection(window.firestore, 'courses', window.currentCourseId, 'tasks'));
      const tasksSnapshot = await getDocs(tasksQuery);
      tasks = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        courseId: window.currentCourseId,
        ...doc.data()
      }));
      console.log('Firestore tasks:', tasks);
      if (tasks.length) {
        await db.tasks.bulkPut(tasks);
        console.log('Tasks cached in Dexie');
      }
    }

    taskList.innerHTML = '';
    if (!tasks.length) {
      console.log('No tasks found for courseId:', window.currentCourseId);
      taskList.innerHTML = '<li class="p-3 text-gray-500">No tasks for this course.</li>';
      return;
    }

    tasks.forEach(task => {
      const statusColor = {
        urgent: 'text-red-500',
        'needs-attention': 'text-orange-500',
        ok: 'text-green-500'
      }[task.status] || 'text-gray-500';

      const li = document.createElement('li');
      li.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200 mb-2';
      li.innerHTML = `
        <span class="${statusColor}">${task.description} (${task.type})</span>
        <select onchange="window.updateTaskStatus('${task.id}', this.value)" class="p-1 text-sm rounded">
          <option value="urgent" ${task.status === 'urgent' ? 'selected' : ''}>🔴 Urgent</option>
          <option value="needs-attention" ${task.status === 'needs-attention' ? 'selected' : ''}>🟠 Needs Attention</option>
          <option value="ok" ${task.status === 'ok' ? 'selected' : ''}>🟢 OK</option>
        </select>
      `;
      taskList.appendChild(li);
    });
  } catch (err) {
    console.error('Error rendering tasks:', err);
    taskList.innerHTML = '<li class="p-3 text-red-500">Error loading tasks: ' + err.message + '</li>';
  }
}

window.addTask = async () => {
  if (!window.currentUser || !window.currentCourseId) {
    console.warn('Cannot add task, missing user or courseId:', window.currentUser, window.currentCourseId);
    alert('Please log in and select a course first.');
    return;
  }

  const description = prompt('Enter task description:');
  const type = prompt('Enter task type (e.g., Maintenance, Inspection):');
  if (!description || !type) {
    alert('Description and type are required.');
    return;
  }

  try {
    const task = {
      courseId: window.currentCourseId,
      description,
      type,
      status: 'needs-attention',
      timestamp: new Date().toISOString(),
      bunkerId: null
    };
    console.log('Adding task:', task);

    const docRef = await addDoc(
      collection(window.firestore, 'courses', window.currentCourseId, 'tasks'),
      task
    );
    console.log('Task added to Firestore, ID:', docRef.id);

    await db.tasks.put({ id: docRef.id, ...task });
    console.log('Task cached in Dexie');
    alert('Task added successfully.');
    await renderTaskButtons();
  } catch (err) {
    console.error('Error adding task:', err);
    alert('Failed to add task: ' + err.message);
  }
};

window.updateTaskStatus = async (taskId, status) => {
  if (!window.currentUser || !window.currentCourseId) {
    console.warn('Cannot update task, missing user or courseId:', window.currentUser, window.currentCourseId);
    alert('Please log in and select a course first.');
    return;
  }

  try {
    console.log('Updating task status, ID:', taskId, 'Status:', status);
    await db.tasks.update(taskId, { status });
    console.log('Task updated in Dexie');

    if (window.firestore) {
      const taskRef = doc(window.firestore, 'courses', window.currentCourseId, 'tasks', taskId);
      await updateDoc(taskRef, { status });
      console.log('Task updated in Firestore');
    }

    await renderTaskButtons();
  } catch (err) {
    console.error('Error updating task status:', err);
    alert('Failed to update task status: ' + err.message);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('Task panel initialized');
  const tasksSection = document.getElementById('tasks');
  if (!tasksSection) {
    console.error('Tasks section not found');
    return;
  }

  const observer = new MutationObserver(() => {
    console.log('Tasks section visibility changed, hidden:', tasksSection.classList.contains('hidden'));
    if (!tasksSection.classList.contains('hidden')) {
      renderTaskButtons();
    }
  });
  observer.observe(tasksSection, { attributes: true, attributeFilter: ['class'] });

  let lastCourseId = window.currentCourseId;
  const courseChangeInterval = setInterval(() => {
    if (window.currentCourseId !== lastCourseId) {
      console.log('Course changed from', lastCourseId, 'to', window.currentCourseId);
      lastCourseId = window.currentCourseId;
      if (!tasksSection.classList.contains('hidden')) {
        renderTaskButtons();
      }
    }
  }, 1000);
});

document.addEventListener('click', (e) => {
  if (e.target.id === 'add-task-btn') {
    console.log('Add task button clicked');
    window.addTask();
  }
});