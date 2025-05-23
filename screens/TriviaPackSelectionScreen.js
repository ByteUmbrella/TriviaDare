import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ImageBackground,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  Platform,
  BackHandler,
  Dimensions,
  TextInput,
  ScrollView,
  Switch,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { 
  TRIVIA_PACKS, 
  checkPackAvailability, 
  getPackStatistics,
  getFeaturedPacks,
  setFeaturedPacksOverride,
  clearFeaturedPacksOverride,
  setBetaMode,
  isBetaMode
} from '../Context/triviaPacks';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { useFirebase } from '../Context/multiplayer/FirebaseContext';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';

// Import the IAP manager and needed constants
import iapManager, { 
  PRODUCT_IDS, 
  PACK_TO_PRODUCT_MAP,
  DARES_TO_PRODUCT_MAP
} from '../Context/IAPManager';

const TriviaPackSelectionScreen = ({ navigation, route }) => {
  // Get screen dimensions for responsive sizing
  const { width: screenWidth } = Dimensions.get('window');
  const itemWidth = (screenWidth - 56) / 2; // 2 columns with 8px margins
  
  // Tab and pack state
  const [selectedPack, setSelectedPack] = useState(null);
  const [activeTab, setActiveTab] = useState('Basic');
  const [packStats, setPackStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [imageCache, setImageCache] = useState({});
  const [loadingImages, setLoadingImages] = useState(true);
  
  // Background music state
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const backgroundMusicRef = useRef(null);
  const [musicVolume, setMusicVolume] = useState(0.5); // Set initial volume to 20%
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  
  // UI state
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [packDetailVisible, setPackDetailVisible] = useState(false);
  const [selectedDetailPack, setSelectedDetailPack] = useState(null);
  
  // Featured section state
  const [featuredSectionCollapsed, setFeaturedSectionCollapsed] = useState(false);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState(true);
  const collapsedFeaturedHeight = 60; // Height when collapsed
  const expandedFeaturedHeight = 140; // Height when expanded
  const featuredHeightValue = useRef(new Animated.Value(expandedFeaturedHeight)).current;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const packImages = useRef({});
  const searchInputRef = useRef(null);
  const flatListRef = useRef(null);
  
  // Premium pack organization states
  const [premiumCategory, setPremiumCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('alphabetical');
  const PACKS_PER_PAGE = 12;
  
  // Access Firebase context for multiplayer integration
  const firebase = useFirebase();
  const isDevMode = firebase?.isDevMode || false;
  
  // Check if we're coming from multiplayer
  const isMultiplayerFlow = route.params?.fromMultiplayer || false;
  
  // Dev mode and beta mode states
  const [devModePacksVisible, setDevModePacksVisible] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [betaMode, setBetaModeState] = useState(false);
  const [featuredPackIds, setFeaturedPackIds] = useState([]);
  
  // Secret long press states for showing question counts
  const [showQuestionCounts, setShowQuestionCounts] = useState(false);
  const longPressTimer = useRef(null);

  // Connect to IAP manager for UI updates after purchases
  useEffect(() => {
    const refreshPacksAfterPurchase = async () => {
      console.log('🔄 Refreshing packs after purchase completion');
      // Wait a moment for the purchase to process fully
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadPackStats();
      
      // Show success message to user
      Alert.alert('Purchase Successful', 'Your purchase was completed successfully!');
    };

    // Set up refresh callback in IAP manager
    if (iapManager) {
      iapManager.onPurchaseComplete = refreshPacksAfterPurchase;
    }
    
    return () => {
      // Clean up
      if (iapManager) {
        iapManager.onPurchaseComplete = null;
      }
    };
  }, []);

  // Initialize IAP manager
  useEffect(() => {
    const initializeIAP = async () => {
      try {
        await iapManager.initialize();
        console.log('✅ IAP manager initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing IAP manager:', error);
      }
    };
    
    initializeIAP();
  }, []);
 
  // Load and play background music
  useEffect(() => {
    let isMounted = true;
    
    const loadBackgroundMusic = async () => {
      try {
        const sound = new Audio.Sound();
        await sound.loadAsync(require('../assets/Sounds/TriviaPackSelectionScreenBackground.mp3'));
        
        // Set initial volume (range: 0 to 1)
        await sound.setVolumeAsync(musicVolume);
        
        // Loop the music
        await sound.setIsLoopingAsync(true);
        
        if (isMounted) {
          backgroundMusicRef.current = sound;
          setBackgroundMusic(sound);
          
          // Start playing
          await sound.playAsync();
        }
      } catch (error) {
        console.error('Error loading background music:', error);
      }
    };
    
    loadBackgroundMusic();
    
    // Clean up when component unmounts
    return () => {
      isMounted = false;
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.stopAsync().catch(() => {});
        backgroundMusicRef.current.unloadAsync().catch(() => {});
        backgroundMusicRef.current = null; // Added this line to clear the reference
      }
      // Clean up long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Add a specific effect to handle modal music
  useEffect(() => {
    if (packDetailVisible && backgroundMusicRef.current) {
      // Add a slight delay to ensure the modal animation is complete
      const resumeTimer = setTimeout(() => {
        backgroundMusicRef.current?.getStatusAsync()
          .then(status => {
            if (status.isLoaded && !status.isPlaying) {
              backgroundMusicRef.current.playAsync().catch(() => {});
            }
          })
          .catch(() => {});
      }, 50);
      
      return () => clearTimeout(resumeTimer);
    }
  }, [packDetailVisible]);

  // Adjust music volume function
  const adjustMusicVolume = async (volume) => {
    setMusicVolume(volume);
    if (backgroundMusicRef.current) {
      await backgroundMusicRef.current.setVolumeAsync(volume);
    }
  };

  // Toggle background music playback
  const toggleBackgroundMusic = async (shouldPlay) => {
    if (backgroundMusicRef.current) {
      if (shouldPlay) {
        await backgroundMusicRef.current.playAsync();
      } else {
        await backgroundMusicRef.current.pauseAsync();
      }
    }
  };

  // Handle Android back button and screen focus changes
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          // If pack detail modal is open, close it instead of going back
          if (packDetailVisible) {
            setPackDetailVisible(false);
            return true;
          }
          // If search is visible, close it instead of going back
          if (isSearchVisible) {
            toggleSearch();
            return true;
          }
          
          // Stop music when going back
          if (backgroundMusicRef.current) {
            backgroundMusicRef.current.stopAsync().catch(() => {});
            backgroundMusicRef.current.unloadAsync().catch(() => {});
            backgroundMusicRef.current = null;
          }
          
          handleBackPress();
          return true;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        
        return () => {
          BackHandler.removeEventListener('hardwareBackPress', onBackPress);
        };
      }
      
      // This runs when the screen loses focus (navigating away)
      return () => {
        if (backgroundMusicRef.current) {
          backgroundMusicRef.current.stopAsync().catch(() => {});
          backgroundMusicRef.current.unloadAsync().catch(() => {});
          backgroundMusicRef.current = null;
        }
      };
    }, [isMultiplayerFlow, packDetailVisible, isSearchVisible])
  );

  // Reset page when tab or category changes
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    // Reset featured section to expanded when changing tabs
    if (featuredSectionCollapsed) {
      toggleFeaturedSection();
    }
  }, [activeTab, premiumCategory]);

  // Preload all pack images with improved Android handling
  useEffect(() => {
    const preloadPackImages = async () => {
      setLoadingImages(true);
      try {
        // Load in batches for Android to prevent OOM errors
        const batchSize = Platform.OS === 'android' ? 4 : 10;
        const packs = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium];
        let cacheResults = {};
        
        for (let i = 0; i < packs.length; i += batchSize) {
          const batchPacks = packs.slice(i, i + batchSize);
          const batchPromises = batchPacks.map(async pack => {
            try {
              // For Android, timeout if image takes too long to load
              const imagePromise = Asset.loadAsync(pack.image);
              
              if (Platform.OS === 'android') {
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Image load timeout')), 5000)
                );
                
                await Promise.race([imagePromise, timeoutPromise]);
              } else {
                await imagePromise;
              }
              
              return { [pack.id]: true };
            } catch (error) {
              console.warn(`Error loading image for pack ${pack.id}:`, error);
              return { [pack.id]: false };
            }
          });

          const batchResults = await Promise.all(batchPromises);
          cacheResults = { ...cacheResults, ...Object.assign({}, ...batchResults) };
        }
        
        setImageCache(cacheResults);
      } catch (error) {
        console.error('Error preloading pack images:', error);
      } finally {
        setLoadingImages(false);
      }
    };

    preloadPackImages();

    return () => {
      // Cleanup loaded images especially important for Android
      if (Platform.OS === 'android') {
        Object.values(packImages.current).forEach(image => {
          if (image && image.unload) {
            image.unload();
          }
        });
      }
    };
  }, []);

  // Initialize beta mode and featured packs
  useEffect(() => {
    const initializeBetaAndFeatured = async () => {
      try {
        // Check beta mode
        const isBetaEnabled = await isBetaMode();
        setBetaModeState(isBetaEnabled);
        
        // Get featured packs
        const featured = await getFeaturedPacks();
        setFeaturedPackIds(featured);
      } catch (error) {
        console.error('Error initializing beta mode and featured packs:', error);
      }
    };
    
    initializeBetaAndFeatured();
  }, []);

  // Initial load with fade animation
  useEffect(() => {
    loadPackStats();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: Platform.OS === 'android' ? 200 : 300, // Slightly faster on Android
      useNativeDriver: true
    }).start();
  }, []);

  // Toggle search bar visibility
  const toggleSearch = () => {
    if (isSearchVisible) {
      // Hide search
      Animated.timing(searchAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        setIsSearchVisible(false);
        setSearchQuery('');
      });
    } else {
      // Show search
      setIsSearchVisible(true);
      Animated.timing(searchAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        searchInputRef.current?.focus();
      });
    }
  };

  // Search input width animation
  const searchInputWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '85%']
  });

  // Handle featured section collapse/expand
  const toggleFeaturedSection = () => {
    setFeaturedSectionCollapsed(prev => !prev);
    
    Animated.timing(featuredHeightValue, {
      toValue: featuredSectionCollapsed ? expandedFeaturedHeight : collapsedFeaturedHeight,
      duration: 250,
      useNativeDriver: false
    }).start();
  };

  // Handle FlatList scroll for auto-collapsing featured section
  const handleScroll = (event) => {
    if (!autoCollapseEnabled || activeTab !== 'Premium') return;
    
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastScrollPosition ? 'down' : 'up';
    
    // Auto-collapse on scroll down, expand on scroll to top
    if (direction === 'down' && currentOffset > 100 && !featuredSectionCollapsed) {
      setFeaturedSectionCollapsed(true);
      Animated.timing(featuredHeightValue, {
        toValue: collapsedFeaturedHeight,
        duration: 250,
        useNativeDriver: false
      }).start();
    } else if (direction === 'up' && currentOffset < 20 && featuredSectionCollapsed) {
      setFeaturedSectionCollapsed(false);
      Animated.timing(featuredHeightValue, {
        toValue: expandedFeaturedHeight,
        duration: 250,
        useNativeDriver: false
      }).start();
    }
    
    setLastScrollPosition(currentOffset);
  };

  // Toggle view mode between grid and list
  const toggleViewMode = () => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  };

  // Handle long press start for showing question counts
  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setShowQuestionCounts(prev => !prev);
      if (Platform.OS === 'ios') {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }, 5000);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Optimized pack statistics loading
  // Optimized pack statistics loading
