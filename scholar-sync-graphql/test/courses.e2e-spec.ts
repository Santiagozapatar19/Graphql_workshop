import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { gql, resetDatabase } from './gql-helper';

const GQL = '/graphql';

describe('Courses GraphQL (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let createdCourseId: string;
  let enrollmentId: string;

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function signupAndLogin(email: string, password: string, firstName: string, lastName: string) {
    await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token } }`,
          { input: { email, password, firstName, lastName } },
        ),
      );

    const res = await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Login($input: LoginInput!) { login(loginInput: $input) { token } }`,
          { input: { email, password } },
        ),
      );
    return res.body.data.login.token as string;
  }

  async function promoteToAdmin(token: string, userId: string) {
    // Actualizamos roles directamente en BD no es posible desde GraphQL (protegido),
    // así que usamos el repo. En tests reales se haría con el seed SQL.
    // Aquí asumimos que el primer usuario registrado puede recibir admin vía seed.
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
    await resetDatabase(app);

    // Registrar admin (lo ponemos como admin directamente en el repo)
    await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Signup($input: SignUpInput!) { signup(signUpInput: $input) { token user { id } } }`,
          { input: { email: 'admin_courses@e2e.com', password: 'Password123', firstName: 'Admin', lastName: 'E2E' } },
        ),
      );

    // Usamos query directo para promover admin
    const conn = app.get(DataSource);
    await conn.query(
      `UPDATE users SET roles = '{"admin"}' WHERE email = 'admin_courses@e2e.com'`,
    );

    // Login admin
    const adminRes = await request(app.getHttpServer())
      .post(GQL)
      .send(
        gql(
          `mutation Login($input: LoginInput!) { login(loginInput: $input) { token } }`,
          { input: { email: 'admin_courses@e2e.com', password: 'Password123' } },
        ),
      );
    adminToken = adminRes.body.data.login.token;

    // Registrar y loguear student
    studentToken = await signupAndLogin(
      'student_courses@e2e.com',
      'Password123',
      'Student',
      'E2E',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ── createCourse ──────────────────────────────────────────────────────────

  describe('createCourse mutation', () => {
    it('should create a course when admin', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation CreateCourse($input: CreateCourseInput!) {
              createCourse(createCourseInput: $input) {
                id name credits isActive
              }
            }`,
            { input: { name: 'GraphQL 101', credits: 3, description: 'Intro to GraphQL' } },
          ),
        )
        .expect(200);

      expect(res.body.data.createCourse.name).toBe('GraphQL 101');
      expect(res.body.data.createCourse.isActive).toBe(true);
      createdCourseId = res.body.data.createCourse.id;
    });

    it('should return Forbidden when student tries to create a course', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation CreateCourse($input: CreateCourseInput!) {
              createCourse(createCourseInput: $input) { id }
            }`,
            { input: { name: 'Hacked Course', credits: 1 } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].message).toMatch(/Forbidden|role/i);
    });

    it('should return Unauthorized when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation CreateCourse($input: CreateCourseInput!) {
              createCourse(createCourseInput: $input) { id }
            }`,
            { input: { name: 'No Auth Course', credits: 2 } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── courses (findAll) ─────────────────────────────────────────────────────

  describe('courses query', () => {
    it('should return all courses when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(gql(`query { courses { id name credits isActive } }`))
        .expect(200);

      expect(Array.isArray(res.body.data.courses)).toBe(true);
      expect(res.body.data.courses.length).toBeGreaterThan(0);
    });

    it('should return Unauthorized when no token provided', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(gql(`query { courses { id name } }`))
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── course (findOne) ──────────────────────────────────────────────────────

  describe('course query', () => {
    it('should return a course by id', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `query Course($id: ID!) { course(id: $id) { id name credits } }`,
            { id: createdCourseId },
          ),
        )
        .expect(200);

      expect(res.body.data.course.id).toBe(createdCourseId);
      expect(res.body.data.course.name).toBe('GraphQL 101');
    });

    it('should return error when course does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `query Course($id: ID!) { course(id: $id) { id } }`,
            { id: '00000000-0000-0000-0000-000000000000' },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── updateCourse ──────────────────────────────────────────────────────────

  describe('updateCourse mutation', () => {
    it('should update a course when admin', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation UpdateCourse($input: UpdateCourseInput!) {
              updateCourse(updateCourseInput: $input) { id name credits }
            }`,
            { input: { id: createdCourseId, name: 'GraphQL Advanced', credits: 4 } },
          ),
        )
        .expect(200);

      expect(res.body.data.updateCourse.name).toBe('GraphQL Advanced');
      expect(res.body.data.updateCourse.credits).toBe(4);
    });

    it('should return Forbidden when student tries to update a course', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation UpdateCourse($input: UpdateCourseInput!) {
              updateCourse(updateCourseInput: $input) { id }
            }`,
            { input: { id: createdCourseId, name: 'Hacked Name' } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── enrollUser ────────────────────────────────────────────────────────────

  describe('enrollUser mutation', () => {
    it('should enroll the current student in a course', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation EnrollUser($input: EnrollUserInput!) {
              enrollUser(enrollUserInput: $input) {
                id relationType enrolledAt
                course { id name }
                user { id email }
              }
            }`,
            { input: { courseId: createdCourseId } },
          ),
        )
        .expect(200);

      expect(res.body.data.enrollUser.course.id).toBe(createdCourseId);
      expect(res.body.data.enrollUser.relationType).toBe('student');
      enrollmentId = res.body.data.enrollUser.id;
    });

    it('should return ConflictException when already enrolled', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation EnrollUser($input: EnrollUserInput!) {
              enrollUser(enrollUserInput: $input) { id }
            }`,
            { input: { courseId: createdCourseId } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });

    it('should return Unauthorized when no token provided', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(
          gql(
            `mutation EnrollUser($input: EnrollUserInput!) {
              enrollUser(enrollUserInput: $input) { id }
            }`,
            { input: { courseId: createdCourseId } },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── myEnrollments ─────────────────────────────────────────────────────────

  describe('myEnrollments query', () => {
    it('should return enrollments for the authenticated student', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(gql(`query { myEnrollments { id relationType course { id name } } }`))
        .expect(200);

      expect(Array.isArray(res.body.data.myEnrollments)).toBe(true);
      expect(res.body.data.myEnrollments.length).toBeGreaterThan(0);
    });

    it('should return Unauthorized when no token provided', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .send(gql(`query { myEnrollments { id } }`))
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── unenroll ──────────────────────────────────────────────────────────────

  describe('unenroll mutation', () => {
    it('should unenroll the student from a course', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation Unenroll($id: ID!) { unenroll(enrollmentId: $id) { id } }`,
            { id: enrollmentId },
          ),
        )
        .expect(200);

      expect(res.body.data.unenroll.id).toBe(enrollmentId);
    });

    it('should return NotFound when enrollment does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation Unenroll($id: ID!) { unenroll(enrollmentId: $id) { id } }`,
            { id: '00000000-0000-0000-0000-000000000000' },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });

  // ── removeCourse ──────────────────────────────────────────────────────────

  describe('removeCourse mutation', () => {
    it('should soft-delete a course when admin', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(
          gql(
            `mutation RemoveCourse($id: ID!) { removeCourse(id: $id) { id isActive } }`,
            { id: createdCourseId },
          ),
        )
        .expect(200);

      expect(res.body.data.removeCourse.isActive).toBe(false);
    });

    it('should return Forbidden when student tries to remove a course', async () => {
      const res = await request(app.getHttpServer())
        .post(GQL)
        .set('Authorization', `Bearer ${studentToken}`)
        .send(
          gql(
            `mutation RemoveCourse($id: ID!) { removeCourse(id: $id) { id } }`,
            { id: createdCourseId },
          ),
        )
        .expect(200);

      expect(res.body.errors).toBeDefined();
    });
  });
});
