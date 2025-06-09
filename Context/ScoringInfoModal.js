import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  BackHandler, 
  Platform,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const ScoringInfoModal = ({ visible, onClose, timerConfig, packStats }) => {
  // Handle Android back button
  useEffect(() => {
    if (Platform.OS === 'android' && visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      
      return () => backHandler.remove();
    }
  }, [visible, onClose]);

  // Get timer configurations for display
  const getTimerConfigs = () => {
    return [
      { label: 'Quick (15s)', baseScore: 200, timeLimit: 15 },
      { label: 'Standard (30s)', baseScore: 150, timeLimit: 30 },
      { label: 'Relaxed (45s)', baseScore: 100, timeLimit: 45 },
      { label: 'Extended (60s)', baseScore: 50, timeLimit: 60 }
    ];
  };

  // Calculate question count multiplier examples
  const getQuestionMultiplierExamples = () => {
    return [
      { questions: 3, multiplier: 1.5, description: 'Short games = Higher dare values' },
      { questions: 5, multiplier: 1.0, description: 'Baseline' },
      { questions: 10, multiplier: 0.8, description: 'Long games = Lower dare values' }
    ];
  };

  const InfoCard = ({ children, icon, title, accent = false }) => (
    <View style={[styles.infoCard, accent && styles.accentCard]}>
      <View style={styles.cardHeader}>
        {icon && <Ionicons name={icon} size={20} color="#FFD700" style={styles.cardIcon} />}
        <Text style={[styles.cardTitle, accent && styles.accentCardTitle]}>{title}</Text>
      </View>
      {children}
    </View>
  );

  const ScoreRow = ({ label, value, isSubText = false, color = 'white' }) => (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreLabel, isSubText && styles.subText, { color }]}>{label}</Text>
      <Text style={[styles.scoreValue, isSubText && styles.subText, { color }]}>{value}</Text>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView style={styles.centeredView}>
        <StatusBar backgroundColor="rgba(0, 0, 0, 0.8)" translucent={true} />
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.9)', 'rgba(26, 35, 126, 0.9)']}
          style={styles.gradientBackground}
        >
          <View style={styles.modalView}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={32} color="#FFD700" />
            </TouchableOpacity>
            
            <View style={styles.header}>
              <Ionicons name="trophy" size={32} color="#FFD700" style={styles.headerIcon} />
              <Text style={styles.modalTitle}>Scoring System</Text>
            </View>
            
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollViewContent}
              overScrollMode={Platform.OS === 'android' ? 'never' : 'always'}
            >
              {/* Trivia Scoring */}
              <InfoCard icon="checkmark-circle" title="Trivia Question Scoring">
                <Text style={styles.sectionDescription}>
                  Points earned for correct answers based on timer setting:
                </Text>
                <View style={styles.timerGrid}>
                  {getTimerConfigs().map((config, index) => (
                    <View key={index} style={[styles.timerCard, 
                      timerConfig?.baseScore === config.baseScore && styles.currentTimerCard
                    ]}>
                      <Text style={styles.timerLabel}>{config.label}</Text>
                      <Text style={styles.timerScore}>{config.baseScore} pts</Text>
                      <Text style={styles.timerBonus}>+2 pts/sec remaining</Text>
                    </View>
                  ))}
                </View>
              </InfoCard>

              {/* Dynamic Dare Scoring */}
              <InfoCard icon="flash" title="Dynamic Dare Scoring" accent={true}>
                <Text style={styles.sectionDescription}>
                  Wrong answers unlock dares with smart point calculation:
                </Text>
                
                {/* Base Calculation */}
                <View style={styles.formulaCard}>
                  <Text style={styles.formulaTitle}>Base Dare Points</Text>
                  <Text style={styles.formulaText}>Timer Base Score × 0.75</Text>
                  <Text style={styles.formulaExample}>
                    Example: 150 pts × 0.75 = 112 base dare points
                  </Text>
                </View>

                {/* Question Count Multiplier */}
                <View style={styles.formulaCard}>
                  <Text style={styles.formulaTitle}>📏 Game Length Bonus</Text>
                  <Text style={styles.formulaText}>Adjusts for total questions in game</Text>
                  {getQuestionMultiplierExamples().map((example, index) => (
                    <ScoreRow 
                      key={index}
                      label={`${example.questions} questions:`}
                      value={`${example.multiplier}x (${example.description})`}
                      isSubText={true}
                      color="#4CAF50"
                    />
                  ))}
                </View>

                {/* Catch-up Bonus */}
                <View style={styles.formulaCard}>
                  <Text style={styles.formulaTitle}>⚡ Catch-up Bonus</Text>
                  <Text style={styles.formulaText}>Helps trailing players compete</Text>
                  <Text style={styles.formulaExample}>
                    (Average Score - Your Score) × 0.2
                  </Text>
                  <ScoreRow 
                    label="Behind by 100 pts:"
                    value="+20 bonus points"
                    isSubText={true}
                    color="#4CAF50"
                  />
                </View>

                {/* Streak Multiplier */}
                <View style={styles.formulaCard}>
                  <Text style={styles.formulaTitle}>🔥 Streak Multiplier</Text>
                  <Text style={styles.formulaText}>Consecutive completed dares</Text>
                  <ScoreRow label="1st dare:" value="1.0x (baseline)" isSubText={true} />
                  <ScoreRow label="2nd consecutive:" value="1.25x (+25%)" isSubText={true} color="#FF9800" />
                  <ScoreRow label="3rd consecutive:" value="1.5x (+50%)" isSubText={true} color="#FF9800" />
                  <ScoreRow label="4th consecutive:" value="1.75x (+75%)" isSubText={true} color="#FF9800" />
                </View>

                {/* Final Formula */}
                <View style={styles.finalFormulaCard}>
                  <Text style={styles.finalFormulaTitle}>🎯 Final Calculation</Text>
                  <Text style={styles.finalFormulaText}>
                    ((Base × Game Length) + Catch-up) × Streak
                  </Text>
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleTitle}>Example Scenario:</Text>
                    <ScoreRow label="Base (Standard):" value="112 pts" isSubText={true} />
                    <ScoreRow label="Short game (3Q):" value="×1.5 = 168 pts" isSubText={true} color="#4CAF50" />
                    <ScoreRow label="Catch-up bonus:" value="+20 pts" isSubText={true} color="#4CAF50" />
                    <ScoreRow label="Streak (3x):" value="×1.5 = 282 pts" isSubText={true} color="#FF9800" />
                    <View style={styles.finalResultRow}>
                      <Text style={styles.finalResultText}>Final Dare Worth: 282 points!</Text>
                    </View>
                  </View>
                </View>
              </InfoCard>

              {/* Game Modes */}
              <InfoCard icon="game-controller" title="Game Modes">
                <View style={styles.modeCard}>
                  <Text style={styles.modeTitle}>🎲 TriviaDare Mode</Text>
                  <Text style={styles.modeDescription}>
                    Wrong answers trigger dares with dynamic scoring
                  </Text>
                </View>
                <View style={styles.modeCard}>
                  <Text style={styles.modeTitle}>🧠 TriviaONLY Mode</Text>
                  <Text style={styles.modeDescription}>
                    Pure trivia - no dares, just knowledge testing
                  </Text>
                </View>
              </InfoCard>

              {/* Pro Tips */}
              <InfoCard icon="bulb" title="Pro Tips">
                <View style={styles.tipItem}>
                  <Ionicons name="rocket" size={16} color="#FFD700" />
                  <Text style={styles.tipText}>Build dare streaks for massive point multipliers</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="trending-up" size={16} color="#4CAF50" />
                  <Text style={styles.tipText}>Trailing players get automatic catch-up bonuses</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="timer" size={16} color="#FF9800" />
                  <Text style={styles.tipText}>Shorter games have higher-value dares</Text>
                </View>
                <View style={styles.tipItem}>
                  <Ionicons name="flash" size={16} color="#E91E63" />
                  <Text style={styles.tipText}>Answer quickly for maximum time bonus</Text>
                </View>
              </InfoCard>
              
              {/* Add padding at bottom for better scrolling */}
              <View style={{ height: Platform.OS === 'android' ? 30 : 20 }} />
            </ScrollView>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '95%',
    maxHeight: Platform.OS === 'android' ? '90%' : '85%',
    backgroundColor: 'rgba(26, 35, 126, 0.95)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      }
    }),
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollViewContent: {
    paddingBottom: 10,
  },
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 15,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  accentCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    flex: 1,
  },
  accentCardTitle: {
    color: '#FFD700',
  },
  sectionDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    lineHeight: 22,
  },
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timerCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  currentTimerCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  timerLabel: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timerScore: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 4,
  },
  timerBonus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  formulaCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
  },
  formulaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 6,
  },
  formulaText: {
    fontSize: 14,
    color: 'white',
    marginBottom: 4,
  },
  formulaExample: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
    marginTop: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  scoreLabel: {
    fontSize: 14,
    color: 'white',
    flex: 1,
  },
  scoreValue: {
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  subText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    paddingLeft: 10,
  },
  finalFormulaCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  finalFormulaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    marginBottom: 8,
  },
  finalFormulaText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  exampleBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 12,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 8,
    textAlign: 'center',
  },
  finalResultRow: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  finalResultText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  modeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    paddingHorizontal: 8,
  },
  tipText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
});

export default ScoringInfoModal;