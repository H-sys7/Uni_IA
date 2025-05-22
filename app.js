const fs = require('fs');
const util = require('util');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const logFile = fs.createWriteStream('debug.log', { flags: 'a' });
console.log = (...args) => {
  logFile.write(util.format(...args) + '\n');
  process.stdout.write(util.format(...args) + '\n');
};

const app = express();
app.use(express.json());
app.use(cors({ origin: '*', methods: ['POST'] }));

const upload = multer({ storage: multer.memoryStorage() });

app.use((req, res, next) => {
  console.log('Reçu:', req.method, req.url);
  console.log('Headers:', req.headers);
  next();
});

async function callMistralAPI(prompt, model = "mistral-medium", temperature = 0.3) {
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Mistral API: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('Réponse de l\'API Mistral invalide');
    return content;
  } catch (error) {
    console.error('Erreur API Mistral:', error.message);
    throw error;
  }
}

async function processTestResponse(rawResponse) {
  try {
    const jsonStart = rawResponse.indexOf('[');
    const jsonEnd = rawResponse.lastIndexOf(']');
    const jsonString = rawResponse.substring(jsonStart, jsonEnd + 1);

    const parsed = JSON.parse(jsonString);
    if (!parsed.every(q => q.question && q.options && q.correctIndex !== undefined)) {
      throw new Error('Structure de test invalide');
    }
    return parsed;
  } catch (error) {
    console.error('Réponse brute:', rawResponse);
    throw new Error(`Échec du parsing JSON: ${error.message}`);
  }
}

// ==== Endpoint /api/test ====
app.post('/api/test', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Aucun fichier reçu');
    if (req.file.mimetype !== 'application/pdf') throw new Error('Format PDF requis');
    if (req.file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (>10MB)');

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.substring(0, 30000);
    console.log('Texte extrait (début):', text.substring(0, 200));

    const prompt = `Génère un test avec explications en JSON VALIDE. Format :
    [
      {
        "question": "Texte",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "Explication détaillée"
      }
    ]
    Document : ${text.substring(0, 25000)}`;

    const rawTest = await callMistralAPI(prompt);
    const test = await processTestResponse(rawTest);

    res.json({
      success: true,
      test,
      pages: pdfData.numpages,
      characters: text.length
    });

  } catch (error) {
    console.error('Erreur Test:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==== Endpoint /api/flashcards ====
app.post('/api/flashcards', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Aucun fichier reçu');
    if (req.file.mimetype !== 'application/pdf') throw new Error('Format PDF requis');
    if (req.file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (>10MB)');

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.substring(0, 30000);

    const prompt = `Génère 10 flashcards en JSON VALIDE. Format :
    [
      {
        "question": "Question concise",
        "answer": "Réponse précise"
      }
    ]
    Document : ${text.substring(0, 25000)}`;

    const rawFlashcards = await callMistralAPI(prompt);
    const jsonStart = rawFlashcards.indexOf('[');
    const jsonEnd = rawFlashcards.lastIndexOf(']');
    const flashcards = JSON.parse(rawFlashcards.substring(jsonStart, jsonEnd + 1));
    if (!flashcards.every(fc => fc.question && fc.answer)) {
      throw new Error('Structure de flashcards invalide');
    }

    res.json({
      success: true,
      flashcards,
      pages: pdfData.numpages,
      characters: text.length
    });

  } catch (error) {
    console.error('Erreur Flashcards:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==== Endpoint /api/summary ====
app.post('/api/summary', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Aucun fichier reçu');
    if (req.file.mimetype !== 'application/pdf') throw new Error('Format PDF requis');
    if (req.file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (>10MB)');

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.substring(0, 30000);
    console.log('Texte extrait (début):', text.substring(0, 200));

    const prompt = `Génère UNIQUEMENT un résumé structuré en français de ce document : ${text}`;
    const summary = await callMistralAPI(prompt);

    if (!summary || typeof summary !== 'string') {
      throw new Error('Résumé invalide ou vide');
    }

    res.json({
      success: true,
      summary,
      pages: pdfData.numpages,
      characters: text.length
    });

  } catch (error) {
    console.error('Erreur Summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint pour le quiz
app.post('/api/quiz', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw new Error('Aucun fichier reçu');
    if (req.file.mimetype !== 'application/pdf') throw new Error('Format PDF requis');
    if (req.file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (>10MB)');

    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text.substring(0, 30000);
    console.log('Texte extrait (début):', text.substring(0, 200));

    const prompt = `Génère un quiz en JSON VALIDE. Format :
    [
      {
        "question": "Texte",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0
      }
    ]
    Document : ${text.substring(0, 25000)}`;

    const rawQuiz = await callMistralAPI(prompt);
    const jsonStart = rawQuiz.indexOf('[');
    const jsonEnd = rawQuiz.lastIndexOf(']');
    const quiz = JSON.parse(rawQuiz.substring(jsonStart, jsonEnd + 1));

    if (!quiz.every(q => q.question && q.options && q.correctIndex !== undefined)) {
      throw new Error('Structure de quiz invalide');
    }

    res.json({
      success: true,
      quiz,
      pages: pdfData.numpages,
      characters: text.length
    });

  } catch (error) {
    console.error('Erreur Quiz:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));