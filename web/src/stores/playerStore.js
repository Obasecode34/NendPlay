// src/stores/playerStore.js
import { create } from 'zustand'

const usePlayerStore = create((set, get) => ({
  currentMedia: null,
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  duration: 0,
  isMiniPlayer: false,

  setMedia: (media) => set({ currentMedia: media, isPlaying: true, isMiniPlayer: true, progress: 0 }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  clearMedia: () => set({ currentMedia: null, isPlaying: false, isMiniPlayer: false, progress: 0 }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
}))

export default usePlayerStore
