import { APPARATUS_CONFIG, ENEMY_PATTERNS } from './config.js'

const FACE_MASK = Object.freeze([
  '  XXXXX  ',
  ' XXXXXXX ',
  'XXXXXXXXX',
  'XX  X  XX',
  'XXXXXXXXX',
  'XX XXX XX',
  ' XXX XXX ',
  '  XXXXX  ',
])

const TENTACLE_ANCHORS = Object.freeze([
  Object.freeze({ x: -2.75, y: -0.45, phase: 0.2 }),
  Object.freeze({ x: 0, y: -2.35, phase: 2.25 }),
  Object.freeze({ x: 2.75, y: -0.45, phase: 4.35 }),
])

function buildFacePieces(config) {
  const width = FACE_MASK[0].length
  const height = FACE_MASK.length
  const pieces = []

  FACE_MASK.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== 'X') return
      const index = pieces.length
      pieces.push({
        id: `boss-face-${index}`,
        kind: 'boss-face',
        pattern: ENEMY_PATTERNS[(rowIndex * 3 + columnIndex) % ENEMY_PATTERNS.length],
        x: (columnIndex - (width - 1) / 2) * config.BOSS_FACE_SPACING,
        y: ((height - 1) / 2 - rowIndex) * config.BOSS_FACE_SPACING,
        phase: index * 0.63,
        active: true,
        destroyedAt: null,
        revivedAt: 0,
      })
    })
  })

  return pieces
}

function buildTentacles(config) {
  return TENTACLE_ANCHORS.slice(0, config.BOSS_TENTACLE_COUNT).map((anchor, tentacleIndex) => ({
    id: `boss-tentacle-${tentacleIndex}`,
    anchor,
    extension: 0.08 + tentacleIndex * 0.04,
    cooldown: tentacleIndex * 0.7,
    attackPulse: 0,
    destroyed: false,
    destroyedAt: null,
    segments: Array.from({ length: config.BOSS_TENTACLE_SEGMENTS }, (_, segmentIndex) => ({
      id: `boss-tentacle-${tentacleIndex}-segment-${segmentIndex}`,
      kind: 'boss-tentacle',
      tentacleIndex,
      segmentIndex,
      pattern: ENEMY_PATTERNS[(tentacleIndex + segmentIndex) % ENEMY_PATTERNS.length],
      alive: true,
    })),
  }))
}

export function createBoss(config = APPARATUS_CONFIG) {
  return {
    elapsed: 0,
    regenClock: 0,
    regenPulse: 0,
    tentacleBreakPulse: 0,
    defeated: false,
    facePieces: buildFacePieces(config),
    tentacles: buildTentacles(config),
  }
}

export function activeTentacleCount(boss) {
  return boss?.tentacles?.filter((tentacle) => !tentacle.destroyed).length ?? 0
}

export function bossRegenerationLabel(boss) {
  switch (activeTentacleCount(boss)) {
    case 3:
      return 'RAPID'
    case 2:
      return 'SLOWED'
    case 1:
      return 'WEAK'
    default:
      return 'OFF'
  }
}

export function facePiecePosition(piece, boss, config = APPARATUS_CONFIG) {
  const time = boss?.elapsed ?? 0
  return {
    x: piece.x + Math.sin(time * 1.45 + piece.phase) * 0.045,
    y: piece.y + Math.cos(time * 1.15 + piece.phase) * 0.035,
    z: config.BOSS_FACE_Z + Math.sin(time * 0.8 + piece.phase) * 0.08,
  }
}

export function tentacleSegmentPosition(tentacle, segment, boss, config = APPARATUS_CONFIG) {
  const segmentProgress = (segment.segmentIndex + 1) / tentacle.segments.length
  const reach = 0.16 + tentacle.extension * 0.84
  const pathProgress = segmentProgress * reach
  const time = boss?.elapsed ?? 0
  const curl = Math.sin(time * 3.1 + tentacle.anchor.phase + segmentProgress * 7.4)
  const curlY = Math.cos(time * 2.65 + tentacle.anchor.phase + segmentProgress * 6.1)

  return {
    x: tentacle.anchor.x * (1 - pathProgress * 0.7) + curl * (0.18 + segmentProgress * 0.78),
    y: tentacle.anchor.y * (1 - pathProgress * 0.48) + curlY * (0.14 + segmentProgress * 0.58),
    z: config.BOSS_FACE_Z + (config.BOSS_TENTACLE_NEAR_Z - config.BOSS_FACE_Z) * pathProgress,
  }
}

