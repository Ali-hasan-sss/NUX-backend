import request from 'supertest';
import app from '../src/app';

describe('Admin Users API', () => {
  let adminToken: string;
  let adminId: string;

  beforeAll(async () => {
    const loginRes = await request(app).post('/api/auth/admin/login').send({
      email: 'admin@example.com',
      password: 'Admin@123',
    });

    if (!loginRes.body.data) {
      throw new Error('Failed to login as admin');
    }

    adminToken = loginRes.body.data.tokens.accessToken;
    adminId = loginRes.body.data.user.id;
  });

  test('GET /admin/users - should get all users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /admin/users with filters - should filter users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .query({ isActive: 'true', isRestaurant: 'false', email: 'admin' })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].email).toContain('admin');
  });

  test('GET /admin/users/:id - should get admin user by ID', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(adminId);
  });

  test('PUT /admin/users/:id - should update admin user', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Updated Admin Name' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Updated Admin Name');
  });

  test('DELETE /admin/users/:id - should fail to delete admin', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).not.toBe(200);
  });
});
