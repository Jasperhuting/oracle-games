'use client'

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabGroup {
  id: string;
  label: string;
  tabs: Tab[];
}

interface NestedTabsProps {
  groups: TabGroup[];
  defaultGroup?: string;
  defaultTab?: string;
}

export const NestedTabs = ({ groups, defaultGroup, defaultTab }: NestedTabsProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupFromUrl = searchParams.get('group');
  const tabFromUrl = searchParams.get('tab');

  const [activeGroup, setActiveGroup] = useState(
    groupFromUrl || defaultGroup || groups[0]?.id
  );

  const currentGroup = groups.find(g => g.id === activeGroup);
  const [activeTab, setActiveTab] = useState(
    tabFromUrl || defaultTab || currentGroup?.tabs[0]?.id
  );

  // Update active group/tab when URL changes
  useEffect(() => {
    if (groupFromUrl && groups.some(g => g.id === groupFromUrl)) {
      setActiveGroup(groupFromUrl);
    }
  }, [groupFromUrl, groups]);

  useEffect(() => {
    const group = groups.find(g => g.id === activeGroup);
    if (tabFromUrl && group?.tabs.some(tab => tab.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (group) {
      setActiveTab(group.tabs[0]?.id);
    }
  }, [tabFromUrl, activeGroup, groups]);

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    const group = groups.find(g => g.id === groupId);
    const firstTab = group?.tabs[0]?.id;
    setActiveTab(firstTab || '');
    router.push(`?group=${groupId}&tab=${firstTab}`, { scroll: false });
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`?group=${activeGroup}&tab=${tabId}`, { scroll: false });
  };

  const activeTabContent = currentGroup?.tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className="w-full">
      {/* Group Headers (Main Tabs) */}
      <div className="border border-gray-200 bg-white rounded-t-lg">
        <nav className="flex space-x-8 px-6 overflow-x-auto" aria-label="Tab Groups">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => handleGroupChange(group.id)}
              className={`
                whitespace-nowrap
                py-4 px-1 border-b-2 font-semibold text-base transition-colors
                cursor-pointer
                ${activeGroup === group.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {group.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub Tab Headers */}
      {currentGroup && (
        <div className="border-l border-r border-gray-200 bg-gray-50">
          <nav className="flex space-x-6 px-6 overflow-x-auto" aria-label="Sub Tabs">
            {currentGroup.tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  whitespace-nowrap
                  py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  cursor-pointer
                  ${activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-400'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-6 border border-gray-200 -mt-[1px]">
        {activeTabContent}
      </div>
    </div>
  );
}
