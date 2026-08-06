import test from 'node:test'
import assert from 'node:assert/strict'
import { segmentIntersectsSphere } from '../src/game/projectileMath.js'

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
