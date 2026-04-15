'use client'

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { IconAdjustments, IconX } from "@tabler/icons-react";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import type { User } from "@/lib/types/user";

// dnd-kit
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// Cards
import { CarriereCard } from "./account/CarriereCard";
import { InboxPreview } from "./account/InboxPreview";
import { ActiveGamesCard } from "./account/ActiveGamesCard";
import { AvailableGamesCard } from "./account/AvailableGamesCard";
import { GameRulesCard } from "./account/GameRulesCard";
import { CalendarCard } from "./account/CalendarCard";
import { getProfileCompleteness } from "@/lib/profile/completeness";
import { ProfileCompletenessCard } from "./account/ProfileCompletenessCard";
import { ForumActivityCard } from "./account/ForumActivityCard";
import { ActiveUsersCard } from "./account/ActiveUsersCard";
import { SortableBlock } from "./account/SortableBlock";

// Layout hook
import { useDashboardLayout, type BlockId, type BlockConfig } from "@/hooks/useDashboardLayout";

// ─── Droppable column wrapper ─────────────────────────────────────────────────
function DroppableColumn({ id, children, editMode }: { id: string; children: React.ReactNode; editMode: boolean }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={[
                "space-y-6 min-h-24 rounded-lg transition-colors",
                editMode && isOver ? "bg-blue-50/40 ring-2 ring-blue-200 ring-dashed" : "",
            ].join(" ")}
        >
            {children}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AccountPageContent() {
    const { user } = useAuth();
    const { userData, loading: userDataLoading, refreshUserData, setUserData } = useCurrentUser();
    const { t } = useTranslation();
    const [editMode, setEditMode] = useState(false);
    const [activeId, setActiveId] = useState<BlockId | null>(null);

    const {
        blocks,
        toggleVisibility,
        moveToColumn,
        reorderAndPersist,
    } = useDashboardLayout();

    // Keep a ref to blocks for use inside drag handlers (avoids stale closures)
    const blocksRef = useRef(blocks);
    useEffect(() => { blocksRef.current = blocks; }, [blocks]);

    // ── dnd-kit sensors ───────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as BlockId);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeBlockId = active.id as BlockId;
        const overId = over.id as string;

        const current = blocksRef.current;
        const activeBlock = current.find(b => b.id === activeBlockId);
        if (!activeBlock) return;

        const overColumn: 'left' | 'right' | undefined =
            overId === 'left' || overId === 'right'
                ? overId as 'left' | 'right'
                : current.find(b => b.id === overId)?.column;

        if (overColumn && overColumn !== activeBlock.column) {
            moveToColumn(activeBlockId, overColumn);
        }
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        reorderAndPersist(
            active.id as BlockId,
            over.id as string,
            blocksRef.current,
        );
    }

    // ── Render helpers ────────────────────────────────────────────────────────
    const renderCardContent = (block: BlockConfig) => {
        switch (block.id) {
            case 'carriere':
                return (
                    <CarriereCard
                        userId={user!.uid}
                        playername={userData?.playername || user!.displayName || user!.email?.split('@')[0] || 'User'}
                        dateOfBirth={userData?.dateOfBirth}
                        avatarUrl={userData?.avatarUrl}
                        onAvatarUpdate={(newUrl) => {
                            setUserData((prev: User | null) => prev ? { ...prev, avatarUrl: newUrl } : prev);
                            void refreshUserData();
                        }}
                    />
                );
            case 'inbox':        return <InboxPreview />;
            case 'forum':        return <ForumActivityCard />;
            case 'active-games': return <ActiveGamesCard userId={user!.uid} excludeSportTypes={['f1']} />;
            case 'available-games': return <AvailableGamesCard userId={user!.uid} />;
            case 'rules':        return <GameRulesCard />;
            case 'calendar':     return <CalendarCard userId={user!.uid} />;
            case 'active-users': return <ActiveUsersCard />;
        }
    };

    if (!user) return null;

    if (userDataLoading) {
        return (
            <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px]">
                <div className="mx-auto container">
                    <div className="flex items-center justify-center p-8">
                        <div className="text-gray-600">{t('global.loading')}</div>
                    </div>
                </div>
            </div>
        );
    }

    const completeness = getProfileCompleteness(userData ?? {});
    const leftBlocks  = blocks.filter(b => b.column === 'left');
    const rightBlocks = blocks.filter(b => b.column === 'right');
    const activeBlock = activeId ? blocks.find(b => b.id === activeId) : null;

    return (
        <div className="flex flex-col min-h-screen p-4 md:p-8 mt-[36px]">
            <div className="mx-auto container max-w-7xl">

                {/* Header */}
                <div className="flex flex-row border border-gray-200 mb-6 items-center justify-end bg-white px-6 py-4 rounded-lg">
                    <button
                        onClick={() => setEditMode(v => !v)}
                        className={[
                            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors",
                            editMode
                                ? "bg-gray-900 text-white border-gray-900"
                                : "text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900",
                        ].join(" ")}
                    >
                        {editMode ? <IconX className="w-4 h-4" /> : <IconAdjustments className="w-4 h-4" />}
                        {editMode ? t('account.done') : t('account.layoutMode')}
                    </button>
                </div>

                <h1 className="text-3xl font-bold mb-6">{t('account.myAccount')}</h1>

                {/* Edit mode hint */}
                {editMode && (
                    <p className="text-sm text-gray-500 mb-4 -mt-3">
                        {t('account.layoutHint')}
                    </p>
                )}

                {/* Profile completeness — always visible, not draggable */}
                <ProfileCompletenessCard completeness={completeness} uid={user.uid} />

                {/* Dashboard grid */}
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left column */}
                        <SortableContext
                            items={leftBlocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <DroppableColumn id="left" editMode={editMode}>
                                {leftBlocks.map(block => (
                                    <SortableBlock
                                        key={block.id}
                                        id={block.id}
                                        label={block.label}
                                        editMode={editMode}
                                        visible={block.visible}
                                        onToggle={() => toggleVisibility(block.id)}
                                    >
                                        {renderCardContent(block)}
                                    </SortableBlock>
                                ))}
                            </DroppableColumn>
                        </SortableContext>

                        {/* Right column */}
                        <SortableContext
                            items={rightBlocks.map(b => b.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <DroppableColumn id="right" editMode={editMode}>
                                {rightBlocks.map(block => (
                                    <SortableBlock
                                        key={block.id}
                                        id={block.id}
                                        label={block.label}
                                        editMode={editMode}
                                        visible={block.visible}
                                        onToggle={() => toggleVisibility(block.id)}
                                    >
                                        {renderCardContent(block)}
                                    </SortableBlock>
                                ))}
                            </DroppableColumn>
                        </SortableContext>
                    </div>

                    {/* Drag overlay — shows a ghost while dragging */}
                    <DragOverlay>
                        {activeBlock ? (
                            <div className="rounded-lg border border-blue-300 bg-blue-50 shadow-xl px-4 py-3 flex items-center gap-2 text-sm font-medium text-blue-700">
                                <IconAdjustments className="w-4 h-4 shrink-0" />
                                {activeBlock.label}
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}
