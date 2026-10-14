// Stock photos (Unsplash License; sources in public/images/CREDITS.txt). They illustrate tree work
// in general: SF Tree Removal has no crews of its own, so alt text describes only what is visible.
export interface Photo { w: number; h: number; alt: string; widths: number[] }
export const photos = {
  "crane-lift": {
    "w": 960,
    "h": 720,
    "alt": "Crane lifting a large cut section of a tree trunk over a yard during a tree removal",
    "widths": [
      640,
      960
    ]
  },
  "fallen-on-car": {
    "w": 960,
    "h": 540,
    "alt": "Large tree fallen across a street and onto a parked car after a storm",
    "widths": [
      640,
      960
    ]
  },
  "canopy-climber": {
    "w": 1400,
    "h": 934,
    "alt": "Tree worker with safety gear climbing a large branch above a roof",
    "widths": [
      640,
      960,
      1280
    ]
  },
  "trunk-cutting": {
    "w": 960,
    "h": 640,
    "alt": "Climber in a harness cutting a large tree trunk with a chainsaw",
    "widths": [
      640,
      960
    ]
  },
  "arborist-inspect": {
    "w": 960,
    "h": 640,
    "alt": "Tree worker in a yellow helmet inspecting the branches of a large tree",
    "widths": [
      640,
      960
    ]
  },
  "uprooted-yard": {
    "w": 960,
    "h": 640,
    "alt": "Large tree uprooted and fallen across a yard, with its root ball exposed",
    "widths": [
      640,
      960
    ]
  },
  "storm-uproot": {
    "w": 960,
    "h": 960,
    "alt": "Uprooted trees and debris after a severe storm",
    "widths": [
      640,
      960
    ]
  },
  "broken-tree": {
    "w": 960,
    "h": 720,
    "alt": "Large tree split and broken apart, with cut logs on the ground",
    "widths": [
      640,
      960
    ]
  },
  "tree-on-house": {
    "w": 960,
    "h": 641,
    "alt": "Tree that has fallen against the front of a house after a storm",
    "widths": [
      640,
      960
    ]
  },
  "bucket-truck": {
    "w": 960,
    "h": 640,
    "alt": "Utility bucket truck working on trees near power lines on a street",
    "widths": [
      640,
      960
    ]
  },
  "ladder-oak": {
    "w": 960,
    "h": 640,
    "alt": "Worker on a ladder in a large oak with a chainsaw in the foreground",
    "widths": [
      640,
      960
    ]
  },
  "climber-rope": {
    "w": 960,
    "h": 640,
    "alt": "Climber with ropes and a chainsaw working in a large oak tree",
    "widths": [
      640,
      960
    ]
  },
  "chainsaw": {
    "w": 1400,
    "h": 912,
    "alt": "Close-up of a worker in gloves cutting a branch with a chainsaw",
    "widths": [
      640,
      960,
      1280
    ]
  },
  "trunk-bucket": {
    "w": 1400,
    "h": 934,
    "alt": "Freshly cut tree trunk with a worker in a bucket lift in the background",
    "widths": [
      640,
      960,
      1280
    ]
  },
  "aerial-lift": {
    "w": 960,
    "h": 640,
    "alt": "Two workers in an aerial lift basket pruning a large green tree",
    "widths": [
      640,
      960
    ]
  },
  "brick-house-climber": {
    "w": 960,
    "h": 638,
    "alt": "Climber removing tree limbs next to a brick house",
    "widths": [
      640,
      960
    ]
  },
  "beach-palms": {
    "w": 960,
    "h": 640,
    "alt": "Palm trees in front of beachfront buildings on a sunny coast",
    "widths": [
      640,
      960
    ]
  },
  "hero-crane": {
    "w": 1280,
    "h": 960,
    "alt": "Crane lowering a large tree next to a building during a tree removal",
    "widths": [
      640,
      960,
      1280
    ]
  }
} as const satisfies Record<string, Photo>;
export type PhotoKey = keyof typeof photos;
