import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  BackHandler,
  StatusBar,
  Image,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useGame } from '../Context/GameContext';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Function to calculate responsive font sizes
const scaleFontSize = (size) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scaleFactor);
};

const PendingDaresScreen = ({ navigation, route }) => {
    const { pendingDares, updatePendingDareStatus, scores, setScores, players } = useGame();
    const [currentDareIndex, setCurrentDareIndex] = useState(0);
    const buttonScale = useRef(new Animated.Value(1)).current;
    const { packName, completedDares } = route.params || {};
    const [updatedCompletedDares, setUpdatedCompletedDares] = useState([...(completedDares || [])]);
    const [flipped, setFlipped] = useState(true);
    const [isFirstRender, setIsFirstRender] = useState(true);
    
    // Animation values
    const cardPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const cardOpacity = useRef(new Animated.Value(1)).current;
    const cardRotation = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(1)).current;
    const cardShineAnim = useRef(new Animated.Value(0)).current;
    const casinoLightsAnim = useRef(new Animated.Value(0)).current;
    const nextCardPosition = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH, y: 50 })).current;
    const nextCardOpacity = useRef(new Animated.Value(0)).current;
    const nextCardRotation = useRef(new Animated.Value(-15)).current;
    const nextCardScale = useRef(new Animated.Value(0.9)).current;
    const cardShadowOpacity = useRef(new Animated.Value(0.5)).current;

    // Start card shine animation
    useEffect(() => {
        // Card shine effect
        Animated.loop(
            Animated.sequence([
                Animated.timing(cardShineAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(cardShineAnim, {
                    toValue: 0,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Casino lights effect
        Animated.loop(
            Animated.sequence([
                Animated.timing(casinoLightsAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(casinoLightsAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // Add Android back button handler
    useFocusEffect(
        React.useCallback(() => {
            if (Platform.OS === 'android') {
                const onBackPress = () => {
                    // Prevent going back - must complete all pending dares
                    return true;
                };

                BackHandler.addEventListener('hardwareBackPress', onBackPress);
                return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
            }
        }, [])
    );

    // Add a useEffect to handle navigation when pendingDares is empty
    useEffect(() => {
        if (pendingDares.length === 0) {
            navigation.replace('EndGameScreen', {
                packName: packName,
                completedDares: updatedCompletedDares,
                players: players.map(p => typeof p === 'string' ? p : p.name)
            });
        }
    }, [pendingDares, updatedCompletedDares]);

    // Animation for initial card entrance (dealer style)
    useEffect(() => {
        if (isFirstRender) {
            // Start with card off-screen (as if dealer is holding it)
            cardPosition.setValue({ x: -SCREEN_WIDTH, y: 100 });
            cardOpacity.setValue(0);
            cardRotation.setValue(-15);
            cardScale.setValue(0.9);
            
            // Animate card being dealt onto the table
            Animated.parallel([
                Animated.timing(cardPosition, {
                    toValue: { x: 0, y: 0 },
                    duration: 600,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.5))
                }),
                Animated.timing(cardOpacity, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(cardRotation, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.2))
                }),
                Animated.timing(cardScale, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.back(1.2))
                }),
                Animated.sequence([
                    Animated.delay(300),
                    Animated.spring(cardShadowOpacity, {
                        toValue: 1,
                        friction: 6,
                        useNativeDriver: true
                    })
                ])
            ]).start(() => {
                setIsFirstRender(false);
            });
        }
    }, [isFirstRender]);

    // Defensive check before rendering or processing dares
    if (pendingDares.length === 0) {
        return (
            <ImageBackground
                source={require('../assets/redfelt.jpg')}
                style={styles.container}
                fadeDuration={Platform.OS === 'android' ? 300 : 0}
            >
                <StatusBar hidden />
                <View style={styles.feltOverlay} />
                <View style={styles.loadingContainer}>
                    <Animatable.Text 
                        animation="pulse" 
                        iterationCount="infinite" 
                        style={styles.loadingText}
                    >
                        Shuffling cards...
                    </Animatable.Text>
                </View>
            </ImageBackground>
        );
    }

    const handleDareResponse = (completed) => {
        // Ensure currentDare exists and has a player
        const currentDare = pendingDares[currentDareIndex];
        if (!currentDare) {
            console.error('No current dare found');
            return;
        }

        // Validate player exists
        if (!currentDare.player) {
            console.error('Current dare is missing player information');
            return;
        }

        // Update dare status
        updatePendingDareStatus(currentDareIndex, completed);

        // Update completedDares count if the dare was completed
        if (completed) {
            // Get the current player's name
            const currentPlayerName = typeof currentDare.player === 'string' ? 
                currentDare.player : 
                (currentDare.player.name || 'Unknown');
            
            // Find the player's index in the players array
            let playerIndex = -1;
            
            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                const playerName = typeof player === 'string' ? player : player.name;
                
                if (playerName === currentPlayerName) {
                    playerIndex = i;
                    break;
                }
            }
            
            console.log(`Player '${currentPlayerName}' found at index: ${playerIndex}`);
            
            if (playerIndex !== -1) {
                // Create a deep copy of the updatedCompletedDares array
                const newCompletedDares = [...updatedCompletedDares];
                
                // Increment the player's completion count
                if (typeof newCompletedDares[playerIndex] === 'number') {
                    newCompletedDares[playerIndex] += 1;
                } else {
                    // If the value is undefined or not a number, initialize it to 1
                    newCompletedDares[playerIndex] = 1;
                }
                
                console.log(`Updated completedDares for player ${playerIndex}:`, newCompletedDares);
                
                // Update the state
                setUpdatedCompletedDares(newCompletedDares);
            } else {
                console.error(`Could not find player "${currentPlayerName}" in players array`);
            }
        }

        // Animate button press
        Animated.sequence([
            Animated.timing(buttonScale, {
                toValue: 0.95,
                duration: Platform.OS === 'android' ? 70 : 100,
                useNativeDriver: true,
            }),
            Animated.timing(buttonScale, {
                toValue: 1,
                duration: Platform.OS === 'android' ? 70 : 100,
                useNativeDriver: true,
            }),
        ]).start();

        // Determine if there's a next dare
        const hasNextDare = currentDareIndex < pendingDares.length - 1;
        
        if (hasNextDare) {
            // Reset and position the next card (off-screen to the right)
            nextCardPosition.setValue({ x: SCREEN_WIDTH, y: 30 });
            nextCardOpacity.setValue(0);
            nextCardRotation.setValue(15);
            nextCardScale.setValue(0.9);
            
            // Prepare to animate the current card out and the next card in
            
            // 1. First animate current card sliding off to the left (like discarding)
            Animated.parallel([
                Animated.timing(cardPosition, {
                    toValue: { x: -SCREEN_WIDTH - 100, y: 100 },
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic)
                }),
                Animated.timing(cardOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(cardRotation, {
                    toValue: -20,
                    duration: 400, 
                    useNativeDriver: true,
                }),
                Animated.timing(cardShadowOpacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start(() => {
                // After card is gone, increment to next dare
                setCurrentDareIndex(prev => prev + 1);
                
                // Small delay before dealing the next card
                setTimeout(() => {
                    // Swap animation values for smooth transition
                    cardPosition.setValue(nextCardPosition.__getValue());
                    cardOpacity.setValue(nextCardOpacity.__getValue());
                    cardRotation.setValue(nextCardRotation.__getValue());
                    cardScale.setValue(nextCardScale.__getValue());
                    
                    // 2. Then animate the next card coming in from the right (like dealing)
                    Animated.parallel([
                        Animated.timing(cardPosition, {
                            toValue: { x: 0, y: 0 },
                            duration: 600,
                            useNativeDriver: true,
                            easing: Easing.out(Easing.back(1.5))
                        }),
                        Animated.timing(cardOpacity, {
                            toValue: 1,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(cardRotation, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                            easing: Easing.out(Easing.back(1.2))
                        }),
                        Animated.timing(cardScale, {
                            toValue: 1,
                            duration: 600,
                            useNativeDriver: true,
                            easing: Easing.out(Easing.back(1.2))
                        }),
                        Animated.sequence([
                            Animated.delay(300),
                            Animated.spring(cardShadowOpacity, {
                                toValue: 1,
                                friction: 6,
                                useNativeDriver: true
                            })
                        ])
                    ]).start();
                }, 50);
            });
        } else {
            // No more dares, just animate card off screen
            Animated.parallel([
                Animated.timing(cardPosition, {
                    toValue: { x: -SCREEN_WIDTH - 100, y: 100 },
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic)
                }),
                Animated.timing(cardOpacity, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(cardRotation, {
                    toValue: -20,
                    duration: 400,
                    useNativeDriver: true,
                })
            ]).start(() => {
                // Navigate to EndGameScreen with the updated completedDares array
                navigation.replace('EndGameScreen', {
                    packName: packName,
                    completedDares: updatedCompletedDares,
                    players: players.map(p => typeof p === 'string' ? p : p.name)
                });
            });
        }
    };

    const currentDare = pendingDares[currentDareIndex];

    // Add additional null checks
    if (!currentDare) {
        console.error('No current dare found');
        return null;
    }

    // Get player name regardless of whether it's a string or object
    const playerName = typeof currentDare.player === 'string' ? 
        currentDare.player : 
        (currentDare.player?.name || 'Unknown Player');

    // Find player index for current completion count display
    const playerIndex = players.findIndex(p => {
        const pName = typeof p === 'string' ? p : p.name;
        return pName === playerName;
    });

    // Get current completion count for this player (safely)
    const playerCompletionCount = playerIndex !== -1 && playerIndex < updatedCompletedDares.length 
        ? (updatedCompletedDares[playerIndex] || 0) 
        : 0;

    // Card shine effect position
    const shinePosition = cardShineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-150%', '250%'],
    });
    
    // Transform for the card with casino dealer animation
    const cardAnimatedStyle = {
        transform: [
            { translateX: cardPosition.x },
            { translateY: cardPosition.y },
            { rotate: cardRotation.interpolate({
                inputRange: [-20, 0, 20],
                outputRange: ['-20deg', '0deg', '20deg'],
            })},
            { scale: cardScale }
        ],
        opacity: cardOpacity,
    };

    return (
        <ImageBackground
            source={require('../assets/redfelt.jpg')}
            style={styles.container}
            fadeDuration={Platform.OS === 'android' ? 300 : 0}
        >
            <StatusBar hidden />
            <View style={styles.feltOverlay} />
            
            {/* Casino lighting effect */}
            <Animated.View 
                style={[
                    styles.casinoLights,
                    {
                        opacity: casinoLightsAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.2]
                        })
                    }
                ]}
            />
            
            <View style={styles.content}>
                {/* Player name with casino styling */}
                <View style={styles.header}>
                    <Text style={styles.title}>{playerName}</Text>
                    <View style={styles.titleDecoration}>
                        <View style={styles.titleLine} />
                        <Ionicons name="diamond" size={24} color="#FFD700" />
                        <View style={styles.titleLine} />
                    </View>
                </View>
                
                {/* Poker chip showing completion count */}
                <View style={styles.completedDaresBadge}>
                    <Image
                        source={require('../assets/DaresOnly/yellowpokerchip.png')}
                        style={styles.pokerChip}
                        fadeDuration={Platform.OS === 'android' ? 300 : 0}
                    />
                    <Text style={styles.completedDaresText}>
                        {playerCompletionCount}
                    </Text>
                </View>

                {/* Dealer's position (visual indicator where cards come from) */}
                <View style={styles.dealerPosition}>
                    <Animatable.View
                        animation="pulse"
                        iterationCount="infinite"
                        duration={2000}
                        style={styles.dealerIndicator}
                    >
                        <Ionicons name="person" size={20} color="#FFD700" />
                    </Animatable.View>
                </View>

                {/* Card with dare content - with dealer animation */}
                <Animated.View style={[styles.dareContainer, cardAnimatedStyle]}>
                    {/* Card shadow - animated separately for depth effect */}
                    <Animated.View 
                        style={[
                            styles.cardShadow,
                            {
                                opacity: cardShadowOpacity,
                                transform: [
                                    { translateX: cardPosition.x.interpolate({
                                        inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
                                        outputRange: [-10, 0, 10],
                                        extrapolate: 'clamp'
                                    })},
                                    { translateY: cardPosition.y.interpolate({
                                        inputRange: [-100, 0, 100],
                                        outputRange: [-5, 6, 15],
                                        extrapolate: 'clamp'
                                    })}
                                ]
                            }
                        ]} 
                    />
                    
                    <View style={styles.dareCard}>
                        {/* Card shine effect */}
                        <Animated.View 
                            style={[
                                styles.cardShine,
                                {
                                    transform: [{ translateX: shinePosition }]
                                }
                            ]}
                        />
                        
                        {/* Card header */}
                        <View style={styles.cardHeaderContainer}>
                            <Text style={styles.pendingLabel}>PENDING DARE</Text>
                        </View>
                        
                        {/* Dare text */}
                        <View style={styles.dareTextContainer}>
                            <Text 
                                style={styles.dareText}
                                adjustsFontSizeToFit={true}
                                numberOfLines={8}
                                minimumFontScale={0.5}
                            >
                                {currentDare.dare || 'No dare specified'}
                            </Text>
                        </View>

                        {/* Action buttons */}
                        <View style={styles.dareButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.dareButton, styles.completeButton]}
                                onPress={() => handleDareResponse(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="checkmark" size={28} color="white" />
                                <Text style={styles.dareButtonText}>Complete</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.dareButton, styles.incompleteButton]}
                                onPress={() => handleDareResponse(false)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={28} color="white" />
                                <Text style={styles.dareButtonText}>Failed</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                {/* Progress indicator */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBadge}>
                        <Text style={styles.progressText}>
                            {currentDareIndex + 1} / {pendingDares.length}
                        </Text>
                    </View>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    feltOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(28, 115, 51, 0.2)', // Green felt overlay
        opacity: 0.8,
    },
    casinoLights: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFD700', // Gold lights
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: scaleFontSize(40),
        color: '#FFD700', // Gold text
        fontWeight: 'bold',
        marginBottom: 5,
        textAlign: 'center',
        fontFamily: 'Poker',
        ...Platform.select({
            ios: {
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 5,
            },
            android: {
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 3,
                elevation: 3,
            }
        }),
    },
    titleDecoration: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '60%',
        marginBottom: 20,
    },
    titleLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#FFD700',
    },
    completedDaresBadge: {
        position: 'absolute',
        top: 90,
        alignSelf: 'center',
        backgroundColor: 'transparent',
        borderRadius: 20,
        padding: 10,
        marginTop: 5,
        alignItems: 'center',
        zIndex: 10,
    },
    completedDaresText: {
        color: '#000',
        fontSize: 24,
        fontWeight: 'bold',
        position: 'absolute',
        top: '38%',
        left: '53%',
    },
    pokerChip: {
        width: 55,
        height: 55,
        resizeMode: 'contain',
    },
    dealerPosition: {
        position: 'absolute',
        right: 15,
        top: SCREEN_HEIGHT / 2 - 100,
        zIndex: 10,
    },
    dealerIndicator: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    cardShadow: {
        position: 'absolute',
        width: 320,
        height: 420,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        top: 15,
        left: 15,
    },
    dareContainer: {
        backgroundColor: 'transparent',
        borderRadius: 20,
        marginTop: 10,
        zIndex: 5,
        width: 350,
        height: 450,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },
    dareCard: {
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FFD700', // Gold border
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            }
        }),
    },
    cardCorner: {
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
    },
    cardCornerBottom: {
        top: 'auto',
        left: 'auto',
        bottom: 8,
        right: 8,
        transform: [{ rotate: '180deg' }],
    },
    suitContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardCornerText: {
        color: '#000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    cardShine: {
        position: 'absolute',
        width: 40,
        height: '200%',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        transform: [{ rotate: '30deg' }],
    },
    cardHeaderContainer: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 15,
        marginBottom: 10,
    },
    dareTextContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 25,
        width: '100%',
    },
    dareText: {
        color: '#333',
        fontSize: scaleFontSize(32),
        lineHeight: scaleFontSize(40),
        textAlign: 'center',
        fontWeight: 'bold',
        fontFamily: 'standard',
    },
    pendingLabel: {
        backgroundColor: '#FF9800',
        color: 'white',
        fontWeight: 'bold',
        fontSize: scaleFontSize(16),
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFF',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
            },
            android: {
                elevation: 3,
            }
        }),
    },
    dareButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 25,
        marginTop: 10,
    },
    dareButton: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 30,
        width: '45%',
        height: 60, // Reduced height
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.4,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            }
        }),
        borderWidth: 2,
        borderColor: '#FFD700', // Gold border
    },
    completeButton: {
        backgroundColor: '#4CAF50',
    },
    incompleteButton: {
        backgroundColor: '#D32F2F',
    },
    dareButtonText: {
        color: 'white',
        fontSize: scaleFontSize(15),
        fontWeight: 'bold',
        textAlign: 'center',
        width: '100%',
        lineHeight: 22,
    },
    progressContainer: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 48 : 55,
        right: 25,
        zIndex: 10,
    },
    progressBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 15,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#FFD700',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.8,
                shadowRadius: 3,
            },
            android: {
                elevation: 4,
            }
        }),
    },
    progressText: {
        color: '#FFD700',
        fontSize: scaleFontSize(24),
        fontWeight: 'bold',
        textAlign: 'center',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFD700',
        fontSize: scaleFontSize(26),
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'Poker',
        ...Platform.select({
            ios: {
                textShadowColor: 'rgba(0, 0, 0, 0.5)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 3,
            },
            android: {
                textShadowColor: 'rgba(0, 0, 0, 0.5)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
            }
        }),
    }
});

export default PendingDaresScreen;