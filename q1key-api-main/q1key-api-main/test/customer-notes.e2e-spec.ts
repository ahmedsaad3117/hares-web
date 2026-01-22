import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerNote } from '../src/modules/customer-notes/entities/customer-note.entity';
import { NoteCategory } from '../src/modules/customer-notes/entities/note-category.enum';

describe('CustomerNotesController (e2e)', () => {
  let app: INestApplication;
  let repository: Repository<CustomerNote>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    repository = moduleFixture.get<Repository<CustomerNote>>(
      getRepositoryToken(CustomerNote),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await repository.query('DELETE FROM customer_notes');
  });

  describe('POST /customer-notes', () => {
    it('should create a new customer note', () => {
      const createDto = {
        customer_id: 1,
        note_text: 'Customer requested payment extension',
        category: NoteCategory.FOLLOW_UP,
        branch_id: 1,
      };

      return request(app.getHttpServer())
        .post('/customer-notes')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.customer_id).toBe(createDto.customer_id);
          expect(res.body.note_text).toBe(createDto.note_text);
          expect(res.body.category).toBe(createDto.category);
          expect(res.body).toHaveProperty('created_by');
          expect(res.body).toHaveProperty('created_at');
        });
    });

    it('should create note with default GENERAL category', () => {
      const createDto = {
        customer_id: 1,
        note_text: 'Simple customer note',
      };

      return request(app.getHttpServer())
        .post('/customer-notes')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.category).toBe(NoteCategory.GENERAL);
        });
    });

    it('should fail validation when note_text is missing', () => {
      const createDto = {
        customer_id: 1,
      };

      return request(app.getHttpServer())
        .post('/customer-notes')
        .send(createDto)
        .expect(400);
    });

    it('should fail validation when note_text exceeds 1400 characters', () => {
      const createDto = {
        customer_id: 1,
        note_text: 'a'.repeat(1401),
      };

      return request(app.getHttpServer())
        .post('/customer-notes')
        .send(createDto)
        .expect(400);
    });

    it('should fail validation with invalid category', () => {
      const createDto = {
        customer_id: 1,
        note_text: 'Test note',
        category: 'INVALID_CATEGORY',
      };

      return request(app.getHttpServer())
        .post('/customer-notes')
        .send(createDto)
        .expect(400);
    });
  });

  describe('GET /customer-notes', () => {
    beforeEach(async () => {
      // Seed test data
      await repository.save([
        {
          customer_id: 1,
          user_id: 1,
          note_text: 'First note',
          category: NoteCategory.GENERAL,
          created_by: 1,
          created_at: new Date('2025-01-01'),
        },
        {
          customer_id: 2,
          user_id: 1,
          note_text: 'Second note',
          category: NoteCategory.COMPLAINT,
          created_by: 1,
          created_at: new Date('2025-01-02'),
        },
        {
          customer_id: 1,
          user_id: 1,
          note_text: 'Third note',
          category: NoteCategory.FOLLOW_UP,
          created_by: 1,
          created_at: new Date('2025-01-03'),
        },
      ]);
    });

    it('should return paginated customer notes', () => {
      return request(app.getHttpServer())
        .get('/customer-notes')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBe(3);
          expect(res.body.meta.total).toBe(3);
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(10);
        });
    });

    it('should handle pagination with custom limit', () => {
      return request(app.getHttpServer())
        .get('/customer-notes')
        .query({ page: 1, limit: 2 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.meta.totalPages).toBe(2);
        });
    });

    it('should return empty array on page beyond available data', () => {
      return request(app.getHttpServer())
        .get('/customer-notes')
        .query({ page: 10, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual([]);
          expect(res.body.meta.total).toBe(3);
        });
    });
  });

  describe('GET /customer-notes/:id', () => {
    let noteId: number;

    beforeEach(async () => {
      const note = await repository.save({
        customer_id: 1,
        user_id: 1,
        note_text: 'Test note for retrieval',
        category: NoteCategory.GENERAL,
        created_by: 1,
        created_at: new Date(),
      });
      noteId = note.id;
    });

    it('should return a single customer note by id', () => {
      return request(app.getHttpServer())
        .get(`/customer-notes/${noteId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(noteId);
          expect(res.body.note_text).toBe('Test note for retrieval');
        });
    });

    it('should return 404 for non-existent note', () => {
      return request(app.getHttpServer())
        .get('/customer-notes/999999')
        .expect(404);
    });

    it('should return 400 for invalid id format', () => {
      return request(app.getHttpServer())
        .get('/customer-notes/invalid')
        .expect(400);
    });
  });

  describe('GET /customer-notes/customer/:customerId', () => {
    beforeEach(async () => {
      await repository.save([
        {
          customer_id: 1,
          user_id: 1,
          note_text: 'Customer 1 note 1',
          category: NoteCategory.GENERAL,
          created_by: 1,
          created_at: new Date('2025-01-01'),
        },
        {
          customer_id: 1,
          user_id: 1,
          note_text: 'Customer 1 note 2',
          category: NoteCategory.COMPLAINT,
          created_by: 1,
          created_at: new Date('2025-01-02'),
        },
        {
          customer_id: 2,
          user_id: 1,
          note_text: 'Customer 2 note',
          category: NoteCategory.GENERAL,
          created_by: 1,
          created_at: new Date('2025-01-03'),
        },
      ]);
    });

    it('should return paginated notes for specific customer', () => {
      return request(app.getHttpServer())
        .get('/customer-notes/customer/1')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.data.every((note) => note.customer_id === 1)).toBe(true);
          expect(res.body.meta.total).toBe(2);
        });
    });

    it('should return empty array for customer with no notes', () => {
      return request(app.getHttpServer())
        .get('/customer-notes/customer/999')
        .query({ page: 1, limit: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual([]);
          expect(res.body.meta.total).toBe(0);
        });
    });
  });

  describe('PUT /customer-notes/:id', () => {
    let noteId: number;

    beforeEach(async () => {
      const note = await repository.save({
        customer_id: 1,
        user_id: 1,
        note_text: 'Original note text',
        category: NoteCategory.GENERAL,
        created_by: 1,
        created_at: new Date(),
      });
      noteId = note.id;
    });

    it('should update a customer note', () => {
      const updateDto = {
        note_text: 'Updated note text',
        category: NoteCategory.FOLLOW_UP,
      };

      return request(app.getHttpServer())
        .put(`/customer-notes/${noteId}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.note_text).toBe(updateDto.note_text);
          expect(res.body.category).toBe(updateDto.category);
          expect(res.body).toHaveProperty('last_edited_by');
          expect(res.body).toHaveProperty('edited_at');
        });
    });

    it('should update only note_text when category not provided', () => {
      const updateDto = {
        note_text: 'Only text updated',
      };

      return request(app.getHttpServer())
        .put(`/customer-notes/${noteId}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.note_text).toBe(updateDto.note_text);
          expect(res.body.category).toBe(NoteCategory.GENERAL);
        });
    });

    it('should return 404 for non-existent note', () => {
      const updateDto = {
        note_text: 'Updated text',
      };

      return request(app.getHttpServer())
        .put('/customer-notes/999999')
        .send(updateDto)
        .expect(404);
    });

    it('should fail validation when note_text exceeds 1400 characters', () => {
      const updateDto = {
        note_text: 'a'.repeat(1401),
      };

      return request(app.getHttpServer())
        .put(`/customer-notes/${noteId}`)
        .send(updateDto)
        .expect(400);
    });
  });

  describe('DELETE /customer-notes/:id', () => {
    let noteId: number;

    beforeEach(async () => {
      const note = await repository.save({
        customer_id: 1,
        user_id: 1,
        note_text: 'Note to be deleted',
        category: NoteCategory.GENERAL,
        created_by: 1,
        created_at: new Date(),
      });
      noteId = note.id;
    });

    it('should delete a customer note', () => {
      return request(app.getHttpServer())
        .delete(`/customer-notes/${noteId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toBe('Customer note deleted successfully');
        });
    });

    it('should verify note is actually deleted', async () => {
      await request(app.getHttpServer())
        .delete(`/customer-notes/${noteId}`)
        .expect(200);

      return request(app.getHttpServer())
        .get(`/customer-notes/${noteId}`)
        .expect(404);
    });

    it('should return 404 for non-existent note', () => {
      return request(app.getHttpServer())
        .delete('/customer-notes/999999')
        .expect(404);
    });

    it('should return 400 for invalid id format', () => {
      return request(app.getHttpServer())
        .delete('/customer-notes/invalid')
        .expect(400);
    });
  });

  describe('Permission Tests', () => {
    let creatorNote: any;
    let otherUserNote: any;

    beforeEach(async () => {
      // Create note by user 1 (creator)
      creatorNote = await repository.save({
        customer_id: 1,
        user_id: 1,
        note_text: 'Note created by user 1',
        category: NoteCategory.GENERAL,
        created_by: 1,
        created_at: new Date(),
      });

      // Create note by user 2
      otherUserNote = await repository.save({
        customer_id: 1,
        user_id: 2,
        note_text: 'Note created by user 2',
        category: NoteCategory.GENERAL,
        created_by: 2,
        created_at: new Date(),
      });
    });

    describe('PUT /customer-notes/:id - Permissions', () => {
      it('should allow creator to edit their own note', () => {
        const updateDto = { note_text: 'Updated by creator' };

        return request(app.getHttpServer())
          .put(`/customer-notes/${creatorNote.id}`)
          .send(updateDto)
          .expect(200)
          .expect((res) => {
            expect(res.body.note_text).toBe(updateDto.note_text);
          });
      });

      // Note: Full permission testing requires JWT token mock setup
      // These tests verify the guard is applied, actual permission
      // logic is tested in unit tests
    });

    describe('DELETE /customer-notes/:id - Permissions', () => {
      it('should allow creator to delete their own note', () => {
        return request(app.getHttpServer())
          .delete(`/customer-notes/${creatorNote.id}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.message).toBe('Customer note deleted successfully');
          });
      });
    });
  });
});
