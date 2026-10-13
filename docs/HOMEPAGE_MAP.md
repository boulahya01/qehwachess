# Homepage geographic artwork

The map-led hero restores the original discovery concept with clearer typography and two primary destinations: casual games and tournaments. The map route remains an additional discovery link.

The background uses Natural Earth's public-domain 1:50m land polygons, clipped and projected into a local SVG. It contains no political boundaries. Static city dots identify city centers, not event availability or exact venues. No map SDK, tile request, location permission, fabricated participant count or animation framework is needed for the hero.

Run `python scripts/generate-home-map.py` to reproduce the light and dark assets. The generator pins its data source to a Git revision. Each SVG is approximately 8.5 KB before compression.

Data source and terms: [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/). The interactive event map uses its existing map provider and attribution independently.
