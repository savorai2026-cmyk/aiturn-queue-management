export interface MapPoint {
  lat: number;
  lon: number;
}

export interface AddressSuggestion {
  label: string;
  point: MapPoint;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    district?: string;
    countrycode?: string;
  };
}

interface NominatimHit {
  lat?: string;
  lon?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
  };
}

function finitePoint(lat: number, lon: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function placeLabel(
  street: string | undefined,
  houseNumber: string | undefined,
  name: string | undefined,
  place: string | undefined,
) {
  const streetLine = [street, houseNumber].filter(Boolean).join(' ');
  const title = streetLine || (name && name !== street ? name : '');
  return [title, place].filter(Boolean).join(', ');
}

function photonLabel(properties: PhotonFeature['properties']) {
  if (!properties) return '';
  const place = properties.city || properties.town || properties.village || properties.district || '';
  return placeLabel(properties.street, properties.housenumber, properties.name, place);
}

export function wazeUrlForPoint(point: MapPoint) {
  const lat = point.lat.toFixed(6);
  const lon = point.lon.toFixed(6);
  return `https://www.waze.com/live-map/directions?to=ll.${lat}%2C${lon}`;
}

export function pointFromWazeUrl(url: string): MapPoint | null {
  try {
    const parsed = new URL(url);
    const target = parsed.searchParams.get('to');
    if (target?.startsWith('ll.')) {
      const [latText, lonText] = target.slice(3).split(',');
      const point = finitePoint(Number(latText), Number(lonText));
      if (point) return point;
    }
    const pair = parsed.searchParams.get('ll');
    if (!pair) return null;
    const [latText, lonText] = pair.split(',');
    return finitePoint(Number(latText), Number(lonText));
  } catch {
    return null;
  }
}

export function mapEmbedSrc(point: MapPoint) {
  const padLon = 0.012;
  const padLat = 0.008;
  const bbox = [
    point.lon - padLon,
    point.lat - padLat,
    point.lon + padLon,
    point.lat + padLat,
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${point.lat}%2C${point.lon}`;
}

async function searchPhoton(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  // lang=he makes Photon answer 400, including for Hebrew text.
  url.searchParams.set('limit', '6');
  url.searchParams.set('lat', '31.4');
  url.searchParams.set('lon', '34.9');
  url.searchParams.set('bbox', '34.2,29.45,35.95,33.4');
  const response = await fetch(url, { signal, headers: { 'Accept-Language': 'he' } });
  if (!response.ok) return [];
  const body = await response.json() as { features?: PhotonFeature[] };
  const features = body.features ?? [];
  const local = features.filter((feature) => feature.properties?.countrycode?.toLowerCase() === 'il');
  return (local.length > 0 ? local : features).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const point = finitePoint(coordinates?.[1] ?? Number.NaN, coordinates?.[0] ?? Number.NaN);
    const label = photonLabel(feature.properties);
    if (!point || !label) return [];
    return [{ label, point }];
  });
}

async function searchNominatim(query: string, signal: AbortSignal): Promise<AddressSuggestion[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'il');
  url.searchParams.set('accept-language', 'he');
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) return [];
  const hits = await response.json() as NominatimHit[];
  return hits.flatMap((hit) => {
    const point = finitePoint(Number(hit.lat), Number(hit.lon));
    const address = hit.address;
    const place = address?.city || address?.town || address?.village || address?.municipality || '';
    const label = placeLabel(address?.road, address?.house_number, undefined, place);
    if (!point || !label) return [];
    return [{ label, point }];
  });
}

export async function searchAddressSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<AddressSuggestion[]> {
  try {
    const photon = await searchPhoton(query, signal);
    if (photon.length > 0) return photon;
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return searchNominatim(query, signal);
}
