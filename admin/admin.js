// admin/admin.js - Admin Panel with Supabase Cloud Sync (FIXED IMAGE DISPLAY)

let isLoggedIn = false;

document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('loginSection');
    const adminPanel = document.getElementById('adminPanel');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginError = document.getElementById('loginError');

    // Floor controls
    const floorSelect = document.getElementById('floorSelect');
    const addFloorBtn = document.getElementById('addFloorBtn');
    const removeFloorBtn = document.getElementById('removeFloorBtn');
    const renameFloorBtn = document.getElementById('renameFloorBtn');
    const renameFloorSection = document.getElementById('renameFloorSection');
    const floorNameInput = document.getElementById('floorNameInput');
    const confirmRenameBtn = document.getElementById('confirmRenameBtn');
    const cancelRenameBtn = document.getElementById('cancelRenameBtn');
    const floorWarning = document.getElementById('floorWarning');

    const mapContainer = document.getElementById('mapContainer');
    const floorPlanImg = document.getElementById('floorPlanImg');
    const floorPlanUpload = document.getElementById('floorPlanUpload');
    const clearMapBtn = document.getElementById('clearMapBtn');
    const addModeBtn = document.getElementById('addModeBtn');
    const deleteModeBtn = document.getElementById('deleteModeBtn');
    const connectModeBtn = document.getElementById('connectModeBtn');
    const disconnectModeBtn = document.getElementById('disconnectModeBtn');
    const addMarkerForm = document.getElementById('addMarkerForm');
    const markerNameInput = document.getElementById('markerName');
    const iconPicker = document.getElementById('iconPicker');
    const confirmAddMarker = document.getElementById('confirmAddMarker');
    const markersList = document.getElementById('markersList');
    const saveDataBtn = document.getElementById('saveDataBtn');

    let currentMode = null;
    let pendingMarker = null;
    let selectedIcon = '🛏️';
    let firstSelectedMarker = null;

    // ✅ SUPABASE CONFIGURATION
    const SUPABASE_URL = 'https://ejqrlglwogjpabmojfly.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJsZ2x3b2dqcGFibW9qZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU1NTcsImV4cCI6MjA4NTI5MTU1N30.OQeRNExX5PHG9BVmthuUFebVyyahg7tZWmmqCOLGBnE';
    let hotelId = 'default_hotel';

    // ✅ DIRECT API FUNCTIONS
    async function saveToCloudDirect() {
        try {
            const hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
            
            const checkResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/hotels?hotel_id=eq.${hotelId}`,
                {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            let method = 'POST';
            let url = `${SUPABASE_URL}/rest/v1/hotels`;
            
            if (checkResponse.ok) {
                const checkData = await checkResponse.json();
                if (checkData && checkData.length > 0) {
                    method = 'PATCH';
                    url = `${SUPABASE_URL}/rest/v1/hotels?hotel_id=eq.${hotelId}`;
                }
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': method === 'PATCH' ? 'return=minimal' : 'return=representation'
                },
                body: JSON.stringify({
                    hotel_id: hotelId,
                    hotel_data: hotelData,
                    updated_at: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            
            console.log('✅ Admin: Hotel data saved to cloud');
            return { success: true };
        } catch (error) {
            console.error('❌ Admin: Error saving to cloud:', error);
            return { success: false, error: error.message };
        }
    }

    async function loadFromCloudDirect() {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/hotels?hotel_id=eq.${hotelId}&select=hotel_data`,
                {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('ℹ️ Admin: No hotel data found in cloud');
                    return { success: true, data: null };
                }
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data && data.length > 0 && data[0].hotel_data) {
                console.log('✅ Admin: Hotel data loaded from cloud');
                return { success: true, data: data[0].hotel_data };
            } else {
                console.log('ℹ️ Admin: No hotel data found in cloud');
                return { success: true, data: null };
            }
        } catch (error) {
            console.error('❌ Admin: Error loading from cloud:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ SAFE DATA INITIALIZATION
    let hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
    
    // Load from cloud on page load
    const cloudResult = await loadFromCloudDirect();
    if (cloudResult.success && cloudResult.data) {
        hotelData = cloudResult.data;
        localStorage.setItem('hotelData', JSON.stringify(hotelData));
        console.log('📥 Admin: Loaded data from cloud storage');
    }
    
    console.log('Admin: Initial hotelData:', hotelData);
    
    if (!hotelData.floors) {
        hotelData.floors = {};
        console.log('Created empty floors object');
    }

    // Ensure at least Floor 1 exists with proper structure
    if (Object.keys(hotelData.floors).length === 0) {
        console.log('Creating default floor 1');
        hotelData.floors['1'] = { 
            markers: [], 
            connections: [], 
            floorPlanUrl: '',
            name: 'Floor 1',
            floorNumber: '1'
        };
        saveData(); // Save immediately
    } else {
        // Verify each floor has the right structure
        Object.keys(hotelData.floors).forEach(floorNum => {
            if (!hotelData.floors[floorNum].markers) hotelData.floors[floorNum].markers = [];
            if (!hotelData.floors[floorNum].connections) hotelData.floors[floorNum].connections = [];
            if (!hotelData.floors[floorNum].name) hotelData.floors[floorNum].name = `Floor ${floorNum}`;
            if (!hotelData.floors[floorNum].floorNumber) hotelData.floors[floorNum].floorNumber = floorNum;
        });
    }

    let currentFloor = Object.keys(hotelData.floors)[0] || '1';
    console.log('Current floor:', currentFloor, 'Available floors:', Object.keys(hotelData.floors));

    // ✅ HELPER: Get or create floor data
    function getFloorData(floorNum) {
        if (!hotelData.floors[floorNum]) {
            console.log('Creating new floor:', floorNum);
            hotelData.floors[floorNum] = { 
                markers: [], 
                connections: [], 
                floorPlanUrl: '',
                name: `Floor ${floorNum}`,
                floorNumber: floorNum
            };
        }
        return hotelData.floors[floorNum];
    }

    // ✅ SAVE ALL DATA (LOCAL + CLOUD)
    function saveData() {
        console.log('Saving data for floors:', Object.keys(hotelData.floors));
        localStorage.setItem('hotelData', JSON.stringify(hotelData));
    }

    // ✅ UPDATE FLOOR SELECTOR
    function updateFloorSelect() {
        console.log('Updating floor select');
        floorSelect.innerHTML = '';
        const floorNums = Object.keys(hotelData.floors).sort((a, b) => parseInt(a) - parseInt(b));
        console.log('Floor numbers:', floorNums);
        
        floorNums.forEach(floorNum => {
            const floorData = getFloorData(floorNum);
            const displayName = floorData.name || `Floor ${floorNum}`;
            const opt = document.createElement('option');
            opt.value = floorNum;
            opt.textContent = displayName;
            floorSelect.appendChild(opt);
        });
        floorSelect.value = currentFloor;
        removeFloorBtn.disabled = (floorNums.length <= 1);
        floorWarning.classList.toggle('hidden', floorNums.length > 1);
    }

    // ✅ FIXED: LOAD FLOOR WITH PROPER IMAGE DISPLAY
    function loadFloor(floorNum) {
        console.log('Loading floor:', floorNum);
        currentFloor = floorNum;
        const floorData = getFloorData(currentFloor);
        
        console.log('Floor data for', floorNum, ':', {
            hasImage: !!floorData.floorPlanUrl,
            imageLength: floorData.floorPlanUrl ? floorData.floorPlanUrl.length : 0,
            imagePrefix: floorData.floorPlanUrl ? floorData.floorPlanUrl.substring(0, 50) : 'none'
        });

        // ✅ FIXED: Proper image loading with error handling
        floorPlanImg.src = '';
        floorPlanImg.style.display = 'none';
        floorPlanImg.onload = null;
        floorPlanImg.onerror = null;
        
        if (floorData.floorPlanUrl && floorData.floorPlanUrl.length > 100) {
            console.log('Setting image source for floor', floorNum);
            
            // Create a new image to test loading first
            const testImage = new Image();
            
            testImage.onload = () => {
                console.log('✅ Test image loaded successfully');
                // Now set the actual image
                floorPlanImg.src = floorData.floorPlanUrl;
                floorPlanImg.style.display = 'block';
                
                // Apply proper styling for centering
                floorPlanImg.style.position = 'absolute';
                floorPlanImg.style.top = '50%';
                floorPlanImg.style.left = '50%';
                floorPlanImg.style.transform = 'translate(-50%, -50%)';
                floorPlanImg.style.maxWidth = '100%';
                floorPlanImg.style.maxHeight = '100%';
                floorPlanImg.style.objectFit = 'contain';
                
                // Ensure container is properly styled
                mapContainer.style.position = 'relative';
                mapContainer.style.overflow = 'hidden';
                mapContainer.style.display = 'flex';
                mapContainer.style.alignItems = 'center';
                mapContainer.style.justifyContent = 'center';
                
                console.log('✅ Floor plan image displayed');
            };
            
            testImage.onerror = () => {
                console.error('❌ Test image failed to load');
                floorPlanImg.style.display = 'none';
                floorPlanImg.src = '';
                
                // Try direct assignment as fallback
                setTimeout(() => {
                    if (floorData.floorPlanUrl) {
                        floorPlanImg.src = floorData.floorPlanUrl;
                        floorPlanImg.style.display = 'block';
                    }
                }, 100);
            };
            
            // Start loading the test image
            testImage.src = floorData.floorPlanUrl;
            
        } else {
            console.log('No valid image for floor', floorNum);
            floorPlanImg.style.display = 'none';
            floorPlanImg.src = '';
            
            // Show placeholder message
            const placeholder = document.getElementById('floorPlanPlaceholder') || (() => {
                const div = document.createElement('div');
                div.id = 'floorPlanPlaceholder';
                div.style.position = 'absolute';
                div.style.top = '50%';
                div.style.left = '50%';
                div.style.transform = 'translate(-50%, -50%)';
                div.style.color = '#666';
                div.style.textAlign = 'center';
                div.style.padding = '20px';
                div.innerHTML = `
                    <div style="font-size: 48px; margin-bottom: 10px;">🏢</div>
                    <div style="font-weight: bold; margin-bottom: 5px;">No Floor Plan</div>
                    <div style="font-size: 14px;">Upload an image using the button above</div>
                `;
                mapContainer.appendChild(div);
                return div;
            })();
            
            placeholder.style.display = 'block';
        }

        renderAll();
        updateMarkersList();
        updateFloorSelect();
    }

    updateFloorSelect();
    loadFloor(currentFloor);

    // Initialize icons
    const HOTEL_ICONS = ['🛏️', '🚪', '🍽️', '🏊', '💪', '🧼', '🛗', '🚻', '🧳', '☕', '🛎️', '🔒'];
    HOTEL_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.textContent = icon;
        btn.addEventListener('click', () => {
            selectedIcon = icon;
            iconPicker.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        iconPicker.appendChild(btn);
    });
    iconPicker.querySelector('button')?.classList.add('active');

    // === LOGIN ===
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();

        if (user.toLowerCase() === 'admin' && pass === '1234') {
            isLoggedIn = true;
            loginSection.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            loginError.classList.add('hidden');
            
            // Add cloud save button after login
            addCloudSaveButton();
        } else {
            loginError.classList.remove('hidden');
            loginSection.style.animation = 'shake 0.5s';
            setTimeout(() => loginSection.style.animation = '', 500);
        }
    });

    logoutBtn.addEventListener('click', () => {
        isLoggedIn = false;
        adminPanel.classList.add('hidden');
        loginSection.classList.remove('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        loginError.classList.add('hidden');
    });

    // === FLOOR MANAGEMENT ===
    floorSelect.addEventListener('change', () => {
        loadFloor(floorSelect.value);
    });

    addFloorBtn.addEventListener('click', () => {
        const floorNums = Object.keys(hotelData.floors).map(Number);
        const newFloor = (Math.max(...floorNums, 0) + 1).toString();
        console.log('Adding new floor:', newFloor);
        getFloorData(newFloor); // Initialize
        updateFloorSelect();
        loadFloor(newFloor);
        saveData();
    });

    removeFloorBtn.addEventListener('click', () => {
        if (Object.keys(hotelData.floors).length <= 1) return;
        if (confirm(`Delete Floor ${currentFloor}? This cannot be undone.`)) {
            console.log('Deleting floor:', currentFloor);
            delete hotelData.floors[currentFloor];
            const remainingFloors = Object.keys(hotelData.floors);
            currentFloor = remainingFloors.length > 0 ? remainingFloors[0] : '1';
            if (!hotelData.floors[currentFloor]) {
                hotelData.floors[currentFloor] = { 
                    markers: [], 
                    connections: [], 
                    floorPlanUrl: '', 
                    name: `Floor ${currentFloor}`,
                    floorNumber: currentFloor
                };
            }
            saveData();
            loadFloor(currentFloor);
        }
    });

    // ✅ RENAME FLOOR
    renameFloorBtn.addEventListener('click', () => {
        const floorData = getFloorData(currentFloor);
        floorNameInput.value = floorData.name || `Floor ${currentFloor}`;
        renameFloorSection.classList.remove('hidden');
    });

    cancelRenameBtn.addEventListener('click', () => {
        renameFloorSection.classList.add('hidden');
    });

    confirmRenameBtn.addEventListener('click', () => {
        const newName = floorNameInput.value.trim();
        if (newName) {
            getFloorData(currentFloor).name = newName;
            saveData();
            updateFloorSelect();
            renameFloorSection.classList.add('hidden');
        }
    });

 // === FILE UPLOAD - USING SUPABASE STORAGE ===
floorPlanUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        // File size validation
        const maxSize = 50 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert(`File too large! Please select an image smaller than 50MB.\nCurrent size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            e.target.value = '';
            return;
        }
        
        // Show loading indicator
        const originalText = clearMapBtn.textContent;
        clearMapBtn.textContent = 'Uploading...';
        clearMapBtn.disabled = true;
        
        try {
            // Use Supabase Storage for images
            if (window.imageUploader) {
                const result = await window.imageUploader.uploadImage(file, currentFloor);
                
                if (result.success) {
                    // Store only the URL, not the full base64 data
                    const floorData = getFloorData(currentFloor);
                    floorData.floorPlanUrl = result.publicUrl;
                    floorData.imageType = 'url'; // Mark as URL, not base64
                    
                    saveData();
                    loadFloor(currentFloor);
                    alert('✅ Image uploaded to cloud storage!');
                } else {
                    alert(`❌ Upload failed: ${result.error}`);
                }
            } else {
                // Fallback to base64 (but with compression)
                alert('⚠️ Using local storage (image will be compressed)');
                
                const reader = new FileReader();
                reader.onload = async () => {
                    const floorData = getFloorData(currentFloor);
                    
                    // Compress image
                    const compressed = await compressImage(reader.result, 0.6);
                    floorData.floorPlanUrl = compressed;
                    floorData.imageType = 'base64';
                    
                    saveData();
                    loadFloor(currentFloor);
                };
                reader.readAsDataURL(file);
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading image');
        } finally {
            // Reset button
            clearMapBtn.textContent = originalText;
            clearMapBtn.disabled = false;
            e.target.value = '';
        }
    } else {
        alert('Please select a valid image file (JPEG, PNG, etc.)');
    }
});

    // Store event listener for reattachment
    const floorPlanUploadEventListener = floorPlanUpload.addEventListener;

    // === CLEAR MAP ===
    clearMapBtn.addEventListener('click', () => {
        if (confirm(`Clear entire map for ${getFloorData(currentFloor).name}? This will remove the floor plan image and all markers.`)) {
            const floorData = getFloorData(currentFloor);
            floorData.floorPlanUrl = '';
            floorData.markers = [];
            floorData.connections = [];
            saveData();
            loadFloor(currentFloor);
            alert('✅ Floor plan cleared!');
        }
    });

    // === MODE BUTTONS ===
    function setActiveMode(mode) {
        currentMode = mode;
        
        // Reset all buttons to their default colors
        addModeBtn.className = 'px-3 py-1 text-sm bg-green-600 text-white rounded';
        deleteModeBtn.className = 'px-3 py-1 text-sm bg-red-600 text-white rounded';
        connectModeBtn.className = 'px-3 py-1 text-sm bg-purple-600 text-white rounded';
        disconnectModeBtn.className = 'px-3 py-1 text-sm bg-orange-600 text-white rounded';
        
        // Highlight the active mode button
        switch(mode) {
            case 'add':
                addModeBtn.className = 'px-3 py-1 text-sm bg-blue-600 text-white rounded';
                break;
            case 'delete':
                deleteModeBtn.className = 'px-3 py-1 text-sm bg-blue-600 text-white rounded';
                break;
            case 'connect':
                connectModeBtn.className = 'px-3 py-1 text-sm bg-blue-600 text-white rounded';
                break;
            case 'disconnect':
                disconnectModeBtn.className = 'px-3 py-1 text-sm bg-blue-600 text-white rounded';
                break;
        }
        
        addMarkerForm.classList.toggle('hidden', mode !== 'add');
        clearSelection();
    }

    addModeBtn.addEventListener('click', () => setActiveMode('add'));
    deleteModeBtn.addEventListener('click', () => setActiveMode('delete'));
    connectModeBtn.addEventListener('click', () => setActiveMode('connect'));
    disconnectModeBtn.addEventListener('click', () => setActiveMode('disconnect'));

    // === MARKER HANDLING ===
    confirmAddMarker.addEventListener('click', () => {
        const name = markerNameInput.value.trim();
        if (name && pendingMarker) {
            const newId = Date.now().toString();
            getFloorData(currentFloor).markers.push({ 
                id: newId, 
                x: pendingMarker.x, 
                y: pendingMarker.y, 
                name, 
                icon: selectedIcon 
            });
            saveData();
            loadFloor(currentFloor);
            addMarkerForm.classList.add('hidden');
            markerNameInput.value = '';
            pendingMarker = null;
            alert(`✅ Marker "${name}" added successfully!`);
        } else {
            alert('❌ Please enter a name for the marker and click on the map to place it.');
        }
    });

    // ✅ MODIFIED SAVE BUTTON - SAVES TO CLOUD
    saveDataBtn.addEventListener('click', async () => {
        saveData(); // Local save
        
        const result = await saveToCloudDirect();
        if (result.success) {
            alert('✅ Saved locally and to cloud!');
        } else {
            alert(`✅ Saved locally. ❌ Cloud save failed: ${result.error}`);
        }
    });

    mapContainer.addEventListener('click', handleMapClick);

    // === CLICK HANDLER ===
    function handleMapClick(e) {
        if (!floorPlanImg.src || floorPlanImg.style.display === 'none') {
            console.log('No image loaded, cannot place markers');
            alert('⚠️ Please upload a floor plan image first before adding markers.');
            return;
        }
        
        const rect = mapContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const floorData = getFloorData(currentFloor);
        let closest = null;
        let minDist = 30;
        for (const m of floorData.markers) {
            const dist = Math.hypot(m.x - x, m.y - y);
            if (dist < minDist) {
                minDist = dist;
                closest = m;
            }
        }

        if (currentMode === 'add') {
            console.log('Adding marker at position:', x, y);
            pendingMarker = { x, y };
            addMarkerForm.classList.remove('hidden');
            markerNameInput.focus();
        } else if (currentMode === 'delete' && closest) {
            if (confirm(`Delete marker "${closest.name}"?`)) {
                const idToRemove = closest.id;
                floorData.markers = floorData.markers.filter(m => m.id !== idToRemove);
                floorData.connections = floorData.connections.filter(([a, b]) => a !== idToRemove && b !== idToRemove);
                saveData();
                loadFloor(currentFloor);
                alert(`✅ Marker "${closest.name}" deleted.`);
            }
        } else if ((currentMode === 'connect' || currentMode === 'disconnect') && closest) {
            if (!firstSelectedMarker) {
                firstSelectedMarker = closest;
                highlightMarker(closest.id, true);
                alert(`📌 Selected "${closest.name}". Now click another marker to ${currentMode === 'connect' ? 'connect' : 'disconnect'}.`);
            } else {
                if (firstSelectedMarker.id === closest.id) {
                    highlightMarker(firstSelectedMarker.id, false);
                    firstSelectedMarker = null;
                    alert('Selection cleared.');
                    return;
                }

                const connIndex = floorData.connections.findIndex(([a, b]) =>
                    (a === firstSelectedMarker.id && b === closest.id) ||
                    (a === closest.id && b === firstSelectedMarker.id)
                );

                if (currentMode === 'connect' && connIndex === -1) {
                    floorData.connections.push([firstSelectedMarker.id, closest.id]);
                    alert(`✅ Connected "${firstSelectedMarker.name}" to "${closest.name}"`);
                } else if (currentMode === 'disconnect' && connIndex !== -1) {
                    floorData.connections.splice(connIndex, 1);
                    alert(`✅ Disconnected "${firstSelectedMarker.name}" from "${closest.name}"`);
                } else if (currentMode === 'connect') {
                    alert('⚠️ These markers are already connected.');
                } else {
                    alert('⚠️ These markers are not connected.');
                }

                highlightMarker(firstSelectedMarker.id, false);
                firstSelectedMarker = null;
                saveData();
                loadFloor(currentFloor);
            }
        }
    }

    function clearSelection() {
        if (firstSelectedMarker) {
            highlightMarker(firstSelectedMarker.id, false);
            firstSelectedMarker = null;
        }
    }

    function highlightMarker(id, highlight) {
        const el = document.querySelector(`.marker[data-id="${id}"]`);
        if (el) el.classList.toggle('selected', highlight);
    }

    // === RENDERING ===
    function renderAll() {
        console.log('Rendering floor', currentFloor);
        document.querySelectorAll('.marker, .connection').forEach(el => el.remove());
        const floorData = getFloorData(currentFloor);

        console.log('Markers to render:', floorData.markers.length);
        
        floorData.markers.forEach(marker => {
            const el = document.createElement('div');
            el.className = 'marker';
            el.dataset.id = marker.id;
            el.textContent = marker.icon;
            el.title = marker.name;
            el.style.left = `${marker.x}px`;
            el.style.top = `${marker.y}px`;
            mapContainer.appendChild(el);
        });

        floorData.connections.forEach(([id1, id2]) => {
            const m1 = floorData.markers.find(m => m.id === id1);
            const m2 = floorData.markers.find(m => m.id === id2);
            if (m1 && m2) {
                const length = Math.sqrt((m2.x - m1.x) ** 2 + (m2.y - m1.y) ** 2);
                const angle = Math.atan2(m2.y - m1.y, m2.x - m1.x) * 180 / Math.PI;
                const div = document.createElement('div');
                div.className = 'connection';
                div.style.width = `${length}px`;
                div.style.height = '4px';
                div.style.left = `${m1.x}px`;
                div.style.top = `${m1.y}px`;
                div.style.transform = `rotate(${angle}deg)`;
                mapContainer.appendChild(div);
            }
        });
    }

    function updateMarkersList() {
        markersList.innerHTML = '';
        const floorData = getFloorData(currentFloor);
        floorData.markers.forEach((m, i) => {
            const item = document.createElement('li');
            item.className = 'location-item';
            item.innerHTML = `<span>${m.icon} ${m.name}</span><button data-index="${i}" class="text-red-600 hover:text-red-800 text-sm">Remove</button>`;
            markersList.appendChild(item);
        });
        markersList.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                const idToRemove = getFloorData(currentFloor).markers[idx].id;
                getFloorData(currentFloor).markers.splice(idx, 1);
                getFloorData(currentFloor).connections = getFloorData(currentFloor).connections.filter(([a, b]) => a !== idToRemove && b !== idToRemove);
                saveData();
                loadFloor(currentFloor);
            });
        });
    }

    // ✅ ADD CLOUD SAVE BUTTON
    function addCloudSaveButton() {
        // Create cloud save button container
        const cloudContainer = document.createElement('div');
        cloudContainer.className = 'mt-6 p-4 bg-blue-50 rounded-lg';
        
        cloudContainer.innerHTML = `
            <h3 class="font-semibold text-blue-800 mb-2">Cloud Storage (Supabase)</h3>
            <div class="flex flex-col gap-2">
                <button id="cloudSaveBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2">
                    <i data-feather="upload-cloud"></i>
                    Save to Cloud
                </button>
                <button id="cloudLoadBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                    <i data-feather="download-cloud"></i>
                    Load from Cloud
                </button>
                <div class="text-xs text-gray-600 mt-2 p-2 bg-gray-100 rounded">
                    <p class="font-medium">Connection Status:</p>
                    <p>URL: ${SUPABASE_URL}</p>
                    <p>Hotel ID: <code class="bg-white px-1">${hotelId}</code></p>
                </div>
            </div>
        `;
        
        // Insert after save button
        saveDataBtn.parentNode.insertBefore(cloudContainer, saveDataBtn.nextSibling);
        
        // Add event listeners
        document.getElementById('cloudSaveBtn').addEventListener('click', async () => {
            const result = await saveToCloudDirect();
            if (result.success) {
                alert('✅ Hotel data saved to cloud!');
            } else {
                alert(`❌ Failed to save to cloud: ${result.error}`);
            }
        });
        
        document.getElementById('cloudLoadBtn').addEventListener('click', async () => {
            if (confirm('Load from cloud? This will replace your current hotel data.')) {
                const result = await loadFromCloudDirect();
                if (result.success && result.data) {
                    hotelData = result.data;
                    localStorage.setItem('hotelData', JSON.stringify(hotelData));
                    
                    if (!hotelData.floors) hotelData.floors = {};
                    loadFloor(currentFloor);
                    
                    alert('✅ Hotel data loaded from cloud!');
                } else if (result.success && !result.data) {
                    alert('ℹ️ No hotel data found in cloud.');
                } else {
                    alert(`❌ Failed to load from cloud: ${result.error}`);
                }
            }
        });
        
        // Refresh feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }
    
    // ✅ Add debug info panel
    function addDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.className = 'fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-lg text-xs max-w-xs opacity-90 z-50 hidden';
        debugPanel.innerHTML = `
            <div class="font-bold mb-2">Debug Info</div>
            <div id="debugContent" class="space-y-1"></div>
        `;
        document.body.appendChild(debugPanel);
        
        // Toggle debug panel with Ctrl+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                debugPanel.classList.toggle('hidden');
            }
        });
        
        // Update debug info periodically
        setInterval(() => {
            const floorData = getFloorData(currentFloor);
            document.getElementById('debugContent').innerHTML = `
                <div>Floor: ${currentFloor}</div>
                <div>Markers: ${floorData.markers.length}</div>
                <div>Connections: ${floorData.connections.length}</div>
                <div>Image: ${floorData.floorPlanUrl ? '✅ Loaded' : '❌ None'}</div>
                <div>Image Length: ${floorData.floorPlanUrl ? floorData.floorPlanUrl.length : 0}</div>
            `;
        }, 1000);
    }
    
    // Initialize debug panel
    addDebugPanel();
});
