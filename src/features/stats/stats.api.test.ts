import { describe, expect, it } from 'vitest';
import { resolveStatsServiceTitles } from './stats.serviceTitles';

const catalog = new Map([
  [4, 'שעווה - בטן'],
  [9, 'פדיקור'],
]);

describe('resolveStatsServiceTitles', () => {
  it('uses the saved snapshot before the catalog', () => {
    expect(
      resolveStatsServiceTitles(
        4,
        [{ service_id: 4, title_snapshot: 'שם ישן' }],
        catalog,
      ),
    ).toEqual(['שם ישן']);
  });

  it('fills a blank snapshot from the service catalog', () => {
    expect(
      resolveStatsServiceTitles(
        null,
        [{ service_id: 9, title_snapshot: '  ' }],
        catalog,
      ),
    ).toEqual(['פדיקור']);
  });

  it('uses the appointment service when no service rows were saved', () => {
    expect(resolveStatsServiceTitles(4, [], catalog)).toEqual(['שעווה - בטן']);
  });

  it('stays empty when neither the rows nor the appointment point at a service', () => {
    expect(resolveStatsServiceTitles(null, [], catalog)).toEqual([]);
  });
});