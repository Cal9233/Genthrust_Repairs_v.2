// Load env FIRST before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamic import AFTER env is loaded
  const { db, pool } = await import('../src/lib/db');
  const { notificationQueue } = await import('../src/lib/schema');
  const { eq } = await import('drizzle-orm');

  console.log('\n=== USERS TABLE ===');
  const [usersRows] = await pool.query('SELECT id, email FROM users');
  console.table(usersRows);

  console.log('\n=== PENDING NOTIFICATIONS (first 15) ===');
  const pendingNotifications = await db
    .select({
      id: notificationQueue.id,
      status: notificationQueue.status,
      userId: notificationQueue.userId,
      repairOrderId: notificationQueue.repairOrderId,
    })
    .from(notificationQueue)
    .where(eq(notificationQueue.status, 'PENDING_APPROVAL'))
    .limit(15);

  console.table(pendingNotifications);

  console.log('\n=== SUMMARY ===');
  const uniqueUserIds = [...new Set(pendingNotifications.map(n => n.userId))];
  console.log('Unique userIds in pending notifications:', uniqueUserIds);

  await pool.end();
}

main().catch(console.error);
