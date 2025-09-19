const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check if API key is provided
if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.error('❌ OPENAI_API_KEY is not set or is using placeholder value');
  console.error('Please create a .env file in the backend directory with your actual OpenAI API key');
  console.error('Example: OPENAI_API_KEY=sk-your-actual-api-key-here');
  process.exit(1);
}

console.log('✅ OpenAI API Key loaded successfully');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Configure multer for file uploads (memory storage for serverless)
const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage for serverless environments
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper's max)
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Audienze API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
  ];
  res.json(users);
});

// Transcription endpoint using Whisper API
app.post('/api/speech/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Processing audio file:', req.file.originalname);
    console.log('File mimetype:', req.file.mimetype);
    console.log('File size:', req.file.size);

    // Create a File object from the buffer for Whisper API
    const audioFile = new File([req.file.buffer], req.file.originalname, {
      type: req.file.mimetype
    });

    // Call Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1", // Use whisper-1 model (gpt-4o-transcribe is not available yet)
      response_format: "text"
    });

    // Basic speech analysis (we'll enhance this later)
    const transcript = transcription;
    const words = transcript.split(' ').length;
    const duration = req.body.duration || 60; // Assume 60 seconds if not provided
    const pace = Math.round((words / duration) * 60); // words per minute

    // Simple filler word detection
    const fillerWords = ['um', 'uh', 'like', 'you know', 'so', 'well', 'actually'];
    const fillerCount = fillerWords.reduce((count, filler) => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = transcript.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);

    const response = {
      transcript: transcript,
      analysis: {
        pace: pace,
        clarity: Math.max(60, 100 - (fillerCount * 5)), // Simple clarity score
        fillerWords: fillerCount,
        wordCount: words,
        duration: duration,
        suggestions: generateSuggestions(pace, fillerCount)
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('Transcription error:', error);
    
    // No file cleanup needed with memory storage
    res.status(500).json({
      error: 'Transcription failed',
      message: error.message
    });
  }
});

// Helper function to generate suggestions based on analysis
function generateSuggestions(pace, fillerCount) {
  const suggestions = [];
  
  if (pace < 120) {
    suggestions.push("Try speaking a bit faster - aim for 150-180 words per minute");
  } else if (pace > 200) {
    suggestions.push("Slow down slightly - aim for 150-180 words per minute");
  } else {
    suggestions.push("Great pace! Keep it steady");
  }
  
  if (fillerCount > 3) {
    suggestions.push("Try to reduce filler words like 'um' and 'uh'");
  } else if (fillerCount === 0) {
    suggestions.push("Excellent! No filler words detected");
  }
  
  suggestions.push("Practice pausing between key points for better clarity");
  
  return suggestions;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server only when running locally (not when imported by Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
  });
}

// Export the Express app for serverless usage (Vercel)
module.exports = app;
