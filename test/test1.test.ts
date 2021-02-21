describe('calculate', function () {
  it('add', function () {
    expect(1 + 1).toBe(2);
  });

  it('substract', function () {
    expect(2 - 1).toBe(1);
  });
});

test('aaa', () => {
  expect(2 + 2).not.toBe(5);
});

test('adding positive numbers is not zero', () => {
  for (let a = 1; a < 10; a++) {
    for (let b = 1; b < 10; b++) {
      expect(a + b).not.toBe(0);
    }
  }
});
