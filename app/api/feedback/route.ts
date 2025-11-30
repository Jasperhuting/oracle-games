import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Feedback } from '@/lib/types/games';

// GET /api/feedback - Get all feedback (admin only)
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

    const feedbackSnapshot = await db.collection('feedback')
      .orderBy('createdAt', 'desc')
      .get();

    const feedback: Feedback[] = [];
    feedbackSnapshot.forEach((doc) => {
      const data = doc.data();
      feedback.push({
        id: doc.id,
        userId: data.userId,
        userEmail: data.userEmail,
        currentPage: data.currentPage,
        message: data.message,
        createdAt: data.createdAt || new Date(),
        status: data.status || 'new',
      });
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, message, currentPage } = body;

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'User ID and message are required' },
        { status: 400 }
      );
    }

    if (message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get user email
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userEmail = userData?.email || 'unknown';

    
    
    const feedbackData: Omit<Feedback, 'id'> = {
      userId,
      userEmail,
      currentPage,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'new',
    };

    const feedbackRef = await db.collection('feedback').add(feedbackData);

    return NextResponse.json({
      success: true,
      id: feedbackRef.id,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/feedback - Update feedback status (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, feedbackId, status, currentPage } = body;

    if (!userId || !feedbackId || !status) {
      return NextResponse.json(
        { error: 'User ID, feedback ID, and status are required' },
        { status: 400 }
      );
    }

    if (!['new', 'reviewed', 'resolved'].includes(status)) {
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

    const updateData: { status: 'new' | 'reviewed' | 'resolved'; currentPage?: string } = {
      status,
    };

    if (typeof currentPage !== 'undefined') {
      updateData.currentPage = currentPage;
    }

    await db.collection('feedback').doc(feedbackId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Feedback status updated successfully'
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedbackId } = body;

    if (!feedbackId) {
      return NextResponse.json(
        { error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin

    await db.collection('feedback').doc(feedbackId).delete();

    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to delete feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}