import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import PermissionsPage from './page';

describe('PermissionsPage', () => {
  beforeEach(() => {
    // mock token in localStorage
    (global as any).localStorage = {
      getItem: (k: string) => (k === 'token' ? 'demo-token' : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    } as any;

    // mock fetch to return permissions
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ permissions: ['manage', 'menu_master_data'] }),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders permissions in read-only grid', async () => {
    render(<PermissionsPage />);

    // wait for items to appear
    await waitFor(() => {
      expect(screen.getByText('manage')).toBeInTheDocument();
      expect(screen.getByText('menu_master_data')).toBeInTheDocument();
    });

    // read-only note present
    expect(
      screen.getByText('Read-only dari', { exact: false })
    ).toBeInTheDocument();
  });
});