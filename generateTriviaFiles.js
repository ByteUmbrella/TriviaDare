const fs = require('fs');
const path = require('path');

// Define packs with consistent naming
const packs = {
  GenericPacks: [
    'Entertainmentpack',  // Added 'pack' suffix
    'Sciencepack',
    'Historypack',
    'Sportspack',
    'Artpack',
    'Geographypack',
    'Moviepack',
    'Musicpack',
    'Technologypack'
  ],
  PremiumPacks: [
    'harrypotter',  // Premium packs don't need 'pack' suffix
    'friends',
    'halloweenhorror'
  ]
};

const difficulties = ['easy', 'medium', 'hard', 'impossible'];

// Generate 30 placeholder questions
function generatePlaceholderQuestions(difficulty) {
  const questions = [];
  for (let i = 1; i <= 30; i++) {
    questions.push({
      "Question ID": `PLACEHOLDER_${i}`,
      "Question Text": `Placeholder Question ${i}`,
      "Option A": `Placeholder ${i}A`,
      "Option B": `Placeholder ${i}B`,
      "Option C": `Placeholder ${i}C`,
      "Option D": `Placeholder ${i}D`,
      "Correct Answer": `Option ${['A', 'B', 'C', 'D'][i % 4]}`,
      "Difficulty": difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
    });
  }
  return { "Sheet1": questions };
}

// Ensure directory exists
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Creating directory: ${dirPath}`);
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  }
  return false;
}

// Create directories and files
async function generateFiles() {
  try {
    // Create base directory structure
    const baseDir = path.join(__dirname, 'Packs', 'TriviaDare');
    ensureDirectoryExists(baseDir);
    
    // Create pack type directories
    Object.keys(packs).forEach(packType => {
      const packTypeDir = path.join(baseDir, packType);
      ensureDirectoryExists(packTypeDir);
    });

    // Track created and existing files
    const summary = {
      created: [],
      existing: [],
      errors: []
    };

    // Generate files for each pack and difficulty
    Object.entries(packs).forEach(([packType, packList]) => {
      packList.forEach(pack => {
        difficulties.forEach(difficulty => {
          const fileName = `${pack}${difficulty}.json`;
          const filePath = path.join(baseDir, packType, fileName);
          
          try {
            if (!fs.existsSync(filePath)) {
              const content = generatePlaceholderQuestions(difficulty);
              fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
              summary.created.push(fileName);
              console.log(`Created: ${fileName}`);
            } else {
              summary.existing.push(fileName);
              console.log(`Exists (skipped): ${fileName}`);
            }
          } catch (error) {
            summary.errors.push({ file: fileName, error: error.message });
            console.error(`Error creating ${fileName}:`, error.message);
          }
        });
      });
    });

    // Print summary
    console.log('\n=== Generation Summary ===');
    console.log(`\nFiles created (${summary.created.length}):`);
    summary.created.forEach(file => console.log(`- ${file}`));
    
    console.log(`\nFiles already existing (${summary.existing.length}):`);
    summary.existing.forEach(file => console.log(`- ${file}`));
    
    if (summary.errors.length > 0) {
      console.log(`\nErrors (${summary.errors.length}):`);
      summary.errors.forEach(({file, error}) => console.log(`- ${file}: ${error}`));
    }

    console.log('\nDirectories:');
    console.log(`Base: ${baseDir}`);
    console.log(`GenericPacks: ${path.join(baseDir, 'GenericPacks')}`);
    console.log(`PremiumPacks: ${path.join(baseDir, 'PremiumPacks')}`);
  } catch (error) {
    console.error('Major error:', error);
    process.exit(1);
  }
}

// Run the generator
console.log('Starting trivia file generation...');
generateFiles().catch(error => {
  console.error('Error generating files:', error);
});