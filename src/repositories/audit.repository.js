import BaseRepository from './base.repository.js';

export class AuditRepository extends BaseRepository {
  constructor() {
    super('adminAuditLog');
  }

  async logAction({ adminUserId, action, entityType, entityId, details, ipAddress, userAgent, tx }) {
    return this.create(
      {
        adminUserId,
        action,
        entityType,
        entityId,
        details,
        ipAddress,
        userAgent,
      },
      { tx }
    );
  }
}

export const auditRepository = new AuditRepository();
export default auditRepository;

