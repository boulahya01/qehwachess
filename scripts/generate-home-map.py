"""Generate a local decorative map from public-domain Natural Earth data.
City dots identify city centers, not active events or exact venues.
Run: python scripts/generate-home-map.py
"""
from pathlib import Path
import json
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_land.geojson'


def clip(points, axis, bound, greater):
    result = []
    previous = points[-1]
    for current in points:
        inside = current[axis] >= bound if greater else current[axis] <= bound
        old_inside = previous[axis] >= bound if greater else previous[axis] <= bound
        if inside != old_inside:
            ratio = (bound - previous[axis]) / (current[axis] - previous[axis])
            result.append(tuple(previous[i] + ratio * (current[i] - previous[i]) for i in (0, 1)))
        if inside:
            result.append(current)
        previous = current
    return result


def xy(lon, lat):
    return ((lon + 20) / 24 * 1440, (44 - lat) / 22 * 880)


with urlopen(SOURCE) as response:
    data = json.load(response)
paths = []
for feature in data['features']:
    geometry = feature['geometry']
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    for polygon in polygons:
        points = polygon[0]
        for axis, bound, greater in [(0, -20, True), (0, 4, False), (1, 22, True), (1, 44, False)]:
            if points:
                points = clip(points, axis, bound, greater)
        if points:
            paths.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in [xy(*p) for p in points]) + 'Z')

cities = [('Tangier', -5.834, 35.76), ('Rabat', -6.8498, 34.0209), ('Casablanca', -7.5898, 33.5731), ('Marrakesh', -7.9811, 31.6295), ('Agadir', -9.5981, 30.4278), ('Fez', -5.0078, 34.0181)]
for mode, land, sea, stroke, text, accent in [('dark', '#2e4540', '#122420', '#507067', '#9bb8ad', '#8bd3af'), ('light', '#dfebe4', '#f2f6f2', '#b5c9bb', '#5d7b6b', '#1b684b')]:
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 880"><rect width="1440" height="880" fill="{sea}"/><g fill="{land}" stroke="{stroke}" stroke-width="1.2">'
    svg += ''.join(f'<path d="{path}"/>' for path in paths) + '</g>'
    svg += f'<g stroke="{stroke}" opacity=".18" stroke-width=".6">' + ''.join(f'<path d="M{x} 0V880M0 {x/1440*880:.1f}H1440"/>' for x in range(0, 1441, 120)) + '</g>'
    svg += f'<g fill="{accent}" stroke="{sea}" stroke-width="3">'
    for name, lon, lat in cities:
        x, y = xy(lon, lat)
        svg += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5"/>'
    svg += '</g>'
    svg += f'<g fill="{text}" font-family="sans-serif" font-size="15" letter-spacing="1">'
    for name, lon, lat in cities:
        x, y = xy(lon, lat)
        svg += f'<text x="{x+12:.1f}" y="{y+5:.1f}">{name}</text>'
    svg += '</g></svg>'
    (ROOT / f'public/images/morocco-map-{mode}.svg').write_text(svg, encoding='utf-8')
    print(f'{mode}: {len(svg)} bytes')
