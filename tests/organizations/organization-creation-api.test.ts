import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/organizations/route';
import { DatabaseService } from '@/lib/db';
import * as serverAuth from '@/lib/auth/server-user';

// Mock localStorage in Node test environment
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Organization Creation API Route (/api/organizations)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    DatabaseService.initialize();
  });

  it('blocks unauthenticated requests with 401 Unauthorized', async () => {
    vi.spyOn(serverAuth, 'getServerAuthUser').mockResolvedValue(null);

    const postReq = new NextRequest('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme Esports' }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');

    const getRes = await GET();
    expect(getRes.status).toBe(401);
    const getBody = await getRes.json();
    expect(getBody.error).toBe('Unauthorized');
  });

  it('returns 400 when organization name is missing or empty', async () => {
    vi.spyOn(serverAuth, 'getServerAuthUser').mockResolvedValue({
      id: 'user-authorized-1',
      email: 'organizer@acme.org',
    });

    const postReq = new NextRequest('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('name is required');
  });

  it('successfully creates an organization for an authorized user', async () => {
    vi.spyOn(serverAuth, 'getServerAuthUser').mockResolvedValue({
      id: 'user-authorized-1',
      email: 'organizer@acme.org',
    });

    const postReq = new NextRequest('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Thunderbolt Gaming Club',
        slug: 'thunderbolt-gaming',
        description: 'Collegiate esports league',
        logo_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e',
      }),
    });

    const res = await POST(postReq);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.organization).toBeDefined();
    expect(body.organization.name).toBe('Thunderbolt Gaming Club');
    expect(body.organization.slug).toBe('thunderbolt-gaming');
    expect(body.organization.owner_id).toBe('user-authorized-1');
  });

  it('lists user organizations for an authorized user', async () => {
    vi.spyOn(serverAuth, 'getServerAuthUser').mockResolvedValue({
      id: 'user-authorized-1',
      email: 'organizer@acme.org',
    });

    // Create an organization first
    const postReq = new NextRequest('http://localhost/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Falcon Athletics' }),
    });
    await POST(postReq);

    const getRes = await GET();
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.organizations)).toBe(true);
    expect(body.organizations.length).toBeGreaterThan(0);
    const created = body.organizations.find((o: { name: string }) => o.name === 'Falcon Athletics');
    expect(created).toBeDefined();
    expect(created.user_role).toBe('owner');
  });
});
