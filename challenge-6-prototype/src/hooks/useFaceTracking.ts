import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { estimateHorizontalHeadPose } from '../lib/headPose'
import type { FaceFrame } from '../types'

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const INFERENCE_INTERVAL_MS = 66

export function useFaceTracking() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const animationRef = useRef(0)
  const lastInferenceRef = useRef(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [frame, setFrame] = useState<FaceFrame>({ landmarks: null, rawYaw: null, timestamp: 0 })

  const drawFaceGuide = useCallback((landmarks: NormalizedLandmark[] | null) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    if (!landmarks) return

    const outline = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
    context.strokeStyle = 'rgba(113, 240, 222, .85)'
    context.lineWidth = Math.max(2, width / 480)
    context.lineCap = 'round'
    context.beginPath()
    outline.forEach((index, position) => {
      const point = landmarks[index]
      if (position === 0) context.moveTo(point.x * width, point.y * height)
      else context.lineTo(point.x * width, point.y * height)
    })
    context.closePath()
    context.stroke()

    context.fillStyle = '#f6ffbd'
    for (const index of [1, 234, 454]) {
      const point = landmarks[index]
      context.beginPath()
      context.arc(point.x * width, point.y * height, Math.max(3, width / 330), 0, Math.PI * 2)
      context.fill()
    }
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animationRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
    setFrame({ landmarks: null, rawYaw: null, timestamp: performance.now() })
    drawFaceGuide(null)
  }, [drawFaceGuide])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support camera access.')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    })
    streamRef.current = stream
    const video = videoRef.current
    if (!video) throw new Error('The camera preview is unavailable.')
    video.srcObject = stream
    await video.play()

    if (!landmarkerRef.current) {
      const vision = await FilesetResolver.forVisionTasks(VISION_WASM)
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      })
    }

    setCameraOn(true)
    const infer = () => {
      const now = performance.now()
      const activeVideo = videoRef.current
      if (activeVideo && activeVideo.readyState >= 2 && landmarkerRef.current && now - lastInferenceRef.current >= INFERENCE_INTERVAL_MS) {
        lastInferenceRef.current = now
        const result = landmarkerRef.current.detectForVideo(activeVideo, now)
        const landmarks = result.faceLandmarks[0] ?? null
        drawFaceGuide(landmarks)
        setFrame({
          landmarks,
          rawYaw: landmarks ? estimateHorizontalHeadPose(landmarks) : null,
          timestamp: now,
        })
      }
      animationRef.current = requestAnimationFrame(infer)
    }
    animationRef.current = requestAnimationFrame(infer)
  }, [drawFaceGuide])

  useEffect(() => () => {
    stopCamera()
    landmarkerRef.current?.close()
  }, [stopCamera])

  return { videoRef, canvasRef, frame, cameraOn, startCamera, stopCamera }
}
