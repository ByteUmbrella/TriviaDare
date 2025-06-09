# TriviaDare API Reference

## 🔥 Firebase Realtime Database API

This document outlines the complete API structure for TriviaDare's Firebase implementation, including data models, methods, and real-time synchronization patterns.

## 📊 Data Models

### Room Model

```typescript
interface Room {
  roomCode: string;           // 4-character alphanumeric code (e.g., "A1B2")
  hostId: string;            // Firebase user ID of the host
  createdAt: string;         // ISO timestamp
  gameStatus: GameStatus;    // "waiting" | "playing" | "finished"
  gameMode: GameMode;        // "TriviaDARE" | "TriviaONLY"
  
  gameSettings: {
    timeLimit: number;       // 15, 30, 45, or 60 seconds
    rounds: number;          // 1-20 questions
    gameMode: GameMode;      // Host-selected mode
  };
  
  gameData?: {
    gameMode: GameMode;
    packName: string;        // Display name of trivia pack
    packId: string;          // Internal pack identifier
    packDisplayName: string; // Formatted display name
    questions: Question[];   // Array of trivia questions
    timeLimit: number;
    rounds: number;
    totalQuestions: number;
    createdAt: string;       // ISO timestamp
  };
  
  currentQuestionIndex?: number;  // Current question (0-based)
  currentPlayerId?: string;       // Whose turn it is
  
  players: {
    [userId: string]: Player;
  };
  
  // Dare system (TriviaDARE mode only)
  currentDare?: {
    playerId: string;        // Who is performing the dare
    text: string;           // Dare description
    timestamp: string;      // ISO timestamp
    pointValue: number;     // Dynamically calculated points
    inProgress: boolean;
  };
  
  dareVotes?: {
    [userId: string]: boolean;  // true = completed, false = not completed
  };
  
  // Game coordination
  countdown?: {
    value: number;          // 3, 2, 1
    startTimestamp: string; // ISO timestamp
    inProgress: boolean;
  };
  
  // Answer tracking
  answers?: {
    [questionIndex: string]: {
      [userId: string]: {
        playerId: string;
        answer: string;
        isCorrect: boolean;
        timestamp: string;
      };
    };
  };
  
  // Admin features
  removedPlayers?: {
    [userId: string]: boolean;
  };
}
```

### Player Model

```typescript
interface Player {
  id: string;              // Firebase user ID
  name: string;            // Display name (1-15 characters)
  isHost: boolean;         // Host privileges
  isConnected: boolean;    // Connection status
  platform: Platform;     // "ios" | "android"
  score: number;           // Current game score
  ready: boolean;          // Ready to start game
  joinedAt: string;        // ISO timestamp
  
  // Dare voting (optional)
  dareVote?: {
    value: boolean;        // Vote value
    timestamp: string;     // When vote was cast
  };
}
```

### Question Model

```typescript
interface Question {
  "Question ID": string;     // Unique identifier
  "Question Text": string;   // The trivia question
  "Option A": string;        // First answer option
  "Option B": string;        // Second answer option  
  "Option C": string;        // Third answer option
  "Option D": string;        // Fourth answer option
  "Correct Answer": string;  // "Option A", "Option B", "Option C", or "Option D"
  "Difficulty": string;      // "Easy", "Medium", "Hard", "Impossible"
}
```

### Game Settings Model

```typescript
interface GameSettings {
  timeLimit: 15 | 30 | 45 | 60;     // Timer duration in seconds
  rounds: number;                    // Number of questions (1-20)
  gameMode: "TriviaDARE" | "TriviaONLY";
}
```

## 🔧 FirebaseContext Methods

### Authentication

#### `signInAnonymouslyIfNeeded()`
```typescript
signInAnonymouslyIfNeeded(): Promise<string | null>
```
- **Description**: Signs in user anonymously if not already authenticated
- **Returns**: User ID string or null if failed
- **Usage**: Called automatically when needed

### Room Management

#### `createRoom(playerName, gameSettings)`
```typescript
createRoom(
  playerName: string, 
  gameSettings: GameSettings
): Promise<string>
```
- **Description**: Creates a new game room with 4-digit code
- **Parameters**:
  - `playerName`: Host's display name (1-15 characters)
  - `gameSettings`: Initial game configuration
- **Returns**: Room code (e.g., "A1B2")
- **Throws**: Error if creation fails

**Example:**
```javascript
const roomCode = await firebase.createRoom("Alice", {
  timeLimit: 30,
  rounds: 5,
  gameMode: "TriviaDARE"
});
// Returns: "A1B2"
```

#### `joinRoom(roomCode, playerName)`
```typescript
joinRoom(
  roomCode: string, 
  playerName: string
): Promise<string>
```
- **Description**: Joins an existing room
- **Parameters**:
  - `roomCode`: 4-character room code (case-insensitive)
  - `playerName`: Player's display name (1-15 characters)
- **Returns**: Normalized room code
- **Throws**: Error if room not found or game already started

