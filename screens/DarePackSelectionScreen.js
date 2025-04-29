import React, { useState, useEffect, useCallback, memo } from 'react';
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
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useSettings } from '../Context/Settings';
import { useCustomDares } from '../Context/CustomDaresContext';
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (SCREEN_WIDTH - (CARD_MARGIN * 4)) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

const PackCard = memo(({ item, packCounts, customCounts, onPress }) => {
  const totalCount = (packCounts[item.name] || 0) + (customCounts[item.name] || 0);
  
  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(item)}
        activeOpacity={Platform.OS === 'android' ? 0.7 : 0.9}
      >
        <ImageBackground 
          source={item.image} 
          style={styles.cardImage}
          imageStyle={styles.cardImageStyle}
          fadeDuration={Platform.OS === 'android' ? 300 : 0}
        >
          <View style={styles.cardOverlay}>
            <Text 
              style={styles.packName}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
            <Text style={styles.packDareCount}>
              {totalCount} Dares {customCounts[item.name] > 0 && `(${customCounts[item.name]} Custom)`}
            </Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </View>
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

  // Handle Android back button
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
          return false;
        };

        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [modalVisible, showCustomDaresModal])
  );

  useEffect(() => {
    if (isFlipped) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300, // Faster on Android
        delay: Platform.OS === 'android' ? 300 : 400,
        useNativeDriver: true,
      }).start();
    } else {
      contentOpacity.setValue(0);
    }
  }, [isFlipped]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Screen focused');
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const loadCounts = async () => {
      setIsLoading(true);
      const counts = {};
      const customCounts = {};
      
      try {
        // On Android, process in smaller batches to prevent ANR
        if (Platform.OS === 'android') {
          const batchSize = 3;
          for (let i = 0; i < packs.length; i += batchSize) {
            const batchPacks = packs.slice(i, i + batchSize);
            for (const pack of batchPacks) {
              counts[pack.name] = Array.isArray(pack.dares) ? pack.dares.length : 0;
              customCounts[pack.name] = await getCustomDareCount(pack.name);
            }
          }
        } else {
          // Original iOS implementation
          for (const pack of packs) {
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
 
    loadCounts();
  }, []);

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
    
    // Dismiss keyboard on Android
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
        // Slight delay before flip animation - shorter on Android
        setTimeout(() => {
          setIsFlipped(true);
        }, Platform.OS === 'android' ? 50 : 100);
        
        // Load preview dares
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
        // Add platform-specific navigation options
        ...(Platform.OS === 'android' ? {
          animation: 'slide_from_right'
        } : {})
      });
      setModalVisible(false);
      setIsFlipped(false);
      setShowDealAnimation(false);
      setShowCustomDareInput(false);
      setCustomDareText('');
    }, Platform.OS === 'android' ? 800 : 1000); // Slightly faster on Android
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
    }, Platform.OS === 'android' ? 600 : 800); // Slightly faster on Android
  }, []);

  const packs = [
    {
      name: 'Family Friendly',
      image: require('../assets/DaresOnly/familyfun.jpg'),
      description: 'Fun for the whole family! Dares suitable for all ages.',
      dares: require('../Packs/DaresOnly/family_friendly.json')
    },
    {
      name: 'IceBreakers',
      image: require('../assets/DaresOnly/icebreakers.jpg'),
      description: 'More of a Truth than a dare, just simple questions to learn about one another.',
      dares: require('../Packs/DaresOnly/icebreakers.json')
    },
    {
      name: 'Couples',
      image: require('../assets/DaresOnly/couples.jpg'),
      description: 'Strengthen your bond with fun and romantic dares.',
      dares: require('../Packs/DaresOnly/couples.json')
    },
    {
      name: 'Out In Public',
      image: require('../assets/DaresOnly/public.jpg'),
      description: 'Dares that involve interactions in social settings.',
      dares: require('../Packs/DaresOnly/out_in_public.json')
    },
    {
      name: 'Music Mania',
      image: require('../assets/DaresOnly/music.jpg'),
      description: 'For music lovers, dares involve singing, dancing, or performing to your favorite tunes.',
      dares: require('../Packs/DaresOnly/music_mania.json')
    },
    {
      name: 'Office Fun',
      image: require('../assets/DaresOnly/office.jpg'),
      description: 'Lighten up the workday with office-appropriate dares that build teamwork and camaraderie.',
      dares: require('../Packs/DaresOnly/office_fun.json')
    },
    {
      name: 'Adventure Seekers',
      image: require('../assets/DaresOnly/adventure.jpg'),
      description: 'Challenge your limits with thrilling and adventurous dares perfect for the fearless.',
      dares: require('../Packs/DaresOnly/adventure_seekers.json')
    },
    {
      name: 'Bar',
      image: require('../assets/DaresOnly/bar.jpg'),
      description: 'Night out? Spice it up with these bar-themed dares. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/bar.json')
    },
    {
      name: 'Spicy',
      image: require('../assets/DaresOnly/spicy.jpg'),
      description: 'Turn up the heat with these daring challenges. 18+ only.',
      ageRestricted: true,
      dares: require('../Packs/DaresOnly/spicy.json')
    },
  ];

  const renderItem = useCallback(({ item }) => (
    <PackCard
      item={item}
      packCounts={packCounts}
      customCounts={customCounts}
      onPress={handleSelectPack}
    />
  ), [packCounts, customCounts, handleSelectPack]);

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={require('../assets/redfelt.jpg')} 
        style={styles.backgroundImage}
        fadeDuration={Platform.OS === 'android' ? 300 : 0}
      >
        <View style={styles.mainContent}>
          {/* Header Section */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Dare Pack</Text>
            </View>
          </View>
  
          {/* Grid Section */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
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
              data={packs}
              renderItem={renderItem}
              keyExtractor={item => item.name}
              numColumns={2}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={styles.row}
              ListHeaderComponent={
                <Text style={styles.instruction}>
                  Select a dare pack to begin
                </Text>
              }
              ListFooterComponent={<View style={{ height: 20 }} />}
              initialNumToRender={Platform.OS === 'android' ? 4 : 6}
              maxToRenderPerBatch={Platform.OS === 'android' ? 2 : 4}
              windowSize={Platform.OS === 'android' ? 3 : 5}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>
  
        {/* Pack Details Modal */}
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
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                }
              ]}
            >
              <Animatable.View
                animation={isFlipped ? 'fadeIn' : 'fadeOut'}
                duration={Platform.OS === 'android' ? 200 : 300}
                style={[styles.modalContainer]}
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
                      <Ionicons name="close-circle" size={24} color="black" />
                    </TouchableOpacity>
  
                    <Text style={styles.modalTitle}>{selectedPack?.name}</Text>
                    <Text style={styles.modalSubtitle}>
                      {(packCounts[selectedPack?.name] || 0) + (customCounts[selectedPack?.name] || 0)} Dares Available
                      {customCounts[selectedPack?.name] > 0 && ` (${customCounts[selectedPack?.name]} Custom)`}
                    </Text>
                    <Text style={styles.modalDescription}>{selectedPack?.description}</Text>
  
                    {/* Custom Dare Buttons */}
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
  
                    {/* Custom Dare Input */}
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
                          autoFocus={!Platform.OS === 'android'} // Avoid autofocus on Android
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
  
                    {/* Success Message */}
                    {customDareSuccess && (
                      <Animatable.View
                        animation="fadeIn"
                        duration={300}
                        style={styles.successMessage}
                      >
                        <Text style={styles.successText}>✓ Custom Dare Added!</Text>
                      </Animatable.View>
                    )}
  
                    {/* Preview Section */}
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
  
                    {/* Counter Section */}
                    <View style={styles.counterContainer}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.max(dareCount - 1, 1))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterText}>{dareCount}</Text>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => setDareCount(Math.min(dareCount + 1, 25))}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
  
                    <TouchableOpacity
                      style={[styles.buttonClose, styles.confirmButton]}
                      onPress={handleConfirmDares}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.confirmButtonText}>Deal Cards</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </Animatable.View>
              </Animatable.View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Modal>
  
        {/* Custom Dares Management Modal */}
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
                style={[styles.modalView, styles.customDaresModalView]}
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
                  <Ionicons name="close-circle" size={24} color="black" />
                </TouchableOpacity>
  
                <Text style={styles.modalTitle}>Custom Dares</Text>
                
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
                            autoFocus={!Platform.OS === 'android'} // Avoid autofocus on Android
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
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  mainContent: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: -20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: -45,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5, // Less shadow on Android
      }
    }),
  },
  instruction: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 15,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3, // Less shadow on Android
      }
    }),
  },
  gridContent: {
    padding: CARD_MARGIN,
  },
  row: {
    justifyContent: 'space-between',
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: CARD_MARGIN * 2,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      }
    }),
  },
  card: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageStyle: {
    borderRadius: 15,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  packName: {
    color: 'white',
    fontSize: Platform.OS === 'android' ? 14 : 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  packDescription: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  packDareCount: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
  modalContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: Platform.OS === 'android' ? 25 : 35,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      }
    }),
    width: '90%',
    maxWidth: 400,
    transform: [{ perspective: 1000 }],
    backfaceVisibility: 'hidden',
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'white',
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: Platform.OS === 'android' ? 16 : 18,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
    paddingHorizontal: 10,
  },
  customDareButtonsContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  customDareButton: {
    flex: 0.48,
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 15,
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
  customDareButtonActive: {
    backgroundColor: '#f57c00',
  },
  customDareButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: Platform.OS === 'android' ? 14 : 16,
  },
  viewCustomButton: {
    flex: 0.48,
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 15,
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
  viewCustomButtonActive: {
    backgroundColor: '#1976d2',
  },
  viewCustomButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: Platform.OS === 'android' ? 14 : 16,
  },
  customDaresModalView: {
    maxHeight: '80%',
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      }
    }),
  },
  daresList: {
    width: '100%',
    maxHeight: '80%',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  dareItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  dareText: {
    flex: 1,
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#333',
    paddingRight: 10,
    lineHeight: Platform.OS === 'android' ? 20 : 22,
  },
  dareActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
  },
  editButton: {
    padding: 8,
    marginRight: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 15,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 15,
  },
  saveButton: {
    padding: 8,
    marginRight: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 15,
  },
  cancelButton: {
    padding: 8,
    backgroundColor: 'rgba(158, 158, 158, 0.1)',
    borderRadius: 15,
  },
  editDareInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 40,
  },
  noDaresText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  customDareInputContainer: {
    width: '100%',
    marginVertical: 10,
    padding: 10,
  },
  customDareInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    minHeight: Platform.OS === 'android' ? 60 : 80, // Smaller on Android
    width: '100%',
    textAlignVertical: 'top',
    fontSize: Platform.OS === 'android' ? 14 : 16,
  },
  createDareButton: {
    backgroundColor: '#4CAF50',
    padding: Platform.OS === 'android' ? 8 : 10,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
    ...Platform.select({
      android: {
        elevation: 3,
      }
    }),
  },
  createDareButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  createDareButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  successMessage: {
    position: 'absolute',
    top: 10,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 20,
    zIndex: 2,
    ...Platform.select({
      android: {
        elevation: 6,
      }
    }),
  },
  successText: {
    color: 'white',
    fontWeight: 'bold',
  },
  previewButton: {
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 15,
    marginVertical: 10,
    width: '80%',
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
  previewButtonActive: {
    backgroundColor: '#388e3c',
  },
  previewButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: Platform.OS === 'android' ? 14 : 16,
  },
  previewContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  previewDare: {
    fontSize: Platform.OS === 'android' ? 13 : 14,
    marginVertical: 5,
    color: '#333',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  counterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ddd',
    marginHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  counterButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  counterText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 20,
    marginTop: 10,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: Platform.OS === 'android' ? 14 : 16,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    padding: 5,
  },
  buttonClose: {
    borderRadius: 20,
    padding: 10,
    ...Platform.select({
      ios: {
        elevation: 2,
      },
      android: {
        elevation: 2,
      }
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 5,
      },
      android: {
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 3,
      }
    }),
  },
});

export default DarePackSelectionScreen;