import { db } from './db.js';
import { collection, addDoc, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let map = null;
let markers = [];
let gridOverlay = null;
let gridEnabled = false;
let placingMode = false;
let placingCount = 0;

window.renderMap = async () => {
  const canvas = document.getElementById('map-canvas');
  if (!canvas) {
    console.error('Map canvas not found');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Canvas context not available');
    return;
  }

  // Set canvas size
  canvas.width = 800;
  canvas.height = 600;

  // Load map image from Firestore/Supabase
  if (!window.currentCourseId) {
    console.warn('No course selected');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillText('Select a course to view the map.', 50, 50);
    return;
  }

  try {
    // Fetch map image URL
    const mapQuery = await getDocs(collection(window.firestore, 'courses', window.currentCourseId, 'maps'));
    const mapUrl = mapQuery.docs[0]?.data()?.url || '/images/placeholder-map.png';
    
    const img = new Image();
    img.src = mapUrl;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      loadBunkers();
    };
    img.onerror = () => {
      console.error('Failed to load map image');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillText('Failed to load map image.', 50, 50);
    };
  } catch (err) {
    console.error('Error loading map:', err);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillText('Error loading map: ' + err.message, 50, 50);
  }
};

async function loadBunkers() {
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  markers = [];

  try {
    // Fetch bunkers from Dexie
    let bunkers = await db.bunkers.where({ courseId: window.currentCourseId }).toArray();
    
    // Sync with Firestore
    if (window.currentUser && window.firestore) {
      const bunkersQuery = query(collection(window.firestore, 'courses', window.currentCourseId, 'bunkers'));
      const bunkersSnapshot = await getDocs(bunkersQuery);
      bunkers = bunkersSnapshot.docs.map(doc => ({
        id: doc.id,
        courseId: window.currentCourseId,
        ...doc.data()
      }));
      if (bunkers.length) {
        await db.bunkers.bulkPut(bunkers);
      }
    }

    // Draw bunkers
    bunkers.forEach(bunker => {
      ctx.beginPath();
      ctx.arc(bunker.x, bunker.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      markers.push({ id: bunker.id, x: bunker.x, y: bunker.y });
    });
  } catch (err) {
    console.error('Error loading bunkers:', err);
  }
}

canvas.addEventListener('click', async (e) => {
  if (!placingMode || !window.currentCourseId) return;

  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  try {
    const bunker = {
      courseId: window.currentCourseId,
      x,
      y,
      timestamp: new Date().toISOString()
    };
    const docRef = await addDoc(collection(window.firestore, 'courses', window.currentCourseId, 'bunkers'), bunker);
    await db.bunkers.put({ id: docRef.id, ...bunker });
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    markers.push({ id: docRef.id, x, y });

    placingCount--;
    if (placingCount <= 0) {
      placingMode = false;
    }
  } catch (err) {
    console.error('Error adding bunker:', err);
  }
});

window.togglePlacingMode = () => {
  placingMode = !placingMode;
  placingCount = placingMode ? 10 : 0; // Allow 10 bunkers per session
  console.log('Placing mode:', placingMode);
};

window.toggleGrid = () => {
  gridEnabled = !gridEnabled;
  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  
  if (gridEnabled) {
    gridOverlay = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gridSize = 50;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  } else if (gridOverlay) {
    ctx.putImageData(gridOverlay, 0, 0);
    loadBunkers();
  }
};

document.addEventListener('DOMContentLoaded', () => {
window.renderMap = () => {
  console.log('Rendering map');
  const mapDiv = document.getElementById('map');
  if (mapDiv) {
    mapDiv.innerHTML = '<p>Map placeholder</p>';
  } else {
    console.error('Map div not found');
  }
};

// Ensure it runs on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.renderMap();
});
});