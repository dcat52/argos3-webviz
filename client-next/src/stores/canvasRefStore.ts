import { create } from 'zustand'
import type { WebGLRenderer, Scene, Camera } from 'three'

interface CanvasRefState {
  gl: { domElement: HTMLCanvasElement; render: (scene: Scene, camera: Camera) => void; scene: Scene; camera: Camera } | null
  setGl: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void
}

export const useCanvasRef = create<CanvasRefState>((set) => ({
  gl: null,
  setGl: (renderer, scene, camera) =>
    set({ gl: { domElement: renderer.domElement, render: (s, c) => renderer.render(s, c), scene, camera } }),
}))
