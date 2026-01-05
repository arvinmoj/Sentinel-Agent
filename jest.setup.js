// Jest setup file
global.console = {
  ...console,
  // Suppress console logs during tests unless there's an error
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error, // Keep error logs visible
};

// Set test timeout
jest.setTimeout(10000);