**Example:**
```javascript
await firebase.joinRoom("a1b2", "Bob");
// Auto-normalizes to "A1B2"
```

#### `leaveRoom()`
```typescript
leaveRoom(): Promise<void>
```
- **Description**: Leaves current room and handles host transfer
- **Side Effects**: 
  - Removes player from room
  - Transfers host to another player if current user is host
  - Deletes room if no players remain

#### `removePlayerFromRoom(playerId)`
```typescript
removePlayerFromRoom(playerId: string): Promise<boolean>
```
- **Description**: Host-only method to remove a player from the room
- **Parameters**:
  - `playerId`: ID of player to remove
- **Returns**: Success boolean
- **Authorization**: Only room host can remove players

### Game Operations

#### `startGame(gameMode, packName, questions, timeLimit, rounds)`
```typescript
startGame(
  gameMode: GameMode,
  packName: string,
  questions: Question[],
  timeLimit: number,
  rounds: number
): Promise<void>
```
- **Description**: Starts the game with loaded questions
- **Parameters**:
  - `gameMode`: "TriviaDARE" or "TriviaONLY"
  - `packName`: Name of the trivia pack
  - `questions`: Array of question objects
  - `timeLimit`: Timer duration in seconds
  - `rounds`: Number of questions to play
- **Authorization**: Only room host can start game
- **Side Effects**: Updates game status to "playing"

**Example:**
```javascript
await firebase.startGame(
  "TriviaDARE",
  "Entertainment", 
  shuffledQuestions,
  30,
  5
);
```

#### `updateGameState(updates)`
```typescript
updateGameState(updates: Partial<Room>): Promise<boolean>
```
- **Description**: Updates game state in Firebase
- **Parameters**:
  - `updates`: Partial room object with fields to update
- **Returns**: Success boolean
- **Authorization**: Typically host-only for most updates

**Example:**
```javascript
await firebase.updateGameState({
  currentPlayerId: "user456",
  currentQuestionIndex: 1
});
```

#### `updatePlayerData(updates, playerId?)`
```typescript
updatePlayerData(
  updates: Partial<Player>,
  playerId?: string
): Promise<boolean>
```
- **Description**: Updates player data
- **Parameters**:
  - `updates`: Partial player object with fields to update
  - `playerId`: Optional player ID (defaults to current user)
- **Returns**: Success boolean

**Example:**
```javascript
// Update own score
await firebase.updatePlayerData({ score: 350 });

// Update ready status
await firebase.updatePlayerData({ ready: true });
```

### Answer System

#### `submitAnswer(answer, isCorrect)`
```typescript
submitAnswer(
  answer: string, 
  isCorrect: boolean
): Promise<boolean>
```
- **Description**: Submits answer for current question
- **Parameters**:
  - `answer`: Selected answer text
  - `isCorrect`: Whether answer is correct
- **Returns**: Success boolean
- **Side Effects**: 
  - Records answer in Firebase
  - Updates score if correct
  - Advances game if all players answered

**Example:**
```javascript
await firebase.submitAnswer("Parasite", true);
```

### Dare System

#### `generateAndSetDare()`
```typescript
generateAndSetDare(): Promise<string | null>
```
- **Description**: Generates random dare and stores in Firebase
- **Returns**: Dare text or null if failed
- **Authorization**: Typically called by host
- **Side Effects**: Sets `currentDare` in room data

#### `submitDareVote(isCompleted)`
```typescript
submitDareVote(isCompleted: boolean): Promise<boolean>
```
- **Description**: Submits vote for dare completion
- **Parameters**:
  - `isCompleted`: Whether dare was completed successfully
- **Returns**: Success boolean
- **Usage**: All players vote on dare completion

**Example:**
```javascript
// Vote that dare was completed
await firebase.submitDareVote(true);

// Vote that dare was not completed  
await firebase.submitDareVote(false);
```

#### `processDareVotes()`
```typescript
processDareVotes(): Promise<boolean>
```
- **Description**: Processes all dare votes and awards points
- **Returns**: Whether votes were processed
- **Authorization**: Host-only
- **Logic**: Awards points if majority votes "completed"

### Utility Methods

#### `getLeaderboard()`
```typescript
getLeaderboard(): Player[]
```
- **Description**: Returns players sorted by score (descending)
- **Returns**: Array of player objects
- **Usage**: For displaying current standings

#### `clearError()`
```typescript
clearError(): void
```
- **Description**: Clears current error state
- **Usage**: Reset error state after handling

## 📡 Real-time Listeners

### Room State Listener

Automatically listens to room updates:

```javascript
// FirebaseContext sets up listener
useEffect(() => {
  if (!currentRoom) return;
  
  const roomRef = ref(database, `rooms/${currentRoom}`);
  const unsubscribe = onValue(roomRef, (snapshot) => {
    const data = snapshot.val();
    setGameState(data);
  });
  
  return unsubscribe;
}, [currentRoom]);
```

### Player Data Listener

Listens to player changes:

