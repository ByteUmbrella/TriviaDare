import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  View, 
  Modal, 
  ImageBackground, 
  Dimensions,
  Platform,
  TextInput,
  Alert,
  ScrollView,
  FlatList,
  Animated,
  BackHandler,
  Keyboard,
  TouchableWithoutFeedback,
  Pressable,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useSettings } from '../Context/Settings';
import { useCustomDares } from '../Context/CustomDaresContext';
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';
import iapManager, { PRODUCT_IDS, DARES_TO_PRODUCT_MAP } from '../Context/IAPManager';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Very conservative tablet detection - BOTH dimensions must be tablet-sized
const isTabletDevice = () => {
  if (Platform.OS === 'ios') {
    // iPad mini starts at 744pt width - require BOTH dimensions to be large
    return SCREEN_WIDTH >= 744 && SCREEN_HEIGHT >= 1000;
  } else if (Platform.OS === 'android') {
    // Only large tablets with both dimensions 600+ dp
    return SCREEN_WIDTH >= 600 && SCREEN_HEIGHT >= 600;
  }
  return false;
};

const IS_TABLET = isTabletDevice();

// Keep original phone dimensions exactly the same
const GRID_PADDING = SCREEN_WIDTH * 0.04;
const COLUMNS = 2;
const CARD_MARGIN = SCREEN_WIDTH * 0.02;
const CARD_WIDTH = (SCREEN_WIDTH - (GRID_PADDING * 2) - (CARD_MARGIN * (COLUMNS + 1))) / COLUMNS;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const scaleFontSize = (size) => {
  const scaleFactor = Math.min(SCREEN_WIDTH / 375, SCREEN_HEIGHT / 812);
  return Math.round(size * scaleFactor);
};

// Only adjust modal size for tablets
const getModalWidth = () => {
  if (IS_TABLET) {
    return Math.min(SCREEN_WIDTH * 0.7, 600); // Tablet modal
  } else {
    return SCREEN_WIDTH * 0.9; // Original phone modal
  }
};

const getModalMaxWidth = () => {
  if (IS_TABLET) {
    return 600; // Tablet max width
  } else {
    return 400; // Original phone max width
  }
};

const PackCard = memo(({ item, packCounts, customCounts, onPress, showDareCounts, isPurchased, price, onPurchase, isPurchasing }) => {
  const totalCount = (packCounts[item.name] || 0) + (customCounts[item.name] || 0);
  const [cardAnim] = useState(new Animated.Value(0));
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  }, []);
  
  const cardTransform = {
    transform: [
      {
        scale: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.02]
        })
      }
    ]
  };
  
  return (
    <Animated.View style={[styles.cardContainer, cardTransform]}>
      <TouchableOpacity
        style={[
          styles.card,
          isPurchased && price && styles.purchasedCard
        ]}
        onPress={() => isPurchased ? onPress(item) : onPurchase(item)}
        disabled={isPurchasing}
        activeOpacity={Platform.OS === 'android' ? 0.7 : 0.9}
      >
        <ImageBackground 
          source={item.image} 
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
          fadeDuration={Platform.OS === 'android' ? 300 : 0}
        >
          {!isPurchased && price && (
            <View style={styles.priceBadge}>
              <Text style={styles.priceText}>${price}</Text>
            </View>
          )}
          
          {item.ageRestricted && (
            <View style={styles.ageRestrictedBadge}>
              <Text style={styles.ageRestrictedText}>18+</Text>
            </View>
          )}
          
          {isPurchasing ? (
            <View style={styles.purchasingOverlay}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Text style={styles.purchasingText}>Purchasing...</Text>
            </View>
          ) : !isPurchased && price ? (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={40} color="#FFD700" />
            </View>
          ) : isPurchased && price ? (
            <View style={styles.purchasedBadge}>
              <Text style={styles.purchasedText}>OWNED</Text>
            </View>
          ) : null}
          
          <View style={styles.cardOverlay}>
            <Text 
              style={styles.packName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            {showDareCounts && (
              <Text style={styles.packDareCount}>
                {totalCount} Dares {customCounts[item.name] > 0 && `(${customCounts[item.name]} Custom)`}
              </Text>
            )}
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
});

