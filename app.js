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
let supabase;
try {
  if (!window.env.NEXT_PUBLIC_SUPABASE_URL || !window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL or Anon Key is undefined');
  }
  supabase = createClient(
    window.env.NEXT_PUBLIC_SUPABASE_URL,
    window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
} catch (error) {
  console.error('Supabase initialization failed:', error);
}

// Login function
window.login = async function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    window.currentUser = userCredential.user;
    alert('Login successful');
    window.location.href = '/dashboard.html';
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
};

// Add course
window.addCourse = async function(courseName) {
  try {
    const docRef = await addDoc(collection(firestore, 'courses'), {
      name: courseName,
      createdBy: window.currentUser.uid,
      createdAt: new Date()
    });
    await db.courses.put({
      id: docRef.id,
      name: courseName
    });
    alert('Course added');
    return docRef.id;
  } catch (error) {
    console.error('Error adding course:', error);
    alert('Failed to add course');
  }
};

// Upload map to Supabase
window.uploadMap = async function(courseId, file) {
  if (!supabase) {
    alert('Supabase not initialized');
    return;
  }
  try {
    const fileName = `${courseId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from('maps')
      .upload(fileName, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('maps')
      .getPublicUrl(fileName);
    await db.maps.put({
      id: fileName,
      courseId,
      url: urlData.publicUrl
    });
    alert('Map uploaded');
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading map:', error);
    alert('Failed to upload map');
  }
};

// Add task
window.addTask = async function(courseId, bunkerId, description, type) {
  try {
    const docRef = await addDoc(collection(firestore, 'tasks'), {
      courseId,
      bunkerId,
      description,
      type,
      status: 'pending',
      createdBy: window.currentUser.uid,
      timestamp: new Date()
    });
    await db.tasks.put({
      id: docRef.id,
      courseId,
      bunkerId,
      description,
      type,
      status: 'pending',
      timestamp: new Date()
    });
    alert('Task added');
  } catch (error) {
    console.error('Error adding task:', error);
    alert('Failed to add task');
  }
};

// Fetch courses
window.fetchCourses = async function() {
  try {
    const querySnapshot = await getDocs(collection(firestore, 'courses'));
    const courses = [];
    querySnapshot.forEach(doc => {
      courses.push({ id: doc.id, ...doc.data() });
    });
    await db.courses.bulkPut(courses);
    return courses;
  } catch (error) {
    console.error('Error fetching courses:', error);
    return await db.courses.toArray();
  }
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/dashboard.html') {
    fetchCourses().then(courses => {
      // Render courses in dashboard
      const courseList = document.getElementById('course-list');
      if (courseList) {
        courseList.innerHTML = courses.map(course => `<li>${course.name}</li>`).join('');
      }
    });
  }
});