import { useEffect, useRef } from 'react'

interface ScreenCaptureProps {
  stream: MediaStream
}

export default function ScreenCapture({ stream }: ScreenCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="preview-video"
    />
  )
}