const DarePackSelectionScreen = ({ navigation }) => {
  const { addCustomDare, getCustomDares, getCustomDareCount, removeCustomDare } = useCustomDares();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPack, setSelectedPack] = useState(null);
  const [dareCount, setDareCount] = useState(5);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDealAnimation, setShowDealAnimation] = useState(false);
  const [packCounts, setPackCounts] = useState({});
  const [customCounts, setCustomCounts] = useState({});
  const [previewDares, setPreviewDares] = useState([]);
  const [lastTap, setLastTap] = useState(0);
  const [customDareText, setCustomDareText] = useState('');
  const [showCustomDareInput, setShowCustomDareInput] = useState(false);
  const [customDareSuccess, setCustomDareSuccess] = useState(false);
  const [showCustomDaresModal, setShowCustomDaresModal] = useState(false);
  const [customDares, setCustomDares] = useState([]);
  const [editingDare, setEditingDare] = useState(null);
  const [contentOpacity] = useState(new Animated.Value(0));
  const [isLoading, setIsLoading] = useState(true);
  const [cardsAnimation] = useState(new Animated.Value(0));
  const [showDareCounts, setShowDareCounts] = useState(false);
  const [purchaseStates, setPurchaseStates] = useState({});

  // NEW: Add visible packs state for promo integration
  const [visiblePacks, setVisiblePacks] = useState([]);

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

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const onBackPress = () => {
          if (modalVisible) {
            handleBack();
            return true;
          }
          if (showCustomDaresModal) {
            setShowCustomDaresModal(false);
            setTimeout(() => {
              setModalVisible(true);
              setIsFlipped(true);
            }, 300);
            return true;
          }
          if (showPurchaseDialog) {
            setShowPurchaseDialog(false);
            return true;
          }
          return false;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [modalVisible, showCustomDaresModal, showPurchaseDialog])
  );

  useEffect(() => {
    if (isFlipped) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300,
        delay: Platform.OS === 'android' ? 300 : 400,
        useNativeDriver: true,
      }).start();
    } else {
      contentOpacity.setValue(0);
    }
  }, [isFlipped]);

  useEffect(() => {
    Animated.timing(cardsAnimation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused');
      // NEW: Reload visible packs and purchase states when screen focused
      loadVisiblePacks();
      checkPurchaseStates();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const loadCounts = async () => {
      setIsLoading(true);
      const counts = {};
      const customCounts = {};
      
      try {
        console.log('📊 Loading pack counts and dare counts with promo integration...');
        
        // NEW: Load visible packs first
        const visiblePacksArray = await loadVisiblePacks();
        
        if (Platform.OS === 'android') {
          const batchSize = 3;
          for (let i = 0; i < visiblePacksArray.length; i += batchSize) {
            const batchPacks = visiblePacksArray.slice(i, i + batchSize);
            for (const pack of batchPacks) {
              counts[pack.name] = Array.isArray(pack.dares) ? pack.dares.length : 0;
              customCounts[pack.name] = await getCustomDareCount(pack.name);
            }
          }
        } else {
          for (const pack of visiblePacksArray) {
            counts[pack.name] = Array.isArray(pack.dares) ? pack.dares.length : 0;
            customCounts[pack.name] = await getCustomDareCount(pack.name);
          }
        }
      } catch (error) {
        console.error('Error loading dare counts:', error);
      } finally {
        setPackCounts(counts);
        setCustomCounts(customCounts);
        setIsLoading(false);
      }
    };

    console.log('🚀 Loading counts and checking purchase states');
    loadCounts();
    
    console.log('🔒 Production mode active:', !__DEV__);
    console.log('📱 Platform:', Platform.OS);
    console.log('📐 Screen dimensions:', SCREEN_WIDTH, 'x', SCREEN_HEIGHT);
    console.log('📱 Is Tablet (modal only):', IS_TABLET);
    
    console.log('💰 Checking purchase states for premium packs...');
    checkPurchaseStates().then(() => {
      console.log('✅ Purchase state checking complete');
    });
  }, []);

  // NEW: Pack visibility configuration for hidden dares packs
  const DARES_PACK_VISIBILITY = {
    // Example: Add any hidden dares packs here
    // 'Secret Dares': { hide: true },     // Hidden until unlocked via promo
    // 'VIP Premium': { hide: true },      // Hidden until unlocked via promo
    // 'Hidden Spicy': { hide: true },     // Hidden until unlocked via promo
    
    // To make existing packs hidden, add them here:
    // 'Spicy': { hide: true },           // Would hide Spicy pack until unlocked
    // 'Couples': { hide: true },         // Would hide Couples pack until unlocked
  };

  // NEW: Function to check if a dares pack should be visible
  const shouldShowDaresPack = async (pack) => {
    try {
      // Check if pack has visibility configuration
      const packConfig = DARES_PACK_VISIBILITY[pack.name];
      
      // If no config or not hidden, always show
      if (!packConfig || !packConfig.hide) {
        return true;
      }
      
      // If hidden, only show if unlocked via promo or IAP
      if (pack.isPremium) {
        // Map pack names to product keys for promo integration
        let packKey = '';
        switch (pack.name) {
          case 'Spicy':
            packKey = 'spicy';
            break;
          case 'House Party':
            packKey = 'houseparty';
            break;
          case 'Couples':
            packKey = 'couples';
            break;
          case 'Bar':
            packKey = 'bar';
            break;
          // Add any hidden premium packs here
          default:
            return false; // Unknown hidden pack
        }
        
        if (packKey) {
          // Use enhanced promo-integrated method
          const isUnlocked = await iapManager.isDaresPurchased(packKey);
          return isUnlocked;
        }
      }
      
      // For non-premium hidden packs, you could add other unlock logic here
      return false;
    } catch (error) {
      console.error(`Error checking visibility for dares pack ${pack.name}:`, error);
      return true; // Default to visible on error
    }
  };

  // NEW: Updated checkPurchaseStates with promo integration
  // NEW: Updated checkPurchaseStates with promo integration
  const checkPurchaseStates = async () => {
    try {
      const states = {};
      
      console.log('📊 Checking dare pack purchase states with promo integration...');
      
      if (!iapManager.isInitialized) {
        await iapManager.initializeSilently();
      }
      
      // Check everything bundle first
      const hasBundle = await iapManager.isPurchased(PRODUCT_IDS.EVERYTHING_BUNDLE);
      console.log('✅ Everything bundle purchased:', hasBundle);
      
      // Check each visible pack individually using enhanced promo-integrated methods
      const packsToCheck = visiblePacks.length > 0 ? visiblePacks : packs;
      
      for (const pack of packsToCheck) {
        if (!pack.isPremium) {
          states[pack.name] = true;
          continue;
        }
        
        if (hasBundle) {
          states[pack.name] = true;
          continue;
        }
        
        // Map pack names to product keys for promo integration
        let packKey = '';
        switch (pack.name) {
          case 'Spicy':
            packKey = 'spicy';
            break;
          case 'House Party':
            packKey = 'houseparty';
            break;
          case 'Couples':
            packKey = 'couples';
            break;
          case 'Bar':
            packKey = 'bar';
            break;
        }
        
        // NEW: Use enhanced promo-integrated method
        if (packKey) {
          const isUnlocked = await iapManager.isDaresPurchased(packKey);
          states[pack.name] = isUnlocked;
          
          // Only log detailed info in dev mode
          if (__DEV__) {
            console.log(`🔍 Promo-integrated check for ${pack.name} (${packKey}):`, isUnlocked);
          }
        } else {
          states[pack.name] = false;
        }
      }
      
      // Add Everything Bundle to purchase states
      states[PRODUCT_IDS.EVERYTHING_BUNDLE] = hasBundle;
      
      console.log('✅ Dare pack purchase states updated with promo integration');
      
      setPurchaseStates(states);
    } catch (error) {
      console.error('❌ Error checking purchase states:', error);
      
      const fallbackStates = {};
      const packsToCheck = visiblePacks.length > 0 ? visiblePacks : packs;
      packsToCheck.forEach(pack => {
        fallbackStates[pack.name] = !pack.isPremium;
      });
      console.log('⚠️ Using fallback purchase states due to error');
      setPurchaseStates(fallbackStates);
    }
  };

  // NEW: Function to load visible packs (separated for reuse)
  const loadVisiblePacks = async () => {
    try {
      console.log('👀 Loading visible dares packs...');
      
      const allPacks = packs;
      const visiblePacksArray = [];
      
      for (const pack of allPacks) {
        const shouldShow = await shouldShowDaresPack(pack);
        if (shouldShow) {
          visiblePacksArray.push(pack);
        }
      }
      
      console.log('👀 Visible dares packs after promo filtering:', visiblePacksArray.map(p => p.name));
      setVisiblePacks(visiblePacksArray);
      
      return visiblePacksArray;
    } catch (error) {
      console.error('Error loading visible packs:', error);
      return packs; // Fallback to all packs
    }
  };

  // SIMPLIFIED PURCHASE HANDLING
  const handlePurchase = async (pack) => {
    console.log('🛒 Starting purchase for pack:', pack.name);
    
    let packKey = '';
    switch (pack.name) {
      case 'Spicy':
        packKey = 'spicy';
        break;
      case 'House Party':
        packKey = 'houseparty';
        break;
      case 'Couples':
        packKey = 'couples';
        break;
      case 'Bar':
        packKey = 'bar';
        break;
      default:
        console.error('❌ Unknown pack:', pack.name);
        Alert.alert('Error', 'Unknown pack type.');
        return;
    }

    if (!packKey || !DARES_TO_PRODUCT_MAP[packKey]) {
      console.error('❌ No product ID found for pack:', pack.name);
      Alert.alert('Purchase Error', 'Could not find product information for this pack.');
      return;
    }

    const productId = DARES_TO_PRODUCT_MAP[packKey];
    console.log('✅ Product ID resolved:', productId);
    
    const product = iapManager.getProductById(productId);
    if (!product) {
      console.error('❌ Product not found in store:', productId);
      Alert.alert('Product Unavailable', 'This pack is temporarily unavailable. Please try again later.');
      return;
    }
    
    // Set up purchase flow
    setPendingProduct({
      ...pack,
      productId,
      price: product.localizedPrice,
      storeTitle: product.title
    });
    setShowPurchaseDialog(true);
  };

  const confirmPurchase = async () => {
    if (!pendingProduct) return;
    
    setShowPurchaseDialog(false);
    
    // Add pack to purchasing set
    setPurchasingPacks(prev => new Set(prev).add(pendingProduct.name));
    showToastMessage(`Starting purchase for ${pendingProduct.name}...`);
    
    try {
      // Use the new callback-based purchase method
      await iapManager.purchaseProductWithCallback(pendingProduct.productId, (result) => {
        console.log('Purchase completed:', result);
        
        // Remove from purchasing set
        setPurchasingPacks(prev => {
          const newSet = new Set(prev);
          newSet.delete(pendingProduct.name);
          return newSet;
        });

        if (result.success) {
          console.log('✅ Purchase successful, refreshing pack states...');
          showToastMessage('🎉 Purchase successful!');
          
          // NEW: Refresh both visible packs and purchase states
          setTimeout(async () => {
            await loadVisiblePacks();
            checkPurchaseStates();
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
        newSet.delete(pendingProduct.name);
        return newSet;
      });
      
      showToastMessage('Failed to start purchase. Please try again.');
    } finally {
      setPendingProduct(null);
    }
  };

  const isPurchasing = (packName) => {
    return purchasingPacks.has(packName);
  };

  // Everything Bundle purchase
  const handleEverythingBundlePurchase = () => {
    console.log('💎 Everything Bundle purchase initiated');
    
    const bundleProduct = iapManager.getProductById(PRODUCT_IDS.EVERYTHING_BUNDLE);
    if (bundleProduct) {
      setPendingProduct({
        name: 'Everything Bundle',
        productId: PRODUCT_IDS.EVERYTHING_BUNDLE,
        price: bundleProduct.localizedPrice,
        storeTitle: bundleProduct.title,
        description: 'All Premium Packs + Future Updates',
        image: require('../assets/DaresOnly/spicy.jpg') // Use a representative image
      });
      setShowPurchaseDialog(true);
    } else {
      Alert.alert(
        "Purchase Everything Bundle",
        "Get unlimited access to all premium dare packs including future releases for just $49.99. This is a one-time purchase.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Purchase",
            onPress: async () => {
              setPurchasingPacks(prev => new Set(prev).add('everything_bundle'));
              showToastMessage("Starting Everything Bundle purchase...");
              
              try {
                await iapManager.purchaseProductWithCallback(PRODUCT_IDS.EVERYTHING_BUNDLE, (result) => {
                  setPurchasingPacks(prev => {
                    const newSet = new Set(prev);
                    newSet.delete('everything_bundle');
                    return newSet;
                  });

                  if (result.success) {
                    showToastMessage('🎉 Everything Bundle purchased successfully!');
                    setTimeout(async () => {
                      await loadVisiblePacks();
                      checkPurchaseStates();
                    }, 1000);
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

  const getPreviewDares = useCallback(async (pack, count = 2) => {
    if (!pack || !Array.isArray(pack.dares)) return [];
    
    try {
      const standardDares = [...pack.dares];
      const customDares = await getCustomDares(pack.name);
      const allDares = [...standardDares, ...customDares.map(d => d.text)];
      return allDares.sort(() => 0.5 - Math.random()).slice(0, count);
    } catch (error) {
      console.error('Error getting preview dares:', error);
      return [];
    }
  }, [getCustomDares]);
  
  const handleCreateCustomDare = async () => {
    if (!customDareText.trim() || !selectedPack) return;
    
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    
    try {
      const success = await addCustomDare(selectedPack.name, customDareText.trim());
      if (success) {
        setCustomDareSuccess(true);
        setCustomDareText('');
        const newCount = await getCustomDareCount(selectedPack.name);
        setCustomCounts(prev => ({
          ...prev,
          [selectedPack.name]: newCount
        }));
        setPreviewDares(await getPreviewDares(selectedPack));
        setTimeout(() => {
          setCustomDareSuccess(false);
          setShowCustomDareInput(false);
        }, 2000);
      } else {
        Alert.alert('Error', 'Failed to add custom dare. Please try again.');
      }
    } catch (error) {
      console.error('Error creating custom dare:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };
  
  const handleEditDare = async (dare) => {
    if (!dare.text.trim()) return;
    
    try {
      await removeCustomDare(selectedPack.name, dare.id);
      const success = await addCustomDare(selectedPack.name, dare.text);
      if (success) {
        const updatedDares = await getCustomDares(selectedPack.name);
        setCustomDares(updatedDares);
        setEditingDare(null);
      }
    } catch (error) {
      console.error('Error editing dare:', error);
      Alert.alert('Error', 'Failed to edit the dare. Please try again.');
    }
  };
  
  const handleSelectPack = useCallback(
    debounce(async (pack) => {
      try {
        console.log('Pack selected:', pack.name);
        if (modalVisible) return;
        const now = Date.now();
        if (now - lastTap < 300) return;
        setLastTap(now);
        setSelectedPack(pack);
        setDareCount(5);
        setModalVisible(true);
        setTimeout(() => {
          setIsFlipped(true);
        }, Platform.OS === 'android' ? 50 : 100);
        
        try {
          const dares = await getPreviewDares(pack);
          setPreviewDares(dares);
        } catch (error) {
          console.error('Error loading preview dares:', error);
        }
      } catch (error) {
        console.error('Error in handleSelectPack:', error);
      }
    }, 300, { leading: true, trailing: false }),
    [modalVisible, lastTap, getPreviewDares]
  );
  
  const handleConfirmDares = useCallback(() => {
    setShowDealAnimation(true);
    
    setTimeout(() => {
      navigation.navigate('DareOnlyScreen', { 
        packName: selectedPack.name, 
        dareCount,
        ...(Platform.OS === 'android' ? {
          animation: 'slide_from_right'
        } : {})
      });
      setModalVisible(false);
      setIsFlipped(false);
      setShowDealAnimation(false);
      setShowCustomDareInput(false);
      setCustomDareText('');
    }, Platform.OS === 'android' ? 800 : 1000);
  }, [selectedPack, dareCount, navigation]);
  
  const handleBack = useCallback(() => {
    if (Platform.OS === 'android') {
      Keyboard.dismiss();
    }
    
    setIsFlipped(false);
    setTimeout(() => {
      setModalVisible(false);
      setShowPreview(false);
      setShowCustomDareInput(false);
      setCustomDareText('');
    }, Platform.OS === 'android' ? 600 : 800);
  }, []);

  const handleTitleLongPress = () => {
    const timer = setTimeout(() => {
      setShowDareCounts(prev => !prev);
      
      try {
        if (Platform.OS === 'ios') {
          const ReactNative = require('react-native');
          if (ReactNative.Haptics) {
            ReactNative.Haptics.impactAsync(ReactNative.Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (Platform.OS === 'android') {
          const { Vibration } = require('react-native');
          Vibration.vibrate(100);
        }
      } catch (error) {
        console.log('Haptic feedback error:', error);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  };

  const packs = [
    {
      name: 'Family Friendly',
      image: require('../assets/DaresOnly/familyfun.jpg'),
      description: 'Fun for the whole family! Dares suitable for all ages.',
      dares: require('../Packs/DaresOnly/family_friendly.json'),
      isPremium: false
    },
    {
      name: 'IceBreakers',
      image: require('../assets/DaresOnly/icebreakers.jpg'),
      description: 'More of a Truth than a dare, just simple questions to learn about one another.',
      dares: require('../Packs/DaresOnly/icebreakers.json'),
      isPremium: false
    },
    {
      name: 'Out In Public',
      image: require('../assets/DaresOnly/public.jpg'),
      description: 'Dares that involve interactions in social settings.',
      dares: require('../Packs/DaresOnly/out_in_public.json'),
      isPremium: false
    },
    {
      name: 'Music Mania',
      image: require('../assets/DaresOnly/music.jpg'),
      description: 'For music lovers, dares involve singing, dancing, or performing to your favorite tunes.',
      dares: require('../Packs/DaresOnly/music_mania.json'),
      isPremium: false
    },
    {
      name: 'Office Fun',
      image: require('../assets/DaresOnly/office.jpg'),
      description: 'Lighten up the workday with office-appropriate dares that build teamwork and camaraderie.',
      dares: require('../Packs/DaresOnly/office_fun.json'),
      isPremium: false
    },
    {
      name: 'Adventure',
      image: require('../assets/DaresOnly/adventure.jpg'),
      description: 'Challenge your limits with thrilling and adventurous dares perfect for the fearless.',
      dares: require('../Packs/DaresOnly/adventure_seekers.json'),
      isPremium: false
    },
    {
      name: 'Couples',
      image: require('../assets/DaresOnly/couples.jpg'),
      description: 'Strengthen your bond with fun and romantic dares.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/couples.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'Bar',
      image: require('../assets/DaresOnly/bar.jpg'),
      description: 'Night out? Spice it up with these bar-themed dares. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/bar.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'House Party',
      image: require('../assets/DaresOnly/houseparty.jpg'),
      description: 'Wanting to make the house party even more crazy? This pack is for you!',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/house_party.json'),
      isPremium: true,
      price: '3.99'
    },
    {
      name: 'Spicy',
      image: require('../assets/DaresOnly/spicy.jpg'),
      description: 'Turn up the heat with these daring challenges. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/spicy.json'),
      isPremium: true,
      price: '3.99'
    },
  ];

  const renderItem = useCallback(({ item, index }) => {
    const animationDelay = index * 100;
    
    const isPurchased = purchaseStates[item.name] === true;
    const isCurrentlyPurchasing = isPurchasing(item.name);
    
    return (
      <Animated.View 
        style={{
          opacity: cardsAnimation,
          transform: [
            {
              translateY: cardsAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }
          ]
        }}
      >
        <PackCard
          item={item}
          packCounts={packCounts}
          customCounts={customCounts}
          onPress={handleSelectPack}
          showDareCounts={showDareCounts}
          isPurchased={isPurchased}
          price={item.isPremium ? item.price : null}
          onPurchase={handlePurchase}
          isPurchasing={isCurrentlyPurchasing}
        />
      </Animated.View>
    );
  }, [packCounts, customCounts, handleSelectPack, cardsAnimation, showDareCounts, purchaseStates, handlePurchase, isPurchasing]);

  const renderEverythingBundle = () => {
    const isEverythingBundlePurchased = purchaseStates[PRODUCT_IDS.EVERYTHING_BUNDLE] === true;
    const isBundlePurchasing = isPurchasing('everything_bundle');
    
    if (isEverythingBundlePurchased) {
      return (
        <View style={styles.everythingBundlePurchasedBar}>
          <Text style={styles.bundlePurchasedBarText}>Everything Bundle Was Purchased</Text>
        </View>
      );
    }
    
    return (
      <TouchableOpacity 
        style={styles.everythingBundleButton}
        onPress={handleEverythingBundlePurchase}
        disabled={isBundlePurchasing}
        activeOpacity={0.8}
      >
        <ImageBackground 
          source={require('../assets/DaresOnly/spicy.jpg')}
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
              <Text style={styles.bundleSubtitle}>All Premium Dare Packs + Future Updates</Text>
            </View>
            
            <View style={styles.bundlePriceContainer}>
              <Text style={styles.bundlePrice}>$49.99</Text>
              <Text style={styles.bundleSavings}>Save over 80%</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

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
                  <Text style={styles.benefitText}>Permanent access to all dares</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                  <Text style={styles.benefitText}>Available on all your devices</Text>
                </View>
                <View style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={16} color="#00C853" />
                  <Text style={styles.benefitText}>Create custom dares</Text>
                </View>
                {pendingProduct.name === 'Everything Bundle' && (
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

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../assets/redfelt.jpg')} 
        style={styles.backgroundImage}
        fadeDuration={Platform.OS === 'android' ? 300 : 0}
      >
        <View style={styles.feltOverlay} />
        <View style={styles.mainContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                navigation.dispatch(CommonActions.goBack());
              }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFD700" />
            </TouchableOpacity>
            
            <View style={styles.headerSpacer} />
            
            <View style={styles.titleContainerCentered}>
              <Pressable
                onLongPress={handleTitleLongPress}
                delayLongPress={1000}
                style={styles.titlePressable}
              >
                <Text style={styles.title}>Dare Pack</Text>
                <View style={styles.titleDecoration}>
                  <View style={styles.titleLine} />
                  <Ionicons name="diamond" size={24} color="#FFD700" />
                  <View style={styles.titleLine} />
                </View>
                {showDareCounts && (
                  <Text style={styles.developerModeText}>Developer Mode</Text>
                )}
              </Pressable>
            </View>
            
            <View style={styles.headerSpacer} />
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFD700" />
              <Animatable.Text 
                animation="pulse" 
                iterationCount="infinite" 
                style={styles.loadingText}
              >
                Loading dare packs...
              </Animatable.Text>
            </View>
          ) : (
            <FlatList
              data={visiblePacks} // NEW: Use visible packs instead of all packs
              renderItem={renderItem}
              keyExtractor={item => item.name}
              numColumns={COLUMNS}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              ListHeaderComponent={
                <Animatable.View 
                  animation="fadeIn" 
                  duration={800} 
                  delay={300}
                >
                  <Text style={styles.instruction}>
                    Select a dare pack to begin
                  </Text>
                </Animatable.View>
              }
              ListFooterComponent={
                <View style={styles.footerContainer}>
                  {renderEverythingBundle()}
                  <View style={{ height: 20 }} />
                </View>
              }
              initialNumToRender={Platform.OS === 'android' ? 4 : 6}
              maxToRenderPerBatch={Platform.OS === 'android' ? 2 : 4}
              windowSize={Platform.OS === 'android' ? 3 : 5}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>

        <Modal
          animationType={Platform.OS === 'android' ? "fade" : "fade"}
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleBack}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
            <Animated.View 
              style={[
                styles.centeredView,
                {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                }
              ]}
            >
              <Animatable.View
                animation={isFlipped ? 'fadeIn' : 'fadeOut'}
                duration={Platform.OS === 'android' ? 200 : 300}
                style={[styles.modalContainer, { width: getModalWidth(), maxWidth: getModalMaxWidth() }]}
                useNativeDriver
              >
                <Animatable.View
                  animation={isFlipped ? 'flipInY' : 'flipOutY'}
                  duration={Platform.OS === 'android' ? 500 : 600}
                  style={[styles.modalView]}
                  useNativeDriver
                >
                  <Animated.View
                    style={[
                      styles.modalContent,
                      {
                        opacity: contentOpacity,
                        transform: [{
                          scale: contentOpacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.95, 1]
                          })
                        }]
                      }
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.closeButton}
                      onPress={handleBack}
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#FFD700" />
                    </TouchableOpacity>

                    <Text style={styles.modalTitle}>{selectedPack?.name}</Text>
                    <View style={styles.casinoSeparator}>
                      <View style={styles.separatorLine} />
                      <Ionicons name="diamond" size={16} color="#FFD700" />
                      <View style={styles.separatorLine} />
                    </View>
                    {showDareCounts && (
                      <Text style={styles.modalSubtitle}>
                        {(packCounts[selectedPack?.name] || 0) + (customCounts[selectedPack?.name] || 0)} Dares Available
                        {customCounts[selectedPack?.name] > 0 && ` (${customCounts[selectedPack?.name]} Custom)`}
                      </Text>
                    )}
                    <Text style={styles.modalDescription}>{selectedPack?.description}</Text>

                    <View style={styles.customDareButtonsContainer}>
                      <TouchableOpacity
                        style={[styles.customDareButton, showCustomDareInput && styles.customDareButtonActive]}
                        onPress={() => {
                          setShowCustomDareInput(!showCustomDareInput);
                          if (showCustomDaresModal) setShowCustomDaresModal(false);
                          if (Platform.OS === 'android' && showCustomDareInput) {
                            Keyboard.dismiss();
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.customDareButtonText}>
                          {showCustomDareInput ? 'Cancel Custom Dare' : 'Create Custom Dare'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.viewCustomButton, showCustomDaresModal && styles.viewCustomButtonActive]}
                        onPress={async () => {
                          if (Platform.OS === 'android') {
                            Keyboard.dismiss();
                          }
                          try {
                            const dares = await getCustomDares(selectedPack.name);
                            setCustomDares(dares);
                            setModalVisible(false);
                            setTimeout(() => {
                              setShowCustomDaresModal(true);
                            }, 100);
                          } catch (error) {
                            console.error('Error loading custom dares:', error);
                            Alert.alert('Error', 'Failed to load custom dares');
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.viewCustomButtonText}>View Custom Dares</Text>
                      </TouchableOpacity>
                    </View>

                    {showCustomDareInput && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={Platform.OS === 'android' ? 200 : 300}
                        style={styles.customDareInputContainer}
                      >
                        <TextInput
                          style={styles.customDareInput}
                          value={customDareText}
                          onChangeText={setCustomDareText}
                          placeholder="Type your custom dare here..."
                          multiline
                          maxLength={200}
                          autoFocus={!Platform.OS === 'android'}
                          blurOnSubmit={Platform.OS === 'android'}
                          returnKeyType="done"
                        />
                        <TouchableOpacity
                          style={[
                            styles.createDareButton,
                            !customDareText.trim() && styles.createDareButtonDisabled
                          ]}
                          onPress={handleCreateCustomDare}
                          disabled={!customDareText.trim()}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.createDareButtonText}>Add Custom Dare</Text>
                        </TouchableOpacity>
                      </Animatable.View>
                    )}

                    {customDareSuccess && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={300}
                        style={styles.successMessage}
                      >
                        <Text style={styles.successText}>✓ Custom Dare Added!</Text>
                      </Animatable.View>
                    )}

                    <TouchableOpacity
                      style={[styles.previewButton, showPreview && styles.previewButtonActive]}
                      onPress={() => setShowPreview(!showPreview)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.previewButtonText}>
                        {showPreview ? 'Hide Preview' : 'Show Preview'}
                      </Text>
                    </TouchableOpacity>

                    {showPreview && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={Platform.OS === 'android' ? 200 : 300}
                        style={styles.previewContainer}
                      >
                        {previewDares.map((dare, index) => (
                          <Text key={index} style={styles.previewDare}>• {dare}</Text>
                        ))}
                      </Animatable.View>
                    )}

                    <View style={styles.counterContainer}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.max(dareCount - 1, 1))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <View style={styles.counterTextContainer}>
                        <Text style={styles.counterText}>{dareCount}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.min(dareCount + 1, 10))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.buttonClose, styles.dealDaresButton]}
                      onPress={handleConfirmDares}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dealDaresButtonText}>Deal Dares</Text>
                      <Ionicons name="card" size={20} color="white" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  </Animated.View>
                </Animatable.View>
              </Animatable.View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal
          visible={showCustomDaresModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setShowCustomDaresModal(false);
            setTimeout(() => {
              setModalVisible(true);
              setIsFlipped(true);
            }, 300);
          }}
          statusBarTranslucent={Platform.OS === 'android'}
        >
          <TouchableWithoutFeedback onPress={Platform.OS === 'android' ? Keyboard.dismiss : undefined}>
            <TouchableOpacity 
              style={styles.centeredView} 
              activeOpacity={1} 
              onPress={() => {
                if (Platform.OS === 'android') {
                  Keyboard.dismiss();
                }
              }}
            >
              <Animatable.View
                animation="slideInUp"
                duration={Platform.OS === 'android' ? 200 : 300}
                style={[styles.modalView, styles.customDaresModalView, { width: getModalWidth(), maxWidth: getModalMaxWidth() }]}
              >
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      Keyboard.dismiss();
                    }
                    setShowCustomDaresModal(false);
                    setTimeout(() => {
                      setModalVisible(true);
                      setIsFlipped(true);
                    }, 300);
                  }}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Ionicons name="close-circle" size={24} color="#FFD700" />
                </TouchableOpacity>

                <Text style={styles.modalTitle}>Custom Dares</Text>
                <View style={styles.casinoSeparator}>
                  <View style={styles.separatorLine} />
                  <Ionicons name="diamond" size={16} color="#FFD700" />
                  <View style={styles.separatorLine} />
                </View>
                
                {customDares.length === 0 ? (
                  <Text style={styles.noDaresText}>No custom dares yet</Text>
                ) : (
                  <ScrollView 
                    style={styles.daresList}
                    showsVerticalScrollIndicator={true}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {customDares.map((dare) => (
                      <View key={dare.id} style={styles.dareItem}>
                        {editingDare?.id === dare.id ? (
                          <TextInput
                            style={styles.editDareInput}
                            value={editingDare.text}
                            onChangeText={(text) => setEditingDare({...editingDare, text})}
                            multiline
                            autoFocus={!Platform.OS === 'android'}
                            returnKeyType="done"
                            blurOnSubmit={Platform.OS === 'android'}
                          />
                        ) : (
                          <Text style={styles.dareText}>{dare.text}</Text>
                        )}
                        <View style={styles.dareActions}>
                          {editingDare?.id === dare.id ? (
                            <>
                              <TouchableOpacity
                                style={styles.saveButton}
                                onPress={() => handleEditDare(editingDare)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="checkmark" size={20} color="#4CAF50" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                  if (Platform.OS === 'android') {
                                    Keyboard.dismiss();
                                  }
                                  setEditingDare(null);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="close" size={20} color="#666" />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => setEditingDare(dare)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="pencil" size={20} color="#2196F3" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => {
                                  Alert.alert(
                                    'Delete Dare',
                                    'Are you sure you want to delete this dare?',
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                          await removeCustomDare(selectedPack.name, dare.id);
                                          setCustomDares(dares => dares.filter(d => d.id !== dare.id));
                                          const newCount = await getCustomDareCount(selectedPack.name);
                                          setCustomCounts(prev => ({
                                            ...prev,
                                            [selectedPack.name]: newCount
                                          }));
                                        }
                                      }
                                    ]
                                  );
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="trash" size={20} color="#ff0000" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Animatable.View>
            </TouchableOpacity>
          </TouchableWithoutFeedback>
        </Modal>

        <PurchaseDialog />

        {showToast && (
          <Animated.View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  feltOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  mainContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  headerSpacer: {
    width: 40,
    height: 30,
  },
  titleContainerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 25,
  },
  titlePressable: {
    alignItems: 'center',
  },
  title: {
    fontSize: scaleFontSize(32),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  titleLine: {
    height: 1,
    width: 50,
    backgroundColor: '#FFD700',
    marginHorizontal: 8,
  },
  developerModeText: {
    color: '#ff4500',
    fontSize: 12,
    marginTop: 3,
  },
  instruction: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    fontWeight: '500',
  },
  gridContent: {
    paddingHorizontal: GRID_PADDING,
    paddingBottom: 30,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_MARGIN,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginVertical: 8,
  },
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  purchasedCard: {
    borderColor: '#00C853',
    borderWidth: 2,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  cardImageStyle: {
    borderRadius: 10,
    resizeMode: 'cover',
  },
  cardOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 10,
    borderRadius: 5,
  },
  packName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  packDareCount: {
    color: '#FFD700',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFD700',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 10,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    padding: 10,
    height: 'auto',
  },
  modalView: {
    backgroundColor: '#1a1a1a',
    borderRadius: IS_TABLET ? 25 : 20,
    padding: IS_TABLET ? 30 : 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 10,
  },
  modalTitle: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  casinoSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    marginBottom: 15,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FFD700',
    marginHorizontal: 10,
  },
  modalSubtitle: {
    color: '#FFD700',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDescription: {
    color: 'white',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  customDareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  customDareButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  customDareButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  customDareButtonText: {
    color: '#FFD700',
    fontWeight: '500',
    fontSize: 12,
  },
  viewCustomButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginLeft: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  viewCustomButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  viewCustomButtonText: {
    color: '#FFD700',
    fontWeight: '500',
    fontSize: 12,
  },
  customDareInputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  customDareInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: 'white',
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 10,
  },
  createDareButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  createDareButtonDisabled: {
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
  },
  createDareButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  successMessage: {
    backgroundColor: 'rgba(0, 200, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    alignItems: 'center',
  },
  successText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  previewButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  previewButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  previewButtonText: {
    color: '#FFD700',
    fontWeight: '500',
  },
  previewContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  previewDare: {
    color: 'white',
    marginBottom: 8,
    lineHeight: 20,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
    padding: 8,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  counterButtonText: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  counterTextContainer: {
    paddingHorizontal: 20,
  },
  counterText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  buttonClose: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dealDaresButton: {
    backgroundColor: '#FFD700',
  },
  dealDaresButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  customDaresModalView: {
    height: '80%',
    alignItems: 'stretch',
  },
  daresList: {
    width: '100%',
    marginTop: 10,
    flex: 1,
  },
  dareItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  dareText: {
    color: 'white',
    flex: 1,
  },
  editDareInput: {
    color: 'white',
    flex: 1,
    borderWidth: 1,
    borderColor: '#2196F3',
    padding: 8,
    borderRadius: 5,
    marginRight: 8,
  },
  dareActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 5,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 5,
    marginLeft: 8,
  },
  saveButton: {
    padding: 5,
    marginLeft: 8,
  },
  cancelButton: {
    padding: 5,
    marginLeft: 8,
  },
  noDaresText: {
    color: 'gray',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  priceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    zIndex: 2,
  },
  priceText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ageRestrictedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'red',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  ageRestrictedText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  purchasedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#00C853',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 3,
  },
  purchasedText: {
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

  // Toast styles
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

  // Footer container for Everything Bundle
  footerContainer: {
    paddingHorizontal: 8,
    marginTop: 15,
  },

  // Everything Bundle styles
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

  // Simple Everything Bundle Purchased Bar
  everythingBundlePurchasedBar: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#00C853',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  bundlePurchasedBarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
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

export default DarePackSelectionScreen;