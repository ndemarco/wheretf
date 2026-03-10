import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';

describe('test infrastructure', () => {
  it('connects to in-memory MongoDB', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('can create and query a collection', async () => {
    const TestSchema = new mongoose.Schema({ name: String });
    const TestModel = mongoose.model('Test', TestSchema);
    await TestModel.create({ name: 'smoke' });
    const found = await TestModel.findOne({ name: 'smoke' });
    expect(found).not.toBeNull();
    expect(found!.name).toBe('smoke');
  });
});