const loadPackStats = async () => {
  setLoading(true);
  const stats = {};
  const errors = {};
  
  try {
    // Check if we're in production/TestFlight
    const isProductionBuild = !__DEV__;
    console.log('🔒 Production mode active:', isProductionBuild);
    
    // Update beta mode and featured packs when refreshing
    const isBetaEnabled = await isBetaMode();
    setBetaModeState(isBetaEnabled);
    
    const featured = await getFeaturedPacks();
    setFeaturedPackIds(featured);
    
    // Make sure IAP manager is initialized
    if (!iapManager.isInitialized) {
      await iapManager.initialize();
    }
    
    // On Android, load in batches to prevent ANR
    if (Platform.OS === 'android') {
      const allPacks = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium];
      const batchSize = 5;
      
      for (let i = 0; i < allPacks.length; i += batchSize) {
        const batchPacks = allPacks.slice(i, i + batchSize);
        const batchPromises = batchPacks.map(async pack => {
          try {
            const result = await checkPackAvailability(pack);
            
            // Handle premium packs in production builds
            if (isProductionBuild && TRIVIA_PACKS.Premium.some(p => p.id === pack.id)) {
              // For TestFlight/Production, check the actual purchase status
              const isPremiumPack = TRIVIA_PACKS.Premium.some(p => p.id === pack.id);
              
              if (isPremiumPack) {
                // Check if everything bundle is purchased
                const hasBundle = await iapManager.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
                
                // Check if individual pack is purchased
                const isPackPurchased = hasBundle || 
                  (PACK_TO_PRODUCT_MAP[pack.id] && 
                   await iapManager.isPurchased(PACK_TO_PRODUCT_MAP[pack.id]));
                
                // Override the purchase status in the result
                result.purchased = isPackPurchased;
                
                console.log(`Production: pack ${pack.id} purchased:`, result.purchased);
              }
            }
            
            return {
              id: pack.id,
              result,
              errors: result.validationErrors.length > 0 ? result.validationErrors : null
            };
          } catch (error) {
            console.error(`Error checking pack ${pack.id}:`, error);
            return {
              id: pack.id,
              result: { 
                isAvailable: false, 
                stats: { total: 0 },
                // In TestFlight/Production, assume premium packs are not purchased by default
                purchased: false
              },
              errors: ['Failed to load pack']
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ id, result, errors: packErrors }) => {
          stats[id] = result;
          if (packErrors) {
            errors[id] = packErrors;
          }
        });
      }
    } else {
      // Original iOS implementation
      const packPromises = [...TRIVIA_PACKS.Basic, ...TRIVIA_PACKS.Premium].map(async pack => {
        try {
          const result = await checkPackAvailability(pack);
          
          // Handle premium packs in production builds
          if (isProductionBuild && TRIVIA_PACKS.Premium.some(p => p.id === pack.id)) {
            // For TestFlight/Production, check the actual purchase status
            const isPremiumPack = TRIVIA_PACKS.Premium.some(p => p.id === pack.id);
            
            if (isPremiumPack) {
              // Check if everything bundle is purchased
              const hasBundle = await iapManager.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
              
              // Check if individual pack is purchased
              const isPackPurchased = hasBundle || 
                (PACK_TO_PRODUCT_MAP[pack.id] && 
                 await iapManager.isPurchased(PACK_TO_PRODUCT_MAP[pack.id]));
              
              // Override the purchase status
              result.purchased = isPackPurchased;
              
              console.log(`Production: pack ${pack.id} purchased:`, result.purchased);
            }
          }
          
          return {
            id: pack.id,
            result,
            errors: result.validationErrors.length > 0 ? result.validationErrors : null
          };
        } catch (error) {
          console.error(`Error checking pack ${pack.id}:`, error);
          return {
            id: pack.id,
            result: { 
              isAvailable: false, 
              stats: { total: 0 },
              // In TestFlight/Production, assume premium content is not purchased
              purchased: false
            },
            errors: ['Failed to load pack']
          };
        }
      });

      const results = await Promise.all(packPromises);
      
      results.forEach(({ id, result, errors: packErrors }) => {
        stats[id] = result;
        if (packErrors) {
          errors[id] = packErrors;
        }
      });
    }
    
    // Log final purchase states for debugging
    console.log('📊 Final pack stats loaded, premium packs:');
    const premiumPacks = TRIVIA_PACKS.Premium.map(p => p.id);
    premiumPacks.forEach(packId => {
      if (stats[packId]) {
        console.log(`📦 Pack ${packId} purchased: ${stats[packId].purchased}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error loading pack stats:', error);
    Alert.alert('Error', 'Failed to load pack statistics. Please try again.');
  } finally {
    setPackStats(stats);
    setValidationErrors(errors);
    setLoading(false);
  }
};

  // Optimized refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Refresh beta mode
      const isBetaEnabled = await isBetaMode();
      setBetaModeState(isBetaEnabled);
      
      // Refresh featured packs
      const featured = await getFeaturedPacks();
      setFeaturedPackIds(featured);
      
      // Refresh pack stats
      await loadPackStats();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handle back button press based on flow
  const handleBackPress = () => {
    console.log('Pack selection back button pressed, isMultiplayerFlow:', isMultiplayerFlow);
    
    if (isMultiplayerFlow) {
      // If we came from LobbyScreen (which should be the case if fromMultiplayer is true)
      if (route.params?.__fromLobby) {
        console.log('Returning to LobbyScreen with no changes');
        // Just navigate back to the LobbyScreen without any changes
        navigation.goBack();
      } else {
        // If from multiplayer but not specifically from LobbyScreen
        navigation.goBack();
      }
    } else {
      // Normal flow reset to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  };

  // Show pack detail modal
  const showPackDetail = (pack) => {
    // Check current music state
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.getStatusAsync().then(status => {
        const wasPlaying = status.isLoaded && status.isPlaying;
        setSelectedDetailPack(pack);
        setPackDetailVisible(true);
        
        // If music should be playing, ensure it continues after modal animation
        if (wasPlaying) {
          setTimeout(() => {
            if (backgroundMusicRef.current) {
              backgroundMusicRef.current.playAsync().catch(() => {});
            }
          }, 100);
        }
      }).catch(() => {
        // In case of error, just show the modal
        setSelectedDetailPack(pack);
        setPackDetailVisible(true);
      });
    } else {
      // No music reference, just show the modal
      setSelectedDetailPack(pack);
      setPackDetailVisible(true);
    }
  };

  // Close pack detail modal
  const closePackDetail = () => {
    setPackDetailVisible(false);
    
    // Ensure music keeps playing after modal closes
    if (backgroundMusicRef.current) {
      setTimeout(() => {
        if (backgroundMusicRef.current) {
          backgroundMusicRef.current.playAsync().catch(() => {});
        }
      }, 100);
    }
  };

  // Memoized tab change handler with platform-specific animations
  const handleTabChange = useCallback((tab) => {
    const duration = Platform.OS === 'android' ? 100 : 150;
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: duration,
      useNativeDriver: true
    }).start(() => {
      setActiveTab(tab);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: duration,
        useNativeDriver: true
      }).start();
    });
  }, []);

  // Get featured packs based on featuredPackIds
  const actualFeaturedPacks = useMemo(() => {
    if (!featuredPackIds || !featuredPackIds.length) {
      // Fallback to manually featured packs if rotation is not loaded yet
      return TRIVIA_PACKS.Premium.filter(pack => pack.featured || pack.isPopular).slice(0, 5);
    }
    
    // Get packs based on the IDs from the rotation system
    return featuredPackIds
      .map(id => TRIVIA_PACKS.Premium.find(pack => pack.id === id))
      .filter(Boolean); // Filter out any undefined values
  }, [featuredPackIds, TRIVIA_PACKS.Premium]);

  // Filter and sort packs based on current settings
  const filteredPacks = useMemo(() => {
    let packs = TRIVIA_PACKS[activeTab];
    
    // Apply category filter for Premium packs
    if (activeTab === 'Premium' && premiumCategory !== 'All') {
      packs = packs.filter(pack => 
        pack.category === premiumCategory || 
        (pack.tags && pack.tags.includes(premiumCategory))
      );
    }
    
    // Apply search query filter
    if (searchQuery.trim() !== '') {
      packs = packs.filter(pack => 
        pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pack.tags && pack.tags.some(tag => 
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
    }
    
    // Apply sorting - Modified to always put purchased packs first
    if (sortBy === 'alphabetical') {
      packs = [...packs].sort((a, b) => {
        // First sort by purchase status
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        // Then sort alphabetically
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'questions') {
      packs = [...packs].sort((a, b) => {
        // First sort by purchase status
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        // Then sort by question count
        const aCount = packStats[a.id]?.stats?.total || 0;
        const bCount = packStats[b.id]?.stats?.total || 0;
        return bCount - aCount;
      });
    } else if (sortBy === 'newest') {
      packs = [...packs].sort((a, b) => {
        // First sort by purchase status
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        // Then sort by date
        const aDate = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
        const bDate = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
        return bDate - aDate;
      });
    } else if (sortBy === 'featured') {
      packs = [...packs].sort((a, b) => {
        // First sort by purchase status
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        // Then sort by featured status
        const aFeatured = featuredPackIds.includes(a.id);
        const bFeatured = featuredPackIds.includes(b.id);
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'purchased') {
      // Put purchased packs first
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        return a.name.localeCompare(b.name); // Alphabetical within groups
      });
    }
    
    return packs;
  }, [TRIVIA_PACKS, activeTab, premiumCategory, searchQuery, sortBy, packStats, featuredPackIds]);

  // Get paginated packs for infinite scrolling
  const paginatedPacks = useMemo(() => {
    const endIndex = currentPage * PACKS_PER_PAGE;
    return filteredPacks.slice(0, endIndex);
  }, [filteredPacks, currentPage]);

  // Enhanced pack selection handler with direct IAP integration
  const handleSelectPack = async (pack) => {
    // Set as selected pack for admin controls
    setSelectedPack(pack);
    
    // Check if this is a premium pack that needs to be unlocked
    const isPremium = TRIVIA_PACKS.Premium.some(p => p.id === pack.id);
    const isUnlocked = packStats[pack.id]?.purchased || false;
    
    if (isPremium && !isUnlocked && !betaMode && !isDevMode) {
      console.log('🛒 Initiating purchase for pack:', pack.id);
      
      try {
        // First determine if this is a trivia pack or a dares pack to get correct product ID
        let productId = null;
        
        // Look in trivia packs first
        if (PACK_TO_PRODUCT_MAP[pack.id]) {
          productId = PACK_TO_PRODUCT_MAP[pack.id];
        } 
        // Then check dares packs
        else if (DARES_TO_PRODUCT_MAP[pack.id]) {
          productId = DARES_TO_PRODUCT_MAP[pack.id];
        }
        
        if (!productId) {
          console.error('❌ No product ID found for pack:', pack.id);
          Alert.alert('Error', 'Could not find product information for this pack.');
          return;
        }
        
        // Show purchase confirmation
        Alert.alert(
          `Purchase ${pack.name}`,
          `Would you like to purchase this premium pack for ${pack.defaultPrice || '$3.99'}?`,
          [
            {
              text: "Cancel",
              style: "cancel"
            },
            {
              text: "Purchase",
              onPress: async () => {
                try {
                  // Show loading indicator
                  setLoading(true);
                  
                  console.log('🛒 Requesting purchase for product:', productId);
                  // This will trigger the native purchase dialog on iOS/Android
                  const success = await iapManager.purchaseProduct(productId);
                  
                  if (success) {
                    console.log('✅ Purchase initiated successfully');
                    // UI will refresh after purchase completes via the callback we set up
                  } else {
                    console.log('⚠️ Purchase not initiated');
                  }
                } catch (error) {
                  console.error('❌ Purchase initiation error:', error);
                  Alert.alert('Error', 'Failed to start purchase. Please try again.');
                } finally {
                  setLoading(false);
                }
              }
            }
          ]
        );
        return;
      } catch (error) {
        console.error('❌ Purchase setup error:', error);
        Alert.alert('Error', 'There was a problem setting up the purchase. Please try again.');
        return;
      }
    }
    
    // Skip validation in dev mode if dev packs are visible
    if (!isDevMode && validationErrors[pack.id]?.length > 0) {
      Alert.alert(
        "Pack Validation Errors",
        `This pack has some issues:\n\n${validationErrors[pack.id].join('\n')}`,
        [{ text: "OK" }]
      );
      return;
    }
   
    try {
      const stats = await getPackStatistics(pack.id);
      // Skip empty pack validation in dev mode
      if (!isDevMode && stats.total === 0) {
        Alert.alert(
          "Pack Not Available",
          "This pack doesn't have any questions yet.",
          [{ text: "OK" }]
        );
        return;
      }
   
      // Fade out animation before navigation - with different durations for Android
      const animationDuration = Platform.OS === 'android' ? 150 : 200;
      
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true
      }).start(() => {
        // Check if we're coming from multiplayer flow
        if (isMultiplayerFlow) {
          // Check if we came from LobbyScreen specifically (via our custom flag)
          const cameFromLobby = route.params?.__fromLobby;
          console.log("Multiplayer flow detected, came from lobby:", cameFromLobby);
          
          // FIREBASE INTEGRATION: Use Firebase context for multiplayer
          if (firebase && firebase.currentRoom) {
            // Add console logs to track the data flow
            console.log('[TriviaPackSelectionScreen] Updating Firebase with pack:', {
              id: pack.id,
              name: pack.name,
              displayName: pack.displayName || pack.name
            });
            
            // If we have a Firebase room, update game state with selected pack
            firebase.updateGameState({
              gameData: {
                ...firebase.gameState?.gameData,
                packName: pack.name,
                packId: pack.id,
                packDisplayName: pack.displayName || pack.name
              }
            }).then(() => {
              console.log('[TriviaPackSelectionScreen] Firebase update successful');
              
              // Force a delay to ensure Firebase data is propagated before navigation
              setTimeout(() => {
                if (cameFromLobby) {
                  // If we came from lobby, use navigate instead of goBack
                  console.log('[TriviaPackSelectionScreen] Returning to Lobby with updated pack:', pack.id, pack.name);
                  
                  // Use proper navigation with parameters to ensure the LobbyScreen updates correctly
                  navigation.navigate('LobbyScreen', {
                    selectedPack: pack.id,
                    packName: pack.displayName || pack.name,
                    fromPackSelection: true,
                    _timestamp: Date.now() // Add unique timestamp to force params update
                  });
                } else {
                  // Normal navigation to lobby with the selected pack
                  navigation.navigate('LobbyScreen', {
                    selectedPack: pack.name,
                    packName: pack.displayName || pack.name,
                    backgroundMusic: backgroundMusicRef.current
                  });
                }
              }, 300); // Add a small delay to ensure Firebase update is processed
            }).catch(error => {
              console.error('[TriviaPackSelectionScreen] Error updating Firebase:', error);
              Alert.alert('Error', 'Failed to update game with selected pack. Please try again.');
              
              // Even if Firebase update fails, still navigate back with the pack data
              if (cameFromLobby) {
                navigation.navigate('LobbyScreen', {
                  selectedPack: pack.id,
                  packName: pack.displayName || pack.name,
                  fromPackSelection: true,
                  _timestamp: Date.now()
                });
              }
            });
          }
          // Legacy Bluetooth support for backward compatibility
          else if (bluetooth) {
            bluetooth.setSelectedPack(pack.name);
            bluetooth.setPackName(pack.displayName || pack.name);
            
            // Make sure we retrieve the current player name from bluetooth context
            const currentPlayerName = bluetooth.playerName;
            
            if (cameFromLobby) {
              // If we came from lobby, use navigate instead of goBack
              navigation.navigate('LobbyScreen', {
                selectedPack: pack.id,
                packName: pack.displayName || pack.name,
                fromPackSelection: true,
                _timestamp: Date.now()
              });
            } else {
              // Navigate to lobby with the selected pack for multiplayer
              // Pass playerName explicitly to ensure it's preserved
              navigation.navigate('LobbyScreen', {
                isHost: true,
                selectedPack: pack.name,
                packName: pack.displayName || pack.name,
                playerName: currentPlayerName, // Explicitly pass the player name
                backgroundMusic: backgroundMusicRef.current // Pass the music reference
              });
            }
          } else {
            
            if (cameFromLobby) {
              // Use navigate instead of goBack
              navigation.navigate('LobbyScreen', {
                selectedPack: pack.id,
                packName: pack.displayName || pack.name,
                fromPackSelection: true,
                _timestamp: Date.now()
              });
            } else {
              navigation.navigate('LobbyScreen', {
                selectedPack: pack.name,
                packName: pack.displayName || pack.name
              });
            }
          }
        } else {
          // Original single-player flow with Android-optimized navigation
          const navigationConfig = Platform.OS === 'android' 
            ? { animationEnabled: true } // Enable animations on Android for smoother transitions
            : { animationEnabled: false, detachInactiveScreens: false }; // iOS original config
            
          navigation.navigate('GameConfirmation', {
            selectedPack: pack.name,
            navigationConfig,
            backgroundMusic: backgroundMusicRef.current // Pass the music reference
          });
        }
      });
    } catch (error) {
      console.error('Error selecting pack:', error);
      Alert.alert('Error', 'Failed to load pack. Please try again.');
    }
  };
   
  // Render category chip for premium categories
  const renderCategoryChip = useCallback((category, label, icon) => (
    <TouchableOpacity 
      style={[
        styles.categoryChip,
        premiumCategory === category && styles.categoryChipActive
      ]}
      onPress={() => setPremiumCategory(category)}
      key={category}
    >
      {icon && (
        <Ionicons 
          name={icon} 
          size={14} 
          color={premiumCategory === category ? '#FFFFFF' : '#FFD700'} 
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[
        styles.categoryChipText,
        premiumCategory === category && styles.categoryChipTextActive
      ]}>{label}</Text>
    </TouchableOpacity>
  ), [premiumCategory]);
   
  // Compact featured pack item for wider display
  // Compact featured pack item for wider display
const renderCompactFeaturedPack = useCallback((pack) => {
  const packStat = packStats[pack.id];
  const totalQuestions = packStat?.stats?.total || 0;
  const isFeatured = featuredPackIds.includes(pack.id);
  const isPurchased = packStat?.purchased || false;
  
  return (
    <TouchableOpacity 
      key={pack.id}
      style={[
        styles.compactFeaturedPack,
        { width: (Dimensions.get('window').width / 2) - 28 }, // Calculate width here
        isFeatured && styles.compactFeaturedPackHighlighted,
        isPurchased && { borderColor: '#00C853', borderWidth: 1.5 } // Green border for purchased
      ]}
      onPress={() => showPackDetail(pack)}
      onLongPress={() => setSelectedPack(pack)}
    >
    <ImageBackground 
      source={pack.image} 
      style={styles.compactFeaturedPackImage}
      imageStyle={{ resizeMode: 'cover' }}
    >
      <View style={styles.compactFeaturedPackOverlay} />
      
      {/* Purchased indicator */}
      {isPurchased && (
        <View style={styles.compactFeaturedPackPurchased}>
          <Ionicons name="checkmark" size={14} color="white" />
        </View>
      )}
      
      {/* Featured star */}
      {isFeatured && (
        <View style={styles.compactFeaturedStar}>
          <Ionicons name="star" size={16} color="black" />
        </View>
      )}
      
      <View style={styles.compactFeaturedTextContainer}>
        <Text 
          style={styles.compactFeaturedPackName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {pack.name}
        </Text>
        {/* Conditionally show question count based on showQuestionCounts state */}
        {totalQuestions > 0 && showQuestionCounts && (
          <Text style={styles.compactFeaturedPackQuestions}>
            {totalQuestions} Q
          </Text>
        )}
      </View>
    </ImageBackground>
  </TouchableOpacity>
  );
}, [packStats, featuredPackIds, showQuestionCounts]);
   
  // Render pack item in grid or list mode
 // Render pack item in grid or list mode
const renderPackItem = useCallback(({ item }) => {
  const packStat = packStats[item.id];
  const isDisabled = (devModePacksVisible && isDevMode) ? 
    false : 
    !packStat?.isAvailable || !item.enabled;
  
  const hasErrors = validationErrors[item.id]?.length > 0;
  const totalQuestions = packStat?.stats?.total || 0;
  const isPremium = activeTab === 'Premium';
  const isFeatured = featuredPackIds.includes(item.id);
  const isPurchased = packStat?.purchased || false;
  
  // Add extra logging for premium packs
  if (isPremium) {
    console.log(`Premium pack ${item.name} (${item.id}):`, {
      purchased: isPurchased,
      isLocked: !isPurchased,
      productId: PACK_TO_PRODUCT_MAP[item.id]
    });
  }
  
  // Show price in dev mode or if not purchased and not in beta mode
  const showPrice = isDevMode || (isPremium && !isPurchased && !betaMode);
 
  // Grid view render
  if (viewMode === 'grid') {
    return (
      <TouchableOpacity 
        style={[
          styles.packItem,
          { width: itemWidth },
          isDisabled && styles.disabledPack,
          hasErrors && !isDevMode && styles.errorPack,
          isFeatured && styles.featuredPackItem, // Special border for featured packs
          isPurchased && styles.purchasedPackItem // Add special styling for purchased packs
        ]}
        onPress={() => !isDisabled && showPackDetail(item)}
        onLongPress={() => setSelectedPack(item)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <ImageBackground 
          source={item.image} 
          style={styles.imageBackground}
          fadeDuration={Platform.OS === 'android' ? 300 : 0}
          imageStyle={{ resizeMode: 'cover' }}
        >
          <View style={styles.overlay} />
          <View style={styles.textGradient} />
          
          <View style={styles.packTextContainer}>
            <Text 
              style={styles.packText}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.7}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
          </View>

          {/* Purchased checkmark indicator */}
          {isPurchased && (
            <View style={styles.purchasedCheckmark}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          )}
          
          {/* Conditionally show question count based on showQuestionCounts state */}
          {packStat && packStat.isAvailable && showQuestionCounts && (
            <View style={styles.packStatsContainer}>
              <Text style={styles.questionCountText}>
                {`${totalQuestions} Questions`}
              </Text>
            </View>
          )}
 
          {/* Error indicator */}
          {hasErrors && !isDevMode && (
            <View style={styles.errorIndicator}>
              <Ionicons name="warning" size={24} color="#ff4500" />
            </View>
          )}
 
          {/* Coming soon badge */}
          {isDisabled && !hasErrors && !isDevMode && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          )}
          
          {/* Show price for non-purchased packs OR in dev mode */}
          {isPremium && showPrice && (
            <View style={styles.priceTagContainer}>
              <Text style={styles.priceTagText}>{item.defaultPrice || '$3.99'}</Text>
            </View>
          )}
          
          {/* Use a lock icon overlay for premium, non-purchased packs */}
          {isPremium && !isPurchased && !betaMode && !isDevMode && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={40} color="#FFD700" />
            </View>
          )}
          
          {/* Featured star indicator */}
          {isFeatured && (
            <View style={styles.featuredStarIndicator}>
              <Ionicons name="star" size={16} color="#FFD700" />
            </View>
          )}
          
          {/* Category badge if applicable */}
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
          )}
          
        </ImageBackground>
      </TouchableOpacity>
    );
  }
  // List view render - similar updates as above
  else {
    return (
      <TouchableOpacity 
        style={[
          styles.packItemList,
          isDisabled && styles.disabledPack,
          hasErrors && !isDevMode && styles.errorPackList,
          isFeatured && styles.featuredPackItemList,
          isPurchased && styles.purchasedPackItemList
        ]}
        onPress={() => !isDisabled && showPackDetail(item)}
        onLongPress={() => setSelectedPack(item)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {/* Pack Thumbnail */}
        <ImageBackground 
          source={item.image} 
          style={styles.listThumbnail}
          imageStyle={{ borderRadius: 8 }}
        >
          <View style={styles.thumbnailOverlay} />
          
          {/* Lock icon overlay for premium, non-purchased packs */}
          {isPremium && !isPurchased && !betaMode && !isDevMode && (
            <View style={styles.thumbnailLockOverlay}>
              <Ionicons name="lock-closed" size={24} color="#FFD700" />
            </View>
          )}
          
          {isFeatured && (
            <View style={styles.featuredIndicatorList}>
              <Ionicons name="star" size={16} color="black" />
            </View>
          )}
          
          {/* Purchased indicator for list view */}
          {isPurchased && (
            <View style={styles.purchasedIndicatorList}>
              <Text style={styles.purchasedIndicatorText}>OWNED</Text>
            </View>
          )}
        </ImageBackground>
        
        {/* Pack Info */}
        <View style={styles.packInfoList}>
          <Text 
            style={styles.packNameList}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
          
          <View style={styles.packMetaList}>
            {item.category && (
              <View style={styles.categoryBadgeList}>
                <Text style={styles.categoryBadgeTextList}>{item.category}</Text>
              </View>
            )}
            
            {/* Conditionally show question count in list view */}
            {packStat && packStat.isAvailable && showQuestionCounts && (
              <Text style={styles.questionCountTextList}>
                {`${totalQuestions} Q`}
              </Text>
            )}
          </View>
        </View>
        
        {/* Indicators */}
        <View style={styles.listIndicators}>
          {/* Price tag for premium packs - show in dev mode or if not purchased */}
          {isPremium && showPrice && (
            <View style={styles.priceTagList}>
              <Text style={styles.priceTagTextList}>{item.defaultPrice || '$3.99'}</Text>
            </View>
          )}
          
          {item.isNew && (
            <View style={styles.newIndicatorList}>
              <Text style={styles.newIndicatorTextList}>NEW</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }
}, [packStats, validationErrors, devModePacksVisible, isDevMode, itemWidth, activeTab, betaMode, featuredPackIds, viewMode, showQuestionCounts]);
   
  // Function to render header for the FlatList
  const renderListHeader = useCallback(() => {
    if (activeTab !== 'Premium' || isSearchVisible) return null;
    
    return (
      <View style={styles.premiumControls}>
        {/* Category Chips with Icons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {renderCategoryChip('All', 'All Packs', 'apps')}
          {renderCategoryChip('TV', 'TV Shows', 'tv')}
          {renderCategoryChip('Movies', 'Movies', 'film')}
          {renderCategoryChip('Games', 'Video Games', 'game-controller')}
          {renderCategoryChip('Books', 'Books', 'book')}
          {renderCategoryChip('Other', 'Other', 'ellipsis-horizontal-circle')}
        </ScrollView>
        
        {/* Sorting Controls */}
        <View style={styles.sortContainer}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortButtonsContainer}
          >
            <TouchableOpacity 
              style={[styles.sortButton, sortBy === 'alphabetical' && styles.sortButtonActive]}
              onPress={() => setSortBy('alphabetical')}
            >
              <Text style={[
                styles.sortButtonText, 
                sortBy === 'alphabetical' && styles.sortButtonTextActive
              ]}>A-Z</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortButton, sortBy === 'questions' && styles.sortButtonActive]}
              onPress={() => setSortBy('questions')}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === 'questions' && styles.sortButtonTextActive
              ]}>Questions</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortButton, sortBy === 'newest' && styles.sortButtonActive]}
              onPress={() => setSortBy('newest')}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === 'newest' && styles.sortButtonTextActive
              ]}>Newest</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortButton, sortBy === 'purchased' && styles.sortButtonActive]}
              onPress={() => setSortBy('purchased')}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === 'purchased' && styles.sortButtonTextActive
              ]}>Purchased</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      
        {/* Featured Packs Section - Animated Collapsible */}
        <Animated.View style={[styles.featuredSection, { height: featuredHeightValue }]}>
          <TouchableOpacity 
            style={styles.featuredHeader}
            onPress={toggleFeaturedSection}
            activeOpacity={0.8}
          >
            <Text style={styles.featuredTitle}>Featured Packs</Text>
            <Ionicons 
              name={featuredSectionCollapsed ? "chevron-down" : "chevron-up"} 
              size={20} 
              color="#FFD700" 
            />
          </TouchableOpacity>
          
          {!featuredSectionCollapsed && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScrollContent}
            >
              {actualFeaturedPacks.map(pack => renderCompactFeaturedPack(pack))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    );
  }, [
    activeTab, 
    premiumCategory, 
    sortBy, 
    featuredSectionCollapsed, 
    featuredHeightValue, 
    actualFeaturedPacks,
    isSearchVisible
  ]);
   
  const renderListFooter = useCallback(() => {
  // First check if the everything bundle is already purchased
  const isEverythingBundlePurchased = packStats[PRODUCT_IDS.EVERYTHING_BUNDLE]?.purchased || false;
  
  // Only show the Everything Bundle in the Premium tab and when not searching
  if (activeTab !== 'Premium' || searchQuery.trim() !== '') {
    return paginatedPacks.length < filteredPacks.length ? (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator color="#00ff00" size="small" />
        <Text style={styles.loadMoreText}>Loading more packs...</Text>
      </View>
    ) : (filteredPacks.length === 0 ? (
      <View style={styles.noResultsContainer}>
        <Ionicons name="search-outline" size={40} color="#FFD700" />
        <Text style={styles.noResultsText}>No packs found</Text>
        <Text style={styles.noResultsSubText}>Try a different search or category</Text>
      </View>
    ) : (
      <View style={styles.endOfListContainer}>
        <Text style={styles.endOfListText}>You've seen all available packs</Text>
      </View>
    ));
  }
  
  return (
    <View style={styles.everythingBundleContainer}>
      {/* First render loading indicator or end of list message if applicable */}
      {paginatedPacks.length < filteredPacks.length && (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator color="#00ff00" size="small" />
          <Text style={styles.loadMoreText}>Loading more packs...</Text>
        </View>
      )}
      
      {/* Then render the Everything Bundle button IF not already purchased */}
      {!isEverythingBundlePurchased ? (
        <TouchableOpacity 
          style={styles.everythingBundleButton}
          onPress={() => {
            // Show purchase confirmation alert
            Alert.alert(
              "Purchase Everything Bundle",
              "Get unlimited access to all premium packs including future releases for just $49.99. This is a one-time purchase.",
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Purchase",
                  onPress: async () => {
                    try {
                      // Show loading indicator
                      setLoading(true);
                      
                      console.log('🛒 Initiating Everything Bundle purchase');
                      await iapManager.purchaseProduct(PRODUCT_IDS.EVERYTHING_BUNDLE);
                      // Purchase result handled by listener
                    } catch (error) {
                      console.error('❌ Bundle purchase error:', error);
                      Alert.alert('Error', 'There was a problem with your purchase. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  }
                }
              ]
            );
          }}
          activeOpacity={0.8}
        >
          <ImageBackground 
            source={require('../assets/gameshow.jpg')} // Using existing background image
            style={styles.bundleBackground}
            imageStyle={{ borderRadius: 15 }}
          >
            <View style={styles.bundleOverlay} />
            <View style={styles.bundleContent}>
              <View style={styles.bundleTitleContainer}>
                <Text style={styles.bundleTitle}>EVERYTHING BUNDLE</Text>
                <Text style={styles.bundleSubtitle}>All Premium Packs + Future Updates</Text>
              </View>
              
              <View style={styles.bundlePriceContainer}>
                <Text style={styles.bundlePrice}>$49.99</Text>
                <Text style={styles.bundleSavings}>Save over 80%</Text>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      ) : (
        // For users who already purchased the bundle, show a "thank you" message
        <View style={styles.everythingBundlePurchasedContainer}>
          <View style={styles.bundlePurchasedContent}>
            <Ionicons name="checkmark-circle" size={40} color="#00C853" />
            <Text style={styles.bundlePurchasedTitle}>ALL PACKS UNLOCKED</Text>
            <Text style={styles.bundlePurchasedText}>
              Thank you for your purchase! You have access to all current and future packs.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}, [activeTab, paginatedPacks, filteredPacks, searchQuery, packStats]);
   
  // Updated render function with improved header and space-saving features
  return (
    <ImageBackground 
      source={require('../assets/gameshow.jpg')} 
      style={styles.container}
      fadeDuration={Platform.OS === 'android' ? 300 : 0}
    >
      {loading || loadingImages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator 
            size="large" 
            color="#00ff00"
            style={Platform.OS === 'android' ? { transform: [{ scale: 1.2 }] } : undefined} 
          />
          <Text style={styles.loadingText}>
            {loadingImages ? "Loading Images..." : "Loading Trivia Packs..."}
          </Text>
        </View>
      ) : (
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Fixed Header with back button, title, and search/view icons */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={28} color="#FFD700" />
            </TouchableOpacity>
            
            {!isSearchVisible ? (
              // Title when search is not visible
              <View style={styles.headerTitleContainer}>
                <TouchableOpacity 
                  onPressIn={handleLongPressStart}
                  onPressOut={handleLongPressEnd}
                  onTouchCancel={handleLongPressEnd}
                  activeOpacity={1}
                >
                  <Text 
                    style={styles.headerTitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.8}
                  >
                    Trivia Packs
                  </Text>
                  {betaMode && (
                    <Text style={styles.betaBadgeText}>BETA MODE</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // Animated search input when search is visible
              <Animated.View 
                style={[
                  styles.searchInputAnimated,
                  { width: searchInputWidth }
                ]}
              >
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInputExpanded}
                  placeholder="Search packs..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoFocus={true}
                />
                {searchQuery !== '' && (
                  <TouchableOpacity 
                    style={styles.clearSearchButton}
                    onPress={() => setSearchQuery('')}
                  >
                    <Ionicons name="close-circle" size={20} color="#FFD700" />
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
            
            {/* Header Action Buttons */}
            <View style={styles.headerActions}>
              {/* Search button */}
              <TouchableOpacity 
                style={[
                  styles.headerIconButton,
                  isSearchVisible && styles.headerIconButtonActive
                ]}
                onPress={toggleSearch}
              >
                <Ionicons 
                  name={isSearchVisible ? "close" : "search"} 
                  size={24} 
                  color="#FFD700" 
                />
              </TouchableOpacity>
              
              {/* View mode toggle (grid/list) */}
              <TouchableOpacity 
                style={styles.headerIconButton}
                onPress={toggleViewMode}
              >
                <Ionicons 
                  name={viewMode === 'grid' ? "list" : "grid-outline"} 
                  size={24} 
                  color="#FFD700" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {isDevMode && showDevMode && (
            <View style={styles.devModeContainer}>
              <Text style={styles.devModeContainerText}>
                Development Mode Active
              </Text>
              <TouchableOpacity 
                style={styles.devModeButton}
                onPress={() => setDevModePacksVisible(!devModePacksVisible)}
              >
                <Text style={styles.devModeButtonText}>
                  {devModePacksVisible ? 'Hide Dev Packs' : 'Show Dev Packs'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          
          {/* Enhanced Tab Selection with Indicators */}
          <View style={styles.tabContainerWrapper}>
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[
                  styles.tabButton,
                  activeTab === 'Basic' ? styles.activeTabButton : {}
                ]}
                onPress={() => handleTabChange('Basic')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'Basic' ? styles.activeTabText : {}
                ]}>Basic Packs</Text>
                {activeTab === 'Basic' && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.tabButton,
                  activeTab === 'Premium' ? styles.activeTabButton : {}
                ]}
                onPress={() => handleTabChange('Premium')}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'Premium' ? styles.activeTabText : {}
                ]}>Premium Packs</Text>
                {activeTab === 'Premium' && <View style={styles.tabIndicator} />}
                
                {/* Add a "MORE" badge to draw attention to Premium tab */}
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>MORE</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
   
          {/* Pack Grid/List with Infinite Scrolling */}
          <FlatList
            ref={flatListRef}
            data={paginatedPacks}
            keyExtractor={(item) => `${activeTab}-${item.id}`}
            renderItem={renderPackItem}
            numColumns={viewMode === 'grid' ? 2 : 1}
            key={viewMode === 'grid' ? 'grid' : 'list'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#00ff00"
                colors={["#00ff00"]}
                progressBackgroundColor={Platform.OS === 'android' ? '#222222' : undefined}
              />
            }
            initialNumToRender={Platform.OS === 'android' ? 4 : 6}
            maxToRenderPerBatch={Platform.OS === 'android' ? 2 : 4}
            windowSize={Platform.OS === 'android' ? 5 : 7}
            removeClippedSubviews={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              searchQuery && { paddingTop: 10 } // Add padding when searching
            ]}
            onEndReached={() => {
              if (paginatedPacks.length < filteredPacks.length) {
                setCurrentPage(prev => prev + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={renderListHeader}
            onScroll={handleScroll}
            scrollEventThrottle={16} // For smooth scroll handling
            ListFooterComponent={renderListFooter}
            ListEmptyComponent={() => (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={40} color="#FFD700" />
                <Text style={styles.noResultsText}>No packs found</Text>
                <Text style={styles.noResultsSubText}>Try a different search or category</Text>
              </View>
            )}
          />
          
          {/* Pack Detail Modal */}
<Modal
  transparent={true}
  visible={packDetailVisible}
  onRequestClose={closePackDetail}
  animationType="none"
  hardwareAccelerated={true}
  presentationStyle="overFullScreen"
>
  <TouchableOpacity 
    style={styles.modalBackground}
    activeOpacity={1}
    onPress={closePackDetail}
  >
    <TouchableWithoutFeedback>
      <View style={styles.packDetailContainer}>
        {selectedDetailPack && (
          <>
            {/* Modal Header with Title and Close Button */}
            <View style={styles.packDetailHeader}>
              <Text style={styles.packDetailTitle}>
                {selectedDetailPack.name}
              </Text>
              <TouchableOpacity onPress={closePackDetail}>
                <Ionicons name="close" size={24} color="#FFD700" />
              </TouchableOpacity>
            </View>
            
            {/* Purchased badge - added at top level for visibility */}
            {packStats[selectedDetailPack.id]?.purchased && (
              <View style={{
                position: 'absolute',
                top: 15,
                right: 15,
                backgroundColor: '#00C853',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                zIndex: 10,
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 'bold',
                }}>PURCHASED</Text>
              </View>
            )}
            
            {/* Pack Image */}
            <ImageBackground 
              source={selectedDetailPack.image}
              style={styles.packDetailImage}
              imageStyle={{ borderRadius: 10 }}
            >
              <View style={styles.packDetailOverlay} />
              
              {/* Category Badge */}
              {selectedDetailPack.category && (
                <View style={styles.packDetailCategory}>
                  <Text style={styles.packDetailCategoryText}>
                    {selectedDetailPack.category}
                  </Text>
                </View>
              )}
              
              {/* Price Badge for Premium Packs */}
              {TRIVIA_PACKS.Premium.some(p => p.id === selectedDetailPack.id) && 
               !packStats[selectedDetailPack.id]?.purchased && 
               !betaMode && 
               !isDevMode && (
                <View style={styles.packDetailPrice}>
                  <Text style={styles.packDetailPriceText}>
                    {selectedDetailPack.defaultPrice || '$3.99'}
                  </Text>
                </View>
              )}
              
              {/* Featured indicator */}
              {featuredPackIds.includes(selectedDetailPack.id) && (
                <View style={styles.packDetailFeatured}>
                  <Ionicons name="star" size={18} color="black" />
                </View>
              )}
            </ImageBackground>
            
            {/* Pack Description and Stats */}
            <View style={styles.packDetailInfo}>
              <Text style={styles.packDetailDescription}>
                {selectedDetailPack.description || 
                  `Test your knowledge with this exciting ${selectedDetailPack.category || 'trivia'} pack! Challenge your friends or play solo.`
                }
              </Text>
              
              {/*<View style={styles.packDetailStats}>
                <View style={styles.packDetailStat}>
                  <Ionicons name="help-circle" size={20} color="#00ff00" />
                  <Text style={styles.packDetailStatText}>
                    {(packStats[selectedDetailPack.id]?.stats?.total || 0)} Questions
                  </Text>
                </View>
                
                {selectedDetailPack.difficulty && (
                  <View style={styles.packDetailStat}>
                    <Ionicons name="trending-up" size={20} color="#FFD700" />
                    <Text style={styles.packDetailStatText}>
                      {selectedDetailPack.difficulty} Difficulty
                    </Text>
                  </View>
                )}
              </View> */}
            </View>
            
            {/* Action Buttons: Purchase or Play */}
            {TRIVIA_PACKS.Premium.some(p => p.id === selectedDetailPack.id) && 
             !packStats[selectedDetailPack.id]?.purchased && 
             !betaMode && 
             !isDevMode ? (
              <TouchableOpacity 
                style={styles.purchasePackButton}
                onPress={() => {
                  closePackDetail();
                  
                  // Get the product ID
                  let productId = null;
                  if (PACK_TO_PRODUCT_MAP[selectedDetailPack.id]) {
                    productId = PACK_TO_PRODUCT_MAP[selectedDetailPack.id];
                  } else if (DARES_TO_PRODUCT_MAP[selectedDetailPack.id]) {
                    productId = DARES_TO_PRODUCT_MAP[selectedDetailPack.id];
                  }
                  
                  if (!productId) {
                    console.error('❌ No product ID found for pack:', selectedDetailPack.id);
                    Alert.alert('Error', 'Could not find product information.');
                    return;
                  }
                  
                  // Show purchase confirmation
                  Alert.alert(
                    `Purchase ${selectedDetailPack.name}`,
                    `Would you like to purchase this premium pack for ${selectedDetailPack.defaultPrice || '$3.99'}?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      { 
                        text: "Purchase", 
                        onPress: async () => {
                          try {
                            setLoading(true);
                            await iapManager.purchaseProduct(productId);
                            // Purchase result will be handled by the listener
                          } catch (error) {
                            console.error('❌ Purchase error:', error);
                            Alert.alert('Error', 'There was a problem with your purchase. Please try again.');
                          } finally {
                            setLoading(false);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.purchasePackButtonText}>Purchase</Text>
                <Ionicons name="pricetag" size={24} color="white" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.playPackButton,
                  // Add a green tint to the play button for purchased packs
                  packStats[selectedDetailPack.id]?.purchased && {
                    borderColor: '#00C853',
                    borderWidth: 2,
                  }
                ]}
                onPress={() => {
                  // Make sure music plays first before closing modal
                  if (backgroundMusicRef.current) {
                    backgroundMusicRef.current.playAsync().catch(() => {});
                  }
                  
                  // Use setTimeout to ensure audio has time to resume
                  setTimeout(() => {
                    closePackDetail();
                    handleSelectPack(selectedDetailPack);
                  }, 50);
                }}
              >
                <Text style={styles.playPackButtonText}>
                  {packStats[selectedDetailPack.id]?.purchased ? "Start Game" : "Play Free Pack"}
                </Text>
                <Ionicons name="play" size={24} color="black" />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </TouchableWithoutFeedback>
  </TouchableOpacity>
</Modal>
        </Animated.View>
      )}
    </ImageBackground>
  );
};

 const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)', // Lightened from 0.5
    paddingTop: Platform.OS === 'android' ? 30 : 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    position: 'relative',
    height: 50,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 60,
  },
  headerTitle: {
    fontSize: Platform.OS === 'android' ? 24 : 26,
    color: '#FFD700',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
    letterSpacing: 1,
    textAlign: 'center',
  },
  betaBadgeText: {
    color: '#00C853',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  headerActions: {
    flexDirection: 'row',
    position: 'absolute',
    right: 0,
    zIndex: 10,
  },
  headerIconButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginLeft: 10,
  },
  headerIconButtonActive: {
    backgroundColor: 'rgba(0, 180, 0, 0.6)',
  },
  
  // Search Styles
  searchInputAnimated: {
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    borderWidth: 1, 
    borderColor: '#FFD700',
    paddingHorizontal: 15,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  searchInputExpanded: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    height: '100%',
  },
  clearSearchButton: {
    padding: 5,
  },
  // Tab Styles
  tabContainerWrapper: {
    marginBottom: 20,
    marginTop: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Platform.OS === 'android' ? 12 : 14,
    position: 'relative',
    borderRadius: 20,
  },
  activeTabButton: {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
  },
  tabText: {
    fontSize: Platform.OS === 'android' ? 18 : 20,
    color: 'white',
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  activeTabText: {
    color: '#00ff00',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -3,
    width: '50%',
    height: 3,
    backgroundColor: '#00ff00',
    borderRadius: 1.5,
  },
  newBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: '#FF4500',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Premium Controls Styles
  premiumControls: {
    marginBottom: 10,
  },
 
  // Category Chip Styles
  categoryScrollContent: {
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  categoryChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(0, 180, 0, 0.7)',
    borderColor: 'white',
  },
  categoryChipText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  categoryChipTextActive: {
    color: 'white',
  },
  
  // Sort Controls
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  sortLabel: {
    color: 'white',
    fontSize: 14,
    marginRight: 10,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sortButtonsContainer: {
    flexDirection: 'row',
    paddingRight: 10,
  },
  sortButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  sortButtonActive: {
    backgroundColor: 'rgba(0, 186, 0, 0.8)',
    borderColor: 'white',
  },
  sortButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  sortButtonTextActive: {
    color: 'white',
  },
  
  // Featured Packs Styles
  featuredSection: {
    marginBottom: 5,
    overflow: 'hidden',
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 8,
  },
  featuredTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  featuredScrollContent: {
    paddingLeft: 5,
    paddingRight: 5,
    paddingBottom: 10,
  },
  
  compactFeaturedPack: {
    width: '45%',
    height: 95,
    marginRight: 11,
    marginBottom: 5,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  compactFeaturedPackHighlighted: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  compactFeaturedPackImage: {
    width: '100%',
    height: '100%',
  },
  compactFeaturedPackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Lightened from 0.5
  },
  compactFeaturedStar: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 12,
    padding: 3,
  },
  compactFeaturedTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Lightened from 0.7
  },
  compactFeaturedPackName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 1,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  compactFeaturedPackQuestions: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Load more section
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadMoreText: {
    color: '#00ff00',
    marginLeft: 10,
    fontSize: 16,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Empty results state
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  noResultsText: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  noResultsSubText: {
    color: 'white',
    fontSize: 16,
    marginTop: 5,
    textAlign: 'center',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // End of list
  endOfListContainer: {
    padding: 20,
    alignItems: 'center',
  },
  endOfListText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontStyle: 'italic',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Purchased pack styles for grid view
purchasedPackItem: {
  borderColor: '#00C853', // Bright green border
  borderWidth: 2,
  shadowColor: '#00C853',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 5,
  elevation: 6,
},

// Purchased pack styles for list view
purchasedPackItemList: {
  borderLeftColor: '#00C853', // Green left border for list view
  borderLeftWidth: 3,
},

// Checkmark badge for grid view purchased packs
purchasedCheckmark: {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,200,83,0.9)',
  borderRadius: 12,
  width: 24, 
  height: 24,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3,
},

// "OWNED" badge for list view purchased packs
purchasedIndicatorList: {
  position: 'absolute',
  top: 10,
  right: 10,
  backgroundColor: '#00C853',
  paddingHorizontal: 6,
  paddingVertical: 3,
  borderRadius: 4,
  zIndex: 2,
},
purchasedIndicatorText: {
  color: 'white',
  fontSize: 10,
  fontWeight: 'bold',
},

// Featured pack purchased indicator
compactFeaturedPackPurchased: {
  position: 'absolute',
  top: 8,
  right: 8,
  backgroundColor: 'rgba(0,200,83,0.9)',
  borderRadius: 10,
  width: 20, 
  height: 20,
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3,
},

// Detail modal purchased badge
packDetailPurchasedBadge: {
  position: 'absolute',
  top: 15,
  right: 15,
  backgroundColor: '#00C853',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
  zIndex: 10,
},
packDetailPurchasedText: {
  color: 'white',
  fontSize: 12,
  fontWeight: 'bold',
},
  
  // Grid view styles
  listContent: {
    paddingBottom: 20,
  },
  packItem: {
    flex: 0.5,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)', // Increased brightness
    height: 160, // Increased from 140 for better text display
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  disabledPack: {
    opacity: 0.6,
  },
  errorPack: {
    borderColor: '#ff4500',
    borderWidth: 3,
  },
  featuredPackItem: {
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  purchasedPackItem: {
    borderColor: '#00C853',
    borderWidth: 2,
  },
  imageBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lightened from 0.4
  },
  textGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Lightened from 0.7
  },
  packTextContainer: {
    position: 'absolute',
    bottom: 15, // Moved up a bit more to give more room
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6, // Reduced padding
    minHeight: 50, // Increased minimum height
  },
  packText: {
    color: 'white',
    fontSize: Platform.OS === 'android' ? 16 : 18, // Keep consistent size
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 6, // Slightly reduced padding
    paddingVertical: 4,
    width: '100%',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flexWrap: 'wrap',
    lineHeight: 20, // Better line height for 2 lines
    maxHeight: 50, // Increased to accommodate 2 lines better
    numberOfLines: 2, // Explicitly allow 2 lines
  },
  packStatsContainer: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
  },
  questionCountText: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  comingSoonBadge: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 69, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  comingSoonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  errorIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 5,
    borderRadius: 15,
  },
  premiumIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  betaUnlockedIndicator: {
    position: 'absolute',
    top: 5,
    right: 35,
    backgroundColor: 'rgba(0, 200, 83, 0.8)',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: 'white',
  },
  categoryBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0, 0, 155, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  categoryBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  featuredStarIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  priceTagContainer: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  priceTagText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },

  everythingBundlePurchasedContainer: {
  marginTop: 10,
  marginBottom: 30,
  marginHorizontal: 16,
  borderRadius: 15,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  overflow: 'hidden',
  padding: 20,
  borderWidth: 2,
  borderColor: '#00C853',
  shadowColor: '#00C853',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 5,
},

