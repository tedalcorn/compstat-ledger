import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the dashboard header and main tabs', () => {
  render(<App />);
  expect(screen.getByText(/NYPD CompStat Ledger/i)).toBeInTheDocument();
  expect(screen.getByText(/^Headlines$/i)).toBeInTheDocument();
  expect(screen.getByText(/Crime Numbers/i)).toBeInTheDocument();
  expect(screen.getByText(/By Precinct/i)).toBeInTheDocument();
  expect(screen.getByText(/Council Districts/i)).toBeInTheDocument();
});
