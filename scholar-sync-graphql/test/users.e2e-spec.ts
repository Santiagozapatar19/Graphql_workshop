import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { gql } from './gql-helper';

const GQL = '/graphql';

describe('Users GraphQL (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Crear admin
    const adminSignup = await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { user { id } } }`,
          { input: { email: 'admin_users@e2e.com', password: 'Password123', firstName: 'Admin', lastName: 'Users' } },
        ),
      );

    // Promover a admin via SQL
    const ds = app.get(DataSource);
    await ds.query(`UPDATE users SET roles = '{"admin"}' WHERE email = 'admin_users@e2e.com'`);

    // Login admin
    const adminLogin = await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Login($input: LoginInput!) { login(loginInput: $input) { token } }`,
          { input: { email: 'admin_users@e2e.com', password: 'Password123' } },
        ),
      );
    adminToken = adminLogin.body.data.login.token;

    // Crear student
    const studentSignup = await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token user { id } } }`,
          { input: { email: 'student_users@e2e.com', password: 'Password123', firstName: 'Student', lastName: 'Users' } },
        ),
      );
    studentToken = studentSignup.body.data.signup.token;
    studentId = studentSignup.body.data.signup.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── me query ──────────────────────────────────────────────────────────────

  describe('me query', () => {
    it('should return the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(gql(`query { me { id email firstName lastName roles } }`))
        .expect(200);

      expect(res.body.data.me.email).toBe('student_users@e2e.com');
      expect(res.body.data.me.roles).toContain('student');
    });

    it('should return Unauthorized when no token', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(gql(`query { me { id } }`))
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── users query (admin only) ──────────────────────────────────────────────

  describe('users query', () => {
    it('should return all users when admin', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(gql(`query { users { id email roles isActive } }`))
        .expect(200);

      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    it('should return Forbidden when student tries to list all users', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(gql(`query { users { id email } }`))
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toMatch(/Forbidden|role/i);
    });

    it('should return Unauthorized when no token', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(gql(`query { users { id } }`))
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── user query ────────────────────────────────────────────────────────────

  describe('user query', () => {
    it('should return a user by id when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `query User($id: ID!) { user(id: $id) { id email firstName } }`,
            { id: studentId },
          ),
        )
        .expect(200);

      expect(res.body.data.user.id).toBe(studentId);
    });

    it('should return error when user does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `query User($id: ID!) { user(id: $id) { id } }`,
            { id: '00000000-0000-0000-0000-000000000000' },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── updateUser mutation ───────────────────────────────────────────────────

  describe('updateUser mutation', () => {
    it('should allow a student to update their own profile', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(updateUserInput: $input) { id firstName }
            }`,
            { input: { id: studentId, firstName: 'UpdatedName' } },
          ),
        )
        .expect(200);

      expect(res.body.data.updateUser.firstName).toBe('UpdatedName');
    });

    it('should return Unauthorized when student tries to update another user', async () => {
      // Obtener ID del admin
      const adminRes = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(gql(`query { me { id } }`));
      const adminId = adminRes.body.data.me.id;

      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(updateUserInput: $input) { id }
            }`,
            { input: { id: adminId, firstName: 'Hacked' } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });

    it('should allow admin to update any user', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation UpdateUser($input: UpdateUserInput!) {
              updateUser(updateUserInput: $input) { id lastName }
            }`,
            { input: { id: studentId, lastName: 'AdminUpdated' } },
          ),
        )
        .expect(200);

      expect(res.body.data.updateUser.lastName).toBe('AdminUpdated');
    });
  });

  // ── removeUser mutation ───────────────────────────────────────────────────

  describe('removeUser mutation', () => {
    it('should return Forbidden when student tries to remove a user', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation RemoveUser($id: ID!) { removeUser(id: $id) { id isActive } }`,
            { id: studentId },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });

    it('should soft-delete a user when admin', async () => {
      // Crear usuario temporal para eliminar
      const temp = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { user { id } } }`,
            { input: { email: 'temp_delete@e2e.com', password: 'Password123', firstName: 'Temp', lastName: 'Del' } },
          ),
        );
      const tempId = temp.body.data.signup.user.id;

      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation RemoveUser($id: ID!) { removeUser(id: $id) { id isActive } }`,
            { id: tempId },
          ),
        )
        .expect(200);

      expect(res.body.data.removeUser.isActive).toBe(false);
    });

    it('should return error when user does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation RemoveUser($id: ID!) { removeUser(id: $id) { id } }`,
            { id: '00000000-0000-0000-0000-000000000000' },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });
});
