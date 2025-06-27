```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { db } from './db.js';

const firebaseConfig = {
  apiKey: window.env.FIREBASE_API_KEY,
  authDomain: window.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.env.FIREBASE_PROJECT_ID,
  messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
window.firestore = firestore;

let supabase;
try {
  supabase = createClient(
    window.env.NEXT_PUBLIC_SUPABASE_URL,
    window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  window.supabase = supabase;
} catch (error) {
  console.error('Supabase init failed:', error);
}

window.showAddCourse = () => {
  document.getElementById('add-course').classList.toggle('hidden');
};

window.showUploadMap = () => {
  document.getElementById('upload-map').classList.toggle('hidden');
};

window.login = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    window.currentUser = userCredential.user;
    console.log('Logged in user:', window.currentUser.uid);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    fetchCourses().then(displayCourses);
  } catch (e) {
    alert('Login failed: ' + e.message);
  }
};

window.addCourse = async (courseName) => {
  if (!window.currentUser) return alert('Login first.');
  try {
    const docRef = await addDoc(collection(firestore, 'courses'), {
      name: courseName,
      createdBy: window.currentUser.uid,
      createdAt: new Date()
    });
    window.currentCourseId = docRef.id;
    await db.courses.put({ id: docRef.id, name: courseName });
    alert('Course added');
    fetchCourses().then(displayCourses);
  } catch (e) {
    console.error('Add course failed:', e);
  }
};

window.handleMapUpload = async () => {
  const file = document.getElementById('map-file').files[0];
  const hole = document.getElementById('hole-number').value;
  const courseId = window.currentCourseId;
  if (!file || !hole || !courseId) return alert('Select file, hole, and course');
  try {
    const fileName = `${courseId}/hole-${hole}-${file.name}`;
    const { error } = await supabase.storage.from('maps').upload(fileName, file);
    if (error) {
      console.error('Supabase upload failed:', error);
      alert('Upload failed: ' + error.message);
      throw error;
    }
    const { data } = supabase.storage.from('maps').getPublicUrl(fileName);
    await db.maps.put({ id: fileName, courseId, url: data.publicUrl, holeNumber: hole });
    alert('Map uploaded');
  } catch (e) {
    console.error('Error uploading map:', e);
    alert('Upload failed');
  }
};

window.fetchCourses = async () => {
  try {
    const snapshot = await getDocs(collection(firestore, 'courses'));
    const courses = [];
    snapshot.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));
    await db.courses.bulkPut(courses);
    return courses;
  } catch (e) {
    console.error('Fetch courses failed:', e);
    return await db.courses.toArray();
  }
};

function displayCourses(courses) {
  const list = document.getElementById('course-list');
  list.innerHTML = '';
  courses.forEach(c => {
    const li = document.createElement('li');
    li.textContent = c.name;
    li.onclick = () => {
      window.currentCourseId = c.id;
      console.log('Selected Course ID:', window.currentCourseId);
      alert(`Course selected: ${c.name}`);
      if (window.renderTaskButtons) {
        window.renderTaskButtons();
      }
    };
    list.appendChild(li);
  });
}

onAuthStateChanged(auth, user => {
  if (user) {
    window.currentUser = user;
    console.log('Current User:', window.currentUser.uid);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    fetchCourses().then(displayCourses);
  }
});
```