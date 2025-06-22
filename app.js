import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { db } from './db.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: window.env.FIREBASE_API_KEY,
  authDomain: window.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.env.FIREBASE_PROJECT_ID,
  messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Initialize Supabase
const supabase = createClient(
  window.env.NEXT_PUBLIC_SUPABASE_URL,
  window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Login function
window.login = async function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert('Login successful');
    window.currentUser = auth.currentUser;
    await syncOfflineData();
    document.getElementById('login').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
};

// Logout function
window.logout = async function() {
  try {
    await signOut(auth);
    alert('Logged out');
    window.currentUser = null;
    window.currentCourseId = null;
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
  } catch (error) {
    alert('Logout failed: ' + error.message);
  }
};

// Add a new course
window.addCourse = async function(courseName) {
  try {
    if (navigator.onLine) {
      const docRef = await addDoc(collection(firestore, 'courses'), {
        name: courseName,
        createdAt: new Date()
      });
      await db.courses.add({ id: docRef.id, name: courseName, maps: [] });
      alert('Course added: ' + courseName);
      window.currentCourseId = docRef.id;
      return docRef.id;
    } else {
      const tempId = 'offline_' + Date.now();
      await db.courses.add({ id: tempId, name: courseName, maps: [] });
      alert('Course saved offline. Will sync when online.');
      window.currentCourseId = tempId;
      return tempId;
    }
  } catch (error) {
    alert('Error adding course: ' + error.message);
  }
};

