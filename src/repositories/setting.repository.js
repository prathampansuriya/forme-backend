import BaseRepository from './base.repository.js';

export class SettingRepository extends BaseRepository {
  constructor() {
    super('storeSetting');
  }

  async getByKey(key, { tx } = {}) {
    return this.findFirst({ key }, { tx });
  }

  async setKey(key, value, description = null, { tx } = {}) {
    const existing = await this.getByKey(key, { tx });
    if (existing) {
      return this.update(existing.id, { value, ...(description ? { description } : {}) }, { tx });
    }
    return this.create({ key, value, description }, { tx });
  }
}

export const settingRepository = new SettingRepository();
export default settingRepository;

