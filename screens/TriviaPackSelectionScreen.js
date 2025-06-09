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
  Image,
} from 'react-native';
import { 
  TRIVIA_PACKS, 
  checkPackAvailability, 
  getPackStatistics,
  getFeaturedPacks,
  setFeaturedPacksOverride,
  clearFeaturedPacksOverride,
  setBetaMode,
  isBetaMode,
  // NEW: Import promo-integrated functions
  shouldShowPack,
  isPackPurchased
} from '../Context/triviaPacks';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import { useFirebase } from '../Context/multiplayer/FirebaseContext';
import { useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ACHIEVEMENT TRACKER IMPORT
import { achievementTracker } from '../Context/AchievementTracker';

import iapManager, { 
  PRODUCT_IDS, 
  PACK_TO_PRODUCT_MAP,
  DARES_TO_PRODUCT_MAP
} from '../Context/IAPManager';

const TriviaPackSelectionScreen = ({ navigation, route }) => {
  const { width: screenWidth } = Dimensions.get('window');
  const itemWidth = (screenWidth - 56) / 2;
  
  // NEW: Extract gameMode from route params
  const { players, gameMode } = route.params || {};
  
  const [selectedPack, setSelectedPack] = useState(null);
  const [activeTab, setActiveTab] = useState('Basic');
  const [packStats, setPackStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [imageCache, setImageCache] = useState({});
  const [loadingImages, setLoadingImages] = useState(true);
  
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const backgroundMusicRef = useRef(null);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [packDetailVisible, setPackDetailVisible] = useState(false);
  const [selectedDetailPack, setSelectedDetailPack] = useState(null);
  
  const [featuredSectionCollapsed, setFeaturedSectionCollapsed] = useState(false);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);
  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState(true);
  const collapsedFeaturedHeight = 60;
  const expandedFeaturedHeight = 140;
  const featuredHeightValue = useRef(new Animated.Value(expandedFeaturedHeight)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const packImages = useRef({});
  const searchInputRef = useRef(null);
  const flatListRef = useRef(null);
  
  const [premiumCategory, setPremiumCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('alphabetical');
  const PACKS_PER_PAGE = 12;
  
  // NEW: Add visible packs state for promo integration
  const [visiblePacks, setVisiblePacks] = useState({
    Basic: [],
    Premium: []
  });
  
  const firebase = useFirebase();
  const isDevMode = firebase?.isDevMode || false;
  
  const isMultiplayerFlow = route.params?.fromMultiplayer || false;
  
  const [devModePacksVisible, setDevModePacksVisible] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [betaMode, setBetaModeState] = useState(false);
  const [featuredPackIds, setFeaturedPackIds] = useState([]);
  
  const [showQuestionCounts, setShowQuestionCounts] = useState(false);
  const longPressTimer = useRef(null);

  // SIMPLIFIED PURCHASE STATE - Track which packs are being purchased
  const [purchasingPacks, setPurchasingPacks] = useState(new Set());
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);

  // Toast system
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const showToastMessage = useCallback((message, duration = 3000) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, duration);
  }, []);

  // Initialize IAP silently on mount
  useEffect(() => {
    const initializeIAP = async () => {
      try {
        console.log('🛒 Initializing IAP silently...');
        await iapManager.initializeSilently();
        console.log('✅ IAP manager initialized silently');
      } catch (error) {
        console.log('⚠️ Silent IAP initialization failed:', error.message);
        // Don't show error - just log it
      }
    };
    
    initializeIAP();
  }, []);

  // Load pack statistics and setup
  useEffect(() => {
    loadPackStats();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: Platform.OS === 'android' ? 200 : 300,
      useNativeDriver: true
    }).start();
  }, []);

  // Background music and cleanup
  useEffect(() => {
    let isMounted = true;
    
    const loadBackgroundMusic = async () => {
      try {
        const sound = new Audio.Sound();
        await sound.loadAsync(require('../assets/Sounds/TriviaPackSelectionScreenBackground.mp3'));
        
        await sound.setVolumeAsync(musicVolume);
        await sound.setIsLoopingAsync(true);
        
        if (isMounted) {
          backgroundMusicRef.current = sound;
          setBackgroundMusic(sound);
          await sound.playAsync();
        }
      } catch (error) {
        console.error('Error loading background music:', error);
      }
    };
    
    loadBackgroundMusic();
    
    return () => {
      isMounted = false;
      if (backgroundMusicRef.current) {
        backgroundMusicRef.current.stopAsync().catch(() => {});
        backgroundMusicRef.current.unloadAsync().catch(() => {});
        backgroundMusicRef.current = null;
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // NEW: Image preloading with promo-aware filtering
  useEffect(() => {
    const preloadPackImages = async () => {
      setLoadingImages(true);
      try {
        const batchSize = Platform.OS === 'android' ? 4 : 10;
        
        // NEW: Use promo-aware pack filtering
        const basicPacks = [];
        const premiumPacks = [];
        
        // Check visibility for each pack
        for (const pack of TRIVIA_PACKS.Basic) {
          const shouldShow = await shouldShowPack(pack.id);
          if (shouldShow) {
            basicPacks.push(pack);
          }
        }
        
        for (const pack of TRIVIA_PACKS.Premium) {
          const shouldShow = await shouldShowPack(pack.id);
          if (shouldShow) {
            premiumPacks.push(pack);
          }
        }
        
        // Update visible packs state
        setVisiblePacks({
          Basic: basicPacks,
          Premium: premiumPacks
        });
        
        const allVisiblePacks = [...basicPacks, ...premiumPacks];
        let cacheResults = {};
        
        for (let i = 0; i < allVisiblePacks.length; i += batchSize) {
          const batchPacks = allVisiblePacks.slice(i, i + batchSize);
          const batchPromises = batchPacks.map(async pack => {
            try {
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
  }, []);

  // Beta mode and featured packs initialization
  useEffect(() => {
    const initializeBetaAndFeatured = async () => {
      try {
        const isBetaEnabled = await isBetaMode();
        setBetaModeState(isBetaEnabled);
        
        const featured = await getFeaturedPacks();
        setFeaturedPackIds(featured);
      } catch (error) {
        console.error('Error initializing beta mode and featured packs:', error);
      }
    };
    
    initializeBetaAndFeatured();
  }, []);

  // Back handler
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          if (packDetailVisible) {
            setPackDetailVisible(false);
            return true;
          }
          if (isSearchVisible) {
            toggleSearch();
            return true;
          }
          if (showPurchaseDialog) {
            setShowPurchaseDialog(false);
            return true;
          }
          
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
    }, [isMultiplayerFlow, packDetailVisible, isSearchVisible, showPurchaseDialog])
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
    if (featuredSectionCollapsed) {
      toggleFeaturedSection();
    }
  }, [activeTab, premiumCategory]);

  // NEW: Updated loadPackStats with promo integration
  const loadPackStats = async () => {
    setLoading(true);
    const stats = {};
    const errors = {};
    
    try {
      console.log('📊 Loading pack statistics with promo integration...');
      
      const isProductionBuild = !__DEV__;
      const isBetaEnabled = await isBetaMode();
      setBetaModeState(isBetaEnabled);
      
      const featured = await getFeaturedPacks();
      setFeaturedPackIds(featured);
      
      // Ensure IAP is initialized before checking purchases
      if (!iapManager.isInitialized) {
        await iapManager.initializeSilently();
      }
      
      // Check Everything Bundle purchase status first
      const bundlePurchased = await iapManager.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
      console.log('🎁 Everything Bundle purchased:', bundlePurchased);
      
      // NEW: Get all packs including hidden ones, then filter by visibility
      const allBasicPacks = TRIVIA_PACKS.Basic;
      const allPremiumPacks = TRIVIA_PACKS.Premium;
      
      const visibleBasicPacks = [];
      const visiblePremiumPacks = [];
      
      // Check visibility for Basic packs
      for (const pack of allBasicPacks) {
        const shouldShow = await shouldShowPack(pack.id);
        if (shouldShow) {
          visibleBasicPacks.push(pack);
        }
      }
      
      // Check visibility for Premium packs
      for (const pack of allPremiumPacks) {
        const shouldShow = await shouldShowPack(pack.id);
        if (shouldShow) {
          visiblePremiumPacks.push(pack);
        }
      }
      
      // Update visible packs state
      setVisiblePacks({
        Basic: visibleBasicPacks,
        Premium: visiblePremiumPacks
      });
      
      const allVisiblePacks = [...visibleBasicPacks, ...visiblePremiumPacks];
      console.log('👀 Visible packs after promo filtering:', allVisiblePacks.map(p => p.id));
      
      if (Platform.OS === 'android') {
        const batchSize = 5;
        
        for (let i = 0; i < allVisiblePacks.length; i += batchSize) {
          const batchPacks = allVisiblePacks.slice(i, i + batchSize);
          const batchPromises = batchPacks.map(async pack => {
            try {
              // NEW: Use promo-integrated checkPackAvailability and isPackPurchased
              const result = await checkPackAvailability(pack);
              const isUnlocked = await isPackPurchased(pack.id);
              
              // Override with promo-aware purchase status
              result.purchased = isUnlocked;
              
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
        const packPromises = allVisiblePacks.map(async pack => {
          try {
            // NEW: Use promo-integrated checkPackAvailability and isPackPurchased
            const result = await checkPackAvailability(pack);
            const isUnlocked = await isPackPurchased(pack.id);
            
            // Override with promo-aware purchase status
            result.purchased = isUnlocked;
            
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
      
      // Add Everything Bundle to packStats
      stats[PRODUCT_IDS.EVERYTHING_BUNDLE] = {
        purchased: bundlePurchased,
        isAvailable: true,
        stats: { total: 0 }
      };
      
      console.log('✅ Pack statistics loaded successfully with promo integration');
      console.log('🎁 Everything Bundle in stats:', stats[PRODUCT_IDS.EVERYTHING_BUNDLE]);
      
    } catch (error) {
      console.error('❌ Error loading pack stats:', error);
      Alert.alert('Error', 'Failed to load pack statistics. Please try again.');
    } finally {
      setPackStats(stats);
      setValidationErrors(errors);
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      const isBetaEnabled = await isBetaMode();
      setBetaModeState(isBetaEnabled);
      
      const featured = await getFeaturedPacks();
      setFeaturedPackIds(featured);
      
      await loadPackStats();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // UPDATED: Enhanced purchase handling with achievement tracking
  const handlePurchase = async (pack) => {
    console.log('🛒 Starting purchase for pack:', pack.id);
    
    let productId = null;
    if (PACK_TO_PRODUCT_MAP[pack.id]) {
      productId = PACK_TO_PRODUCT_MAP[pack.id];
    } else if (DARES_TO_PRODUCT_MAP[pack.id]) {
      productId = DARES_TO_PRODUCT_MAP[pack.id];
    }
    
    if (!productId) {
      console.error('❌ No product ID found for pack:', pack.id);
      Alert.alert('Error', 'Could not find product information for this pack.');
      return;
    }
    
    const product = iapManager.getProductById(productId);
    if (!product) {
      console.error('❌ Product not found in store:', productId);
      Alert.alert('Product Unavailable', 'This pack is temporarily unavailable. Please try again later.');
      return;
    }
    
    // Show confirmation dialog
    setPendingProduct({
      ...pack,
      productId,
      price: product.localizedPrice,
      storeTitle: product.title
    });
    setShowPurchaseDialog(true);
  };

  // UPDATED: Enhanced confirmPurchase with achievement tracking
  const confirmPurchase = async () => {
    if (!pendingProduct) return;
    
    setShowPurchaseDialog(false);
    
    // Add pack to purchasing set
    setPurchasingPacks(prev => new Set(prev).add(pendingProduct.id));
    showToastMessage(`Starting purchase for ${pendingProduct.name}...`);
    
    try {
      // Use the new callback-based purchase method
      await iapManager.purchaseProductWithCallback(pendingProduct.productId, async (result) => {
        console.log('🛒 Purchase completed:', result);
        
        // Remove from purchasing set
        setPurchasingPacks(prev => {
          const newSet = new Set(prev);
          newSet.delete(pendingProduct.id);
          return newSet;
        });

        if (result.success) {
          console.log('✅ Purchase successful, tracking achievement...');
          showToastMessage('🎉 Purchase successful!');
          
          try {
            // ACHIEVEMENT TRACKING: Track pack purchase
            console.log('🏆 Tracking pack purchase achievement for:', pendingProduct.id);
            await achievementTracker.trackPackPurchase(pendingProduct.id);
            console.log('🏆 Pack purchase achievement tracked successfully');
          } catch (achievementError) {
            console.error('❌ Failed to track pack purchase achievement:', achievementError);
            // Don't show error to user - achievement tracking shouldn't break the flow
          }
          
          // Refresh pack stats to show the pack as purchased
          setTimeout(() => {
            loadPackStats();
          }, 1000);
          
        } else if (!result.cancelled) {
          console.error('❌ Purchase failed:', result.error);
          showToastMessage(`Purchase failed: ${result.error}`);
        }
        // If cancelled, do nothing - user cancelled intentionally
      });

    } catch (error) {
      console.error('❌ Purchase initiation failed:', error);
      
      // Remove from purchasing set on error
      setPurchasingPacks(prev => {
        const newSet = new Set(prev);
        newSet.delete(pendingProduct.id);
        return newSet;
      });
      
      showToastMessage('Failed to start purchase. Please try again.');
    } finally {
      setPendingProduct(null);
    }
  };

  const isPurchasing = (packId) => {
    return purchasingPacks.has(packId);
  };

  // UPDATED: Everything Bundle purchase with achievement tracking
  const handleEverythingBundlePurchase = () => {
    console.log('💎 Everything Bundle purchase initiated');
    
    const bundleProduct = iapManager.getProductById(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (bundleProduct) {
      setPendingProduct({
        id: 'everything_bundle',
        name: 'Everything Bundle',
        productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
        price: bundleProduct.localizedPrice,
        storeTitle: bundleProduct.title,
        description: 'All Premium Packs + Future Updates',
        image: require('../assets/gameshow.jpg')
      });
      setShowPurchaseDialog(true);
    } else {
      Alert.alert(
        "Purchase Everything Bundle",
        "Get unlimited access to all premium packs including future releases for just $49.99. This is a one-time purchase.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Purchase",
            onPress: async () => {
              setPurchasingPacks(prev => new Set(prev).add('everything_bundle'));
              showToastMessage("Starting Everything Bundle purchase...");
              
              try {
                await iapManager.purchaseProductWithCallback(PRODUCT_IDS.EVERYTHING_BUNDLE, async (result) => {
                  setPurchasingPacks(prev => {
                    const newSet = new Set(prev);
                    newSet.delete('everything_bundle');
                    return newSet;
                  });

                  if (result.success) {
                    showToastMessage('🎉 Everything Bundle purchased successfully!');
                    
                    try {
                      // ACHIEVEMENT TRACKING: Track Everything Bundle purchase
                      console.log('🏆 Tracking Everything Bundle purchase achievement...');
                      await achievementTracker.trackPackPurchase('everything_bundle');
                      console.log('🏆 Everything Bundle purchase achievement tracked successfully');
                    } catch (achievementError) {
                      console.error('❌ Failed to track bundle purchase achievement:', achievementError);
                      // Don't show error to user - achievement tracking shouldn't break the flow
                    }
                    
                    // Force immediate refresh for bundle purchase
                    setTimeout(async () => {
                      console.log('🔄 Refreshing pack stats after bundle purchase...');
                      await loadPackStats();
                    }, 500);
                  } else if (!result.cancelled) {
                    showToastMessage(`Bundle purchase failed: ${result.error}`);
                  }
                });
              } catch (error) {
                console.error('❌ Bundle purchase error:', error);
                setPurchasingPacks(prev => {
                  const newSet = new Set(prev);
                  newSet.delete('everything_bundle');
                  return newSet;
                });
                showToastMessage('Bundle purchase failed. Please try again.');
              }
            }
          }
        ]
      );
    }
  };

  // UPDATED: Pack selection handler with gameMode support and achievement tracking
  const handleSelectPack = async (pack) => {
    setSelectedPack(pack);
    
    // NEW: No longer need special themepark handling - let promo system handle it
    const isPremium = TRIVIA_PACKS.Premium.some(p => p.id === pack.id);
    const isUnlocked = await isPackPurchased(pack.id); // Use promo-integrated function
    
    if (isPremium && !isUnlocked && !betaMode && !isDevMode) {
      handlePurchase(pack);
      return;
    }
    
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
      if (!isDevMode && stats.total === 0) {
        Alert.alert(
          "Pack Not Available",
          "This pack doesn't have any questions yet.",
          [{ text: "OK" }]
        );
        return;
      }
   
      const animationDuration = Platform.OS === 'android' ? 150 : 200;
      
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true
      }).start(() => {
        if (isMultiplayerFlow) {
          const cameFromLobby = route.params?.__fromLobby;
          console.log("Multiplayer flow detected, came from lobby:", cameFromLobby);
          
          if (firebase && firebase.currentRoom) {
            console.log('[TriviaPackSelectionScreen] Updating Firebase with pack:', {
              id: pack.id,
              name: pack.name,
              displayName: pack.displayName || pack.name
            });
            
            firebase.updateGameState({
              gameData: {
                ...firebase.gameState?.gameData,
                packName: pack.name,
                packId: pack.id,
                packDisplayName: pack.displayName || pack.name
              }
            }).then(() => {
              console.log('[TriviaPackSelectionScreen] Firebase update successful');
              
              setTimeout(() => {
                if (cameFromLobby) {
                  console.log('[TriviaPackSelectionScreen] Returning to Lobby with updated pack:', pack.id, pack.name);
                  
                  navigation.navigate('LobbyScreen', {
                    selectedPack: pack.id,
                    packName: pack.displayName || pack.name,
                    fromPackSelection: true,
                    _timestamp: Date.now()
                  });
                } else {
                  navigation.navigate('LobbyScreen', {
                    selectedPack: pack.name,
                    packName: pack.displayName || pack.name,
                    backgroundMusic: backgroundMusicRef.current
                  });
                }
              }, 300);
            }).catch(error => {
              console.error('[TriviaPackSelectionScreen] Error updating Firebase:', error);
              Alert.alert('Error', 'Failed to update game with selected pack. Please try again.');
              
              if (cameFromLobby) {
                navigation.navigate('LobbyScreen', {
                  selectedPack: pack.id,
                  packName: pack.displayName || pack.name,
                  fromPackSelection: true,
                  _timestamp: Date.now()
                });
              }
            });
          } else {
            if (cameFromLobby) {
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
          // NEW: Pass gameMode and players to GameConfirmation with achievement tracking
          const navigationConfig = Platform.OS === 'android' 
            ? { animationEnabled: true }
            : { animationEnabled: false, detachInactiveScreens: false };
            
          console.log('🎮 Navigating to GameConfirmation with:', {
            selectedPack: pack.name,
            gameMode,
            players,
            packId: pack.id
          });
            
          navigation.navigate('GameConfirmation', {
            selectedPack: pack.name,
            players, // NEW: Pass players through
            gameMode, // NEW: Pass gameMode through
            packId: pack.id, // ACHIEVEMENT: Pass pack ID for potential future tracking
            navigationConfig,
            backgroundMusic: backgroundMusicRef.current
          });
        }
      });
    } catch (error) {
      console.error('Error selecting pack:', error);
      Alert.alert('Error', 'Failed to load pack. Please try again.');
    }
  };

  const handleBackPress = () => {
    console.log('Pack selection back button pressed, isMultiplayerFlow:', isMultiplayerFlow);
    
    if (isMultiplayerFlow) {
      if (route.params?.__fromLobby) {
        console.log('Returning to LobbyScreen with no changes');
        navigation.goBack();
      } else {
        navigation.goBack();
      }
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  };

  const toggleSearch = () => {
    if (isSearchVisible) {
      Animated.timing(searchAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }).start(() => {
        setIsSearchVisible(false);
        setSearchQuery('');
      });
    } else {
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

  const searchInputWidth = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '85%']
  });

  const toggleFeaturedSection = () => {
    setFeaturedSectionCollapsed(prev => !prev);
    
    Animated.timing(featuredHeightValue, {
      toValue: featuredSectionCollapsed ? expandedFeaturedHeight : collapsedFeaturedHeight,
      duration: 250,
      useNativeDriver: false
    }).start();
  };

  const handleScroll = (event) => {
    if (!autoCollapseEnabled || activeTab !== 'Premium') return;
    
    const currentOffset = event.nativeEvent.contentOffset.y;
    const direction = currentOffset > lastScrollPosition ? 'down' : 'up';
    
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

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  };

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

  const showPackDetail = async (pack) => {
    // NEW: Check if pack is unlocked using promo-integrated function
    const isUnlocked = await isPackPurchased(pack.id);
    
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.getStatusAsync().then(status => {
        const wasPlaying = status.isLoaded && status.isPlaying;
        setSelectedDetailPack({ ...pack, isUnlocked });
        setPackDetailVisible(true);
        
        if (wasPlaying) {
          setTimeout(() => {
            if (backgroundMusicRef.current) {
              backgroundMusicRef.current.playAsync().catch(() => {});
            }
          }, 100);
        }
      }).catch(() => {
        setSelectedDetailPack({ ...pack, isUnlocked });
        setPackDetailVisible(true);
      });
    } else {
      setSelectedDetailPack({ ...pack, isUnlocked });
      setPackDetailVisible(true);
    }
  };

  const closePackDetail = () => {
    setPackDetailVisible(false);
    
    if (backgroundMusicRef.current) {
      setTimeout(() => {
        if (backgroundMusicRef.current) {
          backgroundMusicRef.current.playAsync().catch(() => {});
        }
      }, 100);
    }
  };

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

  // NEW: Updated actualFeaturedPacks to use visible packs
  const actualFeaturedPacks = useMemo(() => {
    if (!featuredPackIds || !featuredPackIds.length) {
      return visiblePacks.Premium.filter(pack => pack.featured || pack.isPopular).slice(0, 5);
    }
    
    return featuredPackIds
      .map(id => visiblePacks.Premium.find(pack => pack.id === id))
      .filter(pack => pack);
  }, [featuredPackIds, visiblePacks.Premium]);

  // NEW: Updated filteredPacks to use visible packs instead of manual filtering
  const filteredPacks = useMemo(() => {
    let packs = visiblePacks[activeTab] || [];
    
    // No longer need to manually filter out 'themepark' - promo system handles visibility
    
    if (activeTab === 'Premium' && premiumCategory !== 'All') {
      packs = packs.filter(pack => 
        pack.category === premiumCategory || 
        (pack.tags && pack.tags.includes(premiumCategory))
      );
    }
    
    if (searchQuery.trim() !== '') {
      packs = packs.filter(pack => 
        pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pack.tags && pack.tags.some(tag => 
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
    }
    
    if (sortBy === 'alphabetical') {
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'questions') {
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        const aCount = packStats[a.id]?.stats?.total || 0;
        const bCount = packStats[b.id]?.stats?.total || 0;
        return bCount - aCount;
      });
    } else if (sortBy === 'newest') {
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        const aDate = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
        const bDate = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
        return bDate - aDate;
      });
    } else if (sortBy === 'featured') {
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        
        const aFeatured = featuredPackIds.includes(a.id);
        const bFeatured = featuredPackIds.includes(b.id);
        if (aFeatured && !bFeatured) return -1;
        if (!aFeatured && bFeatured) return 1;
        
        return a.name.localeCompare(b.name);
      });
    } else if (sortBy === 'purchased') {
      packs = [...packs].sort((a, b) => {
        const aPurchased = packStats[a.id]?.purchased || false;
        const bPurchased = packStats[b.id]?.purchased || false;
        if (aPurchased && !bPurchased) return -1;
        if (!aPurchased && bPurchased) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    return packs;
  }, [visiblePacks, activeTab, premiumCategory, searchQuery, sortBy, packStats, featuredPackIds]);

  const paginatedPacks = useMemo(() => {
    const endIndex = currentPage * PACKS_PER_PAGE;
    return filteredPacks.slice(0, endIndex);
  }, [filteredPacks, currentPage]);

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
          { width: (Dimensions.get('window').width / 2) - 28 },
          isFeatured && styles.compactFeaturedPackHighlighted,
          isPurchased && { borderColor: '#00C853', borderWidth: 1.5 }
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
          
          {isPurchased && (
            <View style={styles.compactFeaturedPackPurchased}>
              <Ionicons name="checkmark" size={14} color="white" />
            </View>
          )}
          
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
    const isCurrentlyPurchasing = isPurchasing(item.id);
    
    const showPrice = isDevMode || (isPremium && !isPurchased && !betaMode);
   
    if (viewMode === 'grid') {
      return (
        <TouchableOpacity 
          style={[
            styles.packItem,
            { width: itemWidth },
            isDisabled && styles.disabledPack,
            hasErrors && !isDevMode && styles.errorPack,
            isFeatured && styles.featuredPackItem,
            isPurchased && styles.purchasedPackItem
          ]}
          onPress={() => !isDisabled && showPackDetail(item)}
          onLongPress={() => setSelectedPack(item)}
          disabled={isDisabled || isCurrentlyPurchasing}
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

            {isPurchased && (
              <View style={styles.purchasedCheckmark}>
                <Ionicons name="checkmark" size={16} color="white" />
              </View>
            )}

            {isCurrentlyPurchasing && (
              <View style={styles.purchasingOverlay}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.purchasingText}>Purchasing...</Text>
              </View>
            )}
            
            {packStat && packStat.isAvailable && showQuestionCounts && (
              <View style={styles.packStatsContainer}>
                <Text style={styles.questionCountText}>
                  {`${totalQuestions} Questions`}
                </Text>
              </View>
            )}
   
            {hasErrors && !isDevMode && (
              <View style={styles.errorIndicator}>
                <Ionicons name="warning" size={24} color="#ff4500" />
              </View>
            )}
   
            {isDisabled && !hasErrors && !isDevMode && (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            )}
            
            {isPremium && showPrice && (
              <View style={styles.priceTagContainer}>
                <Text style={styles.priceTagText}>{item.defaultPrice || '$3.99'}</Text>
              </View>
            )}
            
            {isPremium && !isPurchased && !betaMode && !isDevMode && !isCurrentlyPurchasing && (
              <View style={styles.lockOverlay}>
                <Ionicons name="lock-closed" size={40} color="#FFD700" />
              </View>
            )}
            
            {isFeatured && (
              <View style={styles.featuredStarIndicator}>
                <Ionicons name="star" size={16} color="#FFD700" />
              </View>
            )}
            
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}
            
          </ImageBackground>
        </TouchableOpacity>
      );
    } else {
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
          disabled={isDisabled || isCurrentlyPurchasing}
          activeOpacity={0.7}
        >
          <ImageBackground 
            source={item.image} 
            style={styles.listThumbnail}
            imageStyle={{ borderRadius: 8 }}
          >
            <View style={styles.thumbnailOverlay} />
            
            {isPremium && !isPurchased && !betaMode && !isDevMode && !isCurrentlyPurchasing && (
              <View style={styles.thumbnailLockOverlay}>
                <Ionicons name="lock-closed" size={24} color="#FFD700" />
              </View>
            )}

            {isCurrentlyPurchasing && (
              <View style={styles.thumbnailPurchasingOverlay}>
                <ActivityIndicator size="small" color="#FFD700" />
              </View>
            )}
            
            {isFeatured && (
              <View style={styles.featuredIndicatorList}>
                <Ionicons name="star" size={16} color="black" />
              </View>
            )}
            
            {isPurchased && (
              <View style={styles.purchasedIndicatorList}>
                <Text style={styles.purchasedIndicatorText}>OWNED</Text>
              </View>
            )}
          </ImageBackground>
          
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
              
              {packStat && packStat.isAvailable && showQuestionCounts && (
                <Text style={styles.questionCountTextList}>
                  {`${totalQuestions} Q`}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.listIndicators}>
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
  }, [packStats, validationErrors, devModePacksVisible, isDevMode, itemWidth, activeTab, betaMode, featuredPackIds, viewMode, showQuestionCounts, isPurchasing]);

  const renderListHeader = useCallback(() => {
    if (activeTab !== 'Premium' || isSearchVisible) return null;
    
    return (
      <View style={styles.premiumControls}>
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
    // Check bundle purchase status more thoroughly
    const isEverythingBundlePurchased = packStats[PRODUCT_IDS.EVERYTHING_BUNDLE]?.purchased || 
                                       packStats['everything_bundle']?.purchased || 
                                       false;
    const isBundlePurchasing = isPurchasing('everything_bundle');
    
    // Debug logging
    if (__DEV__) {
      console.log('🎁 Bundle check - PRODUCT_ID:', PRODUCT_IDS.EVERYTHING_BUNDLE);
      console.log('🎁 Bundle check - packStats keys:', Object.keys(packStats));
      console.log('🎁 Bundle check - isEverythingBundlePurchased:', isEverythingBundlePurchased);
      console.log('🎁 Bundle check - packStats bundle entry:', packStats[PRODUCT_IDS.EVERYTHING_BUNDLE]);
    }
    
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
        {paginatedPacks.length < filteredPacks.length && (
          <View style={styles.loadMoreContainer}>
            <ActivityIndicator color="#00ff00" size="small" />
            <Text style={styles.loadMoreText}>Loading more packs...</Text>
          </View>
        )}
        
        {!isEverythingBundlePurchased ? (
          <TouchableOpacity 
            style={styles.everythingBundleButton}
            onPress={handleEverythingBundlePurchase}
            disabled={isBundlePurchasing}
            activeOpacity={0.8}
          >
            <ImageBackground 
              source={require('../assets/gameshow.jpg')}
              style={styles.bundleBackground}
              imageStyle={{ borderRadius: 15 }}
            >
              <View style={styles.bundleOverlay} />
              
              {isBundlePurchasing && (
                <View style={styles.bundlePurchasingOverlay}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.bundlePurchasingText}>Purchasing Bundle...</Text>
                </View>
              )}
              
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
          <View style={styles.everythingBundlePurchasedBar}>
            <Text style={styles.bundlePurchasedBarText}>Everything Bundle Was Purchased</Text>
          </View>
        )}
      </View>
    );
  }, [activeTab, paginatedPacks, filteredPacks, searchQuery, packStats, isPurchasing]);

  // Purchase Confirmation Dialog
  const PurchaseDialog = () => {
    if (!showPurchaseDialog || !pendingProduct) return null;
    
    return (
      <Modal
        visible={showPurchaseDialog}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.purchaseDialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Confirm Purchase</Text>
              <TouchableOpacity onPress={() => setShowPurchaseDialog(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.productPreview}>
              <Image source={pendingProduct.image} style={styles.previewImage} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{pendingProduct.name}</Text>
                <Text style={styles.previewPrice}>{pendingProduct.price}</Text>
              </View>
            </View>
            
            <View style={styles.purchaseDetails}>
              <Text style={styles.detailsTitle}>What you'll get:</Text>
              <View style={styles.benefitsList}>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                  <Text style={styles.benefitText}>Permanent access to all content</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                  <Text style={styles.benefitText}>No subscription required</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                  <Text style={styles.benefitText}>Available on all your devices</Text>
                </View>
                {pendingProduct.id === 'everything_bundle' && (
                  <View style={styles.benefit}>
                    <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                    <Text style={styles.benefitText}>All future packs included</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.dialogActions}>
              <TouchableOpacity 
                style={styles.cancelDialogButton}
                onPress={() => setShowPurchaseDialog(false)}
              >
                <Text style={styles.cancelDialogText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.confirmButton}
                onPress={confirmPurchase}
              >
                <Text style={styles.confirmButtonText}>Purchase {pendingProduct.price}</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.securityNote}>
              🔒 Secure payment processed by Apple
            </Text>
          </View>
        </View>
      </Modal>
    );
  };

  // NEW: Update header title to reflect game mode
  const getHeaderTitle = () => {
    if (gameMode === 'TriviaONLY') {
      return 'Trivia Packs';
    } else if (gameMode === 'TriviaDare') {
      return 'Trivia Packs';
    }
    return 'Trivia Packs';
  };
   
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
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={28} color="#FFD700" />
            </TouchableOpacity>
            
            {!isSearchVisible ? (
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
                    {getHeaderTitle()}
                  </Text>
                  {betaMode && (
                    <Text style={styles.betaBadgeText}>BETA MODE</Text>
                  )}
                  {/* NEW: Show game mode badge */}
                  {gameMode && (
                    <Text style={styles.gameModeSubtitle}>
                      {gameMode === 'TriviaONLY' ? '📚 Knowledge Only' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
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
            
            <View style={styles.headerActions}>
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
                
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>MORE</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
   
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
              searchQuery && { paddingTop: 10 }
            ]}
            onEndReached={() => {
              if (paginatedPacks.length < filteredPacks.length) {
                setCurrentPage(prev => prev + 1);
              }
            }}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={renderListHeader}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListFooterComponent={renderListFooter}
            ListEmptyComponent={() => (
              <View style={styles.noResultsContainer}>
                <Ionicons name="search-outline" size={40} color="#FFD700" />
                <Text style={styles.noResultsText}>No packs found</Text>
                <Text style={styles.noResultsSubText}>Try a different search or category</Text>
              </View>
            )}
          />
          
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
                      <View style={styles.packDetailHeader}>
                        <Text style={styles.packDetailTitle}>
                          {selectedDetailPack.name}
                        </Text>
                        <TouchableOpacity onPress={closePackDetail}>
                          <Ionicons name="close" size={24} color="#FFD700" />
                        </TouchableOpacity>
                      </View>
                      
                      {/* NEW: Use promo-integrated unlock status */}
                      {selectedDetailPack.isUnlocked && (
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
                      
                      <ImageBackground 
                        source={selectedDetailPack.image}
                        style={styles.packDetailImage}
                        imageStyle={{ borderRadius: 10 }}
                      >
                        <View style={styles.packDetailOverlay} />
                        
                        {selectedDetailPack.category && (
                          <View style={styles.packDetailCategory}>
                            <Text style={styles.packDetailCategoryText}>
                              {selectedDetailPack.category}
                            </Text>
                          </View>
                        )}
                        
                        {TRIVIA_PACKS.Premium.some(p => p.id === selectedDetailPack.id) && 
                         !selectedDetailPack.isUnlocked && 
                         !betaMode && 
                         !isDevMode && (
                          <View style={styles.packDetailPrice}>
                            <Text style={styles.packDetailPriceText}>
                              {selectedDetailPack.defaultPrice || '$3.99'}
                            </Text>
                          </View>
                        )}
                        
                        {featuredPackIds.includes(selectedDetailPack.id) && (
                          <View style={styles.packDetailFeatured}>
                            <Ionicons name="star" size={18} color="black" />
                          </View>
                        )}
                      </ImageBackground>
                      
                      <View style={styles.packDetailInfo}>
                        <Text style={styles.packDetailDescription}>
                          {selectedDetailPack.description || 
                            `Test your knowledge with this exciting ${selectedDetailPack.category || 'trivia'} pack! Challenge your friends or play solo.`
                          }
                        </Text>
                      </View>
                      
                      {TRIVIA_PACKS.Premium.some(p => p.id === selectedDetailPack.id) && 
                       !selectedDetailPack.isUnlocked && 
                       !betaMode && 
                       !isDevMode ? (
                        <TouchableOpacity 
                          style={styles.purchasePackButton}
                          onPress={() => {
                            closePackDetail();
                            handlePurchase(selectedDetailPack);
                          }}
                          disabled={isPurchasing(selectedDetailPack.id)}
                        >
                          {isPurchasing(selectedDetailPack.id) ? (
                            <>
                              <ActivityIndicator size="small" color="white" />
                              <Text style={styles.purchasePackButtonText}>Purchasing...</Text>
                            </>
                          ) : (
                            <>
                              <Text style={styles.purchasePackButtonText}>Purchase</Text>
                              <Ionicons name="pricetag" size={24} color="white" />
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          style={[
                            styles.playPackButton,
                            selectedDetailPack.isUnlocked && {
                              borderColor: '#00C853',
                              borderWidth: 2,
                            }
                          ]}
                          onPress={() => {
                            if (backgroundMusicRef.current) {
                              backgroundMusicRef.current.playAsync().catch(() => {});
                            }
                            
                            setTimeout(() => {
                              closePackDetail();
                              handleSelectPack(selectedDetailPack);
                            }, 50);
                          }}
                        >
                          <Text style={styles.playPackButtonText}>
                            {selectedDetailPack.isUnlocked ? "Start Game" : "Play Free Pack"}
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

          <PurchaseDialog />

          {showToast && (
            <Animated.View style={styles.toastContainer}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  // Keep all your existing styles, just adding new ones for game mode
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    fontSize: Platform.OS === 'android' ? 20 : 22, // Slightly smaller to accommodate longer titles
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
  // NEW: Game mode subtitle style
  gameModeSubtitle: {
    color: '#FFD700',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.8,
    marginTop: 2,
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
  premiumControls: {
    marginBottom: 10,
  },
 
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    borderColor: '#00C853',
    borderWidth: 2,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },

  // Purchased pack styles for list view
  purchasedPackItemList: {
    borderLeftColor: '#00C853',
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

  // NEW: Purchasing overlay styles
  purchasingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  purchasingText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  thumbnailPurchasingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 8,
  },
  bundlePurchasingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    borderRadius: 15,
  },
  bundlePurchasingText: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },

  // Toast and status styles
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
    zIndex: 10000,
  },
  toastText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    borderColor: 'rgba(255, 255, 255, 0.9)',
    height: 160,
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
  imageBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  textGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  packTextContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    minHeight: 50,
  },
  packText: {
    color: 'white',
    fontSize: Platform.OS === 'android' ? 16 : 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: '100%',
    textShadowColor: 'black',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    flexWrap: 'wrap',
    lineHeight: 20,
    maxHeight: 50,
    numberOfLines: 2,
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
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
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
  everythingBundlePurchasedBar: {
    backgroundColor: '#00C853',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bundlePurchasedBarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Purchase Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseDialog: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  previewPrice: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  purchaseDetails: {
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  benefitsList: {
    gap: 8,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  cancelDialogButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  cancelDialogText: {
    fontWeight: 'bold',
    color: '#666',
  },
  confirmButton: {
    flex: 2,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontWeight: 'bold',
    color: '#000',
  },
  securityNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
 
export default TriviaPackSelectionScreen;