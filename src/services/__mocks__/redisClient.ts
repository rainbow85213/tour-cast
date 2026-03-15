const redisMock = {
  get:    jest.fn().mockResolvedValue(null),
  set:    jest.fn().mockResolvedValue('OK'),
  setex:  jest.fn().mockResolvedValue('OK'),
  del:    jest.fn().mockResolvedValue(1),
  quit:   jest.fn().mockResolvedValue('OK'),
  on:     jest.fn(),
};

export default redisMock;
