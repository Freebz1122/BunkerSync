import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
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
    window.location.href = '/dashboard.html';
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
};

// Add a new course
async function addCourse(courseName) {
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
}

// Upload map image to Supabase
async function uploadMap(file, courseId, holeNumber) {
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
}

// Add a bunker to a course
async function addBunker(courseId, holeNumber, lat, lng) {
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
}

// Add a task with offline support
async function addTask(courseId, bunkerId, taskType, description) {
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
}

// Load courses
async function loadCourses() {
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
}

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

// Sync on connectivity change
window.addEventListener('online', syncOfflineData);

// Expose functions for global access
window.addCourse = addCourse;
window.uploadMap = uploadMap;
window.addBunker = addBunker;
window.addTask = addTask;
window.loadCourses = loadCourses;

export { supabase, firestore }; // For map.js