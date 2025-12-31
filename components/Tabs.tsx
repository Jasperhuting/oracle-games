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
      <div className="border border-gray-200 bg-white rounded-t-lg">
        <nav className="flex space-x-8 px-6 overflow-y-scroll" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                whitespace-nowrap
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                cursor-pointer
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg p-6 border border-gray-200 -mt-[1px]">
        {activeTabContent}
      </div>
    </div>
  );
}
