/**
 * PDF Processing Application
 * Features: Summary, Quiz, Test, and Flashcard generation from uploaded PDF files
 * Uses Supabase for storage and local Flask API for document processing
 */

// ========================================
// 1. SUPABASE CONFIGURATION & INITIALIZATION
// ========================================

const { createClient } = window.supabase;
const supabaseUrl = 'https://fauxbclsyvkkdeeghwoo.supabase.co';
// Note: In production, this should be stored as an environment variable
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhdXhiY2xzeXZra2RlZWdod29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxMTQ2MjEsImV4cCI6MjA2MDY5MDYyMX0.Guh14-64SJiNA8aww2LC_vvo1NPsootVe6PbSeY-yWE';
const supabaseClient = createClient(supabaseUrl, supabaseKey);
const bucketName = 'uni-ai';

// ========================================
// 2. GLOBAL VARIABLES
// ========================================

// Store the currently selected file for processing
let currentFile = null;

// ========================================
// 3. SUPABASE CONNECTION TEST
// ========================================

/**
 * Test Supabase connection on app initialization
 * Lists available storage buckets to verify connectivity
 */
supabaseClient.storage.listBuckets()
  .then(({ data }) => {
    if (!data) throw new Error('Aucun bucket trouvé');
    console.log('Buckets disponibles:', data);
  })
  .catch(error => {
    console.error('Erreur de connexion:', error.message);
  });

// ========================================
// 4. EVENT LISTENERS SETUP
// ========================================

/**
 * File input change handler
 * Updates the UI to show selected file information
 */
document.getElementById('fileInput').addEventListener('change', (e) => {
  currentFile = e.target.files[0];
  const fileInfo = document.getElementById('fileInfo');
  fileInfo.textContent = currentFile ? currentFile.name : 'Aucun fichier sélectionné';
});

/**
 * Upload button handler
 * Validates file selection and provides user feedback
 */
document.getElementById('uploadButton').addEventListener('click', async () => {
  if (!currentFile) {
    updateStatus('❌ Aucun fichier sélectionné.', 'error');
    return;
  }

  try {
    updateStatus('📤 Téléchargement en cours...', 'loading');

    // Sanitize the filename
    const sanitizedFilename = sanitizeFilename(currentFile.name);

    // Upload the file to Supabase
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(`uploads/${sanitizedFilename}`, currentFile);

    if (error) {
      throw new Error(`Erreur Supabase : ${error.message}`);
    }

    updateStatus('✅ Fichier téléchargé avec succès !', 'success');
    console.log('Fichier téléchargé :', data);
  } catch (error) {
    console.error('Erreur lors du téléchargement :', error.message);
    updateStatus(`❌ Erreur : ${error.message}`, 'error');
  }
});

// Feature button event listeners
document.getElementById('generateSummaryButton').addEventListener('click', generateSummary);
document.getElementById('generateQuizButton').addEventListener('click', generateQuiz);
document.getElementById('generateTestButton').addEventListener('click', generateTest);
document.getElementById('generateFlashcardsButton').addEventListener('click', generateFlashcards);

// ========================================
// 5. UTILITY FUNCTIONS
// ========================================

/**
 * Clean and format summary text
 * Removes markdown formatting and fixes common text issues
 * @param {string} text - Raw summary text from API
 * @returns {string} - Cleaned and formatted text
 */
function cleanSummary(text) {
  return text
    .replace(/\*\*/g, '') // Remove markdown bold formatting
    .replace(/(\d+) ns/g, '$1 ans') // Fix "ns" to "ans" (years in French)
    .replace(/zaines/g, 'dizaines') // Fix "zaines" to "dizaines" (dozens)
    .replace(/férifié/g, 'à effet') // Fix OCR error
    .replace(/(\d+%)/g, '<strong>$1</strong>'); // Make percentages bold
}

/**
 * Update application status message
 * Manages status display with different visual states
 * @param {string} message - Status message to display
 * @param {string} type - Status type: 'loading', 'success', 'error'
 */
function updateStatus(message, type = 'loading') {
  const status = document.getElementById('status');
  const content = document.getElementById('statusContent');
  
  // Update CSS class for visual styling
  status.className = `status-message status-${type}`;
  content.textContent = message;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      status.className = 'status-message status-hidden';
    }, 3000);
  }
}

/**
 * Sanitize filename for safe storage
 * Removes special characters and normalizes text
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename
    .normalize('NFD') // Normalize Unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^a-zA-Z0-9_.-]/g, '_') // Replace special chars with underscore
    .toLowerCase(); // Convert to lowercase
}

// ========================================
// 6. API COMMUNICATION FUNCTIONS
// ========================================

/**
 * Generate document summary
 * Sends PDF to Flask API for AI-powered summarization
 */
