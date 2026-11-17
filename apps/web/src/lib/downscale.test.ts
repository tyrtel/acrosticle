import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_EDGE, targetSize } from './downscale';

describe('targetSize', () => {
  it('enlarges small images to the minimum edge when asked, keeping the shape', () => {
    expect(targetSize(943, 504, MAX_IMAGE_EDGE, 1568)).toEqual({ width: 1568, height: 838 });
    expect(targetSize(3840, 3840, MAX_IMAGE_EDGE, 1568)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
    });
    expect(targetSize(2000, 1000, MAX_IMAGE_EDGE, 1568)).toEqual({ width: 2000, height: 1000 });
  });

  it('scales the long edge down to the limit, keeping the shape', () => {
    expect(targetSize(5152, 3864)).toEqual({ width: MAX_IMAGE_EDGE, height: 1932 });
    expect(targetSize(1853, 3000)).toEqual({ width: 1591, height: MAX_IMAGE_EDGE });
  });

  it('never enlarges small images', () => {
    expect(targetSize(1853, 2515)).toEqual({ width: 1853, height: 2515 });
  });

  it('accepts a custom limit', () => {
    expect(targetSize(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});
