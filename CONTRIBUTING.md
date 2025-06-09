# Contributing to TriviaDare 🤝

Thank you for your interest in contributing to TriviaDare! This document provides guidelines and information for contributors.

## 🎯 Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our Code of Conduct:

- **Be respectful** and inclusive
- **Be constructive** in discussions and feedback
- **Be collaborative** and help others learn
- **Focus on what's best** for the community and project

## 🚀 Getting Started

### Prerequisites

```bash
# Required versions
node >= 18.0.0
npm >= 8.0.0
expo-cli >= 6.0.0
git >= 2.0.0
```

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/yourusername/TriviaDare.git
   cd TriviaDare
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   ```bash
   # Copy example config
   cp config/firebaseConfig.example.js config/firebaseConfig.js
   # Add your Firebase project credentials
   ```

4. **Start development server**
   ```bash
   expo start
   ```

5. **Run tests**
   ```bash
   npm test
   npm run test:watch  # Watch mode
   npm run test:e2e    # End-to-end tests
   ```

## 🏗️ Development Workflow

### Branch Strategy

```
main                 # Production-ready code
├── develop         # Integration branch
├── feature/xxx     # New features
├── bugfix/xxx      # Bug fixes
├── hotfix/xxx      # Critical production fixes
└── docs/xxx        # Documentation updates
```

### Creating a Feature

1. **Create feature branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow coding standards (see below)
   - Add tests for new functionality
   - Update documentation if needed

3. **Test thoroughly**
   ```bash
   npm test                    # Unit tests
   npm run test:e2e           # E2E tests
   npm run lint               # Code linting
   npm run type-check         # TypeScript checks
   ```

4. **Commit with conventional format**
   ```bash
   git add .
   git commit -m "feat: add new multiplayer feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for consistent commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(multiplayer): add rejoin functionality for disconnected players
fix(firebase): resolve question loading race condition
docs(readme): update installation instructions
style(components): format QuestionContainer with prettier
refactor(context): simplify Firebase state management
test(multiplayer): add integration tests for dare voting
chore(deps): update expo to latest version
```

## 📝 Coding Standards

### File Organization

```
src/
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── game/              # Game-specific components
│   └── index.js           # Component exports
├── screens/
│   ├── multiplayer/       # Multiplayer screens
│   ├── singleplayer/      # Single-player screens
│   └── shared/            # Shared screens
├── Context/
│   ├── GameContext.js     # Game state
│   ├── FirebaseContext.js # Multiplayer state
│   └── index.js           # Context exports
├── utils/
│   ├── helpers.js         # Helper functions
│   ├── constants.js       # App constants
│   └── validation.js      # Input validation
└── hooks/
    ├── useTimer.js        # Custom hooks
    └── useFirebase.js
```

### Naming Conventions

**Files and Folders:**
- `PascalCase` for React components: `QuestionContainer.js`
- `camelCase` for utilities and hooks: `useMultiplayer.js`
- `kebab-case` for assets: `background-music.mp3`

**Variables and Functions:**
```javascript
// Constants - UPPER_SNAKE_CASE
const TIMER_CONFIGS = { ... };
const MAX_PLAYERS = 8;

// Variables and functions - camelCase
const playerName = 'Alice';
const calculateScore = (timeLeft) => { ... };

// Components - PascalCase
const MultiplayerQuestionScreen = () => { ... };

// React hooks - camelCase with 'use' prefix
const useFirebaseSync = () => { ... };
```

### Component Structure

