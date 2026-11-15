import { describe, expect, it } from 'vitest';
import {
  mapEmbedSrc,
  pointFromWazeUrl,
  wazeUrlForPoint,
} from './arrivalAddress';

describe('arrival address links', () => {
  it('builds a Waze directions link from coordinates', () => {
    const url = wazeUrlForPoint({ lat: 32.0853, lon: 34.781769 });
    expect(url).toBe('https://www.waze.com/live-map/directions?to=ll.32.085300%2C34.781769');
    expect(pointFromWazeUrl(url)).toEqual({ lat: 32.0853, lon: 34.781769 });
  });

  it('reads an older coordinate link and ignores a search link', () => {
    expect(pointFromWazeUrl('https://www.waze.com/ul?ll=32.085300,34.781769&navigate=yes'))
      .toEqual({ lat: 32.0853, lon: 34.781769 });
    expect(pointFromWazeUrl('https://www.waze.com/ul?q=Tel%20Aviv&navigate=yes')).toBeNull();
    expect(pointFromWazeUrl('not a url')).toBeNull();
  });

  it('frames the map around the point', () => {
    const src = mapEmbedSrc({ lat: 32.08, lon: 34.78 });
    expect(src).toContain('marker=32.08%2C34.78');
    expect(src).toContain('bbox=');
  });
});
