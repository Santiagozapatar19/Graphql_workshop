import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { gql, resetDatabase } from './gql-helper';

const GQL = '/graphql';

describe('Auth GraphQL (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── signup ────────────────────────────────────────────────────────────────

  describe('signup mutation', () => {
    it('should register a new user and return a token', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) {
              signup(signUpInput: $input) {
                token
                user { id email firstName lastName roles isActive }
              }
            }`,
            {
              input: {
                email: 'test_signup@e2e.com',
                password: 'Password123',
                firstName: 'Test',
                lastName: 'User',
              },
            },
          ),
        )
        .expect(200);

      expect(res.body.data.signup.token).toBeDefined();
      expect(res.body.data.signup.user.email).toBe('test_signup@e2e.com');
      expect(res.body.data.signup.user.roles).toContain('student');
    });

    it('should return error when email is already taken', async () => {
      // Primer signup
      await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token } }`,
            { input: { email: 'dup@e2e.com', password: 'Password123', firstName: 'A', lastName: 'B' } },
          ),
        );

      // Segundo signup con el mismo email
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token } }`,
            { input: { email: 'dup@e2e.com', password: 'Password123', firstName: 'A', lastName: 'B' } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });

    it('should return validation error for invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token } }`,
            { input: { email: 'not-an-email', password: 'Password123', firstName: 'A', lastName: 'B' } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login mutation', () => {
    const email = 'login_test@e2e.com';
    const password = 'Password123';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token } }`,
            { input: { email, password, firstName: 'Login', lastName: 'Test' } },
          ),
        );
    });

    it('should return a token with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Login($input: LoginInput!) {
              login(loginInput: $input) { token user { id email roles } }
            }`,
            { input: { email, password } },
          ),
        )
        .expect(200);

      expect(res.body.data.login.token).toBeDefined();
      expect(res.body.data.login.user.email).toBe(email);
    });

    it('should return Unauthorized with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation Login($input: LoginInput!) { login(loginInput: $input) { token } }`,
            { input: { email, password: 'WrongPass123' } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });
});
