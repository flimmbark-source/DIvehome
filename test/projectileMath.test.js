import test from 'node:test'
import assert from 'node:assert/strict'
import {
  raySphereIntersectionDistance,
  segmentIntersectsSphere,
} from '../src/game/projectileMath.js'

test('a fast projectile still hits when it crosses a target between frames', () => {
  assert.equal(
    segmentIntersectsSphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -5 },
      { x: 0.2, y: 0, z: -2.5 },
      0.5,
    ),
    true,
  )
})

test('a projectile segment misses a target outside its radius', () => {
  assert.equal(
    segmentIntersectsSphere(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -5 },
      { x: 1.2, y: 0, z: -2.5 },
      0.5,
    ),
    false,
  )
})

test('hitscan returns the nearest forward intersection distance', () => {
  const distance = raySphereIntersectionDistance(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: -5 },
    1,
  )
  assert.equal(distance, 4)
})

test('hitscan ignores spheres behind the muzzle or outside the ray', () => {
  assert.equal(
    raySphereIntersectionDistance(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: 3 },
      0.5,
    ),
    null,
  )
  assert.equal(
    raySphereIntersectionDistance(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: -1 },
      { x: 2, y: 0, z: -3 },
      0.5,
    ),
    null,
  )
})