bundlePurchasedContent: {
  alignItems: 'center',
  padding: 10,
},

bundlePurchasedTitle: {
  color: '#00C853',
  fontSize: 22,
  fontWeight: 'bold',
  marginTop: 10,
  marginBottom: 8,
  textAlign: 'center',
},

bundlePurchasedText: {
  color: 'white',
  fontSize: 16,
  textAlign: 'center',
  marginTop: 5,
  lineHeight: 22,
},
  
  // List view styles
  packItemList: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    margin: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  errorPackList: {
    borderColor: '#ff4500',
    borderWidth: 2,
  },
  featuredPackItemList: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  purchasedPackItemList: {
    borderColor: '#00C853',
    borderWidth: 2,
  },
  listThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
  },
  // In your styles object
lockOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3,
},
thumbnailLockOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 3,
  borderRadius: 8,
},
  featuredIndicatorList: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    borderRadius: 12,
    padding: 3,
  },
  packInfoList: {
    flex: 1,
    justifyContent: 'center',
  },
  packNameList: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  packMetaList: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  categoryBadgeList: {
    backgroundColor: 'rgba(0, 0, 155, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  categoryBadgeTextList: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  questionCountTextList: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listIndicators: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  priceTagList: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'white',
  },
  priceTagTextList: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  newIndicatorList: {
    backgroundColor: '#ff4500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'white',
  },
  newIndicatorTextList: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  // Dev mode specific styles
  devModeContainer: {
    backgroundColor: 'rgba(255, 153, 0, 0.2)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FF9800',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  devModeContainerText: {
    color: '#FF9800',
    fontWeight: 'bold',
    flex: 1,
  },
  devModeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  devModeButtonText: {
    color: '#FFFFFF'
  },
  // Pack detail modal styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  packDetailContainer: {
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    width: '85%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      }
    }),
  },
  packDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  packDetailTitle: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    paddingRight: 10,
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  packDetailImage: {
    height: 150,
    width: '100%',
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
  },
  packDetailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  packDetailCategory: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 155, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'white',
  },
  packDetailCategoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  packDetailPrice: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'white',
  },
  packDetailPriceText: {
    color: '#1A237E',
    fontSize: 16,
    fontWeight: 'bold',
  },
  packDetailFeatured: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'white',
  },
  packDetailInfo: {
    marginBottom: 20,
  },
  packDetailDescription: {
    color: 'white',
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
  },
  packDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 10,
  },
  packDetailStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packDetailStatText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  playPackButton: {
    flexDirection: 'row',
    backgroundColor: '#00ff00',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  playPackButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  purchasePackButton: {
    flexDirection: 'row',
    backgroundColor: '#1A237E',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  purchasePackButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  // Everything Bundle styles
  everythingBundleContainer: {
    paddingHorizontal: 8,
    marginBottom: 20,
    marginTop: 15,
  },
  everythingBundleButton: {
    width: '100%',
    height: 120,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      }
    }),
  },
  bundleBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  bundleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bundleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  bundleTitleContainer: {
    flex: 1,
  },
  bundleTitle: {
    color: '#FFD700',
    fontSize: 26,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  bundleSubtitle: {
    color: 'white',
    fontSize: 16,
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bundlePriceContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  bundlePrice: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bundleSavings: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
 });
 
 export default TriviaPackSelectionScreen;