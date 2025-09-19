// Lightweight model for recording metadata to keep transcript tied to audio
// Only metadata is persisted to localStorage; audio blobs live in IndexedDB by id

export default class Recording {
  constructor({
    id,
    transcript = '',
    feedback = null,
    timestamp = new Date().toISOString(),
    audioSize = 0,
    duration = 0,
    hasAudio = true,
    status = 'completed' // 'pending' | 'processing' | 'completed' | 'error'
  }) {
    this.id = id;
    this.transcript = transcript;
    this.feedback = feedback;
    this.timestamp = timestamp;
    this.audioSize = audioSize;
    this.duration = duration;
    this.hasAudio = hasAudio;
    this.status = status;
  }

  static create({ transcript, feedback, audioBlob }) {
    const id = Date.now().toString();
    return new Recording({
      id,
      transcript: transcript || '',
      feedback: feedback || null,
      timestamp: new Date().toISOString(),
      audioSize: audioBlob ? audioBlob.size : 0,
      // Duration is better derived from actual audio metadata; keep placeholder for now
      duration: audioBlob ? Math.round(audioBlob.size / 1000) : 0,
      hasAudio: Boolean(audioBlob),
      status: transcript ? 'completed' : 'pending'
    });
  }

  static fromMetadata(obj) {
    return new Recording(obj || {});
  }

  toMetadata() {
    return {
      id: this.id,
      transcript: this.transcript,
      feedback: this.feedback,
      timestamp: this.timestamp,
      audioSize: this.audioSize,
      duration: this.duration,
      hasAudio: this.hasAudio,
      status: this.status
    };
  }
}


