import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import Recording from './models/Recording';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldSaveRecording, setShouldSaveRecording] = useState(false);
  const shouldSaveRecordingRef = useRef(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(180); // deprecated, will be removed
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordingHistory, setRecordingHistory] = useState([]);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('recordings');
  const [selectedRecording, setSelectedRecording] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const audioRef = useRef(null);

  // Load recordings from localStorage on component mount
  useEffect(() => {
    const savedRecordings = loadRecordings();
    setRecordingHistory(savedRecordings);
    
    // Check if user has existing recordings
    if (savedRecordings.length > 0) {
      setIsReturningUser(true);
    }
  }, []);

  // Save recording data locally - Efficient storage using Recording model
  const saveRecording = async (transcript, feedback, audioBlob) => {
    const recording = Recording.create({ transcript, feedback, audioBlob });

    // Store audio blob in IndexedDB for efficient storage
    try {
      if (audioBlob) {
        await storeAudioBlob(recording.id, audioBlob);
      }
    } catch (error) {
      console.error('Failed to store audio:', error);
    }

    // Store only metadata in localStorage (much smaller)
    const existingRecordings = JSON.parse(localStorage.getItem('recordings') || '[]');
    existingRecordings.push(recording.toMetadata());
    const recentRecordings = existingRecordings.slice(-20);
    localStorage.setItem('recordings', JSON.stringify(recentRecordings));

    // Clean up old audio files from IndexedDB
    const keepIds = recentRecordings.map(r => r.id);
    await cleanupOldRecordings(keepIds);

    const updated = recentRecordings.map(Recording.fromMetadata);
    setRecordingHistory(updated);

    // Return the newly created recording so caller can focus it
    return recording;
  };

  // Store audio blob in IndexedDB
  const storeAudioBlob = async (id, audioBlob) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AudioRecordings', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        const putRequest = store.put({ id, audioBlob });
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('recordings')) {
          db.createObjectStore('recordings', { keyPath: 'id' });
        }
      };
    });
  };

  // Clean up old recordings from IndexedDB
  const cleanupOldRecordings = async (keepIds) => {
    try {
      const request = indexedDB.open('AudioRecordings', 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        
        // Get all stored IDs
        const getAllRequest = store.getAllKeys();
        getAllRequest.onsuccess = () => {
          const allIds = getAllRequest.result;
          const idsToDelete = allIds.filter(id => !keepIds.includes(id));
          
          // Delete old recordings
          idsToDelete.forEach(id => {
            store.delete(id);
          });
        };
      };
    } catch (error) {
      console.error('Failed to cleanup old recordings:', error);
    }
  };

  // Load user's history
  const loadRecordings = () => {
    const raw = JSON.parse(localStorage.getItem('recordings') || '[]');
    return raw.map(Recording.fromMetadata);
  };

  // Get audio blob from IndexedDB
  const getAudioBlob = async (id) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('AudioRecordings', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['recordings'], 'readonly');
        const store = transaction.objectStore('recordings');
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.audioBlob);
          } else {
            reject(new Error('Audio not found'));
          }
        };
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  };

  // Clear all stored data (for development/testing)
  const clearAllData = async () => {
    if (window.confirm('Are you sure you want to clear all recordings? This cannot be undone.')) {
      try {
        // Clear localStorage
        localStorage.removeItem('recordings');
        
        // Clear IndexedDB
        const request = indexedDB.deleteDatabase('AudioRecordings');
        request.onsuccess = () => {
          console.log('IndexedDB cleared successfully');
        };
        request.onerror = () => {
          console.error('Failed to clear IndexedDB');
        };
        
        // Reset state
        setRecordingHistory([]);
        setIsReturningUser(false);
        setTranscript('');
        setFeedback(null);
        setCurrentAudioUrl(null);
        setIsPlaying(false);
        
        alert('All data cleared successfully!');
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data. Please try again.');
      }
    }
  };

  // Delete a single recording
  const deleteRecording = async (recordingId) => {
    if (window.confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
      try {
        // Remove from localStorage
        const existingRecordings = JSON.parse(localStorage.getItem('recordings') || '[]');
        const updatedRecordings = existingRecordings.filter(r => r.id !== recordingId);
        localStorage.setItem('recordings', JSON.stringify(updatedRecordings));

        // Remove from IndexedDB
        const request = indexedDB.open('AudioRecordings', 1);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['recordings'], 'readwrite');
          const store = transaction.objectStore('recordings');
          store.delete(recordingId);
        };

        // Update state
        const updated = updatedRecordings.map(Recording.fromMetadata);
        setRecordingHistory(updated);

        // If this was the selected recording, clear it
        if (selectedRecording && selectedRecording.id === recordingId) {
          setSelectedRecording(null);
          setTranscript('');
          setFeedback(null);
          setCurrentAudioUrl(null);
          setIsPlaying(false);
        }

        console.log('Recording deleted successfully');
      } catch (error) {
        console.error('Error deleting recording:', error);
        alert('Error deleting recording. Please try again.');
      }
    }
  };

  // Playback function for recordings
  const playRecording = async (recording) => {
    try {
      // Get audio blob from IndexedDB
      const audioBlob = await getAudioBlob(recording.id);
      
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // Create audio URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);
      setCurrentAudioUrl(audioUrl);
      
      // Play the audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((error) => {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
          });
        
        // Handle audio end
        audioRef.current.onended = () => {
          setIsPlaying(false);
          // Clean up the object URL
          URL.revokeObjectURL(audioUrl);
        };
        
        // Handle audio errors
        audioRef.current.onerror = () => {
          setIsPlaying(false);
          console.error('Audio playback error');
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error('Failed to load audio:', error);
      // Show error message to user
      alert('Sorry, the audio for this recording could not be loaded.');
    }
    
    // Set the selected recording and switch to feedback tab
    setSelectedRecording(recording);
    setActiveTab('feedback');
    setTranscript(recording.transcript);
    setFeedback(recording.feedback);
  };

  // Play current audio
  const playCurrentAudio = () => {
    if (audioRef.current && currentAudioUrl) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((error) => {
          console.error('Error playing current audio:', error);
          setIsPlaying(false);
        });
    }
  };

  // Stop audio playback
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      const currentElapsed = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
      
      // Show confirmation dialog
      const shouldSave = window.confirm(
        `Recording is ${formatTime(currentElapsed)} long. Do you want to save and process this recording?`
      );
      
      if (shouldSave) {
        // Set flag to save the recording
        console.log('User chose to save, setting shouldSaveRecording to true');
        shouldSaveRecordingRef.current = true;
        setShouldSaveRecording(true);
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        // User chose not to save, discard the recording
        shouldSaveRecordingRef.current = false;
        setShouldSaveRecording(false); // Don't save
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setElapsedSeconds(0);
        console.log('Recording discarded');
      }
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Cancel means discard without confirmation
      shouldSaveRecordingRef.current = false;
      setShouldSaveRecording(false); // Don't save
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
      console.log('Recording cancelled and discarded');
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('onstop triggered, shouldSaveRecording:', shouldSaveRecordingRef.current);
        if (shouldSaveRecordingRef.current) {
          console.log('Processing audio...');
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const duration = Math.max(1, Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000));
          console.log('Audio blob size:', audioBlob.size, 'Duration:', duration);
          processAudio(audioBlob, duration);
        } else {
          console.log('Not saving recording - shouldSaveRecording is false');
        }
        // Reset the flag for next recording
        shouldSaveRecordingRef.current = false;
        setShouldSaveRecording(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
      setTranscript('');
      setFeedback(null);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Please allow microphone access to record your speech.');
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Keyboard shortcuts for recording control
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (isRecording) {
        if (event.code === 'Space' || event.code === 'Escape') {
          event.preventDefault();
          cancelRecording();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isRecording, cancelRecording]);

  const processAudio = async (audioBlob, durationSeconds) => {
    setIsProcessing(true);
    
    try {
      // Create FormData to send audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      if (durationSeconds) formData.append('duration', String(durationSeconds));
      
      // Send to backend for transcription
      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      setTranscript(result.transcript);
      setFeedback(result.analysis);
      
      // Save recording to localStorage and focus it in Feedback tab
      const enriched = { ...result.analysis };
      if (typeof durationSeconds === 'number') enriched.duration = durationSeconds;
      const newRec = await saveRecording(result.transcript, enriched, audioBlob);
      setSelectedRecording(newRec);
      setActiveTab('feedback');
      
    } catch (error) {
      console.error('Transcription error:', error);
      
      // Fallback to mock data if transcription fails
      const mockTranscript = "Transcription failed. Please try again.";
      const mockFeedback = {
        pace: 0,
        clarity: 0,
        fillerWords: 0,
        suggestions: [
          "There was an error processing your audio. Please try recording again.",
          "Make sure your microphone is working properly",
          "Try speaking more clearly"
        ]
      };
      
      setTranscript(mockTranscript);
      setFeedback(mockFeedback);
      
      // Still save the recording even if transcription failed
      const failedEnriched = { ...mockFeedback };
      if (typeof durationSeconds === 'number') failedEnriched.duration = durationSeconds;
      const failedRec = await saveRecording(mockTranscript, failedEnriched, audioBlob);
      setSelectedRecording(failedRec);
      setActiveTab('feedback');
    }
    
    setIsProcessing(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="App">
      {/* Hidden audio element for playback */}
      <audio ref={audioRef} />
      
      <div className="main-container">
        {/* Left Side - Recording Interface (60%) */}
        <div className="recording-section">
          <div className="recording-controls">
            {!isRecording && !isProcessing && (
              <div className="recording-ready">
                {/* Big Centered Microphone with Ripple */}
                <div className="ready-mic-visualization">
                  <div className="ready-mic-rings">
                    <div className="ready-ring ready-ring-1"></div>
                    <div className="ready-ring ready-ring-2"></div>
                    <div className="ready-ring ready-ring-3"></div>
                  </div>
                  <div className="ready-mic-icon-container">
                    <svg className="ready-mic-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="currentColor"/>
                      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H7V12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12V10H19Z" fill="currentColor"/>
                      <path d="M11 22H13V24H11V22Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                
                <h2 className="recording-title">Ready to Record</h2>
                <p className="recording-subtitle">Click the microphone to start your speech</p>
                <button 
                  className="record-button"
                  onClick={startRecording}
                >
                  <span className="button-text">Start Recording</span>
                  <div className="button-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="currentColor"/>
                      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H7V12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12V10H19Z" fill="currentColor"/>
                    </svg>
                  </div>
                </button>
                
                {/* Development Clear Button */}
                {process.env.NODE_ENV === 'development' && (
                  <button 
                    className="clear-data-button"
                    onClick={clearAllData}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      marginTop: '1rem',
                      opacity: 0.7
                    }}
                  >
                    🗑️ Clear All Data
                  </button>
                )}
              </div>
            )}
            
            {isRecording && (
              <div className="recording-interface">
                {/* Central Microphone with Elegant Animation */}
                <div className="mic-visualization">
                  <div className="mic-rings">
                    <div className="ring ring-1"></div>
                    <div className="ring ring-2"></div>
                    <div className="ring ring-3"></div>
                  </div>
                  <div className="mic-icon-container">
                    <svg className="mic-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="currentColor"/>
                      <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10H7V12C7 14.76 9.24 17 12 17C14.76 17 17 14.76 17 12V10H19Z" fill="currentColor"/>
                      <path d="M11 22H13V24H11V22Z" fill="currentColor"/>
                    </svg>
                  </div>
                </div>
                
                {/* Real-time Audio Visualization */}
                <div className="audio-visualizer">
                  <div className="visualizer-bars">
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                    <div className="bar"></div>
                  </div>
                </div>
                
                {/* Clean Status Display */}
                <div className="recording-status">
                  <div className="status-dot"></div>
                  <span className="status-text">Recording</span>
                  <div className="timer">{formatTime(elapsedSeconds)}</div>
                </div>
                
                {/* Keyboard Shortcut Hint */}
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  fontSize: '0.9rem',
                  marginBottom: '10px'
                }}>
                  Press <kbd style={{ 
                    background: '#f3f4f6', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>Space</kbd> or <kbd style={{ 
                    background: '#f3f4f6', 
                    padding: '2px 6px', 
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>Esc</kbd> to cancel recording (discard)
                </div>
                
                {/* Main Stop Recording Button (Discard) */}
                <button 
                  className="stop-recording-btn" 
                  onClick={stopRecording}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '16px 32px',
                    borderRadius: '30px',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                    margin: '20px auto',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div className="stop-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
                      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
                    </svg>
                  </div>
                  <span>Stop Recording</span>
                </button>
                
                {/* Secondary Save Option */}
                <button 
                  className="save-recording-btn" 
                  onClick={stopRecording}
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: '0 auto'
                  }}
                >
                  <span>💾</span>
                  <span>Save Recording</span>
                </button>
              </div>
            )}
            
            {isProcessing && (
              <div className="processing">
                <div className="processing-animation">
                  <div className="processing-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="processing-pulse"></div>
                </div>
                <h3 className="processing-title">Analyzing Your Speech</h3>
                <p className="processing-subtitle">Please wait while we process your recording...</p>
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Tabbed Interface (40%) */}
        <div className="text-section">
          <div className="tabbed-interface">
            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTab === 'recordings' ? 'active' : ''}`}
                onClick={() => setActiveTab('recordings')}
              >
                <span className="tab-icon">🎙️</span>
                <span className="tab-label">Recordings</span>
              </button>
              <button 
                className={`tab-button ${activeTab === 'feedback' ? 'active' : ''}`}
                onClick={() => setActiveTab('feedback')}
              >
                <span className="tab-icon">📊</span>
                <span className="tab-label">Feedback</span>
              </button>
              <button 
                className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <span className="tab-icon">📈</span>
                <span className="tab-label">Analytics</span>
              </button>
              <button 
                className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <span className="tab-icon">⚙️</span>
                <span className="tab-label">Settings</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'recordings' && (
                <div className="tab-panel">
                  {(isReturningUser || (transcript && feedback)) && recordingHistory.length > 0 ? (
                    <div className="recording-history">
                      <div className="history-header">
                        <h2>Your Recordings</h2>
                      </div>
                      
                      <div className="history-list">
                        {recordingHistory.slice().reverse().map((recording) => (
                          <div key={recording.id} className="history-item" onClick={() => playRecording(recording)}>
                            <div className="history-header">
                              <span className="history-date">
                                {new Date(recording.timestamp).toLocaleDateString()}
                              </span>
                              <span className="history-time">
                                {new Date(recording.timestamp).toLocaleTimeString()}
                              </span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  className="play-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    playRecording(recording);
                                  }}
                                >
                                  ▶️
                                </button>
                                <button
                                  className="view-feedback-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRecording(recording);
                                    setTranscript(recording.transcript);
                                    setFeedback(recording.feedback);
                                    setActiveTab('feedback');
                                  }}
                                >
                                  View Feedback
                                </button>
                                <button
                                  className="delete-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRecording(recording.id);
                                  }}
                                  style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </div>
                            <div className="history-metrics">
                              <span>Pace: {recording.feedback.pace} WPM</span>
                              <span>Clarity: {recording.feedback.clarity}%</span>
                              <span>Filler Words: {recording.feedback.fillerWords}</span>
                            </div>
                            {/* Transcript preview removed per request */}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">🎙️</div>
                      <h3>No Recordings Yet</h3>
                      <p>Start recording to see your speech history here</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'feedback' && (
                <div className="tab-panel">
                  {selectedRecording || (transcript && feedback) ? (
                    <div className="feedback-panel">
                      <div className="feedback-header">
                        <h2>
                          {selectedRecording ? 'Recording Feedback' : 'Latest Feedback'}
                        </h2>
                        {selectedRecording && (
                          <button 
                            className="back-to-recordings-btn"
                            onClick={() => {
                              setSelectedRecording(null);
                              setActiveTab('recordings');
                            }}
                          >
                            ← Back to Recordings
                          </button>
                        )}
                      </div>
                      
                      {selectedRecording && (
                        <div className="recording-info">
                          <div className="recording-meta">
                            <span className="recording-date">
                              {new Date(selectedRecording.timestamp).toLocaleDateString()}
                            </span>
                            <span className="recording-time">
                              {new Date(selectedRecording.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="recording-duration">
                              {selectedRecording.duration}s
                            </span>
                          </div>
                          
                          <div className="audio-controls">
                            <button 
                              className="audio-control-btn"
                              onClick={isPlaying ? stopAudio : playCurrentAudio}
                            >
                              {isPlaying ? '⏸️' : '▶️'}
                            </button>
                            <span className="audio-status">
                              {isPlaying ? 'Playing...' : 'Ready to play'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Transcript Section */}
                      {selectedRecording && (
                        <div className="transcript-section">
                          <h3>Transcript</h3>
                          <div className="transcript-content">
                            <p className="transcript-text">{selectedRecording.transcript}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="feedback-overview">
                        <div className="score-card">
                          <div className="score-circle">
                            <span className="score-number">{feedback ? Math.round((feedback.clarity + Math.min(100, (feedback.pace / 200) * 100) + Math.max(0, 100 - (feedback.fillerWords * 10))) / 3) : 0}</span>
                            <span className="score-total">/100</span>
                          </div>
                          <h3>Overall Score</h3>
                        </div>
                        
                        <div className="metrics-grid">
                          <div className="metric-item">
                            <span className="metric-label">Clarity</span>
                            <div className="metric-bar">
                              <div 
                                className="metric-fill" 
                                style={{ width: `${feedback ? feedback.clarity : 0}%` }}
                              ></div>
                            </div>
                            <span className="metric-value">{feedback ? feedback.clarity : 0}%</span>
                          </div>
                          
                          <div className="metric-item">
                            <span className="metric-label">Pace</span>
                            <div className="metric-bar">
                              <div 
                                className="metric-fill" 
                                style={{ width: `${feedback ? Math.min(100, (feedback.pace / 200) * 100) : 0}%` }}
                              ></div>
                            </div>
                            <span className="metric-value">{feedback ? feedback.pace : 0} WPM</span>
                          </div>
                          
                          <div className="metric-item">
                            <span className="metric-label">Filler Words</span>
                            <div className="metric-bar">
                              <div 
                                className="metric-fill" 
                                style={{ width: `${feedback ? Math.min(100, (feedback.fillerWords / 10) * 100) : 0}%` }}
                              ></div>
                            </div>
                            <span className="metric-value">{feedback ? feedback.fillerWords : 0}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="suggestions-section">
                        <h3>Improvement Suggestions</h3>
                        <div className="suggestions-list">
                          {feedback && feedback.suggestions ? feedback.suggestions.map((suggestion, index) => (
                            <div key={index} className="suggestion-item">
                              <span className="suggestion-icon">💡</span>
                              <span className="suggestion-text">{suggestion}</span>
                            </div>
                          )) : <div className="suggestion-item">No suggestions available</div>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">📊</div>
                      <h3>No Feedback Available</h3>
                      <p>Click on a recording to view its feedback, or record a new speech</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="tab-panel">
                  <div className="analytics-panel">
                    <h2>Speech Analytics</h2>
                    {recordingHistory.length > 0 ? (
                      <div className="analytics-content">
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">📈</div>
                            <div className="stat-info">
                              <span className="stat-number">{recordingHistory.length}</span>
                              <span className="stat-label">Total Recordings</span>
                            </div>
                          </div>
                          
                          <div className="stat-card">
                            <div className="stat-icon">⏱️</div>
                            <div className="stat-info">
                              <span className="stat-number">
                                {recordingHistory.reduce((total, r) => total + (r.duration || 0), 0)}s
                              </span>
                              <span className="stat-label">Total Speaking Time</span>
                            </div>
                          </div>
                          
                          <div className="stat-card">
                            <div className="stat-icon">📅</div>
                            <div className="stat-info">
                              <span className="stat-number">
                                {new Set(recordingHistory.map(r => 
                                  new Date(r.timestamp).toDateString()
                                )).size}
                              </span>
                              <span className="stat-label">Days Active</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="progress-section">
                          <h3>Recent Progress</h3>
                          <p>Keep recording to see your improvement trends!</p>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">📈</div>
                        <h3>No Analytics Yet</h3>
                        <p>Start recording to track your progress</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="tab-panel">
                  <div className="settings-panel">
                    <h2>Settings</h2>
                    <div className="settings-content">
                      <div className="setting-group">
                        <h3>Recording</h3>
                        <div className="setting-item">
                          <label>Recording Duration</label>
                          <select>
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                            <option value="120">2 minutes</option>
                            <option value="180">3 minutes</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="setting-group">
                        <h3>Privacy</h3>
                        <div className="setting-item">
                          <label>Data Storage</label>
                          <p className="setting-description">
                            All recordings are stored locally on your device
                          </p>
                        </div>
                      </div>
                      
                      <div className="setting-group">
                        <h3>Development</h3>
                        <button 
                          className="clear-data-button"
                          onClick={clearAllData}
                        >
                          🗑️ Clear All Data
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Audio Control Toast */}
        {isPlaying && (
          <div className="audio-toast">
            <div className="toast-content">
              <div className="toast-info">
                <span className="toast-icon">🎵</span>
                <span className="toast-text">Audio Playing</span>
              </div>
              <div className="toast-controls">
                <button 
                  className="toast-btn pause-btn"
                  onClick={stopAudio}
                >
                  ⏸️ Pause
                </button>
                <button 
                  className="toast-btn stop-btn"
                  onClick={() => {
                    stopAudio();
                    setCurrentAudioUrl(null);
                    setSelectedRecording(null);
                  }}
                >
                  ⏹️ Stop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
