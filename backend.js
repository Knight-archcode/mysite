// backend.js - Supabase integration

const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // e.g., https://xyz.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class HotelBackend {
    constructor() {
        this.hotelId = 'default_hotel'; // Change if you want multiple hotels
    }
    
    // Save hotel data to Supabase
    async saveHotelData(hotelData) {
        try {
            const { data, error } = await supabase
                .from('hotels')
                .upsert({
                    hotel_id: this.hotelId,
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
    
    // Load hotel data from Supabase
    async loadHotelData() {
        try {
            const { data, error } = await supabase
                .from('hotels')
                .select('hotel_data')
                .eq('hotel_id', this.hotelId)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
            
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
    
    // Share hotel via URL (encodes data in URL)
    async generateShareableUrl() {
        const { data } = await this.loadHotelData();
        if (!data) return null;
        
        // Compress data for URL
        const dataStr = JSON.stringify(data);
        const compressed = btoa(encodeURIComponent(dataStr));
        
        // Create shareable URL
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?hotelData=${compressed}`;
    }
    
    // Load from URL parameter
    loadFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const hotelDataParam = params.get('hotelData');
        
        if (hotelDataParam) {
            try {
                const decoded = decodeURIComponent(atob(hotelDataParam));
                const hotelData = JSON.parse(decoded);
                
                console.log('✅ Loaded hotel data from URL');
                localStorage.setItem('hotelData', JSON.stringify(hotelData));
                
                // Remove parameter from URL
                window.history.replaceState({}, '', window.location.pathname);
                
                return { success: true, data: hotelData };
            } catch (error) {
                console.error('❌ Error loading from URL:', error);
                return { success: false, error };
            }
        }
        return { success: true, data: null };
    }
}

// Create global instance
window.hotelBackend = new HotelBackend();