async function generateSummary() {
  const resultDiv = document.getElementById('result');
  
  try {
    // Validate file selection
    if (!currentFile) throw new Error('Aucun fichier sélectionné');
    
    // Update UI status
    updateStatus('🧠 Génération du résumé...', 'loading');

    // Prepare form data for API request
    const formData = new FormData();
    formData.append('file', currentFile);

    // Send request to Flask API
    const response = await fetch('http://localhost:5000/api/summary', {
      method: 'POST',
      body: formData
    });

    // Handle HTTP errors
    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    
    // Parse response
    const data = await response.json();

    // Display results with metadata
    resultDiv.innerHTML = `
      <h2>📝 Résumé généré :</h2>
      <div class="summary">${cleanSummary(data.summary)}</div>
      <div class="meta">
        <p>📄 Pages : ${data.pages}</p>
        <p>🔤 Caractères : ${data.characters}</p>
      </div>
    `;
    
    // Show results and update status
    resultDiv.classList.add('visible');
    updateStatus('✅ Résumé prêt !', 'success');
    
  } catch (error) {
    // Handle errors gracefully
    resultDiv.innerHTML = '';
    updateStatus(`❌ Erreur : ${error.message}`, 'error');
  }
}

/**
 * Generate interactive quiz
 * Creates multiple-choice questions from document content
 */
