// Script to fix order values for existing todos
// Run with: node scripts/fix-todo-orders.js

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixTodoOrders() {
  try {
    console.log('Fetching all todos...');
    const snapshot = await db.collection('adminTodos').get();

    console.log(`Found ${snapshot.size} todos`);

    // Group todos by status
    const todosByStatus = {
      todo: [],
      in_progress: [],
      done: []
    };

    snapshot.forEach(doc => {
      const data = doc.data();
      const status = data.status || 'todo';
      todosByStatus[status].push({
        id: doc.id,
        ...data
      });
    });

    console.log('Todos by status:', {
      todo: todosByStatus.todo.length,
      in_progress: todosByStatus.in_progress.length,
      done: todosByStatus.done.length
    });

    // Update orders for each status
    const batch = db.batch();
    let updateCount = 0;

    for (const [status, todos] of Object.entries(todosByStatus)) {
      console.log(`\nProcessing ${status} todos...`);

      // Sort by existing order (if present), then by createdAt
      todos.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.createdAt && b.createdAt) {
          return a.createdAt.toMillis() - b.createdAt.toMillis();
        }
        return 0;
      });

      // Assign new sequential orders
      todos.forEach((todo, index) => {
        const ref = db.collection('adminTodos').doc(todo.id);
        const oldOrder = todo.order;
        const newOrder = index;

        if (oldOrder !== newOrder) {
          console.log(`  ${todo.title}: order ${oldOrder} -> ${newOrder}`);
          batch.update(ref, { order: newOrder });
          updateCount++;
        } else {
          console.log(`  ${todo.title}: order ${newOrder} (unchanged)`);
        }
      });
    }

    if (updateCount > 0) {
      console.log(`\nCommitting ${updateCount} updates...`);
      await batch.commit();
      console.log('✅ Done!');
    } else {
      console.log('\n✅ No updates needed - all orders are correct!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTodoOrders();
