import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import { poseCenterX, poseVelocity } from '../lib/movement'
import type { PoseFrame } from '../types'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]]

export function usePoseTracking() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<PoseLandmarker | null>(null)
  const requestRef = useRef(0)
  const previousRef = useRef<{ landmarks: NormalizedLandmark[]; time: number } | null>(null)
  const lastInferenceRef = useRef(0)
  const [cameraOn, setCameraOn] = useState(false)
  const [frame, setFrame] = useState<PoseFrame>({ landmarks: null, velocity: null, centerX: .5, timestamp: 0 })

  const drawPose = useCallback((landmarks: NormalizedLandmark[] | null) => {
    const canvas = canvasRef.current, video = videoRef.current
    if (!canvas || !video) return
    const width = video.videoWidth || 1280, height = video.videoHeight || 720
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    if (!landmarks) return
    context.strokeStyle = 'rgba(84,246,197,.75)'; context.lineWidth = Math.max(3, width / 360); context.lineCap = 'round'
    for (const [a, b] of CONNECTIONS) {
      const start = landmarks[a], end = landmarks[b]
      if ((start.visibility ?? 0) < .45 || (end.visibility ?? 0) < .45) continue
      context.beginPath(); context.moveTo(start.x * width, start.y * height); context.lineTo(end.x * width, end.y * height); context.stroke()
    }
    context.fillStyle = '#d8fff3'
    for (const index of [11,12,13,14,15,16,23,24,25,26,27,28]) {
      const point = landmarks[index]
      if ((point.visibility ?? 0) < .45) continue
      context.beginPath(); context.arc(point.x * width, point.y * height, Math.max(4, width / 260), 0, Math.PI * 2); context.fill()
    }
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(requestRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null; previousRef.current = null; setCameraOn(false)
    setFrame({ landmarks: null, velocity: null, centerX: .5, timestamp: performance.now() }); drawPose(null)
  }, [drawPose])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported in this browser.')
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false })
    streamRef.current = stream
    const video = videoRef.current
    if (!video) throw new Error('Camera preview is unavailable.')
    video.srcObject = stream; await video.play()
    if (!trackerRef.current) {
      const vision = await FilesetResolver.forVisionTasks(WASM)
      trackerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55,
      })
    }
    setCameraOn(true)
    const infer = () => {
      const now = performance.now(), activeVideo = videoRef.current
      if (activeVideo && activeVideo.readyState >= 2 && trackerRef.current && now - lastInferenceRef.current >= 66) {
        lastInferenceRef.current = now
        const landmarks = trackerRef.current.detectForVideo(activeVideo, now).landmarks[0] ?? null
        let velocity: number | null = null
        if (landmarks) {
          velocity = poseVelocity(landmarks, previousRef.current?.landmarks ?? null, now - (previousRef.current?.time ?? now))
          previousRef.current = { landmarks, time: now }
        }
        drawPose(landmarks)
        setFrame({ landmarks, velocity, centerX: landmarks ? poseCenterX(landmarks) : .5, timestamp: now })
      }
      requestRef.current = requestAnimationFrame(infer)
    }
    requestRef.current = requestAnimationFrame(infer)
  }, [drawPose])

  useEffect(() => () => { stopCamera(); trackerRef.current?.close() }, [stopCamera])
  return { videoRef, canvasRef, frame, cameraOn, startCamera, stopCamera }
}
