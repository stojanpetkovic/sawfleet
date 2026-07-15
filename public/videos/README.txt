VIDEO HERO — files needed here
================================

The homepage, contractor registration, and truck/fleet registration
hero sections now play a looping muted background video. Add your
own footage with these exact filenames (referenced directly in the
.astro files):

  /public/videos/hero-tree-service.mp4      + hero-poster.jpg
  (homepage — src/pages/index.astro)

  /public/videos/hero-contractors.mp4       + hero-contractors-poster.jpg
  (src/pages/contractors-registration.astro)

  /public/videos/hero-fleet.mp4             + hero-fleet-poster.jpg
  (src/pages/truck-registration.astro)

RECOMMENDED SPECS
------------------
- MP4 (H.264), 1920x1080 or 1280x720
- 10–20 second seamless loop, no audio needed (muted autoplay)
- Compressed to under ~5–8 MB so mobile connections load it fast
  (handbrake.fr or a similar compressor works well)
- The poster .jpg is what shows before the video loads / on very
  slow connections — use a still frame from the video itself

FREE, LICENSE-SAFE FOOTAGE
----------------------------
If you don't have your own footage yet, these sites offer free
royalty-free stock video (tree removal / arborist / heavy
equipment / logging truck searches work well):
  - pexels.com/videos
  - coverr.co
  - pixabay.com/videos

Until real files are added, the <video> tag will simply fail
silently and the dark gradient background will show on its own —
nothing breaks, but the hero won't have motion until you add these.
