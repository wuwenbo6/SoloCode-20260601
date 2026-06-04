import * as THREE from 'three';

class BVHCollisionManager {
  constructor() {
    this.collisionMeshes = [];
    this.combinedGeometry = null;
    this.bvhMesh = null;
    this.playerRadius = 0.5;
    this.playerHeight = 1.6;
    this.tempVector = new THREE.Vector3();
    this.tempVector2 = new THREE.Vector3();
    this.tempBox = new THREE.Box3();
    this.tempRaycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.tempTriangle = new THREE.Triangle();
    this.tempIntersection = new THREE.Vector3();
    this.tempSegment = new THREE.Line3();
    this.stats = {
      checksPerFrame: 0,
      totalChecks: 0,
      cacheHits: 0
    };
    this._collisionCache = new Map();
  }

  buildFromMeshes(meshes) {
    this.collisionMeshes = meshes.filter(m => m.geometry && m.visible && m.userData?.collidable !== false);
    
    if (this.collisionMeshes.length === 0) {
      console.warn('No collision meshes found');
      return;
    }

    const mergedGeometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    let indexOffset = 0;

    for (const mesh of this.collisionMeshes) {
      const geometry = mesh.geometry;
      if (!geometry.attributes.position) continue;

      mesh.updateMatrixWorld(true);
      const worldMatrix = mesh.matrixWorld;
      this.tempMatrix.copy(worldMatrix);

      const posAttr = geometry.attributes.position;
      const indexAttr = geometry.index;

      for (let i = 0; i < posAttr.count; i++) {
        this.tempVector.fromBufferAttribute(posAttr, i);
        this.tempVector.applyMatrix4(this.tempMatrix);
        positions.push(this.tempVector.x, this.tempVector.y, this.tempVector.z);
      }

      if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
          indices.push(indexAttr.getX(i) + indexOffset);
        }
        indexOffset += posAttr.count;
      } else {
        for (let i = 0; i < posAttr.count; i += 3) {
          indices.push(i + indexOffset, i + 1 + indexOffset, i + 2 + indexOffset);
        }
        indexOffset += posAttr.count;
      }
    }

    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    mergedGeometry.setIndex(indices);
    mergedGeometry.computeBoundsTree();

    this.combinedGeometry = mergedGeometry;

    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.05 
    });
    this.bvhMesh = new THREE.Mesh(mergedGeometry, material);
    
    console.log(`BVH built from ${this.collisionMeshes.length} meshes, ${indices.length / 3} triangles`);
    this._collisionCache.clear();
  }

  get bvh() {
    return this.combinedGeometry ? this.combinedGeometry.boundsTree : null;
  }

  _getTriangle(index) {
    if (!this.combinedGeometry) return null;
    
    const indices = this.combinedGeometry.index;
    const positions = this.combinedGeometry.attributes.position;
    
    const a = indices.getX(index * 3);
    const b = indices.getX(index * 3 + 1);
    const c = indices.getX(index * 3 + 2);

    this.tempTriangle.a.fromBufferAttribute(positions, a);
    this.tempTriangle.b.fromBufferAttribute(positions, b);
    this.tempTriangle.c.fromBufferAttribute(positions, c);

    return this.tempTriangle;
  }

  checkCollision(position, radius = null, height = null) {
    if (!this.bvh) return false;

    const r = radius || this.playerRadius;
    const h = height || this.playerHeight;
    
    const cacheKey = `${position.x.toFixed(2)}|${position.z.toFixed(2)}|${r}|${h}`;
    if (this._collisionCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this._collisionCache.get(cacheKey);
    }

    this.stats.checksPerFrame++;
    this.stats.totalChecks++;

    const playerBox = new THREE.Box3(
      new THREE.Vector3(position.x - r, position.y, position.z - r),
      new THREE.Vector3(position.x + r, position.y + h, position.z + r)
    );

    let collided = false;
    
    this.bvh.shapecast({
      intersectsBounds: (box) => {
        return box.intersectsBox(playerBox);
      },
      intersectsTriangle: (tri) => {
        if (tri.intersectsBox(playerBox)) {
          collided = true;
          return true;
        }
        return false;
      },
      boundsTraverseOrder: (box) => {
        return box.distanceToPoint(new THREE.Vector3(position.x, position.y + h / 2, position.z));
      }
    });

    if (this._collisionCache.size > 1000) {
      this._collisionCache.clear();
    }
    this._collisionCache.set(cacheKey, collided);

    return collided;
  }

  checkLineCollision(start, end, radius = null) {
    if (!this.bvh) return null;

    const r = radius || this.playerRadius;
    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();
    
    if (distance < 0.001) return null;
    
    direction.normalize();

    const rayOrigin = new THREE.Vector3(start.x, start.y + this.playerHeight / 2, start.z);
    this.tempRaycaster.set(rayOrigin, direction);
    this.tempRaycaster.far = distance + r;

    const mesh = this.bvhMesh || new THREE.Mesh(this.combinedGeometry);
    const hits = this.tempRaycaster.intersectObject(mesh);

    if (hits.length > 0) {
      return {
        point: hits[0].point.clone(),
        normal: hits[0].face ? hits[0].face.normal.clone() : new THREE.Vector3(0, 1, 0),
        distance: hits[0].distance
      };
    }

    return null;
  }

  sweepCollision(position, delta, radius = null, height = null) {
    if (!this.bvh) {
      return {
        collided: false,
        newPosition: {
          x: position.x + delta.x,
          y: position.y,
          z: position.z + delta.z
        }
      };
    }

    const r = radius || this.playerRadius;
    const h = height || this.playerHeight;

    const totalDistance = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
    const steps = Math.max(1, Math.ceil(totalDistance / (r * 0.5)));
    const stepDelta = {
      x: delta.x / steps,
      y: delta.y / steps,
      z: delta.z / steps
    };

    let currentPos = { ...position };
    let collided = false;
    let slideNormal = null;

    for (let i = 0; i < steps; i++) {
      const testPos = {
        x: currentPos.x + stepDelta.x,
        y: currentPos.y,
        z: currentPos.z + stepDelta.z
      };

      if (!this.checkCollision(testPos, r, h)) {
        currentPos = testPos;
      } else {
        collided = true;
        
        const testX = { x: currentPos.x + stepDelta.x, y: currentPos.y, z: currentPos.z };
        const testZ = { x: currentPos.x, y: currentPos.y, z: currentPos.z + stepDelta.z };
        
        if (!this.checkCollision(testX, r, h)) {
          currentPos = testX;
          slideNormal = new THREE.Vector3(0, 0, 1);
        } else if (!this.checkCollision(testZ, r, h)) {
          currentPos = testZ;
          slideNormal = new THREE.Vector3(1, 0, 0);
        } else {
          break;
        }
      }
    }

    return {
      collided,
      newPosition: currentPos,
      slideNormal
    };
  }

  findSafePosition(targetPosition, maxAttempts = 12, searchRadius = 2.5) {
    if (!this.bvh) return targetPosition;

    if (!this.checkCollision(targetPosition)) {
      return targetPosition;
    }

    console.log('Finding safe position for:', targetPosition);

    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = searchRadius * (ring + 1) / 3;
      const pointsInRing = 8 + ring * 4;
      
      for (let i = 0; i < pointsInRing; i++) {
        const angle = (i / pointsInRing) * Math.PI * 2;
        const testPos = {
          x: targetPosition.x + Math.cos(angle) * ringRadius,
          y: targetPosition.y,
          z: targetPosition.z + Math.sin(angle) * ringRadius
        };
        
        if (!this.checkCollision(testPos)) {
          console.log(`Found safe position at ring ${ring}, angle ${Math.round(angle * 180 / Math.PI)}°`);
          return testPos;
        }
      }
    }

    const fallbackPos = {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z + 3
    };
    console.warn('Could not find safe position, using fallback:', fallbackPos);
    return fallbackPos;
  }

  validatePath(path, minDistance = 1) {
    if (!this.bvh || path.length < 2) return path;

    console.log('Validating path with', path.length, 'points');
    const validatedPath = [path[0]];
    
    for (let i = 1; i < path.length; i++) {
      const currentPoint = path[i];
      const prevPoint = validatedPath[validatedPath.length - 1];
      
      if (this.checkCollision(currentPoint)) {
        console.warn(`Path point ${i} is inside collision, adjusting`);
        const safePoint = this.findSafePosition(currentPoint, 10, 2);
        validatedPath.push(safePoint);
        continue;
      }
      
      const collision = this.checkLineCollision(
        new THREE.Vector3(prevPoint.x, prevPoint.y || 0, prevPoint.z),
        new THREE.Vector3(currentPoint.x, currentPoint.y || 0, currentPoint.z),
        this.playerRadius * 0.8
      );

      if (collision) {
        console.warn(`Path collision detected between points ${i - 1} and ${i}, distance: ${collision.distance.toFixed(2)}`);
        
        const midPoint = {
          x: (prevPoint.x + currentPoint.x) / 2,
          y: currentPoint.y || 0,
          z: (prevPoint.z + currentPoint.z) / 2
        };
        
        const safeMidPoint = this.findSafePosition(midPoint, 10, 2);
        validatedPath.push(safeMidPoint);
      }
      
      validatedPath.push(currentPoint);
    }

    console.log('Validated path has', validatedPath.length, 'points');
    return validatedPath;
  }

  resetStats() {
    this.stats.checksPerFrame = 0;
  }

  getStats() {
    return { ...this.stats };
  }

  dispose() {
    if (this.combinedGeometry) {
      if (this.combinedGeometry.boundsTree) {
        this.combinedGeometry.disposeBoundsTree();
      }
      this.combinedGeometry.dispose();
    }
    if (this.bvhMesh) {
      this.bvhMesh.geometry.dispose();
      this.bvhMesh.material.dispose();
    }
    this.collisionMeshes = [];
    this._collisionCache.clear();
  }
}

const collisionManager = new BVHCollisionManager();
export default collisionManager;
export { BVHCollisionManager };
