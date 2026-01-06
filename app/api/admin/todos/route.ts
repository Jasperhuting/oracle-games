import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export interface AdminTodo {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  category: string;
  order: number;
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// GET /api/admin/todos - Get all admin todos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const todosSnapshot = await db.collection('adminTodos')
      .orderBy('order', 'asc')
      .get();

    const todos: AdminTodo[] = [];
    todosSnapshot.forEach((doc) => {
      const data = doc.data();
      todos.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category || 'global',
        order: data.order,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        assigneeEmail: data.assigneeEmail,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    return NextResponse.json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch todos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/todos - Create a new todo
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, category } = body;

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'User ID and title are required' },
        { status: 400 }
      );
    }

    if (title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title cannot be empty' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get the current max order for 'todo' status to add the new todo at the end
    const todosSnapshot = await db.collection('adminTodos')
      .where('status', '==', 'todo')
      .orderBy('order', 'desc')
      .limit(1)
      .get();

    let maxOrder = -1;
    todosSnapshot.forEach((doc) => {
      maxOrder = doc.data().order;
    });

    const now = Timestamp.now();
    const todoData = {
      title: title.trim(),
      status: 'todo' as const,
      category: category || 'global',
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    const todoRef = await db.collection('adminTodos').add(todoData);

    return NextResponse.json({
      success: true,
      id: todoRef.id,
      todo: {
        id: todoRef.id,
        ...todoData,
      }
    });
  } catch (error) {
    console.error('Error creating todo:', error);
    return NextResponse.json(
      { error: 'Failed to create todo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/todos - Update a todo (title, description, status, category, or order)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, todoId, title, description, status, category, order, assigneeId, assigneeName, assigneeEmail } = body;

    if (!userId || !todoId) {
      return NextResponse.json(
        { error: 'User ID and todo ID are required' },
        { status: 400 }
      );
    }

    if (status && !['todo', 'in_progress', 'done'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const updateData: {
      title?: string;
      description?: string;
      status?: 'todo' | 'in_progress' | 'done';
      category?: string;
      order?: number;
      assigneeId?: string | null;
      assigneeName?: string | null;
      assigneeEmail?: string | null;
      updatedAt: Timestamp;
    } = {
      updatedAt: Timestamp.now(),
    };

    if (title !== undefined) {
      if (title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description.trim();
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    if (category !== undefined) {
      updateData.category = category;
    }

    if (order !== undefined) {
      updateData.order = order;
    }

    if (assigneeId !== undefined) {
      updateData.assigneeId = assigneeId;
      updateData.assigneeName = assigneeName || null;
      updateData.assigneeEmail = assigneeEmail || null;
    }

    await db.collection('adminTodos').doc(todoId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Todo updated successfully'
    });
  } catch (error) {
    console.error('Error updating todo:', error);
    return NextResponse.json(
      { error: 'Failed to update todo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/todos - Delete a todo
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, todoId } = body;

    if (!userId || !todoId) {
      return NextResponse.json(
        { error: 'User ID and todo ID are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    await db.collection('adminTodos').doc(todoId).delete();

    return NextResponse.json({
      success: true,
      message: 'Todo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting todo:', error);
    return NextResponse.json(
      { error: 'Failed to delete todo', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
