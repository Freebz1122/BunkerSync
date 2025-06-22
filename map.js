import { db } from './db.js';
import { supabase, firestore } from './app.js';
import { getDoc, doc, collection, getDocs, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let map = null;
let markers = [];
let gridOverlay = null;
let gridEnabled = false;

async function loadMap(hole) {
  if (!window.currentCourseId || !hole) {
    document.getElementById('map').innerHTML = '<p>No map available</p>';
    return;
  }
  try {
    const courseDoc = await getDoc(doc(firestore, 'courses', window.currentCourseId));
    if (!courseDoc.exists()) {
      document.getElementById('map').innerHTML = '<p>Course not found</p>';
      return;
    }
    const mapData = courseDoc.data().maps?.find((m) => m.holeNumber === parseInt(hole) || m.holeNumber === hole);
    if (!mapData) {
      document.getElementById('map').innerHTML = '<p>No map available for this hole</p>';
      return;
    }
    if (map) {
      map.remove();
    }
    map = L.map('map').setView([0, 0], 1);
    L.imageOverlay(mapData.url, [[-100, -100], [100, 100]]).addTo(map);
    map.fitBounds([[-100, -100], [100, 100]]);
    markers.forEach((marker) => marker.remove());
    markers = [];
    const bunkers = await getDocs(query(collection(firestore, 'courses', window.currentCourseId, 'bunkers'), where('holeNumber', '==', hole)));
    bunkers.forEach((doc) => {
      const { lat, lng } = doc.data();
      const marker = L.marker([lat, lng]).addTo(map);
      markers.push(marker);
    });
    map.on('click', async (e) => {
      if (!window.currentUser || window.currentUser.email !== 'admin@example.com') {
        alert('Admin access required to add bunkers');
        return;
      }
      const { lat, lng } = e.latlng;
      const marker = L.marker([lat, lng]).addTo(map);
      markers.push(marker);
      await addDoc(collection(firestore, 'courses', window.currentCourseId, 'bunkers'), {
        holeNumber: hole,
        lat,
        lng,
        createdAt: new Date()
      });
    });
  } catch (error) {
    console.error('Error loading map:', error);
    document.getElementById('map').innerHTML = '<p>Error loading map</p>';
  }
}

function toggleGrid() {
  gridEnabled = !gridEnabled;
  const gridButton = document.getElementById('grid-toggle');
  gridButton.textContent = `Grid: ${gridEnabled ? 'On' : 'Off'}`;
  if (gridEnabled) {
    gridOverlay = L.grid().addTo(map);
  } else if (gridOverlay) {
    map.removeLayer(gridOverlay);
    gridOverlay = null;
  }
}

window.loadMap = loadMap;
window.toggleGrid = toggleGrid;