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
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useGame } from '../Context/GameContext';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const PendingDaresScreen = ({ navigation, route }) => {
    const { pendingDares, updatePendingDareStatus, scores, setScores, players } = useGame();
    const [currentDareIndex, setCurrentDareIndex] = useState(0);
    const buttonScale = useRef(new Animated.Value(1)).current;
    const { packName, completedDares } = route.params || {};
    const [updatedCompletedDares, setUpdatedCompletedDares] = useState([...(completedDares || [])]);
    const [flipped, setFlipped] = useState(true);
    const [isFirstRender, setIsFirstRender] = useState(true);
    const flipAnim = useRef(new Animated.Value(1)).current;

    // Debug log to track the state
    useEffect(() => {
        console.log("Current completedDares:", completedDares);
        console.log("Current updatedCompletedDares:", updatedCompletedDares);
        console.log("Current players:", players);
    }, [completedDares, updatedCompletedDares, players]);

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

    // Animation for initial card appearance
    useEffect(() => {
        if (isFirstRender) {
            Animated.spring(flipAnim, {
                toValue: 1,
                tension: 40,
                friction: 8,
                useNativeDriver: true,
            }).start();
            setIsFirstRender(false);
        }
    }, [isFirstRender, flipAnim]);

    // Defensive check before rendering or processing dares
    if (pendingDares.length === 0) {
        return (
            <ImageBackground
                source={require('../assets/redfelt.jpg')}
                style={styles.container}
                fadeDuration={Platform.OS === 'android' ? 300 : 0}
            >
                <StatusBar hidden />
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
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

        // Set flipped to false to hide the card
        setFlipped(false);

        // Use animation to flip the card out
        Animated.spring(flipAnim, {
            toValue: 0,
            tension: 40,
            friction: Platform.OS === 'android' ? 6 : 8,
            useNativeDriver: true,
        }).start(() => {
            // After animation completes, move to next dare or navigate
            if (currentDareIndex < pendingDares.length - 1) {
                setCurrentDareIndex(prev => prev + 1);
                setFlipped(true);
                // Reset the flip animation
                flipAnim.setValue(0);
                // Show the next card with animation
                Animated.spring(flipAnim, {
                    toValue: 1,
                    tension: 40,
                    friction: Platform.OS === 'android' ? 6 : 8,
                    useNativeDriver: true,
                }).start();
            } else {
                // Log the final state before navigation
                console.log("Final updatedCompletedDares before navigation:", updatedCompletedDares);
                
                // Navigate to EndGameScreen with the updated completedDares array
                navigation.replace('EndGameScreen', {
                    packName: packName,
                    completedDares: updatedCompletedDares,
                    players: players.map(p => typeof p === 'string' ? p : p.name)
                });
            }
        });
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

    const frontAnimatedStyle = {
        transform: [
            { 
                scale: flipAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                })
            },
            {
                rotateY: flipAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['-90deg', '0deg']
                })
            }
        ],
        opacity: flipAnim
    };

    return (
        <ImageBackground
            source={require('../assets/redfelt.jpg')}
            style={styles.container}
            fadeDuration={Platform.OS === 'android' ? 300 : 0}
        >
            <StatusBar hidden />
            <View style={styles.content}>
                <Text style={styles.title}>{playerName}</Text>
                
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

                <Animated.View style={[styles.dareContainer, frontAnimatedStyle]}>
                    <View style={styles.dareCard}>
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

                        <Text style={styles.pendingLabel}>PENDING DARE</Text>

                        <View style={styles.dareButtonsContainer}>
                            <TouchableOpacity
                                style={[styles.dareButton, styles.completeButton]}
                                onPress={() => handleDareResponse(true)}
                                activeOpacity={0.7}
                            >
                                <Icon name="check" size={24} color="white" />
                                <Text style={styles.dareButtonText}>Completed</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.dareButton, styles.incompleteButton]}
                                onPress={() => handleDareResponse(false)}
                                activeOpacity={0.7}
                            >
                                <Icon name="times" size={24} color="white" />
                                <Text style={styles.dareButtonText}>Failed</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                <View style={styles.progressContainer}>
                    <Text style={styles.progressText}>
                        {currentDareIndex + 1} / {pendingDares.length}
                    </Text>
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        alignItems: 'center',
    },
    title: {
        fontSize: Platform.OS === 'android' ? 36 : 40,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 75,
        textAlign: 'center',
        ...Platform.select({
            android: {
                elevation: 3, // Add elevation for better visibility on dark backgrounds
            }
        }),
    },
    completedDaresBadge: {
        position: 'absolute',
        top: 80,
        alignSelf: 'center',
        backgroundColor: 'transparent',
        borderRadius: 20,
        padding: 10,
        marginTop: 10,
        alignItems: 'center',
    },
    completedDaresText: {
        color: '#000',
        fontSize: 25,
        fontWeight: 'bold',
        position: 'absolute',
        top: '40%',
        left: '55%',
    },
    pokerChip: {
        width: 50,
        height: 50,
        resizeMode: 'contain',
    },
    dareContainer: {
        backgroundColor: 'rgba(255, 255, 255, 1)',
        borderRadius: 20,
        padding: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.8,
                shadowRadius: 2,
            },
            android: {
                elevation: 8,
            }
        }),
        width: 375,
        height: 475,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        backfaceVisibility: 'hidden',
    },
    dareCard: {
        width: '100%',
        height: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
    },
    dareTextContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
        width: '100%',
    },
    dareText: {
        color: '#333',
        fontSize: Platform.OS === 'android' ? 40 : 45,
        lineHeight: Platform.OS === 'android' ? 44 : 48,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    pendingLabel: {
        backgroundColor: '#FFA500',
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        padding: 8,
        borderRadius: 5,
        marginBottom: 20,
        ...Platform.select({
            android: {
                elevation: 3,
            }
        }),
    },
    dareButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        paddingHorizontal: 15,
        marginBottom: 20,
        marginTop: 10,
    },
    dareButton: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 20,
        width: '40%',
        height: 80,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            }
        }),
        borderWidth: 2,
        borderColor: '#fff',
    },
    completeButton: {
        backgroundColor: '#4CAF50',
    },
    incompleteButton: {
        backgroundColor: '#f44336',
    },
    dareButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 5,
    },
    progressContainer: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 15,
        padding: 10,
        ...Platform.select({
            android: {
                elevation: 3,
            }
        }),
    },
    progressText: {
        color: 'white',
        fontSize: Platform.OS === 'android' ? 22 : 24,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        ...Platform.select({
            ios: {
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
            },
            android: {
                textShadowColor: 'rgba(0, 0, 0, 0.4)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 1,
            }
        }),
    }
});

export default PendingDaresScreen;