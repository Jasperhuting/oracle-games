'use client'

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabsProps } from "@/lib/types/component-props";

export const Tabs = ({ tabs, defaultTab }: TabsProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(
    tabFromUrl || defaultTab || tabs[0]?.id
  );

  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabs.some(tab => tab.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, tabs]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`?tab=${tabId}`, { scroll: false });
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="border border-gray-200 bg-white rounded-t-lg overflow-hidden">
        <nav className="flex px-2 overflow-x-auto overflow-y-hidden gap-1 pt-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                whitespace-nowrap
                py-2.5 px-4 rounded-t font-medium text-sm transition-all duration-150
                cursor-pointer border-b-2 select-none
                ${activeTab === tab.id
                  ? 'border-primary text-primary bg-primary/5'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-200'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-6 border border-gray-200 border-t-0">
        {activeTabContent}
      </div>
    </div>
  );
}
