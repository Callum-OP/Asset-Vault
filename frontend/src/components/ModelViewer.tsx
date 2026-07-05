import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

import { ErrorBoundary } from './ErrorBoundary'

function extensionOf(url: string): string {
  return url.split('.').pop()?.toLowerCase() ?? ''
}

// Center the camera on the model's bounding sphere so any model — whatever its
// origin, scale, or offset — is framed and vertically centred.
function FitCamera({ object }: { object: THREE.Object3D }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(object)
    if (box.isEmpty()) return
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const { center, radius } = sphere
    const safeRadius = radius || 1

    const fov = (camera.fov * Math.PI) / 180
    const distance = (safeRadius / Math.sin(fov / 2)) * 1.3

    camera.position.set(center.x, center.y, center.z + distance)
    camera.near = distance / 100
    camera.far = distance * 100
    camera.updateProjectionMatrix()
    camera.lookAt(center)

    if (controls) {
      controls.target.copy(center)
      controls.update()
    }
  }, [object, camera, controls, width, height])

  return null
}

function ModelContent({ object }: { object: THREE.Object3D }) {
  return (
    <>
      <primitive object={object} />
      <FitCamera object={object} />
    </>
  )
}

function GltfModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  return <ModelContent object={scene} />
}

function FbxModel({ url }: { url: string }) {
  return <ModelContent object={useLoader(FBXLoader, url)} />
}

function ObjModel({ url }: { url: string }) {
  return <ModelContent object={useLoader(OBJLoader, url)} />
}

function Model({ url }: { url: string }) {
  const ext = extensionOf(url)
  if (ext === 'fbx') return <FbxModel url={url} />
  if (ext === 'obj') return <ObjModel url={url} />
  return <GltfModel url={url} /> // glb / gltf
}

// Once the model has rendered a few frames, grab the canvas as a PNG so it can
// be saved as the asset's gallery thumbnail. Rendered inside <Suspense>, so it
// only mounts after the model has loaded.
function CaptureThumbnail({ onCapture }: { onCapture: (image: Blob) => void }) {
  const gl = useThree((s) => s.gl)
  const captured = useRef(false)
  const frames = useRef(0)

  useFrame(() => {
    if (captured.current) return
    frames.current += 1
    if (frames.current < 5) return // let FitCamera settle and a frame render
    captured.current = true
    gl.domElement.toBlob((blob) => {
      if (blob) onCapture(blob)
    }, 'image/png')
  })

  return null
}

interface Props {
  url: string
  onCapture?: (image: Blob) => void
}

/** Interactive 3D viewer for glTF/GLB, FBX, and OBJ — drag to orbit, scroll to zoom. */
export function ModelViewer({ url, onCapture }: Props) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-subtle">
          Could not load this 3D model.
        </div>
      }
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <ambientLight intensity={0.7} />
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <Suspense fallback={null}>
          <Model url={url} />
          {onCapture && <CaptureThumbnail onCapture={onCapture} />}
        </Suspense>
        <OrbitControls makeDefault enableDamping />
      </Canvas>
    </ErrorBoundary>
  )
}