```javascript
import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useGame } from '../../Context/GameContext';

// PropTypes or TypeScript interfaces
interface QuestionContainerProps {
  question: Question;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
}

// Component implementation
const QuestionContainer = memo(({ 
  question, 
  onAnswer, 
  disabled = false 
}: QuestionContainerProps) => {
  // Hooks
  const [selectedOption, setSelectedOption] = useState(null);
  const { currentScore } = useGame();
  
  // Event handlers
  const handleOptionSelect = useCallback((option) => {
    setSelectedOption(option);
  }, []);
  
  // Effects
  useEffect(() => {
    // Component lifecycle logic
  }, []);
  
  // Render helpers
  const renderOption = (option, index) => (
    <TouchableOpacity key={option} onPress={() => handleOptionSelect(option)}>
      <Text>{option}</Text>
    </TouchableOpacity>
  );
  
  // Main render
  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{question.text}</Text>
      {question.options.map(renderOption)}
    </View>
  );
});

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    ...Platform.select({
      ios: { fontFamily: 'Helvetica' },
      android: { fontFamily: 'Roboto' }
    })
  }
});

QuestionContainer.displayName = 'QuestionContainer';
export default QuestionContainer;
```

### Firebase Integration Patterns

```javascript
// Context pattern for Firebase operations
const useFirebaseOperation = (operation) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation(...args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [operation]);
  
  return { execute, loading, error };
};

// Usage
const { execute: createRoom, loading } = useFirebaseOperation(
  firebase.createRoom
);
```

### Error Handling

```javascript
// Comprehensive error handling
const handleGameOperation = async () => {
  try {
    await gameOperation();
  } catch (error) {
    // Log error for debugging
    console.error('Game operation failed:', error);
    
    // User-friendly error message
    if (error.code === 'permission-denied') {
      showAlert('Access denied. Please check your permissions.');
    } else if (error.code === 'network-error') {
      showAlert('Network error. Please check your connection.');
    } else {
      showAlert('An unexpected error occurred. Please try again.');
    }
    
    // Analytics reporting
    Analytics.reportError('game_operation_failed', {
      error: error.message,
      stack: error.stack,
      context: 'multiplayer_game'
    });
  }
};
```

## 🧪 Testing Guidelines

### Unit Testing

```javascript
// Component testing with React Native Testing Library
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QuestionContainer from '../QuestionContainer';

describe('QuestionContainer', () => {
  const mockQuestion = {
    text: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correctAnswer: '4'
  };
  
  it('renders question text correctly', () => {
    const { getByText } = render(
      <QuestionContainer question={mockQuestion} onAnswer={jest.fn()} />
    );
    
    expect(getByText('What is 2 + 2?')).toBeTruthy();
  });
  
  it('calls onAnswer when option selected', async () => {
    const mockOnAnswer = jest.fn();
    const { getByText } = render(
      <QuestionContainer question={mockQuestion} onAnswer={mockOnAnswer} />
    );
    
    fireEvent.press(getByText('4'));
    
    await waitFor(() => {
      expect(mockOnAnswer).toHaveBeenCalledWith('4');
    });
  });
});
```

### Integration Testing

```javascript
// Firebase integration testing
import { createMockFirebase } from '../../__mocks__/firebase';
import { renderWithProviders } from '../../utils/test-utils';

describe('Multiplayer Integration', () => {
  let mockFirebase;
  
  beforeEach(() => {
    mockFirebase = createMockFirebase();
  });
  
  it('should create and join room successfully', async () => {
    const { getByTestId } = renderWithProviders(
      <ConnectionScreen />,
      { firebase: mockFirebase }
    );
    
    // Test room creation flow
    fireEvent.press(getByTestId('create-room-button'));
    
    await waitFor(() => {
      expect(mockFirebase.createRoom).toHaveBeenCalled();
    });
  });
});
```

### E2E Testing

```javascript
// Detox E2E testing
describe('Multiplayer Game Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should complete full multiplayer game', async () => {
    // Navigate to multiplayer
    await element(by.id('multiplayer-button')).tap();
    
    // Create room
    await element(by.id('create-room-button')).tap();
    await expect(element(by.id('room-code'))).toBeVisible();
    
    // Configure game
    await element(by.id('start-game-button')).tap();
    
    // Play game
    await element(by.id('option-a')).tap();
    await element(by.id('confirm-answer')).tap();
    
    // Verify results
    await expect(element(by.id('results-screen'))).toBeVisible();
  });
});
```

