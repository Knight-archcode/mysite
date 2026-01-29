// admin/admin.js - Admin Panel with Supabase Cloud Sync

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

    // ✅ SUPABASE CONFIGURATION - YOUR CREDENTIALS
    const SUPABASE_URL = 'https://ejqrlglwogjpabmojfly.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJsZ2x3b2dqcGFibW9qZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU1NTcsImV4cCI6MjA4NTI5MTU1N30.OQeRNExX5PHG9BVmthuUFebVyyahg7tZWmmqCOLGBnE';
    let supabaseClient = null;
    let hotelId = 'default_hotel';
    
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Admin: Supabase client initialized');
    } catch (error) {
        console.warn('⚠️ Admin: Supabase not available');
    }

    // ✅ CLOUD FUNCTIONS
    async function saveToCloud() {
        if (!supabaseClient) {
            alert('❌ Supabase not configured. Data will be saved locally only.');
            return { success: false };
        }
        
        try {
            const hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
            
            const { data, error } = await supabaseClient
                .from('hotels')
                .upsert({
                    hotel_id: hotelId,
                    hotel_data: hotelData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'hotel_id'
                });
            
            if (error) throw error;
            
            console.log('✅ Admin: Hotel data saved to cloud');
            return { success: true, data };
        } catch (error) {
            console.error('❌ Admin: Error saving to cloud:', error);
            return { success: false, error };
        }
    }

    async function loadFromCloud() {
        if (!supabaseClient) return { success: false, error: 'No Supabase client' };
        
        try {
            const { data, error } = await supabaseClient
                .from('hotels')
                .select('hotel_data')
                .eq('hotel_id', hotelId)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            if (data) {
                console.log('✅ Admin: Hotel data loaded from cloud');
                return { success: true, data: data.hotel_data };
            } else {
                console.log('ℹ️ Admin: No hotel data found in cloud');
                return { success: true, data: null };
            }
        } catch (error) {
            console.error('❌ Admin: Error loading from cloud:', error);
            return { success: false, error };
        }
    }

    // ✅ SAFE DATA INITIALIZATION
    let hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
    
    // Load from cloud on admin login
    if (supabaseClient) {
        const cloudResult = await loadFromCloud();
        if (cloudResult.success && cloudResult.data) {
            hotelData = cloudResult.data;
            localStorage.setItem('hotelData', JSON.stringify(hotelData));
            console.log('📥 Admin: Loaded data from cloud storage');
        }
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

    // ✅ LOAD FLOOR
    function loadFloor(floorNum) {
        console.log('Loading floor:', floorNum);
        currentFloor = floorNum;
        const floorData = getFloorData(currentFloor);
        
        console.log('Floor data for', floorNum, ':', {
            hasImage: !!floorData.floorPlanUrl,
            imageLength: floorData.floorPlanUrl ? floorData.floorPlanUrl.length : 0
        });

        // Clear and reload image
        floorPlanImg.src = '';
        floorPlanImg.style.display = 'none';
        
        if (floorData.floorPlanUrl && floorData.floorPlanUrl.length > 100) {
            console.log('Setting image source for floor', floorNum);
            
            // Force a fresh load
            const separator = floorData.floorPlanUrl.includes('?') ? '&' : '?';
            const timestamp = Date.now();
            const imageUrl = floorData.floorPlanUrl + separator + 't=' + timestamp;
            
            floorPlanImg.src = imageUrl;
            floorPlanImg.style.display = 'block';
            
            floorPlanImg.onload = function() {
                console.log('Image loaded for floor', floorNum);
                this.style.display = 'block';
            };
            
            floorPlanImg.onerror = function() {
                console.error('Failed to load image for floor', floorNum);
                this.style.display = 'none';
                this.src = '';
            };
        } else {
            console.log('No valid image for floor', floorNum);
            floorPlanImg.style.display = 'none';
            floorPlanImg.src = '';
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

    // === FILE UPLOAD ===
    floorPlanUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                console.log('Uploading image for floor', currentFloor);
                const floorData = getFloorData(currentFloor);
                floorData.floorPlanUrl = reader.result;
                console.log('Image saved for floor', currentFloor, 'size:', reader.result.length);
                
                saveData();
                loadFloor(currentFloor);
                e.target.value = '';
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                alert('Error reading image file');
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please select a valid image file (JPEG, PNG, etc.)');
        }
    });

    // === CLEAR MAP ===
    clearMapBtn.addEventListener('click', () => {
        if (confirm(`Clear entire map for ${getFloorData(currentFloor).name}? This cannot be undone.`)) {
            const floorData = getFloorData(currentFloor);
            floorData.floorPlanUrl = '';
            floorData.markers = [];
            floorData.connections = [];
            saveData();
            loadFloor(currentFloor);
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
        }
    });

    // ✅ MODIFIED SAVE BUTTON - SAVES TO CLOUD
    saveDataBtn.addEventListener('click', async () => {
        saveData(); // Local save
        
        if (supabaseClient) {
            const result = await saveToCloud();
            if (result.success) {
                alert('✅ Saved locally and to cloud!');
            } else {
                alert('✅ Saved locally. ❌ Cloud save failed.');
            }
        } else {
            alert('✅ Saved locally (no cloud connection)');
        }
    });

    mapContainer.addEventListener('click', handleMapClick);

    // === CLICK HANDLER ===
    function handleMapClick(e) {
        if (!floorPlanImg.src) {
            console.log('No image loaded, cannot place markers');
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
        } else if (currentMode === 'delete' && closest) {
            const idToRemove = closest.id;
            floorData.markers = floorData.markers.filter(m => m.id !== idToRemove);
            floorData.connections = floorData.connections.filter(([a, b]) => a !== idToRemove && b !== idToRemove);
            saveData();
            loadFloor(currentFloor);
        } else if ((currentMode === 'connect' || currentMode === 'disconnect') && closest) {
            if (!firstSelectedMarker) {
                firstSelectedMarker = closest;
                highlightMarker(closest.id, true);
            } else {
                if (firstSelectedMarker.id === closest.id) {
                    highlightMarker(firstSelectedMarker.id, false);
                    firstSelectedMarker = null;
                    return;
                }

                const connIndex = floorData.connections.findIndex(([a, b]) =>
                    (a === firstSelectedMarker.id && b === closest.id) ||
                    (a === closest.id && b === firstSelectedMarker.id)
                );

                if (currentMode === 'connect' && connIndex === -1) {
                    floorData.connections.push([firstSelectedMarker.id, closest.id]);
                } else if (currentMode === 'disconnect' && connIndex !== -1) {
                    floorData.connections.splice(connIndex, 1);
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
        if (!supabaseClient) return;
        
        // Create cloud save button container
        const cloudContainer = document.createElement('div');
        cloudContainer.className = 'mt-6 p-4 bg-blue-50 rounded-lg';
        
        cloudContainer.innerHTML = `
            <h3 class="font-semibold text-blue-800 mb-2">Cloud Storage</h3>
            <div class="flex flex-col gap-2">
                <button id="cloudSaveBtn" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2">
                    <i data-feather="upload-cloud"></i>
                    Save to Cloud
                </button>
                <button id="cloudLoadBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-2">
                    <i data-feather="download-cloud"></i>
                    Load from Cloud
                </button>
                <p class="text-xs text-gray-600 mt-2">
                    Hotel ID: <code class="bg-gray-100 px-2 py-1 rounded">${hotelId}</code>
                </p>
            </div>
        `;
        
        // Insert after save button
        saveDataBtn.parentNode.insertBefore(cloudContainer, saveDataBtn.nextSibling);
        
        // Add event listeners
        document.getElementById('cloudSaveBtn').addEventListener('click', async () => {
            const result = await saveToCloud();
            if (result.success) {
                alert('✅ Hotel data saved to cloud!');
                feather.replace();
            } else {
                alert('❌ Failed to save to cloud. Check console.');
            }
        });
        
        document.getElementById('cloudLoadBtn').addEventListener('click', async () => {
            if (confirm('Load from cloud? This will replace your current hotel data.')) {
                const result = await loadFromCloud();
                if (result.success && result.data) {
                    hotelData = result.data;
                    localStorage.setItem('hotelData', JSON.stringify(hotelData));
                    
                    if (!hotelData.floors) hotelData.floors = {};
                    loadFloor(currentFloor);
                    
                    alert('✅ Hotel data loaded from cloud!');
                } else if (result.success && !result.data) {
                    alert('ℹ️ No hotel data found in cloud.');
                } else {
                    alert('❌ Failed to load from cloud. Check console.');
                }
            }
        });
        
        // Refresh feather icons
        feather.replace();
    }
});
