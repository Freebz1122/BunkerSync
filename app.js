import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, arrayUnion, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import './db.js';

const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID
};

const supabase = createClient(
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
export { db, auth, supabase };

let currentCourseId = null;
let currentHole = null;
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login').style.display = 'none';
    document.getElementById('admin-panel').style.display = user.email === 'admin@example.com' ? 'block' : 'none';
    loadCourses();
  } else {
    document.getElementById('login').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
  }
});

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert('Logged in successfully');
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
}

async function logout() {
  await signOut(auth);
}

async function loadCourses() {
  const courseSelect = document.getElementById('course-select');
  const mapCourseSelect = document.getElementById('map-course-select');
  const taskCourseSelect = document.getElementById('task-course-select');
  courseSelect.innerHTML = '<option value="">Select Course</option>';
  mapCourseSelect.innerHTML = '<option value="">Select Course</option>';
  taskCourseSelect.innerHTML = '<option value="">Select Course</option>';
  const courses = await getDocs(collection(db, 'courses'));
  courses.forEach((doc) => {
    const data = doc.data();
    const option = document.createElement('option');
    option.value = doc.id;
    option.text = data.name;
    courseSelect.appendChild(option);
    mapCourseSelect.appendChild(option.cloneNode(true));
    taskCourseSelect.appendChild(option.cloneNode(true));
  });
}

async function loadCourse(courseId) {
  currentCourseId = courseId;
  const mapHoleSelect = document.getElementById('map-hole-select');
  mapHoleSelect.innerHTML = '<option value="">Select Hole</option>';
  const course = await getDoc(doc(db, 'courses', courseId));
  if (course.exists()) {
    const maps = course.data().maps || [];
    maps.forEach((map) => {
      const option = document.createElement('option');
      option.value = map.hole;
      option.text = `Hole ${map.hole}`;
      mapHoleSelect.appendChild(option);
    });
  }
  loadTasks();
}

function selectHole(hole) {
  currentHole = hole;
  loadMap(hole);
}

async function addCourse() {
  const name = document.getElementById('course-name').value;
  if (!name) {
    alert('Enter a course name');
    return;
  }
  try {
    const courseRef = doc(collection(db, 'courses'));
    await setDoc(courseRef, { name, maps: [] });
    alert('Course added');
    loadCourses();
  } catch (error) {
    alert('Error adding course: ' + error.message);
  }
}

async function uploadMap() {
  const file = document.getElementById('map-file').files[0];
  if (!file || !file.type.match('image.*') || file.size > 100 * 1024) {
    alert('Only images under 100KB are allowed');
    return;
  }
  if (!currentCourseId || !currentUser || currentUser.email !== 'admin@example.com') {
    alert('Admin access required');
    return;
  }
  const hole = document.getElementById('hole-number').value;
  if (!hole) {
    alert('Select a hole number');
    return;
  }
  try {
    const { data, error } = await supabase.storage
      .from('maps')
      .upload(`images/${currentCourseId}/hole${hole}.jpg`, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('maps')
      .getPublicUrl(`images/${currentCourseId}/hole${hole}.jpg`);
    const url = urlData.publicUrl;
    const courseRef = doc(db, 'courses', currentCourseId);
    await updateDoc(courseRef, {
      maps: arrayUnion({ hole: parseInt(hole), url })
    });
    alert('Map uploaded successfully');
  } catch (error) {
    alert('Upload failed: ' + error.message);
  }
}

async function addTask() {
  const description = document.getElementById('task-description').value;
  const type = document.getElementById('task-type').value;
  if (!description || !type || !currentCourseId) {
    alert('Enter task details and select a course');
    return;
  }
  try {
    await localDB.tasks.add({
      courseId: currentCourseId,
      description,
      type,
      status: 'pending',
      timestamp: new Date().toISOString()
    });
    loadTasks();
  } catch (error) {
    alert('Error adding task: ' + error.message);
  }
}

async function loadTasks() {
  const taskList = document.getElementById('task-list');
  taskList.innerHTML = '';
  const tasks = await localDB.tasks.toArray();
  const filteredTasks = currentCourseId
    ? tasks.filter((task) => task.courseId === currentCourseId)
    : tasks;
  filteredTasks.forEach((task) => {
    const li = document.createElement('li');
    li.textContent = `${task.description} (${task.type}, ${task.status})`;
    taskList.appendChild(li);
  });
}

window.login = login;
window.logout = logout;
window.loadCourse = loadCourse;
window.selectHole = selectHole;
window.addCourse = addCourse;
window.uploadMap = uploadMap;
window.addTask = addTask;
window.loadTasks = loadTasks;