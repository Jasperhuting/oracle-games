export const DEFAULT_FORUM_TOPIC_TEMPLATES = [
  {
    title: 'Algemeen',
    body: '<p>Algemene discussie over dit spel.</p>',
  },
  {
    title: 'Vragen & hulp',
    body: '<p>Stel hier je vragen over regels, opstelling of gameplay.</p>',
  },
  {
    title: 'Teampresentatie',
    body: '<p>Stel hier je team voor en licht je keuzes toe.</p>',
  },
  {
    title: 'Blessures & afwezigen',
    body: '<p>Bespreek hier wie afwezig, geblesseerd of twijfelachtig is.</p>',
  },
  {
    title: 'Tactiek & opstelling',
    body: '<p>Welke tactiek of opstelling overweeg je voor deze speelronde?</p>',
  },
  {
    title: 'Transfers & geruchten',
    body: '<p>Praat hier over transfers, wissels en opvallende geruchten.</p>',
  },
] as const;

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function ensureDefaultForumTopicsForGame({
  db,
  gameId,
  userId,
}: {
  db: FirebaseFirestore.Firestore;
  gameId: string;
  userId: string;
}): Promise<{ created: number; skipped: number }> {
  const snapshot = await db.collection('forum_topics').where('gameId', '==', gameId).get();

  const existingTitles = new Set(
    snapshot.docs
      .map((doc) => doc.data())
      .filter((data) => !data.deleted)
      .map((data) => normalizeTitle(String(data.title || '')))
      .filter(Boolean)
  );

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const template of DEFAULT_FORUM_TOPIC_TEMPLATES) {
    const key = normalizeTitle(template.title);
    if (existingTitles.has(key)) {
      skipped += 1;
      continue;
    }

    const plainPreview = template.body.replace(/<[^>]*>/g, '').trim().slice(0, 140);
    await db.collection('forum_topics').add({
      categoryId: null,
      categorySlug: null,
      gameId,
      title: template.title,
      body: template.body,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      replyCount: 0,
      lastReplyAt: now,
      lastReplyPreview: plainPreview || null,
      lastReplyUserId: userId,
      pinned: false,
      status: 'open',
      deleted: false,
    });

    existingTitles.add(key);
    created += 1;
  }

  return { created, skipped };
}
