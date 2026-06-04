import React, { useRef, useEffect } from "react";

interface SpectrumVisualizerProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
}

const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({ analyserRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const analyser = analyserRef.current;
    if (!analyser) return;

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const barCount = 64;
    const gap = 2;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width - gap * (barCount - 1)) / barCount;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step];
        const barHeight = (value / 255) * canvas.height;
        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;

        const gradient = ctx.createLinearGradient(x, canvas.height, x, y);
        gradient.addColorStop(0, "#667eea");
        gradient.addColorStop(1, "#764ba2");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [analyserRef]);

  return <canvas ref={canvasRef} className="spectrum-canvas" />;
};

export default SpectrumVisualizer;
