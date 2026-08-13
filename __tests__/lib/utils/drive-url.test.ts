import { parseDriveFolderId } from '@/lib/utils/drive-url';

describe('parseDriveFolderId', () => {
  it('parses /drive/folders/{id}', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_123')).toBe(
      '1AbC-XyZ_123'
    );
  });

  it('parses /drive/u/{n}/folders/{id} for any digit', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/u/0/folders/1AbC-XyZ_123')).toBe(
      '1AbC-XyZ_123'
    );
    expect(parseDriveFolderId('https://drive.google.com/drive/u/7/folders/1AbC-XyZ_123')).toBe(
      '1AbC-XyZ_123'
    );
  });

  it('parses /folders/{id} without the /drive prefix', () => {
    expect(parseDriveFolderId('https://drive.google.com/folders/1AbC-XyZ_123')).toBe(
      '1AbC-XyZ_123'
    );
  });

  it('parses /open?id={id}', () => {
    expect(parseDriveFolderId('https://drive.google.com/open?id=1AbC-XyZ_123')).toBe(
      '1AbC-XyZ_123'
    );
  });

  it('parses URLs with a trailing slash', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_123/')).toBe(
      '1AbC-XyZ_123'
    );
    expect(
      parseDriveFolderId('https://drive.google.com/drive/u/0/folders/1AbC-XyZ_123/')
    ).toBe('1AbC-XyZ_123');
  });

  it('parses URLs with a query string', () => {
    expect(
      parseDriveFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_123?usp=sharing')
    ).toBe('1AbC-XyZ_123');
    expect(
      parseDriveFolderId(
        'https://drive.google.com/drive/u/0/folders/1AbC-XyZ_123?usp=sharing'
      )
    ).toBe('1AbC-XyZ_123');
  });

  it('parses URLs with both a trailing slash and a query string', () => {
    expect(
      parseDriveFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_123/?usp=sharing')
    ).toBe('1AbC-XyZ_123');
  });

  it('returns null for a non-drive.google.com domain', () => {
    expect(parseDriveFolderId('https://example.com/drive/folders/1AbC-XyZ_123')).toBeNull();
    expect(parseDriveFolderId('https://notdrive.google.com.evil.com/folders/abc')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseDriveFolderId('not a url')).toBeNull();
    expect(parseDriveFolderId('drive.google.com/drive/folders/1AbC-XyZ_123')).toBeNull();
  });

  it('returns null for a drive.google.com URL without a folder id', () => {
    expect(parseDriveFolderId('https://drive.google.com/drive/my-drive')).toBeNull();
    expect(parseDriveFolderId('https://drive.google.com/drive/folders/')).toBeNull();
  });

  it('returns null for empty string, null, and undefined', () => {
    expect(parseDriveFolderId('')).toBeNull();
    expect(parseDriveFolderId(null)).toBeNull();
    expect(parseDriveFolderId(undefined)).toBeNull();
  });
});
