// ✅ Enhanced map.js: draggable bunker placement and saving
import { db } from './db.js';
import {
  getDoc,
  doc,
  collection,
  getDocs,
  query,
  where,
  addDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

let map = null;
let markers = [];
let gridOverlay = null;
let gridEnabled = false;
let placingMode = false;
let placingCount = 0;
let placedBunkers = [];

// Load map image for selected hole
window.loadMap = async function (hole) {
  if (!window.currentCourseId || !hole) {
    document.getElementById('map').innerHTML = '<p>No course or hole selected.</p>';
    return;
  }

  try {
    const mapEntry = await db.maps.where({ courseId: window.currentCourseId, holeNumber: hole }).first();
    if (!mapEntry || !mapEntry.url) {
      document.getElementById('map').innerHTML = '<p>No map available for this hole.</p>';
      return;
    }

    if (map) map.remove();
    map = L.map('map').setView([0, 0], 1);
    L.imageOverlay(mapEntry.url, [[-100, -100], [100, 100]]).addTo(map);
    map.fitBounds([[-100, -100], [100, 100]]);

    markers.forEach(m => m.remove());
    markers = [];

    const bunkersSnapshot = await getDocs(
      query(collection(firestore, 'courses', window.currentCourseId, 'bunkers'), where('holeNumber', '==', hole))
    );
    bunkersSnapshot.forEach(doc => {
      const { lat, lng } = doc.data();
      const marker = L.marker([lat, lng]).addTo(map);
      markers.push(marker);
    });

    map.on('click', e => {
      if (!placingMode) return;
      const marker = L.marker(e.latlng, { draggable: true }).addTo(map);
      markers.push(marker);
      placedBunkers.push(marker);

      if (placedBunkers.length === placingCount) {
        placingMode = false;
        alert('All bunkers placed. Drag into position, then click Save Bunkers.');
      }
    });
  } catch (err) {
    console.error('Map loading failed:', err);
    document.getElementById('map').innerHTML = '<p>Error loading map.</p>';
  }
};

window.startPlacingBunkers = () => {
  const count = parseInt(document.getElementById('bunker-count').value);
  if (!count || count < 1) {
    alert('Enter a valid number of bunkers.');
    return;
  }
  placingMode = true;
  placingCount = count;
  placedBunkers = [];
  document.getElementById('save-bunkers-btn').classList.remove('hidden');
  alert(`Click ${count} times on the map to place bunkers.`);
};

window.savePlacedBunkers = async () => {
  if (!window.currentUser || !window.currentCourseId) return alert('Login and select a course first.');
  const hole = document.getElementById('hole-select').value;
  if (!hole) return alert('Select a hole.');

  for (const m of placedBunkers) {
    const { lat, lng } = m.getLatLng();
    await addDoc(collection(firestore, 'courses', window.currentCourseId, 'bunkers'), {
      holeNumber: hole,
      lat,
      lng,
      createdAt: new Date()
    });
  }

  alert(`${placedBunkers.length} bunkers saved.`);
  document.getElementById('save-bunkers-btn').classList.add('hidden');
  placingMode = false;
  loadMap(hole);
};

window.toggleGrid = function () {
  gridEnabled = !gridEnabled;
  const btn = document.querySelector('button[onclick="toggleGrid()"]');
  btn.textContent = `Grid: ${gridEnabled ? 'On' : 'Off'}`;
  if (gridEnabled) {
    gridOverlay = L.grid().addTo(map);
  } else if (gridOverlay) {
    map.removeLayer(gridOverlay);
    gridOverlay = null;
  }
};