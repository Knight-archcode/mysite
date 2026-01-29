// script.js - Guest Navigation with Supabase Cloud Sync

document.addEventListener('DOMContentLoaded', async () => {
    feather.replace();

    const hotelMapContainer = document.getElementById('hotelMapContainer');
    const floorPlanImg = document.getElementById('floorPlanImg');
    const fromSelect = document.getElementById('fromLocation');
    const toSelect = document.getElementById('toLocation');
    const findBtn = document.getElementById('findRouteBtn');
    const routeSteps = document.getElementById('routeSteps');
    const qrcodeDiv = document.getElementById('qrcode');
    const guestFloorSelect = document.getElementById('guestFloorSelect');

    // ✅ SUPABASE CONFIGURATION - YOUR CREDENTIALS
    const SUPABASE_URL = 'https://ejqrlglwogjpabmojfly.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJsZ2x3b2dqcGFibW9qZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU1NTcsImV4cCI6MjA4NTI5MTU1N30.OQeRNExX5PHG9BVmthuUFebVyyahg7tZWmmqCOLGBnE';
    let supabaseClient = null;
    let hotelId = 'default_hotel'; // Can be changed for multiple hotels
    
    try {
        // Load Supabase client
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase client initialized');
    } catch (error) {
        console.warn('⚠️ Supabase not available, using localStorage only');
    }

    // ✅ CLOUD FUNCTIONS
    async function saveToCloud(hotelData) {
        if (!supabaseClient) return { success: false, error: 'No Supabase client' };
        
        try {
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
            
            console.log('✅ Hotel data saved to cloud');
            return { success: true, data };
        } catch (error) {
            console.error('❌ Error saving to cloud:', error);
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
                console.log('✅ Hotel data loaded from cloud');
                return { success: true, data: data.hotel_data };
            } else {
                console.log('ℹ️ No hotel data found in cloud');
                return { success: true, data: null };
            }
        } catch (error) {
            console.error('❌ Error loading from cloud:', error);
            return { success: false, error };
        }
    }

    function generateShareableUrl(from, to) {
        const baseUrl = 'https://knight-archcode.github.io/mysite/';
        const params = new URLSearchParams({
            hotel: hotelId,
            from: from || '',
            to: to || '',
            source: 'qr_code',
            t: Date.now()
        });
        
        return `${baseUrl}?${params.toString()}`;
    }

    function loadFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const urlHotelId = params.get('hotel');
        const fromParam = params.get('from');
        const toParam = params.get('to');
        
        if (urlHotelId) {
            hotelId = urlHotelId;
            console.log('📥 Loading hotel:', hotelId);
        }
        
        return { from: fromParam, to: toParam };
    }

    // ✅ INITIALIZE: Check URL params first, then load data
    const urlParams = loadFromUrl();
    
    // Load data with priority: 1. localStorage, 2. Cloud, 3. URL
    let hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
    
    // If no data in localStorage, try cloud
    if (Object.keys(hotelData).length === 0 && supabaseClient) {
        const cloudResult = await loadFromCloud();
        if (cloudResult.success && cloudResult.data) {
            hotelData = cloudResult.data;
            localStorage.setItem('hotelData', JSON.stringify(hotelData));
            console.log('📥 Loaded from cloud storage');
        }
    }
    
    if (!hotelData.floors) hotelData.floors = {};
    console.log('Guest: Loaded hotelData', Object.keys(hotelData.floors || {}));

    // Flatten all markers with floor info
    let allMarkers = [];
    Object.keys(hotelData.floors).forEach(floorNum => {
        const floor = hotelData.floors[floorNum];
        if (floor && floor.markers) {
            floor.markers.forEach(m => {
                allMarkers.push({ ...m, floor: floorNum });
            });
        }
    });

    console.log('Guest: Total markers found:', allMarkers.length);

    const floorNumbers = Object.keys(hotelData.floors).sort((a, b) => parseInt(a) - parseInt(b));
    let currentFloor = floorNumbers[0] || '1';
    console.log('Guest: Current floor:', currentFloor, 'Available floors:', floorNumbers);
    
    // Store current path for highlighting
    let currentPath = [];
    let currentFloorPathSegments = [];

    // Populate floor selector
    function populateFloorSelect() {
        if (!guestFloorSelect) return;
        guestFloorSelect.innerHTML = '';
        floorNumbers.forEach(floorNum => {
            const floorData = hotelData.floors[floorNum];
            const displayName = floorData?.name || `Floor ${floorNum}`;
            const opt = document.createElement('option');
            opt.value = floorNum;
            opt.textContent = displayName;
            guestFloorSelect.appendChild(opt);
        });
        guestFloorSelect.value = currentFloor;
    }

    // Load floor plan
    function loadFloor(floorNum) {
        console.log('Guest: Loading floor', floorNum);
        currentFloor = floorNum;
        const floorData = hotelData.floors[floorNum] || {};
        const floorPlanUrl = floorData.floorPlanUrl || '';
        
        console.log('Guest: Floor image data for', floorNum, 'exists:', !!floorPlanUrl, 'length:', floorPlanUrl.length);

        // Clear existing image
        floorPlanImg.src = '';
        floorPlanImg.style.display = 'none';

        if (floorPlanUrl && floorPlanUrl.length > 100) {
            console.log('Guest: Setting image for floor', floorNum);
            
            const testImage = new Image();
            testImage.onload = function() {
                console.log('Guest: Image loaded for floor', floorNum);
                
                floorPlanImg.src = floorPlanUrl;
                floorPlanImg.style.display = 'block';
                floorPlanImg.style.position = 'absolute';
                floorPlanImg.style.top = '50%';
                floorPlanImg.style.left = '50%';
                floorPlanImg.style.transform = 'translate(-50%, -50%)';
                floorPlanImg.style.maxWidth = '100%';
                floorPlanImg.style.maxHeight = '100%';
                floorPlanImg.style.objectFit = 'contain';
                
                hotelMapContainer.style.position = 'relative';
                hotelMapContainer.style.overflow = 'hidden';
                hotelMapContainer.style.display = 'flex';
                hotelMapContainer.style.alignItems = 'center';
                hotelMapContainer.style.justifyContent = 'center';
            };
            
            testImage.onerror = function() {
                console.error('Guest: Failed to load image for floor', floorNum);
                floorPlanImg.style.display = 'none';
                floorPlanImg.src = '';
            };
            
            testImage.src = floorPlanUrl;
        } else {
            console.log('Guest: No image for floor', floorNum);
            floorPlanImg.src = '';
            floorPlanImg.style.display = 'none';
        }

        renderMap();
        // Re-highlight path when switching floors
        highlightCurrentPathOnFloor();
    }

    // Initialize UI
    if (floorNumbers.length > 0) {
        populateFloorSelect();
        loadFloor(currentFloor);
        updateLocationDropdowns();
        
        // ✅ Auto-set from URL parameters if provided
        if (urlParams.from && urlParams.to) {
            setTimeout(() => {
                if (fromSelect) fromSelect.value = urlParams.from;
                if (toSelect) toSelect.value = urlParams.to;
                
                // Auto-find route after UI loads
                setTimeout(() => {
                    if (findBtn) findBtn.click();
                }, 1000);
            }, 500);
        }
    } else {
        routeSteps.innerHTML = '<p class="text-gray-500">No floor plans configured. Please use the admin panel.</p>';
    }

    // Floor switch handler
    guestFloorSelect?.addEventListener('change', () => {
        console.log('Guest: Changing floor to', guestFloorSelect.value);
        loadFloor(guestFloorSelect.value);
    });

    // Auto-switch floor when selecting location
    function autoSwitchFloor() {
        const from = fromSelect?.value;
        const to = toSelect?.value;
        let targetFloor = null;

        if (to) {
            const toMarker = allMarkers.find(m => m.name === to);
            if (toMarker) targetFloor = toMarker.floor;
        } else if (from) {
            const fromMarker = allMarkers.find(m => m.name === from);
            if (fromMarker) targetFloor = fromMarker.floor;
        }

        if (targetFloor && targetFloor !== currentFloor) {
            console.log('Guest: Auto-switching to floor', targetFloor);
            currentFloor = targetFloor;
            if (guestFloorSelect) guestFloorSelect.value = currentFloor;
            loadFloor(currentFloor);
        }
    }

    fromSelect?.addEventListener('change', autoSwitchFloor);
    toSelect?.addEventListener('change', autoSwitchFloor);

    findBtn?.addEventListener('click', findRoute);

    function renderMap() {
        console.log('Guest: Rendering map for floor', currentFloor);
        // Clear all elements except the path segments (we'll handle those separately)
        document.querySelectorAll('.marker, .connection').forEach(el => el.remove());

        const floorMarkers = allMarkers.filter(m => m.floor === currentFloor);
        console.log('Guest: Markers on this floor:', floorMarkers.length);
        
        floorMarkers.forEach(marker => {
            const el = document.createElement('div');
            el.className = 'marker';
            el.textContent = marker.icon;
            el.title = marker.name;
            el.style.left = `${marker.x}px`;
            el.style.top = `${marker.y}px`;
            hotelMapContainer.appendChild(el);
        });

        const floorConnections = (hotelData.floors[currentFloor]?.connections || []);
        floorConnections.forEach(([id1, id2]) => {
            const m1 = allMarkers.find(m => m.id === id1);
            const m2 = allMarkers.find(m => m.id === id2);
            if (m1 && m2 && m1.floor === currentFloor && m2.floor === currentFloor) {
                drawConnection(m1.x, m1.y, m2.x, m2.y, 'connection');
            }
        });
    }

    function drawConnection(x1, y1, x2, y2, className) {
        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const div = document.createElement('div');
        div.className = className;
        div.style.width = `${length}px`;
        div.style.height = '3px';
        div.style.left = `${x1}px`;
        div.style.top = `${y1}px`;
        div.style.transform = `rotate(${angle}deg)`;
        hotelMapContainer.appendChild(div);
    }

    // Draw path segment with highlighting
    function drawPathSegment(x1, y1, x2, y2, isElevator = false) {
        const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const div = document.createElement('div');
        div.className = 'path-segment';
        
        // Different styling for elevator segments
        if (isElevator) {
            div.style.background = '#f59e0b';
            div.style.border = '2px dashed #d97706';
            div.style.height = '6px';
        } else {
            div.style.background = '#ef4444';
            div.style.height = '4px';
        }
        
        div.style.width = `${length}px`;
        div.style.left = `${x1}px`;
        div.style.top = `${y1}px`;
        div.style.transform = `rotate(${angle}deg)`;
        div.style.zIndex = '5';
        div.style.opacity = '0.9';
        div.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.5)';
        div.style.animation = 'pulse 2s infinite';
        
        hotelMapContainer.appendChild(div);
        currentFloorPathSegments.push(div);
    }

    // Highlight path segments on current floor
    function highlightCurrentPathOnFloor() {
        // Clear existing path segments
        currentFloorPathSegments.forEach(segment => segment.remove());
        currentFloorPathSegments = [];
        
        if (currentPath.length < 2) return;
        
        // Find segments that belong to current floor
        for (let i = 0; i < currentPath.length - 1; i++) {
            const currentMarker = currentPath[i];
            const nextMarker = currentPath[i + 1];
            
            // Check if both markers are on current floor
            if (currentMarker.floor === currentFloor && nextMarker.floor === currentFloor) {
                // Regular connection on same floor
                drawPathSegment(currentMarker.x, currentMarker.y, nextMarker.x, nextMarker.y, false);
            } 
            // Check if this is an elevator connection point
            else if (currentMarker.icon === '🛗' && nextMarker.icon === '🛗') {
                // If either elevator is on current floor, show a special marker
                if (currentMarker.floor === currentFloor) {
                    drawElevatorIndicator(currentMarker.x, currentMarker.y);
                }
            }
        }
        
        // Highlight the start and end markers if they're on this floor
        const startMarker = currentPath[0];
        const endMarker = currentPath[currentPath.length - 1];
        
        if (startMarker.floor === currentFloor) {
            highlightMarker(startMarker, true, 'start');
        }
        if (endMarker.floor === currentFloor) {
            highlightMarker(endMarker, true, 'end');
        }
    }

    // Highlight a marker
    function highlightMarker(marker, highlight, type = 'normal') {
        const markerElements = document.querySelectorAll('.marker');
        markerElements.forEach(el => {
            const x = parseFloat(el.style.left);
            const y = parseFloat(el.style.top);
            
            // Find the matching marker by position
            if (Math.abs(x - marker.x) < 5 && Math.abs(y - marker.y) < 5) {
                if (highlight) {
                    el.style.transform = 'translate(-50%, -50%) scale(1.3)';
                    el.style.zIndex = '20';
                    el.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.7)';
                    
                    // Add special styling based on type
                    if (type === 'start') {
                        el.style.border = '3px solid #10b981';
                        el.style.borderRadius = '50%';
                    } else if (type === 'end') {
                        el.style.border = '3px solid #3b82f6';
                        el.style.borderRadius = '50%';
                    }
                } else {
                    el.style.transform = 'translate(-50%, -50%)';
                    el.style.zIndex = '10';
                    el.style.boxShadow = 'none';
                    el.style.border = 'none';
                }
            }
        });
    }

    // Draw elevator indicator
    function drawElevatorIndicator(x, y) {
        const indicator = document.createElement('div');
        indicator.className = 'elevator-indicator';
        indicator.style.position = 'absolute';
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;
        indicator.style.transform = 'translate(-50%, -50%)';
        indicator.style.width = '40px';
        indicator.style.height = '40px';
        indicator.style.background = 'rgba(245, 158, 11, 0.2)';
        indicator.style.border = '3px solid #f59e0b';
        indicator.style.borderRadius = '50%';
        indicator.style.zIndex = '4';
        indicator.style.animation = 'pulse 1.5s infinite';
        hotelMapContainer.appendChild(indicator);
        currentFloorPathSegments.push(indicator);
    }

    function updateLocationDropdowns() {
        const locations = allMarkers.map(m => {
            const floorData = hotelData.floors[m.floor];
            const floorName = floorData?.name || `Floor ${m.floor}`;
            return { name: m.name, icon: m.icon, floor: m.floor, floorName };
        });
        ['fromLocation', 'toLocation'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const current = select.value;
            select.innerHTML = '<option value="">Select location</option>';
            locations.forEach(loc => {
                const opt = document.createElement('option');
                opt.value = loc.name;
                opt.textContent = `${loc.icon} ${loc.name} (${loc.floorName})`;
                select.appendChild(opt);
            });
            if (locations.some(l => l.name === current)) {
                select.value = current;
            }
        });
    }

    // === PATHFINDING & DIRECTIONS ===
    function findShortestPath(startName, endName) {
        const start = allMarkers.find(m => m.name === startName);
        const end = allMarkers.find(m => m.name === endName);
        if (!start || !end) return null;

        const graph = {};
        allMarkers.forEach(m => { graph[m.id] = []; });

        Object.values(hotelData.floors).forEach(floor => {
            (floor?.connections || []).forEach(([a, b]) => {
                const m1 = allMarkers.find(m => m.id === a);
                const m2 = allMarkers.find(m => m.id === b);
                if (m1 && m2) {
                    const dist = Math.hypot(m1.x - m2.x, m1.y - m2.y);
                    graph[a].push({ id: b, dist, type: 'walk' });
                    graph[b].push({ id: a, dist, type: 'walk' });
                }
            });
        });

        const elevators = allMarkers.filter(m => m.icon === '🛗');
        elevators.forEach(e1 => {
            elevators.forEach(e2 => {
                if (e1.floor !== e2.floor) {
                    graph[e1.id].push({ id: e2.id, dist: 10, type: 'elevator' });
                }
            });
        });

        const dist = {};
        const prev = {};
        const queue = allMarkers.map(m => m.id);
        allMarkers.forEach(m => { dist[m.id] = Infinity; prev[m.id] = null; });
        dist[start.id] = 0;

        while (queue.length > 0) {
            let u = null;
            let minDist = Infinity;
            for (const id of queue) {
                if (dist[id] < minDist) {
                    minDist = dist[id];
                    u = id;
                }
            }
            if (u === null || u === end.id) break;
            queue.splice(queue.indexOf(u), 1);

            for (const neighbor of graph[u] || []) {
                const alt = dist[u] + neighbor.dist;
                if (alt < dist[neighbor.id]) {
                    dist[neighbor.id] = alt;
                    prev[neighbor.id] = u;
                }
            }
        }

        const path = [];
        let u = end.id;
        while (u !== null) {
            path.unshift(u);
            u = prev[u];
        }
        if (dist[end.id] === Infinity) return null;
        return path.map(id => allMarkers.find(m => m.id === id));
    }

    function generateDirections(path) {
        if (path.length <= 1) return [];

        const instructions = [];
        const startFloorName = getFloorName(path[0].floor);
        instructions.push(`Start at ${path[0].icon} ${path[0].name} on ${startFloorName}.`);

        for (let i = 1; i < path.length; i++) {
            const current = path[i];
            const prev = path[i - 1];

            if (prev.floor !== current.floor) {
                instructions.push(`Take the elevator to ${getFloorName(current.floor)}.`);
                if (i === path.length - 1) {
                    instructions.push(`Arrive at ${current.icon} ${current.name}.`);
                }
                continue;
            }

            if (i === path.length - 1) {
                instructions.push(`Arrive at ${current.icon} ${current.name}.`);
                break;
            }

            const next = path[i + 1];
            if (next.floor !== current.floor) {
                instructions.push(`Go to the elevator.`);
                continue;
            }

            let dx1 = current.x - prev.x;
            let dy1 = -(current.y - prev.y);
            let dx2 = next.x - current.x;
            let dy2 = -(next.y - current.y);

            const len1 = Math.hypot(dx1, dy1);
            const len2 = Math.hypot(dx2, dy2);
            if (len1 === 0 || len2 === 0) {
                instructions.push(`Proceed to ${current.icon} ${current.name}.`);
                continue;
            }

            const ux1 = dx1 / len1;
            const uy1 = dy1 / len1;
            const ux2 = dx2 / len2;
            const uy2 = dy2 / len2;

            const cross = ux1 * uy2 - uy1 * ux2;
            let action = "go straight";
            if (Math.abs(cross) > 0.1) {
                action = cross > 0 ? "turn left" : "turn right";
            }

            instructions.push(`${action} toward ${current.icon} ${current.name}.`);
        }

        return instructions;
    }

    function getFloorName(floorNum) {
        const floorData = hotelData.floors[floorNum];
        return floorData?.name || `Floor ${floorNum}`;
    }

    function findRoute() {
        const from = fromSelect?.value;
        const to = toSelect?.value;
        if (!from || !to) {
            routeSteps.innerHTML = '<p class="text-gray-400">Select both start and destination</p>';
            qrcodeDiv.innerHTML = '<p class="text-gray-400 text-sm">Route QR appears here</p>';
            
            currentPath = [];
            highlightCurrentPathOnFloor();
            return;
        }

        const path = findShortestPath(from, to);
        if (!path || path.length === 0) {
            routeSteps.innerHTML = '<p class="text-red-600">No path found between these locations.</p>';
            qrcodeDiv.innerHTML = '<p class="text-gray-400 text-sm">No route available</p>';
            
            currentPath = [];
            highlightCurrentPathOnFloor();
            return;
        }

        // Store the current path
        currentPath = path;
        
        const directions = generateDirections(path);
        let stepsHtml = '<ol class="list-decimal pl-5 space-y-1">';
        directions.forEach(step => {
            stepsHtml += `<li>${step}</li>`;
        });
        stepsHtml += '</ol>';
        routeSteps.innerHTML = stepsHtml;

        // Highlight the path on the map
        highlightCurrentPathOnFloor();

        // ✅ QR Code generation with Cloud URL
        const url = generateShareableUrl(from, to);
        
        qrcodeDiv.innerHTML = '';
        
        try {
            const typeNumber = 0;
            const errorCorrectionLevel = 'M';
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(url);
            qr.make();
            const svgTag = qr.createSvgTag(4, 8);
            
            const container = document.createElement('div');
            container.className = 'flex flex-col items-center';
            container.innerHTML = `
                ${svgTag}
                <div class="mt-3 text-center">
                    <p class="text-xs text-gray-600 mb-1">Scan to view route</p>
                    <p class="text-xs text-green-600 font-medium">
                        ✅ Includes hotel data
                    </p>
                    <p class="text-xs text-blue-600 mt-1">
                        ${url.split('?')[0]}
                    </p>
                </div>
            `;
            
            qrcodeDiv.appendChild(container);
            
        } catch (e) {
            console.error("QR Error:", e);
            qrcodeDiv.innerHTML = `
                <div class="text-center p-4 border border-red-200 rounded">
                    <p class="text-red-500 text-sm mb-2">QR generation failed</p>
                    <p class="text-xs text-gray-500 break-all">${url.substring(0, 100)}...</p>
                </div>
            `;
        }
    }
    
    // ✅ Add cloud sync status indicator
    function addCloudStatus() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'cloudStatus';
        statusDiv.className = 'fixed bottom-4 left-4 z-50';
        
        if (supabaseClient) {
            statusDiv.innerHTML = `
                <div class="bg-green-100 text-green-800 px-3 py-2 rounded-lg shadow flex items-center gap-2">
                    <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span class="text-sm">Cloud Sync: Online</span>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div class="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg shadow flex items-center gap-2">
                    <div class="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span class="text-sm">Cloud Sync: Offline (local only)</span>
                </div>
            `;
        }
        
        document.body.appendChild(statusDiv);
    }
    
    // Initialize cloud status
    addCloudStatus();
});