```javascript
const playersRef = ref(database, `rooms/${currentRoom}/players`);
const unsubscribe = onValue(playersRef, (snapshot) => {
  const data = snapshot.val();
  setPlayers(data);
});
```

## 🎯 Game Flow API Patterns

### Starting a Game

```javascript
// 1. Host loads questions
const questionResult = await loadPackQuestions(packName, 'easy');
const shuffledQuestions = questionResult.data
  .sort(() => Math.random() - 0.5)
  .slice(0, rounds);

// 2. Start game with questions
await firebase.startGame(
  gameMode,
  packName, 
  shuffledQuestions,
  timeLimit,
  rounds
);

// 3. Set first player
await firebase.updateGameState({
  currentPlayerId: firstPlayerId
});
```

### Turn Management

```javascript
// Check if it's my turn
const isMyTurn = firebase.user?.uid === firebase.gameState?.currentPlayerId;

// Advance to next player (host only)
const nextPlayerId = determineNextPlayer();
await firebase.updateGameState({
  currentPlayerId: nextPlayerId,
  currentQuestionIndex: currentIndex + 1
});
```

### Dare Workflow

```javascript
// 1. Trigger dare on wrong answer
if (!isCorrect && gameMode === "TriviaDARE") {
  await firebase.updateGameState({
    performingDare: true,
    currentDarePlayerId: currentPlayerId
  });
  
  // 2. Generate dare
  await firebase.generateAndSetDare();
}

// 3. Players vote
await firebase.submitDareVote(isCompleted);

// 4. Process votes (host only)
if (allPlayersVoted) {
  await firebase.processDareVotes();
}
```

## 🔐 Security Rules

### Room Access Rules

```javascript
{
  "rules": {
    "rooms": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$roomId": {
        ".read": "auth != null",
        ".write": "auth != null",
        "players": {
          "$playerId": {
            ".read": "auth != null",
            ".write": "auth != null || $playerId === auth.uid"
          }
        }
      }
    }
  }
}
```

### Data Validation Rules

```javascript
"players": {
  "$playerId": {
    ".validate": "newData.hasChildren(['id', 'name', 'isHost', 'score'])",
    "name": {
      ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 15"
    },
    "score": {
      ".validate": "newData.isNumber() && newData.val() >= 0"
    }
  }
}
```

## ⚡ Performance Optimization

### Efficient Queries

```javascript
// Only listen to specific room
const roomRef = ref(database, `rooms/${roomCode}`);

// Use once() for one-time reads
const snapshot = await get(roomRef);

// Cleanup listeners
useEffect(() => {
  const unsubscribe = onValue(roomRef, handleUpdate);
  return unsubscribe; // Cleanup on unmount
}, []);
```

### Batched Updates

```javascript
// Batch multiple updates
await update(ref(database, `rooms/${roomCode}`), {
  gameStatus: 'playing',
  currentQuestionIndex: 0,
  currentPlayerId: firstPlayerId,
  gameData: gameDataWithQuestions
});
```

### Data Structure Optimization

```javascript
// Efficient player lookup
players: {
  "user123": { ...playerData },  // Direct key access
  "user456": { ...playerData }   // O(1) lookup time
}

// Avoid deep nesting
answers: {
  "0": {                         // Question index
    "user123": { ...answer }     // Player answers
  }
}
```

## 🐛 Error Handling

### Common Error Codes

| Code | Description | Handling |
|------|-------------|----------|
| `permission-denied` | Insufficient permissions | Check authentication |
| `network-error` | Connection issues | Retry with backoff |
| `invalid-argument` | Bad input data | Validate before sending |
| `not-found` | Room doesn't exist | Handle gracefully |
| `already-exists` | Duplicate data | Check existing state |

### Error Handling Pattern

```javascript
const handleFirebaseOperation = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error('Firebase operation failed:', error);
    
    switch (error.code) {
      case 'permission-denied':
        showAlert('Access denied. Please try again.');
        break;
      case 'network-error':
        showAlert('Connection error. Check your internet.');
        break;
      default:
        showAlert('An error occurred. Please try again.');
    }
    
    throw error;
  }
};
```

## 📊 Rate Limits & Quotas

### Firebase Free Tier Limits

- **Concurrent Connections**: 100
- **Database Size**: 1 GB
- **Bandwidth**: 10 GB/month
- **Operations**: No specific limit (depends on usage)

### Optimization Strategies

1. **Efficient Listeners**: Only listen to required data
2. **Cleanup**: Remove listeners when not needed
3. **Batching**: Combine multiple updates
4. **Caching**: Cache frequently accessed data
5. **Pagination**: Limit query results

### Usage Monitoring

```javascript
// Track Firebase usage
const trackUsage = {
  reads: 0,
  writes: 0,
  
  incrementReads() { this.reads++; },
  incrementWrites() { this.writes++; },
  
  getStats() {
    return { reads: this.reads, writes: this.writes };
  }
};
```

---

This API reference provides complete documentation for integrating with TriviaDare's Firebase backend, enabling efficient multiplayer game development.
