import DefaultDict from '../defaultdict';

describe('DefaultDict', () => {
  it('should return the default value when a key is not found', () => {
    const dict = new DefaultDict(() => 0);
    expect(dict['a']).toBe(0);
    expect(dict['b']).toBe(0);
  });

  it('should return the value set for a key', () => {
    const dict = new DefaultDict(() => 0);
    dict['a'] = 1;
    expect(dict['a']).toBe(1);
  });

  it('should return the default value for a key set to null', () => {
    const dict = new DefaultDict(() => 0);
    dict['a'] = null;
    expect(dict['a']).toBe(0);
  });
});