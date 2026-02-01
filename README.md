ADMIN PAGE NOT WORKING

- 🏨 Hotel Hopper Navigator

A complete, self-contained web application for hotel navigation with guest navigation and admin management interfaces. This system allows hotel staff to create interactive floor plans and guests to navigate through the hotel with turn-by-turn directions.

 🌟 Features

- 🛠️ Admin Panel (/admin in the url)
- Secure Login: Protected admin interface (username: `admin`, password: `1234`)
- Multi-floor Management: Add, remove, and rename floors
- Floor Plan Upload: Upload unique images for each floor
- Interactive Editor: 
  - Add location markers with custom icons (🛏️, 🍽️, 🛗, etc.)
  - Connect markers to define walkable paths
  - Delete or modify existing elements
- Local Storage: All data saved in browser's localStorage

- 🧭 Guest Navigation
- Turn-by-turn Directions: Human-readable navigation instructions
- Visual Path Highlighting: 
  - Red path lines showing the route
  - Green/blue markers for start/end points



 📁 File Structure

```
hotel-hopper-navigator/
│
├── index.html              - Guest navigation interface
├── style.css              - Guest styles
├── script.js              - Guest logic (pathfinding, directions, QR)
│
├── admin/
    ├── index.html        - Admin login & management panel
    ├── admin.css         - Admin styles
    └── admin.js          - Admin logic (floor management, editing)

```

 🚀 Quick Start

1. Clone or download the project files
2. Open `index.html` in a web browser to use the guest navigation
3. Access admin panel at `admin/`
   - Username: `admin`
   - Password: `1234`

 🛠️ Setup Instructions

- For Hotel Staff (Admin)
1. Login with username- admin and password- 1234
2.  Go to `admin/index.html` and login
3. Add Floors: Click the "+" button to add new floors
4. Upload Floor Plans: For each floor, upload an image (JPEG, PNG, etc.)
5. Add Locations: 
   - Switch to "Add Marker" mode
   - Click anywhere on the floor plan to place markers
   - Choose icons (🛏️ for rooms, 🍽️ for restaurant, 🛗 for elevators, etc.)
6. Connect Paths: 
   - Switch to "Connect" mode
   - Click two markers to create a walkable path between them
7. Save Changes: Click "Save Changes" to persist all data

- For Guests
1. Open `index.html` in any web browser
2. Select Locations:
   - "From": Your starting point
   - "To": Your destination
3. Find Route: Click "Find Route" to get directions
4. View on Map: The path will be highlighted on the floor plan
5. Switch Floors: Use the floor selector to view different levels


 🎨 Custom Icons Available

| Icon | Meaning       |
|-----|----------------|
| 🛏️ | Bed            | 
| 🍽️ | Fork and Knife |
| 🛗 | Elevator       | 
| 🏊 | Swimmer        | 
| 💪 | Flexed Biceps  |
| 🚻 | Restroom       | 
| 🧳 | Luggage        | 
| ☕ | Hot Beverage   |  
| 🛎️ | Bellhop Bell   | 
| 🔒 | Lock           | 
| 🚪 | Door           | 
-----------------------

 🔧 Technical Details

- Pathfinding Algorithm
- Dijkstra's Algorithm for shortest path calculation
- Multi-floor Navigation: Automatic elevator routing between floors
- Real-time Directions: Turn detection (left/right/straight) based on path geometry

- Data Storage
- Browser localStorage: No server required, works offline
- JSON Structure: 
  ```json
  {
    "floors": {
      "1": {
        "name": "Lobby Floor",
        "floorPlanUrl": "data:image/jpeg;base64,...",
        "markers": [...],
        "connections": [...]
      }
    }
  }
  ```



 🎯 Use Cases

1. Hotel Guests: Navigate from lobby to room, find amenities
2. Event Attendees: Locate conference rooms, banquet halls
3. New Staff: Learn hotel layout during training
4. Accessibility: Help guests with mobility needs find accessible routes



 🤝 Contributing

Want to improve Hotel Hopper Navigator?
1. Fork the repository
2. Create a feature branch
3. Make your improvements
4. Submit a pull request


 📞 Support

For questions, issues, or suggestions:
1. Drop me a message


---

Happy Pathing! 🏨✨

*Remember: This system works completely offline once configured. Perfect for hotels with limited internet access or as a backup navigation system.*