## 📱 Platform-Specific Guidelines

### iOS Development

```javascript
// iOS-specific optimizations
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }
    })
  }
});

// iOS haptic feedback
if (Platform.OS === 'ios') {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
```

### Android Development

```javascript
// Android-specific optimizations
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      android: {
        elevation: 5,
      }
    })
  }
});

// Android native feedback
if (Platform.OS === 'android') {
  import TouchableNativeFeedback from 'react-native';
  // Use TouchableNativeFeedback for better UX
}
```

## 🐛 Bug Reports

### Creating Good Bug Reports

Include the following information:

1. **Environment**
   ```
   - Device: iPhone 13 Pro / Samsung Galaxy S21
   - OS Version: iOS 16.0 / Android 13
   - App Version: 2.1.0
   - Expo SDK Version: 49.0.0
   ```

2. **Steps to Reproduce**
   ```
   1. Open multiplayer mode
   2. Create room with 4 players
   3. Start TriviaDARE game
   4. Answer question incorrectly
   5. Perform dare
   6. Vote on completion
   ```

3. **Expected vs Actual Behavior**
   ```
   Expected: Points awarded after majority vote
   Actual: No points awarded despite 3/4 yes votes
   ```

4. **Logs and Screenshots**
   ```
   Attach console logs, error messages, and screenshots
   ```

## 🎨 Design Guidelines

### UI/UX Principles

1. **Game Show Aesthetic**
   - Bold, vibrant colors
   - Animated transitions
   - Professional typography
   - Celebratory feedback

2. **Cross-Platform Consistency**
   - Maintain core experience across platforms
   - Respect platform conventions
   - Optimize for each platform's strengths

3. **Accessibility**
   - High contrast ratios (WCAG AA)
   - Touch target sizes ≥ 44px
   - Screen reader compatibility
   - Reduced motion options

### Color Palette

```javascript
const COLORS = {
  primary: '#FFD700',      // Gold
  secondary: '#4CAF50',    // Green
  danger: '#FF5722',       // Red
  warning: '#FF9800',      // Orange
  info: '#2196F3',         // Blue
  background: '#1A237E',   // Dark Blue
  surface: '#000000',      // Black
  text: '#FFFFFF',         // White
  textSecondary: '#CCCCCC' // Light Gray
};
```

## 📚 Documentation

### Code Documentation

```javascript
/**
 * Calculates dynamic dare points based on game state
 * 
 * @param {number} playerIndex - Index of player performing dare
 * @param {number[]} currentScores - Array of all player scores
 * @param {number} totalQuestions - Total questions in game
 * @returns {number} Calculated dare points
 * 
 * @example
 * const points = calculateDarePoints(0, [100, 200, 150], 5);
 * // Returns points with streak bonuses and catch-up mechanics
 */
const calculateDarePoints = (playerIndex, currentScores, totalQuestions) => {
  // Implementation...
};
```

### README Updates

When adding new features, update relevant documentation:

- Main README.md features list
- Architecture documentation
- API documentation
- Installation instructions

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` (e.g., 2.1.0)
- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes (backward compatible)

### Release Checklist

```bash
# 1. Update version
npm version patch  # or minor/major

# 2. Update changelog
# Edit CHANGELOG.md with new features and fixes

# 3. Run full test suite
npm run test:all

# 4. Build for production
expo build:android
expo build:ios

# 5. Create release notes
# Document new features, bug fixes, breaking changes

# 6. Tag release
git tag v2.1.0
git push origin v2.1.0

# 7. Deploy to stores
# Submit to App Store and Google Play
```

## 💬 Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and community chat
- **Discord**: Real-time community support
- **Email**: direct contact for sensitive issues

## 🙏 Recognition

Contributors will be recognized in:

- GitHub contributors list
- App credits screen
- Release notes
- Community Hall of Fame

Thank you for contributing to TriviaDare! 🎮✨
