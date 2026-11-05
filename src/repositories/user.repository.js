import BaseRepository from './base.repository.js';

export class UserRepository extends BaseRepository {
  constructor() {
    super('user');
  }

  async findByEmail(email, { select, include, tx } = {}) {
    return this.findFirst({ email: email.toLowerCase() }, { select, include, tx });
  }

  async findByGoogleId(googleId, { select, include, tx } = {}) {
    return this.findFirst({ googleId }, { select, include, tx });
  }

  async updateLastLogin(id, { tx } = {}) {
    return this.update(id, { lastLoginAt: new Date() }, { tx });
  }
}

export const userRepository = new UserRepository();
export default userRepository;

