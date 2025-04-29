const fs = require('fs');
const path = require('path');

const createFiles = () => {
  const baseDir = path.join(__dirname, 'Packs', 'TriviaDare');
  const genericPath = path.join(baseDir, 'GenericPacks');
  const premiumPath = path.join(baseDir, 'PremiumPacks');

  // Create directories if they don't exist
  [genericPath, premiumPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Define all packs and their base filenames
  const files = {
    GenericPacks: [
      'Science',
      'Art',
      'Entertainment',
      'Geography',
      'History',
      'Movie',
      'Music',
      'Sports',
      'Technology'
    ],
    PremiumPacks: [
      'harrypotter',
      'friends',
      'halloweenhorror'
    ]
  };

  const difficulties = ['easy', 'medium', 'hard', 'impossible'];

  const generateQuestions = (packAbbreviation, difficulty) => {
    const questions = [];
    for (let i = 1; i <= 50; i++) {
      const correctAnswerKey = `Option ${['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]}`;
      questions.push({
        "Question ID": `${packAbbreviation.toUpperCase()}_${i}`,
        "Question Text": `Placeholder Question ${i} (${packAbbreviation.toUpperCase()} ${difficulty})`,
        "Option A": correctAnswerKey === 'Option A' ? `Placeholder A_C` : "Placeholder A",
        "Option B": correctAnswerKey === 'Option B' ? `Placeholder B_C` : "Placeholder B",
        "Option C": correctAnswerKey === 'Option C' ? `Placeholder C_C` : "Placeholder C",
        "Option D": correctAnswerKey === 'Option D' ? `Placeholder D_C` : "Placeholder D",
        "Correct Answer": correctAnswerKey,
        "Difficulty": difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
      });
    }
    return questions;
  };

  // Create files for each pack and difficulty
  Object.entries(files).forEach(([packType, packs]) => {
    const packPath = packType === 'GenericPacks' ? genericPath : premiumPath;

    packs.forEach(pack => {
      const packAbbreviation = pack.replace(/\s+/g, '').toLowerCase(); // Abbreviate pack name
      difficulties.forEach(difficulty => {
        const filename = `${pack}${difficulty}.json`;
        const filepath = path.join(packPath, filename);

        const content = {
          Sheet1: generateQuestions(packAbbreviation, difficulty)
        };

        fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
        console.log(`Created: ${filename}`);
      });
    });
  });

  console.log('\nFile creation complete!');
};

createFiles();