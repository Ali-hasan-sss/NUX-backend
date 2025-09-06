// tests/groupController.test.ts
import request from 'supertest';
import app from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Group Controller API', () => {
  let restaurantTokens: string[] = [];
  let restaurantIds: string[] = [];
  let groupId: string;
  let joinRequestId: string;

  const generateEmail = () => `test${Date.now()}@example.com`;
  const password = 'Test@1234';

  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const email = generateEmail();
      const res = await request(app)
        .post('/api/auth/registerRestaurant')
        .send({
          email,
          password,
          restaurantName: `TestRestaurant${i}`,
          address: `Address${i}`,
          latitude: 0,
          longitude: 0,
        });
      expect([200, 201]).toContain(res.status);
      restaurantTokens.push(res.body.data.tokens.accessToken);
      restaurantIds.push(res.body.data.restaurant.id);
    }
  });

  afterAll(async () => {
    await prisma.groupMembership.deleteMany({
      where: { restaurantId: { in: restaurantIds } },
    });
    await prisma.groupJoinRequest.deleteMany({
      where: { fromRestaurantId: { in: restaurantIds } },
    });
    await prisma.restaurantGroup.deleteMany({
      where: { ownerId: { in: restaurantIds } },
    });
    await prisma.restaurant.deleteMany({
      where: { id: { in: restaurantIds } },
    });
    await prisma.$disconnect();
  });

  it('should create a group', async () => {
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${restaurantTokens[0]}`)
      .send({ name: 'TestGroup', description: 'Group for testing' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.name).toBe('TestGroup');
    groupId = res.body.data.id;
  });

  it('should send a join request', async () => {
    const res = await request(app)
      .post('/api/groups/invite')
      .set('Authorization', `Bearer ${restaurantTokens[0]}`)
      .send({ groupId, toRestaurantId: restaurantIds[1] });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.requestId).toBeDefined();
    joinRequestId = res.body.data.requestId;
  });

  it('should accept the join request', async () => {
    const res = await request(app)
      .put(`/api/groups/respond/${joinRequestId}`)
      .set('Authorization', `Bearer ${restaurantTokens[1]}`)
      .send({ status: 'ACCEPTED' });
    expect([200, 201]).toContain(res.status);
  });

  it('should reject a join request', async () => {
    const email = generateEmail();
    const resNew = await request(app).post('/api/auth/registerRestaurant').send({
      email,
      password,
      restaurantName: 'RejectRestaurant',
      address: 'AddressReject',
      latitude: 0,
      longitude: 0,
    });
    const newRestaurantToken = resNew.body.data.tokens.accessToken;
    const newRestaurantId = resNew.body.data.restaurant.id;
    restaurantTokens.push(newRestaurantToken);
    restaurantIds.push(newRestaurantId);

    const res1 = await request(app)
      .post('/api/groups/invite')
      .set('Authorization', `Bearer ${restaurantTokens[0]}`)
      .send({ groupId, toRestaurantId: newRestaurantId });
    const newRequestId = res1.body.data.requestId;

    const res2 = await request(app)
      .put(`/api/groups/respond/${newRequestId}`)
      .set('Authorization', `Bearer ${newRestaurantToken}`)
      .send({ status: 'REJECTED' });
    expect([200, 201]).toContain(res2.status);
  });

  it('should get group members', async () => {
    const res = await request(app)
      .get(`/api/groups/members/${groupId}`)
      .set('Authorization', `Bearer ${restaurantTokens[0]}`);
    expect([200, 201]).toContain(res.status);

    expect(res.body.data.members.length).toBe(1);
  });
});
