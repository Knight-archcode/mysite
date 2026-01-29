// script.js - Guest Navigation with Supabase Cloud Sync (FIXED FOR QR CODES)

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

    // ✅ SUPABASE CONFIGURATION
    const SUPABASE_URL = 'https://ejqrlglwogjpabmojfly.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXJsZ2x3b2dqcGFibW9qZmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTU1NTcsImV4cCI6MjA4NTI5MTU1N30.OQeRNExX5PHG9BVmthuUFebVyyahg7tZWmmqCOLGBnE';
    let hotelId = 'default_hotel';

    // ✅ DIRECT API FUNCTIONS
    async function loadFromCloudDirect() {
        console.log('🔄 Loading from cloud for hotel:', hotelId);
        
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
            
            console.log('Cloud response status:', response.status);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('ℹ️ No hotel data found in cloud');
                    return { success: true, data: null };
                }
                const errorText = await response.text();
                console.error('Cloud error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            
            const data = await response.json();
            console.log('Cloud data received:', data);
            
            if (data && data.length > 0 && data[0].hotel_data) {
                console.log('✅ Hotel data loaded from cloud');
                console.log('Floors in data:', Object.keys(data[0].hotel_data.floors || {}));
                return { success: true, data: data[0].hotel_data };
            } else {
                console.log('ℹ️ No hotel data found in cloud (empty array)');
                return { success: true, data: null };
            }
        } catch (error) {
            console.error('❌ Error loading from cloud:', error);
            return { success: false, error: error.message };
        }
    }

    // ✅ URL PARAMETER HANDLING
    function getUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        const urlHotelId = params.get('hotel');
        const fromParam = params.get('from');
        const toParam = params.get('to');
        
        console.log('📊 URL Parameters:', { urlHotelId, fromParam, toParam });
        
        if (urlHotelId) {
            hotelId = urlHotelId;
            console.log('📥 Setting hotel ID from URL:', hotelId);
        }
        
        return { 
            from: fromParam, 
            to: toParam,
            hasHotelId: !!urlHotelId
        };
    }

    // ✅ LOAD HOTEL DATA WITH PRIORITY
    async function loadHotelData() {
        const urlParams = getUrlParameters();
        
        // Always try to load from cloud when accessed via QR code
        // QR codes have hotel parameter, so we should force cloud load
        if (urlParams.hasHotelId) {
            console.log('🔗 QR Code detected, forcing cloud load...');
            const cloudResult = await loadFromCloudDirect();
            
            if (cloudResult.success && cloudResult.data) {
                console.log('✅ QR Code: Loaded hotel data from cloud');
                localStorage.setItem('hotelData', JSON.stringify(cloudResult.data));
                return cloudResult.data;
            } else {
                console.log('⚠️ QR Code: Could not load from cloud, checking localStorage');
            }
        }
        
        // Fallback: Check localStorage
        let hotelData = JSON.parse(localStorage.getItem('hotelData') || '{}');
        
        // If still empty, try cloud one more time
        if (Object.keys(hotelData).length === 0 || !hotelData.floors) {
            console.log('🔄 No local data, trying cloud...');
            const cloudResult = await loadFromCloudDirect();
            if (cloudResult.success && cloudResult.data) {
                hotelData = cloudResult.data;
                localStorage.setItem('hotelData', JSON.stringify(hotelData));
                console.log('✅ Loaded from cloud as fallback');
            }
        }
        
        return hotelData;
    }

    // ✅ INITIALIZE: Load data first, then setup UI
    let hotelData = await loadHotelData();
    
    if (!hotelData.floors) hotelData.floors = {};
    console.log('📋 Final hotel data loaded:', {
        floors: Object.keys(hotelData.floors),
        hasFloors: Object.keys(hotelData.floors).length > 0
    });

    // Flatten all markers with floor info
    let allMarkers = [];
    Object.keys(hotelData.floors).forEach(floorNum => {
        const floor = hotelData.floors[floorNum];
        if (floor && floor.markers) {
            console.log(`📌 Floor ${floorNum} has ${floor.markers.length} markers`);
            floor.markers.forEach(m => {
                allMarkers.push({ ...m, floor: floorNum });
            });
        }
    });

    console.log('👣 Total markers found:', allMarkers.length);

    const floorNumbers = Object.keys(hotelData.floors).sort((a, b) => parseInt(a) - parseInt(b));
    let currentFloor = floorNumbers[0] || '1';
    console.log('🏢 Current floor:', currentFloor, 'Available floors:', floorNumbers);
    
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
        console.log('📋 Floor selector populated with', floorNumbers.length, 'floors');
    }

    // Load floor plan
    function loadFloor(floorNum) {
        console.log('📥 Loading floor', floorNum);
        currentFloor = floorNum;
        const floorData = hotelData.floors[floorNum] || {};
        const floorPlanUrl = floorData.floorPlanUrl || '';
        
        console.log('🖼️ Floor image data for', floorNum, 'exists:', !!floorPlanUrl, 'length:', floorPlanUrl ? floorPlanUrl.length : 0);

        // Clear existing image
        floorPlanImg.src = '';
        floorPlanImg.style.display = 'none';

        if (floorPlanUrl && floorPlanUrl.length > 100) {
            console.log('🎨 Setting image for floor', floorNum);
            
            const testImage = new Image();
            testImage.onload = function() {
                console.log('✅ Image loaded for floor', floorNum);
                
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
                
                // Render markers after image loads
                setTimeout(renderMap, 100);
            };
            
            testImage.onerror = function() {
                console.error('❌ Failed to load image for floor', floorNum);
                floorPlanImg.style.display = 'none';
                floorPlanImg.src = '';
                renderMap(); // Still render markers even without image
            };
            
            testImage.src = floorPlanUrl;
        } else {
            console.log('⚠️ No image for floor', floorNum);
            floorPlanImg.src = '';
            floorPlanImg.style.display = 'none';
            renderMap(); // Render markers even without image
        }
        
        // Re-highlight path when switching floors
        highlightCurrentPathOnFloor();
    }

    // Initialize UI
    const urlParams = getUrlParameters();
    
    if (floorNumbers.length > 0) {
        populateFloorSelect();
        loadFloor(currentFloor);
        updateLocationDropdowns();
        
        // ✅ Auto-set from URL parameters if provided (from QR code)
        if (urlParams.from && urlParams.to) {
            console.log('🔗 Auto-setting route from QR code:', urlParams.from, '→', urlParams.to);
            
            setTimeout(() => {
                if (fromSelect && fromSelect.options.length > 0) {
                    fromSelect.value = urlParams.from;
                    console.log('✅ Set FROM:', urlParams.from);
                }
                if (toSelect && toSelect.options.length > 0) {
                    toSelect.value = urlParams.to;
                    console.log('✅ Set TO:', urlParams.to);
                }
                
                // Auto-find route after UI loads
                setTimeout(() => {
                    if (findBtn) {
                        console.log('🚀 Auto-finding route...');
                        findBtn.click();
                    }
                }, 1500);
            }, 1000);
        }
    } else {
        routeSteps.innerHTML = `
            <div class="text-center p-4">
                <div class="text-4xl mb-4">🏢</div>
                <p class="text-gray-500 mb-2">No floor plans configured yet.</p>
                <p class="text-sm text-gray-400">Please use the admin panel to set up your hotel navigation.</p>
                <a href="admin/index.html" class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                    Go to Admin Panel
                </a>
            </div>
        `;
        
        // Show QR code warning
        qrcodeDiv.innerHTML = `
            <div class="text-center p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                <div class="text-yellow-600 text-3xl mb-2">⚠️</div>
                <p class="text-yellow-800 font-medium mb-1">Hotel Data Not Found</p>
                <p class="text-yellow-700 text-sm">This QR code links to hotel: <code class="bg-yellow-100 px-2 py-1 rounded">${hotelId}</code></p>
                <p class="text-yellow-700 text-sm mt-2">Make sure the hotel has been configured in the admin panel.</p>
            </div>
        `;
    }

    // Floor switch handler
    guestFloorSelect?.addEventListener('change', () => {
        console.log('🔄 Changing floor to', guestFloorSelect.value);
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
            console.log('🚪 Auto-switching to floor', targetFloor);
            currentFloor = targetFloor;
            if (guestFloorSelect) guestFloorSelect.value = currentFloor;
            loadFloor(currentFloor);
        }
    }

    fromSelect?.addEventListener('change', autoSwitchFloor);
    toSelect?.addEventListener('change', autoSwitchFloor);

    findBtn?.addEventListener('click', findRoute);

    function renderMap() {
        console.log('🎨 Rendering map for floor', currentFloor);
        console.log(`📍 Markers on floor ${currentFloor}:`, allMarkers.filter(m => m.floor === currentFloor).length);
        
        // Clear all elements except the path segments
        document.querySelectorAll('.marker, .connection').forEach(el => el.remove());

        const floorMarkers = allMarkers.filter(m => m.floor === currentFloor);
        
        if (floorMarkers.length === 0) {
            console.log('⚠️ No markers to render on this floor');
            // Show message if no markers
            const noMarkersMsg = document.getElementById('noMarkersMsg') || (() => {
                const msg = document.createElement('div');
                msg.id = 'noMarkersMsg';
                msg.style.position = 'absolute';
                msg.style.top = '50%';
                msg.style.left = '50%';
                msg.style.transform = 'translate(-50%, -50%)';
                msg.style.color = '#666';
                msg.style.textAlign = 'center';
                msg.style.padding = '20px';
                msg.style.zIndex = '1';
                msg.innerHTML = `
                    <div style="font-size: 32px; margin-bottom: 10px;">📍</div>
                    <div style="font-weight: bold; margin-bottom: 5px;">No Markers</div>
                    <div style="font-size: 14px;">No locations marked on this floor</div>
                `;
                hotelMapContainer.appendChild(msg);
                return msg;
            })();
            noMarkersMsg.style.display = 'block';
        } else {
            // Hide no markers message
            const noMarkersMsg = document.getElementById('noMarkersMsg');
            if (noMarkersMsg) noMarkersMsg.style.display = 'none';
            
            // Render markers
            floorMarkers.forEach(marker => {
                const el = document.createElement('div');
                el.className = 'marker';
                el.textContent = marker.icon;
                el.title = `${marker.name} (Floor ${marker.floor})`;
                el.style.left = `${marker.x}px`;
                el.style.top = `${marker.y}px`;
                el.style.zIndex = '10';
                hotelMapContainer.appendChild(el);
                console.log(`📍 Added marker: ${marker.name} at (${marker.x}, ${marker.y})`);
            });

            // Render connections
            const floorConnections = (hotelData.floors[currentFloor]?.connections || []);
            floorConnections.forEach(([id1, id2]) => {
                const m1 = allMarkers.find(m => m.id === id1);
                const m2 = allMarkers.find(m => m.id === id2);
                if (m1 && m2 && m1.floor === currentFloor && m2.floor === currentFloor) {
                    drawConnection(m1.x, m1.y, m2.x, m2.y, 'connection');
                }
            });
        }
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
                        el.title = `START: ${marker.name}`;
                    } else if (type === 'end') {
                        el.style.border = '3px solid #3b82f6';
                        el.style.borderRadius = '50%';
                        el.title = `END: ${marker.name}`;
                    }
                } else {
                    el.style.transform = 'translate(-50%, -50%)';
                    el.style.zIndex = '10';
                    el.style.boxShadow = 'none';
                    el.style.border = 'none';
                    el.title = `${marker.name} (Floor ${marker.floor})`;
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
        
        console.log('📋 Updating dropdowns with', locations.length, 'locations');
        
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
        console.log('🔄 Finding path from', startName, 'to', endName);
        
        const start = allMarkers.find(m => m.name === startName);
        const end = allMarkers.find(m => m.name === endName);
        
        if (!start || !end) {
            console.log('❌ Start or end marker not found');
            return null;
        }

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
        
        if (dist[end.id] === Infinity) {
            console.log('❌ No path found (distance is Infinity)');
            return null;
        }
        
        const result = path.map(id => allMarkers.find(m => m.id === id));
        console.log('✅ Path found with', result.length, 'steps');
        return result;
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

        // ✅ QR Code generation
        const baseUrl = 'https://knight-archcode.github.io/mysite/';
        const params = new URLSearchParams({
            hotel: hotelId,
            from: from,
            to: to,
            source: 'qr_code',
            t: Date.now()
        });
        const url = `${baseUrl}?${params.toString()}`;
        
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
                    <p class="text-xs text-gray-600 mb-1">Scan to share this route</p>
                    <p class="text-xs text-green-600 font-medium">
                        ✅ Includes hotel: ${hotelId}
                    </p>
                    <p class="text-xs text-blue-600 mt-1 break-all">
                        ${from} → ${to}
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
    
    // ✅ Add status panel
    function addStatusPanel() {
        const statusPanel = document.createElement('div');
        statusPanel.id = 'statusPanel';
        statusPanel.className = 'fixed top-4 right-4 bg-blue-600 text-white p-3 rounded-lg text-xs max-w-xs opacity-90 z-50 shadow-lg';
        statusPanel.innerHTML = `
            <div class="font-bold mb-1 flex items-center gap-2">
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                Hotel Navigator
            </div>
            <div id="statusContent" class="space-y-1"></div>
        `;
        document.body.appendChild(statusPanel);
        
        // Update status info
        setInterval(() => {
            const floorData = hotelData.floors[currentFloor];
            document.getElementById('statusContent').innerHTML = `
                <div>Hotel: <span class="font-semibold">${hotelId}</span></div>
                <div>Floor: ${currentFloor}</div>
                <div>Locations: ${allMarkers.length}</div>
                <div class="text-green-300">✓ Cloud Connected</div>
            `;
        }, 2000);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            statusPanel.style.opacity = '0.5';
            statusPanel.style.transition = 'opacity 0.5s';
            
            // Show on hover
            statusPanel.addEventListener('mouseenter', () => {
                statusPanel.style.opacity = '0.9';
            });
            statusPanel.addEventListener('mouseleave', () => {
                statusPanel.style.opacity = '0.5';
            });
        }, 10000);
    }
    
    // Initialize status panel
    addStatusPanel();
    
    // ✅ Add refresh button for testing
    function addRefreshButton() {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshDataBtn';
        refreshBtn.className = 'fixed bottom-4 right-4 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-50';
        refreshBtn.innerHTML = '🔄 Refresh Hotel Data';
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.innerHTML = '⏳ Loading...';
            refreshBtn.disabled = true;
            
            const result = await loadFromCloudDirect();
            if (result.success && result.data) {
                hotelData = result.data;
                localStorage.setItem('hotelData', JSON.stringify(hotelData));
                
                // Reset markers
                allMarkers = [];
                Object.keys(hotelData.floors).forEach(floorNum => {
                    const floor = hotelData.floors[floorNum];
                    if (floor && floor.markers) {
                        floor.markers.forEach(m => {
                            allMarkers.push({ ...m, floor: floorNum });
                        });
                    }
                });
                
                updateLocationDropdowns();
                loadFloor(currentFloor);
                
                alert('✅ Hotel data refreshed from cloud!');
            } else {
                alert('❌ Failed to refresh from cloud');
            }
            
            refreshBtn.innerHTML = '🔄 Refresh Hotel Data';
            refreshBtn.disabled = false;
        });
        
        document.body.appendChild(refreshBtn);
    }
    
    // Add refresh button
    addRefreshButton();
});
