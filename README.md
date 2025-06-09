TriviaDare 🎮
A React Native trivia game featuring real-time Firebase multiplayer with an innovative dare system.
Show Image
Show Image
Show Image
🎯 Overview
TriviaDare combines traditional trivia gameplay with an exciting dare system, supporting both local and remote multiplayer experiences through Firebase real-time synchronization.
🎮 Game Modes

🎭 TriviaDARE: Trivia + Dares (Local Players Required)

Answer trivia questions correctly or perform entertaining dares
Real-time voting system for dare completion
Dynamic scoring with streak bonuses and catch-up mechanics


🧠 TriviaONLY: Pure Trivia (Remote Players Supported)

Classic trivia gameplay without physical challenges
Perfect for remote friends and family
Timer-based scoring with bonus points


🎪 DaresOnly: Skip straight to dares (Coming Soon)

✨ Key Features
🔥 Real-time Multiplayer

4-digit room codes for easy game sharing
Cross-platform compatibility (iOS & Android)
Turn-based gameplay with spectator mode
Live score synchronization across all devices
Automatic host transfer when host disconnects

🎯 Dynamic Scoring System

Timer-based points with multiple speed options (15s, 30s, 45s, 60s)
Adaptive dare scoring based on game length and player performance
Streak multipliers for consecutive dare completions
Catch-up bonuses to keep games competitive

📱 Cross-Platform Experience

Platform indicators show iOS/Android players
Optimized performance for both platforms
Native UI elements (TouchableNativeFeedback on Android)
Platform-specific haptic feedback

🎨 Game Show Aesthetics

Animated countdown sequences
Professional game show styling
Real-time light animations
Sound effects and background music

🚀 Quick Start
Prerequisites
bashnode >= 18.0.0
npm >= 8.0.0
expo-cli >= 6.0.0
Installation
bash# Clone the repository
git clone https://github.com/ByteUmbrella/TriviaDare.git
cd TriviaDare

# Install dependencies
npm install

# Start the development server
expo start
Firebase Setup

Create a Firebase project at https://console.firebase.google.com
Enable Realtime Database and Authentication
Copy your config to /config/firebaseConfig.js
Set up security rules (see /docs/firebase-setup.md)

🏗️ Architecture
Tech Stack

Frontend: React Native with Expo
Backend: Firebase Realtime Database
Authentication: Firebase Anonymous Auth
Navigation: React Navigation 6
State Management: React Context API
Animations: React Native Animated API

Project Structure
TriviaDare/
├── 📱 src/
│   ├── 🎮 screens/
│   │   ├── multiplayer/          # Multiplayer game screens
│   │   │   ├── ConnectionScreen.js
│   │   │   ├── LobbyScreen.js
│   │   │   └── MultiplayerQuestionScreen.js
│   │   └── singleplayer/         # Single device screens
│   ├── 🧩 components/
│   │   ├── QuestionContainer.js
│   │   ├── DarePopup.js
│   │   └── ScoreBanner.js
│   ├── 🔧 Context/
│   │   ├── GameContext.js        # Game state management
│   │   ├── triviaPacks.js        # Question pack system
│   │   └── multiplayer/
│   │       ├── FirebaseContext.js
│   │       └── MultiplayerGameFlow.js
│   ├── 🎨 assets/
│   │   ├── images/
│   │   ├── sounds/
│   │   └── TriviaPackSelection/
│   └── ⚙️ config/
│       └── firebaseConfig.js
├── 📚 docs/                     # Technical documentation
│   ├── ARCHITECTURE.md
│   ├── MULTIPLAYER.md
│   └── API.md
└── 📋 package.json
🎮 How to Play
Multiplayer Setup

Host creates room → Gets 4-digit code (e.g., "A1B2")
Players join → Enter room code and player name
Configure game → Select pack, timer, rounds, game mode
Start game → Synchronized countdown begins

Gameplay Flow

Turn-based questions → One player answers while others watch
Timer pressure → Faster answers = more points
Wrong answer → Triggers dare system (TriviaDARE mode)
Dare voting → All players vote on completion
Dynamic scoring → Points adapt based on game state

🔧 Configuration
Timer Options

⚡ Quick (15s): 200 base points
🎯 Standard (30s): 150 base points
😌 Relaxed (45s): 100 base points
🐌 Extended (60s): 50 base points

Game Settings

Questions: 1-20 per game
Players: 2-8 per room
Packs: 20+ trivia categories
Modes: TriviaDARE or TriviaONLY

📊 Firebase Database Structure
javascriptrooms/{roomCode}/ {
  roomCode: "A1B2",
  hostId: "user123", 
  gameStatus: "playing",
  gameSettings: {
    timeLimit: 30,
    rounds: 5,
    gameMode: "TriviaDARE"
  },
  gameData: {
    questions: [...],  // Loaded from trivia packs
    packName: "Entertainment"
  },
  players: {
    "user123": {
      name: "Player 1",
      score: 250,
      isHost: true,
      platform: "ios"
    }
  }
}
🧪 Testing
bash# Run tests
npm test

# Test specific component
npm test -- QuestionContainer

# Run E2E tests
npm run test:e2e
📱 Platform Support
FeatureiOSAndroidCore Gameplay✅✅Multiplayer✅✅Haptic Feedback✅✅Background Audio✅✅Push Notifications✅✅
🔮 Roadmap
Phase 1: Polish & Testing ✅

 Complete multiplayer implementation
 Question loading system
 Dynamic dare scoring
 Cross-platform optimization

Phase 2: Advanced Features 🔄

 Rejoin functionality after disconnection
 Spectator-only mode
 Custom question pack creation
 Tournament brackets

Phase 3: Social Features 🔮

 Friend systems
 Global leaderboards
 Achievement sharing
 Video dare recording

🤝 Contributing

Fork the repository
Create a feature branch (git checkout -b feature/amazing-feature)
Commit changes (git commit -m 'Add amazing feature')
Push to branch (git push origin feature/amazing-feature)
Open a Pull Request

See CONTRIBUTING.md for detailed guidelines.
📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
📞 Support

📧 Email: support@byteumbrella.com
🐛 Issues: GitHub Issues
💬 Discord: ByteUmbrella Community

🙏 Acknowledgments

Firebase team for real-time database
React Native community
Expo team for development tools
All beta testers and contributors


Made with ❤️ by ByteUmbrella
Bringing friends together through trivia and laughter 🎉
