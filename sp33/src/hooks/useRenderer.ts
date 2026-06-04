import { useEffect, useRef, useState } from 'react';
import { WebGPURenderer } from '../lib/WebGPURenderer.js';
import { OrbitCamera } from '../lib/camera.js';
import { loadModelFromAPI } from '../lib/objLoader.js';
import { useAppStore } from '../store/useAppStore.js';

interface UseRendererOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function useRenderer({ canvasRef, containerRef }: UseRendererOptions) {
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const cameraRef = useRef<OrbitCamera | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState(true);

  const {
    selectedModelId,
    maxBounces,
    enableAO,
    aoSamples,
    aoRadius,
    enableSoftShadows,
    shadowSamples,
    lightRadius,
    setRenderStats,
    setCurrentScene,
    setIsLoading,
    setError,
    resetRenderStats,
  } = useAppStore();

  useEffect(() => {
    if (!navigator.gpu) {
      setWebgpuSupported(false);
      setError('WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+ with WebGPU enabled.');
      return;
    }

    let isMounted = true;

    async function init() {
      if (!canvasRef.current || !containerRef.current) return;

      try {
        const renderer = new WebGPURenderer({
          canvas: canvasRef.current,
          onStatsUpdate: setRenderStats,
        });

        await renderer.init();

        const camera = new OrbitCamera({
          target: [0, 0, 0],
          distance: 4,
          minDistance: 1,
          maxDistance: 20,
          azimuth: 0.5,
          polar: Math.PI / 3,
          fov: 45,
        });

        const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        const cameraData = camera.getGPUData(aspect);
        renderer.updateCamera(cameraData);

        camera.onChange(() => {
          if (!containerRef.current || !rendererRef.current) return;
          const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          const data = camera.getGPUData(aspect);
          rendererRef.current.updateCamera(data);
          resetRenderStats();
        });

        const cleanup = camera.attachToElement(containerRef.current);

        rendererRef.current = renderer;
        cameraRef.current = camera;
        cleanupRef.current = cleanup;

        const handleResize = () => {
          if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          rendererRef.current.resize(width, height);
          const aspect = width / height;
          const data = cameraRef.current.getGPUData(aspect);
          rendererRef.current.updateCamera(data);
        };

        window.addEventListener('resize', handleResize);

        const initialWidth = containerRef.current.clientWidth;
        const initialHeight = containerRef.current.clientHeight;
        renderer.resize(initialWidth, initialHeight);

        if (isMounted) {
          setIsInitialized(true);
        }

        return () => {
          window.removeEventListener('resize', handleResize);
        };
      } catch (err) {
        console.error('Failed to initialize renderer:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize renderer');
        }
      }
    }

    const cleanupPromise = init();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => {
        if (cleanup) cleanup();
        cleanupRef.current?.();
        rendererRef.current?.destroy();
      });
    };
  }, [canvasRef, containerRef, setRenderStats, setError, resetRenderStats]);

  useEffect(() => {
    if (!isInitialized || !rendererRef.current) return;

    let isMounted = true;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    async function loadScene() {
      setIsLoading(true);
      setError(null);
      resetRenderStats();

      try {
        const sceneData = await loadModelFromAPI(selectedModelId);

        if (abortController.signal.aborted) return;
        if (!isMounted || !rendererRef.current) return;

        rendererRef.current.setScene(sceneData);
        rendererRef.current.updateParams({
          maxBounces,
          enableAO,
          aoSamples,
          aoRadius,
          enableSoftShadows,
          shadowSamples,
          lightRadius,
        });
        rendererRef.current.start();
        setCurrentScene(sceneData);
      } catch (err) {
        if (abortController.signal.aborted) return;
        console.error('Failed to load scene:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load scene');
        }
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadScene();

    return () => {
      isMounted = false;
      abortController.abort();
      rendererRef.current?.stop();
    };
  }, [isInitialized, selectedModelId, maxBounces, enableAO, aoSamples, aoRadius, enableSoftShadows, shadowSamples, lightRadius, setIsLoading, setError, setCurrentScene, resetRenderStats]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateParams({
        maxBounces,
        enableAO,
        aoSamples,
        aoRadius,
        enableSoftShadows,
        shadowSamples,
        lightRadius,
      });
      resetRenderStats();
    }
  }, [maxBounces, enableAO, aoSamples, aoRadius, enableSoftShadows, shadowSamples, lightRadius, resetRenderStats]);

  const resetCamera = () => {
    if (cameraRef.current && containerRef.current && rendererRef.current) {
      cameraRef.current.reset();
      const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      const data = cameraRef.current.getGPUData(aspect);
      rendererRef.current.updateCamera(data);
      resetRenderStats();
    }
  };

  const saveImage = () => {
    if (rendererRef.current) {
      rendererRef.current.saveImage(`render-${Date.now()}.png`);
    }
  };

  const saveHDRImage = () => {
    if (rendererRef.current) {
      rendererRef.current.saveHDRImage(`render-${Date.now()}.exr`);
    }
  };

  return {
    isInitialized,
    webgpuSupported,
    renderer: rendererRef.current,
    camera: cameraRef.current,
    resetCamera,
    saveImage,
    saveHDRImage,
  };
}
