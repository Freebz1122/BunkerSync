import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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
const supabase = createClient(window.env.NEXT_PUBLIC_SUPABASE_URL, window.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

window.currentUser = null;
window.currentCourseId = null;

window.signIn = async () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed: ' + error.message);
  }
};

window.signOut = async () => {
  await signOut(auth);
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
};

window.showSection = (sectionId) => {
  document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
  if (sectionId === 'tasks') window.fetchTasks();
};

window.addCourse = async () => {
  const courseName = document.getElementById('course-name').value;
  if (!courseName || !window.currentUser) return alert('Enter a course name and sign in.');
  try {
    const docRef = await addDoc(collection(firestore, 'courses'), {
      name: courseName,
      createdBy: window.currentUser.uid,
      createdAt: new Date()
    });
    window.currentCourseId = docRef.id;
    document.getElementById('course-id').textContent = docRef.id;
    await window.fetchCourses();
  } catch (error) {
    console.error('Add course failed:', error);
    alert('Add course failed');
  }
};

window.fetchCourses = async () => {
  try {
    const querySnapshot = await getDocs(collection(firestore, 'courses'));
    const courseList = document.getElementById('course-list');
    courseList.innerHTML = '';
    const courses = [];
    querySnapshot.forEach(doc => {
      const course = { id: doc.id, ...doc.data() };
      courses.push(course);
      const li = document.createElement('li');
      li.textContent = course.name;
      li.className = 'p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer';
      li.onclick = () => {
        window.currentCourseId = course.id;
        document.getElementById('course-id').textContent = course.id;
        window.fetchTasks();
        window.fetchCourses(); // Refresh logo
      };
      courseList.appendChild(li);
    });
    if (window.currentCourseId) {
      const logoQuery = await getDocs(collection(firestore, 'courses', window.currentCourseId, 'logos'));
      const logo = logoQuery.docs[0]?.data()?.url || '/images/placeholder-logo.png';
      document.getElementById('course-logo').src = logo;
    }
    return courses;
  } catch (error) {
    console.error('Fetch courses failed:', error);
    alert('Fetch courses failed');
    return [];
  }
};

window.uploadLogo = async () => {
  const file = document.getElementById('logo-file').files[0];
  if (!file || !window.currentCourseId) return alert('Select a file and course.');
  try {
    const fileName = `${window.currentCourseId}/logo-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('logos').upload(fileName, file);
    if (error) throw new Error('Logo upload failed: ' + error.message);
    const { data } = supabase.storage.from('logos').getPublicUrl(fileName);
    await addDoc(collection(firestore, 'courses', window.currentCourseId, 'logos'), {
      url: data.publicUrl,
      uploadedAt: new Date()
    });
    document.getElementById('course-logo').src = data.publicUrl;
    alert('Logo uploaded');
  } catch (e) {
    console.error(e);
    alert('Logo upload failed');
  }
};

window.uploadMap = async () => {
  const file = document.getElementById('map-file').files[0];
  if (!file || !window.currentCourseId) return alert('Select a file and course.');
  try {
    const fileName = `${window.currentCourseId}/map-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('maps').upload(fileName, file);
    if (error) throw new Error('Map upload failed: ' + error.message);
    const { data } = supabase.storage.from('maps').getPublicUrl(fileName);
    await addDoc(collection(firestore, 'courses', window.currentCourseId, 'maps'), {
      url: data.publicUrl,
      uploadedAt: new Date()
    });
    alert('Map uploaded');
  } catch (e) {
    console.error(e);
    alert('Map upload failed');
  }
};

window.toggleTheme = () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
};

onAuthStateChanged(auth, async user => {
  if (user) {
    window.currentUser = user;
    document.getElementById('login').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    await window.fetchCourses();
    window.fetchTasks();
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } else {
    window.currentUser = null;
    window.currentCourseId = null;
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
  }
});