async function generateQuiz() {
  const resultDiv = document.getElementById('result');
  
  try {
    // Validate file selection
    if (!currentFile) throw new Error('Aucun fichier sélectionné');
    
    updateStatus('🧠 Génération du quiz...', 'loading');

    // Prepare and send API request
    const formData = new FormData();
    formData.append('file', currentFile);

    const response = await fetch('http://localhost:5000/api/quiz', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const data = await response.json();

    // Create quiz container HTML
    resultDiv.innerHTML = `
      <h2>❓ Quiz généré :</h2>
      <div id="quiz"></div>
      <div class="meta">
        <p>📄 Pages : ${data.pages}</p>
        <p>🔤 Caractères : ${data.characters}</p>
      </div>
    `;
    
    // Populate quiz with interactive elements
    displayQuiz(data.quiz);
    resultDiv.classList.add('visible');
    updateStatus('✅ Quiz prêt !', 'success');
    
  } catch (error) {
    resultDiv.innerHTML = '';
    updateStatus(`❌ Erreur : ${error.message}`, 'error');
  }
}

/**
 * Generate comprehensive test
 * Creates test with multiple questions and detailed explanations
 */
async function generateTest() {
  const resultDiv = document.getElementById('result');
  
  try {
    // Validate file selection
    if (!currentFile) throw new Error('Aucun fichier sélectionné');
    
    updateStatus('🧠 Génération du test...', 'loading');

    // Prepare and send API request
    const formData = new FormData();
    formData.append('file', currentFile);

    const response = await fetch('http://localhost:5000/api/test', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
    const data = await response.json();

    // Create comprehensive test display with explanations
    resultDiv.innerHTML = `
      <h2>📝 Test généré (${data.test.length} questions)</h2>
      <div class="test-container">
        ${data.test.map((q, i) => `
          <div class="test-question">
            <h3>${i + 1}. ${q.question}</h3>
            <ol type="A">${q.options.map(opt => `<li>${opt}</li>`).join('')}</ol>
            <div class="explanation">
              <button class="show-answer" onclick="toggleExplanation(${i})">Voir la réponse</button>
              <div id="explanation${i}" class="hidden">
                <p>✅ Réponse correcte : ${q.options[q.correctIndex]}</p>
                ${q.explanation ? `<p>💡 Explication : ${q.explanation}</p>` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    resultDiv.classList.add('visible');
    updateStatus('✅ Test prêt !', 'success');
    
  } catch (error) {
    resultDiv.innerHTML = '';
    updateStatus(`❌ Erreur : ${error.message}`, 'error');
  }
}

/**
 * Generate interactive flashcards
 * Creates flip-able cards for study and memorization
 */
async function generateFlashcards() {
  const resultDiv = document.getElementById('result');
  
  try {
    // Validate file selection
    if (!currentFile) throw new Error('Aucun fichier sélectionné');
    
    updateStatus('🧠 Génération des flashcards...', 'loading');

    // Prepare and send API request
    const formData = new FormData();
    formData.append('file', currentFile);

    const response = await fetch('http://localhost:5000/api/flashcards', {
      method: 'POST',
      body: formData
    });

    // Handle HTTP errors with detailed feedback
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur serveur [${response.status}]: ${errorText}`);
    }

    // Parse and validate response
    const data = await response.json();
    if (!data.success || !data.flashcards) {
      throw new Error(data.error || 'Format de flashcards invalide');
    }

    // Create interactive flashcard display with embedded CSS
    resultDiv.innerHTML = `
      <style>
        .flashcards-container {
          margin: 20px 0;
        }
        .flashcards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .flashcard-wrapper {
          perspective: 1000px;
          height: 200px;
          cursor: pointer;
        }
        .flashcard {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          border-radius: 10px;
        }
        .flashcard.flipped {
          transform: rotateY(180deg);
        }
        .flashcard-front, .flashcard-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border: 2px solid #3498db;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 20px;
          box-sizing: border-box;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .flashcard-back {
          transform: rotateY(180deg);
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .flashcard-content h3 {
          margin: 0 0 15px 0;
          font-size: 1.2em;
          font-weight: bold;
        }
        .flashcard-content p {
          margin: 0;
          font-size: 1em;
          line-height: 1.4;
        }
        .flip-hint {
          position: absolute;
          bottom: 10px;
          font-size: 0.8em;
          opacity: 0.7;
        }
      </style>
      <h2>📚 Flashcards générées (${data.flashcards.length})</h2>
      <div class="flashcards-container">
        <div class="flashcards-grid">
          ${data.flashcards.map((fc, i) => `
            <div class="flashcard-wrapper" onclick="flipCard(${i})">
              <div class="flashcard" id="flashcard${i}">
                <div class="flashcard-front">
                  <div class="flashcard-content">
                    <h3>Question</h3>
                    <p>${fc.question}</p>
                  </div>
                  <div class="flip-hint">🔄 Cliquez pour voir la réponse</div>
                </div>
                <div class="flashcard-back">
                  <div class="flashcard-content">
                    <h3>Réponse</h3>
                    <p>${fc.answer}</p>
                  </div>
                  <div class="flip-hint">🔄 Cliquez pour voir la question</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="meta">
        <p>📄 Pages analysées : ${data.pages}</p>
        <p>🔤 Caractères traités : ${data.characters}</p>
      </div>
    `;

    resultDiv.classList.add('visible');
    updateStatus('✅ Flashcards prêtes !', 'success');
    
  } catch (error) {
    console.error('Erreur flashcards:', error);
    resultDiv.innerHTML = '';
    updateStatus(`❌ ${error.message}`, 'error');
  }
}

// ========================================
// 7. INTERACTIVE DISPLAY FUNCTIONS
// ========================================

/**
 * Display interactive quiz questions
 * Creates radio button options and answer reveal functionality
 * @param {Array} quizData - Array of quiz question objects
 */
function displayQuiz(quizData) {
  const quizContainer = document.getElementById('quiz');
  quizContainer.innerHTML = '';
  
  // Validate quiz data format
  if (!Array.isArray(quizData)) {
    quizContainer.innerHTML = '<p>❌ Format de quiz invalide</p>';
    return;
  }

  // Create interactive question elements
  quizData.forEach((q, i) => {
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question';
    questionDiv.innerHTML = `
      <h3>Question ${i + 1}: ${q.question}</h3>
      <div class="options">
        ${q.options.map((opt, idx) => `
          <label>
            <input type="radio" name="q${i}" value="${idx}"> ${opt}
          </label>
        `).join('')}
      </div>
      <button onclick="showAnswer(${i}, ${q.correctIndex})">Voir la réponse</button>
      <div id="answer${i}" class="answer"></div>
    `;
    quizContainer.appendChild(questionDiv);
  });
}

// ========================================
// 8. GLOBAL INTERACTIVE FUNCTIONS
// ========================================

/**
 * Show correct answer for quiz question
 * @param {number} index - Question index
 * @param {number} correctIndex - Index of correct answer
 */
window.showAnswer = function(index, correctIndex) {
  const el = document.getElementById(`answer${index}`);
  const selected = document.querySelector(`input[name="q${index}"][value="${correctIndex}"]`);
  if (selected) {
    el.innerHTML = `✅ Réponse correcte : ${selected.parentElement.textContent.trim()}`;
  }
};

/**
 * Toggle explanation visibility for test questions
 * @param {number} i - Question index
 */
window.toggleExplanation = function(i) {
  const el = document.getElementById(`explanation${i}`);
  el.classList.toggle('hidden');
};

/**
 * Flip flashcard to show answer/question
 * @param {number} index - Flashcard index
 */
window.flipCard = function(index) {
  const card = document.getElementById(`flashcard${index}`);
  card.classList.toggle('flipped');
};