// Upload map image to Supabase
window.uploadMap = async function(file, courseId, holeNumber) {
  if (!file || !file.type.match('image.*') || file.size > 500 * 1024) {
    alert('Only images under 500KB are allowed');
    return null;
  }
  try {
    const fileName = `course_${courseId}_hole_${holeNumber}_${Date.now()}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from('maps')
      .upload(fileName, file);
    if (error) throw error;
    const { publicUrl } = supabase.storage.from('maps').getPublicUrl(fileName).data;
    await db.courses.update(courseId, {
      maps: db.courses.get(courseId).then(c => [...(c.maps || []), { holeNumber, url: publicUrl }])
    });
    return publicUrl;
  } catch (error) {
    alert('Error uploading map: ' + error.message);
    return null;
  }
};

// Add a bunker to a course
window.addBunker = async function(courseId, holeNumber, lat, lng) {
  try {
    if (navigator.onLine) {
      const docRef = await addDoc(collection(firestore, `courses/${courseId}/bunkers`), {
        holeNumber,
        lat,
        lng,
        createdAt: new Date()
      });
      await db.bunkers.add({ id: docRef.id, courseId, holeNumber, lat, lng });
      return docRef.id;
    } else {
      const tempId = 'offline_' + Date.now();
      await db.bunkers.add({ id: tempId, courseId, holeNumber, lat, lng });
      return tempId;
    }
  } catch (error) {
    alert('Error adding bunker: ' + error.message);
  }
};

// Add a task with offline support
window.addTask = async function(courseId, bunkerId, taskType, description) {
  try {
    if (navigator.onLine) {
      const docRef = await addDoc(collection(firestore, 'tasks'), {
        courseId,
        bunkerId,
        taskType,
        description,
        createdAt: new Date(),
        status: 'pending'
      });
      await db.tasks.add({
        id: docRef.id,
        courseId,
        bunkerId,
        description,
        type: taskType,
        status: 'synced',
        timestamp: Date.now()
      });
      alert('Task added: ' + description);
      return docRef.id;
    } else {
      const tempId = 'offline_' + Date.now();
      await db.tasks.add({
        id: tempId,
        courseId,
        bunkerId,
        description,
        type: taskType,
        status: 'pending',
        timestamp: Date.now()
      });
      alert('Task saved offline. Will sync when online.');
      return tempId;
    }
  } catch (error) {
    alert('Error adding task: ' + error.message);
  }
};

// Load courses
window.loadCourses = async function() {
  try {
    if (navigator.onLine) {
      const querySnapshot = await getDocs(collection(firestore, 'courses'));
      const courses = [];
      querySnapshot.forEach(doc => {
        courses.push({ id: doc.id, ...doc.data() });
      });
      await db.courses.clear();
      await db.courses.bulkAdd(courses.map(c => ({ id: c.id, name: c.name, maps: c.maps || [] })));
      return courses;
    } else {
      return await db.courses.toArray();
    }
  } catch (error) {
    alert('Error loading courses: ' + error.message);
    return await db.courses.toArray();
  }
};

// Sync offline data to Firestore
async function syncOfflineData() {
  try {
    // Sync courses
    const offlineCourses = await db.courses.where('id').startsWith('offline_').toArray();
    for (const course of offlineCourses) {
      const docRef = await addDoc(collection(firestore, 'courses'), {
        name: course.name,
        createdAt: new Date()
      });
      await db.courses.update(course.id, { id: docRef.id });
    }
    // Sync bunkers
    const offlineBunkers = await db.bunkers.where('id').startsWith('offline_').toArray();
    for (const bunker of offlineBunkers) {
      const docRef = await addDoc(collection(firestore, `courses/${bunker.courseId}/bunkers`), {
        holeNumber: bunker.holeNumber,
        lat: bunker.lat,
        lng: bunker.lng,
        createdAt: new Date()
      });
      await db.bunkers.update(bunker.id, { id: docRef.id });
    }
    // Sync tasks
    const offlineTasks = await db.tasks.where('status').equals('pending').toArray();
    for (const task of offlineTasks) {
      const docRef = await addDoc(collection(firestore, 'tasks'), {
        courseId: task.courseId,
        bunkerId: task.bunkerId,
        taskType: task.type,
        description: task.description,
        createdAt: new Date(),
        status: 'pending'
      });
      await db.tasks.update(task.id, { id: docRef.id, status: 'synced' });
    }
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}

// UI functions
window.showAddCourse = function() {
  document.getElementById('add-course').classList.toggle('hidden');
};

window.showUploadMap = function() {
  document.getElementById('upload-map').classList.toggle('hidden');
};

window.filterTasks = async function(type) {
  try {
    const tasks = type === 'ALL' ? await db.tasks.toArray() : await db.tasks.where('type').equals(type).toArray();
    const tasksDiv = document.getElementById('tasks');
    tasksDiv.innerHTML = '<h2 class="text-xl mb-2">Tasks</h2>';
    tasks.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.textContent = `${task.type}: ${task.description} (${task.status})`;
      tasksDiv.appendChild(taskEl);
    });
  } catch (error) {
    alert('Error filtering tasks: ' + error.message);
  }
};

window.updateTaskStatus = async function(status) {
  try {
    const taskId = prompt('Enter task ID to update:');
    if (!taskId) return;
    if (navigator.onLine) {
      await updateDoc(doc(firestore, 'tasks', taskId), { status });
      await db.tasks.update(taskId, { status });
      alert(`Task ${taskId} updated to ${status}`);
    } else {
      await db.tasks.update(taskId, { status });
      alert(`Task ${taskId} updated offline. Will sync when online.`);
    }
  } catch (error) {
    alert('Error updating task: ' + error.message);
  }
};

window.clearJobs = async function() {
  try {
    await db.tasks.clear();
    if (navigator.onLine) {
      // Note: Firestore tasks need manual deletion or a specific endpoint
      alert('Local tasks cleared. Sync with Firestore manually.');
    } else {
      alert('Local tasks cleared offline.');
    }
  } catch (error) {
    alert('Error clearing tasks: ' + error.message);
  }
};

window.saveTasks = async function() {
  await syncOfflineData();
  alert('Tasks saved and synced.');
};

// Sync on connectivity change
window.addEventListener('online', syncOfflineData);

// Expose functions for global access
window.auth = auth; // For logout
export { supabase, firestore }; // For map.js