export function bossCombatTargets(boss, config = APPARATUS_CONFIG) {
  if (!boss || boss.defeated || boss.elapsed < config.BOSS_INTRO_SECONDS) return []

  const targets = []
  for (const piece of boss.facePieces) {
    if (!piece.active) continue
    targets.push({
      id: piece.id,
      type: piece.kind,
      pattern: piece.pattern,
      position: facePiecePosition(piece, boss, config),
      hitRadius: config.BOSS_FACE_PIECE_RADIUS,
    })
  }

  for (const tentacle of boss.tentacles) {
    if (tentacle.destroyed) continue
    for (const segment of tentacle.segments) {
      if (!segment.alive) continue
      targets.push({
        id: segment.id,
        type: segment.kind,
        pattern: segment.pattern,
        position: tentacleSegmentPosition(tentacle, segment, boss, config),
        hitRadius: config.BOSS_TENTACLE_PIECE_RADIUS,
      })
    }
  }

  return targets
}

export function advanceBoss(boss, deltaSeconds, config = APPARATUS_CONFIG) {
  if (!boss || boss.defeated) return { boss, attacks: 0 }

  const delta = Math.max(0, Math.min(deltaSeconds, 0.05))
  const elapsed = boss.elapsed + delta
  if (elapsed < config.BOSS_INTRO_SECONDS) {
    return { boss: { ...boss, elapsed }, attacks: 0 }
  }

  let attacks = 0
  const tentacles = boss.tentacles.map((tentacle, tentacleIndex) => {
    if (tentacle.destroyed) return tentacle

    let cooldown = Math.max(0, tentacle.cooldown - delta)
    let extension = tentacle.extension
    let attackPulse = tentacle.attackPulse

    if (cooldown <= 0) {
      extension += delta / config.BOSS_TENTACLE_TRAVEL_SECONDS
      if (extension >= 1) {
        attacks += 1
        attackPulse += 1
        extension = 0.08
        cooldown = config.BOSS_TENTACLE_COOLDOWN_SECONDS + tentacleIndex * 0.22
      }
    }

    return { ...tentacle, cooldown, extension, attackPulse }
  })

  const remainingTentacles = tentacles.filter((tentacle) => !tentacle.destroyed).length
  const interval = config.BOSS_REGEN_INTERVALS[remainingTentacles] ?? Number.POSITIVE_INFINITY
  let regenClock = boss.regenClock + delta
  let regenPulse = boss.regenPulse
  let facePieces = boss.facePieces
  const missing = facePieces
    .filter((piece) => !piece.active)
    .sort((a, b) => (a.destroyedAt ?? 0) - (b.destroyedAt ?? 0))

  if (missing.length === 0) {
    regenClock = 0
  } else if (Number.isFinite(interval)) {
    const revivedIds = new Set()
    while (regenClock >= interval && revivedIds.size < missing.length) {
      regenClock -= interval
      revivedIds.add(missing[revivedIds.size].id)
      regenPulse += 1
    }

    if (revivedIds.size > 0) {
      facePieces = facePieces.map((piece) =>
        revivedIds.has(piece.id)
          ? { ...piece, active: true, destroyedAt: null, revivedAt: elapsed }
          : piece,
      )
    }
  }

  return {
    boss: {
      ...boss,
      elapsed,
      regenClock,
      regenPulse,
      facePieces,
      tentacles,
    },
    attacks,
  }
}

export function destroyBossTarget(boss, targetId) {
  if (!boss || boss.defeated || !targetId) {
    return { boss, changed: false, targetType: null, tentacleDestroyed: false, defeated: false }
  }

  const faceIndex = boss.facePieces.findIndex((piece) => piece.id === targetId && piece.active)
  if (faceIndex >= 0) {
    const facePieces = boss.facePieces.map((piece, index) =>
      index === faceIndex
        ? { ...piece, active: false, destroyedAt: boss.elapsed }
        : piece,
    )
    const defeated = facePieces.every((piece) => !piece.active)
    return {
      boss: { ...boss, facePieces, defeated },
      changed: true,
      targetType: 'boss-face',
      tentacleDestroyed: false,
      defeated,
    }
  }

  for (let tentacleIndex = 0; tentacleIndex < boss.tentacles.length; tentacleIndex += 1) {
    const tentacle = boss.tentacles[tentacleIndex]
    if (tentacle.destroyed) continue
    const segmentIndex = tentacle.segments.findIndex((segment) => segment.id === targetId && segment.alive)
    if (segmentIndex < 0) continue

    const segments = tentacle.segments.map((segment, index) =>
      index === segmentIndex ? { ...segment, alive: false } : segment,
    )
    const tentacleDestroyed = segments.every((segment) => !segment.alive)
    const nextTentacle = {
      ...tentacle,
      segments,
      destroyed: tentacleDestroyed,
      destroyedAt: tentacleDestroyed ? boss.elapsed : tentacle.destroyedAt,
    }
    const tentacles = boss.tentacles.map((candidate, index) =>
      index === tentacleIndex ? nextTentacle : candidate,
    )

    return {
      boss: {
        ...boss,
        tentacles,
        tentacleBreakPulse: boss.tentacleBreakPulse + (tentacleDestroyed ? 1 : 0),
      },
      changed: true,
      targetType: 'boss-tentacle',
      tentacleDestroyed,
      defeated: false,
    }
  }

  return { boss, changed: false, targetType: null, tentacleDestroyed: false, defeated: false }
}
